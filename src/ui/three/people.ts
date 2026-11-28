import * as THREE from 'three';
import type { HairStyle, PersonStyle } from '../../data';
import type { OwnerProfile } from '../../sim/state';
import { makePerson, rimify, type Rig } from './models';
import { emojiSprite, G, group, mesh, toon } from './toon';
import { addHelmet, makeScooter } from './farmkit';

/**
 * KHÁCH QUEN - dựng từ makePerson rồi đổi dáng, tóc, quần/váy và gắn phụ kiện.
 * Khách vãng lai chỉ dùng makePerson cơ bản (không phụ kiện), nên phụ kiện là dấu hiệu nhận ra khách quen.
 */

export function makeRegular(style: PersonStyle): THREE.Group {
  // Dáng (trẻ em / thiếu niên / người lớn / người già), kiểu tóc: dựng sẵn trong makePerson
  const g = makePerson({ shirt: style.shirt, hair: style.hairColor, skin: style.skin }, 'none', { build: style.build, hair: style.hair, accent: style.accent, width: style.width });
  const rig = g.userData.rig as Rig;
  const { body } = rig;

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

  for (const a of style.acc) accessory(rig, a, style);
  rimify(g);
  return g;
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

// ---------- Ông / bà chủ quán ----------

const mixHex = (a: number, b: number, k: number) => {
  const c = new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, k)));
  return c.getHex();
};

/**
 * Ông / bà chủ quán theo giới tính + tuổi (25..50): 25 trẻ trung (tóc tạo kiểu, dáng thon), 35 chững chạc,
 * 50 hơi có tuổi (tóc muối tiêu, người đậm hơn, kính lão, ông chủ để ria). Đồ đứng chủ: ông áo gi-lê sẫm, bà áo
 * kiểu + váy; huy hiệu vàng trên ngực để nhận ra giữa khách.
 */
export function makeOwner(o: OwnerProfile): THREE.Group {
  const k = (o.age - 25) / 25; // 0 trẻ … 1 có tuổi
  const female = o.gender === 'female';
  const hairColor = mixHex(female ? 0x3a2418 : 0x221a16, 0xb9b4ae, (k - 0.45) * 1.3);
  const autoHair: HairStyle = female ? (o.age < 31 ? 'pony' : o.age < 42 ? 'bob' : 'bun') : o.age < 31 ? 'spiky' : o.age < 42 ? 'side' : 'short';
  const hair = o.hair && o.hair !== 'auto' ? (o.hair as HairStyle) : autoHair;
  const outfit = o.outfit && o.outfit !== 'auto' ? o.outfit : female ? 'blouse' : 'vest';
  const acc: PersonStyle['acc'] = [];
  if (o.age >= 44) acc.push('readingGlasses');
  if (!female && o.age >= 40) acc.push('mustache');
  // Bộ quần áo: màu áo, quần / váy, phụ kiện
  const OUT: Record<string, Pick<PersonStyle, 'shirt' | 'bottom' | 'bottomColor' | 'accent'> & { jacket?: boolean }> = {
    vest: { shirt: 0xf4f1ea, bottom: 'pants', bottomColor: 0x34384a, accent: 0x2f4f6f, jacket: true },
    blouse: { shirt: 0xd9566b, bottom: 'skirt', bottomColor: 0x3b3f63, accent: 0xf2b23e },
    tee: { shirt: 0x3fb6a8, bottom: 'pants', bottomColor: 0x3d5f8f, accent: 0xf2b23e },
    polo: { shirt: 0x5fae57, bottom: 'pants', bottomColor: 0xc9b28a, accent: 0xffffff },
    apron: { shirt: 0xf6efe0, bottom: 'pants', bottomColor: 0x5a3e2b, accent: 0x8a5a35 },
    aodai: { shirt: female ? 0xd9435f : 0x2f5f9f, bottom: 'pants', bottomColor: 0xffffff, accent: 0xf2c14e },
  };
  const out = OUT[outfit] ?? OUT.vest;
  if (out.jacket) acc.push('jacket');
  const g = makeRegular({ build: 'adult', hair, hairColor, skin: 0xf6cfa8, shirt: out.shirt, bottom: out.bottom, bottomColor: out.bottomColor, acc, accent: out.accent, width: 0.95 + k * 0.22 });
  const rig = g.userData.rig as Rig;
  if (outfit === 'apron') {
    mesh(rig.body, G.box(0.36, 0.46, 0.04), 0x8a5a35, { p: [0, 0.1, 0.2] }); // tạp dề nâu
    mesh(rig.body, G.box(0.16, 0.08, 0.02), 0xf2c14e, { p: [0, 0.12, 0.225], cast: false }); // túi
  } else if (outfit === 'aodai') {
    // Vạt áo dài trước / sau rủ xuống gần gối, cổ đứng
    for (const z of [0.12, -0.12]) mesh(rig.body, G.box(0.3, 0.42, 0.03), out.shirt, { p: [0, -0.2, z] });
    mesh(rig.body, G.cyl(0.09, 0.1, 0.07, 12), out.shirt, { p: [0, 0.5, 0] });
    mesh(rig.body, G.box(0.04, 0.3, 0.02), out.accent, { p: [0.08, 0.3, 0.2], cast: false }); // đường viền nút
  } else if (outfit === 'polo') {
    for (const side of [-1, 1]) mesh(rig.body, G.box(0.1, 0.03, 0.08), out.shirt, { p: [side * 0.06, 0.48, 0.13], r: [0.5, 0, side * 0.4] }); // cổ áo
  }
  mesh(rig.body, G.cyl(0.045, 0.045, 0.02, 10), 0xf2c14e, { p: [-0.1, 0.36, 0.215], r: [Math.PI / 2, 0, 0], cast: false }); // huy hiệu chủ quán
  return g;
}

