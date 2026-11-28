import * as THREE from 'three';
import type { Game } from '../../../sim/game';
import type { FarmSlot } from '../../../sim/state';
import { cycleTime, yieldsOf } from '../../../sim/systems/farm';
import { buildingRect, currentWork } from '../../../sim/systems/farmer';
import { easeOutBack, wobble } from '../../ease';
import { dashedRect, makeGreenhouse } from '../farmkit';
import { Particles } from '../fx';
import { animatePerson, cropStageOf, FARMER_SHAPE, LOOKS, makeCrop, makePerson, type CropStage } from '../models';
import type { Area, Env, Pick } from '../stage';
import { Bar3D, emojiSprite, G, group, mesh, paintSeason, type V3 } from '../toon';

/**
 * KHU NHÀ KÍNH (bên trong nhà màng ở nông trại). Toạ độ riêng của khu: nhà chạy dọc +x từ x = 0 (cửa, đầu tây),
 * lối đi bê tông ở giữa (z = 0), mỗi cột 2 luống hai bên lối đi. Luống thứ i: cột ⌊i/2⌋, bên (i chẵn: bắc, lẻ: nam).
 * Nhà dài thêm về phía đông khi nới rộng (mua thêm lô luống) - cùng số đo với nhà trên bản đồ nông trại (buildingRect).
 * Bấm luống phát Pick {type:'slot'} như ô ngoài nông trại; bác nông dân đứng ở cửa nhà kính trong sim,
 * khu này vẽ bác ở cạnh luống đang làm cho có cảm giác.
 */

const BED = { length: 1.6, depth: 1.5, z: 1.45, height: 0.32 };

interface BedView {
  g: THREE.Group;
  content: THREE.Group;
  producerId: string | null | undefined;
  stage: CropStage;
  ready: THREE.Sprite | null;
  bar: Bar3D;
  ring: THREE.Mesh;
  prevStage: FarmSlot['stage'] | null;
  prevProducer: string | null;
  kickAt: number;
  popAt: number;
}

export class GreenhouseArea implements Area {
  id = 'greenhouse';
  label = 'Nhà kính';
  icon = '🏡';
  root = new THREE.Group();
  view = { position: [3, 9.5, 10] as V3, target: [5, 0, 0] as V3, orbit: 0.8 };
  rainBox = { min: [-20, 0, -30] as V3, max: [40, 14, -14] as V3 };

  private beds = new Map<string, BedView>();
  private house: { length: number; g: THREE.Group; fans: THREE.Object3D[] } | null = null;
  private expand = group(this.root);
  private farmer = makePerson(LOOKS[2], 'straw', FARMER_SHAPE);
  private fx = new Particles(this.root);
  private ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  /** Gọi khi một luống vừa thu hoạch (app.ts cho sản phẩm bay về nút Kho) / vừa gieo, chín (âm thanh). */
  onHarvest: (slotId: string, world: THREE.Vector3, icons: string[]) => void = () => {};
  onAction: (kind: 'plant' | 'ripe') => void = () => {};

  constructor(private game: Game) {
    // Nền đất quanh nhà (nhìn qua màng), cỏ ngoài xa
    mesh(this.root, G.box(80, 0.4, 60), 0x8fd16a, { p: [10, -0.25, 0], cast: false });
    this.farmer.scale.setScalar(1.1);
    this.farmer.visible = false;
    this.root.add(this.farmer);
  }

  private plotType() {
    return this.game.content.slotTypes.all().find((t) => t.building)!;
  }

  /** Tâm luống thứ i trong khu (mét). */
  private bedPos(i: number): { x: number; z: number } {
    const b = this.plotType().building!;
    return { x: b.endLength + b.colLength * (Math.floor(i / 2) + 0.5), z: i % 2 ? BED.z : -BED.z };
  }

