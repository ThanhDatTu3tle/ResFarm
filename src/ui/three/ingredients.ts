import * as THREE from 'three';
import { G, group, mesh, seeded, toon } from './toon';

/**
 * NGUYÊN LIỆU (ItemDef) dựng 3D kiểu đơn giản: gốc ở tâm đáy, cỡ khoảng 0.2–0.3 m, mặt trước +z.
 * Dùng ở trang model, khay hàng / rổ hàng trong quầy chợ (thay biểu tượng), và vỏ ốc / sò / hàu dùng chung cho
 * món ăn quán Ốc + con giống ở ao. Id chưa có model trả null (nơi gọi hiện biểu tượng như cũ).
 */

const glass = (c: number, o = 0.7) => toon(c, { transparent: true, opacity: o });

/** Chai: thân + vai + cổ + nắp + nhãn. */
function bottle(g: THREE.Object3D, body: number, cap: number, label: number, h = 0.24, r = 0.045, clear = false): void {
  const m = clear ? glass(body) : body;
  mesh(g, G.cyl(r, r, h * 0.62, 12), m, { p: [0, h * 0.31, 0] });
  mesh(g, G.cyl(r * 0.4, r, h * 0.2, 12), m, { p: [0, h * 0.72, 0] });
  mesh(g, G.cyl(r * 0.36, r * 0.36, h * 0.12, 10), m, { p: [0, h * 0.88, 0] });
  mesh(g, G.cyl(r * 0.42, r * 0.42, h * 0.07, 10), cap, { p: [0, h * 0.97, 0] });
  mesh(g, G.cyl(r + 0.002, r + 0.002, h * 0.25, 12), label, { p: [0, h * 0.3, 0], cast: false });
}

/** Bao vải / bao giấy buộc miệng. */
function sack(g: THREE.Object3D, color: number, tie: number, fill?: number): void {
  mesh(g, G.sphere(0.12, 10, 8), color, { p: [0, 0.12, 0], s: [1, 1.1, 0.85] });
  mesh(g, G.cyl(0.04, 0.07, 0.08, 8), color, { p: [0, 0.26, 0] });
  mesh(g, G.torus(0.04, 0.01, 4, 10), tie, { p: [0, 0.25, 0], r: [Math.PI / 2, 0, 0], cast: false });
  if (fill != null) mesh(g, G.sphere(0.05, 8, 6), fill, { p: [0, 0.3, 0], s: [1, 0.5, 1], cast: false });
  mesh(g, G.box(0.1, 0.07, 0.005), 0xf3efe6, { p: [0, 0.13, 0.102], cast: false });
}

/** Vỏ ốc xoắn (ốc hương, ốc bươu): thân tròn + các vòng xoắn nhỏ dần lên chóp. */
export function snailShell(g: THREE.Object3D, color: number, stripe: number, s = 1, tall = 1): THREE.Group {
  const sh = group(g, { s });
  mesh(sh, G.sphere(0.06, 10, 8), color, { p: [0, 0.05, 0], s: [1, 0.95, 1.1] });
  for (let i = 0; i < 3; i++) mesh(sh, G.torus(0.045 - i * 0.012, 0.016 - i * 0.003, 6, 12), i % 2 ? stripe : color, { p: [0, 0.085 + i * 0.03 * tall, -0.01], r: [Math.PI / 2, 0, 0] });
  mesh(sh, G.cone(0.014, 0.04 * tall, 6), stripe, { p: [0, 0.16 * tall + 0.01, -0.01] });
  mesh(sh, G.sphere(0.03, 8, 6), 0xf6e6c8, { p: [0.02, 0.04, 0.05], s: [1, 1.2, 0.4], cast: false }); // miệng ốc
  return sh;
}