// ---------- Nhân viên phục vụ thuê ----------

const HELPER_SHIRTS = [0x5fae57, 0xe2703a, 0x9a6bd1, 0x3fb6a8];
const HELPER_HAIRS = [0x3a2a1e, 0x1f1a17, 0x6b3f22, 0x2a1f1a];

/**
 * Nhân viên phục vụ: áo theo người + tạp dề trắng + mũ lưỡi trai vàng. `manager` (từ 2 nhân viên, người thuê đầu tiên):
 * bộ vest xanh than, sơ mi trắng, cà vạt đỏ, bảng tên vàng - không tạp dề, không mũ.
 */
export function makeHelperPerson(look: number, manager: boolean, adultShape: (seed: number, hairs: HairStyle[]) => object): THREE.Group {
  const hairs: HairStyle[] = ['short', 'side', 'pony', 'bob'];
  const skin = look % 2 ? 0xf2c49b : 0xffd9b8;
  if (manager) {
    const shape = adultShape(look * 7 + 3, hairs) as { hair?: HairStyle; width?: number; height?: number };
    const g = makeRegular({ build: 'adult', hair: shape.hair ?? 'side', hairColor: HELPER_HAIRS[look % 4], skin, shirt: 0xf6f3ec, bottom: 'pants', bottomColor: 0x262b3d, acc: ['jacket'], accent: 0x2b3350, width: shape.width ?? 1 });
    const rig = g.userData.rig as Rig;
    // Ve áo mở chữ V khoe sơ mi trắng + cà vạt đỏ, bảng tên vàng
    mesh(rig.body, G.box(0.12, 0.22, 0.02), 0xf6f3ec, { p: [0, 0.36, 0.215], cast: false });
    mesh(rig.body, G.box(0.045, 0.2, 0.02), 0xc9343a, { p: [0, 0.33, 0.228], cast: false });
    mesh(rig.body, G.box(0.1, 0.04, 0.015), 0xf2c14e, { p: [0.12, 0.38, 0.222], cast: false });
    return g;
  }
  const g = makePerson({ shirt: HELPER_SHIRTS[look % 4], hair: HELPER_HAIRS[look % 4], skin }, 'none', adultShape(look * 7 + 3, hairs));
  const rig = g.userData.rig as Rig;
  mesh(rig.body, G.box(0.36, 0.34, 0.05), 0xffffff, { p: [0, 0.14, 0.18] }); // tạp dề
  mesh(rig.head, G.box(0.42, 0.06, 0.3), 0xf2b23e, { p: [0, 0.36, 0.06], r: [-0.2, 0, 0] }); // mũ vàng
  return g;
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

/** Bồi bàn (nhân vật của người chơi): áo xanh, tạp dề trắng, mũ lưỡi trai đỏ. Cảnh quán gắn thêm vòng sáng dưới chân + tay cầm món. */
export function makeWaiter(): THREE.Group {
  const g = makePerson({ shirt: 0x3f8fd2, hair: 0x2a1f1a, skin: 0xffd9b8 });
  const rig = g.userData.rig;
  mesh(rig.body, G.box(0.36, 0.34, 0.05), 0xffffff, { p: [0, 0.14, 0.18] }); // tạp dề
  mesh(rig.head, G.box(0.42, 0.06, 0.3), 0xe2574c, { p: [0, 0.36, 0.06], r: [-0.2, 0, 0] }); // mũ lưỡi trai đỏ
  return g;
}

/** Công an khu vực (quán ốc): quân phục xanh lá đậm, mũ kê-pi quai đỏ + sao vàng, cầu vai đỏ, thắt lưng. */
export function makePolice(): THREE.Group {
  const p = makePerson({ shirt: 0x6f7d3a, hair: 0x1f1a17, skin: 0xf2c49b }, 'none', { width: 1.08, hair: 'short' });
  const rig = p.userData.rig;
  const cap = group(rig.head, { p: [0, 0.3, 0.01] });
  mesh(cap, G.cyl(0.25, 0.22, 0.12, 14), 0x5c6a2e, { p: [0, 0.04, 0] });
  mesh(cap, G.cyl(0.29, 0.29, 0.03, 16), 0x5c6a2e, { p: [0, 0.12, 0.02], s: [1, 1, 1.08] });
  mesh(cap, G.box(0.3, 0.04, 0.02), 0xc9343a, { p: [0, 0.03, 0.235], cast: false });
  mesh(cap, G.box(0.24, 0.025, 0.12), 0x2b2b2b, { p: [0, -0.02, 0.24], r: [0.25, 0, 0] });
  const star = emojiSprite('⭐', 0.13);
  star.position.set(0, 0.07, 0.26);
  cap.add(star);
  for (const side of [-1, 1]) mesh(rig.body, G.box(0.1, 0.03, 0.16), 0xc9343a, { p: [side * 0.2, 0.47, 0] }); // cầu vai
  mesh(rig.body, G.box(0.42, 0.05, 0.3), 0x3a2a1e, { p: [0, -0.02, 0] }); // thắt lưng
  p.scale.setScalar(1.1);
  return p;
}

/** Anh shipper: áo + mũ bảo hiểm xanh lá, thùng giao hàng sau lưng. */
export function makeShipper(): THREE.Group {
  const person = makePerson({ shirt: 0x2fa84f, hair: 0x2a1f1a, skin: 0xf2c49b }, 'none', { width: 1.0 });
  addHelmet(person.userData.rig.head, 0x2fa84f); // mũ bảo hiểm xanh
  mesh(person.userData.rig.body, G.box(0.34, 0.36, 0.26), 0x2fa84f, { p: [0, 0.28, -0.24] }); // thùng giao hàng sau lưng
  person.scale.setScalar(1.1);
  return person;
}

/** Xe máy giao hàng của anh shipper (thùng hàng trên baga), người lái ẩn khi xe đậu. */
export function makeShipperBike(): THREE.Group {
  const rider = makePerson({ shirt: 0x2fa84f, hair: 0x2a1f1a, skin: 0xf2c49b });
  rider.visible = false;
  const bike = makeScooter(0x2fa84f, rider);
  // Thùng giao hàng trên baga: thân xanh, nắp viền đậm, dải trắng + logo túi hàng hai bên
  const box = group(bike, { p: [-0.6, 0.76, 0] });
  mesh(box, G.box(0.46, 0.4, 0.46), 0x2fa84f, { p: [0, 0.2, 0] });
  mesh(box, G.box(0.48, 0.06, 0.48), 0x23803c, { p: [0, 0.41, 0] });
  mesh(box, G.box(0.47, 0.07, 0.47), 0xf3f3f3, { p: [0, 0.24, 0], cast: false });
  for (const s of [-1, 1]) mesh(box, G.box(0.14, 0.12, 0.01), 0xf3f3f3, { p: [0, 0.12, s * 0.236], cast: false });
  mesh(box, G.box(0.03, 0.03, 0.3), 0x2a2d35, { p: [0.2, 0.36, 0], cast: false }); // dây ràng
  return bike;
}

/**
 * Nhân viên trực quầy cashier (giai đoạn 18) - trang phục theo văn hoá quán:
 * quán Việt áo dài (tà trước / tà sau dài, cổ đứng, quần trắng), quán Hàn hanbok (áo jeogori ngắn + nơ goreum đỏ,
 * váy chima phồng từ ngực chấm đất), quán Nhật kimono (áo dài tới mắt cá, đai obi + nơ sau lưng, cổ chéo trắng,
 * tay áo rộng), quán ốc vỉa hè: áo thun quần jean, đeo túi bao tử đựng tiền.
 */
export function makeCashierStaff(cuisine: string): THREE.Group {
  const skin = 0xffd9b8;
  const whiteLegs = (rig: Rig, color: number) => {
    for (const leg of [rig.legL, rig.legR]) (leg.children[0] as THREE.Mesh).material = toon(color);
  };
  if (cuisine === 'vn') {
    const red = 0xc8323a;
    const gold = 0xf2c14e;
    const g = makePerson({ shirt: red, hair: 0x1f1a17, skin }, 'none', { hair: 'long', width: 0.92 });
    const rig = g.userData.rig as Rig;
    whiteLegs(rig, 0xf6f3ec);
    // Tà trước + tà sau dài tới bắp chân, xẻ hai bên hông
    for (const sz of [-1, 1]) mesh(rig.body, G.box(0.28, 0.27, 0.025), red, { p: [0, -0.08, sz * 0.165], r: [sz * 0.06, 0, 0] });
    mesh(rig.body, G.cyl(0.1, 0.11, 0.07, 12), red, { p: [0, 0.5, 0] }); // cổ đứng
    mesh(rig.body, G.torus(0.105, 0.012, 4, 14), gold, { p: [0, 0.53, 0], r: [Math.PI / 2, 0, 0], cast: false });
    // Hoa văn vàng trên ngực + vạt
    for (const [x, y] of [[0.06, 0.34], [-0.05, 0.26], [0.08, 0.16], [-0.07, -0.02], [0.05, -0.1]] as const) mesh(rig.body, G.sphere(0.025, 6, 5), gold, { p: [x, y, y > 0.05 ? 0.2 : 0.18], cast: false });
    rimify(g);
    return g;
  }
  if (cuisine === 'kr') {
    const g = makePerson({ shirt: 0xfff1c2, hair: 0x2a1f1a, skin }, 'none', { hair: 'bun', width: 0.9 });
    const rig = g.userData.rig as Rig;
    // Tay áo sọc màu (saekdong)
    for (const arm of [rig.armL, rig.armR]) for (const [y, c] of [[-0.08, 0xe86a8a], [-0.14, 0x6cb8f6], [-0.2, 0x7ed36f]] as const) mesh(arm, G.torus(0.062, 0.018, 4, 10), c, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], cast: false });
    // Váy chima phồng từ dưới ngực chấm đất (che chân), dải ngực
    mesh(rig.body, G.cone(0.42, 0.72, 16), 0xe8607e, { p: [0, 0.0, 0] });
    mesh(rig.body, G.cyl(0.205, 0.205, 0.06, 16), 0xd94c6c, { p: [0, 0.35, 0] });
    // Nơ goreum đỏ trước ngực
    mesh(rig.body, G.sphere(0.04, 8, 6), 0xc9343a, { p: [0.04, 0.44, 0.19], cast: false });
    for (const [x, r] of [[0.02, 0.15], [0.08, -0.1]] as const) mesh(rig.body, G.box(0.04, 0.22, 0.015), 0xc9343a, { p: [x, 0.32, 0.2], r: [0, 0, r], cast: false });
    // Trâm cài tóc (binyeo)
    mesh(rig.head, G.cyl(0.012, 0.012, 0.34, 5), 0xf2c14e, { p: [0, 0.36, -0.2], r: [0, 0, Math.PI / 2], cast: false });
    for (const leg of [rig.legL, rig.legR]) leg.visible = false;
    rimify(g);
    return g;
  }
  if (cuisine === 'jp') {
    const indigo = 0x3f6fb0;
    const g = makePerson({ shirt: indigo, hair: 0x1f1a17, skin: 0xffe1c7 }, 'none', { hair: 'bun', width: 0.9 });
    const rig = g.userData.rig as Rig;
    // Thân kimono dài tới mắt cá (che chân), hoa anh đào điểm trên vải
    mesh(rig.body, G.cyl(0.215, 0.23, 0.34, 14), indigo, { p: [0, -0.13, 0] });
    for (const [x, y, z] of [[0.1, -0.05, 0.19], [-0.12, -0.18, 0.18], [0.05, -0.24, 0.2], [-0.08, 0.3, 0.19], [0.13, 0.4, 0.15]] as const) mesh(rig.body, G.sphere(0.03, 6, 5), 0xf4b6c8, { p: [x, y, z], s: [1, 1, 0.4], cast: false });
    // Đai obi đỏ + nơ sau lưng
    mesh(rig.body, G.cyl(0.225, 0.225, 0.13, 16), 0xd9433a, { p: [0, 0.16, 0] });
    mesh(rig.body, G.box(0.26, 0.14, 0.08), 0xf2c14e, { p: [0, 0.18, -0.24] });
    mesh(rig.body, G.box(0.12, 0.2, 0.06), 0xd9433a, { p: [0, 0.12, -0.27], cast: false });
    // Cổ áo chéo trắng
    for (const s of [-1, 1]) mesh(rig.body, G.box(0.04, 0.2, 0.02), 0xf6f3ec, { p: [s * 0.035, 0.4, 0.19], r: [0.1, 0, -s * 0.45], cast: false });
    // Tay áo rộng thõng xuống
    for (const arm of [rig.armL, rig.armR]) mesh(arm, G.box(0.13, 0.22, 0.2), indigo, { p: [0, -0.16, 0] });
    // Trâm hoa trên búi tóc
    mesh(rig.head, G.sphere(0.045, 8, 6), 0xf08fb0, { p: [0.12, 0.42, -0.12], cast: false });
    for (const leg of [rig.legL, rig.legR]) leg.visible = false;
    rimify(g);
    return g;
  }
  // Quán ốc vỉa hè: giản dị - áo thun, quần jean, túi bao tử đựng tiền thối
  const g = makePerson({ shirt: 0x4a9bd8, hair: 0x3a2a1e, skin: 0xf2c49b }, 'none', { hair: 'pony' });
  const rig = g.userData.rig as Rig;
  whiteLegs(rig, 0x3a4a6a);
  mesh(rig.body, G.box(0.26, 0.1, 0.08), 0x2a2d35, { p: [0.04, 0.05, 0.2], r: [0, 0, -0.12] });
  mesh(rig.body, G.box(0.44, 0.025, 0.42), 0x2a2d35, { p: [0, 0.07, 0], r: [0, 0, -0.12], cast: false });
  rimify(g);
  return g;
}
