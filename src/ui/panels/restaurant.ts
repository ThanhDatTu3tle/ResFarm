import { activeTables, occupiedSeats } from '../../sim/systems/customers';
import { bar, cmd, esc, ui } from '../dom';
import { bonusText } from './shop';
import { maxHelpers } from '../../sim/systems/helpers';
import { inShift } from '../../sim/systems/customers';
import type { HelperJob } from '../../sim/state';

const JOBS: [HelperJob, string][] = [
  ['serve', '🍽️ Bưng món'],
  ['menu', '📖 Menu & ghi món'],
  ['clean', '🧽 Dọn bàn'],
  ['mop', '🧹 Lau sàn'],
];
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
    const pet = state.profile.pet ? content.pets.get(state.profile.pet) : null;
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
          <div class="grow"><b class="shop-name">${esc(state.profile.name)}</b><div class="muted">Hạng: ${esc(tier.name)}${pet ? ` · ${pet.icon} ${esc(pet.name)}` : ''}</div></div>
</div>
        <div class="row shop-actions"><button class="mini"${ui('rename')}>✏️ Đổi tên quán</button><button class="mini"${ui('photo')}>📸 Chụp ảnh quán</button></div>
      </div>
      ${upgrade}${storage}
      ${helpersHtml(game)}
      <h3>Gian bếp</h3>${chefs}
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

/** Nhân viên phục vụ thuê thêm: năng lượng, việc được giao, đi ăn hàng rong (giờ nghỉ), bồi dưỡng khi xỉu. */
function helpersHtml(game: import('../../sim/game').Game): string {
  const { state, content, ctx } = game;
  const r = state.restaurant;
  const b = content.balance.helpers;
  const max = maxHelpers(ctx);
  const resting = state.clock.phase === 'open' && !inShift(ctx);
  const vendors = content.stalls.all().filter((s) => s.staffMeal).sort((a, c) => a.staffMeal!.energy - c.staffMeal!.energy);
  const cards = r.helpers
    .map((h) => {
      const pct = h.energy / b.maxEnergy;
      const status = h.away
        ? `🍜 Đang ăn ở ${esc(content.stalls.get(h.away.stallId).name)}`
        : h.fainted
          ? '😵 Kiệt sức, xỉu rồi!'
          : h.tasks.length
            ? '🏃 Đang làm việc'
            : '🙂 Đang rảnh';
      const jobs = JOBS.map(([job, label]) => `<button class="mini${h.jobs[job] ? ' on' : ''}"${cmd({ type: 'helper/setJob', helperId: h.id, job, on: !h.jobs[job] })}>${label}</button>`).join('');
      const eat =
        !h.away && !h.fainted
          ? resting
            ? `<div class="muted">Cho đi ăn (giờ nghỉ):</div><div class="chips">${vendors
                .map((v) => `<button class="mini"${cmd({ type: 'helper/eat', helperId: h.id, stallId: v.id })}>${v.icon} ${esc(v.name)} · +${v.staffMeal!.energy}⚡ · ${coins(v.staffMeal!.price)}</button>`)
                .join('')}</div>`
            : '<div class="muted">Giờ nghỉ (12:00–15:00, sau 20:00) mới cho đi ăn hàng rong được.</div>'
          : '';
      return `<div class="card helper${h.fainted ? ' fainted' : ''}" data-key="${h.id}">
        <div class="row"><span class="big">${h.fainted ? '😵' : '🧑‍🍳'}</span>
          <div class="grow"><b>${esc(h.name)}</b><div class="muted">${status}</div>
            <div class="energy">⚡ ${bar(pct)}<em>${Math.round(h.energy)}/${b.maxEnergy}</em></div></div>
        </div>
        ${h.fainted ? `<button class="primary wide"${cmd({ type: 'helper/revive', helperId: h.id })}>💊 Bồi dưỡng nhanh · ${coins(b.reviveCost)}</button>` : ''}
        <div class="chips jobs">${jobs}</div>
        ${eat}
        <div class="row end"><button class="mini ghost"${cmd({ type: 'helper/fire', helperId: h.id })}>Cho nghỉ việc</button></div>
      </div>`;
    })
    .join('');
  const hire =
    r.helpers.length < max
      ? `<button class="wide"${cmd({ type: 'helper/hire' })}${state.money >= b.hireCost ? '' : ' disabled'}>➕ Thuê nhân viên · ${coins(b.hireCost)}</button>`
      : `<div class="muted">${max >= content.room.tiers.length - 1 ? 'Đã đủ 4 nhân viên.' : `Nâng hạng quán để thuê thêm (mỗi bậc thêm 1 người, hiện ${r.helpers.length}/${max}).`}</div>`;
  return `<h3>Nhân viên phục vụ (${r.helpers.length}/${max})</h3>
    <p class="muted">Bật việc nào thì nhân viên tự làm việc đó. Mỗi việc tốn ⚡ năng lượng; cạn là xỉu. Giờ nghỉ cho ra chợ ăn hàng rong để nạp lại.</p>
    ${cards}${hire}`;
}
