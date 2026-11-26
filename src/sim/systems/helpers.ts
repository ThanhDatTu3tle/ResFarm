import { rand, randInt } from '../../core/rng';
import { spend } from '../helpers';
import { roomOf } from '../layout';
import { kitchenTierOf } from './kitchen';
import type { HelperJob, HelperState } from '../state';
import { fail, ok, type SimContext, type System } from '../types';
import { dropWork } from './crew';
import { needOf, readyOrders, taskTaken } from './service';

/**
 * NHÂN VIÊN PHỤC VỤ THUÊ THÊM — mỗi bậc hạng quán (từ hạng 2) thêm 1 chỗ, tối đa 4 người.
 *  - Người chơi giao việc: bưng món (serve), mang menu + ghi món (menu), dọn bàn (clean), lau sàn (mop).
 *    Nhân viên rảnh thì tự nhận việc đang chờ theo thứ tự đó; đi lại / làm việc dùng chung luật với bồi bàn (service.ts).
 *  - Năng lượng, xỉu, giờ nghỉ ra chợ ăn: chung cho cả đội — xem systems/crew.ts.
 *  - Từ 2 nhân viên (giai đoạn 15): người thuê đầu tiên là quản lý (mặc vest); mỗi người GIỮ MỘT BÀN (`focus`): mang menu cho bàn
 *    nào thì chỉ ghi món, bưng món cho bàn đó, khách về thì dọn luôn rồi mới nhận bàn mới. Mỗi sáng có thể 1 người bệnh nghỉ (`sick`).
 */
export const helperSystem: System = {
  id: 'helpers',
  update(ctx) {
    const r = ctx.state.restaurant;
    // Xỉu / bệnh / ra chợ: bỏ bàn đang giữ cho người khác nhận
    for (const h of r.helpers) if (h.focus && (h.fainted || h.sick || ctx.state.crew.restaurantAway)) h.focus = null;
    if (ctx.state.crew.restaurantAway) return;
    const focused = teamMode(ctx);
    for (const h of r.helpers) if (!h.fainted && !h.sick && !h.tasks.length) (focused ? pickFocused : pickTask)(ctx, h);
  },
  onDayStart(ctx) {
    const { state, content } = ctx;
    const hs = state.restaurant.helpers;
    for (const h of hs) {
      h.sick = false;
      h.focus = null;
    }
    // Từ 2 nhân viên: thỉnh thoảng có người bệnh xin nghỉ một ngày
    if (hs.length >= 2 && rand(state.rng) < content.balance.helpers.sickChance) {
      const h = hs[randInt(state.rng, 0, hs.length - 1)];
      h.sick = true;
      ctx.bus.emit('helper/sick', { id: h.id, name: h.name });
    }
  },
  commands: {
    'helper/hire'(ctx) {
      const { state, content } = ctx;
      const r = state.restaurant;
      const b = content.balance.helpers;
      if (r.helpers.length >= maxHelpers(ctx)) return fail(r.tier >= content.room.tiers.length ? 'Đã đủ nhân viên.' : 'Nâng hạng quán hoặc hạng bếp để thuê thêm nhân viên.');
      if (!spend(ctx, b.hireCost)) return fail('Không đủ tiền.');
      const used = new Set(r.helpers.map((h) => h.name));
      const name = b.names.find((n) => !used.has(n)) ?? `Nhân viên ${r.helpers.length + 1}`;
      const door = { x: roomOf(ctx).width / 2, y: roomOf(ctx).dining.y2 };
      r.helpers.push({ id: `h${state.nextId++}`, name, look: r.helpers.length, ...door, tasks: [], carrying: [], jobs: { serve: true, menu: true, clean: true, mop: true }, energy: content.balance.crew.maxEnergy, fainted: false });
      return ok();
    },
    'helper/fire'(ctx, cmd) {
      const h = find(ctx, cmd.helperId);
      if (!h) return fail('Không có nhân viên này.');
      dropWork(ctx, h);
      ctx.state.restaurant.helpers = ctx.state.restaurant.helpers.filter((x) => x !== h);
      return ok();
    },
    'helper/setJob'(ctx, cmd) {
      const h = find(ctx, cmd.helperId);
      if (!h) return fail('Không có nhân viên này.');
      h.jobs[cmd.job] = cmd.on;
      return ok();
    },
  },
};

