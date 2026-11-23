import * as THREE from 'three';
import { animatePerson } from './models';
import { G, group, mesh, toon, type V3 } from './toon';

/**
 * Hàng rong ở vỉa hè chợ (StallDef.kind): xe hủ tiếu gõ ('cart'), gánh bánh tráng trộn ('pole'), xe đạp cà phê ('bike').
 * Mặt trước quay về +z (phía camera). Trả kèm chỗ đặt bảng tên / món bày / người bán để cảnh chợ gắn thêm.
 */
export type StreetKind = 'cart' | 'pole' | 'bike';

export interface StreetCart {
  g: THREE.Group;
  /** Bảng tên: bề rộng chữ, vị trí, màu viền. */
  board: { w: number; p: V3; color: number };
  /** Hàng emoji món bày (showItems): độ cao, bề rộng, z. */
  items: { y: number; w: number; z: number };
  /** Chỗ bốc khói (nồi nước lèo). */
  steam?: V3;
  /** Người bán: vị trí, nón, ngồi ghế (độ cao ghế) hay đứng. */
  vendorAt: V3;
  hat: 'none' | 'straw';
  seat?: number;
}

const BAMBOO = 0xd9c27a;
const RATTAN = 0xc9a066;
const STEEL = 0xbfc5cc;

/** Thanh tròn nối hai điểm (khung xe đạp, dây quang gánh). */
function rod(parent: THREE.Object3D, a: V3, b: V3, r: number, color: number | THREE.Material): THREE.Mesh {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const m = mesh(parent, G.cyl(r, r, 1, 6), color, { cast: false });
  m.scale.set(1, len, 1);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
  return m;
}

/** Bánh xe có nan (nằm trong mặt phẳng xy, nhìn từ camera thấy tròn). */
function spokeWheel(parent: THREE.Object3D, p: V3, r: number, tire = 0x2a2d35): THREE.Group {
  const w = group(parent, { p });
  mesh(w, G.torus(r, 0.035, 6, 18), tire);
  mesh(w, G.torus(r - 0.04, 0.012, 4, 18), STEEL, { cast: false });
  mesh(w, G.cyl(0.045, 0.045, 0.08, 8), STEEL, { r: [Math.PI / 2, 0, 0] });
  for (let k = 0; k < 6; k++) mesh(w, G.box(0.012, (r - 0.04) * 2, 0.012), STEEL, { r: [0, 0, (k * Math.PI) / 6], cast: false });
  return w;
}

/** Ghế đẩu nhựa thấp (vuông, chân loe). */
export function plasticStool(parent: THREE.Object3D, x: number, z: number, color: number, h = 0.3): THREE.Group {
  const s = group(parent, { p: [x, 0, z] });
  mesh(s, G.cyl(0.15, 0.2, h - 0.03, 4), color, { p: [0, (h - 0.03) / 2, 0], r: [0, Math.PI / 4, 0] });
  mesh(s, G.cyl(0.17, 0.16, 0.04, 4), color, { p: [0, h - 0.02, 0], r: [0, Math.PI / 4, 0] });
  return s;
}

/** Hũ nhựa nhỏ đựng topping: thân trong + ruột màu + nắp. */
function jar(parent: THREE.Object3D, p: V3, fill: number, lid: number): void {
  const j = group(parent, { p });
  mesh(j, G.cyl(0.065, 0.065, 0.13, 10), toon(0xf4f8fb, { transparent: true, opacity: 0.45 }), { p: [0, 0.065, 0], cast: false });
  mesh(j, G.cyl(0.055, 0.055, 0.09, 10), fill, { p: [0, 0.05, 0], cast: false });
  mesh(j, G.cyl(0.07, 0.07, 0.03, 10), lid, { p: [0, 0.14, 0], cast: false });
}

