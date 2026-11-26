import * as THREE from 'three';
import { terrazzoSidewalk } from './floortex';
import { signText } from './cuisine';
import type { Env, RainShelter } from './stage';
import { makeCharcoalGrill, makeSnailTable } from './snailstall';
import { G, group, mesh, toon } from './toon';

/**
 * QUÁN ỐC VỈA HÈ (CuisineId 'oc'): quán không có tường, WC, kho — thay cho phòng (buildRoom) và gian bếp (buildKitchen)
 * của RestaurantArea. Mặt bằng sim giữ nguyên (bàn, quầy ra món, chỗ bồi bàn đứng), chỉ khác hình:
 *  - nền bê tông lát ô (màu theo "Sàn nhà": bê tông → gạch lề đường đỏ → gạch hoa), bó vỉa, phố phía sau, đường phía trước;
 *  - sạp dù lớn che khu bếp (màu sọc theo "Sơn tường"), mái cao để nhìn rõ bên trong;
 *  - bàn bày rổ ốc + bếp ga chảo xào (bếp trưởng; bếp lên hạng thì bàn dài ra, thêm chỗ cho đầu bếp thứ 3), bếp nướng than
 *    có lưỡi lửa + tàn lửa (bếp phó), bàn sơ chế cho đầu bếp thứ 4 — hình ở snailstall.ts;
 *  - bảng tên chân đứng bên trái bàn ốc (RestaurantArea.updateNameSign).
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

/** Bàn ốc nối dài thêm bấy nhiêu mét về bên trái khi bếp lên hạng (không lấn ra mép sạp). */
function tableExt(d: StreetDims): number {
  return Math.max(0.8, Math.min(1.6, -2.2 - 1.2 + d.halfW - 1.6));
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
      { x: -2.2 - 1.2 - tableExt(d) / 2, z: z - 1.0 },
      { x: 2.35, z: z - 1.0 },
    ],
    /** Bảng tên đứng sát đầu trái bàn ốc (bàn dài ra khi bếp lên hạng thì bảng lùi theo). */
    sign: (tier: number) => ({ x: -2.2 - 1.2 - (tier >= 2 ? tableExt(d) : 0) - 1.35, z: d.kitchenZ - 0.35 }),
  };
}

/** Vỉa hè trước quán sâu bấy nhiêu mét (tính từ mép trước quán); lòng đường rộng 7 m, tâm đường ở ROAD_MID. */
export const SIDEWALK = 2.8;
export const ROAD_MID = SIDEWALK + 3.6;

