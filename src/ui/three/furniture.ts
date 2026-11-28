import * as THREE from 'three';
import { G, group, mesh, seeded, toon } from './toon';

/**
 * BÀN GHẾ GỖ MỘC (quán Việt) - mẫu đầu tiên theo hướng "đồ làm tay":
 *  - Mặt bàn ghép từ 3 tấm ván, có khe nhỏ, mỗi tấm lệch chút xíu (dài / cao / xoay) như thợ đóng tay.
 *  - Vân gỗ vẽ bằng canvas (sọc lượn sóng + mắt gỗ), nhân với màu nội thất → đổi bộ nội thất vẫn giữ vân.
 *  - Chân chữ A choãi ra, có thanh giằng thấp; ghế đẩu mặt chữ nhật, chân choãi sang hai bên.
 *  - Độ lệch lấy từ RNG có seed theo bàn → cố định giữa các lần tải, mỗi bàn một kiểu hơi khác nhau.
 */

export interface WoodMats {
  /** 3 tấm ván mặt bàn (cùng màu `top`, vân khác nhau). */
  planks: THREE.MeshToonMaterial[];
  /** Màu `base`, vân chạy ngang (thanh nằm dọc trục x). */
  frame: THREE.MeshToonMaterial;
  /** Màu `base`, vân chạy dọc (chân, thanh nằm dọc trục z). */
  frameUp: THREE.MeshToonMaterial;
  /** Màu `seat`: mặt ghế đẩu. */
  seat: THREE.MeshToonMaterial;
}

const grainCache = new Map<string, THREE.Texture>();

/** Vân gỗ: nền gần trắng (để màu nội thất quyết định tông), sọc sẫm lượn sóng, đôi khi có mắt gỗ. */
function grain(variant: number, vertical: boolean): THREE.Texture {
  const key = `${variant}${vertical ? 'v' : 'h'}`;
  let tex = grainCache.get(key);
  if (tex) return tex;
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const c = canvas.getContext('2d')!;
  const rnd = seeded(97 + variant * 31);
  const base = 238 - variant * 7; // mỗi tấm ván sáng tối khác nhau một chút
  c.fillStyle = `rgb(${base},${base - 4},${base - 10})`;
  c.fillRect(0, 0, S, S);
  const lines = 11 + Math.floor(rnd() * 5);
  for (let i = 0; i < lines; i++) {
    const y0 = (i + rnd() * 0.8) * (S / lines);
    const amp = 1 + rnd() * 3;
    const freq = 1 + Math.floor(rnd() * 3);
    const phase = rnd() * Math.PI * 2;
    c.strokeStyle = `rgba(64,36,20,${0.16 + rnd() * 0.28})`;
    c.lineWidth = 0.8 + rnd() * 2.2;
    c.beginPath();
    for (let x = 0; x <= S; x += 4) {
      const y = y0 + Math.sin((x / S) * Math.PI * 2 * freq + phase) * amp;
      if (x === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  if (variant % 2 === 0) {
    // Mắt gỗ: vài vòng elip lồng nhau
    const kx = 30 + rnd() * 68;
    const ky = 30 + rnd() * 68;
    for (let r = 2; r < 9; r += 2.2) {
      c.strokeStyle = `rgba(60,34,18,${0.35 - r * 0.025})`;
      c.lineWidth = 1.2;
      c.beginPath();
      c.ellipse(kx, ky, r * 2.2, r * 0.9, 0, 0, Math.PI * 2);
      c.stroke();
    }
  }
  tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (vertical) {
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI / 2;
  }
  grainCache.set(key, tex);
  return tex;
}

const woodToon = (map: THREE.Texture) => toon(0xffffff, { map });

/** Bộ vật liệu gỗ riêng (mỗi quán / mỗi trang xem một bộ) để đổi màu theo nội thất. */
export function woodMats(colors?: { top: number; base: number; seat: number }): WoodMats {
  const m: WoodMats = {
    planks: [0, 1, 2].map((i) => woodToon(grain(i, false))),
    frame: woodToon(grain(3, false)),
    frameUp: woodToon(grain(3, true)),
    seat: woodToon(grain(4, false)),
  };
  if (colors) tintWood(m, colors);
  return m;
}

export function tintWood(m: WoodMats, c: { top: number; base: number; seat: number }): void {
  for (const p of m.planks) p.color.setHex(c.top);
  m.frame.color.setHex(c.base);
  m.frameUp.color.setHex(c.base);
  m.seat.color.setHex(c.seat);
}

/** Chân gỗ vuông nối từ (x1, y1, z1) xuống (x2, 0, z2): dựng thẳng rồi nghiêng cho khớp. */
function leg(parent: THREE.Object3D, mat: THREE.Material, t: number, top: V, bottom: V): void {
  const dx = top[0] - bottom[0];
  const dz = top[2] - bottom[2];
  const h = top[1] - bottom[1];
  const len = Math.hypot(dx, h, dz);
  mesh(parent, G.box(t, len, t), mat, {
    p: [(top[0] + bottom[0]) / 2, (top[1] + bottom[1]) / 2, (top[2] + bottom[2]) / 2],
    r: [Math.atan2(dz, h), 0, -Math.atan2(dx, h)],
  });
}
type V = [number, number, number];

/**
 * Bàn gỗ ván ghép, chân chữ A ở hai đầu. Gốc ở tâm bàn trên mặt đất, mặt bàn cao `top`, rộng `w` (x) sâu `d` (z).
 * Ván chạy theo cạnh dài.
 */
export function buildWoodTable(g: THREE.Object3D, w: number, d: number, top: number, m: WoodMats, seed = 1): void {
  const rnd = seeded(seed * 7919 + 13);
  const jit = (a: number) => (rnd() * 2 - 1) * a;
  // Dựng theo trục dài = x rồi xoay nếu bàn sâu hơn rộng
  const along = d > w ? group(g, { r: [0, Math.PI / 2, 0] }) : g;
  const [L, D] = d > w ? [d, w] : [w, d];
  const T = 0.065; // dày ván
  const gap = 0.022;
  const pw = (D - gap * 2) / 3;
  for (let i = 0; i < 3; i++) {
    const z = -D / 2 + pw / 2 + i * (pw + gap);
    mesh(along, G.box(L + jit(0.02), T, pw), m.planks[i], { p: [jit(0.012), top - T / 2 + jit(0.004), z], r: [0, jit(0.008), 0] });
  }
  // Hai thanh ngang đỡ ván dưới mặt bàn
  const inset = Math.min(0.2, L * 0.16);
  const lx = L / 2 - inset;
  for (const sx of [-1, 1]) mesh(along, G.box(0.06, 0.05, D - 0.12), m.frameUp, { p: [sx * lx, top - T - 0.025, 0] });
  // Chân chữ A: choãi ra ngoài theo trục dài, hơi chụm vào theo trục ngắn
  const t = Math.min(0.075, L * 0.07);
  const lz = D / 2 - Math.min(0.12, D * 0.12);
  const splay = Math.min(0.09, L * 0.07);
  const yTop = top - T - 0.02;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) leg(along, m.frameUp, t, [sx * lx, yTop, sz * lz], [sx * (lx + splay) + jit(0.01), 0, sz * (lz + 0.03) + jit(0.01)]);
    // Thanh giằng thấp nối hai chân cùng đầu
    const ys = 0.16;
    const xs = sx * (lx + splay * (1 - ys / yTop));
    mesh(along, G.box(0.05, 0.055, 2 * (lz + 0.03 * (1 - ys / yTop)) + 0.04), m.frameUp, { p: [xs, ys, 0] });
  }
  // Thanh giằng dài giữa nối hai đầu
  const xs = lx + splay * (1 - 0.16 / yTop);
  mesh(along, G.box(2 * xs, 0.05, 0.05), m.frame, { p: [0, 0.2, 0] });
}

/** Ghế đẩu gỗ: mặt chữ nhật nằm ngang (theo x), 4 chân choãi sang hai bên, giằng thấp. Gốc ở tâm đất, nhìn về +z. */
export function buildWoodStool(chair: THREE.Object3D, m: WoodMats, seed = 1): void {
  const rnd = seeded(seed * 104729 + 7);
  const jit = (a: number) => (rnd() * 2 - 1) * a;
  const H = 0.46;
  const T = 0.055;
  mesh(chair, G.box(0.44, T, 0.3), m.seat, { p: [0, H - T / 2, 0], r: [jit(0.015), jit(0.04), jit(0.012)] });
  const yTop = H - T;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) leg(chair, m.frameUp, 0.05, [sx * 0.14, yTop, sz * 0.085], [sx * 0.2 + jit(0.008), 0, sz * 0.1 + jit(0.008)]);
    // Giằng hai bên (theo z) và trước sau (theo x)
    mesh(chair, G.box(0.04, 0.045, 0.2), m.frameUp, { p: [sx * 0.185, 0.12, 0] });
  }
  mesh(chair, G.box(0.36, 0.04, 0.035), m.frame, { p: [0, 0.2, -0.095] });
}

