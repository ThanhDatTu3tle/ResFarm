import * as THREE from 'three';
import { G, group, mesh, toon, type Place } from './toon';

/** Các model dùng chung giữa nhiều khu: người, cây, con vật, rau củ. Mọi model nhìn về +z, chân ở y = 0. */

// ---------- Người ----------

export interface Look {
  shirt: number;
  hair: number;
  skin: number;
}

/** Ngoại hình khách; chỉ số khớp với Party.looks (LOOK_COUNT bên sim). */
export const LOOKS: Look[] = [
  { shirt: 0xe2574c, hair: 0x3a2a1e, skin: 0xffd9b8 },
  { shirt: 0x4a9bd8, hair: 0x1f1a17, skin: 0xf2c49b },
  { shirt: 0x5fae57, hair: 0x6b3f22, skin: 0xffd9b8 },
  { shirt: 0xf2b23e, hair: 0x1f1a17, skin: 0xe8b88a },
  { shirt: 0x9a6bd1, hair: 0xc98b4f, skin: 0xffe1c7 },
  { shirt: 0xf08fb0, hair: 0x3a2a1e, skin: 0xf2c49b },
  { shirt: 0x3fb6a8, hair: 0xd9d9d9, skin: 0xffd9b8 },
  { shirt: 0xf47b3c, hair: 0x54381f, skin: 0xe8b88a },
];

export function makePerson(look: Look, hat: 'none' | 'chef' | 'straw' = 'none'): THREE.Group {
  const g = group(null);
  for (const side of [-1, 1]) {
    mesh(g, G.cyl(0.07, 0.07, 0.3, 8), 0x4a4a6a, { p: [side * 0.1, 0.15, 0] });
    mesh(g, G.capsule(0.065, 0.2), look.shirt, { p: [side * 0.27, 0.55, 0], r: [0, 0, side * 0.25] });
    mesh(g, G.sphere(0.03, 8, 6), 0x2a1f1a, { p: [side * 0.08, 1.02, 0.19], cast: false });
    mesh(g, G.sphere(0.035, 8, 6), 0xff9d9d, { p: [side * 0.13, 0.94, 0.165], cast: false });
  }
  mesh(g, G.capsule(0.2, 0.28), look.shirt, { p: [0, 0.56, 0] });
  mesh(g, G.sphere(0.21), look.skin, { p: [0, 1, 0] });
  if (hat === 'chef') {
    mesh(g, G.cyl(0.16, 0.15, 0.2), 0xffffff, { p: [0, 1.25, 0] });
    mesh(g, G.sphere(0.2), 0xffffff, { p: [0, 1.4, 0], s: [1, 0.65, 1] });
  } else {
    mesh(g, G.sphere(0.225), look.hair, { p: [0, 1.05, -0.035], s: [1, 0.85, 1] });
    if (hat === 'straw') {
      mesh(g, G.cyl(0.36, 0.38, 0.03), 0xe9c46a, { p: [0, 1.17, 0] });
      mesh(g, G.cyl(0.17, 0.2, 0.14), 0xe9c46a, { p: [0, 1.25, 0] });
    }
  }
  return g;
}

// ---------- Cây cối, hàng rào ----------

/** Cây tán tròn; userData.sway đánh dấu để khu vực cho đung đưa theo gió. */
export function makeTree(parent: THREE.Object3D, o: Place, leaf = 0x5fae57): THREE.Group {
  const g = group(parent, o);
  mesh(g, G.cyl(0.14, 0.2, 1.1, 8), 0x8a5a3a, { p: [0, 0.55, 0] });
  const crown = group(g, { p: [0, 1.1, 0] });
  mesh(crown, G.ico(0.75, 1), leaf, { p: [0, 0.55, 0] });
  mesh(crown, G.ico(0.5, 1), leaf, { p: [0.45, 0.25, 0.1] });
  mesh(crown, G.ico(0.48, 1), leaf, { p: [-0.42, 0.3, -0.1] });
  crown.userData.sway = Math.random() * 6;
  return g;
}

export function makeBush(parent: THREE.Object3D, o: Place, leaf = 0x6fbf5f): THREE.Group {
  const g = group(parent, o);
  mesh(g, G.ico(0.4, 1), leaf, { p: [0, 0.3, 0] });
  mesh(g, G.ico(0.28, 1), leaf, { p: [0.32, 0.22, 0.05] });
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
};

