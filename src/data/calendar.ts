/**
 * LỊCH trong game: ngày 1 là Thứ Hai, mùng 1 mùa Xuân năm 1. Mỗi mùa 28 ngày (4 tuần), 4 mùa một năm.
 * Hiện mới dùng để hiển thị; về sau món theo mùa / thời tiết theo mùa đọc từ đây (roadmap C6).
 */

export const DAYS_PER_SEASON = 28;

export interface SeasonDef {
  id: string;
  name: string;
  icon: string;
}

export const seasons: SeasonDef[] = [
  { id: 'spring', name: 'Xuân', icon: '🌸' },
  { id: 'summer', name: 'Hạ', icon: '🌻' },
  { id: 'autumn', name: 'Thu', icon: '🍁' },
  { id: 'winter', name: 'Đông', icon: '⛄' },
];

/** Tên ngắn và tên đầy đủ của thứ trong tuần, bắt đầu từ Thứ Hai. */
export const weekdays: { short: string; name: string }[] = [
  { short: 'T2', name: 'Thứ Hai' },
  { short: 'T3', name: 'Thứ Ba' },
  { short: 'T4', name: 'Thứ Tư' },
  { short: 'T5', name: 'Thứ Năm' },
  { short: 'T6', name: 'Thứ Sáu' },
  { short: 'T7', name: 'Thứ Bảy' },
  { short: 'CN', name: 'Chủ Nhật' },
];
