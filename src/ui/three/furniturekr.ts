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
