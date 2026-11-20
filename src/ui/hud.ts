import { seasons, weekdays } from '../data/calendar';
import { partyColor } from './colors';
import { defOf } from '../sim/systems/events';
import { craftableCount } from '../sim/helpers';
import type { RecipeDef } from '../data';
import { calendarOf } from '../sim/calendar';
import { readyOrders } from '../sim/systems/service';
import type { Game } from '../sim/game';
import { xpForLevel } from '../sim/helpers';
import { cmd, esc, ui as uiAttr } from './dom';
import { currentQuest } from '../sim/systems/quests';
import { questChapters } from '../data/quests';
import { mealCoachTip } from './coach';
import { acceptingGuests, inShift } from '../sim/systems/customers';
import { billDue, billTotal, crewMembers, maxEnergyOf, mealBudget, missingEnergy, orderedEnergy } from '../sim/systems/crew';
import { priceOf } from '../sim/systems/market';
import { stockOf } from '../sim/helpers';
import { clockText, coins } from './format';
import { panels, type UiState } from './panels';
import { festivalOf, isSeasonEnd, isYearEnd, nextFestival, seasonPriceFactor } from '../sim/calendar';
import type { DayStats } from '../sim/state';

/**
 * HUD trên cảnh 3D: bên trái là tiền + uy tín + huy hiệu cấp, bên phải là "đồng hồ" (vòng ngày đêm, lịch,
 * thời tiết, giờ) và nút bánh răng mở bảng Cài đặt. Hàm thuần: đọc state, trả HTML (app.ts morph vào #hud).
 */

export const SPEEDS = [0, 1, 2, 4];

/** Vòng tiến độ quanh huy hiệu cấp (SVG). */
function levelBadge(level: number, frac: number): string {
  const r = 19;
  const c = 2 * Math.PI * r;
  const pct = Math.round(Math.max(0, Math.min(1, frac)) * 100);
  return `<div class="level-badge" title="Cấp ${level} · ${pct}% tới cấp ${level + 1}">
    <svg viewBox="0 0 46 46" aria-hidden="true">
      <circle class="track" cx="23" cy="23" r="${r}" />
      <circle class="fill" cx="23" cy="23" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct / 100)).toFixed(1)}" />
    </svg>
    <b>${level}</b><span>Cấp</span>
  </div>`;
}

/**
 * Vòng ngày đêm: một đĩa trời (ngày ở trên, đêm ở dưới, mặt trời và mặt trăng đối nhau) xoay theo giờ,
 * nhìn qua ô cửa nửa vòng tròn. 12:00 mặt trời ở đỉnh; buổi sáng nằm bên trái, chiều tối sang phải.
 */
function dayDial(minute: number): string {
  const angle = ((minute - 720) / 1440) * 360;
  return `<div class="dial" aria-hidden="true">
    <div class="dial-disc" style="transform: rotate(${angle.toFixed(1)}deg)"><i class="sun">☀️</i><i class="moon">🌙</i></div>
    <div class="dial-pin"></div>
  </div>`;
}

/** Thẻ nhiệm vụ hệ thống dưới tiền / uy tín: nhiệm vụ đang làm + tiến độ; xong thì nút "Nhận thưởng". */
function questCard(game: Game): string {
  if (game.state.tutorial) return ''; // ngày hướng dẫn: thẻ chỉ dẫn nằm ở chỗ này
  const def = currentQuest(game.ctx);
  const total = game.content.quests.length;
  const q = game.state.quests;
  if (!def) return `<div class="quest all-done" data-key="quest" title="Đã hoàn thành mọi nhiệm vụ">🏆 Xong hết ${total} nhiệm vụ!</div>`;
  const shown = def.goal.kind === 'reputation' ? q.progress.toFixed(1) : Math.floor(q.progress);
  const pct = Math.round((q.progress / def.goal.target) * 100);
  const reward = [def.reward.money ? coins(def.reward.money) : '', def.reward.xp ? `${def.reward.xp} XP` : ''].filter(Boolean).join(' · ');
  return `<div class="quest${q.done ? ' done' : ''}" data-key="quest"${uiAttr('quest')} title="Bấm để xem chi tiết nhiệm vụ">
    <div class="quest-chapter">Chương ${def.chapter}: ${esc(questChapters[def.chapter - 1] ?? '')}</div>
    <div class="quest-head"><span class="quest-icon">${def.icon}</span><b>${esc(def.title)}</b><em>${q.index + 1}/${total}</em></div>
    <div class="quest-desc">${esc(def.desc)}</div>
    ${
      q.done
        ? `<button class="quest-claim"${cmd({ type: 'quest/claim' })}>🎁 Nhận thưởng · ${reward}</button>`
        : `<div class="quest-bar"><i style="width:${pct}%"></i><span>${shown}/${def.goal.target}</span></div>`
    }
  </div>`;
}

