import * as THREE from 'three';
import { crayonize } from './crayon';
import { G, group, mesh, toon, type V3 } from './toon';
import { plasticStool } from './streetcarts';

/**
 * Tiệm 25caaaaa ngoài chợ (StallDef.kind 'kiosk'): tiệm trà sữa / ăn vặt hộp hồng, mặt trước mở ô cửa bán hàng nhìn
 * thấy bên trong (kệ hũ trân châu, bảng menu, tủ mát), quầy ốp gạch hồng bày ly trà sữa + máy dập nắp, mái hiên sọc
 * răng cưa có dây đèn, ly matcha khổng lồ trên nóc. Mặt trước quay về +z.
 */
export interface TeaKiosk {
  g: THREE.Group;
  /** Chỗ treo biển logo (ảnh) trên nóc + bề rộng. */
  logo: { p: V3; w: number };
  /** Bảng tên trên mép mái hiên. */
  board: { w: number; p: V3 };
  /** Hàng emoji món bày (showItems). */
  items: { y: number; w: number; z: number };
  /** Người bán đứng sau quầy. */
  vendorAt: V3;
  /** Bóng đèn dây trên mái hiên: cảnh chợ chỉnh emissiveIntensity theo đêm. */
  bulbs: THREE.MeshToonMaterial[];
}

const PINK = 0xf6c9d6;
const PINK_DEEP = 0xf28cb1;
const CREAM = 0xfffaf1;
const WOOD = 0xb9733f;

/** Ly trà sữa: thân trong, nước màu, lớp kem, trân châu, nắp dập + ống hút. */
export function bobaCup(parent: THREE.Object3D, p: V3, tea: number, s = 1, straw = PINK_DEEP): THREE.Group {
  const c = group(parent, { p, s });
  mesh(c, G.cyl(0.055, 0.042, 0.17, 10), toon(0xf4f8fb, { transparent: true, opacity: 0.4 }), { p: [0, 0.085, 0], cast: false });
  mesh(c, G.cyl(0.05, 0.04, 0.13, 10), tea, { p: [0, 0.07, 0], cast: false });
  mesh(c, G.cyl(0.052, 0.05, 0.025, 10), 0xfff4e0, { p: [0, 0.145, 0], cast: false });
  for (let k = 0; k < 4; k++) mesh(c, G.sphere(0.012, 4, 3), 0x2a1a12, { p: [Math.cos(k * 1.6) * 0.025, 0.02, Math.sin(k * 1.6) * 0.025], cast: false });
  mesh(c, G.cyl(0.057, 0.057, 0.006, 10), 0xffffff, { p: [0, 0.172, 0], cast: false });
  mesh(c, G.cyl(0.008, 0.008, 0.12, 5), straw, { p: [0.015, 0.22, 0], r: [0, 0, -0.18], cast: false });
  return c;
}

