import { FARM_DAY } from '../data/farm';
export function coins(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')} <i class="coin" aria-hidden="true"></i>`;
}

/** Phút trong ngày -> "HH:MM". */
export function clockText(minute: number): string {
  const m = Math.floor(minute) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Thời lượng phút game -> "2g 30p". */
export function duration(minutes: number): string {
  const m = Math.max(0, Math.ceil(minutes));
  if (m < 60) return `${m}p`;
  return m % 60 ? `${Math.floor(m / 60)}g ${m % 60}p` : `${m / 60}g`;
}

/**
 * Thời gian nông trại theo NGÀY (cây / con lớn nhiều ngày): "1 ngày", "2,5 ngày"; dưới 1 ngày thì "~0,4 ngày".
 * 1 ngày = `FARM_DAY` phút game (cả ngày mở cửa + phần qua đêm). Thời gian ngắn (cối xay) vẫn dùng duration().
 */
export function farmTime(minutes: number): string {
  const d = Math.max(0, minutes) / FARM_DAY;
  if (d >= 2) return `${(Math.round(d * 2) / 2).toLocaleString('vi-VN')} ngày`;
  if (d >= 0.95) return `${(Math.round(d * 10) / 10).toLocaleString('vi-VN')} ngày`;
  return `~${Math.max(0.1, Math.round(d * 10) / 10).toLocaleString('vi-VN')} ngày`;
}

export function qty(n: number): string {
  return n === Infinity ? '∞' : String(n);
}
