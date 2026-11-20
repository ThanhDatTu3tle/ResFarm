import * as THREE from 'three';
import { signText } from './cuisine';
import type { Env, RainShelter } from './stage';
import { emojiSprite, G, group, mesh, toon } from './toon';

/**
 * QUÁN ỐC VỈA HÈ (CuisineId 'oc'): quán không có tường, WC, kho — thay cho phòng (buildRoom) và gian bếp (buildKitchen)
 * của RestaurantArea. Mặt bằng sim giữ nguyên (bàn, quầy ra món, chỗ bồi bàn đứng), chỉ khác hình:
 *  - nền bê tông lát ô (màu theo "Sàn nhà": bê tông → gạch lề đường đỏ → gạch hoa), bó vỉa, phố phía sau, đường phía trước;
 *  - sạp dù lớn che khu bếp (màu sọc theo "Sơn tường"), mái cao để nhìn rõ bên trong;
 *  - xe đẩy ốc (bếp trưởng), bếp nướng than có ánh lửa (bếp phó), bàn sơ chế cho đầu bếp thuê thêm;
 *  - bảng tên chân đứng bên trái xe đẩy (RestaurantArea.updateNameSign).
 *  - mưa thì mái sạp kéo dài ra che hết sân (bạt hơi trong).
 * Dây đèn vàng ở cuisine.ts (decorateInterior).
 */

export interface StreetDims {
  halfW: number;
  backZ: number;
  frontZ: number;
  kitchenZ: number;
}

export interface StreetMats {
  floorA: THREE.Material;
  floorB: THREE.Material;
  wall: THREE.Material;
  trim: THREE.Material;
}

/** Vị trí khu bếp vỉa hè (mét, toạ độ cảnh quán). */
export function streetSpots(d: StreetDims) {
  const z = d.kitchenZ - 0.85; // mép trước xe đẩy / bếp nướng
  return {
    cart: { x: -2.2, z },
    grill: { x: 0.55, z },
    /** Chỗ đứng đầu bếp (sau xe / bếp, quay mặt ra khách): bếp trưởng, bếp phó, rồi các đầu bếp thuê thêm. */
    chefs: [
      { x: -2.2, z: z - 1.0 },
      { x: 0.55, z: z - 1.0 },
      { x: 2.35, z: z - 1.0 },
      { x: -4.1, z: z - 1.0 },
    ],
    sign: { x: -4.25, z: d.kitchenZ - 0.2 },
  };
}

/** Nền, bó vỉa, đường, dãy nhà phố phía sau. */
export function buildStreetGround(r: THREE.Object3D, d: StreetDims, mats: StreetMats): void {
  const { halfW, backZ, frontZ } = d;
  const depth = frontZ - backZ + 0.6;
  const cz = (frontZ + backZ) / 2;
  mesh(r, G.box(70, 0.2, 60), 0xb9d48a, { p: [0, -0.25, 0], cast: false }); // cỏ xa
  // Vỉa hè rộng hơn khu quán một chút + bó vỉa
  mesh(r, G.box(halfW * 2 + 3, 0.2, depth + 2.4), 0xcfcbc2, { p: [0, -0.1, cz - 0.6], cast: false });
  mesh(r, G.box(halfW * 2 + 3, 0.22, 0.25), 0xe6e2da, { p: [0, -0.05, frontZ + 0.75], cast: false }); // bó vỉa
  mesh(r, G.box(70, 0.18, 7), 0x5c5f66, { p: [0, -0.14, frontZ + 4.4], cast: false }); // lòng đường
  for (let x = -30; x <= 30; x += 3) mesh(r, G.box(1.4, 0.02, 0.15), 0xf3efe6, { p: [x, -0.04, frontZ + 4.4], cast: false });
  // Khu quán: nền lát ô 1 m, giữa mỗi ô một hoa văn hình thoi (gạch hoa); nền bê tông thì hai màu gần như nhau
  const w = halfW * 2;
  mesh(r, G.box(w, 0.06, depth), mats.floorA, { p: [0, 0.0, cz], receive: true, cast: false });
  const nx = Math.round(w);
  const nz = Math.round(depth);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = -halfW + (i + 0.5) * (w / nx);
      const z = backZ - 0.3 + (j + 0.5) * (depth / nz);
      mesh(r, G.box(0.5, 0.012, 0.5), mats.floorB, { p: [x, 0.035, z], r: [0, Math.PI / 4, 0], cast: false });
    }
  }
  for (let i = 1; i < nx; i++) mesh(r, G.box(0.025, 0.01, depth), 0x8f8c86, { p: [-halfW + i * (w / nx), 0.034, cz], cast: false });
  for (let j = 1; j < nz; j++) mesh(r, G.box(w, 0.01, 0.025), 0x8f8c86, { p: [0, 0.034, backZ - 0.3 + j * (depth / nz)], cast: false });

  // Dãy nhà phố phía sau (đã đóng cửa cuốn), cao vừa phải để không che bếp
  const fronts = [0xf2d16b, 0xa9d3c9, 0xf0b7a4, 0xd9e2ef];
  const bz = backZ - 2.4;
  for (let i = 0; i < 4; i++) {
    const x = -halfW - 0.5 + i * ((halfW * 2 + 1) / 3);
    const h = 4.4 + (i % 2) * 0.8;
    const house = group(r, { p: [x, 0, bz] });
    mesh(house, G.box(3.5, h, 2), fronts[i], { p: [0, h / 2, -0.6] });
    mesh(house, G.box(2.4, 2.2, 0.06), 0xb9bec4, { p: [0, 1.1, 0.42] }); // cửa cuốn
    for (let k = 0; k < 8; k++) mesh(house, G.box(2.4, 0.03, 0.08), 0x9aa1a8, { p: [0, 0.2 + k * 0.26, 0.44], cast: false });
    mesh(house, G.box(3.6, 0.12, 0.9), 0x7a4a3a, { p: [0, 2.6, 0.3] }); // mái hiên
    mesh(house, G.box(1.4, 0.9, 0.06), 0x9fd0ef, { p: [0, 3.5, 0.42] }); // cửa sổ lầu
    mesh(house, G.box(1.6, 0.08, 0.3), 0x5a5f66, { p: [0, 3.0, 0.5] }); // ban công
  }
}

