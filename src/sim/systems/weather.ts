import { randRange, weightedIndex } from '../../core/rng';
import type { SimContext, System } from '../types';

/** Thời tiết đổi ngẫu nhiên theo thời gian; ảnh hưởng gameplay qua WeatherDef.effects (xem modifier() ở helpers.ts). */
export const weatherSystem: System = {
  id: 'weather',
  init: rollWeather,
  update(ctx, dt) {
    ctx.state.weather.minutesLeft -= dt;
    if (ctx.state.weather.minutesLeft <= 0) rollWeather(ctx);
  },
};

function rollWeather(ctx: SimContext): void {
  const { state, content } = ctx;
  const all = content.weathers.all();
  const def = all[weightedIndex(state.rng, all.map((w) => w.weight))];
  state.weather = { id: def.id, minutesLeft: randRange(state.rng, def.duration[0], def.duration[1]) };
  ctx.bus.emit('weather/changed', { id: def.id });
}
