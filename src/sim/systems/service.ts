import { randInt } from '../../core/rng';
import { hasAll } from '../helpers';
import { nextWaypoint } from '../pathing';
import { roomOf, serviceSpot, tableById, tablePos, type Point } from '../layout';
import type { HelperState, Order, Party, WaiterState, WaiterTask } from '../state';
import { fail, ok, type Command, type SimContext, type System } from '../types';
import { awayReason, dropWork, tire } from './crew';
import { placeOrders, startBrowsing } from './customers';
import { checkPacked } from './takeout';

/**
 * PHỤC VỤ - người chơi đóng vai bồi bàn. Bấm vào khách / quầy line / bàn dơ / vết bẩn là giao việc; bồi bàn làm lần lượt:
 * đi tới nơi (tốc độ balance.service.waiterSpeed, theo toạ độ mặt bằng) rồi mới mang menu / ghi món / bưng món / dọn / lau.
 *  - Bưng món (người chơi): bấm quầy line → `service/pickup`: ra quầy lấy món ra quầy sớm nhất, tối đa `carryMax` món;
 *    rồi bấm bàn → `service/serve`: giao những món đang cầm của bàn đó (món mang màu bàn - xem `Party.color`).
 *  - Nhân viên thuê / test: `service/deliver` (lấy đúng các món của một bàn ở quầy rồi giao một lượt).
 *  - Rảnh việc thì bồi bàn đứng yên tại chỗ (không chạy về quầy).
 * Vị trí bồi bàn nằm trong state nên cảnh 3D chỉ việc vẽ theo, và mọi thứ vẫn tất định.
 */

/** Mọi người phục vụ: bồi bàn (người chơi) + nhân viên thuê đang ở quán. */
export function workers(ctx: SimContext): WaiterState[] {
  const r = ctx.state.restaurant;
  return [r.waiter, ...r.helpers.filter((h) => !h.sick)];
}

/** Đã có ai nhận việc giống vậy chưa (để hai người không cùng chạy tới một việc). */
export function taskTaken(ctx: SimContext, match: (t: WaiterTask) => boolean): boolean {
  return workers(ctx).some((w) => w.tasks.some(match));
}

/** Đơn đã có người nhận bưng (đang trong hàng việc hoặc trên khay của ai đó). */
export function isReserved(ctx: SimContext, orderId: number): boolean {
  return workers(ctx).some((w) => w.carrying.includes(orderId) || w.tasks.some((t) => (t.kind === 'deliver' || t.kind === 'handoff') && t.orderIds.includes(orderId)));
}

/** Món đang nằm ở quầy ra món và chưa ai nhận bưng - thứ người chơi chọn được. */
export function readyOrders(ctx: SimContext): Order[] {
  return ctx.state.restaurant.orders.filter((o) => o.status === 'ready' && !isReserved(ctx, o.id));
}

/** Đơn món `recipeId` của nhóm còn chưa lên bàn và chưa ai bưng (nhóm này nhận được món đó). `skip` = đơn đã chọn cho khay này. */
export function wantedOrder(ctx: SimContext, party: Party, recipeId: string, skip: number[] = []): Order | undefined {
  return ctx.state.restaurant.orders.find((o) => o.partyId === party.id && o.recipeId === recipeId && o.status !== 'served' && o.status !== 'carrying' && !isReserved(ctx, o.id) && !skip.includes(o.id));
}

/** Các món nhóm còn chờ (chưa lên bàn, chưa ai bưng) - một khay "đủ bộ" phải khớp đúng số món này. */
export function pendingOrders(ctx: SimContext, party: Party): Order[] {
  return ctx.state.restaurant.orders.filter((o) => o.partyId === party.id && o.status !== 'served' && o.status !== 'carrying' && !isReserved(ctx, o.id));
}

/**
 * Khay món có giao đủ bộ cho một nhóm không: mỗi món trong khay ứng với một món nhóm còn chờ (cùng món thì đổi chủ được)
 * và số món bằng đúng số món nhóm còn chờ. Trả nhóm khớp đầu tiên, hoặc null.
 */
