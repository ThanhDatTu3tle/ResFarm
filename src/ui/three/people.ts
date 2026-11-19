import * as THREE from 'three';
import type { PersonStyle } from '../../data';
import { makePerson, type Rig } from './models';
import { G, group, mesh, toon } from './toon';

/**
 * KHÁCH QUEN — dựng từ makePerson rồi đổi dáng, tóc, quần/váy và gắn phụ kiện.
 * Khách vãng lai chỉ dùng makePerson cơ bản (không phụ kiện), nên phụ kiện là dấu hiệu nhận ra khách quen.
 */

/** Tỉ lệ toàn thân theo dáng người. */
const BUILD_SCALE: Record<PersonStyle['build'], number> = { kid: 0.74, teen: 0.9, adult: 1.02, elder: 0.96 };

export function makeRegular(style: PersonStyle): THREE.Group {
  const g = makePerson({ shirt: style.shirt, hair: style.hairColor, skin: style.skin });
  const rig = g.userData.rig as Rig;
  const { head, body } = rig;
  g.scale.setScalar(BUILD_SCALE[style.build]);
  // Trẻ em: đầu to hơn nữa cho đáng yêu
  if (style.build === 'kid') head.scale.setScalar(1.12);
  // Người già: lưng hơi khom (animatePerson đặt rotation.x của body nên khom bằng group cha)
  if (style.build === 'elder') g.userData.hunch = 0.16;

  // Quần / váy: tô lại chân, váy thì thêm vạt váy quanh hông
  for (const leg of [rig.legL, rig.legR]) {
    const pants = leg.children[0] as THREE.Mesh;
    pants.material = toon(style.bottomColor);
    if (style.bottom === 'skirt' || style.bottom === 'shorts') {
      // Chân trần phía dưới: đổi phần quần thành màu da, váy / quần đùi che phần trên
      pants.material = toon(style.skin);
      if (style.bottom === 'shorts') mesh(leg, G.capsule(0.082, 0.05), style.bottomColor, { p: [0, -0.06, 0] });
    }
  }
  if (style.bottom === 'skirt') mesh(body, G.cone(0.27, 0.26, 12), style.bottomColor, { p: [0, 0.02, 0] });

  hair(head, style);
  for (const a of style.acc) accessory(rig, a, style);
  return g;
}

/** Kiểu tóc: thay phần tóc mặc định của makePerson (2 mesh màu tóc cuối cùng trên đầu). */
function hair(head: THREE.Group, style: PersonStyle): void {
  const c = style.hairColor;
  // makePerson thêm tóc sau miệng: tìm 2 mesh dùng màu tóc rồi bỏ đi để dựng lại theo kiểu
  const hairMeshes = head.children.filter((m) => m instanceof THREE.Mesh && (m.material as THREE.MeshToonMaterial).color?.getHex() === c);
  for (const m of hairMeshes.slice(-2)) head.remove(m);
  switch (style.hair) {
    case 'bald':
      // Hói: chỉ còn viền tóc hai bên và sau gáy
      for (const side of [-1, 1]) mesh(head, G.sphere(0.09, 10, 8), c, { p: [side * 0.2, 0.2, -0.06], s: [0.6, 1, 1.2] });
      mesh(head, G.sphere(0.12, 10, 8), c, { p: [0, 0.18, -0.17], s: [1.5, 0.8, 0.6] });
      break;
    case 'spiky':
      mesh(head, G.sphere(0.245), c, { p: [0, 0.26, -0.04], s: [1, 0.8, 1] });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        mesh(head, G.cone(0.07, 0.16, 6), c, { p: [Math.cos(a) * 0.13, 0.43, Math.sin(a) * 0.13 - 0.03], r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5] });
      }
      break;
    case 'long':
      mesh(head, G.sphere(0.25), c, { p: [0, 0.26, -0.04], s: [1.05, 0.88, 1] });
      mesh(head, G.box(0.42, 0.42, 0.14), c, { p: [0, 0.06, -0.15] });
      break;
    case 'pony':
      mesh(head, G.sphere(0.25), c, { p: [0, 0.27, -0.04], s: [1, 0.85, 1] });
      mesh(head, G.sphere(0.06, 8, 6), style.accent, { p: [0, 0.3, -0.26] }); // dây buộc
      mesh(head, G.capsule(0.07, 0.22), c, { p: [0, 0.14, -0.31], r: [0.35, 0, 0] });
      break;
    case 'twin':
      mesh(head, G.sphere(0.25), c, { p: [0, 0.27, -0.04], s: [1, 0.85, 1] });
      for (const side of [-1, 1]) {
        mesh(head, G.sphere(0.05, 8, 6), style.accent, { p: [side * 0.22, 0.28, -0.05] });
        mesh(head, G.capsule(0.06, 0.16), c, { p: [side * 0.27, 0.15, -0.06], r: [0, 0, side * 0.35] });
      }
      break;
    case 'bun':
      mesh(head, G.sphere(0.25), c, { p: [0, 0.26, -0.04], s: [1, 0.85, 1] });
      mesh(head, G.sphere(0.11, 12, 10), c, { p: [0, 0.48, -0.1] });
      break;
    default:
      mesh(head, G.sphere(0.245), c, { p: [0, 0.26, -0.04], s: [1, 0.85, 1] });
      mesh(head, G.sphere(0.1, 10, 8), c, { p: [0.07, 0.36, 0.15], s: [1.4, 0.6, 0.8] });
  }
}

