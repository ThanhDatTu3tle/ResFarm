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

/** Các khớp của người để khu vực cử động: xoay tay/chân quanh vai/hông, cúi đầu, chớp mắt. */
export interface Rig {
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  eyes: THREE.Object3D[];
  /** Lệch pha riêng từng người để không ai chớp mắt/thở cùng lúc. */
  seed: number;
}

const HIP_Y = 0.3;
const SHOULDER_Y = 0.72;
const NECK_Y = 0.8;
let personSeed = 0;

/**
 * Người kiểu chibi: đầu to, mắt to có đốm sáng, má hồng, tay chân tách rời quay quanh khớp.
 * Khớp nằm trong `userData.rig` (xem `Rig`); gọi `animatePerson` mỗi khung hình để người "sống".
 */
export function makePerson(look: Look, hat: 'none' | 'chef' | 'straw' = 'none'): THREE.Group {
  const g = group(null);
  const pants = 0x4a4a6a;
  const legs: THREE.Group[] = [];
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = group(g, { p: [side * 0.1, HIP_Y, 0] });
    mesh(leg, G.capsule(0.075, 0.14), pants, { p: [0, -0.15, 0] });
    mesh(leg, G.sphere(0.085, 10, 8), 0x5a3b2a, { p: [0, -0.27, 0.035], s: [1, 0.6, 1.35] }); // giày
    legs.push(leg);
  }
  const body = group(g, { p: [0, HIP_Y, 0] });
  mesh(body, G.capsule(0.2, 0.24), look.shirt, { p: [0, 0.25, 0] });
  if (hat === 'chef') mesh(body, G.cone(0.1, 0.12, 3), 0xe2574c, { p: [0, 0.45, 0.17], r: [Math.PI / 2 + 0.3, 0, Math.PI] }); // khăn quàng đỏ
  for (const side of [-1, 1]) {
    const arm = group(body, { p: [side * 0.24, SHOULDER_Y - HIP_Y, 0], r: [0, 0, side * 0.18] });
    mesh(arm, G.capsule(0.06, 0.18), look.shirt, { p: [0, -0.13, 0] });
    mesh(arm, G.sphere(0.065, 10, 8), look.skin, { p: [0, -0.27, 0] }); // bàn tay
    arms.push(arm);
  }

  // Đầu: to (≈ 40% chiều cao) cho ra chất chibi
  const head = group(body, { p: [0, NECK_Y - HIP_Y, 0] });
  mesh(head, G.sphere(0.23), look.skin, { p: [0, 0.2, 0] });
  const eyes: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const eye = group(head, { p: [side * 0.085, 0.18, 0.2] });
    mesh(eye, G.sphere(0.038, 10, 8), 0x2a1f1a, { s: [0.9, 1.25, 0.6], cast: false });
    mesh(eye, G.sphere(0.013, 6, 5), 0xffffff, { p: [side * -0.01, 0.017, 0.022], cast: false }); // đốm sáng trong mắt
    eyes.push(eye);
    mesh(head, G.sphere(0.042, 8, 6), 0xff9d9d, { p: [side * 0.14, 0.105, 0.17], s: [1.2, 0.75, 0.5], cast: false }); // má hồng
  }
  mesh(head, G.torus(0.028, 0.008, 4, 10, Math.PI), 0x8a3a2a, { p: [0, 0.1, 0.215], r: [0, 0, Math.PI], cast: false }); // miệng cười

  if (hat === 'chef') {
    mesh(head, G.cyl(0.17, 0.16, 0.2), 0xffffff, { p: [0, 0.44, 0] });
    mesh(head, G.sphere(0.21), 0xffffff, { p: [0, 0.6, 0], s: [1, 0.65, 1] });
  } else {
    mesh(head, G.sphere(0.245), look.hair, { p: [0, 0.26, -0.04], s: [1, 0.85, 1] });
    mesh(head, G.sphere(0.1, 10, 8), look.hair, { p: [0.07, 0.36, 0.15], s: [1.4, 0.6, 0.8] }); // mái tóc
    if (hat === 'straw') {
      mesh(head, G.cyl(0.38, 0.4, 0.03), 0xe9c46a, { p: [0, 0.39, 0] });
      mesh(head, G.cyl(0.18, 0.21, 0.15), 0xe9c46a, { p: [0, 0.47, 0] });
      mesh(head, G.cyl(0.215, 0.215, 0.04), 0xc94a3f, { p: [0, 0.42, 0] });
    }
  }

  g.userData.rig = { body, head, armL: arms[0], armR: arms[1], legL: legs[0], legR: legs[1], eyes, seed: (personSeed++ * 1.618) % 10 } satisfies Rig;
  return g;
}

/** Tư thế cho animatePerson. Các giá trị số là cường độ 0..1. */
export interface Pose {
  /** Đang đi bộ. */
  walk?: number;
  /** Đang ngồi ghế. */
  sit?: boolean;
  /** Đang nấu (đảo chảo). */
  cook?: number;
  /** Đang ăn (đưa tay lên miệng). */
  eat?: boolean;
  /** Vẫy tay chào. */
  wave?: number;
  /** Hai tay bưng đồ trước ngực (bồi bàn). */
  carry?: boolean;
  /** Vung cuốc: hai tay giơ lên rồi bổ xuống, người gập theo nhịp (0..1). */
  dig?: number;
  /** Tưới: tay phải đưa ra trước, nghiêng bình qua lại (0..1). */
  pour?: number;
  /** Cúi xuống đất: gieo hạt / nhổ thu hoạch / cho con vật ăn (0..1). */
  reach?: number;
}

