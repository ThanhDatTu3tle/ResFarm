import { festivalOf } from '../calendar';
import type { System } from '../types';

/**
 * Lễ hội: hiệu ứng (khách đông, tip...) tính thẳng trong `modifier()` theo ngày; system này chỉ trao tiền mừng
 * đầu ngày lễ (lì xì Tết...) và báo cho UI. Danh sách lễ ở `src/data/calendar.ts` (`festivals`).
 */
export const festivalSystem: System = {
  id: 'festival',
  onDayStart(ctx) {
    const def = festivalOf(ctx.state.clock.day);
    if (!def) return;
    // Tiền mừng không phải doanh thu bán hàng: cộng thẳng, không vào thống kê
    if (def.gift) ctx.state.money += def.gift;
    ctx.bus.emit('festival/started', { id: def.id, gift: def.gift ?? 0 });
  },
};
