import * as THREE from 'three';
import type { HairStyle, PersonBuild } from '../../data';
import { G, group, mesh, toonRim } from './toon';
import { mergeParts } from './merge';

/**
 * NGƯỜI kiểu chibi: đầu to, mắt to có đốm sáng, má hồng, tay chân tách rời quay quanh khớp.
 * Dáng người (`Shape`): trẻ em / thiếu niên / người lớn / người già, cao thấp, mập gầy, kiểu tóc.
 * Khớp nằm trong `userData.rig` (xem `Rig`); gọi `animatePerson` mỗi khung hình để người "sống".
 * Mọi model nhìn về +z, chân ở y = 0.
 */

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

/** Dáng người. Bỏ trống = người lớn, cân đối, tóc ngắn. */
export interface Shape {
  build?: PersonBuild;
  /** Bề ngang thân (0.85 gầy … 1.3 mập). */
  width?: number;
  /** Cao thấp so với chuẩn của dáng (0.92 … 1.08). */
  height?: number;
  hair?: HairStyle;
  /** Màu dây buộc tóc / nơ. */
  accent?: number;
}

/** Tỉ lệ theo dáng: cả người, chân, đầu, thân. Trẻ em thấp, chân ngắn, đầu to. */
const BUILDS: Record<PersonBuild, { scale: number; leg: number; head: number; torso: number }> = {
  kid: { scale: 0.7, leg: 0.78, head: 1.15, torso: 0.88 },
  teen: { scale: 0.88, leg: 0.96, head: 1.04, torso: 0.95 },
  adult: { scale: 1, leg: 1, head: 1, torso: 1 },
  elder: { scale: 0.95, leg: 0.94, head: 1, torso: 1 },
};

/** Các khớp của người để khu vực cử động. */
export interface Rig {
  /** Gốc bên trong (nhún khi bước, lắc hông) - vị trí / hướng của cả người vẫn là group ngoài. */
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  eyes: THREE.Object3D[];
  /** Bóng mờ dưới chân. */
  shadow: THREE.Object3D;
  /** Lệch pha riêng từng người để không ai chớp mắt/thở cùng lúc. */
  seed: number;
  /** Ngồi: nâng gốc lên bao nhiêu (toạ độ trong người) để hông chạm mặt ghế như người lớn. */
  sitLift: number;
  /** Nhịp bước (trẻ em bước nhanh hơn). */
  stepRate: number;
}

const HIP_Y = 0.3;
const SHOULDER_Y = 0.72;
const NECK_Y = 0.8;
let personSeed = 0;

