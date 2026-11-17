/**
 * Hàm easing và đường cong "nảy" dùng chung cho hiệu ứng DOM lẫn cảnh 3D.
 * Mọi hàm nhận t trong 0..1 (hoặc số giây đã trôi với các hàm *Kick) và trả hệ số.
 */

export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export const easeOutCubic = (t: number) => 1 - (1 - clamp01(t)) ** 3;

/** Vọt quá rồi lùi về — hợp với thứ "bật" ra (cây mới gieo, biểu tượng xuất hiện). */
export function easeOutBack(t: number, overshoot = 1.9): number {
  const x = clamp01(t) - 1;
  return 1 + (overshoot + 1) * x ** 3 + overshoot * x ** 2;
}

/** Nảy như lò xo — hợp với cây vừa chín. */
export function easeOutElastic(t: number): number {
  const x = clamp01(t);
  if (x === 0 || x === 1) return x;
  return 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
}

/**
 * Dao động tắt dần quanh 0, dùng cho squash & stretch: biên độ 1 lúc đầu, về 0 sau khoảng `duration` giây.
 * Nhân với độ mạnh rồi cộng vào scale.
 */
export function wobble(seconds: number, duration = 0.5, freq = 22): number {
  if (seconds < 0 || seconds > duration) return 0;
  return Math.exp((-seconds / duration) * 5) * Math.cos(seconds * freq);
}

/** Đường cong CSS tương đương easeOutBack, cho Web Animations / transition. */
export const CSS_BACK = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
