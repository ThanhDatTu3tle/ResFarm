import type { WeatherDef } from './types';

/** Thêm kiểu thời tiết: thêm 1 mục ở đây. Mục đầu tiên là thời tiết mặc định. */
export const weathers: WeatherDef[] = [
  { id: 'sunny', name: 'Nắng đẹp', icon: '☀️', weight: 45, duration: [180, 420], effects: { spawnRate: 1.1 }, visual: { rain: 0, clouds: 0.25, wind: 0.2, dim: 0 } },
  { id: 'cloudy', name: 'Nhiều mây', icon: '⛅', weight: 22, duration: [120, 300], visual: { rain: 0, clouds: 0.8, wind: 0.3, dim: 0.2 } },
  { id: 'windy', name: 'Gió lớn', icon: '🍃', weight: 15, duration: [120, 240], effects: { spawnRate: 0.95 }, visual: { rain: 0, clouds: 0.5, wind: 1, dim: 0.05 } },
  { id: 'rain', name: 'Mưa', icon: '🌧️', weight: 18, duration: [120, 300], effects: { growSpeed: 1.3, spawnRate: 0.8 }, wetsSoil: true, visual: { rain: 1, clouds: 1, wind: 0.5, dim: 0.4 } },
];
