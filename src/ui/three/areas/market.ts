import * as THREE from 'three';
import type { StallDef } from '../../../data';
import type { Game } from '../../../sim/game';
import { animatePerson, LOOKS, makeCrate, makeLampPost, makePerson, makeTree } from '../models';
import { collectSway, sway, type Area, type Env, type Pick } from '../stage';
import { emojiSprite, G, group, mesh, seeded, toon, type V3 } from '../toon';

/**
 * KHU CHỢ — mỗi StallDef trong src/data/market.ts thành một sạp có mái bạt sọc, tự bày hàng theo `items`.
 * Bấm vào sạp phát Pick {type:'stall'} để mở bảng mua hàng.
 */

const STALL_COLORS = [0xe2574c, 0x5fae57, 0x4a9bd8, 0xf2a23a, 0x9a6bd1];
const STALL_SPACING = 6.5;
const STALL_Z = -1.6;

export class MarketArea implements Area {
  id = 'market';
  label = 'Chợ';
  icon = '🧺';
  root = new THREE.Group();
  view = { position: [0, 8.6, 17.5] as V3, target: [0, 1.7, -1.4] as V3, orbit: 0.75 };
  rainBox = { min: [-20, 0, -12] as V3, max: [20, 14, 12] as V3 };

  private swayNodes: THREE.Object3D[];
  private bulbs: THREE.MeshToonMaterial[] = [];
  private lights: THREE.PointLight[] = [];
  private houseWindowMat = toon(0xfff1c2, { emissive: 0xffc861, emissiveIntensity: 0 });
  private bobbers: { obj: THREE.Object3D; y: number; phase: number; amp: number }[] = [];
  private walkers: { g: THREE.Group; range: number; speed: number; phase: number }[] = [];
  private vendors: THREE.Group[] = [];
  private flags: THREE.Object3D[] = [];

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
    mesh(r, G.box(34, 0.03, 4.4), 0xf3e6c8, { p: [0, 0.015, 3.2], cast: false });
    for (let x = -16; x <= 16; x += 2) mesh(r, G.box(0.05, 0.035, 4.4), 0xdcc79c, { p: [x, 0.02, 3.2], cast: false });

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
    for (const lx of [-10.3, 10.3]) {
      this.bulbs.push(makeLampPost(r, { p: [lx, 0, 1.4], s: 1.25 }));
      const light = new THREE.PointLight(0xffc27a, 0, 0, 0);
      light.position.set(lx * 0.6, 3.4, 3);
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
    for (const tx of [-16, 16]) makeTree(r, { p: [tx, 0, 4.5], s: 1.2 }, 0x4f9e4a);
    makeCrate(r, { p: [-11.6, 0, -0.6], s: 1.3 });
    makeCrate(r, { p: [-11.9, 0.39, -0.6], s: 1 }, 0xc98b4f);
    makeCrate(r, { p: [11.7, 0, -0.4], s: 1.3 });
    for (const [bx, bz] of [[12.6, 0.4], [-12.6, 0.5]]) {
      mesh(r, G.cyl(0.38, 0.32, 0.8, 12), 0xb07a45, { p: [bx, 0.4, bz] });
      mesh(r, G.torus(0.37, 0.03, 6, 14), 0x5f6b77, { p: [bx, 0.55, bz], r: [Math.PI / 2, 0, 0] });
    }

    // Người đi chợ qua lại
    for (let i = 0; i < 4; i++) {
      const g = makePerson(LOOKS[(i * 3 + 1) % LOOKS.length]);
      g.position.z = 2.4 + i * 0.7;
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

    // Biển hiệu tròn với biểu tượng của sạp
    mesh(g, G.cyl(0.62, 0.62, 0.1, 20), 0xffffff, { p: [0, 3.85, 0.1], r: [Math.PI / 2, 0, 0] });
    mesh(g, G.torus(0.62, 0.06, 8, 24), color, { p: [0, 3.85, 0.1] });
    const sign = emojiSprite(def.icon, 0.85);
    sign.position.set(0, 3.85, 0.3);
    g.add(sign);

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

  update(env: Env): void {
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
