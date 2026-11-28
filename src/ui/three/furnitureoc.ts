import * as THREE from 'three';
import { G, group, mesh, seeded, toon } from './toon';

/**
 * BÀN GHẾ NÂNG CẤP QUÁN ỐC (bậc 2, sau bàn nhựa mặc định):
 *  - Bàn inox gấp: mặt inox bo góc có viền gập mép; mỗi đầu bàn hai chân ống + vòng chữ U (gông gấp)
 *    (kiểu bàn inox gấp quán nhậu vỉa hè), giằng thấp nối các chân.
 *  - Ghế nhựa lưng nan ngang: ghế nhựa đúc màu đỏ đô, lưng cao bo tròn với các nan ngang, chân vuông choãi.
 * Gốc bàn ở tâm mặt đất, mặt bàn cao `top`; gốc ghế ở tâm đất, khách nhìn về +z (lưng ghế phía -z).
 */

let inoxTop: THREE.MeshToonMaterial | null = null;
let inoxTube: THREE.MeshToonMaterial | null = null;
let inoxEdge: THREE.MeshToonMaterial | null = null;

function inoxMats() {
  inoxTop ??= toon(0xcdd3db);
  inoxTube ??= toon(0xaeb5be);
  inoxEdge ??= toon(0xc6ccd4);
  return { top: inoxTop, tube: inoxTube, edge: inoxEdge };
}

/** Ống tròn nối hai điểm. */
function tube(parent: THREE.Object3D, mat: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, r = 0.016): void {
  const len = a.distanceTo(b);
  const m = mesh(parent, G.cyl(r, r, len, 8), mat, { p: [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2] });
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
}

/**
 * Bàn inox gấp (kiểu bàn inox quán nhậu): mặt inox phẳng bo góc, viền gập mép + ốp góc; mỗi đầu bàn hai chân ống
 * từ dưới mặt bàn chúi vào trong rồi bẻ ra thành bàn chân có nút cao su, giữa hai chân là vòng chữ U (gông gấp)
 * treo dưới mặt bàn; giằng ngang thấp nối hai chân mỗi đầu và hai thanh giằng dọc nối hai đầu bàn.
 */
