import { recipesFor, type RecipeDef } from '../../data';
import type { Game } from '../../sim/game';
import { craftableCount, stockOf } from '../../sim/helpers';
import { cmd, esc, ui as uiAttr } from '../dom';
import { itemTipHtml } from '../sources';
import { coins, duration, qty } from '../format';
import type { Panel, UiState } from './types';
import { isSeasonalDish, seasonalPrice, seasonNames } from '../../sim/calendar';

/** Tag nguyên liệu của món - bấm để xem nguyên liệu đó kiếm ở đâu (chợ / trồng / nuôi / chế biến), tooltip ngay dưới. */
function ingredients(game: Game, recipe: RecipeDef, ui: UiState): string {
  const prefix = `m-${recipe.id}:`;
  const chips = recipe.ingredients
    .map((ing) => {
      const item = game.content.items.get(ing.item);
      const have = stockOf(game.ctx, ing.item);
      const label = item.infinite ? '' : ` ${have}/${ing.qty}`;
      const key = prefix + ing.item;
      return `<button class="chip item-chip ${have >= ing.qty ? '' : 'bad'}${ui.itemTip === key ? ' on' : ''}" title="Bấm để xem ${esc(item.name)} kiếm ở đâu"${uiAttr(`itemTip:${key}`)}>${item.icon}${label}</button>`;
    })
    .join('');
  const tipItem = ui.itemTip?.startsWith(prefix) ? ui.itemTip.slice(prefix.length) : null;
  return `<div class="chips">${chips}</div>${tipItem && game.content.items.has(tipItem) ? itemTipHtml(game, tipItem) : ''}`;
}

export const menuPanel: Panel = {
  id: 'menu',
  label: 'Thực đơn',
  icon: '📖',
  // Số món đang bán sắp hết nguyên liệu
  badge(game) {
    const { state, content, ctx } = game;
    return state.menu.active.filter((id) => craftableCount(ctx, content.recipes.get(id).ingredients) < content.balance.lowStockPortions).length;
  },
  render(game, ui) {
    const { state, content, ctx } = game;
    const recipes = recipesFor(content, state.cuisine);

    const unlocked = recipes
      .filter((r) => state.menu.unlocked.includes(r.id))
      .map((r) => {
        const active = state.menu.active.includes(r.id);
        const can = craftableCount(ctx, r.ingredients);
        const low = active && can < content.balance.lowStockPortions;
        return `<div class="card ${active ? '' : 'off'}${low ? ' low-stock' : ''}" data-key="${r.id}">${low ? `<div class="low-note">⚠️ ${can ? 'Sắp hết nguyên liệu' : 'Hết nguyên liệu'} - thiếu: ${missingText(game, r)}</div>` : ''}
          <div class="row"><span class="big">${r.icon}</span>
            <div class="grow"><b>${esc(r.name)}</b>
              ${seasonBadge(game, r)}<div class="muted">${priceText(game, r)} · nấu ${duration(r.cookTime)} · còn nấu được <b class="${can ? '' : 'bad-text'}">${qty(can)}</b> phần</div></div>
            <button class="${active ? 'on' : ''}"${cmd({ type: 'menu/setActive', recipeId: r.id, active: !active })}>${active ? 'Đang bán' : 'Tạm ngưng'}</button>
          </div>
          ${ingredients(game, r, ui)}</div>`;
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
              ${seasonBadge(game, r)}<div class="muted">Bán ${priceText(game, r)} · nấu ${duration(r.cookTime)}</div></div>
            <button${cmd({ type: 'menu/unlock', recipeId: r.id })}${canBuy ? '' : ' disabled'}>${levelOk ? `Học món · ${coins(r.unlock.cost)}` : `🔒 Cấp ${r.unlock.level}`}</button>
          </div>
          ${ingredients(game, r, ui)}</div>`;
      })
      .join('');

    return `<h3>Món đang có</h3>${unlocked}${locked ? `<h3>Món chưa học</h3>${locked}` : ''}`;
  },
};

/** Nhãn món hợp mùa: đúng mùa thì nổi bật (bán đắt hơn), khác mùa thì ghi mùa của món. */
function seasonBadge(game: Game, r: RecipeDef): string {
  if (!r.seasons) return '';
  return isSeasonalDish(game.ctx, r)
    ? `<span class="season-tag ok" title="Đang đúng mùa: giá bán cao hơn">Món hợp mùa +${Math.round((game.content.balance.seasons.dishBonus - 1) * 100)}%</span>`
    : `<span class="season-tag" title="Bán đắt hơn vào mùa này">Hợp mùa ${seasonNames(r.seasons)}</span>`;
}

/** Giá bán hôm nay (đúng mùa thì gạch giá gốc). */
function priceText(game: Game, r: RecipeDef): string {
  const now = seasonalPrice(game.ctx, r);
  return now !== r.price ? `<s>${r.price}</s> <b class="good-text">${coins(now)}</b>` : coins(r.price);
}

/** Nguyên liệu đang thiếu cho 3 phần nữa (để biết cần mua gì). */
function missingText(game: Game, r: RecipeDef): string {
  const want = game.content.balance.lowStockPortions;
  const miss = r.ingredients
    .map((ing) => ({ item: game.content.items.get(ing.item), need: ing.qty * want - stockOf(game.ctx, ing.item) }))
    .filter((m) => !m.item.infinite && m.need > 0);
  return miss.map((m) => `${m.item.icon} ${esc(m.item.name)} ×${m.need}`).join(', ') || 'đủ';
}