/** Cỡ khay trên bàn trong quán (so với cỡ dựng 0.44 × 0.34 m). */
export const CADDY_SCALE = 0.8;

/**
 * Đặt khay lên bàn: bàn 4 / 6 người để giữa; bàn 1–2 người đẩy sát một mép không có khách ngồi
 * (ưu tiên mép sau, xa camera). `seats`: vị trí ghế so với tâm bàn (m). `edge` = luôn đẩy ra mép (giữa bàn có vỉ nướng).
 */
type Builder = (g: THREE.Object3D, top: number, seed: number, at: { x?: number; z?: number; rot?: number; scale?: number }) => void;
export function placeCaddy(g: THREE.Object3D, top: number, w: number, d: number, seats: { x: number; z: number }[], seed = 1, build: Builder = buildCaddy, half = 0.17, s = CADDY_SCALE, edge = false): void {
  if (seats.length > 2 && !edge) return build(g, top, seed, { scale: s });
  const sideOf = (p: { x: number; z: number }): [number, number] => (Math.abs(p.x) > Math.abs(p.z) ? [Math.sign(p.x), 0] : [0, Math.sign(p.z)]);
  const taken = seats.map(sideOf);
  const edges: [number, number][] = [[0, -1], [-1, 0], [1, 0], [0, 1]];
  const [dx, dz] = edges.find(([ex, ez]) => !taken.some(([tx, tz]) => tx === ex && tz === ez)) ?? [0, -1];
  const off = (dx ? w / 2 : d / 2) - half * s - 0.06;
  build(g, top, seed, { x: dx * off, z: dz * off, rot: dx ? -dx * Math.PI / 2 : dz > 0 ? Math.PI : 0, scale: s });
}

let caddyWood: { flat: THREE.MeshToonMaterial; up: THREE.MeshToonMaterial } | null = null;

/**
 * KHAY ĐA NĂNG trên bàn quán Việt (gỗ cao su sáng màu): hộp giấy ăn có khe, ống đũa thìa 2 ngăn có rãnh,
 * 2 hũ sứ trắng có nắp, chai tương ớt, bình nước tương, cốc tăm. Gốc ở tâm khay, đặt trên mặt bàn cao `top`.
 * Dựng cỡ 0.44 × 0.34 m; trong quán thu nhỏ bằng `at.scale` (CADDY_SCALE).
 */