export function partyForTray(ctx: SimContext, orderIds: number[]): Party | null {
  const orders = orderIds.map((id) => ctx.state.restaurant.orders.find((o) => o.id === id));
  if (!orders.length || orders.some((o) => !o || o.status !== 'ready' || isReserved(ctx, o.id))) return null;
  for (const party of ctx.state.restaurant.parties) {
    if (party.phase !== 'waitingFood') continue;
    const need = pendingOrders(ctx, party).map((o) => o.recipeId).sort();
    const have = orders.map((o) => o!.recipeId).sort();
    if (need.length === have.length && need.every((r, i) => r === have[i])) return party;
  }
  return null;
}

/** Nhóm đang chờ người chơi làm gì (để hiện bong bóng / gợi ý). */
export function needOf(party: Party): 'menu' | 'order' | null {
  if (party.called) return null;
  // Khách chưa ngồi xuống (đang đi từ cửa vào ghế): chưa ai được tới mang menu
  if ((party.walking ?? 0) > 0) return null;
  if (party.phase === 'seated') return 'menu';
  if (party.phase === 'readyToOrder') return 'order';
  return null;
}

function partySpot(ctx: SimContext, party: Party): Point | null {
  if (!party.tableId) return null;
  const t = tableById(ctx, party.tableId);
  if (!t) return null;
  return serviceSpot(t, tablePos(ctx, t), party.seats);
}

/** Chỗ đứng trước quầy ra món. */
export function passSpot(ctx: SimContext): Point {
  const room = roomOf(ctx);
  return room.passStand ?? { x: room.pass.x, y: room.pass.y + 30 };
}

function targetOf(ctx: SimContext, task: WaiterTask, w: WaiterState): Point | null {
  const r = ctx.state.restaurant;
  if (task.kind === 'pickup') return passSpot(ctx);
  if (task.kind === 'handoff') {
    // Chưa cầm món (nhân viên thuê nhận việc từ quầy line): ra quầy line lấy trước, rồi tới quầy cashier
    if (!task.orderIds.every((id) => w.carrying.includes(id))) return passSpot(ctx);
    return roomOf(ctx).cashier?.stand ?? null;
  }
  if (task.kind === 'clean') {
    const t = tableById(ctx, task.tableId);
    return t && r.dirty[t.id]?.length ? serviceSpot(t, tablePos(ctx, t), r.dirty[t.id]) : null;
  }
  if (task.kind === 'mop') {
    const s = r.stains.find((x) => x.id === task.stainId);
    return s ? { x: s.x + 22, y: s.y } : null;
  }
  const party = r.parties.find((p) => p.id === task.partyId);
  if (!party) return null;
  if (task.kind === 'deliver' && !task.orderIds.every((id) => w.carrying.includes(id))) return passSpot(ctx);
  return partySpot(ctx, party);
}

/** Người phục vụ `w` tới nơi: làm việc đầu hàng. Trả true nếu xong việc đó (bỏ khỏi hàng). */
function act(ctx: SimContext, task: WaiterTask, w: WaiterState): boolean {
  const { state, bus } = ctx;
  const r = state.restaurant;
  if (task.kind === 'clean') {
    delete r.dirty[task.tableId];
    bus.emit('waiter/done', { kind: 'clean', partyId: null });
    return true;
  }
  if (task.kind === 'mop') {
    r.stains = r.stains.filter((s) => s.id !== task.stainId);
    bus.emit('waiter/done', { kind: 'mop', partyId: null });
    return true;
  }
  if (task.kind === 'pickup') {
    // Tới quầy: lấy món ra quầy sớm nhất cho đủ tay
    const room = ctx.content.balance.service.carryMax - w.carrying.length;
    for (const o of passQueue(ctx).slice(0, Math.max(0, room))) {
      o.status = 'carrying';
      w.carrying.push(o.id);
    }
    bus.emit('waiter/done', { kind: 'pickup', partyId: null });
    return true;
  }
  if (task.kind === 'handoff') {
    const orders = task.orderIds.map((id) => r.orders.find((o) => o.id === id)).filter((o): o is Order => !!o);
    if (!orders.length) return true;
    if (!orders.every((o) => w.carrying.includes(o.id))) {
      // Tới quầy line: xếp các món còn ở quầy lên tay rồi đi tiếp tới quầy cashier
      for (const o of orders) {
        if (o.status !== 'ready' || w.carrying.includes(o.id)) continue;
        o.status = 'carrying';
        w.carrying.push(o.id);
      }
      task.orderIds = orders.filter((o) => w.carrying.includes(o.id)).map((o) => o.id);
      bus.emit('waiter/done', { kind: 'pickup', partyId: null });
      return !task.orderIds.length;
    }
    // Tới quầy cashier: đặt món vào túi; đủ món của đơn thì đóng gói chờ shipper
    for (const o of orders) {
      o.status = 'served';
      bus.emit('order/served', { orderId: o.id, recipeId: o.recipeId });
    }
    w.carrying = w.carrying.filter((id) => !task.orderIds.includes(id));
    for (const id of new Set(orders.map((o) => o.takeoutId!))) checkPacked(ctx, id);
    bus.emit('waiter/done', { kind: 'handoff', partyId: null });
    return true;
  }
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
  const orders = task.orderIds.map((id) => r.orders.find((o) => o.id === id)).filter((o): o is Order => !!o);
  if (!orders.length) return true;
  if (!orders.every((o) => w.carrying.includes(o.id))) {
    // Tới quầy: xếp cả khay lên tay rồi đi tiếp tới bàn
    for (const o of orders) {
      if (o.status !== 'ready' || w.carrying.includes(o.id)) continue;
      o.status = 'carrying';
      w.carrying.push(o.id);
    }
    task.orderIds = orders.filter((o) => w.carrying.includes(o.id)).map((o) => o.id);
    bus.emit('waiter/done', { kind: 'pickup', partyId: party.id });
    return !task.orderIds.length;
  }
  for (const o of orders) {
    o.status = 'served';
    bus.emit('order/served', { orderId: o.id, recipeId: o.recipeId });
  }
  w.carrying = w.carrying.filter((id) => !task.orderIds.includes(id));
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
  // Món ruột đi theo người gọi
  [a.fav, b.fav] = [b.fav, a.fav];
}

