import * as THREE from 'three';
import { partyColor } from '../../colors';
import { passSlots } from '../../../sim/systems/kitchen';
import type { RoomDef, StaffDef, TableDef } from '../../../data';
import type { Game } from '../../../sim/game';
import { blockerOf, canPlaceProp, canPlaceTable, LAYOUT_GRID, nearestPlaceable, placedProps, roomOf, seatSpots, tableById, tablePos, withRotation } from '../../../sim/layout';
import { heartsOf } from '../../../sim/systems/regulars';
import { makeHelperPerson, makePet, makeRegular } from '../people';
import { isManager } from '../../../sim/systems/helpers';
import { policePending } from '../../../sim/systems/events';
import { animateProp, makeProp } from '../props';
import { activeTables, moodOf } from '../../../sim/systems/customers';
import { isReserved, needOf } from '../../../sim/systems/service';
import { adultShape, animateCreature, animatePerson, LOOKS, makeBush, makeDish, makePerson, randomShape } from '../models';
import { buildSeat, counterExtras, decorateInterior, seatStyle, signText, tableExtras, type InteriorAnimator } from '../cuisine';
import { buildStreetGround, buildStreetKitchen, standingSign, streetSpots } from '../street';
import { HOLD_MS, type Area, type Env, type Pick } from '../stage';
import { Bar3D, blinkLeds, bubbleSprite, emojiSprite, G, group, ledFrame, mesh, textSprite, toon, paintSeason } from '../toon';
import { easeOutBack, wobble } from '../../ease';
import { Particles } from '../fx';
import { FestiveSet } from '../festive';
import { makeScooter } from '../farmkit';
import { nextWaypoint } from '../../../sim/pathing';
import { OwnerWalker, type Spot } from '../owner';
import { Curbside } from '../curbside';
import { buildEquipment, type EquipDims, type EquipView } from '../equipment';

/**
 * KHU QUÁN — nội thất quán ăn tông ấm, nhìn kiểu "cắt mái".
 *  - Kích thước phòng lấy từ content.room, bàn từ TableDef + state.restaurant.layout (toạ độ 2D),
 *    quy đổi sang mét bằng wx()/wz(). Nới rộng quán chỉ cần sửa data.
 *  - Màu sàn, tường, bàn ghế lấy từ nội thất đang dùng (state.decor.equipped).
 *  - Chế độ sắp xếp: kéo bàn / đồ trang trí (Pick {type:'table' | 'prop'}) -> dragItem()/endDrag(); bàn xoay = group.rotation.y -π/2.
 *  - Khách quen: model riêng (people.ts), vòng hồng, bảng tên -> ⭐; thú cưng đi lang thang; biển tên quán trên tường sau.
 *  - Phục vụ: bồi bàn (người chơi) vẽ theo state.restaurant.waiter; bong bóng chat trên đầu khách (Pick {type:'party'})
 *    báo việc cần làm; quầy ra món (Pick {type:'pass'}) bày các món bếp đã nấu xong.
 */

/** Mặt theo tâm trạng khi chờ món: vui vẻ, bình thường, chán nản, tức giận. */
const MOOD_FACES = ['😄', '🙂', '😒', '😠'];
/** Chỗ đặt đĩa trên quầy line (mét, so với tâm quầy): 2 hàng, mỗi hàng n/2 đĩa cách nhau 0.5 m. */
function passSlotsXY(n: number): [number, number][] {
  const cols = Math.ceil(n / 2);
  return Array.from({ length: cols * 2 }, (_, i) => [((i % cols) - (cols - 1) / 2) * 0.5, i < cols ? -0.12 : 0.2] as [number, number]);
}
const PASS_TOP = 1.02;

interface PartyFx {
  bar: Bar3D;
  /** Bong bóng chính (cần menu / chọn xong / tâm trạng) và bong bóng các món đã gọi. */
  main: THREE.Sprite | null;
  mainKey: string;
  dishes: THREE.Sprite | null;
  dishesKey: string;
  holder: THREE.Group;
}

const UNIT = 55; // số đơn vị toạ độ 2D ứng với 1 mét trong cảnh

/** Bảng tên khách quen: nền kem viền hồng, tên + dãy tim. */
function tagSprite(name: string, hearts: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 128;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#fffaf1';
  c.strokeStyle = '#ff8fc0';
  c.lineWidth = 8;
  c.beginPath();
  c.roundRect(8, 8, 368, 112, 40);
  c.fill();
  c.stroke();
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#3b2a1e';
  c.font = 'bold 46px Mali, system-ui, sans-serif';
  c.fillText(name, 192, 48);
  c.fillStyle = '#e2468a';
  c.font = 'bold 34px Mali, system-ui, sans-serif';
  c.fillText(hearts, 192, 92);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(1.2, 0.4, 1);
  sprite.renderOrder = 10;
  return sprite;
}
const WALK_SPEED = 4.2;
const TABLE_TOP = 0.8;
const COUNTER_TOP = 1.1;
const WALL_H = 4.2;

interface Actor {
  g: THREE.Group;
  tx: number;
  tz: number;
  /** Hướng nhìn khi đã ngồi/đứng yên. */
  face: number;
  /** Độ cao khi đã vào chỗ (ngồi ghế thì nhô lên). */
  restY: number;
  leaving: boolean;
  /** Các điểm phải đi qua trước khi tới đích (vào: cửa quán; về: cửa → chỗ đậu xe / cuối vỉa hè). */
  via: [number, number][];
  /** Đã xếp đường ra về chưa. */
  exitSet?: boolean;
  /** Đã có ghế (để ngồi khi tới nơi) và đang ăn (đưa tay lên miệng). */
  seated: boolean;
  eating: boolean;
  /** Khách quen: bảng tên (hiện vài giây lúc mới tới) rồi thu thành ngôi sao nhỏ trên đầu. */
  regular?: { tag: THREE.Sprite; star: THREE.Sprite; born: number };
  /** Điểm rẽ kế tiếp khi đi vòng qua bàn ghế (pathing), tính lại vài lần mỗi giây. */
  wp?: PathCache;
  /** Chỗ đứng ngay sau ghế (lùi ra khỏi bàn): vào chỗ thì tới đây trước rồi mới ngồi, ra về thì lùi ra đây trước. */
  out?: [number, number] | null;
  /** Đã tới chỗ đứng sau ghế (đang vào ghế / đang ngồi). */
  atOut?: boolean;
}

/** Đường vòng qua bàn ghế đang đi: điểm rẽ kế tiếp + đích lúc tính + mốc thời gian. */
interface PathCache {
  wp: [number, number];
  goal: [number, number];
  at: number;
}

interface PropView {
  g: THREE.Group;
  pad: THREE.Mesh;
  hand: THREE.Sprite;
  def: string;
}

interface TableView {
  def: TableDef;
  g: THREE.Group;
  /** Tấm báo hợp lệ/không hợp lệ dưới chân bàn khi đang kéo. */
  pad: THREE.Mesh;
  hand: THREE.Sprite;
}

export class RestaurantArea implements Area {
  id = 'restaurant';
  label: string;
  icon = '🏠';
  root = new THREE.Group();
  view: Area['view'];
  rainBox: Area['rainBox'];
  /** Quán ốc: vùng dưới sạp dù / mái kéo dài không có mưa (street.ts cập nhật). */
  rainShelter?: Area['rainShelter'];

  // Kích thước phòng (mét)
  private halfW: number;
  /** Mét quán rộng thêm về phía Đông so với hạng 1 (dãy bếp dài thêm chừng đó). */
  private kitchenExtra = 0;
  private backZ: number;
  private frontZ: number;
  private kitchenZ: number;
  /** Mép trái gian bếp (mét): bên trái là lối đi vào WC + kho hàng. */
  private kitchenX1: number;
  private door: [number, number];
  private queueZ: number;
  /** Kiểu mặt bằng (room.plan): bếp tường sau / quầy chữ L (quán Nhật) / bếp sát cửa (quán Việt). */
  private plan: 'back' | 'L' | 'front';
  /** Biển tên quán trên tủ kính quán Việt. */
  private frontSign: { board: THREE.Group; w: number; text: string; mesh: THREE.Mesh | null } | null = null;
  /** Giữa hai cửa WC / kho (treo chữ Phúc ở quán Việt). */
  private corridorX = 0;

  // Vật liệu riêng của quán để đổi màu theo nội thất đang dùng
  private mats = {
    floorA: toon(0xc98b4f, {}),
    floorB: toon(0xd9a066, {}),
    wall: toon(0xf8e3bd, {}),
    trim: toon(0xb9733f, {}),
    top: toon(0xe0a868, {}),
    base: toon(0x8a5a35, {}),
    seat: toon(0xe2703a, {}),
    back: toon(0xb9733f, {}),
  };
  private padMat = new THREE.MeshBasicMaterial({ color: 0x5fd068, transparent: true, opacity: 0.55 });
  private bulbMat = toon(0xfff1c2, { emissive: 0xffc861, emissiveIntensity: 0.3 });
  private windowMat = toon(0xbfe6ff, { transparent: true, opacity: 0.3 });

