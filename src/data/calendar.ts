/**
 * LỊCH trong game: ngày 1 là Thứ Hai, mùng 1 mùa Xuân năm 1. Mỗi mùa 28 ngày (4 tuần), 4 mùa một năm.
 * Thời tiết theo mùa (`WeatherDef.seasonWeights`), mùa đông đóng băng đất ngoài trời (`frozen`), tổng kết mùa / năm.
 */

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
