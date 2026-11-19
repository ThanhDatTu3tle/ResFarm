import * as THREE from 'three';
import type { FestivalDecor } from '../../data/calendar';
import { festivalOf } from '../../sim/calendar';
import type { Game } from '../../sim/game';
import { G, group, mesh, type V3 } from './toon';

/**
 * Trang trí lễ hội dựng bằng khối cơ bản, dùng chung cho khu Quán và khu Chợ:
 *  - tet: dây đèn lồng đỏ + chậu mai vàng (Tết, Tất niên)
 *  - lantern: dây đèn ông sao nhiều màu + cây đèn ông sao (Trung thu)
 *  - xmas: dây đèn nhấp nháy + cây thông có quà (Giáng sinh)
 *  - bunting: dây cờ đuôi nheo nhiều màu (Lễ hội pháo hoa)
 * Khu dựng sẵn một nhóm cho mỗi kiểu (`FestiveSet`), mỗi khung hình gọi `update` để chỉ hiện đúng kiểu của lễ hôm nay.
 */

const FLAG_COLORS = [0xe2574c, 0xf2b23e, 0x5fae57, 0x3f7fd9, 0xe8739a];
const STAR_COLORS = [0xe2574c, 0xf2b23e, 0x3fb6a8, 0x9a6bd1, 0xe8739a];

/** Một dây treo từ a tới b, võng xuống ở giữa, kèm đồ treo dọc dây. */
function string(parent: THREE.Object3D, a: V3, b: V3, kind: FestivalDecor, sway: THREE.Object3D[], scale = 1): void {
  const n = Math.max(3, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / (1.1 * scale)));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - Math.sin(u * Math.PI) * 0.35, a[2] + (b[2] - a[2]) * u));
  }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x5a3b2a }));
  parent.add(line);
  const dir = Math.atan2(b[0] - a[0], b[2] - a[2]);
  for (let i = 1; i < n; i++) {
    const p = pts[i];
    const hang = group(parent, { p: [p.x, p.y, p.z], s: scale });
    hang.userData.phase = i * 1.7;
    sway.push(hang);
    if (kind === 'tet') {
      mesh(hang, G.cyl(0.012, 0.012, 0.14, 4), 0x5a3b2a, { p: [0, -0.07, 0], cast: false });
      mesh(hang, G.sphere(0.17, 12, 10), 0xd9342b, { p: [0, -0.3, 0], s: [1, 0.85, 1] });
      for (const y of [-0.15, -0.45]) mesh(hang, G.cyl(0.08, 0.08, 0.04, 10), 0xf2c14e, { p: [0, y, 0], cast: false });
      mesh(hang, G.cyl(0.015, 0.03, 0.16, 6), 0xf2c14e, { p: [0, -0.55, 0], cast: false }); // tua vàng
    } else if (kind === 'lantern') {
      mesh(hang, G.cyl(0.012, 0.012, 0.12, 4), 0x5a3b2a, { p: [0, -0.06, 0], cast: false });
      const star = mesh(hang, G.ico(0.17, 0), STAR_COLORS[i % STAR_COLORS.length], { p: [0, -0.28, 0], s: [1, 1, 0.45], cast: false });
      star.rotation.y = dir;
    } else if (kind === 'xmas') {
      const bulb = mesh(hang, G.sphere(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: FLAG_COLORS[i % FLAG_COLORS.length] }), { p: [0, -0.05, 0], cast: false });
      bulb.userData.blink = i;
    } else {
      // Cờ đuôi nheo: tam giác dẹt quay mũi xuống, mặt nhìn ngang dây
      const flag = mesh(hang, G.cone(0.16, 0.34, 3), FLAG_COLORS[i % FLAG_COLORS.length], { p: [0, -0.18, 0], r: [Math.PI, 0, 0], s: [1, 1, 0.25], cast: false });
      flag.rotation.y = dir + Math.PI / 2;
    }
  }
}

/** Chậu mai vàng ngày Tết. */
export function makeMai(parent: THREE.Object3D, p: V3, s = 1): THREE.Group {
  const g = group(parent, { p, s });
  mesh(g, G.cyl(0.32, 0.25, 0.45, 12), 0x3f6fb5, { p: [0, 0.22, 0] });
  mesh(g, G.cyl(0.33, 0.33, 0.05, 12), 0xf2c14e, { p: [0, 0.42, 0], cast: false });
  mesh(g, G.cyl(0.06, 0.09, 0.9, 6), 0x6b4a2f, { p: [0, 0.85, 0] });
  for (const [x, z, h, tilt] of [[0.18, 0, 0.7, -0.6], [-0.2, 0.08, 0.6, 0.65], [0, -0.18, 0.55, 0.5]] as const) {
    const br = group(g, { p: [0, 1.0, 0], r: [z * 2.5 * tilt, 0, x * 2.5 * -Math.abs(tilt)] });
    mesh(br, G.cyl(0.025, 0.04, h, 5), 0x6b4a2f, { p: [0, h / 2, 0] });
    for (let k = 0; k < 5; k++) mesh(br, G.ico(0.07, 0), 0xffd23f, { p: [Math.sin(k * 2.3) * 0.12, h * (0.35 + k * 0.14), Math.cos(k * 2.3) * 0.12], cast: false });
  }
  for (let k = 0; k < 6; k++) mesh(g, G.ico(0.07, 0), 0xffd23f, { p: [Math.sin(k) * 0.16, 1.35 + (k % 3) * 0.1, Math.cos(k) * 0.16], cast: false });
  return g;
}

