import type { QuestDef, QuestGoalKind } from '../../data';
import { addXp } from '../helpers';
import { fail, ok, type SimContext, type System } from '../types';

/**
 * NHIỆM VỤ HỆ THỐNG: chuỗi nhiệm vụ trong src/data/quests.ts, làm lần lượt.
 *  - Mục tiêu dạng đếm (serve, happy, harvest, produce): system khác gọi bumpQuest() đúng lúc chuyện xảy ra;
 *    chỉ đếm khi nhiệm vụ đó đang được làm.
 *  - Mục tiêu dạng trạng thái (unlock, revenue, reputation): update() đọc thẳng từ state mỗi bước.
 * Đạt mục tiêu → state.quests.done = true (phát 'quest/completed'); lệnh quest/claim nhận thưởng và mở nhiệm vụ kế.
 */
export const questSystem: System = {
  id: 'quests',
  update(ctx) {
    const q = ctx.state.quests;
    const def = currentQuest(ctx);
    if (!def || q.done) return;
    const value = stateValue(ctx, def);
    if (value != null) q.progress = Math.min(def.goal.target, value);
    if (q.progress >= def.goal.target) {
      q.progress = def.goal.target;
      q.done = true;
      ctx.bus.emit('quest/completed', { questId: def.id });
    }
  },
  commands: {
    'quest/claim'(ctx) {
      const q = ctx.state.quests;
      const def = currentQuest(ctx);
      if (!def) return fail('Đã xong hết nhiệm vụ.');
      if (!q.done) return fail('Nhiệm vụ chưa hoàn thành.');
      // Thưởng không tính vào doanh thu ngày (để nhiệm vụ "doanh thu" không tự cộng dồn)
      ctx.state.money += def.reward.money ?? 0;
      if (def.reward.xp) addXp(ctx, def.reward.xp);
      ctx.bus.emit('quest/claimed', { questId: def.id, money: def.reward.money ?? 0 });
      Object.assign(q, { index: q.index + 1, progress: 0, done: false });
      return ok();
    },
  },
};

/** Nhiệm vụ đang làm (null khi đã xong hết). */
export function currentQuest(ctx: SimContext): QuestDef | null {
  return ctx.content.quests[ctx.state.quests.index] ?? null;
}

/** Cộng tiến độ cho mục tiêu dạng đếm — chỉ khi nhiệm vụ đang làm có đúng loại mục tiêu này. */
export function bumpQuest(ctx: SimContext, kind: QuestGoalKind, n = 1): void {
  const def = currentQuest(ctx);
  const q = ctx.state.quests;
  if (!def || q.done || def.goal.kind !== kind) return;
  q.progress = Math.min(def.goal.target, q.progress + n);
}

/** Tiến độ của mục tiêu dạng trạng thái; null = mục tiêu dạng đếm. */
function stateValue(ctx: SimContext, def: QuestDef): number | null {
  const { state, content } = ctx;
  switch (def.goal.kind) {
    case 'unlock':
      return state.menu.unlocked.filter((id) => {
        const r = content.recipes.get(id);
        return r.unlock.level > 1 || r.unlock.cost > 0;
      }).length;
    case 'revenue':
      return state.stats.today.revenue;
    case 'reputation':
      return Math.floor(state.reputation * 10) / 10;
    default:
      return null;
  }
}
