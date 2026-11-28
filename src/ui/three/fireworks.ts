import * as THREE from 'three';

/**
 * PHÁO HOA (mừng quán lên hạng): quả pháo bay vút lên kéo vệt sáng, tới đỉnh thì nổ thành chùm tia màu
 * (tia toả đều theo mặt cầu, có lực cản + trọng lực, nhấp nháy rồi tắt dần), kèm vài tia lấp lánh rơi chậm.
 * Toàn bộ tia vẽ bằng một THREE.Points cộng màu (AdditiveBlending) nên nhẹ: mỗi hạt có vị trí, vận tốc, màu, tuổi.
 */

const MAX = 1600;
const PALETTE = [0xff5a5a, 0xffc23e, 0x6fe36f, 0x58c8ff, 0xd77bff, 0xff8ad1, 0xfff1b0];

interface Spark {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  r: number; g: number; b: number;
  age: number; life: number;
  drag: number; grav: number;
  /** Nhấp nháy (tia lấp lánh). */
  twinkle: boolean;
  /** Đang là quả pháo bay lên: tới hết đời thì nổ. */
  rocket?: { color: number; trail: number };
}

let dotTex: THREE.Texture | null = null;
/** Chấm sáng tròn mờ viền (texture cho từng hạt). */
function dot(): THREE.Texture {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

export class Fireworks {
  private sparks: Spark[] = [];
  private points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);

  constructor(parent: THREE.Object3D) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.PointsMaterial({ size: 0.55, map: dot(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 20;
    this.points.userData.keep = true;
    parent.add(this.points);
  }

  get busy(): boolean {
    return this.sparks.length > 0;
  }

  /** Bắn một quả từ mặt đất (x, z) lên độ cao `h`. */
  launch(x: number, z: number, h = 6, color = PALETTE[Math.floor(Math.random() * PALETTE.length)]): void {
    const t = 0.9 + Math.random() * 0.25;
    this.add({ x, y: 0.3, z, vx: (Math.random() - 0.5) * 0.6, vy: h / t + 4.9 * t * 0.5, vz: (Math.random() - 0.5) * 0.6, ...rgb(0xffe2a0), age: 0, life: t, drag: 0, grav: 4.9, twinkle: false, rocket: { color, trail: 0 } });
  }

  private explode(s: Spark, color: number): void {
    const n = 90 + Math.floor(Math.random() * 40);
    const speed = 4.2 + Math.random() * 1.6;
    const two = Math.random() < 0.4 ? PALETTE[Math.floor(Math.random() * PALETTE.length)] : color;
    for (let i = 0; i < n; i++) {
      // Hướng đều trên mặt cầu (Fibonacci) + lệch nhẹ
      const k = (i + 0.5) / n;
      const phi = Math.acos(1 - 2 * k);
      const th = Math.PI * (1 + Math.sqrt(5)) * i;
      const v = speed * (0.85 + Math.random() * 0.3);
      const c = rgb(i % 3 === 0 ? two : color);
      this.add({ x: s.x, y: s.y, z: s.z, vx: Math.sin(phi) * Math.cos(th) * v, vy: Math.cos(phi) * v, vz: Math.sin(phi) * Math.sin(th) * v, ...c, age: 0, life: 1.3 + Math.random() * 0.6, drag: 1.6, grav: 2.4, twinkle: false });
    }
    // Lấp lánh vàng rơi chậm
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * 2.2;
      this.add({ x: s.x, y: s.y, z: s.z, vx: Math.cos(a) * v, vy: Math.random() * 1.5, vz: Math.sin(a) * v, ...rgb(0xfff1b0), age: 0, life: 2 + Math.random(), drag: 2.5, grav: 1, twinkle: true });
    }
    // Chớp sáng giữa tâm nổ
    for (let i = 0; i < 6; i++) this.add({ x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, age: 0, life: 0.18, drag: 0, grav: 0, twinkle: false });
  }

  private add(s: Spark): void {
    if (this.sparks.length < MAX) this.sparks.push(s);
  }

  update(dt: number): void {
    const out: Spark[] = [];
    const born: [Spark, number][] = [];
    for (const s of this.sparks) {
      s.age += dt;
      if (s.age >= s.life) {
        if (s.rocket) born.push([s, s.rocket.color]);
        continue;
      }
      const d = Math.exp(-s.drag * dt);
      s.vx *= d;
      s.vz *= d;
      s.vy = s.vy * d - s.grav * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      // Quả pháo bay lên rắc vệt đuôi
      if (s.rocket) {
        s.rocket.trail += dt;
        while (s.rocket.trail > 0.02) {
          s.rocket.trail -= 0.02;
          out.push({ x: s.x + (Math.random() - 0.5) * 0.05, y: s.y - 0.1, z: s.z + (Math.random() - 0.5) * 0.05, vx: (Math.random() - 0.5) * 0.3, vy: -0.4, vz: (Math.random() - 0.5) * 0.3, ...rgb(0xffb35a), age: 0, life: 0.45, drag: 1, grav: 1, twinkle: false });
        }
      }
      out.push(s);
    }
    this.sparks = out.slice(0, MAX);
    for (const [s, c] of born) this.explode(s, c);
    // Ghi ra bộ đệm: độ sáng giảm theo tuổi (cộng màu nên tối = trong suốt)
    const n = this.sparks.length;
    for (let i = 0; i < n; i++) {
      const s = this.sparks[i];
      const k = s.age / s.life;
      let a = s.rocket ? 1 : Math.pow(1 - k, 1.6);
      if (s.twinkle) a *= Math.random() < 0.5 ? 1 : 0.2;
      // Tia vừa nổ hơi trắng rồi ngả về màu thật
      const w = s.rocket ? 0 : Math.max(0, 1 - k * 5) * 0.25;
      this.pos[i * 3] = s.x;
      this.pos[i * 3 + 1] = s.y;
      this.pos[i * 3 + 2] = s.z;
      this.col[i * 3] = (s.r + (1 - s.r) * w) * a;
      this.col[i * 3 + 1] = (s.g + (1 - s.g) * w) * a;
      this.col[i * 3 + 2] = (s.b + (1 - s.b) * w) * a;
    }
    const geo = this.points.geometry;
    geo.setDrawRange(0, n);
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.points.parent?.remove(this.points);
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

function rgb(hex: number): { r: number; g: number; b: number } {
  return { r: ((hex >> 16) & 255) / 255, g: ((hex >> 8) & 255) / 255, b: (hex & 255) / 255 };
}
