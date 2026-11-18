import { decorFor, type DecorDef, type DecorSlot, type ModifierKey } from '../../data';
import { decorSlotNames } from '../../data/decor';
import type { Game } from '../../sim/game';
import { cmd, esc, ui } from '../dom';
import { coins } from '../format';
import type { Panel } from './types';

const MODIFIER_NAMES: Record<ModifierKey, string> = {
  cookSpeed: 'tốc độ nấu',
  patience: 'độ kiên nhẫn của khách',
  tip: 'tiền tip',
  spawnRate: 'lượng khách',
  growSpeed: 'tốc độ lớn của nông trại',
  dishPrice: 'giá bán món',
};

/** "+10% độ kiên nhẫn của khách · +15% tiền tip" từ bảng hệ số. */
function bonusText(modifiers?: Partial<Record<ModifierKey, number>>): string {
  return Object.entries(modifiers ?? {})
    .map(([key, mul]) => `${mul >= 1 ? '+' : ''}${Math.round((mul - 1) * 100)}% ${MODIFIER_NAMES[key as ModifierKey]}`)
    .join(' · ');
}

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

function decorCard(game: Game, d: DecorDef): string {
  const { state } = game;
  const owned = state.decor.owned.includes(d.id);
  const using = state.decor.equipped[d.slot] === d.id;
  const levelOk = state.level >= d.level;
  const swatches = Object.values(d.colors)
    .map((c) => `<i class="swatch" style="background:${hex(c)}"></i>`)
    .join('');
  const button = using
    ? '<button class="on" disabled>✔ Đang dùng</button>'
    : owned
      ? `<button${cmd({ type: 'decor/equip', decorId: d.id })}>Dùng</button>`
      : `<button${cmd({ type: 'decor/buy', decorId: d.id })}${levelOk && state.money >= d.cost ? '' : ' disabled'}>${levelOk ? coins(d.cost) : `🔒 Cấp ${d.level}`}</button>`;
  return `<div class="card ${using ? 'owned' : ''}" data-key="${d.id}"><div class="row">
    <span class="big">${d.icon}</span>
    <div class="grow"><b>${esc(d.name)}</b>
      <div class="swatches">${swatches}</div>
      <div class="muted">${bonusText(d.modifiers) || 'Chỉ để đẹp'}</div></div>
    ${button}</div></div>`;
}

/** Siêu thị: nội thất (sàn, sơn tường, bàn ghế) + trang thiết bị nâng cấp quán. */
export const shopPanel: Panel = {
  id: 'shop',
  label: 'Siêu thị',
  icon: '🛒',
  render(game) {
    const { state, content } = game;

    const decor = (Object.keys(decorSlotNames) as DecorSlot[])
      .map((slot) => {
        const cards = decorFor(content, state.cuisine)
          .filter((d) => d.slot === slot)
          .map((d) => decorCard(game, d))
          .join('');
        return `<h3>${decorSlotNames[slot]}</h3>${cards}`;
      })
      .join('');

    const equipment = content.upgrades
      .all()
      .map((u) => {
        const owned = state.upgrades.includes(u.id);
        const levelOk = state.level >= u.level;
        const preOk = !u.requires || state.upgrades.includes(u.requires);
        const label = owned ? '✔ Đã có' : !levelOk ? `🔒 Cấp ${u.level}` : !preOk ? `Cần ${esc(content.upgrades.get(u.requires!).name)}` : coins(u.cost);
        const enabled = !owned && levelOk && preOk && state.money >= u.cost;
        return `<div class="card ${owned ? 'owned' : ''}" data-key="${u.id}"><div class="row">
          <span class="big">${u.icon}</span>
          <div class="grow"><b>${esc(u.name)}</b><div class="muted">${esc(u.desc)}</div></div>
          <button${cmd({ type: 'upgrade/buy', upgradeId: u.id })}${enabled ? '' : ' disabled'}>${label}</button></div></div>`;
      })
      .join('');

    return `<div class="row"><p class="muted grow">Mua nội thất là dùng ngay; món đã mua đổi qua lại miễn phí.</p>
      <button class="mini"${ui('edit')}>🪑 Sắp xếp bàn</button></div>
      ${decor}<h3>Trang thiết bị</h3>${equipment}`;
  },
};
