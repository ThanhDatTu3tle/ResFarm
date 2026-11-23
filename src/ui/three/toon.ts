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

const rimCache = new Map<number, THREE.MeshToonMaterial>();

/**
 * Vật liệu toon có VIỀN SÁNG MỀM (rim light): phần mép vật thể (nơi bề mặt quay ngang so với camera) hắt sáng ấm nhẹ,
 * giúp nhân vật tách khỏi nền mà không cần nét viền cứng. Dùng cho người (xem `rimify` trong person.ts). Có cache theo màu.
 */
export function toonRim(color: number): THREE.MeshToonMaterial {
  let m = rimCache.get(color);
  if (m) return m;
  m = new THREE.MeshToonMaterial({ color, gradientMap });
  m.userData.rim = true;
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `{
        float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        outgoingLight += vec3(1.0, 0.94, 0.82) * smoothstep(0.55, 1.0, rimF) * 0.22;
      }
      #include <opaque_fragment>`,
    );
  };
  m.customProgramCacheKey = () => 'toon-rim';
  rimCache.set(color, m);
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
  torus: (r = 1, t = 0.1, a = 8, b = 20, arc = Math.PI * 2) => cached(`t${r},${t},${a},${b},${arc}`, () => new THREE.TorusGeometry(r, t, a, b, arc)),
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

const bubbleTextures = new Map<string, THREE.Texture>();

/**
 * Bong bóng chat (nền trắng bo tròn, đuôi nhọn chỉ xuống) chứa một hoặc nhiều emoji — dùng cho yêu cầu của khách
 * (📖 cần menu, 😊 chọn xong món, mặt theo tâm trạng, các món đã gọi). Texture có cache theo nội dung.
 * Luôn vẽ đè lên cảnh (không bị quầy / mái quầy / tường che — vd bàn dơ ở quầy chữ L quán Nhật).
 */
