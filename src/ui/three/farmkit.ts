import * as THREE from 'three';
import { crayonize } from './crayon';
import { G, group, mesh, seeded, toon, type V3 } from './toon';

/**
 * Model riêng của nông trại: cối xay gió, nhà xay lúa (bánh xe nước), máy cày, kiện rơm,
 * viền đứt khúc đánh dấu chỗ mở rộng được. Nhìn về +z, chân ở y = 0.
 */

/** Cối xay gió: trả về cánh quạt (để quay theo gió) và chỗ chất bao lúa trước cửa. */
export function makeWindmill(): { g: THREE.Group; blades: THREE.Group; sacks: THREE.Group } {
  const g = group(null);
  const rnd = seeded(41);
  const H = 4.2;
  const rAt = (y: number) => 1.3 - (y / H) * 0.4;
  // Tháp bát giác thuôn, nẹp ván ngang, chân móng đá
  mesh(g, G.cyl(0.9, 1.3, H, 8), 0xf3e9d2, { p: [0, H / 2, 0] });
  for (let y = 0.45; y < H; y += 0.42) mesh(g, G.cyl(rAt(y) + 0.012, rAt(y) + 0.012, 0.03, 8), 0xdccfb2, { p: [0, y, 0], cast: false });
  mesh(g, G.cyl(1.42, 1.48, 0.22, 10), 0x9aa0a8, { p: [0, 0.11, 0] });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rnd() * 0.2;
    mesh(g, G.ico(rnd() < 0.5 ? 0.1 : 0.13, 0), rnd() < 0.5 ? 0x8a9099 : 0xb0b5bc, { p: [Math.cos(a) * 1.45, 0.2, Math.sin(a) * 1.45], r: [rnd(), rnd(), rnd()] });
  }
  // Ban công gỗ vòng quanh tháp + lan can
  const by = 2.6;
  const br = rAt(by) + 0.32;
  mesh(g, G.cyl(br, br, 0.08, 16), 0xb07a45, { p: [0, by, 0] });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    mesh(g, G.box(0.04, 0.36, 0.04), 0x8a5a35, { p: [Math.cos(a) * (br - 0.03), by + 0.2, Math.sin(a) * (br - 0.03)] });
  }
  mesh(g, G.torus(br - 0.03, 0.025, 4, 20), 0x8a5a35, { p: [0, by + 0.38, 0], r: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    mesh(g, G.box(0.05, 0.05, 0.42), 0x8a5a35, { p: [Math.cos(a) * (br - 0.2), by - 0.16, Math.sin(a) * (br - 0.2)], r: [0, -a + Math.PI / 2, 0.6] }); // thanh chống
  }
  // Mũ cối: mái hai tầng lợp ván, chóp + cờ nhỏ
  mesh(g, G.cyl(0.98, 0.95, 0.18, 10), 0x8a5a35, { p: [0, H + 0.06, 0] });
  mesh(g, G.cone(1.15, 0.9, 10), 0xc94a3f, { p: [0, H + 0.6, 0] });
  mesh(g, G.cone(0.72, 0.7, 10), 0xa83a32, { p: [0, H + 1.05, 0] });
  mesh(g, G.cyl(0.02, 0.02, 0.5, 4), 0x5a3b2a, { p: [0, H + 1.55, 0] });
  mesh(g, G.box(0.02, 0.14, 0.24), 0xf2c14e, { p: [0, H + 1.72, 0.12], cast: false });
  // Cửa ván có khung + bậc đá; 2 cửa sổ có cánh mở
  const front = (y: number) => rAt(y) - 0.02;
  mesh(g, G.box(0.84, 1.42, 0.08), 0x5a3b2a, { p: [0, 0.78, front(0.7)] });
  for (let i = 0; i < 4; i++) mesh(g, G.box(0.16, 1.28, 0.06), i % 2 ? 0x7a4a2f : 0x84532f, { p: [-0.255 + i * 0.17, 0.72, front(0.7) + 0.04] });
  mesh(g, G.sphere(0.035, 6, 5), 0xf2c14e, { p: [0.22, 0.72, front(0.7) + 0.09], cast: false });
  mesh(g, G.box(1.0, 0.1, 0.4), 0xa8adb5, { p: [0, 0.05, front(0) + 0.2] });
  for (const [y, side] of [[3.0, 0], [1.9, 1]] as const) {
    const w = group(g, { p: side ? [front(y) * Math.sin(1.1), y, front(y) * Math.cos(1.1)] : [0, y, front(y)], r: [0, side ? 1.1 : 0, 0] });
    mesh(w, G.box(0.5, 0.5, 0.06), 0x5a3b2a);
    mesh(w, G.box(0.38, 0.38, 0.07), 0xbfe6ff, { cast: false });
    mesh(w, G.box(0.04, 0.38, 0.08), 0x5a3b2a, { cast: false });
    for (const s of [-1, 1]) mesh(w, G.box(0.2, 0.4, 0.03), 0x3f7a5a, { p: [s * 0.38, 0, 0.08], r: [0, s * 0.6, 0] }); // cánh cửa sổ
  }
  // Cánh quạt: trục + 4 cánh khung mắt cáo căng vải
  // Trục cánh chìa ra khỏi tháp để cánh quay không quét trúng ban công
  mesh(g, G.box(0.16, 0.16, 0.7), 0x5a3b2a, { p: [0, 3.9, 1.22] });
  const blades = group(g, { p: [0, 3.9, 1.6] });
  mesh(blades, G.cyl(0.16, 0.2, 0.3, 8), 0x5a3b2a, { r: [Math.PI / 2, 0, 0] });
  mesh(blades, G.sphere(0.13, 8, 6), 0x8a5a3a, { p: [0, 0, 0.16] });
  for (let i = 0; i < 4; i++) {
    const arm = group(blades, { r: [0, 0, (i * Math.PI) / 2] });
    mesh(arm, G.box(0.09, 2.4, 0.07), 0x8a5a3a, { p: [0, 1.25, 0] });
    const sail = group(arm, { p: [0.28, 1.45, 0.02], r: [0, 0.18, 0] });
    for (const x of [-0.22, 0.22]) mesh(sail, G.box(0.03, 1.8, 0.03), 0xa8784a, { p: [x, 0, 0] });
    for (let k = 0; k < 7; k++) mesh(sail, G.box(0.46, 0.025, 0.025), 0xa8784a, { p: [0, -0.9 + k * 0.3, 0] });
    mesh(sail, G.box(0.42, 1.72, 0.012), 0xf6efe0, { p: [0, 0, -0.015] });
  }
  const sacks = group(g, { p: [0.95, 0, 1.5] });
  return { g, blades, sacks };
}

