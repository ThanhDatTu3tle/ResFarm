import * as THREE from 'three';
import { clam, halfShell, razorClam, snailShell } from './ingredients';
import { G, group, mesh, seeded, toon, type Place } from './toon';

/** Các model dùng chung giữa nhiều khu: người, cây, con vật, rau củ. Mọi model nhìn về +z, chân ở y = 0. */

// ---------- Người: xem person.ts (dựng người, tóc, dáng, cử động) ----------
export * from './person';

/** Chớp mắt / vẫy đuôi cho con vật: model nào gắn `userData.eyes` / `userData.tail` thì được cử động. */
export function animateCreature(g: THREE.Object3D, t: number, phase: number): void {
  const eyes = g.userData.eyes as THREE.Object3D[] | undefined;
  if (eyes) {
    const blink = (t * 1.1 + phase) % 4.2 < 0.12;
    for (const e of eyes) e.scale.y = blink ? 0.15 : 1;
  }
  const tail = g.userData.tail as THREE.Object3D | undefined;
  if (tail) tail.rotation.z = Math.sin(t * 5 + phase) * 0.4;
}

// ---------- Cây cối, hàng rào ----------

let treeSeed = 1;

/** Màu lá đậm / nhạt hơn để tán có khối sáng tối (vẫn là sắc xanh nên paintSeason đổi màu theo mùa được). */
function shade(hex: number, k: number): number {
  return new THREE.Color(hex).multiplyScalar(k).getHex();
}

/**
 * Cây tán tròn: thân thuôn có rễ loe + chạc cành, tán gồm nhiều cụm lá to nhỏ khác nhau (mỗi cây một dáng),
 * cụm dưới sẫm, cụm đỉnh sáng cho ra khối. userData.sway đánh dấu để khu vực cho đung đưa theo gió.
 */
export function makeTree(parent: THREE.Object3D, o: Place, leaf = 0x5fae57): THREE.Group {
  const rnd = seeded(treeSeed++ * 97 + 3);
  const g = group(parent, o);
  const bark = 0x8a5a3a;
  mesh(g, G.cyl(0.13, 0.2, 1.15, 7), bark, { p: [0, 0.575, 0] });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rnd();
    mesh(g, G.box(0.09, 0.08, 0.26), bark, { p: [Math.cos(a) * 0.15, 0.04, Math.sin(a) * 0.15], r: [0, -a + Math.PI / 2, 0], cast: false }); // rễ loe
  }
  const fork = rnd() < 0.5 ? -1 : 1;
  mesh(g, G.cyl(0.05, 0.08, 0.5, 6), bark, { p: [fork * 0.16, 1.0, 0], r: [0, 0, -fork * 0.7] });
  const crown = group(g, { p: [0, 1.1, 0] });
  mesh(crown, G.ico(0.72, 1), leaf, { p: [0, 0.58, 0] });
  mesh(crown, G.ico(0.55, 1), shade(leaf, 0.82), { p: [0, 0.18, 0.05] }); // cụm dưới sẫm
  const n = 3 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.8;
    const r = [0.42, 0.48, 0.52][Math.floor(rnd() * 3)];
    mesh(crown, G.ico(r, 1), i % 2 ? leaf : shade(leaf, 0.9), { p: [Math.cos(a) * 0.48, 0.3 + rnd() * 0.25, Math.sin(a) * 0.42] });
  }
  mesh(crown, G.ico(0.34, 1), shade(leaf, 1.15), { p: [0.1, 1.02, 0.12] }); // đỉnh đón nắng
  crown.userData.sway = Math.random() * 6;
  return g;
}

/** Bụi cây: 3–4 cụm lá to nhỏ, khoảng một nửa số bụi có hoa nhỏ (trắng / hồng / vàng) điểm trên mặt. */
export function makeBush(parent: THREE.Object3D, o: Place, leaf = 0x6fbf5f): THREE.Group {
  const rnd = seeded(treeSeed++ * 61 + 11);
  const g = group(parent, o);
  mesh(g, G.ico(0.4, 1), leaf, { p: [0, 0.3, 0] });
  mesh(g, G.ico(0.28, 1), shade(leaf, 0.85), { p: [0.32, 0.2, 0.05] });
  mesh(g, G.ico(0.26, 1), shade(leaf, 1.1), { p: [-0.28, 0.22, 0.1] });
  if (rnd() < 0.5) mesh(g, G.ico(0.22, 1), leaf, { p: [0.05, 0.18, -0.3] });
  if (rnd() < 0.55) {
    const bloom = [0xffffff, 0xf08fb0, 0xf2d24e][Math.floor(rnd() * 3)];
    for (let i = 0; i < 7; i++) {
      const a = rnd() * Math.PI * 2;
      const up = 0.3 + rnd() * 0.9;
      mesh(g, G.sphere(0.045, 6, 5), bloom, { p: [Math.cos(a) * Math.cos(up) * 0.4, 0.3 + Math.sin(up) * 0.4, Math.sin(a) * Math.cos(up) * 0.4], cast: false });
    }
  }
  return g;
}

/** Hàng rào gỗ từ (x1,z1) tới (x2,z2). */
export function makeFence(parent: THREE.Object3D, x1: number, z1: number, x2: number, z2: number, color = 0xc98b4f): void {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const angle = Math.atan2(x2 - x1, z2 - z1);
  const g = group(parent, { p: [(x1 + x2) / 2, 0, (z1 + z2) / 2], r: [0, angle, 0] });
  const posts = Math.max(2, Math.round(len / 0.9) + 1);
  for (let i = 0; i < posts; i++) mesh(g, G.box(0.1, 0.6, 0.1), color, { p: [0, 0.3, -len / 2 + (len * i) / (posts - 1)] });
  for (const y of [0.25, 0.48]) mesh(g, G.box(0.05, 0.07, 1), color, { p: [0, y, 0], s: [1, 1, len] });
}

// ---------- Rau củ trên ruộng ----------

type CropStyle = { shape: 'ball' | 'bush' | 'stalk' | 'root'; leaf: number; fruit?: number };

/** Hình cho từng producer trồng trên ruộng; id lạ dùng kiểu mặc định (bụi xanh). */
const CROPS: Record<string, CropStyle> = {
  cabbage: { shape: 'ball', leaf: 0x9bd65a },
  tomato: { shape: 'bush', leaf: 0x4f9e4a, fruit: 0xe5463c },
  chili: { shape: 'bush', leaf: 0x4f9e4a, fruit: 0xd92b2b },
  potato: { shape: 'bush', leaf: 0x6aa84f, fruit: 0xb98a55 },
  onion: { shape: 'stalk', leaf: 0x7cc35c, fruit: 0xe3b5d6 },
  carrot: { shape: 'root', leaf: 0x58b04f, fruit: 0xf28c28 },
  cucumber: { shape: 'bush', leaf: 0x5fae57, fruit: 0x3f7a35 },
};

/** Giai đoạn lớn của cây: 0 = mầm, 1 = cây non (chưa có quả), 2 = trưởng thành. */
export type CropStage = 0 | 1 | 2;

/** Đổi tỉ lệ lớn (0..1) của lứa đầu sang giai đoạn hiển thị. */
/** Giống này có model cây riêng trong CROPS (không có thì nông trại hiện bụi xanh chung / emoji). */
export function hasCropModel(producerId: string): boolean {
  return producerId in CROPS;
}

export function cropStageOf(frac: number): CropStage {
  return frac < 0.3 ? 0 : frac < 0.7 ? 1 : 2;
}