/** Xe hủ tiếu gõ: thùng gỗ sơn xanh viền đỏ, tủ kính bày vắt hủ tiếu, nồi nước lèo, mái tôn đỏ, 2 bánh căm + chân chống. */
function noodleCart(): StreetCart {
  const g = group(null);
  const body = 0x3f8fb5;
  const red = 0xd93a32;
  // Thùng xe + viền
  mesh(g, G.box(1.9, 0.6, 0.8), body, { p: [0, 0.85, 0] });
  for (const y of [0.56, 1.15]) mesh(g, G.box(1.96, 0.06, 0.86), red, { p: [0, y, 0] });
  mesh(g, G.box(2.0, 0.04, 0.9), 0xb9733f, { p: [0, 1.2, 0] }); // mặt gỗ
  // Bánh căm hai bên hông + trục, chân chống phía phải, tay đẩy phía trái
  for (const z of [0.47, -0.47]) spokeWheel(g, [-0.35, 0.36, z], 0.34);
  mesh(g, G.cyl(0.02, 0.02, 0.98, 6), STEEL, { p: [-0.35, 0.36, 0], r: [Math.PI / 2, 0, 0] });
  for (const z of [0.3, -0.3]) mesh(g, G.box(0.05, 0.56, 0.05), 0x2f3a44, { p: [0.82, 0.28, z] });
  for (const z of [0.32, -0.32]) {
    rod(g, [-0.95, 0.85, z], [-1.3, 0.95, z], 0.025, 0x2f3a44);
    mesh(g, G.cyl(0.035, 0.035, 0.14, 6), 0x3a2a1e, { p: [-1.33, 0.96, z], r: [0, 0, Math.PI / 2 - 0.28] });
  }
  // Tủ kính (khung đỏ) bày vắt hủ tiếu, bát, rau
  const cab = group(g, { p: [-0.42, 1.22, 0] });
  for (const [x, z] of [[-0.5, 0.33], [0.5, 0.33], [-0.5, -0.33], [0.5, -0.33]] as const) mesh(cab, G.box(0.05, 0.6, 0.05), red, { p: [x, 0.3, z] });
  mesh(cab, G.box(1.08, 0.05, 0.72), red, { p: [0, 0.62, 0] });
  mesh(cab, G.box(1.0, 0.56, 0.66), toon(0xcfefff, { transparent: true, opacity: 0.32 }), { p: [0, 0.3, 0], cast: false });
  for (let i = 0; i < 4; i++) mesh(cab, G.box(0.17, 0.08, 0.14), 0xf6ecd2, { p: [-0.33 + i * 0.2, 0.06, 0.12], r: [0, i * 0.3, 0], cast: false }); // vắt hủ tiếu
  for (let i = 0; i < 3; i++) mesh(cab, G.cyl(0.11, 0.07, 0.05, 12), 0xffffff, { p: [0.3, 0.04 + i * 0.05, -0.15], cast: false }); // chồng bát
  mesh(cab, G.ico(0.1, 0), 0x6fbf4a, { p: [-0.3, 0.08, -0.15], s: [1.3, 0.6, 1], cast: false }); // rổ rau
  mesh(cab, G.box(0.22, 0.04, 0.14), 0xe8a3a0, { p: [0.0, 0.03, -0.15], cast: false }); // thịt xá xíu thái
  // Nồi nước lèo + bếp than
  mesh(g, G.cyl(0.24, 0.24, 0.12, 12), 0x3b3f46, { p: [0.5, 1.28, 0] });
  mesh(g, G.cyl(0.28, 0.26, 0.42, 14), STEEL, { p: [0.5, 1.55, 0] });
  mesh(g, G.cyl(0.29, 0.29, 0.03, 14), 0xdfe4ea, { p: [0.5, 1.77, 0] });
  mesh(g, G.sphere(0.04, 6, 5), 0x3a2a1e, { p: [0.5, 1.81, 0] });
  for (const s of [-1, 1]) mesh(g, G.box(0.08, 0.04, 0.04), 0x3a2a1e, { p: [0.5 + s * 0.31, 1.65, 0] });
  // Chai tương ớt, hũ đũa trên mặt gỗ phía trước
  mesh(g, G.cyl(0.035, 0.045, 0.18, 8), 0xe5463c, { p: [0.12, 1.31, 0.3] });
  mesh(g, G.cyl(0.035, 0.045, 0.18, 8), 0x5a3221, { p: [0.22, 1.31, 0.3] });
  mesh(g, G.cyl(0.05, 0.05, 0.12, 8), 0xb9733f, { p: [0.92, 1.28, 0.3] });
  for (let k = 0; k < 4; k++) mesh(g, G.box(0.012, 0.22, 0.012), 0xf2e2b8, { p: [0.9 + (k % 2) * 0.03, 1.4, 0.29 + (k >> 1) * 0.03], cast: false });
  // Mái tôn đỏ trên 4 cột, diềm trắng răng cưa phía trước, đèn lồng nhỏ
  for (const [x, z] of [[-0.92, 0.38], [0.92, 0.38], [-0.92, -0.38], [0.92, -0.38]] as const) mesh(g, G.box(0.04, 1.08, 0.04), 0x8a5a35, { p: [x, 1.76, z] });
  const roof = group(g, { p: [0, 2.32, 0] });
  mesh(roof, G.box(2.15, 0.05, 1.08), red, { r: [0.06, 0, 0] });
  for (let i = 0; i < 9; i++) mesh(roof, G.box(0.2, 0.1, 0.02), 0xffffff, { p: [-0.96 + i * 0.24, -0.08, 0.55], cast: false });
  const lantern = group(g, { p: [0.15, 2.0, 0.42] });
  mesh(lantern, G.box(0.006, 0.22, 0.006), 0x3a2a1e, { p: [0, 0.18, 0], cast: false });
  mesh(lantern, G.sphere(0.09, 8, 6), 0xe5463c, { s: [1, 1.2, 1] });
  mesh(lantern, G.cyl(0.04, 0.04, 0.03, 8), 0xf2c14e, { p: [0, -0.11, 0] });
  // Ghế nhựa thấp + bàn nhựa cho khách
  plasticStool(g, -1.55, 0.95, 0x4a9bd8);
  plasticStool(g, 1.75, 1.05, 0x4a9bd8);
  return { g, board: { w: 1.5, p: [0, 0.86, 0.46], color: red }, items: { y: 1.82, w: 1.1, z: 0.45 }, steam: [0.5, 2.05, 0], vendorAt: [1.3, 0, -0.15], hat: 'none' }; // đứng cạnh nồi nước lèo (sau tủ kính bị che)
}

