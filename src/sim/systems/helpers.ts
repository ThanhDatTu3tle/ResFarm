import { spend } from '../helpers';
import type { HelperJob, HelperState } from '../state';
import { fail, ok, type SimContext, type System } from '../types';
import { inShift } from './customers';
import { needOf, readyOrders, taskTaken } from './service';

/**
 * NHÂN VIÊN PHỤC VỤ THUÊ THÊM — mỗi bậc hạng quán (từ hạng 2) thêm 1 chỗ, tối đa 4 người.
 *  - Người chơi giao việc: bưng món (serve), mang menu + ghi món (menu), dọn bàn (clean), lau sàn (mop).
 *    Nhân viên rảnh thì tự nhận việc đang chờ theo thứ tự đó; đi lại / làm việc dùng chung luật với bồi bàn (service.ts).
 *  - Năng lượng: mỗi việc làm xong tốn balance.helpers.energyPerTask; cạn thì xỉu (bồi dưỡng nhanh tốn reviveCost xu,
 *    hoặc qua đêm tự hồi một ít). Giờ nghỉ (ngoài ca) cho đi ăn hàng rong ở chợ: tốn tiền, vắng mặt một lúc, về thì đầy năng lượng hơn.
 */
export const helperSystem: System = {
  id: 'helpers',
  update(ctx, dt) {
    const r = ctx.state.restaurant;
    for (const h of r.helpers) {
      if (h.away) {
        h.away.minutesLeft -= dt;
        if (h.away.minutesLeft <= 0) comeBack(ctx, h);
        continue;
      }
      if (!h.fainted && !h.tasks.length) pickTask(ctx, h);
    }
  },
  onDayStart(ctx) {
    const b = ctx.content.balance.helpers;
    for (const h of ctx.state.restaurant.helpers) {
      if (h.away) comeBack(ctx, h);
      // Ngủ một đêm: hồi lại chút sức (người đang xỉu cũng tỉnh lại)
      h.energy = Math.min(b.maxEnergy, Math.max(h.energy, 0) + b.overnightEnergy);
      h.fainted = false;
    }
  },
  commands: {
    'helper/hire'(ctx) {
      const { state, content } = ctx;
      const r = state.restaurant;
      const b = content.balance.helpers;
      if (r.helpers.length >= maxHelpers(ctx)) return fail(r.tier >= content.room.tiers.length ? 'Đã đủ nhân viên.' : 'Nâng hạng quán để thuê thêm nhân viên.');
      if (!spend(ctx, b.hireCost)) return fail('Không đủ tiền.');
      const used = new Set(r.helpers.map((h) => h.name));
      const name = b.names.find((n) => !used.has(n)) ?? `Nhân viên ${r.helpers.length + 1}`;
      const door = { x: content.room.width / 2, y: content.room.dining.y2 };
      r.helpers.push({ id: `h${state.nextId++}`, name, look: r.helpers.length, ...door, tasks: [], carrying: [], jobs: { serve: true, menu: true, clean: true, mop: true }, energy: b.maxEnergy, fainted: false, away: null });
      return ok();
    },
    'helper/fire'(ctx, cmd) {
      const h = find(ctx, cmd.helperId);
      if (!h) return fail('Không có nhân viên này.');
      dropTasks(ctx, h);
      ctx.state.restaurant.helpers = ctx.state.restaurant.helpers.filter((x) => x !== h);
      return ok();
    },
    'helper/setJob'(ctx, cmd) {
      const h = find(ctx, cmd.helperId);
      if (!h) return fail('Không có nhân viên này.');
      h.jobs[cmd.job] = cmd.on;
      return ok();
    },
    'helper/revive'(ctx, cmd) {
      const h = find(ctx, cmd.helperId);
      const b = ctx.content.balance.helpers;
      if (!h || !h.fainted) return fail('Nhân viên này vẫn khoẻ.');
      if (!spend(ctx, b.reviveCost)) return fail('Không đủ tiền bồi dưỡng.');
      h.fainted = false;
      h.energy = b.reviveEnergy;
      return ok();
    },
    'helper/eat'(ctx, cmd) {
      const { state, content } = ctx;
      const h = find(ctx, cmd.helperId);
      if (!h) return fail('Không có nhân viên này.');
      if (h.away) return fail(`${h.name} đang đi ăn rồi.`);
      if (h.fainted) return fail(`${h.name} đang xỉu — bồi dưỡng trước đã.`);
      if (state.clock.phase !== 'open' || inShift(ctx)) return fail('Chỉ cho nhân viên đi ăn trong giờ nghỉ.');
      const meal = content.stalls.has(cmd.stallId) ? content.stalls.get(cmd.stallId).staffMeal : undefined;
      if (!meal) return fail('Hàng này không bán đồ ăn cho nhân viên.');
      if (!spend(ctx, meal.price)) return fail('Không đủ tiền.');
      dropTasks(ctx, h);
      h.away = { stallId: cmd.stallId, minutesLeft: meal.minutes };
      return ok();
    },
  },
};

/** Số nhân viên thuê được ở hạng quán hiện tại (hạng 1: 0, mỗi bậc +1). */
export function maxHelpers(ctx: SimContext): number {
  return Math.max(0, ctx.state.restaurant.tier - 1);
}

function find(ctx: SimContext, id: string): HelperState | undefined {
  return ctx.state.restaurant.helpers.find((h) => h.id === id);
}

/** Ăn xong: về cửa quán, cộng năng lượng theo món. */
function comeBack(ctx: SimContext, h: HelperState): void {
  const { content } = ctx;
  const meal = h.away && content.stalls.has(h.away.stallId) ? content.stalls.get(h.away.stallId).staffMeal : undefined;
  h.away = null;
  h.energy = Math.min(content.balance.helpers.maxEnergy, h.energy + (meal?.energy ?? 0));
  Object.assign(h, { x: content.room.width / 2, y: content.room.dining.y2 });
  ctx.bus.emit('helper/returned', { helperId: h.id, energy: h.energy });
}

/** Bỏ hết việc đang nhận (khách được gọi lại, món đang bưng trả về quầy). */
function dropTasks(ctx: SimContext, h: HelperState): void {
  const r = ctx.state.restaurant;
  for (const t of h.tasks) {
    if (t.kind !== 'menu' && t.kind !== 'takeOrder') continue;
    const p = r.parties.find((x) => x.id === t.partyId);
    if (p) p.called = false;
  }
  for (const o of r.orders) if (h.carrying.includes(o.id)) o.status = 'ready';
  h.tasks = [];
  h.carrying = [];
}

/** Nhân viên rảnh tự nhận một việc đang chờ theo thứ tự: bưng món → menu / ghi món → dọn bàn → lau sàn. */
function pickTask(ctx: SimContext, h: HelperState): void {
  const r = ctx.state.restaurant;
  const can = (job: HelperJob) => h.jobs[job];
  if (can('serve')) {
    // Bưng hết món đã ra quầy của một bàn trong một lượt
    const ready = readyOrders(ctx);
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
