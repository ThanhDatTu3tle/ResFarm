import * as THREE from 'three';
import { side } from './farmkit';
import { signText } from './cuisine';
import { emojiSprite, G, group, mesh, seeded, type V3 } from './toon';

/**
 * TRANG THIẾT BỊ ĐÃ MUA Ở SIÊU THỊ hiện trong quán (giai đoạn 15) — mua xong là thấy ngay:
 *  - decor (Cây cảnh & tranh treo): 2 chậu cây lá to hai bên cửa + tranh phong cảnh có đèn rọi treo tường bên (quán ốc: chậu cây ở góc trước)
 *  - knives (Bộ dao bếp xịn): thanh nam châm treo dao trên tường bếp (quán ốc: hộp dao trên xe đẩy)
 *  - music (Dàn loa): 2 loa treo góc tường sau, nốt nhạc bay lên (quán ốc: loa đứng trên cột đèn)
 *  - sign (Biển hiệu đèn LED): viền đèn LED nhấp nháy quanh biển tên quán (RestaurantArea.updateNameSign)
 *  - stove (Bếp công nghiệp): chụp hút khói inox trên dãy bếp + lửa xanh (quán ốc: bếp ga đôi lửa lớn cạnh xe đẩy)
 *  - porcelain (Bộ bát đĩa sứ): tủ chén kính bày đĩa sứ trắng viền xanh
 *  - icecream (Tủ kem): tủ kem nắp kính, khay kem nhiều màu, bảng KEM
 *  - irrigation (Hệ thống tưới) là đồ nông trại: vòi phun xoay ở các ruộng (areas/farm.ts).
 * Toạ độ mét của cảnh quán. Chỉ là hình: hiệu ứng gameplay nằm ở UpgradeDef.modifiers.
 */
export interface EquipDims {
  street: boolean;
  halfW: number;
  backZ: number;
  frontZ: number;
  kitchenZ: number;
  kitchenX1: number;
  /** Tâm + nửa chiều dài dãy bếp (quán trong nhà). */
  kitchenCenter: number;
  kitchenHalf: number;
  door: [number, number];
  /**
   * Mặt bằng riêng (quầy chữ L quán Nhật, bếp sát cửa quán Việt): dãy bếp (tâm, chiều dài, góc xoay — 0 = dọc tường sau),
   * chỗ treo dao, tủ chén, tủ kem [x, z, góc xoay]. Bỏ trống = theo dãy bếp tường sau.
   */
  line?: { x: number; z: number; len: number; rot: number };
  knife?: [number, number, number];
  cabinet?: [number, number, number];
  freezer?: [number, number, number];
  /** Quán trong nhà: tâm z hai ô cửa sổ tường bên và khoảng tường giữa chúng (treo tranh, loa, kê tủ kem cho khỏi bị cửa sổ che). */
  sideWins?: [number, number];
  /** Quán ốc: chỗ xe đẩy, bếp nướng. */
  cart?: { x: number; z: number };
  grill?: { x: number; z: number };
}

export interface EquipView {
  g: THREE.Group;
  update(t: number): void;
}

const STEEL = 0xc7cfd6;
const STEEL_DK = 0x8f9aa4;
const glassMat = () => new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.28 });

/** Chậu cây lớn: chậu gốm men có viền + đất, cây lá to kiểu trầu bà / bàng Singapore (cuống + phiến lá có gân giữa). */
function bigPlant(parent: THREE.Object3D, x: number, z: number, seed: number): void {
  const rnd = seeded(seed);
  const p = group(parent, { p: [x, 0, z], r: [0, rnd() * 6, 0] });
  mesh(p, G.cyl(0.3, 0.22, 0.55, 14), 0xe9e2d4, { p: [0, 0.28, 0] });
  mesh(p, G.cyl(0.305, 0.3, 0.08, 14), 0x3f6f5a, { p: [0, 0.4, 0], cast: false }); // dải men xanh
  mesh(p, G.cyl(0.33, 0.31, 0.06, 14), 0xd9d0bf, { p: [0, 0.57, 0] });
  mesh(p, G.cyl(0.28, 0.28, 0.02, 14), 0x5a3b2a, { p: [0, 0.61, 0], cast: false }); // mặt đất nhô hơn vành 1cm (trùng mặt thì nhấp nháy xoáy)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd() * 0.4;
    const len = 0.55 + rnd() * 0.6;
    const tilt = 0.25 + rnd() * 0.45;
    const stem = group(p, { p: [0, 0.6, 0], r: [0, -a, 0] });
    const arm = group(stem, { r: [0, 0, -tilt] });
    mesh(arm, G.cyl(0.012, 0.018, len, 4), 0x4f7f3a, { p: [0, len / 2, 0] });
    const leaf = group(arm, { p: [0, len, 0], r: [0, 0, tilt + 0.5 + rnd() * 0.4] });
    const green = i % 3 ? 0x3f8f45 : 0x58a94e;
    mesh(leaf, G.sphere(0.16, 8, 6), green, { p: [0.14, 0, 0], s: [1.1, 0.12, 0.7] });
    mesh(leaf, G.box(0.3, 0.012, 0.012), 0x8fcf7a, { p: [0.14, 0.012, 0], cast: false }); // gân giữa
  }
}

