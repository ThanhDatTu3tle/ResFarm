import { fitsSlot, type MillType, type ProducerDef, type SlotTypeDef } from '../../data';
import type { Game } from '../../sim/game';
import type { FarmerTaskKind, FarmSlot } from '../../sim/state';
import { cycleTime, needsWatering, nextTier, slotPrice, slotsOfType, yieldsOf } from '../../sim/systems/farm';
import { gardenerOn, isAutoSlot, queuedKinds } from '../../sim/systems/farmer';
import { canPlantNow, isFrozen, seasonNames, seasonOf } from '../../sim/calendar';
import { millPrice, millsOfType } from '../../sim/systems/mills';
import { bar, cmd, esc, ui } from '../dom';
import { coins, duration, farmTime } from '../format';
import type { Panel, UiState } from './types';

function yieldsText(game: Game, slot: FarmSlot, def: ProducerDef): string {
  return yieldsOf(game.ctx, slot, def)
    .map((y) => `${y.qty}${game.content.items.get(y.item).icon}`)
    .join(' ');
}

/** Số thứ tự ô trong loại của nó (1, 2, 3...) để người chơi biết đang xem ô nào. */
function slotLabel(game: Game, slot: FarmSlot): string {
  const type = game.content.slotTypes.get(slot.type);
  const list = slotsOfType(game.ctx, slot.type);
  return list.length > 1 ? `${type.name} số ${list.indexOf(slot) + 1}` : type.name;
}

