import * as THREE from 'three';
import type { SlotType } from '../../../data';
import type { Game } from '../../../sim/game';
import type { FarmerTaskKind, FarmSlot } from '../../../sim/state';
import { currentWork, slotCenter, slotScale } from '../../../sim/systems/farmer';
import { cycleTime, needsWatering, yieldsOf } from '../../../sim/systems/farm';
import { easeOutBack, wobble } from '../../ease';
import { Particles } from '../fx';
import { animateCreature, animatePerson, cropStageOf, LOOKS, makeAnimals, makeBush, makeCrop, makeFence, makePerson, makeTree, type CropStage } from '../models';
import { collectSway, sway, type Area, type Env, type Pick } from '../stage';
import { Bar3D, emojiSprite, G, group, mesh, seeded, toon, type V3 } from '../toon';

/**
 * KHU NÔNG TRẠI — ruộng, chuồng, ao ngoài trời. Mỗi ô trong state.farm.slots có một SlotView;
 * bấm vào ô phát Pick {type:'slot'} (app.ts quyết định: thu hoạch / cuốc / tưới / mở bảng chọn giống).
 * Mua thêm ô thì ô mới tự mọc ra theo SlotTypeDef.layout (src/data/farm.ts); ô lên bậc (ao nới rộng) thì to ra và nuôi nhiều con hơn.
 * Bác nông dân là nhân vật trong sim (systems/farmer.ts): khu này chỉ vẽ bác theo state.farm.farmer.
 */

/** Biểu tượng việc bác nông dân đang làm / sắp làm, hiện trên đầu bác. */
const TASK_ICON: Record<FarmerTaskKind, string> = { till: '⛏️', water: '💧', plant: '🌱', harvest: '🧺', clear: '🧹', visit: '👀' };

const SOIL = { hard: 0xbf9a66, tilled: 0x8a5a36, wetMul: 0.6 };

interface SlotView {
  g: THREE.Group;
  content: THREE.Group;
  /** undefined = chưa dựng lần nào. */
  producerId: string | null | undefined;
  tier: number;
  movers: { g: THREE.Group; x: number; z: number; phase: number }[];
  ready: THREE.Sprite | null;
  bar: Bar3D;
  ring: THREE.Mesh;
  type: SlotType;
  /** Chỉ ruộng mới có: màu đất, luống cày, cỏ dại, biểu tượng nhắc việc. */
  soil?: THREE.MeshToonMaterial;
  furrows?: THREE.Object3D;
  weeds?: THREE.Object3D;
  drop: THREE.Sprite;
  hoe: THREE.Sprite;
  /** Trạng thái ô ở khung hình trước — so sánh để biết vừa xảy ra chuyện gì (gieo, chín, thu...) mà phát hiệu ứng. */
  prev: SlotSnapshot | null;
  /** Mốc env.t của các hiệu ứng đang chạy: ô bị nhún, cây bật lên khi gieo, cây nảy khi chín. */
  kickAt: number;
  popAt: number;
  ripeAt: number;
  /** Giai đoạn lớn của cây đang dựng (chỉ ruộng). */
  cropStage: CropStage;
}

interface SlotSnapshot {
  producerId: string | null;
  stage: FarmSlot['stage'];
  tilled: boolean;
  wet: number;
}

/** Biểu tượng bay ra khi thu hoạch: tối đa bấy nhiêu cái mỗi ô. */
const MAX_HARVEST_ICONS = 4;

export class FarmArea implements Area {
  id = 'farm';
  label = 'Nông trại';
  icon = '🌾';
  root = new THREE.Group();
  view = { position: [0.8, 15.5, 18] as V3, target: [0.8, 0, 2] as V3, orbit: 1 };
  rainBox = { min: [-20, 0, -14] as V3, max: [20, 15, 14] as V3 };