/** Nhà xay lúa: nhà ván gỗ trên móng đá, mái ngói có nóc, cửa sổ có cánh, máng gỗ dẫn nước xuống bánh xe nước bên hông. */
export function makeRiceMill(waterMat: THREE.Material): { g: THREE.Group; wheel: THREE.Group; sacks: THREE.Group } {
  const g = group(null);
  const rnd = seeded(77);
  // Móng đá
  mesh(g, G.box(2.6, 0.24, 2.4), 0x9aa0a8, { p: [0, 0.12, 0] });
  for (let i = 0; i < 9; i++) mesh(g, G.box(0.24 + rnd() * 0.1, 0.12, 0.03), rnd() < 0.5 ? 0x8a9099 : 0xb0b5bc, { p: [-1.1 + i * 0.27, 0.12, 1.21], cast: false });
  // Tường ván dọc hai tông
  mesh(g, G.box(2.4, 1.7, 2.2), 0xd9b98a, { p: [0, 1.09, 0] });
  for (const z of [-1.1, 1.1]) for (let i = 0; i < 12; i++) mesh(g, G.box(0.17, 1.7, 0.02), i % 2 ? 0xcfae7e : 0xdfc293, { p: [-1.1 + i * 0.2, 1.09, z + Math.sign(z) * 0.011], cast: false });
  for (const x of [-1.2, 1.2]) for (let i = 0; i < 11; i++) mesh(g, G.box(0.02, 1.7, 0.17), i % 2 ? 0xcfae7e : 0xdfc293, { p: [x + Math.sign(x) * 0.011, 1.09, -1.0 + i * 0.2], cast: false });
  // Cột góc + xà ngang
  for (const x of [-1.2, 1.2]) for (const z of [-1.1, 1.1]) mesh(g, G.box(0.14, 1.75, 0.14), 0x8a5a35, { p: [x, 1.1, z] });
  for (const z of [-1.13, 1.13]) mesh(g, G.box(2.5, 0.1, 0.06), 0x8a5a35, { p: [0, 1.9, z] });
  // Mái ngói: lăng trụ + các hàng ngói + nóc
  mesh(g, G.prism(), 0x9a4a32, { p: [0, 1.95, 0], r: [0, Math.PI / 2, 0], s: [2.8, 1.1, 2.9] });
  const slope = Math.atan2(1.1, 1.4);
  for (const s of [-1, 1]) for (let k = 1; k < 5; k++) {
    const f = k / 5;
    mesh(g, G.box(2.92, 0.03, 0.05), 0x7a3a26, { p: [0, 1.95 + 1.1 * f + 0.02, s * 1.4 * (1 - f) + s * 0.02], r: [s * slope, 0, 0], cast: false });
  }
  mesh(g, G.box(3.0, 0.1, 0.16), 0x6b3020, { p: [0, 3.06, 0] });
  // Cửa có khung, cửa sổ có cánh mở
  mesh(g, G.box(0.84, 1.3, 0.06), 0x5a3b2a, { p: [0, 0.89, 1.13] });
  for (let i = 0; i < 4; i++) mesh(g, G.box(0.16, 1.18, 0.05), i % 2 ? 0x6b3f22 : 0x744526, { p: [-0.255 + i * 0.17, 0.84, 1.16] });
  const win = group(g, { p: [0.72, 1.35, 1.13] });
  mesh(win, G.box(0.46, 0.42, 0.06), 0x5a3b2a);
  mesh(win, G.box(0.34, 0.3, 0.07), 0x2f2a26, { cast: false });
  for (const s of [-1, 1]) mesh(win, G.box(0.18, 0.34, 0.03), 0x3f7a5a, { p: [s * 0.33, 0, 0.08], r: [0, s * 0.55, 0] });
  // Máng gỗ trên cao dẫn nước từ phía sau xuống bánh xe + máng dưới
  const trough = (x: number, y: number, z1: number, z2: number, wy = 0.12) => {
    const len = z2 - z1;
    mesh(g, G.box(0.42, 0.04, len), 0x8a5a35, { p: [x, y, (z1 + z2) / 2] });
    for (const s of [-1, 1]) mesh(g, G.box(0.04, 0.16, len), 0x7a4a2f, { p: [x + s * 0.2, y + 0.08, (z1 + z2) / 2] });
    mesh(g, G.box(0.36, 0.03, len), waterMat, { p: [x, y + wy, (z1 + z2) / 2], cast: false });
  };
  trough(1.6, 0.1, -1.3, 1.3);
  trough(1.6, 1.72, -1.6, -0.55, 0.08);
  for (const z of [-1.5, -0.8]) mesh(g, G.box(0.06, 1.65, 0.06), 0x7a4a2f, { p: [1.82, 0.85, z] });
  // Bánh xe nước: 2 vành, cánh gạt giữa hai vành, nan, trục cắm vào tường
  const wheel = group(g, { p: [1.6, 0.85, 0] });
  for (const x of [-0.13, 0.13]) mesh(wheel, G.torus(0.8, 0.045, 5, 20), 0x6b4a2f, { p: [x, 0, 0], r: [0, Math.PI / 2, 0] });
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    const spoke = group(wheel, { r: [a, 0, 0] });
    for (const x of [-0.13, 0.13]) mesh(spoke, G.box(0.04, 1.6, 0.04), 0x8a5a35, { p: [x, 0, 0] });
    mesh(spoke, G.box(0.32, 0.24, 0.035), 0x9a6a3f, { p: [0, 0.78, 0] });
  }
  mesh(wheel, G.cyl(0.1, 0.1, 0.4, 8), 0x5a3b2a, { r: [0, 0, Math.PI / 2] });
  mesh(g, G.box(0.42, 0.07, 0.07), 0x3b2a1e, { p: [1.35, 0.85, 0] });
  const sacks = group(g, { p: [-0.9, 0, 1.45] });
  return { g, wheel, sacks };
}

/** Chất bao lúa / bao thành phẩm trước cối: n bao (tối đa 6). */
export function fillSacks(holder: THREE.Group, n: number, color = 0xe8d6a8): void {
  holder.clear();
  for (let i = 0; i < Math.min(6, n); i++) {
    const x = (i % 3) * 0.32 - 0.32;
    const y = Math.floor(i / 3) * 0.3;
    mesh(holder, G.capsule(0.15, 0.12), color, { p: [x, 0.17 + y, (i % 2) * 0.05], r: [0, 0, Math.PI / 2] });
  }
}

/**
 * Máy cày nhỏ (bác nông dân ngồi trên, nhìn về +z): nắp máy đỏ dài có lưới tản nhiệt + đèn, ống khói, vô lăng,
 * bánh sau to có gai, chắn bùn cong, kéo rơ-moóc gỗ phía sau. Trả về thùng chở (để chất lúa) và các bánh (để quay).
 */