/** Nửa vỏ sò / hàu (ngửa): `kind` scallop = quạt có gân, oyster = sần dẹt xám. Gốc ở đáy vỏ. */
export function halfShell(g: THREE.Object3D, kind: 'scallop' | 'oyster', s = 1): THREE.Group {
  const sh = group(g, { s });
  if (kind === 'scallop') {
    mesh(sh, G.sphere(0.07, 12, 6, ), 0xf2b07a, { p: [0, 0.015, 0], s: [1, 0.3, 0.95] });
    for (let i = -3; i <= 3; i++) mesh(sh, G.box(0.006, 0.012, 0.13), 0xd98a4f, { p: [i * 0.018, 0.008, 0], r: [0, i * 0.18, 0], cast: false }); // gân quạt
    mesh(sh, G.box(0.06, 0.02, 0.025), 0xf2b07a, { p: [0, 0.008, -0.07] }); // tai vỏ
  } else {
    mesh(sh, G.sphere(0.075, 10, 6), 0x9a9a92, { p: [0, 0.015, 0], s: [1, 0.3, 1.3] });
    for (let i = 0; i < 4; i++) mesh(sh, G.ico(0.025, 0), 0x85857e, { p: [Math.cos(i * 1.6) * 0.05, 0.012, Math.sin(i * 1.6) * 0.07], s: [1.3, 0.4, 1], cast: false });
    mesh(sh, G.sphere(0.055, 10, 6), 0xd9d6cf, { p: [0, 0.03, 0], s: [1, 0.12, 1.25], cast: false }); // lòng vỏ xà cừ
  }
  return sh;
}

/** Con nghêu (2 mảnh vỏ khép, có sọc). */
export function clam(g: THREE.Object3D, s = 1, open = false): THREE.Group {
  const c = group(g, { s });
  mesh(c, G.sphere(0.05, 10, 8), 0xd9c9a8, { p: [0, 0.03, 0], s: [1.3, open ? 0.35 : 0.65, 1] });
  for (const r of [0.03, 0.045]) mesh(c, G.torus(r, 0.004, 3, 14, Math.PI), 0x8a7a5a, { p: [0, 0.03, 0], r: [-Math.PI / 2, 0, 0], s: [1.3, 1, 1], cast: false });
  if (open) {
    mesh(c, G.sphere(0.05, 10, 6), 0xd9c9a8, { p: [0, 0.07, -0.04], r: [-1.1, 0, 0], s: [1.3, 0.3, 1] });
    mesh(c, G.sphere(0.03, 8, 6), 0xf6d8b0, { p: [0, 0.045, 0], s: [1.2, 0.5, 1], cast: false });
  }
  return c;
}

/** Ốc móng tay (vỏ dài hẹp hai mảnh). */
export function razorClam(g: THREE.Object3D, s = 1): THREE.Group {
  const c = group(g, { s });
  mesh(c, G.capsule(0.018, 0.14), 0xc9a066, { p: [0, 0.02, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.8] });
  mesh(c, G.box(0.16, 0.004, 0.005), 0x8a6a3a, { p: [0, 0.035, 0], cast: false });
  mesh(c, G.sphere(0.015, 6, 5), 0xf6d8b0, { p: [0.1, 0.02, 0], cast: false });
  return c;
}

function sphereFruit(g: THREE.Object3D, r: number, color: number, leaf = 0x4f9e4a, squash = 1): void {
  mesh(g, G.sphere(r, 12, 10), color, { p: [0, r * squash, 0], s: [1, squash, 1] });
  mesh(g, G.cyl(0.005, 0.006, 0.03, 4), 0x6b4a2f, { p: [0, r * 2 * squash + 0.01, 0], cast: false });
  mesh(g, G.box(0.04, 0.004, 0.02), leaf, { p: [0.02, r * 2 * squash + 0.015, 0], r: [0, 0, 0.4], cast: false });
}

