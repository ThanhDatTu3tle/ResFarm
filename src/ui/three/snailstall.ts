import * as THREE from 'three';
import { signText } from './cuisine';
import { G, group, mesh, seeded, toon } from './toon';

/**
 * QUÁN ỐC — khu bếp bếp trưởng và bếp phó (dùng ở street.ts, xem thử ở trang models).
 *  - makeSnailTable(tier): bàn inox chữ nhật bày đầy rổ nhựa đỏ / khay inox / thau trắng đựng ốc, sò, nghêu, hàu, tôm,
 *    trứng cút…; đầu bên phải có bếp ga + chảo xào lửa xanh. Bếp lên hạng thì bàn dài ra về bên trái (thêm rổ, thêm
 *    chỗ đứng cho đầu bếp khác). Gốc ở chỗ bếp trưởng đứng (giữa phần bàn đầu tiên), mặt bàn nhìn về +z.
 *  - makeCharcoalGrill(): bếp nướng than chân cao, than hồng, lưỡi lửa liếm qua vỉ, tàn lửa bay lên.
 */

const STEEL = 0xc8d0d5;
const STEEL_DK = 0x8a939b;
const TOP = 0.98;

/** Mỗi loại hải sản trong rổ: màu nền + màu con, hình con (vỏ ốc nhọn / tròn / dẹt / dài). */
type Kind = { base: number; colors: number[]; shape: 'cone' | 'ball' | 'flat' | 'long' | 'shrimp' };
const SEAFOOD: Kind[] = [
  { base: 0xd9c7a3, colors: [0xf1e3c4, 0xc9a77a, 0xe8d4ad], shape: 'cone' }, // ốc hương
  { base: 0x4a3b33, colors: [0x2f2622, 0x5a4638, 0x3a2e28], shape: 'ball' }, // ốc bươu / sò huyết
  { base: 0xcfc9bd, colors: [0xe9e4d8, 0xbdb5a6, 0xd8d1c2], shape: 'flat' }, // nghêu
  { base: 0xd8bfa0, colors: [0xe9cfa8, 0xcfae84], shape: 'long' }, // ốc móng tay
  { base: 0xe9a07a, colors: [0xf08a5a, 0xf3b07a, 0xe8744a], shape: 'shrimp' }, // tôm
  { base: 0x9a9286, colors: [0xb5ad9f, 0x7f786d, 0xa59c8e], shape: 'flat' }, // hàu
  { base: 0xe8e0cf, colors: [0xf3ecdc, 0xd9cdb5, 0x8a6a4a], shape: 'ball' }, // trứng cút lộn
  { base: 0xd9a27a, colors: [0xf0b48a, 0xe58f6a, 0xf6cfa8], shape: 'flat' }, // sò điệp
  { base: 0x5f5a52, colors: [0x7a736a, 0x4a453f, 0x8f877b], shape: 'cone' }, // ốc len
];

/** Đống hải sản trong lòng một rổ (w × d), mặt trên ở y = 0. */
function pile(parent: THREE.Object3D, w: number, d: number, kind: Kind, seed: number): void {
  const rnd = seeded(seed * 613 + 7);
  mesh(parent, G.sphere(0.5, 10, 6), kind.base, { p: [0, -0.02, 0], s: [w * 0.95, 0.11, d * 0.95], cast: false });
  const n = kind.shape === 'long' || kind.shape === 'shrimp' ? 6 : 10;
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * w * 0.75;
    const z = (rnd() - 0.5) * d * 0.7;
    const c = kind.colors[i % kind.colors.length];
    const y = 0.02 + rnd() * 0.015;
    const ry = rnd() * Math.PI;
    if (kind.shape === 'cone') mesh(parent, G.cone(0.03, 0.07, 6), c, { p: [x, y + 0.02, z], r: [1.2, ry, 0], cast: false });
    else if (kind.shape === 'ball') mesh(parent, G.sphere(0.032, 6, 5), c, { p: [x, y, z], s: [1, 0.85, 1.1], cast: false });
    else if (kind.shape === 'flat') mesh(parent, G.sphere(0.045, 7, 5), c, { p: [x, y, z], r: [0, ry, 0], s: [1, 0.4, 0.8], cast: false });
    else if (kind.shape === 'long') mesh(parent, G.box(0.16, 0.025, 0.035), c, { p: [x * 0.6, y, z], r: [0, (rnd() - 0.5) * 0.5, 0], cast: false });
    else mesh(parent, G.torus(0.04, 0.016, 4, 8, Math.PI * 1.3), c, { p: [x, y + 0.01, z], r: [Math.PI / 2, 0, ry], cast: false });
  }
}