export function hudHtml(game: Game, ui: UiState, moneyShown: number): string {
  const { state, content } = game;
  const b = content.balance;
  const cal = calendarOf(state.clock.day);
  const season = seasons[cal.season];
  const weekday = weekdays[cal.weekday];
  const weather = content.weathers.get(state.weather.id);
  const open = state.clock.phase === 'open';
  const working = open && inShift(game.ctx);
  const rush = working && b.rushHours.some((h) => state.clock.minute >= h.from && state.clock.minute < h.to);
  const nextShift = b.shifts.find((s) => s.from > state.clock.minute);
  // Giờ làm tròn 10 phút cho gọn mắt, như đồng hồ treo tường
  const time = clockText(Math.floor(state.clock.minute / 10) * 10);
  // Trạng thái quán viết thẳng bằng chữ (không icon) cho dễ đọc
  const lunch = nextShift && nextShift !== b.shifts[0];
  const tag = working && !acceptingGuests(game.ctx)
    ? `<span class="tag closed" title="Đã ngưng nhận khách mới, phục vụ nốt khách đang ở quán">Ngưng nhận khách</span>`
    : rush
    ? `<span class="tag rush" title="Giờ cao điểm: khách tới đông">Đông khách</span>`
    : working
      ? `<span class="tag open" title="Quán đang mở cửa đón khách">Mở cửa</span>`
      : lunch
        ? `<span class="tag closed" title="Giờ nghỉ: đi chợ, ra nông trại; mở lại lúc ${clockText(nextShift.from)}">Nghỉ trưa</span>`
        : `<span class="tag closed" title="${nextShift ? `Quán mở cửa lúc ${clockText(nextShift.from)}` : 'Quán đã đóng cửa'}">Đóng cửa</span>`;
  // Sau 21:00 (quán đã đóng, cả đội ở chợ): cho kết thúc ngày sớm
  const endDay =
    open && state.clock.minute >= b.crew.endDayAfter
      ? `<button class="end-day"${cmd({ type: 'day/end' })} title="Đi ngủ sớm, sang màn tổng kết ngày">🌙 Kết thúc ngày</button>`
      : '';
  const speed = ui.speed === 0 ? `<span class="tag paused" title="Đang tạm dừng">⏸</span>` : ui.speed > 1 ? `<span class="tag fast" title="Tốc độ">x${ui.speed}</span>` : '';

  return `<div class="hud-left">
      <div class="hud-top">
        ${levelBadge(state.level, state.xp / xpForLevel(state.level))}
        <div class="hud-stack">
          <span class="stat money" data-key="money"><span class="num">${moneyText(moneyShown)}</span>${COIN}</span>
          <span class="stat rep" title="Uy tín của quán">⭐ ${state.reputation.toFixed(1)}</span>
        </div>
        ${questCard(game)}
      </div>
      ${lowStockChip(game)}
    </div>
    <div class="hud-right">
      <div class="clock" title="${esc(`${weekday.name}, ngày ${cal.dayOfSeason} mùa ${season.name}, năm ${cal.year}`)}">
        <div class="clock-top">
          ${dayDial(state.clock.minute)}
          <div class="date">
            <b>${weekday.short} <em>Ngày ${cal.dayOfSeason}</em></b>
            <span>Mùa ${esc(season.name)} · Năm ${cal.year}</span>
          </div>
          <button class="cal-btn"${uiAttr('calendar:open')} title="Lịch: mùa, năm, ngày lễ, sự kiện sắp tới" aria-label="Mở lịch">📅</button>
        </div>
        <div class="clock-row">
          <span class="weather" title="${esc(weather.name)}">${weather.icon}</span>
          <span class="time">${time}</span>
          ${tag}${speed}
        </div>
        ${festivalTag(game)}${eventTag(game)}
        ${endDay}
        ${state.crew.pending.length ? `<button class="meal-call"${uiAttr('meal')}>🍜 Gọi món cho đội (${state.crew.pending.length})</button>` : ''}
      </div>
      <div class="side-col">
        <button class="gear"${uiAttr('settings')} title="Cài đặt" aria-label="Cài đặt">⚙️</button>
        ${sideButtons(game, ui)}
      </div>
    </div>`;
}

