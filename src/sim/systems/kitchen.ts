import { modifier } from '../helpers';
import type { System } from '../types';

/**
 * Bếp: mỗi đầu bếp nấu 1 đơn một lúc, lấy đơn cũ nhất còn chờ.
 * Nấu xong thì đặt món ra quầy ra món ('ready'); bồi bàn (người chơi) bưng lên bàn — xem service.ts.
 */
export const kitchenSystem: System = {
  id: 'kitchen',
  update(ctx, dt) {
    const { state, content } = ctx;
    const { orders, staff } = state.restaurant;
    const speedMul = modifier(ctx, 'cookSpeed');

    for (const s of staff) {
      if (s.orderId == null) {
        const next = orders.find((o) => o.status === 'queued');
        if (!next) continue;
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
      }
    }
  },
};
