import * as THREE from 'three';
import { easeOutBack } from '../ease';
import { emojiSprite } from './toon';

/**
 * Hạt hiệu ứng dạng emoji trong cảnh 3D: bật ra, bay theo vận tốc + trọng lực, phình rồi mờ dần.
 * Mỗi khu giữ một Particles và gọi update(dt) mỗi khung hình.
 */

interface Particle {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  gravity: number;
  age: number;
  life: number;
  size: number;
  delay: number;
}

export interface BurstOpts {
  /** Số hạt. */
  count?: number;
  /** Tốc độ bung ngang (m/giây). */
  spread?: number;
  /** Tốc độ bay lên (m/giây). */
  up?: number;
  /** Gia tốc rơi (m/giây²); âm thì bay lên dần. */
  gravity?: number;
  life?: number;
  size?: number;
  /** Giãn cách xuất hiện giữa các hạt (giây). */
  stagger?: number;
}

export class Particles {
  private items: Particle[] = [];

  constructor(private parent: THREE.Object3D) {}

  /** Bung `count` hạt `icon` từ `at` (toạ độ trong `parent`). */
  burst(icon: string, at: THREE.Vector3, o: BurstOpts = {}): void {
    const count = o.count ?? 5;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.8;
      const spread = (o.spread ?? 1.2) * (0.6 + Math.random() * 0.4);
      const sprite = emojiSprite(icon, 0.001);
      sprite.position.copy(at);
      sprite.renderOrder = 12;
      sprite.material.depthTest = false;
      this.parent.add(sprite);
      this.items.push({
        sprite,
        vel: new THREE.Vector3(Math.cos(angle) * spread, (o.up ?? 3) * (0.8 + Math.random() * 0.4), Math.sin(angle) * spread),
        gravity: o.gravity ?? 9,
        age: 0,
        life: o.life ?? 0.8,
        size: (o.size ?? 0.45) * (0.85 + Math.random() * 0.3),
        delay: i * (o.stagger ?? 0),
      });
    }
  }

  update(dt: number): void {
    for (const p of this.items) {
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.age += dt;
      p.vel.y -= p.gravity * dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      const k = p.age / p.life;
      // Bật to nhanh trong 30% đầu, giữ, rồi co lại lúc cuối
      const grow = easeOutBack(Math.min(1, k / 0.3));
      const shrink = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      p.sprite.scale.setScalar(Math.max(0.001, p.size * grow * shrink));
      p.sprite.material.opacity = shrink;
    }
    for (const p of this.items) {
      if (p.age < p.life) continue;
      this.parent.remove(p.sprite);
      p.sprite.material.dispose(); // texture emoji dùng chung, không dispose
    }
    this.items = this.items.filter((p) => p.age < p.life);
  }
}