/** Hộp đổi tên quán (ô nhập trong game, không dùng window.prompt). */
export function renameHtml(ui: UiState): string {
  if (ui.rename == null) return '';
  return `<div class="backdrop" data-key="rename"${uiAttr('rename:close')}>
    <div class="dialog rename" role="dialog" aria-label="Đổi tên quán"${uiAttr('noop')}>
      <h2>✏️ Đổi tên quán</h2>
      <input type="text" maxlength="24" value="${esc(ui.rename)}" data-rename-input autocomplete="off" enterkeyhint="done" aria-label="Tên quán">
      <p class="muted">Tối đa 24 ký tự. Tên hiện trên biển hiệu của quán.</p>
      <div class="dialog-foot"><button${uiAttr('rename:close')}>Huỷ</button><button class="primary"${uiAttr('rename:ok')}>Đổi tên</button></div>
    </div>
  </div>`;
}

/** Đồng xu vàng vẽ bằng CSS (emoji 🪙 mỗi máy một kiểu, có máy ra màu bạc). */
export const COIN = '<i class="coin" aria-hidden="true"></i>';

/** Số tiền trên HUD (không kèm icon). */
export function moneyText(amount: number): string {
  return Math.round(amount).toLocaleString('vi-VN');
}

/** Bảng mở bằng nút tròn dọc bên phải dưới bánh răng (chỉ icon); các bảng còn lại nằm ở thanh dưới. */
export const SIDE_PANELS = ['farm', 'farmhands', 'restaurant', 'market', 'crew', 'shop', 'achievements'];

function sideButtons(game: Game, ui: UiState): string {
  return SIDE_PANELS.map((id) => panels.find((p) => p.id === id)!)
    .map((p) => {
      const badge = p.badge?.(game) ?? 0;
      return `<button class="round${ui.drawer === p.id ? ' on' : ''}" data-key="side-${p.id}"${uiAttr(`drawer:${p.id}`)} title="${esc(p.label)}" aria-label="${esc(p.label)}">${p.icon}${badge ? `<span class="badge">${badge}</span>` : ''}</button>`;
    })
    .join('');
}

/** Tổng kết mùa / năm ở màn hết ngày cuối mùa (ngày 14) — doanh thu, chi, lãi, khách. */
export function periodSummaryHtml(game: Game): string {
  const { state } = game;
  const day = state.clock.day;
  if (!isSeasonEnd(day)) return '';
  const cal = calendarOf(day);
  const card = (title: string, s: DayStats) => `<div class="period">
      <h3>${title}</h3>
      <div class="stats">
        <div><span>Doanh thu</span><b>${coins(s.revenue)}</b></div>
        <div><span>Trong đó tip</span><b>${coins(s.tips)}</b></div>
        <div><span>Đã chi</span><b>${coins(s.spent)}</b></div>
        <div><span>Lãi</span><b class="${s.revenue - s.spent >= 0 ? 'good-text' : 'bad-text'}">${coins(s.revenue - s.spent)}</b></div>
        <div><span>Món đã nấu</span><b>${s.dishes}</b></div>
        <div><span>Khách hài lòng</span><b>${s.guestsServed}</b></div>
      </div>
    </div>`;
  const next = seasons[(cal.season + 1) % seasons.length];
  return `${card(`${seasons[cal.season].icon} Tổng kết mùa ${seasons[cal.season].name} năm ${cal.year}`, state.stats.season)}
    ${isYearEnd(day) ? card(`🎆 Tổng kết năm ${cal.year}`, state.stats.year) : ''}
    <p class="muted">Ngày mai sang mùa ${next.name}${next.frozen ? ' — đất ngoài trời đóng băng, chỉ trồng được trong nhà kính; chuồng và ao nghỉ tới mùa Xuân' : ''}${seasons[cal.season].frozen ? ' — băng tan, nông trại ngoài trời làm lại được' : ''}.</p>`;
}

/** Số việc phục vụ đang chờ người chơi (khách cần menu / chờ ghi món + món nằm ở quầy chưa ai bưng). */
export function serviceAlerts(game: Game): number {
  const r = game.state.restaurant;
  const needs = r.parties.filter((p) => !p.called && (p.phase === 'seated' || p.phase === 'readyToOrder')).length;
  return needs + readyOrders(game.ctx).length;
}