/** Tranh treo: khung gỗ có gờ, giấy ngà, phong cảnh (trời, dãy núi lớp lớp, mặt trời / trăng, ruộng) + đèn rọi tranh đồng. */
function painting(parent: THREE.Object3D, p: V3, ry: number, kind: 0 | 1): void {
  const f = group(parent, { p, r: [0, ry, 0] });
  mesh(f, G.box(1.14, 0.84, 0.05), 0x6b4428);
  mesh(f, G.box(1.04, 0.74, 0.055), 0x8a5a35);
  mesh(f, G.box(0.96, 0.66, 0.06), 0xfff6e6, { p: [0, 0, 0.002] });
  const sky = kind ? 0xffd9a8 : 0xcfe8f2;
  mesh(f, G.box(0.9, 0.36, 0.062), sky, { p: [0, 0.13, 0.002], cast: false });
  mesh(f, G.sphere(0.08, 12, 8), kind ? 0xe2703a : 0xfff1b8, { p: [kind ? 0.22 : -0.24, 0.2, 0.03], s: [1, 1, 0.3], cast: false });
  const hills: [number, number, number, number][] = kind
    ? [[-0.2, 0.55, 0.32, 0x8a6a9a], [0.18, 0.45, 0.24, 0xa98ab5], [-0.02, 0.9, 0.14, 0x6b4f7a]]
    : [[-0.22, 0.5, 0.34, 0x6f9fa8], [0.2, 0.5, 0.26, 0x8bb8bf], [0, 0.9, 0.16, 0x4f7f6a]];
  for (const [x, w, h, c] of hills) mesh(f, G.prism(), c, { p: [x, -0.02, 0.034], s: [w, h, 0.01], cast: false });
  mesh(f, G.box(0.9, 0.14, 0.064), kind ? 0x9fc46a : 0x7fb35a, { p: [0, -0.24, 0.002], cast: false }); // ruộng / bãi cỏ
  for (let i = 0; i < 4; i++) mesh(f, G.box(0.9, 0.006, 0.066), 0x5f8f45, { p: [0, -0.28 + i * 0.03, 0.002], cast: false });
  // Đèn rọi tranh
  const lamp = group(f, { p: [0, 0.48, 0.06] });
  mesh(lamp, G.box(0.04, 0.08, 0.04), 0xc9a24a, { p: [0, -0.02, -0.04] });
  mesh(lamp, G.cyl(0.035, 0.045, 0.36, 10), 0xc9a24a, { p: [0, 0.03, 0.04], r: [0, 0, Math.PI / 2] });
}

/** Một con dao treo: cán gỗ có 2 đinh tán, lưỡi theo kiểu (dao bầu, dao chặt vuông, santoku, dao gọt, dao răng cưa). */
function knife(parent: THREE.Object3D, x: number, kind: number): void {
  const k = group(parent, { p: [x, -0.05, 0.04] });
  mesh(k, G.box(0.035, 0.13, 0.03), 0x5a3b2a, { p: [0, 0.03, 0] });
  for (const y of [0.0, 0.06]) mesh(k, G.sphere(0.007, 4, 3), 0xdfe5ea, { p: [0, y, 0.016], cast: false });
  mesh(k, G.box(0.04, 0.02, 0.032), 0x9aa3ad, { p: [0, -0.04, 0] }); // khâu
  const blade = 0xdfe5ea;
  if (kind === 1) mesh(k, G.box(0.13, 0.2, 0.008), blade, { p: [0.03, -0.15, 0] }); // dao chặt vuông
  else if (kind === 3) mesh(k, G.box(0.03, 0.13, 0.008), blade, { p: [0, -0.11, 0] }); // dao gọt
  else {
    const len = kind === 4 ? 0.3 : 0.27;
    mesh(k, G.box(kind === 2 ? 0.06 : 0.05, len, 0.008), blade, { p: [0.008, -0.05 - len / 2, 0] });
    mesh(k, G.box(0.03, 0.05, 0.008), blade, { p: [-0.006, -0.06 - len, 0], r: [0, 0, 0.5] }); // mũi vát
    if (kind === 4) for (let i = 0; i < 8; i++) mesh(k, G.box(0.01, 0.01, 0.009), 0xa8b0ba, { p: [0.033, -0.09 - i * 0.03, 0], r: [0, 0, 0.78], cast: false }); // răng cưa
  }
}