/** Rổ nhựa đỏ có lỗ thoáng (viền + các thanh) / khay inox / thau nhựa trắng — w × d, cao h, gốc ở đáy. */
function container(parent: THREE.Object3D, x: number, z: number, w: number, d: number, style: 0 | 1 | 2, kind: Kind, seed: number): void {
  const g = group(parent, { p: [x, TOP, z] });
  const h = style === 1 ? 0.07 : 0.13;
  const color = style === 0 ? 0xe2382e : style === 1 ? STEEL : 0xf4f4f0;
  mesh(g, G.box(w - 0.04, 0.02, d - 0.04), color, { p: [0, 0.01, 0], cast: false });
  for (const sz of [-1, 1]) mesh(g, G.box(w, h, 0.02), color, { p: [0, h / 2, sz * (d / 2 - 0.01)], cast: false });
  for (const sx of [-1, 1]) mesh(g, G.box(0.02, h, d), color, { p: [sx * (w / 2 - 0.01), h / 2, 0], cast: false });
  if (style === 0) {
    // Rổ đỏ: viền trên dày + các khe lỗ thoáng sẫm màu ở mặt trước
    mesh(g, G.box(w + 0.02, 0.025, d + 0.02), 0xc92a22, { p: [0, h, 0], s: [1, 1, 1], cast: false });
    for (let i = 0; i < 5; i++) mesh(g, G.box(0.025, h * 0.5, 0.005), 0x8f1d18, { p: [-w * 0.36 + i * w * 0.18, h * 0.45, d / 2 + 0.001], cast: false });
  } else if (style === 2) mesh(g, G.box(w + 0.03, 0.02, d + 0.03), 0xffffff, { p: [0, h, 0], cast: false });
  const fill = group(g, { p: [0, h + 0.005, 0] }); // đầy ụ, nhô hơn miệng rổ
  pile(fill, w - 0.05, d - 0.05, kind, seed);
}

/** Bếp ga mini + chảo xào (đặt trên kệ thấp cạnh bàn). Trả về ngọn lửa để lập loè. */
function wokStove(parent: THREE.Object3D, x: number, z: number): THREE.Mesh[] {
  const g = group(parent, { p: [x, 0, z] });
  // Kệ sắt: 4 chân, mặt kệ, kệ dưới để bình ga
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(g, G.box(0.04, 0.82, 0.04), 0x3b3f46, { p: [sx * 0.27, 0.41, sz * 0.24] });
  mesh(g, G.box(0.6, 0.04, 0.54), 0x4a4f58, { p: [0, 0.82, 0] });
  mesh(g, G.box(0.56, 0.03, 0.5), 0x3b3f46, { p: [0, 0.18, 0] });
  mesh(g, G.cyl(0.12, 0.12, 0.42, 12), 0xd9433a, { p: [0, 0.4, -0.04] }); // bình ga đỏ
  mesh(g, G.cyl(0.05, 0.07, 0.06, 8), 0x8f9aa4, { p: [0, 0.64, -0.04] });
  // Bếp ga: thân vuông, núm vặn, kiềng 3 chân
  mesh(g, G.box(0.42, 0.1, 0.4), 0x2f333a, { p: [0, 0.89, 0] });
  mesh(g, G.cyl(0.03, 0.03, 0.03, 8), 0xe2382e, { p: [0.12, 0.89, 0.21], r: [Math.PI / 2, 0, 0], cast: false });
  mesh(g, G.torus(0.1, 0.014, 4, 14), 0x1f2226, { p: [0, 0.95, 0], r: [Math.PI / 2, 0, 0], cast: false });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.85 });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xbfe2ff, transparent: true, opacity: 0.9 });
  const flames = [mesh(g, G.cone(0.11, 0.1, 10), flameMat, { p: [0, 0.99, 0], cast: false }), mesh(g, G.cone(0.06, 0.07, 8), coreMat, { p: [0, 0.98, 0], cast: false })];
  // Chảo gang sâu lòng, tay cầm gỗ, xẻng xào, ít ốc đang xào bơ tỏi
  const wok = group(g, { p: [0, 1.06, 0], r: [0.08, 0, 0] });
  mesh(wok, G.sphere(0.2, 14, 8), 0x23262b, { s: [1, 0.45, 1] });
  mesh(wok, G.torus(0.19, 0.012, 4, 18), 0x3a3e45, { p: [0, 0.04, 0], r: [Math.PI / 2, 0, 0], cast: false });
  mesh(wok, G.cyl(0.18, 0.18, 0.01, 14), 0xc98a3a, { p: [0, 0.045, 0], cast: false }); // nước sốt bơ tỏi
  for (let i = 0; i < 6; i++) mesh(wok, G.cone(0.025, 0.06, 6), i % 2 ? 0xe9d4ad : 0x6b4a32, { p: [Math.cos(i) * 0.09, 0.06, Math.sin(i * 1.7) * 0.08], r: [1.2, i, 0], cast: false });
  mesh(wok, G.box(0.24, 0.025, 0.035), 0x6b4428, { p: [0.31, 0.05, 0], r: [0, 0, 0.18] });
  const spat = group(g, { p: [-0.08, 1.12, 0.05], r: [0, 0.4, 0.9] });
  mesh(spat, G.cyl(0.008, 0.008, 0.32, 5), STEEL_DK, { p: [0, 0.16, 0], cast: false });
  mesh(spat, G.box(0.07, 0.005, 0.08), STEEL, { p: [0, 0, 0], cast: false });
  return flames;
}