/**
 * Thanh phục vụ phía dưới khu quán: món bồi bàn đang cầm (mỗi món một màu = màu bàn đã gọi), đang ra quầy lấy món,
 * hoặc nhắc "quầy line có món" (bấm để đi lấy).
 */
export function serviceHtml(game: Game): string {
  const { state, content, ctx } = game;
  const r = state.restaurant;
  const w = r.waiter;
  const max = content.balance.service.carryMax;
  const carried = w.carrying.map((id) => r.orders.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => !!o);
  if (carried.length) {
    const chips = carried
      .map((o) => {
        const party = r.parties.find((p) => p.id === o.partyId);
        const color = partyColor(party?.color) ?? '#fffaf1';
        return `<span class="carry-dish" style="--c:${color}" title="${esc(content.recipes.get(o.recipeId).name)}">${content.recipes.get(o.recipeId).icon}</span>`;
      })
      .join('');
    const more = carried.length < max && readyOrders(ctx).length ? `<button class="mini"${uiAttr('pickup')}>+ Lấy thêm món</button>` : '';
    return `<div class="service-card carrying" data-key="carry"><div class="carry-dishes">${chips}</div><span>Bấm vào bàn có bong bóng <b>cùng màu</b> để giao</span>${more}</div>`;
  }
  if (w.tasks.some((t) => t.kind === 'pickup')) return `<div class="service-card carrying" data-key="carry"><span>🏃 Đang ra quầy line lấy món…</span></div>`;
  const n = readyOrders(ctx).length;
  return n
    ? `<button class="service-card pass-hint" data-key="pass-hint"${uiAttr('pickup')}>🔔 Quầy line có ${n} món — bấm quầy (hoặc ở đây) để bưng, tối đa ${max} món một lượt</button>`
    : '';
}

const GUIDE: [string, string][] = [
  ['🖐️', 'Kéo để xoay camera · lăn chuột hoặc chụm 2 ngón để phóng to · bấm đúp để về góc mặc định.'],
  ['↔️', 'Nút ‹ › ở hai mép màn hình để chuyển giữa Nông trại, Quán ăn và Chợ.'],
  ['🌱', 'Nông trại: bấm ô đất để cuốc → gieo → tưới → thu hoạch. Trời mưa thì khỏi tưới.'],
  ['🧺', 'Chợ: bấm vào sạp để mua nguyên liệu. Giá đổi mỗi ngày.'],
  ['🙋', 'Bạn là bồi bàn: khách hiện 📖 thì bấm vào để mang menu, hiện 😊 thì bấm để ghi món.'],
  ['🔔', 'Bếp nấu xong món đặt ở quầy ra món: bấm quầy (bảng hiện bên phải), kéo món vào khay bàn đôi / bàn bốn, bấm "Cầm khay" rồi bấm bàn để bưng cả khay. Để món nguội lâu khách sẽ chuyển 😄 → 🙂 → 😒 → 😠 và bớt tip.'],
  ['🧽', 'Khách ăn xong để lại chén dĩa dơ: bấm vào bàn để dọn, bàn sạch mới đón khách mới. Hết mỗi ca sàn có vết bẩn: bấm vào vết bẩn để lau.'],
  ['⚡', 'Mỗi người trong đội có 30 năng lượng, làm việc là tốn; cạn là xỉu. Giờ nghỉ trưa và tối cả đội ra chợ ăn hàng rong (tự chọn món), ăn xong bạn thanh toán hoá đơn. Lúc đó quán / nông trại tạm nghỉ. Xem bảng Nhân viên.'],
  ['📖', 'Thực đơn: bật món còn đủ nguyên liệu. Hết nguyên liệu khách sẽ bỏ về.'],
  ['🛒', 'Siêu thị: đổi sàn, sơn tường, bàn ghế, mua trang thiết bị và sắp xếp lại bàn.'],
  ['🌙', 'Ngày chạy 06:00–24:00. Quán mở 2 ca: 07:00–12:00 và 15:00–20:00. Sau 21:00 có nút "Kết thúc ngày" để đi ngủ sớm. Hết ngày xem tổng kết; ban đêm cây vẫn lớn.'],
];

