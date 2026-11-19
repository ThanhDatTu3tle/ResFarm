import * as THREE from 'three';
import { makeBush } from './models';
import { signText } from './cuisine';
import { emojiSprite, G, group, mesh, toon } from './toon';

/**
 * ĐỒ TRANG TRÍ đặt tự do trong quán (PropDef.model). Gốc ở tâm khoảng chiếm chỗ, chân ở y = 0, mặt trước nhìn về +z.
 * Kích thước khớp xấp xỉ PropDef.w/h (55 đơn vị 2D = 1 mét). Kiểu chưa có ở đây thì hiện emoji của món.
 */

type Maker = (g: THREE.Group) => void;

const pot = (g: THREE.Group, r: number, h: number, color = 0xc8623e) => {
  mesh(g, G.cyl(r, r * 0.78, h, 14), color, { p: [0, h / 2, 0] });
  mesh(g, G.cyl(r * 1.06, r * 1.06, 0.05, 14), color, { p: [0, h, 0] });
  mesh(g, G.cyl(r * 0.92, r * 0.92, 0.02, 14), 0x5a3b2a, { p: [0, h + 0.02, 0], cast: false });
};

/** Cây có tán hoa (mai vàng, anh đào): thân cong, cành, chùm hoa. */
const blossom = (flower: number) => (g: THREE.Group) => {
  pot(g, 0.26, 0.32, 0x3f6f8f);
  mesh(g, G.cyl(0.05, 0.07, 0.9, 7), 0x6b4a2f, { p: [0, 0.75, 0], r: [0, 0, 0.12] });
  for (const [x, y, z, s] of [[0.05, 1.25, 0, 0.36], [-0.25, 1.05, 0.1, 0.28], [0.28, 1.0, -0.05, 0.27], [0.0, 1.45, 0.05, 0.24], [-0.1, 1.2, -0.22, 0.25]]) {
    mesh(g, G.ico(s, 1), flower, { p: [x, y, z] });
  }
  for (let i = 0; i < 6; i++) mesh(g, G.sphere(0.035, 6, 5), 0xffffff, { p: [Math.sin(i * 2.4) * 0.3, 1.1 + (i % 3) * 0.15, Math.cos(i * 2.4) * 0.25], cast: false });
};