export function makeTeaKiosk(W = 4.6): TeaKiosk {
  const g = group(null);
  const D = 2.6; // sâu từ z -1.9 tới 0.7
  const zF = 0.7;
  const zB = zF - D;
  const H = 3.6;
  // Vỏ tiệm: tường sau, 2 tường hông, sàn, trần - mặt trước để hở ô cửa
  mesh(g, G.box(W, H, 0.12), PINK, { p: [0, H / 2, zB + 0.06] });
  for (const s of [-1, 1]) mesh(g, G.box(0.14, H, D), PINK, { p: [s * (W / 2 - 0.07), H / 2, zB + D / 2] });
  mesh(g, G.box(W, 0.06, D), 0xf2ece4, { p: [0, 0.03, zB + D / 2], cast: false });
  mesh(g, G.box(W + 0.24, 0.24, D + 0.24), 0xffffff, { p: [0, H + 0.12, zB + D / 2] }); // gờ mái trắng
  mesh(g, G.box(W + 0.1, 0.2, D + 0.1), 0xffffff, { p: [0, 0.1, zB + D / 2] }); // chân tường trắng
  // Mặt tiền: 2 trụ hai bên + mảng trên ô cửa (có viền hồng đậm)
  const winL = -W / 2 + 0.45;
  const winR = W / 2 - 0.45;
  const winB = 0.95;
  const winT = 2.5;
  for (const s of [-1, 1]) mesh(g, G.box(0.45, H, 0.14), PINK, { p: [s * (W / 2 - 0.225), H / 2, zF - 0.07] });
  mesh(g, G.box(W, H - winT, 0.14), PINK, { p: [0, (H + winT) / 2, zF - 0.07] });
  // Khung gỗ ô cửa + 2 cánh kính lùa đẩy sang hai bên
  for (const x of [winL, winR]) mesh(g, G.box(0.07, winT - winB, 0.16), WOOD, { p: [x, (winT + winB) / 2, zF - 0.06] });
  mesh(g, G.box(winR - winL + 0.07, 0.07, 0.16), WOOD, { p: [0, winT, zF - 0.06] });
  const glass = toon(0xcfefff, { transparent: true, opacity: 0.3 });
  for (const s of [-1, 1]) {
    mesh(g, G.box(0.6, winT - winB - 0.08, 0.02), glass, { p: [s * (winR - 0.33), (winT + winB) / 2, zF - 0.02], cast: false });
    mesh(g, G.box(0.03, winT - winB - 0.08, 0.04), WOOD, { p: [s * (winR - 0.64), (winT + winB) / 2, zF - 0.02] });
  }
  // Bên trong: kệ gỗ 2 tầng bày hũ trân châu / trà, bảng menu, tủ mát
  const shelf = group(g, { p: [-0.7, 0, zB + 0.25] });
  for (const y of [1.35, 1.85]) {
    mesh(shelf, G.box(1.8, 0.05, 0.3), WOOD, { p: [0, y, 0] });
    for (let i = 0; i < 6; i++) {
      const c = [0x3b2418, 0xf3e2bd, 0x8cbf5a, 0x9a6bd1, 0xc8853f, 0xf2c14e][(i + (y > 1.5 ? 2 : 0)) % 6];
      mesh(shelf, G.cyl(0.09, 0.09, 0.24, 10), toon(0xf4f8fb, { transparent: true, opacity: 0.45 }), { p: [-0.75 + i * 0.3, y + 0.15, 0], cast: false });
      mesh(shelf, G.cyl(0.08, 0.08, 0.17, 10), c, { p: [-0.75 + i * 0.3, y + 0.11, 0], cast: false });
      mesh(shelf, G.cyl(0.095, 0.095, 0.03, 10), PINK_DEEP, { p: [-0.75 + i * 0.3, y + 0.28, 0], cast: false });
    }
  }
  const menu = group(g, { p: [-0.7, 2.55, zB + 0.13] });
  mesh(menu, G.box(1.9, 0.5, 0.04), 0x2f3a36);
  for (let r = 0; r < 3; r++)
    for (const c of [-1, 1]) {
      mesh(menu, G.box(0.5, 0.05, 0.01), CREAM, { p: [c * 0.48 - 0.1, 0.13 - r * 0.13, 0.025], cast: false });
      mesh(menu, G.box(0.12, 0.05, 0.01), [0xf2c14e, PINK_DEEP, 0x8cbf5a][r], { p: [c * 0.48 + 0.27, 0.13 - r * 0.13, 0.025], cast: false });
    }
  const fridge = group(g, { p: [1.35, 0, zB + 0.45] });
  mesh(fridge, G.box(0.9, 1.9, 0.6), 0xe9eef2, { p: [0, 0.95, 0] });
  mesh(fridge, G.box(0.76, 1.5, 0.02), toon(0xcfefff, { transparent: true, opacity: 0.4 }), { p: [0, 1.0, 0.31], cast: false });
  [0.55, 1.0, 1.45].forEach((y, r) => { for (let i = 0; i < 4; i++) bobaCup(fridge, [-0.27 + i * 0.18, y, 0.1], [0x8cbf5a, 0xc8853f, 0x9a6bd1, 0xf28cb1][(i + r) % 4], 0.9); });
  mesh(fridge, G.box(0.9, 0.18, 0.62), PINK_DEEP, { p: [0, 1.82, 0] });
  // Quầy bán: ốp gạch hồng ô vuông, mặt gỗ
  const counter = group(g, { p: [0, 0, zF + 0.32] });
  const cw = winR - winL + 0.3;
  mesh(counter, G.box(cw, 0.88, 0.62), 0xffffff, { p: [0, 0.44, 0] });
  for (let i = 0; i < 9; i++)
    for (let r = 0; r < 3; r++) if ((i + r) % 2 === 0) mesh(counter, G.box(cw / 9 - 0.02, 0.26, 0.01), 0xf7b6c9, { p: [-cw / 2 + (i + 0.5) * (cw / 9), 0.17 + r * 0.28, 0.315], cast: false });
  mesh(counter, G.box(cw + 0.12, 0.07, 0.72), WOOD, { p: [0, 0.915, 0] });
  // Trên quầy: máy dập nắp ly, hàng ly trà sữa, hũ ống hút, máy tính tiền, chuông
  const sealer = group(counter, { p: [-1.25, 0.95, -0.1] });
  mesh(sealer, G.box(0.3, 0.12, 0.3), 0xe9eef2, { p: [0, 0.06, 0] });
  mesh(sealer, G.box(0.1, 0.36, 0.25), 0xe9eef2, { p: [-0.1, 0.3, 0] });
  mesh(sealer, G.box(0.28, 0.08, 0.26), PINK_DEEP, { p: [0.02, 0.5, 0] });
  mesh(sealer, G.box(0.04, 0.03, 0.04), 0xe5463c, { p: [-0.12, 0.2, 0.13], cast: false });
  [0x8cbf5a, 0xc8853f, 0x9a6bd1, 0xf2c14e, 0xf28cb1].forEach((c, i) => bobaCup(counter, [-0.55 + i * 0.22, 0.95, 0.12], c, 1.15));
  mesh(counter, G.cyl(0.06, 0.06, 0.14, 10), toon(0xf4f8fb, { transparent: true, opacity: 0.45 }), { p: [0.75, 1.02, 0], cast: false });
  for (let k = 0; k < 6; k++) mesh(counter, G.cyl(0.008, 0.008, 0.24, 4), [PINK_DEEP, 0x4a9bd8, 0xf2c14e][k % 3], { p: [0.73 + (k % 3) * 0.02, 1.1, -0.02 + (k >> 1) * 0.015], r: [0.1 * (k - 3), 0, 0.12 * (k % 3 - 1)], cast: false });
  const reg = group(counter, { p: [1.2, 0.95, -0.12], r: [0, -0.4, 0] });
  mesh(reg, G.box(0.3, 0.1, 0.24), 0x3b3f46, { p: [0, 0.05, 0] });
  mesh(reg, G.box(0.24, 0.16, 0.02), 0x56748c, { p: [0, 0.2, -0.06], r: [-0.3, 0, 0] });
  mesh(counter, G.sphere(0.05, 8, 6), 0xf2c14e, { p: [1.45, 0.98, 0.18], s: [1, 0.7, 1] });
  // Mái hiên sọc hồng trắng, mép răng cưa, dây đèn
  const awning = group(g, { p: [0, 3.0, zF], r: [0.5, 0, 0] }); // bản lề sát tường, ngắn + cao để thấy người bán bên trong
  const n = 10;
  for (let i = 0; i < n; i++) {
    const col = i % 2 ? 0xffffff : PINK_DEEP;
    const x = -W / 2 + (i + 0.5) * (W / n);
    mesh(awning, G.box(W / n, 0.05, 0.85), col, { p: [x, 0, 0.425] });
    mesh(awning, G.cyl(W / n / 2, W / n / 2, 0.05, 10), col, { p: [x, 0, 0.85], cast: false });
  }
  const bulbs: THREE.MeshToonMaterial[] = [];
  for (let i = 0; i < 9; i++) {
    const m = crayonize(new THREE.MeshToonMaterial({ color: 0xfff1c2, emissive: 0xffc861, emissiveIntensity: 0 }));
    bulbs.push(m);
    const x = -W / 2 + 0.3 + (i * (W - 0.6)) / 8;
    mesh(g, G.sphere(0.045, 6, 5), m, { p: [x, 2.5 - Math.sin((i / 8) * Math.PI) * 0.1, zF + 0.78], cast: false });
  }
  mesh(g, G.box(W - 0.4, 0.01, 0.01), 0x3a2a1e, { p: [0, 2.48, zF + 0.78], cast: false });
  // Chậu cây hai bên cửa + bảng menu chân đứng nhỏ bên trái
  for (const s of [-1, 1]) {
    const pot = group(g, { p: [s * (W / 2 + 0.25), 0, zF + 0.3] });
    mesh(pot, G.cyl(0.2, 0.15, 0.32, 10), 0xffffff, { p: [0, 0.16, 0] });
    mesh(pot, G.ico(0.28, 1), 0x6fbf4a, { p: [0, 0.55, 0], s: [1, 1.15, 1] });
    mesh(pot, G.ico(0.18, 1), 0x8fd16a, { p: [0.08, 0.8, 0.05] });
  }
  const easel = group(g, { p: [-W / 2 - 0.2, 0, zF + 1.15], r: [0, 0.35, 0] });
  for (const s of [-1, 1]) mesh(easel, G.box(0.04, 0.95, 0.04), WOOD, { p: [s * 0.24, 0.47, 0], r: [0.12, 0, 0] });
  mesh(easel, G.box(0.56, 0.62, 0.03), 0x2f3a36, { p: [0, 0.6, 0.05], r: [0.12, 0, 0] });
  for (let r = 0; r < 4; r++) mesh(easel, G.box(0.36, 0.035, 0.01), r === 0 ? PINK_DEEP : CREAM, { p: [0, 0.8 - r * 0.12, 0.08], r: [0.12, 0, 0], cast: false });
  // Ly matcha khổng lồ trên nóc (bên phải biển logo)
  const cup = group(g, { p: [W / 2 - 0.75, H + 0.24, -0.3] });
  mesh(cup, G.cyl(0.36, 0.27, 0.85, 14), toon(0xeaf6ff, { transparent: true, opacity: 0.55 }), { p: [0, 0.43, 0], cast: false });
  mesh(cup, G.cyl(0.33, 0.25, 0.62, 14), 0x8cbf5a, { p: [0, 0.34, 0] });
  mesh(cup, G.cyl(0.345, 0.33, 0.12, 14), 0xfff4e0, { p: [0, 0.71, 0] });
  for (let k = 0; k < 7; k++) mesh(cup, G.sphere(0.055, 6, 5), 0x2a1a12, { p: [Math.cos(k * 0.9) * 0.16, 0.09, Math.sin(k * 0.9) * 0.16], cast: false });
  mesh(cup, G.sphere(0.37, 14, 8), toon(0xeaf6ff, { transparent: true, opacity: 0.6 }), { p: [0, 0.86, 0], s: [1, 0.35, 1], cast: false });
  mesh(cup, G.cyl(0.04, 0.04, 0.75, 8), PINK_DEEP, { p: [0.1, 1.15, 0], r: [0, 0, -0.18] });
  for (const sx of [-1.2, 0.1]) mesh(g, G.box(0.08, 0.9, 0.08), PINK_DEEP, { p: [sx, H + 0.4, -0.25] }); // 2 cột đỡ biển logo
  return {
    g,
    logo: { p: [-0.55, H + 1.15, -0.2], w: 1.75 },
    board: { w: W - 0.4, p: [0, 3.33, zF + 0.05] },
    items: { y: 0.96, w: W - 1.6, z: zF + 0.62 },
    vendorAt: [0, 0.06, zF - 0.32],
    bulbs,
  };
}

