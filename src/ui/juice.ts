import { CSS_BACK } from './ease';

/**
 * "JUICE" phía DOM: biểu tượng bay về HUD, phần tử nảy, chữ nổi, bộ đếm số chạy dần.
 * Thuần hình ảnh — không đọc/sửa state của game. app.ts quyết định khi nào gọi.
 */

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Lớp phủ chứa mọi phần tử bay; không nhận chuột để không chặn thao tác. */
export function fxLayer(root: HTMLElement): HTMLElement {
  const layer = document.createElement('div');
  layer.id = 'fx';
  root.appendChild(layer);
  return layer;
}

/** Nảy nhẹ một phần tử (vd số tiền khi tăng, nút Kho khi nhận hàng). */
export function bump(el: Element | null, strength = 1): void {
  if (!el || reduced()) return;
  const s = 1 + 0.22 * strength;
  el.animate([{ scale: '1' }, { scale: `${s}` }, { scale: '1' }], { duration: 320, easing: CSS_BACK });
}

export interface Point {
  x: number;
  y: number;
}

function centerOf(el: Element): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Biểu tượng bay theo đường cong từ `from` (toạ độ màn hình) về phần tử `to`.
 * Bay xong thì gọi `onArrive` (thường là bump đích).
 */
export function flyIcon(layer: HTMLElement, icon: string, from: Point, to: Element | null, opts: { delay?: number; size?: number; onArrive?: () => void } = {}): void {
  if (!to) return;
  if (reduced()) {
    opts.onArrive?.();
    return;
  }
  const el = document.createElement('span');
  el.className = 'fly';
  el.textContent = icon;
  el.style.fontSize = `${opts.size ?? 26}px`;
  layer.appendChild(el);

  const end = centerOf(to);
  // Đường Bézier bậc hai: điểm điều khiển nằm trên cao, lệch ngẫu nhiên chút cho đỡ đều
  const ctrl = { x: (from.x + end.x) / 2 + (Math.random() - 0.5) * 120, y: Math.min(from.y, end.y) - 80 - Math.random() * 60 };
  const frames: Keyframe[] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * ctrl.x + t * t * end.x;
    const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * ctrl.y + t * t * end.y;
    // Phình to lúc đầu, nhỏ lại khi tới đích
    const scale = t < 0.15 ? 0.4 + (t / 0.15) * 0.9 : 1.3 - t * 0.7;
    frames.push({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`, opacity: t > 0.92 ? 0.6 : 1 });
  }
  const anim = el.animate(frames, { duration: 720, delay: opts.delay ?? 0, easing: 'cubic-bezier(0.45, 0, 0.7, 1)', fill: 'both' });
  anim.onfinish = () => {
    el.remove();
    opts.onArrive?.();
  };
}

/** Chữ nổi lên rồi mờ dần ngay dưới phần tử (vd "+38" dưới số tiền). */
export function floatText(layer: HTMLElement, text: string, near: Element | null, kind: 'good' | 'bad' = 'good'): void {
  if (!near || reduced()) return;
  const r = near.getBoundingClientRect();
  const el = document.createElement('span');
  el.className = `float-text ${kind}`;
  el.textContent = text;
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.top = `${r.bottom + 4}px`;
  layer.appendChild(el);
  const anim = el.animate(
    [
      { transform: 'translate(-50%, 6px) scale(0.6)', opacity: 0 },
      { transform: 'translate(-50%, 0) scale(1.15)', opacity: 1, offset: 0.2 },
      { transform: 'translate(-50%, 0) scale(1)', opacity: 1, offset: 0.6 },
      { transform: 'translate(-50%, 18px) scale(0.95)', opacity: 0 },
    ],
    { duration: 1300, easing: 'ease-out' },
  );
  anim.onfinish = () => el.remove();
}

/**
 * Số hiển thị chạy dần tới giá trị thật (tiền nhảy từng chút thay vì đổi phắt).
 * Gọi `step(target, dt)` mỗi khung hình; đọc `value` để vẽ.
 */
export class Counter {
  value: number;

  constructor(start: number) {
    this.value = start;
  }

  step(target: number, dt: number): number {
    const diff = target - this.value;
    if (Math.abs(diff) < 0.5) this.value = target;
    else {
      const move = Math.abs(diff) * Math.min(1, dt * 7) + dt * 20;
      this.value += Math.sign(diff) * Math.min(Math.abs(diff), move);
    }
    return Math.round(this.value);
  }
}