export function makeCrop(producerId: string, stage: CropStage = 2): THREE.Group {
  const style = CROPS[producerId] ?? { shape: 'bush', leaf: 0x6fbf5f };
  const g = group(null);
  if (stage === 0) {
    // Mầm: thân nhỏ + hai lá mầm xoè hai bên
    mesh(g, G.cyl(0.018, 0.022, 0.14, 5), 0x7cc35c, { p: [0, 0.07, 0] });
    for (const side of [-1, 1]) mesh(g, G.sphere(0.07, 8, 6), style.leaf, { p: [side * 0.07, 0.15, 0], r: [0, 0, side * -0.5], s: [1, 0.35, 0.65] });
    return g;
  }
  if (stage === 1) {
    // Cây non: dáng của loài nhưng nhỏ, chưa có quả/củ
    switch (style.shape) {
      case 'ball':
        for (let i = 0; i < 4; i++) mesh(g, G.sphere(0.11, 8, 6), style.leaf, { p: [Math.cos(i * 1.57) * 0.08, 0.1, Math.sin(i * 1.57) * 0.08], r: [Math.sin(i * 1.57) * 0.6, 0, -Math.cos(i * 1.57) * 0.6], s: [1, 0.45, 1] });
        break;
      case 'stalk':
      case 'root':
        for (const [x, z, tilt] of [[0, 0, 0], [0.05, 0.03, 0.4], [-0.05, -0.02, -0.4]]) mesh(g, G.cone(0.035, 0.32, 6), style.leaf, { p: [x, 0.16, z], r: [0, 0, -tilt] });
        break;
      default:
        mesh(g, G.cyl(0.025, 0.03, 0.2, 6), 0x7a5a3a, { p: [0, 0.1, 0] });
        mesh(g, G.ico(0.18, 1), style.leaf, { p: [0, 0.27, 0] });
    }
    return g;
  }
  switch (style.shape) {
    case 'ball':
      mesh(g, G.ico(0.3, 1), style.leaf, { p: [0, 0.22, 0], s: [1, 0.8, 1] });
      mesh(g, G.ico(0.18, 1), 0xc9ec8f, { p: [0, 0.34, 0] });
      break;
    case 'stalk':
      mesh(g, G.sphere(0.13, 10, 8), style.fruit!, { p: [0, 0.1, 0] });
      for (const [x, z, tilt] of [[0, 0, 0], [0.06, 0.03, 0.3], [-0.06, -0.02, -0.3]]) mesh(g, G.cone(0.04, 0.5, 6), style.leaf, { p: [x, 0.42, z], r: [0, 0, -tilt] });
      break;
    case 'root':
      mesh(g, G.cone(0.1, 0.22, 8), style.fruit!, { p: [0, 0.08, 0], r: [Math.PI, 0, 0] });
      for (const [x, z, tilt] of [[0, 0, 0], [0.08, 0.04, 0.5], [-0.08, -0.03, -0.5], [0.02, -0.08, 0.2]]) mesh(g, G.cone(0.07, 0.4, 6), style.leaf, { p: [x, 0.36, z], r: [0, 0, -tilt] });
      break;
    default:
      mesh(g, G.cyl(0.03, 0.04, 0.3, 6), 0x7a5a3a, { p: [0, 0.15, 0] });
      mesh(g, G.ico(0.26, 1), style.leaf, { p: [0, 0.4, 0] });
      if (style.fruit) {
        for (const [x, y, z] of [[0.2, 0.42, 0.12], [-0.18, 0.34, 0.14], [0.02, 0.56, 0.18], [-0.05, 0.3, -0.22]]) mesh(g, G.sphere(0.075, 8, 6), style.fruit, { p: [x, y, z] });
      }
  }
  return g;
}

// ---------- Con vật ----------

function makeChicken(body: number, size = 1): THREE.Group {
  const g = group(null, { s: size });
  mesh(g, G.sphere(0.22), body, { p: [0, 0.3, 0], s: [1, 0.9, 1.2] });
  mesh(g, G.sphere(0.13), body, { p: [0, 0.52, 0.2] });
  mesh(g, G.cone(0.05, 0.12, 6), 0xf2a23a, { p: [0, 0.5, 0.36], r: [Math.PI / 2, 0, 0] });
  mesh(g, G.sphere(0.06, 8, 6), 0xe2463c, { p: [0, 0.66, 0.2], s: [0.6, 1, 1.2] });
  mesh(g, G.cone(0.12, 0.25, 6), body, { p: [0, 0.42, -0.28], r: [-0.9, 0, 0] });
  g.userData.eyes = [];
  for (const side of [-1, 1]) {
    mesh(g, G.cyl(0.02, 0.02, 0.14, 5), 0xf2a23a, { p: [side * 0.08, 0.07, 0] });
    g.userData.eyes.push(mesh(g, G.sphere(0.03, 8, 6), 0x2a1f1a, { p: [side * 0.085, 0.56, 0.28], cast: false }));
    mesh(g, G.sphere(0.025, 6, 5), 0xffb3b3, { p: [side * 0.1, 0.5, 0.27], cast: false }); // má hồng
  }
  return g;
}

function makeCow(base: number, patch: number): THREE.Group {
  const g = group(null);
  mesh(g, G.sphere(0.42), base, { p: [0, 0.68, 0], s: [0.85, 0.8, 1.35] });
  mesh(g, G.sphere(0.2), patch, { p: [0.22, 0.82, -0.15], s: [0.7, 0.7, 1.1] });
  mesh(g, G.sphere(0.17), patch, { p: [-0.25, 0.72, 0.2], s: [0.6, 0.8, 1] });
  mesh(g, G.sphere(0.24), base, { p: [0, 0.95, 0.62] });
  mesh(g, G.sphere(0.15), 0xf7b9b0, { p: [0, 0.87, 0.8], s: [1.1, 0.8, 0.8] });
  for (const side of [-1, 1]) {
    mesh(g, G.cone(0.05, 0.16, 6), 0xf3e9d2, { p: [side * 0.15, 1.2, 0.58], r: [0, 0, -side * 0.5] });
    mesh(g, G.sphere(0.08, 8, 6), patch, { p: [side * 0.27, 1.02, 0.56], s: [1.3, 0.7, 0.5] });
    (g.userData.eyes ??= []).push(mesh(g, G.sphere(0.04, 8, 6), 0x2a1f1a, { p: [side * 0.12, 1.02, 0.8], cast: false }));
    for (const z of [-0.33, 0.33]) mesh(g, G.cyl(0.07, 0.06, 0.42, 7), base, { p: [side * 0.2, 0.21, z] });
  }
  const tail = group(g, { p: [0, 0.8, -0.55] });
  mesh(tail, G.cyl(0.02, 0.02, 0.4, 5), patch, { p: [0, -0.18, -0.05], r: [0.3, 0, 0] });
  mesh(tail, G.sphere(0.05, 6, 5), patch, { p: [0, -0.38, -0.1] });
  g.userData.tail = tail;
  return g;
}

function makePig(): THREE.Group {
  const pink = 0xf6a6b6;
  const g = group(null);
  mesh(g, G.sphere(0.34), pink, { p: [0, 0.42, 0], s: [0.95, 0.85, 1.25] });
  mesh(g, G.sphere(0.22), pink, { p: [0, 0.52, 0.42] });
  mesh(g, G.cyl(0.09, 0.09, 0.08, 10), 0xe88a9d, { p: [0, 0.5, 0.63], r: [Math.PI / 2, 0, 0] });
  g.userData.tail = mesh(g, G.torus(0.06, 0.02, 6, 10), 0xe88a9d, { p: [0, 0.5, -0.45] });
  for (const side of [-1, 1]) {
    mesh(g, G.cone(0.07, 0.12, 5), 0xe88a9d, { p: [side * 0.13, 0.72, 0.4], r: [0.3, 0, -side * 0.4] });
    (g.userData.eyes ??= []).push(mesh(g, G.sphere(0.035, 8, 6), 0x2a1f1a, { p: [side * 0.1, 0.6, 0.58], cast: false }));
    for (const z of [-0.22, 0.22]) mesh(g, G.cyl(0.06, 0.05, 0.2, 7), pink, { p: [side * 0.16, 0.1, z] });
  }
  return g;
}

function makeFish(color: number): THREE.Group {
  const g = group(null);
  mesh(g, G.sphere(0.16), color, { s: [0.6, 0.9, 1.5] });
  mesh(g, G.cone(0.12, 0.2, 4), color, { p: [0, 0, -0.3], r: [Math.PI / 2, 0, 0], s: [0.4, 1, 1] });
  g.userData.eyes = [-1, 1].map((side) => mesh(g, G.sphere(0.03, 6, 5), 0x2a1f1a, { p: [side * 0.08, 0.04, 0.14], cast: false }));
  return g;
}

/** Model + số con cho từng producer nuôi trong chuồng/ao. Id lạ trả null (khu nông trại sẽ hiện emoji thay thế). */
const ANIMALS: Record<string, { count: number; make: () => THREE.Group }> = {
  hen: { count: 3, make: () => makeChicken(0xffffff) },
  broiler: { count: 4, make: () => makeChicken(0xf7d354, 0.75) },
  pig: { count: 2, make: makePig },
  dairy_cow: { count: 1, make: () => makeCow(0xffffff, 0x3a3a3a) },
  cattle: { count: 1, make: () => makeCow(0xb5733c, 0x8a5226) },
  fish_fry: { count: 3, make: () => makeFish(0xf2913d) },
  shrimp_fry: { count: 4, make: () => makeFish(0xf4978e) },
  salmon_fry: { count: 3, make: () => makeFish(0xf28c5a) },
  // Ốc / sò / nghêu / hàu giống: dùng chung vỏ với nguyên liệu, phóng to cho thấy rõ trong ao
  oc_huong_fry: { count: 4, make: () => shellfish((g) => snailShell(g, 0xf3dcb4, 0xc98a4f, 1, 1.3)) },
  oc_mong_tay_fry: { count: 4, make: () => shellfish((g) => razorClam(g)) },
  so_diep_fry: { count: 4, make: () => shellfish((g) => halfShell(g, 'scallop')) },
  ngheu_fry: { count: 4, make: () => shellfish((g) => clam(g)) },
  hau_fry: { count: 4, make: () => shellfish((g) => halfShell(g, 'oyster')) },
  oc_bu_fry: { count: 4, make: () => shellfish((g) => snailShell(g, 0x5a5a3a, 0x3b3a2a, 1.2, 0.8)) },
};

