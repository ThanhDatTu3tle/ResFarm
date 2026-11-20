import * as THREE from 'three';
import type { StallDef } from '../../../data';
import type { Game } from '../../../sim/game';
import { crewLook, logoBoard } from './stall';
import { addUmbrella, adultShape, animatePerson, LOOKS, makeCrate, makeLampPost, makePerson, makeTree, randomShape, UMBRELLA_COLORS } from '../models';
import { collectSway, sway, type Area, type Env, type Pick } from '../stage';
import { emojiSprite, G, group, mesh, seeded, toon, type V3, paintSeason } from '../toon';
import { signText } from '../cuisine';
import { FestiveSet } from '../festive';
import { makeCar, makeScooter, makeTruck, setVehicleLights } from '../farmkit';

/**
 * KHU CHỢ — mỗi StallDef trong src/data/market.ts thành một sạp có mái bạt sọc, tự bày hàng theo `items`.
 * Bấm vào sạp phát Pick {type:'stall'} để mở bảng mua hàng. Mỗi sạp có bảng tên (= StallDef.name) và có thể có
 * bảng chân đứng (StallDef.standee). Trước chợ: vỉa hè rộng cho người đi bộ, rồi tới con đường 2 làn xe chạy qua lại.
 */

/** Vỉa hè: z từ SIDEWALK.z1 tới z2; đường: hai làn ở LANES (z), xe chạy +x ở làn gần chợ, -x ở làn xa. */
const SIDEWALK = { z1: 1.0, z2: 9.8 };
const ROAD = { z1: 10.3, z2: 16.3 };
const LANES = [11.8, 14.8];
const ROAD_HALF = 26;
/** Mọi xe trên đường chạy cùng một tốc độ (m/giây thực) để không xe nào xuyên qua xe khác. */
const VEHICLE_SPEED = 3.8;

const STALL_COLORS = [0xe2574c, 0x5fae57, 0x4a9bd8, 0xf2a23a, 0x9a6bd1];
const STALL_SPACING = 5.9;
const STALL_Z = -1.6;

export class MarketArea implements Area {
  id = 'market';
  label = 'Chợ';
  icon = '🧺';
  root = new THREE.Group();
  // Lùi camera ra sau con đường để thấy đủ sạp, vỉa hè và xe chạy
  view = { position: [0, 13, 31] as V3, target: [0, 1.2, 4.2] as V3, orbit: 0.75 };
  rainBox = { min: [-22, 0, -12] as V3, max: [22, 14, 18] as V3 };
  outdoor = true;

  private swayNodes: THREE.Object3D[];
  private bulbs: THREE.MeshToonMaterial[] = [];
  private lights: THREE.PointLight[] = [];
  private houseWindowMat = toon(0xfff1c2, { emissive: 0xffc861, emissiveIntensity: 0 });
  private bobbers: { obj: THREE.Object3D; y: number; phase: number; amp: number }[] = [];
  private walkers: { g: THREE.Group; range: number; speed: number; phase: number }[] = [];
  private vendors: THREE.Group[] = [];
  private flags: THREE.Object3D[] = [];
  /** Xe trên đường: chạy theo làn, ra khỏi đầu đường thì vòng lại đầu kia. */
  private vehicles: { g: THREE.Group; speed: number; dir: 1 | -1; wheels: THREE.Object3D[]; rider: THREE.Group | null }[] = [];
  /** Tâm từng hàng quán (để camera lướt tới khi bấm). */
  private centers = new Map<string, { x: number; z: number }>();
  /** Ghế đẩu nhựa ở mấy bộ bàn trước Tiệm 25caaaaa: người trong đội ăn ở tiệm thì ngồi đây. */
  private kioskSeats: { x: number; z: number; face: number }[] = [];
  private kioskId: string | null = null;
  /** Hơi nóng bốc lên từ nồi hủ tiếu / ly cà phê. */
  private steams: THREE.Sprite[] = [];

  /** Tâm hàng quán `id` (mét, toạ độ khu chợ) — app.ts lướt camera tới đây khi bấm sạp. */
  stallCenter(id: string): { x: number; z: number } | null {
    return this.centers.get(id) ?? null;
  }