export function buildCaddy(g: THREE.Object3D, top: number, seed = 1, at: { x?: number; z?: number; rot?: number; scale?: number } = {}): void {
  caddyWood ??= { flat: woodToon(grain(1, false)), up: woodToon(grain(2, true)) };
  for (const m of [caddyWood.flat, caddyWood.up]) m.color.setHex(0xe2b67c);
  const { flat, up } = caddyWood;
  const groove = 0xa8784a;
  const white = 0xf6f3ee;
  const rnd = seeded(seed * 613 + 5);
  const jit = (a: number) => (rnd() * 2 - 1) * a;
  const t = group(g, { p: [at.x ?? 0, top, at.z ?? 0], r: [0, (at.rot ?? 0) + jit(0.06), 0], s: at.scale ?? 1 });
  // Khay đáy + gờ phải, gờ trước
  mesh(t, G.box(0.44, 0.025, 0.34), flat, { p: [0, 0.0125, 0] });
  const y0 = 0.025;
  mesh(t, G.box(0.014, 0.035, 0.34), up, { p: [0.213, y0 + 0.0175, 0] });
  mesh(t, G.box(0.44, 0.022, 0.014), flat, { p: [0, y0 + 0.011, 0.163] });

  // Hộp giấy ăn (trái trước): khe bầu dục + tờ giấy nhú lên
  mesh(t, G.box(0.18, 0.09, 0.19), flat, { p: [-0.13, y0 + 0.045, 0.065] });
  mesh(t, G.cyl(0.035, 0.035, 0.004, 16), groove, { p: [-0.13, y0 + 0.091, 0.075], s: [1.6, 1, 0.75], cast: false });
  mesh(t, G.ico(0.04, 0), white, { p: [-0.135, y0 + 0.115, 0.07], s: [1.3, 0.9, 0.45], r: [0.2, 0.5, 0.4] });
  mesh(t, G.box(0.06, 0.05, 0.004), white, { p: [-0.11, y0 + 0.12, 0.085], r: [-0.5, 0.3, 0.6], cast: false });

  // Ống đũa thìa (trái sau): 2 ngăn, mặt trước có 3 rãnh ngang
  const hx = -0.13;
  const hz = -0.1;
  const H = 0.15;
  const [W, D, th] = [0.18, 0.12, 0.012];
  for (const sz of [-1, 1]) mesh(t, G.box(W, H, th), flat, { p: [hx, y0 + H / 2, hz + sz * (D / 2 - th / 2)] });
  for (const sx of [-1, 0, 1]) mesh(t, G.box(th, sx ? H : H - 0.02, D - th * 2), up, { p: [hx + sx * (W / 2 - th / 2), y0 + (sx ? H / 2 : (H - 0.02) / 2), hz] });
  for (let i = 0; i < 3; i++) mesh(t, G.box(W * 0.7, 0.008, 0.003), groove, { p: [hx, y0 + 0.035 + i * 0.03, hz + D / 2 + 0.001], cast: false });
  // Thìa inox ngăn trái (cán xuống, lòng thìa ngửa lên)
  for (let i = 0; i < 3; i++) {
    const s = group(t, { p: [hx - 0.045 + jit(0.012), y0 + 0.02, hz + (i - 1) * 0.022], r: [jit(0.12), 0, -0.12 + jit(0.08)] });
    mesh(s, G.box(0.011, 0.15, 0.005), 0xc9ced6, { p: [0, 0.075, 0], cast: false });
    mesh(s, G.sphere(0.022, 10, 8), 0xdfe3ea, { p: [0, 0.165, 0], s: [1, 1.35, 0.45], cast: false });
  }
  // Đũa tre ngăn phải
  for (let i = 0; i < 10; i++) {
    const x = hx + 0.045 + jit(0.028);
    const z = hz + jit(0.035);
    mesh(t, G.cyl(0.0045, 0.0045, 0.25, 4), 0xd8ae78, { p: [x, y0 + 0.125 + jit(0.012), z], r: [jit(0.06), 0, jit(0.06)], cast: false });
  }

  // 2 hũ sứ trắng có nắp
  for (const [x, z] of [[0.04, -0.075], [0.02, 0.085]]) {
    mesh(t, G.cyl(0.048, 0.042, 0.05, 16), white, { p: [x, y0 + 0.025, z] });
    mesh(t, G.cyl(0.05, 0.05, 0.012, 16), white, { p: [x, y0 + 0.056, z] });
    mesh(t, G.sphere(0.013, 10, 8), white, { p: [x, y0 + 0.068, z], cast: false });
  }
  // Chai tương ớt (đỏ, nhãn sẫm, nắp đỏ)
  const cb = group(t, { p: [0.155, y0, -0.11] });
  mesh(cb, G.cyl(0.031, 0.033, 0.11, 14), 0xd8302a, { p: [0, 0.055, 0] });
  mesh(cb, G.cyl(0.032, 0.034, 0.045, 14), 0x3a2b25, { p: [0, 0.05, 0], cast: false });
  mesh(cb, G.cyl(0.014, 0.031, 0.035, 14), 0xd8302a, { p: [0, 0.127, 0] });
  mesh(cb, G.cyl(0.014, 0.016, 0.035, 10), 0xc4221d, { p: [0, 0.16, 0] });
  // Bình nước tương sứ trắng: thân, cổ, núm, vòi, quai
  const cr = group(t, { p: [0.135, y0, 0.02], r: [0, -0.5, 0] });
  mesh(cr, G.cyl(0.024, 0.032, 0.07, 14), white, { p: [0, 0.035, 0] });
  mesh(cr, G.cyl(0.014, 0.022, 0.025, 12), white, { p: [0, 0.082, 0] });
  mesh(cr, G.sphere(0.013, 10, 8), white, { p: [0, 0.1, 0], cast: false });
  mesh(cr, G.cyl(0.006, 0.009, 0.045, 8), white, { p: [0.034, 0.05, 0], r: [0, 0, -0.9], cast: false });
  mesh(cr, G.torus(0.018, 0.005, 6, 12, Math.PI), white, { p: [-0.028, 0.055, 0], r: [0, 0, Math.PI / 2], cast: false });
  // Cốc tăm lục giác + bó tăm xoè
  const tp = group(t, { p: [0.165, y0, 0.115] });
  mesh(tp, G.cyl(0.024, 0.021, 0.055, 6), white, { p: [0, 0.0275, 0] });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    mesh(tp, G.cyl(0.0018, 0.0018, 0.07, 3), 0xc79a63, { p: [Math.cos(a) * 0.008, 0.07, Math.sin(a) * 0.008], r: [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25], cast: false });
  }
}

// ---------- Quán Ốc: bàn nhựa xanh, ghế nhựa đỏ có tựa, ống inox đũa ----------

/** Chân nhựa vuông thuôn (trụ 4 cạnh xoay 45°), hơi choãi ra ngoài theo (sx, sz). */
function plasticLeg(parent: THREE.Object3D, mat: THREE.Material, x: number, z: number, h: number, rt: number, rb: number, sx: number, sz: number, lean = 0.05): void {
  const tilt = group(parent, { p: [x, h, z], r: [sz * lean, 0, -sx * lean] });
  mesh(tilt, G.cyl(rt, rb, h, 4), mat, { p: [0, -h / 2, 0], r: [0, Math.PI / 4, 0] });
}

const archCache = new Map<string, THREE.ExtrudeGeometry>();

/**
 * Tấm hông bàn nhựa đúc: dải diềm trên + hai chân bản rộng ở hai đầu, giữa là vòm cong (mặt cắt trong mặt x-y,
 * đáy ở y = 0, cao h, dài w, dày t). Ghép 4 tấm quanh mặt bàn thành 4 chân chữ L như bàn nhựa Song Long.
 */
function archPanel(w: number, h: number, t: number): THREE.ExtrudeGeometry {
  const key = `${w.toFixed(2)},${h.toFixed(2)},${t}`;
  let geo = archCache.get(key);
  if (geo) return geo;
  const leg = Math.min(0.13, w * 0.16); // bề ngang chân ở chân đế
  const apron = 0.1; // diềm trên
  const r = Math.min(0.16, (w - leg * 2) / 2 - 0.01); // bán kính bo vòm ở hai góc
  const top = h - apron;
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, 0);
  sh.lineTo(-w / 2 + leg, 0);
  // chân thuôn dần lên (mép trong hơi xiên) rồi bo cong thành vòm
  sh.lineTo(-w / 2 + leg + 0.02, top - r);
  sh.quadraticCurveTo(-w / 2 + leg + 0.02, top, -w / 2 + leg + 0.02 + r, top);
  sh.lineTo(w / 2 - leg - 0.02 - r, top);
  sh.quadraticCurveTo(w / 2 - leg - 0.02, top, w / 2 - leg - 0.02, top - r);
  sh.lineTo(w / 2 - leg, 0);
  sh.lineTo(w / 2, 0);
  sh.lineTo(w / 2, h);
  sh.lineTo(-w / 2, h);
  sh.closePath();
  geo = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -t / 2);
  archCache.set(key, geo);
  return geo;
}

