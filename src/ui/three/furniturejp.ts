import * as THREE from 'three';
import type { WoodMats } from './furniture';
import { G, group, mesh, seeded, toon } from './toon';

/**
 * BÀN BỆT QUÁN NHẬT (bộ sang trọng duy nhất của quán Nhật — DecorDef.style 'zataku_jp'):
 *  - Bàn bệt (zataku): mặt gỗ nguyên tấm dày, hai đầu là khung chân hình thang (hai trụ choãi + thanh đế), thấp ~0.36 m.
 *  - Đôn ngồi bệt: tấm gỗ dày kê trên hai thanh đế thấp, khách ngồi xếp chân dưới bàn.
 * Dùng bộ vật liệu vân gỗ `WoodMats` của quán (màu theo nội thất). Gốc ở tâm mặt đất; khách nhìn về +z.
 */

/** Độ cao mặt bàn bệt (m). */
export const ZATAKU_TOP = 0.36;

/** Bàn bệt: mặt gỗ dày + 2 khung chân hình thang ở hai đầu (theo trục x). */
export function buildZataku(g: THREE.Object3D, w: number, d: number, top: number, m: WoodMats, seed = 1): void {
  const rnd = seeded(seed * 4523 + 1);
  const T = 0.07;
  mesh(g, G.box(w, T, d), m.planks[0], { p: [0, top - T / 2, 0], r: [0, (rnd() - 0.5) * 0.01, 0] });
  const legH = top - T;
  const lx = w / 2 - 0.22;
  const lz = d / 2 - 0.12;
  const post = 0.07;
  for (const sx of [-1, 1]) {
    const x = sx * lx;
    // Hai trụ choãi ra theo z (trên hẹp, dưới rộng) + thanh đế sát đất + thanh trên dưới mặt bàn
    for (const sz of [-1, 1]) {
      const zt = sz * (lz - 0.06);
      const zb = sz * lz;
      const p = mesh(g, G.box(post, legH, post), m.frameUp, { p: [x, legH / 2, (zt + zb) / 2] });
      p.rotation.x = -sz * Math.atan2(Math.abs(zb - zt), legH);
    }
    mesh(g, G.box(post, post * 0.8, 2 * lz + post), m.frame, { p: [x, post * 0.4, 0] });
    mesh(g, G.box(post, post * 0.7, 2 * (lz - 0.06) + post), m.frame, { p: [x, legH - post * 0.35, 0] });
  }
}

/** Đôn ngồi bệt: tấm gỗ dày kê trên hai thanh đế (cao ~0.1 m). */
export function buildFloorSeat(chair: THREE.Object3D, m: WoodMats, seed = 1): void {
  const rnd = seeded(seed * 2141 + 3);
  const c = group(chair, { p: [(rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.04], r: [0, (rnd() - 0.5) * 0.1, 0] });
  const W = 0.5;
  const D = 0.42;
  const H = 0.1;
  mesh(c, G.box(W, 0.05, D), m.seat, { p: [0, H - 0.025, 0] });
  for (const sx of [-1, 1]) mesh(c, G.box(0.06, H - 0.05, D - 0.08), m.frameUp, { p: [sx * (W / 2 - 0.08), (H - 0.05) / 2, 0] });
}

let stoneMat: THREE.MeshToonMaterial | null = null;

/**
 * Bàn đá quán Nhật (bộ sang trọng — 'stone_jp'): mặt là tấm gỗ cũ nguyên khối rất dày, mép gồ ghề (2 tấm ghép lệch),
 * một đầu kê trên khối đá cuội tròn, đầu kia kê trên khối gỗ vuông; ghế là đôn gỗ hộp vuông.
 */
export function buildStoneTable(g: THREE.Object3D, w: number, d: number, top: number, m: WoodMats, seed = 1): void {
  stoneMat ??= toon(0x9a958b);
  const rnd = seeded(seed * 3923 + 11);
  const t = group(g, { r: [0, (rnd() - 0.5) * 0.02, 0] });
  const T = 0.12;
  // Hai tấm gỗ dày ghép dọc, bề rộng lệch nhau, mép trước gồ ghề (các khúc nhỏ thò ra thụt vào)
  const split = 0.45 + (rnd() - 0.5) * 0.1;
  const d1 = d * split;
  const d2 = d - d1 - 0.01;
  mesh(t, G.box(w, T, d1), m.planks[0], { p: [0, top - T / 2, -d / 2 + d1 / 2] });
  mesh(t, G.box(w - 0.04, T * 0.92, d2), m.planks[1], { p: [0.02, top - T * 0.46, d / 2 - d2 / 2] });
  for (let i = 0; i < 5; i++) {
    const x = -w / 2 + (w / 5) * (i + 0.5);
    mesh(t, G.box(w / 5 - 0.02, T * 0.7, 0.03), m.frame, { p: [x, top - T * 0.45, d / 2 + (rnd() - 0.5) * 0.03], cast: false });
  }
  const legH = top - T;
  // Đầu trái: đá cuội tròn (cầu dẹt) đỡ thẳng mặt bàn
  const sx = -w / 2 + 0.38;
  const r = Math.min(0.32, d * 0.4);
  mesh(t, G.sphere(1, 14, 10), stoneMat, { p: [sx, legH * 0.5, 0], s: [r, legH * 0.52, r * 0.95] });
  // Đầu phải: khối gỗ vuông kê
  const bx = w / 2 - 0.35;
  mesh(t, G.box(0.42, legH, Math.min(0.5, d * 0.7)), m.frameUp, { p: [bx, legH / 2, 0] });
  for (let i = 1; i < 3; i++) mesh(t, G.box(0.43, 0.012, Math.min(0.5, d * 0.7) + 0.01), m.frame, { p: [bx, (legH / 3) * i, 0], cast: false });
}

/** Đôn gỗ hộp vuông (cao ~0.45 m): mặt gỗ dày, 4 vách ván ghép, viền ván sẫm. */
export function buildBoxStool(chair: THREE.Object3D, m: WoodMats, seed = 1): void {
  const rnd = seeded(seed * 1709 + 5);
  const c = group(chair, { p: [(rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.04], r: [0, (rnd() - 0.5) * 0.18, 0] });
  const S = 0.4;
  const H = 0.45;
  mesh(c, G.box(S, H - 0.05, S), m.frameUp, { p: [0, (H - 0.05) / 2, 0] });
  mesh(c, G.box(S + 0.03, 0.05, S + 0.03), m.planks[seed % 3], { p: [0, H - 0.025, 0] });
  for (let i = 1; i < 3; i++) mesh(c, G.box(S + 0.006, 0.01, S + 0.006), m.frame, { p: [0, ((H - 0.05) / 3) * i, 0], cast: false });
}
