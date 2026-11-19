import { DAYS_PER_SEASON, seasons, type SeasonDef } from '../data/calendar';
import type { SlotType } from '../data';
import type { SimContext } from './types';

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

/** Mùa của ngày đang chơi. */
export function seasonOf(ctx: SimContext): SeasonDef {
  return seasons[calendarOf(ctx.state.clock.day).season];
}

/** Ô loại này đang bị đóng băng (mùa đông, ở ngoài trời — nhà kính không tính). */
export function isFrozen(ctx: SimContext, type: SlotType): boolean {
  return !!seasonOf(ctx).frozen && !ctx.content.slotTypes.get(type).building;
}

/** Ngày cuối mùa / cuối năm (để hiện tổng kết). */
export function isSeasonEnd(day: number): boolean {
  return calendarOf(day).dayOfSeason === DAYS_PER_SEASON;
}
export function isYearEnd(day: number): boolean {
  const c = calendarOf(day);
  return c.dayOfSeason === DAYS_PER_SEASON && c.season === seasons.length - 1;
}