export function settingsHtml(ui: UiState, prefs: { music: boolean; sfx: boolean }): string {
  if (!ui.settings) return '';
  const toggle = (action: string, on: boolean, icon: string, label: string) =>
    `<button class="toggle-row${on ? ' is-on' : ''}"${uiAttr(action)} role="switch" aria-checked="${on}">
      <span>${icon} ${label}</span><i class="switch"><i></i></i>
    </button>`;
  return `<div class="backdrop" data-key="settings"${uiAttr('settings:close')}>
    <div class="dialog settings" role="dialog" aria-label="Cài đặt"${uiAttr('noop')}>
      <div class="dialog-head"><h2>⚙️ Cài đặt</h2><button class="x-close"${uiAttr('settings:close')} aria-label="Đóng">✕</button></div>
      <p class="muted">Game tạm dừng trong lúc mở bảng này.</p>

      <section>
        <h3>Tốc độ</h3>
        <div class="segmented">${SPEEDS.map((s) => `<button class="${ui.speed === s ? 'on' : ''}"${uiAttr(`speed:${s}`)}>${s === 0 ? '⏸ Dừng' : `▶ x${s}`}</button>`).join('')}</div>
      </section>

      <section>
        <button class="wide"${uiAttr('guide:0')}>📘 Hướng dẫn chơi</button>
      </section>

      <section>
        <h3>Âm thanh</h3>
        ${toggle('music', prefs.music, '🎵', 'Nhạc nền')}
        ${toggle('sfx', prefs.sfx, '🔊', 'Hiệu ứng âm thanh')}
      </section>

      <section>
        <h3>Màn hình</h3>
        <button class="wide"${uiAttr('fullscreen')}>⛶ Bật/tắt toàn màn hình</button>
      </section>

      <section>
        <h3>Hướng dẫn nhanh</h3>
        <ul class="guide">${GUIDE.map(([icon, text]) => `<li><span>${icon}</span><p>${esc(text)}</p></li>`).join('')}</ul>
      </section>

      <div class="dialog-foot">
        <button${uiAttr('home')}>🏠 Màn hình chính</button>
        <button class="primary"${uiAttr('settings:close')}>Tiếp tục chơi</button>
      </div>
    </div>
  </div>`;
}


/** Bảng chi tiết nhiệm vụ: nhiệm vụ đang làm (mô tả, tiến độ, phần thưởng) + danh sách cả chuỗi. */
export function questHtml(game: Game, ui: UiState): string {
  if (!ui.questOpen) return '';
  const { state, content } = game;
  const q = state.quests;
  const def = currentQuest(game.ctx);
  const reward = (r: { money?: number; xp?: number }) => [r.money ? coins(r.money) : '', r.xp ? `${r.xp} XP` : ''].filter(Boolean).join(' · ');
  const current = def
    ? `<div class="quest-detail${q.done ? ' done' : ''}">
        <div class="row"><span class="big">${def.icon}</span><div class="grow"><b>${esc(def.title)}</b><div class="muted">Chương ${def.chapter}: ${esc(questChapters[def.chapter - 1] ?? '')} · nhiệm vụ ${q.index + 1}/${content.quests.length}</div></div></div>
        <p>${esc(def.desc)}</p>
        <div class="quest-bar big"><i style="width:${Math.round((q.progress / def.goal.target) * 100)}%"></i><span>${def.goal.kind === 'reputation' ? q.progress.toFixed(1) : Math.floor(q.progress)} / ${def.goal.target}</span></div>
        <div class="reward">🎁 Phần thưởng: <b>${reward(def.reward)}</b> <span class="muted">(không tính vào doanh thu ngày)</span></div>
        ${q.done ? `<button class="primary wide"${cmd({ type: 'quest/claim' })}>🎁 Nhận thưởng</button>` : ''}
      </div>`
    : '<p>🏆 Đã hoàn thành mọi nhiệm vụ!</p>';
  const list = content.quests
    .map((x, i) => {
      const st = i < q.index ? 'done' : i === q.index ? 'now' : 'next';
      const head = i === 0 || content.quests[i - 1].chapter !== x.chapter ? `<li class="chapter">📜 Chương ${x.chapter}: ${esc(questChapters[x.chapter - 1] ?? '')}</li>` : '';
      return `${head}<li class="${st}"><span>${st === 'done' ? '✅' : x.icon}</span><div class="grow"><b>${esc(x.title)}</b><small>${esc(x.desc)}</small></div><em>${reward(x.reward)}</em></li>`;
    })
    .join('');
  return `<div class="backdrop" data-key="questdlg"${uiAttr('quest:close')}>
    <div class="dialog quest-dialog" role="dialog" aria-label="Nhiệm vụ"${uiAttr('noop')}>
      <div class="dialog-head"><h2>🎯 Nhiệm vụ</h2><button class="x-close"${uiAttr('quest:close')} aria-label="Đóng">✕</button></div>
      ${current}
      <h3>Cả chuỗi nhiệm vụ</h3>
      <ul class="quest-list">${list}</ul>
    </div>
  </div>`;
}

