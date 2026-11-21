import { activeTables, occupiedSeats } from '../../sim/systems/customers';
import type { Game } from '../../sim/game';
import { kitchenTierOf, passSlots } from '../../sim/systems/kitchen';
import { bar, cmd, esc, ui } from '../dom';
import { bonusText } from './shop';
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
    // Quán của riêng mình: tên, hạng quán, thú cưng, đồ trang trí đang cất kho
    const tiers = content.room.tiers;
    const tier = tiers[state.restaurant.tier - 1];
    const next = tiers[state.restaurant.tier];
    const pets = state.profile.petsOut.map((id) => content.pets.get(id));
    const upgrade = next
      ? `<div class="card" data-key="tier-next"><div class="row"><span class="big">${next.icon}</span>
          <div class="grow"><b>Nâng lên ${esc(next.name)}</b><div class="muted">${esc(next.desc)}</div></div>
          <button${cmd({ type: 'restaurant/upgrade' })}${state.level >= next.level && state.money >= next.cost ? '' : ' disabled'}>${state.level >= next.level ? coins(next.cost) : `🔒 Cấp ${next.level}`}</button></div></div>`
      : '<div class="muted">🏆 Quán đã lên hạng cao nhất.</div>';
    const stored = state.restaurant.props.filter((p) => p.stored);
    const storage = stored.length
      ? `<h3>Kho đồ trang trí</h3>${stored
          .map((p) => {
            const def = content.props.get(p.def);
            return `<div class="row" data-key="st-${p.uid}"><span class="big">${def.icon}</span><div class="grow"><b>${esc(def.name)}</b><div class="muted">${bonusText(def.modifiers) || 'Chỉ để đẹp'}</div></div><button class="mini"${cmd({ type: 'prop/place', uid: p.uid })}>Bày ra</button></div>`;
          })
          .join('')}`
      : '';
    return `
      <div class="shop-card" data-key="profile">
        <div class="row"><span class="big">${tier.icon}</span>
          <div class="grow"><b class="shop-name">${esc(state.profile.name)}</b><div class="muted">Hạng: ${esc(tier.name)}${pets.map((p) => ` · ${p.icon} ${esc(p.name)}`).join('')}</div></div>
</div>
        <div class="row shop-actions"><button class="mini"${ui('rename')}>✏️ Đổi tên quán</button><button class="mini"${ui('rename:owner')}>🙋 Tên chủ quán</button><button class="mini"${ui('photo')}>📸 Chụp ảnh quán</button></div>
      </div>
      ${upgrade}${storage}
      <h3>Gian bếp</h3>${kitchenCard(game)}${chefs}
      <div class="muted">🔔 Món chờ ở quầy ra món: ${atPass.length ? atPass.map((o) => content.recipes.get(o.recipeId).icon).join(' ') : 'không có'}</div>
      <div class="muted">Đơn đang chờ: ${queued.length ? queued.map((o) => content.recipes.get(o.recipeId).icon).join(' ') : 'không có'}</div>
      <div class="row"><h3 class="grow">Bàn ăn</h3><button class="mini"${ui('edit')}>🪑 Sắp xếp quán</button></div><div class="chips">${tables}</div>
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

/** Hạng bếp hiện tại + nút nâng hạng (bếp + quầy line). */
function kitchenCard(game: Game): string {
  const { state, content, ctx } = game;
  const tiers = content.balance.kitchen.tiers;
  const cur = kitchenTierOf(ctx);
  const next = tiers[state.restaurant.kitchenTier];
  const now = `<div class="muted">${cur.icon} <b>${esc(cur.name)}</b> · ${state.restaurant.staff.length}/${cur.chefs} đầu bếp · quầy line ${passSlots(ctx)} đĩa</div>`;
  const up = next
    ? `<div class="card" data-key="kitchen-next"><div class="row"><span class="big">${next.icon}</span>
        <div class="grow"><b>Mở rộng bếp: ${esc(next.name)}</b><div class="muted">${esc(next.desc)}</div></div>
        <button${cmd({ type: 'kitchen/upgrade' })}${state.level >= next.level && state.money >= next.cost ? '' : ' disabled'}>${state.level >= next.level ? coins(next.cost) : `🔒 Cấp ${next.level}`}</button></div></div>`
    : '<div class="muted">🏅 Bếp đã ở hạng cao nhất.</div>';
  return now + up;
}
