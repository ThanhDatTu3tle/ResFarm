import * as THREE from 'three';
import { signText } from './cuisine';
import { buildPainting } from './paintings';
import { emojiSprite, G, group, mesh, seeded, toon, type V3 } from './toon';

/**
 * ĐỒ TRANG TRÍ đặt tự do trong quán (PropDef.model). Gốc ở tâm khoảng chiếm chỗ, chân ở y = 0, mặt trước nhìn về +z.
 * Kích thước khớp xấp xỉ PropDef.w/h (55 đơn vị 2D = 1 mét). Kiểu chưa có ở đây thì hiện emoji của món.
 * Style "đồ làm tay": dựng từ đúng các bộ phận của đồ thật (chậu có vành + đế + dải men, cây có thân uốn + lá có gân...),
 * lệch nhẹ có seed để mỗi món một dáng.
 */

type Maker = (g: THREE.Group) => void;

const SOIL = 0x5a3b2a;
const BARK = 0x6b4a2f;

/** Chậu men: thân thuôn, đế, vành miệng, dải men khác màu, đất + vài viên sỏi. */
function pot(g: THREE.Object3D, r: number, h: number, color = 0xc8623e, band = 0xf3efe6): void {
  mesh(g, G.cyl(r * 0.8, r * 0.8, 0.04, 14), new THREE.Color(color).multiplyScalar(0.75).getHex(), { p: [0, 0.02, 0] });
  mesh(g, G.cyl(r, r * 0.78, h, 14), color, { p: [0, h / 2, 0] });
  mesh(g, G.cyl(r * 0.96 + 0.012, r * 0.9 + 0.012, h * 0.16, 14), band, { p: [0, h * 0.62, 0], cast: false });
  mesh(g, G.cyl(r * 1.08, r * 1.02, 0.05, 14), color, { p: [0, h, 0] });
  mesh(g, G.cyl(r * 0.94, r * 0.94, 0.02, 14), SOIL, { p: [0, h + 0.025, 0], cast: false }); // mặt đất nhô hơn mặt vành 1cm (trùng mặt thì nhấp nháy xoáy)
  for (let i = 0; i < 4; i++) mesh(g, G.sphere(0.022, 5, 4), 0xcfc8bb, { p: [Math.cos(i * 1.7) * r * 0.6, h + 0.04, Math.sin(i * 1.7) * r * 0.6], s: [1, 0.6, 1], cast: false });
}

/** Lá phẳng có gân giữa, gốc ở `p`, chĩa theo góc a (quanh trục đứng) và nghiêng `tilt` lên/xuống. */
function leaf(parent: THREE.Object3D, p: V3, a: number, tilt: number, len: number, wid: number, color: number): void {
  const l = group(parent, { p, r: [0, -a, tilt] });
  mesh(l, G.sphere(0.5, 8, 6), color, { p: [len / 2, 0, 0], s: [len, 0.025, wid] });
  mesh(l, G.box(len * 0.9, 0.012, 0.01), 0x9fd08a, { p: [len / 2, 0.012, 0], cast: false });
}

/** Bông 5 cánh nhìn về +z của group (mai, anh đào, lan). */
function flower(parent: THREE.Object3D, p: V3, r: [number, number, number], s: number, petal: number, heart: number): void {
  const f = group(parent, { p, r, s });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    mesh(f, G.sphere(0.035, 6, 5), petal, { p: [Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0], s: [1, 1, 0.35], cast: false });
  }
  mesh(f, G.sphere(0.016, 5, 4), heart, { p: [0, 0, 0.012], cast: false });
}

/** Thân cây uốn khúc từ các đoạn nối nhau; trả về điểm ngọn. */
function trunk(parent: THREE.Object3D, pts: V3[], r0: number, r1: number, color = BARK): V3 {
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = d.length();
    const k0 = r0 + (r1 - r0) * (i / (pts.length - 1));
    const k1 = r0 + (r1 - r0) * ((i + 1) / (pts.length - 1));
    const m = mesh(parent, G.cyl(k1, k0, len, 7), color, { p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] });
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    mesh(parent, G.sphere(k1, 7, 5), color, { p: b, cast: false }); // khớp nối cho liền
  }
  return pts[pts.length - 1];
}

/** Cây có tán hoa (mai vàng, anh đào): chậu, gốc uốn, cành toả, đầy bông 5 cánh + nụ. */
const blossomTree = (petal: number, heart: number, potColor: number, band: number, seed: number) => (g: THREE.Group) => {
  const rnd = seeded(seed);
  pot(g, 0.26, 0.32, potColor, band);
  const top = trunk(g, [[0, 0.33, 0], [0.06, 0.6, 0.02], [-0.05, 0.85, -0.02], [0.02, 1.08, 0]], 0.07, 0.035);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.5;
    const len = 0.28 + rnd() * 0.2;
    const base: V3 = [top[0] * 0.5, 0.78 + rnd() * 0.3, 0];
    const tip: V3 = [base[0] + Math.cos(a) * len, base[1] + 0.12 + rnd() * 0.18, base[2] + Math.sin(a) * len];
    trunk(g, [base, tip], 0.025, 0.012);
    for (let k = 0; k < 7; k++) {
      const u = 0.35 + (k / 7) * 0.65;
      flower(g, [base[0] + (tip[0] - base[0]) * u + (rnd() - 0.5) * 0.08, base[1] + (tip[1] - base[1]) * u + rnd() * 0.07, base[2] + (tip[2] - base[2]) * u + (rnd() - 0.5) * 0.08], [rnd() * 6, rnd() * 6, 0], 1 + rnd() * 0.4, petal, heart);
    }
    mesh(g, G.sphere(0.025, 5, 4), new THREE.Color(petal).multiplyScalar(0.85).getHex(), { p: tip, cast: false }); // nụ đầu cành
  }
  for (let k = 0; k < 10; k++) flower(g, [(rnd() - 0.5) * 0.3, 1.05 + rnd() * 0.25, (rnd() - 0.5) * 0.3], [rnd() * 6, rnd() * 6, 0], 1.2, petal, heart);
};

/** Thân bình gốm tiện tròn (LatheGeometry) theo các điểm [bán kính, độ cao]. Có cache theo khoá. */
const lathes = new Map<string, THREE.LatheGeometry>();
function lathe(key: string, pts: [number, number][]): THREE.LatheGeometry {
  let geo = lathes.get(key);
  if (!geo) lathes.set(key, (geo = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 18)));
  return geo;
}

const glass = (color: number, opacity: number) => new THREE.MeshToonMaterial({ color, transparent: true, opacity });

