import * as THREE from 'three';
import { MOTO_W } from './curbside';
import { signText } from './cuisine';
import { makeBush, makeTree } from './models';
import { G, group, mesh, seeded, toon } from './toon';

/**
 * XÓM QUANH QUÁN (khu quán, mọi phong cách): nhà phố ống kiểu Việt Nam + cây xanh cho bớt trống trải.
 *  - Dãy nhà phía sau quán (bên kia hẻm sau) - quán ốc đã có dãy nhà phố riêng ở street.ts nên bỏ dãy này.
 *  - Hai bên, ngoài bãi xe máy / bãi ô tô: nhà mặt tiền quay ra đường, cây bóng mát trên vỉa hè.
 *  - Bụi cây, cây cao điểm xuyết giữa các nhà; cửa sổ sáng đèn vàng khi trời tối.
 * Mặt bằng tính theo cỡ quán (halfW / backZ / frontZ) nên quán nâng hạng rộng ra thì xóm tự giãn theo.
 */
export interface NeighborDims {
  halfW: number;
  backZ: number;
  frontZ: number;
  /** Quán ốc vỉa hè: đã có dãy nhà phía sau. */
  street: boolean;
  /** Phần quán còn nới thêm về phía Đông tới hạng cao nhất (m): xóm chừa chỗ cho bãi đất hoang. */
  eastExtra?: number;
}

const FRONTS = [0xf7c6a3, 0xbfe0c8, 0xf6e2a0, 0xc9d8f0, 0xf4b7b7, 0xd9c7ee, 0xf2d6b3, 0xb9dbe0];
const SIGNS: [string, string][] = [
  ['Tạp hóa Thu', '#d9433a'],
  ['Tiệm may Hoa', '#2f6fb0'],
  ['Sửa xe Tâm', '#3b3f46'],
  ['Thuốc tây', '#2f9e5a'],
  ['Cắt tóc', '#9a6bd1'],
  ['Photo · In ấn', '#e2703a'],
  ['Bánh mì', '#c7832e'],
  ['Điện nước', '#2f6fb0'],
];

/**
 * Nhà phố ống: tầng trệt cửa cuốn hoặc cửa kính + mái hiên + bảng hiệu, các tầng trên có cửa sổ, ban công lan can sắt +
 * chậu cây, máy lạnh; nóc là mái ngói dốc hoặc sân thượng có lan can + bồn nước. Gốc ở giữa chân mặt tiền, mặt nhìn +z.
 */