/** Từ 2 nhân viên trở lên: mỗi người giữ một bàn, người đầu tiên làm quản lý. */
export function teamMode(ctx: SimContext): boolean {
  return ctx.state.restaurant.helpers.length >= 2;
}

/** Nhân viên này là quản lý (người thuê đầu tiên, khi đã có từ 2 nhân viên). */
export function isManager(ctx: SimContext, helperId: string): boolean {
  return teamMode(ctx) && ctx.state.restaurant.helpers[0]?.id === helperId;
}

/** Bàn (nhóm khách) này đang có nhân viên khác giữ. */
function heldByOther(ctx: SimContext, h: HelperState, partyId: number): boolean {
  return ctx.state.restaurant.helpers.some((x) => x !== h && !x.sick && !x.fainted && x.focus?.partyId === partyId);
}

/**
 * Chế độ giữ bàn: đang giữ bàn thì chỉ làm việc của bàn đó (menu → ghi món → bưng → dọn); rảnh tay thì nhận bàn mới đang chờ
 * menu, hoặc làm giúp việc của bàn không ai giữ (người chơi đã mang menu), cuối cùng mới lau sàn.
 */
function pickFocused(ctx: SimContext, h: HelperState): void {
  const r = ctx.state.restaurant;
  const can = (job: HelperJob) => h.jobs[job];
  if (h.focus) {
    const party = r.parties.find((p) => p.id === h.focus!.partyId);
    if (party) {
      if (can('menu') && needOf(party)) {
        const kind = needOf(party) === 'menu' ? 'menu' : 'takeOrder';
        party.called = true;
        h.tasks.push({ kind, partyId: party.id });
        return;
      }
      const ready = can('serve') ? readyOrders(ctx).filter((o) => o.partyId === party.id) : [];
      if (ready.length) {
        h.tasks.push({ kind: 'deliver', orderIds: ready.map((o) => o.id), partyId: party.id });
        return;
      }
      return; // khách đang chờ món / đang ăn: đứng chờ, không bỏ bàn
    }
    // Khách về: dọn bàn mình giữ rồi mới rảnh tay
    const tableId = h.focus.tableId;
    h.focus = null;
    if (can('clean') && r.dirty[tableId]?.length && !taskTaken(ctx, (x) => x.kind === 'clean' && x.tableId === tableId)) {
      h.tasks.push({ kind: 'clean', tableId });
      return;
    }
  }
  if (can('menu')) {
    const party = r.parties.find((p) => p.tableId && needOf(p) && !heldByOther(ctx, h, p.id));
    if (party) {
      const kind = needOf(party) === 'menu' ? 'menu' : 'takeOrder';
      party.called = true;
      h.focus = { partyId: party.id, tableId: party.tableId! };
      h.tasks.push({ kind, partyId: party.id });
      return;
    }
  }
  if (can('serve') && takeHandoff(ctx, h)) return;
  if (can('serve')) {
    // Món của bàn không ai giữ (người chơi tự phục vụ bàn đó) vẫn bưng giúp
    const ready = readyOrders(ctx).filter((o) => o.takeoutId == null && !heldByOther(ctx, h, o.partyId));
    if (ready.length) {
      const partyId = ready[0].partyId;
      h.tasks.push({ kind: 'deliver', orderIds: ready.filter((o) => o.partyId === partyId).map((o) => o.id), partyId });
      return;
    }
  }
  if (can('clean')) {
    const held = new Set(r.helpers.filter((x) => x !== h && x.focus).map((x) => x.focus!.tableId));
    const id = Object.keys(r.dirty).find((t) => r.dirty[t]?.length && !held.has(t) && !taskTaken(ctx, (x) => x.kind === 'clean' && x.tableId === t));
    if (id) {
      h.tasks.push({ kind: 'clean', tableId: id });
      return;
    }
  }
  if (can('mop')) {
    const stain = r.stains.find((s) => !taskTaken(ctx, (x) => x.kind === 'mop' && x.stainId === s.id));
    if (stain) h.tasks.push({ kind: 'mop', stainId: stain.id });
  }
}