/** Gánh bánh tráng trộn: hai thúng tre có quang + mẹt bày hũ topping và xấp bánh tráng, đòn gánh tre gác trên quang. */
function snackPole(): StreetCart {
  const g = group(null);
  for (const [sx, side] of [[-0.82, 0], [0.82, 1]] as const) {
    const b = group(g, { p: [sx, 0, 0.15] });
    mesh(b, G.cyl(0.38, 0.3, 0.34, 12), RATTAN, { p: [0, 0.17, 0] });
    for (const y of [0.1, 0.22]) mesh(b, G.torus(0.35 + y * 0.12, 0.012, 4, 16), 0xa9814f, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], cast: false });
    mesh(b, G.torus(0.39, 0.025, 5, 16), 0x9a7040, { p: [0, 0.34, 0], r: [Math.PI / 2, 0, 0] });
    // Mẹt tre trên miệng thúng
    mesh(b, G.cyl(0.47, 0.45, 0.04, 16), 0xe2c48a, { p: [0, 0.37, 0] });
    mesh(b, G.torus(0.47, 0.025, 5, 18), 0xa9814f, { p: [0, 0.39, 0], r: [Math.PI / 2, 0, 0], cast: false });
    // Quang: 4 sợi mây từ mép thúng chụm lên móc
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      rod(b, [Math.cos(a) * 0.4, 0.3, Math.sin(a) * 0.4], [0, 1.1, 0], 0.012, 0x8a5a35);
    }
    mesh(b, G.torus(0.04, 0.012, 4, 10), 0x5a3b2a, { p: [0, 1.12, 0], cast: false });
    if (side === 0) {
      // Hũ topping: xoài xanh, tôm khô, trứng cút, hành phi, sa tế, khô bò
      const fills: [number, number][] = [[0x9ccf5a, 0x5fae57], [0xe8763a, 0xe5463c], [0xf6efe0, 0xf2c14e], [0xb07a3c, 0x4a9bd8], [0xc0392b, 0xe5463c], [0x8a3a22, 0xf2c14e]];
      fills.forEach(([f, l], i) => jar(b, [Math.cos(i * 1.05) * 0.27, 0.39, Math.sin(i * 1.05) * 0.27], f, l));
      jar(b, [0, 0.39, 0], 0x5fae57, 0xe5463c); // rau răm
    } else {
      // Xấp bánh tráng tròn, mấy bịch bánh trộn sẵn, thau inox + đũa
      for (let i = 0; i < 6; i++) mesh(b, G.cyl(0.19, 0.19, 0.012, 14), 0xf3e2bd, { p: [-0.18 + (i % 2) * 0.012, 0.4 + i * 0.013, -0.12], cast: false });
      for (let i = 0; i < 3; i++) {
        const bag = group(b, { p: [0.1 + i * 0.13, 0.42, 0.2 - i * 0.04], r: [0, i * 0.5, 0] });
        mesh(bag, G.box(0.11, 0.05, 0.14), toon(0xf6f1e6, { transparent: true, opacity: 0.7 }), { cast: false });
        mesh(bag, G.box(0.08, 0.03, 0.1), 0xd9783a, { cast: false });
        mesh(bag, G.box(0.03, 0.04, 0.03), 0xe5463c, { p: [0, 0.035, -0.06], cast: false });
      }
      mesh(b, G.cyl(0.13, 0.08, 0.08, 14), STEEL, { p: [0.18, 0.43, -0.12] });
      mesh(b, G.cyl(0.11, 0.11, 0.02, 14), 0xd9783a, { p: [0.18, 0.46, -0.12], cast: false });
    }
  }
  // Đòn gánh tre (có đốt) gác trên hai móc quang
  const pole = group(g, { p: [0, 1.15, 0.15] });
  mesh(pole, G.cyl(0.035, 0.035, 2.3, 8), BAMBOO, { r: [0, 0, Math.PI / 2] });
  for (const x of [-0.9, -0.3, 0.3, 0.9]) mesh(pole, G.cyl(0.04, 0.04, 0.03, 8), 0xb9a05a, { p: [x, 0, 0], r: [0, 0, Math.PI / 2], cast: false });
  // Ghế đẩu thấp cho người bán + ghế cho khách
  plasticStool(g, 0, -0.5, 0x5fae57, 0.22);
  plasticStool(g, -0.6, 1.15, 0xe2574c, 0.26);
  plasticStool(g, 0.6, 1.15, 0xe2574c, 0.26);
  return { g, board: { w: 1.3, p: [0, 0.32, 0.72], color: 0x5fae57 }, items: { y: 1.25, w: 1.6, z: 0.15 }, vendorAt: [0, 0.22, -0.5], hat: 'straw', seat: 0.22 };
}