export interface SnailTable {
  g: THREE.Group;
  /** Mép trái / phải của bàn (toạ độ trong g, không tính bếp ga). */
  left: number;
  right: number;
  update(t: number): void;
}

/** Bàn bày ốc của bếp trưởng. tier 1: 2.2 m; tier ≥ 2: dài thêm `ext` m về bên trái (mặc định 1.6). */
export function makeSnailTable(tier = 1, ext = 1.6): SnailTable {
  const g = group(null);
  const right = 1.0;
  const left = -1.2 - (tier >= 2 ? ext : 0);
  const len = right - left;
  const cx = (left + right) / 2;
  const D = 0.95;
  // Khung: mặt inox, diềm xanh lá sơn (như xe ốc vỉa hè), chân sắt + bánh xe nhỏ, kệ dưới
  mesh(g, G.box(len, 0.04, D), STEEL, { p: [cx, TOP - 0.02, 0] });
  mesh(g, G.box(len + 0.04, 0.05, D + 0.04), 0xe4e9ec, { p: [cx, TOP - 0.06, 0], cast: false });
  mesh(g, G.box(len, 0.32, 0.03), 0x2f8a5a, { p: [cx, TOP - 0.24, D / 2 - 0.02] }); // diềm trước
  mesh(g, G.box(len, 0.03, 0.02), 0x23704a, { p: [cx, TOP - 0.4, D / 2 - 0.01], cast: false });
  for (const sx of [left + 0.06, right - 0.06]) mesh(g, G.box(0.03, 0.32, D), 0x2f8a5a, { p: [sx, TOP - 0.24, 0] });
  const legsX = [left + 0.06, right - 0.06];
  if (tier >= 2) legsX.push(-1.2);
  for (const lx of legsX) for (const sz of [-1, 1]) {
    mesh(g, G.box(0.05, TOP - 0.12, 0.05), STEEL_DK, { p: [lx, (TOP - 0.12) / 2 + 0.08, sz * (D / 2 - 0.06)] });
    mesh(g, G.cyl(0.05, 0.05, 0.04, 10), 0x2a2d35, { p: [lx, 0.05, sz * (D / 2 - 0.06)], r: [Math.PI / 2, 0, 0], cast: false });
  }
  mesh(g, G.box(len - 0.1, 0.03, D - 0.12), STEEL_DK, { p: [cx, 0.22, 0], cast: false }); // kệ dưới
  // Bảng đỏ trên diềm trước
  const board = group(g, { p: [right - 1.1, TOP - 0.24, D / 2 + 0.005] });
  mesh(board, G.box(1.5, 0.26, 0.015), 0xd9433a);
  const word = signText('ỐC · SÒ · HÀU', '#ffe7a3', 1.4, 0.22);
  word.position.z = 0.012;
  board.add(word);

  // Rổ / khay hải sản: hàng sau cao hơn chút (kê trên bậc inox) cho khách nhìn thấy cả hai hàng
  const step = group(g, { p: [cx, 0, -D / 2 + 0.24] });
  mesh(step, G.box(len - 0.1, 0.08, 0.42), STEEL, { p: [0, TOP + 0.04, 0], cast: false });
  const cols = Math.floor((len - 0.6) / 0.44); // chừa đầu phải ~0.5 m làm chỗ thái, đặt thớt
  let seed = 1;
  const back = group(g, { p: [0, 0.08, 0] });
  for (let i = 0; i < cols; i++) {
    const x = left + 0.3 + i * 0.44;
    const kf = SEAFOOD[(i * 2) % SEAFOOD.length];
    const kb = SEAFOOD[(i * 2 + 1) % SEAFOOD.length];
    container(g, x, 0.2, 0.4, 0.4, (i % 3 === 1 ? 1 : 0) as 0 | 1, kf, seed++);
    container(back, x, -D / 2 + 0.24, 0.4, 0.38, (i % 3 === 2 ? 2 : i % 2 ? 1 : 0) as 0 | 1 | 2, kb, seed++);
  }
  // Chỗ thái bên phải: thớt gỗ, dao, chén nước chấm, hũ ớt, rổ rau răm
  mesh(g, G.cyl(0.18, 0.18, 0.05, 14), 0xb98a55, { p: [right - 0.3, TOP + 0.025, 0.18] });
  mesh(g, G.box(0.2, 0.008, 0.05), 0xdfe5ea, { p: [right - 0.32, TOP + 0.055, 0.2], r: [0, 0.5, 0], cast: false });
  for (let k = 0; k < 3; k++) mesh(g, G.cyl(0.05, 0.035, 0.04, 10), 0xffffff, { p: [right - 0.45 + k * 0.12, TOP + 0.02, -0.38], cast: false });
  mesh(g, G.cyl(0.05, 0.05, 0.1, 10), 0xe2382e, { p: [right - 0.07, TOP + 0.05, -0.02] }); // hũ ớt
  mesh(g, G.sphere(0.09, 8, 6), 0x5aa848, { p: [right - 0.65, TOP + 0.05, -0.3], s: [1, 0.5, 1], cast: false }); // rổ rau răm
  // Dưới gầm: xô đỏ, thùng xốp trắng, chồng chén
  mesh(g, G.cyl(0.2, 0.16, 0.34, 14), 0xd93a32, { p: [left + 0.35, 0.41, 0.05] });
  mesh(g, G.box(0.55, 0.3, 0.38), 0xf5f5f0, { p: [cx + 0.2, 0.39, -0.05] });
  for (let k = 0; k < 4; k++) mesh(g, G.cyl(0.08, 0.06, 0.04, 10), 0xf3efe6, { p: [right - 0.3, 0.26 + k * 0.035, 0.1], cast: false });
  if (tier >= 2) mesh(g, G.cyl(0.2, 0.16, 0.3, 14), 0x3f7fd9, { p: [-1.6, 0.39, 0.05] }); // thau xanh dưới phần bàn nối

  // Bếp ga + chảo xào sát đầu phải bàn
  const flames = wokStove(g, right + 0.38, -0.05);
  return {
    g,
    left,
    right,
    update(t) {
      flames.forEach((f, i) => f.scale.set(1, 0.75 + Math.abs(Math.sin(t * 13 + i * 1.7)) * 0.55, 1));
    },
  };
}