/** Con giống có vỏ trong ao: vỏ phóng to 2.2 lần. */
function shellfish(build: (g: THREE.Group) => unknown): THREE.Group {
  const g = group(null);
  build(group(g, { s: 2.2 }));
  g.userData.shell = true; // ao cho bò chậm, không nhảy như cá
  return g;
}

export function makeAnimals(producerId: string): THREE.Group[] | null {
  const def = ANIMALS[producerId];
  return def ? Array.from({ length: def.count }, def.make) : null;
}

// ---------- Món ăn trên đĩa ----------
// Kích thước theo đĩa trong quán: bán kính đĩa 0.2, món nằm gọn trong bán kính ~0.16, cao ≤ 0.16. Gốc ở mặt đĩa.

const RICE = 0xfbf6ea;
const EGG_WHITE = 0xffffff;
const YOLK = 0xffc93c;

function bowl(g: THREE.Group, soup: number, rim = 0xf3e9d2, r = 0.15): void {
  mesh(g, G.cyl(r, r * 0.65, 0.1, 16), rim, { p: [0, 0.05, 0] });
  mesh(g, G.cyl(r * 0.88, r * 0.88, 0.01, 16), soup, { p: [0, 0.095, 0], cast: false });
}

function friedEgg(g: THREE.Group, x: number, y: number, z: number, s = 1): void {
  mesh(g, G.sphere(0.08, 12, 6), EGG_WHITE, { p: [x, y, z], s: [s, 0.18 * s, s * 0.9], cast: false });
  mesh(g, G.sphere(0.035, 10, 8), YOLK, { p: [x + 0.01, y + 0.015, z], s: [1, 0.7, 1], cast: false });
}

function halfEgg(g: THREE.Group, x: number, y: number, z: number): void {
  mesh(g, G.sphere(0.045, 10, 8), EGG_WHITE, { p: [x, y, z], s: [1, 0.75, 1.2] });
  mesh(g, G.sphere(0.024, 8, 6), YOLK, { p: [x, y + 0.03, z], s: [1, 0.4, 1], cast: false });
}

const glassy = (c: number, o = 0.7) => toon(c, { transparent: true, opacity: o });

function riceMound(g: THREE.Group, x = 0, z = 0): void {
  mesh(g, G.sphere(0.1, 14, 10), RICE, { p: [x, 0.02, z], s: [1.1, 0.75, 1] });
}

