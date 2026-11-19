import { fitsSlot, type MillType, type ProducerDef, type SlotTypeDef } from '../../data';
import type { Game } from '../../sim/game';
import type { FarmSlot } from '../../sim/state';
import { cycleTime, needsWatering, nextTier, slotPrice, slotsOfType, yieldsOf } from '../../sim/systems/farm';
import { isAutoSlot, queuedKinds } from '../../sim/systems/farmer';
import { canPlantNow, isFrozen, seasonNames, seasonOf } from '../../sim/calendar';
import { millPrice, millsOfType } from '../../sim/systems/mills';
import { bar, cmd, esc, ui } from '../dom';
import { coins, duration } from '../format';
import type { Panel, UiState } from './types';

function yieldsText(game: Game, slot: FarmSlot, def: ProducerDef): string {
  return yieldsOf(game.ctx, slot, def)
    .map((y) => `${y.qty}${game.content.items.get(y.item).icon}`)
    .join(' ');
}

function slotCard(game: Game, slot: FarmSlot, uiState: UiState): string {
  const { content, state, ctx } = game;
  const type = content.slotTypes.get(slot.type);
  const selected = uiState.selectedSlot === slot.id ? 'selected' : '';
  const wet = type.needsWater && slot.wet > 0 ? 'wet' : '';
  const tier = slot.tier > 1 ? `<span class="tier">Bậc ${slot.tier}</span>` : '';
  // Ô đã giao việc cho bác nông dân: hiện dấu và không cho bấm lại việc đó
  const queued = queuedKinds(ctx, slot.id).filter((k) => k !== 'visit');
  const coming = queued.length ? '<span class="coming" title="Bác nông dân đang tới">🧑‍🌾</span>' : '';

  if (!slot.producerId) {
    if (type.needsTilling && !slot.tilled && !queued.length) {
      return `<div class="slot hard ${selected}" data-key="${slot.id}"${cmd({ type: 'farmer/do', kind: 'till', slotId: slot.id })}>
        <span class="big">⛏️</span><b>Cuốc đất</b></div>`;
    }
    if (queued.length) {
      return `<div class="slot hard ${selected}" data-key="${slot.id}"${ui(`slot:${slot.id}`)}>${coming}<span class="big">🧑‍🌾</span><b>Bác đang tới</b></div>`;
    }
    const last = slot.lastProducerId ? content.producers.get(slot.lastProducerId) : null;
    const replant = last && canPlantNow(ctx, last, slot.type)
      ? `<button class="mini"${cmd({ type: 'farmer/do', kind: 'plant', slotId: slot.id, producerId: last.id })}${state.money >= last.cost ? '' : ' disabled'} title="Trồng/nuôi lại ${esc(last.name)}">↻ ${last.icon}</button>`
      : '';
    return `<div class="slot empty ${wet} ${selected}" data-key="${slot.id}"${ui(`slot:${slot.id}`)}>${tier}<span class="muted">${type.needsTilling ? 'Sẵn sàng gieo' : 'Trống'}</span>${replant}</div>`;
  }

  const def = content.producers.get(slot.producerId);
  if (slot.stage === 'ready') {
    return `<div class="slot ready ${selected}" data-key="${slot.id}"${queued.length ? ui(`slot:${slot.id}`) : cmd({ type: 'farmer/do', kind: 'harvest', slotId: slot.id })}>
      ${tier}${coming}<span class="big">${def.icon}</span><b>Thu ${yieldsText(game, slot, def)}</b></div>`;
  }
  const total = cycleTime(def, slot);
  const water = queued.length
    ? '<span class="muted">Bác đang tới</span>'
    : needsWatering(ctx, slot)
    ? `<button class="mini water"${cmd({ type: 'farmer/do', kind: 'water', slotId: slot.id })}>💧 Tưới</button>`
    : `<span class="muted">${duration(total - slot.progress)}</span>`;
  return `<div class="slot ${wet} ${selected}" data-key="${slot.id}"${ui(`slot:${slot.id}`)}>
    ${tier}${coming}<span class="big">${def.icon}</span>${bar(slot.progress / total, 'green')}${water}</div>`;
}