/** Xe đạp cà phê: khung xe đạp, thùng gỗ sau baga với 2 phích + ly cà phê sữa đá, thùng xốp đá phía trước, dù che. */
function coffeeBike(): StreetCart {
  const g = group(null);
  const frame = 0x2f6f8f;
  spokeWheel(g, [-0.62, 0.34, 0], 0.32);
  spokeWheel(g, [0.62, 0.34, 0], 0.32);
  const R: V3 = [-0.62, 0.34, 0];
  const F: V3 = [0.62, 0.34, 0];
  const BB: V3 = [-0.06, 0.3, 0];
  const S: V3 = [-0.24, 0.92, 0];
  const H: V3 = [0.42, 0.95, 0];
  const Hb: V3 = [0.47, 0.72, 0];
  for (const [a, b] of [[R, BB], [R, S], [S, BB], [S, H], [BB, Hb], [H, Hb]] as const) rod(g, a, b, 0.025, frame);
  rod(g, Hb, F, 0.02, frame); // càng trước
  mesh(g, G.cyl(0.07, 0.07, 0.03, 10), 0x3b3f46, { p: [-0.06, 0.3, 0.04], r: [Math.PI / 2, 0, 0] }); // đĩa xích
  rod(g, S, [-0.27, 1.02, 0], 0.018, STEEL);
  mesh(g, G.box(0.22, 0.05, 0.12), 0x3a2a1e, { p: [-0.28, 1.05, 0] }); // yên
  rod(g, H, [0.4, 1.1, 0], 0.018, STEEL);
  mesh(g, G.cyl(0.015, 0.015, 0.5, 6), STEEL, { p: [0.4, 1.1, 0], r: [Math.PI / 2, 0, 0] }); // ghi đông
  for (const z of [0.24, -0.24]) mesh(g, G.cyl(0.022, 0.022, 0.08, 6), 0x3a2a1e, { p: [0.4, 1.1, z], r: [Math.PI / 2, 0, 0] });
  rod(g, [-0.06, 0.3, 0.06], [0.08, 0, 0.22], 0.015, 0x3b3f46); // chân chống
  // Baga sau + thùng gỗ
  mesh(g, G.box(0.66, 0.03, 0.4), 0x3b3f46, { p: [-0.6, 0.76, 0] });
  for (const x of [-0.85, -0.35]) rod(g, [x, 0.76, 0], [-0.62, 0.34, 0], 0.012, 0x3b3f46);
  const box = group(g, { p: [-0.62, 0.78, 0] });
  mesh(box, G.box(0.66, 0.42, 0.5), 0x8a5a35, { p: [0, 0.21, 0] });
  mesh(box, G.box(0.68, 0.04, 0.52), 0x6b4a2f, { p: [0, 0.43, 0] });
  mesh(box, G.box(0.5, 0.26, 0.01), 0xfff1d6, { p: [0, 0.21, 0.255], cast: false });
  mesh(box, G.box(0.3, 0.06, 0.012), 0x6b4a2f, { p: [0, 0.25, 0.262], cast: false }); // chữ "CÀ PHÊ" cách điệu
  mesh(box, G.box(0.2, 0.04, 0.012), 0xd93a32, { p: [0, 0.15, 0.262], cast: false });
  // 2 phích (đỏ, xanh) + khay ly cà phê sữa đá trên nắp thùng
  for (const [x, c] of [[-0.18, 0xd93a32], [0.0, 0x3fb6a8]] as const) {
    mesh(box, G.cyl(0.075, 0.075, 0.3, 12), c, { p: [x, 0.6, -0.1] });
    mesh(box, G.sphere(0.075, 10, 6), 0xe8e8e8, { p: [x, 0.75, -0.1], s: [1, 0.5, 1] });
    mesh(box, G.cyl(0.03, 0.03, 0.04, 8), 0x3b3f46, { p: [x, 0.79, -0.1] });
  }
  const glass = toon(0xf4f8fb, { transparent: true, opacity: 0.4 });
  for (let i = 0; i < 4; i++) {
    const cx = -0.22 + (i % 2) * 0.12 + 0.24;
    const cz = 0.08 + Math.floor(i / 2) * 0.12;
    mesh(box, G.cyl(0.045, 0.035, 0.14, 10), glass, { p: [cx, 0.52, cz], cast: false });
    mesh(box, G.cyl(0.038, 0.032, 0.07, 10), 0x6b3f22, { p: [cx, 0.49, cz], cast: false });
    mesh(box, G.cyl(0.04, 0.038, 0.03, 10), 0xf0e2c8, { p: [cx, 0.54, cz], cast: false });
  }
  for (let i = 0; i < 5; i++) mesh(box, G.cyl(0.045, 0.035, 0.03, 10), glass, { p: [-0.25, 0.46 + i * 0.03, 0.12], cast: false }); // chồng ly
  // Rổ trước + thùng xốp đá
  mesh(g, G.box(0.36, 0.2, 0.36), 0x8a5a35, { p: [0.66, 0.98, 0] });
  mesh(g, G.box(0.34, 0.24, 0.32), 0xf8f8f4, { p: [0.66, 1.18, 0] });
  mesh(g, G.box(0.36, 0.04, 0.34), 0x4a9bd8, { p: [0.66, 1.31, 0] });
  // Dù che: cán cắm sau thùng, tán 8 múi hai màu
  rod(g, [-0.88, 0.8, -0.2], [-0.62, 2.35, -0.1], 0.02, 0x8a5a35);
  const um = group(g, { p: [-0.6, 2.42, -0.1], r: [0, 0, -0.12] });
  mesh(um, G.cone(1.0, 0.42, 8), 0xf2b23e);
  mesh(um, G.cone(0.55, 0.23, 8), 0xffffff, { p: [0, 0.1, 0], cast: false }); // chóp trắng
  for (let k = 0; k < 8; k++) mesh(um, G.sphere(0.035, 5, 4), 0xffffff, { p: [Math.cos((k * Math.PI) / 4) * 0.99, -0.21, Math.sin((k * Math.PI) / 4) * 0.99], cast: false }); // tua ở đầu gọng
  mesh(um, G.sphere(0.05, 6, 5), 0xd93a32, { p: [0, 0.23, 0] });
  // Ghế nhựa cho khách
  plasticStool(g, -0.2, 0.95, 0xe2574c);
  plasticStool(g, 0.55, 1.05, 0xf2b23e);
  return { g, board: { w: 1.0, p: [1.35, 0.52, 0.5], color: 0x6b4a2f }, items: { y: 1.55, w: 0.9, z: -0.15 }, vendorAt: [-0.15, 0, -0.75], hat: 'none' };
}

