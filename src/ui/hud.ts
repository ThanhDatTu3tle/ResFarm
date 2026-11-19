import { seasons, weekdays } from '../data/calendar';
import { calendarOf } from '../sim/calendar';
import { readyOrders } from '../sim/systems/service';
import type { Game } from '../sim/game';
import { xpForLevel } from '../sim/helpers';
import { cmd, esc, ui as uiAttr } from './dom';
import { currentQuest } from '../sim/systems/quests';
import { acceptingGuests, inShift } from '../sim/systems/customers';
import { isReserved, pendingOrders } from '../sim/systems/service';
import type { Party } from '../sim/state';
import { tableById } from '../sim/layout';
import { billDue, billTotal, crewMembers, mealBudget } from '../sim/systems/crew';
import { priceOf } from '../sim/systems/market';
import { stockOf } from '../sim/helpers';
import { clockText, coins } from './format';
import type { UiState } from './panels';

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
  const def = currentQuest(game.ctx);
  const total = game.content.quests.length;
  const q = game.state.quests;
  if (!def) return `<div class="quest all-done" data-key="quest" title="Đã hoàn thành mọi nhiệm vụ">🏆 Xong hết ${total} nhiệm vụ!</div>`;
  const shown = def.goal.kind === 'reputation' ? q.progress.toFixed(1) : Math.floor(q.progress);
  const pct = Math.round((q.progress / def.goal.target) * 100);
  const reward = [def.reward.money ? `${def.reward.money} 🪙` : '', def.reward.xp ? `${def.reward.xp} XP` : ''].filter(Boolean).join(' · ');
  return `<div class="quest${q.done ? ' done' : ''}" data-key="quest"${uiAttr('quest')} title="Bấm để xem chi tiết nhiệm vụ">
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
  const tag = working && !acceptingGuests(game.ctx)
    ? `<span class="tag closed" title="Đã ngưng nhận khách mới, phục vụ nốt khách đang ở quán">🔕 Ngưng nhận khách</span>`
    : rush
    ? `<span class="tag rush" title="Giờ cao điểm: khách tới đông">🔥 Đông</span>`
    : working
      ? `<span class="tag open" title="Quán đang mở cửa đón khách">🍽️ Mở</span>`
      : nextShift
        ? `<span class="tag closed" title="Giờ nghỉ: đi chợ, ra nông trại; mở lại lúc ${clockText(nextShift.from)}">😴 Nghỉ tới ${clockText(nextShift.from)}</span>`
        : `<span class="tag closed" title="Quán đã đóng cửa">🌙 Đóng cửa</span>`;
  // Sau 21:00 (quán đã đóng, cả đội ở chợ): cho kết thúc ngày sớm
  const endDay =
    open && state.clock.minute >= b.crew.endDayAfter
      ? `<button class="end-day"${cmd({ type: 'day/end' })} title="Đi ngủ sớm, sang màn tổng kết ngày">🌙 Kết thúc ngày</button>`
      : '';
  const speed = ui.speed === 0 ? `<span class="tag paused" title="Đang tạm dừng">⏸</span>` : ui.speed > 1 ? `<span class="tag fast" title="Tốc độ">x${ui.speed}</span>` : '';

  return `<div class="hud-left">
      ${levelBadge(state.level, state.xp / xpForLevel(state.level))}
      <div class="hud-stack">
        <span class="stat money" data-key="money">${coins(moneyShown)}</span>
        <span class="stat rep" title="Uy tín của quán">⭐ ${state.reputation.toFixed(1)}</span>
        ${questCard(game)}
      </div>
    </div>
    <div class="hud-right">
      <div class="clock" title="${esc(`${weekday.name}, ngày ${cal.dayOfSeason} mùa ${season.name}, năm ${cal.year}`)}">
        <div class="clock-top">
          ${dayDial(state.clock.minute)}
          <div class="date">
            <b>${weekday.short}<em>${cal.dayOfSeason}</em></b>
            <span>${season.icon} ${esc(season.name)} · Năm ${cal.year}</span>
          </div>
        </div>
        <div class="clock-row">
          <span class="weather" title="${esc(weather.name)}">${weather.icon}</span>
          <span class="time">${time}</span>
          ${tag}${speed}
        </div>
        ${endDay}
        ${state.crew.pending.length ? `<button class="meal-call"${uiAttr('meal')}>🍜 Gọi món cho đội (${state.crew.pending.length})</button>` : ''}
      </div>
      <button class="gear"${uiAttr('settings')} title="Cài đặt" aria-label="Cài đặt">⚙️</button>
    </div>`;
}

/** Số việc phục vụ đang chờ người chơi (khách cần menu / chờ ghi món + món nằm ở quầy chưa ai bưng). */
export function serviceAlerts(game: Game): number {
  const r = game.state.restaurant;
  const needs = r.parties.filter((p) => !p.called && (p.phase === 'seated' || p.phase === 'readyToOrder')).length;
  return needs + readyOrders(game.ctx).length;
}

/**
 * Khay ở quầy ra món: danh sách món đã nấu xong để chọn bưng; chọn rồi thì thành thanh nhắc
 * "đang cầm món — bấm vào bàn cần giao".
 */
export function serviceHtml(game: Game, ui: UiState): string {
  const { state, content } = game;
  if (ui.serving != null && !ui.passOpen) {
    const order = state.restaurant.orders.find((o) => o.id === ui.serving);
    if (!order) return '';
    const recipe = content.recipes.get(order.recipeId);
    return `<div class="service-card carrying" data-key="carry">
      <span class="dish-icon">${recipe.icon}</span>
      <div><b>${esc(recipe.name)}</b><span>Bấm vào bàn đã gọi món này để giao</span></div>
      <button class="mini"${uiAttr('serve:')}>✕ Thôi</button>
    </div>`;
  }
  if (!ui.passOpen) return '';
  const inTray = new Set([...ui.tray2, ...ui.tray4]);
  const ready = readyOrders(game.ctx).filter((o) => !inTray.has(o.id));
  const tableName = (partyId: number) => {
    const p = state.restaurant.parties.find((x) => x.id === partyId);
    return p?.tableId ? (tableById(game.ctx, p.tableId)?.name ?? '') : '';
  };
  const dish = (id: number) => {
    const o = state.restaurant.orders.find((x) => x.id === id);
    return o ? content.recipes.get(o.recipeId) : null;
  };
  const tray = (kind: 2 | 4, ids: number[]) => {
    const slots = Array.from({ length: kind }, (_, i) => {
      const id = ids[i];
      const r = id != null ? dish(id) : null;
      return r
        ? `<button class="tray-slot full" data-key="s${id}"${uiAttr(`trayOut:${id}`)} title="Bấm để bỏ ra"><span class="dish-icon">${r.icon}</span></button>`
        : '<span class="tray-slot"></span>';
    }).join('');
    const picked = ui.trayPick === kind;
    // Gợi ý bàn khớp đúng các món trong khay (người chơi vẫn tự bấm bàn để bưng)
    const match = ids.length ? trayParty(game, ids, kind) : null;
    const matchName = match?.tableId ? (tableById(game.ctx, match.tableId)?.name ?? '') : '';
    const hint = picked ? '👉 Bấm vào bàn để bưng' : match ? `✅ Đủ món cho ${esc(matchName)}` : ids.length ? 'Chưa đủ bộ món của bàn nào' : 'Kéo món vào đây';
    return `<div class="tray${picked ? ' picked' : ''}${match ? ' match' : ''}" data-tray="${kind}">
      <div class="tray-head"><b>${kind === 2 ? '🍽️ Khay bàn đôi' : '🍱 Khay bàn bốn'}</b>${ids.length ? `<button class="mini"${uiAttr(`trayClear:${kind}`)} title="Bỏ hết món ra">✕</button>` : ''}</div>
      <div class="tray-slots s${kind}">${slots}</div>
      <button class="tray-take${picked ? ' on' : ''}"${uiAttr(`trayPick:${kind}`)}${ids.length ? '' : ' disabled'}>${picked ? '✋ Đang cầm khay — bấm lại để đặt xuống' : '🛎️ Cầm khay đi bưng'}</button>
      <small class="tray-hint-line">${hint}</small>
    </div>`;
  };
  const held = ui.serving != null ? state.restaurant.orders.find((o) => o.id === ui.serving) : null;
  const heldBar = held
    ? `<div class="held-bar"><span class="dish-icon">${content.recipes.get(held.recipeId).icon}</span><span>Đang cầm <b>${esc(content.recipes.get(held.recipeId).name)}</b> — bấm bàn đã gọi món này</span><button class="mini"${uiAttr('serve:')}>✕</button></div>`
    : '';
  return `<div class="service-card pass" data-key="pass">
    <div class="service-head"><b>🔔 Quầy ra món</b><button class="mini"${uiAttr('pass:close')} aria-label="Đóng">✕</button></div>
    ${heldBar}
    ${
      ready.length
        ? `<div class="pass-list">${ready
            .map((o) => {
              const r = content.recipes.get(o.recipeId);
              return `<button class="pass-dish${ui.serving === o.id ? ' on' : ''}" data-key="o${o.id}" data-order="${o.id}"${uiAttr(`serve:${o.id}`)}><span class="dish-icon">${r.icon}</span><b>${esc(r.name)}</b><small>${esc(tableName(o.partyId))}</small></button>`;
            })
            .join('')}</div>`
        : inTray.size
          ? ''
          : '<p class="muted">Chưa có món nào nấu xong. Bếp nấu xong món sẽ hiện ở đây.</p>'
    }
    <div class="trays">${tray(2, ui.tray2)}${tray(4, ui.tray4)}</div>
    <p class="muted tray-hint">Bấm một món rồi bấm bàn đã gọi để giao một món. Hoặc kéo món vào khay, bấm "Cầm khay" rồi bấm bàn để bưng cả khay.</p>
  </div>`;
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
      <div class="dialog-head"><h2>⚙️ Cài đặt</h2><button class="mini"${uiAttr('settings:close')} aria-label="Đóng">✕</button></div>
      <p class="muted">Game tạm dừng trong lúc mở bảng này.</p>

      <section>
        <h3>Tốc độ</h3>
        <div class="segmented">${SPEEDS.map((s) => `<button class="${ui.speed === s ? 'on' : ''}"${uiAttr(`speed:${s}`)}>${s === 0 ? '⏸ Dừng' : `▶ x${s}`}</button>`).join('')}</div>
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

/**
 * Nhóm khách nhận được cả khay này: các món trong khay khớp đúng những món nhóm còn chờ, và nhóm ngồi bàn hợp khay
 * (khay 2 ô: bàn đôi / quầy ghế đơn; khay 4 ô: bàn từ 3 ghế). Bàn đông hơn 4 người: khay 4 ô đầy là giao trước một đợt.
 */
export function trayParty(game: Game, ids: number[], kind: 2 | 4): Party | null {
  const { ctx, state } = game;
  const orders = ids.map((id) => state.restaurant.orders.find((o) => o.id === id));
  if (!orders.length || orders.some((o) => !o || o.status !== 'ready' || isReserved(ctx, o.id))) return null;
  const have = orders.map((o) => o!.recipeId).sort();
  for (const party of state.restaurant.parties) {
    if (party.phase !== 'waitingFood' || !party.tableId) continue;
    const t = tableById(ctx, party.tableId);
    if (!t || (kind === 2 ? !(t.shared || t.seats <= 2) : t.shared || t.seats <= 2)) continue;
    const need = pendingOrders(ctx, party).map((o) => o.recipeId).sort();
    if (need.length === have.length && need.every((r, i) => r === have[i])) return party;
    // Bàn hơn 4 người: khay 4 ô đầy, toàn món bàn đó còn chờ -> giao trước
    if (kind === 4 && have.length === 4 && need.length > 4) {
      const left = [...need];
      if (have.every((r) => { const i = left.indexOf(r); if (i < 0) return false; left.splice(i, 1); return true; })) return party;
    }
  }
  return null;
}

/** Khay nên chứa món này: theo bàn của người đã gọi (bàn đôi / quầy → khay 2 ô, bàn lớn → khay 4 ô). */
export function trayFor(game: Game, orderId: number): 2 | 4 {
  const o = game.state.restaurant.orders.find((x) => x.id === orderId);
  const p = o && game.state.restaurant.parties.find((x) => x.id === o.partyId);
  const t = p?.tableId ? tableById(game.ctx, p.tableId) : null;
  return !t || t.shared || t.seats <= 2 ? 2 : 4;
}

/** Bảng chi tiết nhiệm vụ: nhiệm vụ đang làm (mô tả, tiến độ, phần thưởng) + danh sách cả chuỗi. */
export function questHtml(game: Game, ui: UiState): string {
  if (!ui.questOpen) return '';
  const { state, content } = game;
  const q = state.quests;
  const def = currentQuest(game.ctx);
  const reward = (r: { money?: number; xp?: number }) => [r.money ? `${r.money} 🪙` : '', r.xp ? `${r.xp} XP` : ''].filter(Boolean).join(' · ');
  const current = def
    ? `<div class="quest-detail${q.done ? ' done' : ''}">
        <div class="row"><span class="big">${def.icon}</span><div class="grow"><b>${esc(def.title)}</b><div class="muted">Nhiệm vụ ${q.index + 1}/${content.quests.length}</div></div></div>
        <p>${esc(def.desc)}</p>
        <div class="quest-bar big"><i style="width:${Math.round((q.progress / def.goal.target) * 100)}%"></i><span>${def.goal.kind === 'reputation' ? q.progress.toFixed(1) : Math.floor(q.progress)} / ${def.goal.target}</span></div>
        <div class="reward">🎁 Phần thưởng: <b>${reward(def.reward)}</b> <span class="muted">(không tính vào doanh thu ngày)</span></div>
        ${q.done ? `<button class="primary wide"${cmd({ type: 'quest/claim' })}>🎁 Nhận thưởng</button>` : ''}
      </div>`
    : '<p>🏆 Đã hoàn thành mọi nhiệm vụ!</p>';
  const list = content.quests
    .map((x, i) => {
      const st = i < q.index ? 'done' : i === q.index ? 'now' : 'next';
      return `<li class="${st}"><span>${st === 'done' ? '✅' : x.icon}</span><div class="grow"><b>${esc(x.title)}</b><small>${esc(x.desc)}</small></div><em>${reward(x.reward)}</em></li>`;
    })
    .join('');
  return `<div class="backdrop" data-key="questdlg"${uiAttr('quest:close')}>
    <div class="dialog quest-dialog" role="dialog" aria-label="Nhiệm vụ"${uiAttr('noop')}>
      <div class="dialog-head"><h2>🎯 Nhiệm vụ</h2><button class="mini"${uiAttr('quest:close')} aria-label="Đóng">✕</button></div>
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
 * Bảng gọi món cho cả đội ở chợ: chọn người (chip), rồi bấm món ở hàng rong / Tiệm 25caaaaa.
 * `ui.mealStall` = chỉ hiện thực đơn một hàng (mở từ bảng menu trong tiệm). Quá hạn chưa chọn thì mọi người tự chọn.
 */
