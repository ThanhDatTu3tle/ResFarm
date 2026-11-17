import { randInt, randRange, weightedIndex } from '../../core/rng';
import type { TableDef } from '../../data';
import { addReputation, addXp, earn, hasAll, modifier, removeAll } from '../helpers';
import type { Party } from '../state';
import type { LeaveReason, SimContext, System } from '../types';

/** Số kiểu ngoại hình khách mà scene biết vẽ. */
export const LOOK_COUNT = 8;

/** Vòng đời khách: tới -> xếp hàng -> ngồi bàn -> gọi món -> chờ món -> ăn -> trả tiền / bỏ về. */
export const customerSystem: System = {
  id: 'customers',
  update(ctx, dt) {
    const { state, content } = ctx;
    const b = content.balance;
    const r = state.restaurant;

    if (state.clock.phase === 'open') {
      r.spawnTimer -= dt;
      if (r.spawnTimer <= 0) {
        r.spawnTimer = nextSpawnDelay(ctx);
        if (r.parties.filter((p) => p.phase === 'queue').length < b.maxQueue) spawnParty(ctx);
      }
    }

    // Duyệt bản sao vì party có thể bị xoá trong lúc duyệt. Thứ tự mảng = thứ tự tới => xếp bàn FIFO.
    for (const p of [...r.parties]) {
      switch (p.phase) {
        case 'queue': {
          const spot = findSeats(ctx, p.size);
          if (spot) {
            p.tableId = spot.tableId;
            p.seats = spot.seats;
            p.phase = 'ordering';
            p.timer = b.orderTime;
            ctx.bus.emit('party/seated', { partyId: p.id, tableId: spot.tableId });
          } else {
            p.patience -= dt;
            if (p.patience <= 0) leave(ctx, p, 'queueTimeout');
          }
          break;
        }
        case 'ordering':
          p.timer -= dt;
          if (p.timer <= 0) placeOrders(ctx, p);
          break;
        case 'waitingFood': {
          const allServed = p.orderIds.every((id) => r.orders.find((o) => o.id === id)?.status === 'served');
          if (allServed) {
            p.phase = 'eating';
            p.timer = b.eatTime;
          } else {
            p.patience -= dt;
            if (p.patience <= 0) leave(ctx, p, 'foodTimeout');
          }
          break;
        }
        case 'eating':
          p.timer -= dt;
          if (p.timer <= 0) pay(ctx, p);
          break;
      }
    }
  },
};

/** Các bàn đang có (bàn cần nâng cấp chỉ xuất hiện khi đã mua). */
export function activeTables(ctx: SimContext): TableDef[] {
  return ctx.content.tables.all().filter((t) => !t.requiresUpgrade || ctx.state.upgrades.includes(t.requiresUpgrade));
}

export function occupiedSeats(ctx: SimContext, tableId: string): number[] {
  return ctx.state.restaurant.parties.filter((p) => p.tableId === tableId).flatMap((p) => p.seats);
}

/** Tìm chỗ cho nhóm `size` người: ưu tiên bàn ít ghế thừa nhất. */
export function findSeats(ctx: SimContext, size: number): { tableId: string; seats: number[] } | null {
  let best: { tableId: string; seats: number[]; waste: number } | null = null;
  for (const t of activeTables(ctx)) {
    if (size > (t.maxParty ?? (t.shared ? 1 : t.seats))) continue;
    const taken = occupiedSeats(ctx, t.id);
    if (!t.shared && taken.length > 0) continue;
    const free = Array.from({ length: t.seats }, (_, i) => i).filter((i) => !taken.includes(i));
    if (free.length < size) continue;
    const waste = t.shared ? 0 : t.seats - size;
    if (!best || waste < best.waste) best = { tableId: t.id, seats: free.slice(0, size), waste };
  }
  return best && { tableId: best.tableId, seats: best.seats };
}