/** Model món theo recipeId; id chưa có trả null → quán hiện emoji của món như cũ. */
const DISHES: Record<string, (g: THREE.Group) => void> = {
  egg_rice: (g) => {
    riceMound(g);
    friedEgg(g, 0.01, 0.095, 0.01, 0.95);
  },
  stir_cabbage: (g) => {
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      const r = i === 0 ? 0 : 0.08;
      mesh(g, G.ico(0.055, 0), i % 3 ? 0x7cc35c : 0xb6e07a, { p: [Math.cos(a) * r, 0.03 + (i === 0 ? 0.03 : 0), Math.sin(a) * r], s: [1, 0.5, 1], r: [a, a, 0] });
    }
    for (const [x, z] of [[0.05, -0.03], [-0.06, 0.04]]) mesh(g, G.sphere(0.015, 6, 5), 0xfff3d6, { p: [x, 0.07, z], cast: false });
  },
  tomato_soup: (g) => {
    bowl(g, 0xf06d4f);
    for (const [x, z] of [[0.04, 0.02], [-0.05, -0.03], [0.0, -0.06]]) mesh(g, G.sphere(0.03, 8, 6), 0xffe08a, { p: [x, 0.1, z], s: [1.2, 0.35, 0.9], cast: false });
    mesh(g, G.sphere(0.03, 8, 6), 0xe5463c, { p: [-0.03, 0.1, 0.05], s: [1, 0.4, 1], cast: false });
  },
  chicken_rice: (g) => {
    riceMound(g, -0.04, 0);
    for (const [x, z, r] of [[0.07, -0.04, 0.4], [0.08, 0.04, -0.3]]) mesh(g, G.capsule(0.035, 0.07), 0xd9984f, { p: [x, 0.04, z], r: [Math.PI / 2, r, 0] });
    mesh(g, G.cone(0.025, 0.06, 5), 0x5fae57, { p: [-0.04, 0.1, 0.0] });
  },
  braised_pork: (g) => {
    bowl(g, 0x8a4a22, 0x6b3f2a);
    for (const [x, z] of [[0.05, 0.04], [-0.05, 0.03], [0.0, -0.06]]) mesh(g, G.box(0.06, 0.05, 0.06), 0xa0562a, { p: [x, 0.11, z], r: [0, x * 8, 0] });
    halfEgg(g, -0.02, 0.11, 0.0);
    halfEgg(g, 0.06, 0.11, -0.03);
  },
  flan: (g) => {
    mesh(g, G.cyl(0.08, 0.1, 0.08, 16), 0xffd36b, { p: [0, 0.04, 0] });
    mesh(g, G.cyl(0.082, 0.082, 0.018, 16), 0x9a5a1e, { p: [0, 0.088, 0] });
    mesh(g, G.cyl(0.12, 0.12, 0.006, 16), 0xb06a26, { p: [0, 0.003, 0], cast: false }); // nước đường thắng chảy ra đĩa
  },
  fried_fish: (g) => {
    mesh(g, G.cyl(0.15, 0.15, 0.006, 16), 0xe5463c, { p: [0, 0.003, 0], s: [1, 1, 0.75], cast: false }); // sốt cà
    const fish = group(g, { p: [0.01, 0.04, 0], r: [0, 0.3, 0] });
    mesh(fish, G.sphere(0.06, 12, 8), 0xe0a040, { s: [2, 0.7, 1] });
    mesh(fish, G.cone(0.05, 0.07, 4), 0xc98330, { p: [-0.14, 0, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.35] });
    mesh(fish, G.sphere(0.012, 6, 5), 0x2a1f1a, { p: [0.09, 0.02, 0.035], cast: false });
    mesh(g, G.cone(0.02, 0.05, 5), 0x5fae57, { p: [-0.05, 0.08, 0.05] });
  },
  pho: (g) => {
    bowl(g, 0xf3d9a4, 0xffffff, 0.16);
    for (let i = 0; i < 3; i++) mesh(g, G.torus(0.04 + i * 0.025, 0.007, 4, 18), 0xfffaf0, { p: [0.01, 0.1, 0], r: [Math.PI / 2, 0, 0], cast: false }); // bánh phở
    for (const [x, z, r] of [[0.05, -0.04, 0.3], [-0.04, -0.05, -0.4], [0.0, 0.06, 1]]) mesh(g, G.box(0.07, 0.008, 0.045), 0xb5674a, { p: [x, 0.106, z], r: [0, r, 0], cast: false }); // thịt bò
    for (const [x, z] of [[-0.06, 0.04], [0.07, 0.04]]) mesh(g, G.sphere(0.022, 6, 5), 0x5fae57, { p: [x, 0.108, z], s: [1, 0.4, 1], cast: false }); // rau thơm
  },
  chili_shrimp: (g) => {
    for (const [x, z, r] of [[0.05, 0.03, 0.4], [-0.05, 0.04, 2.3], [0.0, -0.05, -1.2]]) {
      mesh(g, G.torus(0.04, 0.02, 6, 10, Math.PI * 1.3), 0xf2723a, { p: [x, 0.03, z], r: [Math.PI / 2, 0, r] });
    }
    for (const [x, z] of [[0.0, 0.0], [0.07, -0.05], [-0.07, -0.02]]) mesh(g, G.sphere(0.012, 6, 5), 0xd92b2b, { p: [x, 0.05, z], cast: false });
  },
  stir_squid: (g) => {
    for (const [x, z] of [[0.05, 0.03], [-0.05, 0.04], [0.0, -0.05], [-0.02, 0.0]]) mesh(g, G.torus(0.03, 0.012, 6, 12), 0xfaf0e6, { p: [x, 0.02, z], r: [Math.PI / 2 - 0.3, 0, x * 9] });
    for (const [x, z] of [[0.06, -0.03], [-0.06, -0.03], [0.02, 0.07]]) mesh(g, G.box(0.03, 0.012, 0.012), 0xd92b2b, { p: [x, 0.03, z], r: [0, x * 20, 0] });
    mesh(g, G.cone(0.02, 0.05, 5), 0x5fae57, { p: [0.0, 0.05, 0.03] });
  },
  chicken_curry: (g) => {
    bowl(g, 0xf0a63a);
    for (const [x, z] of [[0.05, 0.03], [-0.05, -0.02]]) mesh(g, G.box(0.045, 0.04, 0.045), 0xf3dc9a, { p: [x, 0.105, z], r: [0, x * 10, 0] }); // khoai
    mesh(g, G.cyl(0.022, 0.022, 0.015, 10), 0xf28c28, { p: [0.0, 0.105, -0.06] }); // cà rốt
    mesh(g, G.capsule(0.025, 0.04), 0xd9984f, { p: [-0.02, 0.105, 0.06], r: [Math.PI / 2, 0, 0.8] }); // gà
  },
  shaking_beef: (g) => {
    for (const [x, z] of [[0.04, 0.03], [-0.04, 0.04], [0.0, -0.04], [0.06, -0.04], [-0.06, -0.03]]) mesh(g, G.box(0.05, 0.045, 0.05), 0x7a3e22, { p: [x, 0.025, z], r: [0, x * 12, 0] });
    mesh(g, G.box(0.04, 0.012, 0.03), 0x5fae57, { p: [0.0, 0.06, 0.01] });
    mesh(g, G.box(0.04, 0.012, 0.03), 0xe5463c, { p: [0.05, 0.055, -0.01], r: [0, 0.6, 0] });
    mesh(g, G.torus(0.03, 0.006, 4, 12), 0xf0e3f0, { p: [-0.04, 0.055, 0.0], r: [Math.PI / 2, 0, 0], cast: false }); // hành tây
  },

  // ----- Quán Việt (thêm ở Giai đoạn 2) -----
  com_tam: (g) => {
    riceMound(g, -0.05, 0.02);
    mesh(g, G.box(0.11, 0.025, 0.07), 0x9a4a22, { p: [0.06, 0.02, -0.02], r: [0, 0.4, 0] }); // sườn nướng
    for (const x of [0.03, 0.06, 0.09]) mesh(g, G.box(0.006, 0.03, 0.06), 0x6b2f16, { p: [x, 0.035, -0.02], r: [0, 0.4, 0], cast: false });
    friedEgg(g, 0.0, 0.03, 0.08, 0.6);
    for (const [x, z] of [[-0.1, -0.07], [-0.07, -0.09]]) mesh(g, G.cyl(0.02, 0.02, 0.008, 10), 0x9fd07a, { p: [x, 0.006, z], cast: false }); // dưa leo
  },
  hu_tieu: (g) => {
    bowl(g, 0xf3e3b8, 0xffffff, 0.16);
    for (let i = 0; i < 3; i++) mesh(g, G.torus(0.035 + i * 0.025, 0.006, 4, 18), 0xfffaf0, { p: [0, 0.1, 0], r: [Math.PI / 2, 0, 0], cast: false });
    for (const [x, z, r] of [[0.05, -0.04, 0.4], [-0.06, 0.02, 2.4]]) mesh(g, G.torus(0.025, 0.012, 6, 10, Math.PI * 1.3), 0xf2723a, { p: [x, 0.11, z], r: [Math.PI / 2, 0, r] }); // tôm
    mesh(g, G.box(0.06, 0.008, 0.04), 0xe0a07a, { p: [0.0, 0.106, 0.06], cast: false }); // thịt
    mesh(g, G.sphere(0.02, 6, 5), 0x5fae57, { p: [-0.03, 0.108, -0.06], s: [1, 0.4, 1], cast: false });
  },
  bun_bo: (g) => {
    bowl(g, 0xe0662f, 0xffffff, 0.16);
    for (let i = 0; i < 3; i++) mesh(g, G.torus(0.04 + i * 0.022, 0.006, 4, 18), 0xfffaf0, { p: [0, 0.1, 0], r: [Math.PI / 2, 0, 0], cast: false });
    for (const [x, z, r] of [[0.05, -0.04, 0.3], [-0.05, -0.04, -0.4]]) mesh(g, G.box(0.06, 0.008, 0.045), 0x8a3f22, { p: [x, 0.106, z], r: [0, r, 0], cast: false });
    for (const [x, z] of [[0.0, 0.06], [0.06, 0.04]]) mesh(g, G.torus(0.012, 0.004, 4, 8), 0xd92b2b, { p: [x, 0.108, z], r: [Math.PI / 2, 0, 0], cast: false }); // ớt
  },
  com_gia_dinh: (g) => {
    mesh(g, G.cyl(0.05, 0.035, 0.05, 12), 0xffffff, { p: [-0.07, 0.025, 0.05] });
    mesh(g, G.sphere(0.045, 10, 8), RICE, { p: [-0.07, 0.05, 0.05], s: [1, 0.5, 1] });
    mesh(g, G.cyl(0.055, 0.04, 0.05, 12), 0xffffff, { p: [0.07, 0.025, 0.05] });
    mesh(g, G.cyl(0.048, 0.048, 0.005, 12), 0xf06d4f, { p: [0.07, 0.05, 0.05], cast: false }); // canh
    mesh(g, G.cyl(0.07, 0.07, 0.012, 14), 0xffffff, { p: [0, 0.006, -0.06] });
    for (const [x, z] of [[-0.02, -0.06], [0.025, -0.05]]) mesh(g, G.box(0.035, 0.03, 0.035), 0xa0562a, { p: [x, 0.03, z] }); // thịt kho
    mesh(g, G.ico(0.03, 0), 0x7cc35c, { p: [0.0, 0.03, -0.09], s: [1.3, 0.5, 1] }); // rau xào
  },

  banh_mi: (g) => {
    const b = group(g, { p: [0, 0.04, 0], r: [0, 0.5, 0] });
    mesh(b, G.capsule(0.045, 0.2), 0xe0a050, { r: [0, 0, Math.PI / 2] }); // ổ bánh mì
    mesh(b, G.box(0.2, 0.025, 0.05), 0xd98a6a, { p: [0, 0.02, 0.012], cast: false }); // thịt
    mesh(b, G.box(0.18, 0.012, 0.052), 0x7cc35c, { p: [0, 0.04, 0.012], cast: false }); // dưa leo, rau
    for (const x of [-0.06, 0.02, 0.08]) mesh(b, G.box(0.02, 0.006, 0.05), 0xc78a30, { p: [x, 0.047, 0], r: [0, 0.6, 0], cast: false }); // vết khía
  },

  // ----- Quán Nhật -----
  katsu_sando: (g) => {
    for (const [x, r] of [[-0.05, 0.3], [0.06, -0.4]]) {
      const s = group(g, { p: [x, 0, 0], r: [0, r, 0] });
      mesh(s, G.box(0.1, 0.022, 0.1), 0xfff3d6, { p: [0, 0.012, 0] });
      mesh(s, G.box(0.1, 0.03, 0.1), 0xd9984f, { p: [0, 0.038, 0] }); // heo chiên xù
      mesh(s, G.box(0.1, 0.008, 0.1), 0x7cc35c, { p: [0, 0.057, 0], cast: false });
      mesh(s, G.box(0.1, 0.022, 0.1), 0xfff3d6, { p: [0, 0.072, 0] });
    }
  },
  onigiri: (g) => {
    for (const [x, r] of [[-0.06, 0.3], [0.06, -0.3]]) {
      const o = group(g, { p: [x, 0, 0], r: [0, r, 0] });
      mesh(o, G.prism(), 0xf3ecd8, { s: [0.12, 0.11, 0.05] }); // nắm cơm tam giác đứng (ngả kem cho khỏi lẫn vào đĩa trắng)
      mesh(o, G.box(0.07, 0.055, 0.056), 0x1f2a1f, { p: [0, 0.027, 0] }); // rong biển quấn đáy
      for (const [px, py] of [[-0.015, 0.075], [0.012, 0.068], [0.0, 0.085]]) mesh(o, G.sphere(0.005, 4, 4), 0x2a1f1a, { p: [px, py, 0.026], cast: false }); // mè đen
    }
  },
  tamagoyaki: (g) => {
    for (const x of [-0.06, 0, 0.06]) {
      mesh(g, G.box(0.05, 0.045, 0.07), 0xffd34e, { p: [x, 0.023, 0] });
      mesh(g, G.box(0.051, 0.006, 0.071), 0xe8a92a, { p: [x, 0.03, 0], cast: false });
    }
  },
  miso_soup: (g) => {
    bowl(g, 0xc9a066, 0x8a2f2a, 0.12);
    for (const [x, z] of [[0.03, 0.02], [-0.03, -0.02], [0.0, -0.04]]) mesh(g, G.box(0.022, 0.018, 0.022), 0xfffaf0, { p: [x, 0.1, z] });
    for (const [x, z] of [[-0.04, 0.03], [0.04, -0.03]]) mesh(g, G.box(0.03, 0.004, 0.012), 0x2f5a2f, { p: [x, 0.1, z], r: [0, x * 20, 0], cast: false });
  },
  maki: (g) => {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.cos(a) * 0.08;
      const z = Math.sin(a) * 0.08;
      mesh(g, G.cyl(0.032, 0.032, 0.04, 12), 0x1f2a1f, { p: [x, 0.02, z] });
      mesh(g, G.cyl(0.026, 0.026, 0.042, 12), RICE, { p: [x, 0.021, z] });
      mesh(g, G.cyl(0.011, 0.011, 0.044, 8), i % 2 ? 0xf28c5a : 0x7cc35c, { p: [x, 0.022, z] });
    }
  },
  teriyaki: (g) => {
    riceMound(g, -0.06, 0.03);
    for (const [x, z] of [[0.04, -0.03], [0.07, 0.03], [0.02, 0.05]]) mesh(g, G.box(0.05, 0.035, 0.04), 0x8a4a1e, { p: [x, 0.02, z], r: [0, x * 15, 0] });
    for (const [x, z] of [[0.05, 0.0], [0.03, 0.03]]) mesh(g, G.sphere(0.005, 4, 4), 0xfff3d6, { p: [x, 0.04, z], cast: false }); // mè
    mesh(g, G.cone(0.02, 0.05, 5), 0x5fae57, { p: [-0.02, 0.06, -0.06] });
  },
  sushi_salmon: (g) => {
    for (const x of [-0.05, 0.05]) {
      mesh(g, G.capsule(0.025, 0.06), RICE, { p: [x, 0.025, 0], r: [Math.PI / 2, 0, 0] });
      mesh(g, G.box(0.06, 0.018, 0.11), 0xf28c5a, { p: [x, 0.055, 0] });
      for (const z of [-0.03, 0, 0.03]) mesh(g, G.box(0.061, 0.019, 0.006), 0xffd2b8, { p: [x, 0.056, z], r: [0, 0.4, 0], cast: false });
    }
  },
  tempura: (g) => {
    for (const [x, z, r] of [[-0.04, 0.0, 0.3], [0.04, 0.02, -0.3], [0.0, -0.05, 1.4]]) {
      const t = group(g, { p: [x, 0.03, z], r: [0, r, 0] });
      mesh(t, G.capsule(0.028, 0.08), 0xf2c25a, { r: [0, 0, Math.PI / 2] });
      mesh(t, G.cone(0.02, 0.035, 4), 0xe5463c, { p: [0.075, 0.0, 0], r: [0, 0, -Math.PI / 2] }); // đuôi tôm
    }
  },
  ramen: (g) => {
    bowl(g, 0xe8c58a, 0x2a1f1a, 0.16);
    for (let i = 0; i < 3; i++) mesh(g, G.torus(0.04 + i * 0.022, 0.007, 4, 18), 0xf3d98a, { p: [0, 0.1, 0], r: [Math.PI / 2, 0, 0], cast: false });
    mesh(g, G.cyl(0.04, 0.04, 0.012, 14), 0xd9a07a, { p: [0.05, 0.107, -0.03] }); // chashu
    halfEgg(g, -0.05, 0.11, -0.02);
    mesh(g, G.box(0.05, 0.06, 0.004), 0x1f2a1f, { p: [0.0, 0.13, -0.1], r: [-0.3, 0, 0] }); // lá rong biển
    for (const [x, z] of [[0.0, 0.06], [0.04, 0.05]]) mesh(g, G.cyl(0.008, 0.008, 0.006, 6), 0x5fae57, { p: [x, 0.108, z], cast: false });
  },
  udon: (g) => {
    bowl(g, 0xf3e3b8, 0xd9433a, 0.15);
    for (let i = 0; i < 3; i++) mesh(g, G.torus(0.035 + i * 0.026, 0.011, 5, 18), 0xfffaf0, { p: [0, 0.1, 0], r: [Math.PI / 2, 0, 0], cast: false });
    for (const [x, z] of [[0.04, 0.03], [-0.04, -0.03]]) {
      mesh(g, G.sphere(0.02, 8, 6), 0x8a5a35, { p: [x, 0.118, z], s: [1, 0.6, 1] });
      mesh(g, G.cyl(0.007, 0.009, 0.02, 6), 0xf3e9d2, { p: [x, 0.108, z], cast: false });
    }
  },
  takoyaki: (g) => {
    mesh(g, G.box(0.24, 0.015, 0.14), 0xd9b56a, { p: [0, 0.008, 0] }); // thuyền giấy
    for (let i = 0; i < 6; i++) {
      const x = -0.07 + (i % 3) * 0.07;
      const z = i < 3 ? -0.03 : 0.03;
      mesh(g, G.sphere(0.03, 10, 8), 0xc98330, { p: [x, 0.04, z] });
      mesh(g, G.sphere(0.024, 8, 6), 0x5a2f1a, { p: [x, 0.058, z], s: [1, 0.35, 1], cast: false }); // sốt
    }
    for (const [x, z] of [[-0.03, 0.0], [0.04, -0.02]]) mesh(g, G.box(0.012, 0.004, 0.008), 0x5fae57, { p: [x, 0.075, z], cast: false });
  },
  katsudon: (g) => {
    bowl(g, RICE, 0x2a1f1a, 0.15);
    for (const x of [-0.05, 0, 0.05]) mesh(g, G.box(0.045, 0.025, 0.12), 0xd9984f, { p: [x, 0.11, 0], r: [0, 0, x * 2] });
    mesh(g, G.sphere(0.04, 10, 8), 0xffd34e, { p: [0.02, 0.12, 0.03], s: [1.4, 0.25, 1], cast: false }); // trứng
    mesh(g, G.cyl(0.008, 0.008, 0.006, 6), 0x5fae57, { p: [-0.03, 0.13, -0.03], cast: false });
  },
  sashimi: (g) => {
    mesh(g, G.cone(0.035, 0.05, 8), 0xffffff, { p: [-0.08, 0.025, 0] }); // củ cải bào
    mesh(g, G.box(0.05, 0.004, 0.05), 0x3f8f3a, { p: [-0.02, 0.012, 0], r: [0, 0.6, 0.4], cast: false }); // lá tía tô
    for (let i = 0; i < 4; i++) mesh(g, G.box(0.03, 0.025, 0.07), 0xf28c5a, { p: [0.0 + i * 0.03, 0.02, -0.04], r: [0.25, 0, 0] });
    for (let i = 0; i < 3; i++) mesh(g, G.box(0.03, 0.022, 0.07), 0xf6efe4, { p: [0.015 + i * 0.03, 0.018, 0.05], r: [0.25, 0, 0] });
  },
  gyudon: (g) => {
    bowl(g, RICE, 0x2a1f1a, 0.15);
    for (const [x, z, r] of [[0.04, 0.02, 0.4], [-0.04, 0.03, -0.5], [0.0, -0.04, 1.1], [0.05, -0.04, 2]]) mesh(g, G.box(0.06, 0.01, 0.04), 0x8a4a2a, { p: [x, 0.105, z], r: [0, r, 0], cast: false });
    mesh(g, G.torus(0.025, 0.005, 4, 12), 0xf3e9d2, { p: [-0.03, 0.11, -0.03], r: [Math.PI / 2, 0, 0], cast: false });
    mesh(g, G.box(0.03, 0.012, 0.02), 0xe5463c, { p: [0.06, 0.11, 0.06], cast: false }); // gừng hồng
  },

  // ----- Quán Hàn -----
  gilgeori_toast: (g) => {
    const t = group(g, { p: [0, 0, 0], r: [0, 0.3, 0] });
    mesh(t, G.box(0.13, 0.025, 0.13), 0xe0a050, { p: [0, 0.013, 0] });
    mesh(t, G.box(0.12, 0.03, 0.12), 0xffd34e, { p: [0, 0.04, 0] }); // trứng chiên bắp cải
    for (const [x, z] of [[-0.03, 0.02], [0.03, -0.03]]) mesh(t, G.box(0.03, 0.006, 0.01), 0x9fd07a, { p: [x, 0.057, z], cast: false });
    mesh(t, G.box(0.13, 0.025, 0.13), 0xe8b060, { p: [0, 0.068, 0] });
    mesh(t, G.box(0.08, 0.004, 0.012), 0xd9341e, { p: [0, 0.083, 0], r: [0, 0.4, 0], cast: false }); // sốt
  },
  kimbap: (g) => {
    for (let i = 0; i < 7; i++) {
      const x = -0.09 + i * 0.03;
      const s = group(g, { p: [x * 1.05, 0.016, (i % 2) * 0.012], r: [0.5, 0, 0] }); // lát nghiêng ngửa mặt cho thấy nhân
      mesh(s, G.cyl(0.034, 0.034, 0.024, 12), 0x1f2a1f);
      mesh(s, G.cyl(0.028, 0.028, 0.026, 12), RICE);
      for (const [c, dx, dz] of [[0xf28c28, -0.008, 0], [0xffd34e, 0.008, 0], [0x5fae57, 0, 0.01]] as const) mesh(s, G.box(0.008, 0.028, 0.008), c, { p: [dx, 0, dz], cast: false });
    }
  },
  kimchi: (g) => {
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      const r = i === 0 ? 0 : 0.07;
      mesh(g, G.ico(0.05, 0), i % 2 ? 0xd9542f : 0xf0a070, { p: [Math.cos(a) * r, 0.03 + (i === 0 ? 0.03 : 0), Math.sin(a) * r], s: [1, 0.55, 1], r: [a, a, 0] });
    }
  },
  gyeran_jjim: (g) => {
    mesh(g, G.cyl(0.11, 0.08, 0.08, 16), 0x3b2a2a, { p: [0, 0.04, 0] }); // nồi đất
    mesh(g, G.sphere(0.1, 14, 10), 0xffd34e, { p: [0, 0.075, 0], s: [1, 0.65, 1] });
    for (const [x, z] of [[0.02, 0.03], [-0.03, -0.01]]) mesh(g, G.box(0.02, 0.004, 0.006), 0x5fae57, { p: [x, 0.14, z], cast: false });
  },
  tteokbokki: (g) => {
    mesh(g, G.cyl(0.14, 0.14, 0.012, 16), 0xd9341e, { p: [0, 0.006, 0], cast: false }); // sốt đỏ
    for (const [x, z, r] of [[0.05, 0.03, 0.3], [-0.05, 0.04, -0.5], [0.0, -0.05, 1.2], [-0.06, -0.03, 0.9], [0.06, -0.04, -1]]) mesh(g, G.capsule(0.018, 0.05), 0xf6efe4, { p: [x, 0.03, z], r: [Math.PI / 2, 0, r] });
    mesh(g, G.box(0.05, 0.012, 0.035), 0xe0b070, { p: [0.0, 0.03, 0.02], r: [0, 0.7, 0] }); // chả cá
    for (const [x, z] of [[0.02, -0.02], [-0.02, 0.06]]) mesh(g, G.sphere(0.005, 4, 4), 0xfff3d6, { p: [x, 0.05, z], cast: false });
  },
  kr_fried_chicken: (g) => {
    for (const [x, z, c] of [[0.05, 0.03, 0xd9984f], [-0.05, 0.04, 0xc0402a], [0.0, -0.05, 0xd9984f], [-0.06, -0.04, 0xc0402a], [0.06, -0.04, 0xd9984f]] as const) {
      mesh(g, G.ico(0.045, 1), c, { p: [x, 0.04, z], s: [1, 0.8, 1] });
    }
    mesh(g, G.box(0.04, 0.03, 0.04), 0xffffff, { p: [0.0, 0.03, 0.08] }); // củ cải muối
  },
  ramyeon: (g) => {
    mesh(g, G.cyl(0.13, 0.12, 0.08, 16), 0xd4a537, { p: [0, 0.04, 0] }); // nồi nhôm vàng
    for (const sx of [-1, 1]) mesh(g, G.box(0.04, 0.012, 0.02), 0xd4a537, { p: [sx * 0.15, 0.07, 0] });
    mesh(g, G.cyl(0.115, 0.115, 0.01, 16), 0xd9542f, { p: [0, 0.078, 0], cast: false });
    for (let i = 0; i < 4; i++) mesh(g, G.torus(0.02 + i * 0.022, 0.006, 4, 14), 0xf3d98a, { p: [0.01, 0.084, 0], r: [Math.PI / 2, 0, i], cast: false });
    halfEgg(g, -0.04, 0.09, 0.03);
  },
  kimchi_stew: (g) => {
    mesh(g, G.cyl(0.13, 0.1, 0.09, 16), 0x2a2420, { p: [0, 0.045, 0] }); // nồi đá
    mesh(g, G.cyl(0.115, 0.115, 0.01, 16), 0xd9341e, { p: [0, 0.088, 0], cast: false });
    for (const [x, z] of [[0.04, 0.02], [-0.04, -0.03]]) mesh(g, G.box(0.03, 0.025, 0.03), 0xfffaf0, { p: [x, 0.095, z] });
    for (const [x, z] of [[-0.03, 0.05], [0.03, -0.05]]) mesh(g, G.ico(0.025, 0), 0xf0a070, { p: [x, 0.095, z], s: [1, 0.4, 1] });
  },
  bibimbap: (g) => {
    mesh(g, G.cyl(0.14, 0.1, 0.08, 16), 0x2a2420, { p: [0, 0.04, 0] });
    mesh(g, G.cyl(0.125, 0.125, 0.012, 16), RICE, { p: [0, 0.082, 0], cast: false });
    for (const [i, c] of [0xf28c28, 0x5fae57, 0x8a5a35, 0x7a3e22, 0xffe08a].entries()) {
      const a = (i / 5) * Math.PI * 2;
      mesh(g, G.sphere(0.035, 8, 6), c, { p: [Math.cos(a) * 0.075, 0.09, Math.sin(a) * 0.075], s: [1.2, 0.35, 1.2], cast: false });
    }
    friedEgg(g, 0, 0.095, 0, 0.55);
  },
  sundubu: (g) => {
    mesh(g, G.cyl(0.13, 0.1, 0.09, 16), 0x2a2420, { p: [0, 0.045, 0] });
    mesh(g, G.cyl(0.115, 0.115, 0.01, 16), 0xe04a2a, { p: [0, 0.088, 0], cast: false });
    mesh(g, G.sphere(0.06, 12, 8), 0xfffaf0, { p: [-0.02, 0.09, 0], s: [1.3, 0.35, 1] }); // đậu non
    mesh(g, G.sphere(0.025, 10, 8), YOLK, { p: [0.05, 0.095, 0.03], s: [1, 0.6, 1], cast: false });
    mesh(g, G.torus(0.02, 0.008, 6, 10, Math.PI * 1.3), 0xf2723a, { p: [0.04, 0.097, -0.05], r: [Math.PI / 2, 0, 0.4] });
  },
  bulgogi: (g) => {
    for (const [x, z, r] of [[0.04, 0.02, 0.4], [-0.04, 0.03, -0.5], [0.0, -0.04, 1.1], [0.05, -0.05, 2], [-0.05, -0.04, 0.2]]) mesh(g, G.box(0.07, 0.012, 0.045), 0x6b3418, { p: [x, 0.012 + Math.abs(x) * 0.1, z], r: [0.1, r, 0] });
    mesh(g, G.torus(0.03, 0.006, 4, 12), 0xf3e9d2, { p: [0.02, 0.03, 0.0], r: [Math.PI / 2, 0, 0], cast: false });
    for (const [x, z] of [[0.0, 0.02], [-0.02, -0.02], [0.03, -0.03]]) mesh(g, G.sphere(0.005, 4, 4), 0xfff3d6, { p: [x, 0.035, z], cast: false });
    mesh(g, G.box(0.04, 0.006, 0.006), 0x5fae57, { p: [-0.03, 0.035, 0.04], cast: false });
  },
  samgyeopsal: (g) => {
    for (const x of [-0.05, 0.0, 0.05]) {
      mesh(g, G.box(0.04, 0.02, 0.13), 0xd98a6a, { p: [x, 0.012, -0.02] });
      mesh(g, G.box(0.041, 0.006, 0.131), 0xfff3e6, { p: [x, 0.014, -0.02], cast: false }); // lớp mỡ
    }
    for (const [x, z] of [[-0.07, 0.08], [0.06, 0.08]]) mesh(g, G.sphere(0.045, 10, 6), 0x7cc35c, { p: [x, 0.01, z], s: [1.2, 0.2, 1] }); // xà lách
  },
  pajeon: (g) => {
    mesh(g, G.cyl(0.14, 0.14, 0.02, 20), 0xe8b45a, { p: [0, 0.012, 0] });
    for (let i = 0; i < 5; i++) mesh(g, G.box(0.18, 0.006, 0.01), 0x5fae57, { p: [0, 0.024, -0.08 + i * 0.04], r: [0, 0.2, 0], cast: false }); // hành lá
    for (const [x, z] of [[0.05, 0.03], [-0.05, -0.02]]) mesh(g, G.torus(0.018, 0.007, 5, 10), 0xfaf0e6, { p: [x, 0.026, z], r: [Math.PI / 2, 0, 0], cast: false });
    mesh(g, G.torus(0.02, 0.008, 6, 10, Math.PI * 1.3), 0xf2723a, { p: [0.0, 0.028, 0.06], r: [Math.PI / 2, 0, 1] });
  },
  galbijjim: (g) => {
    bowl(g, 0x7a3e1e, 0x3b2a2a, 0.16);
    for (const [x, z, r] of [[0.04, 0.02, 0.4], [-0.04, 0.03, -0.5], [0.0, -0.05, 1.1]]) {
      mesh(g, G.box(0.06, 0.04, 0.04), 0x6b3418, { p: [x, 0.11, z], r: [0, r, 0] });
      mesh(g, G.cyl(0.008, 0.008, 0.07, 6), 0xf3e9d2, { p: [x, 0.13, z], r: [0, r, Math.PI / 2] }); // xương sườn
    }
    mesh(g, G.cyl(0.02, 0.02, 0.015, 10), 0xf28c28, { p: [0.06, 0.11, -0.04] });
    mesh(g, G.box(0.035, 0.03, 0.035), 0xf3dc9a, { p: [-0.06, 0.11, -0.04] });
  },
  // ----- Món tráng miệng / trái cây (thêm ở Giai đoạn 17) -----
  fruit_plate: (g) => {
    for (const [x, z, r] of [[-0.05, -0.02, 0.3], [0.03, -0.06, -0.4]]) {
      const w = group(g, { p: [x, 0, z], r: [0, r, 0] }); // miếng dưa hấu tam giác
      mesh(w, G.prism(), 0xe5463c, { p: [0, 0.012, 0], s: [0.1, 0.08, 0.03] });
      mesh(w, G.box(0.1, 0.012, 0.032), 0x4f9e4a, { p: [0, 0.006, 0] });
      for (const dx of [-0.02, 0.015]) mesh(w, G.sphere(0.004, 4, 3), 0x2a1f1a, { p: [dx, 0.04, 0.016], cast: false });
    }
    for (const [x, z] of [[0.07, 0.05], [0.02, 0.07]]) {
      mesh(g, G.cyl(0.035, 0.035, 0.015, 12), 0xf28c28, { p: [x, 0.015, z], r: [0.5, 0, 0.2] }); // lát cam
      mesh(g, G.cyl(0.028, 0.028, 0.016, 12), 0xffc46b, { p: [x, 0.015, z], r: [0.5, 0, 0.2], cast: false });
    }
    for (let i = 0; i < 5; i++) mesh(g, G.sphere(0.017, 8, 6), 0x8e4fa8, { p: [-0.08 + (i % 3) * 0.02, 0.02 + (i > 2 ? 0.02 : 0), 0.06 + (i % 2) * 0.015], cast: false }); // nho
  },
  che_chuoi: (g) => {
    bowl(g, 0xfbf3e2, 0xf3e9d2, 0.13);
    for (const [x, z] of [[0.03, 0.02], [-0.03, -0.01], [0.0, -0.05], [-0.04, 0.04]]) mesh(g, G.cyl(0.022, 0.022, 0.012, 10), 0xf6e3a0, { p: [x, 0.1, z], cast: false }); // chuối
    for (let i = 0; i < 6; i++) mesh(g, G.sphere(0.008, 5, 4), glassy(0xe9f3ff), { p: [Math.cos(i) * 0.06, 0.1, Math.sin(i) * 0.06], cast: false }); // bột báng
    for (const [x, z] of [[0.05, -0.04], [0.01, 0.06], [-0.06, 0.0]]) mesh(g, G.sphere(0.009, 5, 4), 0xc9944a, { p: [x, 0.104, z], s: [1, 0.6, 1.3], cast: false }); // đậu phộng
  },
  fruit_sando: (g) => {
    for (const [x, r] of [[-0.05, 0.3], [0.06, -0.4]]) {
      const s = group(g, { p: [x, 0, 0], r: [0, r, 0] }); // sandwich tam giác dựng đứng, lộ mặt cắt
      mesh(s, G.prism(), 0xfff3d6, { s: [0.11, 0.1, 0.07] });
    }
    for (const [x, c] of [[-0.05, 0xe5463c], [0.06, 0x7cc35c]] as const) {
      mesh(g, G.box(0.01, 0.05, 0.06), 0xffffff, { p: [x, 0.04, 0.04], cast: false }); // kem
      mesh(g, G.sphere(0.014, 6, 5), c, { p: [x + 0.008, 0.045, 0.045], s: [0.4, 1, 1], cast: false });
      mesh(g, G.sphere(0.012, 6, 5), 0xf28c28, { p: [x + 0.008, 0.03, 0.025], s: [0.4, 1, 1], cast: false });
    }
  },
  hwachae: (g) => {
    mesh(g, G.cyl(0.12, 0.08, 0.09, 16), glassy(0xffffff, 0.45), { p: [0, 0.045, 0], cast: false }); // bát thuỷ tinh
    mesh(g, G.cyl(0.11, 0.11, 0.01, 16), glassy(0xf6a6c1, 0.85), { p: [0, 0.08, 0], cast: false });
    for (const [x, z, c] of [[0.04, 0.02, 0xe5463c], [-0.04, 0.03, 0xf2c43e], [0.0, -0.05, 0x7cc35c], [-0.05, -0.03, 0xe5463c]] as const) mesh(g, G.sphere(0.022, 8, 6), c, { p: [x, 0.085, z], cast: false });
    for (const [x, z] of [[0.05, -0.04], [-0.01, 0.06]]) mesh(g, G.box(0.025, 0.025, 0.025), glassy(0xe9f6ff, 0.8), { p: [x, 0.09, z], r: [0.3, 0.5, 0], cast: false }); // đá
  },
  tom_nuong: (g) => {
    for (const [z, r] of [[-0.05, 0.1], [0.0, -0.05], [0.05, 0.08]]) {
      const s = group(g, { p: [0, 0.02, z], r: [0, r, 0] });
      mesh(s, G.cyl(0.004, 0.004, 0.24, 4), 0xc9a066, { r: [0, 0, Math.PI / 2] }); // xiên tre
      mesh(s, G.torus(0.025, 0.013, 6, 10, Math.PI * 1.4), 0xe2643a, { p: [0.02, 0.01, 0], r: [Math.PI / 2, 0, 0] });
      for (const x of [0.0, 0.04]) mesh(s, G.box(0.004, 0.006, 0.03), 0x5a2a1a, { p: [x, 0.025, 0], cast: false }); // vết nướng
    }
    mesh(g, G.sphere(0.025, 8, 6), 0x9fd07a, { p: [-0.1, 0.015, 0.06], s: [1, 0.6, 0.6] }); // chanh
  },
  ngheu_hap_thai: (g) => {
    bowl(g, 0xf3e3a0, 0xf3e9d2, 0.15);
    for (const [x, z, r] of [[0.04, 0.03, 0.3], [-0.05, 0.02, 1.8], [0.0, -0.05, -0.6], [0.06, -0.04, 2.6], [-0.04, -0.05, 1]]) clam(group(g, { p: [x, 0.09, z], r: [0, r, 0] }), 0.7, true);
    for (const [x, z, r] of [[-0.02, 0.06, 0.4], [0.05, 0.06, -0.6]]) mesh(g, G.box(0.06, 0.008, 0.008), 0xd9e6a0, { p: [x, 0.11, z], r: [0, r, 0], cast: false }); // sả
    mesh(g, G.torus(0.01, 0.004, 4, 8), 0xd92b2b, { p: [0.0, 0.11, 0.0], r: [Math.PI / 2, 0, 0], cast: false });
  },
  hau_nuong_mo_hanh: (g) => {
    for (const [x, z, r] of [[-0.06, 0.03, 0.4], [0.06, 0.03, -0.4], [0.0, -0.06, 0]]) {
      const s = halfShell(group(g, { p: [x, 0, z], r: [0, r, 0] }), 'oyster', 0.8);
      mesh(s, G.sphere(0.04, 8, 6), 0xd9d0bf, { p: [0, 0.035, 0], s: [1, 0.3, 1.2], cast: false });
      for (let k = 0; k < 4; k++) mesh(s, G.box(0.015, 0.006, 0.006), 0x5fae57, { p: [Math.cos(k * 1.7) * 0.025, 0.045, Math.sin(k * 1.7) * 0.03], cast: false }); // mỡ hành
      mesh(s, G.sphere(0.008, 4, 3), 0xc9944a, { p: [0.01, 0.048, -0.01], cast: false });
    }
  },
  mi_xao_oc_mong_tay: (g) => {
    for (let i = 0; i < 4; i++) mesh(g, G.torus(0.03 + i * 0.022, 0.007, 4, 14), 0xe8b84a, { p: [0, 0.02 + (i % 2) * 0.008, 0], r: [Math.PI / 2 + (i % 2) * 0.15, 0, i], cast: false });
    for (const [x, z, r] of [[0.05, 0.03, 0.4], [-0.05, 0.04, -0.6], [0.0, -0.06, 1.2]]) mesh(g, G.capsule(0.012, 0.05), 0xf6d8b0, { p: [x, 0.04, z], r: [Math.PI / 2, 0, r] }); // thịt ốc móng tay
    for (const [x, z] of [[-0.03, -0.03], [0.06, -0.03]]) mesh(g, G.box(0.04, 0.006, 0.02), 0x5fae57, { p: [x, 0.045, z], r: [0, x * 20, 0], cast: false });
  },
  oc_bu_nhoi_thit: (g) => {
    for (const [x, z, r] of [[-0.06, 0.03, 0.4], [0.06, 0.03, -0.4], [0.0, -0.06, 0]]) {
      const o = group(g, { p: [x, 0, z], r: [0, r, 0] });
      snailShell(o, 0x5a5a3a, 0x3b3a2a, 0.8, 0.8);
      mesh(o, G.box(0.006, 0.1, 0.03), 0x4f9e4a, { p: [0.03, 0.08, 0.03], r: [0.3, 0, -0.4] }); // lá gừng cắm miệng ốc
    }
    mesh(g, G.cyl(0.025, 0.02, 0.025, 10), 0xffffff, { p: [0.09, 0.012, -0.08] });
    mesh(g, G.cyl(0.022, 0.022, 0.004, 10), 0xc9944a, { p: [0.09, 0.025, -0.08], cast: false }); // chén nước mắm gừng
  },
  so_diep_nuong_mo_hanh: (g) => {
    for (const [x, z, r] of [[-0.06, 0.03, 0.4], [0.06, 0.03, -0.4], [0.0, -0.06, 0]]) {
      const s = halfShell(group(g, { p: [x, 0, z], r: [0, r, 0] }), 'scallop', 0.8);
      mesh(s, G.cyl(0.025, 0.025, 0.02, 10), 0xfaf3e6, { p: [0, 0.03, 0.01] });
      for (let k = 0; k < 4; k++) mesh(s, G.box(0.015, 0.006, 0.006), 0x5fae57, { p: [Math.cos(k * 1.7) * 0.03, 0.045, Math.sin(k * 1.7) * 0.03], cast: false });
    }
  },
  hau_nuong_pho_mai: (g) => {
    for (const [x, z, r] of [[-0.06, 0.03, 0.4], [0.06, 0.03, -0.4], [0.0, -0.06, 0]]) {
      const s = halfShell(group(g, { p: [x, 0, z], r: [0, r, 0] }), 'oyster', 0.8);
      mesh(s, G.sphere(0.045, 10, 6), 0xf6d34e, { p: [0, 0.035, 0], s: [1, 0.35, 1.2], cast: false }); // phô mai chảy
      for (const [dx, dz] of [[0.01, 0.01], [-0.02, -0.02]]) mesh(s, G.sphere(0.01, 5, 4), 0xc98330, { p: [dx, 0.05, dz], s: [1, 0.4, 1], cast: false }); // vết cháy
    }
  },
  so_diep_nuong_pho_mai: (g) => {
    for (const [x, z, r] of [[-0.06, 0.03, 0.4], [0.06, 0.03, -0.4], [0.0, -0.06, 0]]) {
      const s = halfShell(group(g, { p: [x, 0, z], r: [0, r, 0] }), 'scallop', 0.8);
      mesh(s, G.sphere(0.045, 10, 6), 0xf6d34e, { p: [0, 0.032, 0], s: [1, 0.35, 1], cast: false });
      mesh(s, G.sphere(0.01, 5, 4), 0xc98330, { p: [0.01, 0.045, 0.01], s: [1, 0.4, 1], cast: false });
    }
  },
  oc_huong_sot_pho_mai: (g) => {
    mesh(g, G.cyl(0.13, 0.13, 0.012, 16), 0xf6c34e, { p: [0, 0.006, 0], cast: false }); // sốt phô mai
    for (const [x, z, r] of [[-0.05, 0.03, 0.4], [0.05, 0.04, -0.4], [0.0, -0.05, 1.2], [-0.06, -0.04, 2], [0.07, -0.03, 0.8]]) snailShell(group(g, { p: [x, 0.005, z], r: [0.4, r, 0.3] }), 0xf3dcb4, 0xc98a4f, 0.55, 1.3);
    for (const [x, z] of [[0.0, 0.07], [0.03, 0.0]]) mesh(g, G.box(0.02, 0.005, 0.006), 0x5fae57, { p: [x, 0.02, z], cast: false });
  },
};