export function makePerson(look: Look, hat: 'none' | 'chef' | 'straw' = 'none', shape: Shape = {}): THREE.Group {
  const build = BUILDS[shape.build ?? 'adult'];
  const w = shape.width ?? 1;
  const scale = build.scale * (shape.height ?? 1);
  const hipY = HIP_Y * build.leg;

  // Tỉ lệ dáng đặt ở gốc bên trong: nơi gọi vẫn được g.scale.setScalar(...) (người bán to hơn cho dễ nhìn) mà không mất dáng
  const g = group(null);
  const root = group(g, { s: scale });
  const pants = 0x4a4a6a;
  const legs: THREE.Group[] = [];
  const arms: THREE.Group[] = [];
  const legW = 0.88 + 0.12 * w;
  for (const side of [-1, 1]) {
    const leg = group(root, { p: [side * 0.1 * (0.8 + 0.2 * w), hipY, 0], s: [1, build.leg, 1] });
    mesh(leg, G.capsule(0.075, 0.14), pants, { p: [0, -0.15, 0], s: [legW, 1, legW] });
    mesh(leg, G.sphere(0.085, 10, 8), 0x5a3b2a, { p: [0, -0.27, 0.035], s: [1, 0.6 / build.leg, 1.35] }); // giày
    legs.push(leg);
  }
  const body = group(root, { p: [0, hipY, 0] });
  const t = build.torso;
  mesh(body, G.capsule(0.2, 0.24), look.shirt, { p: [0, 0.25 * t, 0], s: [w, t, w * 0.94] });
  if (w > 1.12) mesh(body, G.sphere(0.17, 14, 10), look.shirt, { p: [0, 0.17 * t, 0.1 * w], s: [w * 0.95, 0.9, 0.8] }); // bụng
  if (hat === 'chef') mesh(body, G.cone(0.1, 0.12, 3), 0xe2574c, { p: [0, 0.45 * t, 0.17 * w], r: [Math.PI / 2 + 0.3, 0, Math.PI] }); // khăn quàng đỏ
  const shoulder = (SHOULDER_Y - HIP_Y) * t;
  for (const side of [-1, 1]) {
    const arm = group(body, { p: [side * (0.24 + (w - 1) * 0.22), shoulder, 0], r: [0, 0, side * 0.18] });
    mesh(arm, G.capsule(0.06, 0.18), look.shirt, { p: [0, -0.13, 0], s: [legW, 1, legW] });
    mesh(arm, G.sphere(0.065, 10, 8), look.skin, { p: [0, -0.27, 0] }); // bàn tay
    arms.push(arm);
  }

  // Đầu: to (≈ 40% chiều cao) cho ra chất chibi
  const head = group(body, { p: [0, (NECK_Y - HIP_Y) * t, 0], s: build.head });
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
    hairBack(head, look.hair); // tóc gáy lộ dưới mũ
  } else {
    addHair(head, hat === 'straw' ? 'short' : (shape.hair ?? 'short'), look.hair, shape.accent ?? 0xe2574c);
    if (hat === 'straw') {
      mesh(head, G.cyl(0.38, 0.4, 0.03), 0xe9c46a, { p: [0, 0.39, 0] });
      mesh(head, G.cyl(0.18, 0.21, 0.15), 0xe9c46a, { p: [0, 0.47, 0] });
      mesh(head, G.cyl(0.215, 0.215, 0.04), 0xc94a3f, { p: [0, 0.42, 0] });
    }
  }

  // Khăn quàng cổ (chỉ hiện mùa đông - xem `wardrobe`), mỗi người một màu
  const scarfColor = SCARVES[personSeed % SCARVES.length];
  const scarf = group(body, { p: [0, (NECK_Y - HIP_Y) * t - 0.02, 0], s: [w, 1, w] });
  mesh(scarf, G.torus(0.165, 0.062, 6, 16), scarfColor, { r: [Math.PI / 2, 0, 0] });
  mesh(scarf, G.box(0.1, 0.22, 0.05), scarfColor, { p: [0.08, -0.13, 0.17], r: [0.25, 0, 0.18] }); // đuôi khăn thả trước ngực
  scarf.visible = false;
  g.userData.scarf = scarf;

  // Bóng mờ dưới chân: người đứng "chạm đất" kể cả trong nhà, chỗ bóng nắng không tới
  const shadow = new THREE.Mesh(SHADOW_GEO, shadowMat());
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  shadow.scale.set(0.95 * w * scale, 0.8 * w * scale, 1);
  shadow.renderOrder = -1;
  g.add(shadow);

  if (shape.build === 'elder') g.userData.hunch = 0.16;
  g.userData.rig = {
    root, body, head, armL: arms[0], armR: arms[1], legL: legs[0], legR: legs[1], eyes, shadow,
    seed: (personSeed++ * 1.618) % 10,
    sitLift: HIP_Y - hipY * scale,
    stepRate: 11 / Math.sqrt(build.leg * build.scale),
  } satisfies Rig;
  rimify(g);
  return g;
}

const SCARVES = [0xd9473f, 0x3f7fd9, 0xe8a33a, 0x4fa86a, 0x9a5fc4, 0xe8739a];

// ---------- Bóng dưới chân + viền sáng ----------