function nextSpawnDelay(ctx: SimContext): number {
  const { state, content } = ctx;
  const b = content.balance;
  const repFactor = 0.5 + (state.reputation / 5) * 1.2;
  const rush = b.rushHours.find((h) => state.clock.minute >= h.from && state.clock.minute < h.to)?.factor ?? 1;
  return (b.spawnInterval * randRange(state.rng, 0.5, 1.5)) / (repFactor * rush * modifier(ctx, 'spawnRate'));
}

function spawnParty(ctx: SimContext): void {
  const { state, content } = ctx;
  const size = Math.max(1, weightedIndex(state.rng, content.balance.partySizeWeights));
  const patience = content.balance.queuePatience * modifier(ctx, 'patience');
  const party: Party = {
    id: state.nextId++,
    size,
    phase: 'queue',
    tableId: null,
    seats: [],
    patience,
    patienceMax: patience,
    timer: 0,
    orderIds: [],
    looks: Array.from({ length: size }, () => randInt(state.rng, 0, LOOK_COUNT - 1)),
  };
  state.restaurant.parties.push(party);
  ctx.bus.emit('party/arrived', { partyId: party.id });
}

/** Mỗi khách gọi 1 món trong số món đang bán VÀ còn đủ nguyên liệu; nguyên liệu bị trừ ngay khi gọi. */
function placeOrders(ctx: SimContext, party: Party): void {
  const { state, content } = ctx;
  for (let i = 0; i < party.size; i++) {
    const options = state.menu.active.map((id) => content.recipes.get(id)).filter((r) => hasAll(ctx, r.ingredients));
    if (!options.length) break;
    const recipe = options[weightedIndex(state.rng, options.map((r) => r.popularity ?? 1))];
    removeAll(ctx, recipe.ingredients);
    const order = { id: state.nextId++, partyId: party.id, recipeId: recipe.id, status: 'queued' as const, progress: 0 };
    state.restaurant.orders.push(order);
    party.orderIds.push(order.id);
    ctx.bus.emit('order/placed', { orderId: order.id, recipeId: recipe.id });
  }
  if (!party.orderIds.length) {
    leave(ctx, party, 'noFood');
    return;
  }
  const patience = (content.balance.foodPatience + content.balance.foodPatiencePerGuest * party.size) * modifier(ctx, 'patience');
  party.phase = 'waitingFood';
  party.patience = party.patienceMax = patience;
}

function pay(ctx: SimContext, party: Party): void {
  const { state, content } = ctx;
  const b = content.balance;
  const priceMul = modifier(ctx, 'dishPrice');
  let total = 0;
  for (const id of party.orderIds) {
    const order = state.restaurant.orders.find((o) => o.id === id);
    if (order) total += Math.round(content.recipes.get(order.recipeId).price * priceMul);
  }
  const satisfaction = Math.max(0, Math.min(1, party.patience / party.patienceMax));
  const tip = Math.round(total * b.tipRate * satisfaction * modifier(ctx, 'tip'));
  earn(ctx, total + tip);
  state.stats.today.tips += tip;
  state.stats.total.tips += tip;
  addXp(ctx, Math.round(total * b.xpPerCoin));
  addReputation(ctx, b.reputation.paid + b.reputation.paidBonus * satisfaction);
  leave(ctx, party, 'paid', total, tip);
}

/** Xoá nhóm khách khỏi quán (kèm đơn của họ) và ghi nhận kết quả. */
function leave(ctx: SimContext, party: Party, reason: LeaveReason, total = 0, tip = 0): void {
  const { state, content } = ctx;
  const r = state.restaurant;
  r.orders = r.orders.filter((o) => o.partyId !== party.id);
  for (const s of r.staff) if (s.orderId != null && party.orderIds.includes(s.orderId)) s.orderId = null;
  r.parties = r.parties.filter((p) => p.id !== party.id);

  const key = reason === 'paid' ? 'guestsServed' : 'guestsLost';
  state.stats.today[key] += party.size;
  state.stats.total[key] += party.size;
  if (reason === 'noFood') addReputation(ctx, content.balance.reputation.noFood);
  else if (reason !== 'paid') addReputation(ctx, content.balance.reputation.timeout);

  ctx.bus.emit('party/left', { partyId: party.id, tableId: party.tableId, size: party.size, reason, total, tip });
}