/** Cây thông Noel có ngôi sao và vài hộp quà. */
export function makeXmasTree(parent: THREE.Object3D, p: V3, s = 1): THREE.Group {
  const g = group(parent, { p, s });
  mesh(g, G.cyl(0.12, 0.14, 0.3, 8), 0x6b4a2f, { p: [0, 0.15, 0] });
  [[0.75, 0.9, 0.7], [0.58, 0.8, 1.25], [0.4, 0.7, 1.75]].forEach(([r, h, y]) => mesh(g, G.cone(r, h, 10), 0x2f7d4a, { p: [0, y, 0] }));
  mesh(g, G.ico(0.14, 0), new THREE.MeshBasicMaterial({ color: 0xffd23f }), { p: [0, 2.2, 0], cast: false });
  for (let k = 0; k < 9; k++) {
    const a = k * 2.1;
    const y = 0.6 + (k % 3) * 0.5;
    const r = 0.62 - (k % 3) * 0.17;
    mesh(g, G.sphere(0.06, 8, 6), FLAG_COLORS[k % FLAG_COLORS.length], { p: [Math.cos(a) * r, y, Math.sin(a) * r], cast: false });
  }
  for (const [x, z, c] of [[0.55, 0.45, 0xe2574c], [-0.5, 0.5, 0x3f7fd9], [0.1, 0.7, 0xf2b23e]] as const) {
    mesh(g, G.box(0.3, 0.24, 0.3), c, { p: [x, 0.12, z] });
    mesh(g, G.box(0.32, 0.05, 0.06), 0xffffff, { p: [x, 0.25, z], cast: false });
  }
  return g;
}

/** Cây đèn ông sao cắm trên cán (Trung thu). */
export function makeStarLantern(parent: THREE.Object3D, p: V3, color: number, s = 1): THREE.Group {
  const g = group(parent, { p, s });
  mesh(g, G.cyl(0.025, 0.025, 1.5, 5), 0x8a5a35, { p: [0, 0.75, 0], r: [0, 0, 0.15] });
  mesh(g, G.ico(0.3, 0), color, { p: [0.12, 1.55, 0], s: [1, 1, 0.45] });
  mesh(g, G.cyl(0.02, 0.04, 0.25, 5), 0xf2c14e, { p: [0.12, 1.15, 0], cast: false });
  return g;
}

/** Bộ trang trí cho một khu: mỗi kiểu một nhóm, ẩn sẵn. */
export class FestiveSet {
  readonly groups = new Map<FestivalDecor, THREE.Group>();
  private sway: THREE.Object3D[] = [];
  private blinks: THREE.Mesh[] = [];

  constructor(
    parent: THREE.Object3D,
    /** Các dây treo (điểm đầu, điểm cuối). */
    strings: [V3, V3][],
    /** Chỗ đặt đồ đứng (chậu mai, cây thông, đèn ông sao). */
    spots: V3[],
    /** Phóng to đồ treo / đồ đứng (khu nhìn từ xa như chợ). */
    scale = 1,
  ) {
    for (const kind of ['tet', 'lantern', 'xmas', 'bunting'] as FestivalDecor[]) {
      const g = group(parent);
      g.visible = false;
      for (const [a, b] of strings) string(g, a, b, kind, this.sway, scale);
      spots.forEach((p, i) => {
        if (kind === 'tet') makeMai(g, p, scale);
        else if (kind === 'lantern') makeStarLantern(g, p, STAR_COLORS[i % STAR_COLORS.length], scale);
        else if (kind === 'xmas' && i === 0) makeXmasTree(g, p, scale);
      });
      this.groups.set(kind, g);
    }
    for (const g of this.groups.values()) g.traverse((o) => o instanceof THREE.Mesh && o.userData.blink != null && this.blinks.push(o));
  }

  /** Hiện đúng kiểu trang trí của lễ hôm nay (không có lễ thì ẩn hết); đồ treo đung đưa, đèn Noel nhấp nháy. */
  update(game: Game, t: number, wind: number): void {
    const kind = festivalOf(game.state.clock.day)?.decor ?? null;
    for (const [k, g] of this.groups) g.visible = k === kind;
    if (!kind) return;
    for (const h of this.sway) h.rotation.z = Math.sin(t * (1.5 + wind * 2) + h.userData.phase) * (0.06 + wind * 0.12);
    if (kind === 'xmas') for (const b of this.blinks) (b.material as THREE.MeshBasicMaterial).color.setHex(FLAG_COLORS[(Math.floor(t * 2) + b.userData.blink) % FLAG_COLORS.length]);
  }
}