  /** Dựng lại vỏ nhà (khung, màng, lối đi) theo chiều dài hiện tại; chỉnh lại góc nhìn mặc định cho vừa nhà. */
  private buildHouse(length: number): void {
    if (this.house) this.root.remove(this.house.g);
    const b = this.plotType().building!;
    const built = makeGreenhouse(length, b.width, b.colLength, true);
    const g = group(this.root);
    g.add(built.g);
    // Nền trong nhà: sỏi nhạt + lối đi bê tông ở giữa + rãnh thoát nước hai bên
    mesh(g, G.box(length, 0.04, b.width - 0.1), 0xe2d8c0, { p: [length / 2, 0.1, 0], cast: false });
    mesh(g, G.box(length, 0.05, 1.3), 0xcfd3d6, { p: [length / 2, 0.13, 0], cast: false });
    for (const z of [-0.68, 0.68]) mesh(g, G.box(length, 0.06, 0.06), 0xa9aeb4, { p: [length / 2, 0.15, z], cast: false });
    // Ống tưới nhỏ giọt chạy dọc trên cao + dây treo
    for (const side of [-1, 1]) {
      mesh(g, G.cyl(0.025, 0.025, length - 0.4, 6), 0x2a2d35, { p: [length / 2, 2.15, side * BED.z], r: [0, 0, Math.PI / 2], cast: false });
      for (let x = 0.6; x < length - 0.4; x += 0.9) mesh(g, G.cyl(0.006, 0.006, 1.4, 3), 0xe8e8e8, { p: [x, 1.45, side * BED.z], cast: false });
    }
    // Bàn dụng cụ + thùng tưới cạnh cửa
    mesh(g, G.box(0.6, 0.7, 0.5), 0x8a5a35, { p: [0.45, 0.45, -2.1] });
    mesh(g, G.cyl(0.14, 0.12, 0.25, 10), 0x5fae57, { p: [0.45, 0.93, -2.1] });
    this.house = { length, g, fans: built.fans };
    this.view.target = [length / 2, 0, 0];
    this.view.position = [length / 2 - 3.5, 7 + length * 0.18, 7.5 + length * 0.25];
  }

  private buildBed(slot: FarmSlot, i: number): BedView {
    const p = this.bedPos(i);
    const g = group(this.root, { p: [p.x, 0, p.z] });
    g.userData.pick = { type: 'slot', id: slot.id } satisfies Pick;
    // Luống đất nâng cao, viền trắng như khung luống trong nhà màng
    mesh(g, G.box(BED.length, BED.height, BED.depth), 0xf3f3f3, { p: [0, BED.height / 2, 0] });
    mesh(g, G.box(BED.length - 0.12, BED.height + 0.02, BED.depth - 0.12), 0x7a4f2e, { p: [0, BED.height / 2, 0] });
    mesh(g, G.cyl(0.015, 0.015, BED.length - 0.1, 5), 0x2a2d35, { p: [0, BED.height + 0.03, 0], r: [0, 0, Math.PI / 2], cast: false }); // ống nhỏ giọt
    const ring = mesh(g, G.box(BED.length + 0.25, 0.03, BED.depth + 0.25), this.ringMat, { p: [0, 0.14, 0], cast: false, receive: false });
    const bar = new Bar3D(0.9);
    bar.group.position.set(0, 1.35, 0);
    g.add(bar.group);
    return { g, content: group(g, { p: [0, BED.height, 0] }), producerId: undefined, stage: 2, ready: null, bar, ring, prevStage: null, prevProducer: null, kickAt: -99, popAt: -99 };
  }

  private fill(view: BedView, producerId: string | null, stage: CropStage): void {
    view.content.clear();
    view.producerId = producerId;
    view.stage = stage;
    view.ready = null;
    if (!producerId) return;
    for (const [x, z] of [[-0.4, -0.35], [0.4, -0.35], [-0.4, 0.35], [0.4, 0.35]]) {
      const crop = makeCrop(producerId, stage);
      crop.position.set(x, 0, z);
      crop.scale.setScalar(0.85);
      view.content.add(crop);
    }
    const def = this.game.content.producers.get(producerId);
    view.ready = emojiSprite(this.game.content.items.get(def.yields[0].item).icon, 0.6);
    view.ready.position.y = 1.1;
    view.content.add(view.ready);
  }

  private paintedSeason = -1;