  constructor(private game: Game) {
    this.buildScenery();
    // Trang trí lễ hội: dây treo ngang trước dãy sạp, đồ đứng trên vỉa hè (chỉ hiện vào ngày lễ)
    this.festive = new FestiveSet(this.root, [[[-14.5, 4.1, 1.4], [14.5, 4.1, 1.4]]], [[-2.4, 0, 3.0], [3.4, 0, 3.2]], 1.9);
    // Dãy chợ: sạp mái bạt + tiệm nhỏ xếp hàng ngang; hàng rong đứng trên vỉa hè ở chỗ riêng (StallDef.spot)
    const all = game.content.stalls.all();
    const row = all.filter((d) => !d.kind || d.kind === 'stall' || d.kind === 'kiosk');
    row.forEach((def, i) => {
      const x = (i - (row.length - 1) / 2) * STALL_SPACING;
      const color = STALL_COLORS[i % STALL_COLORS.length];
      if (def.kind === 'kiosk') this.buildKiosk(game, def, x, color, i);
      else this.buildStall(game, def, x, color, i);
      this.centers.set(def.id, { x, z: STALL_Z + 1.2 });
    });
    all.filter((d) => d.spot).forEach((def, i) => {
      this.buildStreetVendor(game, def, i);
      this.centers.set(def.id, { x: def.spot!.x, z: def.spot!.z });
    });
    this.swayNodes = collectSway(this.root);
  }

