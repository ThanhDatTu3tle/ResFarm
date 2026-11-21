import { awayReason, crewMembers, maxEnergyOf, type CrewMember } from '../../sim/systems/crew';
import { kitchenTierOf, nextChefDef, uncookedDishes } from '../../sim/systems/kitchen';
import { maxHelpers } from '../../sim/systems/helpers';
import type { Game } from '../../sim/game';
import type { HelperJob, HelperState } from '../../sim/state';
import { clockText, coins } from '../format';
import { bar, cmd, esc, ui } from '../dom';
import type { Panel } from './types';

const JOBS: [HelperJob, string][] = [
  ['serve', '🍽️ Bưng món'],
  ['menu', '📖 Menu & ghi món'],
  ['clean', '🧽 Dọn bàn'],
  ['mop', '🧹 Lau sàn'],
];

const ROLE: Record<CrewMember['role'], string> = { chef: 'Đầu bếp', waiter: 'Phục vụ', helper: 'Nhân viên phục vụ', shipper: 'Giao hàng', farmer: 'Nông trại' };

/**
 * Bảng Nhân viên: cả đội (đầu bếp, bồi bàn, nhân viên thuê, bác nông dân) với thanh năng lượng, đang làm gì / đang ăn gì ở chợ,
 * nút bồi dưỡng khi xỉu; nhân viên thuê thì giao việc / cho nghỉ / thuê thêm.
 */
export const crewPanel: Panel = {
  id: 'crew',
  label: 'Nhân viên',
  icon: '👥',
  badge(game) {
    return crewMembers(game.ctx).filter((m) => m.vitals.fainted).length;
  },
  render(game) {
    const { state, content, ctx } = game;
    const b = content.balance.crew;
    const rows = crewMembers(ctx)
      .map((m) => {
        const meal = state.crew.meals.find((l) => l.who === m.who);
        const away = awayReason(ctx, m.group);
        const waiting = state.crew.pending.some((p) => p.who === m.who);
        const status = waiting
          ? `🧾 Đang chờ bạn gọi món <button class="mini"${ui('meal')}>🍜 Gọi món</button>`
          : meal
          ? `${meal.icon} Đang ăn ${esc(meal.dish)} ở ${esc(content.stalls.get(meal.stallId).name)}`
          : away
            ? (m.group === 'farm' ? state.crew.farmerAway : state.crew.restaurantAway) === 'dinner' ? '🌙 Đang chơi ở chợ' : '🧺 Đang ở chợ'
            : m.vitals.fainted
              ? '😵 Kiệt sức, xỉu rồi!'
              : busy(game, m)
                ? '🏃 Đang làm việc'
                : '🙂 Đang rảnh';
        const max = maxEnergyOf(game.ctx, m.who);
        const low = !m.vitals.fainted && m.vitals.energy <= max * 0.2;
        const revive =
          m.vitals.fainted && !away
            ? `<button class="primary wide"${cmd({ type: 'crew/revive', who: m.who })}${state.money >= b.reviveCost ? '' : ' disabled'}>💊 Bồi dưỡng nhanh · ${coins(b.reviveCost)}</button>`
            : '';
        const helper = m.role === 'helper' ? state.restaurant.helpers.find((h) => h.id === m.who) : undefined;
        return `<div class="card helper${m.vitals.fainted ? ' fainted' : ''}${low ? ' low' : ''}" data-key="${m.who}">
          <div class="row"><span class="big">${m.vitals.fainted ? '😵' : m.icon}</span>
            <div class="grow"><b>${esc(m.name)}</b> <span class="pill">${ROLE[m.role]}</span><div class="muted">${status}</div>
              <div class="energy">⚡ ${bar(m.vitals.energy / max)}<em>${Math.round(m.vitals.energy)}/${max}</em></div></div>
          </div>
          ${revive}${helper ? helperControls(helper) : ''}${m.role === 'chef' ? chefControls(game, m.who) : ''}
        </div>`;
      })
      .join('');
    const r = state.restaurant;
    const max = maxHelpers(ctx);
    const hb = content.balance.helpers;
    const hire =
      r.helpers.length < max
        ? `<button class="wide"${cmd({ type: 'helper/hire' })}${state.money >= hb.hireCost ? '' : ' disabled'}>➕ Thuê nhân viên phục vụ · ${coins(hb.hireCost)}</button>`
        : `<div class="muted">${max >= content.room.tiers.length - 1 ? 'Đã đủ 4 nhân viên phục vụ.' : `Nâng hạng quán để thuê thêm nhân viên phục vụ (mỗi bậc thêm 1 người, hiện ${r.helpers.length}/${max}).`}</div>`;
    const sick = r.helpers.filter((h) => h.sick).map((h) => `<div class="card helper sick" data-key="sick-${h.id}"><div class="row"><span class="big">🤒</span><div class="grow"><b>${esc(h.name)}</b> <span class="pill">Nhân viên</span><div class="muted">Bị bệnh, xin nghỉ hôm nay — mai đi làm lại.</div></div></div></div>`).join('');
    const team = r.helpers.length >= 2 ? `<p class="muted">🤵 ${esc(r.helpers[0].name)} làm quản lý. Từ 2 nhân viên, mỗi người giữ một bàn: mang menu bàn nào thì ghi món, bưng món, dọn bàn đó.</p>` : '';
    return `<p class="muted">Đầu bếp tối đa ${b.chefMaxEnergy} ⚡, bồi bàn / nhân viên / bác nông dân ${b.maxEnergy} ⚡. Đầu bếp nấu 1 món tốn ${b.chefPerDish}; phục vụ (menu, ghi món, bưng, lau sàn — dọn bàn không tốn) và bác nông dân (cuốc, gieo, tưới, thu hoạch) mỗi việc tốn ${b.waiterPerTask}. Cạn là xỉu.
      Nghỉ trưa: bác ra chợ ${clockText(b.farmerLunch.from)}–${clockText(b.farmerLunch.to)}, đội quán ra chợ khi hết ca sáng và quán vắng khách, ${clockText(b.lunchBack)} về. Tối sau ca cuối cả đội ra chợ ăn tối. Ngủ qua đêm là đầy sức.</p>
      ${uncookedNote(game)}${team}${rows}${sick}${chefHire(game)}${hire}`;
  },
};