/**
 * Hoá đơn ăn uống của cả đội ở chợ: hiện khi mọi người đã ăn xong (crew.meals rỗng) — ai ăn gì, ở hàng nào, bao nhiêu tiền;
 * người chơi bấm Thanh toán (lệnh crew/pay).
 */
export function billHtml(game: Game): string {
  const { state, content } = game;
  const c = state.crew;
  if (!billDue(game.ctx)) return '';
  const total = billTotal(game.ctx);
  const rows = c.bill
    .map((l, i) => `<li data-key="b${i}"><span class="big">${l.icon}</span><div class="grow"><b>${esc(l.name)}</b><small>${esc(l.dish)} · ${esc(content.stalls.get(l.stallId).name)} · +${l.energy} ⚡</small></div><em>${coins(l.price)}</em></li>`)
    .join('');
  const kind = c.bill[c.bill.length - 1].kind === 'lunch' ? 'bữa trưa' : 'bữa tối';
  return `<div class="backdrop" data-key="bill">
    <div class="dialog bill-dialog" role="dialog" aria-label="Hoá đơn ăn uống">
      <div class="dialog-head"><h2>🧾 Hoá đơn ${kind} ở chợ</h2></div>
      <p class="muted">Cả đội đã ăn xong và nạp lại năng lượng.</p>
      <ul class="bill-list">${rows}</ul>
      <div class="bill-total"><span>Tổng cộng</span><b>${coins(total)}</b></div>
      <button class="primary wide"${cmd({ type: 'crew/pay' })}>💵 Thanh toán ${coins(total)}</button>
    </div>
  </div>`;
}

/**
 * Bảng gọi món cho cả đội ở chợ, chia 2 cột:
 *  - trái (4/12): mọi người trong đợt nghỉ — biểu tượng, tên, thanh năng lượng (phần đặc = đang có, phần sọc = món đã gọi);
 *  - phải (8/12): thực đơn hàng rong / Tiệm 25caaaaa cho người đang chọn. Bấm món là gọi thêm, thanh đầy dần;
 *    đầy thanh thì người đó xong, tự chuyển sang người kế tiếp. Món đã gọi bấm ✕ để bỏ.
 * `ui.mealStall` = chỉ hiện thực đơn một hàng (mở từ bảng menu trong tiệm). Quá hạn chưa chọn thì mọi người tự chọn.
 */
