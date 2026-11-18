import type { ProducerDef } from '../../data';
import type { Game } from '../../sim/game';
import type { FarmSlot } from '../../sim/state';
import { cycleTime, needsWatering, nextTier, slotPrice, slotsOfType, yieldsOf } from '../../sim/systems/farm';
import { queuedKinds } from '../../sim/systems/farmer';
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
    const replant = last
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
    const repeat = def.cycles === 1 ? 'thu 1 lần' : `thu nhiều lần, mỗi ${duration(def.regrowTime ?? def.growTime)}`;
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
    .filter((p) => p.slot === slot.type)
    .map((p) => {
      const levelOk = state.level >= p.level;
      return `<div class="row" data-key="${p.id}"><span class="big">${p.icon}</span>
        <div class="grow"><b>${esc(p.name)}</b>
          <div class="muted">${duration(p.growTime)} → ${yieldsText(game, slot, p)}${p.cycles === 1 ? '' : ` mỗi ${duration(p.regrowTime ?? p.growTime)}`}</div></div>
        <button${cmd({ type: 'farmer/do', kind: 'plant', slotId: slot.id, producerId: p.id })}${levelOk && state.money >= p.cost ? '' : ' disabled'}>${levelOk ? coins(p.cost) : `🔒 Cấp ${p.level}`}</button></div>`;
    })
    .join('');
  return `<div class="card"><b>Chọn thứ để trồng / nuôi</b>${options}${upgrade}</div>`;
}

export const farmPanel: Panel = {
  id: 'farm',
  label: 'Nông trại',
  icon: '🌾',
  badge: (game) => game.state.farm.slots.filter((s) => s.producerId && s.stage === 'ready').length,
  render(game, uiState) {
    const { state, content, ctx } = game;
    const selected = state.farm.slots.find((s) => s.id === uiState.selectedSlot);
    const anyReady = state.farm.slots.some((s) => s.producerId && s.stage === 'ready');
    const anyDry = state.farm.slots.some((s) => s.producerId && s.stage === 'growing' && needsWatering(ctx, s));

    const sections = content.slotTypes
      .all()
      .map((type) => {
        const slots = slotsOfType(ctx, type.id);
        const price = slotPrice(ctx, type.id);
        const levelOk = state.level >= type.level;
        const buy =
          slots.length >= type.max
            ? ''
            : `<button class="mini"${cmd({ type: 'farm/buySlot', slotType: type.id })}${levelOk && state.money >= price ? '' : ' disabled'}>${levelOk ? `+ Thêm ô · ${coins(price)}` : `🔒 Cấp ${type.level}`}</button>`;
        const detail = selected && selected.type === type.id ? slotDetail(game, selected) : '';
        return `<div class="row"><h3 class="grow">${type.icon} ${esc(type.name)} (${slots.length}/${type.max})</h3>${buy}</div>
          <div class="slots">${slots.map((s) => slotCard(game, s, uiState)).join('')}</div>${detail}`;
      })
      .join('');

    // Trạng thái bác nông dân: rảnh / đang làm gì / còn bao nhiêu việc
    const tasks = state.farm.farmer.tasks.filter((t) => t.kind !== 'visit');
    const farmer = tasks.length
      ? `<span class="grow">🧑‍🌾 Bác nông dân còn <b>${tasks.length}</b> việc</span><button class="mini"${cmd({ type: 'farmer/cancel' })} title="Bỏ các việc chưa tới lượt">Huỷ bớt</button>`
      : '<span class="grow muted">🧑‍🌾 Bác nông dân đang rảnh — bấm ô để giao việc</span>';

    return `<p class="muted">Ruộng: cuốc đất → gieo → tưới (trời mưa khỏi tưới) → thu. Qua đêm nông trại vẫn lớn.</p>
      <div class="row farmer-status">${farmer}</div>
      <div class="row"><span class="grow"></span>
        <button${cmd({ type: 'farmer/doAll', kind: 'water' })}${anyDry ? '' : ' disabled'}>💧 Tưới hết</button>
        <button${cmd({ type: 'farmer/doAll', kind: 'harvest' })}${anyReady ? '' : ' disabled'}>Thu hoạch hết</button></div>${sections}`;
  },
};