/** Đang có việc trong tay không. */
function busy(game: Game, m: CrewMember): boolean {
  const { state } = game;
  if (m.role === 'chef') return state.restaurant.staff.some((s) => s.id === m.who && s.orderId != null);
  if (m.role === 'farmer') return state.farm.farmer.tasks.length > 0;
  if (m.role === 'shipper') return !!state.restaurant.shipper.trip;
  const w = m.role === 'waiter' ? state.restaurant.waiter : state.restaurant.helpers.find((h) => h.id === m.who);
  return !!w?.tasks.length;
}

function helperControls(h: HelperState): string {
  const jobs = JOBS.map(([job, label]) => `<button class="mini${h.jobs[job] ? ' on' : ''}"${cmd({ type: 'helper/setJob', helperId: h.id, job, on: !h.jobs[job] })}>${label}</button>`).join('');
  return `<div class="chips jobs">${jobs}</div>
    <div class="row end"><button class="mini ghost"${cmd({ type: 'helper/fire', helperId: h.id })}>Cho nghỉ việc</button></div>`;
}

/**
 * Giao món cho đầu bếp (chỉ hiện khi bếp có từ 2 đầu bếp): "Mọi món" hoặc chọn từng món đang bán.
 * Đầu bếp được giao món nào thì chỉ nhận đơn món đó — bếp tự chạy, không cần người chơi điều.
 */
function chefControls(game: Game, chefId: string): string {
  const { state, content } = game;
  const s = state.restaurant.staff.find((x) => x.id === chefId);
  if (!s) return '';
  const def = content.staff.get(s.id);
  const fire = def.hire ? `<div class="row end"><button class="mini ghost"${cmd({ type: 'chef/fire', chefId })}>Cho nghỉ việc</button></div>` : '';
  if (state.restaurant.staff.length < 2) return fire;
  const all = !s.dishes;
  const dishes = state.menu.active
    .map((id) => content.recipes.get(id))
    .map((r) => {
      const on = !all && s.dishes!.includes(r.id);
      return `<button class="mini${on ? ' on' : ''}"${cmd({ type: 'chef/setDish', chefId, recipeId: r.id, on: !on })} title="${esc(r.name)}">${r.icon} ${esc(r.name)}</button>`;
    })
    .join('');
  return `<div class="chef-dishes"><span class="muted">Nấu món:</span>
      <button class="mini${all ? ' on' : ''}"${cmd({ type: 'chef/setDish', chefId, recipeId: null, on: true })}>🍽️ Mọi món</button>${dishes}</div>${fire}`;
}

/** Thuê thêm đầu bếp (theo hạng bếp). */
function chefHire(game: Game): string {
  const { state, content, ctx } = game;
  const def = nextChefDef(ctx);
  if (!def) return '';
  const tier = kitchenTierOf(ctx);
  const cost = content.balance.kitchen.chefHireCost;
  return state.restaurant.staff.length < tier.chefs
    ? `<button class="wide"${cmd({ type: 'chef/hire' })}${state.money >= cost ? '' : ' disabled'}>🧑‍🍳 Thuê đầu bếp (${esc(def.name)}) · ${coins(cost)}</button>`
    : `<div class="muted">Bếp đủ ${tier.chefs} đầu bếp — mở rộng bếp (bảng Quán) để thuê thêm.</div>`;
}

/** Cảnh báo: món đang bán mà không đầu bếp nào được giao nấu. */
function uncookedNote(game: Game): string {
  const ids = uncookedDishes(game.ctx);
  if (!ids.length) return '';
  return `<div class="low-note">⚠️ Chưa đầu bếp nào nấu: ${ids.map((id) => `${game.content.recipes.get(id).icon} ${esc(game.content.recipes.get(id).name)}`).join(', ')} — khách gọi món này sẽ phải chờ mãi.</div>`;
}
