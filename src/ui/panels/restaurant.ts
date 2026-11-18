import { activeTables, occupiedSeats } from '../../sim/systems/customers';
import { bar, esc, ui } from '../dom';
import { coins } from '../format';
import type { Panel } from './types';

export const restaurantPanel: Panel = {
  id: 'restaurant',
  label: 'Quán',
  icon: '🏠',
  render(game) {
    const { state, content, ctx } = game;
    const { orders, staff, parties } = state.restaurant;

    const chefs = staff
      .map((s) => {
        const def = content.staff.get(s.id);
        const order = orders.find((o) => o.id === s.orderId);
        const recipe = order && content.recipes.get(order.recipeId);
        return `<div class="row" data-key="${s.id}">
          <span class="big">${def.icon}</span>
          <div class="grow"><b>${esc(def.name)}</b>
            <div class="muted">${recipe ? `${recipe.icon} ${esc(recipe.name)}` : 'Đang rảnh'}</div>
            ${order && recipe ? bar(order.progress / recipe.cookTime) : ''}
          </div></div>`;
      })
      .join('');

    const queued = orders.filter((o) => o.status === 'queued');
    const atPass = orders.filter((o) => o.status === 'ready');
    const tables = activeTables(ctx)
      .map((t) => {
        const used = occupiedSeats(ctx, t.id).length;
        return `<div class="chip ${used ? 'on' : ''}">${esc(t.name)} <b>${used}/${t.seats}</b></div>`;
      })
      .join('');

    const today = state.stats.today;
    const waiting = parties.filter((p) => p.phase === 'queue').length;
    return `
      <h3>Gian bếp</h3>${chefs}
      <div class="muted">🔔 Món chờ ở quầy ra món: ${atPass.length ? atPass.map((o) => content.recipes.get(o.recipeId).icon).join(' ') : 'không có'}</div>
      <div class="muted">Đơn đang chờ: ${queued.length ? queued.map((o) => content.recipes.get(o.recipeId).icon).join(' ') : 'không có'}</div>
      <div class="row"><h3 class="grow">Bàn ăn</h3><button class="mini"${ui('edit')}>🪑 Sắp xếp bàn</button></div><div class="chips">${tables}</div>
      <div class="muted">Khách đang xếp hàng: ${waiting} nhóm</div>
      <h3>Hôm nay</h3>
      <div class="stats">
        <div><span>Doanh thu</span><b>${coins(today.revenue)}</b></div>
        <div><span>Trong đó tip</span><b>${coins(today.tips)}</b></div>
        <div><span>Đã chi</span><b>${coins(today.spent)}</b></div>
        <div><span>Món đã nấu</span><b>${today.dishes}</b></div>
        <div><span>Khách hài lòng</span><b>${today.guestsServed}</b></div>
        <div><span>Khách bỏ về</span><b>${today.guestsLost}</b></div>
      </div>`;
  },
};