/** Món giao tận nơi đã ra quầy line (chưa ai nhận): nhân viên mang ra quầy cashier (tối đa carryMax món một lượt). */
function takeHandoff(ctx: SimContext, h: HelperState): boolean {
  if (!roomOf(ctx).cashier) return false;
  const ready = readyOrders(ctx).filter((o) => o.takeoutId != null).slice(0, ctx.content.balance.service.carryMax);
  if (!ready.length) return false;
  h.tasks.push({ kind: 'handoff', orderIds: ready.map((o) => o.id) });
  return true;
}

/** Số nhân viên phục vụ tối đa (quán hạng cao nhất). */
export const MAX_HELPERS = 4;
/** Số bàn tối đa theo số ghế (kể cả bàn có sẵn và bàn đang cất): bàn 6, bàn 4, bàn đôi, bàn đơn. */
export const TABLE_CAPS: Record<number, number> = { 6: 2, 4: 3, 2: 5, 1: 4 };
/**
 * Số bàn MUA THÊM được (ngoài bàn có sẵn) theo hạng quán, theo số ghế — cộng dồn. Hạng chưa ghi ở đây:
 * mỗi bậc +1 mỗi loại (bàn 6 từ hạng 3), vẫn không quá TABLE_CAPS.
 */
export const TABLE_EXTRA_BY_TIER: Record<number, Record<number, number>> = {
  1: {},
  2: { 4: 1, 2: 1, 1: 1 },
  3: { 4: 1, 2: 2, 1: 1, 6: 1 },
  4: { 4: 2, 2: 3, 1: 1, 6: 1 },
  5: { 4: 2, 2: 3, 1: 1, 6: 2 },
};

/** Số nhân viên thuê được ở hạng quán hiện tại (hạng 1: 0, mỗi bậc +1). */
export function maxHelpers(ctx: SimContext): number {
  return Math.min(MAX_HELPERS, Math.max(0, ctx.state.restaurant.tier - 1) + kitchenTierOf(ctx).helpers);
}

function find(ctx: SimContext, id: string): HelperState | undefined {
  return ctx.state.restaurant.helpers.find((h) => h.id === id);
}

/** Nhân viên rảnh tự nhận một việc đang chờ theo thứ tự: bưng món → menu / ghi món → dọn bàn → lau sàn. */
function pickTask(ctx: SimContext, h: HelperState): void {
  const r = ctx.state.restaurant;
  const can = (job: HelperJob) => h.jobs[job];
  if (can('serve') && takeHandoff(ctx, h)) return;
  if (can('serve')) {
    // Bưng hết món đã ra quầy của một bàn trong một lượt
    const ready = readyOrders(ctx).filter((o) => o.takeoutId == null);
    if (ready.length) {
      const partyId = ready[0].partyId;
      h.tasks.push({ kind: 'deliver', orderIds: ready.filter((o) => o.partyId === partyId).map((o) => o.id), partyId });
      return;
    }
  }
  if (can('menu')) {
    const party = r.parties.find((p) => needOf(p));
    if (party) {
      const kind = needOf(party) === 'menu' ? 'menu' : 'takeOrder';
      party.called = true;
      h.tasks.push({ kind, partyId: party.id });
      return;
    }
  }
  if (can('clean')) {
    const id = Object.keys(r.dirty).find((t) => r.dirty[t]?.length && !taskTaken(ctx, (x) => x.kind === 'clean' && x.tableId === t));
    if (id) {
      h.tasks.push({ kind: 'clean', tableId: id });
      return;
    }
  }
  if (can('mop')) {
    const stain = r.stains.find((s) => !taskTaken(ctx, (x) => x.kind === 'mop' && x.stainId === s.id));
    if (stain) h.tasks.push({ kind: 'mop', stainId: stain.id });
  }
}
