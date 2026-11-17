import type { ProducerDef, SlotType } from '../../data';
import { addItem, modifier, spend } from '../helpers';
import { createSlot, type FarmSlot } from '../state';
import { fail, ok, type CommandResult, type SimContext, type System } from '../types';

/** Nông trại: các ô (ruộng/chuồng/ao) chứa producer lớn dần theo thời gian rồi cho thu hoạch. */
export const farmSystem: System = {
  id: 'farm',
  update(ctx, dt) {
    grow(ctx, dt);
  },
  onDayStart(ctx) {
    grow(ctx, ctx.content.balance.nightMinutes);
  },
  commands: {
    'farm/plant'(ctx, cmd) {
      const slot = findSlot(ctx, cmd.slotId);
      if (!slot) return fail('Không tìm thấy ô.');
      if (slot.producerId) return fail('Ô này đang được dùng.');
      if (!ctx.content.producers.has(cmd.producerId)) return fail('Không có giống này.');
      const def = ctx.content.producers.get(cmd.producerId);
      if (def.slot !== slot.type) return fail(`${def.name} không hợp với loại ô này.`);
      if (ctx.state.level < def.level) return fail(`Cần cấp ${def.level}.`);
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
      clearSlot(slot);
      return ok();
    },
    'farm/buySlot'(ctx, cmd) {
      const def = ctx.content.slotTypes.get(cmd.slotType);
      const owned = slotsOfType(ctx, cmd.slotType).length;
      if (ctx.state.level < def.level) return fail(`Cần cấp ${def.level}.`);
      if (owned >= def.max) return fail('Đã đạt số ô tối đa.');
      if (!spend(ctx, slotPrice(ctx, cmd.slotType))) return fail('Không đủ tiền.');
      // Ô chỉ được thêm, không bao giờ bị xoá, nên `owned` là chỉ số duy nhất.
      ctx.state.farm.slots.push(createSlot(cmd.slotType, owned));
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
  const bought = Math.max(0, slotsOfType(ctx, type).length - def.initial);
  return Math.round(def.basePrice * Math.pow(def.priceGrowth, bought));
}

/** Thời gian của chu kỳ hiện tại (lần đầu là growTime, các lần sau là regrowTime). */
export function cycleTime(def: ProducerDef, slot: FarmSlot): number {
  return slot.cyclesDone === 0 ? def.growTime : (def.regrowTime ?? def.growTime);
}

function findSlot(ctx: SimContext, id: string): FarmSlot | undefined {
  return ctx.state.farm.slots.find((s) => s.id === id);
}

function clearSlot(slot: FarmSlot): void {
  Object.assign(slot, { producerId: null, stage: 'growing', progress: 0, cyclesDone: 0 });
}

function grow(ctx: SimContext, minutes: number): void {
  const amount = minutes * modifier(ctx, 'growSpeed');
  for (const slot of ctx.state.farm.slots) {
    if (!slot.producerId || slot.stage !== 'growing') continue;
    slot.progress += amount;
    if (slot.progress >= cycleTime(ctx.content.producers.get(slot.producerId), slot)) {
      slot.stage = 'ready';
      ctx.bus.emit('farm/ready', { slotId: slot.id });
    }
  }
}

function harvest(ctx: SimContext, slot: FarmSlot): CommandResult {
  if (!slot.producerId || slot.stage !== 'ready') return fail('Chưa thu hoạch được.');
  const def = ctx.content.producers.get(slot.producerId);
  for (const y of def.yields) addItem(ctx, y.item, y.qty);
  slot.cyclesDone++;
  if (def.cycles !== 'infinite' && slot.cyclesDone >= def.cycles) clearSlot(slot);
  else Object.assign(slot, { stage: 'growing', progress: 0 });
  return ok();
}