export function makeTractor(): { g: THREE.Group; bed: THREE.Group; wheels: THREE.Object3D[] } {
  const g = group(null);
  const red = 0xd9433a;
  const dark = 0x3b3f46;
  // Nắp máy dựng theo hình nhìn ngang (khung con xoay để trục x của hình chạy theo +z)
  const fwd = group(g, { r: [0, -Math.PI / 2, 0] });
  mesh(fwd, side([[0.22, 0.48], [1.28, 0.48], [1.3, 0.86], [1.2, 0.96], [0.3, 1.0], [0.22, 0.94]], 0.56), red);
  mesh(g, G.box(0.42, 0.26, 1.3), dark, { p: [0, 0.42, 0.55] }); // khung gầm
  mesh(g, G.box(0.46, 0.3, 0.04), dark, { p: [0, 0.7, 1.31], cast: false }); // lưới tản nhiệt
  for (let i = 0; i < 3; i++) mesh(g, G.box(0.4, 0.025, 0.05), 0x6b7079, { p: [0, 0.6 + i * 0.09, 1.32], cast: false });
  for (const s of [-1, 1]) mesh(g, G.box(0.1, 0.08, 0.04), headMat, { p: [s * 0.2, 0.9, 1.25], cast: false }); // đèn
  mesh(g, G.box(0.6, 0.12, 0.14), dark, { p: [0, 0.4, 1.38] }); // cản trước
  // Ống khói: thẳng đứng, nắp chụp nghiêng
  mesh(g, G.cyl(0.045, 0.045, 0.55, 8), dark, { p: [0.17, 1.22, 0.95] });
  mesh(g, G.box(0.1, 0.03, 0.12), dark, { p: [0.17, 1.51, 0.97], r: [0.3, 0, 0] });
  // Thân dưới ghế + bậc lên xuống
  mesh(g, G.box(0.56, 0.38, 0.6), red, { p: [0, 0.62, -0.05] });
  for (const s of [-1, 1]) mesh(g, G.box(0.18, 0.04, 0.4), dark, { p: [s * 0.32, 0.42, 0.28] });
  // Ghế có tựa
  mesh(g, G.box(0.42, 0.07, 0.36), 0x2a2d35, { p: [0, 0.85, -0.05] });
  mesh(g, G.box(0.42, 0.26, 0.06), 0x2a2d35, { p: [0, 1.0, -0.24], r: [-0.15, 0, 0] });
  // Vô lăng: trục nghiêng + vòng tròn gần nằm ngang trước ngực bác
  mesh(g, G.box(0.05, 0.4, 0.05), dark, { p: [0, 1.0, 0.36], r: [0.45, 0, 0] });
  mesh(g, G.torus(0.15, 0.022, 5, 16), 0x2a2d35, { p: [0, 1.17, 0.3], r: [-1.15, 0, 0] });
  const wheels: THREE.Object3D[] = [];
  const tire = (x: number, z: number, r: number, w: number, hub: number, lugs: number): void => {
    const m = mesh(g, G.cyl(r, r, w, 16), 0x2a2d35, { p: [x, r, z], r: [0, 0, Math.PI / 2] });
    mesh(m, G.cyl(r * 0.55, r * 0.55, w + 0.02, 10), hub);
    mesh(m, G.cyl(r * 0.18, r * 0.18, w + 0.05, 8), 0xcfd6dc);
    for (let i = 0; i < lugs; i++) {
      const a = (i / lugs) * Math.PI * 2;
      mesh(m, G.box(0.07, w * 0.9, 0.05), 0x2a2d35, { p: [Math.cos(a) * r, 0, Math.sin(a) * r], r: [0, -a, 0], cast: false }); // gai lốp
    }
    wheels.push(m);
  };
  for (const s of [-1, 1]) {
    tire(s * 0.5, -0.1, 0.45, 0.24, 0xf2c94c, 12);
    tire(s * 0.38, 1.05, 0.26, 0.16, 0xf2c94c, 8);
    // Chắn bùn cong ôm bánh sau
    mesh(g, G.torus(0.5, 0.045, 4, 14, Math.PI), red, { p: [s * 0.5, 0.45, -0.1], r: [0, Math.PI / 2, 0], s: [1, 1, 3.2] });
    mesh(g, G.box(0.06, 0.05, 0.1), headMat, { p: [s * 0.6, 0.98, -0.1], cast: false });
  }
  // Rơ-moóc gỗ phía sau: cần kéo, sàn ván, thành ván có khe, cọc góc, 2 bánh nhỏ
  mesh(g, G.box(0.08, 0.06, 0.5), dark, { p: [0, 0.38, -0.6] });
  const bed = group(g, { p: [0, 0.35, -1.1] });
  mesh(bed, G.box(0.95, 0.08, 0.9), 0x9a6a3f);
  for (const y of [0.1, 0.24]) {
    for (const s of [-1, 1]) mesh(bed, G.box(0.05, 0.1, 0.9), 0xb07a45, { p: [s * 0.45, y, 0] });
    for (const z of [-0.43, 0.43]) mesh(bed, G.box(0.95, 0.1, 0.05), 0xb07a45, { p: [0, y, z] });
  }
  for (const x of [-0.46, 0.46]) for (const z of [-0.44, 0.44]) mesh(bed, G.box(0.07, 0.34, 0.07), 0x7a5535, { p: [x, 0.15, z] });
  for (const s of [-1, 1]) tire(s * 0.55, -1.1, 0.2, 0.12, 0xcfd6dc, 0);
  return { g, bed, wheels };
}

/** Kiện rơm tròn: mặt hai đầu có vòng xoắn rơm, lưới quấn 2 dải, vài cọng rơm lòi ra. */
export function hayBale(parent: THREE.Object3D, x: number, z: number, r = 0): void {
  const rnd = seeded(Math.round(x * 13 + z * 7) + 5);
  const g = group(parent, { p: [x, 0, z], r: [0, r, 0] });
  mesh(g, G.cyl(0.32, 0.32, 0.5, 14), 0xe8c55a, { p: [0, 0.32, 0], r: [Math.PI / 2, 0, 0] });
  for (const s of [-1, 1]) for (const rr of [0.08, 0.16, 0.24]) mesh(g, G.torus(rr, 0.012, 3, 14), 0xd2ab45, { p: [0, 0.32, s * 0.251], cast: false });
  for (const z2 of [-0.12, 0.12]) mesh(g, G.torus(0.322, 0.018, 4, 16), 0xc9a040, { p: [0, 0.32, z2], cast: false });
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    mesh(g, G.box(0.015, 0.14, 0.015), 0xf2d98a, { p: [Math.cos(a) * 0.32, 0.32 + Math.sin(a) * 0.32, (rnd() - 0.5) * 0.45], r: [rnd() - 0.5, 0, a - Math.PI / 2 + (rnd() - 0.5)], cast: false });
  }
}

/** Rơm rải trên nền chuồng: vài vệt rơm mảnh. */
export function strawLitter(parent: THREE.Object3D, w: number, d: number, seed: () => number): void {
  for (let i = 0; i < 26; i++) {
    mesh(parent, G.box(0.35, 0.02, 0.04), i % 2 ? 0xe8c55a : 0xd9b048, { p: [(seed() - 0.5) * w, 0.09, (seed() - 0.5) * d], r: [0, seed() * Math.PI, 0], cast: false });
  }
}

const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });

/** Viền đứt khúc hình vuông cạnh `size` (chỗ mua thêm ô / cối), nằm sát mặt đất. */
export function dashedRect(parent: THREE.Object3D, size: number, dash = 0.45, depth = size): THREE.Group {
  const g = group(parent);
  const hx = size / 2;
  const hz = depth / 2;
  const nx = Math.max(2, Math.round(size / (dash * 1.8)));
  const nz = Math.max(2, Math.round(depth / (dash * 1.8)));
  for (const az of [-hz, hz]) for (let i = 0; i < nx; i++) mesh(g, G.box(dash, 0.03, 0.09), dashMat, { p: [-hx + (size * (i + 0.5)) / nx, 0.04, az], cast: false, receive: false });
  for (const ax of [-hx, hx]) for (let i = 0; i < nz; i++) mesh(g, G.box(0.09, 0.03, dash), dashMat, { p: [ax, 0.04, -hz + (depth * (i + 0.5)) / nz], cast: false, receive: false });
  mesh(g, G.box(size, 0.01, depth), toon(0xffffff, { transparent: true, opacity: 0.12 }), { p: [0, 0.02, 0], cast: false, receive: false });
  return g;
}

/**
 * Đường viền ao méo tự nhiên (khép kín, mặt phẳng xz): bề ngang tối đa = 2·rx, bề dọc ≈ 2·rz.
 * Cùng seed thì cùng hình — dùng chung cho mặt ao, bờ ao và viền đứt khúc "nới rộng ao".
 */
export function pondOutline(rx: number, rz: number, seed = 1, n = 48): THREE.Vector2[] {
  const wobble = (a: number) => 1 + 0.1 * Math.sin(2 * a + 0.7 + seed) + 0.07 * Math.sin(3 * a + 2.1 + seed * 1.3) + 0.04 * Math.sin(5 * a + 1 + seed * 0.7);
  const max = 1.21;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = wobble(a) / max;
    return new THREE.Vector2(Math.cos(a) * rx * k, Math.sin(a) * rz * k);
  });
}

/** Khối phẳng theo đường viền (mặt ao, bờ ao): dày `h`, đáy ở y = 0. */
export function outlineSlab(points: THREE.Vector2[], h: number): THREE.BufferGeometry {
  // Shape vẽ trên mặt xy với y = -z, rồi xoay nằm xuống mặt đất và đùn lên trên
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, -p.y)));
  return new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2);
}