  private buildScenery(): void {
    const r = this.root;
    const rnd = seeded(23);
    mesh(r, G.box(80, 0.4, 70), 0xe6d3ad, { p: [0, -0.2, 0], cast: false });
    // Vỉa hè lát gạch (rộng gấp đôi trước), viền bó vỉa
    const sw = SIDEWALK.z2 - SIDEWALK.z1;
    mesh(r, G.box(52, 0.08, sw), 0xf3e6c8, { p: [0, 0.04, (SIDEWALK.z1 + SIDEWALK.z2) / 2], cast: false });
    for (let x = -26; x <= 26; x += 2) mesh(r, G.box(0.05, 0.09, sw), 0xdcc79c, { p: [x, 0.045, (SIDEWALK.z1 + SIDEWALK.z2) / 2], cast: false });
    for (let z = SIDEWALK.z1 + 2; z < SIDEWALK.z2; z += 2) mesh(r, G.box(52, 0.09, 0.05), 0xdcc79c, { p: [0, 0.045, z], cast: false });
    mesh(r, G.box(52, 0.2, 0.3), 0xcfc6b5, { p: [0, 0.1, SIDEWALK.z2 + 0.15] });
    mesh(r, G.box(52, 0.2, 0.3), 0xcfc6b5, { p: [0, 0.1, ROAD.z2 + 0.15] });
    // Đường nhựa 2 làn: vạch giữa đứt khúc, vạch kẻ đường cho người đi bộ
    mesh(r, G.box(52, 0.04, ROAD.z2 - ROAD.z1), 0x5f646b, { p: [0, 0.02, (ROAD.z1 + ROAD.z2) / 2], cast: false });
    for (let x = -26; x < 26; x += 2.6) mesh(r, G.box(1.3, 0.045, 0.14), 0xf6f1e4, { p: [x + 0.65, 0.025, (ROAD.z1 + ROAD.z2) / 2], cast: false });
    // Vạch qua đường (vằn ngựa): các vạch dài dọc theo chiều xe chạy, xếp nối nhau từ mép đường bên này sang bên kia
    for (let z = ROAD.z1 + 0.5; z < ROAD.z2 - 0.3; z += 0.9) mesh(r, G.box(3.6, 0.045, 0.45), 0xf6f1e4, { p: [0, 0.026, z], cast: false });
    mesh(r, G.box(52, 0.4, 20), 0xbfd88f, { p: [0, -0.18, ROAD.z2 + 10.3], cast: false }); // bãi cỏ bên kia đường

    // Dãy nhà phố phía sau
    const palette = [0xf7c6a3, 0xbfe0c8, 0xf6e2a0, 0xc9d8f0, 0xf4b7b7, 0xd9c7ee];
    let x = -19;
    for (let i = 0; x < 19; i++) {
      const w = 3.6 + rnd() * 1.6;
      const h = 3.2 + rnd() * 1.8;
      const house = group(r, { p: [x + w / 2, 0, -8.2] });
      mesh(house, G.box(w, h, 3), palette[i % palette.length], { p: [0, h / 2, 0] });
      mesh(house, G.prism(), i % 2 ? 0xb5553c : 0x6f7fa8, { p: [0, h, 0], s: [w + 0.5, 1.3, 3.4] });
      mesh(house, G.box(0.8, 1.4, 0.1), 0x8a5a3a, { p: [-w / 4, 0.7, 1.52] });
      for (const wxp of [w / 4, -w / 4]) mesh(house, G.box(0.8, 0.7, 0.1), this.houseWindowMat, { p: [wxp, h - 0.9, 1.52], cast: false });
      x += w + 0.25;
    }

    // Cột đèn + dây cờ
    // Đèn đường dọc mép vỉa hè
    for (const lx of [-18, -6, 6, 18]) this.bulbs.push(makeLampPost(r, { p: [lx, 0, SIDEWALK.z2 - 0.4], s: 1.3 }));
    for (const lx of [-10.3, 10.3]) {
      this.bulbs.push(makeLampPost(r, { p: [lx, 0, 1.4], s: 1.25 }));
      const light = new THREE.PointLight(0xffc27a, 0, 0, 0);
      light.position.set(lx * 0.6, 3.4, 5);
      this.lights.push(light);
      r.add(light);
    }
    const flagColors = [0xe2574c, 0xf2b23e, 0x5fae57, 0x4a9bd8, 0x9a6bd1];
    for (let i = 0; i <= 26; i++) {
      const t = i / 26;
      const flag = mesh(r, G.cone(0.2, 0.42, 3), flagColors[i % flagColors.length], { p: [-10.3 + t * 20.6, 4.35 - Math.sin(t * Math.PI) * 0.7, 1.4], r: [Math.PI, 0, 0], cast: false });
      flag.userData.phase = i * 0.7;
      this.flags.push(flag);
    }

    // Cây, thùng hàng, chum
    for (const tx of [-14.5, 14.5]) makeTree(r, { p: [tx, 0, -3.5], s: 1.5 });
    for (const tx of [-21, -12, 12, 21]) {
      mesh(r, G.box(1.2, 0.12, 1.2), 0x8a6a45, { p: [tx, 0.1, SIDEWALK.z2 - 1.1], cast: false }); // bồn gốc cây
      makeTree(r, { p: [tx, 0, SIDEWALK.z2 - 1.1], s: 1.15 }, 0x4f9e4a);
    }
    for (let tx = -24; tx <= 24; tx += 4.2) makeTree(r, { p: [tx + rnd(), 0, ROAD.z2 + 3 + rnd() * 2], s: 1 + rnd() * 0.5 });
    makeCrate(r, { p: [-11.6, 0, -0.6], s: 1.3 });
    makeCrate(r, { p: [-11.9, 0.39, -0.6], s: 1 }, 0xc98b4f);
    makeCrate(r, { p: [11.7, 0, -0.4], s: 1.3 });
    for (const [bx, bz] of [[12.6, 0.4], [-12.6, 0.5]]) {
      mesh(r, G.cyl(0.38, 0.32, 0.8, 12), 0xb07a45, { p: [bx, 0.4, bz] });
      mesh(r, G.torus(0.37, 0.03, 6, 14), 0x5f6b77, { p: [bx, 0.55, bz], r: [Math.PI / 2, 0, 0] });
    }

    // Xe cộ: ô tô, xe tải nhỏ, xe máy chạy hai chiều
    const kinds: ['car' | 'truck' | 'scooter', number][] = [['car', 0xe2574c], ['scooter', 0x4a9bd8], ['car', 0xf2c94c], ['scooter', 0xe2703a], ['truck', 0x3f8fd2], ['scooter', 0x5fae57], ['car', 0xf3f3f3], ['scooter', 0x9a6bd1]];
    kinds.forEach(([kind, color], i) => {
      const dir: 1 | -1 = i % 2 ? -1 : 1;
      const rider = kind === 'scooter' ? makePerson(LOOKS[(i * 5 + 2) % LOOKS.length], 'none', adultShape(i * 5 + 2)) : null;
      const g = kind === 'car' ? makeCar(color) : kind === 'truck' ? makeTruck(color) : makeScooter(color, rider!);
      // Mỗi làn 4 xe cách đều nhau (cùng tốc độ nên giữ nguyên khoảng cách)
      g.position.set(-ROAD_HALF + (Math.floor(i / 2) + 0.25 + (i % 2) * 0.5) * (ROAD_HALF / 2), 0, LANES[i % 2 ? 1 : 0] + (kind === 'scooter' ? (rnd() - 0.5) * 0.8 : 0));
      g.rotation.y = dir > 0 ? 0 : Math.PI;
      r.add(g);
      const wheels: THREE.Object3D[] = [];
      g.traverse((o) => o instanceof THREE.Mesh && o.geometry.type === 'CylinderGeometry' && o.rotation.x !== 0 && wheels.push(o));
      this.vehicles.push({ g, speed: VEHICLE_SPEED, dir, wheels, rider }); // mọi xe cùng tốc độ: không chạy xuyên qua nhau
    });

    // Người đi chợ qua lại trên vỉa hè rộng
    for (let i = 0; i < 7; i++) {
      const walker = randomShape(900 + i, i % 3, LOOKS[(i * 3 + 1) % LOOKS.length]);
      const g = makePerson(walker.look!, 'none', walker.shape);
      addUmbrella(g, UMBRELLA_COLORS[i % UMBRELLA_COLORS.length]); // trời mưa thì bung dù
      g.position.z = 2.2 + i * 1.05;
      r.add(g);
      this.walkers.push({ g, range: 6 + rnd() * 6, speed: 0.12 + rnd() * 0.1, phase: rnd() * 6 });
    }
  }