const SHADOW_GEO = new THREE.CircleGeometry(0.34, 24);
let shadowMaterial: THREE.MeshBasicMaterial | null = null;
/** Vật liệu bóng: vòng tròn mờ dần ra mép (texture vẽ bằng canvas, tạo một lần). */
function shadowMat(): THREE.MeshBasicMaterial {
  if (shadowMaterial) return shadowMaterial;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.32)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = grad;
  x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  shadowMaterial = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.7 });
  return shadowMaterial;
}

/**
 * Đổi vật liệu của người sang bản có viền sáng mềm (rim light): mép người hắt sáng nhẹ, tách khỏi nền.
 * Bỏ qua chi tiết nhỏ trên mặt (mắt, má, miệng - mesh không đổ bóng) và vật liệu trong suốt.
 * Gọi lại sau khi gắn thêm đồ (khách quen, tạp dề) cũng được.
 */
export function rimify(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.castShadow) return;
    const mat = m.material as THREE.MeshToonMaterial;
    if (!mat?.isMeshToonMaterial || mat.transparent || mat.userData.rim) return;
    m.material = toonRim(mat.color.getHex());
  });
}

// ---------- Tóc ----------

/** Phần tóc ôm gáy, dùng chung cho mọi kiểu (để tóc không trông như cái mũ chụp). */
function hairBack(head: THREE.Group, c: number): void {
  mesh(head, G.sphere(0.22, 14, 10), c, { p: [0, 0.15, -0.09], s: [1.06, 0.9, 0.85] });
}

/** Chỏm tóc trên đầu + gáy + tóc mai hai bên. */
function hairCap(head: THREE.Group, c: number, puff = 1): void {
  mesh(head, G.sphere(0.245), c, { p: [0, 0.26, -0.04], s: [1.02 * puff, 0.86 * puff, 1.02 * puff] });
  hairBack(head, c);
  for (const side of [-1, 1]) mesh(head, G.box(0.05, 0.12, 0.08), c, { p: [side * 0.215, 0.17, 0.06], r: [0, 0, side * -0.08] }); // tóc mai
}