/** Nền, bó vỉa, đường, dãy nhà phố phía sau. */
export function buildStreetGround(r: THREE.Object3D, d: StreetDims, mats: StreetMats): void {
  const { halfW, backZ, frontZ } = d;
  const depth = frontZ - backZ + 0.6;
  const cz = (frontZ + backZ) / 2;
  mesh(r, G.box(70, 0.2, 60), 0xb9d48a, { p: [0, -0.25, 0], cast: false }); // cỏ xa
  // Vỉa hè rộng hơn khu quán một chút + bó vỉa
  mesh(r, G.box(halfW * 2 + 3, 0.2, depth + 2.4), 0xcfcbc2, { p: [0, -0.1, cz - 0.6], cast: false });
  // Giai đoạn 15: vỉa hè trước quán rộng ra (SIDEWALK m) cho xe shipper đậu, người đi bộ; đường lùi ra xa
  mesh(r, G.box(70, 0.2, SIDEWALK), 0xcfcbc2, { p: [0, -0.1, frontZ + SIDEWALK / 2], cast: false });
  terrazzoSidewalk(r, 70, SIDEWALK - 0.12, frontZ + SIDEWALK / 2 - 0.06); // vỉa hè gạch terrazzo rãnh cong
  mesh(r, G.box(70, 0.22, 0.25), 0xe6e2da, { p: [0, -0.05, frontZ + SIDEWALK], cast: false }); // bó vỉa
  mesh(r, G.box(70, 0.18, 7), 0x5c5f66, { p: [0, -0.14, frontZ + ROAD_MID], cast: false }); // lòng đường
  for (let x = -30; x <= 30; x += 3) mesh(r, G.box(1.4, 0.02, 0.15), 0xf3efe6, { p: [x, -0.04, frontZ + ROAD_MID], cast: false });
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

/** Sạp dù che bếp, bàn ốc (dài theo hạng bếp), bếp nướng than, bàn sơ chế (đầu bếp thứ 4). Trả về hàm cập nhật (lửa lập loè). */
export function buildStreetKitchen(r: THREE.Object3D, d: StreetDims, mats: StreetMats, chefs: number, shelter: RainShelter, tier = 1): (env: Env, dt: number) => void {
  const s = streetSpots(d);
  const STEEL = 0xc8d0d5;

  // ---- Sạp dù lớn: 4 cột + mái phẳng sọc + diềm lượn sóng phía trước, cao 4 m để nhìn rõ bên trong
  const x1 = -d.halfW + 0.3;
  const x2 = d.halfW - 0.3;
  const z1 = d.backZ - 0.2;
  const z2 = d.kitchenZ + 0.55;
  const top = 4.8;
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

  // ---- Bàn ốc (bếp trưởng): bàn inox bày rổ ốc / sò / nghêu, bếp ga + chảo xào ở đầu phải; bếp lên hạng thì bàn dài
  // ra về bên trái làm chỗ cho đầu bếp thứ 3 (xem snailstall.ts)
  const table = makeSnailTable(tier, tableExt(d));
  table.g.position.set(s.cart.x, 0, s.cart.z);
  r.add(table.g);

  // ---- Bếp nướng than (bếp phó): than hồng, lưỡi lửa liếm qua vỉ, tàn lửa bay
  const grill = makeCharcoalGrill();
  grill.g.position.set(s.grill.x, 0, s.grill.z);
  r.add(grill.g);
  // Thùng đá cạnh bếp nướng
  mesh(r, G.box(0.6, 0.45, 0.45), 0xffffff, { p: [s.grill.x + 1.05, 0.23, s.grill.z - 0.5] });
  mesh(r, G.box(0.62, 0.05, 0.47), 0x3f7fd9, { p: [s.grill.x + 1.05, 0.47, s.grill.z - 0.5], cast: false });

  // ---- Đầu bếp thứ 4: bàn sơ chế inox nhỏ bên phải, có rổ ốc đang lặt
  for (let i = 3; i < Math.min(chefs, s.chefs.length); i++) {
    const c = s.chefs[i];
    const t = group(r, { p: [c.x, 0, c.z + 0.9] });
    mesh(t, G.box(1.1, 0.06, 0.6), STEEL, { p: [0, 0.92, 0] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(t, G.cyl(0.03, 0.03, 0.9, 6), 0x8a8f99, { p: [sx * 0.48, 0.45, sz * 0.25] });
    mesh(t, G.cyl(0.22, 0.22, 0.05, 14), 0xb98a55, { p: [0.25, 0.97, 0] }); // thớt
    mesh(t, G.box(0.4, 0.12, 0.36), 0xe2382e, { p: [-0.25, 1.01, 0] }); // rổ ốc
    mesh(t, G.sphere(0.17, 8, 5), 0xd9c7a3, { p: [-0.25, 1.06, 0], s: [1, 0.3, 0.9], cast: false });
  }

  return (env, dt) => {
    // Lửa bếp nướng + bếp ga lập loè; buổi tối ánh lửa hắt rõ hơn
    grill.update(env.t, env.night, dt);
    table.update(env.t);
    // Mái kéo dài theo mưa
    // Theo giờ thực env.t (không theo dt: khung hình thưa vẫn kéo đủ), ~1.5 s là bung hết
    const step = awnT < 0 ? 1 : Math.min(1, Math.max(0, env.t - awnT) * 2.5);
    awnT = env.t;
    awnK += ((env.rain > 0.2 ? 1 : 0) - awnK) * step;
    void dt;
    awning.visible = awnK > 0.02;
    awning.scale.z = Math.max(0.02, awnK);
    // Mái kéo ra thì phía trước quán (vỉa hè, lòng đường) cũng không mưa: chỉ mưa hai bên trái / phải
    shelter.z2 = Math.max(z2 + 0.4, awnStart + (d.frontZ + ROAD_MID - 0.4 - awnStart) * awnK);
    awnA.color.copy((mats.wall as THREE.MeshToonMaterial).color);
    awnB.color.copy((mats.trim as THREE.MeshToonMaterial).color);
  };
}

/** Bảng tên chân đứng (giá chữ A) bên trái xe đẩy. Gốc ở chân bảng, mặt nhìn về +z. */
export function standingSign(name: string, trim: THREE.Material): THREE.Group {
  const g = group(null);
  const w = Math.min(2.2, 0.9 + name.length * 0.09);
  for (const sx of [-1, 1]) mesh(g, G.box(0.06, 2.0, 0.06), 0x6b4a2f, { p: [sx * (w / 2 - 0.05), 1.0, 0.14], r: [-0.12, 0, 0] });
  for (const sx of [-1, 1]) mesh(g, G.box(0.06, 2.0, 0.06), 0x6b4a2f, { p: [sx * (w / 2 - 0.05), 1.0, -0.14], r: [0.12, 0, 0] });
  const board = group(g, { p: [0, 1.5, 0.15], r: [-0.12, 0, 0] });
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
