import type { WeatherDef } from './types';

/** Thêm kiểu thời tiết: thêm 1 mục ở đây. Mục đầu tiên là thời tiết mặc định. */
export const weathers: WeatherDef[] = [
  { id: 'sunny', name: 'Nắng đẹp', icon: '☀️', weight: 45, seasonWeights: [45, 60, 35, 30], duration: [180, 420], effects: { spawnRate: 1.1 }, visual: { rain: 0, clouds: 0.25, wind: 0.2, dim: 0 } },
  { id: 'cloudy', name: 'Nhiều mây', icon: '⛅', weight: 22, seasonWeights: [22, 15, 25, 30], duration: [120, 300], visual: { rain: 0, clouds: 0.8, wind: 0.3, dim: 0.2 } },
  { id: 'windy', name: 'Gió lớn', icon: '🍃', weight: 15, seasonWeights: [15, 8, 35, 12], duration: [120, 240], effects: { spawnRate: 0.95 }, visual: { rain: 0, clouds: 0.5, wind: 1, dim: 0.05 } },
  { id: 'rain', name: 'Mưa', icon: '🌧️', weight: 18, seasonWeights: [18, 17, 20, 0], duration: [120, 300], effects: { growSpeed: 1.3, spawnRate: 0.8 }, wetsSoil: true, visual: { rain: 1, clouds: 1, wind: 0.5, dim: 0.4 } },
  { id: 'snow', name: 'Tuyết rơi', icon: '❄️', weight: 0, seasonWeights: [0, 0, 0, 28], duration: [120, 300], effects: { spawnRate: 0.85 }, visual: { rain: 0, clouds: 0.9, wind: 0.3, dim: 0.25, snow: 1 } },
];
