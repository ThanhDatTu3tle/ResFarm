import type { ItemStack, ModifierKey } from '../data';
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
export function spend(ctx: SimContext, amount: number): boolean {
  const { state } = ctx;
  if (state.money < amount) return false;
  state.money -= amount;
  state.stats.today.spent += amount;
  state.stats.total.spent += amount;
  return true;
}

export function xpForLevel(level: number): number {
  return Math.round(80 * Math.pow(level, 1.6));
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

export function addReputation(ctx: SimContext, delta: number): void {
  ctx.state.reputation = Math.max(0, Math.min(5, ctx.state.reputation + delta));
}

// ---------- Modifier từ nâng cấp ----------

/** Tích các hệ số của `key` từ thời tiết hiện tại, mọi nâng cấp đã mua và nội thất đang dùng (1 nếu không có). */
export function modifier(ctx: SimContext, key: ModifierKey): number {
  let value = ctx.content.weathers.get(ctx.state.weather.id).effects?.[key] ?? 1;
  for (const id of ctx.state.upgrades) value *= ctx.content.upgrades.get(id).modifiers?.[key] ?? 1;
  for (const id of Object.values(ctx.state.decor.equipped)) value *= ctx.content.decor.get(id).modifiers?.[key] ?? 1;
  return value;
}
