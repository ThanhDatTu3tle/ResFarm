import * as THREE from 'three';
import type { StallDef } from '../../../data';
import type { Game } from '../../../sim/game';
import { animatePerson, LOOKS, makeCrate, makeLampPost, makePerson, makeTree } from '../models';
import { collectSway, sway, type Area, type Env, type Pick } from '../stage';
import { emojiSprite, G, group, mesh, seeded, toon, type V3 } from '../toon';
import { signText } from '../cuisine';
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

const STALL_COLORS = [0xe2574c, 0x5fae57, 0x4a9bd8, 0xf2a23a, 0x9a6bd1];
const STALL_SPACING = 6.5;
const STALL_Z = -1.6;

export class MarketArea implements Area {
  id = 'market';
  label = 'Chợ';
  icon = '🧺';
  root = new THREE.Group();
  // Lùi camera ra sau con đường để thấy đủ sạp, vỉa hè và xe chạy
  view = { position: [0, 12, 29] as V3, target: [0, 1.2, 4.6] as V3, orbit: 0.75 };
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

  constructor(game: Game) {
    this.buildScenery();
    const stalls = game.content.stalls.all();
    stalls.forEach((def, i) => this.buildStall(game, def, (i - (stalls.length - 1) / 2) * STALL_SPACING, STALL_COLORS[i % STALL_COLORS.length], i));
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
    for (let i = 0; i < 7; i++) mesh(r, G.box(0.5, 0.045, ROAD.z2 - ROAD.z1 - 0.4), 0xf6f1e4, { p: [-1.8 + i * 0.6, 0.026, (ROAD.z1 + ROAD.z2) / 2], cast: false });
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
      const rider = kind === 'scooter' ? makePerson(LOOKS[(i * 5 + 2) % LOOKS.length]) : null;
      const g = kind === 'car' ? makeCar(color) : kind === 'truck' ? makeTruck(color) : makeScooter(color, rider!);
      g.position.set(-ROAD_HALF + rnd() * ROAD_HALF * 2, 0, LANES[i % 2 ? 1 : 0] + (kind === 'scooter' ? (rnd() - 0.5) * 0.8 : 0));
      g.rotation.y = dir > 0 ? 0 : Math.PI;
      r.add(g);
      const wheels: THREE.Object3D[] = [];
      g.traverse((o) => o instanceof THREE.Mesh && o.geometry.type === 'CylinderGeometry' && o.rotation.x !== 0 && wheels.push(o));
      this.vehicles.push({ g, speed: kind === 'scooter' ? 4.5 + rnd() * 1.5 : kind === 'truck' ? 3.2 : 3.8 + rnd(), dir, wheels, rider });
    });

    // Người đi chợ qua lại trên vỉa hè rộng
    for (let i = 0; i < 7; i++) {
      const g = makePerson(LOOKS[(i * 3 + 1) % LOOKS.length]);
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
      for (const sx of [-0.32, 0.32]) mesh(s, G.box(0.06, 1.2, 0.06), 0x8a5a35, { p: [sx, 0.6, 0], r: [-0.12, 0, 0] });
      mesh(s, G.box(0.06, 1.1, 0.06), 0x8a5a35, { p: [0, 0.55, -0.32], r: [0.35, 0, 0] });
      // Mặt bảng nghiêng nhẹ; chữ gắn vào mặt bảng nên nghiêng theo
      const face = group(s, { p: [0, 0.75, 0.04], r: [-0.12, 0, 0] });
      mesh(face, G.box(0.8, 0.95, 0.05), 0x8a5a35);
      mesh(face, G.box(0.7, 0.85, 0.06), 0x2f5d50, { p: [0, 0, 0.01] });
      const cut = def.standee.length > 18 ? def.standee.lastIndexOf(' ', 16) : -1;
      const lines = cut > 0 ? [def.standee.slice(0, cut), def.standee.slice(cut + 1)] : [def.standee];
      lines.forEach((line, k) => {
        const t = signText(line, '#fffaf1', 0.62, 0.19);
        t.position.set(0, 0.2 - k * 0.24, 0.05);
        face.add(t);
      });
      const shell = emojiSprite('🐚', 0.26);
      shell.position.set(0.2, -0.28, 0.1);
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
    const vendor = makePerson(LOOKS[(index * 2 + 4) % LOOKS.length], 'straw');
    vendor.position.set(0, 0, -1.3);
    vendor.scale.setScalar(1.25);
    g.add(vendor);
    this.vendors.push(vendor);
  }

  update(env: Env, dt: number): void {
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