  private slots = new Map<string, SlotView>();
  private swayNodes: THREE.Object3D[];
  private blades: THREE.Group;
  private farmer!: THREE.Group;
  /** Biểu tượng việc trên đầu bác; dựng lại khi đổi việc. */
  private farmerIcon: THREE.Sprite | null = null;
  private farmerIconKind: FarmerTaskKind | null = null;
  private farmerPrev = new THREE.Vector2();
  private farmerWalk = 0;
  private ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  private waterMat = toon(0x5bbbe8, { transparent: true, opacity: 0.85 });
  private fx = new Particles(this.root);
  /** Gọi khi một ô vừa được thu hoạch: vị trí thế giới + biểu tượng sản phẩm (app.ts cho chúng bay về HUD). */
  onHarvest: (slotId: string, world: THREE.Vector3, icons: string[]) => void = () => {};
  /** Gọi khi một ô vừa được gieo / cuốc / tưới / chín (app.ts phát âm thanh). */
  onAction: (kind: 'plant' | 'till' | 'water' | 'ripe') => void = () => {};

  constructor(private game: Game) {
    this.blades = this.buildScenery();
    this.swayNodes = collectSway(this.root);
  }

  private buildScenery(): THREE.Group {
    const r = this.root;
    const rnd = seeded(7);
    mesh(r, G.box(80, 0.4, 70), 0x8fd16a, { p: [0, -0.2, 0], cast: false });
    for (let i = 0; i < 14; i++) mesh(r, G.cyl(1, 1, 0.02, 12), 0x9eda7a, { p: [-18 + rnd() * 36, 0.01, -8 + rnd() * 20], s: [1 + rnd() * 2, 1, 0.8 + rnd()], cast: false });
    mesh(r, G.box(1.5, 0.03, 20), 0xdcbf8e, { p: [1.25, 0.015, 3], cast: false });
    mesh(r, G.box(16, 0.03, 1.5), 0xdcbf8e, { p: [8.5, 0.015, 5.2], cast: false });

    // Đồi xa
    for (const [x, s] of [[-16, 9], [0, 12], [17, 10]]) mesh(r, G.ico(1, 2), 0x74b85a, { p: [x, -4.5, -22], s: [s * 1.4, s, s], cast: false });

    // Nhà kho đỏ + tháp chứa
    const barn = group(r, { p: [7.5, 0, -7.2] });
    mesh(barn, G.box(4.6, 2.6, 3.2), 0xc94a3f, { p: [0, 1.3, 0] });
    mesh(barn, G.prism(), 0x7a4a3a, { p: [0, 2.6, 0], s: [5.2, 1.5, 3.6] });
    mesh(barn, G.box(1.3, 1.7, 0.1), 0xf3e9d2, { p: [0, 0.85, 1.62] });
    mesh(barn, G.box(0.9, 0.7, 0.1), 0xf3e9d2, { p: [0, 2.9, 1.62] });
    mesh(r, G.cyl(0.95, 0.95, 3.6, 14), 0xe9eef2, { p: [11.4, 1.8, -7.4] });
    mesh(r, G.cone(1.05, 0.9, 14), 0xc94a3f, { p: [11.4, 4.05, -7.4] });

    // Cối xay gió — cánh quay nhanh theo sức gió
    const mill = group(r, { p: [-9.5, 0, -7.4] });
    mesh(mill, G.cyl(0.45, 0.85, 3.8, 10), 0xf3e9d2, { p: [0, 1.9, 0] });
    mesh(mill, G.cone(0.6, 0.7, 10), 0xc94a3f, { p: [0, 4.15, 0] });
    const blades = group(mill, { p: [0, 3.5, 0.6] });
    mesh(blades, G.sphere(0.16, 8, 6), 0x8a5a3a);
    for (let i = 0; i < 4; i++) {
      const arm = group(blades, { r: [0, 0, (i * Math.PI) / 2] });
      mesh(arm, G.box(0.34, 1.9, 0.05), 0xffffff, { p: [0, 1.05, 0] });
    }

    // Cây, bụi, hàng rào
    for (let x = -19; x <= 19; x += 3.1) {
      if (Math.abs(x - 7.5) < 3.2 || Math.abs(x + 9.5) < 1.6 || Math.abs(x - 11.4) < 1.5) continue;
      makeTree(r, { p: [x + rnd() * 1.2, 0, -9.5 - rnd() * 2.5], s: 1.1 + rnd() * 0.7 }, rnd() > 0.5 ? 0x5fae57 : 0x4f9e4a);
    }
    for (const x of [-18.5, 19.5]) for (let z = -5; z <= 9; z += 3.4) makeTree(r, { p: [x + rnd(), 0, z + rnd()], s: 1 + rnd() * 0.6 });
    for (let i = 0; i < 10; i++) makeBush(r, { p: [-15 + rnd() * 14, 0, 11.5 + rnd() * 2], s: 0.8 + rnd() * 0.6 });
    makeFence(r, -15.2, -4.4, 0.4, -4.4);
    makeFence(r, 2.1, -4.4, 15.5, -4.4);

    // Bác nông dân — vị trí cập nhật mỗi khung hình theo state.farm.farmer
    const farmer = (this.farmer = makePerson(LOOKS[2], 'straw'));
    const home = this.game.state.farm.farmer;
    farmer.position.set(home.x, 0, home.z);
    this.farmerPrev.set(home.x, home.z);
    farmer.scale.setScalar(1.15);
    r.add(farmer);
    return blades;
  }

