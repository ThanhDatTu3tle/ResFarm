import { DAYS_PER_SEASON, festivals, seasons, type FestivalDef, type SeasonDef } from '../data/calendar';
import type { ProducerDef, RecipeDef, SlotType } from '../data';
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

/** Ngày lễ rơi vào ngày `day` của ván (ngày 1 = khai trương, không tính lễ). */
export function festivalOf(day: number): FestivalDef | null {
  if (day <= 1) return null;
  const c = calendarOf(day);
  return festivals.find((f) => f.season === c.season && f.day === c.dayOfSeason) ?? null;
}

/** Lễ hội sắp tới trong vòng `within` ngày tới (kể cả hôm nay): lễ + còn mấy ngày. */
export function nextFestival(day: number, within = DAYS_PER_SEASON): { def: FestivalDef; inDays: number } | null {
  for (let i = 0; i <= within; i++) {
    const def = festivalOf(day + i);
    if (def) return { def, inDays: i };
  }
  return null;
}

/** Giống này gieo / thả ở loại ô này vào hôm nay được không (mùa vụ + mùa Đông đóng băng; nhà kính quanh năm). */
export function canPlantNow(ctx: SimContext, def: ProducerDef, type: SlotType): boolean {
  if (ctx.content.slotTypes.get(type).building) return true;
  if (isFrozen(ctx, type)) return false;
  return !def.seasons || def.seasons.includes(calendarOf(ctx.state.clock.day).season);
}

/** Tên các mùa trồng được, vd "Xuân, Thu". */
export function seasonNames(list: number[]): string {
  return list.map((i) => seasons[i]?.name ?? '?').join(', ');
}

/**
 * Hệ số giá chợ theo mùa của một nguyên liệu: chỉ tính nguyên liệu do cây trồng theo mùa làm ra.
 * Có giống đang đúng mùa → rẻ hơn; có giống theo mùa mà không giống nào đúng mùa → đắt hơn; còn lại giữ nguyên.
 */
export function seasonPriceFactor(ctx: SimContext, itemId: string): number {
  const growers = ctx.content.producers.all().filter((p) => p.seasons && p.yields.some((y) => y.item === itemId));
  if (!growers.length) return 1;
  const season = calendarOf(ctx.state.clock.day).season;
  const b = ctx.content.balance.seasons;
  return growers.some((p) => p.seasons!.includes(season)) && season !== 3 ? b.inSeasonPrice : b.offSeasonPrice;
}

/** Món đang đúng mùa (bán đắt hơn). */
export function isSeasonalDish(ctx: SimContext, r: RecipeDef): boolean {
  return !!r.seasons?.includes(calendarOf(ctx.state.clock.day).season);
}

/** Giá bán một phần món hôm nay (giá gốc × món hợp mùa; hệ số chung `dishPrice` nhân riêng). */
export function seasonalPrice(ctx: SimContext, r: RecipeDef): number {
  return Math.round(r.price * (isSeasonalDish(ctx, r) ? ctx.content.balance.seasons.dishBonus : 1));
}
