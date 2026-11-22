import * as THREE from 'three';
import type { FestivalDecor } from '../../data/calendar';
import { festivalOf } from '../../sim/calendar';
import type { Game } from '../../sim/game';
import { side } from './farmkit';
import { G, group, mesh, seeded, toon, type V3 } from './toon';

/**
 * Trang trí lễ hội dựng bằng khối cơ bản, dùng chung cho khu Quán và khu Chợ:
 *  - tet: dây đèn lồng đỏ + chậu mai vàng (Tết, Tất niên)
 *  - lantern: dây đèn ông sao nhiều màu + cây đèn ông sao (Trung thu)
 *  - xmas: dây đèn nhấp nháy + cây thông có quà + người tuyết (Giáng sinh)
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
      const star = mesh(hang, side(starPts(0.18, 0.08), 0.05), STAR_COLORS[i % STAR_COLORS.length], { p: [0, -0.3, 0], cast: false });
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

/** Điểm viền ngôi sao 5 cánh (bán kính ngoài R, trong r), mũi trên cùng hướng lên. */
function starPts(R: number, r: number): [number, number][] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const k = i % 2 ? r : R;
    return [Math.cos(a) * k, Math.sin(a) * k] as [number, number];
  });
}

/** Một bông mai 5 cánh vàng nhụy cam (mặt hướng +z của group). */
function blossom(parent: THREE.Object3D, p: V3, s: number, ry: number): void {
  const f = group(parent, { p, r: [0, ry, 0], s });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    mesh(f, G.sphere(0.035, 6, 5), 0xffd23f, { p: [Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0], s: [1, 1, 0.4], cast: false });
  }
  mesh(f, G.sphere(0.018, 6, 5), 0xe2703a, { p: [0, 0, 0.012], cast: false });
}

/** Chậu mai vàng ngày Tết: chậu men lam có viền hoa văn, gốc mai uốn khúc, cành đầy bông 5 cánh, treo bao lì xì đỏ. */
export function makeMai(parent: THREE.Object3D, p: V3, s = 1): THREE.Group {
  const rnd = seeded(Math.round(p[0] * 31 + p[2] * 17) + 9);
  const g = group(parent, { p, s });
  const bark = 0x5a3b2a;
  // Chậu men: thân lam, 2 dải trắng có chấm lam, miệng loe, đất
  mesh(g, G.cyl(0.33, 0.24, 0.46, 14), 0x2f5fa8, { p: [0, 0.23, 0] });
  for (const y of [0.1, 0.36]) mesh(g, G.cyl(0.33 - y * 0.18 + 0.006, 0.33 - y * 0.18 + 0.006, 0.05, 14), 0xf3f0e8, { p: [0, y, 0], cast: false });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    mesh(g, G.sphere(0.018, 5, 4), 0x2f5fa8, { p: [Math.cos(a) * 0.272, 0.36, Math.sin(a) * 0.272], cast: false });
  }
  mesh(g, G.cyl(0.36, 0.33, 0.05, 14), 0x2a4f8a, { p: [0, 0.47, 0] });
  mesh(g, G.cyl(0.31, 0.31, 0.02, 14), 0x5a3b2a, { p: [0, 0.48, 0], cast: false });
  // Gốc uốn khúc: 3 đoạn nghiêng ngược nhau
  const segs: [V3, V3][] = [[[0, 0.48, 0], [0.08, 0.78, 0.02]], [[0.08, 0.78, 0.02], [-0.06, 1.02, -0.02]], [[-0.06, 1.02, -0.02], [0.02, 1.22, 0]]];
  segs.forEach(([a, b], i) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    mesh(g, G.cyl(0.05 - i * 0.012, 0.075 - i * 0.012, len, 6), bark, { p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r: [0, 0, -Math.atan2(b[0] - a[0], b[1] - a[1])] });
  });
  // Cành toả ra, đầy bông
  const tips: V3[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.5;
    const len = 0.35 + rnd() * 0.25;
    const tilt = 0.6 + rnd() * 0.4;
    const base: V3 = [0, 0.95 + rnd() * 0.25, 0];
    const br = group(g, { p: base, r: [0, -a, 0] });
    const arm = group(br, { r: [0, 0, -tilt] });
    mesh(arm, G.cyl(0.014, 0.028, len, 5), bark, { p: [0, len / 2, 0] });
    for (let k = 0; k < 5; k++) blossom(arm, [(rnd() - 0.5) * 0.08, len * (0.3 + k * 0.17), (rnd() - 0.5) * 0.08], 1 + rnd() * 0.3, rnd() * 6);
    tips.push([Math.cos(a) * Math.sin(tilt) * len * 0.6, base[1] + Math.cos(tilt) * len * 0.6, Math.sin(a) * Math.sin(tilt) * len * 0.6]);
  }
  for (let k = 0; k < 8; k++) blossom(g, [(rnd() - 0.5) * 0.25, 1.22 + rnd() * 0.18, (rnd() - 0.5) * 0.25], 1.1, rnd() * 6);
  // Bao lì xì đỏ treo dưới vài cành
  for (const t of tips.filter((_, i) => i % 2 === 0)) {
    mesh(g, G.cyl(0.004, 0.004, 0.1, 3), 0xf2c14e, { p: [t[0], t[1] - 0.05, t[2]], cast: false });
    const env = group(g, { p: [t[0], t[1] - 0.15, t[2]], r: [0, rnd() * 3, (rnd() - 0.5) * 0.2] });
    mesh(env, G.box(0.08, 0.12, 0.01), 0xd9342b, { cast: false });
    mesh(env, G.box(0.04, 0.04, 0.012), 0xf2c14e, { p: [0, 0.01, 0], cast: false });
  }
  return g;
}

