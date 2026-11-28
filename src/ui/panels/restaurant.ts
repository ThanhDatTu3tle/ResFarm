import { activeTables, occupiedSeats } from '../../sim/systems/customers';
import { FULL_KIT_DISCOUNT, fullKitPlan, lotsCleared, type FullKitPlan } from '../../sim/systems/home';
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
    const pets = state.profile.petsOut.map((id) => content.pets.get(id));
    const upgrade = upgradeCards(game);
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

let kitCache: { key: string; plan: FullKitPlan | null } | null = null;

/** Gói nâng hạng + đủ bàn (tính lại khi bố cục / hạng / cấp đổi - chạy thử trên bản sao state nên không tính mỗi khung hình). */
function cachedKit(game: Game): FullKitPlan | null {
  const r = game.state.restaurant;
  const key = JSON.stringify([r.tier, game.state.level, r.layout, r.extraTables, r.storedTables, r.props.length]);
  if (kitCache?.key !== key) kitCache = { key, plan: fullKitPlan(game.ctx) };
  return kitCache.plan;
}

/** Thẻ nâng hạng quán: nâng thường + gói "nâng hạng + trang bị đủ bàn" giảm giá (dùng ở bảng Quán và Siêu thị). */
export function upgradeCards(game: Game): string {
  const { state, content } = game;
  const next = content.room.tiers[state.restaurant.tier];
  if (!next) return '<div class="muted">🏆 Quán đã lên hạng cao nhất.</div>';
  const unlocked = state.level >= next.level;
  // Bãi đất hoang bên Đông: phải dọn xong lô kế bên mới nâng hạng được
  const lot = next.id - 1;
  if (lotsCleared(state) < lot && next.clear) {
    const clearing = state.restaurant.lots?.clearing;
    const pct = clearing ? Math.round((1 - clearing.left / next.clear.minutes) * 100) : 0;
    const left = clearing ? Math.ceil(clearing.left / 60 * 10) / 10 : 0;
    const btn = clearing
      ? '<button disabled>🚧 Đang dọn</button>'
      : `<button${cmd({ type: 'lot/clear' })}${unlocked && state.money >= next.clear.cost ? '' : ' disabled'}>${unlocked ? coins(next.clear.cost) : `🔒 Cấp ${next.level}`}</button>`;
    return `<div class="card" data-key="lot-${lot}"><div class="row"><span class="big">🚧</span>
    <div class="grow"><b>Dọn lô đất hoang số ${lot}</b>
    <div class="muted">${clearing
      ? `Đội thợ đang dọn xà bần, cỏ dại… ${pct}% - còn khoảng ${left} giờ.`
      : `Bãi đất bỏ hoang cạnh quán. Thuê đội thợ dọn sạch (${next.clear.minutes / 60} giờ) để mở rộng lên ${esc(next.name)}.`}</div>
    ${clearing ? `<div class="bar green"><i style="width:${pct}%"></i></div>` : ''}</div>
    ${btn}</div></div>`;
  }
  const plain = `<div class="card" data-key="tier-next"><div class="row"><span class="big">${next.icon}</span>
    <div class="grow"><b>Nâng lên ${esc(next.name)}</b><div class="muted">${esc(next.desc)}</div></div>
    <button${cmd({ type: 'restaurant/upgrade' })}${unlocked && state.money >= next.cost ? '' : ' disabled'}>${unlocked ? coins(next.cost) : `🔒 Cấp ${next.level}`}</button></div></div>`;
  const kit = unlocked ? cachedKit(game) : null;
  if (!kit || !kit.tables.length) return plain;
  const counts = new Map<string, number>();
  for (const t of kit.tables) counts.set(t.kind, (counts.get(t.kind) ?? 0) + 1);
  const list = [...counts].map(([k, n]) => `${n} ${esc(content.tableKinds.get(k).name.toLowerCase())}`).join(', ');
  const combo = `<div class="card" data-key="tier-full"><div class="row"><span class="big">🎁</span>
    <div class="grow"><b>Nâng hạng + trang bị đủ bàn (giảm ${Math.round(FULL_KIT_DISCOUNT * 100)}%)</b>
    <div class="muted">Lên ${esc(next.name)} và mua luôn ${list} - bàn tự xếp vào chỗ đẹp. Mua lẻ: nâng hạng ${coins(kit.upgradeCost)} + bàn ${coins(kit.full - kit.upgradeCost)} = <s>${coins(kit.full)}</s>, tiết kiệm ${coins(kit.full - kit.price)}.</div></div>
    <button${cmd({ type: 'restaurant/upgradeFull' })}${state.money >= kit.price ? '' : ' disabled'}>${coins(kit.price)}</button></div></div>`;
  return plain + combo;
}
