import { serviceSpot, tablePos, type Point } from '../layout';
import type { Order, Party, WaiterTask } from '../state';
import { fail, ok, type Command, type SimContext, type System } from '../types';
import { placeOrders, startBrowsing } from './customers';

/**
 * PHỤC VỤ — người chơi đóng vai bồi bàn. Bấm vào khách / quầy ra món là giao việc; bồi bàn làm lần lượt:
 * đi tới nơi (tốc độ balance.service.waiterSpeed, theo toạ độ mặt bằng) rồi mới mang menu / ghi món / bưng món.
 * Vị trí bồi bàn nằm trong state nên cảnh 3D chỉ việc vẽ theo, và mọi thứ vẫn tất định.
 */

/** Đơn đã có người nhận bưng (đang trong hàng việc hoặc trên tay). */
export function isReserved(ctx: SimContext, orderId: number): boolean {
  const w = ctx.state.restaurant.waiter;
  return w.carrying === orderId || w.tasks.some((t) => t.kind === 'deliver' && t.orderId === orderId);
}

/** Món đang nằm ở quầy ra món và chưa ai nhận bưng — thứ người chơi chọn được. */
export function readyOrders(ctx: SimContext): Order[] {
  return ctx.state.restaurant.orders.filter((o) => o.status === 'ready' && !isReserved(ctx, o.id));
}

/** Đơn món `recipeId` của nhóm còn chưa lên bàn và chưa ai bưng (nhóm này nhận được món đó). */
export function wantedOrder(ctx: SimContext, party: Party, recipeId: string): Order | undefined {
  return ctx.state.restaurant.orders.find((o) => o.partyId === party.id && o.recipeId === recipeId && o.status !== 'served' && o.status !== 'carrying' && !isReserved(ctx, o.id));
}

/** Nhóm đang chờ người chơi làm gì (để hiện bong bóng / gợi ý). */
export function needOf(party: Party): 'menu' | 'order' | null {
  if (party.called) return null;
  if (party.phase === 'seated') return 'menu';
  if (party.phase === 'readyToOrder') return 'order';
  return null;
}

function partySpot(ctx: SimContext, party: Party): Point | null {
  if (!party.tableId) return null;
  const t = ctx.content.tables.get(party.tableId);
  return serviceSpot(t, tablePos(ctx, t), party.seats);
}

/** Chỗ đứng trước quầy ra món. */
export function passSpot(ctx: SimContext): Point {
  const pass = ctx.content.room.pass;
  return { x: pass.x, y: pass.y + 30 };
}

function targetOf(ctx: SimContext, task: WaiterTask): Point | null {
  const party = ctx.state.restaurant.parties.find((p) => p.id === task.partyId);
  if (!party) return null;
  if (task.kind === 'deliver' && ctx.state.restaurant.waiter.carrying !== task.orderId) return passSpot(ctx);
  return partySpot(ctx, party);
}

/** Bồi bàn tới nơi: làm việc đầu hàng. Trả true nếu xong việc đó (bỏ khỏi hàng). */
function act(ctx: SimContext, task: WaiterTask): boolean {
  const { state, bus } = ctx;
  const r = state.restaurant;
  const w = r.waiter;
  const party = r.parties.find((p) => p.id === task.partyId);
  if (!party) return true;
  if (task.kind === 'menu') {
    if (party.phase === 'seated') startBrowsing(ctx, party);
    bus.emit('waiter/done', { kind: 'menu', partyId: party.id });
    return true;
  }
  if (task.kind === 'takeOrder') {
    if (party.phase === 'readyToOrder') placeOrders(ctx, party);
    bus.emit('waiter/done', { kind: 'takeOrder', partyId: party.id });
    return true;
  }
  const order = r.orders.find((o) => o.id === task.orderId);
  if (!order) return true;
  if (w.carrying !== order.id) {
    // Tới quầy: nhấc món lên tay rồi đi tiếp tới bàn
    if (order.status !== 'ready') return true;
    order.status = 'carrying';
    w.carrying = order.id;
    bus.emit('waiter/done', { kind: 'pickup', partyId: party.id });
    return false;
  }
  order.status = 'served';
  w.carrying = null;
  bus.emit('order/served', { orderId: order.id, recipeId: order.recipeId });
  bus.emit('waiter/done', { kind: 'deliver', partyId: party.id });
  return true;
}

