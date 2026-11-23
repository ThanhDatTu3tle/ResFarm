import { fitsSlot, type ItemStack, type ProducerDef, type SlotType } from '../../data';
import { calendarOf, canPlantNow, isFrozen, seasonNames } from '../calendar';
import { addItem, modifier, spend } from '../helpers';
import { bumpQuest } from './quests';
import { createSlot, type FarmSlot } from '../state';
import { fail, ok, type CommandResult, type SimContext, type System } from '../types';

/**
 * Nông trại: các ô (ruộng/chuồng/ao) chứa producer lớn dần theo thời gian rồi cho thu hoạch.
 * Vòng đời một ô ruộng: chưa cuốc -> cuốc (tơi xốp) -> gieo -> tưới/hứng mưa -> lớn -> thu -> lại chưa cuốc.
 * Loại ô nào cần cuốc/tưới, nâng cấp được hay không là do SlotTypeDef quyết định (needsTilling, needsWater, tiers).
 */
/** Lời báo khi làm việc ngoài trời giữa mùa đông. */
export const FROZEN = 'Mùa đông đất ngoài trời đóng băng, chuồng ao nghỉ — chỉ trồng được trong nhà kính.';

/** Phút cuối cùng nông trại đã chạy trong ngày (kết thúc ngày sớm thì phần còn lại tới 24:00 được bù qua đêm). */
const lastMinute = new WeakMap<object, number>();

export const farmSystem: System = {
  id: 'farm',
  update(ctx, dt) {
    grow(ctx, dt);
    lastMinute.set(ctx.state, ctx.state.clock.minute);
  },
  onDayStart(ctx) {
    witherOffSeason(ctx);
    // Qua đêm: nightMinutes + phần ngày hôm qua bị bỏ qua (kết thúc ngày sớm) — để "1 ngày" luôn đủ một ngày nông trại
    const { closeMinute, nightMinutes } = ctx.content.balance;
    const last = lastMinute.get(ctx.state);
    grow(ctx, nightMinutes + (last != null ? Math.max(0, closeMinute - last) : 0));
  },
  commands: {
    'farm/till'(ctx, cmd) {
      const slot = findSlot(ctx, cmd.slotId);
      if (!slot) return fail('Không tìm thấy ô.');
      if (!ctx.content.slotTypes.get(slot.type).needsTilling) return fail('Ô này không cần cuốc.');
      if (slot.producerId) return fail('Ô đang có cây, không cuốc được.');
      if (slot.tilled) return fail('Đất đã tơi xốp rồi.');
      if (isFrozen(ctx, slot.type)) return fail(FROZEN);
      slot.tilled = true;
      return ok();
    },
    'farm/water'(ctx, cmd) {
      const slot = findSlot(ctx, cmd.slotId);
      if (!slot) return fail('Không tìm thấy ô.');
      if (!ctx.content.slotTypes.get(slot.type).needsWater) return fail('Ô này không cần tưới.');
      if (isFrozen(ctx, slot.type)) return fail(FROZEN);
      if (!needsWatering(ctx, slot)) return fail('Đất vẫn còn ẩm.');
      slot.wet = ctx.content.balance.farm.waterDuration;
      return ok();
    },
    'farm/waterAll'(ctx) {
      const dry = ctx.state.farm.slots.filter((s) => s.producerId && needsWatering(ctx, s) && !isFrozen(ctx, s.type));
      if (!dry.length) return fail('Không có cây nào cần tưới.');
      for (const slot of dry) slot.wet = ctx.content.balance.farm.waterDuration;
      return ok();
    },
    'farm/plant'(ctx, cmd) {
      const slot = findSlot(ctx, cmd.slotId);
      if (!slot) return fail('Không tìm thấy ô.');
      if (slot.producerId) return fail('Ô này đang được dùng.');
      if (!ctx.content.producers.has(cmd.producerId)) return fail('Không có giống này.');
      const def = ctx.content.producers.get(cmd.producerId);
      if (!fitsSlot(def, slot.type)) return fail(`${def.name} không hợp với loại ô này.`);
      if (isFrozen(ctx, slot.type)) return fail(FROZEN);
      if (!canPlantNow(ctx, def, slot.type)) return fail(`${def.name} chỉ trồng ngoài trời vào mùa ${seasonNames(def.seasons ?? [])} — trồng trong nhà kính thì quanh năm.`);
      if (ctx.content.slotTypes.get(slot.type).needsTilling && !slot.tilled) return fail('Đất chưa tơi xốp, cuốc đất trước đã.');
      if (ctx.state.level < def.level) return fail(`Cần cấp ${def.level}.`);
      // Ao chia ô nuôi: mỗi loại hải sản chỉ nuôi ở một ô
      if (ctx.content.slotTypes.get(slot.type).perTier && slotsOfType(ctx, slot.type).some((s) => s !== slot && s.producerId === def.id)) return fail(`Ao đã nuôi ${def.name.toLowerCase()} rồi, chọn loại khác nhé.`);
      if (!spend(ctx, def.cost)) return fail('Không đủ tiền.');
      Object.assign(slot, { producerId: def.id, lastProducerId: def.id, stage: 'growing', progress: 0, cyclesDone: 0 });
      return ok();
    },
    'farm/harvest'(ctx, cmd) {
      const slot = findSlot(ctx, cmd.slotId);
      if (!slot) return fail('Không tìm thấy ô.');
      return harvest(ctx, slot);
    },
    'farm/harvestAll'(ctx) {
      const ready = ctx.state.farm.slots.filter((s) => s.producerId && s.stage === 'ready');
      if (!ready.length) return fail('Chưa có gì để thu hoạch.');
      for (const slot of ready) harvest(ctx, slot);
      return ok();
    },
    'farm/clear'(ctx, cmd) {
      const slot = findSlot(ctx, cmd.slotId);
      if (!slot?.producerId) return fail('Ô đang trống.');
      clearSlot(ctx, slot);
      return ok();
    },
    'farm/buySlot'(ctx, cmd) {
      const def = ctx.content.slotTypes.get(cmd.slotType);
      const owned = slotsOfType(ctx, cmd.slotType).length;
      if (ctx.state.level < def.level) return fail(`Cần cấp ${def.level}.`);
      if (def.perTier) return fail(`Nới rộng ${def.name.toLowerCase()} để có thêm chỗ nuôi.`);
      if (owned >= def.max) return fail(def.building ? 'Nhà kính đã dài tối đa.' : 'Đã đạt số ô tối đa.');
      if (!spend(ctx, slotPrice(ctx, cmd.slotType))) return fail('Không đủ tiền.');
      // Ô chỉ được thêm, không bao giờ bị xoá, nên `owned` là chỉ số duy nhất. Loại mua theo lô thì thêm cả lô.
      const n = Math.min(def.batch ?? 1, def.max - owned);
      for (let i = 0; i < n; i++) ctx.state.farm.slots.push(createSlot(cmd.slotType, owned + i));
      return ok();
    },
    'farm/upgradeSlot'(ctx, cmd) {
      const slot = findSlot(ctx, cmd.slotId);
      if (!slot) return fail('Không tìm thấy ô.');
      const next = nextTier(ctx, slot);
      if (!next) return fail('Ô này đã lớn tối đa.');
      if (ctx.state.level < next.level) return fail(`Cần cấp ${next.level}.`);
      if (!spend(ctx, next.cost)) return fail('Không đủ tiền.');
      const def = ctx.content.slotTypes.get(slot.type);
      if (def.perTier) {
        // Ao: cả mặt ao lên bậc (mọi ô nuôi) + thêm ô nuôi mới
        const all = slotsOfType(ctx, slot.type);
        for (const s of all) s.tier++;
        const n = Math.min(def.perTier, def.max - all.length);
        for (let i = 0; i < n; i++) ctx.state.farm.slots.push({ ...createSlot(slot.type, all.length + i), tier: slot.tier });
      } else slot.tier++;
      return ok();
    },
  },
};

