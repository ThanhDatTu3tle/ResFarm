import * as THREE from 'three';
import type { StallDef } from '../../../data';
import type { Game } from '../../../sim/game';
import { priceOf } from '../../../sim/systems/market';
import { signText } from '../cuisine';
import { animatePerson, LOOKS, makePerson } from '../models';
import type { Area, Env, Pick } from '../stage';
import { emojiSprite, G, group, mesh, type V3 } from '../toon';

/**
 * KHU BÊN TRONG QUẦY CHỢ (bấm sạp ở chợ thì camera "đi vào" đây, giống nhà kính ở nông trại).
 *  - Sạp nguyên liệu: quầy gỗ bày các khay hàng, mỗi khay một nguyên liệu với biển giá hôm nay; bấm khay → Pick 'goods'
 *    (app.ts mở bảng mua nhỏ). Người bán đứng sau quầy.
 *  - Tiệm 25caaaaa: phòng hồng, quầy pha chế có biển logo, bảng menu treo tường (bấm → Pick 'menuboard', mở bảng gọi món
 *    cho cả đội), bàn ghế nhỏ — người trong đội gọi món ở tiệm thì ngồi ăn ở đây.
 * Dựng lại khi đổi sạp (show) hoặc sang ngày mới (giá đổi).
 */

/** Màu quầy theo thứ tự sạp (khớp màu mái bạt ngoài chợ). */
const STALL_COLORS = [0xe2574c, 0x5fae57, 0x4a9bd8, 0xf2a23a, 0x9a6bd1];

