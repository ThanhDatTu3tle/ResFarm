import type { ProducerDef } from '../../data';
import type { Game } from '../../sim/game';
import type { FarmSlot } from '../../sim/state';
import { cycleTime, slotPrice, slotsOfType } from '../../sim/systems/farm';
import { bar, cmd, esc, ui } from '../dom';
import { coins, duration } from '../format';
import type { Panel, UiState } from './types';

function yieldsText(game: Game, def: ProducerDef): string {
  return def.yields.map((y) => `${y.qty}${game.content.items.get(y.item).icon}`).join(' ');
}

function slotCard(game: Game, slot: FarmSlot, uiState: UiState): string {
  const { content, state } = game;
  const selected = uiState.selectedSlot === slot.id ? 'selected' : '';
  if (!slot.producerId) {
    const last = slot.lastProducerId ? content.producers.get(slot.lastProducerId) : null;
    const replant = last
      ? `<button class="mini"${cmd({ type: 'farm/plant', slotId: slot.id, producerId: last.id })}${state.money >= last.cost ? '' : ' disabled'} title="Trồng/nuôi lại ${esc(last.name)}">↻ ${last.icon}</button>`
      : '';
    return `<div class="slot empty ${selected}" data-key="${slot.id}"${ui(`slot:${slot.id}`)}><span class="muted">Trống</span>${replant}</div>`;
  }
  const def = content.producers.get(slot.producerId);
  if (slot.stage === 'ready') {
    return `<div class="slot ready ${selected}" data-key="${slot.id}"${cmd({ type: 'farm/harvest', slotId: slot.id })}>
      <span class="big">${def.icon}</span><b>Thu ${yieldsText(game, def)}</b></div>`;
  }
  const total = cycleTime(def, slot);
  return `<div class="slot ${selected}" data-key="${slot.id}"${ui(`slot:${slot.id}`)}>
    <span class="big">${def.icon}</span>${bar(slot.progress / total, 'green')}
    <span class="muted">${duration(total - slot.progress)}</span></div>`;
}

function slotDetail(game: Game, slot: FarmSlot): string {
  const { content, state } = game;
  if (slot.producerId) {
    const def = content.producers.get(slot.producerId);
    const repeat = def.cycles === 1 ? 'thu 1 lần' : `thu nhiều lần, mỗi ${duration(def.regrowTime ?? def.growTime)}`;
    return `<div class="card"><div class="row"><span class="big">${def.icon}</span>
      <div class="grow"><b>${esc(def.name)}</b><div class="muted">Cho ${yieldsText(game, def)} · ${repeat}</div></div>
      <button class="danger"${cmd({ type: 'farm/clear', slotId: slot.id })}>Dọn ô</button></div></div>`;
  }
  const options = content.producers
    .all()
    .filter((p) => p.slot === slot.type)
    .map((p) => {
      const levelOk = state.level >= p.level;
      return `<div class="row" data-key="${p.id}"><span class="big">${p.icon}</span>
        <div class="grow"><b>${esc(p.name)}</b>
          <div class="muted">${duration(p.growTime)} → ${yieldsText(game, p)}${p.cycles === 1 ? '' : ` mỗi ${duration(p.regrowTime ?? p.growTime)}`}</div></div>
        <button${cmd({ type: 'farm/plant', slotId: slot.id, producerId: p.id })}${levelOk && state.money >= p.cost ? '' : ' disabled'}>${levelOk ? coins(p.cost) : `🔒 Cấp ${p.level}`}</button></div>`;
    })
    .join('');
  return `<div class="card"><b>Chọn thứ để trồng / nuôi</b>${options}</div>`;
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

    return `<div class="row"><p class="muted grow">Bấm ô trống để chọn giống. Qua đêm nông trại vẫn lớn.</p>
      <button${cmd({ type: 'farm/harvestAll' })}${anyReady ? '' : ' disabled'}>Thu hoạch hết</button></div>${sections}`;
  },
};
