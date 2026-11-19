/**
 * LỊCH trong game: ngày 1 là Thứ Hai, mùng 1 mùa Xuân năm 1. Mỗi mùa 28 ngày (4 tuần), 4 mùa một năm.
 * Thời tiết theo mùa (`WeatherDef.seasonWeights`), mùa đông đóng băng đất ngoài trời (`frozen`), tổng kết mùa / năm.
 */

import type { ModifierKey } from './types';

export const DAYS_PER_SEASON = 28;

export interface SeasonDef {
  id: string;
  name: string;
  icon: string;
  /** Đất ngoài trời đóng băng: không cuốc / gieo / nuôi, cây ngoài trời ngừng lớn (nhà kính vẫn trồng được). */
  frozen?: boolean;
}

export const seasons: SeasonDef[] = [
  { id: 'spring', name: 'Xuân', icon: '🌸' },
  { id: 'summer', name: 'Hạ', icon: '🌻' },
  { id: 'autumn', name: 'Thu', icon: '🍁' },
  { id: 'winter', name: 'Đông', icon: '⛄', frozen: true },
];

/** Tên ngắn và tên đầy đủ của thứ trong tuần, bắt đầu từ Thứ Hai. */
export const weekdays: { short: string; name: string }[] = [
  { short: 'Thứ 2', name: 'Thứ Hai' },
  { short: 'Thứ 3', name: 'Thứ Ba' },
  { short: 'Thứ 4', name: 'Thứ Tư' },
  { short: 'Thứ 5', name: 'Thứ Năm' },
  { short: 'Thứ 6', name: 'Thứ Sáu' },
  { short: 'Thứ 7', name: 'Thứ Bảy' },
  { short: 'Chủ Nhật', name: 'Chủ Nhật' },
];

/** Kiểu trang trí lễ hội trong cảnh quán + chợ (xem ui/three/festive.ts). */
export type FestivalDecor = 'tet' | 'lantern' | 'xmas' | 'bunting';

/** Ngày lễ: cố định theo lịch (mùa + ngày trong mùa). Hiệu ứng nhân vào `modifier()` cả ngày hôm đó. */
export interface FestivalDef {
  id: string;
  name: string;
  icon: string;
  /** Chỉ số mùa (0 Xuân … 3 Đông) và ngày trong mùa (1..28). */
  season: number;
  day: number;
  desc: string;
  effects?: Partial<Record<ModifierKey, number>>;
  /** Tiền mừng quán nhận đầu ngày (lì xì...). */
  gift?: number;
  decor: FestivalDecor;
}

/** Thêm ngày lễ: thêm 1 mục ở đây. Năm đầu khai trương đúng mùng 1 Tết nên ngày 1 của ván không tính lễ. */
export const festivals: FestivalDef[] = [
  { id: 'tet', name: 'Tết Nguyên Đán', icon: '🧧', season: 0, day: 1, desc: 'Khách du xuân đông, tip lì xì hậu hĩnh. Quán được lì xì đầu năm.', effects: { spawnRate: 1.5, tip: 1.5 }, gift: 200, decor: 'tet' },
  { id: 'phao_hoa', name: 'Lễ hội pháo hoa', icon: '🎆', season: 1, day: 20, desc: 'Cả phố đi xem pháo hoa: khách đông và vui vẻ, chịu chờ lâu hơn.', effects: { spawnRate: 1.4, patience: 1.15 }, decor: 'bunting' },
  { id: 'trung_thu', name: 'Tết Trung thu', icon: '🏮', season: 2, day: 15, desc: 'Rước đèn phá cỗ: khách đông, tip nhiều.', effects: { spawnRate: 1.4, tip: 1.3 }, decor: 'lantern' },
  { id: 'giang_sinh', name: 'Đêm Giáng sinh', icon: '🎄', season: 3, day: 24, desc: 'Khách đi chơi Noel ghé quán sưởi ấm, tip nhiều.', effects: { spawnRate: 1.4, tip: 1.4 }, decor: 'xmas' },
  { id: 'tat_nien', name: 'Tất niên', icon: '🎊', season: 3, day: 28, desc: 'Bữa cơm cuối năm: khách đông, tip rất hậu.', effects: { spawnRate: 1.3, tip: 1.6 }, decor: 'tet' },
];