/**
 * Dọn món mồ côi: đơn mà nhóm khách đã không còn trong quán (giận bỏ về, save cũ, đổi chủ món…) thì bỏ đi, và món nào
 * trên tay bồi bàn / nhân viên không còn đơn thì đổ luôn - nếu không người phục vụ cầm mãi, không giao được cho ai.
 * Việc "giao" chỉ còn món đã mất thì cũng bỏ.
 */
function dropOrphans(ctx: SimContext): void {
  const r = ctx.state.restaurant;
  // Chỉ dọn món đã nấu xong (ở quầy / trên tay): món mồ côi ở quầy mà để lại thì bồi bàn lấy lên lại rồi kẹt tiếp
  const cooking = new Set(ctx.state.takeout.orders.filter((t) => t.status === 'cooking').map((t) => t.id));
  const orphan = (o: Order) =>
    (o.status === 'ready' || o.status === 'carrying') && (o.takeoutId != null ? !cooking.has(o.takeoutId) : !r.parties.some((p) => p.id === o.partyId));
  if (r.orders.some(orphan)) {
    const gone = new Set(r.orders.filter(orphan).map((o) => o.id));
    r.orders = r.orders.filter((o) => !gone.has(o.id));
    for (const s of r.staff) if (s.orderId != null && gone.has(s.orderId)) s.orderId = null;
  }
  for (const w of [r.waiter, ...r.helpers]) {
    if (w.carrying.some((id) => !r.orders.some((o) => o.id === id))) w.carrying = w.carrying.filter((id) => r.orders.some((o) => o.id === id));
    for (const t of w.tasks) if (t.kind === 'deliver' || t.kind === 'handoff') t.orderIds = t.orderIds.filter((id) => r.orders.some((o) => o.id === id));
    if (w.tasks.some((t) => (t.kind === 'deliver' || t.kind === 'handoff') && !t.orderIds.length)) w.tasks = w.tasks.filter((t) => (t.kind !== 'deliver' && t.kind !== 'handoff') || t.orderIds.length);
  }
}

/** Món đang chờ ở quầy line chưa ai nhận, xếp theo lúc ra quầy (sớm trước). */
export function passQueue(ctx: SimContext): Order[] {
  return readyOrders(ctx).sort((a, b) => (a.readyAt ?? 0) - (b.readyAt ?? 0) || a.id - b.id);
}