/** Loa treo tường: thùng gỗ óc chó, lưới vải sẫm, loa bass + loa treble có viền, đèn báo, giá treo chữ L. */
function speaker(parent: THREE.Object3D, p: V3, r: V3): void {
  const s = group(parent, { p });
  s.rotation.set(r[0], r[1], r[2], 'YXZ'); // quay trước, chúc xuống sau
  mesh(s, G.box(0.42, 0.62, 0.34), 0x5a3b2a);
  mesh(s, G.box(0.36, 0.56, 0.02), 0x2a2d35, { p: [0, 0, 0.17] });
  for (const [y, rr] of [[-0.1, 0.13], [0.16, 0.06]] as const) {
    mesh(s, G.torus(rr, 0.018, 5, 16), 0x5f6b77, { p: [0, y, 0.185], cast: false });
    mesh(s, G.cone(rr * 0.85, 0.05, 14), 0x3b3f46, { p: [0, y, 0.18], r: [-Math.PI / 2, 0, 0], cast: false });
    mesh(s, G.sphere(rr * 0.25, 8, 6), 0x8f9aa4, { p: [0, y, 0.19], s: [1, 1, 0.5], cast: false });
  }
  mesh(s, G.sphere(0.012, 6, 5), new THREE.MeshBasicMaterial({ color: 0x5fd08a }), { p: [0.13, -0.26, 0.185], cast: false });
  mesh(s, G.box(0.06, 0.06, 0.3), 0x3b3f46, { p: [0, 0.34, -0.14] }); // giá treo
}

/** Kem ốc quế 3D (bánh quế có vân ô + 2 viên kem + sốt). */
function iceCreamCone(parent: THREE.Object3D, p: V3, s: number): THREE.Group {
  const c = group(parent, { p, s });
  mesh(c, G.cone(0.1, 0.3, 10), 0xd9a15a, { p: [0, -0.15, 0], r: [Math.PI, 0, 0] });
  for (const y of [-0.08, -0.16]) mesh(c, G.torus(0.075 - (y + 0.08) * -0.4, 0.006, 3, 12), 0xb07a3a, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], cast: false });
  mesh(c, G.sphere(0.11, 12, 10), 0xf6a6c1, { p: [0, 0.04, 0] });
  mesh(c, G.sphere(0.09, 12, 10), 0xfff1b8, { p: [0, 0.17, 0] });
  mesh(c, G.sphere(0.03, 8, 6), 0xd9342b, { p: [0, 0.27, 0] }); // anh đào
  return c;
}

