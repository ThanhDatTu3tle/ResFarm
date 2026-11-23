import * as THREE from 'three';
import type { StallDef } from '../../../data';
import type { Game } from '../../../sim/game';
import { crewLook, logoBoard } from './stall';
import { addUmbrella, adultShape, animatePerson, LOOKS, makeCrate, makeLampPost, makePerson, makeTree, randomShape, UMBRELLA_COLORS } from '../models';
import { collectSway, sway, type Area, type Env, type Pick } from '../stage';
import { blinkLeds, emojiSprite, G, group, ledFrame, mesh, seeded, toon, type V3, paintSeason } from '../toon';
import { signText } from '../cuisine';
import { FestiveSet } from '../festive';
import { OwnerWalker, randIn, type Spot } from '../owner';
import { CAR_COLORS, CAR_KINDS, makeCar, makeScooter, setVehicleLights } from '../farmkit';
import { Chatter } from '../chatter';
import { makePlasticSet, makeTeaKiosk } from '../kiosk';
import { animateCartVendor, equipCartVendor, makeStreetCart, type StreetKind } from '../streetcarts';
import { makeBillboard, type Billboard } from '../billboard';
import { mergeStatic } from '../merge';
import { BusStopScene, makeCityBus, type CityBus } from '../busstop';

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
/** Phanh / tăng tốc (m/s²) khi xe giữ khoảng cách hoặc xe buýt ghé trạm. */
const BRAKE = 4;
const ACCEL = 2.2;
/** Hai cột đèn lớn treo dây cờ: ngoài rìa dãy sạp (sạp ngoài cùng tâm ±11.8, rộng 5 m). */
const LAMP_X = 15;
/** Trạm xe buýt (phải cây trước Tiệm 25caaaaa) và biển LED (trái cây trước sạp thịt), mét. */
const BUS_STOP = { x: 15.0, z: 7.6 };
/** Cửa giữa xe buýt dừng lệch bấy nhiêu so với tâm trạm (ngay trước băng ghế). */
const BUS_DOOR_DX = -0.5;
const BILLBOARD = { x: -15.6, z: 6.6 };

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
  /** Lời rao của từng người bán (StallDef.calls), bật lệch giờ nhau. */
  private chatters: Chatter[] = [];
  private flags: THREE.Object3D[] = [];
  /** Bóng LED nhấp nháy quanh bảng tên sạp hải sản. */
  private leds: THREE.MeshBasicMaterial[] = [];
  /** Xe trên đường: chạy theo làn, ra khỏi đầu đường thì vòng lại đầu kia. */
  private vehicles: {
    g: THREE.Group;
    speed: number;
    dir: 1 | -1;
    wheels: THREE.Object3D[];
    rider: THREE.Group | null;
    /** Chiều dài xe (m) để giữ khoảng cách. */
    len: number;
    /** Chỉ xe buýt: về bến (ẩn) → chạy → dừng đón khách (mở cửa) → chạy tiếp. */
    bus?: { phase: 'away' | 'drive' | 'dwell' | 'leave'; until: number; doors: number; depart: number };
  }[] = [];
  private bus: CityBus | null = null;
  private busStop: BusStopScene | null = null;
  private billboard: Billboard | null = null;
  /** Bóng các cột đèn ngoài vỉa hè (hai cột treo dây cờ + đèn đường sát mặt đường) + đèn hắt + quầng sáng. */
  private brightBulbs: THREE.MeshToonMaterial[] = [];
  private nearLights: THREE.PointLight[] = [];
  private halos: THREE.Sprite[] = [];
  /** Tâm từng hàng quán (để camera lướt tới khi bấm). */
  private centers = new Map<string, { x: number; z: number }>();
  /** Ghế đẩu nhựa ở mấy bộ bàn trước Tiệm 25caaaaa: người trong đội ăn ở tiệm thì ngồi đây. */
  private kioskSeats: { x: number; z: number; face: number }[] = [];
  private kioskId: string | null = null;
  /** Ông / bà chủ đi dạo dọc vỉa hè, ghé ngó từng sạp. */
  private owner: OwnerWalker | null = null;
  /** Hơi nóng bốc lên từ nồi hủ tiếu / ly cà phê. */
  private steams: THREE.Sprite[] = [];

  /** Tâm hàng quán `id` (mét, toạ độ khu chợ) — app.ts lướt camera tới đây khi bấm sạp. */
  stallCenter(id: string): { x: number; z: number } | null {
    return this.centers.get(id) ?? null;
  }

  /** Chỗ ông / bà chủ đi tới: hơn nửa số lần là trước một sạp (quay vào sạp), còn lại là một chỗ trên vỉa hè. */
  private ownerSpot(): Spot {
    const rows = this.game.content.stalls.all().filter((d) => !d.spot);
    if (Math.random() < 0.6 && rows.length) {
      const c = this.centers.get(rows[Math.floor(Math.random() * rows.length)].id)!;
      return { x: c.x + (Math.random() - 0.5) * 1.6, z: 2.2 + Math.random() * 0.4, face: Math.PI };
    }
    return randIn(-14, 14, 2.4, 5.2);
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
    // Tối ưu: gộp mesh của cảnh tĩnh (đất, vỉa hè, đường, dãy nhà, cột đèn, cây, thùng, biển LED)
    mergeStatic(this.scenery);
  }

  /** Cảnh tĩnh của chợ (gộp mesh sau khi dựng). */
  private scenery!: THREE.Group;

  private buildScenery(): void {
    // Cảnh tĩnh vào nhóm `scenery` (gộp mesh sau khi dựng — merge.ts); vật cử động (cờ, xe, người) gắn thẳng vào root
    const top = this.root;
    const r = (this.scenery = group(top));
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
    // (−18 dời ra −20 nhường chỗ biển LED, 18 dời ra 19.3 nhường chỗ trạm xe buýt)
    // Cột đèn sáng rực: bóng đèn + đèn hắt xuống đất + quầng sáng quanh bóng (cao bóng ≈ 2.76 × s)
    const brightLamp = (x: number, z: number, s: number, lightZ: number | null) => {
      this.brightBulbs.push(makeLampPost(r, { p: [x, 0, z], s }));
      if (lightZ != null) {
        const near = new THREE.PointLight(0xffd08a, 0, 13, 1.1);
        near.position.set(x, 2.65 * s, lightZ);
        this.nearLights.push(near);
        r.add(near);
      }
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: 0xffd58a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.set(x, 2.76 * s, z);
      halo.scale.setScalar(1.8);
      this.halos.push(halo);
      r.add(halo);
    };
    // Đèn đường sát mặt đường (−18 dời ra −20 nhường chỗ biển LED, 18 dời ra 19.3 nhường chỗ trạm xe buýt); đèn hắt
    // hơi lùi vào vỉa hè cho sáng chỗ người đi
    // (đèn hắt chỉ cho hai cột giữa — bớt đèn điểm cho máy yếu; hai cột ngoài vẫn có bóng rực + quầng sáng)
    for (const lx of [-20, -6, 6, 19.3]) brightLamp(lx, SIDEWALK.z2 - 0.4, 1.3, Math.abs(lx) < 10 ? SIDEWALK.z2 - 1.6 : null);
    // Hai cột đèn lớn treo dây cờ: đứng ngoài rìa dãy sạp (không che sạp thịt / Tiệm 25caaaaa, không cản bấm sạp)
    for (const lx of [-LAMP_X, LAMP_X]) {
      brightLamp(lx, 1.4, 1.25, 2.2);
      const light = new THREE.PointLight(0xffc27a, 0, 0, 0);
      light.position.set(lx * 0.6, 3.6, 5);
      this.lights.push(light);
      r.add(light);
    }
    const flagColors = [0xe2574c, 0xf2b23e, 0x5fae57, 0x4a9bd8, 0x9a6bd1];
    for (let i = 0; i <= 36; i++) {
      const t = i / 36;
      const flag = mesh(top, G.cone(0.2, 0.42, 3), flagColors[i % flagColors.length], { p: [-LAMP_X + t * LAMP_X * 2, 4.35 - Math.sin(t * Math.PI) * 0.9, 1.4], r: [Math.PI, 0, 0], cast: false });
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

    // Biển LED quảng cáo lớn bên trái cây trước sạp thịt (quảng cáo ở src/data/ads.ts)
    this.billboard = makeBillboard(undefined, 3.8);
    this.billboard.g.position.set(BILLBOARD.x, 0, BILLBOARD.z);
    this.billboard.g.rotation.y = 0.35; // xoay vào giữa chợ cho camera nhìn rõ mặt màn
    r.add(this.billboard.g);
    // Trạm xe buýt bên phải cây trước Tiệm 25caaaaa: khách ngồi chờ, xe buýt ghé đón / trả khách
    this.busStop = new BusStopScene(
      top,
      BUS_STOP,
      (i) => {
        const s = randomShape(700 + i, i % 3, LOOKS[(i * 7 + 3) % LOOKS.length]);
        return makePerson(s.look!, 'none', s.shape);
      },
      animatePerson,
    );

    // Xe cộ: ô tô, xe tải nhỏ, xe máy chạy hai chiều
    const kinds: ['car' | 'scooter', number][] = [['car', CAR_COLORS[0]], ['scooter', 0x4a9bd8], ['car', CAR_COLORS[5]], ['scooter', 0xe2703a], ['car', CAR_COLORS[8]], ['scooter', 0x5fae57], ['car', CAR_COLORS[3]], ['scooter', 0x9a6bd1]];
    kinds.forEach(([kind, color], i) => {
      if (i === 6) return; // làn gần chợ bớt 1 xe: nhường chỗ cho xe buýt
      const dir: 1 | -1 = i % 2 ? -1 : 1;
      const rider = kind === 'scooter' ? makePerson(LOOKS[(i * 5 + 2) % LOOKS.length], 'none', adultShape(i * 5 + 2)) : null;
      const g = kind === 'car' ? makeCar(color, CAR_KINDS[(i >> 1) % CAR_KINDS.length]) : makeScooter(color, rider!);
      // Mỗi làn 4 xe cách đều nhau (cùng tốc độ nên giữ nguyên khoảng cách)
      g.position.set(-ROAD_HALF + (Math.floor(i / 2) + 0.25 + (i % 2) * 0.5) * (ROAD_HALF / 2), 0, LANES[i % 2 ? 1 : 0] + (kind === 'scooter' ? (rnd() - 0.5) * 0.8 : 0));
      g.rotation.y = dir > 0 ? 0 : Math.PI;
      top.add(g);
      const wheels: THREE.Object3D[] = [];
      g.traverse((o) => o instanceof THREE.Mesh && o.geometry.type === 'CylinderGeometry' && o.rotation.x !== 0 && wheels.push(o));
      // Tối ưu: gộp thân xe (bánh xe quay nên giữ riêng; người lái xe máy tự bỏ qua)
      for (const w of wheels) w.userData.keep = true;
      mergeStatic(g);
      this.vehicles.push({ g, speed: VEHICLE_SPEED, dir, wheels, rider, len: kind === 'car' ? 2.7 : 1.7 });
    });
    // Xe buýt: chạy làn gần chợ (+x), ghé trạm rồi đi; ra khỏi đầu đường thì "về bến" một lúc mới quay lại
    const bus = makeCityBus();
    bus.g.visible = false;
    bus.g.position.set(-ROAD_HALF, 0, LANES[0]);
    top.add(bus.g);
    this.bus = bus;
    this.vehicles.push({ g: bus.g, speed: 0, dir: 1, wheels: bus.wheels, rider: null, len: bus.length, bus: { phase: 'away', until: 0, doors: 0, depart: -1 } });

    // Người đi chợ qua lại trên vỉa hè rộng
    for (let i = 0; i < 7; i++) {
      const walker = randomShape(900 + i, i % 3, LOOKS[(i * 3 + 1) % LOOKS.length]);
      const g = makePerson(walker.look!, 'none', walker.shape);
      addUmbrella(g, UMBRELLA_COLORS[i % UMBRELLA_COLORS.length]); // trời mưa thì bung dù
      g.position.z = 2.2 + i * 1.05;
      top.add(g);
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
    // Sạp hải sản: viền đèn LED nhấp nháy quanh bảng tên
    if (def.id === 'seafood') this.leds.push(...ledFrame(board, W + 0.42, 1.07, 0.08));
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
    this.chatters.push(new Chatter(vendor, def.calls ?? [], 1.95, index, 0.34));
    mergeStatic(g);
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

  /** 3 bộ bàn ghế nhựa mini trên khoảng trống trước tiệm (bấm cũng là vào tiệm). */
  private plasticTables(def: StallDef, x: number): void {
    this.kioskId = def.id;
    const sets: [number, number, number, number][] = [
      [x - 1.3, 2.9, 0xe2574c, 0x3f7fd9],
      [x + 1.4, 2.6, 0x3f7fd9, 0xf2b23e],
      [x + 0.2, 5.0, 0xf2b23e, 0xe2574c],
    ];
    for (const [tx, tz, top, stool] of sets) {
      const set = makePlasticSet(top, stool);
      set.g.position.set(tx, 0, tz);
      set.g.userData.pick = { type: 'stall', id: def.id } satisfies Pick;
      this.root.add(set.g);
      mergeStatic(set.g);
      for (const st of set.seats) this.kioskSeats.push({ x: tx + st.x, z: tz + st.z, face: st.face }); // ngồi quay mặt vào bàn
    }
  }

  private buildKiosk(game: Game, def: StallDef, x: number, color: number, index: number): void {
    const g = group(this.root, { p: [x, 0, STALL_Z - 0.4] });
    g.userData.pick = { type: 'stall', id: def.id } satisfies Pick;
    // Tiệm dựng ở kiosk.ts (xem cả ở trang model đồ vật); ở đây gắn biển logo, bảng tên, món bày, bàn ghế, người bán
    const kiosk = makeTeaKiosk();
    g.add(kiosk.g);
    this.bulbs.push(...kiosk.bulbs);
    this.plasticTables(def, x);
    logoBoard(g, kiosk.logo.p, kiosk.logo.w);
    this.nameBoard(g, def, kiosk.board.w, kiosk.board.p, color); // trên mép mái hiên cho khỏi bị che
    this.showItems(game, g, def, kiosk.items.y, kiosk.items.w, kiosk.items.z, index);
    const vendor = makePerson(LOOKS[(index * 3 + 1) % LOOKS.length], 'none', adultShape(index * 3 + 1));
    vendor.position.set(...kiosk.vendorAt);
    vendor.scale.setScalar(1.2);
    g.add(vendor);
    this.vendors.push(vendor);
    this.chatters.push(new Chatter(vendor, def.calls ?? [], 1.95, index, 0.34));
    mergeStatic(g);
  }

  /** Hàng rong trên vỉa hè: xe hủ tiếu gõ, gánh bánh tráng trộn, xe đạp cà phê. */
  private buildStreetVendor(game: Game, def: StallDef, index: number): void {
    const g = group(this.root, { p: [def.spot!.x, 0, def.spot!.z] });
    g.userData.pick = { type: 'stall', id: def.id } satisfies Pick;
    // Xe / gánh dựng ở streetcarts.ts (xem cả ở trang model đồ vật); ở đây gắn bảng tên, món bày, khói, người bán
    const cart = makeStreetCart(def.kind as StreetKind);
    g.add(cart.g);
    this.nameBoard(g, def, cart.board.w, cart.board.p, cart.board.color);
    this.showItems(game, g, def, cart.items.y, cart.items.w, cart.items.z, index + 5);
    if (cart.steam) {
      const steam = emojiSprite('♨️', 0.4);
      steam.position.set(...cart.steam);
      g.add(steam);
      this.steams.push(steam);
    }
    const vendorAt = cart.vendorAt;
    const hat = cart.hat;
    const vendor = makePerson(LOOKS[(index * 3 + 5) % LOOKS.length], hat, adultShape(index * 3 + 5));
    addUmbrella(vendor, UMBRELLA_COLORS[(index + 3) % UMBRELLA_COLORS.length]); // hàng rong đứng ngoài vỉa hè
    vendor.position.set(...vendorAt);
    vendor.scale.setScalar(1.15);
    equipCartVendor(def.kind as StreetKind, vendor);
    g.add(vendor);
    this.vendors.push(vendor);
    this.chatters.push(new Chatter(vendor, def.calls ?? [], cart.seat ? 1.6 : 1.95, index, 0.34));
    mergeStatic(g);
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
    this.owner ??= new OwnerWalker(this.game, this.root, { x: 0, z: 3.5 }, () => this.ownerSpot(), undefined, 0.75, 1.15).withMarker(0.9);
    this.owner.update(env.t, dt);
    for (const s of this.steams) {
      s.position.y = (s.userData.y0 ??= s.position.y) + ((env.t * 0.6) % 0.5);
      s.material.opacity = 1 - ((env.t * 0.6) % 0.5) * 1.6;
    }
    this.updateTraffic(env.t, dt);
    for (const v of this.vehicles) {
      for (const w of v.wheels) w.rotation.y += v.speed * dt * 3;
      v.g.position.y = Math.abs(Math.sin(env.t * 14 + v.speed)) * 0.015;
      if (v.rider) animatePerson(v.rider, env.t, { sit: true, ride: true });
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
    this.vendors.forEach((v, i) => animateCartVendor(v, env.t, Math.max(0, Math.min(1, (Math.sin(env.t * 0.45 + i * 2.1) - 0.85) * 8))));
    for (const c of this.chatters) c.update(env.t);
    blinkLeds(this.leds, env.t);
    for (const f of this.flags) f.rotation.z = Math.sin(env.t * (2 + env.wind * 5) + f.userData.phase) * (0.1 + env.wind * 0.5);
    sway(this.swayNodes, env);

    for (const bulb of this.bulbs) bulb.emissiveIntensity = env.night * 1.6;
    for (const bulb of this.brightBulbs) bulb.emissiveIntensity = 0.25 + env.night * 3;
    for (const light of this.nearLights) light.intensity = env.night * 3.2;
    for (const h of this.halos) {
      h.material.opacity = env.night * (0.75 + Math.sin(env.t * 2.3) * 0.05);
      h.visible = env.night > 0.02;
    }
    this.billboard?.update(env.t, env.night);
    this.busStop?.update(env.t);
    this.houseWindowMat.emissiveIntensity = env.night * 1.2;
    this.houseWindowMat.color.setHex(0xbfe6ff).lerp(new THREE.Color(0xfff1c2), env.night);
    for (const light of this.lights) light.intensity = env.night * 1.4;
  }

  /**
   * Xe chạy theo làn, giữ khoảng cách với xe phía trước (tính vòng qua hai đầu đường): khoảng trống còn `gap` thì
   * chạy tối đa √(2·BRAKE·gap) — xe trước dừng (xe buýt ghé trạm) thì xe sau phanh kịp, không tông. Xe buýt có lịch riêng.
   */
  private updateTraffic(t: number, dt: number): void {
    const span = ROAD_HALF * 2;
    const live = this.vehicles.filter((v) => v.g.visible);
    for (const v of this.vehicles) {
      const b = v.bus;
      if (b && this.bus) {
        if (b.phase === 'away') {
          // Về bến: hết giờ chờ và đầu đường trống thì xuất bến
          // Mỗi giờ trong game một chuyến: xuất bến lúc HH:45 để tới trạm khoảng đúng giờ (đi ~15 phút game)
          const minute = this.game.state.clock.minute;
          if (b.depart < 0 || b.depart - minute > 60) b.depart = nextDeparture(minute);
          const clear = !live.some((o) => o !== v && o.dir === 1 && (o.g.position.x < -ROAD_HALF + v.len + 1.5 || o.g.position.x > ROAD_HALF - 3));
          if (minute < b.depart || !clear) continue;
          b.depart = nextDeparture(minute + 1);
          b.phase = 'drive';
          v.g.position.x = -ROAD_HALF + v.len / 2;
          v.speed = VEHICLE_SPEED;
          v.g.visible = true;
        }
        if (b.phase === 'dwell') {
          v.speed = 0;
          b.doors = Math.min(1, b.doors + dt * 4);
          if (t >= b.until) b.phase = 'leave';
          this.bus.setDoors(b.doors);
          continue;
        }
        if (b.doors > 0) this.bus.setDoors((b.doors = Math.max(0, b.doors - dt * 5)));
      }
      let target = VEHICLE_SPEED;
      // Xe phía trước cùng chiều gần nhất
      let gap = Infinity;
      for (const o of live) {
        if (o === v || o.dir !== v.dir || !o.g.visible) continue;
        const d = ((((o.g.position.x - v.g.position.x) * v.dir) % span) + span) % span;
        gap = Math.min(gap, d - (v.len + o.len) / 2 - 0.9);
      }
      target = Math.min(target, Math.sqrt(2 * BRAKE * Math.max(0, gap)));
      // Xe buýt: phanh dừng đúng chỗ cửa giữa trước trạm
      if (b && b.phase === 'drive' && this.bus) {
        const stopX = BUS_STOP.x + BUS_DOOR_DX - this.bus.door.x;
        const left = stopX - v.g.position.x;
        if (left <= 0.05 && v.speed < 0.6) {
          v.g.position.x = stopX;
          const door = { x: stopX + this.bus.door.x, z: LANES[0] + this.bus.door.z };
          const open = this.busStop?.onBusStop(door, t) ?? 1.5;
          b.phase = 'dwell';
          b.until = t + open;
          v.speed = 0;
          continue;
        }
        target = Math.min(target, Math.sqrt(2 * BRAKE * Math.max(0, left)));
      }
      // Tăng tốc từ từ, phanh ngay
      v.speed = target > v.speed ? Math.min(target, v.speed + ACCEL * dt) : target;
      v.g.position.x += v.dir * v.speed * dt;
      if (b && v.g.position.x > ROAD_HALF - v.len / 2) {
        // Hết đường: về bến, chờ chuyến giờ sau
        Object.assign(b, { phase: 'away', doors: 0 });
        v.g.visible = false;
        continue;
      }
      if (v.g.position.x > ROAD_HALF) v.g.position.x -= span;
      if (v.g.position.x < -ROAD_HALF) v.g.position.x += span;
    }
  }
}

/** Phút game của chuyến xe buýt kế tiếp (xuất bến lúc HH:45, tới trạm ~ đúng giờ), tính từ phút `m` trở đi. */
function nextDeparture(m: number): number {
  const lead = 15;
  return Math.ceil((m + lead) / 60) * 60 - lead;
}

/** Quầng sáng tròn mờ quanh bóng đèn (dùng chung). */
let halo: THREE.Texture | null = null;
function haloTexture(): THREE.Texture {
  if (halo) return halo;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return (halo = new THREE.CanvasTexture(c));
}
