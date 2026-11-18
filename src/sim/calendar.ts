import { DAYS_PER_SEASON, seasons } from '../data/calendar';

export interface CalendarDate {
  /** 0 = Thứ Hai … 6 = Chủ Nhật. */
  weekday: number;
  /** 1..DAYS_PER_SEASON */
  dayOfSeason: number;
  /** Chỉ số trong `seasons`. */
  season: number;
  /** Bắt đầu từ 1. */
  year: number;
}

/** Ngày thứ `day` của game (bắt đầu từ 1) ứng với ngày nào trong lịch. Hàm thuần, không đọc state. */
export function calendarOf(day: number): CalendarDate {
  const d = Math.max(0, Math.floor(day) - 1);
  const seasonIndex = Math.floor(d / DAYS_PER_SEASON);
  return {
    weekday: d % 7,
    dayOfSeason: (d % DAYS_PER_SEASON) + 1,
    season: seasonIndex % seasons.length,
    year: Math.floor(seasonIndex / seasons.length) + 1,
  };
}