export function makeDish(recipeId: string): THREE.Group | null {
  const build = DISHES[recipeId];
  if (!build) return null;
  const g = group(null);
  build(g);
  return g;
}

// ---------- Đồ trang trí ----------

/**
 * Cột đèn kiểu cổ: đế bát giác, thân có vòng nẹp, đèn lồng 4 mặt kính (sáng theo đêm) có mái chóp + núm.
 * Trả về vật liệu kính đèn để khu vực chỉnh độ sáng theo ban đêm.
 */
export function makeLampPost(parent: THREE.Object3D, o: Place): THREE.MeshToonMaterial {
  const g = group(parent, o);
  const bulb = toon(0xfff1c2, { emissive: 0xffc861, emissiveIntensity: 0 });
  const iron = 0x3b4049;
  mesh(g, G.cyl(0.17, 0.21, 0.28, 8), iron, { p: [0, 0.14, 0] });
  mesh(g, G.cyl(0.12, 0.17, 0.12, 8), iron, { p: [0, 0.34, 0] });
  mesh(g, G.cyl(0.055, 0.075, 2.15, 8), iron, { p: [0, 1.47, 0] });
  for (const y of [0.55, 1.6, 2.5]) mesh(g, G.cyl(0.085, 0.085, 0.05, 8), 0x5a606b, { p: [0, y, 0], cast: false });
  // Đèn lồng
  const head = group(g, { p: [0, 2.58, 0] });
  mesh(head, G.cyl(0.17, 0.11, 0.06, 4), iron, { r: [0, Math.PI / 4, 0] });
  mesh(head, G.box(0.22, 0.3, 0.22), bulb, { p: [0, 0.18, 0], cast: false });
  for (const x of [-0.115, 0.115]) for (const z of [-0.115, 0.115]) mesh(head, G.box(0.03, 0.32, 0.03), iron, { p: [x, 0.18, z] });
  mesh(head, G.cone(0.24, 0.2, 4), iron, { p: [0, 0.43, 0], r: [0, Math.PI / 4, 0] });
  mesh(head, G.sphere(0.04, 6, 5), iron, { p: [0, 0.55, 0] });
  return bulb;
}