function accessory(rig: Rig, a: PersonStyle['acc'][number], style: PersonStyle): void {
  const { head, body } = rig;
  const accent = style.accent;
  switch (a) {
    case 'bow':
      for (const side of [-1, 1]) mesh(head, G.cone(0.07, 0.12, 4), accent, { p: [side * 0.07, 0.48, -0.02], r: [0, 0, side * -Math.PI / 2] });
      mesh(head, G.sphere(0.035, 8, 6), accent, { p: [0, 0.48, -0.02] });
      break;
    case 'backpack':
      mesh(body, G.box(0.3, 0.32, 0.14), accent, { p: [0, 0.3, -0.22] });
      mesh(body, G.box(0.24, 0.12, 0.05), 0xffffff, { p: [0, 0.22, -0.3] });
      break;
    case 'capBack':
      mesh(head, G.sphere(0.25, 14, 8), accent, { p: [0, 0.3, -0.02], s: [1, 0.55, 1] });
      mesh(head, G.box(0.26, 0.03, 0.2), accent, { p: [0, 0.32, -0.3], r: [-0.25, 0, 0] }); // lưỡi trai quay ra sau
      break;
    case 'glasses':
    case 'readingGlasses':
      for (const side of [-1, 1]) mesh(head, G.torus(0.055, 0.012, 5, 12), a === 'glasses' ? 0x2a2a2a : 0xb08d57, { p: [side * 0.085, 0.18, 0.225], cast: false });
      mesh(head, G.box(0.06, 0.012, 0.012), 0x2a2a2a, { p: [0, 0.19, 0.228], cast: false });
      break;
    case 'bag':
      mesh(body, G.box(0.04, 0.4, 0.04), accent, { p: [0.12, 0.32, 0.12], r: [0, 0, 0.6] });
      mesh(body, G.box(0.22, 0.18, 0.08), accent, { p: [-0.25, 0.1, 0.05] });
      break;
    case 'helmet':
      mesh(head, G.sphere(0.27, 14, 10), accent, { p: [0, 0.27, -0.03], s: [1, 0.85, 1.05] });
      mesh(head, G.box(0.3, 0.05, 0.06), 0x3a3a3a, { p: [0, 0.27, 0.24] });
      break;
    case 'jacket':
      mesh(body, G.capsule(0.215, 0.22), accent, { p: [0, 0.25, -0.01], s: [1, 1, 0.95] });
      mesh(body, G.box(0.03, 0.4, 0.02), 0xdddddd, { p: [0, 0.26, 0.21] }); // khoá kéo
      break;
    case 'scarf':
      mesh(body, G.torus(0.16, 0.06, 6, 14), accent, { p: [0, 0.47, 0], r: [Math.PI / 2, 0, 0] });
      mesh(body, G.box(0.09, 0.22, 0.05), accent, { p: [0.08, 0.36, 0.17], r: [0, 0, 0.15] });
      break;
    case 'towel':
      mesh(body, G.box(0.13, 0.05, 0.36), accent, { p: [0.19, 0.48, 0], r: [0, 0, -0.35] });
      mesh(body, G.box(0.12, 0.26, 0.04), accent, { p: [0.23, 0.33, 0.15] });
      break;
    case 'beard':
      mesh(head, G.sphere(0.16, 10, 8), style.hairColor, { p: [0, 0.06, 0.13], s: [1.1, 0.75, 0.7] });
      break;
    case 'mustache':
      for (const side of [-1, 1]) mesh(head, G.capsule(0.022, 0.06), style.hairColor === 0xeeeeee ? 0xf4f4f4 : style.hairColor, { p: [side * 0.04, 0.125, 0.22], r: [0, 0, side * 1.2] });
      break;
    case 'fedora':
      mesh(head, G.cyl(0.34, 0.34, 0.03), accent, { p: [0, 0.4, -0.02] });
      mesh(head, G.cyl(0.2, 0.23, 0.17), accent, { p: [0, 0.49, -0.02] });
      mesh(head, G.cyl(0.235, 0.235, 0.04), 0x3a2a1e, { p: [0, 0.43, -0.02] });
      break;
    case 'cane': {
      const cane = group(rig.armR, { p: [0, -0.28, 0.04] });
      mesh(cane, G.cyl(0.02, 0.02, 0.7, 6), accent, { p: [0, -0.28, 0.06] });
      mesh(cane, G.torus(0.05, 0.018, 5, 10, Math.PI), accent, { p: [0, 0.07, 0.11], r: [0, Math.PI / 2, 0] });
      break;
    }
  }
}

