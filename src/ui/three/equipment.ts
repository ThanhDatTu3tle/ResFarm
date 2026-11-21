import * as THREE from 'three';
import { makeBush } from './models';
import { signText } from './cuisine';
import { emojiSprite, G, group, mesh } from './toon';

/**
 * TRANG THIẾT BỊ ĐÃ MUA Ở SIÊU THỊ hiện trong quán (giai đoạn 15) — mua xong là thấy ngay:
 *  - decor (Cây cảnh & tranh treo): 2 chậu cây lớn hai bên cửa + tranh treo tường bên (quán ốc: chậu cây ở góc trước)
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
  /** Quán ốc: chỗ xe đẩy, bếp nướng. */
  cart?: { x: number; z: number };
  grill?: { x: number; z: number };
}

export interface EquipView {
  g: THREE.Group;
  update(t: number): void;
}

export function buildEquipment(parent: THREE.Object3D, d: EquipDims, owned: Set<string>): EquipView {
  const g = group(parent);
  const anims: ((t: number) => void)[] = [];
  const has = (id: string) => owned.has(id);
  const wallH = 3.3;

  if (has('decor')) {
    // Hai chậu cây lớn hai bên cửa
    for (const side of [-1, 1]) {
      const x = d.door[0] + side * (d.street ? d.halfW - 0.5 : 1.6);
      const z = d.street ? d.frontZ - 0.2 : d.frontZ + 0.55;
      mesh(g, G.cyl(0.32, 0.26, 0.55, 12), 0xc8623e, { p: [x, 0.28, z] });
      mesh(g, G.cyl(0.34, 0.34, 0.05, 12), 0xa8502f, { p: [x, 0.56, z] });
      makeBush(g, { p: [x, 0.62, z], s: 1.25 }, 0x3f8f45);
      makeBush(g, { p: [x + 0.1, 1.1, z - 0.05], s: 0.8 }, 0x58a94e);
    }
    // Tranh treo hai tường bên (quán trong nhà)
    if (!d.street) {
      const art = [0xf2b23e, 0x4a9bd8, 0xe2574c, 0x5fae57];
      [-1, 1].forEach((side, k) => {
        const x = side * (d.halfW - 0.02);
        const z = (d.kitchenZ + d.frontZ) / 2;
        const f = group(g, { p: [x, 2.2, z], r: [0, -side * Math.PI / 2, 0] });
        mesh(f, G.box(1.1, 0.8, 0.05), 0x7a4a2a);
        mesh(f, G.box(0.95, 0.65, 0.06), 0xfff6e6, { p: [0, 0, 0.01] });
        mesh(f, G.box(0.5, 0.3, 0.07), art[k * 2], { p: [-0.12, -0.08, 0.02] }); // núi
        mesh(f, G.sphere(0.1, 10, 8), art[k * 2 + 1], { p: [0.25, 0.15, 0.04] }); // mặt trời
      });
    }
  }

  if (has('knives')) {
    if (!d.street) {
      // Thanh nam châm + 5 con dao trên tường bếp, bên trái dãy bếp
      const [x, z, rot] = d.knife ?? [d.kitchenCenter - d.kitchenHalf + 0.9, d.backZ + 0.05, 0];
      const bar = group(g, { p: [x, 1.85, z], r: [0, rot, 0] });
      mesh(bar, G.box(1.0, 0.07, 0.04), 0x3b3f46);
      for (let i = 0; i < 5; i++) {
        const k = group(bar, { p: [-0.4 + i * 0.2, -0.05, 0.04] });
        mesh(k, G.box(0.04, 0.12, 0.03), 0x2a1f1a, { p: [0, 0.02, 0] }); // cán
        mesh(k, G.box(0.06 + (i % 2) * 0.03, 0.26, 0.01), 0xdfe5ea, { p: [0, -0.17, 0] }); // lưỡi
      }
    } else if (d.cart) {
      const blk = group(g, { p: [d.cart.x + 0.7, 1.05, d.cart.z - 0.2] });
      mesh(blk, G.box(0.22, 0.24, 0.16), 0x8a5a35, { p: [0, 0.12, 0], r: [0.3, 0, 0] });
      for (let i = 0; i < 3; i++) mesh(blk, G.box(0.03, 0.12, 0.03), 0x2a1f1a, { p: [-0.06 + i * 0.06, 0.3, -0.04] });
    }
  }

  if (has('music')) {
    const spots: [number, number, number][] = d.street
      ? [[-d.halfW - 0.15, 3.0, d.frontZ + 0.2], [d.halfW + 0.15, 3.0, d.frontZ + 0.2]]
      : [[-d.halfW + 0.35, wallH - 0.4, d.kitchenZ + 0.4], [d.halfW - 0.35, wallH - 0.4, d.kitchenZ + 0.4]];
    const notes: THREE.Sprite[] = [];
    spots.forEach(([x, y, z], i) => {
      const s = group(g, { p: [x, y, z], r: [0.2, x < 0 ? 0.6 : -0.6, 0] });
      mesh(s, G.box(0.42, 0.62, 0.36), 0x2a2d35);
      mesh(s, G.cyl(0.13, 0.13, 0.03, 16), 0x5f6b77, { p: [0, -0.1, 0.18], r: [Math.PI / 2, 0, 0] });
      mesh(s, G.cyl(0.06, 0.06, 0.03, 12), 0x5f6b77, { p: [0, 0.16, 0.18], r: [Math.PI / 2, 0, 0] });
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
    if (!d.street) {
      // Chụp hút khói inox dài theo dãy bếp + ống khói lên trần, lửa xanh dưới chảo
      const line = d.line ?? { x: d.kitchenCenter, z: d.backZ + 0.55, len: d.kitchenHalf * 2, rot: 0 };
      const h = group(g, { p: [line.x, 0, line.z], r: [0, line.rot, 0] });
      const w = line.len;
      const deep = d.line ? 0.7 : 0.95;
      mesh(h, G.box(w, 0.35, deep), 0xc7cfd6, { p: [0, 2.55, 0] });
      mesh(h, G.box(w - 0.2, 0.06, deep - 0.1), 0x8f9aa4, { p: [0, 2.36, 0] });
      mesh(h, G.box(0.5, 0.8, 0.5), 0xc7cfd6, { p: [0, 3.1, -0.1] });
      for (const dx of d.line ? [-w * 0.3, 0, w * 0.3] : [-1.0, 0.2]) flames.push(mesh(h, G.cone(0.12, 0.12, 8), flameMat, { p: [dx, 1.03, 0], cast: false }));
    } else if (d.grill) {
      // Quán ốc: bếp ga đôi trên chân sắt, chảo gang lớn, lửa xanh
      const x = d.grill.x + 1.25;
      const z = d.grill.z - 0.2;
      for (const sx of [-0.35, 0.35]) for (const sz of [-0.2, 0.2]) mesh(g, G.cyl(0.025, 0.025, 0.7, 6), 0x3b3f46, { p: [x + sx, 0.35, z + sz] });
      mesh(g, G.box(0.85, 0.12, 0.5), 0x3b3f46, { p: [x, 0.75, z] });
      for (const sx of [-0.2, 0.2]) {
        mesh(g, G.cyl(0.18, 0.15, 0.08, 14), 0x2a2d35, { p: [x + sx, 0.95, z] });
        flames.push(mesh(g, G.cone(0.1, 0.12, 8), flameMat, { p: [x + sx, 0.86, z], cast: false }));
      }
      mesh(g, G.cyl(0.13, 0.13, 0.5, 10), 0xe2703a, { p: [x + 0.6, 0.25, z] }); // bình ga
    }
    anims.push((t) => flames.forEach((f, i) => f.scale.set(1, 0.8 + Math.abs(Math.sin(t * 13 + i)) * 0.5, 1)));
  }

  if (has('porcelain')) {
    // Tủ chén kính: 3 tầng đĩa sứ trắng viền xanh, bát úp
    const at: [number, number, number] = d.street ? [-d.halfW + 1.4, d.backZ + 0.45, 0] : (d.cabinet ?? [d.kitchenX1 - 0.32, (d.backZ + d.kitchenZ) / 2 + 0.2, -Math.PI / 2]);
    const c = group(g, { p: [at[0], 0, at[1]], r: [0, at[2], 0] });
    mesh(c, G.box(1.1, 1.9, 0.42), 0x9a6b44, { p: [0, 0.95, 0] });
    mesh(c, G.box(1.0, 1.7, 0.02), new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.25 }), { p: [0, 1.0, 0.22], cast: false });
    for (const y of [0.45, 0.95, 1.45]) {
      mesh(c, G.box(1.0, 0.03, 0.36), 0x7a4f30, { p: [0, y - 0.15, 0] });
      for (let i = 0; i < 4; i++) {
        const p = group(c, { p: [-0.36 + i * 0.24, y, 0.02], r: [Math.PI / 2 - 0.25, 0, 0] });
        mesh(p, G.cyl(0.1, 0.1, 0.015, 16), 0xffffff);
        mesh(p, G.torus(0.085, 0.01, 4, 16), 0x2f6fbf, { p: [0, 0.01, 0], r: [Math.PI / 2, 0, 0], cast: false });
      }
    }
  }

  if (has('icecream')) {
    // Tủ kem nắp kính: thân trắng, sọc hồng, khay kem nhiều màu, bảng "KEM" + cây kem trên nóc
    const at: [number, number, number] = d.street ? [-d.halfW + 0.9, d.kitchenZ - 1.0, 0.3] : (d.freezer ?? [-d.halfW + 1.9, d.kitchenZ + 0.55, 0]);
    const f = group(g, { p: [at[0], 0, at[1]], r: [0, at[2], 0] });
    mesh(f, G.box(1.3, 0.85, 0.7), 0xfdfbf6, { p: [0, 0.43, 0] });
    mesh(f, G.box(1.32, 0.12, 0.72), 0xf08fb0, { p: [0, 0.62, 0] });
    const tubs = [0xfff1b8, 0xf6a6c1, 0x8b5a3c, 0xa8e6b9, 0xffd27a, 0xc8b6ff];
    tubs.forEach((c, i) => mesh(f, G.box(0.36, 0.06, 0.26), c, { p: [-0.42 + (i % 3) * 0.42, 0.88, i < 3 ? -0.15 : 0.15], cast: false }));
    mesh(f, G.box(1.3, 0.04, 0.7), new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.35 }), { p: [0, 0.94, 0], cast: false });
    const board = group(f, { p: [0, 1.35, -0.3] });
    mesh(board, G.box(0.9, 0.38, 0.05), 0xf08fb0);
    const txt = signText('KEM', '#ffffff', 0.8, 0.3);
    txt.position.z = 0.04;
    board.add(txt);
    for (const sx of [-0.4, 0.4]) mesh(f, G.cyl(0.02, 0.02, 0.45, 6), 0xdcd6cb, { p: [sx, 1.0, -0.3] });
    const cone = emojiSprite('🍦', 0.45);
    cone.position.set(0.55, 1.65, -0.3);
    f.add(cone);
    anims.push((t) => (cone.position.y = 1.65 + Math.sin(t * 2) * 0.05));
  }

  return { g, update: (t) => anims.forEach((a) => a(t)) };
}
