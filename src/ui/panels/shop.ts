import { decorFor, type DecorDef, type DecorSlot, type ModifierKey } from '../../data';
import { decorSlotNames } from '../../data/decor';
import type { Game } from '../../sim/game';
import { cmd, esc, ui } from '../dom';
import { coins } from '../format';
import type { Panel, UiState } from './types';

const MODIFIER_NAMES: Record<ModifierKey, string> = {
  cookSpeed: 'tốc độ nấu',
  patience: 'độ kiên nhẫn của khách',
  tip: 'tiền tip',
  spawnRate: 'lượng khách',
  growSpeed: 'tốc độ lớn của nông trại',
  dishPrice: 'giá bán món',
};

/** "+10% độ kiên nhẫn của khách · +15% tiền tip" từ bảng hệ số. */
export function bonusText(modifiers?: Partial<Record<ModifierKey, number>>): string {
  return Object.entries(modifiers ?? {})
    .map(([key, mul]) => `${mul >= 1 ? '+' : ''}${Math.round((mul - 1) * 100)}% ${MODIFIER_NAMES[key as ModifierKey]}`)
    .join(' · ');
}

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

function decorCard(game: Game, d: DecorDef, uiState: UiState): string {
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
  // Xem trước: tô lại quán bằng màu món này (chưa mua), bấm lần nữa thì thôi
  const previewing = uiState.decorPreview === d.id;
  const preview = using ? '' : `<button class="${previewing ? 'on' : 'ghost'}"${ui(`decorPreview:${d.id}`)}>${previewing ? '✖ Thôi xem' : '👀 Xem trước'}</button>`;
  return `<div class="card ${using ? 'owned' : ''}${previewing ? ' previewing' : ''}" data-key="${d.id}"><div class="row">
    <span class="big">${d.icon}</span>
    <div class="grow"><b>${esc(d.name)}</b>
      <div class="swatches">${swatches}</div>
      <div class="muted">${bonusText(d.modifiers) || 'Chỉ để đẹp'}</div></div>
    <div class="btns">${preview}${button}</div></div></div>`;
}

/** Siêu thị: nội thất (sàn, sơn tường, bàn ghế) + trang thiết bị nâng cấp quán. */
export const shopPanel: Panel = {
  id: 'shop',
  label: 'Siêu thị',
  icon: '🛒',
  render(game, uiState) {
    const { state, content } = game;

    const decor = (Object.keys(decorSlotNames) as DecorSlot[])
      .map((slot) => {
        const cards = decorFor(content, state.cuisine)
          .filter((d) => d.slot === slot)
          .map((d) => decorCard(game, d, uiState))
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

    // Đồ trang trí đặt tự do (F4): mua là tự bày vào chỗ trống
    const owned = (id: string) => state.restaurant.props.filter((p) => p.def === id).length;
    const props = content.props
      .all()
      .filter((p) => !p.giftOnly && (!p.cuisine || p.cuisine === state.cuisine))
      .map((p) => {
        const levelOk = state.level >= p.level;
        const n = owned(p.id);
        return `<div class="card" data-key="prop-${p.id}"><div class="row">
          <span class="big">${p.icon}</span>
          <div class="grow"><b>${esc(p.name)}</b>${n ? ` <span class="pill">Có ${n}</span>` : ''}
            <div class="muted">${bonusText(p.modifiers) || 'Chỉ để đẹp'}</div></div>
          <button${cmd({ type: 'prop/buy', propId: p.id })}${levelOk && state.money >= p.cost ? '' : ' disabled'}>${levelOk ? coins(p.cost) : `🔒 Cấp ${p.level}`}</button></div></div>`;
      })
      .join('');

    // Bàn lẻ mua thêm (B7)
    const extraCount = (kind: string) => state.restaurant.extraTables.filter((t) => t.kind === kind).length;
    const tables = content.tableKinds
      .all()
      .map((k) => {
        const levelOk = state.level >= k.level;
        const n = extraCount(k.id);
        return `<div class="card" data-key="tk-${k.id}"><div class="row">
          <span class="big">${k.icon}</span>
          <div class="grow"><b>${esc(k.name)}</b>${n ? ` <span class="pill">Đã mua ${n}</span>` : ''}<div class="muted">${k.seats} chỗ ngồi · tự đặt vào chỗ trống</div></div>
          <button${cmd({ type: 'table/buy', kind: k.id })}${levelOk && state.money >= k.cost ? '' : ' disabled'}>${levelOk ? coins(k.cost) : `🔒 Cấp ${k.level}`}</button></div></div>`;
      })
      .join('');

    // Thú cưng (F5)
    const pets = content.pets
      .all()
      .map((p) => {
        const has = state.profile.pets.includes(p.id);
        const using = state.profile.petsOut.includes(p.id);
        const levelOk = state.level >= p.level;
        const button = using
          ? `<button class="on"${cmd({ type: 'pet/set', petId: p.id, out: false })}>✔ Ở quán · Cho nghỉ</button>`
          : has
            ? `<button${cmd({ type: 'pet/set', petId: p.id, out: true })}>Đưa ra quán</button>`
            : `<button${cmd({ type: 'pet/adopt', petId: p.id })}${levelOk && state.money >= p.cost ? '' : ' disabled'}>${levelOk ? coins(p.cost) : `🔒 Cấp ${p.level}`}</button>`;
        return `<div class="card ${using ? 'owned' : ''}" data-key="pet-${p.id}"><div class="row">
          <span class="big">${p.icon}</span>
          <div class="grow"><b>${esc(p.name)}</b><div class="muted">${esc(p.desc)}</div><div class="muted">${bonusText(p.modifiers)}</div></div>
          ${button}</div></div>`;
      })
      .join('');

    const pv = uiState.decorPreview && content.decor.has(uiState.decorPreview) ? content.decor.get(uiState.decorPreview) : null;
    const previewBar = pv
      ? `<div class="card previewing" data-key="decor-preview"><div class="row"><span class="big">👀</span><div class="grow"><b>Đang xem trước: ${esc(pv.name)}</b><div class="muted">Quán đang tô màu thử — mua thì giữ luôn, thôi thì về như cũ.</div></div><div class="btns"><button class="ghost"${ui('decorPreview:')}>Thôi</button></div></div></div>`
      : '';
    return `${previewBar}<div class="row"><p class="muted grow">Mua nội thất là dùng ngay; món đã mua đổi qua lại miễn phí. Bấm 👀 Xem trước để thử màu sàn, tường, bàn ghế trong quán trước khi mua.</p>
      <button class="mini"${ui('edit')}>🪑 Sắp xếp quán</button></div>
      <h3>Đồ trang trí</h3><p class="muted">Mua là tự bày vào chỗ trống; vào 🪑 Sắp xếp quán để kéo đi chỗ khác, xoay, cất kho. Mỗi loại tính hiệu ứng một lần.</p>${props}
      <h3>Thú cưng</h3>${pets}
      <h3>Bàn thêm</h3>${tables}
      ${decor}<h3>Trang thiết bị</h3>${equipment}`;
  },
};