  private actors = new Map<string, Actor>();
  /** servedAt: mốc env.t lúc món vừa ra bàn (để đĩa nảy lên), -1 = chưa ra. */
  private dishes = new Map<number, { g: THREE.Group; sprite: THREE.Sprite; food: THREE.Group | null; servedAt: number }>();
  /** Gọi khi một nhóm khách trả tiền: vị trí thế giới của bàn + số tiền (app.ts cho xu bay về HUD). */
  onPaid: (world: THREE.Vector3, amount: number) => void = () => {};
  private partyFx = new Map<number, PartyFx>();
  /** Đĩa trên quầy ra món theo id đơn. */
  private passPlates = new Map<number, THREE.Group>();
  /** Chỗ đặt đĩa trên quầy line theo hạng bếp. */
  private passXY: [number, number][] = passSlotsXY(6);
  private passBell!: THREE.Sprite;
  private waiter!: { g: THREE.Group; ring: THREE.Mesh; hand: THREE.Group; handKey: string; lastX: number; lastZ: number };
  /** smoke: giây còn lại tới lần phả khói bếp kế tiếp; yaw: hướng đứng; puff: chỗ khói bốc (mặc định: sát tường sau). */
  private chefs: { g: THREE.Group; icon: THREE.Sprite; iconFor: string; bar: Bar3D; smoke: number; yaw: number; puff?: [number, number] }[] = [];
  private fx = new Particles(this.root);
  private tables = new Map<string, TableView>();
  private drag: { kind: 'table' | 'prop'; id: string; x: number; y: number } | null = null;
  /** Lệch giữa chỗ con trỏ chạm sàn lúc bắt đầu kéo và tâm vật: giữ nguyên để vật không "nhảy" ra sau con trỏ. */
  private grab: { dx: number; dy: number } | null = null;
  private props = new Map<string, PropView>();
  private selMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.45 });
  /** Thú cưng đi lang thang trong khu ăn uống (chỉ là hình ảnh, sim chỉ biết đang nuôi con nào). */
  private pets = new Map<string, { id: string; g: THREE.Group; x: number; z: number; tx: number; tz: number; wait: number; petting: number; wp?: PathCache }>();
  /** Biển tên quán trên tường sau. */
  private nameSign: { text: string; g: THREE.Group } | null = null;
  /** Mặt bằng theo hạng quán lúc dựng cảnh (lên hạng thì app.ts dựng lại cả khu). */
  readonly room: RoomDef;
  private unsub: (() => void)[] = [];
  private floats: { sprite: THREE.Sprite; life: number }[] = [];
  private lamps: THREE.PointLight[] = [];
  private firstFrame = true;
  /** Trước cửa quán: đường, xe cộ, bãi giữ xe, bác bảo vệ, khách tới bằng xe (curbside.ts). */
  private curb!: Curbside;
  /** Trang thiết bị đã mua ở Siêu thị (equipment.ts): dựng lại khi mua thêm. */
  private equip: { key: string; view: EquipView } | null = null;
  /** Viền LED quanh biển tên quán (khi có Biển hiệu đèn LED). */
  private signLeds: THREE.MeshBasicMaterial[] = [];
  /** Đồ trang trí theo phong cách quán (đèn lồng đung đưa, quạt quay...). */
  private interior: InteriorAnimator;
  /** Quán ốc vỉa hè (không tường, xe đẩy + bếp nướng dưới sạp dù — xem street.ts). */
  private street: boolean;
  /** Quán ốc về đêm tối hơn hẳn (chỉ còn dây đèn vàng, lửa than) — Stage đọc. */
  nightDark = 0;
  /** Ông / bà chủ đi chậm quanh khu ăn quan sát. */
  private owner: OwnerWalker | null = null;
  /** Anh shipper đứng cạnh xe máy đậu trước cửa quán; đi giao thì cả người lẫn xe vắng mặt. */
  private shipper: { person: THREE.Group; bike: THREE.Group; badge: THREE.Sprite } | null = null;
  /** Cập nhật riêng khu bếp vỉa hè (than hồng lập loè). */
  private streetAnim: InteriorAnimator = () => {};

  constructor(private game: Game) {
    const room = (this.room = roomOf(game.ctx));
    this.plan = room.plan ?? 'back';
    this.halfW = room.width / 2 / UNIT + 0.4;
    this.backZ = this.wz(0) - 0.7;
    this.frontZ = this.wz(room.height) + 0.4;
    this.kitchenZ = this.wz(room.kitchenDepth);
    // Gian bếp giữ nguyên chỗ so với quầy ra món khi quán rộng thêm (giai đoạn 14: 540 → 620); lối đi WC / kho bên trái rộng ra
    // Giai đoạn 15: quán nới về phía Đông thì gian bếp giữ mép trái, dãy bếp dài thêm sang phải (kitchenExtra)
    this.kitchenX1 = -this.halfW + 4 + 40 / UNIT;
    this.kitchenExtra = (room.width - game.content.room.width) / UNIT;
    this.door = [0, this.frontZ + 0.6];
    this.queueZ = this.wz(room.height - 32);
    const depth = this.frontZ - this.backZ;
    // Giai đoạn 15: nhìn lùi ra một chút để thấy vỉa hè, con đường, bãi giữ xe hai bên
    this.view = { position: [0, depth * 1.0, depth * 1.18 + 1.4], target: [0, 0.6, 1.4], orbit: 0.95 };
    this.rainBox = { min: [-22, 0, this.backZ - 13], max: [22, 14, this.backZ - 0.5] };

    this.label = game.content.cuisines.get(game.state.cuisine).name;
    this.root.userData.areaRoot = true;
    this.street = game.state.cuisine === 'oc';
    if (this.street) {
      this.nightDark = 0.7;
      // Ngoài trời: mưa rơi khắp khu quán (cả bàn ghế), không chỉ ngoài cửa sổ
      this.rainBox = { min: [-this.halfW - 3, 0, this.backZ - 3], max: [this.halfW + 3, 12, this.frontZ + 3] };
      buildStreetGround(this.root, this.dims(), this.mats);
      for (const x of [-this.halfW * 0.5, this.halfW * 0.5]) {
        const lamp = new THREE.PointLight(0xffc27a, 0, 0, 0);
        lamp.position.set(x, 3.2, 0.5);
        this.lamps.push(lamp);
        this.root.add(lamp);
      }
    } else this.buildRoom();
    // Trang trí lễ hội: dây treo dọc hai tường bên, đồ đứng hai bên cửa (chỉ hiện vào ngày lễ)
    {
      const { halfW, backZ, frontZ } = this;
      const x = halfW - 0.3;
      this.festive = new FestiveSet(
        this.root,
        [
          [[-x, 3.5, backZ + 0.8], [-x, 3.5, frontZ - 0.3]],
          [[x, 3.5, backZ + 0.8], [x, 3.5, frontZ - 0.3]],
        ],
        [[-2.2, 0, frontZ + 0.55], [2.2, 0, frontZ + 0.55]],
      );
    }
    this.buildKitchen();
    this.curb = new Curbside(this.root, { halfW: this.halfW, frontZ: this.frontZ, backZ: this.backZ, door: this.door, hasRoad: this.street });
    this.interior = decorateInterior(game.state.cuisine, this.root, {
      halfW: this.halfW,
      backZ: this.backZ,
      frontZ: this.frontZ,
      kitchenZ: this.kitchenZ,
      kitchenX1: this.kitchenX1,
      kitchenExtra: this.kitchenExtra,
      wallH: WALL_H,
      kitchenCenter: this.plan === 'L' ? this.wx(76) : undefined,
      corridorX: this.corridorX,
      lcounter: this.plan === 'L' ? { x: this.wx(170), zBack: this.backZ + 0.1, zCorner: this.wz(340), xStart: -this.halfW } : undefined,
    });

    this.unsub.push(game.bus.on('party/left', (e) => {
      let anchor: THREE.Vector3 | null = null;
      const table = e.tableId ? tableById(game.ctx, e.tableId) : null;
      if (table) {
        const at = tablePos(game.ctx, table);
        anchor = new THREE.Vector3(this.wx(at.x), 0, this.wz(at.y));
      }
      for (const [key, actor] of this.actors) {
        if (!key.startsWith(`${e.partyId}:`)) continue;
        actor.leaving = true;
        anchor ??= actor.g.position.clone();
        if (e.reason === 'closed') continue; // hết ca, khách về không giận
        if (e.reason !== 'paid') {
          const angry = emojiSprite('💢', 0.45);
          angry.position.set(0, 1.55, 0);
          actor.g.add(angry);
        }
      }
      if (!anchor || e.reason === 'closed') return;
      // Khách vui: tim bay lên (có tip thì nhiều tim hơn)
      if (e.reason === 'paid') this.fx.burst(e.tip > 0 ? '💖' : '😊', anchor.clone().setY(1.7), { count: e.tip > 0 ? 4 : 1, up: 1.6, spread: 0.7, gravity: 0.6, life: 1.3, size: 0.4, stagger: 0.08 });
      if (e.reason === 'paid') this.onPaid(this.root.localToWorld(anchor.clone().setY(1.2)), e.total + e.tip);
      const sprite = e.reason === 'paid' ? textSprite(`+${e.total + e.tip}`, '#2f8f3a') : emojiSprite('💢', 0.8);
      sprite.position.set(anchor.x, 2, anchor.z);
      this.root.add(sprite);
      this.floats.push({ sprite, life: 1.8 });
    }));
  }

  /** Gỡ các đăng ký sự kiện (khi app dựng lại khu quán sau lúc lên hạng). */
  dispose(): void {
    for (const off of this.unsub) off();
    this.unsub = [];
  }

  private dims() {
    return { halfW: this.halfW, backZ: this.backZ, frontZ: this.frontZ, kitchenZ: this.kitchenZ };
  }

  private police: THREE.Group | null = null;

  /** Công an khu vực (quán ốc): đứng trước cửa quán trong lúc chờ chủ quán quyết, thỉnh thoảng chỉ tay vào bàn ghế. */
  private updatePolice(env: Env): void {
    const on = !!policePending(this.game.ctx);
    if (!this.police && !on) return;
    if (!this.police) {
      // Quân phục xanh lá đậm, mũ kê-pi có quai đỏ + huy hiệu sao vàng, cầu vai đỏ
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
      const badge = emojiSprite('👮', 0.55);
      badge.position.set(0, 2.4, 0);
      p.add(badge);
      p.position.set(-0.8, 0, this.frontZ + 1.0);
      this.root.add(p);
      this.police = p;
    }
    this.police.visible = on;
    if (on) {
      this.police.rotation.y = Math.PI * 0.8 + Math.sin(env.t * 0.7) * 0.35;
      animatePerson(this.police, env.t, { wave: Math.max(0, Math.sin(env.t * 1.3)) });
    }
  }

  /** Anh shipper + xe máy trước cửa (bên phải cửa ra vào). */
  private updateShipper(env: Env): void {
    if (!this.shipper) {
      const person = makePerson({ shirt: 0x2fa84f, hair: 0x2a1f1a, skin: 0xf2c49b }, 'none', { width: 1.0 });
      mesh(person.userData.rig.head, G.sphere(0.27, 12, 8), 0x2fa84f, { p: [0, 0.24, -0.02], s: [1, 0.85, 1] }); // mũ bảo hiểm xanh
      mesh(person.userData.rig.body, G.box(0.34, 0.36, 0.26), 0x2fa84f, { p: [0, 0.28, -0.24] }); // thùng giao hàng sau lưng
      person.scale.setScalar(1.1);
      const rider = makePerson({ shirt: 0x2fa84f, hair: 0x2a1f1a, skin: 0xf2c49b });
      rider.visible = false;
      const bike = makeScooter(0x2fa84f, rider);
      mesh(bike, G.box(0.5, 0.42, 0.5), 0x2fa84f, { p: [-0.55, 0.92, 0] }); // thùng hàng trên baga
      const x = this.halfW - 1.0;
      const z = this.frontZ + 1.3;
      bike.position.set(x, 0, z);
      bike.rotation.y = Math.PI / 2;
      person.position.set(x - 1.0, 0, z + 0.1);
      person.rotation.y = -0.3;
      const badge = emojiSprite('🛵', 0.5);
      badge.position.set(x - 1.0, 2.25, z + 0.1);
      badge.visible = false;
      this.root.add(bike, person, badge);
      this.shipper = { person, bike, badge };
    }
    const s = this.game.state.restaurant.shipper;
    const away = !!this.game.state.crew.restaurantAway;
    this.shipper.bike.visible = !s.trip;
    this.shipper.person.visible = !s.trip && !away;
    // Kiệt sức: ngồi bệt; còn lại đứng chờ, thỉnh thoảng vẫy
    if (this.shipper.person.visible) animatePerson(this.shipper.person, env.t, { sit: s.fainted, wave: s.fainted ? 0 : Math.max(0, Math.min(1, (Math.sin(env.t * 0.4) - 0.85) * 7)) });
  }

  /** Chỗ đứng ngẫu nhiên trong khu ăn (không vướng bàn ghế, đồ trang trí, lối vào) — toạ độ mét. */
  private ownerSpot(): Spot {
    const { ctx } = this.game;
    const d = roomOf(ctx).dining;
    for (let i = 0; i < 25; i++) {
      const x = d.x1 + 20 + Math.random() * (d.x2 - d.x1 - 40);
      const y = d.y1 + 20 + Math.random() * (d.y2 - d.y1 - 40);
      if (!blockerOf(ctx, { x1: x - 16, y1: y - 16, x2: x + 16, y2: y + 16 }, '')) return { x: this.wx(x), z: this.wz(y) };
    }
    return { x: this.wx((d.x1 + d.x2) / 2), z: this.wz(d.y1 + 20) };
  }

  private updateOwner(env: Env, dt: number): void {
    if (!this.owner) {
      const toRoom = (p: Spot) => ({ x: p.x * UNIT + this.room.width / 2, y: p.z * UNIT + this.room.height / 2 });
      this.owner = new OwnerWalker(this.game, this.root, this.ownerSpot(), () => this.ownerSpot(), (from, to) => {
        const w = nextWaypoint(this.game.ctx, toRoom(from), toRoom(to));
        return { x: this.wx(w.x), z: this.wz(w.y) };
      }, 0.6, 1.1);
    }
    this.owner.update(env.t, dt);
  }

  /**
   * Điểm hướng tới kế tiếp trên đường từ (x, z) tới đích (gx, gz) — mét. Ngoài vỉa hè đi thẳng; trong quán dùng pathing của sim
   * (lưới A* vòng qua bàn kèm ghế, đồ trang trí, khối bếp). Tính lại mỗi 0,25 giây, khi tới điểm rẽ hoặc đổi đích.
   */
  private pathStep(a: { wp?: PathCache }, x: number, z: number, gx: number, gz: number, t: number): [number, number] {
    const out = this.frontZ + 0.3;
    if (z > out && gz > out) return [gx, gz];
    const c = a.wp;
    if (!c || c.goal[0] !== gx || c.goal[1] !== gz || t - c.at > 0.25 || Math.hypot(c.wp[0] - x, c.wp[1] - z) < 0.08) {
      const toRoom = (px: number, pz: number) => ({ x: px * UNIT + this.room.width / 2, y: pz * UNIT + this.room.height / 2 });
      const w = nextWaypoint(this.game.ctx, toRoom(x, z), toRoom(gx, gz));
      a.wp = { wp: [this.wx(w.x), this.wz(w.y)], goal: [gx, gz], at: t };
    }
    return a.wp!.wp;
  }

  wx(px: number): number {
    return (px - this.room.width / 2) / UNIT;
  }

  wz(py: number): number {
    return (py - this.room.height / 2) / UNIT;
  }

  // ---------- Dựng cảnh tĩnh ----------

  private buildRoom(): void {
    const r = this.root;
    const { halfW, backZ, frontZ, kitchenZ, mats } = this;
    const depth = frontZ - backZ;

    // Nền ngoài trời + sàn ván hai tông + sàn bếp lát gạch
    mesh(r, G.box(70, 0.2, 60), 0xb9d48a, { p: [0, -0.25, 0], cast: false });
    mesh(r, G.box(halfW * 2, 0.2, depth), mats.floorA, { p: [0, -0.1, (frontZ + backZ) / 2], cast: false });
    const planks = Math.round(halfW * 2);
    // Ván sàn hai tông: quán bếp tường sau thì từ mép bếp ra cửa, quán khác lát suốt (gian bếp lát gạch đè lên)
    const plankZ = this.plan === 'back' ? kitchenZ : backZ;
    for (let i = 1; i < planks; i += 2) {
      mesh(r, G.box(1, 0.02, 1), mats.floorB, { p: [-halfW + ((i + 0.5) * halfW * 2) / planks, 0.005, (frontZ + plankZ) / 2], s: [(halfW * 2) / planks, 1, frontZ - plankZ], cast: false });
    }
    const kf = this.kitchenFloor();
    mesh(r, G.box(1, 0.03, 1), 0xefe6d6, { p: [(kf[0] + kf[1]) / 2, 0.01, (kf[2] + kf[3]) / 2], s: [kf[1] - kf[0], 1, kf[3] - kf[2]], cast: false });

    // Tường sau: chân tường + mảng tường chừa 2 ô cửa sổ
    const backSeg = (x1: number, x2: number, y1: number, y2: number, mat = mats.wall) =>
      mesh(r, G.box(1, 1, 0.3), mat, { p: [(x1 + x2) / 2, (y1 + y2) / 2, backZ - 0.15], s: [x2 - x1, y2 - y1, 1] });
    backSeg(-halfW, halfW, 0, 1.3, mats.trim);
    backSeg(-halfW, halfW, 3.3, WALL_H);
    // Chỉ còn cửa sổ bên phải (sau bếp); bên trái là lối đi có cửa WC và cửa kho
    const winX = this.plan === 'L' ? this.wx(255) : halfW - 2;
    backSeg(-halfW, winX - 1.2, 1.3, 3.3);
    backSeg(winX + 1.2, halfW, 1.3, 3.3);
    this.buildWindow(winX, 2.3, backZ - 0.15, 0);
    this.buildCorridor();

    // Hai tường bên (chỉ nửa sau để nhìn thấy bên trong), mỗi bên 1 cửa sổ
    // Hai tường bên chạy suốt tới mép trước; mỗi bên 2 ô cửa sổ (tường bên phải thấp hơn ở nửa trước để camera nhìn rõ)
    const sideLen = depth + 0.3;
    for (const side of [-1, 1]) {
      const x = side * (halfW + 0.15);
      const z0 = backZ - 0.3;
      const seg = (za: number, zb: number, y1: number, y2: number, mat = mats.wall) =>
        mesh(r, G.box(0.3, 1, 1), mat, { p: [x, (y1 + y2) / 2, (za + zb) / 2], s: [1, y2 - y1, zb - za] });
      const wins = [z0 + sideLen * 0.3, z0 + sideLen * 0.7];
      seg(z0, z0 + sideLen, 0, 1.3, mats.trim);
      seg(z0, z0 + sideLen, 3.3, WALL_H);
      seg(z0, wins[0] - 1.2, 1.3, 3.3);
      seg(wins[0] + 1.2, wins[1] - 1.2, 1.3, 3.3);
      seg(wins[1] + 1.2, z0 + sideLen, 1.3, 3.3);
      for (const wz of wins) this.buildWindow(x, 2.3, wz, Math.PI / 2);
    }
    // Mép trước: chân tường thấp hai bên cửa (không che phòng)
    for (const side of [-1, 1]) mesh(r, G.box(halfW - 1.3, 0.5, 0.3), mats.trim, { p: [side * (halfW + 1.3) / 2, 0.25, frontZ + 0.15] });

    // Bảng thực đơn phấn trên tường sau (quán Việt; quán Nhật treo thẻ gỗ, quán Hàn treo biển neon — xem cuisine.ts)
    // (Bếp sát cửa quán Việt: không treo bảng thực đơn sau lưng đầu bếp)
    if (this.game.state.cuisine === 'vn' && this.plan === 'back') {
      const mx = this.kitchenCenter() - 0.6;
      mesh(r, G.box(2.3, 1.2, 0.05), mats.trim, { p: [mx, 2.75, backZ + 0.02] });
      mesh(r, G.box(2.1, 1, 0.08), 0x2f5d50, { p: [mx, 2.75, backZ + 0.05] });
      const menu = emojiSprite('📋', 0.7);
      menu.position.set(mx, 2.75, backZ + 0.2);
      r.add(menu);
    }

    // Chậu cây ở hai góc trong (góc ngoài để đồ trang trí theo quán), thảm chùi chân
    const pots = this.plan === 'L' ? [[halfW - 0.7, this.wz(100)]] : this.plan === 'front' ? [[halfW - 0.7, kitchenZ + 0.8]] : [[-halfW + 0.7, kitchenZ + 0.8], [halfW - 0.7, kitchenZ + 0.8]];
    for (const [x, z] of pots) {
      mesh(r, G.cyl(0.35, 0.28, 0.5), 0xc8623e, { p: [x, 0.25, z] });
      makeBush(r, { p: [x, 0.45, z], s: 1.1 }, 0x4f9e4a);
    }
    mesh(r, G.box(2.2, 0.04, 0.8), 0xb5553c, { p: [0, 0.02, frontZ - 0.2], cast: false });

    // Đèn treo trần: kiểu đèn theo quán (cuisine.ts); ở đây chỉ có nguồn sáng — sáng dần khi trời tối
    for (const x of [-halfW * 0.5, halfW * 0.5]) {
      const lamp = new THREE.PointLight(0xffc27a, 0, 0, 0);
      lamp.position.set(x, 3.2, 0.5);
      this.lamps.push(lamp);
      r.add(lamp);
    }
  }