/** Viền đứt khúc theo một đường khép kín (vd ao sau khi nới rộng). */
export function dashedOutline(parent: THREE.Object3D, points: THREE.Vector2[], dash = 0.45): THREE.Group {
  const g = group(parent);
  const n = points.length;
  const step = dash * 1.8;
  let next = 0; // quãng đường (dọc viền) tới nét kế tiếp
  let walked = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const len = a.distanceTo(b);
    while (next < walked + len) {
      const k = (next - walked) / len;
      mesh(g, G.box(dash, 0.03, 0.09), dashMat, { p: [a.x + (b.x - a.x) * k, 0.04, a.y + (b.y - a.y) * k], r: [0, -Math.atan2(b.y - a.y, b.x - a.x), 0], cast: false, receive: false });
      next += step;
    }
    walked += len;
  }
  return g;
}

/** Viền đứt khúc hình tròn đường kính `size`. */
export function dashedCircle(parent: THREE.Object3D, size: number, dash = 0.45): THREE.Group {
  const g = group(parent);
  const r = size / 2;
  const n = Math.max(8, Math.round((Math.PI * size) / (dash * 1.8)));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    mesh(g, G.box(dash, 0.03, 0.09), dashMat, { p: [Math.cos(a) * r, 0.04, Math.sin(a) * r], r: [0, -a + Math.PI / 2, 0], cast: false, receive: false });
  }
  mesh(g, G.cyl(r, r, 0.01, 24), toon(0xffffff, { transparent: true, opacity: 0.12 }), { p: [0, 0.02, 0], cast: false, receive: false });
  return g;
}

/** Mặt ruộng lúa: lưới khóm lúa. stage 0 mạ non, 1 lúa xanh, 2 chín vàng (lúa mì vàng óng, lúa nước vàng xanh trĩu bông). */
export function grainField(parent: THREE.Object3D, size: number, kind: 'wheat' | 'rice', stage: 0 | 1 | 2): THREE.Group {
  const g = group(parent);
  const n = 6;
  const step = (size - 0.6) / (n - 1);
  const h = [0.18, 0.42, 0.6][stage];
  const stem = stage === 2 ? (kind === 'wheat' ? 0xe0b63e : 0xc9c35a) : stage === 1 ? 0x6fbf4a : 0x8fd16a;
  const head = kind === 'wheat' ? 0xf0c850 : 0xe8d27a;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = -size / 2 + 0.3 + i * step + (j % 2) * 0.08;
      const z = -size / 2 + 0.3 + j * step;
      const tuft = group(g, { p: [x, 0, z], r: [0, (i * 7 + j * 3) % 6, 0] });
      tuft.userData.sway = (i * 0.7 + j * 1.3) % 6;
      for (let k = 0; k < 3; k++) {
        const lean = (k - 1) * 0.18;
        mesh(tuft, G.cone(0.035, h, 4), stem, { p: [lean * 0.4, h / 2, (k % 2) * 0.05], r: [0, 0, lean], cast: false });
        if (stage === 2) mesh(tuft, G.capsule(0.03, 0.1), head, { p: [lean * h, h + 0.02, (k % 2) * 0.05], r: [0.3, 0, lean + (kind === 'rice' ? 0.5 : 0)], cast: false });
      }
    }
  }
  return g;
}

// ---------- Nhà lồng / nhà màng ----------

const filmMat = new THREE.MeshToonMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
const filmMatInside = new THREE.MeshToonMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false });

/**
 * Khung nhà màng mái vòm dài `length` (theo +x, từ x = 0), rộng `width` (z ở giữa): cột + vòm thép trắng mỗi `rib` mét,
 * xà dọc, màng phủ trong mờ, đầu tây có cửa, đầu đông có quạt thông gió. inside = true: màng mỏng hơn (nhìn từ trong).
 * Trả về các cánh quạt để quay.
 */
export function makeGreenhouse(length: number, width: number, rib: number, inside = false): { g: THREE.Group; fans: THREE.Object3D[] } {
  const g = group(null);
  const r = width / 2;
  const wall = 1.0; // chân tường thẳng trước khi uốn vòm
  const steel = 0xf2f4f6;
  const film = inside ? filmMatInside : filmMat;
  mesh(g, G.box(length + 0.3, 0.12, width + 0.3), 0xcfd3d6, { p: [length / 2, 0.06, 0], cast: false }); // móng
  const ribs = Math.max(1, Math.round(length / rib));
  for (let i = 0; i <= ribs; i++) {
    const x = (i / ribs) * length;
    for (const side of [-1, 1]) mesh(g, G.box(0.08, wall, 0.08), steel, { p: [x, wall / 2, side * r] });
    mesh(g, G.torus(r, 0.04, 5, 18, Math.PI), steel, { p: [x, wall, 0], r: [0, Math.PI / 2, 0] });
  }
  // Xà dọc: nóc + hai bên vai vòm + chân tường
  for (const a of [Math.PI / 2, Math.PI / 4, (3 * Math.PI) / 4]) mesh(g, G.box(length, 0.05, 0.05), steel, { p: [length / 2, wall + Math.sin(a) * r, Math.cos(a) * r] });
  for (const side of [-1, 1]) mesh(g, G.box(length, 0.06, 0.06), steel, { p: [length / 2, wall, side * r] });
  // Màng phủ: vòm (nửa trụ) + hai vách thẳng
  const roof = new THREE.CylinderGeometry(r, r, length, 20, 1, true, 0, Math.PI);
  mesh(g, roof, film, { p: [length / 2, wall, 0], r: [Math.PI / 2, 0, Math.PI / 2], cast: false, receive: false });
  for (const side of [-1, 1]) mesh(g, G.box(length, wall, 0.02), film, { p: [length / 2, wall / 2, side * r], cast: false, receive: false });
  // Vách hai đầu: nửa đĩa trên + chữ nhật dưới
  const endTop = new THREE.CircleGeometry(r, 20, 0, Math.PI);
  for (const x of [0, length]) {
    mesh(g, endTop, film, { p: [x, wall, 0], r: [0, Math.PI / 2, 0], cast: false, receive: false });
    mesh(g, G.box(0.02, wall, width), film, { p: [x, wall / 2, 0], cast: false, receive: false });
  }
  // Cửa đầu tây (khung xanh lá, cửa mở) + biển nhỏ
  mesh(g, G.box(0.1, 2.1, 0.08), 0x3f8f5a, { p: [-0.02, 1.05, -0.6] });
  mesh(g, G.box(0.1, 2.1, 0.08), 0x3f8f5a, { p: [-0.02, 1.05, 0.6] });
  mesh(g, G.box(0.1, 0.08, 1.28), 0x3f8f5a, { p: [-0.02, 2.1, 0] });
  mesh(g, G.box(0.04, 2.0, 0.6), film, { p: [-0.25, 1.0, -0.9], r: [0, 0.7, 0], cast: false, receive: false }); // cánh cửa mở
  // Quạt thông gió đầu đông
  const fans: THREE.Object3D[] = [];
  for (const z of [-r * 0.45, r * 0.45]) {
    const f = group(g, { p: [length + 0.04, 1.2, z], r: [0, Math.PI / 2, 0] });
    mesh(f, G.box(0.9, 0.9, 0.12), 0x5f6b77);
    mesh(f, G.cyl(0.38, 0.38, 0.13, 16), 0x2a2d35, { r: [Math.PI / 2, 0, 0] });
    const blades = group(f, { p: [0, 0, 0.08] });
    for (let k = 0; k < 3; k++) mesh(blades, G.box(0.08, 0.6, 0.02), 0xcfd6dc, { r: [0, 0, (k * Math.PI * 2) / 3] });
    fans.push(blades);
  }
  return { g, fans };
}

