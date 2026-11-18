import * as THREE from 'three';
import type { TableDef } from '../../../data';
import type { Game } from '../../../sim/game';
import { canPlaceTable, LAYOUT_GRID, seatSpots, tablePos } from '../../../sim/layout';
import { activeTables, moodOf } from '../../../sim/systems/customers';
import { isReserved, needOf, wantedOrder } from '../../../sim/systems/service';
import { animatePerson, LOOKS, makeBush, makeDish, makePerson } from '../models';
import { buildSeat, counterExtras, decorateInterior, seatStyle, signText, tableExtras, type InteriorAnimator } from '../cuisine';
import type { Area, Env, Pick } from '../stage';
import { Bar3D, bubbleSprite, emojiSprite, G, group, mesh, textSprite, toon } from '../toon';
import { easeOutBack, wobble } from '../../ease';
import { Particles } from '../fx';

/**
 * KHU QUÁN — nội thất quán ăn tông ấm, nhìn kiểu "cắt mái".
 *  - Kích thước phòng lấy từ content.room, bàn từ TableDef + state.restaurant.layout (toạ độ 2D),
 *    quy đổi sang mét bằng wx()/wz(). Nới rộng quán chỉ cần sửa data.
 *  - Màu sàn, tường, bàn ghế lấy từ nội thất đang dùng (state.decor.equipped).
 *  - Chế độ sắp xếp: kéo bàn (Pick {type:'table'}) -> dragTable()/endDrag().
 *  - Phục vụ: bồi bàn (người chơi) vẽ theo state.restaurant.waiter; bong bóng chat trên đầu khách (Pick {type:'party'})
 *    báo việc cần làm; quầy ra món (Pick {type:'pass'}) bày các món bếp đã nấu xong.
 */

