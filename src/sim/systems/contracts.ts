import { randInt, randRange } from '../../core/rng';
import { seasonPriceFactor } from '../calendar';
import { addReputation, addXp, earn, hasAll, removeAll, stockOf } from '../helpers';
import type { ItemStack } from '../../data';
import { fail, ok, type SimContext, type System } from '../types';
import { bumpQuest } from './quests';
import { tire } from './crew';

/**
 * ĐƠN ĐẶT HÀNG + BÁN HÀNG DƯ.
 *  - Mỗi sáng có vài đơn (`state.contracts`) từ khách ngoài (trường học, nhà hàng, hàng xóm…): cần một ít nguyên liệu,
 *    giao trước giờ `balance.contracts.due` thì nhận thưởng (xu cao hơn giá chợ + XP + chút uy tín). Quá giờ thì đơn hết hạn
 *    (không phạt). Nguyên liệu trong đơn chỉ lấy loại mua được ở chợ hoặc trồng / nuôi được ở cấp hiện tại.
 *  - Bán hàng dư (`market/sell`): bán lại nguyên liệu trong kho với giá `sellPrice` (= một nửa giá gốc, theo mùa).
 */
const CLIENTS: [string, string][] = [
  ['Bếp ăn trường Tiểu học', '🏫'],
  ['Nhà hàng Hương Quê', '🍽️'],
  ['Cô Ba hàng xóm', '👵'],
  ['Tiệm bánh mì đầu hẻm', '🥖'],
  ['Căn tin công ty', '🏢'],
  ['Quán chay Tâm An', '🪷'],
  ['Tiệc cưới nhà chú Năm', '💒'],
  ['Khách sạn Bến Sông', '🏨'],
];

export const contractSystem: System = {
  id: 'contracts',
  init: rollContracts,
  onDayStart(ctx) {
    // Qua đêm mà shipper còn đang đi: coi như giao xong
    if (ctx.state.restaurant.shipper.trip?.contractId != null) finishTrip(ctx);
    rollContracts(ctx);
  },
  update(ctx) {
    // Anh shipper giao xong thì về, nhận thưởng đơn đó
    const s = ctx.state.restaurant.shipper;
    // (chuyến giao tận nơi do takeout.ts lo)
    if (s.trip?.contractId != null && ctx.state.clock.minute >= s.trip.until) finishTrip(ctx);
    const due = ctx.content.balance.contracts.due;
    if (ctx.state.clock.minute < due) return;
    for (const c of ctx.state.contracts) {
      if (c.status !== 'open') continue;
      c.status = 'expired';
      ctx.bus.emit('contract/expired', { id: c.id });
    }
  },
  commands: {
    'contract/deliver'(ctx, cmd) {
      const c = ctx.state.contracts.find((x) => x.id === cmd.contractId);
      if (!c || c.status !== 'open') return fail('Đơn này không còn nữa.');
      const blocked = shipperBlocked(ctx);
      if (blocked) return fail(blocked);
      if (!hasAll(ctx, c.items)) return fail('Trong kho chưa đủ hàng cho đơn này.');
      removeAll(ctx, c.items);
      // Anh shipper chở đi: 15–40 phút, tốn 5–10 năng lượng; về mới nhận thưởng
      const b = ctx.content.balance.crew.shipperTrip;
      const s = ctx.state.restaurant.shipper;
      s.trip = { contractId: c.id, until: ctx.state.clock.minute + randInt(ctx.state.rng, b.minutes[0], b.minutes[1]) };
      c.status = 'shipping';
      tire(ctx, 'shipper', s, randInt(ctx.state.rng, b.energy[0], b.energy[1]));
      ctx.bus.emit('shipper/left', { id: c.id, until: s.trip.until });
      return ok();
    },
    'market/sell'(ctx, cmd) {
      const item = ctx.content.items.has(cmd.itemId) ? ctx.content.items.get(cmd.itemId) : null;
      if (!item || item.infinite) return fail('Không bán được thứ này.');
      const qty = Math.min(Math.floor(cmd.qty), stockOf(ctx, item.id));
      if (qty <= 0) return fail('Trong kho không còn.');
      removeAll(ctx, [{ item: item.id, qty }]);
      earn(ctx, sellPrice(ctx, item.id) * qty);
      return ok();
    },
  },
};