/** Chi tiết ô đang chọn (bấm ô trên cảnh 3D): đang lớn → tiến độ, tưới, dọn; trống → chọn giống để gieo / nuôi. */
function slotDetail(game: Game, slot: FarmSlot): string {
  const { content, state, ctx } = game;
  const type = content.slotTypes.get(slot.type);
  const queued: FarmerTaskKind[] = queuedKinds(ctx, slot.id).filter((k) => k !== 'visit');
  const helper = gardenerOn(ctx, slot.id);
  const coming = queued.length || helper ? `<span class="muted">${helper ? `👩‍🌾 ${esc(helper.name)} đang lo` : '🧑‍🌾 Bác đang tới làm'}</span>` : '';
  const head = `<div class="row slot-head"><b class="grow">${type.icon} ${esc(slotLabel(game, slot))}${slot.tier > 1 ? ` · bậc ${slot.tier}` : ''}</b>${coming}</div>`;

  // Nới rộng ô (vd ao cá)
  const next = nextTier(ctx, slot);
  const upgrade = next
    ? `<div class="row"><div class="grow"><b>Nới rộng ${esc(type.name.toLowerCase())}</b>
        <div class="muted">Bậc ${slot.tier} → ${slot.tier + 1} · sản lượng ×${next.yieldMul}${type.perTier ? ` · nuôi thêm ${type.perTier} loại` : ''}</div></div>
        <button${cmd({ type: 'farm/upgradeSlot', slotId: slot.id })}${state.level >= next.level && state.money >= next.cost ? '' : ' disabled'}>${state.level >= next.level ? coins(next.cost) : `🔒 Cấp ${next.level}`}</button></div>`
    : '';

  if (slot.producerId) {
    const def = content.producers.get(slot.producerId);
    const repeat = isAutoSlot(ctx, slot)
      ? `thu bằng máy cày, tự gieo lại và chở tới ${esc(content.mills.get(type.mill!).name.toLowerCase())}`
      : def.cycles === 1 ? 'thu 1 lần' : `thu nhiều lần, ${farmTime(def.regrowTime ?? def.growTime)} một lứa`;
    const moisture = type.needsWater ? ` · ${slot.wet > 0 ? `đất ẩm thêm ${farmTime(slot.wet)}` : 'đất khô, cây lớn chậm'}` : '';
    const total = cycleTime(def, slot);
    const frozen = isFrozen(ctx, slot.type);
    const status =
      slot.stage === 'ready'
        ? `<div class="row"><span class="grow">✅ Đã chín - thu được ${yieldsText(game, slot, def)}</span><button class="primary"${cmd({ type: 'farmer/do', kind: 'harvest', slotId: slot.id })}${queued.includes('harvest') ? ' disabled' : ''}>Thu hoạch</button></div>`
        : `<div class="row"><div class="grow">${bar(slot.progress / total, 'green')}<div class="muted">${frozen ? '❄️ Đang nghỉ đông' : `còn ${farmTime(total - slot.progress)}`}</div></div>${
            needsWatering(ctx, slot) && !frozen ? `<button class="water"${cmd({ type: 'farmer/do', kind: 'water', slotId: slot.id })}${queued.includes('water') ? ' disabled' : ''}>💧 Tưới</button>` : ''
          }</div>`;
    return `<div class="card">${head}<div class="row"><span class="big">${def.icon}</span>
      <div class="grow"><b>${esc(def.name)}</b><div class="muted">Cho ${yieldsText(game, slot, def)} · ${repeat}${moisture}${def.diesInWinter ? ' · hết lứa khi sang mùa Đông' : ''}</div></div>
      <button class="danger"${cmd({ type: 'farmer/do', kind: 'clear', slotId: slot.id })}>Dọn ô</button></div>${status}${upgrade}</div>`;
  }
  if (type.needsTilling && !slot.tilled) {
    return `<div class="card">${head}<div class="row"><span class="big">⛏️</span>
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
      return `<div class="row seed-row${inSeason ? '' : ' off-season'}" data-key="${p.id}"><span class="big">${p.icon}</span>
        <div class="grow"><b>${esc(p.name)}</b> ${seasonTag}
          <div class="muted">${farmTime(p.growTime)} → ${yieldsText(game, slot, p)}${p.cycles === 1 ? '' : `, rồi ${farmTime(p.regrowTime ?? p.growTime)} một lứa`}${p.diesInWinter ? ' · tới mùa Đông hết lứa' : ''}</div></div>
        ${btn}</div>`;
    })
    .join('');
  // Giống gieo lần trước lên đầu danh sách (trồng lại nhanh)
  return `<div class="card">${head}<b>Chọn thứ để trồng / nuôi</b>${options}${upgrade}</div>`;
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
    slots.length >= type.max || type.perTier
      ? ''
      : `<button class="mini"${cmd({ type: 'farm/buySlot', slotType: type.id })}${levelOk && state.money >= price ? '' : ' disabled'}>${levelOk ? `${type.building ? `+ Nới dài nhà (thêm ${type.batch} luống)` : '+ Thêm ô'} · ${coins(price)}` : `🔒 Cấp ${type.level}`}</button>`;
  const detail = selected && selected.type === type.id ? slotDetail(game, selected) : '';
  const note = type.building
    ? '<p class="muted">Trong nhà kính: không cần cuốc, có tưới nhỏ giọt, cây lớn nhanh hơn 30%. Bấm vào nhà kính trên nông trại để vào trong.</p>'
    : type.mill ? `<p class="muted">Bấm thu hoạch là xong: bác lái máy cày thu, tự gieo lại và chở lúa tới ${esc(game.content.mills.get(type.mill).name.toLowerCase())}.</p>`
    : type.perTier ? `<p class="muted">Mỗi góc ao nuôi một loại (${slots.length}/${type.max} loại). Nới rộng ao để nuôi thêm ${type.perTier} loại. Bấm vào góc ao trên nông trại để thả giống.</p>` : '';
  // Không còn lưới ô: người chơi bấm thẳng ô trên cảnh 3D (bảng tự hiện chi tiết ô đó). Ở đây chỉ tóm tắt số ô.
  const n = (f: (s: FarmSlot) => boolean) => slots.filter(f).length;
  const ready = n((s) => !!s.producerId && s.stage === 'ready');
  const growing = n((s) => !!s.producerId && s.stage === 'growing');
  const dry = n((s) => !!s.producerId && s.stage === 'growing' && needsWatering(ctx, s) && !isFrozen(ctx, s.type));
  const empty = n((s) => !s.producerId);
  const sum = [ready && `✅ ${ready} chín`, growing && `🌱 ${growing} đang lớn`, dry && `💧 ${dry} cần tưới`, empty && `${empty} ô trống`].filter(Boolean).join(' · ');
  return `<div class="row"><h3 class="grow">${type.icon} ${esc(type.name)} (${slots.length}/${type.max})</h3>${buy}</div>${detail}
    <p class="muted slot-sum">${sum || 'Chưa có ô nào'}</p>${note}`;
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
      : '<span class="grow muted">🧑‍🌾 Bác nông dân đang rảnh - bấm ô để giao việc</span>';

    const winter = seasonOf(ctx).frozen
      ? '<p class="winter-note">❄️ Mùa đông: đất ngoài trời đóng băng, chuồng và ao nghỉ - cây ngoài trời ngừng lớn tới mùa Xuân. Nhà kính vẫn trồng bình thường.</p>'
      : '';
    return `${winter}${focusBar}${focus ? '' : '<p class="muted">👆 Bấm thẳng vào ô trên nông trại để cuốc, gieo, tưới, thu. Cây lớn tính bằng ngày (qua đêm vẫn lớn); tưới một lần ẩm cả ngày, trời mưa khỏi tưới. Ruộng lúa thu tự động bằng máy cày.</p>'}
      <div class="row farmer-status">${farmer}<button class="mini"${ui('drawer:farmhands')}>🧰 Nhà nông${state.farm.gardeners.length ? ` · ${state.farm.gardeners.length} 👩‍🌾` : ''}</button></div>
      <div class="row"><span class="grow"></span>
        <button${cmd({ type: 'farmer/doAll', kind: 'water' })}${anyDry ? '' : ' disabled'}>💧 Tưới hết</button>
        <button${cmd({ type: 'farmer/doAll', kind: 'harvest' })}${anyReady ? '' : ' disabled'}>Thu hoạch hết</button></div>${sections}`;
  },
};
