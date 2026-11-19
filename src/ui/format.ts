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

export function qty(n: number): string {
  return n === Infinity ? '∞' : String(n);
}