/** Lối đi bên trái gian bếp: vách ngăn thấp, cửa WC và cửa kho hàng trên tường sau, thảm nhỏ. */
  private buildCorridor(): void {
    const r = this.root;
    const { halfW, backZ, kitchenZ, kitchenX1, mats } = this;
    // Bếp tường sau: vách ngăn thấp giữa lối đi và gian bếp; quán Nhật: WC + kho ở góc phải cuối quán; quán Việt: góc trái cuối quán
    let doorX: [number, number] = [-halfW + 1.1, kitchenX1 - 1.15];
    if (this.plan === 'back') {
      mesh(r, G.box(0.16, 2.2, kitchenZ - backZ), mats.wall, { p: [kitchenX1, 1.1, (backZ + kitchenZ) / 2] });
      mesh(r, G.box(0.2, 0.1, kitchenZ - backZ + 0.04), mats.trim, { p: [kitchenX1, 2.25, (backZ + kitchenZ) / 2] });
    } else if (this.plan === 'L') doorX = [halfW - 0.95, halfW - 2.15];
    else doorX = [-halfW + 1.1, -halfW + 2.4];
    this.corridorX = (doorX[0] + doorX[1]) / 2;
    const doors: [number, string, number, string][] = [
      [doorX[0], 'WC', 0x6fa8c9, '🚻'],
      [doorX[1], 'KHO', 0xb9733f, '📦'],
    ];
    for (const [x, text, color, icon] of doors) {
      const d = group(r, { p: [x, 0, backZ + 0.03] });
      mesh(d, G.box(1.15, 2.35, 0.08), mats.trim, { p: [0, 1.17, 0] });
      mesh(d, G.box(0.95, 2.2, 0.1), color, { p: [0, 1.1, 0.02] });
      const panel = new THREE.Color(color).multiplyScalar(0.82).getHex();
      for (const y of [0.6, 1.6]) mesh(d, G.box(0.75, 0.6, 0.02), panel, { p: [0, y, 0.08], cast: false });
      mesh(d, G.sphere(0.05, 8, 6), 0xd4a537, { p: [0.35, 1.05, 0.1] });
      const plate = group(d, { p: [0, 2.6, 0.04] });
      mesh(plate, G.box(0.8, 0.32, 0.04), 0xfffaf1);
      const sign = signText(text, '#3b2a1e', 0.75, 0.3);
      sign.position.z = 0.03;
      plate.add(sign);
      const ic = emojiSprite(icon, 0.35);
      ic.position.set(0, 3.05, 0.2);
      d.add(ic);
    }
    mesh(r, G.box(2.6, 0.03, 0.9), 0x6f8f6a, { p: [this.corridorX, 0.02, backZ + 0.8], cast: false }); // thảm lối đi
  }

  private buildWindow(x: number, y: number, z: number, rotY: number): void {
    const g = group(this.root, { p: [x, y, z], r: [0, rotY, 0] });
    mesh(g, G.box(2.4, 2, 0.06), this.windowMat, { cast: false, receive: false });
    for (const fy of [-1, 1]) mesh(g, G.box(2.6, 0.12, 0.36), this.mats.trim, { p: [0, fy, 0] });
    for (const fx of [-1.2, 0, 1.2]) mesh(g, G.box(0.1, 2, 0.34), this.mats.trim, { p: [fx, 0, 0] });
    for (const fx of [-1, 1]) mesh(g, G.box(0.5, 1.9, 0.1), 0xe9806a, { p: [fx * 0.95, 0, 0.2] });
  }

  /** Tâm dãy bếp (mét): giữa tủ lạnh và quầy ra món. */
  private kitchenCenter(): number {
    return this.kitchenX1 + 3.1 + this.kitchenExtra / 2;
  }

  /** Gian bếp khởi đầu gọn nhẹ: 1 dãy bếp ngắn + tủ lạnh. Bếp to hơn là việc của các nâng cấp sau này. */
  private buildKitchen(): void {
    const r = this.root;
    const z = this.backZ + 0.55;
    // Gian bếp gọn: tủ lạnh sát vách ngăn, dãy bếp 3.4 m; bếp lên hạng thì thêm bàn sơ chế, nồi hầm, lò nướng bên phải
    const cx = this.kitchenCenter();
    const ktier = this.game.state.restaurant.kitchenTier;
    if (this.street) {
      this.buildStreetChefs();
      return;
    }
    if (this.plan === 'L') return this.buildKitchenL();
    if (this.plan === 'front') return this.buildKitchenFront();
    // Dãy bếp dài thêm theo phần quán nới về phía Đông; bàn sơ chế / lò nướng đứng nối đuôi bên phải
    const ext = this.kitchenExtra;
    if (ktier >= 2) {
      const px = cx + 2.45 + ext / 2;
      mesh(r, G.box(1.2, 0.95, 0.9), 0xb9c2ca, { p: [px, 0.475, z] });
      mesh(r, G.box(1.3, 0.08, 1), 0x5f6b77, { p: [px, 0.98, z] });
      mesh(r, G.box(0.6, 0.04, 0.4), 0xd9b38c, { p: [px - 0.2, 1.04, z + 0.05] }); // thớt
      for (const [dx, c] of [[-0.35, 0xe5463c], [-0.15, 0x7cc35c], [0.0, 0xf28c28]] as const) mesh(r, G.sphere(0.06, 8, 6), c, { p: [px + dx, 1.1, z + 0.12] });
      mesh(r, G.cyl(0.2, 0.18, 0.32, 12), 0xcfd6dc, { p: [px + 0.35, 1.18, z - 0.1] }); // nồi hầm
    }
    if (ktier >= 3) {
      const ox = cx + 2.45 + ext / 2;
      mesh(r, G.box(1.2, 1.1, 0.7), 0x3b3f46, { p: [ox, 1.62, z - 0.05] }); // lò nướng trên bàn
      mesh(r, G.box(0.9, 0.55, 0.04), 0x8a5a35, { p: [ox, 1.62, z + 0.31] });
      mesh(r, G.box(0.9, 0.5, 0.02), new THREE.MeshBasicMaterial({ color: 0xff9a4a }), { p: [ox, 1.62, z + 0.34], cast: false });
      mesh(r, G.cyl(0.36, 0.3, 0.12), 0x3b3f46, { p: [cx - 0.4, 1.08, z] }); // chảo thứ hai
    }
    mesh(r, G.box(3.4 + ext, 0.95, 0.9), 0x9aa6b2, { p: [cx, 0.475, z] });
    mesh(r, G.box(3.6 + ext, 0.08, 1), 0x5f6b77, { p: [cx, 0.98, z] });
    // Phần bếp dài thêm: thêm bếp ga + nồi, chảo cho đầu bếp thuê
    for (let k = 0; k < Math.floor(ext / 2.2); k++) {
      for (const [bx, c] of [[cx - 1.7 - ext / 2 + 0.55 + k * 1.1, 0xd9534a], [cx + 1.7 + ext / 2 - 0.55 - k * 1.1, 0xcfd6dc]] as const) {
        mesh(r, G.cyl(0.3, 0.26, 0.1), 0x3b3f46, { p: [bx, 1.07, z] });
        mesh(r, G.cyl(0.22, 0.2, 0.28, 12), c, { p: [bx, 1.26, z - 0.05] });
      }
    }
    mesh(r, G.cyl(0.32, 0.28, 0.35), 0xd9534a, { p: [cx - 1.0, 1.2, z] });
    mesh(r, G.cyl(0.34, 0.34, 0.04), 0x8a2f2a, { p: [cx - 1.0, 1.39, z] });
    mesh(r, G.cyl(0.36, 0.3, 0.12), 0x3b3f46, { p: [cx + 0.2, 1.08, z] });
    mesh(r, G.box(0.5, 0.05, 0.08), 0x3b3f46, { p: [cx + 0.75, 1.1, z] });
    mesh(r, G.cyl(0.24, 0.22, 0.45), 0xcfd6dc, { p: [cx + 1.3, 1.25, z] });
    const fx = this.kitchenX1 + 0.65;
    mesh(r, G.box(1, 2.2, 0.85), 0xe9eef2, { p: [fx, 1.1, z] });
    mesh(r, G.box(0.06, 0.6, 0.06), 0x9aa6b2, { p: [fx + 0.35, 1.5, z + 0.46] });

    this.buildPass();
    this.buildWaiter();

    // Đầu bếp đứng sau quầy, quay mặt ra phòng ăn — dàn đều theo số đầu bếp thật (bếp lên hạng thì dãy dài thêm)
    const staff = this.game.state.restaurant.staff.map((s) => this.game.content.staff.get(s.id));
    const lo = this.kitchenCenter() - 1.6 - ext / 2;
    const hi = this.kitchenCenter() + 1.6 + ext / 2 + (ktier >= 2 ? 1.1 : 0);
    staff.forEach((def, i) => {
      const g = makePerson({ shirt: def.hire ? 0xf6f0e4 : 0xffffff, hair: i % 3 === 2 ? 0x6b4a2f : 0x3a2a1e, skin: i % 2 ? 0xffd9b8 : 0xf2c49b }, 'chef', { width: [1.2, 0.95, 1.05, 0.9][i % 4] });
      g.position.set(staff.length === 1 ? this.kitchenCenter() : lo + ((i + 0.5) * (hi - lo)) / staff.length, 0, this.kitchenZ - 1.05);
      g.scale.setScalar(def.speed > 1 ? 1.15 : 1.05);
      this.root.add(g);
      const bar = new Bar3D(0.8);
      bar.group.position.set(0, 1.95, 0);
      g.add(bar.group);
      const icon = emojiSprite('🍳', 0.5);
      icon.position.set(0, 2.3, 0);
      g.add(icon);
      this.chefs.push({ g, icon, iconFor: '', bar, smoke: i * 0.2, yaw: 0 });
    });
  }

  /** Gian bếp lát gạch [x1, x2, z1, z2] (mét) theo mặt bằng. */
  private kitchenFloor(): [number, number, number, number] {
    if (this.plan === 'L') return [-this.halfW, this.wx(152), this.backZ, this.wz(322)];
    if (this.plan === 'front') return [-this.halfW, this.wx(168), this.wz(this.room.height - 240), this.frontZ];
    return [this.kitchenX1, this.halfW, this.backZ, this.kitchenZ];
  }

  /** Đầu bếp đứng ở (x, z) quay mặt theo yaw; khói bốc lên ở puff khi đang nấu. */
  private addChef(def: StaffDef, i: number, x: number, z: number, yaw: number, puff: [number, number]): void {
    const g = makePerson({ shirt: def.hire ? 0xf6f0e4 : 0xffffff, hair: i % 3 === 2 ? 0x6b4a2f : 0x3a2a1e, skin: i % 2 ? 0xffd9b8 : 0xf2c49b }, 'chef', { width: [1.2, 0.95, 1.05, 0.9][i % 4] });
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    g.scale.setScalar(def.speed > 1 ? 1.15 : 1.05);
    this.root.add(g);
    const bar = new Bar3D(0.8);
    bar.group.position.set(0, 1.95, 0);
    g.add(bar.group);
    const icon = emojiSprite('🍳', 0.5);
    icon.position.set(0, 2.3, 0);
    g.add(icon);
    this.chefs.push({ g, icon, iconFor: '', bar, smoke: i * 0.2, yaw, puff });
  }

  /** Bếp + chảo trên mặt bàn bếp ở (x, z) — đầu bếp đứng trước nó. */
  private burner(x: number, z: number, top: number, color = 0x3b3f46): void {
    mesh(this.root, G.cyl(0.24, 0.22, 0.06, 12), 0x2a2d35, { p: [x, top + 0.03, z] });
    mesh(this.root, G.cyl(0.3, 0.24, 0.1, 14), color, { p: [x, top + 0.11, z] });
  }

  /**
   * QUÁN NHẬT — quầy bếp chữ L ở góc trái-sau (kiểu izakaya): cạnh dài dọc tường trái (quầy ra món sát tường sau + 2 quầy đôi),
   * cạnh ngắn quay ra cửa (2 ghế đơn). Đầu bếp đứng trong lòng chữ L quay mặt ra quầy; tủ lạnh, kệ rượu sake dọc tường trái.
   * Khúc quầy ra món và hai quầy đôi / quầy ghế đơn do buildPass / buildTable dựng; ở đây dựng phần quầy nối giữa chúng.
   */
  private buildKitchenL(): void {
    const r = this.root;
    const { halfW, backZ, mats } = this;
    const X = (px: number) => this.wx(px);
    const Z = (pz: number) => this.wz(pz);
    const ktier = this.game.state.restaurant.kitchenTier;
    const cw = 36 / UNIT;
    const counter = (z1: number, z2: number) => {
      if (z2 - z1 < 0.05) return;
      mesh(r, G.box(cw, COUNTER_TOP - 0.08, z2 - z1), mats.base, { p: [X(170), (COUNTER_TOP - 0.08) / 2, (z1 + z2) / 2] });
      mesh(r, G.box(cw + 0.25, 0.08, z2 - z1), mats.top, { p: [X(170), COUNTER_TOP - 0.04, (z1 + z2) / 2] });
    };
    // Phần quầy nối: sau quầy ra món → quầy đôi đầu, quầy đôi trong → góc chữ L
    // Đầu quầy sát tường sau → quầy đôi đầu; khúc ngăn giữa 2 quầy đôi (không ghế, vách gỗ + chậu cây); góc chữ L
    counter(backZ + 0.1, Z(70));
    counter(Z(160), Z(200));
    counter(Z(290), Z(358));
    const gapZ = Z(180);
    mesh(r, G.box(cw + 0.3, 0.9, 0.08), 0x8a5a35, { p: [X(170), COUNTER_TOP + 0.45, gapZ - 0.18] }); // vách gỗ ngăn 2 quầy
    mesh(r, G.box(cw + 0.3, 0.9, 0.08), 0x8a5a35, { p: [X(170), COUNTER_TOP + 0.45, gapZ + 0.18] });
    mesh(r, G.cyl(0.14, 0.11, 0.2, 10), 0x3b3f46, { p: [X(170), COUNTER_TOP + 0.1, gapZ] });
    makeBush(r, { p: [X(170), COUNTER_TOP + 0.25, gapZ], s: 0.6 }, 0x4f9e4a);
    // Bàn bếp trong lòng chữ L (thấp hơn mặt quầy), bếp + chảo trước mỗi đầu bếp
    const ix = X(136);
    const top = 0.92;
    mesh(r, G.box(0.42, top, Z(322) - backZ - 0.1), 0xb9c2ca, { p: [ix, top / 2, (backZ + 0.1 + Z(322)) / 2] });
    mesh(r, G.box(0.48, 0.05, Z(322) - backZ - 0.1), 0x5f6b77, { p: [ix, top, (backZ + 0.1 + Z(322)) / 2] });
    // Tủ lạnh góc trong, kệ thấp + kệ rượu sake dọc tường trái
    mesh(r, G.box(0.85, 2.2, 1), 0xe9eef2, { p: [-halfW + 0.45, 1.1, backZ + 0.65] });
    mesh(r, G.box(0.06, 0.6, 0.06), 0x9aa6b2, { p: [-halfW + 0.9, 1.5, backZ + 0.95] });
    const shelfZ1 = backZ + 1.3;
    const shelfZ2 = Z(310);
    mesh(r, G.box(0.55, 0.9, shelfZ2 - shelfZ1), 0x9aa6b2, { p: [-halfW + 0.3, 0.45, (shelfZ1 + shelfZ2) / 2] });
    mesh(r, G.box(0.6, 0.05, shelfZ2 - shelfZ1), 0x5f6b77, { p: [-halfW + 0.3, 0.92, (shelfZ1 + shelfZ2) / 2] });
    mesh(r, G.box(0.3, 0.05, shelfZ2 - shelfZ1), 0x8a5a35, { p: [-halfW + 0.15, 1.75, (shelfZ1 + shelfZ2) / 2] });
    const bottles = [0x3f7a4a, 0xf3efe0, 0x2a5d8a, 0x8a4a2a];
    for (let i = 0, n = Math.floor((shelfZ2 - shelfZ1) / 0.22); i < n; i++) mesh(r, G.cyl(0.045, 0.055, 0.32, 8), bottles[i % 4], { p: [-halfW + 0.15, 1.94, shelfZ1 + 0.12 + i * 0.22] });
    // Nồi cơm, thùng gỗ ủ cơm sushi trên kệ thấp; bếp lên hạng: nồi hầm dashi, bếp nướng than robata
    mesh(r, G.cyl(0.22, 0.2, 0.3, 14), 0xf3efe0, { p: [-halfW + 0.3, 1.1, shelfZ1 + 0.5] });
    mesh(r, G.cyl(0.26, 0.26, 0.14, 16), 0xc8955a, { p: [-halfW + 0.3, 1.02, shelfZ1 + 1.2] });
    if (ktier >= 2) mesh(r, G.cyl(0.22, 0.2, 0.36, 12), 0xcfd6dc, { p: [-halfW + 0.3, 1.13, shelfZ2 - 0.5] });
    if (ktier >= 3) {
      const gz = (shelfZ1 + shelfZ2) / 2 + 0.3;
      mesh(r, G.box(0.5, 0.18, 0.9), 0x3b3f46, { p: [-halfW + 0.3, 1.04, gz] });
      mesh(r, G.box(0.42, 0.03, 0.8), new THREE.MeshBasicMaterial({ color: 0xff8a3a }), { p: [-halfW + 0.3, 1.14, gz], cast: false });
    }
    this.buildPass();
    this.buildWaiter();
    // Đầu bếp đứng giữa kệ tường và bàn bếp, quay mặt ra quầy (hướng Đông)
    const staff = this.game.state.restaurant.staff.map((s) => this.game.content.staff.get(s.id));
    const lo = backZ + 1.2;
    const hi = Z(300);
    staff.forEach((def, i) => {
      const z = staff.length === 1 ? (lo + hi) / 2 : lo + ((i + 0.5) * (hi - lo)) / staff.length;
      this.burner(ix, z, top);
      this.addChef(def, i, X(98), z, Math.PI / 2, [ix, z]);
    });
  }

  /**
   * QUÁN VIỆT — bếp nấu ngay cửa bên trái, dài nửa quán (kiểu quán phở): tủ kính bánh phở nhìn ra đường,
   * bàn bếp inox với nồi nước dùng to bốc khói, đầu bếp đứng sát tường trái quay mặt vào quán.
   * Quầy ra món ở đầu trong của bếp (bồi bàn đứng phía sau lấy món); xa hơn là lối đi vào WC + kho.
   */
  private buildKitchenFront(): void {
    const r = this.root;
    const { halfW, frontZ } = this;
    const X = (px: number) => this.wx(px);
    const k1 = this.wz(this.room.height - 240);
    const ktier = this.game.state.restaurant.kitchenTier;
    // Bàn bếp inox dọc theo bếp (mặt quay vào quán)
    const sx = X(140);
    const top = 0.9;
    const z1 = k1 + 0.35;
    const z2 = frontZ - 0.95;
    mesh(r, G.box(0.75, top, z2 - z1), 0xb9c2ca, { p: [sx, top / 2, (z1 + z2) / 2] });
    mesh(r, G.box(0.85, 0.05, z2 - z1 + 0.1), 0x5f6b77, { p: [sx, top, (z1 + z2) / 2] });
    mesh(r, G.box(0.04, 0.12, z2 - z1), 0xd9433a, { p: [sx + 0.38, top - 0.2, (z1 + z2) / 2], cast: false }); // viền đỏ
    // Nồi nước dùng to (nồi phở) + chồng bát, rổ rau thơm, chai nước mắm
    const pot = (z: number, s = 1) => {
      mesh(r, G.cyl(0.34 * s, 0.3 * s, 0.62 * s, 16), 0xcfd6dc, { p: [sx, top + 0.31 * s, z] });
      mesh(r, G.cyl(0.36 * s, 0.36 * s, 0.05, 16), 0x9aa6b2, { p: [sx, top + 0.63 * s, z] });
      mesh(r, G.sphere(0.05, 8, 6), 0x3b3f46, { p: [sx, top + 0.68 * s, z] });
    };
    pot(z2 - 0.45, 1.1);
    if (ktier >= 2) pot(z2 - 1.3, 0.9);
    for (let k = 0; k < 4; k++) mesh(r, G.cyl(0.16, 0.11, 0.07, 12), 0xf6f1e4, { p: [sx + 0.12, top + 0.06 + k * 0.07, z1 + 0.35] }); // chồng bát
    mesh(r, G.cyl(0.2, 0.15, 0.1, 12), 0xc9a066, { p: [sx, top + 0.06, z1 + 0.85] });
    mesh(r, G.ico(0.13, 0), 0x5fae57, { p: [sx, top + 0.14, z1 + 0.85], s: [1.3, 0.6, 1.3] });
    for (const [dz, c] of [[0, 0x8a4a2a], [0.12, 0xd9433a]] as const) mesh(r, G.cyl(0.04, 0.045, 0.2, 8), c, { p: [sx + 0.25, top + 0.1, z1 + 1.15 + dz] });
    if (ktier >= 3) {
      // Bếp than nướng chả (bún chả) cạnh tủ kính
      const gz = z2 - 2.1;
      mesh(r, G.box(0.6, 0.22, 0.5), 0x3b3f46, { p: [sx, top + 0.11, gz] });
      mesh(r, G.box(0.5, 0.03, 0.4), new THREE.MeshBasicMaterial({ color: 0xff8a3a }), { p: [sx, top + 0.23, gz], cast: false });
    }
    // Kệ thấp sát tường trái (gia vị, bánh phở, thùng đá)
    mesh(r, G.box(0.5, 0.85, z2 - z1), 0x9a6b44, { p: [-halfW + 0.27, 0.43, (z1 + z2) / 2] });
    for (let i = 0, n = Math.floor((z2 - z1) / 0.35); i < n; i++) mesh(r, G.box(0.22, 0.2, 0.22), [0xf3efe0, 0xd9b56a, 0xe2703a][i % 3], { p: [-halfW + 0.25, 0.96, z1 + 0.2 + i * 0.35] });
    // Tủ kính bánh phở ở mặt tiền, chữ PHỞ đỏ quay ra đường
    const cab = group(r, { p: [(-halfW + X(168)) / 2, 0, frontZ - 0.45] });
    const cwid = X(168) + halfW - 0.2;
    mesh(cab, G.box(cwid, 0.85, 0.6), 0x9a6b44, { p: [0, 0.43, 0] });
    mesh(cab, G.box(cwid, 0.6, 0.55), new THREE.MeshBasicMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.35 }), { p: [0, 1.16, 0], cast: false });
    for (const fx of [-cwid / 2, cwid / 2]) mesh(cab, G.box(0.05, 0.62, 0.58), 0xd9b56a, { p: [fx, 1.16, 0] });
    mesh(cab, G.box(cwid + 0.04, 0.05, 0.6), 0xd9b56a, { p: [0, 1.47, 0] });
    for (let i = 0; i < 5; i++) mesh(cab, G.box(0.36, 0.06, 0.3), i % 2 ? 0xf6f1e4 : 0xf1e2c0, { p: [-cwid / 2 + 0.35 + (i * (cwid - 0.7)) / 4, 0.92, 0], cast: false }); // bánh phở
    mesh(cab, G.box(0.25, 0.12, 0.2), 0xb5553c, { p: [cwid / 2 - 0.4, 0.95, 0.05], cast: false }); // thịt bò
    const board = group(cab, { p: [0, 1.85, 0.05] });
    mesh(board, G.box(Math.min(2.4, cwid), 0.55, 0.05), 0xd9433a);
    this.frontSign = { board, w: Math.min(2.2, cwid - 0.2), text: '', mesh: null };
    this.updateFrontSign();
    for (const bx of [-0.9, 0.9]) mesh(cab, G.cyl(0.02, 0.02, 0.4, 6), 0xd9b56a, { p: [bx * Math.min(1, cwid / 2.4), 1.65, 0.05] });
    this.buildPass();
    this.buildWaiter();
    // Đầu bếp đứng giữa kệ tường và bàn bếp, quay mặt vào quán; khói bốc từ nồi trước mặt
    const staff = this.game.state.restaurant.staff.map((s) => this.game.content.staff.get(s.id));
    const lo = z1 + 0.5;
    const hi = z2 - 0.2;
    staff.forEach((def, i) => {
      const z = staff.length === 1 ? z2 - 0.45 : lo + ((i + 0.5) * (hi - lo)) / staff.length;
      this.addChef(def, i, X(62), z, Math.PI / 2, [sx, z]);
    });
  }

  /** Quán ốc: sạp dù + xe đẩy (bếp trưởng) + bếp nướng (bếp phó) + bàn sơ chế cho đầu bếp thuê; quầy ra món như quán thường. */
  private buildStreetChefs(): void {
    const staff = this.game.state.restaurant.staff.map((s) => this.game.content.staff.get(s.id));
    this.rainShelter = { x1: 0, x2: 0, z1: 0, z2: 0, y: 0 };
    this.streetAnim = buildStreetKitchen(this.root, this.dims(), this.mats, staff.length, this.rainShelter);
    this.buildPass();
    this.buildWaiter();
    const spots = streetSpots(this.dims()).chefs;
    staff.forEach((def, i) => {
      const at = spots[i % spots.length];
      const g = makePerson({ shirt: def.hire ? 0xf6f0e4 : 0xffffff, hair: i % 3 === 2 ? 0x6b4a2f : 0x3a2a1e, skin: i % 2 ? 0xffd9b8 : 0xf2c49b }, 'chef', { width: [1.2, 0.95, 1.05, 0.9][i % 4] });
      g.position.set(at.x, 0, at.z);
      g.scale.setScalar(def.speed > 1 ? 1.15 : 1.05);
      this.root.add(g);
      const bar = new Bar3D(0.8);
      bar.group.position.set(0, 1.95, 0);
      g.add(bar.group);
      const icon = emojiSprite('🍳', 0.5);
      icon.position.set(0, 2.3, 0);
      g.add(icon);
      this.chefs.push({ g, icon, iconFor: '', bar, smoke: i * 0.2, yaw: 0 });
    });
  }

  /** Quầy ra món: bếp nấu xong đặt đĩa ở đây, đèn giữ nóng phía trên, chuông báo khi có món chờ. */
  private buildPass(): void {
    const pass = this.room.pass;
    // Quầy line dài theo sức chứa của hạng bếp (6 đĩa = 1.7 m); dài thêm về phía trái, mép phải giữ nguyên
    this.passXY = passSlotsXY(passSlots(this.game.ctx));
    const w = 0.5 * (this.passXY.length / 2) + 0.2;
    // Quán Nhật: quầy ra món là khúc đầu cạnh dài quầy chữ L (sát tường sau, mặt quay sang phải);
    // quán Việt: đầu trong của bếp sát cửa (mặt quay vào trong, bồi bàn đứng phía sau lấy món)
    let at: [number, number, number] = [this.wx(pass.x) - (w - 1.7) / 2, this.wz(pass.y), 0];
    if (this.plan === 'L') at = [this.wx(pass.x), this.wz(pass.y), 0];
    else if (this.plan === 'front') at = [-this.halfW + 0.45 + w / 2, this.wz(pass.y), Math.PI];
    const g = group(this.root, { p: [at[0], 0, at[1]], r: [0, at[2], 0] });
    g.userData.pick = { type: 'pass', id: 'pass' } satisfies Pick;
    mesh(g, G.box(w, PASS_TOP - 0.06, 0.8), 0x9aa6b2, { p: [0, (PASS_TOP - 0.06) / 2, 0] });
    mesh(g, G.box(w + 0.15, 0.06, 0.95), 0xdfe5ea, { p: [0, PASS_TOP - 0.03, 0] });
    mesh(g, G.box(w, 0.08, 0.04), 0xe2703a, { p: [0, PASS_TOP - 0.25, 0.41] }); // viền cam phía trước
    // Đèn giữ nóng
    for (const side of [-1, 1]) mesh(g, G.cyl(0.03, 0.03, 0.9, 6), 0x5f6b77, { p: [side * (w / 2 - 0.03), PASS_TOP + 0.45, -0.3] });
    mesh(g, G.box(w + 0.05, 0.08, 0.22), 0x5f6b77, { p: [0, PASS_TOP + 0.9, -0.2] });
    mesh(g, G.box(w - 0.1, 0.03, 0.16), this.bulbMat, { p: [0, PASS_TOP + 0.85, -0.2], cast: false });
    this.passBell = emojiSprite('🔔', 0.5);
    this.passBell.position.set(0, PASS_TOP + 1.35, 0);
    g.add(this.passBell);
    // Hộp chứa đĩa (để vị trí đĩa theo quầy)
    g.userData.plates = group(g, { p: [0, PASS_TOP, 0] });
  }

  /** Bồi bàn — nhân vật của người chơi: áo xanh, tạp dề trắng, vòng sáng dưới chân cho dễ nhận ra. */
  private buildWaiter(): void {
    const g = makePerson({ shirt: 0x3f8fd2, hair: 0x2a1f1a, skin: 0xffd9b8 });
    const rig = g.userData.rig;
    mesh(rig.body, G.box(0.36, 0.34, 0.05), 0xffffff, { p: [0, 0.14, 0.18] }); // tạp dề
    mesh(rig.head, G.box(0.42, 0.06, 0.3), 0xe2574c, { p: [0, 0.36, 0.06], r: [-0.2, 0, 0] }); // mũ lưỡi trai đỏ
    const ring = mesh(g, G.torus(0.42, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffd23e }), { p: [0, 0.03, 0], r: [Math.PI / 2, 0, 0], cast: false, receive: false });
    const hand = group(g, { p: [0, 0.98, 0.34] });
    g.scale.setScalar(1.1);
    const home = this.game.state.restaurant.waiter;
    g.position.set(this.wx(home.x), 0, this.wz(home.y));
    this.root.add(g);
    this.waiter = { g, ring, hand, handKey: '', lastX: g.position.x, lastZ: g.position.z };
  }

  /** Món đang trên tay bồi bàn: đĩa có model món, hoặc menu / sổ ghi món khi đang đi làm việc đó. */
  private setWaiterHand(key: string, recipeIds: string[] | null, w: { hand: THREE.Group; handKey: string } = this.waiter): void {
    if (w.handKey === key) return;
    w.handKey = key;
    w.hand.clear();
    if (!key) return;
    if (recipeIds) {
      // Khay gỗ, các đĩa xếp cạnh nhau (tối đa 4 đĩa)
      const n = recipeIds.length;
      if (n > 1) mesh(w.hand, G.box(0.3 * Math.min(n, 2) + 0.12, 0.03, n > 2 ? 0.62 : 0.34), 0x8a5a35, { p: [0, -0.02, 0] });
      recipeIds.forEach((recipeId, i) => {
        const plate = group(w.hand, { p: n > 1 ? [((i % 2) - 0.5) * 0.3 * (n > 1 ? 1 : 0), 0, n > 2 ? (Math.floor(i / 2) - 0.5) * 0.3 : 0] : [0, 0, 0], s: n > 1 ? 0.72 : 1 });
        mesh(plate, G.cyl(0.2, 0.14, 0.04, 14), 0xffffff);
        const food = makeDish(recipeId);
        if (food) {
          food.position.y = 0.02;
          plate.add(food);
        } else {
          const icon = emojiSprite(this.game.content.recipes.get(recipeId).icon, 0.4);
          icon.position.y = 0.22;
          plate.add(icon);
        }
      });
    } else if (key === 'mop') {
      // Cây lau nhà: cán gỗ chéo xuống sàn trước mặt, đầu lau sợi bông trắng
      const mop = group(w.hand, { p: [0, -0.1, 0], r: [0.55, 0, 0] });
      mesh(mop, G.cyl(0.025, 0.025, 1.25, 6), 0xb07a45, { p: [0, -0.45, 0] });
      const head = group(mop, { p: [0, -1.08, 0] });
      mesh(head, G.box(0.42, 0.06, 0.12), 0x6f8fb3);
      for (let i = 0; i < 7; i++) mesh(head, G.box(0.05, 0.16, 0.08), 0xf4f1ea, { p: [-0.18 + i * 0.06, -0.1, 0], cast: false });
    } else {
      const icon = emojiSprite({ menu: '📖', note: '📝', clean: '🧽', mop: '🧹' }[key] ?? '📝', 0.42);
      icon.position.y = 0.1;
      w.hand.add(icon);
    }
  }

  /** Dựng một bàn + ghế trong group riêng (gốc ở tâm bàn) để dời được cả cụm. */
  private buildTable(rotated: TableDef): TableView {
    const t = withRotation(rotated, false);
    const { mats } = this;
    const g = group(this.root);
    g.userData.pick = { type: 'table', id: t.id } satisfies Pick;
    const w = t.w / UNIT;
    const d = t.h / UNIT;
    if (t.shared || t.bar) {
      // Quầy dọc (quầy chữ L quán Nhật): dựng như quầy ngang rồi xoay để mặt khách quay sang phía Đông
      const body = t.bar ? group(g, { r: [0, Math.PI / 2, 0] }) : g;
      const [bw, bd] = t.bar ? [d, w] : [w, d];
      mesh(body, G.box(bw, COUNTER_TOP - 0.08, bd), mats.base, { p: [0, (COUNTER_TOP - 0.08) / 2, 0] });
      mesh(body, G.box(bw + (t.bar ? 0 : 0.2), 0.08, bd + 0.25), mats.top, { p: [0, COUNTER_TOP - 0.04, 0] });
      counterExtras(this.game.state.cuisine, body, COUNTER_TOP, bw, bd);
    } else {
      mesh(g, G.box(w, 0.1, d), mats.top, { p: [0, TABLE_TOP - 0.05, 0] });
      mesh(g, G.box(w - 0.15, 0.06, d - 0.15), mats.base, { p: [0, TABLE_TOP - 0.13, 0] });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(g, G.cyl(0.06, 0.06, TABLE_TOP - 0.1, 8), mats.base, { p: [sx * (w / 2 - 0.15), (TABLE_TOP - 0.1) / 2, sz * (d / 2 - 0.15)] });
      tableExtras(this.game.state.cuisine, g, TABLE_TOP, w, d);
    }
    for (const [si, s] of seatSpots(t, { x: 0, y: 0 }).entries()) {
      const cx = s.x / UNIT;
      const cz = s.y / UNIT;
      const chair = group(g, { p: [cx, 0, cz], r: [0, Math.atan2(s.dishX / UNIT - cx, s.dishY / UNIT - cz), 0] });
      if (t.shared || t.bar) {
        mesh(chair, G.cyl(0.05, 0.07, 0.72, 8), 0x5f6b77, { p: [0, 0.36, 0] });
        mesh(chair, G.cyl(0.26, 0.26, 0.08, 14), mats.seat, { p: [0, 0.74, 0] });
      } else {
        // Quán ốc: ghế nhựa mini xanh / đỏ xen kẽ
        if (this.street) {
          buildSeat('plastic', chair, si % 2 ? { ...mats, seat: mats.back } : mats);
          chair.scale.setScalar(0.88);
        } else buildSeat(seatStyle(this.game.state.cuisine), chair, mats);
      }
    }
    const pad = mesh(g, G.box(1, 0.03, 1), this.padMat, { p: [0, 0.03, 0], s: [w + 1.3, 1, d + 1.5], cast: false, receive: false });
    const hand = emojiSprite('✋', 0.55);
    hand.position.set(0, 1.75, 0);
    g.add(hand);
    return { def: t, g, pad, hand };
  }

  // ---------- Phục vụ ----------

  /** Dựng lại bong bóng khi nội dung đổi; bong bóng chờ người chơi bấm thì nhún nhảy cho dễ thấy. */
  private updateBubbles(fx: PartyFx, party: import('../../../sim/state').Party, env: Env, arrived: boolean): void {
    const { ctx, state, content } = this.game;
    const need = needOf(party);
    let main = '';
    // Khách đang đi vào chỗ: ngồi xuống rồi mới giơ tay xin menu
    if (party.phase === 'seated') main = arrived && !(party.walking ?? 0) ? '📖' : '';
    else if (party.phase === 'browsing') main = '💭';
    else if (party.phase === 'readyToOrder') main = '📝'; // chọn xong, chờ ghi món (ghi xong mới hiện mặt cười / tâm trạng)
    else if (party.phase === 'waitingFood') main = MOOD_FACES[moodOf(ctx, party)];
    // Món ruột của khách quen có tim đứng trước
    const waiting = party.phase === 'waitingFood' ? state.restaurant.orders.filter((o) => o.partyId === party.id && o.status !== 'served').flatMap((o) => (o.fav ? ['💖', content.recipes.get(o.recipeId).icon] : [content.recipes.get(o.recipeId).icon])) : [];
    const dishesKey = waiting.join('|');

    // Đã gọi món: bong bóng mang màu bàn (món của bàn này trên quầy / trên tay bồi bàn cùng màu)
    const color = party.phase === 'waitingFood' ? partyColor(party.color) : null;
    const mainKey = `${main}|${color ?? ''}`;
    if (fx.mainKey !== mainKey) {
      if (fx.main) fx.holder.remove(fx.main);
      fx.main = main ? bubbleSprite([main], 0.8, color) : null;
      if (fx.main) fx.holder.add(fx.main);
      fx.mainKey = mainKey;
    }
    const dishKey = `${dishesKey}|${color ?? ''}`;
    if (fx.dishesKey !== dishKey) {
      if (fx.dishes) fx.holder.remove(fx.dishes);
      fx.dishes = waiting.length ? bubbleSprite(waiting, 0.62, color) : null;
      if (fx.dishes) fx.holder.add(fx.dishes);
      fx.dishesKey = dishKey;
    }

    // Bồi bàn đang cầm món của bàn này: bong bóng nhún lên cho dễ thấy
    const wants = party.phase === 'waitingFood' && state.restaurant.waiter.carrying.some((id) => state.restaurant.orders.find((o) => o.id === id)?.partyId === party.id);
    const beat = 1 + Math.max(0, Math.sin(env.t * 6 + party.id)) * 0.18;
    // Kích thước gốc của bong bóng (lúc dựng) để nhún theo tỉ lệ mà không cộng dồn
    const base = (sprite: THREE.Sprite) => (sprite.userData.base ??= sprite.scale.clone()) as THREE.Vector3;
    if (fx.main) {
      const k = need ? beat : 1;
      fx.main.scale.copy(base(fx.main)).multiplyScalar(k);
      fx.main.material.opacity = party.called ? 0.55 : 1;
    }
    if (fx.dishes) {
      const k = wants ? beat * 1.15 : 1;
      fx.dishes.scale.copy(base(fx.dishes)).multiplyScalar(k);
    }
    // Hai bong bóng đứng cạnh nhau, căn giữa trên đầu nhóm khách
    const mw = fx.main ? base(fx.main).x : 0;
    const dw = fx.dishes ? base(fx.dishes).x : 0;
    const gap = fx.main && fx.dishes ? 0.06 : 0;
    const left = -(mw + gap + dw) / 2;
    if (fx.main) fx.main.position.set(left + mw / 2, 0, 0);
    if (fx.dishes) fx.dishes.position.set(left + mw + gap + dw / 2, 0.04, 0);
  }

  /** Đĩa trên quầy ra món: món đã nấu xong chờ bưng; món người chơi đang chọn thì nảy lên. */
  private updatePass(env: Env): void {
    const { state, ctx } = this.game;
    const plates: THREE.Group = this.passBell.parent!.userData.plates;
    const ready = state.restaurant.orders.filter((o) => o.status === 'ready');
    const keep = new Set(ready.map((o) => o.id));
    for (const [id, g] of this.passPlates) {
      if (keep.has(id)) continue;
      plates.remove(g);
      this.passPlates.delete(id);
    }
    ready.slice(0, this.passXY.length).forEach((o, i) => {
      let g = this.passPlates.get(o.id);
      if (!g) {
        g = group(plates);
        mesh(g, G.cyl(0.2, 0.14, 0.04, 14), 0xffffff);
        const food = makeDish(o.recipeId);
        if (food) {
          food.position.y = 0.02;
          g.add(food);
        } else {
          const icon = emojiSprite(this.game.content.recipes.get(o.recipeId).icon, 0.36);
          icon.position.y = 0.2;
          g.add(icon);
        }
        // Vòng màu dưới đĩa = màu bàn đã gọi món này
        const pc = partyColor(this.game.state.restaurant.parties.find((p) => p.id === o.partyId)?.color);
        if (pc) mesh(g, G.cyl(0.24, 0.24, 0.02, 18), new THREE.MeshBasicMaterial({ color: pc }), { p: [0, -0.01, 0], cast: false });
        g.userData.born = env.t;
        this.passPlates.set(o.id, g);
      }
      const [x, z] = this.passXY[i];
      const picked = false;
      const reserved = isReserved(ctx, o.id);
      const pop = easeOutBack(Math.min(1, (env.t - g.userData.born) / 0.35), 3);
      g.position.set(x, picked ? 0.12 + Math.abs(Math.sin(env.t * 6)) * 0.08 : 0.02, z);
      g.scale.setScalar(Math.max(0.001, pop) * (picked ? 1.15 : reserved ? 0.85 : 1));
    });
    const waitingDishes = ready.some((o) => !isReserved(ctx, o.id));
    this.passBell.visible = waitingDishes;
    this.passBell.position.y = PASS_TOP + 1.35 + Math.abs(Math.sin(env.t * 5)) * 0.1;
    this.passBell.material.rotation = Math.sin(env.t * 12) * 0.25;
  }

  /** Bồi bàn đi theo vị trí trong sim (làm mượt), quay mặt theo hướng đi, cầm thứ đang mang. */
  private updateWaiter(env: Env, dt: number): void {
    const w = this.game.state.restaurant.waiter;
    // Giờ nghỉ cả đội ra chợ: bồi bàn vắng mặt (về lại thì hiện ở cửa)
    this.waiter.g.visible = !this.game.state.crew.restaurantAway;
    this.moveWorker(w, this.waiter, env, dt, w.fainted);
    faintPose(this.waiter.g, w.fainted, dt);
    (this.waiter.ring.material as THREE.MeshBasicMaterial).opacity = 1;
    this.waiter.ring.scale.setScalar(1 + Math.sin(env.t * 4) * 0.06);
    this.updateHelpers(env, dt);
  }

  /** Một người phục vụ (bồi bàn hoặc nhân viên thuê) đi theo vị trí trong sim, quay theo hướng đi, cầm thứ đang mang. */
  private moveWorker(sim: import('../../../sim/state').WaiterState, w: { g: THREE.Group; hand: THREE.Group; handKey: string; lastX: number; lastZ: number }, env: Env, dt: number, still = false): void {
    const { state } = this.game;
    const tx = this.wx(sim.x);
    const tz = this.wz(sim.y);
    const pos = w.g.position;
    pos.x += (tx - pos.x) * Math.min(1, dt * 12);
    pos.z += (tz - pos.z) * Math.min(1, dt * 12);
    const dx = pos.x - w.lastX;
    const dz = pos.z - w.lastZ;
    const moving = Math.hypot(dx, dz) > 0.004;
    w.lastX = pos.x;
    w.lastZ = pos.z;
    if (moving) w.g.rotation.y = Math.atan2(dx, dz);
    else if (!sim.tasks.length) w.g.rotation.y += (0 - w.g.rotation.y) * Math.min(1, dt * 5); // rảnh: quay mặt ra phòng
    pos.y = moving ? Math.abs(Math.sin(env.t * 11)) * 0.06 : 0;

    const carrying = sim.carrying.map((id) => state.restaurant.orders.find((o) => o.id === id)).filter((o) => !!o);
    const task = sim.tasks[0];
    if (carrying.length) this.setWaiterHand(`dish:${sim.carrying.join(',')}`, carrying.map((o) => o!.recipeId), w);
    else if (task?.kind === 'menu') this.setWaiterHand('menu', null, w);
    else if (task?.kind === 'takeOrder') this.setWaiterHand('note', null, w);
    else if (task?.kind === 'clean') this.setWaiterHand('clean', null, w);
    else if (task?.kind === 'mop') this.setWaiterHand('mop', null, w);
    else this.setWaiterHand('', null, w);
    // Đang đứng lau vết bẩn: đẩy cây lau qua lại
    const mopping = task?.kind === 'mop' && sim.work != null && !moving;
    w.hand.rotation.y = mopping ? Math.sin(env.t * 7) * 0.45 : 0;
    if (!still) animatePerson(w.g, env.t, { walk: moving ? 1 : 0, carry: carrying.length > 0, mop: mopping ? 1 : 0 });
    this.updateCarryBadges(w.g, carrying.map((o) => o!));
  }

  /** Món đang cầm hiện trên đầu người phục vụ, mỗi món một bong bóng màu của bàn đã gọi. */
  private updateCarryBadges(g: THREE.Group, orders: import('../../../sim/state').Order[]): void {
    const { state, content } = this.game;
    const items = orders.map((o) => ({ icon: content.recipes.get(o.recipeId).icon, color: partyColor(state.restaurant.parties.find((p) => p.id === o.partyId)?.color) }));
    const key = items.map((i) => `${i.icon}${i.color}`).join('|');
    if (g.userData.badgeKey === key) return;
    g.userData.badgeKey = key;
    let holder = g.userData.badges as THREE.Group | undefined;
    if (!holder) {
      holder = group(g, { p: [0, 2.15, 0] });
      g.userData.badges = holder;
    }
    holder.clear();
    items.forEach((it, i) => {
      const s = bubbleSprite([it.icon], 0.42, it.color);
      s.position.x = (i - (items.length - 1) / 2) * 0.46;
      holder!.add(s);
    });
  }

  private helperViews = new Map<string, { mgr: boolean; g: THREE.Group; hand: THREE.Group; handKey: string; lastX: number; lastZ: number; bar: Bar3D; status: THREE.Sprite; statusKey: string }>();

  /** Nhân viên thuê: áo theo người, mũ vàng, thanh năng lượng trên đầu; xỉu thì nằm lăn ra sàn 😵; đi ăn ở chợ thì vắng mặt. */
  private updateHelpers(env: Env, dt: number): void {
    const helpers = this.game.state.restaurant.helpers;
    const away = !!this.game.state.crew.restaurantAway;
    for (const [id, v] of this.helperViews) {
      // Vừa lên quản lý (thuê thêm người thứ 2) hay thôi làm quản lý: dựng lại hình
      if (helpers.some((h) => h.id === id) && v.mgr === isManager(this.game.ctx, id)) continue;
      this.root.remove(v.g);
      this.helperViews.delete(id);
    }
    for (const h of helpers) {
      let v = this.helperViews.get(h.id);
      if (!v) {
        const mgr = isManager(this.game.ctx, h.id);
        const g = makeHelperPerson(h.look, mgr, adultShape);
        const hand = group(g, { p: [0, 0.98, 0.34] });
        const bar = new Bar3D(0.7);
        bar.group.position.set(0, 2.0, 0);
        g.add(bar.group);
        const status = emojiSprite('😵', 0.45);
        status.position.set(0, 1.0, 0);
        status.visible = false;
        g.add(status);
        g.scale.setScalar(1.05);
        g.position.set(this.wx(h.x), 0, this.wz(h.y));
        this.root.add(g);
        this.helperViews.set(h.id, (v = { mgr, g, hand, handKey: '', lastX: g.position.x, lastZ: g.position.z, bar, status, statusKey: '' }));
      }
      // Bệnh nghỉ ở nhà hôm nay: không có mặt ở quán
      v.g.visible = !away && !h.sick;
      this.moveWorker(h, v, env, dt, h.fainted);
      const max = this.game.content.balance.crew.maxEnergy;
      v.bar.set(h.energy / max, true);
      v.bar.group.visible = !h.fainted;
      // Xỉu: nằm nghiêng ra sàn, ngôi sao quay trên đầu
      v.g.rotation.z += ((h.fainted ? Math.PI / 2 : 0) - v.g.rotation.z) * Math.min(1, dt * 6);
      v.status.visible = h.fainted || h.energy < max * 0.2;
      const key = h.fainted ? '😵' : '😓';
      if (v.statusKey !== key) {
        v.g.remove(v.status);
        v.status = emojiSprite(key, 0.45);
        v.status.position.set(0, h.fainted ? 0.6 : 2.3, 0);
        v.g.add(v.status);
        v.statusKey = key;
      }
      if (h.fainted) v.g.position.y = 0.2;
    }
  }

  // ---------- Sắp xếp bàn ----------

  /** Đang kéo bàn `id` tới điểm (x, z) trên sàn: cập nhật vị trí xem trước. */
  dragItem(kind: 'table' | 'prop', id: string, x: number, z: number): void {
    const room = this.room;
    const { ctx, state } = this.game;
    const snap = (v: number) => Math.round(v / LAYOUT_GRID) * LAYOUT_GRID;
    const px = x * UNIT + room.width / 2;
    const py = z * UNIT + room.height / 2;
    // Lần đầu: nhớ chỗ nắm so với tâm vật (bấm lên mặt bàn cao hơn sàn nên tia chạm sàn lệch ra sau)
    if (!this.drag || this.drag.id !== id) {
      const prop = kind === 'prop' ? state.restaurant.props.find((p) => p.uid === id) : null;
      const t = kind === 'table' ? tableById(ctx, id) : null;
      const at = prop ?? (t ? tablePos(ctx, t) : { x: px, y: py });
      this.grab = { dx: at.x - px, dy: at.y - py };
    }
    const want = { x: snap(px + (this.grab?.dx ?? 0)), y: snap(py + (this.grab?.dy ?? 0)) };
    // Vướng một chút thì tự hít vào chỗ trống gần nhất (xem trước màu xanh, thả ra đặt luôn chỗ đó)
    const prop = kind === 'prop' ? state.restaurant.props.find((p) => p.uid === id) : null;
    const check = (cx: number, cy: number) => (kind === 'table' ? canPlaceTable(ctx, id, cx, cy) : canPlaceProp(ctx, id, cx, cy, prop?.rot ?? 0));
    const fit = nearestPlaceable(check, want.x, want.y);
    this.drag = { kind, id, ...(fit ?? want) };
  }

  /** Kết thúc kéo: trả về vị trí để app gửi lệnh 'layout/moveTable' (null nếu không kéo gì). */
  endDrag(): { kind: 'table' | 'prop'; id: string; x: number; y: number } | null {
    const d = this.drag;
    this.drag = null;
    this.grab = null;
    return d;
  }

  // ---------- Chén dĩa dơ, vết bẩn sàn ----------

  private dirtyViews = new Map<string, THREE.Group>();
  private stainViews = new Map<number, { g: THREE.Group; ring: THREE.Mesh; level: number }>();
  private holdRing = new THREE.MeshBasicMaterial({ color: 0x5fd068, transparent: true, opacity: 0.9, depthTest: false });

  /** Chén dĩa dơ ở chỗ khách vừa ngồi + bong bóng 🧽 nhắc dọn (bấm bàn là dọn). */
  private updateDirty(env: Env): void {
    const { state, ctx } = this.game;
    const dirty = state.restaurant.dirty;
    for (const [key, g] of this.dirtyViews) {
      const [tableId, seats] = key.split('|');
      if (dirty[tableId]?.join(',') === seats) continue;
      this.root.remove(g);
      this.dirtyViews.delete(key);
    }
    for (const [tableId, seats] of Object.entries(dirty)) {
      const key = `${tableId}|${seats.join(',')}`;
      const table = tableById(ctx, tableId);
      if (!table || !seats.length) continue;
      let g = this.dirtyViews.get(key);
      const spots = seatSpots(table, tablePos(ctx, table));
      if (!g) {
        g = group(this.root);
        g.userData.pick = { type: 'table', id: tableId } satisfies Pick;
        const top = (table.shared || table.bar ? COUNTER_TOP : TABLE_TOP) + 0.02;
        for (const i of seats) {
          const s = spots[i];
          if (!s) continue;
          const plate = group(g, { p: [this.wx(s.dishX), top, this.wz(s.dishY)] });
          mesh(plate, G.cyl(0.2, 0.14, 0.04, 14), 0xf4f1e8);
          mesh(plate, G.cyl(0.13, 0.1, 0.03, 10), 0xc9b48a, { p: [0, 0.03, 0], cast: false }); // vụn thức ăn
          mesh(plate, G.cyl(0.1, 0.07, 0.1, 10), 0xffffff, { p: [0.12, 0.07, -0.06] }); // chén úp
          mesh(plate, G.box(0.02, 0.01, 0.22), 0x8a5a35, { p: [-0.12, 0.05, 0.02], r: [0, 0.4, 0], cast: false }); // đũa
        }
        const cx = seats.reduce((a, i) => a + this.wx(spots[i]?.dishX ?? 0), 0) / seats.length;
        const cz = seats.reduce((a, i) => a + this.wz(spots[i]?.dishY ?? 0), 0) / seats.length;
        const bubble = bubbleSprite(['🧽'], 0.6);
        bubble.position.set(cx, 1.75, cz);
        bubble.userData.base = bubble.scale.clone();
        g.add(bubble);
        g.userData.bubble = bubble;
        this.dirtyViews.set(key, g);
      }
      const bubble = g.userData.bubble as THREE.Sprite;
      const queued = state.restaurant.waiter.tasks.some((t) => t.kind === 'clean' && t.tableId === tableId);
      bubble.material.opacity = queued ? 0.5 : 1;
      bubble.scale.copy(bubble.userData.base).multiplyScalar(queued ? 1 : 1 + Math.max(0, Math.sin(env.t * 6)) * 0.15);
    }
  }

  /** Vết bẩn trên sàn: đốm nâu theo độ bẩn; đang bấm giữ thì hiện vòng tiến độ. */
  private updateStains(env: Env): void {
    const { state } = this.game;
    const stains = state.restaurant.stains;
    for (const [id, v] of this.stainViews) {
      const s = stains.find((x) => x.id === id);
      if (s && s.level === v.level) continue;
      this.root.remove(v.g);
      this.stainViews.delete(id);
    }
    for (const s of stains) {
      let v = this.stainViews.get(s.id);
      if (!v) {
        const g = group(this.root, { p: [this.wx(s.x), 0.02, this.wz(s.y)] });
        g.userData.pick = { type: 'stain', id: String(s.id) } satisfies Pick;
        const k = 0.55 + s.level * 0.22;
        const rnd = (n: number) => ((Math.sin(s.id * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
        for (let i = 0; i < 3 + s.level; i++) {
          mesh(g, G.cyl(1, 1, 0.01, 12), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x8a6a45 : 0x7a5a3a, transparent: true, opacity: 0.55 + s.level * 0.1, depthWrite: false }), {
            p: [(rnd(i) - 0.5) * k, 0.003 * i, (rnd(i + 9) - 0.5) * k * 0.8],
            s: [0.12 + rnd(i + 3) * 0.2 * k, 1, 0.1 + rnd(i + 5) * 0.16 * k],
            cast: false,
            receive: false,
          });
        }
        // Vùng bấm rộng hơn vết bẩn cho dễ trúng
        mesh(g, G.cyl(0.55 * k + 0.2, 0.55 * k + 0.2, 0.02, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { cast: false, receive: false });
        const ring = mesh(g, G.torus(0.45, 0.05, 6, 32, 0.001), this.holdRing, { p: [0, 0.3, 0], r: [-Math.PI / 2, 0, 0], cast: false, receive: false });
        ring.renderOrder = 11;
        if (s.level >= 2) {
          const fly = emojiSprite('🪰', 0.28);
          fly.position.set(0.2, 0.5, 0);
          g.add(fly);
          g.userData.fly = fly;
        }
        this.stainViews.set(s.id, (v = { g, ring, level: s.level }));
      }
      const fly = v.g.userData.fly as THREE.Sprite | undefined;
      if (fly) fly.position.set(Math.cos(env.t * 3 + s.id) * 0.3, 0.45 + Math.sin(env.t * 5) * 0.08, Math.sin(env.t * 3 + s.id) * 0.3);
      // Vòng tiến độ bấm giữ: Stage ghi lại vật đang giữ (holding), vẽ lại cung theo thời gian giữ
      const held = this.holdFor === String(s.id) ? Math.min(1, this.holdMs / HOLD_MS) : 0;
      v.ring.visible = held > 0;
      if (held > 0) v.ring.geometry = G.torus(0.45, 0.05, 6, 32, Math.max(0.001, Math.round(held * 20) / 20) * Math.PI * 2);
    }
  }

  /** app.ts báo vết bẩn đang được bấm giữ (id) và đã giữ bao lâu (ms). */
  holdFor: string | null = null;
  holdMs = 0;

  // ---------- Khách quen ----------

  /** Vòng sáng hồng dưới chân + bảng tên (tên + tim) + ngôi sao nhỏ thay bảng tên sau vài giây. */
  /** Khách đặc biệt của sự kiện (nhà phê bình): mũ nồi đen, kính, biểu tượng nổi trên đầu. */
  private decorateVip(g: THREE.Group): void {
    const rig = g.userData.rig;
    mesh(rig.head, G.cyl(0.24, 0.26, 0.08, 16), 0x2a2a2a, { p: [0.03, 0.42, -0.02], r: [0, 0, 0.25] });
    mesh(rig.head, G.sphere(0.03, 6, 5), 0x2a2a2a, { p: [0.05, 0.47, -0.02] });
    for (const side of [-1, 1]) mesh(rig.head, G.torus(0.055, 0.012, 5, 12), 0x2a2a2a, { p: [side * 0.085, 0.18, 0.225], cast: false });
    const tag = emojiSprite('🧐', 0.6);
    tag.position.set(0, 2.95, 0);
    g.add(tag);
  }

  private decorateRegular(g: THREE.Group, name: string, hearts: number, t: number): NonNullable<Actor['regular']> {
    const k = 1 / g.scale.x; // trẻ em thu nhỏ: giữ vòng sáng và chữ đúng cỡ
    const ring = mesh(g, G.torus(0.4, 0.035, 6, 24), new THREE.MeshBasicMaterial({ color: 0xff8fc0, transparent: true, opacity: 0.85 }), { p: [0, 0.03, 0], r: [Math.PI / 2, 0, 0], s: k, cast: false, receive: false });
    ring.userData.regularRing = true;
    const max = this.game.content.balance.regulars.heartVisits.length;
    const tag = tagSprite(name, '♥'.repeat(hearts) + '♡'.repeat(max - hearts));
    tag.position.set(0, 2.15 * k, 0);
    tag.scale.multiplyScalar(k);
    g.add(tag);
    const star = emojiSprite('⭐', 0.32 * k);
    star.position.set(0, 1.95 * k, 0);
    star.visible = false;
    g.add(star);
    return { tag, star, born: t };
  }

  private updateRegularTag(actor: Actor, env: Env): void {
    const r = actor.regular!;
    const age = env.t - r.born;
    const show = age < 4.5;
    r.tag.visible = show;
    r.tag.material.opacity = Math.min(1, age * 4, (4.5 - age) * 3);
    r.star.visible = !show;
    r.star.position.y = r.star.userData.y0 ??= r.star.position.y;
    r.star.position.y = r.star.userData.y0 + Math.sin(env.t * 3) * 0.04;
    const ring = actor.g.children.find((c) => c.userData.regularRing) as THREE.Mesh | undefined;
    if (ring) ring.rotation.z = env.t * 1.5;
  }

  // ---------- Đồ trang trí, thú cưng, biển tên ----------

  /** Đang kéo đồ trang trí `uid` tới điểm (x, z) trên sàn. */
  private updateProps(env: Env): void {
    const { ctx, content } = this.game;
    const placed = placedProps(ctx);
    const keep = new Set(placed.map((p) => p.uid));
    for (const [uid, view] of this.props) {
      if (keep.has(uid)) continue;
      this.root.remove(view.g);
      this.props.delete(uid);
    }
    for (const p of placed) {
      const def = content.props.get(p.def);
      let view = this.props.get(p.uid);
      if (!view) {
        const g = group(this.root);
        g.userData.pick = { type: 'prop', id: p.uid } satisfies Pick;
        g.add(makeProp(def.model, def.icon));
        const pad = mesh(g, G.box(1, 0.03, 1), this.selMat, { p: [0, 0.03, 0], s: [def.w / UNIT + 0.3, 1, def.h / UNIT + 0.3], cast: false, receive: false });
        const hand = emojiSprite('✋', 0.45);
        hand.position.set(0, 1.9, 0);
        g.add(hand);
        // Đồ mới bày: nảy lên
        g.userData.born = env.t;
        this.props.set(p.uid, (view = { g, pad, hand, def: p.def }));
      }
      const dragging = this.drag?.kind === 'prop' && this.drag.id === p.uid;
      const at = dragging ? this.drag! : p;
      view.g.position.set(this.wx(at.x), dragging ? 0.25 : 0, this.wz(at.y));
      view.g.rotation.y = p.rot ? -Math.PI / 2 : 0;
      const pop = easeOutBack(Math.min(1, (env.t - view.g.userData.born) / 0.45), 3);
      view.g.scale.setScalar(Math.max(0.001, pop));
      const selected = env.editLayout && env.editSelected === p.uid;
      view.pad.visible = dragging || selected;
      view.pad.material = dragging ? this.padMat : this.selMat;
      if (dragging) this.padMat.color.setHex(canPlaceProp(ctx, p.uid, at.x, at.y, p.rot) ? 0xe2574c : 0x5fd068);
      view.hand.visible = env.editLayout && !dragging;
      view.hand.position.y = 1.9 + Math.sin(env.t * 3 + view.g.position.x) * 0.08;
      animateProp(view.g, env.t);
    }
  }

  /** Thú cưng: đi lang thang tới chỗ trống ngẫu nhiên, thỉnh thoảng lại gần khách đang ngồi cho vuốt ve (tim bay). */
  /** Các bé thú cưng đang ở quán (chó, mèo cùng lúc được): mỗi bé đi lang thang riêng. */
  private updatePets(env: Env, dt: number): void {
    const out = this.game.state.profile.petsOut;
    for (const [id, p] of this.pets) {
      if (out.includes(id)) continue;
      this.root.remove(p.g);
      this.pets.delete(id);
    }
    out.forEach((id, i) => this.updatePet(env, dt, id, i));
  }

  private updatePet(env: Env, dt: number, id: string, index: number): void {
    const d = this.room.dining;
    let pet = this.pets.get(id);
    if (!pet) {
      const g = makePet(id);
      const x = this.wx((d.x1 + d.x2) / 2) + (index ? 1.2 : 0);
      const z = this.wz(d.y2 - 40);
      g.position.set(x, 0, z);
      this.root.add(g);
      this.pets.set(id, (pet = { id, g, x, z, tx: x, tz: z, wait: 1 + index * 1.5, petting: 0 }));
    }
    const dist = Math.hypot(pet.tx - pet.x, pet.tz - pet.z);
    const legs = pet.g.userData.legs as THREE.Object3D[];
    if (dist > 0.05) {
      // Đi vòng qua bàn ghế như người
      const [sx, sz] = this.pathStep(pet, pet.x, pet.z, pet.tx, pet.tz, env.t);
      const dx = sx - pet.x;
      const dz = sz - pet.z;
      const sdist = Math.max(1e-6, Math.hypot(dx, dz));
      const step = Math.min(sdist, dt * 1.1);
      pet.x += (dx / sdist) * step;
      pet.z += (dz / sdist) * step;
      pet.g.rotation.y = Math.atan2(dx, dz);
      legs.forEach((l, i) => (l.rotation.x = Math.sin(env.t * 14 + i * Math.PI) * 0.5));
      pet.g.position.y = Math.abs(Math.sin(env.t * 14)) * 0.03;
    } else {
      legs.forEach((l) => (l.rotation.x = 0));
      pet.g.position.y = 0;
      if ((pet.wait -= dt) <= 0) {
        // Lúc thì ghé khách đang ngồi (được vuốt ve), lúc thì đi dạo chỗ ngẫu nhiên
        const seated = [...this.actors.values()].filter((a) => a.seated && !a.leaving);
        const guest = Math.random() < 0.45 && seated.length ? seated[Math.floor(Math.random() * seated.length)] : null;
        if (guest) {
          pet.tx = guest.tx + 0.45;
          pet.tz = guest.tz + 0.35;
          pet.petting = 1;
        } else {
          pet.tx = this.wx(d.x1 + 30 + Math.random() * (d.x2 - d.x1 - 60));
          pet.tz = this.wz(d.y1 + 30 + Math.random() * (d.y2 - d.y1 - 60));
          pet.petting = 0;
        }
        pet.wait = 2.5 + Math.random() * 3;
      } else if (pet.petting === 1 && pet.wait < 2) {
        pet.petting = 2;
        this.fx.burst('💕', new THREE.Vector3(pet.x, 0.9, pet.z), { count: 3, up: 1.1, spread: 0.4, gravity: 0.4, life: 1.2, size: 0.3, stagger: 0.12 });
      }
    }
    pet.g.position.x = pet.x;
    pet.g.position.z = pet.z;
    animateCreature(pet.g, env.t, 0.7);
    const head = pet.g.userData.head as THREE.Object3D;
    head.rotation.y = Math.sin(env.t * 0.7) * 0.4;
  }

  /** Biển tên quán treo trên tường sau (dựng lại khi đổi tên). */
  /** Biển trên tủ kính quán Việt: tên quán người chơi đặt (đổi tên thì vẽ lại). */
  private updateFrontSign(): void {
    const s = this.frontSign;
    const name = this.game.state.profile.name.toUpperCase();
    if (!s || s.text === name) return;
    if (s.mesh) s.board.remove(s.mesh);
    s.mesh = signText(name, '#fff4dc', s.w, 0.45);
    s.mesh.position.z = 0.04;
    s.board.add(s.mesh);
    s.text = name;
  }

  private updateNameSign(env: Env): void {
    // Có Biển hiệu đèn LED thì biển tên có viền đèn nhấp nháy
    const led = this.game.state.upgrades.includes('sign');
    const name = this.game.state.profile.name;
    const key = `${name}|${led}`;
    if (this.signLeds.length) blinkLeds(this.signLeds, env.t);
    if (this.nameSign?.text === key) return;
    if (this.nameSign) this.root.remove(this.nameSign.g);
    this.signLeds = [];
    if (this.street) {
      // Quán ốc: bảng tên chân đứng bên trái xe đẩy
      const at = streetSpots(this.dims()).sign;
      const sign = standingSign(name, this.mats.trim);
      sign.position.set(at.x, 0, at.z);
      sign.rotation.y = 0.2;
      if (led) {
        const w = Math.min(2.2, 0.9 + name.length * 0.09);
        const board = group(sign, { p: [0, 1.15, 0.15], r: [-0.12, 0, 0] });
        this.signLeds = ledFrame(board, w + 0.1, 1.0, 0.06, 0.14);
      }
      this.root.add(sign);
      this.nameSign = { text: key, g: sign };
      return;
    }
    const signX = this.plan === 'L' ? this.wx(96) : this.plan === 'front' ? 0.6 : -this.halfW + 4 + 3.1 - 0.6;
    const g = group(this.root, { p: [signX, 3.78, this.backZ + 0.04] });
    const w = Math.min(4.6, 1.2 + name.length * 0.2);
    mesh(g, G.box(w + 0.25, 0.7, 0.06), this.mats.trim);
    mesh(g, G.box(w, 0.56, 0.08), 0xfff4dc, { p: [0, 0, 0.01] });
    const text = signText(name, '#8a3a2a', w - 0.15, 0.48);
    text.position.z = 0.06;
    g.add(text);
    if (led) this.signLeds = ledFrame(g, w + 0.4, 0.85, 0.06, 0.18);
    this.nameSign = { text: key, g };
  }

  /** Chỗ đặt trang thiết bị theo mặt bằng riêng (quầy chữ L / bếp sát cửa); bếp tường sau dùng mặc định trong equipment.ts. */
  private equipSpots(): { line?: EquipDims['line']; knife?: EquipDims['knife']; cabinet?: EquipDims['cabinet']; freezer?: EquipDims['freezer'] } {
    const { halfW, backZ, frontZ } = this;
    if (this.plan === 'L') {
      const z2 = this.wz(322);
      return {
        line: { x: this.wx(124), z: (backZ + 1 + z2) / 2, len: z2 - backZ - 1.2, rot: Math.PI / 2 },
        knife: [-halfW + 0.04, (backZ + z2) / 2, Math.PI / 2],
        cabinet: [halfW - 0.25, this.wz(395), -Math.PI / 2],
        freezer: [halfW - 0.4, this.wz(475), -Math.PI / 2],
      };
    }
    if (this.plan === 'front') {
      const k1 = this.wz(this.room.height - 240);
      return {
        line: { x: this.wx(140), z: (k1 + frontZ) / 2 - 0.2, len: frontZ - k1 - 1.6, rot: Math.PI / 2 },
        knife: [-halfW + 0.04, k1 + 1.2, Math.PI / 2],
        cabinet: [-halfW + 0.25, this.wz(70), Math.PI / 2],
        freezer: [-halfW + 0.4, k1 - 1.6, Math.PI / 2],
      };
    }
    return {};
  }

  /** Trang thiết bị đã mua: dựng lại khi danh sách đổi (mua thêm), mỗi khung hình chạy hoạt cảnh (nốt nhạc, lửa). */
  private updateEquipment(env: Env): void {
    const owned = this.game.state.upgrades;
    const key = [...owned].sort().join(',');
    if (this.equip?.key !== key) {
      if (this.equip) this.root.remove(this.equip.view.g);
      const spots = this.street ? streetSpots(this.dims()) : null;
      const view = buildEquipment(
        this.root,
        {
          street: this.street,
          halfW: this.halfW,
          backZ: this.backZ,
          frontZ: this.frontZ,
          kitchenZ: this.kitchenZ,
          kitchenX1: this.kitchenX1,
          kitchenCenter: this.kitchenCenter(),
          kitchenHalf: 1.7 + this.kitchenExtra / 2,
          door: this.door,
          ...this.equipSpots(),
          cart: spots?.cart,
          grill: spots?.grill,
        },
        new Set(owned),
      );
      this.equip = { key, view };
    }
    this.equip.view.update(env.t);
  }

  // ---------- Đồng bộ với state mỗi khung hình ----------

  private paintedSeason = -1;
  private festive: FestiveSet | null = null;

  update(env: Env, dt: number, speed: number): void {
    this.festive?.update(this.game, env.t, env.wind);
    // Chỉ đổi nền cỏ ngoài quán (chậu cây trong nhà giữ xanh)
    if (this.paintedSeason !== env.season) {
      this.paintedSeason = env.season;
      paintSeason(this.root, env.season, false);
    }
    const { state, content, ctx } = this.game;
    const { parties, orders, staff } = state.restaurant;
    this.interior(env, dt);
    this.streetAnim(env, dt);
    this.updateOwner(env, dt);
    this.updateShipper(env);
    this.updatePolice(env);

    // Màu theo nội thất đang dùng
    const colors = (slot: 'floor' | 'wall' | 'furniture') => content.decor.get(state.decor.equipped[slot]).colors;
    const floor = colors('floor');
    const wall = colors('wall');
    const furn = colors('furniture');
    const { mats } = this;
    mats.floorA.color.setHex(floor.a);
    mats.floorB.color.setHex(floor.b);
    mats.wall.color.setHex(wall.wall);
    mats.trim.color.setHex(wall.trim);
    mats.top.color.setHex(furn.top);
    mats.base.color.setHex(furn.base);
    mats.seat.color.setHex(furn.seat);
    mats.back.color.setHex(furn.back);

    // Bàn: dựng bàn mới có, đặt đúng vị trí hiện tại (hoặc vị trí đang kéo)
    const tablesNow = activeTables(ctx);
    for (const t of tablesNow) {
      let view = this.tables.get(t.id);
      if (!view) this.tables.set(t.id, (view = this.buildTable(t)));
      const dragging = this.drag?.kind === 'table' && this.drag.id === t.id;
      const at = dragging ? this.drag! : tablePos(ctx, t);
      view.g.position.set(this.wx(at.x), dragging ? 0.25 : 0, this.wz(at.y));
      view.g.rotation.y = t.rotated ? -Math.PI / 2 : 0;
      const selected = env.editLayout && env.editSelected === t.id;
      view.pad.visible = dragging || selected;
      view.pad.material = dragging ? this.padMat : this.selMat;
      if (dragging) this.padMat.color.setHex(canPlaceTable(ctx, t.id, at.x, at.y) ? 0xe2574c : 0x5fd068);
      view.hand.visible = env.editLayout && !t.fixed && !dragging;
      view.hand.position.y = 1.75 + Math.sin(env.t * 3 + view.g.position.x) * 0.08;
    }
    // Bàn mua thêm đã bán: bỏ khỏi cảnh
    for (const [id, view] of this.tables) {
      if (tablesNow.some((t) => t.id === id)) continue;
      this.root.remove(view.g);
      this.tables.delete(id);
    }
    this.updateProps(env);
    this.updatePets(env, dt);
    this.updateNameSign(env);
    this.updateFrontSign();
    this.updateEquipment(env);
    this.updateDirty(env);
    this.updateStains(env);

    // Ánh sáng trong nhà
    for (const lamp of this.lamps) lamp.intensity = this.street ? env.night * 1.4 : 0.25 + env.night * 1.5;
    this.bulbMat.emissiveIntensity = 0.3 + env.night * 1.4;
    this.windowMat.opacity = 0.18 + env.day * 0.15;

    // Đầu bếp (giờ nghỉ ra chợ thì vắng mặt; kiệt sức thì nằm ra sàn)
    const chefsAway = !!state.crew.restaurantAway;
    staff.forEach((s, i) => {
      const chef = this.chefs[i];
      if (!chef) return;
      chef.g.visible = !chefsAway;
      faintPose(chef.g, s.fainted, dt);
      if (s.fainted) {
        chef.icon.visible = chef.bar.group.visible = false;
        return;
      }
      const order = orders.find((o) => o.id === s.orderId);
      chef.icon.visible = chef.bar.group.visible = !!order;
      chef.g.position.y = order ? Math.abs(Math.sin(env.t * 9 + i)) * 0.03 : 0;
      chef.g.rotation.y = chef.yaw + (order ? Math.sin(env.t * 2 + i) * 0.15 : 0);
      // Đang nấu thì đảo chảo; rảnh thì thỉnh thoảng vẫy tay chào khách
      const idleWave = Math.max(0, Math.min(1, (Math.sin(env.t * 0.4 + i * 2.5) - 0.88) * 9));
      animatePerson(chef.g, env.t, { cook: order ? 1 : 0, wave: order ? 0 : idleWave });
      if (!order) return;
      // Khói bếp bốc lên từ chảo khi đang nấu
      if ((chef.smoke -= dt) <= 0) {
        chef.smoke = 0.35 + Math.random() * 0.2;
        const puff = chef.puff ? new THREE.Vector3(chef.puff[0] + (Math.random() - 0.5) * 0.3, 1.5, chef.puff[1] + (Math.random() - 0.5) * 0.3) : new THREE.Vector3(chef.g.position.x + (Math.random() - 0.5) * 0.4, 1.5, this.street ? chef.g.position.z + 1.0 : this.backZ + 0.6);
        this.fx.burst('☁️', puff, { count: 1, up: 0.5, spread: 0.12, gravity: -0.6, life: 1.5, size: 0.32 });
      }
      const recipe = content.recipes.get(order.recipeId);
      if (chef.iconFor !== recipe.icon) {
        chef.g.remove(chef.icon);
        chef.icon = emojiSprite(recipe.icon, 0.5);
        chef.icon.position.set(0, 2.3, 0);
        chef.g.add(chef.icon);
        chef.iconFor = recipe.icon;
      }
      chef.bar.set(order.progress / recipe.cookTime);
    });

    // Khách: đặt mục tiêu vị trí
    const seen = new Set<string>();
    const seenParties = new Set<number>();
    let queueX = 1.4;
    // Trước cửa: nhóm mới tới bằng xe thì xe chạy vào bãi trước, khách xuống xe rồi mới đi vào
    const present = new Set([...this.actors.keys()].map((k) => Number(k.split(':')[0])));
    this.curb.update(env.t, dt * Math.max(1, speed), env.night, parties, present, this.firstFrame);
    for (const party of parties) {
      seenParties.add(party.id);
      if (!this.firstFrame && this.curb.holding(party.id)) continue;
      const table = party.tableId ? tableById(ctx, party.tableId) : null;
      const spots = table ? seatSpots(table, tablePos(ctx, table)) : null;
      let cx = 0;
      let cz = 0;
      for (let i = 0; i < party.size; i++) {
        const key = `${party.id}:${i}`;
        seen.add(key);
        const spot = spots?.[party.seats[i]];
        const tx = spot ? this.wx(spot.x) : queueX + i * 0.55;
        const tz = spot ? this.wz(spot.y) : this.queueZ;
        let actor = this.actors.get(key);
        if (!actor) {
          const regular = i === 0 && party.regular ? content.regulars.get(party.regular) : null;
          // Khách vãng lai: dáng người (trẻ em đi cùng gia đình, người già, mập gầy) + kiểu tóc cố định theo nhóm và vị trí
          const walkIn = randomShape(party.id * 10 + i, i, LOOKS[party.looks[i] % LOOKS.length]);
          const g = regular ? makeRegular(regular.style) : makePerson(walkIn.look!, 'none', walkIn.shape);
          g.userData.pick = { type: 'party', id: String(party.id) } satisfies Pick;
          // Khách đi bộ dọc vỉa hè tới, hoặc bước xuống từ xe vừa đậu; đi qua cửa rồi mới vào chỗ
          const [sx, sz] = this.firstFrame ? [tx, tz] : this.curb.spawnOf(party.id);
          g.position.set(sx + (this.firstFrame ? 0 : (i % 3) * 0.3 - 0.3), 0, sz);
          this.root.add(g);
          this.actors.set(key, (actor = { g, tx, tz, face: 0, restY: 0, leaving: false, via: this.firstFrame ? [] : this.curb.entryVia(party.id), seated: false, eating: false, atOut: this.firstFrame }));
          if (regular) actor.regular = this.decorateRegular(g, regular.name, heartsOf(ctx, regular.id), env.t);
          if (party.vip && i === 0) this.decorateVip(g);
        }
        if (actor.regular) this.updateRegularTag(actor, env);
        actor.seated = !!spot;
        actor.eating = party.phase === 'eating';
        if (actor.tx !== tx || actor.tz !== tz) actor.atOut = false;
        actor.tx = tx;
        actor.tz = tz;
        // Chỗ đứng sau ghế: lùi 34 đơn vị khỏi bàn theo hướng ghế → đĩa (ngoài vùng bàn kèm ghế, để đi vòng không xuyên bàn mình)
        if (spot) {
          const ox = spot.x - spot.dishX;
          const oy = spot.y - spot.dishY;
          const n = Math.hypot(ox, oy) || 1;
          actor.out = [this.wx(spot.x + (ox / n) * 34), this.wz(spot.y + (oy / n) * 34)];
        } else actor.out = null;
        actor.face = spot ? Math.atan2(this.wx(spot.dishX) - tx, this.wz(spot.dishY) - tz) : Math.PI;
        actor.restY = spot ? (table!.shared || table!.bar ? 0.4 : 0.14) : 0;
        cx += tx / party.size;
        cz += tz / party.size;
      }
      if (!spots) queueX += party.size * 0.55 + 0.35;

      // Bong bóng chat (việc người chơi cần làm / tâm trạng / món đã gọi) + thanh kiên nhẫn
      let fx = this.partyFx.get(party.id);
      if (!fx) {
        const holder = group(this.root);
        holder.userData.pick = { type: 'party', id: String(party.id) } satisfies Pick;
        fx = { bar: new Bar3D(0.9), main: null, mainKey: '', dishes: null, dishesKey: '', holder };
        this.root.add(fx.bar.group);
        this.partyFx.set(party.id, fx);
      }
      // Cả nhóm đã tới ghế (không còn đi trên đường vào quán)
      let arrived = !!spots;
      for (let i = 0; i < party.size && arrived; i++) {
        const a = this.actors.get(`${party.id}:${i}`);
        arrived = !!a && !a.via.length && Math.hypot(a.g.position.x - a.tx, a.g.position.z - a.tz) < 0.15;
      }
      this.updateBubbles(fx, party, env, arrived);
      fx.holder.position.set(cx, 1.75, cz);
      const patience = party.patience / party.patienceMax;
      fx.bar.group.position.set(cx, 1.62, cz);
      fx.bar.group.visible =
        party.phase === 'queue' || ((party.phase === 'seated' ? arrived : party.phase === 'readyToOrder') && !party.called) || (party.phase === 'waitingFood' && patience < 0.35);
      fx.bar.set(patience, true);

      // Đĩa thức ăn
      if (table && spots) {
        party.orderIds.forEach((id, i) => {
          const order = orders.find((o) => o.id === id);
          const spot = spots[party.seats[i]];
          if (!order || !spot) return;
          let dish = this.dishes.get(id);
          if (!dish) {
            const g = group(this.root, { p: [this.wx(spot.dishX), (table.shared || table.bar ? COUNTER_TOP : TABLE_TOP) + 0.02, this.wz(spot.dishY)] });
            mesh(g, G.cyl(0.2, 0.14, 0.04, 14), 0xffffff);
            const sprite = emojiSprite(content.recipes.get(order.recipeId).icon, 0.42);
            sprite.position.y = 0.26;
            g.add(sprite);
            // Món có model 3D thì bày lên đĩa khi ra món; emoji chỉ còn làm bong bóng "đang chờ món"
            const food = makeDish(order.recipeId);
            if (food) {
              food.position.y = 0.02;
              food.visible = false;
              g.add(food);
            }
            this.dishes.set(id, (dish = { g, sprite, food, servedAt: -1 }));
          }
          const served = order.status === 'served';
          if (served && dish.servedAt < 0) dish.servedAt = env.t;
          dish.g.visible = served;
          dish.g.position.set(this.wx(spot.dishX), (table.shared || table.bar ? COUNTER_TOP : TABLE_TOP) + 0.02, this.wz(spot.dishY));
          dish.sprite.position.y = 0.24;
          // Món vừa ra: đĩa nảy lên rồi đáp xuống, đĩa dẹt-giãn một nhịp
          const since = served ? env.t - dish.servedAt : 99;
          const pop = served && since < 0.5 ? easeOutBack(since / 0.4, 3) : 1;
          dish.sprite.scale.setScalar(0.42 * pop);
          if (dish.food) {
            dish.food.visible = served;
            dish.sprite.visible = !served;
            dish.food.scale.setScalar(1.1 * Math.max(0.001, pop));
          }
          const squash = wobble(since, 0.4);
          dish.g.scale.set(1 + 0.15 * squash, 1 - 0.3 * squash, 1 + 0.15 * squash);
        });
      }
    }
    this.firstFrame = false;

    // Dọn những thứ không còn trong state
    for (const [id, dish] of this.dishes) {
      if (orders.some((o) => o.id === id)) continue;
      this.root.remove(dish.g);
      this.dishes.delete(id);
    }
    for (const [id, fx] of this.partyFx) {
      if (seenParties.has(id)) continue;
      this.root.remove(fx.bar.group, fx.holder);
      this.partyFx.delete(id);
    }

    this.updatePass(env);
    this.updateWaiter(env, dt);

    // Di chuyển khách
    // dt có thể âm ở khung hình đầu (tua ?ff= lâu hơn mốc rAF): kẹp về 0 để không chia 0/0 ra NaN
    const step = WALK_SPEED * Math.max(0, dt) * Math.max(1, speed);
    for (const [key, actor] of this.actors) {
      if (!seen.has(key)) actor.leaving = true;
      if (actor.leaving && !actor.exitSet) {
        // Ra về: ra cửa, rồi tới xe của nhóm (bãi giữ xe) hoặc đi bộ dọc vỉa hè
        actor.exitSet = true;
        const out = this.curb.exitOf(Number(key.split(':')[0]));
        actor.via = [...(actor.out && actor.atOut ? [actor.out] : []), this.door, ...out.slice(0, -1)];
        [actor.tx, actor.tz] = out[out.length - 1];
      }
      const pos = actor.g.position;
      // Vào chỗ: tới chỗ đứng sau ghế trước, rồi mới bước vào ghế
      const toOut = !actor.via.length && !actor.leaving && !!actor.out && !actor.atOut;
      const [gx, gz] = actor.via.length ? actor.via[0] : toOut ? actor.out! : [actor.tx, actor.tz];
      const dist = Math.hypot(gx - pos.x, gz - pos.z);
      // Trong quán: đi vòng qua bàn ghế, khách đang ngồi, đồ trang trí, khối bếp (như nhân viên)
      const [sx, sz] = this.pathStep(actor, pos.x, pos.z, gx, gz, env.t);
      const dx = sx - pos.x;
      const dz = sz - pos.z;
      const sdist = Math.max(1e-6, Math.hypot(dx, dz));
      if (dist <= Math.max(step, 1e-6) && actor.via.length) {
        pos.set(gx, 0, gz);
        actor.via.shift();
      } else if (dist <= Math.max(step, 1e-6) && toOut) {
        pos.set(gx, 0, gz);
        actor.atOut = true;
      } else if (dist <= Math.max(step, 1e-6)) {
        if (actor.leaving) {
          this.root.remove(actor.g);
          this.actors.delete(key);
          continue;
        }
        pos.set(actor.tx, actor.restY, actor.tz);
        actor.g.rotation.y = actor.face;
        const sit = actor.seated && !actor.leaving;
        animatePerson(actor.g, env.t, { sit, eat: sit && actor.eating });
      } else {
        pos.x += (dx / sdist) * Math.min(step, sdist);
        pos.z += (dz / sdist) * Math.min(step, sdist);
        pos.y = Math.abs(Math.sin(env.t * 11 + pos.x)) * 0.07;
        actor.g.rotation.y = Math.atan2(dx, dz);
        animatePerson(actor.g, env.t, { walk: 1 });
      }
    }

    this.fx.update(dt);

    // Chữ nổi
    for (const f of this.floats) {
      f.life -= dt;
      f.sprite.position.y += dt * 0.7;
      f.sprite.material.opacity = Math.max(0, Math.min(1, f.life));
      if (f.life <= 0) {
        this.root.remove(f.sprite);
        f.sprite.material.dispose();
      }
    }
    this.floats = this.floats.filter((f) => f.life > 0);
  }
}

/** Kiệt sức: nằm nghiêng ra sàn (mượt dần); tỉnh lại thì đứng dậy. */
function faintPose(g: THREE.Object3D, fainted: boolean, dt: number): void {
  g.rotation.z += ((fainted ? Math.PI / 2 : 0) - g.rotation.z) * Math.min(1, dt * 6);
  if (fainted) g.position.y = 0.2;
}