/** Thùng gỗ ván thưa: nan ngang có khe hở, 4 cột góc, lỗ tay cầm hai đầu, lòng thùng sẫm (đặt hàng lên trên y ≈ 0.3). */
export function makeCrate(parent: THREE.Object3D, o: Place, color = 0xd9a066): THREE.Group {
  const g = group(parent, o);
  const dark = new THREE.Color(color).multiplyScalar(0.72).getHex();
  mesh(g, G.box(0.58, 0.22, 0.46), 0x5a3b2a, { p: [0, 0.14, 0] }); // lòng thùng
  mesh(g, G.box(0.62, 0.03, 0.5), dark, { p: [0, 0.015, 0] });
  for (const y of [0.07, 0.165, 0.26]) {
    for (const s of [-1, 1]) mesh(g, G.box(0.6, 0.07, 0.02), color, { p: [0, y, s * 0.245] });
    for (const s of [-1, 1]) mesh(g, G.box(0.02, 0.07, 0.46), color, { p: [s * 0.3, y, 0] });
  }
  for (const x of [-0.29, 0.29]) for (const z of [-0.235, 0.235]) mesh(g, G.box(0.045, 0.31, 0.045), dark, { p: [x, 0.155, z] });
  for (const s of [-1, 1]) mesh(g, G.box(0.025, 0.04, 0.14), 0x2a1f1a, { p: [s * 0.305, 0.26, 0], cast: false }); // lỗ tay cầm
  return g;
}