  private buildStall(game: Game, def: StallDef, x: number, color: number, index: number): void {
    const g = group(this.root, { p: [x, 0, STALL_Z] });
    g.userData.pick = { type: 'stall', id: def.id } satisfies Pick;
    const W = 5;

    // Quầy + khăn trải
    mesh(g, G.box(W, 0.9, 1.5), 0xd9a066, { p: [0, 0.45, 0] });
    mesh(g, G.box(W + 0.1, 0.08, 1.6), 0xb07a45, { p: [0, 0.92, 0] });
    mesh(g, G.box(W + 0.04, 0.5, 0.05), color, { p: [0, 0.6, 0.77] });
    mesh(g, G.box(W + 0.04, 0.1, 0.06), 0xffffff, { p: [0, 0.4, 0.775] });

    // Cột + mái bạt sọc
    for (const sx of [-1, 1]) for (const sz of [-0.7, 0.75]) mesh(g, G.cyl(0.07, 0.07, 3.1, 8), 0x8a5a35, { p: [sx * (W / 2 - 0.1), 1.55, sz] });
    const awning = group(g, { p: [0, 3.15, 0.25], r: [0.3, 0, 0] });
    const strips = 9;
    for (let i = 0; i < strips; i++) mesh(awning, G.box((W + 0.7) / strips, 0.08, 2.6), i % 2 ? 0xffffff : color, { p: [-(W + 0.7) / 2 + ((i + 0.5) * (W + 0.7)) / strips, 0, 0] });
    for (let i = 0; i < strips; i++) mesh(awning, G.sphere(0.32, 10, 8), i % 2 ? 0xffffff : color, { p: [-(W + 0.7) / 2 + ((i + 0.5) * (W + 0.7)) / strips, -0.05, 1.3], s: [1, 0.7, 0.25] });

    // Bảng tên sạp: tấm gỗ viền màu sạp, biểu tượng bên trái + tên sạp
    const board = group(g, { p: [0, 4.05, 0.15] });
    mesh(board, G.box(W + 0.3, 0.95, 0.1), color);
    mesh(board, G.box(W + 0.1, 0.78, 0.12), 0xfffaf1);
    for (const sx of [-1, 1]) mesh(board, G.cyl(0.04, 0.04, 0.5, 6), 0x8a5a35, { p: [sx * 1.8, -0.65, 0] });
    const icon = emojiSprite(def.icon, 0.62);
    icon.position.set(-W / 2 + 0.45, 0, 0.12);
    board.add(icon);
    const name = signText(def.name, '#3b2a1e', W - 0.9, 0.62);
    name.position.set(0.3, 0, 0.075);
    board.add(name);
    // Bảng chân đứng nhỏ cạnh sạp (bảng phấn xanh)
    if (def.standee) {
      const s = group(g, { p: [W / 2 + 0.85, 0, 1.25], r: [0, -0.15, 0], s: 1.5 });
      for (const sx of [-0.5, 0.5]) mesh(s, G.box(0.06, 1.2, 0.06), 0x8a5a35, { p: [sx, 0.6, 0], r: [-0.12, 0, 0] });
      mesh(s, G.box(0.06, 1.1, 0.06), 0x8a5a35, { p: [0, 0.55, -0.32], r: [0.35, 0, 0] });
      // Mặt bảng nghiêng nhẹ; chữ gắn vào mặt bảng nên nghiêng theo
      const face = group(s, { p: [0, 0.75, 0.04], r: [-0.12, 0, 0] });
      mesh(face, G.box(1.2, 0.95, 0.05), 0x8a5a35);
      mesh(face, G.box(1.1, 0.85, 0.06), 0x2f5d50, { p: [0, 0, 0.01] });
      // Chữ to, chia 2 dòng ở khoảng trắng gần giữa câu
      const mid = def.standee.length / 2;
      const spaces = [...def.standee].map((c, i) => (c === ' ' ? i : -1)).filter((i) => i > 0);
      const cut = spaces.length ? spaces.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a)) : -1;
      const lines = cut > 0 && def.standee.length > 10 ? [def.standee.slice(0, cut), def.standee.slice(cut + 1)] : [def.standee];
      lines.forEach((line, k) => {
        const t = signText(line, '#fffaf1', 1.0, 0.34);
        t.position.set(0, (lines.length - 1) * 0.17 - k * 0.34, 0.05);
        face.add(t);
      });
      const shell = emojiSprite('🐚', 0.24);
      shell.position.set(0.44, -0.33, 0.1);
      face.add(shell);
    }

    // Đèn lồng treo mái
    for (const sx of [-1, 1]) {
      const bulb = toon(0xfff1c2, { emissive: 0xffc861, emissiveIntensity: 0 });
      this.bulbs.push(bulb);
      mesh(g, G.sphere(0.14, 10, 8), bulb, { p: [sx * 1.9, 2.55, 1], cast: false });
    }

    // Bày hàng: mỗi mặt hàng một thùng + biểu tượng, tối đa 2 hàng
    const rows = def.items.length > 5 ? 2 : 1;
    const cols = Math.ceil(def.items.length / rows);
    def.items.forEach((id, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const px = (col - (cols - 1) / 2) * ((W - 0.5) / cols);
      const crate = makeCrate(g, { p: [px, 0.96 + row * 0.22, 0.38 - row * 0.62], s: Math.min(1.15, 4 / cols) });
      const icon = emojiSprite(game.content.items.get(id).icon, 0.5);
      icon.position.set(0, 0.6, 0);
      crate.add(icon);
      this.bobbers.push({ obj: icon, y: 0.6, phase: index * 2 + i, amp: 0.04 });
    });

    // Người bán
    const vendor = makePerson(LOOKS[(index * 2 + 4) % LOOKS.length], 'straw', adultShape(index * 2 + 4));
    vendor.position.set(0, 0, -1.3);
    vendor.scale.setScalar(1.25);
    g.add(vendor);
    this.vendors.push(vendor);
  }

  /** Bày hàng: thùng nhỏ + biểu tượng mặt hàng, dàn ngang quanh (x, z) trong group g. */
  private showItems(game: Game, g: THREE.Group, def: StallDef, y: number, width: number, z: number, index: number): void {
    // Hàng rong / tiệm ăn vặt bày món ăn (thực đơn cho cả đội), sạp thường bày nguyên liệu
    const icons = def.menu ? def.menu.map((d) => d.icon) : def.items.map((id) => game.content.items.get(id).icon);
    icons.forEach((emoji, i) => {
      const px = (i - (icons.length - 1) / 2) * (width / icons.length);
      const icon = emojiSprite(emoji, 0.42);
      icon.position.set(px, y + 0.3, z);
      g.add(icon);
      this.bobbers.push({ obj: icon, y: y + 0.3, phase: index * 3 + i, amp: 0.04 });
    });
  }

  /** Bảng tên nhỏ (tấm gỗ + chữ) cho tiệm / hàng rong. */
  private nameBoard(g: THREE.Group, def: StallDef, w: number, p: V3, color: number): void {
    const board = group(g, { p });
    mesh(board, G.box(w + 0.2, 0.62, 0.08), color);
    mesh(board, G.box(w, 0.5, 0.1), 0xfffaf1);
    const icon = emojiSprite(def.icon, 0.42);
    icon.position.set(-w / 2 + 0.3, 0, 0.1);
    board.add(icon);
    const name = signText(def.name, '#3b2a1e', w - 0.7, 0.42);
    name.position.set(0.22, 0, 0.065);
    board.add(name);
  }

  /** Tiệm nhỏ ăn vặt / trà sữa trong dãy chợ: nhà hộp sơn hồng, mái hiên, quầy kính, ly trà sữa. */
  /** 3 bộ bàn ghế nhựa mini trên khoảng trống trước tiệm (bấm cũng là vào tiệm). */
  private plasticTables(def: StallDef, x: number): void {
    this.kioskId = def.id;
    const sets: [number, number, number, number][] = [
      [x - 1.3, 2.9, 0xe2574c, 0x3f7fd9],
      [x + 1.4, 2.6, 0x3f7fd9, 0xf2b23e],
      [x + 0.2, 5.0, 0xf2b23e, 0xe2574c],
    ];
    for (const [tx, tz, top, stool] of sets) {
      const t = group(this.root, { p: [tx, 0, tz] });
      t.userData.pick = { type: 'stall', id: def.id } satisfies Pick;
      mesh(t, G.box(0.75, 0.05, 0.75), top, { p: [0, 0.58, 0] });
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(t, G.box(0.05, 0.56, 0.05), top, { p: [lx * 0.32, 0.28, lz * 0.32] });
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const sx = Math.sin(a) * 0.7;
        const sz = Math.cos(a) * 0.7;
        mesh(t, G.cyl(0.18, 0.2, 0.32, 10), stool, { p: [sx, 0.16, sz] });
        // Ngồi quay mặt vào bàn
        this.kioskSeats.push({ x: tx + sx, z: tz + sz, face: a + Math.PI });
      }
    }
  }

  private buildKiosk(game: Game, def: StallDef, x: number, color: number, index: number): void {
    const g = group(this.root, { p: [x, 0, STALL_Z - 0.4] });
    g.userData.pick = { type: 'stall', id: def.id } satisfies Pick;
    const W = 4.6;
    mesh(g, G.box(W, 3.2, 2.6), 0xf6c9d6, { p: [0, 1.6, -0.6] });
    mesh(g, G.box(W + 0.2, 0.25, 2.8), 0xffffff, { p: [0, 3.3, -0.6] });
    // Ô cửa bán hàng + quầy
    mesh(g, G.box(W - 0.8, 1.5, 0.1), 0x5a3b2a, { p: [0, 1.75, 0.71] });
    mesh(g, G.box(W - 0.6, 0.9, 0.7), 0xffffff, { p: [0, 0.45, 1.0] });
    mesh(g, G.box(W - 0.5, 0.08, 0.8), 0xf28cb1, { p: [0, 0.92, 1.0] });
    this.plasticTables(def, x);
    // Mái hiên sọc
    const awning = group(g, { p: [0, 2.75, 1.05], r: [0.45, 0, 0] });
    for (let i = 0; i < 8; i++) mesh(awning, G.box(W / 8, 0.06, 1.1), i % 2 ? 0xffffff : 0xf28cb1, { p: [-W / 2 + (i + 0.5) * (W / 8), 0, 0] });
    // Biển logo Tiệm 25caaaaa trên nóc + ly matcha to
    logoBoard(g, [-0.55, 4.35, -0.2], 1.75);
    for (const sx of [-1.2, 0.1]) mesh(g, G.box(0.08, 0.9, 0.08), 0xf28fb0, { p: [sx, 3.5, -0.25] });
    const cup = group(g, { p: [W / 2 - 0.7, 3.45, -0.3] });
    mesh(cup, G.cyl(0.32, 0.24, 0.8, 14), new THREE.MeshToonMaterial({ color: 0x8cbf5a, transparent: true, opacity: 0.92 }), { p: [0, 0.4, 0] });
    mesh(cup, G.cyl(0.34, 0.34, 0.08, 14), 0xffffff, { p: [0, 0.82, 0] });
    mesh(cup, G.cyl(0.03, 0.03, 0.5, 6), 0xf28cb1, { p: [0.08, 1.05, 0], r: [0, 0, -0.2] });
    this.nameBoard(g, def, W - 0.4, [0, 3.12, 0.75], color); // trên mép mái hiên cho khỏi bị che
    this.showItems(game, g, def, 0.96, W - 1.2, 1.0, index);
    const vendor = makePerson(LOOKS[(index * 3 + 1) % LOOKS.length], 'none', adultShape(index * 3 + 1));
    vendor.position.set(0, 0, 0.2);
    vendor.scale.setScalar(1.2);
    g.add(vendor);
    this.vendors.push(vendor);
  }

  /** Hàng rong trên vỉa hè: xe hủ tiếu gõ, gánh bánh tráng trộn, xe đạp cà phê. */
  private buildStreetVendor(game: Game, def: StallDef, index: number): void {
    const g = group(this.root, { p: [def.spot!.x, 0, def.spot!.z] });
    g.userData.pick = { type: 'stall', id: def.id } satisfies Pick;
    const wood = 0xb9733f;
    let vendorAt: V3 = [0, 0, -0.9];
    let hat: 'none' | 'straw' = 'none';
    if (def.kind === 'cart') {
      // Xe đẩy: thùng gỗ, tủ kính, nồi nước lèo bốc khói, 2 bánh xe, bảng tên đỏ trên mái
      mesh(g, G.box(2.2, 0.9, 0.9), wood, { p: [0, 0.75, 0] });
      mesh(g, G.box(1.2, 0.6, 0.8), new THREE.MeshToonMaterial({ color: 0xcfefff, transparent: true, opacity: 0.45 }), { p: [-0.4, 1.5, 0], cast: false });
      mesh(g, G.cyl(0.32, 0.3, 0.45, 14), 0xbfc5cc, { p: [0.6, 1.42, 0] });
      for (const sx of [-0.7, 0.7]) {
        const wheel = mesh(g, G.cyl(0.32, 0.32, 0.08, 14), 0x3a3a3a, { p: [sx, 0.32, 0.5], r: [Math.PI / 2, 0, 0] });
        wheel.castShadow = true;
      }
      for (const sx of [-1, 1]) mesh(g, G.cyl(0.03, 0.03, 1.2, 6), 0x8a5a35, { p: [sx * 1.0, 1.8, -0.35] });
      mesh(g, G.box(2.3, 0.08, 1.1), 0xd93a32, { p: [0, 2.42, -0.1] });
      this.nameBoard(g, def, 1.9, [0, 2.0, 0.5], 0xd93a32);
      this.showItems(game, g, def, 1.2, 1.1, 0.5, index + 5);
      const steam = emojiSprite('♨️', 0.4);
      steam.position.set(0.6, 1.95, 0);
      g.add(steam);
      this.steams.push(steam);
      // Ghế nhựa thấp cho khách ngồi lề đường
      for (const [sx, sz] of [[-1.6, 0.9], [1.6, 0.9]]) mesh(g, G.box(0.35, 0.3, 0.35), 0x4a9bd8, { p: [sx, 0.15, sz] });
    } else if (def.kind === 'pole') {
      // Gánh hàng: đòn gánh tre + hai thúng tròn đặt dưới đất, người bán đội nón lá
      for (const sx of [-0.85, 0.85]) {
        mesh(g, G.cyl(0.42, 0.34, 0.35, 14), 0xc9a066, { p: [sx, 0.2, 0.2] });
        mesh(g, G.cyl(0.4, 0.4, 0.04, 14), 0xf3e9d2, { p: [sx, 0.39, 0.2], cast: false });
        for (let k = 0; k < 3; k++) mesh(g, G.cyl(0.005, 0.005, 1.1, 4), 0x8a5a35, { p: [sx + Math.cos(k * 2.1) * 0.35, 0.95, 0.2 + Math.sin(k * 2.1) * 0.35], r: [Math.sin(k * 2.1) * 0.3, 0, -Math.cos(k * 2.1) * 0.3] });
      }
      mesh(g, G.cyl(0.04, 0.04, 2.3, 6), 0xd9c27a, { p: [0, 1.48, 0.2], r: [0, 0, Math.PI / 2] });
      for (const sx of [-0.6, 0.6]) mesh(g, G.box(0.3, 0.25, 0.3), 0xe2574c, { p: [sx, 0.12, 1.1] }); // ghế nhựa
      this.showItems(game, g, def, 0.45, 1.8, 0.2, index + 5);
      this.nameBoard(g, def, 1.7, [0, 0.95, 1.6], 0x5fae57);
      vendorAt = [0, 0, -0.55];
      hat = 'straw';
    } else {
      // Xe đạp cà phê: 2 bánh, khung, thùng gỗ phía sau, dù che
      for (const sx of [-0.75, 0.75]) mesh(g, G.torus(0.33, 0.04, 6, 18), 0x3a3a3a, { p: [sx, 0.36, 0] });
      mesh(g, G.cyl(0.03, 0.03, 1.5, 6), 0x2f6f8f, { p: [0, 0.6, 0], r: [0, 0, Math.PI / 2] });
      mesh(g, G.box(0.9, 0.6, 0.7), 0x6b4a2f, { p: [0.55, 0.95, 0] });
      for (let i = 0; i < 4; i++) mesh(g, G.cyl(0.07, 0.06, 0.2, 10), 0xffffff, { p: [0.3 + i * 0.17, 1.35, 0.15] });
      mesh(g, G.cyl(0.02, 0.02, 1.7, 6), 0x8a5a35, { p: [0.55, 1.9, 0] });
      mesh(g, G.cone(1.0, 0.45, 10), 0xf2b23e, { p: [0.55, 2.85, 0] });
      this.nameBoard(g, def, 1.6, [0.55, 0.95, 0.4], 0x6b4a2f);
      this.showItems(game, g, def, 1.45, 0.9, -0.15, index + 5);
      const steam = emojiSprite('☕', 0.36);
      steam.position.set(-0.2, 1.4, 0.2);
      g.add(steam);
      vendorAt = [-0.4, 0, -0.75];
    }
    const vendor = makePerson(LOOKS[(index * 3 + 5) % LOOKS.length], hat, adultShape(index * 3 + 5));
    addUmbrella(vendor, UMBRELLA_COLORS[(index + 3) % UMBRELLA_COLORS.length]); // hàng rong đứng ngoài vỉa hè
    vendor.position.set(...vendorAt);
    vendor.scale.setScalar(1.15);
    g.add(vendor);
    this.vendors.push(vendor);
  }

  private eaters = new Map<string, THREE.Group>();

  /**
   * Cả đội ra chợ ăn (state.crew.meals): mỗi người ngồi ghế nhựa trước hàng mình chọn, đưa tay lên miệng, trên đầu là món đang ăn.
   * Nhìn áo là biết ai: đầu bếp mũ trắng, bồi bàn áo xanh mũ đỏ, nhân viên thuê mũ vàng, bác nông dân nón lá.
   */
  private updateEaters(env: Env): void {
    const { state } = this.game;
    const meals = state.crew.meals;
    for (const [who, g] of this.eaters) {
      if (meals.some((l) => l.who === who)) continue;
      this.root.remove(g);
      this.eaters.delete(who);
    }
    const perStall = new Map<string, number>();
    for (const l of meals) {
      const c = this.centers.get(l.stallId);
      if (!c) continue;
      const n = perStall.get(l.stallId) ?? 0;
      perStall.set(l.stallId, n + 1);
      let g = this.eaters.get(l.who);
      if (!g) {
        const seat = l.stallId === this.kioskId ? this.kioskSeats[n % this.kioskSeats.length] : undefined;
        const p = crewLook(this.game, l.who);
        p.position.y = 0.3;
        if (seat) {
          // Tiệm 25caaaaa: ngồi ghế đẩu nhựa ở bàn trước tiệm
          g = group(this.root, { p: [seat.x, 0, seat.z] });
          p.rotation.y = seat.face;
        } else {
          // Hai hàng ghế trước quầy, mỗi hàng 4 người
          g = group(this.root, { p: [c.x - 1.35 + (n % 4) * 0.9, 0, c.z + 1.9 + Math.floor(n / 4) * 0.9] });
          mesh(g, G.box(0.4, 0.3, 0.4), 0x4a9bd8, { p: [0, 0.15, 0] });
          p.rotation.y = Math.PI;
        }
        g.add(p);
        g.userData.person = p;
        const dish = emojiSprite(l.icon, 0.4);
        dish.position.set(0, 2.05, 0);
        g.add(dish);
        this.eaters.set(l.who, g);
      }
      animatePerson(g.userData.person, env.t, { sit: true, eat: true });
    }
  }


  private paintedSeason = -1;
  private festive: FestiveSet | null = null;

  update(env: Env, dt: number): void {
    this.festive?.update(this.game, env.t, env.wind);
    if (this.paintedSeason !== env.season) {
      this.paintedSeason = env.season;
      paintSeason(this.root, env.season);
    }
    this.updateEaters(env);
    for (const s of this.steams) {
      s.position.y = (s.userData.y0 ??= s.position.y) + ((env.t * 0.6) % 0.5);
      s.material.opacity = 1 - ((env.t * 0.6) % 0.5) * 1.6;
    }
    for (const v of this.vehicles) {
      v.g.position.x += v.dir * v.speed * dt;
      if (v.g.position.x > ROAD_HALF) v.g.position.x = -ROAD_HALF;
      if (v.g.position.x < -ROAD_HALF) v.g.position.x = ROAD_HALF;
      for (const w of v.wheels) w.rotation.y += v.speed * dt * 3;
      v.g.position.y = Math.abs(Math.sin(env.t * 14 + v.speed)) * 0.015;
      if (v.rider) animatePerson(v.rider, env.t, { sit: true });
    }
    setVehicleLights(env.night);
    for (const b of this.bobbers) b.obj.position.y = b.y + Math.abs(Math.sin(env.t * 2 + b.phase)) * b.amp;
    for (const w of this.walkers) {
      const a = env.t * w.speed + w.phase;
      w.g.position.x = Math.sin(a) * w.range;
      w.g.position.y = Math.abs(Math.sin(env.t * 9 + w.phase)) * 0.06;
      w.g.rotation.y = Math.cos(a) > 0 ? Math.PI / 2 : -Math.PI / 2;
      animatePerson(w.g, env.t, { walk: 1 });
    }
    // Người bán: thở, chớp mắt, thỉnh thoảng vẫy tay mời khách
    this.vendors.forEach((v, i) => animatePerson(v, env.t, { wave: Math.max(0, Math.min(1, (Math.sin(env.t * 0.45 + i * 2.1) - 0.85) * 8)) }));
    for (const f of this.flags) f.rotation.z = Math.sin(env.t * (2 + env.wind * 5) + f.userData.phase) * (0.1 + env.wind * 0.5);
    sway(this.swayNodes, env);

    for (const bulb of this.bulbs) bulb.emissiveIntensity = env.night * 1.6;
    this.houseWindowMat.emissiveIntensity = env.night * 1.2;
    this.houseWindowMat.color.setHex(0xbfe6ff).lerp(new THREE.Color(0xfff1c2), env.night);
    for (const light of this.lights) light.intensity = env.night * 0.9;
  }
}