// ---------- Xe cộ (khu chợ) ----------

/** Đèn pha / đèn hậu dùng chung: sáng lên khi trời tối (khu gọi setVehicleLights). */
const headMat = crayonize(new THREE.MeshToonMaterial({ color: 0xfff6d0, emissive: 0xffe8a0, emissiveIntensity: 0 }));
const tailMat = crayonize(new THREE.MeshToonMaterial({ color: 0xd9433a, emissive: 0xff3020, emissiveIntensity: 0 }));
export function setVehicleLights(night: number): void {
  headMat.emissiveIntensity = night * 1.8;
  tailMat.emissiveIntensity = night * 1.2;
}

export function wheel(g: THREE.Object3D, x: number, z: number, r: number, w = 0.18): THREE.Mesh {
  const m = mesh(g, G.cyl(r, r, w, 12), 0x2a2d35, { p: [x, r, z], r: [Math.PI / 2, 0, 0] });
  mesh(m, G.cyl(r * 0.45, r * 0.45, w + 0.02, 8), 0xcfd6dc);
  return m;
}

/** Các loại ô tô con: sedan, SUV, bán tải, xe tải mini. */
export type CarKind = 'sedan' | 'suv' | 'pickup' | 'mini';
export const CAR_KINDS: readonly CarKind[] = ['sedan', 'suv', 'pickup', 'mini'];
/** Bảng màu sơn ô tô: đỏ, xanh dương, trắng, bạc, đen, vàng, xanh lá, cam, xanh ngọc, đỏ đô, be, xanh navy. */
export const CAR_COLORS: readonly number[] = [0xe2574c, 0x4a9bd8, 0xf3f3f3, 0xa9b1ba, 0x34373e, 0xf2c94c, 0x5fae57, 0xe2703a, 0x3fb6a8, 0x8a2f3a, 0xd9c7a3, 0x2f4f8a];

type Pt = [number, number];
const profiles = new Map<string, THREE.ExtrudeGeometry>();
/** Khối lăng trụ theo hình nhìn ngang (x tới trước, y lên), đùn dọc z rộng `depth`, tâm ở z = 0. Có cache. */
export function side(pts: Pt[], depth: number): THREE.ExtrudeGeometry {
  const key = `${depth}|${pts.join(';')}`;
  let geo = profiles.get(key);
  if (!geo) {
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    profiles.set(key, (geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2)));
  }
  return geo;
}

export const GLASS = 0x56748c;
export const TRIM = 0x3b3f46;
export const CHROME = 0xcfd6dc;

/** Tấm kính phẳng nằm trên mặt nghiêng từ a tới b (kính chắn gió / kính sau) + một vệt sáng phản chiếu. */
export function slopeGlass(g: THREE.Object3D, a: Pt, b: Pt, w: number, streak = true): void {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const nx = -Math.sin(ang) * Math.sign(dx || 1) * 0.012;
  const ny = Math.cos(ang) * Math.sign(dx || 1) * 0.012;
  const mid: V3 = [(a[0] + b[0]) / 2 + nx, (a[1] + b[1]) / 2 + ny, 0];
  const p = group(g, { p: mid, r: [0, 0, ang] });
  mesh(p, G.box(len - 0.08, 0.02, w), GLASS, { cast: false });
  if (streak) mesh(p, G.box(0.05, 0.022, w * 0.5), 0xdbe9f2, { p: [len * 0.12, 0.002, -w * 0.12], r: [0, 0.7, 0], cast: false });
}

/** Cửa kính hai bên: hình nhìn ngang thu nhỏ vào trong, đùn rộng hơn cabin chút xíu để lộ ra ở hai hông. */
export function sideGlass(g: THREE.Object3D, pts: Pt[], w: number): void {
  mesh(g, side(pts, w), GLASS, { cast: false });
}

/** Đèn pha, đèn hậu, cản trước / sau, lưới tản nhiệt, biển số, gương — phần chung của mọi loại xe. */
export function carTrim(g: THREE.Object3D, o: { front: number; back: number; w: number; lightY: number; bumperY: number; mirror: V3; grille?: number }): void {
  const { front, back, w, lightY, bumperY } = o;
  for (const s of [-1, 1]) {
    mesh(g, G.box(0.05, 0.1, 0.2), headMat, { p: [front + 0.01, lightY, s * (w / 2 - 0.15)], cast: false });
    mesh(g, G.box(0.05, 0.11, 0.16), tailMat, { p: [back - 0.01, lightY + 0.02, s * (w / 2 - 0.12)], cast: false });
    mesh(g, G.box(0.16, 0.08, 0.06), TRIM, { p: o.mirror.map((v, i) => (i === 2 ? v * s : v)) as V3 }); // gương chiếu hậu
  }
  mesh(g, G.box(0.05, o.grille ?? 0.1, w * 0.4), TRIM, { p: [front + 0.01, lightY, 0], cast: false }); // lưới tản nhiệt
  for (const [x, d] of [[front, 1], [back, -1]] as const) {
    mesh(g, G.box(0.1, 0.13, w + 0.04), TRIM, { p: [x + d * 0.03, bumperY, 0] }); // cản
    mesh(g, G.box(0.02, 0.09, 0.26), 0xf3efe6, { p: [x + d * 0.085, bumperY + 0.01, 0], cast: false }); // biển số
  }
}

/** Tay nắm cửa nhỏ ở hai hông tại các x. */
function handles(g: THREE.Object3D, xs: number[], y: number, w: number): void {
  for (const x of xs) for (const s of [-1, 1]) mesh(g, G.box(0.1, 0.025, 0.02), CHROME, { p: [x, y, s * (w / 2 + 0.005)], cast: false });
}

/** Thùng gỗ đựng rau củ (chở trên bán tải / xe tải mini). */
function crate(g: THREE.Object3D, p: V3, produce: number, ry = 0): void {
  const c = group(g, { p, r: [0, ry, 0] });
  mesh(c, G.box(0.42, 0.24, 0.32), 0xc9965a, { p: [0, 0.12, 0] });
  for (const y of [0.07, 0.17]) mesh(c, G.box(0.43, 0.025, 0.33), 0xa8763f, { p: [0, y, 0], cast: false });
  for (let i = 0; i < 6; i++) mesh(c, G.sphere(0.065, 8, 6), produce, { p: [-0.12 + (i % 3) * 0.12, 0.25, i < 3 ? -0.07 : 0.07], cast: false });
}

/**
 * Ô tô con chạy theo +x, theo loại: sedan (thấp, có cốp), SUV (cao vuông, giá nóc, lốp dự phòng),
 * bán tải (cabin kép + thùng chở thùng rau), xe tải mini (đầu bằng, thùng lửng chở hàng). Dài ≤ 2.6 m để vừa ô đậu xe.
 */