const MAKERS: Record<string, (g: THREE.Group) => void> = {
  rice: (g) => sack(g, 0xf3efe6, 0xd9342b, 0xfbf6ea),
  water: (g) => bottle(g, 0x8fd3f0, 0x2f6fbf, 0x4a9bd8, 0.26, 0.04, true),
  oil: (g) => {
    bottle(g, 0xf2c14e, 0xd9342b, 0x5fae57, 0.24, 0.05, true);
    mesh(g, G.torus(0.03, 0.008, 4, 10, Math.PI), 0xf2c14e, { p: [0.05, 0.18, 0], r: [0, 0, -Math.PI / 2], cast: false }); // quai
  },
  salt: (g) => {
    mesh(g, G.cyl(0.08, 0.06, 0.05, 14), 0x3f6fb5, { p: [0, 0.025, 0] });
    mesh(g, G.cone(0.065, 0.05, 12), 0xffffff, { p: [0, 0.07, 0] });
  },
  fish_sauce: (g) => bottle(g, 0x8a4a1e, 0xd9342b, 0xf2c14e, 0.26, 0.04, true),
  soy_sauce: (g) => bottle(g, 0x2a1f1a, 0xd9342b, 0xf3efe6, 0.22, 0.045),
  miso: (g) => {
    mesh(g, G.cyl(0.08, 0.07, 0.08, 12), 0xa8784a, { p: [0, 0.04, 0] });
    for (const y of [0.02, 0.065]) mesh(g, G.torus(0.078, 0.006, 3, 12), 0x5a3b2a, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], cast: false });
    mesh(g, G.sphere(0.07, 10, 6), 0xb9844a, { p: [0, 0.08, 0], s: [1, 0.3, 1], cast: false });
  },
  gochujang: (g) => {
    mesh(g, G.box(0.14, 0.08, 0.1), 0xc8302a, { p: [0, 0.04, 0] });
    mesh(g, G.box(0.15, 0.02, 0.11), 0x8a1f1a, { p: [0, 0.09, 0] });
    mesh(g, G.box(0.06, 0.04, 0.005), 0xf2c14e, { p: [0, 0.045, 0.051], cast: false });
  },
  cabbage: (g) => {
    mesh(g, G.ico(0.1, 1), 0x9bd65a, { p: [0, 0.09, 0], s: [1, 0.85, 1] });
    for (let i = 0; i < 4; i++) mesh(g, G.sphere(0.07, 8, 6), 0x7cc35c, { p: [Math.cos(i * 1.57) * 0.07, 0.06, Math.sin(i * 1.57) * 0.07], s: [1, 0.4, 1], r: [Math.sin(i * 1.57) * 0.8, 0, -Math.cos(i * 1.57) * 0.8] });
  },
  tomato: (g) => {
    mesh(g, G.sphere(0.07, 12, 10), 0xe5463c, { p: [0, 0.06, 0], s: [1, 0.85, 1] });
    for (let i = 0; i < 5; i++) mesh(g, G.box(0.035, 0.005, 0.01), 0x4f9e4a, { p: [Math.cos(i * 1.26) * 0.015, 0.12, Math.sin(i * 1.26) * 0.015], r: [0, -i * 1.26, 0], cast: false });
  },
  onion: (g) => {
    mesh(g, G.sphere(0.065, 12, 10), 0xc98aa8, { p: [0, 0.06, 0], s: [1, 0.95, 1] });
    mesh(g, G.cone(0.025, 0.05, 8), 0xb57a95, { p: [0, 0.14, 0] });
    for (let i = 0; i < 3; i++) mesh(g, G.box(0.003, 0.1, 0.003), 0xd9a8c0, { p: [0, 0.06, 0.064], r: [0, i * 0.8, 0], cast: false });
  },
  carrot: (g) => {
    mesh(g, G.cone(0.035, 0.2, 8), 0xf28c28, { p: [0, 0.035, 0], r: [0, 0, Math.PI / 2] });
    for (const r of [-0.4, 0, 0.4]) mesh(g, G.cone(0.012, 0.1, 4), 0x58b04f, { p: [-0.13, 0.05, 0], r: [r, 0, Math.PI / 2 + 0.4] });
  },
  potato: (g) => {
    mesh(g, G.sphere(0.06, 10, 8), 0xb98a55, { p: [0, 0.045, 0], s: [1.3, 0.75, 1] });
    for (const [x, z] of [[0.03, 0.03], [-0.04, 0.0], [0.0, -0.04]]) mesh(g, G.sphere(0.006, 4, 3), 0x7a5a3a, { p: [x, 0.08, z], cast: false });
  },
  chili: (g) => {
    for (const [x, r] of [[-0.02, 0.3], [0.025, -0.3]]) {
      const c = group(g, { p: [x, 0.02, 0], r: [0, r, 0] });
      mesh(c, G.capsule(0.015, 0.1), 0xd92b2b, { r: [0, 0, Math.PI / 2 + 0.2] });
      mesh(c, G.cyl(0.005, 0.006, 0.03, 4), 0x4f9e4a, { p: [0.07, 0.015, 0], r: [0, 0, 0.8] });
    }
  },
  cucumber: (g) => {
    mesh(g, G.capsule(0.03, 0.16), 0x4f8f3a, { p: [0, 0.03, 0], r: [0, 0, Math.PI / 2] });
    for (let i = 0; i < 6; i++) mesh(g, G.sphere(0.006, 4, 3), 0x9fd07a, { p: [-0.07 + i * 0.03, 0.055, (i % 2) * 0.02 - 0.01], cast: false });
  },
  mushroom: (g) => {
    for (const [x, z, s] of [[0, 0, 1], [0.06, 0.03, 0.75]] as const) {
      const m = group(g, { p: [x, 0, z], s });
      mesh(m, G.cyl(0.015, 0.02, 0.06, 8), 0xf3e9d2, { p: [0, 0.03, 0] });
      mesh(m, G.sphere(0.05, 10, 8), 0x8a5a35, { p: [0, 0.065, 0], s: [1, 0.55, 1] });
    }
  },
  pork: (g) => {
    mesh(g, G.box(0.16, 0.04, 0.1), 0xf2a8a0, { p: [0, 0.02, 0] });
    for (const y of [0.012, 0.03]) mesh(g, G.box(0.161, 0.006, 0.101), 0xfff3e6, { p: [0, y, 0], cast: false }); // lớp mỡ
    mesh(g, G.box(0.161, 0.01, 0.101), 0xe8b0a0, { p: [0, 0.042, 0], cast: false }); // da
  },
  chicken: (g) => {
    const d = group(g, { p: [0, 0.04, 0], r: [0, 0, 0.2] });
    mesh(d, G.sphere(0.05, 10, 8), 0xe8b48a, { s: [1.4, 1, 1] });
    mesh(d, G.cyl(0.012, 0.012, 0.08, 6), 0xf6f1e4, { p: [0.09, 0, 0], r: [0, 0, Math.PI / 2] });
    mesh(d, G.sphere(0.016, 6, 5), 0xf6f1e4, { p: [0.13, 0, 0] });
  },
  beef: (g) => {
    mesh(g, G.box(0.16, 0.035, 0.11), 0xb5362a, { p: [0, 0.018, 0] });
    for (let i = 0; i < 4; i++) mesh(g, G.box(0.07, 0.002, 0.006), 0xf3d6cc, { p: [-0.04 + i * 0.025, 0.037, -0.03 + (i % 2) * 0.05], r: [0, i * 0.8, 0], cast: false });
    mesh(g, G.box(0.161, 0.036, 0.012), 0xfff3e6, { p: [0, 0.018, -0.05], cast: false });
  },
  fish: (g) => {
    const f = group(g, { p: [0, 0.035, 0] });
    mesh(f, G.sphere(0.045, 10, 8), 0x9fb5c2, { s: [2.2, 0.8, 0.6] });
    mesh(f, G.cone(0.035, 0.05, 4), 0x7f95a2, { p: [-0.12, 0, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.3] });
    mesh(f, G.sphere(0.008, 5, 4), 0x2a1f1a, { p: [0.08, 0.01, 0.022], cast: false });
    mesh(f, G.box(0.08, 0.004, 0.002), 0xe2e8ec, { p: [0, 0, 0.027], cast: false });
  },
  shrimp: (g) => {
    mesh(g, G.torus(0.04, 0.018, 6, 10, Math.PI * 1.4), 0xb9b3aa, { p: [0, 0.018, 0], r: [Math.PI / 2, 0, 0] }); // tôm tươi xám xanh
    mesh(g, G.cone(0.02, 0.03, 4), 0x9a948c, { p: [0.04, 0.018, -0.012], r: [0, 0, -Math.PI / 2], s: [1, 1, 0.4], cast: false });
    for (const z of [0.01, 0.02]) mesh(g, G.cyl(0.002, 0.002, 0.06, 3), 0x9a948c, { p: [-0.05, 0.02, z], r: [0, 0, Math.PI / 2 + 0.3], cast: false }); // râu
  },
  squid: (g) => {
    mesh(g, G.cone(0.035, 0.12, 8), 0xf3e6e6, { p: [0.03, 0.035, 0], r: [0, 0, -Math.PI / 2] });
    for (let i = 0; i < 5; i++) mesh(g, G.cyl(0.005, 0.003, 0.08, 4), 0xe8cccc, { p: [-0.07, 0.03, -0.02 + i * 0.01], r: [0, 0, Math.PI / 2 + (i - 2) * 0.08], cast: false });
    mesh(g, G.cone(0.03, 0.03, 4), 0xf3e6e6, { p: [0.1, 0.035, 0], r: [0, 0, -Math.PI / 2], s: [1, 1, 0.2] });
  },
  salmon: (g) => {
    mesh(g, G.box(0.16, 0.04, 0.08), 0xf28c5a, { p: [0, 0.02, 0] });
    for (let i = 0; i < 5; i++) mesh(g, G.box(0.006, 0.041, 0.081), 0xffd2b8, { p: [-0.06 + i * 0.03, 0.02, 0], r: [0, 0.4, 0], cast: false });
  },
  oc_huong: (g) => void snailShell(g, 0xf3dcb4, 0xc98a4f, 1, 1.3),
  oc_mong_tay: (g) => {
    razorClam(g, 1);
    razorClam(group(g, { p: [0.01, 0.03, 0.03], r: [0, 0.3, 0] }), 0.9);
  },
  so_diep: (g) => void halfShell(g, 'scallop', 1),
  ngheu: (g) => {
    clam(g, 1);
    clam(group(g, { p: [0.07, 0, 0.03], r: [0, 1, 0] }), 0.8);
  },
  hau: (g) => void halfShell(g, 'oyster', 1),
  oc_bu: (g) => void snailShell(g, 0x5a5a3a, 0x3b3a2a, 1.2, 0.8),
  scallion: (g) => {
    for (let i = 0; i < 6; i++) {
      const s = group(g, { p: [0, 0.012, -0.025 + i * 0.01], r: [0, (i - 3) * 0.06, Math.PI / 2] });
      mesh(s, G.cyl(0.006, 0.007, 0.06, 5), 0xf3f6ee, { p: [0, -0.06, 0] });
      mesh(s, G.cyl(0.005, 0.006, 0.14, 5), 0x5fae57, { p: [0, 0.04, 0] });
    }
  },
  egg: (g) => {
    for (const [x, z] of [[0, 0], [0.05, 0.03], [-0.04, 0.04]]) mesh(g, G.sphere(0.03, 10, 8), 0xf6e6c8, { p: [x, 0.03, z], s: [1, 1.25, 1] });
  },
  milk: (g) => {
    mesh(g, G.box(0.08, 0.16, 0.08), 0xffffff, { p: [0, 0.08, 0] });
    mesh(g, G.prism(), 0xffffff, { p: [0, 0.16, 0], s: [0.08, 0.04, 0.08] });
    mesh(g, G.box(0.081, 0.06, 0.081), 0x4a9bd8, { p: [0, 0.05, 0], cast: false });
  },
  noodle: (g) => {
    for (let i = 0; i < 4; i++) mesh(g, G.box(0.16, 0.008, 0.11), 0xfaf7ee, { p: [(i % 2) * 0.008, 0.005 + i * 0.01, 0], r: [0, i * 0.08, 0] });
  },
  rice_noodle: (g) => {
    for (let i = 0; i < 4; i++) mesh(g, G.torus(0.03 + i * 0.015, 0.008, 4, 14), 0xfaf7ee, { p: [0, 0.01 + (i % 2) * 0.008, 0], r: [Math.PI / 2, 0, i], cast: false });
  },
  wheat_noodle: (g) => {
    for (let i = 0; i < 4; i++) mesh(g, G.torus(0.03 + i * 0.015, 0.008, 4, 14), 0xf3d98a, { p: [0, 0.01 + (i % 2) * 0.008, 0], r: [Math.PI / 2, 0, i], cast: false });
  },
  rice_cake: (g) => {
    for (let i = 0; i < 5; i++) mesh(g, G.capsule(0.014, 0.08), 0xf6efe4, { p: [-0.04 + (i % 3) * 0.03, 0.015 + (i > 2 ? 0.025 : 0), (i > 2 ? 0.015 : 0)], r: [Math.PI / 2, 0, Math.PI / 2] });
  },
  tofu: (g) => {
    mesh(g, G.box(0.11, 0.06, 0.09), 0xfaf6ea, { p: [0, 0.03, 0] });
    mesh(g, G.box(0.111, 0.004, 0.091), 0xe9e2d0, { p: [0, 0.045, 0], cast: false });
  },
  seaweed: (g) => {
    for (let i = 0; i < 4; i++) mesh(g, G.box(0.14, 0.004, 0.12), i % 2 ? 0x1f2a1f : 0x2a3a2a, { p: [0, 0.004 + i * 0.005, 0], r: [0, i * 0.1, 0] });
  },
  flour: (g) => sack(g, 0xf6f1e4, 0xc9a066),
  bread: (g) => {
    mesh(g, G.capsule(0.035, 0.18), 0xe0a050, { p: [0, 0.035, 0], r: [0, 0, Math.PI / 2] });
    for (const x of [-0.06, 0, 0.06]) mesh(g, G.box(0.02, 0.006, 0.05), 0xc78a30, { p: [x, 0.068, 0], r: [0, 0.6, 0], cast: false });
  },
  cheese: (g) => {
    // Miếng nêm nằm: tam giác nằm ngang, đùn theo chiều cao
    mesh(g, G.prism(), 0xf6d34e, { p: [0, 0.035, 0.05], r: [-Math.PI / 2, 0, 0], s: [0.14, 0.12, 0.07] });
    for (const [x, z] of [[0.02, 0.02], [-0.03, 0.03], [0.0, -0.03]]) mesh(g, G.sphere(0.01, 6, 5), 0xd9b02e, { p: [x, 0.071, z], s: [1, 0.3, 1], cast: false });
    mesh(g, G.sphere(0.012, 6, 5), 0xd9b02e, { p: [0.03, 0.035, 0.052], s: [1, 1, 0.3], cast: false });
  },
  orange: (g) => sphereFruit(g, 0.06, 0xf28c28),
  apple: (g) => sphereFruit(g, 0.06, 0xd9433a, 0x4f9e4a, 0.88),
  mango: (g) => {
    mesh(g, G.sphere(0.05, 10, 8), 0xf2c43e, { p: [0, 0.045, 0], s: [1.5, 0.9, 1] });
    mesh(g, G.sphere(0.03, 8, 6), 0xe2703a, { p: [0.04, 0.06, 0.02], s: [1, 0.8, 0.6], cast: false });
  },
  banana: (g) => {
    for (let i = 0; i < 4; i++) mesh(g, G.torus(0.08, 0.016, 6, 10, 1.4), 0xf2d03e, { p: [0, 0.02 + i * 0.015, -0.04 + i * 0.012], r: [Math.PI / 2 - 0.3, 0, 0.9] });
    mesh(g, G.cyl(0.012, 0.012, 0.04, 6), 0x6b4a2f, { p: [0.06, 0.06, 0.0], r: [0, 0, 0.6] });
  },
  wheat: (g) => {
    const rnd = seeded(3);
    for (let i = 0; i < 7; i++) {
      const s = group(g, { p: [0, 0.01, 0], r: [(rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.4] });
      mesh(s, G.cyl(0.004, 0.004, 0.22, 3), 0xd9b05a, { p: [0, 0.11, 0] });
      mesh(s, G.capsule(0.012, 0.04), 0xe8c55a, { p: [0, 0.24, 0] });
    }
    mesh(g, G.torus(0.02, 0.006, 4, 10), 0xd9342b, { p: [0, 0.08, 0], r: [Math.PI / 2, 0, 0], cast: false });
  },
  paddy_rice: (g) => sack(g, 0xc9a066, 0x8a5a35, 0xe8c55a),
};

/** Model nguyên liệu theo id; chưa có thì null. */
export function makeIngredient(id: string): THREE.Group | null {
  const make = MAKERS[id];
  if (!make) return null;
  const g = group(null);
  make(g);
  return g;
}
