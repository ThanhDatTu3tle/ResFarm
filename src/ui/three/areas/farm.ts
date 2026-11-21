import * as THREE from 'three';
import type { SlotType } from '../../../data';
import type { Game } from '../../../sim/game';
import type { FarmerTaskKind, FarmSlot } from '../../../sim/state';
import type { MillType } from '../../../data';
import { farmChecklist } from '../../../sim/systems/tutorial';
import { buildingRect, currentWork, isAutoSlot, nextWaypoint, slotCenter, slotCenterAt, slotScale, workSpot } from '../../../sim/systems/farmer';
import { OwnerWalker, type Spot } from '../owner';
import { millCenter, millCenterAt } from '../../../sim/systems/mills';
import { dashedOutline, dashedRect, fillSacks, makeGreenhouse, grainField, hayBale, makeRiceMill, makeTractor, makeWindmill, outlineSlab, pondOutline, strawLitter } from '../farmkit';
import { cycleTime, needsWatering, nextTier, yieldsOf } from '../../../sim/systems/farm';
import { easeOutBack, wobble } from '../../ease';
import { Particles } from '../fx';
import { makeFruitTree } from '../farmkit';
import { adultShape, animateCreature, animatePerson, cropStageOf, FARMER_SHAPE, LOOKS, makeAnimals, makeBush, makeCrop, makeFence, makeLampPost, makePerson, makeTree, type CropStage } from '../models';
import { collectSway, sway, type Area, type Env, type Pick } from '../stage';
import { Bar3D, emojiSprite, G, group, mesh, seeded, toon, type V3, paintSeason } from '../toon';

/**
 * KHU NÔNG TRẠI — ruộng, chuồng, ao ngoài trời. Mỗi ô trong state.farm.slots có một SlotView;
 * bấm vào ô phát Pick {type:'slot'} (app.ts quyết định: thu hoạch / cuốc / tưới / mở bảng chọn giống).
 * Mua thêm ô thì ô mới tự mọc ra theo SlotTypeDef.layout (src/data/farm.ts); ô lên bậc (ao nới rộng) thì to ra và nuôi nhiều con hơn.
 * Bác nông dân là nhân vật trong sim (systems/farmer.ts): khu này chỉ vẽ bác theo state.farm.farmer.
 */

/** Dải phẳng nằm trên mặt đất chạy theo đường cong (lòng sông, bãi cát). */
function ribbon(curve: THREE.Curve<THREE.Vector3>, width: number, samples: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    const h = width / 2;
    pos.push(p.x - t.z * h, 0, p.z + t.x * h, p.x + t.z * h, 0, p.z - t.x * h);
    if (i < samples) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Biểu tượng việc bác nông dân đang làm / sắp làm, hiện trên đầu bác. */
/** Áo người làm vườn (khác áo bác nông dân). */
const GARDENER_LOOKS = [LOOKS[5], LOOKS[3], LOOKS[6]];
const TASK_ICON: Record<FarmerTaskKind, string> = { till: '⛏️', water: '💧', plant: '🌱', harvest: '🧺', clear: '🧹', visit: '👀', haul: '🚜' };

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
  /** Ngày hướng dẫn: khung vàng nhấp nháy (+ mũi tên ở ô đầu mỗi loại) chỉ chỗ cần làm. */
  hint?: THREE.Group;
  drop: THREE.Sprite;
  hoe: THREE.Sprite;
  /** Trạng thái ô ở khung hình trước — so sánh để biết vừa xảy ra chuyện gì (gieo, chín, thu...) mà phát hiệu ứng. */
  prev: SlotSnapshot | null;
  /** Mốc env.t của các hiệu ứng đang chạy: ô bị nhún, cây bật lên khi gieo, cây nảy khi chín. */
  kickAt: number;
  popAt: number;
  ripeAt: number;
  /** Giai đoạn lớn của cây đang dựng (ruộng rau, lúa mì, lúa nước). */
  cropStage: CropStage;
  /** Ruộng lúa: các khóm lúa (đung đưa theo gió). */
  grain?: THREE.Group;
}

interface MillView {
  g: THREE.Group;
  spin: THREE.Object3D;
  sacks: THREE.Group;
  sackCount: number;
  icon: THREE.Sprite | null;
  product: string;
  bar: Bar3D;
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
  // Bản đồ trải từ hàng cây phía sau (z ≈ -10) tới cối xay phía trước (z ≈ 27): nhìn xa hơn, bấm ô thì camera lướt lại gần
  view = { position: [3, 28, 37] as V3, target: [3, 0, 13] as V3, orbit: 1 };
  rainBox = { min: [-22, 0, -14] as V3, max: [30, 15, 32] as V3 };
  outdoor = true;

  private slots = new Map<string, SlotView>();
  private swayNodes: THREE.Object3D[];
  private mills = new Map<string, MillView>();
  /** Viền đứt khúc chỗ mua thêm được; dựng lại khi số ô / cối đổi. */
  private expand = group(this.root);
  private expandKey = '';
  private tractor = makeTractor();
  /** Máy cày đậu cạnh ruộng lúa lúc rảnh (bác lái đi thì ẩn, chỉ còn chiếc đang chạy). */
  private parked = makeTractor();
  /** Người làm vườn (state.farm.gardeners): hình theo id, tạo / xoá theo state. */
  private gardeners = new Map<string, { g: THREE.Group; prev: THREE.Vector2; walk: number; icon: THREE.Sprite | null; iconKind: FarmerTaskKind | null }>();
  private bulbs: THREE.MeshToonMaterial[] = [];
  /** Nhà màng (luống bên trong vẽ ở areas/greenhouse.ts); dựng lại khi nhà dài thêm. */
  private house: { count: number; g: THREE.Group; fans: THREE.Object3D[] } | null = null;
  private lamps: THREE.PointLight[] = [];
  private farmer!: THREE.Group;
  /** Biểu tượng việc trên đầu bác; dựng lại khi đổi việc. */
  private farmerIcon: THREE.Sprite | null = null;
  private farmerIconKind: FarmerTaskKind | null = null;
  private farmerPrev = new THREE.Vector2();
  private farmerWalk = 0;
  private ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  private waterMat = toon(0x5bbbe8, { transparent: true, opacity: 0.85 });
  /** Mùa đã tô màu cây cỏ (tô lại khi sang mùa). */
  private paintedSeason = -1;
  private fx = new Particles(this.root);
  /** Vệt sóng trôi trên sông/suối: vị trí u (0..1) dọc đường cong, lệch ngang off. */
  private flow: { m: THREE.Mesh; curve: THREE.Curve<THREE.Vector3>; u: number; off: number; speed: number }[] = [];
  /** Gọi khi một ô vừa được thu hoạch: vị trí thế giới + biểu tượng sản phẩm (app.ts cho chúng bay về HUD). */
  onHarvest: (slotId: string, world: THREE.Vector3, icons: string[]) => void = () => {};
  /** Gọi khi một ô vừa được gieo / cuốc / tưới / chín (app.ts phát âm thanh). */
  onAction: (kind: 'plant' | 'till' | 'water' | 'ripe') => void = () => {};

