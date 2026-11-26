import * as THREE from 'three';
import { buildGrillTable, buildLeatherChair, type WoodMats } from './furniture';
import { G, group, mesh, seeded, toon } from './toon';

/**
 * BÀN GHẾ NÂNG CẤP QUÁN HÀN:
 *  - 'drum_kr' Bàn thùng phuy (quán nhậu pocha): thùng phuy thép có gân, vỉ nướng than tròn trên miệng; ghế đôn tròn
 *    chân sắt đệm đỏ. Bàn 4 / bàn 6 = 2 / 3 thùng phuy kê sát nhau (joinedTables).
 *  - 'walnut_kr' Bộ sang trọng: bàn nướng gỗ óc chó (như bàn nướng mặc định) + ống hút khói đồng thả từ trần xuống
 *    trên vỉ; ghế da bò (màu theo nội thất).
 * Gốc bàn ở tâm mặt đất, mặt bàn cao `top`; gốc ghế ở tâm đất, khách nhìn về +z.
 */

let drumMats: { body: THREE.MeshToonMaterial; rib: THREE.MeshToonMaterial; cushion: THREE.MeshToonMaterial; leg: THREE.MeshToonMaterial; copper: THREE.MeshToonMaterial } | null = null;

function mats() {
  drumMats ??= { body: toon(0x5f7f86), rib: toon(0x4b666c), cushion: toon(0xc8352e), leg: toon(0x3a3d42), copper: toon(0xc07a45) };
  return drumMats;
}

/** Một thùng phuy nướng (tròn, nằm gọn trong w × d). */
export function buildDrumTable(g: THREE.Object3D, w: number, d: number, top: number, seed = 1): void {
  const m = mats();
  const rnd = seeded(seed * 811 + 7);
  const r = Math.min(w, d) / 2 - 0.08;
  const t = group(g, { r: [0, rnd() * Math.PI, 0] });
  mesh(t, G.cyl(r, r, top - 0.03, 20), m.body, { p: [0, (top - 0.03) / 2, 0] });
  for (const y of [0.05, top * 0.36, top * 0.68]) mesh(t, G.torus(r + 0.004, 0.014, 5, 22), m.rib, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], cast: false });
  // Mặt bàn tròn rộng hơn thân + vành, vỉ than giữa
  mesh(t, G.cyl(r + 0.1, r + 0.1, 0.035, 22), m.rib, { p: [0, top - 0.017, 0] });
  mesh(t, G.cyl(0.24, 0.24, 0.012, 20), 0x1f2126, { p: [0, top + 0.003, 0] });
  mesh(t, G.cyl(0.11, 0.11, 0.008, 14), 0xe2703a, { p: [0, top + 0.007, 0], cast: false });
  mesh(t, G.torus(0.24, 0.016, 5, 22), 0xc9ced6, { p: [0, top + 0.01, 0], r: [Math.PI / 2, 0, 0], cast: false });
  for (let i = -4; i <= 4; i++) {
    const z = i * 0.05;
    mesh(t, G.box(2 * Math.sqrt(Math.max(0, 0.225 ** 2 - z * z)), 0.006, 0.008), 0x8a8f96, { p: [0, top + 0.018, z], cast: false });
  }
}

/** Ghế đôn tròn chân sắt, đệm đỏ (ghế quán pocha). */
export function buildDrumStool(chair: THREE.Object3D, seed = 1): void {
  const m = mats();
  const rnd = seeded(seed * 613 + 1);
  const c = group(chair, { p: [(rnd() - 0.5) * 0.05, 0, (rnd() - 0.5) * 0.05] });
  const H = 0.44;
  mesh(c, G.cyl(0.19, 0.18, 0.07, 16), m.cushion, { p: [0, H - 0.035, 0] });
  mesh(c, G.torus(0.17, 0.012, 4, 16), m.leg, { p: [0, 0.14, 0], r: [Math.PI / 2, 0, 0], cast: false });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    mesh(c, G.cyl(0.013, 0.013, H - 0.07, 6), m.leg, { p: [Math.cos(a) * 0.14, (H - 0.07) / 2, Math.sin(a) * 0.14], r: [Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1] });
  }
}