export function makeCar(color: number, kind: CarKind = 'sedan'): THREE.Group {
  const g = group(null);
  if (kind === 'sedan') {
    const w = 1.12;
    mesh(g, side([[-1.24, 0.3], [1.24, 0.3], [1.26, 0.58], [1.16, 0.7], [0.42, 0.78], [-0.78, 0.8], [-1.2, 0.75], [-1.26, 0.58]], w), color);
    mesh(g, side([[0.44, 0.78], [0.02, 1.16], [-0.52, 1.16], [-0.8, 0.8]], w - 0.12), color); // cabin
    sideGlass(g, [[0.32, 0.82], [0.0, 1.1], [-0.18, 1.1], [-0.18, 0.82]], w - 0.1);
    sideGlass(g, [[-0.26, 0.82], [-0.26, 1.1], [-0.5, 1.1], [-0.7, 0.82]], w - 0.1);
    slopeGlass(g, [0.44, 0.78], [0.02, 1.16], w - 0.22);
    slopeGlass(g, [-0.8, 0.8], [-0.52, 1.16], w - 0.22, false);
    mesh(g, G.box(2.0, 0.08, w + 0.01), TRIM, { p: [0, 0.34, 0], cast: false }); // ốp sườn
    handles(g, [0.12, -0.36], 0.72, w);
    carTrim(g, { front: 1.26, back: -1.26, w, lightY: 0.6, bumperY: 0.38, mirror: [0.38, 0.86, w / 2 - 0.02] });
    for (const x of [-0.78, 0.8]) for (const z of [-0.5, 0.5]) wheel(g, x, z, 0.27);
  } else if (kind === 'suv') {
    const w = 1.22;
    mesh(g, side([[-1.22, 0.38], [1.22, 0.38], [1.25, 0.76], [1.16, 0.9], [0.58, 0.96], [-1.22, 0.98]], w), color);
    mesh(g, side([[0.6, 0.96], [0.26, 1.46], [-1.16, 1.46], [-1.22, 0.98]], w - 0.1), color); // cabin
    sideGlass(g, [[0.48, 1.0], [0.22, 1.38], [0.02, 1.38], [0.02, 1.0]], w - 0.08);
    sideGlass(g, [[-0.08, 1.0], [-0.08, 1.38], [-0.58, 1.38], [-0.58, 1.0]], w - 0.08);
    sideGlass(g, [[-0.68, 1.0], [-0.68, 1.38], [-1.06, 1.38], [-1.1, 1.0]], w - 0.08);
    slopeGlass(g, [0.6, 0.96], [0.26, 1.46], w - 0.2);
    mesh(g, G.box(0.02, 0.36, w - 0.3), GLASS, { p: [-1.235, 1.2, 0], cast: false }); // kính sau
    mesh(g, G.box(2.3, 0.16, w + 0.02), TRIM, { p: [0, 0.44, 0], cast: false }); // ốp nhựa đen quanh gầm
    for (const s of [-1, 1]) mesh(g, G.box(1.3, 0.04, 0.04), TRIM, { p: [-0.42, 1.52, s * (w / 2 - 0.12)] }); // giá nóc
    for (const x of [-0.85, 0.05]) mesh(g, G.box(0.05, 0.035, w - 0.2), TRIM, { p: [x, 1.55, 0] });
    const spare = mesh(g, G.cyl(0.27, 0.27, 0.16, 12), 0x2a2d35, { p: [-1.32, 0.78, 0], r: [0, 0, Math.PI / 2] }); // lốp dự phòng (không quay)
    mesh(spare, G.cyl(0.16, 0.16, 0.17, 8), color);
    handles(g, [-0.05, -0.62], 0.9, w);
    carTrim(g, { front: 1.25, back: -1.22, w, lightY: 0.78, bumperY: 0.46, mirror: [0.52, 1.04, w / 2 - 0.02], grille: 0.16 });
    for (const x of [-0.78, 0.78]) for (const z of [-0.55, 0.55]) wheel(g, x, z, 0.33, 0.2);
  } else if (kind === 'pickup') {
    const w = 1.2;
    mesh(g, side([[-1.3, 0.38], [1.3, 0.38], [1.32, 0.76], [1.2, 0.88], [0.72, 0.94], [-0.2, 0.96], [-0.2, 0.62], [-1.3, 0.62]], w), color);
    mesh(g, side([[0.74, 0.94], [0.42, 1.42], [-0.14, 1.42], [-0.2, 0.96]], w - 0.1), color); // cabin
    sideGlass(g, [[0.62, 0.98], [0.38, 1.34], [0.2, 1.34], [0.2, 0.98]], w - 0.08);
    sideGlass(g, [[0.12, 0.98], [0.12, 1.34], [-0.1, 1.34], [-0.12, 0.98]], w - 0.08);
    slopeGlass(g, [0.74, 0.94], [0.42, 1.42], w - 0.2);
    // Thùng sau: sàn đen, hai thành + bửng sau màu xe
    mesh(g, G.box(1.06, 0.02, w - 0.14), 0x2a2d35, { p: [-0.76, 0.63, 0], cast: false });
    for (const s of [-1, 1]) mesh(g, G.box(1.1, 0.36, 0.07), color, { p: [-0.75, 0.8, s * (w / 2 - 0.035)] });
    mesh(g, G.box(0.07, 0.36, w), color, { p: [-1.27, 0.8, 0] });
    for (const s of [-1, 1]) mesh(g, G.box(1.12, 0.03, 0.09), TRIM, { p: [-0.75, 0.995, s * (w / 2 - 0.035)], cast: false });
    crate(g, [-0.5, 0.64, -0.2], 0xf28c28, 0.1);
    crate(g, [-0.96, 0.64, 0.22], 0x5fae57, -0.15);
    crate(g, [-0.62, 0.89, 0.04], 0xd9433a, 0.25); // thùng chồng lên cho lộ hàng trên thành thùng
    mesh(g, G.box(2.4, 0.15, w + 0.02), TRIM, { p: [0, 0.44, 0], cast: false });
    handles(g, [0.36, -0.02], 0.88, w);
    carTrim(g, { front: 1.32, back: -1.3, w, lightY: 0.74, bumperY: 0.46, mirror: [0.66, 1.0, w / 2 - 0.02], grille: 0.18 });
    for (const x of [-0.85, 0.82]) for (const z of [-0.55, 0.55]) wheel(g, x, z, 0.32, 0.2);
  } else {
    // Xe tải mini đầu bằng: cabin vuông phía trước, thùng lửng phía sau
    const w = 1.1;
    const bed = 0xd9dde0;
    mesh(g, side([[0.48, 0.34], [1.18, 0.34], [1.2, 0.86], [1.12, 1.48], [1.02, 1.56], [0.48, 1.56]], w), color); // cabin
    sideGlass(g, [[1.06, 0.98], [1.02, 1.44], [0.62, 1.44], [0.62, 0.98]], w + 0.02);
    slopeGlass(g, [1.2, 0.9], [1.12, 1.46], w - 0.14);
    mesh(g, G.box(0.03, 0.02, 0.5), TRIM, { p: [1.21, 0.92, 0.1], r: [0, 0, 0.3], cast: false }); // cần gạt nước
    mesh(g, G.box(2.0, 0.12, w - 0.1), TRIM, { p: [-0.2, 0.36, 0] }); // khung gầm
    mesh(g, G.box(1.66, 0.06, w), bed, { p: [-0.42, 0.6, 0] }); // sàn thùng
    for (const s of [-1, 1]) mesh(g, G.box(1.66, 0.28, 0.04), bed, { p: [-0.42, 0.76, s * (w / 2 - 0.02)] });
    mesh(g, G.box(0.04, 0.28, w), bed, { p: [-1.23, 0.76, 0] });
    // Khung che sau cabin (dàn ống)
    for (const s of [-1, 1]) mesh(g, G.box(0.04, 0.6, 0.04), TRIM, { p: [0.4, 0.92, s * (w / 2 - 0.05)] });
    for (const y of [1.0, 1.2]) mesh(g, G.box(0.04, 0.035, w - 0.1), TRIM, { p: [0.4, y, 0] });
    crate(g, [-0.05, 0.63, -0.22], 0xd9433a);
    crate(g, [-0.05, 0.63, 0.22], 0x5fae57, 0.08);
    crate(g, [-0.55, 0.63, 0.0], 0xf2c43e, -0.1);
    crate(g, [-0.08, 0.88, 0.0], 0xf28c28, 0.12);
    crate(g, [-0.98, 0.63, 0.18], 0x9fcf6a, 0.05);
    handles(g, [0.7], 0.92, w);
    for (const s of [-1, 1]) {
      mesh(g, G.box(0.05, 0.12, 0.18), headMat, { p: [1.2, 0.66, s * (w / 2 - 0.16)], cast: false });
      mesh(g, G.box(0.04, 0.1, 0.1), tailMat, { p: [-1.26, 0.48, s * (w / 2 - 0.1)], cast: false });
      mesh(g, G.box(0.12, 0.1, 0.05), TRIM, { p: [1.12, 1.2, s * (w / 2 + 0.04)] }); // gương
    }
    mesh(g, G.box(0.04, 0.06, w * 0.45), TRIM, { p: [1.2, 0.66, 0], cast: false });
    mesh(g, G.box(0.1, 0.13, w + 0.02), TRIM, { p: [1.21, 0.42, 0] }); // cản trước
    mesh(g, G.box(0.02, 0.09, 0.26), 0xf3efe6, { p: [1.265, 0.42, 0], cast: false });
    mesh(g, G.box(0.02, 0.09, 0.26), 0xf3efe6, { p: [-1.26, 0.62, 0], cast: false });
    for (const x of [-0.8, 0.86]) for (const z of [-0.5, 0.5]) wheel(g, x, z, 0.24, 0.16);
  }
  return g;
}

