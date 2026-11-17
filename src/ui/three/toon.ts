import * as THREE from 'three';

/**
 * Bộ đồ nghề dựng hình phong cách hoạt hình (toon), cùng kiểu với dự án co-thu-3d:
 * mọi model ghép từ khối cơ bản bằng code, không có file model/texture ngoài.
 */

// Bảng sáng 4 nấc tạo nét tô bệt kiểu hoạt hình
const gradientMap = new THREE.DataTexture(new Uint8Array([120, 185, 235, 255]), 4, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

const matCache = new Map<number, THREE.MeshToonMaterial>();

/** Vật liệu toon theo màu. Không truyền opts thì dùng chung (cache) — đừng sửa trực tiếp vật liệu dùng chung. */
export function toon(color: number, opts?: THREE.MeshToonMaterialParameters): THREE.MeshToonMaterial {
  if (opts) return new THREE.MeshToonMaterial({ color, gradientMap, ...opts });
  let m = matCache.get(color);
  if (!m) matCache.set(color, (m = new THREE.MeshToonMaterial({ color, gradientMap })));
  return m;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined;
  if (!g) geoCache.set(key, (g = make()));
  return g;
}

/** Hình học có cache. */
export const G = {
  sphere: (r = 1, w = 16, h = 12) => cached(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h)),
  box: (x = 1, y = 1, z = 1) => cached(`b${x},${y},${z}`, () => new THREE.BoxGeometry(x, y, z)),
  cyl: (rt = 1, rb = 1, h = 1, seg = 14) => cached(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  cone: (r = 1, h = 1, seg = 10) => cached(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  ico: (r = 1, d = 0) => cached(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d)),
  torus: (r = 1, t = 0.1, a = 8, b = 20) => cached(`t${r},${t},${a},${b}`, () => new THREE.TorusGeometry(r, t, a, b)),
  capsule: (r = 1, l = 1) => cached(`cap${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 10)),
  /** Lăng trụ tam giác 1x1x1 (mái nhà): đáy rộng 1 theo x, cao 1 theo y, nóc chạy dọc z. Chỉnh cỡ bằng scale. */
  prism: () =>
    cached('prism', () => {
      const shape = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]);
      return new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
    }),
};

export type V3 = [number, number, number];
export interface Place {
  p?: V3;
  r?: V3;
  s?: number | V3;
  cast?: boolean;
  receive?: boolean;
}

function place(obj: THREE.Object3D, o: Place): void {
  if (o.p) obj.position.set(...o.p);
  if (o.r) obj.rotation.set(...o.r);
  if (typeof o.s === 'number') obj.scale.setScalar(o.s);
  else if (o.s) obj.scale.set(...o.s);
}

/** Tạo mesh nhanh: mesh(cha, hình, màu | vật liệu, { p: vị trí, r: xoay, s: tỉ lệ }). */
export function mesh(parent: THREE.Object3D | null, geo: THREE.BufferGeometry, mat: number | THREE.Material, o: Place = {}): THREE.Mesh {
  const m = new THREE.Mesh(geo, typeof mat === 'number' ? toon(mat) : mat);
  place(m, o);
  m.castShadow = o.cast !== false;
  m.receiveShadow = o.receive !== false;
  parent?.add(m);
  return m;
}

export function group(parent: THREE.Object3D | null, o: Place = {}): THREE.Group {
  const g = new THREE.Group();
  place(g, o);
  parent?.add(g);
  return g;
}

/** RNG có seed để cảnh trang trí cố định giữa các lần tải (chỉ dùng cho hình ảnh). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Sprite (luôn quay về camera) ----------

const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const emojiTextures = new Map<string, THREE.Texture>();

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Biểu tượng emoji nổi trong cảnh 3D. Nhờ nó nội dung mới thêm trong src/data (món, nguyên liệu...)
 * tự có hình mà không cần dựng model riêng.
 */
export function emojiSprite(icon: string, size = 0.6): THREE.Sprite {
  let tex = emojiTextures.get(icon);
  if (!tex) {
    tex = canvasTexture(128, 128, (c) => {
      c.font = `96px ${EMOJI_FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(icon, 64, 70);
    });
    emojiTextures.set(icon, tex);
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.setScalar(size);
  return sprite;
}

/** Chữ nổi (vd "+52"). Mỗi lần gọi tạo texture riêng — nhớ dispose khi bỏ. */
export function textSprite(text: string, color: string, size = 0.7): THREE.Sprite {
  const tex = canvasTexture(256, 96, (c) => {
    c.font = `bold 64px system-ui, ${EMOJI_FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 10;
    c.strokeStyle = '#fff';
    c.strokeText(text, 128, 50);
    c.fillStyle = color;
    c.fillText(text, 128, 50);
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sprite.scale.set(size * 2.67, size, 1);
  return sprite;
}

/** Thanh tiến độ / kiên nhẫn luôn quay về camera. */
export class Bar3D {
  readonly group = new THREE.Group();
  private fill: THREE.Sprite;
  private fillMat: THREE.SpriteMaterial;

  constructor(
    private width = 0.9,
    height = 0.13,
  ) {
    const back = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x3b2a1e, depthTest: false, transparent: true, opacity: 0.75 }));
    back.scale.set(width + 0.06, height + 0.06, 1);
    this.fillMat = new THREE.SpriteMaterial({ color: 0x5a9e4b, depthTest: false });
    this.fill = new THREE.Sprite(this.fillMat);
    this.fill.scale.set(width, height, 1);
    back.renderOrder = 10;
    this.fill.renderOrder = 11;
    this.group.add(back, this.fill);
  }

  /** frac 0..1; mood = true thì đổi màu xanh -> vàng -> đỏ khi tụt. */
  set(frac: number, mood = false): void {
    const f = Math.max(0.02, Math.min(1, frac));
    this.fill.scale.x = this.width * f;
    this.fill.center.x = 0.5 / f; // neo mép trái của phần tô vào mép trái của thanh
    if (mood) this.fillMat.color.setHex(f > 0.5 ? 0x5a9e4b : f > 0.25 ? 0xe0a030 : 0xd04a3a);
  }
}