  constructor(private game: Game) {
    this.buildScenery();
    this.swayNodes = collectSway(this.root);
  }

  private buildScenery(): void {
    const r = this.root;
    const rnd = seeded(7);
    mesh(r, G.box(90, 0.4, 80), 0x8fd16a, { p: [4, -0.2, 8], cast: false });
    for (let i = 0; i < 22; i++) mesh(r, G.cyl(1, 1, 0.02, 12), 0x9eda7a, { p: [-18 + rnd() * 48, 0.01, -8 + rnd() * 38], s: [1 + rnd() * 2, 1, 0.8 + rnd()], cast: false });
    // Đường đất: dọc (x = 1.25) từ chuồng tới cối xay; ngang (z = 7.4) chạy dọc mép trước dãy chuồng
    mesh(r, G.box(1.5, 0.03, 32), 0xdcbf8e, { p: [1.25, 0.015, 9.6], cast: false });
    mesh(r, G.box(26, 0.03, 1.5), 0xdcbf8e, { p: [14, 0.015, 7.4], cast: false });
    // Đường đất bớt trống trải: vệt cát loang, đá cuội, sỏi nhỏ hai bên mép đường, vài khóm cỏ dại
    const roadPts: [number, number, number][] = []; // x, z, hướng (0 = dọc, 1 = ngang)
    for (let z = -5.5; z <= 25; z += 1.7) roadPts.push([1.25, z, 0]);
    for (let x = 2.5; x <= 26.5; x += 1.9) roadPts.push([x, 7.4, 1]);
    for (const [x, z, horiz] of roadPts) {
      const along = (rnd() - 0.5) * 1.2;
      const across = (rnd() - 0.5) * 1.3;
      const [px, pz] = horiz ? [x + along, z + across] : [x + across, z + along];
      if (rnd() < 0.45) mesh(r, G.cyl(1, 1, 0.012, 9), rnd() > 0.5 ? 0xe9d3a3 : 0xc9a874, { p: [px, 0.034, pz], s: [0.35 + rnd() * 0.5, 1, 0.25 + rnd() * 0.35], r: [0, rnd() * 3, 0], cast: false });
      if (rnd() < 0.5) mesh(r, G.ico(0.09 + rnd() * 0.12, 0), rnd() > 0.5 ? 0xa9aaa0 : 0x8f9088, { p: [px + 0.2, 0.05, pz - 0.15], s: [1, 0.55, 0.85], r: [0, rnd() * 3, 0] });
      for (let k = 0; k < 3; k++) mesh(r, G.ico(0.035, 0), 0xb7b2a2, { p: [px + (rnd() - 0.5) * 0.8, 0.035, pz + (rnd() - 0.5) * 0.8], cast: false });
      // Mép đường: đá to hơn + cỏ dại
      const edge = (rnd() > 0.5 ? 1 : -1) * 0.95;
      const [ex, ez] = horiz ? [x + along, z + edge] : [x + edge, z + along];
      if (rnd() < 0.35) mesh(r, G.ico(0.18 + rnd() * 0.12, 0), 0x9a9b92, { p: [ex, 0.08, ez], s: [1, 0.6, 0.9] });
      else if (rnd() < 0.4) for (let k = 0; k < 3; k++) mesh(r, G.cone(0.04, 0.3 + rnd() * 0.2, 4), 0x7fbf5a, { p: [ex + k * 0.08, 0.15, ez + k * 0.05], cast: false });
    }
    // Lối mòn trước ruộng lúa / sau ruộng lúa nước (bác chạy ngang ở đây)
    // Lối mòn phía bắc sau hàng rào (tới cối xay gió) và lối trước ruộng lúa (tới nhà xay lúa bên sông)
    mesh(r, G.box(10.5, 0.02, 0.8), 0xd8c39a, { p: [-4, 0.012, -5.65], cast: false });
    mesh(r, G.box(11.5, 0.02, 0.8), 0xd8c39a, { p: [-4.5, 0.012, 23.45], cast: false });

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

    this.buildWater();

    // Cây, bụi, hàng rào (chừa chỗ cho sông bên trái)
    for (let x = -19; x <= 31; x += 3.1) {
      if (Math.abs(x - 7.5) < 3.2 || Math.abs(x - 11.4) < 1.5 || Math.abs(x + 12.6) < 2.6 || Math.abs(x + 7.6) < 2 || Math.abs(x + 3.4) < 2) continue;
      makeTree(r, { p: [x + rnd() * 1.2, 0, -9.5 - rnd() * 2.5], s: 1.1 + rnd() * 0.7 }, rnd() > 0.5 ? 0x5fae57 : 0x4f9e4a);
    }
    for (let z = -5; z <= 12; z += 3.4) makeTree(r, { p: [-18.5 + rnd(), 0, z + rnd()], s: 1 + rnd() * 0.6 });
    for (let z = 20; z <= 30; z += 3.4) makeTree(r, { p: [28 + rnd() * 4, 0, z + rnd()], s: 1 + rnd() * 0.6 });
    for (let i = 0; i < 12; i++) makeBush(r, { p: [-10 + rnd() * 24, 0, 29.5 + rnd() * 2], s: 0.8 + rnd() * 0.6 });
    makeFence(r, -10.4, -4.4, 0.4, -4.4);
    makeFence(r, 2.1, -4.4, 17.5, -4.4);

    // Cột đèn dọc đường đất: tối thì sáng (thêm 3 nguồn sáng thật cho đường chính, ao và ruộng lúa)
    for (const [x, z] of [[2.3, -3.2], [2.3, 4.6], [0.2, 10.4], [2.3, 15.5], [2.3, 22.2], [9.6, 8.5], [17.3, 8.4], [-7.2, 22.7], [-9.0, 10.6], [-5.5, -5.0], [16.5, 12]]) {
      this.bulbs.push(makeLampPost(r, { p: [x, 0, z], s: 1.05 }));
    }
    for (const [x, z] of [[1.25, 6], [9, 10], [-4, 19]]) {
      const light = new THREE.PointLight(0xffc27a, 0, 16, 1.4);
      light.position.set(x, 3, z);
      this.lamps.push(light);
      r.add(light);
    }

    // Bác nông dân — vị trí cập nhật mỗi khung hình theo state.farm.farmer
    const farmer = (this.farmer = makePerson(LOOKS[2], 'straw', FARMER_SHAPE));
    const home = this.game.state.farm.farmer;
    farmer.position.set(home.x, 0, home.z);
    this.farmerPrev.set(home.x, home.z);
    farmer.scale.setScalar(1.15);
    r.add(farmer);
    // Máy cày: hiện dưới bác khi thu / gieo ruộng lúa và lúc chở lúa tới cối
    this.tractor.g.visible = false;
    r.add(this.tractor.g);
    // Chỗ đậu: bãi cỏ phía nam ruộng lúa mì (dưới chỗ mở rộng ruộng thứ hai), mũi hướng ra đường đất
    this.parked.g.position.set(-1.6, 0, 23.3);
    this.parked.g.rotation.y = Math.PI / 2;
    r.add(this.parked.g);
  }

