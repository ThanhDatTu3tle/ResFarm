import * as THREE from 'three';
import { passSlots } from '../../../sim/systems/kitchen';
import type { RoomDef, TableDef } from '../../../data';
import type { Game } from '../../../sim/game';
import { canPlaceProp, canPlaceTable, LAYOUT_GRID, placedProps, roomOf, seatSpots, tableById, tablePos, withRotation } from '../../../sim/layout';
import { heartsOf } from '../../../sim/systems/regulars';
import { makePet, makeRegular } from '../people';
import { animateProp, makeProp } from '../props';
import { activeTables, moodOf } from '../../../sim/systems/customers';
import { isReserved, needOf, wantedOrder } from '../../../sim/systems/service';
import { animateCreature, animatePerson, LOOKS, makeBush, makeDish, makePerson } from '../models';
import { buildSeat, counterExtras, decorateInterior, seatStyle, signText, tableExtras, type InteriorAnimator } from '../cuisine';
import { HOLD_MS, type Area, type Env, type Pick } from '../stage';
import { Bar3D, bubbleSprite, emojiSprite, G, group, mesh, textSprite, toon, paintSeason } from '../toon';
import { easeOutBack, wobble } from '../../ease';
import { Particles } from '../fx';
import { FestiveSet } from '../festive';

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
  /** Đã có ghế (để ngồi khi tới nơi) và đang ăn (đưa tay lên miệng). */
  seated: boolean;
  eating: boolean;
  /** Khách quen: bảng tên (hiện vài giây lúc mới tới) rồi thu thành ngôi sao nhỏ trên đầu. */
  regular?: { tag: THREE.Sprite; star: THREE.Sprite; born: number };
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

  // Kích thước phòng (mét)
  private halfW: number;
  private backZ: number;
  private frontZ: number;
  private kitchenZ: number;
  /** Mép trái gian bếp (mét): bên trái là lối đi vào WC + kho hàng. */
  private kitchenX1: number;
  private door: [number, number];
  private queueZ: number;

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
  /** smoke: giây còn lại tới lần phả khói bếp kế tiếp. */
  private chefs: { g: THREE.Group; icon: THREE.Sprite; iconFor: string; bar: Bar3D; smoke: number }[] = [];
  private fx = new Particles(this.root);
  private tables = new Map<string, TableView>();
  private drag: { kind: 'table' | 'prop'; id: string; x: number; y: number } | null = null;
  private props = new Map<string, PropView>();
  private selMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.45 });
  /** Thú cưng đi lang thang trong khu ăn uống (chỉ là hình ảnh, sim chỉ biết đang nuôi con nào). */
  private pet: { id: string; g: THREE.Group; x: number; z: number; tx: number; tz: number; wait: number; petting: number } | null = null;
  /** Biển tên quán trên tường sau. */
  private nameSign: { text: string; g: THREE.Group } | null = null;
  /** Mặt bằng theo hạng quán lúc dựng cảnh (lên hạng thì app.ts dựng lại cả khu). */
  readonly room: RoomDef;
  private unsub: (() => void)[] = [];
  private floats: { sprite: THREE.Sprite; life: number }[] = [];
  private lamps: THREE.PointLight[] = [];
  private firstFrame = true;
  /** Đồ trang trí theo phong cách quán (đèn lồng đung đưa, quạt quay...). */
  private interior: InteriorAnimator;

  constructor(private game: Game) {
    const room = (this.room = roomOf(game.ctx));
    this.halfW = room.width / 2 / UNIT + 0.4;
    this.backZ = this.wz(0) - 0.7;
    this.frontZ = this.wz(room.height) + 0.4;
    this.kitchenZ = this.wz(room.kitchenDepth);
    this.kitchenX1 = -this.halfW + 4;
    this.door = [0, this.frontZ + 0.6];
    this.queueZ = this.wz(room.height - 32);
    const depth = this.frontZ - this.backZ;
    this.view = { position: [0, depth * 0.95, depth * 1.12], target: [0, 0.6, 0.3], orbit: 0.95 };
    this.rainBox = { min: [-22, 0, this.backZ - 13], max: [22, 14, this.backZ - 0.5] };

    this.label = game.content.cuisines.get(game.state.cuisine).name;
    this.buildRoom();
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
    this.interior = decorateInterior(game.state.cuisine, this.root, { halfW: this.halfW, backZ: this.backZ, frontZ: this.frontZ, kitchenZ: this.kitchenZ, kitchenX1: this.kitchenX1, wallH: WALL_H });

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
    for (let i = 1; i < planks; i += 2) {
      mesh(r, G.box(1, 0.02, 1), mats.floorB, { p: [-halfW + ((i + 0.5) * halfW * 2) / planks, 0.005, (frontZ + kitchenZ) / 2], s: [(halfW * 2) / planks, 1, frontZ - kitchenZ], cast: false });
    }
    const kx1 = this.kitchenX1;
    mesh(r, G.box(1, 0.03, 1), 0xefe6d6, { p: [(kx1 + halfW) / 2, 0.01, (kitchenZ + backZ) / 2], s: [halfW - kx1, 1, kitchenZ - backZ], cast: false });

    // Tường sau: chân tường + mảng tường chừa 2 ô cửa sổ
    const backSeg = (x1: number, x2: number, y1: number, y2: number, mat = mats.wall) =>
      mesh(r, G.box(1, 1, 0.3), mat, { p: [(x1 + x2) / 2, (y1 + y2) / 2, backZ - 0.15], s: [x2 - x1, y2 - y1, 1] });
    backSeg(-halfW, halfW, 0, 1.3, mats.trim);
    backSeg(-halfW, halfW, 3.3, WALL_H);
    // Chỉ còn cửa sổ bên phải (sau bếp); bên trái là lối đi có cửa WC và cửa kho
    const winX = halfW - 2;
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
    if (this.game.state.cuisine === 'vn') {
      const mx = this.kitchenCenter() - 0.6;
      mesh(r, G.box(2.3, 1.2, 0.05), mats.trim, { p: [mx, 2.75, backZ + 0.02] });
      mesh(r, G.box(2.1, 1, 0.08), 0x2f5d50, { p: [mx, 2.75, backZ + 0.05] });
      const menu = emojiSprite('📋', 0.7);
      menu.position.set(mx, 2.75, backZ + 0.2);
      r.add(menu);
    }

    // Chậu cây ở hai góc trong (góc ngoài để đồ trang trí theo quán), thảm chùi chân
    for (const [x, z] of [[-halfW + 0.7, kitchenZ + 0.8], [halfW - 0.7, kitchenZ + 0.8]]) {
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
    mesh(r, G.box(0.16, 2.2, kitchenZ - backZ), mats.wall, { p: [kitchenX1, 1.1, (backZ + kitchenZ) / 2] });
    mesh(r, G.box(0.2, 0.1, kitchenZ - backZ + 0.04), mats.trim, { p: [kitchenX1, 2.25, (backZ + kitchenZ) / 2] });
    const doors: [number, string, number, string][] = [
      [-halfW + 1.1, 'WC', 0x6fa8c9, '🚻'],
      [kitchenX1 - 1.15, 'KHO', 0xb9733f, '📦'],
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
    mesh(r, G.box(2.6, 0.03, 0.9), 0x6f8f6a, { p: [(-halfW + kitchenX1) / 2, 0.02, backZ + 0.8], cast: false }); // thảm lối đi
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
    return this.kitchenX1 + 3.1;
  }

  /** Gian bếp khởi đầu gọn nhẹ: 1 dãy bếp ngắn + tủ lạnh. Bếp to hơn là việc của các nâng cấp sau này. */
  private buildKitchen(): void {
    const r = this.root;
    const z = this.backZ + 0.55;
    // Gian bếp gọn: tủ lạnh sát vách ngăn, dãy bếp 3.4 m; bếp lên hạng thì thêm bàn sơ chế, nồi hầm, lò nướng bên phải
    const cx = this.kitchenCenter();
    const ktier = this.game.state.restaurant.kitchenTier;
    if (ktier >= 2) {
      const px = cx + 2.45;
      mesh(r, G.box(1.2, 0.95, 0.9), 0xb9c2ca, { p: [px, 0.475, z] });
      mesh(r, G.box(1.3, 0.08, 1), 0x5f6b77, { p: [px, 0.98, z] });
      mesh(r, G.box(0.6, 0.04, 0.4), 0xd9b38c, { p: [px - 0.2, 1.04, z + 0.05] }); // thớt
      for (const [dx, c] of [[-0.35, 0xe5463c], [-0.15, 0x7cc35c], [0.0, 0xf28c28]] as const) mesh(r, G.sphere(0.06, 8, 6), c, { p: [px + dx, 1.1, z + 0.12] });
      mesh(r, G.cyl(0.2, 0.18, 0.32, 12), 0xcfd6dc, { p: [px + 0.35, 1.18, z - 0.1] }); // nồi hầm
    }
    if (ktier >= 3) {
      const ox = cx + 2.45;
      mesh(r, G.box(1.2, 1.1, 0.7), 0x3b3f46, { p: [ox, 1.62, z - 0.05] }); // lò nướng trên bàn
      mesh(r, G.box(0.9, 0.55, 0.04), 0x8a5a35, { p: [ox, 1.62, z + 0.31] });
      mesh(r, G.box(0.9, 0.5, 0.02), new THREE.MeshBasicMaterial({ color: 0xff9a4a }), { p: [ox, 1.62, z + 0.34], cast: false });
      mesh(r, G.cyl(0.36, 0.3, 0.12), 0x3b3f46, { p: [cx - 0.4, 1.08, z] }); // chảo thứ hai
    }
    mesh(r, G.box(3.4, 0.95, 0.9), 0x9aa6b2, { p: [cx, 0.475, z] });
    mesh(r, G.box(3.6, 0.08, 1), 0x5f6b77, { p: [cx, 0.98, z] });
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
    const lo = this.kitchenCenter() - 1.6;
    const hi = this.kitchenCenter() + 1.6 + (ktier >= 2 ? 1.1 : 0);
    staff.forEach((def, i) => {
      const g = makePerson({ shirt: def.hire ? 0xf6f0e4 : 0xffffff, hair: i % 3 === 2 ? 0x6b4a2f : 0x3a2a1e, skin: i % 2 ? 0xffd9b8 : 0xf2c49b }, 'chef');
      g.position.set(staff.length === 1 ? this.kitchenCenter() : lo + ((i + 0.5) * (hi - lo)) / staff.length, 0, this.kitchenZ - 1.05);
      g.scale.setScalar(def.speed > 1 ? 1.15 : 1.05);
      this.root.add(g);
      const bar = new Bar3D(0.8);
      bar.group.position.set(0, 1.95, 0);
      g.add(bar.group);
      const icon = emojiSprite('🍳', 0.5);
      icon.position.set(0, 2.3, 0);
      g.add(icon);
      this.chefs.push({ g, icon, iconFor: '', bar, smoke: i * 0.2 });
    });
  }

  /** Quầy ra món: bếp nấu xong đặt đĩa ở đây, đèn giữ nóng phía trên, chuông báo khi có món chờ. */
  private buildPass(): void {
    const pass = this.room.pass;
    // Quầy line dài theo sức chứa của hạng bếp (6 đĩa = 1.7 m); dài thêm về phía trái, mép phải giữ nguyên
    this.passXY = passSlotsXY(passSlots(this.game.ctx));
    const w = 0.5 * (this.passXY.length / 2) + 0.2;
    const g = group(this.root, { p: [this.wx(pass.x) - (w - 1.7) / 2, 0, this.wz(pass.y)] });
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
    if (t.shared) {
      mesh(g, G.box(w, COUNTER_TOP - 0.08, d), mats.base, { p: [0, (COUNTER_TOP - 0.08) / 2, 0] });
      mesh(g, G.box(w + 0.2, 0.08, d + 0.25), mats.top, { p: [0, COUNTER_TOP - 0.04, 0] });
      counterExtras(this.game.state.cuisine, g, COUNTER_TOP, w, d);
    } else {
      mesh(g, G.box(w, 0.1, d), mats.top, { p: [0, TABLE_TOP - 0.05, 0] });
      mesh(g, G.box(w - 0.15, 0.06, d - 0.15), mats.base, { p: [0, TABLE_TOP - 0.13, 0] });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(g, G.cyl(0.06, 0.06, TABLE_TOP - 0.1, 8), mats.base, { p: [sx * (w / 2 - 0.15), (TABLE_TOP - 0.1) / 2, sz * (d / 2 - 0.15)] });
      tableExtras(this.game.state.cuisine, g, TABLE_TOP, w, d);
    }
    for (const s of seatSpots(t, { x: 0, y: 0 })) {
      const cx = s.x / UNIT;
      const cz = s.y / UNIT;
      const chair = group(g, { p: [cx, 0, cz], r: [0, Math.atan2(s.dishX / UNIT - cx, s.dishY / UNIT - cz), 0] });
      if (t.shared) {
        mesh(chair, G.cyl(0.05, 0.07, 0.72, 8), 0x5f6b77, { p: [0, 0.36, 0] });
        mesh(chair, G.cyl(0.26, 0.26, 0.08, 14), mats.seat, { p: [0, 0.74, 0] });
      } else {
        buildSeat(seatStyle(this.game.state.cuisine), chair, mats);
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
  private updateBubbles(fx: PartyFx, party: import('../../../sim/state').Party, env: Env): void {
    const { ctx, state, content } = this.game;
    const need = needOf(party);
    let main = '';
    if (party.phase === 'seated') main = '📖';
    else if (party.phase === 'browsing') main = '💭';
    else if (party.phase === 'readyToOrder') main = '😊';
    else if (party.phase === 'waitingFood') main = MOOD_FACES[moodOf(ctx, party)];
    // Món ruột của khách quen có tim đứng trước
    const waiting = party.phase === 'waitingFood' ? state.restaurant.orders.filter((o) => o.partyId === party.id && o.status !== 'served').flatMap((o) => (o.fav ? ['💖', content.recipes.get(o.recipeId).icon] : [content.recipes.get(o.recipeId).icon])) : [];
    const dishesKey = waiting.join('|');

    if (fx.mainKey !== main) {
      if (fx.main) fx.holder.remove(fx.main);
      fx.main = main ? bubbleSprite([main], 0.8) : null;
      if (fx.main) fx.holder.add(fx.main);
      fx.mainKey = main;
    }
    if (fx.dishesKey !== dishesKey) {
      if (fx.dishes) fx.holder.remove(fx.dishes);
      fx.dishes = waiting.length ? bubbleSprite(waiting, 0.62) : null;
      if (fx.dishes) fx.holder.add(fx.dishes);
      fx.dishesKey = dishesKey;
    }

    // Người chơi đang cầm món: bàn nào nhận được món đó thì bong bóng món nhún lên
    const carrying = env.serving != null ? state.restaurant.orders.find((o) => o.id === env.serving) : null;
    const wants = !!carrying && party.phase === 'waitingFood' && !!wantedOrder(ctx, party, carrying.recipeId);
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
        g.userData.born = env.t;
        this.passPlates.set(o.id, g);
      }
      const [x, z] = this.passXY[i];
      const picked = env.serving === o.id;
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
    if (!still) animatePerson(w.g, env.t, { walk: moving ? 1 : 0, carry: carrying.length > 0 });
  }

  private helperViews = new Map<string, { g: THREE.Group; hand: THREE.Group; handKey: string; lastX: number; lastZ: number; bar: Bar3D; status: THREE.Sprite; statusKey: string }>();

  /** Nhân viên thuê: áo theo người, mũ vàng, thanh năng lượng trên đầu; xỉu thì nằm lăn ra sàn 😵; đi ăn ở chợ thì vắng mặt. */
  private updateHelpers(env: Env, dt: number): void {
    const helpers = this.game.state.restaurant.helpers;
    const away = !!this.game.state.crew.restaurantAway;
    for (const [id, v] of this.helperViews) {
      if (helpers.some((h) => h.id === id)) continue;
      this.root.remove(v.g);
      this.helperViews.delete(id);
    }
    for (const h of helpers) {
      let v = this.helperViews.get(h.id);
      if (!v) {
        const shirts = [0x5fae57, 0xe2703a, 0x9a6bd1, 0x3fb6a8];
        const g = makePerson({ shirt: shirts[h.look % shirts.length], hair: [0x3a2a1e, 0x1f1a17, 0x6b3f22, 0x2a1f1a][h.look % 4], skin: h.look % 2 ? 0xf2c49b : 0xffd9b8 });
        const rig = g.userData.rig;
        mesh(rig.body, G.box(0.36, 0.34, 0.05), 0xffffff, { p: [0, 0.14, 0.18] }); // tạp dề
        mesh(rig.head, G.box(0.42, 0.06, 0.3), 0xf2b23e, { p: [0, 0.36, 0.06], r: [-0.2, 0, 0] }); // mũ vàng
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
        this.helperViews.set(h.id, (v = { g, hand, handKey: '', lastX: g.position.x, lastZ: g.position.z, bar, status, statusKey: '' }));
      }
      v.g.visible = !away;
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
    const snap = (v: number) => Math.round(v / LAYOUT_GRID) * LAYOUT_GRID;
    this.drag = { kind, id, x: snap(x * UNIT + room.width / 2), y: snap(z * UNIT + room.height / 2) };
  }

  /** Kết thúc kéo: trả về vị trí để app gửi lệnh 'layout/moveTable' (null nếu không kéo gì). */
  endDrag(): { kind: 'table' | 'prop'; id: string; x: number; y: number } | null {
    const d = this.drag;
    this.drag = null;
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
        const top = (table.shared ? COUNTER_TOP : TABLE_TOP) + 0.02;
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
  private updatePet(env: Env, dt: number): void {
    const { state, content } = this.game;
    const id = state.profile.pet;
    if (this.pet && this.pet.id !== id) {
      this.root.remove(this.pet.g);
      this.pet = null;
    }
    if (!id) return;
    const d = this.room.dining;
    if (!this.pet) {
      const g = makePet(id);
      const x = this.wx((d.x1 + d.x2) / 2);
      const z = this.wz(d.y2 - 40);
      g.position.set(x, 0, z);
      this.root.add(g);
      this.pet = { id, g, x, z, tx: x, tz: z, wait: 1, petting: 0 };
      void content;
    }
    const pet = this.pet;
    const dx = pet.tx - pet.x;
    const dz = pet.tz - pet.z;
    const dist = Math.hypot(dx, dz);
    const legs = pet.g.userData.legs as THREE.Object3D[];
    if (dist > 0.05) {
      const step = Math.min(dist, dt * 1.1);
      pet.x += (dx / dist) * step;
      pet.z += (dz / dist) * step;
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
  private updateNameSign(): void {
    const name = this.game.state.profile.name;
    if (this.nameSign?.text === name) return;
    if (this.nameSign) this.root.remove(this.nameSign.g);
    const g = group(this.root, { p: [-this.halfW + 4 + 3.1 - 0.6, 3.78, this.backZ + 0.04] });
    const w = Math.min(4.6, 1.2 + name.length * 0.2);
    mesh(g, G.box(w + 0.25, 0.7, 0.06), this.mats.trim);
    mesh(g, G.box(w, 0.56, 0.08), 0xfff4dc, { p: [0, 0, 0.01] });
    const text = signText(name, '#8a3a2a', w - 0.15, 0.48);
    text.position.z = 0.06;
    g.add(text);
    this.nameSign = { text: name, g };
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
    this.updatePet(env, dt);
    this.updateNameSign();
    this.updateDirty(env);
    this.updateStains(env);

    // Ánh sáng trong nhà
    for (const lamp of this.lamps) lamp.intensity = 0.25 + env.night * 1.5;
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
      chef.g.rotation.y = order ? Math.sin(env.t * 2 + i) * 0.15 : 0;
      // Đang nấu thì đảo chảo; rảnh thì thỉnh thoảng vẫy tay chào khách
      const idleWave = Math.max(0, Math.min(1, (Math.sin(env.t * 0.4 + i * 2.5) - 0.88) * 9));
      animatePerson(chef.g, env.t, { cook: order ? 1 : 0, wave: order ? 0 : idleWave });
      if (!order) return;
      // Khói bếp bốc lên từ chảo khi đang nấu
      if ((chef.smoke -= dt) <= 0) {
        chef.smoke = 0.35 + Math.random() * 0.2;
        this.fx.burst('☁️', new THREE.Vector3(chef.g.position.x + (Math.random() - 0.5) * 0.4, 1.5, this.backZ + 0.6), { count: 1, up: 0.5, spread: 0.12, gravity: -0.6, life: 1.5, size: 0.32 });
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
    for (const party of parties) {
      seenParties.add(party.id);
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
          const g = regular ? makeRegular(regular.style) : makePerson(LOOKS[party.looks[i] % LOOKS.length]);
          g.userData.pick = { type: 'party', id: String(party.id) } satisfies Pick;
          const [sx, sz] = this.firstFrame ? [tx, tz] : this.door;
          g.position.set(sx, 0, sz);
          this.root.add(g);
          this.actors.set(key, (actor = { g, tx, tz, face: 0, restY: 0, leaving: false, seated: false, eating: false }));
          if (regular) actor.regular = this.decorateRegular(g, regular.name, heartsOf(ctx, regular.id), env.t);
        }
        if (actor.regular) this.updateRegularTag(actor, env);
        actor.seated = !!spot;
        actor.eating = party.phase === 'eating';
        actor.tx = tx;
        actor.tz = tz;
        actor.face = spot ? Math.atan2(this.wx(spot.dishX) - tx, this.wz(spot.dishY) - tz) : Math.PI;
        actor.restY = spot ? (table!.shared ? 0.4 : 0.14) : 0;
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
      this.updateBubbles(fx, party, env);
      fx.holder.position.set(cx, 1.75, cz);
      const patience = party.patience / party.patienceMax;
      fx.bar.group.position.set(cx, 1.62, cz);
      fx.bar.group.visible =
        party.phase === 'queue' || ((party.phase === 'seated' || party.phase === 'readyToOrder') && !party.called) || (party.phase === 'waitingFood' && patience < 0.35);
      fx.bar.set(patience, true);

      // Đĩa thức ăn
      if (table && spots) {
        party.orderIds.forEach((id, i) => {
          const order = orders.find((o) => o.id === id);
          const spot = spots[party.seats[i]];
          if (!order || !spot) return;
          let dish = this.dishes.get(id);
          if (!dish) {
            const g = group(this.root, { p: [this.wx(spot.dishX), (table.shared ? COUNTER_TOP : TABLE_TOP) + 0.02, this.wz(spot.dishY)] });
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
          dish.g.position.set(this.wx(spot.dishX), (table.shared ? COUNTER_TOP : TABLE_TOP) + 0.02, this.wz(spot.dishY));
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
    const step = WALK_SPEED * dt * Math.max(1, speed);
    for (const [key, actor] of this.actors) {
      if (!seen.has(key)) actor.leaving = true;
      if (actor.leaving) [actor.tx, actor.tz] = this.door;
      const pos = actor.g.position;
      const dx = actor.tx - pos.x;
      const dz = actor.tz - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= step) {
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
        pos.x += (dx / dist) * step;
        pos.z += (dz / dist) * step;
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