/** Bộ bàn nhựa mini + 4 ghế đẩu trước tiệm (ghế quay mặt vào bàn). `seats` = toạ độ ghế trong group, để cả đội ngồi ăn. */
export function makePlasticSet(top: number, stool: number): { g: THREE.Group; seats: { x: number; z: number; face: number }[] } {
  const g = group(null);
  mesh(g, G.box(0.78, 0.05, 0.78), top, { p: [0, 0.58, 0] });
  mesh(g, G.box(0.72, 0.06, 0.72), top, { p: [0, 0.535, 0], cast: false }); // gờ dưới mặt bàn
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(g, G.cyl(0.025, 0.035, 0.56, 6), top, { p: [lx * 0.3, 0.28, lz * 0.3], r: [lz * 0.08, 0, -lx * 0.08] });
  mesh(g, G.cyl(0.045, 0.045, 0.12, 8), 0xffffff, { p: [0.15, 0.67, -0.12] }); // hũ khăn giấy
  const seats: { x: number; z: number; face: number }[] = [];
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const sx = Math.sin(a) * 0.7;
    const sz = Math.cos(a) * 0.7;
    plasticStool(g, sx, sz, stool);
    seats.push({ x: sx, z: sz, face: a + Math.PI });
  }
  return { g, seats };
}
