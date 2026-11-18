import { seasons, weekdays } from '../data/calendar';
import { calendarOf } from '../sim/calendar';
import { readyOrders } from '../sim/systems/service';
import type { Game } from '../sim/game';
import { xpForLevel } from '../sim/helpers';
import { esc, ui as uiAttr } from './dom';
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

export function hudHtml(game: Game, ui: UiState, moneyShown: number): string {
  const { state, content } = game;
  const b = content.balance;
  const cal = calendarOf(state.clock.day);
  const season = seasons[cal.season];
  const weekday = weekdays[cal.weekday];
  const weather = content.weathers.get(state.weather.id);
  const open = state.clock.phase === 'open';
  const rush = open && b.rushHours.some((h) => state.clock.minute >= h.from && state.clock.minute < h.to);
  // Giờ làm tròn 10 phút cho gọn mắt, như đồng hồ treo tường
  const time = clockText(Math.floor(state.clock.minute / 10) * 10);
  const tag = !open ? `<span class="tag closed" title="Quán đã đóng cửa">🌙 Nghỉ</span>` : rush ? `<span class="tag rush" title="Giờ cao điểm: khách tới đông">🔥 Đông</span>` : '';
  const speed = ui.speed === 0 ? `<span class="tag paused" title="Đang tạm dừng">⏸</span>` : ui.speed > 1 ? `<span class="tag fast" title="Tốc độ">x${ui.speed}</span>` : '';

  return `<div class="hud-left">
      ${levelBadge(state.level, state.xp / xpForLevel(state.level))}
      <div class="hud-stack">
        <span class="stat money" data-key="money">${coins(moneyShown)}</span>
        <span class="stat rep" title="Uy tín của quán">⭐ ${state.reputation.toFixed(1)}</span>
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
  if (ui.serving != null) {
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
  const ready = readyOrders(game.ctx);
  const tableName = (partyId: number) => {
    const p = state.restaurant.parties.find((x) => x.id === partyId);
    return p?.tableId ? content.tables.get(p.tableId).name : '';
  };
  return `<div class="service-card pass" data-key="pass">
    <div class="service-head"><b>🔔 Quầy ra món</b><button class="mini"${uiAttr('pass:close')} aria-label="Đóng">✕</button></div>
    ${
      ready.length
        ? `<div class="pass-list">${ready
            .map((o) => {
              const r = content.recipes.get(o.recipeId);
              return `<button class="pass-dish" data-key="o${o.id}"${uiAttr(`serve:${o.id}`)}><span class="dish-icon">${r.icon}</span><b>${esc(r.name)}</b><small>${esc(tableName(o.partyId))}</small></button>`;
            })
            .join('')}</div>`
        : '<p class="muted">Chưa có món nào nấu xong. Bếp nấu xong món sẽ hiện ở đây.</p>'
    }
  </div>`;
}

const GUIDE: [string, string][] = [
  ['🖐️', 'Kéo để xoay camera · lăn chuột hoặc chụm 2 ngón để phóng to · bấm đúp để về góc mặc định.'],
  ['↔️', 'Nút ‹ › ở hai mép màn hình để chuyển giữa Nông trại, Quán ăn và Chợ.'],
  ['🌱', 'Nông trại: bấm ô đất để cuốc → gieo → tưới → thu hoạch. Trời mưa thì khỏi tưới.'],
  ['🧺', 'Chợ: bấm vào sạp để mua nguyên liệu. Giá đổi mỗi ngày.'],
  ['🙋', 'Bạn là bồi bàn: khách hiện 📖 thì bấm vào để mang menu, hiện 😊 thì bấm để ghi món.'],
  ['🔔', 'Bếp nấu xong món đặt ở quầy ra món: bấm quầy, chọn món rồi bấm vào bàn đã gọi món đó. Để món nguội lâu khách sẽ chuyển 😄 → 🙂 → 😒 → 😠 và bớt tip.'],
  ['📖', 'Thực đơn: bật món còn đủ nguyên liệu. Hết nguyên liệu khách sẽ bỏ về.'],
  ['🛒', 'Siêu thị: đổi sàn, sơn tường, bàn ghế, mua trang thiết bị và sắp xếp lại bàn.'],
  ['🌙', 'Quán mở 08:00–22:00. Hết ngày xem tổng kết rồi bắt đầu ngày mới; ban đêm cây vẫn lớn.'],
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