/**
 * Bàn nhựa chữ nhật kiểu quán ốc (như bàn nhựa đúc Song Long): mặt dày bo viền, có gân chìm chạy quanh mặt bàn,
 * bốn hông là tấm nhựa liền có vòm cong - chân là bản rộng hình chữ L ở bốn góc, hơi choãi ra; miếng đệm chân sẫm màu.
 * `mats.top` mặt bàn + hông, `mats.base` gân chìm, lòng bàn, đệm chân.
 */
export function buildPlasticTable(g: THREE.Object3D, w: number, d: number, top: number, mats: { top: THREE.Material; base: THREE.Material }, seed = 1): void {
  const rnd = seeded(seed * 3301 + 17);
  const jit = (a: number) => (rnd() * 2 - 1) * a;
  const t = group(g, { r: [0, jit(0.03), 0] });
  const T = 0.04; // dày mặt bàn
  // Mặt bàn + gờ viền bo tròn quanh mép
  mesh(t, G.box(w - 0.04, T, d - 0.04), mats.top, { p: [0, top - T / 2, 0] });
  for (const sz of [-1, 1]) mesh(t, G.cyl(0.025, 0.025, w - 0.04, 6), mats.top, { p: [0, top - 0.022, sz * (d / 2 - 0.022)], r: [0, 0, Math.PI / 2] });
  for (const sx of [-1, 1]) mesh(t, G.cyl(0.025, 0.025, d - 0.04, 6), mats.top, { p: [sx * (w / 2 - 0.022), top - 0.022, 0], r: [Math.PI / 2, 0, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(t, G.sphere(0.025, 6, 4), mats.top, { p: [sx * (w / 2 - 0.022), top - 0.022, sz * (d / 2 - 0.022)], cast: false });
  // Gân chìm chạy quanh mặt bàn (khung chữ nhật mảnh sẫm hơn) + logo tròn ở cạnh trước
  const iw = w - 0.2;
  const id = d - 0.2;
  for (const sz of [-1, 1]) mesh(t, G.box(iw, 0.004, 0.012), mats.base, { p: [0, top + 0.001, sz * (id / 2)], cast: false, receive: false });
  for (const sx of [-1, 1]) mesh(t, G.box(0.012, 0.004, id), mats.base, { p: [sx * (iw / 2), top + 0.001, 0], cast: false, receive: false });
  mesh(t, G.box(0.11, 0.02, 0.004), 0xf2b33a, { p: [0, top - 0.06, d / 2 - 0.035], cast: false, receive: false });
  // Bốn hông vòm: tấm trước / sau dài theo w, hai tấm bên dài theo d; hơi choãi (nghiêng ra ngoài) quanh mép trên
  const h = top - T;
  const lean = 0.06 + jit(0.01);
  const inset = 0.035;
  for (const sz of [-1, 1]) {
    const hinge = group(t, { p: [0, h, sz * (d / 2 - inset)], r: [-sz * lean, 0, 0] });
    mesh(hinge, archPanel(w - inset * 2, h, 0.025), mats.top, { p: [0, -h, 0] });
  }
  for (const sx of [-1, 1]) {
    const hinge = group(t, { p: [sx * (w / 2 - inset), h, 0], r: [0, 0, sx * lean] });
    mesh(hinge, archPanel(d - inset * 2, h, 0.025), mats.top, { p: [0, -h, 0], r: [0, Math.PI / 2, 0] });
  }
  // Lòng dưới mặt bàn sẫm hơn + đệm chân ở bốn góc (chân choãi nên đệm lệch ra ngoài chút)
  mesh(t, G.box(w - 0.14, 0.015, d - 0.14), mats.base, { p: [0, h - 0.01, 0], cast: false });
  const spread = Math.sin(lean) * h;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(t, G.box(0.1, 0.02, 0.1), mats.base, { p: [sx * (w / 2 - inset - 0.04 + spread), 0.01, sz * (d / 2 - inset - 0.04 + spread)], cast: false });
}

/**
 * Ghế nhựa đỏ có tựa lưng (kiểu ghế quán nhậu): mặt ghế có mép cong xuống phía trước, chân vuông thuôn,
 * chân sau vươn lên thành trụ tựa, lưng tựa ngả ra sau có các khe dọc. Gốc ở tâm đất, khách nhìn về +z.
 */
export function buildPlasticChair(chair: THREE.Object3D, mat: THREE.Material, seed = 1): void {
  const rnd = seeded(seed * 7121 + 3);
  const jit = (a: number) => (rnd() * 2 - 1) * a;
  const c = group(chair, { p: [jit(0.03), 0, jit(0.03)], r: [0, jit(0.12), 0] });
  const H = 0.42;
  mesh(c, G.box(0.42, 0.035, 0.4), mat, { p: [0, H, 0] });
  mesh(c, G.box(0.42, 0.06, 0.025), mat, { p: [0, H - 0.03, 0.2] }); // mép trước cong xuống
  for (const sx of [-1, 1]) mesh(c, G.box(0.025, 0.05, 0.4), mat, { p: [sx * 0.21, H - 0.03, 0] }); // mép hai bên
  for (const sx of [-1, 1]) {
    plasticLeg(c, mat, sx * 0.18, 0.16, H - 0.02, 0.026, 0.02, sx, 1, 0.07);
    plasticLeg(c, mat, sx * 0.18, -0.17, H - 0.02, 0.026, 0.02, sx, -1, 0.07);
  }
  // Lưng tựa: ngả ra sau, 2 trụ + thanh trên to + 4 thanh dọc + thanh dưới
  const back = group(c, { p: [0, H, -0.19], r: [-0.18, 0, 0] });
  for (const sx of [-1, 1]) mesh(back, G.box(0.035, 0.42, 0.03), mat, { p: [sx * 0.19, 0.21, 0] });
  mesh(back, G.box(0.42, 0.11, 0.03), mat, { p: [0, 0.37, 0] });
  for (let i = 0; i < 4; i++) mesh(back, G.box(0.045, 0.2, 0.022), mat, { p: [-0.12 + i * 0.08, 0.2, 0] });
  mesh(back, G.box(0.42, 0.035, 0.03), mat, { p: [0, 0.08, 0] });
}

let clearMat: THREE.MeshToonMaterial | null = null;

/**
 * Bộ đồ bàn quán ốc: đĩa thiếc tròn, ống inox cắm đũa tre, 2 chai nước tương thuỷ tinh sẫm (nắp xanh / nắp đỏ),
 * chai nhựa trong đựng nước mắm, cốc tăm gốm nâu. Gốc ở tâm đĩa (bán kính ~0.15 m).
 */
export function buildChopstickSet(g: THREE.Object3D, top: number, seed = 1, at: { x?: number; z?: number; rot?: number; scale?: number } = {}): void {
  clearMat ??= toon(0xe0a35a, { transparent: true, opacity: 0.7 });
  const rnd = seeded(seed * 911 + 29);
  const jit = (a: number) => (rnd() * 2 - 1) * a;
  const t = group(g, { p: [at.x ?? 0, top, at.z ?? 0], r: [0, (at.rot ?? 0) + jit(0.3), 0], s: at.scale ?? 1 });
  mesh(t, G.cyl(0.15, 0.14, 0.012, 24), 0xc3c8cf, { p: [0, 0.006, 0] });
  mesh(t, G.torus(0.145, 0.006, 4, 24), 0xdde1e6, { p: [0, 0.012, 0], r: [Math.PI / 2, 0, 0], cast: false });
  const y0 = 0.012;
  // Ống inox + đũa xoè
  const can = group(t, { p: [-0.045, y0, -0.05] });
  mesh(can, G.cyl(0.055, 0.055, 0.13, 16), 0xb7bdc6, { p: [0, 0.065, 0] });
  for (const y of [0.012, 0.125]) mesh(can, G.torus(0.055, 0.005, 4, 16), 0xe2e5ea, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], cast: false });
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 0.04;
    const lean = 0.05 + r * 2;
    mesh(can, G.cyl(0.004, 0.0045, 0.26, 4), rnd() < 0.3 ? 0xc89a62 : 0xdab27c, { p: [Math.cos(a) * r, 0.14 + jit(0.015), Math.sin(a) * r], r: [Math.sin(a) * lean, 0, -Math.cos(a) * lean], cast: false });
  }
  // 2 chai nước tương thuỷ tinh sẫm
  const bottle = (x: number, z: number, cap: number) => {
    const b = group(t, { p: [x, y0, z] });
    mesh(b, G.cyl(0.026, 0.028, 0.085, 12), 0x2b1a12, { p: [0, 0.0425, 0] });
    mesh(b, G.cyl(0.011, 0.026, 0.03, 12), 0x2b1a12, { p: [0, 0.1, 0] });
    mesh(b, G.cyl(0.015, 0.017, 0.03, 10), cap, { p: [0, 0.128, 0] });
  };
  bottle(0.065, -0.07, 0x2f9e4a);
  bottle(0.095, 0.0, 0xb7432f);
  // Chai nhựa trong (nước mắm), nắp trắng
  const cb = group(t, { p: [0.035, y0, 0.08] });
  mesh(cb, G.cyl(0.028, 0.03, 0.08, 12), clearMat, { p: [0, 0.04, 0], cast: false });
  mesh(cb, G.cyl(0.013, 0.028, 0.022, 12), clearMat, { p: [0, 0.091, 0], cast: false });
  mesh(cb, G.cyl(0.015, 0.015, 0.018, 10), 0xf2efe8, { p: [0, 0.11, 0] });
  // Cốc tăm gốm nâu
  const tp = group(t, { p: [-0.075, y0, 0.07] });
  mesh(tp, G.cyl(0.022, 0.018, 0.045, 8), 0x8a5230, { p: [0, 0.0225, 0] });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    mesh(tp, G.cyl(0.0018, 0.0018, 0.06, 3), 0xd8b47c, { p: [Math.cos(a) * 0.009, 0.06, Math.sin(a) * 0.009], r: [Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2], cast: false });
  }
}