/** Giá bán lại 1 đơn vị nguyên liệu (giá gốc × tỉ lệ bán lại × giá theo mùa), ít nhất 1 xu. */
export function sellPrice(ctx: SimContext, itemId: string): number {
  const item = ctx.content.items.get(itemId);
  return Math.max(1, Math.round(item.basePrice * ctx.content.balance.contracts.sellRatio * seasonPriceFactor(ctx, itemId)));
}

/** Nguyên liệu có thể xuất hiện trong đơn: bán ở chợ, hoặc nông trại làm ra được ở cấp hiện tại. */
function orderableItems(ctx: SimContext): string[] {
  const { content, state } = ctx;
  const ids = new Set<string>();
  for (const s of content.stalls.all()) for (const id of s.items) ids.add(id);
  for (const p of content.producers.all()) if (p.level <= state.level) for (const y of p.yields) ids.add(y.item);
  return [...ids].filter((id) => content.items.has(id) && !content.items.get(id).infinite && content.items.get(id).basePrice > 0);
}

function rollContracts(ctx: SimContext): void {
  const { state, content } = ctx;
  const b = content.balance.contracts;
  state.contracts = [];
  const pool = orderableItems(ctx);
  if (!pool.length) return;
  const count = b.perDay + (state.level >= b.extraAtLevel ? 1 : 0);
  const clients = [...CLIENTS];
  for (let n = 0; n < count && clients.length; n++) {
    const [client, icon] = clients.splice(randInt(state.rng, 0, clients.length - 1), 1)[0];
    const kinds = Math.min(pool.length, randInt(state.rng, 1, 3));
    const picked = new Set<string>();
    while (picked.size < kinds) picked.add(pool[randInt(state.rng, 0, pool.length - 1)]);
    const items: ItemStack[] = [...picked].map((id) => {
      const price = content.items.get(id).basePrice;
      // Hàng rẻ thì đặt nhiều, hàng đắt đặt ít
      const qty = Math.max(2, Math.round(randRange(state.rng, 18, 40) / Math.max(2, price)));
      return { item: id, qty: Math.min(qty, 12) };
    });
    const worth = items.reduce((s, x) => s + content.items.get(x.item).basePrice * x.qty, 0);
    const reward = Math.round(worth * randRange(state.rng, b.rewardMul[0], b.rewardMul[1]));
    state.contracts.push({ id: state.nextId++, client, icon, items, reward, xp: Math.round(reward * b.xpRatio), status: 'open' });
  }
}

/** Đơn đang mở mà kho đã đủ hàng để giao. */
/** Anh shipper đi giao được không: đang đi giao, đang ở chợ với đội, hoặc kiệt sức thì không. */
export function shipperBlocked(ctx: SimContext): string | null {
  const s = ctx.state.restaurant.shipper;
  if (s.trip) return 'Anh shipper đang đi giao đơn khác — đợi anh về nhé.';
  if (ctx.state.crew.restaurantAway) return 'Anh shipper đang ăn ở chợ cùng cả đội.';
  if (s.fainted) return 'Anh shipper kiệt sức rồi — bồi dưỡng ở bảng Nhân viên.';
  return null;
}

/** Giao xong đơn đang chở: nhận thưởng, XP, uy tín; shipper về quán. */
function finishTrip(ctx: SimContext): void {
  const s = ctx.state.restaurant.shipper;
  const c = ctx.state.contracts.find((x) => x.id === s.trip?.contractId);
  s.trip = null;
  if (!c || c.status !== 'shipping') return;
  earn(ctx, c.reward);
  addXp(ctx, c.xp);
  addReputation(ctx, ctx.content.balance.contracts.rep);
  c.status = 'done';
  ctx.bus.emit('contract/done', { id: c.id, reward: c.reward });
  bumpQuest(ctx, 'contract');
}

/** Số đơn còn mở (badge nút Đơn hàng). */
export function openContracts(ctx: SimContext): number {
  return ctx.state.contracts.filter((c) => c.status === 'open').length;
}

export function deliverable(ctx: SimContext): number {
  return ctx.state.contracts.filter((c) => c.status === 'open' && hasAll(ctx, c.items)).length;
}