  /**
   * Con sông chảy dọc mép trái nông trại và con suối nhỏ từ sông dẫn nước vào ao đầu tiên.
   * Suối chạy trước hàng ruộng cuối (ruộng tối đa 5 hàng, mép trước z ≈ 10), chui dưới cầu gỗ trên đường đất
   * rồi kết thúc ở tâm ao — ao nới rộng cỡ nào thì bờ ao vẫn phủ lên đầu suối.
   * Chỉ là cảnh: bác nông dân không bao giờ đi qua vùng nước (lối dọc x = -8.3 dừng ở hàng ruộng cuối).
   */
  private buildWater(): void {
    const r = this.root;
    const rnd = seeded(21);
    const curve = (pts: number[][]) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const river = curve([[-11.5, -26], [-13, -14], [-12, -6], [-14, 2], [-12.4, 9], [-13.6, 16], [-12, 30]]);
    // Suối: từ sông chảy ngang trước ruộng rau, chui dưới cầu đường đất (x = 1.25) rồi kết thúc ở tâm ao
    // (phía đông ao là vườn cây ăn quả, không có suối chảy tiếp). Mương nhỏ dẫn nước sông vào ruộng lúa nước.
    const stream = curve([[-12.8, 11.9], [-10, 12], [-6, 11.75], [-2, 12.05], [1.25, 11.9], [4, 12.6], [7.5, 14.2], [9.5, 15]]);
    const ditch = curve([[-11.7, 15.6], [-10, 15.3], [-8.2, 15.4]]);

    for (const [c, w, samples] of [[river, 3.2, 90], [stream, 0.9, 70], [ditch, 0.4, 12]] as const) {
      mesh(r, ribbon(c, w + 0.9, samples), 0xd8c08c, { p: [0, 0.012, 0], cast: false }); // bãi cát
      mesh(r, ribbon(c, w + 0.35, samples), 0x9fa79a, { p: [0, 0.022, 0], cast: false }); // mép đá
      mesh(r, ribbon(c, w, samples), this.waterMat, { p: [0, 0.035, 0], cast: false });
      // Vệt sóng trắng trôi theo dòng
      const n = Math.round(c.getLength() / (w > 2 ? 1.6 : 1.3));
      for (let i = 0; i < n; i++) {
        const dash = mesh(r, G.box(0.06, 0.012, w > 2 ? 0.55 : 0.3), 0xf2fbff, { cast: false, receive: false });
        this.flow.push({ m: dash, curve: c, u: rnd(), off: (rnd() - 0.5) * w * 0.6, speed: (w > 2 ? 0.9 : 0.7) / c.getLength() });
      }
    }

    // Đá ven sông, lau sậy, cầu gỗ trên đường đất chỗ suối cắt ngang
    for (let i = 0; i < 26; i++) {
      const u = rnd();
      const p = river.getPointAt(u);
      const side = rnd() > 0.5 ? 1 : -1;
      const n = river.getTangentAt(u);
      const d = 1.9 + rnd() * 0.5;
      const x = p.x - n.z * d * side;
      const z = p.z + n.x * d * side;
      if (rnd() > 0.45) mesh(r, G.ico(0.25 + rnd() * 0.25, 0), 0xa9aaa0, { p: [x, 0.1, z], s: [1, 0.6, 1] });
      else for (let k = 0; k < 3; k++) mesh(r, G.cone(0.05, 0.7 + rnd() * 0.4, 5), 0x6aa84f, { p: [x + k * 0.12, 0.35, z + k * 0.08], cast: false });
    }
    for (const [bx, bz] of [[1.25, 11.9]]) {
      const bridge = group(r, { p: [bx, 0, bz] });
      for (let i = -2; i <= 2; i++) mesh(bridge, G.box(1.7, 0.08, 0.26), 0xc98b4f, { p: [0, 0.16, i * 0.3] });
      for (const sx of [-0.85, 0.85]) {
        mesh(bridge, G.box(0.08, 0.06, 1.6), 0x8a5a35, { p: [sx, 0.45, 0] });
        for (const sz of [-0.7, 0.7]) mesh(bridge, G.cyl(0.05, 0.05, 0.45, 6), 0x8a5a35, { p: [sx, 0.25, sz] });
      }
    }
    // Cầu nhỏ thứ hai bắc qua sông cho cảnh có chỗ nhìn
    const footbridge = group(r, { p: [-13.4, 0, 4.5], r: [0, 0.25, 0] });
    for (let i = -6; i <= 6; i++) mesh(footbridge, G.box(0.28, 0.08, 1.1), 0xc98b4f, { p: [i * 0.32, 0.25 + 0.18 * Math.cos((i / 6) * 1.2), 0] });
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
      const k = s / 3.3; // đồ trong chuồng giãn theo cỡ chuồng
      const rnd = seeded(slot.id.length * 7 + s * 10);
      mesh(g, G.box(s, 0.1, s), 0xe9d18b, { p: [0, 0.03, 0], cast: false });
      strawLitter(g, s - 0.4, s - 0.4, rnd);
      makeFence(g, -h, -h, h, -h);
      makeFence(g, -h, h, h, h);
      makeFence(g, -h, -h, -h, h);
      makeFence(g, h, -h, h, h);
      // Chuồng nhỏ + máng ăn + rơm rạ
      mesh(g, G.box(1.5, 1.0, 1.0), 0xd9534a, { p: [-0.8 * k, 0.55, -1.05 * k] });
      mesh(g, G.prism(), 0x8a5a3a, { p: [-0.8 * k, 1.05, -1.05 * k], s: [1.8, 0.65, 1.2] });
      mesh(g, G.box(0.5, 0.55, 0.06), 0x5a2f24, { p: [-0.8 * k, 0.32, -1.05 * k + 0.51] });
      mesh(g, G.box(1.0, 0.22, 0.38), 0xb9733f, { p: [0.9 * k, 0.15, -1.2 * k] });
      mesh(g, G.box(0.9, 0.08, 0.3), 0xe8c55a, { p: [0.9 * k, 0.3, -1.2 * k], cast: false }); // rơm trong máng
      hayBale(g, h - 0.5, h - 0.55, 0.3);
      hayBale(g, h - 1.05, h - 0.5, -0.2);
      mesh(g, G.cone(0.45, 0.5, 8), 0xe8c55a, { p: [-h + 0.55, 0.28, h - 0.6], cast: false }); // đống rơm
    } else if (slot.type === 'orchard') {
      // Gốc cây ăn quả: ụ đất tròn, viền đá nhỏ, cỏ quanh gốc; cây dựng trong fill() theo loại
      mesh(g, G.cyl(s / 2, s / 2 + 0.05, 0.08, 18), 0x9ed47a, { p: [0, 0.03, 0], cast: false });
      mesh(g, G.cyl(0.75, 0.85, 0.16, 14), 0x8a5a3a, { p: [0, 0.07, 0] });
      for (let i = 0; i < 9; i++) mesh(g, G.ico(0.1, 0), 0xa9aaa0, { p: [Math.cos((i / 9) * Math.PI * 2) * 0.88, 0.08, Math.sin((i / 9) * Math.PI * 2) * 0.88], s: [1, 0.6, 1] });
    } else if (slot.type === 'pond') {
      // Ao: bờ đá, mặt nước, lá súng, cầu gỗ nhỏ, bụi lau (bán kính theo cỡ ao trong layout)
      // Hình méo tự nhiên (không tròn): bề ngang = size, bề dọc ~ 0.78 size; bờ đá to hơn mặt nước một chút
      const R = s / 2;
      const shape = pondOutline(R, R * 0.78, 3);
      mesh(g, outlineSlab(shape.map((p) => p.clone().multiplyScalar(1.06)), 0.2), 0xb9b4a8, { p: [0, -0.02, 0] });
      mesh(g, outlineSlab(shape.map((p) => p.clone().multiplyScalar(0.92)), 0.23), this.waterMat, { p: [0, -0.02, 0], cast: false });
      for (const [lx, lz] of [[0.42, 0.25], [-0.36, 0.38], [-0.48, -0.25], [0.18, -0.42], [0.55, -0.1]]) mesh(g, G.cyl(0.26, 0.26, 0.02, 8), 0x5fae57, { p: [lx * R, 0.22, lz * R], cast: false });
      mesh(g, G.box(0.6, 0.06, 1.4), 0xc98b4f, { p: [R * 0.25, 0.3, R * 0.72] });
      for (const side of [-1, 1]) mesh(g, G.cyl(0.04, 0.04, 0.4, 6), 0x8a5a35, { p: [R * 0.25 + side * 0.26, 0.2, R * 0.72 + 0.6] });
      // Lau sậy dọc bờ
      for (const i of [5, 13, 22, 30, 41]) {
        const p = shape[i];
        for (let k = 0; k < 3; k++) mesh(g, G.cone(0.07, 0.8 + k * 0.15, 5), 0x6aa84f, { p: [p.x * 1.02 + k * 0.12, 0.45, p.y * 1.02 + k * 0.06], cast: false });
      }
    } else {
      // Ruộng lúa mì (đất khô vàng) / lúa nước (bờ đất, mặt nước lấp lánh)
      const paddy = slot.type === 'paddy';
      mesh(g, G.box(s, 0.24, s), paddy ? 0x8a6a45 : 0xb08a58, { p: [0, 0.04, 0] });
      if (paddy) {
        mesh(g, G.box(s - 0.4, 0.26, s - 0.4), 0x6b5236, { p: [0, 0.05, 0], cast: false });
        mesh(g, G.box(s - 0.45, 0.02, s - 0.45), this.waterMat, { p: [0, 0.19, 0], cast: false });
      } else {
        mesh(g, G.box(s - 0.3, 0.26, s - 0.3), 0xc9a066, { p: [0, 0.05, 0], cast: false });
        for (let i = 0; i < 5; i++) mesh(g, G.box(s - 0.5, 0.05, 0.12), 0xa98450, { p: [0, 0.19, -s / 2 + 0.55 + i * ((s - 1.1) / 4)], cast: false });
      }
      // Biển nhỏ cắm đầu ruộng
      mesh(g, G.cyl(0.04, 0.04, 0.8, 5), 0x8a5a35, { p: [-s / 2 + 0.2, 0.4, -s / 2 + 0.2] });
      const sign = emojiSprite(paddy ? '🌾' : '🌾', 0.4);
      sign.position.set(-s / 2 + 0.2, 0.95, -s / 2 + 0.2);
      g.add(sign);
    }

