import * as THREE from 'three';
import type { WoodMats } from './furniture';
import { G, group, mesh, seeded, toon } from './toon';

/**
 * BÀN GHẾ CAO CẤP QUÁN VIỆT (giai đoạn 20, chỉ quán Việt - DecorDef.style):
 *  - 'oak_vn' "Bàn ghế gỗ sồi xịn": bàn chân tiện (bầu, khoanh), mặt có gờ chỉ, giằng chữ H thấp; ghế tựa lưng có
 *    hàng con tiện nhỏ giữa hai thanh ngang (kiểu ghế gỗ nhà Việt xưa). Gỗ vàng cam (màu theo nội thất).
 *  - 'luxury_vn' "Bộ sang trọng": bàn vuông gỗ sẫm chân tiện; ghế bành tay vịn, mặt ngồi + lưng đan mây.
 * Dùng bộ vật liệu vân gỗ `WoodMats` của quán (đổi màu theo nội thất); mây có texture đan riêng.
 * Gốc bàn ở tâm mặt đất, mặt bàn cao `top`; gốc ghế ở tâm đất, khách nhìn về +z (lưng ghế phía -z).
 */

/** Chân tiện: thân tròn có bầu phình, các khoanh chỉ, chân thuôn - dựng từ dưới lên trong group tại (x, 0, z). */
function turnedLeg(parent: THREE.Object3D, mat: THREE.Material, x: number, z: number, h: number, r = 0.035): void {
  const g = group(parent, { p: [x, 0, z] });
  const k = h / 0.74;
  // [độ cao đáy, cao, bán kính trên, bán kính dưới]
  const parts: [number, number, number, number][] = [
    [0, 0.05, r * 0.75, r * 0.65], // chân thuôn
    [0.05, 0.3, r * 0.8, r * 0.75],
    [0.35, 0.05, r * 1.25, r * 1.25], // khoanh
    [0.4, 0.14, r * 1.05, r * 1.5], // bầu
    [0.54, 0.04, r * 1.2, r * 1.2],
    [0.58, 0.16, r * 1.15, r * 1.15], // khối vuông đầu chân (nối yếm)
  ];
  for (const [y, hh, rt, rb] of parts) mesh(g, G.cyl(rt, rb, hh * k, 10), mat, { p: [0, (y + hh / 2) * k, 0] });
}

/** Bàn chân tiện: mặt bàn dày có gờ chỉ, yếm bàn, 4 chân tiện, giằng thấp chữ H. */
export function buildTurnedTable(g: THREE.Object3D, w: number, d: number, top: number, m: WoodMats, style: 'oak_vn' | 'luxury_vn', seed = 1): void {
  const rnd = seeded(seed * 613 + 3);
  const T = 0.05;
  mesh(g, G.box(w, T, d), m.planks[0], { p: [0, top - T / 2, 0], r: [0, (rnd() - 0.5) * 0.01, 0] });
  mesh(g, G.box(w - 0.04, 0.025, d - 0.04), m.frame, { p: [0, top - T - 0.012, 0] }); // gờ chỉ dưới mặt
  const ap = style === 'luxury_vn' ? 0.1 : 0.08;
  const ix = w / 2 - 0.09;
  const iz = d / 2 - 0.09;
  for (const sz of [-1, 1]) mesh(g, G.box(2 * ix, ap, 0.03), m.frame, { p: [0, top - T - 0.025 - ap / 2, sz * iz] });
  for (const sx of [-1, 1]) mesh(g, G.box(0.03, ap, 2 * iz), m.frameUp, { p: [sx * ix, top - T - 0.025 - ap / 2, 0] });
  const legH = top - T - 0.025;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) turnedLeg(g, m.frameUp, sx * ix, sz * iz, legH, style === 'luxury_vn' ? 0.038 : 0.034);
  // Giằng chữ H: 2 thanh dọc hai đầu + 1 thanh giữa
  for (const sx of [-1, 1]) mesh(g, G.box(0.03, 0.035, 2 * iz), m.frameUp, { p: [sx * ix, 0.14, 0] });
  mesh(g, G.box(2 * ix, 0.035, 0.03), m.frame, { p: [0, 0.14, 0] });
}