export function mealHtml(game: Game, ui: UiState): string {
  const { state, content, ctx } = game;
  const c = state.crew;
  if (!ui.mealOpen) return '';
  const pending = c.pending;
  const isPending = (who: string) => pending.some((p) => p.who === who);
  if (!isPending(ui.mealWho ?? '')) ui.mealWho = pending[0]?.who ?? null;
  // Người trong đợt nghỉ này: đang chờ gọi món hoặc đang ăn
  const people = crewMembers(ctx).filter((m) => isPending(m.who) || c.meals.some((l) => l.who === m.who));
  const budget = mealBudget(ctx);

  const rows = people
    .map((m) => {
      const ordered = orderedEnergy(ctx, m.who);
      const max = maxEnergyOf(ctx, m.who);
      const now = Math.min(max, m.vitals.energy);
      const add = Math.max(0, Math.min(max - now, ordered));
      const open = isPending(m.who);
      const missing = missingEnergy(ctx, m.who);
      const hasMeal = c.meals.some((l) => l.who === m.who);
      const status = !open ? '✓ Đã chọn xong' : hasMeal ? `Còn thiếu ${missing} ⚡` : missing <= 0 ? 'Đầy sức · gọi 1 món' : `Thiếu ${missing} ⚡`;
      const inner = `<span class="mp-icon">${m.icon}</span>
        <span class="mp-main"><b>${esc(m.name)}</b><small>${status}</small>
          <span class="ebar"><i class="now" style="width:${(now / max) * 100}%"></i><i class="add" style="left:${(now / max) * 100}%;width:${(add / max) * 100}%"></i></span>
        </span>
        <span class="mp-num">${Math.round(now + add)}<small>/${max}</small></span>`;
      return open
        ? `<button class="meal-person${m.who === ui.mealWho ? ' on' : ''}" data-key="mp-${m.who}"${uiAttr(`mealWho:${m.who}`)}>${inner}</button>`
        : `<div class="meal-person done" data-key="mp-${m.who}">${inner}</div>`;
    })
    .join('');

  const who = people.find((m) => m.who === ui.mealWho);
  const mine = who ? c.meals.filter((l) => l.who === who.who) : [];
  const vendors = content.stalls.all().filter((s) => s.menu?.length && (!ui.mealStall || s.id === ui.mealStall));
  const menus = vendors
    .map(
      (s) => `<h3 data-key="v-${s.id}">${s.icon} ${esc(s.name)}</h3><div class="meal-menu">${s
        .menu!.map(
          (d, i) =>
            `<button class="meal-dish" data-key="${s.id}-${i}"${cmd({ type: 'crew/order', who: ui.mealWho ?? '', stallId: s.id, dish: i })}${who && d.price <= budget ? '' : ' disabled'}><span class="big">${d.icon}</span><b>${esc(d.name)}</b><small>+${d.energy} ⚡ · ${coins(d.price)}</small></button>`,
        )
        .join('')}</div>`,
    )
    .join('');
  const right = who
    ? `<div class="meal-for" data-key="for-${who.who}"><span>Đang chọn cho <b>${who.icon} ${esc(who.name)}</b></span>
        ${mine.length ? `<span class="meal-picked">${mine.map((l, i) => `<button class="mini" data-key="pk-${i}"${cmd({ type: 'crew/unorder', who: who.who, index: i })} title="Bỏ món này">${l.icon} ${esc(l.dish)} ✕</button>`).join('')}</span>` : ''}
      </div>
      <div class="meal-menus">${menus}</div>
      ${ui.mealStall ? `<button class="mini"${uiAttr('mealStall:')}>Xem cả hàng rong khác</button>` : ''}`
    : `<p class="muted meal-empty">${pending.length ? 'Chọn một người bên trái để gọi món.' : 'Mọi người đã có món, đang ăn ngon lành. 😋'}</p>`;

  const deadline = pending.length ? Math.min(...pending.map((p) => p.deadline)) : null;
  return `<div class="backdrop" data-key="meal"${uiAttr('meal:close')}>
    <div class="dialog meal-dialog" role="dialog" aria-label="Gọi món cho cả đội"${uiAttr('noop')}>
      <div class="dialog-head"><h2>🍜 Gọi món cho cả đội</h2><button class="x-close"${uiAttr('meal:close')} aria-label="Đóng">✕</button></div>
      ${mealCoachTip(game)}
      <p class="muted meal-note">${
        pending.length
          ? `Chọn người rồi bấm món cho tới khi thanh ⚡ đầy. Chưa chọn trước <b>${clockText(deadline!)}</b> thì mọi người tự chọn. Còn ${coins(budget)} cho bữa này.`
          : 'Mọi người đã chọn xong món.'
      }</p>
      <div class="meal-cols">
        <div class="meal-people">${rows}</div>
        <div class="meal-right">${right}</div>
      </div>
      <div class="dialog-foot">
        ${pending.length ? `<button${cmd({ type: 'crew/autoOrder' })}>🎲 Để mọi người tự chọn</button>` : ''}
        <button class="primary"${uiAttr('meal:done')}>Xong</button>
      </div>
    </div>
  </div>`;
}

/** Bảng mua nhỏ khi bấm một khay hàng trong quầy chợ: giá hôm nay, trong kho còn bao nhiêu, nút mua 1 / 5 / 10. */
export function buyHtml(game: Game, ui: UiState): string {
  const { state, content, ctx } = game;
  const stallId = ui.stallView;
  if (!stallId || !ui.buyItem || !content.stalls.has(stallId)) return '';
  const def = content.stalls.get(stallId);
  if (!def.items.includes(ui.buyItem)) return '';
  const item = content.items.get(ui.buyItem);
  const price = priceOf(ctx, stallId, item.id);
  const factor = state.market.priceFactor[item.id] ?? 1;
  const sf = seasonPriceFactor(ctx, item.id);
  const trend = [
    sf < 1 ? '<span class="good-text">đúng mùa</span>' : sf > 1 ? '<span class="bad-text">trái mùa</span>' : '',
    factor > 1.08 ? '<span class="bad-text">▲ hôm nay đắt</span>' : factor < 0.92 ? '<span class="good-text">▼ hôm nay rẻ</span>' : '',
  ].filter(Boolean).join(' · ');
  const btns = [1, 5, 10].map((n) => `<button${cmd({ type: 'market/buy', stallId, itemId: item.id, qty: n })}${state.money >= price * n ? '' : ' disabled'}>Mua ${n} · ${coins(price * n)}</button>`).join('');
  return `<div class="service-card buy-card" data-key="buy-${item.id}">
    <div class="service-head"><b><span class="dish-icon">${item.icon}</span> ${esc(item.name)}</b><button class="x-close"${uiAttr('buy:close')} aria-label="Đóng">✕</button></div>
    <div class="muted">${coins(price)} / 1 ${trend} · trong kho: ${stockOf(ctx, item.id)}</div>
    <div class="btns">${btns}</div>
  </div>`;
}

