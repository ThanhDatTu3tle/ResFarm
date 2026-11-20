import type { System } from '../types';
import { addStains } from './service';
import { tutorialClockCap } from './tutorial';
import type { DayStats } from '../state';

/** Đồng hồ trong ngày: open -> (hết giờ) closing -> (hết khách) summary. Sang ngày mới do lệnh 'day/next' ở game.ts. */
export const clockSystem: System = {
  id: 'clock',
  update(ctx, dt) {
    const { clock, restaurant, stats } = ctx.state;
    const before = clock.minute;
    // Ngày hướng dẫn: giờ đứng ở 10:30 tới khi làm xong các bước có kịch bản
    const cap = tutorialClockCap(ctx);
    clock.minute = cap != null && before < cap ? Math.min(cap, before + dt) : cap != null ? before : before + dt;
    // Đầu / cuối mỗi ca: báo cho UI; hết ca thì sàn bẩn thêm (khách ra vào cả ca)
    ctx.content.balance.shifts.forEach((s, index) => {
      if (before < s.from && clock.minute >= s.from) ctx.bus.emit('shift/started', { index });
      if (before < s.lastCall && clock.minute >= s.lastCall) ctx.bus.emit('shift/lastCall', { index });
      if (before < s.to && clock.minute >= s.to) {
        addStains(ctx);
        ctx.bus.emit('shift/ended', { index });
      }
    });
    if (clock.phase === 'open' && clock.minute >= ctx.content.balance.closeMinute) clock.phase = 'closing';
    if (clock.phase === 'closing' && restaurant.parties.length === 0) {
      clock.phase = 'summary';
      addInto(stats.season, stats.today);
      addInto(stats.year, stats.today);
      ctx.bus.emit('day/ended', { day: clock.day, stats: stats.today });
    }
  },
};

function addInto(into: DayStats, day: DayStats): void {
  for (const k of Object.keys(day) as (keyof DayStats)[]) into[k] += day[k];
}