/** Ghế tựa con tiện: mặt gỗ, chân sau vươn lên thành trụ lưng, lưng có thanh trên cong + hàng con tiện nhỏ + thanh giữa. */
export function buildSpindleChair(chair: THREE.Object3D, m: WoodMats, seed = 1): void {
  const rnd = seeded(seed * 3301 + 11);
  const c = group(chair, { r: [0, (rnd() - 0.5) * 0.08, 0] });
  const H = 0.46;
  const W = 0.44;
  const D = 0.42;
  mesh(c, G.box(W, 0.045, D), m.seat, { p: [0, H, 0.01] });
  mesh(c, G.box(W - 0.04, 0.05, 0.03), m.frame, { p: [0, H - 0.045, D / 2 - 0.02] }); // yếm trước
  for (const sx of [-1, 1]) {
    mesh(c, G.box(0.04, H - 0.02, 0.04), m.frameUp, { p: [sx * (W / 2 - 0.03), (H - 0.02) / 2, D / 2 - 0.03] }); // chân trước
    // Chân sau + trụ lưng liền một thanh, hơi ngả ra sau
    mesh(c, G.box(0.04, 1.0, 0.04), m.frameUp, { p: [sx * (W / 2 - 0.03), 0.5, -D / 2 + 0.03], r: [-0.05, 0, 0] });
    mesh(c, G.box(0.025, 0.025, D - 0.08), m.frameUp, { p: [sx * (W / 2 - 0.03), 0.16, 0] }); // giằng hông
  }
  const back = group(c, { p: [0, 0, -D / 2 + 0.03], r: [-0.05, 0, 0] });
  mesh(back, G.box(W - 0.02, 0.08, 0.035), m.frameUp, { p: [0, 0.95, 0] }); // thanh trên
  mesh(back, G.box(W - 0.06, 0.035, 0.03), m.frameUp, { p: [0, 0.72, 0] }); // thanh giữa
  mesh(back, G.box(W - 0.06, 0.03, 0.03), m.frameUp, { p: [0, 0.6, 0] }); // thanh dưới
  // Hàng con tiện nhỏ giữa thanh trên và thanh giữa
  for (let i = 0; i < 5; i++) {
    const x = -0.14 + i * 0.07;
    mesh(back, G.cyl(0.011, 0.011, 0.19, 6), m.frameUp, { p: [x, 0.82, 0] });
    mesh(back, G.sphere(0.02, 8, 6), m.frameUp, { p: [x, 0.83, 0], s: [1, 1.3, 1] });
  }
}

let rattanMat: THREE.Material | null = null;
/** Mây đan (mắt cáo lục giác giản lược): nền vàng rơm, sợi chéo hai chiều + sợi ngang, lỗ đan sẫm. */
function rattan(): THREE.Material {
  if (rattanMat) return rattanMat;
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#3a2a1c';
  c.fillRect(0, 0, S, S);
  c.strokeStyle = '#d9b77a';
  c.lineWidth = 3;
  for (let i = -S; i < 2 * S; i += 12) {
    c.beginPath();
    c.moveTo(i, 0);
    c.lineTo(i + S, S);
    c.moveTo(i + S, 0);
    c.lineTo(i, S);
    c.stroke();
  }
  c.strokeStyle = '#c9a466';
  for (let y = 6; y < S; y += 12) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(S, y);
    c.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  rattanMat = toon(0xffffff, { map: tex });
  return rattanMat;
}

/** Ghế bành mây: khung gỗ sẫm, tay vịn cong ra trước, mặt ngồi + lưng đan mây (lưng ngả nhẹ). */
export function buildRattanArmchair(chair: THREE.Object3D, m: WoodMats, seed = 1): void {
  const rnd = seeded(seed * 2711 + 5);
  const c = group(chair, { r: [0, (rnd() - 0.5) * 0.08, 0] });
  const H = 0.45;
  const W = 0.5;
  const D = 0.46;
  const mat = rattan();
  // Khung mặt ngồi + tấm mây
  for (const sz of [-1, 1]) mesh(c, G.box(W, 0.05, 0.04), m.frame, { p: [0, H, sz * (D / 2 - 0.02)] });
  for (const sx of [-1, 1]) mesh(c, G.box(0.04, 0.05, D), m.frameUp, { p: [sx * (W / 2 - 0.02), H, 0] });
  mesh(c, G.box(W - 0.08, 0.02, D - 0.08), mat, { p: [0, H + 0.005, 0] });
  for (const sx of [-1, 1]) {
    mesh(c, G.box(0.045, H, 0.045), m.frameUp, { p: [sx * (W / 2 - 0.02), H / 2, D / 2 - 0.02] }); // chân trước
    mesh(c, G.box(0.045, 0.95, 0.045), m.frameUp, { p: [sx * (W / 2 - 0.02), 0.475, -D / 2 + 0.02], r: [-0.08, 0, 0] }); // chân sau + trụ lưng
    // Tay vịn: thanh nằm từ trụ lưng ra trước, trụ đỡ trên chân trước
    mesh(c, G.box(0.05, 0.035, D + 0.06), m.frame, { p: [sx * (W / 2 - 0.01), H + 0.24, 0.02] });
    mesh(c, G.box(0.035, 0.22, 0.035), m.frameUp, { p: [sx * (W / 2 - 0.02), H + 0.12, D / 2 - 0.02] });
    mesh(c, G.box(0.03, 0.03, D - 0.06), m.frameUp, { p: [sx * (W / 2 - 0.02), 0.13, 0] }); // giằng hông
  }
  // Lưng mây trong khung gỗ, ngả ra sau
  const back = group(c, { p: [0, H, -D / 2 + 0.03], r: [-0.12, 0, 0] });
  mesh(back, G.box(W - 0.06, 0.05, 0.035), m.frame, { p: [0, 0.46, 0] });
  mesh(back, G.box(W - 0.06, 0.035, 0.03), m.frame, { p: [0, 0.08, 0] });
  mesh(back, G.box(W - 0.1, 0.36, 0.015), mat, { p: [0, 0.27, 0.005] });
}
