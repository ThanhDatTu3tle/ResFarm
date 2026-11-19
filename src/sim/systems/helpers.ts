import { spend } from '../helpers';
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
 */
export const helperSystem: System = {
  id: 'helpers',
  update(ctx) {
    const r = ctx.state.restaurant;
    if (ctx.state.crew.restaurantAway) return;
    for (const h of r.helpers) if (!h.fainted && !h.tasks.length) pickTask(ctx, h);
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
      const door = { x: content.room.width / 2, y: content.room.dining.y2 };
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

/** Số nhân viên thuê được ở hạng quán hiện tại (hạng 1: 0, mỗi bậc +1). */
export function maxHelpers(ctx: SimContext): number {
  return Math.min(4, Math.max(0, ctx.state.restaurant.tier - 1) + kitchenTierOf(ctx).helpers);
}

function find(ctx: SimContext, id: string): HelperState | undefined {
  return ctx.state.restaurant.helpers.find((h) => h.id === id);
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