/** Cử động người theo thời gian t (giây thực): thở, chớp mắt, nhìn quanh + tư thế. */
export function animatePerson(g: THREE.Object3D, t: number, pose: Pose = {}): void {
  const rig = g.userData.rig as Rig | undefined;
  if (!rig) return;
  const k = t + rig.seed;
  const walk = pose.walk ?? 0;
  const cook = pose.cook ?? 0;
  const wave = pose.wave ?? 0;
  const dig = pose.dig ?? 0;
  const pour = pose.pour ?? 0;
  const reach = pose.reach ?? 0;
  const chop = Math.sin(t * 9); // nhịp bổ cuốc

  // Thở + chớp mắt (mỗi ~3.7 giây, vài người thỉnh thoảng chớp đôi)
  rig.body.scale.set(1, 1 + Math.sin(k * 2.3) * 0.025, 1);
  const cycle = (k * 1.3) % 4.8;
  const blink = cycle < 0.13 || (rig.seed > 5 && cycle > 0.25 && cycle < 0.36);
  for (const eye of rig.eyes) eye.scale.y = blink ? 0.12 : 1;

  // Đầu: nhìn quanh chậm rãi; khi nấu thì cúi xuống chảo
  const busy = Math.max(cook, dig, pour, reach);
  rig.head.rotation.y = Math.sin(k * 0.45) * 0.35 * (1 - walk) * (1 - busy);
  rig.head.rotation.x = Math.max(cook * 0.3, dig * 0.25, pour * 0.35, reach * 0.45) + Math.sin(k * 0.7) * 0.04;
  rig.head.rotation.z = Math.sin(k * 0.33) * 0.06;

  // Chân: đi thì bước luân phiên, ngồi thì duỗi ra trước
  const step = Math.sin(t * 11 + rig.seed) * 0.65 * walk;
  const legBase = pose.sit ? -1.45 : 0;
  rig.legL.rotation.x = legBase + step;
  rig.legR.rotation.x = legBase - step;

  // Tay: đung đưa nhẹ khi đứng, vung ngược chân khi đi, đảo chảo khi nấu, đưa lên miệng khi ăn
  const idle = Math.sin(k * 1.6) * 0.06;
  let left = -step * 0.8 + idle - cook * 0.9;
  let right = step * 0.8 - idle - cook * (0.9 + Math.sin(t * 14) * 0.35);
  let rightZ = -0.18;
  if (pose.sit) {
    left -= 0.35;
    right -= 0.35;
  }
  if (pose.eat) right = -1.9 + Math.max(0, Math.sin(k * 3)) * 0.9; // múc rồi đưa lên miệng
  if (pose.carry) {
    left = -1.25 + Math.sin(t * 11) * 0.04 * walk;
    right = -1.25 - Math.sin(t * 11) * 0.04 * walk;
  }
  if (dig > 0) {
    // Hai tay cùng cầm cán cuốc: giơ cao rồi bổ xuống trước mặt
    const swing = -1.5 - chop * 1.1;
    left = left * (1 - dig) + swing * dig;
    right = right * (1 - dig) + swing * dig;
  }
  if (pour > 0) {
    left = left * (1 - pour) - 0.3 * pour;
    right = right * (1 - pour) + (-1.35 + Math.sin(t * 5) * 0.15) * pour;
  }
  if (reach > 0) {
    // Cúi gập, hai tay với xuống đất, nhặt lên đặt xuống luân phiên
    left = left * (1 - reach) + (-0.9 + Math.sin(t * 7) * 0.35) * reach;
    right = right * (1 - reach) + (-0.9 - Math.sin(t * 7) * 0.35) * reach;
  }
  if (wave > 0) {
    right = right * (1 - wave) - 2.6 * wave;
    rightZ = -0.18 + (-0.5 + Math.sin(t * 12) * 0.35) * wave;
  }
  rig.armL.rotation.x = left;
  rig.armR.rotation.x = right;
  rig.armR.rotation.z = rightZ;
  // Nghiêng người tới trước: đi, nấu, bổ cuốc theo nhịp, cúi xuống đất
  rig.body.rotation.x = walk * 0.08 + cook * 0.12 + dig * (0.18 + Math.max(0, -chop) * 0.22) + pour * 0.1 + reach * 0.55;
}

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

/** Giai đoạn lớn của cây: 0 = mầm, 1 = cây non (chưa có quả), 2 = trưởng thành. */
export type CropStage = 0 | 1 | 2;

/** Đổi tỉ lệ lớn (0..1) của lứa đầu sang giai đoạn hiển thị. */
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
};

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
};

export function makeDish(recipeId: string): THREE.Group | null {
  const build = DISHES[recipeId];
  if (!build) return null;
  const g = group(null);
  build(g);
  return g;
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