export function slotsOfType(ctx: SimContext, type: SlotType): FarmSlot[] {
  return ctx.state.farm.slots.filter((s) => s.type === type);
}

/** Giá mua ô kế tiếp của loại này. */
export function slotPrice(ctx: SimContext, type: SlotType): number {
  const def = ctx.content.slotTypes.get(type);
  const bought = Math.max(0, Math.floor((slotsOfType(ctx, type).length - def.initial) / (def.batch ?? 1)));
  return Math.round(def.basePrice * Math.pow(def.priceGrowth, bought));
}

/** Thời gian của chu kỳ hiện tại (lần đầu là growTime, các lần sau là regrowTime). */
export function cycleTime(def: ProducerDef, slot: FarmSlot): number {
  return slot.cyclesDone === 0 ? def.growTime : (def.regrowTime ?? def.growTime);
}

/** Bậc nâng cấp kế tiếp của ô (null nếu loại ô không nâng cấp được hoặc đã tối đa). */
export function nextTier(ctx: SimContext, slot: FarmSlot) {
  return ctx.content.slotTypes.get(slot.type).tiers?.[slot.tier - 1] ?? null;
}

/** Sản lượng thực tế của ô khi thu hoạch (đã nhân hệ số theo bậc của ô). */
export function yieldsOf(ctx: SimContext, slot: FarmSlot, def: ProducerDef): ItemStack[] {
  const mul = slot.tier > 1 ? (ctx.content.slotTypes.get(slot.type).tiers?.[slot.tier - 2]?.yieldMul ?? 1) : 1;
  return def.yields.map((y) => ({ item: y.item, qty: Math.round(y.qty * mul) }));
}