export function makeCrop(producerId: string): THREE.Group {
  const style = CROPS[producerId] ?? { shape: 'bush', leaf: 0x6fbf5f };
  const g = group(null);
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
  for (const side of [-1, 1]) {
    mesh(g, G.cyl(0.02, 0.02, 0.14, 5), 0xf2a23a, { p: [side * 0.08, 0.07, 0] });
    mesh(g, G.sphere(0.022, 6, 5), 0x2a1f1a, { p: [side * 0.07, 0.56, 0.3], cast: false });
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
    mesh(g, G.sphere(0.03, 6, 5), 0x2a1f1a, { p: [side * 0.12, 1.0, 0.82], cast: false });
    for (const z of [-0.33, 0.33]) mesh(g, G.cyl(0.07, 0.06, 0.42, 7), base, { p: [side * 0.2, 0.21, z] });
  }
  mesh(g, G.cyl(0.02, 0.02, 0.4, 5), patch, { p: [0, 0.6, -0.6], r: [0.5, 0, 0] });
  return g;
}

function makePig(): THREE.Group {
  const pink = 0xf6a6b6;
  const g = group(null);
  mesh(g, G.sphere(0.34), pink, { p: [0, 0.42, 0], s: [0.95, 0.85, 1.25] });
  mesh(g, G.sphere(0.22), pink, { p: [0, 0.52, 0.42] });
  mesh(g, G.cyl(0.09, 0.09, 0.08, 10), 0xe88a9d, { p: [0, 0.5, 0.63], r: [Math.PI / 2, 0, 0] });
  mesh(g, G.torus(0.06, 0.02, 6, 10), 0xe88a9d, { p: [0, 0.5, -0.45] });
  for (const side of [-1, 1]) {
    mesh(g, G.cone(0.07, 0.12, 5), 0xe88a9d, { p: [side * 0.13, 0.72, 0.4], r: [0.3, 0, -side * 0.4] });
    mesh(g, G.sphere(0.025, 6, 5), 0x2a1f1a, { p: [side * 0.1, 0.58, 0.61], cast: false });
    for (const z of [-0.22, 0.22]) mesh(g, G.cyl(0.06, 0.05, 0.2, 7), pink, { p: [side * 0.16, 0.1, z] });
  }
  return g;
}

function makeFish(color: number): THREE.Group {
  const g = group(null);
  mesh(g, G.sphere(0.16), color, { s: [0.6, 0.9, 1.5] });
  mesh(g, G.cone(0.12, 0.2, 4), color, { p: [0, 0, -0.3], r: [Math.PI / 2, 0, 0], s: [0.4, 1, 1] });
  for (const side of [-1, 1]) mesh(g, G.sphere(0.025, 6, 5), 0x2a1f1a, { p: [side * 0.08, 0.04, 0.14], cast: false });
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
};

export function makeAnimals(producerId: string): THREE.Group[] | null {
  const def = ANIMALS[producerId];
  return def ? Array.from({ length: def.count }, def.make) : null;
}

// ---------- Đồ trang trí ----------

/** Cột đèn; trả về vật liệu bóng đèn để khu vực chỉnh độ sáng theo ban đêm. */
export function makeLampPost(parent: THREE.Object3D, o: Place): THREE.MeshToonMaterial {
  const g = group(parent, o);
  const bulb = toon(0xfff1c2, { emissive: 0xffc861, emissiveIntensity: 0 });
  mesh(g, G.cyl(0.07, 0.1, 2.6, 8), 0x4a4f5a, { p: [0, 1.3, 0] });
  mesh(g, G.cone(0.32, 0.25, 8), 0x4a4f5a, { p: [0, 2.85, 0] });
  mesh(g, G.sphere(0.18, 10, 8), bulb, { p: [0, 2.65, 0], cast: false });
  return bulb;
}

export function makeCrate(parent: THREE.Object3D, o: Place, color = 0xd9a066): THREE.Group {
  const g = group(parent, o);
  mesh(g, G.box(0.62, 0.3, 0.5), color, { p: [0, 0.15, 0] });
  mesh(g, G.box(0.66, 0.05, 0.54), 0xb07a45, { p: [0, 0.3, 0] });
  return g;
}