export function buildEquipment(parent: THREE.Object3D, d: EquipDims, owned: Set<string>): EquipView {
  const g = group(parent);
  const anims: ((t: number) => void)[] = [];
  const has = (id: string) => owned.has(id);
  const wallH = 3.3;

  if (has('decor')) {
    // Hai chậu cây lá to hai bên cửa
    for (const side of [-1, 1]) {
      const x = d.door[0] + side * (d.street ? d.halfW - 0.5 : 1.6);
      const z = d.street ? d.frontZ - 0.2 : d.frontZ + 0.55;
      bigPlant(g, x, z, side > 0 ? 11 : 23);
    }
    // Tranh phong cảnh treo hai tường bên (quán trong nhà)
    if (!d.street) {
      [-1, 1].forEach((side, k) => painting(g, [side * (d.halfW - 0.02), 2.2, d.sideWins ? (d.sideWins[0] + d.sideWins[1]) / 2 : (d.kitchenZ + d.frontZ) / 2], -side * Math.PI / 2, k as 0 | 1));
    }
  }

  if (has('knives')) {
    if (!d.street) {
      // Thanh gỗ nam châm + 5 con dao các kiểu trên tường bếp, bên trái dãy bếp
      const [x, z, rot] = d.knife ?? [d.kitchenCenter - d.kitchenHalf + 0.9, d.backZ + 0.05, 0];
      const bar = group(g, { p: [x, 1.85, z], r: [0, rot, 0] });
      mesh(bar, G.box(1.05, 0.08, 0.035), 0x8a5a35);
      mesh(bar, G.box(1.0, 0.03, 0.04), 0x3b3f46, { p: [0, 0, 0.005] }); // dải nam châm
      for (const sx of [-0.48, 0.48]) mesh(bar, G.cyl(0.012, 0.012, 0.045, 6), 0xdfe5ea, { p: [sx, 0, 0.01], r: [Math.PI / 2, 0, 0], cast: false });
      [0, 1, 2, 3, 4].forEach((kind, i) => knife(bar, -0.4 + i * 0.2, kind));
    } else if (d.cart) {
      // Quán ốc: hộp dao gỗ nghiêng ở chỗ thái đầu phải bàn ốc, cán dao cắm trong khe
      const blk = group(g, { p: [d.cart.x + 0.72, 0.99, d.cart.z - 0.12] });
      const body = group(blk, { p: [0, 0.12, 0], r: [0.3, 0, 0] });
      mesh(body, G.box(0.22, 0.24, 0.16), 0x8a5a35);
      mesh(body, G.box(0.2, 0.01, 0.14), 0x6b4428, { p: [0, 0.121, 0], cast: false });
      for (let i = 0; i < 4; i++) {
        mesh(body, G.box(0.03, 0.12, 0.028), i % 2 ? 0x2a1f1a : 0x5a3b2a, { p: [-0.075 + i * 0.05, 0.18, 0] });
        mesh(body, G.sphere(0.006, 4, 3), 0xdfe5ea, { p: [-0.075 + i * 0.05, 0.2, 0.015], cast: false });
      }
      mesh(blk, G.box(0.24, 0.02, 0.2), 0x6b4428, { p: [0, 0, 0.02] });
    }
  }

  if (has('music')) {
    const spots: [number, number, number][] = d.street
      ? [[-d.halfW - 0.15, 3.0, d.frontZ + 0.2], [d.halfW + 0.15, 3.0, d.frontZ + 0.2]]
      : [-1, 1].map((s) => [s * (d.halfW - 0.35), wallH + 0.15, d.sideWins ? (d.sideWins[0] + d.sideWins[1]) / 2 : d.kitchenZ + 0.4] as [number, number, number]);
    const notes: THREE.Sprite[] = [];
    spots.forEach(([x, y, z], i) => {
      // Trong nhà: quay mặt loa về tâm quán, chúc nhẹ xuống (quán ốc giữ góc cũ)
      const yaw = d.street ? (x < 0 ? 0.6 : -0.6) : Math.atan2(-x, (d.backZ + d.frontZ) / 2 - z);
      speaker(g, [x, y, z], [0.2, yaw, 0]);
      for (let k = 0; k < 2; k++) {
        const n = emojiSprite(k ? '🎵' : '🎶', 0.3);
        n.userData = { x, y: y + 0.3, z, phase: i * 1.3 + k * 2.1 };
        g.add(n);
        notes.push(n);
      }
    });
    anims.push((t) => {
      for (const n of notes) {
        const { x, y, z, phase } = n.userData as { x: number; y: number; z: number; phase: number };
        const k = ((t * 0.35 + phase) % 1.4) / 1.4;
        n.position.set(x + Math.sin(t * 2 + phase) * 0.2 + (x < 0 ? 0.3 : -0.3) * k, y + k * 1.1, z + k * 0.4);
        n.material.opacity = Math.sin(k * Math.PI);
      }
    });
  }

  if (has('stove')) {
    const flames: THREE.Mesh[] = [];
    const flameMat = new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.85 });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xbfe2ff, transparent: true, opacity: 0.9 });
    if (!d.street) {
      // Chụp hút khói inox hình thang (nhìn ngang) + lưới lọc + đèn, ống khói có đai; lửa xanh 2 lớp dưới chảo
      const line = d.line ?? { x: d.kitchenCenter, z: d.backZ + 0.55, len: d.kitchenHalf * 2, rot: 0 };
      const h = group(g, { p: [line.x, 0, line.z], r: [0, line.rot, 0] });
      const w = line.len;
      const deep = d.line ? 0.7 : 0.95;
      const hood = group(h, { r: [0, -Math.PI / 2, 0] }); // hình nhìn ngang đùn dọc dãy bếp
      mesh(hood, side([[-deep / 2, 2.38], [deep / 2, 2.38], [deep / 2, 2.5], [0.1, 2.78], [-deep / 2, 2.78]], w), STEEL);
      for (let i = 0; i < Math.max(2, Math.round(w / 0.5)); i++) {
        const n = Math.max(2, Math.round(w / 0.5));
        mesh(h, G.box(w / n - 0.06, 0.02, deep - 0.14), STEEL_DK, { p: [-w / 2 + (i + 0.5) * (w / n), 2.37, -0.03], cast: false }); // tấm lọc
        for (let k = 0; k < 4; k++) mesh(h, G.box(w / n - 0.08, 0.022, 0.012), 0x6f7a84, { p: [-w / 2 + (i + 0.5) * (w / n), 2.37, -deep / 2 + 0.12 + k * ((deep - 0.24) / 3)], cast: false });
      }
      for (const dx of [-w * 0.3, w * 0.3]) mesh(h, G.box(0.18, 0.015, 0.08), new THREE.MeshBasicMaterial({ color: 0xfff1c2 }), { p: [dx, 2.365, deep / 2 - 0.1], cast: false });
      mesh(h, G.box(0.46, 0.8, 0.46), STEEL, { p: [0, 3.15, -0.12] });
      for (const y of [2.95, 3.3]) mesh(h, G.box(0.49, 0.03, 0.49), STEEL_DK, { p: [0, y, -0.12], cast: false });
      for (const dx of d.line ? [-w * 0.3, 0, w * 0.3] : [-1.0, 0.2]) {
        flames.push(mesh(h, G.cone(0.12, 0.12, 8), flameMat, { p: [dx, 1.03, 0], cast: false }));
        flames.push(mesh(h, G.cone(0.06, 0.08, 6), coreMat, { p: [dx, 1.02, 0], cast: false }));
      }
    } else if (d.grill) {
      // Quán ốc: bếp ga đôi khung sắt, kiềng 3 chân + chảo gang có tay cầm, lửa xanh, ống dẫn ga ra bình ga đỏ
      const x = d.grill.x + 1.25;
      const z = d.grill.z - 0.2;
      for (const sx of [-0.35, 0.35]) for (const sz of [-0.2, 0.2]) mesh(g, G.box(0.04, 0.7, 0.04), 0x3b3f46, { p: [x + sx, 0.35, z + sz] });
      mesh(g, G.box(0.66, 0.03, 0.36), 0x3b3f46, { p: [x, 0.25, z] }); // kệ dưới
      mesh(g, G.box(0.85, 0.12, 0.5), 0x4a4f58, { p: [x, 0.75, z] });
      for (const sx of [-0.2, 0.2]) {
        mesh(g, G.torus(0.1, 0.015, 4, 14), 0x2a2d35, { p: [x + sx, 0.83, z], r: [Math.PI / 2, 0, 0], cast: false });
        for (let k = 0; k < 3; k++) mesh(g, G.box(0.02, 0.05, 0.1), 0x2a2d35, { p: [x + sx + Math.cos(k * 2.1) * 0.12, 0.86, z + Math.sin(k * 2.1) * 0.12], r: [0, -k * 2.1, 0] });
        mesh(g, G.cyl(0.18, 0.12, 0.08, 14), 0x2a2d35, { p: [x + sx, 0.93, z] });
        mesh(g, G.box(0.18, 0.025, 0.03), 0x5a3b2a, { p: [x + sx, 0.96, z + 0.24], r: [0, Math.PI / 2, 0] }); // tay chảo
        flames.push(mesh(g, G.cone(0.1, 0.12, 8), flameMat, { p: [x + sx, 0.86, z], cast: false }));
      }
      mesh(g, G.cyl(0.13, 0.13, 0.5, 10), 0xe2703a, { p: [x + 0.6, 0.25, z] }); // bình ga
      mesh(g, G.cyl(0.06, 0.08, 0.06, 8), 0x8f9aa4, { p: [x + 0.6, 0.53, z] });
      mesh(g, G.torus(0.13, 0.012, 4, 12, Math.PI), 0x2a2d35, { p: [x + 0.47, 0.55, z], r: [0, 0, 0], cast: false }); // ống ga
    }
    anims.push((t) => flames.forEach((f, i) => f.scale.set(1, 0.8 + Math.abs(Math.sin(t * 13 + i)) * 0.5, 1)));
  }

  if (has('porcelain')) {
    // Tủ chén gỗ: chân tủ, phào nóc, 2 cánh kính có song, 3 tầng đĩa dựng trên rãnh + chồng bát, ngăn kéo dưới
    const at: [number, number, number] = d.street ? [-d.halfW + 1.4, d.backZ + 0.45, 0] : (d.cabinet ?? [d.kitchenX1 - 0.32, (d.backZ + d.kitchenZ) / 2 + 0.2, -Math.PI / 2]);
    const c = group(g, { p: [at[0], 0, at[1]], r: [0, at[2], 0] });
    const wood = 0x9a6b44;
    const dark = 0x7a4f30;
    for (const sx of [-0.5, 0.5]) for (const sz of [-0.16, 0.16]) mesh(c, G.box(0.06, 0.12, 0.06), dark, { p: [sx, 0.06, sz] });
    // Thân rỗng: phần ngăn kéo đặc phía dưới, phía trên là hộp kính (tấm hậu + 2 vách hông + nóc) để thấy đĩa bên trong
    mesh(c, G.box(1.1, 0.48, 0.42), wood, { p: [0, 0.36, 0] });
    mesh(c, G.box(1.1, 1.32, 0.04), wood, { p: [0, 1.26, -0.19] });
    for (const sx of [-0.53, 0.53]) mesh(c, G.box(0.04, 1.32, 0.42), wood, { p: [sx, 1.26, 0] });
    mesh(c, G.box(1.1, 0.06, 0.42), wood, { p: [0, 1.9, 0] });
    mesh(c, G.box(1.2, 0.08, 0.5), dark, { p: [0, 1.96, 0] }); // phào nóc
    mesh(c, G.box(1.14, 0.05, 0.46), dark, { p: [0, 0.14, 0] });
    mesh(c, G.box(1.02, 1.3, 0.02), 0x5a3b2a, { p: [0, 1.26, -0.165], cast: false }); // lót hậu sẫm cho đĩa nổi lên
    for (const y of [0.78, 1.2, 1.62]) {
      mesh(c, G.box(1.0, 0.03, 0.34), dark, { p: [0, y - 0.15, 0.02] });
      mesh(c, G.box(1.0, 0.02, 0.02), 0x5a3b2a, { p: [0, y - 0.11, 0.12], cast: false }); // rãnh giữ đĩa
      for (let i = 0; i < 4; i++) {
        const p = group(c, { p: [-0.36 + i * 0.24, y, 0.06], r: [Math.PI / 2 - 0.25, 0, 0] });
        mesh(p, G.cyl(0.1, 0.1, 0.015, 16), 0xffffff);
        mesh(p, G.torus(0.085, 0.01, 4, 16), 0x2f6fbf, { p: [0, 0.01, 0], r: [Math.PI / 2, 0, 0], cast: false });
        mesh(p, G.sphere(0.025, 6, 5), 0x2f6fbf, { p: [0, 0.012, 0], s: [1, 0.2, 1], cast: false }); // hoa văn giữa đĩa
      }
    }
    for (let k = 0; k < 3; k++) mesh(c, G.cyl(0.08, 0.05, 0.05, 12), 0xffffff, { p: [0.36, 0.67 + k * 0.045, -0.06] }); // chồng bát
    // Cánh kính + song gỗ + núm
    for (const sx of [-0.26, 0.26]) {
      mesh(c, G.box(0.5, 1.32, 0.02), glassMat(), { p: [sx, 1.25, 0.215], cast: false });
      mesh(c, G.box(0.52, 0.04, 0.03), dark, { p: [sx, 1.25, 0.22], cast: false });
      for (const ex of [-0.25, 0.25]) mesh(c, G.box(0.03, 1.34, 0.03), dark, { p: [sx + ex, 1.25, 0.22], cast: false });
      mesh(c, G.sphere(0.02, 6, 5), 0xc9a24a, { p: [sx + (sx < 0 ? 0.2 : -0.2), 1.2, 0.24], cast: false });
    }
    for (const y of [0.58, 1.92]) mesh(c, G.box(1.04, 0.04, 0.03), dark, { p: [0, y, 0.22], cast: false });
    // Ngăn kéo dưới
    for (const sx of [-0.26, 0.26]) {
      mesh(c, G.box(0.48, 0.34, 0.02), 0xa8784a, { p: [sx, 0.38, 0.215] });
      mesh(c, G.box(0.12, 0.025, 0.03), 0xc9a24a, { p: [sx, 0.42, 0.235], cast: false });
    }
  }

  if (has('icecream')) {
    // Tủ kem nắp kính cong: thân trắng viền inox, dải hồng có chấm, khay kem có viên kem nhô lên, bánh xe,
    // bảng "KEM" chân đứng + cây kem ốc quế 3D nhún nhảy trên nóc
    const at: [number, number, number] = d.street ? [-d.halfW + 0.9, d.kitchenZ - 1.0, 0.3] : (d.freezer ?? [-d.halfW + 1.9, d.kitchenZ + 0.55, 0]);
    const f = group(g, { p: [at[0], 0, at[1]], r: [0, at[2], 0] });
    mesh(f, G.box(1.3, 0.78, 0.7), 0xfdfbf6, { p: [0, 0.47, 0] });
    mesh(f, G.box(1.28, 0.06, 0.68), 0x8f9aa4, { p: [0, 0.05, 0] });
    for (const sx of [-0.55, 0.55]) for (const sz of [-0.25, 0.25]) mesh(f, G.sphere(0.04, 6, 5), 0x3b3f46, { p: [sx, 0.04, sz], cast: false });
    mesh(f, G.box(1.32, 0.14, 0.72), 0xf08fb0, { p: [0, 0.6, 0] });
    for (let i = 0; i < 7; i++) mesh(f, G.sphere(0.022, 6, 5), 0xffffff, { p: [-0.54 + i * 0.18, 0.6, 0.362], s: [1, 1, 0.3], cast: false });
    mesh(f, G.box(1.34, 0.04, 0.74), STEEL, { p: [0, 0.87, 0] }); // viền inox miệng tủ
    const tubs = [0xfff1b8, 0xf6a6c1, 0x8b5a3c, 0xa8e6b9, 0xffd27a, 0xc8b6ff];
    tubs.forEach((c, i) => {
      const tx = -0.42 + (i % 3) * 0.42;
      const tz = i < 3 ? -0.15 : 0.15;
      mesh(f, G.box(0.38, 0.05, 0.27), 0xdfe5ea, { p: [tx, 0.87, tz], cast: false });
      mesh(f, G.box(0.36, 0.05, 0.25), c, { p: [tx, 0.89, tz], cast: false });
      for (const dx of [-0.08, 0.07]) mesh(f, G.sphere(0.06, 8, 6), c, { p: [tx + dx, 0.92, tz + (dx > 0 ? 0.04 : -0.03)], s: [1, 0.7, 1], cast: false });
    });
    const lid = new THREE.CylinderGeometry(0.36, 0.36, 1.3, 16, 1, true, 0, Math.PI);
    mesh(f, lid, new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.3, side: THREE.DoubleSide }), { p: [0, 0.89, 0], r: [0, 0, Math.PI / 2], s: [0.35, 1, 0.97], cast: false }); // nắp kính cong
    const board = group(f, { p: [0, 1.38, -0.3] });
    mesh(board, G.box(0.94, 0.42, 0.06), 0xffffff);
    mesh(board, G.box(0.88, 0.36, 0.065), 0xf08fb0);
    const txt = signText('KEM', '#ffffff', 0.8, 0.3);
    txt.position.z = 0.04;
    board.add(txt);
    for (const sx of [-0.4, 0.4]) mesh(f, G.cyl(0.02, 0.02, 0.45, 6), 0xdcd6cb, { p: [sx, 1.0, -0.3] });
    const cone = iceCreamCone(f, [0.6, 1.72, -0.3], 1.3);
    anims.push((t) => {
      cone.position.y = 1.72 + Math.sin(t * 2) * 0.05;
      cone.rotation.y = Math.sin(t * 0.8) * 0.4;
    });
  }

  return { g, update: (t) => anims.forEach((a) => a(t)) };
}