/** Dựng kiểu tóc lên đầu (đầu bán kính 0.23, tâm y 0.2). */
export function addHair(head: THREE.Group, style: HairStyle, c: number, accent: number): void {
  switch (style) {
    case 'bald':
      // Hói: chỉ còn viền tóc hai bên và sau gáy
      for (const side of [-1, 1]) mesh(head, G.sphere(0.09, 10, 8), c, { p: [side * 0.2, 0.2, -0.06], s: [0.6, 1, 1.2] });
      mesh(head, G.sphere(0.12, 10, 8), c, { p: [0, 0.18, -0.17], s: [1.5, 0.8, 0.6] });
      break;
    case 'spiky':
      hairCap(head, c, 0.98);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        mesh(head, G.cone(0.07, 0.17, 6), c, { p: [Math.cos(a) * 0.13, 0.43, Math.sin(a) * 0.13 - 0.03], r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5] });
      }
      mesh(head, G.cone(0.08, 0.14, 6), c, { p: [0.04, 0.36, 0.17], r: [1.1, 0, -0.3] }); // chỏm trước dựng lên
      break;
    case 'long':
      hairCap(head, c, 1.02);
      mesh(head, G.capsule(0.17, 0.2), c, { p: [0, 0.02, -0.13], s: [1.25, 1, 0.6] }); // tóc dài sau lưng
      for (const side of [-1, 1]) mesh(head, G.capsule(0.055, 0.2), c, { p: [side * 0.2, 0.08, 0.06], r: [0, 0, side * 0.08] }); // lọn ôm mặt
      mesh(head, G.sphere(0.11, 10, 8), c, { p: [-0.06, 0.35, 0.15], s: [1.6, 0.55, 0.8] }); // mái
      break;
    case 'bob':
      hairCap(head, c, 1.04);
      for (const side of [-1, 1]) mesh(head, G.sphere(0.13, 12, 10), c, { p: [side * 0.17, 0.13, -0.02], s: [0.75, 1.05, 1.1] }); // hai bên tới cằm
      mesh(head, G.box(0.34, 0.08, 0.08), c, { p: [0, 0.33, 0.16], r: [-0.35, 0, 0] }); // mái bằng
      break;
    case 'curly':
      hairCap(head, c, 1.0);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const ring = i % 2 ? 0.17 : 0.12;
        mesh(head, G.sphere(0.075, 10, 8), c, { p: [Math.cos(a) * ring, 0.4 + (i % 3) * 0.02, Math.sin(a) * ring - 0.03] });
      }
      mesh(head, G.sphere(0.09, 10, 8), c, { p: [0, 0.47, -0.02] });
      break;
    case 'side':
      hairCap(head, c, 1.0);
      mesh(head, G.sphere(0.13, 12, 10), c, { p: [0.08, 0.36, 0.13], s: [1.6, 0.6, 0.9], r: [0, 0, -0.25] }); // mái rẽ ngôi một bên
      mesh(head, G.sphere(0.08, 10, 8), c, { p: [0.19, 0.28, 0.12], s: [0.8, 1.1, 0.8] });
      break;
    case 'pony':
      hairCap(head, c, 1.0);
      mesh(head, G.sphere(0.1, 10, 8), c, { p: [0.05, 0.36, 0.15], s: [1.5, 0.55, 0.8] });
      mesh(head, G.sphere(0.06, 8, 6), accent, { p: [0, 0.3, -0.26] }); // dây buộc
      mesh(head, G.capsule(0.07, 0.22), c, { p: [0, 0.14, -0.31], r: [0.35, 0, 0] });
      break;
    case 'twin':
      hairCap(head, c, 1.0);
      mesh(head, G.sphere(0.1, 10, 8), c, { p: [0, 0.36, 0.15], s: [1.6, 0.55, 0.8] });
      for (const side of [-1, 1]) {
        mesh(head, G.sphere(0.05, 8, 6), accent, { p: [side * 0.22, 0.28, -0.05] });
        mesh(head, G.capsule(0.06, 0.16), c, { p: [side * 0.27, 0.15, -0.06], r: [0, 0, side * 0.35] });
      }
      break;
    case 'bun':
      hairCap(head, c, 1.0);
      mesh(head, G.sphere(0.1, 10, 8), c, { p: [-0.05, 0.36, 0.15], s: [1.5, 0.55, 0.8] });
      mesh(head, G.sphere(0.11, 12, 10), c, { p: [0, 0.48, -0.1] });
      break;
    case 'buzz':
      // Đầu đinh: tóc ôm sát, không mái
      mesh(head, G.sphere(0.243), c, { p: [0, 0.24, -0.04], s: [1.0, 0.82, 1.0] });
      hairBack(head, c);
      break;
    case 'undercut':
      // Hai bên cạo ngắn, trên đỉnh dày vuốt ngược ra sau
      mesh(head, G.sphere(0.24), c, { p: [0, 0.23, -0.05], s: [0.98, 0.78, 0.98] });
      hairBack(head, c);
      mesh(head, G.sphere(0.17, 12, 10), c, { p: [0, 0.4, 0.0], s: [1.0, 0.62, 1.35], r: [-0.25, 0, 0] });
      mesh(head, G.sphere(0.1, 10, 8), c, { p: [0, 0.39, 0.15], s: [1.4, 0.7, 0.9], r: [0.5, 0, 0] }); // chỏm mái vuốt lên
      break;
    case 'braid':
      // Tóc dài tết lệch một bên, vắt qua vai trước
      hairCap(head, c, 1.02);
      mesh(head, G.sphere(0.11, 10, 8), c, { p: [-0.05, 0.35, 0.15], s: [1.6, 0.55, 0.8] });
      for (let i = 0; i < 5; i++) mesh(head, G.sphere(0.062 - i * 0.004, 8, 6), c, { p: [0.19 + i * 0.006, 0.08 - i * 0.085, 0.04 + i * 0.03] });
      mesh(head, G.sphere(0.035, 8, 6), accent, { p: [0.22, -0.34, 0.18] }); // dây buộc đuôi tết
      break;
    case 'wavy':
      // Tóc dài uốn sóng: nhiều lọn tròn rủ xuống vai
      hairCap(head, c, 1.04);
      mesh(head, G.sphere(0.11, 10, 8), c, { p: [0.06, 0.35, 0.15], s: [1.6, 0.55, 0.8], r: [0, 0, -0.15] });
      for (let i = 0; i < 7; i++) {
        const a = -1.2 + (i / 6) * 2.4;
        mesh(head, G.sphere(0.085, 10, 8), c, { p: [Math.sin(a) * 0.2, 0.0 - Math.abs(Math.sin(a * 2)) * 0.05 - (i % 2) * 0.05, -0.12 + Math.cos(a) * -0.06] });
      }
      for (const side of [-1, 1]) mesh(head, G.capsule(0.06, 0.16), c, { p: [side * 0.21, 0.07, 0.05], r: [0, 0, side * 0.1] });
      break;
    default: // short
      hairCap(head, c, 1.0);
      mesh(head, G.sphere(0.1, 10, 8), c, { p: [0.07, 0.36, 0.15], s: [1.4, 0.6, 0.8] }); // mái tóc
  }
}