const MAKERS: Record<string, Maker> = {
  fig(g) {
    pot(g, 0.22, 0.34);
    mesh(g, G.cyl(0.03, 0.04, 0.6, 6), 0x6b4a2f, { p: [0, 0.65, 0] });
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      mesh(g, G.sphere(0.14, 8, 6), i % 2 ? 0x3f8f3f : 0x5fae57, { p: [Math.cos(a) * 0.16, 0.8 + (i % 3) * 0.17, Math.sin(a) * 0.16], s: [1.2, 0.5, 0.9], r: [0.4, a, 0] });
    }
  },
  floorlamp(g) {
    mesh(g, G.cyl(0.18, 0.2, 0.05, 14), 0x5a3b2a, { p: [0, 0.025, 0] });
    mesh(g, G.cyl(0.025, 0.025, 1.45, 6), 0x5a3b2a, { p: [0, 0.75, 0] });
    mesh(g, G.cyl(0.16, 0.26, 0.34, 14), toon(0xfff1d0, { emissive: 0xffc861, emissiveIntensity: 0.6 }), { p: [0, 1.55, 0] });
  },
  bonsai(g) {
    mesh(g, G.cyl(0.24, 0.26, 0.42, 8), 0x7a4f33, { p: [0, 0.21, 0] }); // đôn gỗ
    mesh(g, G.box(0.42, 0.09, 0.26), 0x3f6f8f, { p: [0, 0.47, 0] });
    mesh(g, G.cyl(0.03, 0.05, 0.3, 6), 0x6b4a2f, { p: [0.03, 0.66, 0], r: [0, 0, -0.5] });
    for (const [x, y, s] of [[0.14, 0.82, 0.13], [-0.08, 0.78, 0.11], [0.02, 0.92, 0.1]]) mesh(g, G.ico(s, 1), 0x3f8f3f, { p: [x, y, 0], s: [1.4, 0.6, 1] });
  },
  aquarium(g) {
    mesh(g, G.box(1.4, 0.6, 0.6), 0x5a3b2a, { p: [0, 0.3, 0] });
    mesh(g, G.box(1.3, 0.55, 0.52), new THREE.MeshToonMaterial({ color: 0x8fd3f0, transparent: true, opacity: 0.55 }), { p: [0, 0.88, 0], cast: false });
    mesh(g, G.box(1.32, 0.04, 0.54), 0x3a3a3a, { p: [0, 1.17, 0] });
    mesh(g, G.box(1.26, 0.06, 0.48), 0xe9d8a6, { p: [0, 0.64, 0], cast: false });
    for (const [x, c] of [[-0.35, 0xf2913d], [0.1, 0xe2574c], [0.4, 0xf2d03e]] as [number, number][]) {
      const fish = mesh(g, G.sphere(0.06, 8, 6), c, { p: [x, 0.9 + Math.abs(x) * 0.2, 0.05], s: [1.6, 1, 0.6], cast: false });
      fish.userData.swim = x;
    }
    for (const x of [-0.5, 0.25]) mesh(g, G.cone(0.04, 0.3, 5), 0x3f8f3f, { p: [x, 0.8, -0.1], cast: false });
  },
  bamboo(g) {
    pot(g, 0.24, 0.3, 0x2f4f3f);
    for (const [x, z, h] of [[0, 0, 1.6], [0.1, 0.06, 1.3], [-0.09, -0.05, 1.45]]) {
      mesh(g, G.cyl(0.025, 0.025, h, 6), 0x7cb35c, { p: [x, 0.3 + h / 2, z] });
      for (let y = 0.6; y < h; y += 0.35) mesh(g, G.cone(0.05, 0.22, 4), 0x5fae57, { p: [x + 0.08, 0.3 + y, z], r: [0, 0, -1.1] });
    }
  },
  kumquat(g) {
    pot(g, 0.26, 0.34, 0xd9a03a);
    makeBush(g, { p: [0, 0.75, 0], s: 1.5 }, 0x3f8f3f);
    for (let i = 0; i < 12; i++) mesh(g, G.sphere(0.045, 8, 6), 0xf28c28, { p: [Math.sin(i * 2.2) * 0.3, 0.7 + (i % 4) * 0.1, Math.cos(i * 2.2) * 0.3], cast: false });
    mesh(g, G.box(0.1, 0.16, 0.01), 0xd93a32, { p: [0.18, 0.62, 0.3] }); // bao lì xì
  },
  blossom_y: blossom(0xf6d33c),
  blossom_p: blossom(0xf6b3c8),
  vase(g) {
    mesh(g, G.sphere(0.22, 14, 10), 0xf4f1e8, { p: [0, 0.3, 0], s: [1, 1.3, 1] });
    mesh(g, G.cyl(0.08, 0.12, 0.25, 12), 0xf4f1e8, { p: [0, 0.66, 0] });
    mesh(g, G.torus(0.2, 0.02, 5, 16), 0x2f5fa8, { p: [0, 0.32, 0], r: [Math.PI / 2, 0, 0], cast: false });
    mesh(g, G.torus(0.15, 0.015, 5, 16), 0x2f5fa8, { p: [0, 0.5, 0], r: [Math.PI / 2, 0, 0], cast: false });
  },
  toro(g) {
    const stone = 0x9a9a92;
    mesh(g, G.box(0.42, 0.1, 0.42), stone, { p: [0, 0.05, 0] });
    mesh(g, G.cyl(0.08, 0.1, 0.5, 6), stone, { p: [0, 0.35, 0] });
    mesh(g, G.box(0.34, 0.06, 0.34), stone, { p: [0, 0.63, 0] });
    mesh(g, G.box(0.26, 0.24, 0.26), toon(0xfff1c2, { emissive: 0xffc861, emissiveIntensity: 0.5 }), { p: [0, 0.78, 0] });
    mesh(g, G.cone(0.34, 0.22, 4), stone, { p: [0, 1.0, 0], r: [0, Math.PI / 4, 0] });
    mesh(g, G.sphere(0.05, 8, 6), stone, { p: [0, 1.14, 0] });
  },
  maneki(g) {
    mesh(g, G.box(0.42, 0.08, 0.36), 0xd93a32, { p: [0, 0.04, 0] });
    mesh(g, G.sphere(0.17, 12, 10), 0xffffff, { p: [0, 0.27, 0], s: [1, 1.1, 0.9] });
    mesh(g, G.sphere(0.14, 12, 10), 0xffffff, { p: [0, 0.52, 0.02] });
    for (const side of [-1, 1]) mesh(g, G.cone(0.05, 0.08, 4), 0xffffff, { p: [side * 0.08, 0.66, 0.02] });
    mesh(g, G.capsule(0.04, 0.12), 0xffffff, { p: [0.15, 0.55, 0.05], r: [0, 0, -0.3] }); // tay vẫy
    mesh(g, G.torus(0.1, 0.02, 5, 12), 0xd93a32, { p: [0, 0.42, 0.04], r: [Math.PI / 2 - 0.3, 0, 0] });
    mesh(g, G.sphere(0.035, 8, 6), 0xf2c43e, { p: [0, 0.38, 0.13] });
    for (const side of [-1, 1]) mesh(g, G.sphere(0.018, 6, 5), 0x2a1f1a, { p: [side * 0.05, 0.54, 0.14], cast: false });
  },
  onggi(g) {
    for (const [x, z, s] of [[-0.18, 0, 1], [0.2, 0.05, 0.75]]) {
      const j = group(g, { p: [x, 0, z], s });
      mesh(j, G.sphere(0.24, 14, 10), 0x6b3f22, { p: [0, 0.3, 0], s: [1, 1.15, 1] });
      mesh(j, G.cyl(0.15, 0.17, 0.08, 12), 0x5a3420, { p: [0, 0.58, 0] });
      mesh(j, G.cyl(0.17, 0.17, 0.05, 12), 0x5a3420, { p: [0, 0.65, 0] });
    }
  },
  neon(g) {
    mesh(g, G.box(0.06, 1.0, 0.06), 0x3a3f46, { p: [-0.25, 0.5, 0] });
    mesh(g, G.box(0.06, 1.0, 0.06), 0x3a3f46, { p: [0.25, 0.5, 0] });
    mesh(g, G.box(0.7, 0.5, 0.06), 0x24262b, { p: [0, 1.1, 0] });
    const glow = toon(0xff5fa8, { emissive: 0xff5fa8, emissiveIntensity: 0.9 });
    mesh(g, G.torus(0.13, 0.025, 6, 18), glow, { p: [-0.12, 1.1, 0.04], cast: false });
    mesh(g, G.box(0.2, 0.04, 0.03), toon(0x5fe0ff, { emissive: 0x5fe0ff, emissiveIntensity: 0.9 }), { p: [0.16, 1.18, 0.04], cast: false });
    mesh(g, G.box(0.2, 0.04, 0.03), toon(0x5fe0ff, { emissive: 0x5fe0ff, emissiveIntensity: 0.9 }), { p: [0.16, 1.04, 0.04], cast: false });
  },
  pine(g) {
    pot(g, 0.25, 0.32, 0xf4f1e8);
    mesh(g, G.cyl(0.04, 0.06, 0.5, 6), 0x6b4a2f, { p: [0, 0.55, 0] });
    for (const [y, r] of [[0.75, 0.38], [1.05, 0.3], [1.32, 0.2]]) mesh(g, G.cone(r, 0.42, 8), 0x2f6f4a, { p: [0, y, 0] });
  },
  teddy(g) {
    const fur = 0xc98b4f;
    mesh(g, G.sphere(0.24, 12, 10), fur, { p: [0, 0.26, 0], s: [1, 1.05, 0.9] });
    mesh(g, G.sphere(0.18, 12, 10), fur, { p: [0, 0.6, 0.02] });
    mesh(g, G.sphere(0.08, 8, 6), 0xf3dcb4, { p: [0, 0.56, 0.16], s: [1.2, 0.9, 0.7] });
    for (const side of [-1, 1]) {
      mesh(g, G.sphere(0.07, 8, 6), fur, { p: [side * 0.15, 0.75, 0] });
      mesh(g, G.sphere(0.08, 8, 6), fur, { p: [side * 0.22, 0.3, 0.08] });
      mesh(g, G.sphere(0.09, 8, 6), fur, { p: [side * 0.13, 0.06, 0.14] });
      mesh(g, G.sphere(0.02, 6, 5), 0x2a1f1a, { p: [side * 0.06, 0.64, 0.17], cast: false });
    }
    mesh(g, G.torus(0.09, 0.025, 5, 12), 0xe2574c, { p: [0, 0.45, 0.06], r: [Math.PI / 2 - 0.2, 0, 0] });
  },
  claw(g) {
    mesh(g, G.box(0.7, 0.75, 0.7), 0xe2574c, { p: [0, 0.375, 0] });
    mesh(g, G.box(0.66, 0.6, 0.66), new THREE.MeshToonMaterial({ color: 0xcfefff, transparent: true, opacity: 0.4 }), { p: [0, 1.05, 0], cast: false });
    mesh(g, G.box(0.72, 0.12, 0.72), 0xf2b23e, { p: [0, 1.41, 0] });
    for (const [x, z, c] of [[-0.15, -0.1, 0xf6a6c8], [0.12, 0.05, 0x7cc35c], [0, -0.18, 0x4a9bd8]] as [number, number, number][]) mesh(g, G.sphere(0.09, 8, 6), c, { p: [x, 0.84, z] });
    mesh(g, G.cyl(0.01, 0.01, 0.25, 5), 0x9aa6b2, { p: [0.1, 1.22, 0.1] });
    mesh(g, G.cone(0.05, 0.08, 5), 0x9aa6b2, { p: [0.1, 1.08, 0.1], r: [Math.PI, 0, 0] });
    mesh(g, G.sphere(0.05, 8, 6), 0xd93a32, { p: [0.18, 0.62, 0.36] }); // nút bấm
  },
  books(g) {
    // Kệ hở mặt trước: tấm lưng tối, hai vách, nóc + đáy
    mesh(g, G.box(1.2, 1.3, 0.05), 0x5a3b2a, { p: [0, 0.65, -0.2] });
    for (const side of [-1, 1]) mesh(g, G.box(0.06, 1.3, 0.45), 0x8a5a35, { p: [side * 0.57, 0.65, 0] });
    for (const y of [0.02, 1.28]) mesh(g, G.box(1.2, 0.05, 0.45), 0x8a5a35, { p: [0, y, 0] });
    const colors = [0xe2574c, 0x4a9bd8, 0xf2b23e, 0x5fae57, 0x9a6bd1, 0xf08fb0];
    for (const y of [0.2, 0.6, 1.0]) {
      mesh(g, G.box(1.1, 0.04, 0.42), 0x8a5a35, { p: [0, y - 0.13, 0] });
      for (let i = 0; i < 8; i++) mesh(g, G.box(0.1, 0.24 + (i % 3) * 0.03, 0.3), colors[(i + Math.round(y * 5)) % colors.length], { p: [-0.45 + i * 0.12, y, 0.02], cast: false });
    }
  },
  fridge(g) {
    mesh(g, G.box(0.7, 1.6, 0.6), 0xe2574c, { p: [0, 0.8, 0] });
    mesh(g, G.box(0.58, 1.2, 0.02), new THREE.MeshToonMaterial({ color: 0xcfefff, transparent: true, opacity: 0.35 }), { p: [0, 0.85, 0.37], cast: false });
    for (const y of [0.45, 0.8, 1.15]) for (let i = 0; i < 4; i++) mesh(g, G.cyl(0.04, 0.04, 0.2, 8), [0x3fb6a8, 0xf2b23e, 0x5fae57, 0xf47b3c][i], { p: [-0.2 + i * 0.13, y, 0.33], cast: false });
    mesh(g, G.box(0.6, 0.18, 0.02), 0xffffff, { p: [0, 1.5, 0.31] });
    for (const y of [0.33, 0.68, 1.03]) mesh(g, G.box(0.6, 0.03, 0.1), 0xdddddd, { p: [0, y, 0.33], cast: false }); // kệ trong tủ
  },
  chalk(g) {
    for (const side of [-1, 1]) mesh(g, G.box(0.05, 1.0, 0.05), 0x8a5a35, { p: [side * 0.32, 0.5, 0], r: [0.12, 0, 0] });
    const board = group(g, { p: [0, 0.72, 0.05], r: [-0.12, 0, 0] });
    mesh(board, G.box(0.72, 0.6, 0.04), 0x8a5a35);
    mesh(board, G.box(0.64, 0.52, 0.05), 0x2f4f45);
    const text = signText('Món ngon', '#fffaf1', 0.6, 0.18);
    text.position.set(0, 0.12, 0.03);
    board.add(text);
    const text2 = signText('hôm nay ♥', '#f6d33c', 0.6, 0.18);
    text2.position.set(0, -0.1, 0.03);
    board.add(text2);
  },
  owl(g) {
    mesh(g, G.cyl(0.18, 0.2, 0.2, 10), 0x7a4f33, { p: [0, 0.1, 0] });
    mesh(g, G.sphere(0.2, 12, 10), 0xb9733f, { p: [0, 0.42, 0], s: [1, 1.3, 0.9] });
    for (const side of [-1, 1]) {
      mesh(g, G.sphere(0.07, 10, 8), 0xf3dcb4, { p: [side * 0.08, 0.55, 0.14] });
      mesh(g, G.sphere(0.035, 8, 6), 0x2a1f1a, { p: [side * 0.08, 0.55, 0.2], cast: false });
      mesh(g, G.cone(0.04, 0.1, 4), 0xb9733f, { p: [side * 0.12, 0.72, 0] });
    }
    mesh(g, G.cone(0.03, 0.07, 4), 0xf2b23e, { p: [0, 0.48, 0.19], r: [Math.PI, 0, 0] });
  },
  orchid(g) {
    pot(g, 0.16, 0.26, 0xf4f1e8);
    for (const side of [-1, 1]) mesh(g, G.sphere(0.12, 8, 6), 0x3f8f3f, { p: [side * 0.1, 0.32, 0], s: [1.4, 0.3, 0.6], r: [0, 0, side * 0.3] });
    mesh(g, G.cyl(0.012, 0.012, 0.6, 5), 0x5fae57, { p: [0.02, 0.6, 0], r: [0, 0, -0.15] });
    for (let i = 0; i < 5; i++) mesh(g, G.sphere(0.06, 8, 6), i % 2 ? 0xf6b3e0 : 0xd96fb5, { p: [0.08 + i * 0.03, 0.75 + i * 0.05 - (i > 2 ? 0.1 : 0), 0.05], s: [1, 0.6, 1] });
  },
  birdcage(g) {
    mesh(g, G.cyl(0.03, 0.03, 0.8, 6), 0x5a3b2a, { p: [0, 0.4, 0] });
    mesh(g, G.cyl(0.16, 0.18, 0.04, 12), 0x5a3b2a, { p: [0, 0.02, 0] });
    const cage = group(g, { p: [0, 0.82, 0] });
    mesh(cage, G.cyl(0.2, 0.2, 0.03, 14), 0xb08d57);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      mesh(cage, G.cyl(0.006, 0.006, 0.4, 4), 0xb08d57, { p: [Math.cos(a) * 0.19, 0.2, Math.sin(a) * 0.19], cast: false });
    }
    mesh(cage, G.sphere(0.2, 14, 6), 0xb08d57, { p: [0, 0.4, 0], s: [1, 0.35, 1] });
    mesh(cage, G.sphere(0.06, 8, 6), 0xf2d03e, { p: [0, 0.17, 0], s: [1, 1, 1.3] }); // chim vàng
    mesh(cage, G.cone(0.015, 0.04, 4), 0xf28c28, { p: [0, 0.18, 0.08], r: [Math.PI / 2, 0, 0] });
  },
};

/** Dựng đồ trang trí; kiểu chưa có model thì hiện emoji. */
export function makeProp(model: string, icon: string): THREE.Group {
  const g = group(null);
  const make = MAKERS[model];
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