/** Bàn nướng gỗ óc chó + ống hút khói đồng thả từ trần xuống trên vỉ. */
export function buildWalnutGrill(g: THREE.Object3D, w: number, d: number, top: number, m: WoodMats, seed = 1): void {
  const c = mats();
  buildGrillTable(g, w, d, top, m, c.leg, seed);
  const hoodY = top + 0.62;
  mesh(g, G.cyl(0.08, 0.3, 0.22, 20), c.copper, { p: [0, hoodY, 0] });
  mesh(g, G.torus(0.3, 0.015, 5, 22), c.rib, { p: [0, hoodY - 0.11, 0], r: [Math.PI / 2, 0, 0], cast: false });
  mesh(g, G.cyl(0.075, 0.075, 1.2, 14), c.copper, { p: [0, hoodY + 0.71, 0] });
  for (const y of [0.3, 0.75]) mesh(g, G.torus(0.078, 0.01, 4, 14), c.rib, { p: [0, hoodY + y, 0], r: [Math.PI / 2, 0, 0], cast: false });
}

/** Ghế da bò của bộ sang trọng (giữ kiểu ghế mặc định, màu theo nội thất). */
export function buildWalnutChair(chair: THREE.Object3D, leather: THREE.Material, seed = 1): void {
  buildLeatherChair(chair, leather, seed);
}

const CRATE_COLORS = [0xc8322c, 0xeee3c8];
const CUSHION_COLORS = [0xb02a26, 0x24262b];

/**
 * Ghế két bia (bậc 2 'crate_kr', kiểu quán nướng nhậu): két nhựa đựng chai (khung + vách có ô thoáng, lỗ quai,
 * thấy cổ chai bên trong), trên đặt nệm vuông bọc da. Màu két / nệm xen kẽ theo seed (đỏ / kem, đỏ / đen).
 * Không in nhãn hãng bia nào.
 */
export function buildCrateSeat(chair: THREE.Object3D, seed = 1): void {
  const rnd = seeded(seed * 977 + 13);
  const c = group(chair, { p: [(rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.04], r: [0, (rnd() - 0.5) * 0.12, 0] });
  const crate = toon(CRATE_COLORS[seed % 2]);
  const dark = toon(0x2b2b2e);
  const W = 0.44;
  const D = 0.36;
  const H = 0.3;
  // Đáy + 4 trụ góc + viền trên + đai giữa
  mesh(c, G.box(W, 0.03, D), crate, { p: [0, 0.015, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(c, G.box(0.04, H, 0.04), crate, { p: [sx * (W / 2 - 0.02), H / 2, sz * (D / 2 - 0.02)] });
  for (const y of [H - 0.02, H * 0.45]) {
    for (const sz of [-1, 1]) mesh(c, G.box(W, 0.04, 0.025), crate, { p: [0, y, sz * (D / 2 - 0.012)] });
    for (const sx of [-1, 1]) mesh(c, G.box(0.025, 0.04, D), crate, { p: [sx * (W / 2 - 0.012), y, 0] });
  }
  // Vách dưới kín (có lỗ quai sẫm ở hai đầu) + cổ chai thò lên giữa các ô
  for (const sz of [-1, 1]) mesh(c, G.box(W - 0.04, H * 0.38, 0.015), crate, { p: [0, H * 0.22, sz * (D / 2 - 0.01)] });
  for (const sx of [-1, 1]) {
    mesh(c, G.box(0.015, H * 0.38, D - 0.04), crate, { p: [sx * (W / 2 - 0.01), H * 0.22, 0] });
    mesh(c, G.box(0.02, 0.035, 0.12), dark, { p: [sx * (W / 2 - 0.004), H - 0.06, 0], cast: false });
  }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) mesh(c, G.cyl(0.025, 0.03, 0.12, 8), 0x6b4a2a, { p: [-0.12 + i * 0.12, H * 0.62, -0.07 + j * 0.14], cast: false });
  // Nệm vuông bọc da
  const cushion = toon(CUSHION_COLORS[(seed >> 1) % 2]);
  mesh(c, G.box(W + 0.02, 0.12, D + 0.04), cushion, { p: [0, H + 0.06, 0] });
  mesh(c, G.box(W + 0.03, 0.02, D + 0.05), dark, { p: [0, H + 0.005, 0], cast: false });
}
