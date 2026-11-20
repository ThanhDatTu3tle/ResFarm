import type { ItemStack, ModifierKey } from '../data';
import { eventEffect } from './systems/events';
import { festivalOf } from './calendar';
import type { SimContext } from './types';

/** Các hàm dùng chung giữa nhiều system: kho, tiền, kinh nghiệm, uy tín, modifier. */

// ---------- Kho ----------

export function stockOf(ctx: SimContext, itemId: string): number {
  if (ctx.content.items.get(itemId).infinite) return Infinity;
  return ctx.state.inventory[itemId] ?? 0;
}

export function hasAll(ctx: SimContext, stacks: ItemStack[]): boolean {
  return stacks.every((s) => stockOf(ctx, s.item) >= s.qty);
}

export function addItem(ctx: SimContext, itemId: string, qty: number): void {
  if (ctx.content.items.get(itemId).infinite) return;
  ctx.state.inventory[itemId] = (ctx.state.inventory[itemId] ?? 0) + qty;
}

/** Trừ nguyên liệu. Người gọi phải kiểm tra hasAll trước. */
export function removeAll(ctx: SimContext, stacks: ItemStack[]): void {
  for (const s of stacks) addItem(ctx, s.item, -s.qty);
}

/** Số phần tối đa nấu được từ kho hiện tại. */
export function craftableCount(ctx: SimContext, stacks: ItemStack[]): number {
  return Math.min(...stacks.map((s) => Math.floor(stockOf(ctx, s.item) / s.qty)));
}

// ---------- Tiền, kinh nghiệm, uy tín ----------

export function earn(ctx: SimContext, amount: number): void {
  const { state } = ctx;
  state.money += amount;
  state.stats.today.revenue += amount;
  state.stats.total.revenue += amount;
}

/** Trả tiền; false nếu không đủ (không trừ gì). */
/** Chi được khoản này không (được nợ tới balance.debtLimit). */
export function canAfford(ctx: SimContext, amount: number): boolean {
  return ctx.state.money - amount >= -ctx.content.balance.debtLimit;
}

export function spend(ctx: SimContext, amount: number): boolean {
  const { state } = ctx;
  if (!canAfford(ctx, amount)) return false;
  state.money -= amount;
  state.stats.today.spent += amount;
  state.stats.total.spent += amount;
  return true;
}

/**
 * XP cần để lên cấp kế tiếp. 3 cấp đầu giữ nhịp cũ; từ cấp 4 chậm dần (×1.5 ở cấp 4, ×2.5 ở cấp 6, ×4 ở cấp 9…)
 * để người chơi có thời gian làm nhiệm vụ hệ thống.
 */
export function xpForLevel(level: number): number {
  const slow = level > 3 ? 1 + 0.5 * (level - 3) : 1;
  return Math.round(80 * Math.pow(level, 1.6) * slow);
}

export function addXp(ctx: SimContext, amount: number): void {
  const { state } = ctx;
  state.xp += amount;
  while (state.xp >= xpForLevel(state.level)) {
    state.xp -= xpForLevel(state.level);
    state.level++;
    ctx.bus.emit('level/up', { level: state.level });
  }
}

/**
 * Cộng / trừ uy tín. Lên sao chậm dần: dưới 3 sao giữ nhịp cũ, 3–4 sao còn 35%, trên 4 sao còn 15% (mất uy tín thì giữ nguyên).
 */
export function addReputation(ctx: SimContext, delta: number): void {
  const rep = ctx.state.reputation;
  const gain = delta > 0 ? delta * (rep < 3 ? 1 : rep < 4 ? 0.35 : 0.15) : delta;
  ctx.state.reputation = Math.max(0, Math.min(5, rep + gain));
}

// ---------- Modifier từ nâng cấp ----------

/** Tích các hệ số của `key` từ thời tiết hiện tại, mọi nâng cấp đã mua và nội thất đang dùng (1 nếu không có). */
export function modifier(ctx: SimContext, key: ModifierKey): number {
  let value = ctx.content.weathers.get(ctx.state.weather.id).effects?.[key] ?? 1;
  value *= festivalOf(ctx.state.clock.day)?.effects?.[key] ?? 1;
  value *= eventEffect(ctx, key);
  for (const id of ctx.state.upgrades) value *= ctx.content.upgrades.get(id).modifiers?.[key] ?? 1;
  for (const id of Object.values(ctx.state.decor.equipped)) value *= ctx.content.decor.get(id).modifiers?.[key] ?? 1;
  // Quán của riêng mình: hạng quán, thú cưng, đồ trang trí đang bày (mỗi loại tính một lần)
  const { restaurant, profile } = ctx.state;
  value *= ctx.content.room.tiers[restaurant.tier - 1]?.modifiers?.[key] ?? 1;
  if (profile.pet) value *= ctx.content.pets.get(profile.pet).modifiers?.[key] ?? 1;
  for (const id of new Set(restaurant.props.filter((p) => !p.stored).map((p) => p.def))) value *= ctx.content.props.get(id).modifiers?.[key] ?? 1;
  // Sàn bẩn: khách kém kiên nhẫn hơn
  if (key === 'patience' && restaurant.stains.length) {
    const s = ctx.content.balance.stains;
    value *= Math.max(s.minPatience, 1 - s.patiencePerLevel * restaurant.stains.reduce((a, x) => a + x.level, 0));
  }
  return value;
}