const HELMETS = [0xf2b23e, 0xe2574c, 0xf3f3f3, 0x4a9bd8, 0x2a2d35, 0xf08fb0];

/** Mũ bảo hiểm nửa đầu kiểu Việt Nam: vỏ tròn, vành lưỡi trai phía trước, quai dưới cằm. */
export function addHelmet(head: THREE.Object3D, color: number): void {
  for (const c of head.children) if (c.position.y > 0.3) c.visible = false; // tóc dựng / búi trên đỉnh đầu nằm trong mũ
  const h = group(head, { p: [0, 0.24, -0.02] });
  mesh(h, G.sphere(0.29, 12, 8), color, { s: [1, 0.84, 1.02] });
  mesh(h, G.box(0.3, 0.03, 0.14), color, { p: [0, -0.04, 0.27], r: [0.18, 0, 0] }); // lưỡi trai
  for (const s of [-1, 1]) mesh(h, G.box(0.02, 0.2, 0.03), 0x2a2d35, { p: [s * 0.2, -0.22, 0.06], cast: false }); // quai
}

/**
 * Xe tay ga (chạy theo +x): thân sau bo tròn, yên dài, sàn để chân, yếm trước cao, tay lái ngả về phía người lái
 * (có đèn pha, xi-nhan, gương), chắn bùn trước, đèn hậu, baga, ống pô. `rider` (makePerson) ngồi lên yên,
 * đội mũ bảo hiểm; khu gọi animatePerson(rider, t, { sit: true, ride: true }) để hai tay nắm tay lái.
 * Người lái luôn là phần tử con cuối cùng của xe (ẩn khi xe đậu).
 */
export function makeScooter(color: number, rider: THREE.Group): THREE.Group {
  const g = group(null);
  const w = 0.32;
  mesh(g, side([[-0.74, 0.42], [-0.62, 0.3], [-0.2, 0.28], [-0.04, 0.36], [-0.04, 0.62], [-0.66, 0.66], [-0.78, 0.56]], w), color); // thân sau
  mesh(g, side([[-0.66, 0.64], [-0.06, 0.62], [-0.02, 0.69], [-0.18, 0.74], [-0.56, 0.75], [-0.7, 0.7]], w - 0.04), 0x2a2d35); // yên
  mesh(g, G.box(0.32, 0.06, w - 0.02), TRIM, { p: [0.08, 0.31, 0] }); // sàn để chân
  mesh(g, side([[0.2, 0.3], [0.34, 0.3], [0.43, 0.6], [0.32, 0.96], [0.18, 0.96], [0.22, 0.6]], w + 0.04), color); // yếm trước
  mesh(g, G.torus(0.25, 0.04, 4, 10, Math.PI), color, { p: [0.47, 0.22, 0], s: [1, 1, 2.2] }); // chắn bùn trước
  // Tay lái: ốp đầu xe + đèn pha, hai tay nắm, gương
  const bar = group(g, { p: [0.17, 0.98, 0] });
  mesh(bar, G.box(0.2, 0.1, 0.24), color);
  mesh(bar, G.box(0.04, 0.07, 0.14), headMat, { p: [0.1, 0, 0], cast: false });
  for (const s of [-1, 1]) {
    mesh(bar, G.box(0.05, 0.05, 0.14), 0x2a2d35, { p: [0, 0, s * 0.18] }); // tay nắm
    mesh(bar, G.box(0.05, 0.04, 0.05), 0xf2a23a, { p: [0.08, -0.02, s * 0.1], cast: false }); // xi-nhan
    mesh(bar, G.box(0.02, 0.2, 0.02), TRIM, { p: [-0.02, 0.1, s * 0.14], r: [s * 0.25, 0, 0], cast: false }); // cần gương
    mesh(bar, G.box(0.03, 0.06, 0.1), TRIM, { p: [-0.02, 0.2, s * 0.17] });
  }
  mesh(g, G.box(0.05, 0.08, 0.14), tailMat, { p: [-0.77, 0.56, 0], cast: false }); // đèn hậu
  mesh(g, G.box(0.22, 0.03, 0.2), TRIM, { p: [-0.66, 0.74, 0] }); // baga
  mesh(g, G.box(0.38, 0.07, 0.07), 0x8a929c, { p: [-0.42, 0.26, 0.14], r: [0, 0, 0.12] }); // ống pô
  mesh(g, G.box(0.24, 0.02, 0.12), 0xf3efe6, { p: [-0.7, 0.42, 0], r: [0, 0, 0.5], cast: false }); // biển số
  for (const x of [-0.45, 0.47]) wheel(g, x, 0, 0.22, 0.12);
  rider.position.set(-0.24, 0.32, 0);
  rider.rotation.y = Math.PI / 2;
  addHelmet(rider.userData.rig.head, HELMETS[Math.abs(color + rider.id) % HELMETS.length]);
  g.add(rider);
  return g;
}

/**
 * Cây ăn quả theo giống (cam, táo, xoài, chuối) và giai đoạn lớn 0..2: cây con → cây non → cây trưởng thành có trái.
 * Gốc ở y = 0 (đặt trên ụ đất của ô vườn).
 */
export function makeFruitTree(producerId: string, stage: 0 | 1 | 2): THREE.Group {
  if (producerId === 'banana_tree') return makeBananaPlant(stage);
  const g = group(null);
  const k = [0.45, 0.75, 1][stage];
  const leaf = producerId === 'mango_tree' ? 0x3f7f3a : producerId === 'apple_tree' ? 0x5fae57 : 0x4f9e4a;
  // Thân gỗ nâu, hai cành chạc
  mesh(g, G.cyl(0.1 * k, 0.17 * k, 1.3 * k, 8), 0x7a5a3a, { p: [0, 0.65 * k, 0] });
  for (const side of [-1, 1]) mesh(g, G.cyl(0.04 * k, 0.07 * k, 0.6 * k, 6), 0x7a5a3a, { p: [side * 0.18 * k, 1.3 * k, 0], r: [0, 0, -side * 0.6] });
  const crown: [number, number, number, number][] = [[0, 1.75, 0, 0.75], [0.45, 1.5, 0.15, 0.5], [-0.42, 1.55, -0.1, 0.52], [0.05, 1.45, -0.42, 0.5], [-0.1, 1.5, 0.42, 0.5]];
  for (const [x, y, z, r] of crown) mesh(g, G.ico(r * k, 1), leaf, { p: [x * k, y * k, z * k] });
  if (stage === 0) return g;
  // Trái nằm NGOÀI tán lá (trên mặt các khối tán) cho thấy rõ: cây non chỉ có vài trái xanh nhỏ, cây lớn trĩu trái chín
  const ripe = stage === 2;
  const count = ripe ? 14 : 5;
  for (let i = 0; i < count; i++) {
    const [cx, cy, cz, cr] = crown[i % crown.length];
    const a = i * 2.39996; // góc vàng: rải đều quanh tán
    const up = 0.1 + 0.75 * ((i * 0.618) % 1); // nửa trên tán: nhìn từ camera trên cao thấy rõ
    const nx = Math.cos(a) * Math.cos(up);
    const nz = Math.sin(a) * Math.cos(up);
    const ny = Math.sin(up);
    const p: V3 = [(cx + nx * cr) * k, (cy + ny * cr) * k, (cz + nz * cr) * k];
    if (p[1] < 1.1 * k) p[1] = 1.1 * k + (i % 3) * 0.08;
    fruitOn(g, producerId, p, ripe);
  }
  return g;
}

