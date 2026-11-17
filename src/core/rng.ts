/**
 * RNG có seed (mulberry32). Trạng thái nằm trong GameState nên mô phỏng
 * tất định: cùng seed + cùng chuỗi lệnh => cùng kết quả (dễ test, dễ replay).
 * KHÔNG dùng Math.random() trong src/sim.
 */
export interface RngState {
  s: number;
}

export function rand(r: RngState): number {
  r.s = (r.s + 0x6d2b79f5) | 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(r: RngState, min: number, max: number): number {
  return min + rand(r) * (max - min);
}

/** Số nguyên trong [min, max] (bao gồm hai đầu). */
export function randInt(r: RngState, min: number, max: number): number {
  return min + Math.floor(rand(r) * (max - min + 1));
}

/** Chọn chỉ số theo trọng số. Trả -1 nếu tổng trọng số <= 0. */
export function weightedIndex(r: RngState, weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return -1;
  let roll = rand(r) * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll < 0) return i;
  }
  return weights.length - 1;
}