const MAKERS: Record<string, Maker> = {
  /** Chậu bàng Singapore: thân thẳng có đốt, lá to hình đàn violin mọc so le, xanh đậm nhạt xen kẽ. */
  fig(g) {
    const rnd = seeded(5);
    pot(g, 0.22, 0.34, 0xe9e2d4, 0x3f6f5a);
    trunk(g, [[0, 0.35, 0], [0.02, 0.75, 0], [-0.01, 1.2, 0.01]], 0.035, 0.022);
    for (let i = 0; i < 13; i++) {
      const y = 0.55 + i * 0.055;
      const a = i * 2.4 + rnd() * 0.3;
      leaf(g, [0, y, 0], a, 0.35 - rnd() * 0.5, 0.26 + rnd() * 0.06, 0.18, i % 2 ? 0x2f7a3a : 0x4f9e4a);
    }
  },
  /** Đèn cây vải lanh: chân ba gỗ choãi, chụp trống vải có đường may, bóng sáng bên trong, dây giật. */
  floorlamp(g) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      trunk(g, [[Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2], [0, 1.25, 0]], 0.02, 0.016, 0x8a5a35);
    }
    mesh(g, G.cyl(0.03, 0.03, 0.12, 6), 0x3b3f46, { p: [0, 1.3, 0] });
    mesh(g, G.sphere(0.06, 8, 6), toon(0xfff6d8, { emissive: 0xffd27a, emissiveIntensity: 0.9 }), { p: [0, 1.42, 0], cast: false });
    const shade = toon(0xf3e8d0, { emissive: 0xffc861, emissiveIntensity: 0.45, transparent: true, opacity: 0.95 });
    mesh(g, new THREE.CylinderGeometry(0.17, 0.25, 0.32, 18, 1, true), shade, { p: [0, 1.48, 0], cast: false });
    for (const [r, y] of [[0.17, 1.64], [0.25, 1.32]] as const) mesh(g, G.torus(r, 0.008, 4, 18), 0xd9c9a8, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], cast: false });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mesh(g, G.box(0.004, 0.32, 0.004), 0xd9c9a8, { p: [Math.cos(a) * 0.212, 1.48, Math.sin(a) * 0.212], r: [Math.sin(a) * 0.24, 0, -Math.cos(a) * 0.24], cast: false }); // đường may
    }
    mesh(g, G.cyl(0.003, 0.003, 0.22, 3), 0xc9a24a, { p: [0.12, 1.22, 0.05], cast: false }); // dây giật
    mesh(g, G.sphere(0.012, 5, 4), 0xc9a24a, { p: [0.12, 1.1, 0.05], cast: false });
  },
  /** Bonsai trên đôn gỗ: đôn tròn 3 chân chạm, khay men lam có chân, rêu, đá, gốc uốn, tán mây nhiều tầng. */
  bonsai(g) {
    mesh(g, G.cyl(0.25, 0.25, 0.06, 14), 0x7a4f33, { p: [0, 0.42, 0] });
    mesh(g, G.cyl(0.21, 0.23, 0.05, 14), 0x6b4428, { p: [0, 0.37, 0] });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      trunk(g, [[Math.cos(a) * 0.17, 0.37, Math.sin(a) * 0.17], [Math.cos(a) * 0.21, 0.15, Math.sin(a) * 0.21], [Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17]], 0.035, 0.028, 0x6b4428);
    }
    mesh(g, G.box(0.44, 0.09, 0.28), 0x2f5f8a, { p: [0, 0.5, 0] });
    mesh(g, G.box(0.46, 0.02, 0.3), 0x24507a, { p: [0, 0.545, 0] });
    for (const sx of [-0.17, 0.17]) for (const sz of [-0.09, 0.09]) mesh(g, G.box(0.05, 0.02, 0.05), 0x24507a, { p: [sx, 0.455, sz] });
    mesh(g, G.sphere(0.18, 10, 6), 0x5f8f3f, { p: [0, 0.55, 0], s: [1.1, 0.18, 0.7], cast: false }); // rêu
    mesh(g, G.ico(0.05, 0), 0x9aa0a8, { p: [-0.13, 0.57, 0.04], s: [1.3, 0.7, 1] });
    const top = trunk(g, [[0.02, 0.55, 0], [0.09, 0.66, 0.01], [-0.04, 0.78, 0], [0.04, 0.9, 0]], 0.045, 0.02);
    trunk(g, [[-0.04, 0.78, 0], [-0.16, 0.82, 0.03]], 0.018, 0.012);
    for (const [x, y, z, s] of [[top[0], 0.96, 0, 0.12], [-0.17, 0.85, 0.03, 0.1], [0.15, 0.8, -0.02, 0.09], [0.02, 1.04, 0, 0.08]] as const) {
      mesh(g, G.ico(s, 1), 0x3f8f3f, { p: [x, y, z], s: [1.6, 0.55, 1.1] });
      mesh(g, G.ico(s * 0.8, 1), 0x2f7a3a, { p: [x, y - 0.03, z], s: [1.5, 0.4, 1] });
    }
  },
  /** Bể cá: tủ gỗ có 2 cánh, bể kính khung đen, mặt nước, cát + sỏi, đá, rong lượn, sủi bọt, đèn nắp; cá có đuôi bơi qua lại. */
  aquarium(g) {
    const rnd = seeded(31);
    mesh(g, G.box(1.4, 0.6, 0.6), 0x5a3b2a, { p: [0, 0.3, 0] });
    for (const sx of [-0.34, 0.34]) {
      mesh(g, G.box(0.64, 0.48, 0.02), 0x6b4428, { p: [sx, 0.32, 0.305] });
      mesh(g, G.box(0.02, 0.1, 0.03), 0xc9a24a, { p: [sx + (sx < 0 ? 0.28 : -0.28), 0.34, 0.32], cast: false });
    }
    // Khung đen 12 cạnh + kính
    const [w, h, d, y0] = [1.3, 0.55, 0.52, 0.6];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(g, G.box(0.03, h, 0.03), 0x2a2d35, { p: [sx * w / 2, y0 + h / 2, sz * d / 2] });
    for (const y of [y0, y0 + h]) for (const sz of [-1, 1]) mesh(g, G.box(w, 0.03, 0.03), 0x2a2d35, { p: [0, y, sz * d / 2] });
    for (const y of [y0, y0 + h]) for (const sx of [-1, 1]) mesh(g, G.box(0.03, 0.03, d), 0x2a2d35, { p: [sx * w / 2, y, 0] });
    mesh(g, G.box(w - 0.02, h - 0.08, d - 0.02), glass(0x8fd3f0, 0.4), { p: [0, y0 + (h - 0.08) / 2, 0], cast: false });
    mesh(g, G.box(w - 0.04, 0.005, d - 0.04), glass(0xbfeaff, 0.6), { p: [0, y0 + h - 0.08, 0], cast: false }); // mặt nước
    mesh(g, G.box(w - 0.04, 0.06, d - 0.04), 0xe9d8a6, { p: [0, y0 + 0.03, 0], cast: false });
    for (let i = 0; i < 10; i++) mesh(g, G.sphere(0.02, 5, 4), [0xcfc8bb, 0x9aa0a8, 0xe2703a][i % 3], { p: [(rnd() - 0.5) * 1.1, y0 + 0.065, (rnd() - 0.5) * 0.4], s: [1, 0.6, 1], cast: false });
    mesh(g, G.ico(0.09, 0), 0x8a9099, { p: [-0.42, y0 + 0.1, -0.1], s: [1.3, 0.8, 1] });
    mesh(g, G.ico(0.06, 0), 0x9aa0a8, { p: [0.36, y0 + 0.08, -0.12] });
    for (const [x, z, n] of [[-0.52, -0.12, 5], [-0.3, -0.16, 4], [0.48, -0.15, 5], [0.2, -0.18, 3]] as const) {
      for (let k = 0; k < n; k++) mesh(g, G.box(0.03, 0.08, 0.01), k % 2 ? 0x3f8f3f : 0x5fae57, { p: [x + Math.sin(k * 1.3) * 0.02, y0 + 0.1 + k * 0.065, z], r: [0, 0, Math.sin(k) * 0.4], cast: false }); // rong
    }
    for (let k = 0; k < 5; k++) mesh(g, G.sphere(0.012, 5, 4), glass(0xffffff, 0.7), { p: [0.55, y0 + 0.12 + k * 0.08, 0.1], cast: false }); // sủi bọt
    mesh(g, G.box(w + 0.04, 0.05, d + 0.04), 0x2a2d35, { p: [0, y0 + h + 0.035, 0] }); // nắp đèn
    for (const [x, c] of [[-0.35, 0xf2913d], [0.1, 0xe2574c], [0.4, 0xf2d03e]] as [number, number][]) {
      const fish = group(g, { p: [x, 0.88 + Math.abs(x) * 0.15, 0.05] });
      mesh(fish, G.sphere(0.06, 8, 6), c, { s: [1.5, 1, 0.55], cast: false });
      mesh(fish, G.cone(0.045, 0.07, 4), c, { p: [-0.11, 0, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.3], cast: false });
      mesh(fish, G.sphere(0.01, 4, 3), 0x2a1f1a, { p: [0.06, 0.015, 0.03], cast: false });
      fish.userData.swim = x;
    }
  },
  /** Khóm tre cảnh: chậu vuông men xanh, thân tre có đốt, nhánh con, chùm lá thon ở ngọn. */
  bamboo(g) {
    const rnd = seeded(13);
    mesh(g, G.box(0.44, 0.3, 0.44), 0x2f4f3f, { p: [0, 0.15, 0] });
    mesh(g, G.box(0.48, 0.04, 0.48), 0x24402f, { p: [0, 0.3, 0] });
    mesh(g, G.box(0.4, 0.02, 0.4), SOIL, { p: [0, 0.31, 0], cast: false });
    for (const [x, z, h] of [[0, 0, 1.6], [0.1, 0.07, 1.3], [-0.1, -0.05, 1.45], [0.06, -0.1, 1.15]] as const) {
      mesh(g, G.cyl(0.024, 0.026, h, 7), 0x8cbf5c, { p: [x, 0.3 + h / 2, z] });
      for (let y = 0.25; y < h; y += 0.24) mesh(g, G.cyl(0.03, 0.03, 0.02, 7), 0x6f9f45, { p: [x, 0.3 + y, z], cast: false }); // đốt tre
      for (let k = 0; k < 7; k++) {
        const a = rnd() * Math.PI * 2;
        const y = 0.3 + h - 0.35 + rnd() * 0.4;
        leaf(g, [x, y, z], a, -0.3 - rnd() * 0.5, 0.2, 0.045, k % 2 ? 0x5fae57 : 0x4f9e4a);
      }
    }
  },
  /** Cây quất ngày Tết: chậu sứ vàng dải đỏ, tán lá tròn, quả quất có cuống lá, bao lì xì + thiệp đỏ treo. */
  kumquat(g) {
    const rnd = seeded(17);
    pot(g, 0.26, 0.34, 0xf2c14e, 0xd9342b);
    trunk(g, [[0, 0.35, 0], [0.02, 0.6, 0]], 0.04, 0.03);
    for (const [x, y, z, s] of [[0, 0.82, 0, 0.32], [0.2, 0.72, 0.08, 0.22], [-0.2, 0.74, -0.06, 0.22], [0.05, 1.0, -0.05, 0.2]] as const) mesh(g, G.ico(s, 1), x ? 0x3f8f3f : 0x2f7a3a, { p: [x, y, z] });
    for (let i = 0; i < 18; i++) {
      const a = rnd() * Math.PI * 2;
      const up = rnd() * 1.1 - 0.2;
      const p: V3 = [Math.cos(a) * Math.cos(up) * 0.33, 0.82 + Math.sin(up) * 0.3, Math.sin(a) * Math.cos(up) * 0.33];
      mesh(g, G.sphere(0.045, 8, 6), 0xf28c28, { p, cast: false });
      mesh(g, G.box(0.03, 0.004, 0.015), 0x2f7a3a, { p: [p[0], p[1] + 0.045, p[2]], r: [0, a, 0], cast: false });
    }
    for (const [x, z] of [[0.24, 0.24], [-0.26, 0.18], [0.05, 0.33]] as const) {
      mesh(g, G.cyl(0.003, 0.003, 0.08, 3), 0xf2c14e, { p: [x, 0.7, z], cast: false });
      mesh(g, G.box(0.08, 0.12, 0.008), 0xd9342b, { p: [x, 0.6, z], r: [0, Math.atan2(x, z), 0] });
      mesh(g, G.box(0.04, 0.04, 0.01), 0xf2c14e, { p: [x, 0.61, z], r: [0, Math.atan2(x, z), 0], cast: false });
    }
  },
  blossom_y: blossomTree(0xffd23f, 0xe2703a, 0x2f5fa8, 0xf3efe6, 3),
  blossom_p: blossomTree(0xf6b3c8, 0xd9578a, 0x3b3f46, 0xd9c9a8, 7),
  /** Bình gốm Bát Tràng: thân tiện tròn men trắng ngà, hoạ tiết lam (dải viền + hoa dây quanh bụng), đế, miệng loe. */
  vase(g) {
    const body = lathe('battrang', [[0.0, 0.0], [0.13, 0.0], [0.14, 0.04], [0.22, 0.2], [0.24, 0.32], [0.2, 0.46], [0.1, 0.58], [0.08, 0.68], [0.12, 0.78], [0.13, 0.8], [0.1, 0.8]]);
    mesh(g, body, 0xf4f1e8);
    const blue = 0x2f5fa8;
    for (const [r, y] of [[0.145, 0.05], [0.225, 0.2], [0.205, 0.45], [0.09, 0.62], [0.125, 0.77]] as const) mesh(g, G.torus(r, 0.008, 4, 18), blue, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], cast: false });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = 0.242;
      flower(g, [Math.cos(a) * r, 0.32, Math.sin(a) * r], [0, -a + Math.PI / 2, 0], 0.7, blue, 0xf4f1e8);
      mesh(g, G.sphere(0.02, 5, 4), blue, { p: [Math.cos(a + 0.39) * 0.238, 0.27, Math.sin(a + 0.39) * 0.238], s: [1.6, 0.6, 0.4], r: [0, -a, 0.5], cast: false }); // lá dây
    }
  },
  /** Đèn đá tōrō: đế lục giác, thân trụ, đài đỡ, hộp lửa có cửa sổ sáng, mái lục giác cong góc, chóp ngọc; rêu bám. */
  toro(g) {
    const stone = 0x9a9a92;
    const dark = 0x85857e;
    mesh(g, G.cyl(0.22, 0.24, 0.1, 6), dark, { p: [0, 0.05, 0] });
    mesh(g, G.cyl(0.14, 0.18, 0.06, 6), stone, { p: [0, 0.13, 0] });
    mesh(g, G.cyl(0.08, 0.1, 0.42, 8), stone, { p: [0, 0.37, 0] });
    for (const y of [0.3, 0.46]) mesh(g, G.torus(0.09, 0.012, 4, 10), dark, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], cast: false });
    mesh(g, G.cyl(0.2, 0.12, 0.08, 6), stone, { p: [0, 0.62, 0] });
    const fire = group(g, { p: [0, 0.78, 0] });
    mesh(fire, G.cyl(0.12, 0.12, 0.22, 6), toon(0xfff1c2, { emissive: 0xffc861, emissiveIntensity: 0.6 }), { cast: false });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mesh(fire, G.box(0.04, 0.24, 0.04), stone, { p: [Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13] });
    }
    mesh(g, G.cone(0.32, 0.18, 6), stone, { p: [0, 0.98, 0] });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mesh(g, G.cone(0.025, 0.07, 4), stone, { p: [Math.cos(a) * 0.31, 0.92, Math.sin(a) * 0.31], r: [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4] }); // góc mái cong lên
    }
    mesh(g, G.cyl(0.05, 0.06, 0.05, 6), stone, { p: [0, 1.09, 0] });
    mesh(g, G.sphere(0.055, 8, 6), stone, { p: [0, 1.16, 0], s: [1, 1.2, 1] });
    for (const [x, y, z] of [[0.17, 0.1, 0.12], [-0.1, 0.62, 0.15], [0.2, 0.96, -0.05]] as const) mesh(g, G.sphere(0.05, 6, 5), 0x6f8f4a, { p: [x, y, z], s: [1.3, 0.35, 1], cast: false }); // rêu
  },
  /** Mèo thần tài: ngồi trên đệm đỏ có tua, tay trái vẫy, tay phải ôm đồng koban vàng, vòng cổ đỏ có chuông, đốm cam đen. */
  maneki(g) {
    const white = 0xfbfaf6;
    mesh(g, G.box(0.42, 0.07, 0.36), 0xd93a32, { p: [0, 0.035, 0] });
    for (const sx of [-0.2, 0.2]) for (const sz of [-0.17, 0.17]) mesh(g, G.cone(0.02, 0.06, 5), 0xf2c14e, { p: [sx, 0.03, sz], r: [Math.PI, 0, 0], cast: false });
    mesh(g, G.sphere(0.17, 14, 10), white, { p: [0, 0.27, 0], s: [1, 1.1, 0.9] });
    const head = group(g, { p: [0, 0.52, 0.02] });
    mesh(head, G.sphere(0.15, 14, 10), white, { s: [1.1, 0.95, 0.95] });
    for (const side of [-1, 1]) {
      mesh(head, G.cone(0.055, 0.09, 4), white, { p: [side * 0.09, 0.14, 0], r: [0, 0, -side * 0.25] });
      mesh(head, G.cone(0.03, 0.05, 4), 0xf6a6c1, { p: [side * 0.09, 0.13, 0.02], r: [0, 0, -side * 0.25], cast: false });
      mesh(head, G.torus(0.025, 0.006, 3, 8, Math.PI), 0x2a1f1a, { p: [side * 0.055, 0.02, 0.135], cast: false }); // mắt cười
      for (const dy of [-0.01, 0.015]) mesh(head, G.box(0.08, 0.004, 0.004), 0x2a1f1a, { p: [side * 0.12, -0.03 + dy, 0.12], r: [0, 0, side * dy * 6], cast: false }); // râu
    }
    mesh(head, G.sphere(0.015, 6, 5), 0xf6a6c1, { p: [0, -0.02, 0.145], cast: false });
    mesh(head, G.sphere(0.06, 8, 6), 0xf28c28, { p: [0.07, 0.08, -0.04], s: [1, 0.6, 1], cast: false }); // đốm cam
    mesh(head, G.sphere(0.04, 8, 6), 0x2a2d35, { p: [-0.08, 0.09, -0.03], s: [1, 0.6, 1], cast: false }); // đốm đen
    // Tay vẫy giơ cao, tay ôm đồng koban
    mesh(g, G.capsule(0.045, 0.12), white, { p: [-0.15, 0.6, 0.05], r: [0, 0, 0.25] });
    mesh(g, G.sphere(0.05, 8, 6), white, { p: [-0.17, 0.7, 0.06] });
    mesh(g, G.sphere(0.02, 6, 5), 0xf6a6c1, { p: [-0.17, 0.7, 0.105], cast: false });
    mesh(g, G.cyl(0.09, 0.09, 0.02, 14), 0xf2c43e, { p: [0.07, 0.25, 0.15], r: [Math.PI / 2, 0, 0], s: [0.7, 1, 1] });
    mesh(g, G.box(0.04, 0.06, 0.005), 0xc9a24a, { p: [0.07, 0.25, 0.163], cast: false });
    mesh(g, G.sphere(0.05, 8, 6), white, { p: [0.14, 0.31, 0.12] });
    mesh(g, G.torus(0.105, 0.018, 5, 14), 0xd93a32, { p: [0, 0.42, 0.02], r: [Math.PI / 2 - 0.3, 0, 0] });
    mesh(g, G.sphere(0.03, 8, 6), 0xf2c43e, { p: [0, 0.38, 0.125] });
  },
  /** Chum tương onggi: 3 chum men nâu bóng (tiện tròn) có nắp + núm, dây rơm buộc cổ, kê trên bệ đá phẳng. */
  onggi(g) {
    mesh(g, G.box(0.78, 0.06, 0.6), 0x9aa0a8, { p: [0, 0.03, 0] });
    for (let i = 0; i < 5; i++) mesh(g, G.box(0.14, 0.01, 0.6), i % 2 ? 0x8a9099 : 0xa8adb5, { p: [-0.32 + i * 0.16, 0.065, 0], cast: false });
    const jar = lathe('onggi', [[0, 0], [0.14, 0], [0.22, 0.12], [0.26, 0.3], [0.23, 0.48], [0.15, 0.58], [0.15, 0.62], [0, 0.62]]);
    for (const [x, z, s] of [[-0.2, -0.05, 1], [0.22, -0.08, 0.78], [0.05, 0.17, 0.6]] as const) {
      const j = group(g, { p: [x, 0.07, z], s });
      mesh(j, jar, 0x6b3f22);
      mesh(j, G.sphere(0.08, 8, 6), 0x8a5a35, { p: [-0.12, 0.38, 0.17], s: [1, 1.6, 0.3], cast: false }); // vệt bóng men
      mesh(j, G.cyl(0.19, 0.17, 0.05, 14), 0x5a3420, { p: [0, 0.645, 0] });
      mesh(j, G.sphere(0.04, 8, 6), 0x5a3420, { p: [0, 0.69, 0] });
      mesh(j, G.torus(0.155, 0.012, 4, 14), 0xc9a066, { p: [0, 0.56, 0], r: [Math.PI / 2, 0, 0], cast: false }); // dây rơm
    }
  },
  /** Biển đèn neon đứng: khung sắt chân đế, nền đen, viền ống neon xanh, chữ neon hồng "맛집" + trái tim. */
  neon(g) {
    for (const sx of [-0.28, 0.28]) {
      mesh(g, G.box(0.05, 0.9, 0.05), 0x3a3f46, { p: [sx, 0.45, 0] });
      mesh(g, G.box(0.08, 0.03, 0.3), 0x2a2d35, { p: [sx, 0.015, 0] });
    }
    mesh(g, G.box(0.74, 0.5, 0.06), 0x1c1e22, { p: [0, 1.1, 0] });
    const cyan = toon(0x5fe0ff, { emissive: 0x5fe0ff, emissiveIntensity: 1 });
    const pink = toon(0xff5fa8, { emissive: 0xff5fa8, emissiveIntensity: 1 });
    for (const y of [0.89, 1.31]) mesh(g, G.box(0.66, 0.02, 0.02), cyan, { p: [0, y, 0.04], cast: false });
    for (const x of [-0.33, 0.33]) mesh(g, G.box(0.02, 0.42, 0.02), cyan, { p: [x, 1.1, 0.04], cast: false });
    const txt = signText('맛집', '#ff7ab8', 0.42, 0.26);
    txt.position.set(0.06, 1.1, 0.04);
    g.add(txt);
    for (const side of [-1, 1]) mesh(g, G.capsule(0.022, 0.08), pink, { p: [-0.22 + side * 0.03, 1.12, 0.045], r: [0, 0, side * 0.7], cast: false }); // trái tim
  },
  /** Cây thông chậu sứ: chậu trắng vẽ lam, gốc uốn mạnh, các tán kim thông dẹt nhiều tầng (sẫm dưới, sáng trên). */
  pine(g) {
    pot(g, 0.25, 0.32, 0xf4f1e8, 0x2f5fa8);
    const top = trunk(g, [[0, 0.33, 0], [0.12, 0.6, 0.02], [-0.06, 0.88, 0], [0.04, 1.15, 0.02], [-0.02, 1.35, 0]], 0.065, 0.025, 0x5a3b2a);
    trunk(g, [[0.12, 0.6, 0.02], [0.3, 0.7, 0.05]], 0.03, 0.015, 0x5a3b2a);
    trunk(g, [[-0.06, 0.88, 0], [-0.26, 0.95, -0.03]], 0.028, 0.015, 0x5a3b2a);
    for (const [x, y, z, s] of [[0.3, 0.74, 0.05, 0.15], [-0.26, 0.99, -0.03, 0.14], [0.12, 1.18, 0.03, 0.13], [top[0], 1.4, 0, 0.12]] as const) {
      mesh(g, G.ico(s, 1), 0x24603a, { p: [x, y - 0.02, z], s: [1.8, 0.45, 1.3] });
      mesh(g, G.ico(s * 0.85, 1), 0x2f7d4a, { p: [x, y + 0.03, z], s: [1.6, 0.4, 1.2] });
    }
  },
  /** Gấu bông: ngồi duỗi chân, bụng + gan bàn chân màu kem, mõm + mũi, tai trong, nơ đỏ, đường chỉ khâu giữa bụng. */
  teddy(g) {
    const fur = 0xc98b4f;
    const cream = 0xf3dcb4;
    mesh(g, G.sphere(0.24, 12, 10), fur, { p: [0, 0.26, 0], s: [1, 1.05, 0.9] });
    mesh(g, G.sphere(0.15, 10, 8), cream, { p: [0, 0.25, 0.1], s: [1, 1.1, 0.7], cast: false });
    mesh(g, G.box(0.005, 0.2, 0.005), 0x8a5a35, { p: [0, 0.25, 0.205], cast: false });
    const head = group(g, { p: [0, 0.6, 0.02] });
    mesh(head, G.sphere(0.18, 12, 10), fur);
    mesh(head, G.sphere(0.08, 8, 6), cream, { p: [0, -0.04, 0.14], s: [1.2, 0.9, 0.7] });
    mesh(head, G.sphere(0.03, 6, 5), 0x3a2a20, { p: [0, -0.01, 0.2], s: [1.3, 1, 1] });
    for (const side of [-1, 1]) {
      mesh(head, G.sphere(0.07, 8, 6), fur, { p: [side * 0.15, 0.14, 0] });
      mesh(head, G.sphere(0.04, 6, 5), cream, { p: [side * 0.15, 0.14, 0.04], s: [1, 1, 0.5], cast: false });
      mesh(head, G.sphere(0.022, 6, 5), 0x2a1f1a, { p: [side * 0.065, 0.04, 0.16], cast: false });
      mesh(g, G.sphere(0.08, 8, 6), fur, { p: [side * 0.23, 0.32, 0.08], s: [0.9, 1.2, 0.9] }); // tay
      mesh(g, G.sphere(0.09, 8, 6), fur, { p: [side * 0.13, 0.08, 0.16], s: [1, 0.9, 1.3] }); // chân
      mesh(g, G.sphere(0.05, 6, 5), cream, { p: [side * 0.13, 0.08, 0.27], s: [1, 1, 0.4], cast: false }); // gan bàn chân
      mesh(g, G.sphere(0.05, 6, 5), 0xe2574c, { p: [side * 0.07, 0.45, 0.13], s: [1.2, 0.8, 0.6] }); // nơ
    }
    mesh(g, G.sphere(0.025, 6, 5), 0xc8483a, { p: [0, 0.45, 0.15] });
  },
  /** Máy gắp thú: thân đỏ, bảng điều khiển nghiêng có cần + nút + khe xu, lồng kính khung vàng, thú bông chất đống,
   *  ray + càng gắp 3 móc, mái đèn có chữ GẮP THÚ và bóng đèn quanh viền. */
  claw(g) {
    const rnd = seeded(23);
    mesh(g, G.box(0.7, 0.72, 0.7), 0xe2574c, { p: [0, 0.36, 0] });
    mesh(g, G.box(0.6, 0.2, 0.08), 0x2a2d35, { p: [0, 0.5, 0.36] });
    mesh(g, G.box(0.66, 0.08, 0.2), 0xf3efe6, { p: [0, 0.68, 0.36], r: [0.3, 0, 0] });
    mesh(g, G.cyl(0.012, 0.012, 0.1, 6), 0x2a2d35, { p: [-0.15, 0.76, 0.38] });
    mesh(g, G.sphere(0.03, 8, 6), 0xd93a32, { p: [-0.15, 0.81, 0.38] });
    mesh(g, G.cyl(0.035, 0.035, 0.03, 10), 0x4a9bd8, { p: [0.14, 0.73, 0.37] });
    mesh(g, G.box(0.06, 0.015, 0.02), 0x2a2d35, { p: [0.0, 0.5, 0.405], cast: false }); // khe xu
    mesh(g, G.box(0.12, 0.1, 0.02), 0x3a3f46, { p: [0.18, 0.2, 0.355] }); // cửa lấy quà
    mesh(g, G.box(0.66, 0.6, 0.66), glass(0xcfefff, 0.3), { p: [0, 1.02, 0], cast: false });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(g, G.box(0.03, 0.62, 0.03), 0xf2b23e, { p: [sx * 0.33, 1.02, sz * 0.33] });
    const toys = [0xf6a6c8, 0x7cc35c, 0x4a9bd8, 0xf2d03e, 0xc98b4f, 0x9a6bd1];
    for (let i = 0; i < 9; i++) {
      const t = group(g, { p: [(rnd() - 0.5) * 0.5, 0.78 + rnd() * 0.06, (rnd() - 0.5) * 0.5] });
      const c = toys[i % toys.length];
      mesh(t, G.sphere(0.07, 8, 6), c);
      for (const side of [-1, 1]) mesh(t, G.sphere(0.025, 6, 5), c, { p: [side * 0.05, 0.06, 0], cast: false });
    }
    for (const sz of [-0.28, 0.28]) mesh(g, G.box(0.62, 0.02, 0.02), 0x9aa6b2, { p: [0, 1.3, sz] });
    mesh(g, G.box(0.04, 0.03, 0.6), 0x9aa6b2, { p: [0.1, 1.29, 0] });
    mesh(g, G.cyl(0.006, 0.006, 0.2, 4), 0x9aa6b2, { p: [0.1, 1.18, 0.1] });
    mesh(g, G.sphere(0.03, 8, 6), 0x9aa6b2, { p: [0.1, 1.07, 0.1] });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      mesh(g, G.box(0.012, 0.08, 0.012), 0x9aa6b2, { p: [0.1 + Math.cos(a) * 0.03, 1.03, 0.1 + Math.sin(a) * 0.03], r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5] });
    }
    mesh(g, G.box(0.74, 0.16, 0.74), 0xf2b23e, { p: [0, 1.41, 0] });
    const sign = signText('GẮP THÚ', '#d93a32', 0.62, 0.13);
    sign.position.set(0, 1.41, 0.375);
    g.add(sign);
    const bulb = new THREE.MeshBasicMaterial({ color: 0xfff1b8 });
    for (let i = 0; i < 7; i++) mesh(g, G.sphere(0.014, 5, 4), bulb, { p: [-0.33 + i * 0.11, 1.48, 0.375], cast: false });
  },
  /** Kệ sách gỗ: sách cao thấp nhiều màu có gáy chữ, vài cuốn nghiêng, chồng sách nằm, chậu cây nhỏ + khung ảnh trên nóc. */
  books(g) {
    const rnd = seeded(29);
    mesh(g, G.box(1.2, 1.3, 0.04), 0x5a3b2a, { p: [0, 0.65, -0.2] });
    for (const side of [-1, 1]) mesh(g, G.box(0.06, 1.3, 0.45), 0x8a5a35, { p: [side * 0.57, 0.65, 0] });
    for (const y of [0.03, 1.28]) mesh(g, G.box(1.2, 0.05, 0.45), 0x8a5a35, { p: [0, y, 0] });
    mesh(g, G.box(1.14, 0.06, 0.03), 0x6b4428, { p: [0, 0.03, 0.21] });
    const colors = [0xe2574c, 0x4a9bd8, 0xf2b23e, 0x5fae57, 0x9a6bd1, 0xf08fb0, 0x3b3f46, 0xd9c9a8];
    for (const y0 of [0.08, 0.48, 0.88]) {
      mesh(g, G.box(1.1, 0.04, 0.42), 0x8a5a35, { p: [0, y0 - 0.02, 0] });
      let x = -0.5;
      let i = 0;
      while (x < 0.42) {
        const c = colors[Math.floor(rnd() * colors.length)];
        if (i === 5 && y0 > 0.4) {
          // Chồng sách nằm
          for (let k = 0; k < 3; k++) mesh(g, G.box(0.24, 0.045, 0.28), colors[(k * 3 + Math.round(y0 * 10)) % colors.length], { p: [x + 0.12, y0 + 0.025 + k * 0.047, 0.02], r: [0, (rnd() - 0.5) * 0.2, 0], cast: false });
          x += 0.26;
        } else {
          const w = 0.05 + rnd() * 0.04;
          const h = 0.22 + rnd() * 0.1;
          const lean = i === 8 ? 0.25 : 0;
          mesh(g, G.box(w, h, 0.28), c, { p: [x + w / 2 + lean * 0.1, y0 + h / 2, 0.02], r: [0, 0, -lean], cast: false });
          mesh(g, G.box(w * 0.6, 0.015, 0.004), 0xf3efe6, { p: [x + w / 2 + lean * 0.1, y0 + h * 0.7, 0.162], r: [0, 0, -lean], cast: false }); // chữ gáy
          x += w + 0.008;
        }
        i++;
      }
    }
    pot(group(g, { p: [-0.38, 1.3, 0], s: 0.5 }), 0.14, 0.2, 0xe9e2d4, 0x3f6f5a);
    const sprout = group(g, { p: [-0.38, 1.41, 0] });
    for (let k = 0; k < 5; k++) leaf(sprout, [0, 0, 0], k * 1.25, 0.5, 0.12, 0.06, 0x4f9e4a);
    const frame = group(g, { p: [0.3, 1.3, 0.02], r: [-0.15, -0.2, 0] });
    mesh(frame, G.box(0.22, 0.17, 0.02), 0x2a2d35, { p: [0, 0.09, 0] });
    mesh(frame, G.box(0.18, 0.13, 0.022), 0x9fd0e0, { p: [0, 0.09, 0], cast: false });
  },
  /** Tủ nước: thân đỏ, bảng hiệu NƯỚC MÁT, cửa kính khung + tay nắm, 3 tầng chai + lon nhiều màu, dải đèn, lưới tản nhiệt. */
  fridge(g) {
    // Thân rỗng (đế, nóc, 2 vách hông, tấm hậu) để thấy chai lon qua cửa kính
    mesh(g, G.box(0.7, 0.24, 0.6), 0xe2574c, { p: [0, 0.12, 0] });
    mesh(g, G.box(0.7, 0.24, 0.6), 0xe2574c, { p: [0, 1.48, 0] });
    for (const sx of [-0.33, 0.33]) mesh(g, G.box(0.04, 1.2, 0.6), 0xe2574c, { p: [sx, 0.84, 0] });
    mesh(g, G.box(0.7, 1.2, 0.04), 0xe2574c, { p: [0, 0.84, -0.28] });
    mesh(g, G.box(0.62, 1.12, 0.01), 0xf3f6f8, { p: [0, 0.84, -0.255], cast: false }); // lòng tủ sáng
    mesh(g, G.box(0.66, 0.22, 0.02), 0xffffff, { p: [0, 1.5, 0.305] });
    const sign = signText('NƯỚC MÁT', '#d93a32', 0.6, 0.16);
    sign.position.set(0, 1.5, 0.32);
    g.add(sign);
    const drinks = [0x3fb6a8, 0xf2b23e, 0x5fae57, 0xf47b3c, 0x4a9bd8, 0xe2574c];
    for (const [k, y] of [0.3, 0.68, 1.06].entries()) {
      mesh(g, G.box(0.6, 0.02, 0.44), 0xcfd6dc, { p: [0, y, 0.06], cast: false });
      for (let i = 0; i < 5; i++) {
        const c = drinks[(i + k * 2) % drinks.length];
        const x = -0.22 + i * 0.11;
        if (k === 1) {
          mesh(g, G.cyl(0.035, 0.035, 0.12, 10), c, { p: [x, y + 0.07, 0.2], cast: false }); // lon
          mesh(g, G.cyl(0.03, 0.03, 0.01, 10), 0xcfd6dc, { p: [x, y + 0.135, 0.2], cast: false });
        } else {
          mesh(g, G.cyl(0.035, 0.04, 0.2, 10), glass(c, 0.85), { p: [x, y + 0.11, 0.2], cast: false }); // chai
          mesh(g, G.cyl(0.015, 0.03, 0.06, 8), glass(c, 0.85), { p: [x, y + 0.24, 0.2], cast: false });
          mesh(g, G.cyl(0.016, 0.016, 0.02, 8), 0xf3f3f3, { p: [x, y + 0.28, 0.2], cast: false });
        }
      }
    }
    mesh(g, G.box(0.56, 0.015, 0.02), new THREE.MeshBasicMaterial({ color: 0xfff6d8 }), { p: [0, 1.42, 0.3], cast: false }); // dải đèn
    mesh(g, G.box(0.62, 1.24, 0.02), glass(0xcfefff, 0.25), { p: [0, 0.85, 0.31], cast: false });
    for (const sx of [-1, 1]) mesh(g, G.box(0.03, 1.26, 0.03), 0xb8323a, { p: [sx * 0.31, 0.85, 0.31] });
    for (const y of [0.23, 1.47]) mesh(g, G.box(0.62, 0.03, 0.03), 0xb8323a, { p: [0, y, 0.31] });
    mesh(g, G.box(0.03, 0.3, 0.04), 0xcfd6dc, { p: [0.26, 0.85, 0.34] }); // tay nắm
    for (let i = 0; i < 5; i++) mesh(g, G.box(0.56, 0.012, 0.01), 0x2a2d35, { p: [0, 0.06 + i * 0.03, 0.305], cast: false }); // lưới tản nhiệt
  },
  /** Bảng phấn chữ A: khung gỗ, nền xanh đen, chữ phấn + hình tô phấn (bát mì bốc khói, ngôi sao), máng phấn có viên phấn. */
  chalk(g) {
    for (const side of [-1, 1]) {
      mesh(g, G.box(0.05, 1.0, 0.05), 0x8a5a35, { p: [side * 0.32, 0.5, 0.06], r: [0.12, 0, 0] });
      mesh(g, G.box(0.05, 1.0, 0.05), 0x8a5a35, { p: [side * 0.32, 0.5, -0.12], r: [-0.2, 0, 0] }); // chân sau
    }
    const board = group(g, { p: [0, 0.68, 0.06], r: [-0.12, 0, 0] });
    mesh(board, G.box(0.72, 0.66, 0.04), 0x8a5a35);
    mesh(board, G.box(0.64, 0.58, 0.05), 0x2f4f45);
    const text = signText('Món ngon', '#fffaf1', 0.6, 0.16);
    text.position.set(0, 0.17, 0.03);
    board.add(text);
    const text2 = signText('hôm nay ♥', '#f6d33c', 0.6, 0.15);
    text2.position.set(0, 0.02, 0.03);
    board.add(text2);
    const chalkW = 0xf3efe6;
    mesh(board, G.torus(0.07, 0.006, 3, 12, Math.PI), chalkW, { p: [-0.12, -0.17, 0.03], r: [0, 0, Math.PI], cast: false }); // bát
    mesh(board, G.box(0.16, 0.006, 0.004), chalkW, { p: [-0.12, -0.17, 0.03], cast: false });
    for (const dx of [-0.03, 0.02]) mesh(board, G.torus(0.02, 0.004, 3, 8, Math.PI), 0xdcdcdc, { p: [-0.12 + dx, -0.12, 0.03], r: [0, 0, dx > 0 ? 0 : Math.PI], cast: false }); // khói
    mesh(board, G.ico(0.035, 0), 0xf08fb0, { p: [0.15, -0.15, 0.03], s: [1, 1, 0.1], cast: false });
    mesh(g, G.box(0.66, 0.03, 0.06), 0x6b4428, { p: [0, 0.36, 0.13] }); // máng phấn
    for (const [x, c] of [[-0.1, 0xffffff], [0.05, 0xf6d33c], [0.15, 0xf08fb0]] as const) mesh(g, G.cyl(0.008, 0.008, 0.06, 5), c, { p: [x, 0.385, 0.13], r: [0, 0, Math.PI / 2 + x], cast: false });
  },
  /** Tượng cú gỗ trên gốc cây: thân khắc vảy lông nhiều hàng, cánh ôm thân, đĩa mặt sáng, mắt to, chỏm tai, mỏ, móng. */
  owl(g) {
    mesh(g, G.cyl(0.18, 0.21, 0.2, 10), 0x7a4f33, { p: [0, 0.1, 0] });
    for (const r of [0.06, 0.11, 0.155]) mesh(g, G.torus(r, 0.006, 3, 14), 0x9a6b44, { p: [0, 0.201, 0], r: [Math.PI / 2, 0, 0], cast: false }); // vân gốc cây
    const wood = 0xb9733f;
    mesh(g, G.sphere(0.2, 12, 10), wood, { p: [0, 0.42, 0], s: [1, 1.3, 0.9] });
    for (let row = 0; row < 4; row++) for (let k = -2; k <= 2; k++) {
      if (Math.abs(k) + row > 4) continue;
      mesh(g, G.sphere(0.03, 5, 4), 0x9a5f30, { p: [k * 0.05 + (row % 2) * 0.025, 0.28 + row * 0.055, 0.17 - Math.abs(k) * 0.02], s: [1, 0.7, 0.35], cast: false }); // vảy lông
    }
    for (const side of [-1, 1]) {
      mesh(g, G.sphere(0.12, 8, 6), 0x9a5f30, { p: [side * 0.16, 0.4, -0.02], s: [0.4, 1.1, 0.9] }); // cánh
      mesh(g, G.sphere(0.075, 10, 8), 0xf3dcb4, { p: [side * 0.08, 0.56, 0.13], s: [1, 1, 0.5] });
      mesh(g, G.sphere(0.04, 8, 6), 0xf2b23e, { p: [side * 0.08, 0.56, 0.17], s: [1, 1, 0.5], cast: false });
      mesh(g, G.sphere(0.022, 6, 5), 0x2a1f1a, { p: [side * 0.08, 0.56, 0.19], cast: false });
      mesh(g, G.cone(0.045, 0.12, 4), wood, { p: [side * 0.12, 0.72, 0], r: [0, 0, -side * 0.3] });
      for (let k = -1; k <= 1; k++) mesh(g, G.box(0.012, 0.012, 0.04), 0x5a3b2a, { p: [side * 0.07 + k * 0.02, 0.215, 0.12], cast: false }); // móng
    }
    mesh(g, G.cone(0.03, 0.07, 4), 0xe2a03a, { p: [0, 0.5, 0.2], r: [Math.PI, 0, 0] });
  },
  /** Chậu lan hồ điệp: chậu sứ trắng, lá to dày bóng xoè, 2 cành hoa cong buộc cọc, hoa 5 cánh hồng / trắng + nụ đầu cành. */
  orchid(g) {
    pot(g, 0.16, 0.26, 0xf4f1e8, 0xd96fb5);
    for (let i = 0; i < 5; i++) leaf(g, [0, 0.3, 0], i * 1.3, 0.25 + (i % 2) * 0.15, 0.22, 0.09, i % 2 ? 0x2f7a3a : 0x3f8f45);
    mesh(g, G.cyl(0.006, 0.006, 0.6, 4), 0x8a5a35, { p: [0.02, 0.58, -0.02] }); // cọc
    for (const [side, color, heart] of [[1, 0xf6b3e0, 0xd9578a], [-1, 0xfaf6fb, 0xe2a03a]] as const) {
      const stem: V3[] = [[0.02, 0.3, 0], [0.02, 0.62, 0], [side * 0.08, 0.78, 0.04], [side * 0.2, 0.8, 0.08]];
      trunk(g, stem, 0.008, 0.006, 0x5f8f3f);
      for (let k = 0; k < 5; k++) {
        const u = k / 4;
        const p: V3 = [side * (0.04 + u * 0.18), 0.74 + Math.sin(u * Math.PI) * 0.06 - u * 0.04, 0.06 + u * 0.04];
        if (k === 4) mesh(g, G.sphere(0.022, 6, 5), 0x9fcf6a, { p, cast: false });
        else flower(g, p, [0, side * 0.3, 0], 1.6 - k * 0.15, color, heart);
      }
    }
    mesh(g, G.box(0.02, 0.015, 0.02), 0xf3efe6, { p: [0.02, 0.6, 0.008], cast: false }); // kẹp cành
  },
  /** Lồng chim treo: cột gỗ móc cong, lồng tre vòm (nan dọc uốn qua đỉnh), đáy khay, cửa nhỏ, cầu đậu, chim vàng có cánh + đuôi, cốc thức ăn. */
  birdcage(g) {
    mesh(g, G.cyl(0.16, 0.19, 0.05, 12), 0x5a3b2a, { p: [0, 0.025, 0] });
    mesh(g, G.cyl(0.025, 0.03, 1.35, 6), 0x5a3b2a, { p: [0, 0.7, 0] });
    mesh(g, G.torus(0.12, 0.018, 5, 10, Math.PI), 0x5a3b2a, { p: [0.12, 1.37, 0] }); // móc cong
    mesh(g, G.cyl(0.004, 0.004, 0.1, 3), 0xb08d57, { p: [0.24, 1.32, 0], cast: false });
    const cage = group(g, { p: [0.24, 0.84, 0] });
    mesh(cage, G.cyl(0.2, 0.2, 0.04, 16), 0x8a5a35);
    mesh(cage, G.torus(0.2, 0.01, 4, 16), 0xb08d57, { p: [0, 0.18, 0], r: [Math.PI / 2, 0, 0], cast: false });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI;
      mesh(cage, G.torus(0.2, 0.005, 3, 16, Math.PI), 0xb08d57, { p: [0, 0.2, 0], r: [0, a, 0], s: [1, 1.3, 1], cast: false }); // nan vòm
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      mesh(cage, G.cyl(0.004, 0.004, 0.2, 3), 0xb08d57, { p: [Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2], cast: false });
    }
    mesh(cage, G.box(0.1, 0.12, 0.005), 0x8a5a35, { p: [0, 0.08, 0.2], cast: false }); // cửa lồng
    mesh(cage, G.cyl(0.006, 0.006, 0.34, 4), 0x8a5a35, { p: [0, 0.12, 0], r: [0, 0, Math.PI / 2], cast: false }); // cầu đậu
    mesh(cage, G.cyl(0.025, 0.02, 0.03, 8), 0xf3efe6, { p: [-0.12, 0.04, 0.08], cast: false });
    const bird = group(cage, { p: [0.02, 0.17, 0], r: [0, 0.4, 0] });
    mesh(bird, G.sphere(0.05, 8, 6), 0xf2d03e, { s: [1.3, 1, 0.9] });
    mesh(bird, G.sphere(0.035, 8, 6), 0xf2d03e, { p: [0.05, 0.04, 0] });
    mesh(bird, G.cone(0.012, 0.035, 4), 0xf28c28, { p: [0.09, 0.04, 0], r: [0, 0, -Math.PI / 2] });
    mesh(bird, G.sphere(0.008, 4, 3), 0x2a1f1a, { p: [0.065, 0.055, 0.025], cast: false });
    for (const s of [-1, 1]) mesh(bird, G.sphere(0.035, 6, 5), 0xd9b02e, { p: [-0.01, 0.005, s * 0.035], s: [1.3, 0.5, 0.4], cast: false }); // cánh
    mesh(bird, G.box(0.06, 0.008, 0.03), 0xd9b02e, { p: [-0.08, -0.01, 0], r: [0, 0, 0.3], cast: false }); // đuôi
  },
};

/** Dựng đồ trang trí; kiểu chưa có model thì hiện emoji. */
export function makeProp(model: string, icon: string): THREE.Group {
  const g = group(null);
  const make = MAKERS[model];
  if (buildPainting(g, model)) return g; // tranh treo tường (paintings.ts)
  if (make) make(g);
  else {
    const s = emojiSprite(icon, 0.6);
    s.position.y = 0.4;
    g.add(s);
  }
  return g;
}

/** Cử động nhẹ cho đồ trang trí có phần chuyển động (cá bơi trong bể). */
export function animateProp(g: THREE.Object3D, t: number): void {
  g.traverse((o) => {
    const swim = o.userData.swim as number | undefined;
    if (swim == null) return;
    o.position.x = swim + Math.sin(t * 0.8 + swim * 5) * 0.12;
    o.rotation.y = Math.cos(t * 0.8 + swim * 5) > 0 ? 0 : Math.PI;
  });
}