function slotDetail(game: Game, slot: FarmSlot): string {
  const { content, state, ctx } = game;
  const type = content.slotTypes.get(slot.type);

  // Nới rộng ô (vd ao cá)
  const next = nextTier(ctx, slot);
  const upgrade = next
    ? `<div class="row"><div class="grow"><b>Nới rộng ${esc(type.name.toLowerCase())}</b>
        <div class="muted">Bậc ${slot.tier} → ${slot.tier + 1} · sản lượng ×${next.yieldMul}</div></div>
        <button${cmd({ type: 'farm/upgradeSlot', slotId: slot.id })}${state.level >= next.level && state.money >= next.cost ? '' : ' disabled'}>${state.level >= next.level ? coins(next.cost) : `🔒 Cấp ${next.level}`}</button></div>`
    : '';

  if (slot.producerId) {
    const def = content.producers.get(slot.producerId);
    const repeat = isAutoSlot(ctx, slot)
      ? `thu bằng máy cày, tự gieo lại và chở tới ${esc(content.mills.get(type.mill!).name.toLowerCase())}`
      : def.cycles === 1 ? 'thu 1 lần' : `thu nhiều lần, mỗi ${duration(def.regrowTime ?? def.growTime)}`;
    const moisture = type.needsWater ? ` · ${slot.wet > 0 ? `đất ẩm thêm ${duration(slot.wet)}` : 'đất khô, cây lớn chậm'}` : '';
    return `<div class="card"><div class="row"><span class="big">${def.icon}</span>
      <div class="grow"><b>${esc(def.name)}</b><div class="muted">Cho ${yieldsText(game, slot, def)} · ${repeat}${moisture}</div></div>
      <button class="danger"${cmd({ type: 'farmer/do', kind: 'clear', slotId: slot.id })}>Dọn ô</button></div>${upgrade}</div>`;
  }
  if (type.needsTilling && !slot.tilled) {
    return `<div class="card"><div class="row"><span class="big">⛏️</span>
      <div class="grow"><b>Đất chưa tơi xốp</b><div class="muted">Cuốc đất rồi mới gieo hạt được.</div></div>
      <button${cmd({ type: 'farmer/do', kind: 'till', slotId: slot.id })}>Cuốc đất</button></div></div>`;
  }
  const options = content.producers
    .all()
    .filter((p) => fitsSlot(p, slot.type))
    // Giống hợp mùa xếp trước; giống trái mùa (ngoài trời) vẫn hiện nhưng không gieo được
    .sort((a, b) => Number(canPlantNow(ctx, b, slot.type)) - Number(canPlantNow(ctx, a, slot.type)))
    .map((p) => {
      const levelOk = state.level >= p.level;
      const inSeason = canPlantNow(ctx, p, slot.type);
      const indoor = !!type.building;
      const seasonTag = p.seasons && !indoor
        ? `<span class="season-tag${inSeason ? ' ok' : ''}">${inSeason ? 'Đúng mùa' : 'Trái mùa'} · ${seasonNames(p.seasons)}</span>`
        : '';
      const btn = !inSeason
        ? `<button disabled title="Chỉ gieo ngoài trời vào mùa ${seasonNames(p.seasons ?? [])}">Trái mùa</button>`
        : `<button${cmd({ type: 'farmer/do', kind: 'plant', slotId: slot.id, producerId: p.id })}${levelOk && state.money >= p.cost ? '' : ' disabled'}>${levelOk ? coins(p.cost) : `🔒 Cấp ${p.level}`}</button>`;
      return `<div class="row${inSeason ? '' : ' off-season'}" data-key="${p.id}"><span class="big">${p.icon}</span>
        <div class="grow"><b>${esc(p.name)}</b> ${seasonTag}
          <div class="muted">${duration(p.growTime)} → ${yieldsText(game, slot, p)}${p.cycles === 1 ? '' : ` mỗi ${duration(p.regrowTime ?? p.growTime)}`}</div></div>
        ${btn}</div>`;
    })
    .join('');
  return `<div class="card"><b>Chọn thứ để trồng / nuôi</b>${options}${upgrade}</div>`;
}

/** Một loại cối: danh sách cối (thành phẩm đang làm, hàng chờ xay) + nút mua thêm. */
function millSection(game: Game, type: MillType): string {
  const { content, state, ctx } = game;
  const def = content.mills.get(type);
  const list = millsOfType(ctx, type);
  const price = millPrice(ctx, type);
  const levelOk = state.level >= def.level;
  const buy =
    list.length >= def.max
      ? ''
      : `<button class="mini"${cmd({ type: 'mill/buy', millType: type })}${levelOk && state.money >= price ? '' : ' disabled'}>${levelOk ? `+ Thêm cối · ${coins(price)}` : `🔒 Cấp ${def.level}`}</button>`;
  const input = content.items.get(def.input);
  const cards = list
    .map((m, i) => {
      const choices = def.products
        .map((p) => {
          const item = content.items.get(p);
          return `<button class="mini${m.product === p ? ' on' : ''}"${cmd({ type: 'mill/setProduct', millId: m.id, item: p })}>${item.icon} ${esc(item.name)}</button>`;
        })
        .join('');
      const status = m.input
        ? `còn ${m.input}${input.icon} chờ xay${bar(m.progress / def.time, 'green')}`
        : `<span class="muted">Đang chờ bác chở ${esc(input.name.toLowerCase())} tới</span>`;
      return `<div class="card" data-key="${m.id}"><div class="row"><span class="big">${def.icon}</span>
        <div class="grow"><b>${esc(def.name)} ${list.length > 1 ? i + 1 : ''}</b><div class="muted">1${input.icon} → 1 thành phẩm · ${duration(def.time)} mỗi phần</div>${status}</div></div>
        <div class="btns wrap">${choices}</div></div>`;
    })
    .join('');
  return `<div class="row"><h3 class="grow">${def.icon} ${esc(def.name)} (${list.length}/${def.max})</h3>${buy}</div>${cards}`;
}