/**
 * Cây thông Noel trong xô gỗ: 4 tầng lá rủ, dây kim tuyến vàng xoắn quanh, quả châu nhiều màu, ngôi sao 5 cánh sáng
 * trên đỉnh, thảm đỏ viền trắng dưới gốc, quà có ruy băng chữ thập + nơ.
 */
export function makeXmasTree(parent: THREE.Object3D, p: V3, s = 1): THREE.Group {
  const g = group(parent, { p, s });
  mesh(g, G.cyl(0.5, 0.5, 0.02, 18), 0xc8483a, { p: [0, 0.01, 0], cast: false }); // thảm gốc cây
  mesh(g, G.torus(0.5, 0.03, 4, 20), 0xf6f3ec, { p: [0, 0.02, 0], r: [Math.PI / 2, 0, 0], cast: false });
  mesh(g, G.cyl(0.2, 0.16, 0.26, 10), 0xa8784a, { p: [0, 0.13, 0] }); // xô gỗ
  for (const y of [0.06, 0.2]) mesh(g, G.torus(0.19 - y * 0.12, 0.012, 4, 14), 0x5f6b77, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], cast: false });
  mesh(g, G.cyl(0.07, 0.08, 0.3, 6), 0x6b4a2f, { p: [0, 0.38, 0] });
  const tiers: [number, number, number][] = [[0.78, 0.7, 0.72], [0.62, 0.62, 1.15], [0.46, 0.55, 1.55], [0.3, 0.45, 1.92]];
  tiers.forEach(([r, h, y], i) => {
    mesh(g, G.cone(r, h, 10), i % 2 ? 0x2f7d4a : 0x2a7043, { p: [0, y, 0] });
    mesh(g, G.cone(r + 0.04, 0.12, 10), 0x24603a, { p: [0, y - h / 2 + 0.04, 0], cast: false }); // mép tầng rủ xuống
  });
  // Dây kim tuyến xoắn ốc
  for (let k = 0; k < 40; k++) {
    const u = k / 40;
    const y = 0.5 + u * 1.55;
    const r = 0.74 - u * 0.58;
    const a = u * Math.PI * 6;
    mesh(g, G.sphere(0.022, 5, 4), 0xf2c14e, { p: [Math.cos(a) * r, y, Math.sin(a) * r], cast: false });
  }
  // Quả châu
  for (let k = 0; k < 14; k++) {
    const a = k * 2.4;
    const u = (k % 7) / 7;
    const y = 0.5 + u * 1.4;
    const r = 0.7 - u * 0.55;
    mesh(g, G.sphere(0.055, 8, 6), FLAG_COLORS[k % FLAG_COLORS.length], { p: [Math.cos(a) * r, y, Math.sin(a) * r], cast: false });
  }
  // Ngôi sao đỉnh
  const star = mesh(g, side(starPts(0.2, 0.09), 0.06), new THREE.MeshBasicMaterial({ color: 0xffd23f }), { p: [0, 2.3, 0], cast: false });
  star.userData.star = true;
  // Quà: hộp + ruy băng chữ thập + nơ
  for (const [x, z, c, w, ry] of [[0.55, 0.42, 0xe2574c, 0.3, 0.3], [-0.5, 0.48, 0x3f7fd9, 0.26, -0.4], [0.08, 0.68, 0xf2b23e, 0.22, 0.1]] as const) {
    const gift = group(g, { p: [x, 0, z], r: [0, ry, 0] });
    mesh(gift, G.box(w, w * 0.8, w), c, { p: [0, w * 0.4, 0] });
    mesh(gift, G.box(w + 0.01, w * 0.8 + 0.01, 0.045), 0xffffff, { p: [0, w * 0.4, 0], cast: false });
    mesh(gift, G.box(0.045, w * 0.8 + 0.01, w + 0.01), 0xffffff, { p: [0, w * 0.4, 0], cast: false });
    for (const sx of [-1, 1]) mesh(gift, G.torus(0.04, 0.014, 4, 10), 0xffffff, { p: [sx * 0.04, w * 0.8 + 0.035, 0], r: [0, 0, sx * 0.5], cast: false });
  }
  return g;
}