export function buildInoxTable(g: THREE.Object3D, w: number, d: number, top: number, seed = 1): void {
  const m = inoxMats();
  const rnd = seeded(seed * 4111 + 7);
  const t = group(g, { r: [0, (rnd() - 0.5) * 0.04, 0] });
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const T = 0.025;
  mesh(t, G.box(w - 0.06, T, d), m.top, { p: [0, top - T / 2, 0] });
  mesh(t, G.box(w, T, d - 0.06), m.top, { p: [0, top - T / 2, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(t, G.cyl(0.03, 0.03, T, 10), m.top, { p: [sx * (w / 2 - 0.03), top - T / 2, sz * (d / 2 - 0.03)] });
  // Viền gập mép + ốp góc sẫm hơn
  for (const sz of [-1, 1]) mesh(t, G.box(w - 0.06, 0.04, 0.012), m.edge, { p: [0, top - 0.032, sz * (d / 2)] });
  for (const sx of [-1, 1]) mesh(t, G.box(0.012, 0.04, d - 0.06), m.edge, { p: [sx * (w / 2), top - 0.032, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(t, G.cyl(0.034, 0.034, 0.045, 10), m.tube, { p: [sx * (w / 2 - 0.03), top - 0.03, sz * (d / 2 - 0.03)], cast: false });
  const fy = top - 0.05;
  const lz = d / 2 - 0.09;
  for (const sx of [-1, 1]) {
    // Hai chân: từ dưới mặt bàn gần mép, chúi vào trong, chân hơi choãi ra theo z
    const xTop = sx * (w / 2 - 0.12);
    const xBot = sx * (w / 2 - 0.26);
    const zBot = lz + 0.05;
    const legAt = (y: number) => xTop + (xBot - xTop) * ((fy - y) / (fy - 0.06));
    for (const sz of [-1, 1]) {
      tube(t, m.tube, V(xTop, fy, sz * lz), V(xBot, 0.06, sz * zBot));
      // Bàn chân bẻ ra ngoài + nút cao su
      const foot = V(sx * (w / 2 - 0.12), 0.02, sz * zBot);
      tube(t, m.tube, V(xBot, 0.06, sz * zBot), foot, 0.015);
      mesh(t, G.box(0.06, 0.025, 0.035), 0x2f3236, { p: [foot.x + sx * 0.02, 0.012, foot.z], cast: false });
    }
    // Vòng chữ U (gông gấp) treo dưới mặt bàn giữa hai chân
    const ux = sx * (w / 2 - 0.17);
    const drop = Math.min(0.2, lz * 0.55);
    let prev = V(ux, fy, -lz);
    for (let i = 1; i <= 10; i++) {
      const ang = (i / 10) * Math.PI;
      const p = V(ux, fy - Math.sin(ang) * drop, -Math.cos(ang) * lz);
      tube(t, m.tube, prev, p, 0.013);
      prev = p;
    }
    // Giằng ngang thấp nối hai chân
    const yb = 0.16;
    const zb = lz + (zBot - lz) * ((fy - yb) / (fy - 0.06));
    tube(t, m.tube, V(legAt(yb), yb, -zb), V(legAt(yb), yb, zb), 0.014);
  }
  // Hai thanh giằng dọc nối hai đầu bàn (thấp, sát chân)
  const yl = 0.2;
  const xl = w / 2 - 0.12 - (0.14 * (fy - yl)) / (fy - 0.06);
  const zl = lz + (0.05 * (fy - yl)) / (fy - 0.06);
  for (const sz of [-1, 1]) tube(t, m.tube, V(-xl, yl, sz * zl), V(xl, yl, sz * zl), 0.014);
}

/** Ghế nhựa đúc lưng nan ngang (đỏ đô): mặt ghế lõm có mép cong, chân vuông choãi, lưng cao bo tròn với 6 nan ngang. */
export function buildSlatChair(chair: THREE.Object3D, mat: THREE.Material, seed = 1): void {
  const rnd = seeded(seed * 5233 + 1);
  const jit = (a: number) => (rnd() * 2 - 1) * a;
  const c = group(chair, { p: [jit(0.03), 0, jit(0.03)], r: [0, jit(0.12), 0] });
  const H = 0.44;
  const W = 0.44;
  const D = 0.42;
  mesh(c, G.box(W, 0.035, D), mat, { p: [0, H, 0] });
  mesh(c, G.box(W, 0.07, 0.03), mat, { p: [0, H - 0.035, D / 2] }); // mép trước cong xuống
  for (const sx of [-1, 1]) mesh(c, G.box(0.03, 0.06, D), mat, { p: [sx * (W / 2), H - 0.03, 0] }); // mép hai bên
  // 4 chân vuông, choãi ra ngoài
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = group(c, { p: [sx * (W / 2 - 0.03), H - 0.03, sz * (D / 2 - 0.03)], r: [sz * 0.08, 0, -sx * 0.08] });
    mesh(leg, G.box(0.04, H - 0.03, 0.04), mat, { p: [0, -(H - 0.03) / 2, 0] });
  }
  // Lưng cao: 2 trụ + đầu lưng bo tròn + 6 nan ngang, ngả ra sau
  const back = group(c, { p: [0, H, -D / 2 + 0.01], r: [-0.16, 0, 0] });
  const BH = 0.5;
  for (const sx of [-1, 1]) mesh(back, G.box(0.04, BH, 0.035), mat, { p: [sx * (W / 2 - 0.02), BH / 2, 0] });
  mesh(back, G.box(W, 0.06, 0.035), mat, { p: [0, BH - 0.03, 0] });
  // Đầu lưng bo tròn: thanh tròn nằm ngang + hai góc cầu
  mesh(back, G.cyl(0.035, 0.035, W - 0.04, 10), mat, { p: [0, BH, 0], r: [0, 0, Math.PI / 2] });
  for (const sx of [-1, 1]) mesh(back, G.sphere(0.035, 8, 6), mat, { p: [sx * (W / 2 - 0.02), BH, 0], cast: false });
  for (let i = 0; i < 6; i++) mesh(back, G.box(W - 0.06, 0.03, 0.025), mat, { p: [0, 0.07 + i * 0.065, 0] });
}

/** Màu ghế nhựa lưng nan (đỏ đô). */
export const SLAT_CHAIR_COLOR = 0x8e2f2a;

let bambooMats: { pole: THREE.MeshToonMaterial; slat: THREE.MeshToonMaterial; node: THREE.MeshToonMaterial } | null = null;

function bamboo() {
  bambooMats ??= { pole: toon(0xe2c48a), slat: toon(0xecd39e), node: toon(0xc9a465) };
  return bambooMats;
}

/** Cây tre đứng: ống tròn có các mắt tre (khoanh sẫm) cách đều. */
function bambooPole(parent: THREE.Object3D, x: number, z: number, h: number, r = 0.025): void {
  const m = bamboo();
  mesh(parent, G.cyl(r, r * 1.05, h, 8), m.pole, { p: [x, h / 2, z] });
  for (let y = 0.18; y < h - 0.05; y += 0.24) mesh(parent, G.cyl(r * 1.18, r * 1.18, 0.018, 8), m.node, { p: [x, y, z], cast: false });
}

/** Thanh tre nằm ngang nối hai điểm cùng độ cao (theo trục x hoặc z). */
function bambooRail(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r = 0.018): void {
  tube(parent, bamboo().pole, a, b, r);
}

/**
 * Bàn tre Quán Ốc: mặt ghép nan tre chạy dọc có khe hở, khung viền tre quanh mặt, 4 chân cây tre có mắt,
 * giằng tre thấp quanh chân + một thanh giằng dọc giữa.
 */
export function buildBambooTable(g: THREE.Object3D, w: number, d: number, top: number, seed = 1): void {
  const m = bamboo();
  const rnd = seeded(seed * 2741 + 5);
  const t = group(g, { r: [0, (rnd() - 0.5) * 0.04, 0] });
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // Nan mặt bàn chạy dọc theo x, khe hở giữa các nan
  const n = Math.max(6, Math.round(d / 0.075));
  const sw = (d - 0.04) / n;
  for (let i = 0; i < n; i++) mesh(t, G.box(w - 0.02, 0.02, sw * 0.8), m.slat, { p: [0, top - 0.01, -d / 2 + 0.02 + sw * (i + 0.5)], r: [0, 0, (rnd() - 0.5) * 0.004] });
  // Khung viền tre dưới mép mặt
  const fy = top - 0.04;
  for (const sz of [-1, 1]) bambooRail(t, V(-w / 2, fy, sz * (d / 2 - 0.02)), V(w / 2, fy, sz * (d / 2 - 0.02)), 0.022);
  for (const sx of [-1, 1]) bambooRail(t, V(sx * (w / 2 - 0.02), fy, -d / 2), V(sx * (w / 2 - 0.02), fy, d / 2), 0.022);
  // Chân + giằng thấp
  const lx = w / 2 - 0.08;
  const lz = d / 2 - 0.08;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bambooPole(t, sx * lx, sz * lz, top - 0.02, 0.028);
  for (const sz of [-1, 1]) bambooRail(t, V(-lx, 0.16, sz * lz), V(lx, 0.16, sz * lz));
  for (const sx of [-1, 1]) bambooRail(t, V(sx * lx, 0.2, -lz), V(sx * lx, 0.2, lz));
  bambooRail(t, V(-lx, 0.2, 0), V(lx, 0.2, 0));
}

/** Ghế đẩu tre vuông: mặt ghép nan tre, khung viền, 4 chân cây tre có mắt, giằng thấp hai tầng. Khách nhìn về +z. */
export function buildBambooStool(chair: THREE.Object3D, seed = 1): void {
  const m = bamboo();
  const rnd = seeded(seed * 1931 + 9);
  const c = group(chair, { p: [(rnd() - 0.5) * 0.05, 0, (rnd() - 0.5) * 0.05], r: [0, (rnd() - 0.5) * 0.2, 0] });
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const H = 0.42;
  const S = 0.38;
  for (let i = 0; i < 5; i++) mesh(c, G.box(S, 0.02, S / 5 - 0.012), m.slat, { p: [0, H - 0.01, -S / 2 + (S / 5) * (i + 0.5)] });
  for (const sz of [-1, 1]) bambooRail(c, V(-S / 2, H - 0.035, sz * (S / 2 - 0.015)), V(S / 2, H - 0.035, sz * (S / 2 - 0.015)), 0.018);
  for (const sx of [-1, 1]) bambooRail(c, V(sx * (S / 2 - 0.015), H - 0.035, -S / 2), V(sx * (S / 2 - 0.015), H - 0.035, S / 2), 0.018);
  const l = S / 2 - 0.05;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bambooPole(c, sx * l, sz * l, H - 0.02, 0.022);
  for (const sz of [-1, 1]) bambooRail(c, V(-l, 0.12, sz * l), V(l, 0.12, sz * l), 0.014);
  for (const sx of [-1, 1]) bambooRail(c, V(sx * l, 0.17, -l), V(sx * l, 0.17, l), 0.014);
}

/**
 * Quán Ốc (quán nhậu lề đường) không có bàn 4 / bàn 6 riêng: kéo bàn đôi sát nhau mà ghép - bàn 4 = 2 bàn đôi,
 * bàn 6 = 3 bàn đôi, xếp thành hàng theo chiều dài (x). Mỗi bàn con lệch / xoay chút xíu cho giống kéo tay.
 * `build(g, w, d, seed)` dựng một bàn con (gốc ở tâm).
 */
export function joinedTables(g: THREE.Object3D, w: number, d: number, seats: number, seed: number, build: (g: THREE.Object3D, w: number, d: number, seed: number) => void): void {
  const n = seats >= 6 ? 3 : seats >= 4 ? 2 : 1;
  if (n === 1) return build(g, w, d, seed);
  const rnd = seeded(seed * 1777 + 3);
  const sw = w / n;
  for (let i = 0; i < n; i++) {
    const sub = group(g, { p: [-w / 2 + sw * (i + 0.5), 0, (rnd() - 0.5) * 0.04], r: [0, (rnd() - 0.5) * 0.03, 0] });
    build(sub, sw - 0.012, d, seed + i * 7);
  }
}
