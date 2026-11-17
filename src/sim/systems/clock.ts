import type { System } from '../types';

/** Đồng hồ trong ngày: open -> (hết giờ) closing -> (hết khách) summary. Sang ngày mới do lệnh 'day/next' ở game.ts. */
export const clockSystem: System = {
  id: 'clock',
  update(ctx, dt) {
    const { clock, restaurant, stats } = ctx.state;
    clock.minute += dt;
    if (clock.phase === 'open' && clock.minute >= ctx.content.balance.closeMinute) clock.phase = 'closing';
    if (clock.phase === 'closing' && restaurant.parties.length === 0) {
      clock.phase = 'summary';
      ctx.bus.emit('day/ended', { day: clock.day, stats: stats.today });
    }
  },
};