/** Dải lễ hội dưới đồng hồ: hôm nay là lễ gì (di chuột / giữ để xem hiệu ứng), hoặc lễ sắp tới trong 3 ngày. */
function festivalTag(game: Game): string {
  const day = game.state.clock.day;
  const today = festivalOf(day);
  if (today) return `<div class="festival-tag today" title="${esc(today.desc)}">${today.icon} ${esc(today.name)}</div>`;
  const next = nextFestival(day + 1, 2);
  return next ? `<div class="festival-tag" title="${esc(next.def.desc)}">${next.def.icon} ${next.inDays === 0 ? 'Mai' : `${next.inDays + 1} ngày nữa`}: ${esc(next.def.name)}</div>` : '';
}

/** Màn hết ngày: báo trước lễ ngày mai. */
export function tomorrowFestivalHtml(game: Game): string {
  const f = festivalOf(game.state.clock.day + 1);
  return f ? `<div class="festival-next"><b>${f.icon} Ngày mai: ${esc(f.name)}</b><span>${esc(f.desc)} Nhớ đi chợ mua đủ nguyên liệu!</span></div>` : '';
}

/** Món đang bán còn nấu được ít hơn `balance.lowStockPortions` phần (ít nhất trước). */
export function lowStock(game: Game): { recipe: RecipeDef; count: number }[] {
  const { state, content, ctx } = game;
  return state.menu.active
    .map((id) => content.recipes.get(id))
    .map((recipe) => ({ recipe, count: craftableCount(ctx, recipe.ingredients) }))
    .filter((l) => l.count < content.balance.lowStockPortions)
    .sort((a, b) => a.count - b.count);
}

/**
 * Dải cảnh báo nguyên liệu dưới hàng cấp / tiền / sao (thẳng lề trái với huy hiệu cấp): gộp món đã hết và món sắp hết
 * vào một chỗ (không còn thông báo nổi riêng); bấm mở bảng Thực đơn.
 */
function lowStockChip(game: Game): string {
  const low = lowStock(game);
  if (!low.length) return '';
  const out = low.filter((l) => !l.count);
  const soon = low.filter((l) => l.count);
  const part = (label: string, list: typeof low) => {
    if (!list.length) return '';
    const [first, ...rest] = list;
    return `<span class="sw-part"><b>${label}:</b> ${first.recipe.icon} ${esc(first.recipe.name)}${rest.length ? ` <em>${rest.map((l) => l.recipe.icon).join('')}</em>` : ''}</span>`;
  };
  const title = low.map((l) => `${l.recipe.name}: ${l.count ? `còn ${l.count} phần` : 'hết'}`).join(' · ') + ' — bấm để mở Thực đơn';
  return `<button class="stock-warn" data-key="stock-warn"${uiAttr('drawer:menu')} title="${esc(title)}">⚠️ ${part('Hết', out)}${part('Sắp hết', soon)}</button>`;
}

/** Dải sự kiện ngẫu nhiên: báo trước giờ tới (nhà phê bình, thanh tra) hoặc đang diễn ra (còn bao lâu). */
function eventTag(game: Game): string {
  const e = game.state.event;
  if (!e || e.status === 'done') return '';
  const def = defOf(e.id);
  if (e.status === 'scheduled') return def.announce ? `<div class="event-tag" title="${esc(def.name)}">${def.icon} ${esc(def.name)} ~${clockText(e.at)}</div>` : '';
  const left = def.kind === 'modifier' ? ` · còn ${Math.ceil(e.minutesLeft)}'` : ' đang ở quán';
  return `<div class="event-tag active" title="${esc(def.start)}">${def.icon} ${esc(def.name)}${left}</div>`;
}