// ---------- Dáng người ngẫu nhiên (tất định theo seed) ----------

const GREY = [0xd9d9d9, 0xeeeeee, 0xbfbfbf];
const ACCENTS = [0xe2574c, 0xf2b23e, 0x3f7fd9, 0xe8739a, 0x5fae57];
function hash(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/**
 * Dáng cho khách vãng lai / người đi chợ: seed cố định cho cùng một người (vd id nhóm × 10 + vị trí).
 * `member` = vị trí trong nhóm: người dẫn đầu (0) không phải trẻ em, người thứ 3 trở đi hay là trẻ em (đi cùng gia đình).
 * Trả về cả màu tóc (người già tóc bạc).
 */
export function randomShape(seed: number, member = 0, look?: Look): { shape: Shape; look?: Look } {
  const r = (k: number) => hash(seed * 31 + k);
  const kidChance = member === 0 ? 0 : member >= 2 ? 0.4 : 0.15;
  const b = r(1);
  const build: PersonBuild = b < kidChance ? 'kid' : b < kidChance + 0.12 ? 'teen' : b > 0.88 ? 'elder' : 'adult';
  const width = build === 'kid' ? 0.92 + r(2) * 0.18 : 0.85 + r(2) * 0.45;
  const height = 0.93 + r(3) * 0.15;
  const pool: HairStyle[] =
    build === 'kid' ? ['short', 'spiky', 'twin', 'pony', 'bob', 'curly']
    : build === 'elder' ? ['bald', 'short', 'bun', 'side', 'curly']
    : ['short', 'spiky', 'long', 'bob', 'pony', 'bun', 'side', 'curly'];
  const hair = pool[Math.floor(r(4) * pool.length)];
  const accent = ACCENTS[Math.floor(r(5) * ACCENTS.length)];
  const greyLook = build === 'elder' && look ? { ...look, hair: GREY[Math.floor(r(6) * GREY.length)] } : look;
  return { shape: { build, width, height, hair, accent }, look: greyLook };
}

/** Như `randomShape` nhưng luôn là người lớn (người bán hàng, nhân viên). */
export function adultShape(seed: number, hairs: HairStyle[] = ['short', 'side', 'bob', 'pony', 'bun', 'spiky']): Shape {
  const r = (k: number) => hash(seed * 17 + k);
  return { width: 0.88 + r(1) * 0.38, height: 0.95 + r(2) * 0.1, hair: hairs[Math.floor(r(3) * hairs.length)], accent: ACCENTS[Math.floor(r(4) * ACCENTS.length)] };
}

/** Bác nông dân: người lớn, hơi đậm người, thấp đậm. */
export const FARMER_SHAPE: Shape = { width: 1.18, height: 0.97 };

// ---------- Đồ mặc theo mùa ----------

/** Đồ mặc theo mùa / thời tiết cho mọi người trong cảnh: Stage đặt mỗi khung hình, animatePerson đọc. */
export const wardrobe = { winter: false, rain: false };

/**
 * Gắn cây dù (ẩn sẵn) vào tay phải - chỉ người đứng ngoài trời (chợ) mới gắn. Trời mưa (`wardrobe.rain`) thì
 * animatePerson giơ tay cầm dù lên che đầu.
 */
export function addUmbrella(person: THREE.Object3D, color: number): void {
  const rig = person.userData.rig as Rig | undefined;
  if (!rig) return;
  // Tay giơ ra trước UMBRELLA_ARM rad nên xoay ngược lại để cán dù đứng thẳng
  const u = group(rig.armR, { p: [0, -0.27, 0], r: [-UMBRELLA_ARM, 0, 0] });
  mesh(u, G.cyl(0.018, 0.018, 1.15, 6), 0x5a3b2a, { p: [0, 0.55, 0] });
  mesh(u, G.cone(0.62, 0.3, 12), color, { p: [0, 1.25, 0] });
  mesh(u, G.sphere(0.035, 6, 5), color, { p: [0, 1.42, 0] });
  u.visible = false;
  person.userData.umbrella = u;
}
const UMBRELLA_ARM = -1.0;
export const UMBRELLA_COLORS = [0xe2574c, 0x3f7fd9, 0xf2b23e, 0x5fae57, 0x9a6bd1, 0xe8739a, 0x3fb6a8];

// ---------- Cử động ----------

/** Tư thế cho animatePerson. Các giá trị số là cường độ 0..1. */
export interface Pose {
  /** Đang đi bộ. */
  walk?: number;
  /** Đang ngồi ghế. */
  sit?: boolean;
  /** Cầm lái (xe máy, máy cày): hai tay vươn tới trước nắm tay lái, người hơi chồm tới. Dùng kèm sit. */
  ride?: boolean;
  /** Chặt / thái thịt: tay phải cầm dao giơ lên bổ xuống thớt theo nhịp, tay trái giữ miếng thịt, cúi nhìn thớt (0..1). */
  chop?: number;
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
  /** Lau nhà: hai tay cầm cán đưa ra trước, đẩy qua đẩy lại, người hơi cúi (0..1). */
  mop?: number;
  /** Cúi xuống đất: gieo hạt / nhổ thu hoạch / cho con vật ăn (0..1). */
  reach?: number;
}

type PoseKey = 'walk' | 'sit' | 'cook' | 'eat' | 'wave' | 'carry' | 'dig' | 'pour' | 'mop' | 'reach' | 'ride' | 'chop';
const POSE_KEYS: PoseKey[] = ['walk', 'sit', 'cook', 'eat', 'wave', 'carry', 'dig', 'pour', 'mop', 'reach', 'ride', 'chop'];

/**
 * Làm mượt tư thế: mỗi người giữ cường độ hiện tại của từng tư thế và trượt dần về tư thế mới
 * (đang đi dừng lại, ngồi xuống, đứng dậy... không còn giật cục).
 */
function smoothPose(g: THREE.Object3D, t: number, pose: Pose): Record<PoseKey, number> {
  const ud = g.userData;
  const s = (ud.poseS ??= {}) as Record<PoseKey, number>;
  const last = ud.poseT as number | undefined;
  const dt = last == null ? 1 : Math.min(0.25, Math.max(0, t - last));
  ud.poseT = t;
  const k = last == null ? 1 : 1 - Math.exp(-dt * 9);
  for (const key of POSE_KEYS) {
    const v = pose[key];
    const target = typeof v === 'boolean' ? (v ? 1 : 0) : (v ?? 0);
    // Ngồi xuống / đứng dậy nhanh hơn chút để khỏi trôi qua ghế
    const kk = key === 'sit' && last != null ? 1 - Math.exp(-dt * 14) : k;
    s[key] = s[key] == null ? target : s[key] + (target - s[key]) * kk;
  }
  return s;
}

const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** Cử động người theo thời gian t (giây thực): thở, chớp mắt, nhìn quanh, dồn trọng tâm + tư thế. */
export function animatePerson(g: THREE.Object3D, t: number, pose: Pose = {}): void {
  const rig = g.userData.rig as Rig | undefined;
  if (!rig) return;
  // Tối ưu: lần cử động đầu tiên (người đã dựng xong cả trang phục, phụ kiện) thì gộp mesh cùng vật liệu trên từng bộ phận
  if (!g.userData.partsMerged) {
    g.userData.partsMerged = true;
    mergeParts([rig.body, rig.head, rig.armL, rig.armR, rig.legL, rig.legR]);
  }
  const scarf = g.userData.scarf as THREE.Object3D | undefined;
  if (scarf) scarf.visible = wardrobe.winter;
  const umbrella = g.userData.umbrella as THREE.Object3D | undefined;
  const holding = !!umbrella && wardrobe.rain;
  if (umbrella) umbrella.visible = holding;
  const p = smoothPose(g, t, pose);
  const k = t + rig.seed;
  const { walk, cook, wave, dig, pour, reach, mop, sit, eat, carry, ride, chop: chopping } = p;
  const chop = Math.sin(t * 9); // nhịp bổ cuốc
  const phase = t * rig.stepRate + rig.seed;

  // Thở + chớp mắt (mỗi ~3.7 giây, vài người thỉnh thoảng chớp đôi)
  rig.body.scale.set(1, 1 + Math.sin(k * 2.3) * 0.025, 1);
  const cycle = (k * 1.3) % 4.8;
  const blink = cycle < 0.13 || (rig.seed > 5 && cycle > 0.25 && cycle < 0.36);
  for (const eye of rig.eyes) eye.scale.y = blink ? 0.12 : 1;

  // Gốc: nhún theo bước chân, lắc hông nhẹ; đứng yên thì dồn trọng tâm qua lại thật chậm; ngồi thì nâng hông lên mặt ghế
  const still = (1 - walk) * (1 - sit);
  rig.root.position.y = Math.abs(Math.sin(phase)) * 0.045 * walk + rig.sitLift * sit;
  rig.root.rotation.z = Math.sin(phase) * 0.05 * walk + Math.sin(k * 0.5) * 0.025 * still;
  rig.root.rotation.y = Math.sin(phase) * 0.06 * walk;
  rig.shadow.visible = sit < 0.5;

  // Đầu: nhìn quanh chậm rãi (thỉnh thoảng ngoái hẳn sang một bên); khi làm việc thì cúi xuống
  const busy = Math.max(cook, dig, pour, reach, mop);
  const glance = Math.sin(k * 0.45) * 0.3 + Math.max(0, Math.sin(k * 0.17) - 0.8) * 2.2 * Math.sign(Math.sin(k * 0.07));
  rig.head.rotation.y = glance * (1 - walk) * (1 - busy);
  rig.head.rotation.x = Math.max(cook * 0.3, chopping * 0.4, dig * 0.25, pour * 0.35, reach * 0.45, mop * 0.25) + Math.sin(k * 0.7) * 0.04 - Math.abs(Math.sin(phase)) * 0.05 * walk;
  rig.head.rotation.z = Math.sin(k * 0.33) * 0.06 - rig.root.rotation.z * 0.6;

  // Chân: đi thì bước luân phiên, ngồi thì duỗi ra trước (đung đưa nhẹ chân như trẻ con ngồi ghế cao)
  const step = Math.sin(phase) * 0.65 * walk;
  const dangle = Math.sin(k * 2.1) * 0.08 * sit;
  rig.legL.rotation.x = -1.45 * sit + step + dangle;
  rig.legR.rotation.x = -1.45 * sit - step - dangle;

  // Tay: đung đưa khi đứng, vung ngược chân khi đi, các tư thế làm việc trộn theo cường độ
  const idle = Math.sin(k * 1.6) * 0.06;
  let left = -step * 0.8 + idle - cook * 0.9 - sit * 0.35;
  let right = step * 0.8 - idle - cook * (0.9 + Math.sin(t * 14) * 0.35) - sit * 0.35;
  // Hai tay hơi dang ra ngoài (tay trái ở phía −x xoay âm, tay phải ở phía +x xoay dương), đi thì dang thêm chút
  let leftZ = -0.18 - 0.06 * walk;
  let rightZ = 0.18 + 0.06 * walk;
  right = mix(right, -1.9 + Math.max(0, Math.sin(k * 3)) * 0.9, eat); // múc rồi đưa lên miệng
  left = mix(left, -1.25 + Math.sin(phase) * 0.04 * walk, carry);
  right = mix(right, -1.25 - Math.sin(phase) * 0.04 * walk, carry);
  if (dig > 0.001) {
    // Hai tay cùng cầm cán cuốc: giơ cao rồi bổ xuống trước mặt
    const swing = -1.5 - chop * 1.1;
    left = mix(left, swing, dig);
    right = mix(right, swing, dig);
  }
  if (pour > 0.001) {
    left = mix(left, -0.3, pour);
    right = mix(right, -1.35 + Math.sin(t * 5) * 0.15, pour);
  }
  if (reach > 0.001) {
    // Cúi gập, hai tay với xuống đất, nhặt lên đặt xuống luân phiên
    left = mix(left, -0.9 + Math.sin(t * 7) * 0.35, reach);
    right = mix(right, -0.9 - Math.sin(t * 7) * 0.35, reach);
  }
  if (mop > 0.001) {
    // Hai tay nắm cán cây lau nhà trước bụng, đẩy tới kéo lui theo nhịp lau
    const push = Math.sin(t * 7) * 0.25;
    left = mix(left, -0.95 + push, mop);
    right = mix(right, -0.75 + push, mop);
  }
  if (chopping > 0.001) {
    // Nhịp chặt: giơ dao chậm, bổ xuống nhanh (sin bình phương cho cú bổ dứt khoát)
    const lift = Math.max(0, Math.sin(t * 5.5)) ** 2;
    right = mix(right, -0.75 - lift * 1.5, chopping);
    left = mix(left, -0.95, chopping);
    leftZ = mix(leftZ, 0.12, chopping);
  }
  if (ride > 0.001) {
    // Hai tay duỗi tới trước, hơi khép vào trong để bàn tay nằm đúng hai đầu tay lái
    left = mix(left, -1.25, ride);
    right = mix(right, -1.25, ride);
    leftZ = mix(leftZ, -0.04, ride);
    rightZ = mix(rightZ, 0.04, ride);
  }
  if (wave > 0.001) {
    right = mix(right, -2.6, wave);
    rightZ = mix(rightZ, -0.68 + Math.sin(t * 12) * 0.35, wave); // góc vẫy giữ như cũ
  }
  if (holding) {
    // Cầm dù: tay phải giơ cố định trước ngực (không vẫy, không đung đưa)
    right = UMBRELLA_ARM;
    rightZ = -0.18;
  }
  rig.armL.rotation.x = left;
  rig.armR.rotation.x = right;
  rig.armL.rotation.z = leftZ;
  rig.armR.rotation.z = rightZ;
  // Nghiêng người tới trước: đi, nấu, bổ cuốc theo nhịp, cúi xuống đất; người già hơi khom
  rig.body.rotation.x = walk * 0.08 + cook * 0.12 + dig * (0.18 + Math.max(0, -chop) * 0.22) + pour * 0.1 + reach * 0.55 + mop * 0.22 + ride * 0.14 + chopping * 0.15 + ((g.userData.hunch as number | undefined) ?? 0);
  rig.body.rotation.y = -rig.root.rotation.y * 1.4; // vai xoay ngược hông khi bước
}