export function makeStreetCart(kind: StreetKind): StreetCart {
  return kind === 'cart' ? noodleCart() : kind === 'pole' ? snackPole() : coffeeBike();
}

/**
 * Đồ nghề trên tay người bán: chú Tư cầm cặp thanh tre gõ "cóc cóc", cô bán bánh tráng ôm thau trộn. Gọi sau makePerson.
 */
export function equipCartVendor(kind: StreetKind, vendor: THREE.Group): void {
  const rig = vendor.userData.rig as { armR: THREE.Object3D; armL: THREE.Object3D } | undefined;
  if (!rig) return;
  vendor.userData.cartKind = kind;
  if (kind === 'cart') {
    const k = group(rig.armR, { p: [0, -0.3, 0.03], r: [Math.PI / 2, 0, 0] });
    mesh(k, G.cyl(0.03, 0.03, 0.2, 8), BAMBOO, { p: [0, 0.06, 0] }); // ống tre
    mesh(k, G.box(0.02, 0.22, 0.02), 0x8a5a35, { p: [0.05, 0.07, 0] }); // que gõ
  } else if (kind === 'pole') {
    const bowl = group(vendor, { p: [0, 0.5, 0.3] });
    mesh(bowl, G.cyl(0.16, 0.1, 0.1, 14), STEEL);
    mesh(bowl, G.cyl(0.14, 0.14, 0.02, 14), 0xd9783a, { p: [0, 0.04, 0], cast: false });
    vendor.userData.cartBowl = bowl;
  }
}

/**
 * Cử động người bán hàng rong: chú Tư đứng gõ cặp tre từng chặp, cô bánh tráng ngồi trộn (đảo tay trên thau),
 * cô cà phê đứng mời. Thỉnh thoảng ai cũng vẫy khách (`wave`).
 */
export function animateCartVendor(v: THREE.Group, t: number, wave: number): void {
  const kind = v.userData.cartKind as StreetKind | undefined;
  if (kind === 'pole') {
    animatePerson(v, t, { sit: true, cook: wave > 0.05 ? 0 : 1, wave });
    return;
  }
  animatePerson(v, t, { wave });
  if (kind === 'cart' && wave < 0.05) {
    // Gõ từng chặp ~1.6 giây mỗi 5 giây: tay phải giơ cặp tre trước ngực, que gõ nhịp nhanh
    const arm = (v.userData.rig as { armR: THREE.Object3D }).armR;
    const on = t % 5 < 1.6;
    arm.rotation.x = on ? -1.25 + Math.abs(Math.sin(t * 14)) * 0.25 : -0.2;
  }
}