/** Đèn ông sao Trung thu: ngôi sao 5 cánh giấy kiếng (hơi trong, có viền nan tre), tua giấy ở 2 mũi dưới, cán tre có đốt. */
export function makeStarLantern(parent: THREE.Object3D, p: V3, color: number, s = 1): THREE.Group {
  const g = group(parent, { p, s });
  const pole = group(g, { r: [0, 0, -0.15] }); // cán nghiêng về phía ngôi sao
  mesh(pole, G.cyl(0.022, 0.026, 1.5, 6), 0xc9a066, { p: [0, 0.75, 0] });
  for (const y of [0.35, 0.75, 1.15]) mesh(pole, G.cyl(0.03, 0.03, 0.025, 6), 0xa8844a, { p: [0, y, 0], cast: false }); // đốt tre
  const head = group(g, { p: [0.24, 1.6, 0] });
  mesh(head, side(starPts(0.32, 0.14), 0.12), toon(color, { transparent: true, opacity: 0.9, emissive: color, emissiveIntensity: 0.25 }));
  mesh(head, side(starPts(0.34, 0.15), 0.02), 0xf2e2b0, { p: [0, 0, -0.02], cast: false }); // viền nan tre phía sau
  const pts = starPts(0.32, 0.14);
  for (const i of [4, 6]) {
    const [x, y] = pts[i];
    mesh(head, G.cyl(0.006, 0.006, 0.12, 3), 0xf2c14e, { p: [x, y - 0.06, 0], cast: false });
    mesh(head, G.cone(0.03, 0.12, 6), 0xf2c14e, { p: [x, y - 0.16, 0], r: [Math.PI, 0, 0], cast: false });
  }
  return g;
}

/**
 * Người tuyết (Giáng sinh): 3 khối tuyết chồng nhau, mắt + miệng + cúc áo bằng than, mũi cà rốt, tay cành cây có
 * nhánh, khăn len đỏ sọc trắng có đuôi buông, mũ chóp đen dải đỏ, gò tuyết dưới chân.
 */