    const ring = mesh(g, G.box(1, 0.04, 1), this.ringMat, { p: [0, 0.01, 0], s: [s + 0.35, 1, s + 0.35], cast: false, receive: false });
    const bar = new Bar3D(1.1);
    const top = slot.type === 'orchard' ? 3.3 : slot.type === 'pen' ? 2.2 : slot.type === 'wheat' || slot.type === 'paddy' ? 1.4 : 1.3;
    bar.group.position.set(0, top, 0);
    const drop = emojiSprite('💧', 0.6);
    const hoe = emojiSprite('⛏️', 0.6);
    g.add(bar.group, drop, hoe);
    return { ...view, g, content: group(g, { p: [0, slot.type === 'field' || slot.type === 'wheat' ? 0.2 : slot.type === 'paddy' ? 0.15 : 0.1, 0] }), producerId: undefined, tier: 1, movers: [], ready: null, bar, ring, type: slot.type, drop, hoe, prev: null, kickAt: -99, popAt: -99, ripeAt: -99, cropStage: 2 };
  }

  /** Dựng lại thứ đang trồng/nuôi trong ô khi producer hoặc bậc của ô đổi. */
  private fill(view: SlotView, producerId: string | null, tier: number, cropStage: CropStage): void {
    view.content.clear();
    view.grain = undefined;
    view.cropStage = cropStage;
    view.movers = [];
    view.ready = null;
    view.producerId = producerId;
    view.tier = tier;
    if (!producerId) return;
    const def = this.game.content.producers.get(producerId);

    const { layout } = this.game.content.slotTypes.get(view.type);
    if (view.type === 'wheat' || view.type === 'paddy') {
      view.grain = grainField(view.content, layout.size - 0.4, view.type === 'wheat' ? 'wheat' : 'rice', cropStage);
    } else if (view.type === 'orchard') {
      const tree = makeFruitTree(producerId, cropStage);
      view.content.add(tree);
      view.movers.push({ g: tree, x: 0, z: 0, phase: producerId.length });
    } else if (view.type === 'field') {
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
          const room = layout.size / (view.type === 'pen' ? 3.3 : 3); // ô to hơn thì con vật đi rộng hơn
          const radius = (animals.length > 1 ? 0.75 : 0.2) * room;
          const x = Math.cos(angle) * radius + (view.type === 'pen' ? 0.25 * room : 0);
          const z = Math.sin(angle) * radius + (view.type === 'pen' ? 0.35 * room : 0);
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

  /** Cối: dựng khi mới mua, cánh quạt / bánh xe nước quay (nhanh hơn khi đang xay), bao lúa chất theo hàng tồn. */
  private updateMills(env: Env, dt: number): void {
    const { state, ctx, content } = this.game;
    for (const mill of state.farm.mills) {
      let view = this.mills.get(mill.id);
      if (!view) {
        const c = millCenter(ctx, mill);
        const built = mill.type === 'windmill' ? makeWindmill() : makeRiceMill(this.waterMat);
        const g = group(this.root, { p: [c.x, 0, c.z] });
        g.add(built.g);
        if (mill.type === 'ricemill') built.g.scale.x = -1; // bánh xe nước nhúng xuống sông (bên trái)
        g.userData.pick = { type: 'mill', id: mill.id } satisfies Pick;
        const bar = new Bar3D(1.2);
        bar.group.position.set(0, mill.type === 'windmill' ? 5.9 : 3.2, 0);
        g.add(bar.group);
        view = { g, spin: 'blades' in built ? built.blades : built.wheel, sacks: built.sacks, sackCount: -1, icon: null, product: '', bar };
        this.mills.set(mill.id, view);
      }
      const busy = mill.input > 0;
      const speed = mill.type === 'windmill' ? 0.3 + env.wind * 2.5 + (busy ? 1.2 : 0) : busy ? 1.6 : 0.5;
      if (mill.type === 'windmill') view.spin.rotation.z -= speed * dt;
      else view.spin.rotation.x += speed * dt;
      if (view.sackCount !== mill.input) {
        view.sackCount = mill.input;
        fillSacks(view.sacks, Math.ceil(mill.input / 2), mill.type === 'windmill' ? 0xe8d6a8 : 0xd9c89a);
      }
      // Biểu tượng thành phẩm đang làm, lơ lửng trên cối
      if (view.product !== mill.product) {
        if (view.icon) view.g.remove(view.icon);
        view.icon = emojiSprite(content.items.get(mill.product).icon, 0.7);
        view.g.add(view.icon);
        view.product = mill.product;
      }
      const top = mill.type === 'windmill' ? 6.5 : 3.7;
      view.icon!.position.set(0, top + Math.abs(Math.sin(env.t * 2.4)) * 0.12, 0);
      view.bar.group.visible = busy;
      if (busy) view.bar.set(mill.progress / content.mills.get(mill.type).time);
    }
  }

/** Nhà màng phía nam ao: dài theo số luống bên trong; bấm vào để vào khu nhà kính. */
  private updateGreenhouse(dt: number): void {
    const { state, ctx, content } = this.game;
    const type = content.slotTypes.all().find((t) => t.building);
    if (!type) return;
    const count = state.farm.slots.filter((s) => s.type === type.id).length;
    if (!this.house || this.house.count !== count) {
      if (this.house) this.root.remove(this.house.g);
      const rect = buildingRect(ctx, type.id)!;
      const b = type.building!;
      const built = makeGreenhouse(rect.x2 - rect.x1, b.width, b.colLength);
      const g = group(this.root, { p: [rect.x1, 0, b.z] });
      g.add(built.g);
      g.userData.pick = { type: 'building', id: 'greenhouse' } satisfies Pick;
      // Nhìn qua màng thấy hai dãy luống xanh bên trong
      for (const side of [-1, 1]) {
        mesh(g, G.box(rect.x2 - rect.x1 - 2 * b.endLength, 0.3, 1.5), 0x8a5a36, { p: [(rect.x2 - rect.x1) / 2, 0.2, side * 1.45], cast: false });
        for (let x = b.endLength + 0.4; x < rect.x2 - rect.x1 - b.endLength; x += 0.55) mesh(g, G.ico(0.22, 0), 0x5fae57, { p: [x, 0.5, side * 1.45 + ((x * 7) % 0.4) - 0.2], s: [1, 0.8, 1], cast: false });
      }
      const sign = emojiSprite('🏡', 0.7);
      sign.position.set(-0.4, 3.2, 0);
      g.add(sign);
      this.house = { count, g, fans: built.fans };
    }
    for (const f of this.house.fans) f.rotation.z += dt * 8;
  }

  /** Viền đứt khúc + dấu ➕ ở mọi chỗ còn mua thêm ô / cối được (bấm vào để mở bảng mua). */
  /** Vật liệu khung nhấp nháy dùng chung (độ mờ đổi theo nhịp). */
  private hintMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.4, depthWrite: false });
  private hintFrame = new THREE.MeshBasicMaterial({ color: 0xffc400 });

  /** Ngày hướng dẫn (bước nông trại): ô ruộng trống, ruộng lúa mì, chuồng trống nhấp nháy cho người chơi thấy chỗ. */
  private updateHints(env: Env): void {
    const { state, content, ctx } = this.game;
    const types = new Set<SlotType>();
    if (state.tutorial?.step === 'farm') {
      const todo = farmChecklist(ctx).filter((c) => !c.done).map((c) => c.id);
      if (todo.includes('veg')) types.add('field');
      if (todo.includes('wheat')) types.add('wheat');
      if (todo.includes('hen')) types.add('pen');
    }
    const pulse = 0.5 + 0.5 * Math.sin(env.t * 6);
    this.hintMat.opacity = 0.2 + 0.35 * pulse;
    this.hintFrame.color.setHSL(0.13, 1, 0.5 + 0.35 * pulse);
    const arrowed = new Set<SlotType>();
    for (const slot of state.farm.slots) {
      const view = this.slots.get(slot.id);
      if (!view) continue;
      const show = types.has(slot.type) && !slot.producerId;
      if (show && !view.hint) {
        const size = content.slotTypes.get(slot.type).layout.size * slotScale(ctx, slot) + 0.3;
        const h = (view.hint = group(view.g));
        // Mặt vàng mờ + khung viền 4 cạnh dày, đặt cao hơn mặt đất / rơm cho khỏi bị che
        mesh(h, G.box(size, 0.03, size), this.hintMat, { p: [0, 0.45, 0], cast: false });
        const bar = 0.16;
        for (const s of [-1, 1]) {
          mesh(h, G.box(size + bar, 0.14, bar), this.hintFrame, { p: [0, 0.45, (s * size) / 2], cast: false });
          mesh(h, G.box(bar, 0.14, size + bar), this.hintFrame, { p: [(s * size) / 2, 0.45, 0], cast: false });
        }
        const arrow = emojiSprite('👇', 1.8);
        arrow.name = 'arrow';
        h.add(arrow);
      }
      if (!view.hint) continue;
      view.hint.visible = show;
      if (!show) continue;
      const arrow = view.hint.getObjectByName('arrow');
      if (arrow) {
        // Mũi tên chỉ ở ô đầu tiên của mỗi loại cho đỡ rối
        arrow.visible = !arrowed.has(slot.type);
        arrowed.add(slot.type);
        arrow.position.set(0, 2.4 + Math.abs(Math.sin(env.t * 4)) * 0.5, 0);
      }
    }
  }

  private updateExpand(env: Env): void {
    const { state, ctx, content } = this.game;
    const key = [...content.slotTypes.all().map((t) => state.farm.slots.filter((s) => s.type === t.id).length), ...content.mills.all().map((m) => state.farm.mills.filter((x) => x.type === m.id).length), ...state.farm.slots.map((s) => s.tier)].join(',');
    if (key !== this.expandKey) {
      this.expandKey = key;
      this.expand.clear();
      const spot = (x: number, z: number, size: number, id: string, icon: string) => {
        const g = group(this.expand, { p: [x, 0, z] });
        dashedRect(g, size);
        // Mặt bấm trong suốt phủ cả ô cho dễ bấm
        const hit = mesh(g, G.box(size, 0.06, size), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { p: [0, 0.05, 0], cast: false, receive: false });
        hit.userData.pick = { type: 'expand', id } satisfies Pick;
        const plus = emojiSprite('➕', 0.55);
        plus.position.set(0, 0.6, 0);
        const what = emojiSprite(icon, 0.5);
        what.position.set(0, 1.15, 0);
        g.add(plus, what);
        g.userData.bob = [plus, what];
      };
      // Nhà kính: viền đứt khúc ở đầu đông = phần nhà dài thêm khi nới rộng (thêm một lô luống)
      for (const t of content.slotTypes.all().filter((t) => t.building)) {
        const owned = state.farm.slots.filter((s) => s.type === t.id).length;
        if (owned >= t.max) continue;
        const now = buildingRect(ctx, t.id)!;
        const next = buildingRect(ctx, t.id, Math.min(t.max, owned + (t.batch ?? 1)))!;
        const g = group(this.expand, { p: [(now.x2 + next.x2) / 2, 0, (now.z1 + now.z2) / 2] });
        dashedRect(g, next.x2 - now.x2, 0.45, now.z2 - now.z1);
        const hit = mesh(g, G.box(next.x2 - now.x2, 0.06, now.z2 - now.z1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { p: [0, 0.05, 0], cast: false, receive: false });
        hit.userData.pick = { type: 'expand', id: t.id } satisfies Pick;
        const plus = emojiSprite('➕', 0.55);
        const what = emojiSprite('↔️', 0.5);
        plus.position.set(0, 0.6, 0);
        what.position.set(0, 1.15, 0);
        g.add(plus, what);
        g.userData.bob = [plus, what];
      }
      for (const t of content.slotTypes.all().filter((t) => !t.building)) {
        for (let i = state.farm.slots.filter((s) => s.type === t.id).length; i < t.max; i++) {
          const c = slotCenterAt(ctx, t.id, i);
          spot(c.x, c.z, t.layout.size, t.id, t.icon);
        }
      }
      // Ao: không đào ao mới mà nới rộng — viền đứt khúc theo hình ao ở bậc kế tiếp
      for (const slot of state.farm.slots.filter((s) => s.type === 'pond' && nextTier(ctx, s))) {
        const { layout } = content.slotTypes.get(slot.type);
        const c = slotCenter(ctx, slot);
        const R = (layout.size * (1 + layout.tierGrowth * slot.tier)) / 2;
        const g = group(this.expand, { p: [c.x, 0, c.z] });
        dashedOutline(g, pondOutline(R * 1.06, R * 0.78 * 1.06, 3));
        const hitShape = pondOutline(R * 1.06, R * 0.78 * 1.06, 3);
        const hit = mesh(g, outlineSlab(hitShape, 0.04), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { p: [0, 0.01, 0], cast: false, receive: false });
        hit.userData.pick = { type: 'expand', id: 'pond' } satisfies Pick;
        const plus = emojiSprite('➕', 0.55);
        const what = emojiSprite('↔️', 0.5);
        plus.position.set(R * 0.75, 0.6, R * 0.55);
        what.position.set(R * 0.75, 1.15, R * 0.55);
        g.add(plus, what);
        g.userData.bob = [plus, what];
      }
      for (const m of content.mills.all()) {
        for (let i = state.farm.mills.filter((x) => x.type === m.id).length; i < m.max; i++) {
          const c = millCenterAt(ctx, m.id as MillType, i);
          spot(c.x, c.z, 2.8, m.id, m.icon);
        }
      }
    }
    for (const g of this.expand.children) {
      const [plus, what] = g.userData.bob as THREE.Sprite[];
      const k = Math.abs(Math.sin(env.t * 2 + g.position.x));
      plus.position.y = 0.6 + k * 0.12;
      what.position.y = 1.15 + k * 0.12;
      // (ao: dấu nằm lệch về mép trước-phải, chỉ nhún theo chiều cao)
    }
  }

  /** Vẽ bác nông dân theo state: chạy khi đang đi, làm động tác theo việc khi đã tới nơi, vẫy tay khi rảnh. */
  private updateFarmer(env: Env, dt: number): void {
    const { state, ctx } = this.game;
    const f = state.farm.farmer;
    const g = this.farmer;
    // Bác ra chợ ăn: vắng mặt; kiệt sức: nằm nghiêng giữa đồng
    g.visible = !state.crew.farmerAway;
    if (!g.visible) {
      this.tractor.g.visible = false;
      this.parked.g.visible = true;
    }
    if (f.fainted || !g.visible) {
      g.position.set(f.x, f.fainted ? 0.2 : 0, f.z);
      g.rotation.z += ((f.fainted ? Math.PI / 2 : 0) - g.rotation.z) * Math.min(1, dt * 6);
      this.farmerPrev.set(f.x, f.z);
      return;
    }
    g.rotation.z += (0 - g.rotation.z) * Math.min(1, dt * 6);
    const moved =Math.hypot(f.x - this.farmerPrev.x, f.z - this.farmerPrev.y);
    // Làm mượt trạng thái "đang đi" để tay chân không giật khi tốc độ khung hình dao động
    this.farmerWalk += ((moved > 1e-4 ? 1 : 0) - this.farmerWalk) * Math.min(1, dt * 12);
    if (moved > 1e-4) g.rotation.y = Math.atan2(f.x - this.farmerPrev.x, f.z - this.farmerPrev.y);
    this.farmerPrev.set(f.x, f.z);
    const work = currentWork(ctx);
    const task = f.tasks[0] ?? null;
    // Ruộng lúa (thu / gieo lại) và chở lúa tới cối: bác lái máy cày
    const taskSlot = task ? state.farm.slots.find((s) => s.id === task.slotId) : undefined;
    const driving = !!task && (task.kind === 'haul' || (!!taskSlot && isAutoSlot(ctx, taskSlot) && (task.kind === 'harvest' || task.kind === 'plant')));
    const tr = this.tractor;
    tr.g.visible = driving;
    this.parked.g.visible = !driving;
    if (driving) {
      tr.g.position.set(f.x, 0, f.z);
      tr.g.rotation.y = g.rotation.y;
      for (const w of tr.wheels) w.rotation.x += moved * 2.4;
      const load = f.carry ? Math.ceil(f.carry.qty / 2) : 0;
      if (tr.bed.userData.load !== load) {
        tr.bed.userData.load = load;
        fillSacks(tr.bed, load);
      }
      g.position.set(f.x, 0.5 + Math.abs(Math.sin(env.t * 9)) * 0.03 * this.farmerWalk, f.z);
    } else {
      g.position.set(f.x, Math.abs(Math.sin(env.t * 11)) * 0.08 * this.farmerWalk, f.z);
    }

    let pose = {};
    if (work) {
      // Đã tới nơi: quay mặt vào ô (hoặc cối khi đổ lúa) rồi làm việc
      const mill = work.kind === 'haul' ? state.farm.mills.find((m) => m.id === work.millId) : undefined;
      const slot = mill ? undefined : state.farm.slots.find((s) => s.id === work.slotId);
      const c = mill ? millCenter(ctx, mill) : slot ? slotCenter(ctx, slot) : null;
      if (c && !driving) g.rotation.y = Math.atan2(c.x - f.x, c.z - f.z);
      pose = driving ? { sit: true } : work.kind === 'till' ? { dig: 1 } : work.kind === 'water' ? { pour: 1 } : work.kind === 'visit' ? {} : { reach: 1 };
    } else if (driving) {
      pose = { sit: true };
    } else if (!task) {
      // Rảnh: thở, chớp mắt, thỉnh thoảng vẫy tay chào
      pose = { wave: Math.max(0, Math.min(1, (Math.sin(env.t * 0.35) - 0.85) * 8)) };
    }
    animatePerson(g, env.t, { walk: driving ? 0 : this.farmerWalk, ...pose });

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

  /** Vẽ người làm vườn: đi theo state, làm động tác theo việc, nghỉ cùng giờ bác nông dân (ẩn). */
  private updateGardeners(env: Env, dt: number): void {
    const { state, ctx } = this.game;
    const list = state.farm.gardeners;
    for (const [id, v] of this.gardeners) {
      if (list.some((x) => x.id === id)) continue;
      this.root.remove(v.g);
      this.gardeners.delete(id);
    }
    for (const gs of list) {
      let v = this.gardeners.get(gs.id);
      if (!v) {
        const g = makePerson(GARDENER_LOOKS[gs.look % GARDENER_LOOKS.length], 'straw', adultShape(gs.look * 11 + 1));
        g.scale.setScalar(1.05);
        g.position.set(gs.x, 0, gs.z);
        this.root.add(g);
        v = { g, prev: new THREE.Vector2(gs.x, gs.z), walk: 0, icon: null, iconKind: null };
        this.gardeners.set(gs.id, v);
      }
      const g = v.g;
      g.visible = !state.crew.farmerAway;
      if (!g.visible) {
        v.prev.set(gs.x, gs.z);
        continue;
      }
      const moved = Math.hypot(gs.x - v.prev.x, gs.z - v.prev.y);
      v.walk += ((moved > 1e-4 ? 1 : 0) - v.walk) * Math.min(1, dt * 12);
      if (moved > 1e-4) g.rotation.y = Math.atan2(gs.x - v.prev.x, gs.z - v.prev.y);
      v.prev.set(gs.x, gs.z);
      g.position.set(gs.x, Math.abs(Math.sin(env.t * 11 + 1)) * 0.08 * v.walk, gs.z);
      let pose = {};
      const task = gs.task;
      if (task && gs.work != null) {
        const slot = state.farm.slots.find((s) => s.id === task.slotId);
        if (slot && !this.game.content.slotTypes.get(slot.type).building) {
          const c = slotCenter(ctx, slot);
          g.rotation.y = Math.atan2(c.x - gs.x, c.z - gs.z);
        }
        pose = task.kind === 'till' ? { dig: 1 } : task.kind === 'water' ? { pour: 1 } : { reach: 1 };
      }
      animatePerson(g, env.t, { walk: v.walk, ...pose });
      const kind = task?.kind ?? null;
      if (kind !== v.iconKind) {
        if (v.icon) g.remove(v.icon);
        v.icon = kind ? emojiSprite(TASK_ICON[kind], 0.36) : null;
        if (v.icon) g.add(v.icon);
        v.iconKind = kind;
      }
      if (v.icon) v.icon.position.set(0, 1.7 + Math.abs(Math.sin(env.t * 4 + 1)) * 0.08, 0);
    }
  }

  /** Ông / bà chủ đi lòng vòng theo lối của bác nông dân, dừng trước một ô ngắm cây / con vật. */
  private owner: OwnerWalker | null = null;

  private ownerSpot(): Spot {
    const { ctx, state, content } = this.game;
    const slots = state.farm.slots.filter((s) => !content.slotTypes.get(s.type).building);
    if (!slots.length || Math.random() < 0.15) return { ...content.balance.farmer.home };
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const w = workSpot(ctx, slot);
    const c = slotCenter(ctx, slot);
    // Đứng lệch khỏi chỗ bác làm một chút cho khỏi đứng chồng lên nhau
    return { x: w.x + (Math.random() - 0.5) * 0.6, z: w.z, face: Math.atan2(c.x - w.x, c.z - w.z) };
  }

  /** Hệ thống tưới (trang thiết bị mua ở Siêu thị): mỗi ô ngoài trời cần tưới có vòi phun xoay ở góc, tia nước xanh. */
  private sprinklers: { key: string; g: THREE.Group; heads: THREE.Object3D[] } | null = null;
  private updateSprinklers(env: Env): void {
    const { state, content, ctx } = this.game;
    const on = state.upgrades.includes('irrigation');
    const slots = on ? state.farm.slots.filter((s) => content.slotTypes.get(s.type).needsWater && !content.slotTypes.get(s.type).building) : [];
    const key = slots.map((s) => `${s.id}:${s.tier}`).join(',');
    if (this.sprinklers?.key !== key) {
      if (this.sprinklers) this.root.remove(this.sprinklers.g);
      const g = group(this.root);
      const heads: THREE.Object3D[] = [];
      const spray = new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.45, depthWrite: false });
      for (const s of slots) {
        const c = slotCenter(ctx, s);
        const half = (content.slotTypes.get(s.type).layout.size * slotScale(ctx, s)) / 2;
        const p = group(g, { p: [c.x + half - 0.12, 0, c.z + half - 0.12] });
        mesh(p, G.cyl(0.03, 0.03, 0.55, 6), 0x5f6b77, { p: [0, 0.28, 0] });
        const head = group(p, { p: [0, 0.58, 0] });
        mesh(head, G.cyl(0.06, 0.06, 0.08, 8), 0x2f6fbf);
        mesh(head, G.cone(0.32, 0.5, 10), spray, { p: [0.28, 0.02, 0], r: [0, 0, Math.PI / 2 + 0.35], cast: false });
        heads.push(head);
      }
      this.sprinklers = { key, g, heads };
    }
    // Vòi xoay tròn, ban ngày phun (mùa Đông ô ngoài trời đóng băng thì ngừng)
    const spin = env.season === 3 ? 0 : 1;
    this.sprinklers.heads.forEach((h, i) => {
      h.rotation.y = env.t * 1.6 * spin + i;
      h.children[1].visible = !!spin;
    });
  }

  update(env: Env, dt: number): void {
    const { state, content, ctx } = this.game;
    const counts: Partial<Record<SlotType, number>> = {};
    if (!this.owner) {
      const home = content.balance.farmer.home;
      this.owner = new OwnerWalker(this.game, this.root, { x: home.x + 0.8, z: home.z }, () => this.ownerSpot(), (from, to) => nextWaypoint(from, to, content.balance.farmer.lanes), 0.8, 1.0).withMarker(1.1);
    }
    this.owner.update(env.t, dt);

    this.updateSprinklers(env);
    for (const slot of state.farm.slots) {
      if (content.slotTypes.get(slot.type).building) continue; // luống trong nhà kính: vẽ ở khu bên trong
      const index = (counts[slot.type] = (counts[slot.type] ?? -1) + 1);
      let view = this.slots.get(slot.id);
      if (!view) this.slots.set(slot.id, (view = this.buildSlot(slot)));
      // Ruộng: cây đổi hình theo giai đoạn (mầm -> cây non -> trưởng thành); lên giai đoạn thì nảy một cái
      const growing0 = slot.producerId ? content.producers.get(slot.producerId) : null;
      const staged = view.type === 'field' || view.type === 'wheat' || view.type === 'paddy';
      const cropStage: CropStage = staged && growing0 && slot.stage !== 'ready' ? cropStageOf(slot.progress / cycleTime(growing0, slot)) : 2;
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
        if (view.type !== 'field' && view.type !== 'orchard') animateCreature(m.g, env.t, m.phase);
        m.g.scale.set(scale * fit * pop, scale * fit * pop * ripe, scale * fit * pop);
        if (view.type === 'field') {
          m.g.rotation.z = Math.sin(env.t * (1.4 + env.wind * 2) + m.phase) * (0.03 + env.wind * 0.12);
        } else if (view.type === 'orchard') {
          // Cây đứng yên một chỗ, chỉ nghiêng nhẹ theo gió
          m.g.rotation.z = Math.sin(env.t * (1.1 + env.wind * 1.5) + m.phase) * (0.012 + env.wind * 0.05);
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
    this.updateMills(env, dt);
    this.updateGreenhouse(dt);
    this.updateExpand(env);
    this.updateHints(env);
    this.updateFarmer(env, dt);
    this.updateGardeners(env, dt);
    for (const view of this.slots.values()) {
      if (!view.grain) continue;
      const amp = 0.04 + env.wind * 0.22;
      for (const tuft of view.grain.children) tuft.rotation.z = Math.sin(env.t * (1.6 + env.wind * 2.5) + tuft.userData.sway) * amp;
    }
    for (const bulb of this.bulbs) bulb.emissiveIntensity = env.night * 1.6;
    for (const lamp of this.lamps) lamp.intensity = env.night * 22;
    for (const f of this.flow) {
      f.u = (f.u + f.speed * dt * (1 + env.rain)) % 1;
      const p = f.curve.getPointAt(f.u);
      const n = f.curve.getTangentAt(f.u);
      f.m.position.set(p.x - n.z * f.off, 0.045, p.z + n.x * f.off);
      f.m.rotation.y = Math.atan2(n.x, n.z);
    }
    sway(this.swayNodes, env);
    // Mùa đông: sông, ao, mương đóng băng (màu băng nhạt, dòng nước ngừng chảy)
    const frozen = env.season === 3;
    this.waterMat.color.setHex(frozen ? 0xd3ebf5 : 0x5bbbe8).multiplyScalar(0.55 + 0.45 * env.day);
    this.waterMat.opacity = frozen ? 0.97 : 0.85;
    for (const f of this.flow) f.m.visible = !frozen;
    if (this.paintedSeason !== env.season) {
      this.paintedSeason = env.season;
      paintSeason(this.root, env.season);
    }
  }
}