/** Hết ca: sàn có thêm vết bẩn ở khu ăn uống, vết cũ chưa lau thì bẩn thêm một bậc. */
export function addStains(ctx: SimContext): void {
  const { state, content } = ctx;
  const s = content.balance.stains;
  const r = state.restaurant;
  for (const old of r.stains) old.level = Math.min(s.maxLevel, old.level + 1);
  const d = roomOf(ctx).dining;
  for (let i = 0; i < s.perShift && r.stains.length < s.max; i++) {
    r.stains.push({ id: state.nextId++, x: randInt(state.rng, d.x1 + 30, d.x2 - 30), y: randInt(state.rng, d.y1 + 20, d.y2 - 20), level: 1 });
  }
}

export const serviceSystem: System = {
  id: 'service',
  update(ctx, dt) {
    dropOrphans(ctx);
    if (ctx.state.crew.restaurantAway) return; // cả đội đang ở chợ
    for (const w of workers(ctx)) if (!w.fainted) stepWorker(ctx, w, dt);
  },
  commands: {
    'service/menu'(ctx, cmd) {
      const blocked = waiterBlocked(ctx);
      if (blocked) return fail(blocked);
      const party = ctx.state.restaurant.parties.find((p) => p.id === cmd.partyId);
      if (!party || party.phase !== 'seated') return fail('Bàn này chưa cần menu.');
      if ((party.walking ?? 0) > 0) return fail('Khách đang đi vào chỗ, chờ khách ngồi xuống đã.');
      if (party.called) return fail('Đang mang menu tới bàn này rồi.');
      party.called = true;
      ctx.state.restaurant.waiter.tasks.push({ kind: 'menu', partyId: party.id });
      return ok();
    },
    'service/takeOrder'(ctx, cmd) {
      const blocked = waiterBlocked(ctx);
      if (blocked) return fail(blocked);
      const party = ctx.state.restaurant.parties.find((p) => p.id === cmd.partyId);
      if (!party || party.phase !== 'readyToOrder') return fail('Khách chưa chọn xong món.');
      if (party.called) return fail('Đang tới ghi món cho bàn này rồi.');
      if (party.want && !hasAll(ctx, ctx.content.recipes.get(party.want).ingredients)) return fail(`Khách muốn ${ctx.content.recipes.get(party.want).name} nhưng quán đang thiếu nguyên liệu - ra Chợ mua trước đã.`);
      party.called = true;
      ctx.state.restaurant.waiter.tasks.push({ kind: 'takeOrder', partyId: party.id });
      return ok();
    },
    'service/pickup'(ctx) {
      const blocked = waiterBlocked(ctx);
      if (blocked) return fail(blocked);
      const w = ctx.state.restaurant.waiter;
      const max = ctx.content.balance.service.carryMax;
      if (w.tasks.some((t) => t.kind === 'pickup')) return fail('Đang ra quầy lấy món rồi.');
      if (w.carrying.length >= max) return fail(`Đang cầm ${max} món rồi - bấm bàn cùng màu để giao.`);
      if (!passQueue(ctx).length) return fail('Quầy line chưa có món nào nấu xong.');
      w.tasks.push({ kind: 'pickup' });
      return ok();
    },
    'service/serve'(ctx, cmd) {
      const blocked = waiterBlocked(ctx);
      if (blocked) return fail(blocked);
      const r = ctx.state.restaurant;
      const w = r.waiter;
      const party = r.parties.find((p) => p.id === cmd.partyId);
      if (!party || party.phase !== 'waitingFood') return fail('Bàn này không chờ món.');
      // Món đang cầm chưa hứa giao cho bàn nào
      const promised = new Set(w.tasks.flatMap((t) => (t.kind === 'deliver' ? t.orderIds : [])));
      const free = w.carrying.map((id) => r.orders.find((o) => o.id === id)).filter((o): o is Order => !!o && !promised.has(o.id));
      if (!free.length) return fail(w.tasks.some((t) => t.kind === 'pickup') ? 'Đợi lấy món ở quầy xong đã.' : 'Chưa cầm món nào - bấm quầy line để lấy món.');
      // Chỉ giao đúng món mang màu bàn này (món của bàn khác dù cùng loại cũng không đổi chủ)
      const mine = free.filter((o) => o.partyId === party.id);
      if (!mine.length) return fail('Món đang cầm không phải của bàn này - giao cho bàn có bong bóng cùng màu nhé.');
      w.tasks.push({ kind: 'deliver', orderIds: mine.map((o) => o.id), partyId: party.id });
      return ok();
    },
    'service/deliver'(ctx, cmd) {
      const blocked = waiterBlocked(ctx);
      if (blocked) return fail(blocked);
      const r = ctx.state.restaurant;
      if (!cmd.orderIds.length) return fail('Chưa chọn món nào.');
      const party = r.parties.find((p) => p.id === cmd.partyId);
      if (!party || party.phase !== 'waitingFood') return fail('Bàn này không chờ món.');
      const orders: Order[] = [];
      for (const id of cmd.orderIds) {
        const order = r.orders.find((o) => o.id === id);
        if (!order || order.status !== 'ready') return fail('Món này chưa có ở quầy.');
        if (isReserved(ctx, order.id) || orders.includes(order)) return fail('Món này đang được bưng đi rồi.');
        orders.push(order);
      }
      // Mỗi món phải ứng với một món bàn này còn chờ (cùng món của bàn khác thì đổi chủ cho nhau)
      // Món vốn của bàn này giữ nguyên; món của bàn khác thì ghép với một món cùng loại bàn này còn chờ
      const picked = orders.filter((o) => o.partyId === party.id).map((o) => o.id);
      const swaps: [Order, Order][] = [];
      for (const order of orders) {
        if (order.partyId === party.id) continue;
        const target = wantedOrder(ctx, party, order.recipeId, picked);
        if (!target) return fail(`Bàn này không gọi ${ctx.content.recipes.get(order.recipeId).name}.`);
        picked.push(target.id);
        swaps.push([order, target]);
      }
      for (const [order, target] of swaps) swapOwners(ctx, order, target);
      r.waiter.tasks.push({ kind: 'deliver', orderIds: orders.map((o) => o.id), partyId: party.id });
      return ok();
    },
    'service/handoff'(ctx) {
      const blocked = waiterBlocked(ctx);
      if (blocked) return fail(blocked);
      const r = ctx.state.restaurant;
      const w = r.waiter;
      if (!roomOf(ctx).cashier) return fail('Quán chưa có quầy cashier.');
      const promised = new Set(w.tasks.flatMap((t) => (t.kind === 'deliver' || t.kind === 'handoff' ? t.orderIds : [])));
      const mine = w.carrying.filter((id) => !promised.has(id) && r.orders.find((o) => o.id === id)?.takeoutId != null);
      if (!mine.length) {
        if (w.carrying.length) return fail('Món đang cầm là của khách trong quán - bấm bàn cùng màu để giao.');
        return fail(w.tasks.some((t) => t.kind === 'pickup') ? 'Đợi lấy món ở quầy xong đã.' : 'Chưa cầm món giao tận nơi nào - lấy món 🛍️ ở quầy line trước.');
      }
      w.tasks.push({ kind: 'handoff', orderIds: mine });
      return ok();
    },
    'service/clean'(ctx, cmd) {
      const blocked = waiterBlocked(ctx);
      if (blocked) return fail(blocked);
      const r = ctx.state.restaurant;
      if (!r.dirty[cmd.tableId]?.length) return fail('Bàn này sạch rồi.');
      if (taskTaken(ctx, (t) => t.kind === 'clean' && t.tableId === cmd.tableId)) return fail('Đang có người tới dọn bàn này rồi.');
      r.waiter.tasks.push({ kind: 'clean', tableId: cmd.tableId });
      return ok();
    },
    'service/mop'(ctx, cmd) {
      const blocked = waiterBlocked(ctx);
      if (blocked) return fail(blocked);
      const r = ctx.state.restaurant;
      if (!r.stains.some((s) => s.id === cmd.stainId)) return fail('Chỗ này sạch rồi.');
      if (taskTaken(ctx, (t) => t.kind === 'mop' && t.stainId === cmd.stainId)) return fail('Đang có người tới lau chỗ này rồi.');
      r.waiter.tasks.push({ kind: 'mop', stainId: cmd.stainId });
      return ok();
    },
  },
};

