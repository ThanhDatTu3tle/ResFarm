import * as THREE from 'three';
import type { Game } from '../../sim/game';
import { animatePerson } from './models';
import { makeOwner } from './people';
import { emojiSprite, textSprite } from './toon';

/**
 * ÔNG / BÀ CHỦ QUÁN đi dạo trong một khu (quán, chợ, nông trại): chọn chỗ ngẫu nhiên → đi chậm tới → đứng ngó quanh
 * vài giây → chọn chỗ khác. Chỉ là hình (không có trong sim), nên được dùng Math.random.
 * Toạ độ là mét trong `root` của khu. `pick()` trả chỗ muốn tới; `via(from, to)` (tuỳ chọn) trả điểm kế tiếp để
 * đi vòng vật cản (quán dùng nextWaypoint của sim).
 */
export interface Spot {
  x: number;
  z: number;
  /** Tới nơi thì quay mặt về hướng này (vd nhìn vào sạp). */
  face?: number;
}

export class OwnerWalker {
  readonly obj: THREE.Group;
  private target: Spot | null = null;
  private wait = 1 + Math.random() * 2;
  private lookPhase = Math.random() * 10;
  private face: number | null = null;
  /** Đứng yên tại chỗ (không tự đi dạo) - vd đang mua hàng trong sạp. */
  stay = false;
  /** Ngôi sao nhấp nhô trên đầu (khu nhìn xa: chợ, nông trại) để nhận ra chủ quán giữa đám đông. */
  private marker: THREE.Sprite | null = null;
  /** Tên ông / bà chủ lơ lửng trên đầu. */
  private label: THREE.Sprite;
  private key: string;

  constructor(
    private game: Game,
    private parent: THREE.Object3D,
    start: Spot,
    private pick: () => Spot,
    private via: (from: Spot, to: Spot) => Spot = (_f, t) => t,
    private speed = 0.7,
    private scale = 1.1,
  ) {
    this.key = ownerKey(game);
    this.obj = makeOwner(game.state.owner);
    this.obj.scale.setScalar(scale);
    this.obj.position.set(start.x, 0, start.z);
    parent.add(this.obj);
    this.label = this.makeLabel();
  }

  private makeLabel(): THREE.Sprite {
    const name = this.game.state.owner.name;
    const s = textSprite(name || ' ', '#8a3a2a', 0.55 * this.scale);
    s.visible = !!name;
    this.parent.add(s);
    return s;
  }

  /** Bật ngôi sao trên đầu. */
  withMarker(size = 0.8): this {
    this.marker = emojiSprite('⭐', size);
    this.parent.add(this.marker);
    return this;
  }

  /** Đưa tới chỗ mới ngay (vd vào sạp). */
  place(p: Spot, face = 0): void {
    this.obj.position.set(p.x, 0, p.z);
    this.obj.rotation.y = face;
    this.target = null;
    this.face = null;
  }

  /** Đi tới `p` rồi đứng đó (`wait` giây) trước khi đi dạo tiếp. */
  goTo(p: Spot, wait = 6): void {
    this.target = p;
    this.wait = wait;
    this.face = null;
  }

  private arrive(): void {
    this.face = this.target?.face ?? null;
    this.target = null;
  }

  update(t: number, dt: number, pose: { reach?: number } = {}): void {
    // Đổi giới tính / tuổi (ván mới) thì dựng lại model
    if (this.key !== ownerKey(this.game)) {
      this.key = ownerKey(this.game);
      const p = this.obj.position.clone();
      const r = this.obj.rotation.y;
      this.parent.remove(this.obj);
      this.parent.remove(this.label);
      this.label = this.makeLabel();
      Object.assign(this, { obj: makeOwner(this.game.state.owner) });
      this.obj.scale.setScalar(this.scale);
      this.obj.position.copy(p);
      this.obj.rotation.y = r;
      this.parent.add(this.obj);
    }
    const o = this.obj.position;
    let walking = false;
    if (this.target) {
      const step = this.via({ x: o.x, z: o.z }, this.target);
      const dx = step.x - o.x;
      const dz = step.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.03) this.arrive(); // tới nơi (hoặc kẹt: chọn chỗ khác)
      else {
        const move = Math.min(d, this.speed * dt);
        o.x += (dx / d) * move;
        o.z += (dz / d) * move;
        // Quay dần về hướng đi
        const want = Math.atan2(dx, dz);
        let diff = want - this.obj.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.obj.rotation.y += diff * Math.min(1, dt * 6);
        walking = true;
        if (Math.hypot(this.target.x - o.x, this.target.z - o.z) < 0.05) this.arrive();
      }
    } else {
      // Đứng ngó quanh (hoặc quay về phía sạp vừa tới), hết giờ thì chọn chỗ mới
      this.wait -= dt;
      if (this.face != null) {
        const want = this.face + Math.sin(t * 0.4 + this.lookPhase) * 0.2;
        let diff = want - this.obj.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.obj.rotation.y += diff * Math.min(1, dt * 3);
      } else this.obj.rotation.y += Math.sin(t * 0.5 + this.lookPhase) * dt * 0.25;
      if (this.wait <= 0 && !this.stay) {
        this.face = null;
        this.target = this.pick();
        this.wait = 2.5 + Math.random() * 4;
      }
    }
    animatePerson(this.obj, t, { walk: walking ? 0.55 : 0, reach: walking ? 0 : pose.reach ?? 0 });
    this.label.position.set(o.x, 1.95 * this.scale, o.z);
    if (this.marker) this.marker.position.set(o.x, 2.45 * this.scale + Math.abs(Math.sin(t * 2.2)) * 0.15, o.z);
  }
}

function ownerKey(game: Game): string {
  const o = game.state.owner;
  return `${o.gender}:${o.age}:${o.name}:${o.hair}:${o.outfit}`;
}

/** Điểm ngẫu nhiên trong hình chữ nhật. */
export function randIn(x1: number, x2: number, z1: number, z2: number): Spot {
  return { x: x1 + Math.random() * (x2 - x1), z: z1 + Math.random() * (z2 - z1) };
}