/** Một trái theo giống: cam tròn cam có núm; táo đỏ hơi dẹt, cuống + lá; xoài thuôn dài vàng ửng đỏ. Chưa chín thì nhỏ và xanh. */
function fruitOn(g: THREE.Group, producerId: string, p: V3, ripe: boolean): void {
  const f = group(g, { p, s: ripe ? 1.5 : 0.8 });
  if (producerId === 'apple_tree') {
    mesh(f, G.sphere(0.12, 10, 8), ripe ? 0xd9433a : 0x9fcf6a, { s: [1, 0.88, 1], cast: false });
    mesh(f, G.cyl(0.012, 0.012, 0.08, 4), 0x6b4a2f, { p: [0, 0.12, 0], cast: false });
    mesh(f, G.box(0.08, 0.01, 0.04), 0x4f9e4a, { p: [0.04, 0.14, 0], r: [0, 0, 0.5], cast: false });
  } else if (producerId === 'mango_tree') {
    mesh(f, G.cyl(0.008, 0.008, 0.16, 4), 0x6b4a2f, { p: [0, 0.12, 0], cast: false }); // cuống dài treo trái
    mesh(f, G.sphere(0.1, 10, 8), ripe ? 0xf2c43e : 0x7fb35a, { p: [0, -0.04, 0], s: [0.85, 1.45, 0.75], cast: false });
    if (ripe) mesh(f, G.sphere(0.06, 8, 6), 0xe2703a, { p: [0.04, 0.02, 0.04], cast: false }); // má ửng đỏ
  } else {
    mesh(f, G.sphere(0.13, 10, 8), ripe ? 0xf28c28 : 0x7fb35a, { cast: false });
    mesh(f, G.sphere(0.03, 6, 5), 0x4f7f3a, { p: [0, 0.12, 0], cast: false }); // núm cam
  }
}

/**
 * Cây chuối — KHÔNG phải thân gỗ: thân giả là các bẹ lá xanh cuộn chồng lên nhau (có sọc nâu), tàu lá to dài
 * vươn lên rồi rủ xuống, gân giữa sáng màu, mép lá rách; cây lớn có buồng chuối treo trên cuống cong
 * (các nải quả hướng lên) và bắp chuối tím ở đầu cuống; gốc có cây con mọc bên cạnh.
 */
function makeBananaPlant(stage: 0 | 1 | 2): THREE.Group {
  const g = group(null);
  const k = [0.5, 0.78, 1][stage];
  const h = 1.9 * k;
  // Thân giả: 3 lớp bẹ lá chồng nhau, thon dần lên trên
  mesh(g, G.cyl(0.15 * k, 0.22 * k, h, 10), 0x8db35a, { p: [0, h / 2, 0] });
  mesh(g, G.cyl(0.165 * k, 0.2 * k, h * 0.55, 10), 0x7a9e4a, { p: [0, h * 0.28, 0] });
  for (let i = 0; i < 3; i++) mesh(g, G.box(0.04 * k, h * 0.35, 0.02), 0x8a6a45, { p: [Math.cos(i * 2.1) * 0.19 * k, h * (0.25 + i * 0.15), Math.sin(i * 2.1) * 0.19 * k], r: [0, -i * 2.1, 0], cast: false });
  // Tàu lá: đoạn trong vươn lên, đoạn ngoài rủ xuống
  const leaves = stage === 0 ? 4 : 7;
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + 0.3;
    const len = (1.0 + (i % 3) * 0.15) * k;
    const arm = group(g, { p: [0, h - 0.05, 0], r: [0, a, 0] });
    const inner = group(arm, { r: [-0.95 + (i % 2) * 0.15, 0, 0] });
    mesh(inner, G.box(0.03 * k, 0.03 * k, 0.3 * k), 0x9fcf6a, { p: [0, 0, 0.15 * k] }); // cuống lá
    mesh(inner, G.box(0.42 * k, 0.02, len), 0x5fae57, { p: [0, 0, 0.3 * k + len / 2] });
    mesh(inner, G.box(0.035 * k, 0.03, len), 0xb5d98a, { p: [0, 0.012, 0.3 * k + len / 2], cast: false }); // gân giữa
    const outer = group(inner, { p: [0, 0, 0.3 * k + len], r: [0.9, 0, 0] });
    mesh(outer, G.box(0.36 * k, 0.02, 0.55 * k), 0x4f9e4a, { p: [0, 0, 0.27 * k] });
    mesh(outer, G.box(0.08 * k, 0.021, 0.12 * k), 0x8db35a, { p: [0.16 * k, 0, 0.2 * k], cast: false }); // vết rách mép lá
  }
  if (stage === 2) {
    // Buồng chuối: cuống cong chìa ra rồi trĩu xuống, 3 nải quả cong hướng lên, bắp chuối tím ở cuối
    const stalk = group(g, { p: [0, h - 0.15, 0.12], r: [0.5, 0, 0] });
    mesh(stalk, G.cyl(0.035, 0.035, 0.5, 6), 0x7a9e4a, { p: [0, 0.05, 0.25], r: [Math.PI / 2 - 0.2, 0, 0] });
    const bunch = group(g, { p: [0, h - 0.55, 0.42] });
    mesh(bunch, G.cyl(0.03, 0.03, 0.75, 6), 0x7a9e4a, { p: [0, -0.1, 0] });
    for (let tier = 0; tier < 3; tier++) {
      for (let j = 0; j < 7; j++) {
        const a = (j / 7) * Math.PI * 2 + tier * 0.4;
        const fruit = group(bunch, { p: [Math.cos(a) * 0.1, 0.18 - tier * 0.2, Math.sin(a) * 0.1], r: [0, -a, 0] });
        mesh(fruit, G.capsule(0.035, 0.15), 0xf6dd5a, { p: [0.06, 0.06, 0], r: [0, 0, -0.55], cast: false });
        mesh(fruit, G.sphere(0.018, 5, 4), 0x5a4a2a, { p: [0.12, 0.17, 0], cast: false }); // đầu núm
      }
    }
    mesh(bunch, G.cone(0.08, 0.24, 8), 0x7a2f5a, { p: [0, -0.58, 0], r: [Math.PI, 0, 0] }); // bắp chuối
    // Cây chuối con mọc bên gốc
    const pup = group(g, { p: [0.45, 0, -0.25], s: 0.35 });
    mesh(pup, G.cyl(0.15, 0.2, 1.2, 8), 0x8db35a, { p: [0, 0.6, 0] });
    for (let i = 0; i < 3; i++) mesh(pup, G.box(0.35, 0.02, 0.8), 0x5fae57, { p: [Math.cos(i * 2.1) * 0.3, 1.3, Math.sin(i * 2.1) * 0.3], r: [-0.7, -i * 2.1 + Math.PI / 2, 0] });
  }
  return g;
}