/** Biển logo Tiệm 25caaaaa (ảnh trong public/shop, đã cắt bỏ số điện thoại). Tải một lần, dùng chung cho cả chợ và trong tiệm. */
let logoTex: THREE.Texture | null = null;
export function snackLogo(): THREE.Texture {
  if (!logoTex) {
    logoTex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}shop/tiem-25caaaaa.jpg`);
    logoTex.colorSpace = THREE.SRGBColorSpace;
  }
  return logoTex;
}

/** Tấm biển logo (khung gỗ hồng + ảnh), rộng w mét. */
export function logoBoard(parent: THREE.Object3D, p: V3, w: number): THREE.Group {
  const g = group(parent, { p });
  const h = w * (293 / 320);
  mesh(g, G.box(w + 0.16, h + 0.16, 0.08), 0xf28fb0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: snackLogo(), toneMapped: false }));
  face.position.z = 0.045;
  g.add(face);
  return g;
}

export class StallArea implements Area {
  id = 'stall';
  label = 'Trong quầy';
  icon = '🧺';
  root = new THREE.Group();
  view: Area['view'] = { position: [0, 6.6, 7.6], target: [0, 1.1, -1], orbit: 0.45 };
  rainBox = { min: [-20, 0, 8] as V3, max: [20, 12, 14] as V3 };

  private content = group(this.root);
  private stallId: string | null = null;
  private day = -1;
  private vendor: THREE.Group | null = null;
  private eaters = new Map<string, THREE.Group>();
  private bobbers: { obj: THREE.Object3D; y: number; phase: number }[] = [];
  private seats: V3[] = [];

  constructor(private game: Game) {
    mesh(this.root, G.box(40, 0.4, 40), 0x8fd16a, { p: [0, -0.25, 0], cast: false });
  }

  get current(): string | null {
    return this.stallId;
  }

  /** Vào quầy `stallId`: dựng lại bên trong. */
  show(stallId: string): void {
    this.stallId = stallId;
    this.build();
  }

  private build(): void {
    this.content.clear();
    this.eaters.clear();
    this.bobbers = [];
    this.seats = [];
    this.vendor = null;
    this.day = this.game.state.clock.day;
    const { content } = this.game;
    if (!this.stallId || !content.stalls.has(this.stallId)) return;
    const def = content.stalls.get(this.stallId);
    const index = content.stalls.all().indexOf(def);
    this.view = def.kind === 'kiosk' ? { position: [0, 4.6, 7.4], target: [0, 1.5, -2.4], orbit: 0.45 } : { position: [0, 6.6, 7.6], target: [0, 1.1, -1], orbit: 0.45 };
    if (def.kind === 'kiosk') this.buildKiosk(def);
    else this.buildStall(def, STALL_COLORS[index % STALL_COLORS.length], index);
  }

  /** Sạp nguyên liệu: sàn gạch, mái bạt sọc, kệ thùng phía sau, quầy gỗ bày khay hàng có biển giá. */
  private buildStall(def: StallDef, color: number, index: number): void {
    const { game } = this;
    const g = this.content;
    mesh(g, G.box(12, 0.1, 9), 0xe8dcc4, { p: [0, 0, -1], receive: true });
    for (let i = -5; i <= 5; i++) mesh(g, G.box(0.03, 0.11, 9), 0xd6c7aa, { p: [i, 0.01, -1], cast: false });
    // Vách sau + hai bên (vải bạt) và mái sọc
    mesh(g, G.box(10, 3.6, 0.15), 0xf6efe0, { p: [0, 1.8, -4.2] });
    for (const sx of [-1, 1]) mesh(g, G.box(0.15, 3.6, 4.4), 0xf6efe0, { p: [sx * 5, 1.8, -2.1] });
    for (let i = 0; i < 10; i++) mesh(g, G.box(1, 0.08, 4.8), i % 2 ? color : 0xffffff, { p: [-4.5 + i, 3.7, -2], r: [0.12, 0, 0], cast: false });
    for (const sx of [-4.85, 4.85]) mesh(g, G.cyl(0.08, 0.08, 3.7, 8), 0x8a5a35, { p: [sx, 1.85, 0.3] });
    // Kệ thùng gỗ sau lưng người bán
    for (let row = 0; row < 2; row++) {
      mesh(g, G.box(8, 0.08, 0.7), 0x8a5a35, { p: [0, 0.9 + row * 0.9, -3.7] });
      for (let i = 0; i < 6; i++) mesh(g, G.box(1, 0.5, 0.5), 0xc98b4f, { p: [-3.4 + i * 1.36, 1.2 + row * 0.9, -3.7] });
    }
    const name = signText(def.name, '#3b2a1e', 5.4, 0.7);
    name.position.set(0, 3.15, -4.1);
    g.add(name);
    // Người bán sau quầy
    const vendor = makePerson(LOOKS[(index * 3 + 5) % LOOKS.length], index % 2 ? 'none' : 'straw');
    vendor.position.set(0, 0.3, -2.6);
    vendor.scale.setScalar(1.25);
    g.add(vendor);
    this.vendor = vendor;
    // Quầy gỗ + khay hàng: mỗi nguyên liệu một khay, xếp lưới (tối đa 5 cột)
    const items = def.items;
    const cols = Math.min(5, items.length);
    const rows = Math.ceil(items.length / cols);
    const tw = 1.35;
    const td = 1.0;
    const depth = rows * (td + 0.5) + 0.3;
    mesh(g, G.box(cols * (tw + 0.2) + 0.5, 0.9, depth), 0xb07a45, { p: [0, 0.45, -0.6 + depth / 2 - 0.9] });
    mesh(g, G.box(cols * (tw + 0.2) + 0.7, 0.08, depth + 0.2), 0x8a5a35, { p: [0, 0.93, -0.6 + depth / 2 - 0.9] });
    items.forEach((id, i) => {
      const item = game.content.items.get(id);
      const c = i % cols;
      const r = Math.floor(i / cols);
      const rowCount = r === rows - 1 ? items.length - r * cols : cols;
      const x = (c - (rowCount - 1) / 2) * (tw + 0.2);
      const z = -1.2 + r * (td + 0.5);
      // Hàng khay phía sau đặt trên bậc cao hơn (như kệ bậc thang) để không bị hàng trước che
      const lift = (rows - 1 - r) * 0.45;
      if (lift > 0) mesh(g, G.box(tw + 0.1, lift, td + 0.1), 0x9a6a3e, { p: [x, 0.97 + lift / 2, z] });
      const tray = group(g, { p: [x, 0.97 + lift, z] });
      tray.userData.pick = { type: 'goods', id } satisfies Pick;
      mesh(tray, G.box(tw, 0.1, td), 0x6b4a2f);
      mesh(tray, G.box(tw - 0.12, 0.06, td - 0.12), 0xf3e6c8, { p: [0, 0.04, 0] });
      // Đống hàng: vài biểu tượng chồng lên nhau
      for (let k = 0; k < 5; k++) {
        const s = emojiSprite(item.icon, 0.42);
        const y = 0.28 + (k > 2 ? 0.18 : 0);
        s.position.set(((k % 3) - 1) * 0.34, y, k > 2 ? -0.05 : 0.12 - (k % 2) * 0.12);
        tray.add(s);
        if (k === 4) this.bobbers.push({ obj: s, y, phase: i * 1.3 });
      }
      // Biển giá cắm trước khay
      const price = priceOf(game.ctx, def.id, id);
      const factor = game.state.market.priceFactor[id] ?? 1;
      const tagColor = factor > 1.08 ? '#c0392b' : factor < 0.92 ? '#2f8f3a' : '#3b2a1e';
      const tag = group(tray, { p: [0, 0.32, td / 2 + 0.02], r: [-0.35, 0, 0] });
      mesh(tag, G.box(1.18, 0.4, 0.03), 0xffffff);
      const label = signText(`${item.name} · ${price} xu`, tagColor, 1.1, 0.34);
      label.position.z = 0.02;
      tag.add(label);
      mesh(tray, G.cyl(0.015, 0.015, 0.3, 4), 0x6b4a2f, { p: [0, 0.15, td / 2 + 0.02], cast: false });
    });
  }

  /** Tiệm 25caaaaa: phòng hồng, quầy pha chế có biển logo, bảng menu, bàn ghế cho cả đội ngồi ăn. */
  private buildKiosk(def: StallDef): void {
    const g = this.content;
    mesh(g, G.box(11, 0.1, 9), 0xe9a3b8, { p: [0, 0, -1], receive: true });
    for (let i = 0; i < 11; i++) for (let j = 0; j < 9; j++) if ((i + j) % 2) mesh(g, G.box(1, 0.11, 1), 0xd9849f, { p: [-5 + i, 0.001, -5 + j], cast: false });
    mesh(g, G.box(11, 3.8, 0.15), 0xf4a7bd, { p: [0, 1.9, -5.4] });
    for (const sx of [-1, 1]) mesh(g, G.box(0.15, 3.8, 5), 0xf4a7bd, { p: [sx * 5.5, 1.9, -2.9] });
    // Sọc tường như logo
    for (let i = 0; i < 11; i++) mesh(g, G.box(0.45, 3.8, 0.02), 0xf8c6d4, { p: [-5 + i, 1.9, -5.32], cast: false });
    // Quầy pha chế + máy, ly matcha, logo phía trên
    mesh(g, G.box(5.2, 1.0, 1.0), 0xffffff, { p: [1.2, 0.5, -3.9] });
    mesh(g, G.box(5.4, 0.08, 1.15), 0xf28fb0, { p: [1.2, 1.04, -3.9] });
    for (let i = 0; i < 5; i++) {
      mesh(g, G.cyl(0.11, 0.09, 0.32, 10), 0xffffff, { p: [-0.6 + i * 0.6, 1.24, -3.6] });
      mesh(g, G.cyl(0.1, 0.08, 0.2, 10), i % 2 ? 0x7fb35a : 0xd9b38c, { p: [-0.6 + i * 0.6, 1.2, -3.6] });
    }
    mesh(g, G.box(0.7, 0.8, 0.5), 0x9aa6b2, { p: [3.1, 1.48, -4.1] }); // máy xay
    logoBoard(g, [1.2, 2.55, -5.25], 1.9);
    const staff = makePerson({ shirt: 0xe2574c, hair: 0x3a2a1e, skin: 0xffe1c7 });
    staff.position.set(1.2, 0, -4.7);
    staff.scale.setScalar(1.2);
    g.add(staff);
    this.vendor = staff;
    // Bảng menu treo tường trái: bấm để gọi món cho cả đội
    const board = group(g, { p: [-3.3, 1.75, -5.25] });
    board.userData.pick = { type: 'menuboard', id: def.id } satisfies Pick;
    mesh(board, G.box(2.6, 2.3, 0.1), 0x3b3f4a);
    mesh(board, G.box(2.4, 2.1, 0.05), 0x2f4f3f, { p: [0, 0, 0.05] });
    const title = signText('MENU', '#ffe08a', 1.6, 0.36);
    title.position.set(0, 0.8, 0.09);
    board.add(title);
    (def.menu ?? []).forEach((d, i) => {
      const line = signText(`${d.name}  ${d.price} xu`, '#ffffff', 2.1, 0.3);
      line.position.set(0.12, 0.38 - i * 0.38, 0.09);
      board.add(line);
      const icon = emojiSprite(d.icon, 0.3);
      icon.position.set(-1.0, 0.38 - i * 0.38, 0.12);
      board.add(icon);
    });
    const hint = emojiSprite('👆', 0.45);
    hint.position.set(1.15, -0.85, 0.2);
    board.add(hint);
    this.bobbers.push({ obj: hint, y: -0.85, phase: 0 });
    // Bàn tròn + ghế đẩu: chỗ ngồi cho người trong đội
    for (const [tx, tz] of [[-2.6, -1.2], [0.4, -0.6], [3.2, -1.4], [-1.2, 1.4], [2.0, 1.6]] as const) {
      mesh(g, G.cyl(0.55, 0.55, 0.06, 18), 0xffffff, { p: [tx, 0.8, tz] });
      mesh(g, G.cyl(0.06, 0.1, 0.78, 8), 0xf28fb0, { p: [tx, 0.4, tz] });
      for (const a of [0, Math.PI]) {
        const sx = tx + Math.sin(a) * 0.85;
        const sz = tz + Math.cos(a) * 0.85;
        mesh(g, G.cyl(0.22, 0.2, 0.45, 12), 0xf6c94c, { p: [sx, 0.22, sz] });
        this.seats.push([sx, 0.45, sz]);
      }
    }
  }

  /** Người trong đội đang ăn ở tiệm (crew.meals): ngồi ghế đẩu, quay vào bàn, món ăn hiện trên đầu. */
  private updateEaters(env: Env): void {
    const meals = this.stallId ? this.game.state.crew.meals.filter((l) => l.stallId === this.stallId) : [];
    for (const [who, g] of this.eaters) {
      if (meals.some((l) => l.who === who)) continue;
      this.content.remove(g);
      this.eaters.delete(who);
    }
    if (!this.seats.length) return;
    meals.forEach((l, i) => {
      let g = this.eaters.get(l.who);
      if (!g) {
        const seat = this.seats[i % this.seats.length];
        g = group(this.content, { p: seat });
        const p = crewLook(this.game, l.who);
        // Ghế hai phía bàn: quay mặt vào giữa bàn
        p.rotation.y = i % 2 ? 0 : Math.PI;
        g.add(p);
        g.userData.person = p;
        const dish = emojiSprite(l.icon, 0.45);
        dish.position.set(0, 2.0, 0);
        g.add(dish);
        this.eaters.set(l.who, g);
      }
      animatePerson(g.userData.person, env.t, { sit: true, eat: true });
    });
  }

  update(env: Env): void {
    if (this.stallId && this.game.state.clock.day !== this.day) this.build(); // giá đổi theo ngày
    if (this.vendor) animatePerson(this.vendor, env.t, { wave: Math.max(0, Math.min(1, (Math.sin(env.t * 0.5) - 0.8) * 6)) });
    for (const b of this.bobbers) b.obj.position.y = b.y + Math.abs(Math.sin(env.t * 2.4 + b.phase)) * 0.05;
    this.updateEaters(env);
  }
}

/** Model người trong đội theo vai (đầu bếp mũ trắng, bồi bàn mũ đỏ, nhân viên thuê mũ vàng, bác nông dân nón lá). */
export function crewLook(game: Game, who: string): THREE.Group {
  const { state, content } = game;
  if (who === 'farmer') return makePerson(LOOKS[2], 'straw');
  if (content.staff.has(who)) {
    const i = content.staff.all().findIndex((s) => s.id === who);
    return makePerson({ shirt: 0xffffff, hair: 0x3a2a1e, skin: i % 2 ? 0xffd9b8 : 0xf2c49b }, 'chef');
  }
  const h = state.restaurant.helpers.find((x) => x.id === who);
  const p = makePerson(h ? { shirt: [0x5fae57, 0xe2703a, 0x9a6bd1, 0x3fb6a8][h.look % 4], hair: 0x3a2a1e, skin: 0xffd9b8 } : { shirt: 0x3f8fd2, hair: 0x2a1f1a, skin: 0xffd9b8 });
  mesh(p.userData.rig.head, G.box(0.42, 0.06, 0.3), h ? 0xf2b23e : 0xe2574c, { p: [0, 0.36, 0.06], r: [-0.2, 0, 0] }); // mũ lưỡi trai
  return p;
}