function townhouse(parent: THREE.Object3D, w: number, floors: number, seed: number, win: THREE.Material, sign?: [string, string]): THREE.Group {
  const rnd = seeded(seed * 131 + 7);
  const g = group(parent);
  const D = 5;
  const FH = 2.9;
  const H = floors * FH + 0.3;
  const color = FRONTS[seed % FRONTS.length];
  const dark = new THREE.Color(color).multiplyScalar(0.8).getHex();
  mesh(g, G.box(w, H, D), color, { p: [0, H / 2, -D / 2] });
  // Gờ phân tầng
  for (let f = 1; f < floors; f++) mesh(g, G.box(w + 0.06, 0.12, 0.1), dark, { p: [0, f * FH, 0.03], cast: false });
  // Tầng trệt: cửa cuốn (nửa số nhà) hoặc cửa kính mở bán hàng
  if (rnd() < 0.5) {
    mesh(g, G.box(w - 0.6, 2.2, 0.06), 0xb9bec4, { p: [0, 1.1, 0.02] });
    for (let k = 0; k < 8; k++) mesh(g, G.box(w - 0.6, 0.025, 0.08), 0x9aa1a8, { p: [0, 0.2 + k * 0.26, 0.04], cast: false });
  } else {
    mesh(g, G.box(w - 0.6, 2.2, 0.04), win, { p: [0, 1.1, 0.02], cast: false });
    for (const sx of [-1, 0, 1]) mesh(g, G.box(0.06, 2.2, 0.06), 0x5a3b2a, { p: [sx * (w - 0.6) / 2, 1.1, 0.04], cast: false });
    // Chậu cây hai bên cửa
    for (const sx of [-1, 1]) {
      mesh(g, G.cyl(0.18, 0.14, 0.3, 10), 0xb5553c, { p: [sx * (w / 2 - 0.2), 0.15, 0.35] });
      mesh(g, G.ico(0.24, 1), 0x5fae57, { p: [sx * (w / 2 - 0.2), 0.45, 0.35], cast: false });
    }
  }
  // Mái hiên tôn + bảng hiệu
  const awn = rnd() < 0.5 ? 0xd9433a : 0x2f6fb0;
  mesh(g, G.box(w + 0.1, 0.06, 0.9), awn, { p: [0, 2.45, 0.42], r: [0.18, 0, 0] });
  if (sign) {
    const b = group(g, { p: [0, 2.78, 0.05] });
    mesh(b, G.box(w - 0.3, 0.45, 0.06), 0xfffaf1);
    const t = signText(sign[0], sign[1], w - 0.5, 0.36);
    t.position.z = 0.04;
    b.add(t);
  }
  // Các tầng trên: 2 cửa sổ (hoặc cửa ban công), lan can, chậu cây, máy lạnh
  for (let f = 1; f < floors; f++) {
    const y = f * FH;
    const balcony = rnd() < 0.6;
    if (balcony) {
      mesh(g, G.box(w - 0.2, 0.08, 0.7), dark, { p: [0, y + 0.06, 0.35] });
      for (let k = 0; k <= Math.round(w / 0.25); k++) mesh(g, G.box(0.025, 0.7, 0.025), 0x3b3f46, { p: [-w / 2 + 0.15 + k * ((w - 0.3) / Math.round(w / 0.25)), y + 0.45, 0.68], cast: false });
      mesh(g, G.box(w - 0.25, 0.04, 0.04), 0x3b3f46, { p: [0, y + 0.8, 0.68], cast: false });
      mesh(g, G.box(w * 0.55, 1.9, 0.05), win, { p: [0, y + 1.05, 0.02], cast: false }); // cửa ra ban công
      for (const sx of [-1, 1]) {
        mesh(g, G.box(0.4, 0.2, 0.2), 0xb5553c, { p: [sx * (w / 2 - 0.45), y + 0.2, 0.5] });
        mesh(g, G.ico(0.2, 1), rnd() < 0.5 ? 0x5fae57 : 0xe86a8a, { p: [sx * (w / 2 - 0.45), y + 0.42, 0.5], cast: false });
      }
    } else {
      for (const sx of [-1, 1]) {
        mesh(g, G.box(w * 0.28, 1.2, 0.05), win, { p: [sx * w * 0.22, y + 1.4, 0.02], cast: false });
        mesh(g, G.box(w * 0.32, 0.08, 0.16), dark, { p: [sx * w * 0.22, y + 0.76, 0.06], cast: false });
      }
    }
    if (rnd() < 0.6) mesh(g, G.box(0.7, 0.45, 0.3), 0xf3f3f3, { p: [(rnd() < 0.5 ? -1 : 1) * (w / 2 - 0.5), y + 2.4, 0.16] }); // máy lạnh
  }
  // Nóc: mái ngói dốc hoặc sân thượng + bồn nước inox
  if (rnd() < 0.5) {
    mesh(g, G.prism(), rnd() < 0.5 ? 0xb5553c : 0x6f7fa8, { p: [0, H, -D / 2], s: [w + 0.3, 1.2, D + 0.3] });
  } else {
    mesh(g, G.box(w, 0.5, 0.12), dark, { p: [0, H + 0.25, 0] });
    mesh(g, G.cyl(0.4, 0.4, 0.9, 12), 0xcfd6dc, { p: [w * 0.2, H + 0.75, -D * 0.6], r: [0, 0, Math.PI / 2] });
    for (const sx of [-0.3, 0.3]) mesh(g, G.box(0.08, 0.4, 0.08), 0x8a939b, { p: [w * 0.2 + sx, H + 0.2, -D * 0.6] });
  }
  return g;
}