/** Một người phục vụ đi tới việc đầu hàng rồi làm; còn quãng đường thì làm luôn việc kế. */
function stepWorker(ctx: SimContext, w: WaiterState, dt: number): void {
  // Nhân viên thuê đi chậm hơn bồi bàn (người chơi kịp theo dõi, kịp tranh việc)
  const speed = ctx.content.balance.service.waiterSpeed * (w === ctx.state.restaurant.waiter ? 1 : ctx.content.balance.helpers.speedMul);
  let budget = speed * dt;
  // Một bước có thể đi tới nơi rồi làm luôn việc kế tiếp nếu còn quãng đường
  for (let guard = 0; guard < 16 && budget > 0; guard++) {
    const task = w.tasks[0];
    if (!task) return; // rảnh: đứng yên tại chỗ vừa làm xong
    if (task.kind !== 'mop') delete w.work;
    const target = targetOf(ctx, task, w);
    if (!target) {
      w.tasks.shift();
      continue;
    }
    // Đi vòng qua bàn: tới từng điểm rẽ (pathing.ts), tới đúng chỗ mới làm việc
    const step = nextWaypoint(ctx, w, target);
    const dx = step.x - w.x;
    const dy = step.y - w.y;
    const dist = Math.hypot(dx, dy);
    if (dist > budget) {
      w.x += (dx / dist) * budget;
      w.y += (dy / dist) * budget;
      return;
    }
    w.x = step.x;
    w.y = step.y;
    budget -= dist;
    if (step !== target) continue;
    // Lau sàn: đứng lau một lúc rồi mới xong
    if (task.kind === 'mop') {
      if (w.work == null) w.work = ctx.content.balance.service.mopTime;
      const used = Math.min(w.work, budget / speed);
      w.work -= used;
      budget -= used * speed;
      if (w.work > 1e-9) return;
      delete w.work;
    }
    // Xoá đúng việc vừa làm (không dùng shift): làm việc có thể khiến khách bỏ về và leave() đã lọc lại hàng việc,
    // shift() lúc đó sẽ xoá nhầm việc kế tiếp của bàn khác
    if (act(ctx, task, w)) {
      const i = w.tasks.indexOf(task);
      if (i >= 0) w.tasks.splice(i, 1);
      // Mang menu, dọn bàn không tốn sức; ghi món, bưng, lau sàn mỗi việc tốn 1
      if (task.kind !== 'clean' && task.kind !== 'menu' && spendEnergy(ctx, w)) return;
    }
  }
}