  private buildSlot(slot: FarmSlot): SlotView {
    const { layout } = this.game.content.slotTypes.get(slot.type);
    const { x, z } = slotCenter(this.game.ctx, slot);
    const g = group(this.root, { p: [x, 0, z] });
    g.userData.pick = { type: 'slot', id: slot.id } satisfies Pick;
    const s = layout.size;
    const view: Partial<SlotView> = {};

    if (slot.type === 'field') {
      // Đất có vật liệu riêng từng ô để đổi màu theo trạng thái: chai cứng / tơi xốp / ẩm ướt
      view.soil = toon(SOIL.hard, {});
      mesh(g, G.box(s, 0.3, s), 0xa9774c, { p: [0, 0.05, 0] });
      mesh(g, G.box(s - 0.3, 0.32, s - 0.3), view.soil, { p: [0, 0.05, 0] });
      view.furrows = group(g);
      for (const fx of [-0.66, 0, 0.66]) mesh(view.furrows, G.box(0.42, 0.12, s - 0.5), view.soil, { p: [fx, 0.21, 0], cast: false });
      view.weeds = group(g);
      for (const [wx, wz] of [[-0.6, -0.4], [0.5, 0.6], [0.2, -0.7], [-0.3, 0.5]]) mesh(view.weeds, G.cone(0.09, 0.26, 5), 0x7fbf5a, { p: [wx, 0.33, wz], cast: false });
    } else if (slot.type === 'pen') {
      const h = s / 2;
      mesh(g, G.box(s, 0.1, s), 0xe9d18b, { p: [0, 0.03, 0], cast: false });
      makeFence(g, -h, -h, h, -h);
      makeFence(g, -h, h, h, h);
      makeFence(g, -h, -h, -h, h);
      makeFence(g, h, -h, h, h);
      // Chuồng nhỏ + máng ăn
      mesh(g, G.box(1.3, 0.9, 0.9), 0xd9534a, { p: [-0.8, 0.5, -1.05] });
      mesh(g, G.prism(), 0x8a5a3a, { p: [-0.8, 0.95, -1.05], s: [1.6, 0.6, 1.1] });
      mesh(g, G.box(0.45, 0.5, 0.06), 0x5a2f24, { p: [-0.8, 0.3, -0.59] });
      mesh(g, G.box(0.9, 0.2, 0.35), 0xb9733f, { p: [0.9, 0.15, -1.2] });
    } else {
      // Ao: bờ đá, mặt nước, lá súng, cầu gỗ nhỏ, bụi lau
      mesh(g, G.cyl(1.5, 1.62, 0.22, 22), 0xb9b4a8, { p: [0, 0.08, 0] });
      mesh(g, G.cyl(1.3, 1.3, 0.24, 22), this.waterMat, { p: [0, 0.09, 0], cast: false });
      for (const [lx, lz] of [[0.7, 0.5], [-0.6, 0.75], [-0.8, -0.5]]) mesh(g, G.cyl(0.2, 0.2, 0.02, 8), 0x5fae57, { p: [lx, 0.22, lz], cast: false });
      mesh(g, G.box(0.5, 0.06, 1), 0xc98b4f, { p: [0, 0.3, 1.45] });
      for (const side of [-1, 1]) mesh(g, G.cyl(0.04, 0.04, 0.4, 6), 0x8a5a35, { p: [side * 0.22, 0.2, 1.9] });
      for (const [rx, rz] of [[-1.35, 0.6], [-1.5, 0.2], [1.4, -0.5]]) mesh(g, G.cone(0.06, 0.8, 5), 0x6aa84f, { p: [rx, 0.5, rz], cast: false });
    }

    const ring = mesh(g, G.box(1, 0.04, 1), this.ringMat, { p: [0, 0.01, 0], s: [s + 0.35, 1, s + 0.35], cast: false, receive: false });
    const bar = new Bar3D(1.1);
    const top = slot.type === 'pen' ? 2 : 1.3;
    bar.group.position.set(0, top, 0);
    const drop = emojiSprite('💧', 0.6);
    const hoe = emojiSprite('⛏️', 0.6);
    g.add(bar.group, drop, hoe);
    return { ...view, g, content: group(g, { p: [0, slot.type === 'field' ? 0.2 : 0.1, 0] }), producerId: undefined, tier: 1, movers: [], ready: null, bar, ring, type: slot.type, drop, hoe, prev: null, kickAt: -99, popAt: -99, ripeAt: -99, cropStage: 2 };
  }