/** Ô thuộc loại cần tưới và đất đã gần khô. */
export function needsWatering(ctx: SimContext, slot: FarmSlot): boolean {
  return !!ctx.content.slotTypes.get(slot.type).needsWater && slot.wet < ctx.content.balance.farm.waterDuration * 0.25;
}

function findSlot(ctx: SimContext, id: string): FarmSlot | undefined {
  return ctx.state.farm.slots.find((s) => s.id === id);
}

function clearSlot(ctx: SimContext, slot: FarmSlot): void {
  Object.assign(slot, { producerId: null, stage: 'growing', progress: 0, cyclesDone: 0 });
  // Thu xong / dọn ô thì đất chai lại, phải cuốc mới gieo tiếp được.
  if (ctx.content.slotTypes.get(slot.type).needsTilling) slot.tilled = false;
}

/** Tiến `minutes` phút: mưa làm ẩm đất, đất khô dần, cây lớn (đất khô thì lớn chậm). */
function grow(ctx: SimContext, minutes: number): void {
  const { state, content } = ctx;
  const { waterDuration, dryGrowth } = content.balance.farm;
  const weather = content.weathers.get(state.weather.id);
  const raining = !!weather.wetsSoil;
  // Nắng nóng: đất khô nhanh gấp `dryRate` lần
  const dry = weather.dryRate ?? 1;
  const speed = modifier(ctx, 'growSpeed');

  for (const slot of state.farm.slots) {
    let moisture = 1;
    if (content.slotTypes.get(slot.type).needsWater) {
      if (raining) slot.wet = waterDuration;
      // Phần thời gian đất còn ẩm lớn bình thường, phần đã khô lớn chậm.
      const wetPart = Math.min(slot.wet / dry, minutes);
      moisture = (wetPart + (minutes - wetPart) * dryGrowth) / minutes;
      slot.wet = Math.max(0, slot.wet - minutes * dry);
    }
    // Mùa đông: ngoài trời đóng băng, cây và con vật ngừng lớn (nhà kính vẫn lớn)
    if (!slot.producerId || slot.stage !== 'growing' || isFrozen(ctx, slot.type)) continue;
    slot.progress += minutes * speed * moisture * (content.slotTypes.get(slot.type).growMul ?? 1);
    if (slot.progress >= cycleTime(content.producers.get(slot.producerId), slot)) {
      slot.stage = 'ready';
      ctx.bus.emit('farm/ready', { slotId: slot.id });
    }
  }
}

function harvest(ctx: SimContext, slot: FarmSlot): CommandResult {
  if (!slot.producerId || slot.stage !== 'ready') return fail('Chưa thu hoạch được.');
  const def = ctx.content.producers.get(slot.producerId);
  for (const y of yieldsOf(ctx, slot, def)) addItem(ctx, y.item, y.qty);
  bumpQuest(ctx, 'harvest');
  slot.cyclesDone++;
  if (def.cycles !== 'infinite' && slot.cyclesDone >= def.cycles) clearSlot(ctx, slot);
  else Object.assign(slot, { stage: 'growing', progress: 0 });
  return ok();
}

/**
 * Đầu mùa mới: cây theo mùa đang lớn ngoài trời mà trái mùa thì héo (ô trống lại, phải cuốc lại). Cây đã chín vẫn để thu.
 * Mùa Đông mọi rau / lúa đều trái mùa nên héo hết; cây ăn quả, vật nuôi, cá (không có `seasons`) chỉ ngừng lớn.
 */
function witherOffSeason(ctx: SimContext): void {
  const { state, content } = ctx;
  const cal = calendarOf(state.clock.day);
  if (cal.dayOfSeason !== 1 || state.clock.day <= 1) return;
  let count = 0;
  for (const slot of state.farm.slots) {
    if (!slot.producerId || slot.stage !== 'growing' || content.slotTypes.get(slot.type).building) continue;
    const def = content.producers.get(slot.producerId);
    if (!def.seasons || def.seasons.includes(cal.season)) continue;
    clearSlot(ctx, slot);
    count++;
  }
  if (count) ctx.bus.emit('farm/withered', { count });
  // Sang mùa Đông: gà mái đẻ, bò sữa hết lứa (nuôi cả năm) — ô trống lại, mùa Xuân nuôi lứa mới
  if (!isFrozen(ctx, 'pen')) return;
  let culled = 0;
  for (const slot of state.farm.slots) {
    if (!slot.producerId || !content.producers.get(slot.producerId).diesInWinter) continue;
    clearSlot(ctx, slot);
    culled++;
  }
  if (culled) ctx.bus.emit('farm/culled', { count: culled });
}