/** Sạp dù che bếp, xe đẩy ốc, bếp nướng than, bàn sơ chế (theo số đầu bếp). Trả về hàm cập nhật (lửa than lập loè). */
export function buildStreetKitchen(r: THREE.Object3D, d: StreetDims, mats: StreetMats, chefs: number, shelter: RainShelter): (env: Env, dt: number) => void {
  const s = streetSpots(d);
  const STEEL = 0xc8d0d5;

  // ---- Sạp dù lớn: 4 cột + mái phẳng sọc + diềm lượn sóng phía trước, cao 4 m để nhìn rõ bên trong
  const x1 = -d.halfW + 0.3;
  const x2 = d.halfW - 0.3;
  const z1 = d.backZ - 0.2;
  const z2 = d.kitchenZ + 0.55;
  const top = 4.0;
  for (const x of [x1, x2]) for (const z of [z1, z2]) mesh(r, G.cyl(0.06, 0.06, top, 8), 0x8a8f99, { p: [x, top / 2, z] });
  const stripes = 12;
  const sw = (x2 - x1 + 0.6) / stripes;
  for (let i = 0; i < stripes; i++) {
    mesh(r, G.box(sw, 0.06, z2 - z1 + 0.8), i % 2 ? mats.trim : mats.wall, { p: [x1 - 0.3 + (i + 0.5) * sw, top + 0.05, (z1 + z2) / 2], r: [-0.06, 0, 0], cast: true });
  }
  // Diềm lượn sóng
  for (let i = 0; i < stripes * 2; i++) {
    mesh(r, G.cyl(0.2, 0.2, 0.04, 10, ), i % 2 ? mats.trim : mats.wall, { p: [x1 - 0.3 + (i + 0.5) * (sw / 2), top - 0.12, z2 + 0.42], r: [Math.PI / 2, 0, 0], s: [0.65, 1, 1], cast: false });
  }

  // ---- Mái kéo dài: mưa thì bạt sọc trượt ra từ mép sạp dù tới hết sân (tựa lên cột dây đèn), tạnh thì cuốn lại.
  // Bạt hơi trong để vẫn nhìn thấy khách và bàn bên dưới.
  const awnStart = z2 + 0.4;
  const awnLen = d.frontZ + 0.5 - awnStart;
  const awnA = toon(0xffffff, { transparent: true, opacity: 0.26 });
  const awnB = toon(0xffffff, { transparent: true, opacity: 0.26 });
  for (const m of [awnA, awnB]) m.depthWrite = false;
  const awning = group(r, { p: [0, top + 0.02, awnStart] });
  const tilt = Math.atan2(0.3, awnLen); // dốc nhẹ ra phía trước để thoát nước
  awning.rotation.x = tilt;
  for (let i = 0; i < stripes; i++) {
    mesh(awning, G.box(sw, 0.04, awnLen), i % 2 ? awnB : awnA, { p: [x1 - 0.3 + (i + 0.5) * sw, 0, awnLen / 2], cast: false, receive: false });
  }
  for (let i = 0; i < stripes * 2; i++) {
    mesh(awning, G.cyl(0.2, 0.2, 0.04, 10), i % 2 ? awnB : awnA, { p: [x1 - 0.3 + (i + 0.5) * (sw / 2), -0.16, awnLen], r: [Math.PI / 2, 0, 0], s: [0.65, 1, 1], cast: false, receive: false });
  }
  awning.visible = false;
  let awnK = 0;
  // Vùng không có mưa: sạp dù (luôn che) + phần mái đang kéo ra
  Object.assign(shelter, { x1: x1 - 0.3, x2: x2 + 0.3, z1: z1 - 0.5, z2: z2 + 0.4, y: top - 0.1 });
  let awnT = -1;

  // ---- Xe đẩy ốc (bếp trưởng): thân inox, bánh xe, tủ kính trên có ốc / sò, tấm bảng đỏ chữ "ỐC", tay đẩy
  const cart = group(r, { p: [s.cart.x, 0, s.cart.z] });
  mesh(cart, G.box(2.0, 0.75, 0.9), STEEL, { p: [0, 0.62, 0] });
  mesh(cart, G.box(2.06, 0.05, 0.96), 0xe9eef2, { p: [0, 1.01, 0] });
  for (const sx of [-1, 1]) {
    mesh(cart, G.cyl(0.24, 0.24, 0.08, 16), 0x2a2d35, { p: [sx * 0.7, 0.24, 0.47], r: [Math.PI / 2, 0, 0] });
    mesh(cart, G.cyl(0.08, 0.08, 0.1, 8), 0x8a8f99, { p: [sx * 0.7, 0.24, 0.48], r: [Math.PI / 2, 0, 0], cast: false });
  }
  const panel = group(cart, { p: [0, 0.62, 0.46] });
  mesh(panel, G.box(1.7, 0.5, 0.02), 0xd9433a);
  const word = signText('ỐC · SÒ · HÀU', '#ffe7a3', 1.6, 0.4);
  word.position.z = 0.02;
  panel.add(word);
  // Tủ kính trên xe: khung + kính mờ + các khay hải sản
  const glass = toon(0xdff3ff, { transparent: true, opacity: 0.32 });
  mesh(cart, G.box(1.9, 0.45, 0.7), glass, { p: [0, 1.27, -0.05], cast: false, receive: false });
  for (const sx of [-1, 1]) mesh(cart, G.box(0.04, 0.47, 0.72), STEEL, { p: [sx * 0.95, 1.27, -0.05], cast: false });
  mesh(cart, G.box(1.94, 0.04, 0.74), STEEL, { p: [0, 1.5, -0.05], cast: false });
  const trays = ['🐚', '🦪', '🦐', '🐌'];
  trays.forEach((icon, i) => {
    const x = -0.68 + i * 0.45;
    mesh(cart, G.box(0.4, 0.05, 0.55), i % 2 ? 0xd9433a : 0xffffff, { p: [x, 1.07, -0.05], cast: false });
    for (let k = 0; k < 2; k++) {
      const sp = emojiSprite(icon, 0.22);
      sp.position.set(x + (k - 0.5) * 0.14, 1.17, -0.05 + (k % 2) * 0.1);
      cart.add(sp);
    }
  });
  mesh(cart, G.cyl(0.03, 0.03, 0.8, 6), 0x8a8f99, { p: [1.25, 1.0, 0], r: [Math.PI / 2, 0, 0] }); // tay đẩy
  for (const sz of [-1, 1]) mesh(cart, G.box(0.25, 0.03, 0.03), 0x8a8f99, { p: [1.1, 1.0, sz * 0.38], cast: false });
  // Nồi nước chấm + chén trên xe
  mesh(cart, G.cyl(0.16, 0.14, 0.2, 12), 0xcfd6dc, { p: [-0.75, 1.62, -0.2] });
  for (let k = 0; k < 3; k++) mesh(cart, G.cyl(0.07, 0.05, 0.05, 10), 0xffffff, { p: [0.3 + k * 0.17, 1.55, 0.2], cast: false });

  // ---- Bếp nướng than (bếp phó): thùng inox chân cao, than hồng, vỉ nướng, hàu đang nướng
  const grill = group(r, { p: [s.grill.x, 0, s.grill.z] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(grill, G.box(0.06, 0.75, 0.06), 0x3b3f46, { p: [sx * 0.65, 0.375, sz * 0.25] });
  mesh(grill, G.box(1.45, 0.3, 0.65), 0x3b3f46, { p: [0, 0.88, 0] });
  const coals = new THREE.MeshBasicMaterial({ color: 0xff7a2a });
  mesh(grill, G.box(1.3, 0.04, 0.5), coals, { p: [0, 1.04, 0], cast: false });
  for (let k = 0; k < 9; k++) mesh(grill, G.ico(0.06, 0), coals, { p: [-0.55 + k * 0.14, 1.07, (k % 3 - 1) * 0.12], cast: false });
  for (let k = 0; k < 9; k++) mesh(grill, G.box(0.02, 0.02, 0.6), 0x9aa1a8, { p: [-0.6 + k * 0.15, 1.12, 0], cast: false }); // vỉ nướng
  for (let k = 0; k < 4; k++) {
    const sp = emojiSprite(k % 2 ? '🦪' : '🍤', 0.26);
    sp.position.set(-0.45 + k * 0.3, 1.22, 0);
    grill.add(sp);
  }
  const fire = new THREE.PointLight(0xff8a3a, 0, 4.5, 1.6);
  fire.position.set(0, 1.4, 0.2);
  grill.add(fire);
  // Thùng đá + rổ nghêu cạnh bếp
  mesh(r, G.box(0.6, 0.45, 0.45), 0xffffff, { p: [s.grill.x + 1.05, 0.23, s.grill.z - 0.5] });
  mesh(r, G.cyl(0.28, 0.22, 0.22, 12), 0xc99a52, { p: [s.cart.x - 1.3, 0.11, s.cart.z - 0.3] });
  const basket = emojiSprite('🦪', 0.24);
  basket.position.set(s.cart.x - 1.3, 0.3, s.cart.z - 0.3);
  r.add(basket);

  // ---- Bàn sơ chế cho đầu bếp thuê thêm
  for (let i = 2; i < Math.min(chefs, s.chefs.length); i++) {
    const c = s.chefs[i];
    const t = group(r, { p: [c.x, 0, c.z + 0.9] });
    mesh(t, G.box(1.1, 0.06, 0.6), STEEL, { p: [0, 0.92, 0] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(t, G.cyl(0.03, 0.03, 0.9, 6), 0x8a8f99, { p: [sx * 0.48, 0.45, sz * 0.25] });
    mesh(t, G.cyl(0.25, 0.25, 0.06, 14), 0xb98a55, { p: [0, 0.98, 0] }); // thớt
  }

  return (env, dt) => {
    // Than hồng lập loè; buổi tối ánh lửa hắt rõ hơn
    const flick = 0.75 + Math.sin(env.t * 11) * 0.12 + Math.sin(env.t * 23 + 1.3) * 0.08;
    coals.color.setRGB(1, 0.42 + flick * 0.12, 0.12);
    fire.intensity = (0.6 + env.night * 2.2) * flick;
    // Mái kéo dài theo mưa
    // Theo giờ thực env.t (không theo dt: khung hình thưa vẫn kéo đủ), ~1.5 s là bung hết
    const step = awnT < 0 ? 1 : Math.min(1, Math.max(0, env.t - awnT) * 2.5);
    awnT = env.t;
    awnK += ((env.rain > 0.2 ? 1 : 0) - awnK) * step;
    void dt;
    awning.visible = awnK > 0.02;
    awning.scale.z = Math.max(0.02, awnK);
    // Mái kéo ra thì phía trước quán (vỉa hè, lòng đường) cũng không mưa: chỉ mưa hai bên trái / phải
    shelter.z2 = Math.max(z2 + 0.4, awnStart + (d.frontZ + 4 - awnStart) * awnK);
    awnA.color.copy((mats.wall as THREE.MeshToonMaterial).color);
    awnB.color.copy((mats.trim as THREE.MeshToonMaterial).color);
  };
}

/** Bảng tên chân đứng (giá chữ A) bên trái xe đẩy. Gốc ở chân bảng, mặt nhìn về +z. */
export function standingSign(name: string, trim: THREE.Material): THREE.Group {
  const g = group(null);
  const w = Math.min(2.2, 0.9 + name.length * 0.09);
  for (const sx of [-1, 1]) mesh(g, G.box(0.06, 1.6, 0.06), 0x6b4a2f, { p: [sx * (w / 2 - 0.05), 0.8, 0.12], r: [-0.12, 0, 0] });
  for (const sx of [-1, 1]) mesh(g, G.box(0.06, 1.6, 0.06), 0x6b4a2f, { p: [sx * (w / 2 - 0.05), 0.8, -0.12], r: [0.12, 0, 0] });
  const board = group(g, { p: [0, 1.15, 0.15], r: [-0.12, 0, 0] });
  mesh(board, G.box(w, 0.9, 0.05), trim);
  mesh(board, G.box(w - 0.12, 0.78, 0.06), 0x2f3a33, { p: [0, 0, 0.01] }); // bảng đen
  const text = signText(name, '#ffe7a3', w - 0.2, 0.42);
  text.position.set(0, 0.12, 0.05);
  board.add(text);
  const sub = signText('Ốc · Sò · Hàu nướng', '#f6f1e4', w - 0.3, 0.22);
  sub.position.set(0, -0.22, 0.05);
  board.add(sub);
  return g;
}
