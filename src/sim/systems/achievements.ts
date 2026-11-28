import { achievements, type AchievementDef, type AchievementStat } from '../../data/achievements';
import { addXp } from '../helpers';
import { fail, ok, type SimContext, type System } from '../types';

/**
 * SỔ THÀNH TỰU (danh sách ở src/data/achievements.ts).
 *  - Bộ đếm trọn ván `achievements.counts` (serve, happy, harvest, produce, contract) cộng qua `tally()` - quests.ts gọi trong `bumpQuest`.
 *  - Chỉ số còn lại đọc thẳng từ state (`achievementValue`).
 *  - Đạt mốc → thêm vào `done` + sự kiện `achievement/reached`; lệnh `achievement/claim` nhận thưởng (không tính vào doanh thu ngày).
 */
export const achievementSystem: System = {
  id: 'achievements',
  update(ctx) {
    const a = ctx.state.achievements;
    for (const def of achievements) {
      if (a.done.includes(def.id) || achievementValue(ctx, def.stat) < def.target) continue;
      a.done.push(def.id);
      ctx.bus.emit('achievement/reached', { id: def.id });
    }
  },
  commands: {
    'achievement/claim'(ctx, cmd) {
      const a = ctx.state.achievements;
      const def = achievements.find((x) => x.id === cmd.id);
      if (!def) return fail('Không có thành tựu này.');
      if (!a.done.includes(def.id)) return fail('Chưa đạt thành tựu này.');
      if (a.claimed.includes(def.id)) return fail('Đã nhận thưởng rồi.');
      a.claimed.push(def.id);
      ctx.state.money += def.reward.money ?? 0;
      if (def.reward.xp) addXp(ctx, def.reward.xp);
      ctx.bus.emit('achievement/claimed', { id: def.id, money: def.reward.money ?? 0 });
      return ok();
    },
    'achievement/friends'(ctx, cmd) {
      if (!Number.isInteger(cmd.count) || cmd.count < 0) return fail('Số bạn không hợp lệ.');
      const c = ctx.state.achievements.counts;
      c.friends = Math.max(c.friends ?? 0, cmd.count);
      return ok();
    },
  },
};

/** Cộng bộ đếm trọn ván. */
export function tally(ctx: SimContext, stat: string, n = 1): void {
  const c = ctx.state.achievements.counts;
  c[stat] = (c[stat] ?? 0) + n;
}

export function achievementValue(ctx: SimContext, stat: AchievementStat): number {
  const { state } = ctx;
  switch (stat) {
    case 'revenue':
      return state.stats.total.revenue;
    case 'day':
      return state.clock.day;
    case 'level':
      return state.level;
    case 'reputation':
      return Math.floor(state.reputation * 10) / 10;
    case 'recipes':
      return state.menu.unlocked.length;
    case 'gardener':
      return state.farm.gardeners.length;
    case 'tool':
      return state.farm.tools.length;
    default:
      return state.achievements.counts[stat] ?? 0;
  }
}

/** Số thành tựu đã đạt mà chưa nhận thưởng (badge trên nút). */
export function claimableAchievements(ctx: SimContext): AchievementDef[] {
  const a = ctx.state.achievements;
  return achievements.filter((d) => a.done.includes(d.id) && !a.claimed.includes(d.id));
}