// ---------- Thú cưng ----------

/** Mèo hoặc chó nhỏ kiểu chibi; `userData.tail`, `userData.eyes`, `userData.legs` để cử động. */
export function makePet(kind: string): THREE.Group {
  const g = group(null);
  const dog = kind === 'dog';
  const fur = dog ? 0xe0b064 : 0xf0a650;
  const dark = dog ? 0xb98340 : 0xc9762c;
  mesh(g, G.sphere(0.2), fur, { p: [0, 0.24, 0], s: [0.85, 0.8, 1.3] });
  if (!dog) for (const z of [-0.12, 0, 0.12]) mesh(g, G.box(0.3, 0.03, 0.04), dark, { p: [0, 0.39, z], cast: false }); // sọc mèo mướp
  const head = group(g, { p: [0, 0.4, 0.24] });
  mesh(head, G.sphere(0.16), fur);
  mesh(head, G.sphere(0.08, 10, 8), 0xfff3e0, { p: [0, -0.04, 0.12], s: [1.2, 0.8, 0.8] });
  mesh(head, G.sphere(0.025, 6, 5), 0x3a2a1e, { p: [0, -0.01, 0.19], cast: false });
  g.userData.eyes = [-1, 1].map((side) => mesh(head, G.sphere(0.03, 8, 6), 0x2a1f1a, { p: [side * 0.065, 0.04, 0.14], cast: false }));
  for (const side of [-1, 1]) {
    if (dog) mesh(head, G.sphere(0.07, 8, 6), dark, { p: [side * 0.14, 0.02, -0.01], s: [0.6, 1.4, 0.9] }); // tai cụp
    else mesh(head, G.cone(0.06, 0.11, 4), fur, { p: [side * 0.09, 0.15, 0], r: [0, 0, side * -0.3] }); // tai nhọn
  }
  const legs: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) legs.push(mesh(g, G.cyl(0.04, 0.04, 0.16, 6), fur, { p: [sx * 0.09, 0.08, sz * 0.14] }));
  const tail = group(g, { p: [0, 0.3, -0.25] });
  mesh(tail, G.capsule(0.03, dog ? 0.12 : 0.24), dog ? fur : dark, { p: [0, dog ? 0.07 : 0.13, -0.03], r: [-0.5, 0, 0] });
  if (dog) mesh(g, G.torus(0.1, 0.02, 5, 12), 0xe2574c, { p: [0, 0.33, 0.2], r: [Math.PI / 2 - 0.4, 0, 0] }); // vòng cổ
  g.userData.tail = tail;
  g.userData.legs = legs;
  g.userData.head = head;
  return g;
}
