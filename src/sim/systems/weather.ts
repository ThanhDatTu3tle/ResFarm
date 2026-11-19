import { rand, randRange, weightedIndex } from '../../core/rng';
import type { SimContext, System } from '../types';
import { calendarOf } from '../calendar';
import type { WeatherDef } from '../../data';

/** Thời tiết đổi ngẫu nhiên theo thời gian; ảnh hưởng gameplay qua WeatherDef.effects (xem modifier() ở helpers.ts). */
export const weatherSystem: System = {
  id: 'weather',
  init: rollWeather,
  update(ctx, dt) {
    ctx.state.weather.minutesLeft -= dt;
    if (ctx.state.weather.minutesLeft <= 0) rollWeather(ctx);
  },
  // Sang mùa mới mà thời tiết đang có không hợp mùa (mưa sang đông, tuyết sang xuân) thì đổi ngay
  onDayStart(ctx) {
    if (!weightOf(ctx, ctx.content.weathers.get(ctx.state.weather.id))) rollWeather(ctx);
  },
};

/** Trọng số của thời tiết này trong mùa hiện tại. */
function weightOf(ctx: SimContext, w: WeatherDef): number {
  return w.seasonWeights?.[calendarOf(ctx.state.clock.day).season] ?? w.weight;
}

function rollWeather(ctx: SimContext): void {
  const { state, content } = ctx;
  const all = content.weathers.all();
  const def = all[weightedIndex(state.rng, all.map((w) => weightOf(ctx, w)))];
  state.weather = { id: def.id, minutesLeft: randRange(state.rng, def.duration[0], def.duration[1]) };
  ctx.bus.emit('weather/changed', { id: def.id });
  if (def.damage) stormDamage(ctx, def.damage);
}

/** Bão quét qua: mỗi ô rau / lúa ngoài trời đang lớn có xác suất `chance` bị dập, mất nửa tiến độ (nhà kính không sao). */
function stormDamage(ctx: SimContext, chance: number): void {
  const { state, content } = ctx;
  let damaged = 0;
  for (const slot of state.farm.slots) {
    const type = content.slotTypes.get(slot.type);
    if (!slot.producerId || slot.stage !== 'growing' || type.building || !type.needsTilling && !type.mill) continue;
    if (rand(state.rng) >= chance) continue;
    slot.progress *= 0.5;
    damaged++;
  }
  if (damaged) ctx.bus.emit('farm/storm', { damaged });
}