// ---------- Quán Nhật: bàn gỗ sồi sáng, ghế tựa cong đệm xám xanh ----------

/** Chân vuông thuôn nhẹ (trụ 4 cạnh xoay 45°) từ sàn lên độ cao h tại (x, z). */
function taperLeg(parent: THREE.Object3D, mat: THREE.Material, x: number, z: number, h: number, t: number, y0 = 0): void {
  mesh(parent, G.cyl(t * 0.71, t * 0.6, h, 4), mat, { p: [x, y0 + h / 2, z], r: [0, Math.PI / 4, 0] });
}

/**
 * Bàn gỗ sồi sáng kiểu quán Nhật hiện đại: mặt bàn liền khối dày (ghép 2 tấm, có đường nối mảnh), khung yếm dưới mặt,
 * 4 chân vuông thuôn thẳng đứng. Dựng theo chiều dài rồi xoay nếu bàn sâu hơn rộng (vân gỗ chạy dọc bàn).
 */
export function buildOakTable(g: THREE.Object3D, w: number, d: number, top: number, m: WoodMats, seed = 1): void {
  const rnd = seeded(seed * 613 + 5);
  const L = Math.max(w, d);
  const D = Math.min(w, d);
  const t = group(g, { r: [0, d > w ? Math.PI / 2 : 0, 0] });
  const th = 0.055;
  mesh(t, G.box(L, th, D), m.planks[seed % 3], { p: [0, top - th / 2, 0] });
  mesh(t, G.box(L - 0.004, 0.004, 0.008), 0x7a5535, { p: [0, top + 0.001, (rnd() - 0.5) * D * 0.3], cast: false }); // đường ghép 2 tấm gỗ
  mesh(t, G.box(L - 0.02, 0.012, D - 0.02), m.frame, { p: [0, top - th - 0.006, 0], cast: false }); // gờ vát dưới mép
  const ix = L / 2 - 0.09;
  const iz = D / 2 - 0.09;
  const ay = top - th - 0.05;
  for (const s of [-1, 1]) {
    mesh(t, G.box(L - 0.2, 0.08, 0.025), m.frame, { p: [0, ay, s * iz] }); // yếm dọc
    mesh(t, G.box(0.025, 0.08, D - 0.2), m.frame, { p: [s * ix, ay, 0] }); // yếm ngang
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) taperLeg(t, m.frameUp, sx * ix, sz * iz, top - th, 0.06);
}

/**
 * Ghế gỗ sồi tựa cong (nhìn về +z): khung gỗ, đệm vải xám xanh hai lớp, lưng là dải gỗ cong hình móng ngựa ôm ra
 * hai bên rồi dốc xuống thành tay vịn nối chân trước, giằng thấp hai bên. `cushion` = vật liệu đệm (màu "ghế" của bộ nội thất).
 */