/** Người phục vụ làm xong một việc thì mất năng lượng; cạn thì xỉu (bỏ hết việc). Trả true nếu vừa xỉu. */
function spendEnergy(ctx: SimContext, w: WaiterState): boolean {
  const who = w === ctx.state.restaurant.waiter ? 'waiter' : (w as HelperState).id;
  if (!tire(ctx, who, w, ctx.content.balance.crew.waiterPerTask)) return false;
  dropWork(ctx, w);
  return true;
}

/** Bồi bàn (người chơi) chưa nhận việc được: cả đội đang ở chợ, hoặc đang xỉu. */
export function waiterBlocked(ctx: SimContext): string | null {
  const away = awayReason(ctx, 'restaurant');
  if (away) return away;
  if (ctx.state.restaurant.waiter.fainted) return '😵 Bồi bàn kiệt sức rồi - bồi dưỡng ở bảng Nhân viên.';
  return null;
}

/**
 * "Bồi bàn tự động": các lệnh một người chơi chăm chỉ sẽ bấm lúc này (mang menu, ghi món, bưng đủ món cho bàn, dọn bàn dơ).
 * Dùng cho test và script cân bằng; về sau có thể dùng cho nhân viên phục vụ thuê thêm.
 */
export function autoServeCommands(ctx: SimContext): Command[] {
  const commands: Command[] = [];
  const r = ctx.state.restaurant;
  for (const p of r.parties) {
    const need = needOf(p);
    if (need === 'menu') commands.push({ type: 'service/menu', partyId: p.id });
    else if (need === 'order') commands.push({ type: 'service/takeOrder', partyId: p.id });
  }
  // Bưng theo bàn: món nào đã ra quầy của bàn nào thì giao luôn (khay có thể chưa đủ bộ)
  const byParty = new Map<number, number[]>();
  for (const o of readyOrders(ctx)) if (o.takeoutId == null) byParty.set(o.partyId, [...(byParty.get(o.partyId) ?? []), o.id]);
  for (const [partyId, orderIds] of byParty) commands.push({ type: 'service/deliver', orderIds, partyId });
  for (const id of Object.keys(r.dirty)) if (!taskTaken(ctx, (t) => t.kind === 'clean' && t.tableId === id)) commands.push({ type: 'service/clean', tableId: id });
  return commands;
}
