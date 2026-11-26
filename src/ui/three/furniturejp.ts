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

let slabMats: { top: THREE.MeshToonMaterial; edge: THREE.MeshToonMaterial; fleck: THREE.MeshToonMaterial } | null = null;

/**
 * Bàn đá quán Nhật (bộ sang trọng — 'stone_jp'): mặt là phiến đá granite nguyên khối dày, mặt trên mài nhẵn có đốm,
 * mép đẽo thô (các mảng đá lồi lõm sẫm hơn chạy quanh); một đầu kê trên khối đá cuội tròn, đầu kia kê khối đá
 * chẻ xếp chồng. Ghế là đôn gỗ hộp vuông (gỗ ấm tương phản với đá).
 */
export function buildStoneTable(g: THREE.Object3D, w: number, d: number, top: number, _m: WoodMats, seed = 1): void {
  stoneMat ??= toon(0x9a958b);
  slabMats ??= { top: toon(0xc9c3b6), edge: toon(0x8f897e), fleck: toon(0xa29c90) };
  const S = slabMats;
  const rnd = seeded(seed * 3923 + 11);
  const t = group(g, { r: [0, (rnd() - 0.5) * 0.02, 0] });
  const T = 0.13;
  // Phiến đá: lõi + mặt mài nhẵn hơi nhỏ hơn mép
  mesh(t, G.box(w - 0.06, T - 0.02, d - 0.06), S.edge, { p: [0, top - T / 2 - 0.01, 0] });
  mesh(t, G.box(w - 0.1, 0.02, d - 0.1), S.top, { p: [0, top - 0.01, 0] });
  // Mép đẽo thô: các mảng đá dày mỏng, lồi lõm khác nhau quanh 4 cạnh
  const chunk = (x: number, z: number, lx: number, lz: number) => {
    const h = T * (0.75 + rnd() * 0.25);
    mesh(t, G.box(lx, h, lz), rnd() < 0.5 ? S.edge : stoneMat!, { p: [x, top - h / 2 - rnd() * 0.012, z], r: [0, (rnd() - 0.5) * 0.08, 0] });
  };
  const nx = Math.max(4, Math.round(w / 0.32));
  for (let i = 0; i < nx; i++) {
    const x = -w / 2 + (w / nx) * (i + 0.5);
    for (const sz of [-1, 1]) chunk(x, sz * (d / 2 - 0.035 + (rnd() - 0.5) * 0.025), w / nx + 0.01, 0.08);
  }
  const nz = Math.max(2, Math.round(d / 0.32));
  for (let i = 0; i < nz; i++) {
    const z = -d / 2 + (d / nz) * (i + 0.5);
    for (const sx of [-1, 1]) chunk(sx * (w / 2 - 0.035 + (rnd() - 0.5) * 0.025), z, 0.08, d / nz + 0.01);
  }
  // Đốm hạt đá trên mặt
  for (let i = 0; i < Math.round(w * d * 8); i++) {
    mesh(t, G.cyl(0.012 + rnd() * 0.02, 0.012, 0.004, 6), S.fleck, { p: [(rnd() - 0.5) * (w - 0.2), top + 0.001, (rnd() - 0.5) * (d - 0.2)], cast: false, receive: false });
  }
  const legH = top - T;
  // Đầu trái: đá cuội tròn (cầu dẹt) đỡ thẳng mặt bàn
  const sx = -w / 2 + 0.38;
  const r = Math.min(0.32, d * 0.4);
  mesh(t, G.sphere(1, 14, 10), stoneMat, { p: [sx, legH * 0.5, 0], s: [r, legH * 0.52, r * 0.95] });
  // Đầu phải: khối đá chẻ xếp chồng 3 lớp, lệch nhau
  const bx = w / 2 - 0.36;
  const bd = Math.min(0.5, d * 0.7);
  for (let i = 0; i < 3; i++) {
    const h = legH / 3;
    mesh(t, G.box(0.44 - i * 0.03 + (rnd() - 0.5) * 0.04, h - 0.006, bd - i * 0.03), i % 2 ? S.edge : stoneMat, { p: [bx + (rnd() - 0.5) * 0.03, h * i + h / 2, (rnd() - 0.5) * 0.03], r: [0, (rnd() - 0.5) * 0.12, 0] });
  }
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