export function buildOakChair(chair: THREE.Object3D, m: WoodMats, cushion: THREE.Material, seed = 1): void {
  const rnd = seeded(seed * 431 + 17);
  const c = group(chair, { p: [(rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.05], r: [0, (rnd() - 0.5) * 0.12, 0] });
  const H = 0.42;
  mesh(c, G.box(0.44, 0.04, 0.42), m.frame, { p: [0, H, 0] });
  mesh(c, G.box(0.42, 0.05, 0.4), cushion, { p: [0, H + 0.045, 0.005] });
  mesh(c, G.box(0.38, 0.02, 0.36), cushion, { p: [0, H + 0.075, 0.01] }); // phồng giữa đệm
  // Chân trước lên tới tay vịn; chân sau tới mặt ghế, hai cột lưng (khép vào trong) đỡ dải tựa cong
  for (const s of [-1, 1]) {
    taperLeg(c, m.frameUp, s * 0.19, 0.17, 0.62, 0.045);
    taperLeg(c, m.frameUp, s * 0.19, -0.17, H, 0.045);
    mesh(c, G.box(0.035, 0.3, 0.03), m.frameUp, { p: [s * 0.13, 0.58, -0.165], r: [-0.08, 0, 0] });
    mesh(c, G.box(0.025, 0.025, 0.34), m.frame, { p: [s * 0.19, 0.14, 0] }); // giằng hông
    // Tay vịn: từ đầu dải tựa (z 0) dốc xuống đỉnh chân trước
    mesh(c, G.box(0.045, 0.03, 0.2), m.frame, { p: [s * 0.2, 0.665, 0.085], r: [0.5, 0, 0] });
  }
  mesh(c, G.box(0.34, 0.025, 0.025), m.frame, { p: [0, 0.14, 0.17] }); // giằng trước
  // Dải tựa cong: nửa vòng xuyến nằm ngang ôm phía sau, kéo dày theo chiều đứng thành bản gỗ
  mesh(c, G.torus(0.2, 0.02, 4, 18, Math.PI), m.frame, { p: [0, 0.72, 0], r: [-Math.PI / 2, 0, 0], s: [1, 1, 3.2] });
}

/**
 * Đồ trên bàn quán Nhật: hộp giấy trắng có tờ giấy rút lên, khay gỗ nhỏ với cặp lọ nước tương (nắp đỏ / nắp đen) +
 * hũ ớt bột shichimi, chồng đĩa chấm sứ trắng viền chàm. Cùng kiểu đặt với khay quán Việt (placeCaddy).
 */
export function buildJpSet(g: THREE.Object3D, top: number, seed = 1, at: { x?: number; z?: number; rot?: number; scale?: number } = {}): void {
  const rnd = seeded(seed * 277 + 3);
  const jit = (a: number) => (rnd() * 2 - 1) * a;
  const t = group(g, { p: [at.x ?? 0, top, at.z ?? 0], r: [0, (at.rot ?? 0) + jit(0.12), 0], s: at.scale ?? 1 });
  // Hộp giấy
  const box = group(t, { p: [-0.1, 0, 0], r: [0, jit(0.15), 0] });
  mesh(box, G.box(0.13, 0.08, 0.11), 0xf6f3ec, { p: [0, 0.04, 0] });
  mesh(box, G.box(0.06, 0.004, 0.02), 0xd9d2c5, { p: [0, 0.081, 0], cast: false });
  mesh(box, G.box(0.05, 0.05, 0.004), 0xffffff, { p: [0, 0.1, 0], r: [0.25, 0, 0.15], cast: false }); // tờ giấy
  // Khay gỗ + cặp lọ + hũ shichimi
  const tray = group(t, { p: [0.07, 0, -0.01] });
  mesh(tray, G.box(0.15, 0.012, 0.08), 0xc9975c, { p: [0, 0.006, 0] });
  for (const [x, cap] of [[-0.045, 0xc8483a], [0.0, 0x2a2d35]] as const) {
    mesh(tray, G.cyl(0.018, 0.022, 0.07, 10), toon(0xf3f3f3, { transparent: true, opacity: 0.85 }), { p: [x, 0.047, 0] });
    mesh(tray, G.cyl(0.014, 0.014, 0.03, 10), 0x3a1f14, { p: [x, 0.03, 0], cast: false }); // nước tương bên trong
    mesh(tray, G.cyl(0.02, 0.02, 0.018, 10), cap, { p: [x, 0.09, 0] });
  }
  mesh(tray, G.cyl(0.017, 0.017, 0.05, 8), 0x8a3a2a, { p: [0.048, 0.037, 0] }); // shichimi
  mesh(tray, G.cyl(0.018, 0.018, 0.01, 8), 0x2a2d35, { p: [0.048, 0.067, 0] });
  // Chồng đĩa chấm
  const plates = group(t, { p: [0.02, 0, 0.09] });
  for (let i = 0; i < 3; i++) {
    mesh(plates, G.cyl(0.045, 0.035, 0.012, 14), 0xfaf8f2, { p: [jit(0.004), 0.006 + i * 0.013, jit(0.004)] });
    mesh(plates, G.torus(0.043, 0.003, 4, 14), 0x3b5a8a, { p: [0, 0.013 + i * 0.013, 0], r: [Math.PI / 2, 0, 0], cast: false });
  }
}

// ---------- Quán Hàn: bàn nướng mặt gỗ xám, chân tủ kim loại đen, ghế da bò chân sắt ----------

const GRATE = 0x9aa0a8;

/**
 * Bàn nướng BBQ kiểu Hàn: mặt gỗ xám (vân gỗ chung `woodMats`, tô màu "mặt bàn"), viền mép sẫm, vỉ nướng tròn âm
 * giữa bàn (hút khói dưới bàn nên không có ống treo trần), chân là tủ kim loại đen có khe tản nhiệt + nhãn trắng,
 * đế lùi vào trong. `metal` = vật liệu khung (màu "chân bàn" của bộ nội thất).
 */
/** Vỉ nướng âm giữa bàn (tâm ở gốc của `t`, mặt bàn cao `top`): vành inox, lòng đen, than hồng, vỉ thanh song song + vòng tròn. */
export function buildGrillInset(t: THREE.Object3D, top: number): void {
  mesh(t, G.cyl(0.25, 0.25, 0.012, 24), 0x1f2126, { p: [0, top + 0.002, 0] });
  mesh(t, G.torus(0.25, 0.018, 5, 24), 0xc9ced6, { p: [0, top + 0.008, 0], r: [Math.PI / 2, 0, 0] });
  mesh(t, G.cyl(0.07, 0.07, 0.006, 16), 0xe2703a, { p: [0, top + 0.006, 0], cast: false });
  for (const r of [0.1, 0.18]) mesh(t, G.torus(r, 0.006, 4, 22), GRATE, { p: [0, top + 0.016, 0], r: [Math.PI / 2, 0, 0], cast: false });
  for (let i = -4; i <= 4; i++) {
    const z = i * 0.05;
    mesh(t, G.box(2 * Math.sqrt(Math.max(0, 0.235 ** 2 - z * z)), 0.006, 0.008), GRATE, { p: [0, top + 0.018, z], cast: false });
  }
}

export function buildGrillTable(g: THREE.Object3D, w: number, d: number, top: number, m: WoodMats, metal: THREE.Material, seed = 1): void {
  const L = Math.max(w, d);
  const D = Math.min(w, d);
  const t = group(g, { r: [0, d > w ? Math.PI / 2 : 0, 0] });
  const th = 0.05;
  mesh(t, G.box(L, th, D), m.planks[seed % 3], { p: [0, top - th / 2, 0] });
  mesh(t, G.box(L + 0.01, 0.018, D + 0.01), 0x6b6862, { p: [0, top - th + 0.009, 0], cast: false }); // viền mép dưới
  buildGrillInset(t, top);
  // Tủ chân kim loại đen
  const cw = L - 0.5;
  const cd = D - 0.6;
  const ch = top - th - 0.08;
  mesh(t, G.box(cw, ch, cd), metal, { p: [0, 0.08 + ch / 2, 0] });
  mesh(t, G.box(cw - 0.1, 0.08, cd - 0.08), 0x1c1e22, { p: [0, 0.04, 0] }); // đế lùi
  mesh(t, G.box(cw + 0.04, 0.03, cd + 0.04), metal, { p: [0, 0.08 + ch - 0.015, 0] }); // gờ trên
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) mesh(t, G.box(cw * 0.32, 0.012, 0.006), 0x4a4e56, { p: [-cw * 0.22, 0.3 + i * 0.05, s * (cd / 2 + 0.003)], cast: false }); // khe tản nhiệt
    mesh(t, G.box(0.08, 0.05, 0.006), 0xf3f3f3, { p: [cw * 0.25, 0.55, s * (cd / 2 + 0.004)], cast: false }); // nhãn
  }
}