export function mealHtml(game: Game, ui: UiState): string {
  const { state, content, ctx } = game;
  const c = state.crew;
  if (!ui.mealOpen) return '';
  const pending = c.pending;
  if (!pending.some((p) => p.who === ui.mealWho)) ui.mealWho = pending[0]?.who ?? null;
  const icons = new Map(crewMembers(ctx).map((m) => [m.who, m.icon]));
  const chips = [
    ...pending.map((p) => `<button class="meal-who${p.who === ui.mealWho ? ' on' : ''}" data-key="p-${p.who}"${uiAttr(`mealWho:${p.who}`)}><span>${icons.get(p.who) ?? '🙂'}</span>${esc(p.name)}</button>`),
    ...c.meals.map((l) => `<span class="meal-who done" data-key="m-${l.who}" title="${esc(l.dish)}"><span>${l.icon}</span>${esc(l.name)}</span>`),
  ].join('');
  const budget = mealBudget(ctx);
  const vendors = content.stalls.all().filter((s) => s.menu?.length && (!ui.mealStall || s.id === ui.mealStall));
  const menus = vendors
    .map(
      (s) => `<h3 data-key="v-${s.id}">${s.icon} ${esc(s.name)}</h3><div class="meal-menu">${s
        .menu!.map(
          (d, i) =>
            `<button class="meal-dish" data-key="${s.id}-${i}"${cmd({ type: 'crew/order', who: ui.mealWho ?? '', stallId: s.id, dish: i })}${ui.mealWho && d.price <= budget ? '' : ' disabled'}><span class="big">${d.icon}</span><b>${esc(d.name)}</b><small>+${d.energy} ⚡ · ${coins(d.price)}</small></button>`,
        )
        .join('')}</div>`,
    )
    .join('');
  const deadline = pending.length ? Math.min(...pending.map((p) => p.deadline)) : null;
  const who = pending.find((p) => p.who === ui.mealWho);
  return `<div class="backdrop" data-key="meal"${uiAttr('meal:close')}>
    <div class="dialog meal-dialog" role="dialog" aria-label="Gọi món cho cả đội"${uiAttr('noop')}>
      <div class="dialog-head"><h2>🍜 Gọi món cho cả đội</h2><button class="mini"${uiAttr('meal:close')} aria-label="Đóng">✕</button></div>
      <p class="muted">${
        pending.length
          ? `Chọn người rồi bấm món. Chưa chọn trước <b>${clockText(deadline!)}</b> thì mọi người tự chọn. Còn ${coins(budget)} cho bữa này.`
          : 'Mọi người đã có món, đang ăn ngon lành.'
      }</p>
      <div class="meal-whos">${chips}</div>
      ${who ? `<p class="meal-for">Đang chọn cho <b>${esc(who.name)}</b>:</p>${menus}` : ''}
      ${ui.mealStall && pending.length ? `<button class="mini"${uiAttr('mealStall:')}>Xem cả hàng rong khác</button>` : ''}
      <div class="dialog-foot">
        ${pending.length ? `<button${cmd({ type: 'crew/autoOrder' })}>🎲 Để mọi người tự chọn</button>` : ''}
        <button class="primary"${uiAttr('meal:close')}>Xong</button>
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
  const trend = factor > 1.08 ? '<span class="bad-text">▲ hôm nay đắt</span>' : factor < 0.92 ? '<span class="good-text">▼ hôm nay rẻ</span>' : '';
  const btns = [1, 5, 10].map((n) => `<button${cmd({ type: 'market/buy', stallId, itemId: item.id, qty: n })}${state.money >= price * n ? '' : ' disabled'}>Mua ${n} · ${coins(price * n)}</button>`).join('');
  return `<div class="service-card buy-card" data-key="buy-${item.id}">
    <div class="service-head"><b><span class="dish-icon">${item.icon}</span> ${esc(item.name)}</b><button class="mini"${uiAttr('buy:close')} aria-label="Đóng">✕</button></div>
    <div class="muted">${coins(price)} / 1 ${trend} · trong kho: ${stockOf(ctx, item.id)}</div>
    <div class="btns">${btns}</div>
  </div>`;
}