/** Một loại ô: tiêu đề + nút mua thêm + các ô + chi tiết ô đang chọn. */
function slotSection(game: Game, type: SlotTypeDef, uiState: UiState): string {
  const { state, ctx } = game;
  const selected = state.farm.slots.find((s) => s.id === uiState.selectedSlot);
  const slots = slotsOfType(ctx, type.id);
  const price = slotPrice(ctx, type.id);
  const levelOk = state.level >= type.level;
  const buy =
    slots.length >= type.max
      ? ''
      : `<button class="mini"${cmd({ type: 'farm/buySlot', slotType: type.id })}${levelOk && state.money >= price ? '' : ' disabled'}>${levelOk ? `${type.building ? `+ Nới dài nhà (thêm ${type.batch} luống)` : '+ Thêm ô'} · ${coins(price)}` : `🔒 Cấp ${type.level}`}</button>`;
  const detail = selected && selected.type === type.id ? slotDetail(game, selected) : '';
  const note = type.building
    ? '<p class="muted">Trong nhà kính: không cần cuốc, có tưới nhỏ giọt, cây lớn nhanh hơn 30%. Bấm vào nhà kính trên nông trại để vào trong.</p>'
    : type.mill ? `<p class="muted">Bấm thu hoạch là xong: bác lái máy cày thu, tự gieo lại và chở lúa tới ${esc(game.content.mills.get(type.mill).name.toLowerCase())}.</p>` : '';
  return `<div class="row"><h3 class="grow">${type.icon} ${esc(type.name)} (${slots.length}/${type.max})</h3>${buy}</div>${note}
    <div class="slots">${slots.map((s) => slotCard(game, s, uiState)).join('')}</div>${detail}`;
}

export const farmPanel: Panel = {
  id: 'farm',
  label: 'Nông trại',
  icon: '🌾',
  badge: (game) => game.state.farm.slots.filter((s) => s.producerId && s.stage === 'ready').length,
  render(game, uiState) {
    const { state, content, ctx } = game;
    const anyReady = state.farm.slots.some((s) => s.producerId && s.stage === 'ready');
    const anyDry = state.farm.slots.some((s) => s.producerId && s.stage === 'growing' && needsWatering(ctx, s) && !isFrozen(ctx, s.type));

    // Bấm vào ô / cối / chỗ mở rộng trong cảnh 3D: chỉ hiện đúng loại đó (ruộng lúa đi kèm cối của nó)
    const focus = uiState.farmFocus;
    const focusType = focus && content.slotTypes.has(focus) ? content.slotTypes.get(focus) : null;
    const focusMill = focus && content.mills.has(focus) ? (focus as MillType) : focusType?.mill ?? null;
    const types = content.slotTypes.all().filter((t) => !focus || t.id === focus || (focusMill && t.mill === focusMill));
    const millTypes = content.mills.all().filter((m) => !focus || m.id === focusMill);
    const sections = types.map((t) => slotSection(game, t, uiState)).join('') + millTypes.map((m) => millSection(game, m.id)).join('');
    const focusBar = focus
      ? `<div class="row focus-bar"><span class="grow">Đang xem: <b>${esc((focusType ?? content.mills.get(focusMill!)).name)}</b></span><button class="mini"${ui('farmFocus:')}>Xem cả nông trại</button></div>`
      : '';

    // Trạng thái bác nông dân: rảnh / đang làm gì / còn bao nhiêu việc
    const tasks = state.farm.farmer.tasks.filter((t) => t.kind !== 'visit');
    const farmer = tasks.length
      ? `<span class="grow">🧑‍🌾 Bác nông dân còn <b>${tasks.length}</b> việc</span><button class="mini"${cmd({ type: 'farmer/cancel' })} title="Bỏ các việc chưa tới lượt">Huỷ bớt</button>`
      : '<span class="grow muted">🧑‍🌾 Bác nông dân đang rảnh — bấm ô để giao việc</span>';

    const winter = seasonOf(ctx).frozen
      ? '<p class="winter-note">❄️ Mùa đông: đất ngoài trời đóng băng, chuồng và ao nghỉ — cây ngoài trời ngừng lớn tới mùa Xuân. Nhà kính vẫn trồng bình thường.</p>'
      : '';
    return `${winter}${focusBar}${focus ? '' : '<p class="muted">Ruộng: cuốc đất → gieo → tưới (trời mưa khỏi tưới) → thu. Ruộng lúa thu tự động bằng máy cày. Qua đêm nông trại và cối vẫn chạy.</p>'}
      <div class="row farmer-status">${farmer}</div>
      <div class="row"><span class="grow"></span>
        <button${cmd({ type: 'farmer/doAll', kind: 'water' })}${anyDry ? '' : ' disabled'}>💧 Tưới hết</button>
        <button${cmd({ type: 'farmer/doAll', kind: 'harvest' })}${anyReady ? '' : ' disabled'}>Thu hoạch hết</button></div>${sections}`;
  },
};