  update(env: Env, dt: number): void {
    // Nền cỏ ngoài nhà đổi theo mùa (cây trồng bên trong giữ nguyên)
    if (this.paintedSeason !== env.season) {
      this.paintedSeason = env.season;
      paintSeason(this.root, env.season, false);
    }
    const { state, ctx, content } = this.game;
    const type = this.plotType();
    const plots = state.farm.slots.filter((s) => s.type === type.id);
    const rect = buildingRect(ctx, type.id)!;
    const length = rect.x2 - rect.x1;
    if (!this.house || this.house.length !== length) {
      this.buildHouse(length);
      this.rebuildExpand(plots.length);
    }

    plots.forEach((slot, i) => {
      let view = this.beds.get(slot.id);
      if (!view) this.beds.set(slot.id, (view = this.buildBed(slot, i)));
      const def = slot.producerId ? content.producers.get(slot.producerId) : null;
      const stage: CropStage = def && slot.stage !== 'ready' ? cropStageOf(slot.progress / cycleTime(def, slot)) : 2;
      if (view.producerId !== slot.producerId || view.stage !== stage) {
        const grew = view.producerId === slot.producerId && stage > view.stage;
        this.fill(view, slot.producerId, stage);
        if (grew) view.popAt = env.t;
      }
      // Hiệu ứng: gieo (cây bật lên), chín (lấp lánh), thu (sản phẩm bung ra rồi bay về Kho)
      const at = (y: number) => view!.g.localToWorld(new THREE.Vector3(0, y, 0));
      if (view.prevProducer && view.prevStage === 'ready' && (slot.stage !== 'ready' || slot.producerId !== view.prevProducer)) {
        const d = content.producers.get(view.prevProducer);
        const icons: string[] = [];
        for (const y of yieldsOf(ctx, slot, d)) for (let k = 0; k < y.qty && icons.length < 4; k++) icons.push(content.items.get(y.item).icon);
        for (const icon of new Set(icons)) this.fx.burst(icon, at(0.6), { count: 3, up: 3.5, spread: 1, life: 0.7, size: 0.45 });
        view.kickAt = env.t;
        this.onHarvest(slot.id, at(0.8), icons);
      }
      if (slot.producerId && slot.producerId !== view.prevProducer) {
        view.popAt = env.t;
        view.kickAt = env.t;
        this.onAction('plant');
        this.fx.burst('🌱', at(0.5), { count: 3, up: 2, spread: 0.7, life: 0.5, size: 0.28 });
      }
      if (slot.producerId && slot.producerId === view.prevProducer && view.prevStage !== 'ready' && slot.stage === 'ready') {
        this.onAction('ripe');
        this.fx.burst('✨', at(0.9), { count: 4, up: 1.4, spread: 1, gravity: 1, life: 0.7, size: 0.3 });
      }
      view.prevProducer = slot.producerId;
      view.prevStage = slot.stage;

      const squash = wobble(env.t - view.kickAt, 0.45);
      view.g.scale.set(1 + 0.05 * squash, 1 - 0.1 * squash, 1 + 0.05 * squash);
      view.ring.visible = env.selectedSlot === slot.id;
      view.bar.group.visible = !!def && slot.stage === 'growing';
      if (def && slot.stage === 'growing') view.bar.set(Math.min(1, slot.progress / cycleTime(def, slot)));
      const pop = easeOutBack((env.t - view.popAt) / 0.45);
      view.content.scale.setScalar(Math.max(0.001, pop));
      if (view.ready) {
        view.ready.visible = slot.stage === 'ready';
        view.ready.position.y = 1.1 + Math.abs(Math.sin(env.t * 3 + i)) * 0.15;
      }
      for (const crop of view.content.children) if (crop !== view.ready) crop.rotation.z = Math.sin(env.t * 1.2 + i + crop.position.x * 3) * 0.03; // quạt thông gió làm lá rung nhẹ
    });

    // Bác nông dân: hiện cạnh luống khi đang làm việc ở luống đó (trong sim bác đứng ở cửa nhà kính)
    const work = currentWork(ctx);
    const index = work ? plots.findIndex((s) => s.id === work.slotId) : -1;
    this.farmer.visible = index >= 0;
    if (index >= 0) {
      const p = this.bedPos(index);
      this.farmer.position.set(p.x, 0.15, Math.sign(p.z) * 0.35);
      this.farmer.rotation.y = p.z > 0 ? 0 : Math.PI;
      animatePerson(this.farmer, env.t, { reach: 1 });
    }

    for (const f of this.house!.fans) f.rotation.z += dt * 9;
    this.fx.update(dt);
    for (const g of this.expand.children) {
      const bob = g.userData.bob as THREE.Sprite | undefined;
      if (bob) bob.position.y = 0.7 + Math.abs(Math.sin(env.t * 2)) * 0.12;
    }
  }

  /** Viền đứt khúc ở đầu đông: phần nhà dài thêm khi nới rộng (bấm để mở bảng mua). */
  private rebuildExpand(count: number): void {
    this.expand.clear();
    const type = this.plotType();
    if (count >= type.max) return;
    const { ctx } = this.game;
    const now = buildingRect(ctx, type.id, count)!;
    const next = buildingRect(ctx, type.id, Math.min(type.max, count + (type.batch ?? 1)))!;
    const len = next.x2 - now.x2;
    const g = group(this.expand, { p: [now.x2 - now.x1 + len / 2, 0, 0] });
    dashedRect(g, len, 0.45, type.building!.width);
    const hit = mesh(g, G.box(len, 0.06, type.building!.width), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { p: [0, 0.05, 0], cast: false, receive: false });
    hit.userData.pick = { type: 'expand', id: type.id } satisfies Pick;
    const plus = emojiSprite('➕', 0.6);
    plus.position.set(0, 0.7, 0);
    g.add(plus);
    g.userData.bob = plus;
  }
}