  /** Dựng lại thứ đang trồng/nuôi trong ô khi producer hoặc bậc của ô đổi. */
  private fill(view: SlotView, producerId: string | null, tier: number, cropStage: CropStage): void {
    view.content.clear();
    view.cropStage = cropStage;
    view.movers = [];
    view.ready = null;
    view.producerId = producerId;
    view.tier = tier;
    if (!producerId) return;
    const def = this.game.content.producers.get(producerId);

    if (view.type === 'field') {
      for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
        const crop = makeCrop(producerId, cropStage);
        crop.position.set(x, 0, z);
        view.content.add(crop);
        view.movers.push({ g: crop, x, z, phase: x * 3 + z });
      }
    } else {
      // Ô càng to (bậc cao) càng nhiều con
      const animals = Array.from({ length: tier }, () => makeAnimals(producerId) ?? []).flat();
      if (animals.length) {
        animals.forEach((a, i) => {
          const angle = (i / animals.length) * Math.PI * 2 + 0.6;
          const radius = animals.length > 1 ? 0.75 : 0.2;
          const x = Math.cos(angle) * radius + (view.type === 'pen' ? 0.25 : 0);
          const z = Math.sin(angle) * radius + (view.type === 'pen' ? 0.35 : 0);
          a.scale.setScalar(1 / (1 + this.game.content.slotTypes.get(view.type).layout.tierGrowth * (tier - 1))); // con vật giữ nguyên cỡ dù ô được phóng to
          view.content.add(a);
          view.movers.push({ g: a, x, z, phase: i * 2.1 });
        });
      } else {
        // Producer chưa có model riêng: hiện biểu tượng của nó
        const icon = emojiSprite(def.icon, 1);
        icon.position.y = 0.7;
        view.content.add(icon);
      }
    }
    view.ready = emojiSprite(this.game.content.items.get(def.yields[0].item).icon, 0.75);
    view.content.add(view.ready);
  }

  /** So trạng thái ô với khung hình trước và phát hiệu ứng cho thay đổi vừa xảy ra. */
  private react(view: SlotView, slot: FarmSlot, prev: SlotSnapshot, env: Env): void {
    const { content, ctx } = this.game;
    const t = env.t;
    const at = (y: number) => view.g.localToWorld(new THREE.Vector3(0, y, 0));

    if (prev.producerId && prev.stage === 'ready' && (slot.stage !== 'ready' || slot.producerId !== prev.producerId)) {
      // Vừa thu hoạch: sản phẩm bật tung ra rồi (ở app.ts) bay về nút Kho
      const def = content.producers.get(prev.producerId);
      const icons: string[] = [];
      for (const y of yieldsOf(ctx, slot, def)) for (let i = 0; i < y.qty && icons.length < MAX_HARVEST_ICONS; i++) icons.push(content.items.get(y.item).icon);
      for (const icon of new Set(icons)) this.fx.burst(icon, at(0.6), { count: icons.filter((i) => i === icon).length + 1, up: 4.2, spread: 1.3, life: 0.7, size: 0.55 });
      this.fx.burst('✨', at(0.8), { count: 4, up: 2, spread: 1.6, gravity: 2, life: 0.6, size: 0.35 });
      view.kickAt = t;
      this.onHarvest(slot.id, at(0.8), icons);
    }
    if (slot.producerId && slot.producerId !== prev.producerId) {
      // Vừa gieo/thả giống: cây con bật lên từ đất
      view.popAt = t;
      view.kickAt = t;
      this.onAction('plant');
      this.fx.burst('🌱', at(0.4), { count: 3, up: 2.5, spread: 0.9, life: 0.55, size: 0.3 });
    }
    if (slot.tilled && !prev.tilled) {
      view.kickAt = t;
      this.onAction('till');
      this.fx.burst('💨', at(0.3), { count: 5, up: 1.2, spread: 1.8, gravity: 1, life: 0.6, size: 0.4 });
    }
    // Tưới tay (mưa làm ẩm cả loạt thì thôi, để khỏi rối mắt)
    if (slot.wet > prev.wet + 1 && env.rain < 0.3) {
      view.kickAt = t;
      this.onAction('water');
      this.fx.burst('💧', at(1.6), { count: 4, up: 0, spread: 0.7, gravity: 7, life: 0.5, size: 0.35, stagger: 0.05 });
    }
    if (slot.producerId && slot.producerId === prev.producerId && prev.stage !== 'ready' && slot.stage === 'ready') {
      view.ripeAt = t;
      this.onAction('ripe');
      this.fx.burst('✨', at(1), { count: 5, up: 1.5, spread: 1.4, gravity: 1, life: 0.8, size: 0.35 });
    }
  }

  /** Vẽ bác nông dân theo state: chạy khi đang đi, làm động tác theo việc khi đã tới nơi, vẫy tay khi rảnh. */
  private updateFarmer(env: Env, dt: number): void {
    const { state, ctx } = this.game;
    const f = state.farm.farmer;
    const g = this.farmer;
    const moved = Math.hypot(f.x - this.farmerPrev.x, f.z - this.farmerPrev.y);
    // Làm mượt trạng thái "đang đi" để tay chân không giật khi tốc độ khung hình dao động
    this.farmerWalk += ((moved > 1e-4 ? 1 : 0) - this.farmerWalk) * Math.min(1, dt * 12);
    if (moved > 1e-4) g.rotation.y = Math.atan2(f.x - this.farmerPrev.x, f.z - this.farmerPrev.y);
    this.farmerPrev.set(f.x, f.z);
    g.position.set(f.x, Math.abs(Math.sin(env.t * 11)) * 0.08 * this.farmerWalk, f.z);

    const work = currentWork(ctx);
    const task = f.tasks[0] ?? null;
    let pose = {};
    if (work) {
      // Đã tới nơi: quay mặt vào ô rồi làm việc
      const slot = state.farm.slots.find((s) => s.id === work.slotId);
      if (slot) {
        const c = slotCenter(ctx, slot);
        g.rotation.y = Math.atan2(c.x - f.x, c.z - f.z);
      }
      pose = work.kind === 'till' ? { dig: 1 } : work.kind === 'water' ? { pour: 1 } : work.kind === 'visit' ? {} : { reach: 1 };
    } else if (!task) {
      // Rảnh: thở, chớp mắt, thỉnh thoảng vẫy tay chào
      pose = { wave: Math.max(0, Math.min(1, (Math.sin(env.t * 0.35) - 0.85) * 8)) };
    }
    animatePerson(g, env.t, { walk: this.farmerWalk, ...pose });

    // Biểu tượng việc trên đầu: cho người chơi biết bác đang đi làm gì
    const kind = task?.kind ?? null;
    if (kind !== this.farmerIconKind) {
      if (this.farmerIcon) g.remove(this.farmerIcon);
      this.farmerIcon = kind ? emojiSprite(TASK_ICON[kind], 0.42) : null;
      if (this.farmerIcon) g.add(this.farmerIcon);
      this.farmerIconKind = kind;
    }
    if (this.farmerIcon) this.farmerIcon.position.set(0, 1.75 + Math.abs(Math.sin(env.t * 4)) * 0.08, 0);
  }

  update(env: Env, dt: number): void {
    const { state, content, ctx } = this.game;
    const counts: Partial<Record<SlotType, number>> = {};

    for (const slot of state.farm.slots) {
      const index = (counts[slot.type] = (counts[slot.type] ?? -1) + 1);
      let view = this.slots.get(slot.id);
      if (!view) this.slots.set(slot.id, (view = this.buildSlot(slot)));
      // Ruộng: cây đổi hình theo giai đoạn (mầm -> cây non -> trưởng thành); lên giai đoạn thì nảy một cái
      const growing0 = slot.producerId ? content.producers.get(slot.producerId) : null;
      const cropStage: CropStage = view.type === 'field' && growing0 && slot.stage !== 'ready' ? cropStageOf(slot.progress / cycleTime(growing0, slot)) : 2;
      if (view.producerId !== slot.producerId || view.tier !== slot.tier || view.cropStage !== cropStage) {
        const grew = view.producerId === slot.producerId && view.tier === slot.tier && cropStage > view.cropStage;
        this.fill(view, slot.producerId, slot.tier, cropStage);
        if (grew) {
          view.popAt = env.t;
          this.fx.burst('🍃', view.g.localToWorld(new THREE.Vector3(0, 0.6, 0)), { count: 3, up: 1.6, spread: 1, gravity: 2, life: 0.6, size: 0.28 });
        }
      }
      const snapshot: SlotSnapshot = { producerId: slot.producerId, stage: slot.stage, tilled: slot.tilled, wet: slot.wet };
      if (view.prev) this.react(view, slot, view.prev, env);
      view.prev = snapshot;

      // Squash & stretch cả ô khi vừa có thao tác: dẹt xuống rồi nảy lại
      const base = slotScale(ctx, slot);
      const squash = wobble(env.t - view.kickAt, 0.45);
      view.g.scale.set(base * (1 + 0.06 * squash), base * (1 - 0.12 * squash), base * (1 + 0.06 * squash));
      view.ring.visible = env.selectedSlot === slot.id;

      const def = slot.producerId ? content.producers.get(slot.producerId) : null;
      const growing = !!def && slot.stage === 'growing';
      const top = view.type === 'pen' ? 2 : 1.3;
      const bob = Math.abs(Math.sin(env.t * 3 + index)) * 0.12;

      // Trạng thái đất của ruộng: chai cứng (nhạt, có cỏ) -> tơi xốp (sẫm, có luống) -> ẩm (sẫm hơn nữa)
      if (view.soil) {
        view.soil.color.setHex(slot.tilled ? SOIL.tilled : SOIL.hard).multiplyScalar(slot.wet > 0 ? SOIL.wetMul : 1);
        view.furrows!.visible = slot.tilled;
        view.weeds!.visible = !slot.tilled;
      }
      view.hoe.visible = !!content.slotTypes.get(slot.type).needsTilling && !slot.tilled && !def;
      view.hoe.position.y = 0.9 + bob;
      view.drop.visible = growing && needsWatering(ctx, slot);
      view.drop.position.set(0.7, top + 0.15 + bob, 0);

      view.bar.group.visible = growing;
      if (!def) continue;
      const frac = slot.stage === 'ready' ? 1 : Math.min(1, slot.progress / cycleTime(def, slot));
      if (growing) view.bar.set(frac);
      // Lứa đầu: lớn dần. Các lứa sau (gà đẻ, bò sữa): đã trưởng thành.
      // Mỗi giai đoạn đã có hình riêng nên chỉ lớn thêm chút trong giai đoạn; con vật lứa đầu vẫn lớn dần
      const scale = slot.cyclesDone > 0 ? 1 : view.type === 'field' ? 0.8 + 0.2 * frac : 0.3 + 0.7 * frac;
      const fit = view.type === 'field' ? 1 : 1 / base;
      // Bật lên lúc mới gieo; nảy lò xo lúc vừa chín; chín rồi thì "thở" nhẹ cho biết đang chờ thu
      const pop = easeOutBack((env.t - view.popAt) / 0.45);
      const ripe = slot.stage === 'ready' ? 1 + 0.35 * wobble(env.t - view.ripeAt, 0.8, 14) + 0.03 * Math.sin(env.t * 4 + index) : 1;

      for (const m of view.movers) {
        if (view.type !== 'field') animateCreature(m.g, env.t, m.phase);
        m.g.scale.set(scale * fit * pop, scale * fit * pop * ripe, scale * fit * pop);
        if (view.type === 'field') {
          m.g.rotation.z = Math.sin(env.t * (1.4 + env.wind * 2) + m.phase) * (0.03 + env.wind * 0.12);
        } else if (view.type === 'pen') {
          const a = env.t * 0.35 + m.phase;
          m.g.position.set(m.x + Math.sin(a) * 0.35, Math.abs(Math.sin(env.t * 3 + m.phase)) * 0.04, m.z + Math.cos(a * 0.8) * 0.3);
          m.g.rotation.y = Math.atan2(Math.cos(a), -Math.sin(a * 0.8) * 0.8) + Math.sin(env.t * 0.5 + m.phase) * 0.3;
        } else {
          const a = env.t * 0.9 + m.phase;
          const lane = 0.45 + ((m.phase * 7) % 5) * 0.1;
          m.g.position.set(Math.cos(a) * lane, 0.12 + Math.max(0, Math.sin(env.t * 1.3 + m.phase * 2) - 0.75) * 1.6, Math.sin(a) * lane);
          m.g.rotation.y = -a;
        }
      }
      if (view.ready) {
        view.ready.visible = slot.stage === 'ready';
        view.ready.position.y = top + 0.05 + bob * 2;
        view.ready.scale.setScalar(0.75 * Math.max(0.001, easeOutBack((env.t - view.ripeAt) / 0.4)));
      }
    }

    this.fx.update(dt);
    this.updateFarmer(env, dt);
    sway(this.swayNodes, env);
    this.blades.rotation.z -= 0.004 + env.wind * 0.09;
    this.waterMat.color.setHex(0x5bbbe8).multiplyScalar(0.55 + 0.45 * env.day);
  }
}