export function bubbleSprite(icons: string[], size = 0.62, bg?: string | null): THREE.Sprite {
  const key = icons.join('|') + (bg ? `#${bg}` : '');
  let tex = bubbleTextures.get(key);
  const n = Math.max(1, icons.length);
  const w = 64 + 96 * n;
  if (!tex) {
    tex = canvasTexture(w, 168, (c) => {
      const r = 46;
      // Có màu bàn thì tô nền theo màu đó (viền đậm hơn) để người chơi so với món đang cầm
      c.fillStyle = bg ?? '#fffaf1';
      c.strokeStyle = bg ? '#4a3626' : '#8a5a35';
      c.lineWidth = 8;
      c.beginPath();
      c.roundRect(6, 6, w - 12, 124, r);
      c.moveTo(w / 2 - 18, 128);
      c.lineTo(w / 2, 160);
      c.lineTo(w / 2 + 18, 128);
      c.fill();
      c.stroke();
      // che nét viền giữa thân và đuôi bong bóng
      c.fillRect(w / 2 - 14, 120, 28, 12);
      c.font = `84px ${EMOJI_FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      icons.forEach((icon, i) => c.fillText(icon, 32 + 48 + i * 96, 74));
    });
    bubbleTextures.set(key, tex);
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sprite.center.set(0.5, 0);
  sprite.scale.set((size * w) / 168, size, 1);
  sprite.renderOrder = 20;
  return sprite;
}

const speechTextures = new Map<string, { tex: THREE.Texture; w: number; h: number }>();

/**
 * Bong bóng thoại có chữ (lời rao của người bán, câu nói của đầu bếp...): nền kem bo tròn, viền nâu, đuôi nhọn chỉ
 * xuống, chữ Mali tự xuống dòng (tối đa 2 dòng). Gốc sprite ở mũi đuôi; `size` = chiều cao một dòng chữ (m).
 * Texture có cache theo câu. Luôn vẽ đè lên cảnh (không bị bể cá / quầy che).
 */
export function speechSprite(text: string, size = 0.22): THREE.Sprite {
  let t = speechTextures.get(text);
  if (!t) {
    const LINE = 46;
    const font = `600 38px Mali, system-ui, ${EMOJI_FONT}`;
    const measure = document.createElement('canvas').getContext('2d')!;
    measure.font = font;
    // Xuống dòng theo chữ, mỗi dòng ≤ 360 px
    const lines: string[] = [];
    for (const word of text.split(' ')) {
      const last = lines[lines.length - 1];
      if (last != null && measure.measureText(last + ' ' + word).width <= 360) lines[lines.length - 1] = last + ' ' + word;
      else lines.push(word);
    }
    const w = Math.ceil(Math.max(...lines.map((l) => measure.measureText(l).width))) + 56;
    const h = lines.length * LINE + 40 + 26;
    const tex = canvasTexture(w, h, (c) => {
      c.fillStyle = '#fffaf1';
      c.strokeStyle = '#8a5a35';
      c.lineWidth = 6;
      c.beginPath();
      c.roundRect(4, 4, w - 8, h - 34, 26);
      c.moveTo(w / 2 - 14, h - 31);
      c.lineTo(w / 2, h - 4);
      c.lineTo(w / 2 + 14, h - 31);
      c.fill();
      c.stroke();
      c.fillRect(w / 2 - 11, h - 38, 22, 10); // che nét viền giữa thân và đuôi
      c.font = font;
      c.fillStyle = '#4a3626';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      lines.forEach((l, i) => c.fillText(l, w / 2, 24 + LINE / 2 + i * LINE));
    });
    speechTextures.set(text, (t = { tex, w, h }));
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, transparent: true, depthWrite: false, depthTest: false }));
  sprite.center.set(0.5, 0);
  sprite.scale.set((size * t.w) / 46, (size * t.h) / 46, 1);
  sprite.renderOrder = 20;
  return sprite;
}

/** Chữ nổi (vd "+52"). Mỗi lần gọi tạo texture riêng — nhớ dispose khi bỏ. */
/**
 * Viền đèn LED nhiều màu quanh một bảng hiệu (khung chữ nhật w × h, mặt nhìn về +z). Trả về danh sách bóng để
 * `blinkLeds` nhấp nháy chạy vòng mỗi khung hình.
 */
export function ledFrame(parent: THREE.Object3D, w: number, h: number, z = 0.09, step = 0.22): THREE.MeshBasicMaterial[] {
  const colors = [0xff4d4d, 0xffd23e, 0x4dc3ff, 0x6bff8a, 0xff7ad9];
  const mats: THREE.MeshBasicMaterial[] = [];
  const pts: [number, number][] = [];
  const nx = Math.max(2, Math.round(w / step));
  const ny = Math.max(2, Math.round(h / step));
  for (let i = 0; i < nx; i++) pts.push([-w / 2 + (i * w) / nx, h / 2]);
  for (let i = 0; i < ny; i++) pts.push([w / 2, h / 2 - (i * h) / ny]);
  for (let i = 0; i < nx; i++) pts.push([w / 2 - (i * w) / nx, -h / 2]);
  for (let i = 0; i < ny; i++) pts.push([-w / 2, -h / 2 + (i * h) / ny]);
  pts.forEach(([x, y], i) => {
    const m = new THREE.MeshBasicMaterial({ color: colors[i % colors.length] });
    m.userData.on = new THREE.Color(colors[i % colors.length]);
    m.userData.i = i;
    mats.push(m);
    mesh(parent, G.sphere(0.045, 8, 6), m, { p: [x, y, z], cast: false, receive: false });
  });
  return mats;
}

/** Đèn LED chạy vòng: cứ 3 bóng thì 2 bóng sáng, dịch dần theo thời gian; thỉnh thoảng cả viền chớp cùng lúc. */
export function blinkLeds(mats: THREE.MeshBasicMaterial[], t: number): void {
  const step = Math.floor(t * 7);
  const flash = Math.floor(t / 4) % 3 === 0 && Math.floor(t * 4) % 2 === 0;
  for (const m of mats) {
    const on = flash || (step + (m.userData.i as number)) % 3 !== 0;
    m.color.copy(m.userData.on as THREE.Color).multiplyScalar(on ? 1 : 0.25);
  }
}

export function textSprite(text: string, color: string, size = 0.7): THREE.Sprite {
  const tex = canvasTexture(256, 96, (c) => {
    c.font = `bold 64px Mali, system-ui, ${EMOJI_FONT}`;
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

/** Màu nền cỏ của các khu ngoài trời (đổi theo mùa cùng tán lá). */
const GROUND = new Set([0x8fd16a, 0xbfd88f, 0xb9d48a, 0x9eda7a, 0x9ed47a]);
/** [màu hướng tới, mức pha] theo mùa: Xuân giữ nguyên, Hạ ngả vàng, Thu ngả cam, Đông phủ tuyết. */
const SEASON_TINT: [number, number][] = [
  [0, 0],
  [0xc9c44e, 0.2],
  [0xd9822b, 0.6],
  [0xeef3f7, 0.8],
];
/** Nền cỏ đổi nhẹ hơn tán lá (mùa thu nền chỉ ngả vàng cam, không cam rực như lá). */
const GROUND_K = [0, 0.15, 0.3, 0.8];
const hsl = { h: 0, s: 0, l: 0 };

/**
 * Tô lại tán lá (khối ico màu xanh lá) và nền cỏ trong `root` theo mùa (0..3). Chỉ đụng vật liệu toon dùng chung;
 * màu gốc giữ ở `userData.seasonBase` nên gọi lại bao nhiêu lần cũng được. `foliage = false`: chỉ đổi nền cỏ
 * (trong quán có chậu cây, không phủ tuyết lên chậu cây trong nhà).
 */
/**
 * Màu gốc nếu mesh này đổi màu theo mùa (lá cây: khối ico màu xanh lá; nền cỏ: màu trong GROUND), null nếu không.
 * Dùng chung cho paintSeason và mergeStatic (khối gộp giữ màu gốc trong userData.seasonBase).
 */
export function seasonBaseOf(o: THREE.Mesh, foliage = true): number | null {
  const m = o.material;
  if (!(m instanceof THREE.MeshToonMaterial)) return null;
  const hex = m.color.getHex();
  if (matCache.get(hex) !== m) return null;
  m.color.getHSL(hsl);
  const leafy = foliage && o.geometry instanceof THREE.IcosahedronGeometry && hsl.h > 0.17 && hsl.h < 0.45 && hsl.s > 0.2;
  return leafy || GROUND.has(hex) ? hex : null;
}

export function paintSeason(root: THREE.Object3D, season: number, foliage = true): void {
  const [to, k] = SEASON_TINT[season] ?? [0, 0];
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    let base = o.userData.seasonBase as number | undefined;
    if (base === undefined) {
      base = seasonBaseOf(o, foliage) ?? undefined;
      if (base === undefined) return;
      o.userData.seasonBase = base;
    }
    const kk = GROUND.has(base) ? (GROUND_K[season] ?? 0) : k;
    o.material = toon(kk ? new THREE.Color(base).lerp(new THREE.Color(to), kk).getHex() : base);
  });
}