/**
 * Ghế da bò chân sắt (nhìn về +z): đệm ngồi bọc da màu "ghế" có đường chỉ viền sẫm, lưng tựa bọc da gồm 3 mảng ghép
 * hơi cong ôm người, khung sắt đen mảnh dưới đệm, 4 chân ống đen hơi choãi + giằng hai bên.
 */
export function buildLeatherChair(chair: THREE.Object3D, leather: THREE.Material, seed = 1): void {
  const rnd = seeded(seed * 389 + 11);
  const c = group(chair, { p: [(rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.05], r: [0, (rnd() - 0.5) * 0.12, 0] });
  const black = 0x23252a;
  const seam = 0x6b3f1f;
  const H = 0.44;
  mesh(c, G.box(0.4, 0.025, 0.38), black, { p: [0, H - 0.012, 0] }); // khung đỡ đệm
  mesh(c, G.box(0.44, 0.07, 0.42), leather, { p: [0, H + 0.035, 0] });
  mesh(c, G.box(0.4, 0.02, 0.38), leather, { p: [0, H + 0.075, 0.005] }); // đệm phồng
  mesh(c, G.box(0.445, 0.006, 0.425), seam, { p: [0, H + 0.05, 0], cast: false }); // đường chỉ viền
  // Lưng tựa: mảng giữa + 2 mảng hông xoay vào trong, ngả ra sau
  const back = group(c, { p: [0, H + 0.1, -0.2], r: [-0.14, 0, 0] });
  mesh(back, G.box(0.26, 0.32, 0.06), leather, { p: [0, 0.17, 0] });
  for (const s of [-1, 1]) mesh(back, G.box(0.11, 0.32, 0.06), leather, { p: [s * 0.175, 0.17, 0.03], r: [0, -s * 0.45, 0] });
  mesh(back, G.box(0.27, 0.006, 0.065), seam, { p: [0, 0.26, 0], cast: false });
  mesh(back, G.box(0.06, 0.1, 0.03), black, { p: [0, -0.04, -0.01] }); // tai nối lưng với khung
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) mesh(c, G.cyl(0.014, 0.012, H, 6), black, { p: [sx * 0.18, H / 2, sz * 0.16], r: [-sz * 0.06, 0, sx * 0.06] });
    mesh(c, G.box(0.012, 0.012, 0.34), black, { p: [sx * 0.185, 0.16, 0] }); // giằng hông
  }
}

/**
 * Đồ trên bàn nướng Hàn (đặt sát mép, chừa chỗ cho vỉ nướng): kệ menu mica dựng đứng có hình món, hộp giấy inox,
 * ống inox cắm đũa dẹt + muỗng dài, chai soju xanh.
 */
export function buildKrSet(g: THREE.Object3D, top: number, seed = 1, at: { x?: number; z?: number; rot?: number; scale?: number } = {}): void {
  const rnd = seeded(seed * 521 + 7);
  const jit = (a: number) => (rnd() * 2 - 1) * a;
  const t = group(g, { p: [at.x ?? 0, top, at.z ?? 0], r: [0, (at.rot ?? 0) + jit(0.1), 0], s: at.scale ?? 1 });
  // Kệ menu: đế + tấm mica, mặt trước có hình món (khối màu) + dải chữ
  const menu = group(t, { p: [-0.12, 0, 0], r: [0, jit(0.2), 0] });
  mesh(menu, G.box(0.1, 0.012, 0.05), 0xdcdfe4, { p: [0, 0.006, 0] });
  mesh(menu, G.box(0.1, 0.15, 0.006), 0xf6f3ec, { p: [0, 0.085, 0], r: [-0.12, 0, 0] });
  const pic = group(menu, { p: [0, 0.085, 0.006], r: [-0.12, 0, 0] });
  mesh(pic, G.box(0.085, 0.07, 0.004), rnd() < 0.5 ? 0xd9433a : 0xe2703a, { p: [0, 0.025, 0], cast: false });
  mesh(pic, G.box(0.07, 0.012, 0.004), 0x2a2d35, { p: [0, -0.04, 0], cast: false });
  // Hộp giấy inox
  const nap = group(t, { r: [0, jit(0.15), 0] });
  mesh(nap, G.box(0.1, 0.07, 0.07), 0xc9ced6, { p: [0, 0.035, 0] });
  mesh(nap, G.box(0.05, 0.035, 0.004), 0xffffff, { p: [0, 0.085, 0], r: [0.2, 0, 0.1], cast: false });
  // Ống inox: đũa dẹt + muỗng dài
  const can = group(t, { p: [0.1, 0, 0] });
  mesh(can, G.cyl(0.03, 0.03, 0.1, 12), 0xb7bdc6, { p: [0, 0.05, 0] });
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    mesh(can, G.box(0.006, 0.2, 0.003), 0xdde1e6, { p: [Math.cos(a) * 0.012, 0.13, Math.sin(a) * 0.012], r: [jit(0.15), 0, jit(0.15)], cast: false });
  }
  for (let i = 0; i < 2; i++) {
    const sp = group(can, { p: [jit(0.01), 0.13, jit(0.01)], r: [jit(0.15), 0, jit(0.15)] });
    mesh(sp, G.box(0.006, 0.2, 0.004), 0xdde1e6, { cast: false });
    mesh(sp, G.sphere(0.016, 8, 6), 0xdde1e6, { p: [0, 0.11, 0], s: [1, 1.3, 0.35], cast: false });
  }
  // Chai soju
  const glass = toon(0x5fd08a, { transparent: true, opacity: 0.85 });
  const sj = group(t, { p: [0.17, 0, 0.03] });
  mesh(sj, G.cyl(0.028, 0.03, 0.13, 12), glass, { p: [0, 0.065, 0] });
  mesh(sj, G.cyl(0.012, 0.024, 0.05, 10), glass, { p: [0, 0.155, 0] });
  mesh(sj, G.cyl(0.013, 0.013, 0.02, 10), 0x2f9e4a, { p: [0, 0.19, 0] });
  mesh(sj, G.box(0.04, 0.035, 0.003), 0xf3f3f3, { p: [0, 0.065, 0.03], cast: false });
}