export function makeSnowman(parent: THREE.Object3D, p: V3, s = 1): THREE.Group {
  const g = group(parent, { p, s });
  const snow = 0xf6f8fb;
  const coal = 0x2a2d35;
  mesh(g, G.cyl(0.55, 0.62, 0.06, 16), 0xeef2f6, { p: [0, 0.03, 0], cast: false });
  mesh(g, G.sphere(0.42, 16, 12), snow, { p: [0, 0.4, 0], s: [1, 0.9, 1] });
  mesh(g, G.sphere(0.3, 16, 12), snow, { p: [0, 0.94, 0] });
  const head = group(g, { p: [0, 1.38, 0] });
  mesh(head, G.sphere(0.22, 14, 10), snow);
  for (const x of [-0.075, 0.075]) mesh(head, G.sphere(0.026, 6, 5), coal, { p: [x, 0.05, 0.2], cast: false });
  for (let k = 0; k < 5; k++) {
    const a = -0.5 + k * 0.25;
    mesh(head, G.sphere(0.016, 5, 4), coal, { p: [Math.sin(a) * 0.1, -0.07 - Math.cos(a) * 0.03 + 0.03, 0.2], cast: false });
  }
  mesh(head, G.cone(0.035, 0.2, 8), 0xf28c28, { p: [0, 0, 0.3], r: [Math.PI / 2, 0, 0] });
  for (const y of [0.82, 0.95, 1.08]) mesh(g, G.sphere(0.028, 6, 5), coal, { p: [0, y, Math.sqrt(0.3 ** 2 - (y - 0.94) ** 2) - 0.005], cast: false });
  // Tay cành cây
  for (const sx of [-1, 1]) {
    const arm = group(g, { p: [sx * 0.26, 1.0, 0], r: [0, 0, sx * -1.0] });
    mesh(arm, G.cyl(0.014, 0.02, 0.5, 5), 0x6b4a2f, { p: [0, 0.25, 0] });
    mesh(arm, G.cyl(0.008, 0.01, 0.14, 4), 0x6b4a2f, { p: [sx * 0.04, 0.42, 0], r: [0, 0, sx * -0.7] });
    mesh(arm, G.cyl(0.008, 0.01, 0.12, 4), 0x6b4a2f, { p: [-sx * 0.035, 0.36, 0], r: [0, 0, sx * 0.7] });
  }
  // Khăn len sọc + đuôi buông
  mesh(g, G.torus(0.2, 0.06, 6, 16), 0xd9342b, { p: [0, 1.19, 0], r: [Math.PI / 2, 0, 0] });
  mesh(g, G.torus(0.2, 0.062, 6, 16), 0xf6f3ec, { p: [0, 1.19, 0], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.3] });
  const tail = group(g, { p: [0.12, 1.12, 0.16], r: [0.2, 0, 0.25] });
  mesh(tail, G.box(0.1, 0.3, 0.04), 0xd9342b, { p: [0, -0.12, 0] });
  for (const y of [-0.06, -0.18]) mesh(tail, G.box(0.102, 0.03, 0.042), 0xf6f3ec, { p: [0, y, 0], cast: false });
  // Mũ chóp
  const hat = group(head, { p: [0, 0.17, 0], r: [0.1, 0, -0.12] });
  mesh(hat, G.cyl(0.24, 0.24, 0.025, 16), coal);
  mesh(hat, G.cyl(0.15, 0.16, 0.26, 16), coal, { p: [0, 0.14, 0] });
  mesh(hat, G.cyl(0.162, 0.162, 0.05, 16), 0xd9342b, { p: [0, 0.05, 0], cast: false });
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
    /** Chỗ đặt đồ đứng (chậu mai, cây thông + người tuyết, đèn ông sao). */
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
        else if (kind === 'xmas' && i === 1) makeSnowman(g, p, scale);
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
