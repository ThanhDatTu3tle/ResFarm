import { recipesFor, type RecipeDef } from '../../data';
import type { Game } from '../../sim/game';
import { craftableCount, stockOf } from '../../sim/helpers';
import { cmd, esc } from '../dom';
import { coins, duration, qty } from '../format';
import type { Panel } from './types';

function ingredients(game: Game, recipe: RecipeDef): string {
  return recipe.ingredients
    .map((ing) => {
      const item = game.content.items.get(ing.item);
      const have = stockOf(game.ctx, ing.item);
      const label = item.infinite ? '' : ` ${have}/${ing.qty}`;
      return `<span class="chip ${have >= ing.qty ? '' : 'bad'}" title="${esc(item.name)}">${item.icon}${label}</span>`;
    })
    .join('');
}

export const menuPanel: Panel = {
  id: 'menu',
  label: 'Thực đơn',
  icon: '📖',
  render(game) {
    const { state, content, ctx } = game;
    const recipes = recipesFor(content, state.cuisine);

    const unlocked = recipes
      .filter((r) => state.menu.unlocked.includes(r.id))
      .map((r) => {
        const active = state.menu.active.includes(r.id);
        const can = craftableCount(ctx, r.ingredients);
        return `<div class="card ${active ? '' : 'off'}" data-key="${r.id}">
          <div class="row"><span class="big">${r.icon}</span>
            <div class="grow"><b>${esc(r.name)}</b>
              <div class="muted">${coins(r.price)} · nấu ${duration(r.cookTime)} · còn nấu được <b class="${can ? '' : 'bad-text'}">${qty(can)}</b> phần</div></div>
            <button class="${active ? 'on' : ''}"${cmd({ type: 'menu/setActive', recipeId: r.id, active: !active })}>${active ? 'Đang bán' : 'Tạm ngưng'}</button>
          </div>
          <div class="chips">${ingredients(game, r)}</div></div>`;
      })
      .join('');

    const locked = recipes
      .filter((r) => !state.menu.unlocked.includes(r.id))
      .map((r) => {
        const levelOk = state.level >= r.unlock.level;
        const canBuy = levelOk && state.money >= r.unlock.cost;
        return `<div class="card locked" data-key="${r.id}">
          <div class="row"><span class="big">${r.icon}</span>
            <div class="grow"><b>${esc(r.name)}</b>
              <div class="muted">Bán ${coins(r.price)} · nấu ${duration(r.cookTime)}</div></div>
            <button${cmd({ type: 'menu/unlock', recipeId: r.id })}${canBuy ? '' : ' disabled'}>${levelOk ? `Học món · ${coins(r.unlock.cost)}` : `🔒 Cấp ${r.unlock.level}`}</button>
          </div>
          <div class="chips">${ingredients(game, r)}</div></div>`;
      })
      .join('');

    return `<h3>Món đang có</h3>${unlocked}${locked ? `<h3>Món chưa học</h3>${locked}` : ''}`;
  },
};