// ---------- Quầy ghế đơn (Nhật / Hàn): thân quầy + ghế cao cùng bộ với bàn ghế mới ----------

let glowStrip: THREE.MeshToonMaterial | null = null;

/**
 * Thân quầy chạy dọc x, sâu d, mặt quầy cao `top`; mặt khách ngồi là +z.
 * Nhật: mặt gỗ sồi dày nhô ra phía khách, vách trước là nan gỗ dọc, dải đèn vàng ấm hắt dưới mép, chân đế sẫm lùi vào.
 * Hàn: mặt gỗ xám, thân kim loại đen có hai đường nẹp ngang, thanh gác chân inox chạy dọc phía khách.
 * `ends` = false cho các khúc quầy nối (không có mép bo hai đầu).
 */
export function buildBarCounter(g: THREE.Object3D, style: 'jp' | 'kr', w: number, d: number, top: number, m: WoodMats, base: THREE.Material): void {
  const th = 0.06;
  const over = 0.12; // mặt quầy nhô ra phía khách
  mesh(g, G.box(w, th, d + over), m.planks[1], { p: [0, top - th / 2, over / 2] });
  const bh = top - th;
  if (style === 'jp') {
    mesh(g, G.box(w, bh - 0.1, d), m.frame, { p: [0, 0.1 + (bh - 0.1) / 2, 0] });
    mesh(g, G.box(w, 0.1, d - 0.08), 0x3b2a1e, { p: [0, 0.05, -0.02] }); // chân đế lùi
    const n = Math.max(2, Math.round(w / 0.085));
    for (let i = 0; i < n; i++) mesh(g, G.box(0.035, bh - 0.16, 0.025), m.frameUp, { p: [-w / 2 + (i + 0.5) * (w / n), 0.12 + (bh - 0.16) / 2, d / 2 + 0.012] }); // nan gỗ dọc
    mesh(g, G.box(w, 0.04, 0.03), m.frame, { p: [0, bh - 0.02, d / 2 + 0.015] }); // nẹp trên nan
    glowStrip ??= new THREE.MeshToonMaterial({ color: 0xffe2a8, emissive: 0xffc26a, emissiveIntensity: 0.6 });
    mesh(g, G.box(w - 0.04, 0.012, 0.04), glowStrip, { p: [0, top - th - 0.008, d / 2 + over - 0.05], cast: false }); // dải đèn hắt dưới mép
  } else {
    mesh(g, G.box(w, bh - 0.08, d), base, { p: [0, 0.08 + (bh - 0.08) / 2, 0] });
    mesh(g, G.box(w, 0.08, d - 0.08), 0x1c1e22, { p: [0, 0.04, -0.02] });
    for (const y of [0.4, bh - 0.12]) mesh(g, G.box(w, 0.018, 0.008), 0x5a5f68, { p: [0, y, d / 2 + 0.004], cast: false }); // nẹp ngang
    mesh(g, G.box(w - 0.1, 0.03, 0.03), 0xc9ced6, { p: [0, 0.26, d / 2 + 0.13] }); // thanh gác chân
    for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) mesh(g, G.box(0.03, 0.03, 0.13), 0xc9ced6, { p: [x, 0.26, d / 2 + 0.065] });
  }
}

/**
 * Ghế cao quầy (nhìn về +z, mặt ngồi ~0.74 m). Nhật: khung gỗ sồi 4 chân thuôn choãi, gác chân 4 phía, đệm vải màu
 * "ghế", tựa lưng thấp là dải gỗ cong như ghế bàn. Hàn: đệm + tựa da bò, 4 chân sắt đen mảnh, vòng gác chân.
 */
export function buildBarStool(chair: THREE.Object3D, style: 'jp' | 'kr', m: WoodMats, cushion: THREE.Material, seed = 1): void {
  const rnd = seeded(seed * 733 + 19);
  const c = group(chair, { p: [(rnd() - 0.5) * 0.03, 0, (rnd() - 0.5) * 0.04], r: [0, (rnd() - 0.5) * 0.2, 0] });
  const H = 0.7;
  if (style === 'jp') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      mesh(c, G.cyl(0.026, 0.02, H, 4), m.frameUp, { p: [sx * 0.155, H / 2, sz * 0.15], r: [-sz * 0.05, Math.PI / 4, sx * 0.05] });
    }
    for (const s of [-1, 1]) {
      mesh(c, G.box(0.36, 0.025, 0.025), m.frame, { p: [0, 0.26, s * 0.165] }); // gác chân trước / sau
      mesh(c, G.box(0.025, 0.025, 0.34), m.frame, { p: [s * 0.17, 0.3, 0] });
    }
    mesh(c, G.box(0.38, 0.035, 0.36), m.frame, { p: [0, H, 0] });
    mesh(c, G.box(0.36, 0.05, 0.34), cushion, { p: [0, H + 0.04, 0] });
    for (const s of [-1, 1]) mesh(c, G.box(0.03, 0.22, 0.03), m.frameUp, { p: [s * 0.1, H + 0.13, -0.15] });
    mesh(c, G.torus(0.17, 0.016, 4, 16, Math.PI), m.frame, { p: [0, H + 0.25, -0.02], r: [-Math.PI / 2, 0, 0], s: [1, 1, 2.6] });
  } else {
    const black = 0x23252a;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(c, G.cyl(0.013, 0.011, H, 6), black, { p: [sx * 0.15, H / 2, sz * 0.14], r: [-sz * 0.06, 0, sx * 0.06] });
    mesh(c, G.torus(0.17, 0.012, 4, 20), black, { p: [0, 0.26, 0], r: [Math.PI / 2, 0, 0] }); // vòng gác chân
    mesh(c, G.box(0.34, 0.025, 0.32), black, { p: [0, H - 0.012, 0] });
    mesh(c, G.box(0.38, 0.07, 0.36), cushion, { p: [0, H + 0.035, 0] });
    mesh(c, G.box(0.385, 0.006, 0.365), 0x6b3f1f, { p: [0, H + 0.05, 0], cast: false }); // chỉ viền
    const back = group(c, { p: [0, H + 0.08, -0.17], r: [-0.12, 0, 0] });
    mesh(back, G.box(0.2, 0.18, 0.05), cushion, { p: [0, 0.1, 0] });
    for (const s of [-1, 1]) mesh(back, G.box(0.1, 0.18, 0.05), cushion, { p: [s * 0.14, 0.1, 0.025], r: [0, -s * 0.45, 0] });
    mesh(back, G.box(0.05, 0.08, 0.025), black, { p: [0, -0.02, -0.01] });
  }
}
