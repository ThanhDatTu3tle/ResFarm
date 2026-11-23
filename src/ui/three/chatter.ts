import * as THREE from 'three';
import { seeded, speechSprite } from './toon';

/**
 * Lời thoại lâu lâu bật lên trên đầu một nhân vật (người bán rao hàng, đầu bếp đang xào, bác bảo vệ...).
 * Mỗi lần nói một câu chọn ngẫu nhiên (không lặp câu vừa nói), hiện ~3.5 giây rồi im 5–11 giây. Chỉ là hình ảnh,
 * không đụng sim. Khu gọi `update(t)` mỗi khung hình; `active = false` thì im (vd đầu bếp rảnh tay, đội đi vắng).
 */
export class Chatter {
  private bubble: THREE.Sprite | null = null;
  private shownAt = 0;
  private next: number;
  private last = -1;
  private rnd: () => number;

  constructor(
    private host: THREE.Object3D,
    private lines: readonly string[],
    /** Độ cao mũi bong bóng trong toạ độ của host (trên đỉnh đầu). */
    private height: number,
    seed: number,
    /** Chiều cao một dòng chữ (m, trước khi nhân scale của host). */
    private size = 0.2,
    private hold = 3.5,
  ) {
    this.rnd = seeded(seed * 7919 + 13);
    this.next = 1 + this.rnd() * 6; // các nhân vật không nói cùng lúc
  }

  update(t: number, active = true): void {
    if (!this.lines.length) return;
    if (this.bubble && (t - this.shownAt > this.hold || !active)) {
      this.host.remove(this.bubble);
      this.bubble.material.dispose();
      this.bubble = null;
      this.next = t + 5 + this.rnd() * 6;
    }
    if (!this.bubble && active && t >= this.next) {
      let i = Math.floor(this.rnd() * this.lines.length);
      if (i === this.last && this.lines.length > 1) i = (i + 1) % this.lines.length;
      this.last = i;
      this.bubble = speechSprite(this.lines[i], this.size);
      this.bubble.position.y = this.height;
      this.bubble.userData.base = this.bubble.scale.clone();
      this.host.add(this.bubble);
      this.shownAt = t;
    }
    if (this.bubble) {
      // Bật ra (nảy nhẹ) lúc mới hiện, thu lại trước khi tắt
      const age = t - this.shownAt;
      const pop = Math.min(1, age / 0.18);
      const k = (1 + Math.sin(pop * Math.PI) * 0.12) * pop * Math.min(1, (this.hold - age) / 0.2 + 0.2);
      this.bubble.scale.copy(this.bubble.userData.base as THREE.Vector3).multiplyScalar(Math.max(0.01, k));
    }
  }
}

/** Câu than đói buổi sáng của người tối qua không được ăn (crew.hungry). */
export const HUNGRY_LINES = ['Đói bụng quá…', 'Tối qua chưa được ăn gì hết 😢', 'Mệt rã rời, bụng réo nãy giờ…', 'Có gì lót dạ không chủ ơi?', 'Đói run cả tay luôn nè…'];

/**
 * Bong bóng than đói trên đầu một người trong đội: chỉ buổi sáng (tới HUNGRY_UNTIL phút sau giờ mở ca đầu) và chỉ khi
 * người đó có trong crew.hungry, đang có mặt, không xỉu. Chatter tạo lần đầu cần tới, giữ trong host.userData.
 */
export function updateHunger(host: THREE.Object3D, active: boolean, t: number, seed: number, height = 2.6): void {
  let c = host.userData.hungerTalk as Chatter | undefined;
  if (!c) {
    if (!active) return;
    c = new Chatter(host, HUNGRY_LINES, height, 300 + seed, 0.19);
    host.userData.hungerTalk = c;
  }
  c.update(t, active);
}

/** Than đói tới bao lâu sau giờ mở ca đầu (phút game) — 07:00 → 09:00. */
export const HUNGRY_UNTIL = 120;