export interface CharcoalGrill {
  g: THREE.Group;
  /** night 0..1: tối thì ánh lửa hắt mạnh hơn. */
  update(t: number, night: number, dt: number): void;
}

/** Bếp nướng than chân cao: thùng than, than hồng, vỉ nướng, hàu / tôm đang nướng, lưỡi lửa liếm qua vỉ, tàn lửa bay. */
export function makeCharcoalGrill(): CharcoalGrill {
  const g = group(null);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(g, G.box(0.06, 0.75, 0.06), 0x3b3f46, { p: [sx * 0.65, 0.375, sz * 0.25] });
  mesh(g, G.box(1.45, 0.3, 0.65), 0x3b3f46, { p: [0, 0.88, 0] });
  mesh(g, G.box(1.5, 0.04, 0.7), 0x2a2d35, { p: [0, 1.04, 0], cast: false }); // miệng thùng
  mesh(g, G.box(1.2, 0.03, 0.4), 0x50555e, { p: [0, 0.3, 0], cast: false }); // kệ dưới
  for (let k = 0; k < 3; k++) mesh(g, G.box(0.35, 0.18, 0.25), 0x2b2b2b, { p: [-0.4 + k * 0.4, 0.4, 0], cast: false }); // bao than
  const coals = new THREE.MeshBasicMaterial({ color: 0xff7a2a });
  const ash = toon(0x3a3330);
  mesh(g, G.box(1.3, 0.04, 0.5), coals, { p: [0, 1.04, 0], cast: false });
  const rnd = seeded(91);
  for (let k = 0; k < 16; k++) mesh(g, G.ico(0.055, 0), k % 4 === 0 ? ash : coals, { p: [-0.58 + (k % 8) * 0.165, 1.07, k < 8 ? -0.1 : 0.1], r: [rnd() * 3, rnd() * 3, 0], cast: false });
  for (let k = 0; k < 9; k++) mesh(g, G.box(0.02, 0.02, 0.6), 0x9aa1a8, { p: [-0.6 + k * 0.15, 1.15, 0], cast: false }); // vỉ nướng
  mesh(g, G.box(1.25, 0.02, 0.02), 0x9aa1a8, { p: [0, 1.15, 0.29], cast: false });
  mesh(g, G.box(1.25, 0.02, 0.02), 0x9aa1a8, { p: [0, 1.15, -0.29], cast: false });
  // Hàu nướng mỡ hành + tôm trên vỉ
  for (let k = 0; k < 4; k++) {
    const x = -0.48 + k * 0.32;
    if (k % 2 === 0) {
      mesh(g, G.sphere(0.09, 8, 5), 0x9a9286, { p: [x, 1.18, -0.08], s: [1, 0.35, 0.75], cast: false });
      mesh(g, G.sphere(0.06, 8, 5), 0xe8dcc0, { p: [x, 1.2, -0.08], s: [1, 0.3, 0.7], cast: false });
      mesh(g, G.sphere(0.03, 6, 4), 0x5aa848, { p: [x, 1.215, -0.08], s: [1.3, 0.3, 1], cast: false });
      mesh(g, G.sphere(0.09, 8, 5), 0x9a9286, { p: [x + 0.06, 1.18, 0.14], s: [1, 0.35, 0.75], cast: false });
      mesh(g, G.sphere(0.06, 8, 5), 0xe8dcc0, { p: [x + 0.06, 1.2, 0.14], s: [1, 0.3, 0.7], cast: false });
    } else {
      for (let j = 0; j < 2; j++) mesh(g, G.torus(0.05, 0.02, 4, 8, Math.PI * 1.3), 0xf08a5a, { p: [x, 1.19, -0.08 + j * 0.2], r: [Math.PI / 2, 0, j], cast: false });
    }
  }

  // Lưỡi lửa: chóp nón cam / vàng nhô lên giữa các thanh vỉ, nhảy lên xuống so le
  const outer = new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.85, depthWrite: false });
  const inner = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.9, depthWrite: false });
  const tongues: { m: THREE.Mesh; phase: number; base: number }[] = [];
  for (let k = 0; k < 9; k++) {
    const x = -0.55 + k * 0.1375 + (rnd() - 0.5) * 0.04;
    const z = (rnd() - 0.5) * 0.35;
    const m = mesh(g, G.cone(0.05, 0.22, 6), k % 3 === 1 ? inner : outer, { p: [x, 1.12, z], cast: false, receive: false });
    tongues.push({ m, phase: rnd() * 10, base: k % 3 === 1 ? 0.7 : 1 });
  }
  // Tàn lửa: hạt nhỏ bay lên, nhạt dần rồi quay lại
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffb03a, transparent: true, opacity: 1, depthWrite: false });
  const sparks: { m: THREE.Mesh; x: number; z: number; speed: number; phase: number }[] = [];
  for (let k = 0; k < 10; k++) {
    const m = mesh(g, G.box(0.025, 0.025, 0.025), sparkMat.clone(), { p: [0, 1.2, 0], cast: false, receive: false });
    sparks.push({ m, x: (rnd() - 0.5) * 1.1, z: (rnd() - 0.5) * 0.4, speed: 0.5 + rnd() * 0.5, phase: rnd() });
  }
  const fire = new THREE.PointLight(0xff8a3a, 0, 4.5, 1.6);
  fire.position.set(0, 1.45, 0.25);
  g.add(fire);

  return {
    g,
    update(t, night) {
      const flick = 0.75 + Math.sin(t * 11) * 0.12 + Math.sin(t * 23 + 1.3) * 0.08;
      coals.color.setRGB(1, 0.42 + flick * 0.12, 0.12);
      fire.intensity = (0.8 + night * 2.4) * flick;
      for (const f of tongues) {
        const k = Math.max(0, Math.sin(t * 9 + f.phase) * 0.5 + Math.sin(t * 17 + f.phase * 2) * 0.35 + 0.35);
        const h = f.base * (0.35 + k * 0.9);
        f.m.scale.set(0.8 + k * 0.3, h, 0.8 + k * 0.3);
        f.m.position.y = 1.08 + 0.11 * h;
        f.m.visible = h > 0.4;
      }
      for (const s of sparks) {
        const p = (t * s.speed * 0.6 + s.phase) % 1;
        s.m.position.set(s.x + Math.sin(t * 3 + s.phase * 9) * 0.06 * p, 1.2 + p * 1.3, s.z + p * 0.15);
        (s.m.material as THREE.MeshBasicMaterial).opacity = 1 - p;
        s.m.scale.setScalar(1 - p * 0.6);
      }
    },
  };
}