/** Đổi chủ hai đơn cùng món: món đã nấu xong `a` sang nhóm của `b`, đơn `b` (chưa xong) về nhóm cũ của `a`. */
function swapOwners(ctx: SimContext, a: Order, b: Order): void {
  const parties = ctx.state.restaurant.parties;
  const pa = parties.find((p) => p.id === a.partyId);
  const pb = parties.find((p) => p.id === b.partyId);
  [a.partyId, b.partyId] = [b.partyId, a.partyId];
  if (pa) pa.orderIds = pa.orderIds.map((id) => (id === a.id ? b.id : id));
  if (pb) pb.orderIds = pb.orderIds.map((id) => (id === b.id ? a.id : id));
}

export const serviceSystem: System = {
  id: 'service',
  update(ctx, dt) {
    const { state, content } = ctx;
    const w = state.restaurant.waiter;
    let budget = content.balance.service.waiterSpeed * dt;
    // Một bước có thể đi tới nơi rồi làm luôn việc kế tiếp nếu còn quãng đường
    for (let guard = 0; guard < 8 && budget > 0; guard++) {
      const task = w.tasks[0];
      const target = task ? targetOf(ctx, task) : content.room.waiterHome;
      if (!target) {
        w.tasks.shift();
        continue;
      }
      const dx = target.x - w.x;
      const dy = target.y - w.y;
      const dist = Math.hypot(dx, dy);
      if (dist > budget) {
        w.x += (dx / dist) * budget;
        w.y += (dy / dist) * budget;
        return;
      }
      w.x = target.x;
      w.y = target.y;
      budget -= dist;
      if (!task) return;
      if (act(ctx, task)) w.tasks.shift();
    }
  },
  commands: {
    'service/menu'(ctx, cmd) {
      const party = ctx.state.restaurant.parties.find((p) => p.id === cmd.partyId);
      if (!party || party.phase !== 'seated') return fail('Bàn này chưa cần menu.');
      if (party.called) return fail('Đang mang menu tới bàn này rồi.');
      party.called = true;
      ctx.state.restaurant.waiter.tasks.push({ kind: 'menu', partyId: party.id });
      return ok();
    },
    'service/takeOrder'(ctx, cmd) {
      const party = ctx.state.restaurant.parties.find((p) => p.id === cmd.partyId);
      if (!party || party.phase !== 'readyToOrder') return fail('Khách chưa chọn xong món.');
      if (party.called) return fail('Đang tới ghi món cho bàn này rồi.');
      party.called = true;
      ctx.state.restaurant.waiter.tasks.push({ kind: 'takeOrder', partyId: party.id });
      return ok();
    },
    'service/deliver'(ctx, cmd) {
      const r = ctx.state.restaurant;
      const order = r.orders.find((o) => o.id === cmd.orderId);
      if (!order || order.status !== 'ready') return fail('Món này chưa có ở quầy.');
      if (isReserved(ctx, order.id)) return fail('Món này đang được bưng đi rồi.');
      const party = r.parties.find((p) => p.id === cmd.partyId);
      if (!party || party.phase !== 'waitingFood') return fail('Bàn này không chờ món.');
      const target = wantedOrder(ctx, party, order.recipeId);
      if (!target) return fail(`Bàn này không gọi ${ctx.content.recipes.get(order.recipeId).name}.`);
      if (target.id !== order.id) swapOwners(ctx, order, target);
      r.waiter.tasks.push({ kind: 'deliver', orderId: order.id, partyId: party.id });
      return ok();
    },
  },
};

/**
 * "Bồi bàn tự động": các lệnh một người chơi chăm chỉ sẽ bấm lúc này (mang menu, ghi món, bưng món đúng bàn).
 * Dùng cho test và script cân bằng; về sau có thể dùng cho nhân viên phục vụ thuê thêm.
 */
export function autoServeCommands(ctx: SimContext): Command[] {
  const commands: Command[] = [];
  for (const p of ctx.state.restaurant.parties) {
    const need = needOf(p);
    if (need === 'menu') commands.push({ type: 'service/menu', partyId: p.id });
    else if (need === 'order') commands.push({ type: 'service/takeOrder', partyId: p.id });
  }
  for (const o of readyOrders(ctx)) commands.push({ type: 'service/deliver', orderId: o.id, partyId: o.partyId });
  return commands;
}
