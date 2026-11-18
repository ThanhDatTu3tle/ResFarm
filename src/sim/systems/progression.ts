import { spend } from '../helpers';
import { fail, ok, type System } from '../types';

/** Thực đơn (mở khoá món, bật/tắt món đang bán) và nâng cấp quán. */
export const progressionSystem: System = {
  id: 'progression',
  commands: {
    'menu/unlock'(ctx, cmd) {
      const { state, content } = ctx;
      if (!content.recipes.has(cmd.recipeId) || content.recipes.get(cmd.recipeId).cuisine !== state.cuisine) return fail('Quán mình không bán món này.');
      if (state.menu.unlocked.includes(cmd.recipeId)) return fail('Món đã được mở.');
      const { unlock } = content.recipes.get(cmd.recipeId);
      if (state.level < unlock.level) return fail(`Cần cấp ${unlock.level}.`);
      if (!spend(ctx, unlock.cost)) return fail('Không đủ tiền.');
      state.menu.unlocked.push(cmd.recipeId);
      state.menu.active.push(cmd.recipeId);
      return ok();
    },
    'menu/setActive'(ctx, cmd) {
      const { menu } = ctx.state;
      if (!menu.unlocked.includes(cmd.recipeId)) return fail('Món chưa được mở.');
      menu.active = menu.active.filter((id) => id !== cmd.recipeId);
      if (cmd.active) menu.active.push(cmd.recipeId);
      return ok();
    },
    'upgrade/buy'(ctx, cmd) {
      const { state, content } = ctx;
      if (!content.upgrades.has(cmd.upgradeId)) return fail('Không có nâng cấp này.');
      if (state.upgrades.includes(cmd.upgradeId)) return fail('Đã mua rồi.');
      const def = content.upgrades.get(cmd.upgradeId);
      if (state.level < def.level) return fail(`Cần cấp ${def.level}.`);
      if (def.requires && !state.upgrades.includes(def.requires)) return fail(`Cần mua "${content.upgrades.get(def.requires).name}" trước.`);
      if (!spend(ctx, def.cost)) return fail('Không đủ tiền.');
      state.upgrades.push(cmd.upgradeId);
      return ok();
    },
  },
};
