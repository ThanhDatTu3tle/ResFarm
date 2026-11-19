import { modifier, spend } from '../helpers';
import type { StaffState } from '../state';
import { fail, ok, type SimContext } from '../types';
import type { System } from '../types';
import { tire } from './crew';

/**
 * Bếp: mỗi đầu bếp nấu 1 đơn một lúc, lấy đơn cũ nhất còn chờ.
 * Mỗi món nấu xong tốn năng lượng (balance.crew.chefPerDish); kiệt sức thì nghỉ nấu (systems/crew.ts).
 * Nấu xong thì đặt món ra quầy ra món ('ready'); bồi bàn (người chơi) bưng lên bàn — xem service.ts.
 */
export const kitchenSystem: System = {
  id: 'kitchen',
  commands: {
    'kitchen/upgrade': (ctx) => kitchenCommands['kitchen/upgrade'](ctx),
    'chef/hire': (ctx) => kitchenCommands['chef/hire'](ctx),
    'chef/fire': (ctx, cmd) => kitchenCommands['chef/fire'](ctx, cmd),
    'chef/setDish': (ctx, cmd) => kitchenCommands['chef/setDish'](ctx, cmd),
  },
  update(ctx, dt) {
    const { state, content } = ctx;
    const { orders, staff } = state.restaurant;
    const speedMul = modifier(ctx, 'cookSpeed');
    // Giờ nghỉ đội quán ra chợ: bếp tạm nghỉ
    if (state.crew.restaurantAway) return;

    // Quầy line đầy đĩa chưa bưng: bếp chờ, không nhận đơn mới
    let free = passSlots(ctx) - orders.filter((o) => o.status === 'ready').length - staff.filter((s) => s.orderId != null).length;
    for (const s of staff) {
      if (s.fainted) continue; // kiệt sức: đứng im tới khi được bồi dưỡng
      if (s.orderId == null) {
        if (free <= 0) continue;
        // Đầu bếp được giao món nào thì chỉ nhận đơn món đó
        const next = orders.find((o) => o.status === 'queued' && cooks(s, o.recipeId));
        if (!next) continue;
        free--;
        next.status = 'cooking';
        s.orderId = next.id;
      }
      const order = orders.find((o) => o.id === s.orderId);
      if (!order) {
        s.orderId = null;
        continue;
      }
      order.progress += dt * content.staff.get(s.id).speed * speedMul;
      if (order.progress >= content.recipes.get(order.recipeId).cookTime) {
        order.status = 'ready';
        s.orderId = null;
        state.stats.today.dishes++;
        state.stats.total.dishes++;
        ctx.bus.emit('order/ready', { orderId: order.id, recipeId: order.recipeId });
        tire(ctx, s.id, s, content.balance.crew.chefPerDish);
      }
    }
  },
};

/** Đầu bếp này có được giao nấu món này không (chưa giao món nào = nấu mọi món). */
export function cooks(s: StaffState, recipeId: string): boolean {
  return !s.dishes || s.dishes.includes(recipeId);
}

/** Hạng bếp hiện tại (đầu bếp tối đa, sức chứa quầy line...). */
export function kitchenTierOf(ctx: SimContext) {
  const tiers = ctx.content.balance.kitchen.tiers;
  return tiers[Math.min(tiers.length, ctx.state.restaurant.kitchenTier) - 1];
}

/** Số đĩa quầy line giữ được (tính cả món đang nấu dở). */
export function passSlots(ctx: SimContext): number {
  return kitchenTierOf(ctx).passSlots;
}

/** Đầu bếp kế tiếp có thể thuê (StaffDef `hire` chưa có trong quán), null nếu đã thuê hết. */
export function nextChefDef(ctx: SimContext) {
  return ctx.content.staff.all().find((d) => d.hire && !ctx.state.restaurant.staff.some((s) => s.id === d.id)) ?? null;
}

/** Món đang bán mà không đầu bếp nào được giao nấu (đơn món này sẽ nằm chờ mãi). */
export function uncookedDishes(ctx: SimContext): string[] {
  const { staff } = ctx.state.restaurant;
  return ctx.state.menu.active.filter((id) => !staff.some((s) => cooks(s, id)));
}

function chef(ctx: SimContext, id: string) {
  return ctx.state.restaurant.staff.find((s) => s.id === id);
}

export const kitchenCommands = {
  'kitchen/upgrade'(ctx: SimContext) {
    const r = ctx.state.restaurant;
    const next = ctx.content.balance.kitchen.tiers[r.kitchenTier];
    if (!next) return fail('Bếp đã ở hạng cao nhất.');
    if (ctx.state.level < next.level) return fail(`Cần cấp ${next.level}.`);
    if (!spend(ctx, next.cost)) return fail('Không đủ tiền.');
    r.kitchenTier++;
    ctx.bus.emit('kitchen/changed', { tier: r.kitchenTier, chefs: r.staff.length });
    return ok();
  },
  'chef/hire'(ctx: SimContext) {
    const r = ctx.state.restaurant;
    const def = nextChefDef(ctx);
    if (!def) return fail('Đã thuê đủ đầu bếp.');
    if (r.staff.length >= kitchenTierOf(ctx).chefs) return fail('Bếp chật rồi — nâng hạng bếp để thuê thêm đầu bếp.');
    if (ctx.state.crew.restaurantAway) return fail('Cả đội đang ở chợ — đợi về quán rồi thuê nhé.');
    if (!spend(ctx, ctx.content.balance.kitchen.chefHireCost)) return fail('Không đủ tiền.');
    r.staff.push({ id: def.id, orderId: null, energy: ctx.content.balance.crew.maxEnergy, fainted: false });
    ctx.bus.emit('kitchen/changed', { tier: r.kitchenTier, chefs: r.staff.length });
    return ok();
  },
  'chef/fire'(ctx: SimContext, cmd: { chefId: string }) {
    const r = ctx.state.restaurant;
    const s = chef(ctx, cmd.chefId);
    if (!s || !ctx.content.staff.get(s.id).hire) return fail('Chỉ cho nghỉ được đầu bếp thuê thêm.');
    if (ctx.state.crew.restaurantAway) return fail('Cả đội đang ở chợ — đợi về quán đã.');
    // Món đang nấu dở trả lại hàng chờ
    const order = r.orders.find((o) => o.id === s.orderId);
    if (order) order.status = 'queued';
    r.staff = r.staff.filter((x) => x !== s);
    ctx.state.crew.pending = ctx.state.crew.pending.filter((p) => p.who !== s.id);
    ctx.bus.emit('kitchen/changed', { tier: r.kitchenTier, chefs: r.staff.length });
    return ok();
  },
  'chef/setDish'(ctx: SimContext, cmd: { chefId: string; recipeId: string | null; on: boolean }) {
    const s = chef(ctx, cmd.chefId);
    if (!s) return fail('Không có đầu bếp này.');
    if (cmd.recipeId == null) {
      s.dishes = null;
      return ok();
    }
    if (!ctx.content.recipes.has(cmd.recipeId)) return fail('Không có món này.');
    // Đang nấu mọi món mà bấm một món: chuyển sang chỉ nấu đúng món đó
    const list = s.dishes ?? [];
    s.dishes = cmd.on ? [...new Set([...list, cmd.recipeId])] : list.filter((id) => id !== cmd.recipeId);
    return ok();
  },
};
