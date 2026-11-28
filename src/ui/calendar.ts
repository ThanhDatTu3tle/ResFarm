import { DAYS_PER_SEASON, seasons, weekdays } from '../data/calendar';
import type { Game } from '../sim/game';
import { calendarOf, festivalOf } from '../sim/calendar';
import { defOf } from '../sim/systems/events';
import { esc, ui as uiAttr } from './dom';
import { clockText } from './format';
import type { UiState } from './panels';

/**
 * CUỐN LỊCH (nút 📅 trên đồng hồ HUD): lịch một mùa (2 tuần = 2 hàng Thứ 2 → Chủ Nhật) có ngày hôm nay, ngày lễ;
 * lật qua lại các mùa (`ui.calendar` = số mùa lệch so với mùa hiện tại); dải 4 mùa của năm; danh sách sắp tới
 * (sự kiện hôm nay, lễ hội, sang mùa, tổng kết mùa / năm). Mở lịch thì game tạm dừng (app.ts).
 */

const SEASON_NOTE: Record<string, string> = {
  spring: 'Rau củ đúng mùa rẻ, mưa xuân nhiều.',
  summer: 'Nắng nhiều, có ngày nắng nóng đất mau khô, thỉnh thoảng có bão.',
  autumn: 'Gió lộng, lá vàng bay.',
  winter: 'Đất ngoài trời đóng băng (nhà kính vẫn trồng), gà mái đẻ và bò sữa hết lứa, có tuyết.',
};

interface Upcoming {
  inDays: number;
  icon: string;
  text: string;
  note?: string;
}

/** Những việc sắp tới trong `within` ngày (kể cả hôm nay). */
export function upcoming(game: Game, within = DAYS_PER_SEASON * 2): Upcoming[] {
  const { state } = game;
  const day = state.clock.day;
  const list: Upcoming[] = [];
  const e = state.event;
  if (e && e.status !== 'done') {
    const def = defOf(e.id);
    if (e.status === 'active') list.push({ inDays: 0, icon: def.icon, text: `${def.name} đang diễn ra` });
    else if (def.announce) list.push({ inDays: 0, icon: def.icon, text: `${def.name} ghé quán khoảng ${clockText(e.at)}` });
  }
  for (let i = 0; i <= within; i++) {
    const d = day + i;
    const c = calendarOf(d);
    const f = festivalOf(d);
    if (f) list.push({ inDays: i, icon: f.icon, text: f.name, note: f.desc });
    if (i > 0 && c.dayOfSeason === 1) {
      const s = seasons[c.season];
      list.push({ inDays: i, icon: s.icon, text: c.season === 0 ? `Năm ${c.year} - mùa Xuân bắt đầu` : `Mùa ${s.name} bắt đầu`, note: SEASON_NOTE[s.id] });
    }
    if (c.dayOfSeason === DAYS_PER_SEASON) list.push({ inDays: i, icon: '📊', text: c.season === seasons.length - 1 ? `Tổng kết năm ${c.year}` : `Tổng kết mùa ${seasons[c.season].name}` });
  }
  return list;
}

const when = (n: number) => (n === 0 ? 'Hôm nay' : n === 1 ? 'Ngày mai' : `${n} ngày nữa`);

export function calendarHtml(game: Game, ui: UiState): string {
  if (ui.calendar == null) return '';
  const day = game.state.clock.day;
  const today = calendarOf(day);
  const curAbs = Math.floor((Math.max(1, day) - 1) / DAYS_PER_SEASON); // mùa thứ mấy kể từ đầu ván (0 = Xuân năm 1)
  const abs = Math.max(0, curAbs + ui.calendar);
  const first = abs * DAYS_PER_SEASON + 1;
  const c = calendarOf(first);
  const season = seasons[c.season];

  const cells: string[] = [];
  for (let i = 0; i < DAYS_PER_SEASON; i++) {
    const d = first + i;
    const f = festivalOf(d);
    const cls = ['cal-day', d === day ? 'today' : d < day ? 'past' : '', f ? 'fest' : '', i === DAYS_PER_SEASON - 1 ? 'end' : ''].filter(Boolean).join(' ');
    const title = [`${weekdays[calendarOf(d).weekday].name}, ngày ${i + 1} mùa ${season.name}`, f?.name, i === DAYS_PER_SEASON - 1 ? 'Tổng kết mùa' : ''].filter(Boolean).join(' · ');
    cells.push(`<div class="${cls}" title="${esc(title)}"><b>${i + 1}</b>${f ? `<span class="cal-ico">${f.icon}</span>` : d === day ? '<span class="cal-ico">📍</span>' : ''}${f ? `<em>${esc(f.name)}</em>` : ''}</div>`);
  }
  const strip = seasons
    .map((s, i) => {
      const at = Math.floor(abs / seasons.length) * seasons.length + i;
      return `<button class="cal-season${i === c.season ? ' on' : ''}${at === curAbs ? ' now' : ''}"${uiAttr(`calendar:${at - curAbs}`)}>${s.icon} ${esc(s.name)}</button>`;
    })
    .join('');
  const next = upcoming(game).slice(0, 6);

  return `<div class="backdrop" data-key="calendar"${uiAttr('calendar:close')}>
    <div class="dialog calendar" role="dialog" aria-label="Lịch"${uiAttr('noop')}>
      <div class="dialog-head"><h2>📅 Lịch · Năm ${c.year}</h2><button class="x-close"${uiAttr('calendar:close')} aria-label="Đóng">✕</button></div>
      <p class="cal-today">Hôm nay: <b>${weekdays[today.weekday].name}, ngày ${today.dayOfSeason} mùa ${esc(seasons[today.season].name)}, năm ${today.year}</b></p>
      <div class="cal-strip">${strip}</div>
      <div class="cal-nav">
        <button class="mini"${uiAttr(`calendar:${abs - 1 - curAbs}`)}${abs <= 0 ? ' disabled' : ''} aria-label="Mùa trước">‹</button>
        <b>${season.icon} Mùa ${esc(season.name)}</b>
        <button class="mini"${uiAttr(`calendar:${abs + 1 - curAbs}`)} aria-label="Mùa sau">›</button>
      </div>
      <div class="cal-grid">${weekdays.map((w) => `<span class="cal-wd">${esc(w.short.replace('Thứ ', 'T').replace('Chủ Nhật', 'CN'))}</span>`).join('')}${cells.join('')}</div>
      <p class="muted cal-note">${esc(SEASON_NOTE[season.id] ?? '')}</p>
      <h3>Sắp tới</h3>
      <ul class="cal-next">${next.length ? next.map((u) => `<li title="${esc(u.note ?? '')}"><span class="cal-ico">${u.icon}</span><span><b>${esc(u.text)}</b>${u.note ? `<small>${esc(u.note)}</small>` : ''}</span><em>${when(u.inDays)}</em></li>`).join('') : '<li class="muted">Chưa có gì đặc biệt.</li>'}</ul>
    </div>
  </div>`;
}