/** Mặt theo tâm trạng khi chờ món: vui vẻ, bình thường, chán nản, tức giận. */
const MOOD_FACES = ['😄', '🙂', '😒', '😠'];
/** Chỗ đặt đĩa trên quầy ra món (mét, so với tâm quầy). */
const PASS_SLOTS: [number, number][] = [
  [-0.5, -0.12],
  [0, -0.12],
  [0.5, -0.12],
  [-0.5, 0.2],
  [0, 0.2],
  [0.5, 0.2],
];
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
  private passBell!: THREE.Sprite;
  private waiter!: { g: THREE.Group; ring: THREE.Mesh; hand: THREE.Group; handKey: string; lastX: number; lastZ: number };
  /** smoke: giây còn lại tới lần phả khói bếp kế tiếp. */
  private chefs: { g: THREE.Group; icon: THREE.Sprite; iconFor: string; bar: Bar3D; smoke: number }[] = [];
  private fx = new Particles(this.root);
  private tables = new Map<string, TableView>();
  private drag: { id: string; x: number; y: number } | null = null;
  private floats: { sprite: THREE.Sprite; life: number }[] = [];
  private lamps: THREE.PointLight[] = [];
  private firstFrame = true;
  /** Đồ trang trí theo phong cách quán (đèn lồng đung đưa, quạt quay...). */
  private interior: InteriorAnimator;

  constructor(private game: Game) {
    const room = game.content.room;
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
    this.buildKitchen();
    this.interior = decorateInterior(game.state.cuisine, this.root, { halfW: this.halfW, backZ: this.backZ, frontZ: this.frontZ, kitchenZ: this.kitchenZ, kitchenX1: this.kitchenX1, wallH: WALL_H });

    game.bus.on('party/left', (e) => {
      let anchor: THREE.Vector3 | null = null;
      const table = e.tableId ? game.content.tables.get(e.tableId) : null;
      if (table) {
        const at = tablePos(game.ctx, table);
        anchor = new THREE.Vector3(this.wx(at.x), 0, this.wz(at.y));
      }
      for (const [key, actor] of this.actors) {
        if (!key.startsWith(`${e.partyId}:`)) continue;
        actor.leaving = true;
        anchor ??= actor.g.position.clone();
        if (e.reason !== 'paid') {
          const angry = emojiSprite('💢', 0.45);
          angry.position.set(0, 1.55, 0);
          actor.g.add(angry);
        }
      }
      if (!anchor) return;
      // Khách vui: tim bay lên (có tip thì nhiều tim hơn)
      if (e.reason === 'paid') this.fx.burst(e.tip > 0 ? '💖' : '😊', anchor.clone().setY(1.7), { count: e.tip > 0 ? 4 : 1, up: 1.6, spread: 0.7, gravity: 0.6, life: 1.3, size: 0.4, stagger: 0.08 });
      if (e.reason === 'paid') this.onPaid(this.root.localToWorld(anchor.clone().setY(1.2)), e.total + e.tip);
      const sprite = e.reason === 'paid' ? textSprite(`+${e.total + e.tip}`, '#2f8f3a') : emojiSprite('💢', 0.8);
      sprite.position.set(anchor.x, 2, anchor.z);
      this.root.add(sprite);
      this.floats.push({ sprite, life: 1.8 });
    });
  }

  private wx(px: number): number {
    return (px - this.game.content.room.width / 2) / UNIT;
  }

  private wz(py: number): number {
    return (py - this.game.content.room.height / 2) / UNIT;
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
    const sideLen = Math.min(6.5, depth * 0.6);
    for (const side of [-1, 1]) {
      const x = side * (halfW + 0.15);
      const z0 = backZ - 0.3;
      const seg = (za: number, zb: number, y1: number, y2: number, mat = mats.wall) =>
        mesh(r, G.box(0.3, 1, 1), mat, { p: [x, (y1 + y2) / 2, (za + zb) / 2], s: [1, y2 - y1, zb - za] });
      seg(z0, z0 + sideLen, 0, 1.3, mats.trim);
      seg(z0, z0 + sideLen, 3.3, WALL_H);
      seg(z0, z0 + sideLen / 2 - 1.2, 1.3, 3.3);
      seg(z0 + sideLen / 2 + 1.2, z0 + sideLen, 1.3, 3.3);
      this.buildWindow(x, 2.3, z0 + sideLen / 2, Math.PI / 2);
    }

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
    // Gian bếp gọn: tủ lạnh sát vách ngăn, dãy bếp 3.4 m
    const cx = this.kitchenCenter();
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

    // Đầu bếp đứng sau quầy, quay mặt ra phòng ăn
    const staff = this.game.content.staff.all();
    staff.forEach((def, i) => {
      const g = makePerson({ shirt: 0xffffff, hair: 0x3a2a1e, skin: i % 2 ? 0xffd9b8 : 0xf2c49b }, 'chef');
      g.position.set(this.kitchenCenter() + (i - (staff.length - 1) / 2) * 2, 0, this.kitchenZ - 1.05);
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
    const pass = this.game.content.room.pass;
    const g = group(this.root, { p: [this.wx(pass.x), 0, this.wz(pass.y)] });
    g.userData.pick = { type: 'pass', id: 'pass' } satisfies Pick;
    mesh(g, G.box(1.7, PASS_TOP - 0.06, 0.8), 0x9aa6b2, { p: [0, (PASS_TOP - 0.06) / 2, 0] });
    mesh(g, G.box(1.85, 0.06, 0.95), 0xdfe5ea, { p: [0, PASS_TOP - 0.03, 0] });
    mesh(g, G.box(1.7, 0.08, 0.04), 0xe2703a, { p: [0, PASS_TOP - 0.25, 0.41] }); // viền cam phía trước
    // Đèn giữ nóng
    for (const side of [-1, 1]) mesh(g, G.cyl(0.03, 0.03, 0.9, 6), 0x5f6b77, { p: [side * 0.82, PASS_TOP + 0.45, -0.3] });
    mesh(g, G.box(1.75, 0.08, 0.22), 0x5f6b77, { p: [0, PASS_TOP + 0.9, -0.2] });
    mesh(g, G.box(1.6, 0.03, 0.16), this.bulbMat, { p: [0, PASS_TOP + 0.85, -0.2], cast: false });
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
  private setWaiterHand(key: string, recipeId: string | null): void {
    const w = this.waiter;
    if (w.handKey === key) return;
    w.handKey = key;
    w.hand.clear();
    if (!key) return;
    if (recipeId) {
      mesh(w.hand, G.cyl(0.2, 0.14, 0.04, 14), 0xffffff);
      const food = makeDish(recipeId);
      if (food) {
        food.position.y = 0.02;
        w.hand.add(food);
      } else {
        const icon = emojiSprite(this.game.content.recipes.get(recipeId).icon, 0.4);
        icon.position.y = 0.22;
        w.hand.add(icon);
      }
    } else {
      const icon = emojiSprite(key === 'menu' ? '📖' : '📝', 0.42);
      icon.position.y = 0.1;
      w.hand.add(icon);
    }
  }

  /** Dựng một bàn + ghế trong group riêng (gốc ở tâm bàn) để dời được cả cụm. */
  private buildTable(t: TableDef): TableView {
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
    const waiting = party.phase === 'waitingFood' ? state.restaurant.orders.filter((o) => o.partyId === party.id && o.status !== 'served').map((o) => content.recipes.get(o.recipeId).icon) : [];
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
    ready.slice(0, PASS_SLOTS.length).forEach((o, i) => {
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
      const [x, z] = PASS_SLOTS[i];
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
    const { state } = this.game;
    const sim = state.restaurant.waiter;
    const w = this.waiter;
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

    const carrying = sim.carrying != null ? state.restaurant.orders.find((o) => o.id === sim.carrying) : null;
    const task = sim.tasks[0];
    if (carrying) this.setWaiterHand(`dish:${carrying.id}`, carrying.recipeId);
    else if (task?.kind === 'menu') this.setWaiterHand('menu', null);
    else if (task?.kind === 'takeOrder') this.setWaiterHand('note', null);
    else this.setWaiterHand('', null);
    animatePerson(w.g, env.t, { walk: moving ? 1 : 0, carry: !!carrying });
    (w.ring.material as THREE.MeshBasicMaterial).opacity = 1;
    w.ring.scale.setScalar(1 + Math.sin(env.t * 4) * 0.06);
  }

  // ---------- Sắp xếp bàn ----------

  /** Đang kéo bàn `id` tới điểm (x, z) trên sàn: cập nhật vị trí xem trước. */
  dragTable(id: string, x: number, z: number): void {
    const room = this.game.content.room;
    const snap = (v: number) => Math.round(v / LAYOUT_GRID) * LAYOUT_GRID;
    this.drag = { id, x: snap(x * UNIT + room.width / 2), y: snap(z * UNIT + room.height / 2) };
  }

  /** Kết thúc kéo: trả về vị trí để app gửi lệnh 'layout/moveTable' (null nếu không kéo gì). */
  endDrag(): { tableId: string; x: number; y: number } | null {
    const d = this.drag;
    this.drag = null;
    return d && { tableId: d.id, x: d.x, y: d.y };
  }

  // ---------- Đồng bộ với state mỗi khung hình ----------

  update(env: Env, dt: number, speed: number): void {
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
    for (const t of activeTables(ctx)) {
      let view = this.tables.get(t.id);
      if (!view) this.tables.set(t.id, (view = this.buildTable(t)));
      const dragging = this.drag?.id === t.id;
      const at = dragging ? this.drag! : tablePos(ctx, t);
      view.g.position.set(this.wx(at.x), dragging ? 0.25 : 0, this.wz(at.y));
      view.pad.visible = dragging;
      if (dragging) this.padMat.color.setHex(canPlaceTable(ctx, t.id, at.x, at.y) ? 0xe2574c : 0x5fd068);
      view.hand.visible = env.editLayout && !t.fixed && !dragging;
      view.hand.position.y = 1.75 + Math.sin(env.t * 3 + view.g.position.x) * 0.08;
    }

    // Ánh sáng trong nhà
    for (const lamp of this.lamps) lamp.intensity = 0.25 + env.night * 1.5;
    this.bulbMat.emissiveIntensity = 0.3 + env.night * 1.4;
    this.windowMat.opacity = 0.18 + env.day * 0.15;

    // Đầu bếp
    staff.forEach((s, i) => {
      const chef = this.chefs[i];
      if (!chef) return;
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
      const table = party.tableId ? content.tables.get(party.tableId) : null;
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
          const g = makePerson(LOOKS[party.looks[i] % LOOKS.length]);
          g.userData.pick = { type: 'party', id: String(party.id) } satisfies Pick;
          const [sx, sz] = this.firstFrame ? [tx, tz] : this.door;
          g.position.set(sx, 0, sz);
          this.root.add(g);
          this.actors.set(key, (actor = { g, tx, tz, face: 0, restY: 0, leaving: false, seated: false, eating: false }));
        }
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