/** Dựng xóm quanh quán. Trả về hàm cập nhật (cửa sổ sáng đèn khi tối). */
export function buildNeighborhood(r: THREE.Object3D, d: NeighborDims): (night: number) => void {
  const rnd = seeded(77);
  const win = toon(0xbfe6ff, { emissive: 0xffc861, emissiveIntensity: 0 });
  let seed = 3;
  let sign = 0;
  const { halfW, frontZ } = d;
  const east = d.eastExtra ?? 0;
  // Hẻm sau + dãy nhà sau tính theo mép sau của quán ở hạng cao nhất
  const backZ = d.backZ;

  // Phía sau quán: hẻm sau lát xi măng + dãy nhà (mặt quay vào hẻm, tức quay về phía quán)
  if (!d.street) {
    const alleyZ = backZ - 1.6;
    mesh(r, G.box(halfW * 2 + east + 26, 0.04, 2.0), 0xcfcbc2, { p: [east / 2, -0.13, alleyZ], cast: false });
    let x = -halfW - 12;
    while (x < halfW + east + 12) {
      const w = 3.6 + rnd() * 1.4;
      const h = townhouse(r, w, 2 + Math.floor(rnd() * 2), seed++, win);
      h.position.set(x + w / 2, 0, alleyZ - 1.1);
      x += w + 0.1;
    }
    // (Đã bỏ 2 cây sát sau quán: đứng sau tường không thấy, tán lá lại lòi xuyên qua tường vào trong quán)
  }

  // Hai bên, sát mép ngoài hai bãi xe (bãi rộng ~5.6 m): nhà mặt tiền quay ra đường, nhà đầu dãy ngay cạnh bãi
  for (const side of [-1, 1]) {
    // Bên trái có thêm bãi xe máy ngoài bãi ô tô → dãy nhà bên trái lùi ra thêm
    // Bên phải: chừa bãi đất hoang (quán còn nới về phía Đông)
    const off = side < 0 ? MOTO_W + 0.2 : east - 5.2;
    let x = halfW + 6.4 + off;
    for (let i = 0; i < 4; i++) {
      const w = 3.8 + rnd() * 1.2;
      const h = townhouse(r, w, 2 + Math.floor(rnd() * 2), seed++, win, SIGNS[sign++ % SIGNS.length]);
      h.position.set(side * (x + w / 2), 0, frontZ - 0.3);
      x += w + 0.1;
    }
    // Sau dãy nhà, dọc mép bãi xe: hàng bụi cây + cây cao (che khoảng cỏ trống tới sau quán)
    const fx = side * (halfW + 6.3 + off);
    for (let z = backZ - 0.5; z < frontZ - 5.6; z += 0.9) makeBush(r, { p: [fx, 0, z], s: 1.1 + rnd() * 0.3 });
    for (let z = backZ + 0.4; z < frontZ - 6; z += 3.2) makeTree(r, { p: [side * (halfW + 7.6 + off), 0, z], s: 1.3 + rnd() * 0.3 }, 0x4f9e4a);
    // Cây bóng mát trên vỉa hè trước dãy nhà (bồn gốc cây)
    for (const tx of [halfW + 9.5 + off, halfW + 15 + off]) {
      const px = side * tx;
      mesh(r, G.box(1.1, 0.12, 1.1), 0x8a6a45, { p: [px, -0.02, frontZ + 2.3], cast: false });
      makeTree(r, { p: [px, 0, frontZ + 2.3], s: 1.2 + rnd() * 0.25 }, 0x4f9e4a);
    }
    // Góc sau bãi xe: cây to
    if (side < 0) makeTree(r, { p: [side * (halfW + 4.6), 0, backZ - 0.6], s: 1.5 }); // bên phải là bãi đất hoang
  }

  return (night) => {
    win.emissiveIntensity = night * 1.1;
    win.color.setHex(0xbfe6ff).lerp(new THREE.Color(0xfff1c2), night);
  };
}
