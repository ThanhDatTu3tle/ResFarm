import type { System } from '../types';
import { addStains } from './service';

/** Đồng hồ trong ngày: open -> (hết giờ) closing -> (hết khách) summary. Sang ngày mới do lệnh 'day/next' ở game.ts. */
export const clockSystem: System = {
  id: 'clock',
  update(ctx, dt) {
    const { clock, restaurant, stats } = ctx.state;
    const before = clock.minute;
    clock.minute += dt;
    // Đầu / cuối mỗi ca: báo cho UI; hết ca thì sàn bẩn thêm (khách ra vào cả ca)
    ctx.content.balance.shifts.forEach((s, index) => {
      if (before < s.from && clock.minute >= s.from) ctx.bus.emit('shift/started', { index });
      if (before < s.to && clock.minute >= s.to) {
        addStains(ctx);
        ctx.bus.emit('shift/ended', { index });
      }
    });
    if (clock.phase === 'open' && clock.minute >= ctx.content.balance.closeMinute) clock.phase = 'closing';
    if (clock.phase === 'closing' && restaurant.parties.length === 0) {
      clock.phase = 'summary';
      ctx.bus.emit('day/ended', { day: clock.day, stats: stats.today });
    }
  },
};
