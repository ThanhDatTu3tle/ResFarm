import * as THREE from 'three';
import type { StallDef } from '../../../data';
import type { Game } from '../../../sim/game';
import { priceOf } from '../../../sim/systems/market';
import { signText } from '../cuisine';
import { adultShape, animatePerson, FARMER_SHAPE, LOOKS, makePerson, randomShape } from '../models';
import type { Area, Env, Pick } from '../stage';
import { OwnerWalker } from '../owner';
import { blinkLeds, emojiSprite, G, group, ledFrame, mesh, paintSeason, type V3 } from '../toon';

/**
 * KHU BÊN TRONG QUẦY CHỢ (bấm sạp ở chợ thì camera "đi vào" đây, giống nhà kính ở nông trại).
 *  - Sạp hải sản (`StallDef.interior: 'tanks'`): bể nước xếp chữ U, hải sản bơi trong bể (bấm bể → mua); giữa sạp người bán + cân;
 *    ốc, sò (`StallDef.baskets`) bày trong rổ quanh người bán và cái cân (bấm rổ → mua); xô nước.
 *  - Sạp thịt (`'butcher'`): bàn inox dài; nửa trái có giá treo các tảng thịt (bấm tảng thịt → mua), nửa phải thớt to + cân thịt.
 *  - Sạp nguyên liệu: quầy gỗ bày các khay hàng, mỗi khay một nguyên liệu với biển giá hôm nay; bấm khay → Pick 'goods'
 *    (app.ts mở bảng mua nhỏ). Người bán đứng sau quầy.
 *  - Tiệm 25caaaaa: phòng hồng, quầy pha chế có biển logo, bảng menu (bảng chân đứng gần cửa; bấm → Pick 'menuboard', mở bảng gọi món
 *    cho cả đội), bàn ghế nhỏ — người trong đội gọi món ở tiệm thì ngồi ăn ở đây.
 * Dựng lại khi đổi sạp (show) hoặc sang ngày mới (giá đổi).
 */

/** Nước trong bể / xô (trong suốt, không ghi độ sâu để hải sản bên trong vẫn hiện). */
const WATER = new THREE.MeshBasicMaterial({ color: 0x7fd3f0, transparent: true, opacity: 0.32, depthWrite: false });
const WATER_TOP = new THREE.MeshBasicMaterial({ color: 0x5fb8e0 });

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

/** Số khay tối đa trên quầy trước (2 hàng × 5): nhiều hơn thì bày lên kệ sau, quầy không cao quá che người bán. */
const FRONT_MAX = 10;

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
  /** Hải sản bơi trong bể (sạp kiểu 'tanks'): bơi qua lại theo trục x của bể, quay đầu khi đổi hướng. */
  private swimmers: { obj: THREE.Sprite; x: number; y: number; range: number; speed: number; phase: number; size: number }[] = [];
  /** Bọt khí trong bể: nổi lên rồi quay lại đáy. */
  private bubbles: { obj: THREE.Object3D; y0: number; h: number; phase: number }[] = [];
  /** Ghế đẩu trong tiệm: vị trí ghế + tâm bàn (để đặt đĩa món lên mặt bàn trước mặt người ngồi). */
  private seats: { p: V3; table: [number, number] }[] = [];
  /** Khách mua hàng đứng trước sạp (2-3 người): đứng ngó hàng, thỉnh thoảng cúi chọn; một người đi dạo qua lại. */
  private shoppers: { obj: THREE.Group; x: number; z: number; range: number; speed: number; phase: number; face: number }[] = [];
  /** Bóng LED nhấp nháy quanh tên sạp (sạp hải sản). */
  private leds: THREE.MeshBasicMaterial[] = [];
  /** Ông / bà chủ: bước vào sạp rồi đứng chọn hàng (chỗ đứng đầu tiên của addShoppers). */
  private owner: OwnerWalker | null = null;
  /** Đèn trong quầy / tiệm: sáng dần khi trời tối. */
  private lamps: { light: THREE.PointLight; bulb: THREE.MeshBasicMaterial }[] = [];

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
    this.swimmers = [];
    this.bubbles = [];
    this.seats = [];
    this.lamps = [];
    this.shoppers = [];
    this.owner = null;
    this.leds = [];
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

  /** Sạp nguyên liệu: sàn gạch, mái bạt sọc, kệ thùng phía sau, quầy gỗ bày khay hàng có biển giá (sạp 'tanks': bể nước, xem buildTanks). */
  private buildStall(def: StallDef, color: number, index: number): void {
    const { game } = this;
    const g = this.content;
    const tanks = def.interior === 'tanks';
    mesh(g, G.box(12, 0.1, 9), 0xe8dcc4, { p: [0, 0, -1], receive: true });
    for (let i = -5; i <= 5; i++) mesh(g, G.box(0.03, 0.11, 9), 0xd6c7aa, { p: [i, 0.01, -1], cast: false });
    // Vách sau + hai bên (vải bạt) và mái sọc
    // Mái nâng cao (5 m) để từ góc nhìn mặc định thấy trọn bảng hiệu trên vách sau
    mesh(g, G.box(10, 4.9, 0.15), 0xf6efe0, { p: [0, 2.45, -4.2] });
    for (const sx of [-1, 1]) mesh(g, G.box(0.15, 4.9, 4.4), 0xf6efe0, { p: [sx * 5, 2.45, -2.1] });
    for (let i = 0; i < 10; i++) mesh(g, G.box(1, 0.08, 4.8), i % 2 ? color : 0xffffff, { p: [-4.5 + i, 5.0, -2], r: [0.12, 0, 0], cast: false });
    for (const sx of [-4.85, 4.85]) mesh(g, G.cyl(0.08, 0.08, 5.0, 8), 0x8a5a35, { p: [sx, 2.5, 0.3] });
    this.addLamps([[-2.6, 4.2, -1.8], [2.6, 4.2, -1.8]], 4.9);
    // Kệ thùng gỗ sau lưng người bán (sạp bể cá: vách sau dành cho bể). Quầy trước chỉ 2 tầng khay (`FRONT_MAX` món)
    // để không che người bán; hàng còn lại bày trên tầng trên của kệ sau (cao hơn đầu người bán, nhìn từ camera vẫn thấy)
    const shelfItems = tanks || def.interior === 'butcher' ? [] : def.items.slice(FRONT_MAX);
    for (let row = 0; row < (tanks ? 0 : 2); row++) {
      mesh(g, G.box(8, 0.08, 0.7), 0x8a5a35, { p: [0, 0.9 + row * 0.9, -3.7] });
      if (row === 1 && shelfItems.length) continue;
      for (let i = 0; i < 6; i++) mesh(g, G.box(1, 0.5, 0.5), 0xc98b4f, { p: [-3.4 + i * 1.36, 1.2 + row * 0.9, -3.7] });
    }
    const name = signText(def.name, '#3b2a1e', 5.4, 0.7);
    name.position.set(0, 3.15, -4.1);
    g.add(name);
    // Sạp hải sản: viền đèn LED nhấp nháy quanh tên sạp trên vách
    if (def.id === 'seafood') {
      const frame = group(g, { p: [0, 3.15, -4.12] });
      this.leds = ledFrame(frame, 5.9, 0.95, 0.04);
    }
    // Khách mua hàng: chỗ đứng theo kiểu sạp (không che khay / biển giá từ góc nhìn mặc định)
    if (tanks) {
      this.buildTanks(def, index);
      this.addShoppers(index, [[-2.7, 0.2, -1.7], [2.65, -0.45, 1.9]], [-0.1, 0.3, 0.5]);
      return;
    }
    if (def.interior === 'butcher') {
      this.buildButcher(def, index);
      this.addShoppers(index, [[-4.1, 0.9, Math.PI - 0.5], [3.2, 0.9, Math.PI - 0.2]], [1.9, 1.9, 1.0]);
      return;
    }
    // Người bán sau quầy
    const vendor = makePerson(LOOKS[(index * 3 + 5) % LOOKS.length], index % 2 ? 'none' : 'straw', adultShape(index * 3 + 5));
    vendor.position.set(0, 0.55, -2.6); // đứng trên bục sau quầy cho khỏi bị khay hàng che
    vendor.scale.setScalar(1.25);
    g.add(vendor);
    this.vendor = vendor;
    // Quầy gỗ + khay hàng: mỗi nguyên liệu một khay, xếp lưới (tối đa 5 cột, 2 hàng — dư thì lên kệ sau)
    const items = def.items.slice(0, FRONT_MAX);
    const cols = Math.min(5, items.length);
    const rows = Math.ceil(items.length / cols);
    const tw = 1.35;
    const td = 1.0;
    const depth = rows * (td + 0.5) + 0.3;
    mesh(g, G.box(cols * (tw + 0.2) + 0.5, 0.9, depth), 0xb07a45, { p: [0, 0.45, -0.6 + depth / 2 - 0.9] });
    mesh(g, G.box(cols * (tw + 0.2) + 0.7, 0.08, depth + 0.2), 0x8a5a35, { p: [0, 0.93, -0.6 + depth / 2 - 0.9] });
    /** Một khay hàng (bấm để mua): đống biểu tượng + biển giá cắm phía trước. */
    const addTray = (id: string, i: number, at: V3, w: number, d: number, s = 1) => {
      const item = game.content.items.get(id);
      const tray = group(g, { p: at });
      tray.userData.pick = { type: 'goods', id } satisfies Pick;
      mesh(tray, G.box(w, 0.1, d), 0x6b4a2f);
      mesh(tray, G.box(w - 0.12, 0.06, d - 0.12), 0xf3e6c8, { p: [0, 0.04, 0] });
      // Đống hàng: vài biểu tượng chồng lên nhau
      for (let k = 0; k < 5; k++) {
        const sp = emojiSprite(item.icon, 0.42 * s);
        const y = (0.28 + (k > 2 ? 0.18 : 0)) * s;
        sp.position.set(((k % 3) - 1) * 0.34 * (w / tw), y, (k > 2 ? -0.05 : 0.12 - (k % 2) * 0.12) * (d / td));
        tray.add(sp);
        if (k === 4) this.bobbers.push({ obj: sp, y, phase: i * 1.3 });
      }
      // Biển giá cắm trước khay
      const price = priceOf(game.ctx, def.id, id);
      const factor = game.state.market.priceFactor[id] ?? 1;
      const tagColor = factor > 1.08 ? '#c0392b' : factor < 0.92 ? '#2f8f3a' : '#3b2a1e';
      const tag = group(tray, { p: [0, 0.32 * s, d / 2 + 0.02], r: [-0.35, 0, 0] });
      mesh(tag, G.box(1.18 * s, 0.4 * s, 0.03), 0xffffff);
      const label = signText(`${item.name} · ${price} xu`, tagColor, 1.1 * s, 0.34 * s);
      label.position.z = 0.02;
      tag.add(label);
      mesh(tray, G.cyl(0.015, 0.015, 0.3 * s, 4), 0x6b4a2f, { p: [0, 0.15 * s, d / 2 + 0.02], cast: false });
    };
    items.forEach((id, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const rowCount = r === rows - 1 ? items.length - r * cols : cols;
      const x = (c - (rowCount - 1) / 2) * (tw + 0.2);
      const z = -1.2 + r * (td + 0.5);
      // Hàng khay phía sau đặt trên bậc cao hơn (như kệ bậc thang) để không bị hàng trước che
      const lift = (rows - 1 - r) * 0.3;
      if (lift > 0) mesh(g, G.box(tw + 0.1, lift, td + 0.1), 0x9a6a3e, { p: [x, 0.97 + lift / 2, z] });
      addTray(id, i, [x, 0.97 + lift, z], tw, td);
    });
    // Hàng dư bày trên tầng trên của kệ sau, cách đều theo bề ngang kệ
    const sw = Math.min(1.45, 7.6 / Math.max(1, shelfItems.length));
    shelfItems.forEach((id, j) => {
      const x = (j - (shelfItems.length - 1) / 2) * sw;
      addTray(id, items.length + j, [x, 1.86, -3.65], sw - 0.12, 0.62, 0.95);
    });
    // Khách đứng hai bên quầy (khe giữa quầy và vách), quay vào khay; người đi dạo ngang trước quầy
    const side = Math.min(4.6, (cols * (tw + 0.2) + 0.7) / 2 + 0.45);
    const front = -1.5 + depth;
    this.addShoppers(index, [[-side, Math.min(1.2, front - 0.6), Math.PI / 2 + 0.3], [side, Math.min(0.4, front - 1.2), -Math.PI / 2 - 0.3]], [0.3, front + 0.9, 1.8]);
  }

  /** Bể kính: khung, nước xanh trong, cát + rong dưới đáy, bọt khí, hải sản bơi; biển giá trước bể. Bấm bể → mua (Pick 'goods'). */
  private buildTank(id: string, p: V3, rotY: number, phase: number): void {
    const { game } = this;
    const item = game.content.items.get(id);
    const def = game.content.stalls.get(this.stallId!);
    const W = 2.3;
    const D = 1.0;
    const H = 0.95;
    const base = 0.62; // chân bể
    const tank = group(this.content, { p, r: [0, rotY, 0] });
    tank.userData.pick = { type: 'goods', id } satisfies Pick;
    // Chân bể (tủ gỗ) + đáy
    mesh(tank, G.box(W + 0.12, base, D + 0.12), 0x5d7f8f, { p: [0, base / 2, 0] });
    mesh(tank, G.box(W, 0.08, D), 0xe8d7a8, { p: [0, base + 0.04, 0] }); // cát
    // Nước + khung kính
    const water = mesh(tank, G.box(W - 0.04, H - 0.12, D - 0.04), WATER, { p: [0, base + (H - 0.12) / 2 + 0.02, 0], cast: false, receive: false });
    water.renderOrder = -1;
    const top = base + H;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(tank, G.box(0.05, H, 0.05), 0x2f4f5f, { p: [(sx * W) / 2, base + H / 2, (sz * D) / 2], cast: false });
    for (const sz of [-1, 1]) for (const y of [base + 0.02, top]) mesh(tank, G.box(W, 0.05, 0.05), 0x2f4f5f, { p: [0, y, (sz * D) / 2], cast: false });
    for (const sx of [-1, 1]) for (const y of [base + 0.02, top]) mesh(tank, G.box(0.05, 0.05, D), 0x2f4f5f, { p: [(sx * W) / 2, y, 0], cast: false });
    // Rong, đá dưới đáy
    for (let k = 0; k < 3; k++) {
      const x = -0.8 + k * 0.8 + (phase % 0.3);
      mesh(tank, G.cone(0.06, 0.45 + (k % 2) * 0.2, 5), 0x3f9b5a, { p: [x, base + 0.3, -0.25 + (k % 2) * 0.15], cast: false });
      mesh(tank, G.ico(0.09, 0), 0x9a9a9a, { p: [x + 0.25, base + 0.12, 0.2], cast: false });
    }
    // Máy sủi oxy ở góc + bọt khí
    mesh(tank, G.cyl(0.04, 0.04, H - 0.1, 6), 0xdfe8ec, { p: [W / 2 - 0.15, base + H / 2, -D / 2 + 0.12], cast: false });
    for (let k = 0; k < 5; k++) {
      const b = mesh(tank, G.sphere(0.035, 6, 5), 0xffffff, { p: [W / 2 - 0.15, base + 0.1, -D / 2 + 0.15], cast: false });
      this.bubbles.push({ obj: b, y0: base + 0.1, h: H - 0.25, phase: k / 5 + phase });
    }
    // Hải sản bơi: vài con ở các độ sâu khác nhau
    for (let k = 0; k < 4; k++) {
      const size = 0.56 - (k % 2) * 0.08;
      const s = emojiSprite(item.icon, size);
      tank.add(s);
      this.swimmers.push({ obj: s, x: 0, y: base + 0.3 + (k % 3) * 0.18, range: W / 2 - 0.35, speed: 0.6 + (k % 3) * 0.25, phase: phase * 2 + k * 1.7, size });
      s.position.z = -0.25 + (k % 2) * 0.35;
    }
    // Biển giá dán trước bể
    const price = priceOf(game.ctx, def.id, id);
    const factor = game.state.market.priceFactor[id] ?? 1;
    const tagColor = factor > 1.08 ? '#c0392b' : factor < 0.92 ? '#2f8f3a' : '#3b2a1e';
    const tag = group(tank, { p: [0, base / 2, D / 2 + 0.07] });
    mesh(tag, G.box(1.5, 0.42, 0.03), 0xffffff);
    const label = signText(`${item.name} · ${price} xu`, tagColor, 1.4, 0.36);
    label.position.z = 0.02;
    tag.add(label);
  }

  /**
   * Sạp hải sản: bể nước xếp chữ U quanh sạp (hai bể sát vách sau, hai bể chéo hai bên), giữa sạp không có quầy —
   * người bán đứng cạnh cái cân, vài rổ hải sản và xô nước dưới chân.
   */
  private buildTanks(def: StallDef, index: number): void {
    const g = this.content;
    const basketIds = def.baskets ?? [];
    const items = def.items.filter((id) => !basketIds.includes(id));
    // 4 bể trở xuống: 2 bể vách sau + 2 bể chéo hai bên; 5 bể: 3 bể vách sau + 2 bể chéo (bể thứ 3 vào giữa vách sau)
    const spots: { p: V3; r: number }[] =
      items.length >= 5
        ? [
            { p: [-2.5, 0, -3.35], r: 0 },
            { p: [2.5, 0, -3.35], r: 0 },
            { p: [-3.95, 0, -0.35], r: 0.85 },
            { p: [3.95, 0, -0.35], r: -0.85 },
            { p: [0, 0, -3.35], r: 0 },
            { p: [-3.55, 0, 1.4], r: 1.2 },
          ]
        : [
            { p: [-1.45, 0, -3.35], r: 0 },
            { p: [1.45, 0, -3.35], r: 0 },
            { p: [-3.55, 0, -1.0], r: 0.75 },
            { p: [3.55, 0, -1.0], r: -0.75 },
          ];
    items.forEach((id, i) => {
      const s = spots[i % spots.length];
      this.buildTank(id, s.p, s.r, i * 0.37);
    });
    // Người bán đứng giữa sạp, ủng cao su + tạp dề
    const vendor = makePerson(LOOKS[(index * 3 + 5) % LOOKS.length], 'none', { ...adultShape(index * 3 + 5), width: 1.25, hair: 'bun' });
    // Có bể giữa vách sau (5 bể) thì người bán đứng lệch trái cho khỏi che biển giá bể giữa
    vendor.position.set(items.length >= 5 ? -1.15 : -0.3, 0, -1.3);
    vendor.scale.setScalar(1.25);
    mesh(vendor, G.box(0.42, 0.5, 0.05), 0x3f6f8f, { p: [0, 0.55, 0.19], cast: false }); // tạp dề
    g.add(vendor);
    this.vendor = vendor;
    // Cái cân đồng hồ trên ghế đẩu
    const scale = group(g, { p: [0.9, 0, -1.0] });
    mesh(scale, G.cyl(0.22, 0.26, 0.5, 10), 0x2f6fb0, { p: [0, 0.25, 0] }); // ghế đẩu nhựa
    mesh(scale, G.box(0.42, 0.22, 0.36), 0xe9e4da, { p: [0, 0.61, 0] }); // thân cân
    mesh(scale, G.cyl(0.13, 0.13, 0.04, 16), 0xffffff, { p: [0, 0.62, 0.19], r: [Math.PI / 2, 0, 0], cast: false }); // mặt đồng hồ
    mesh(scale, G.box(0.01, 0.09, 0.01), 0xc0392b, { p: [0.02, 0.64, 0.215], r: [0, 0, -0.5], cast: false }); // kim
    mesh(scale, G.cyl(0.26, 0.22, 0.04, 16), 0xb9c2c8, { p: [0, 0.75, 0] }); // đĩa cân
    const onScale = emojiSprite('🦐', 0.3);
    onScale.position.set(0, 0.88, 0);
    scale.add(onScale);
    // Rổ ốc, sò quanh người bán và cái cân: vòng cung phía trước, mỗi rổ một loại có biển giá (bấm rổ → mua)
    const ring: [number, number][] = [[-1.9, -0.2], [-1.15, 0.85], [0.2, 1.15], [1.55, 0.85], [2.2, -0.2], [-2.4, 1.2], [2.8, 1.0]];
    basketIds.forEach((id, i) => {
      const [x, z] = ring[i % ring.length];
      this.buildBasket(id, [x, 0, z], i);
    });
    // Xô nước (xanh, đỏ) + gáo
    const buckets: [number, number, number][] = [[-2.6, -1.9, 0x3d8fd1], [2.2, -1.9, 0xd9534f]];
    for (const [x, z, color] of buckets) {
      const b = group(g, { p: [x, 0, z] });
      mesh(b, G.cyl(0.24, 0.19, 0.42, 12), color, { p: [0, 0.21, 0] });
      mesh(b, G.cyl(0.21, 0.21, 0.02, 12), WATER_TOP, { p: [0, 0.38, 0], cast: false });
      mesh(b, G.torus(0.24, 0.015, 4, 14, Math.PI), 0x888888, { p: [0, 0.42, 0], cast: false }); // quai xô
    }
    mesh(g, G.cyl(0.07, 0.06, 0.08, 8), 0xf2c14e, { p: [2.32, 0.44, -1.85], cast: false }); // gáo
    // Vũng nước nhỏ trên sàn
    mesh(g, G.cyl(0.5, 0.5, 0.01, 16), WATER, { p: [0.3, 0.06, -0.2], s: [1, 1, 0.6], cast: false, receive: false });
  }

  /** Biển giá nhỏ (chữ đổi màu theo giá hôm nay) gắn vào `parent`. */
  private priceTag(parent: THREE.Object3D, id: string, p: V3, w: number, tilt = -0.35): void {
    const { game } = this;
    const item = game.content.items.get(id);
    const price = priceOf(game.ctx, this.stallId!, id);
    const factor = game.state.market.priceFactor[id] ?? 1;
    const color = factor > 1.08 ? '#c0392b' : factor < 0.92 ? '#2f8f3a' : '#3b2a1e';
    const tag = group(parent, { p, r: [tilt, 0, 0] });
    mesh(tag, G.box(w + 0.08, 0.3, 0.03), 0xffffff);
    const label = signText(`${item.name} · ${price} xu`, color, w, 0.26);
    label.position.z = 0.02;
    tag.add(label);
  }

  /** Rổ tre đựng ốc / sò dưới đất, đầy hàng, biển giá cắm trước rổ; bấm → mua (Pick 'goods'). */
  private buildBasket(id: string, p: V3, i: number): void {
    const item = this.game.content.items.get(id);
    const b = group(this.content, { p });
    b.userData.pick = { type: 'goods', id } satisfies Pick;
    mesh(b, G.cyl(0.42, 0.3, 0.3, 14), 0xc99a52, { p: [0, 0.15, 0] });
    for (let k = 0; k < 3; k++) mesh(b, G.torus(0.33 + k * 0.04, 0.012, 3, 16), 0xa77a3a, { p: [0, 0.06 + k * 0.1, 0], r: [Math.PI / 2, 0, 0], cast: false }); // nan đan
    mesh(b, G.torus(0.42, 0.035, 4, 16), 0xa77a3a, { p: [0, 0.3, 0], r: [Math.PI / 2, 0, 0], cast: false });
    mesh(b, G.cyl(0.39, 0.39, 0.04, 14), 0x7a5a3a, { p: [0, 0.27, 0], cast: false }); // đáy hàng
    for (let k = 0; k < 6; k++) {
      const s = emojiSprite(item.icon, 0.24);
      const a = (k / 6) * Math.PI * 2 + i;
      const r = k === 5 ? 0 : 0.18;
      s.position.set(Math.cos(a) * r, 0.36 + (k === 5 ? 0.08 : 0), Math.sin(a) * r * 0.7);
      b.add(s);
      if (k === 5) this.bobbers.push({ obj: s, y: 0.44, phase: i * 1.1 });
    }
    this.priceTag(b, id, [0, 0.14, 0.47], 1.3, -0.25);
  }

  /** Một tảng thịt treo móc: bò đỏ sẫm vân mỡ, heo hồng có lớp mỡ + da, gà nguyên con vàng nhạt. */
  private meatSlab(parent: THREE.Object3D, id: string, x: number, k: number): void {
    const hang = group(parent, { p: [x, 0, 0] });
    mesh(hang, G.torus(0.05, 0.012, 4, 10, Math.PI * 1.4), 0x9aa3a8, { p: [0, -0.05, 0], r: [0, Math.PI / 2, 0], cast: false }); // móc
    mesh(hang, G.cyl(0.01, 0.01, 0.16, 4), 0x9aa3a8, { p: [0, -0.16, 0], cast: false });
    const body = group(hang, { p: [0, -0.24, 0], r: [0, 0, (k % 2 ? 1 : -1) * 0.04] });
    if (id === 'beef') {
      mesh(body, G.box(0.32, 0.62, 0.2), 0xa8333a, { p: [0, -0.31, 0] });
      mesh(body, G.box(0.33, 0.06, 0.21), 0xf3e2d0, { p: [0, -0.18, 0], cast: false }); // vân mỡ
      mesh(body, G.box(0.33, 0.04, 0.21), 0xf3e2d0, { p: [0, -0.42, 0], cast: false });
      mesh(body, G.sphere(0.06, 8, 6), 0xf6f0e4, { p: [0, -0.62, 0.02] }); // đầu xương
    } else if (id === 'pork') {
      mesh(body, G.box(0.36, 0.5, 0.18), 0xf0a1a1, { p: [0, -0.25, 0] });
      mesh(body, G.box(0.37, 0.5, 0.05), 0xfbe6d6, { p: [0, -0.25, 0.1], cast: false }); // lớp mỡ
      mesh(body, G.box(0.37, 0.5, 0.02), 0xf2c49b, { p: [0, -0.25, 0.13], cast: false }); // da
    } else {
      mesh(body, G.sphere(0.18, 12, 10), 0xf6d8a8, { p: [0, -0.24, 0], s: [1, 1.3, 0.9] });
      for (const s of [-1, 1]) mesh(body, G.capsule(0.05, 0.14), 0xf6d8a8, { p: [s * 0.1, -0.02, 0.02], r: [0, 0, s * 0.3] }); // đùi gà treo ngược
      mesh(body, G.sphere(0.07, 8, 6), 0xf6d8a8, { p: [0, -0.5, 0.02] });
    }
  }

  /**
   * Sạp thịt: bàn inox dài; nửa bên trái có giá treo inox với các tảng thịt (mỗi loại một cụm, bấm → mua, biển giá trên mép bàn);
   * nửa bên phải là cái thớt gỗ to (có dao phay, vài miếng thịt đang chặt) và cái cân thịt. Người bán đứng sau thớt.
   */
  private buildButcher(def: StallDef, index: number): void {
    const g = this.content;
    const STEEL = 0xc8d0d5;
    const L = 7.2;
    const D = 1.2;
    const H = 0.95;
    const z0 = -1.4;
    // Bàn inox: mặt bàn, viền, chân, kệ dưới
    mesh(g, G.box(L, 0.06, D), STEEL, { p: [0, H, z0] });
    mesh(g, G.box(L, 0.12, 0.04), 0xaab4ba, { p: [0, H - 0.06, z0 + D / 2] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(g, G.cyl(0.035, 0.035, H, 6), 0xaab4ba, { p: [sx * (L / 2 - 0.15), H / 2, z0 + sz * (D / 2 - 0.12)] });
    mesh(g, G.box(L - 0.3, 0.04, D - 0.25), 0xb6bfc5, { p: [0, 0.25, z0] }); // kệ dưới
    for (let i = 0; i < 4; i++) mesh(g, G.box(0.5, 0.3, 0.4), 0xffffff, { p: [-2.8 + i * 1.6, 0.42, z0], cast: false }); // thùng xốp đá dưới kệ

    // Giá treo: từ mép trái tới giữa bàn
    const x1 = -L / 2 + 0.2;
    const x2 = -0.1;
    const top = 2.55;
    for (const x of [x1, x2]) mesh(g, G.cyl(0.04, 0.04, top - H, 8), STEEL, { p: [x, H + (top - H) / 2, z0 - 0.3] });
    mesh(g, G.cyl(0.035, 0.035, x2 - x1, 8), STEEL, { p: [(x1 + x2) / 2, top, z0 - 0.3], r: [0, 0, Math.PI / 2] });
    const items = def.items;
    const span = (x2 - x1) / items.length;
    items.forEach((id, i) => {
      const cx = x1 + span * (i + 0.5);
      const cluster = group(g, { p: [cx, top, z0 - 0.3] });
      cluster.userData.pick = { type: 'goods', id } satisfies Pick;
      for (let k = 0; k < 2; k++) this.meatSlab(cluster, id, (k - 0.5) * 0.42, k + i);
      // Vài miếng bày trên mặt bàn dưới giá + biển giá ở mép bàn
      const tray = group(g, { p: [cx, H + 0.03, z0 + 0.15] });
      tray.userData.pick = { type: 'goods', id } satisfies Pick;
      mesh(tray, G.box(0.9, 0.04, 0.55), 0xeef2f4);
      const icon = this.game.content.items.get(id).icon;
      for (let k = 0; k < 3; k++) {
        const s = emojiSprite(icon, 0.3);
        s.position.set((k - 1) * 0.26, 0.16, (k % 2) * 0.08);
        tray.add(s);
      }
      this.priceTag(g, id, [cx, H - 0.08, z0 + D / 2 + 0.05], 1.0, 0);
    });

    // Nửa bên phải: thớt gỗ to + dao phay + miếng thịt đang chặt
    const board = group(g, { p: [1.3, H + 0.03, z0] });
    mesh(board, G.cyl(0.58, 0.6, 0.2, 20), 0xb98a55, { p: [0, 0.1, 0] });
    mesh(board, G.cyl(0.5, 0.5, 0.005, 20), 0xa77a45, { p: [0, 0.205, 0], cast: false }); // vân gỗ
    mesh(board, G.box(0.4, 0.1, 0.28), 0xa8333a, { p: [-0.1, 0.26, 0.05], r: [0, 0.4, 0] });
    mesh(board, G.box(0.18, 0.08, 0.2), 0xf0a1a1, { p: [0.25, 0.25, -0.18], r: [0, -0.3, 0] });
    const knife = group(board, { p: [0.18, 0.32, 0.12], r: [0, -0.5, 0.25] });
    mesh(knife, G.box(0.34, 0.16, 0.015), 0xdfe6ea); // lưỡi dao phay
    mesh(knife, G.box(0.2, 0.05, 0.04), 0x3a2a1e, { p: [0.26, -0.03, 0] }); // cán

    // Cân thịt: đế, mặt đồng hồ, đĩa cân có miếng thịt
    const sc = group(g, { p: [2.75, H + 0.03, z0 - 0.05] });
    mesh(sc, G.box(0.5, 0.18, 0.42), 0xe2574c, { p: [0, 0.09, 0] });
    mesh(sc, G.cyl(0.16, 0.16, 0.05, 16), 0xffffff, { p: [0, 0.32, 0.2], r: [Math.PI / 2 - 0.35, 0, 0], cast: false });
    mesh(sc, G.box(0.012, 0.11, 0.012), 0xc0392b, { p: [0.02, 0.34, 0.235], r: [-0.35, 0, -0.6], cast: false });
    mesh(sc, G.box(0.1, 0.2, 0.08), 0xe2574c, { p: [0, 0.24, 0.16] });
    mesh(sc, G.cyl(0.25, 0.22, 0.04, 16), 0xb9c2c8, { p: [0, 0.2, -0.05] });
    mesh(sc, G.box(0.22, 0.08, 0.16), 0xa8333a, { p: [0, 0.26, -0.05], r: [0, 0.3, 0] });

    // Người bán đứng sau thớt, tạp dề trắng dính chút đỏ
    const vendor = makePerson(LOOKS[(index * 3 + 5) % LOOKS.length], 'none', { ...adultShape(index * 3 + 5), width: 1.2, hair: 'bun' });
    vendor.position.set(1.3, 0, z0 - 1.1);
    vendor.scale.setScalar(1.25);
    mesh(vendor, G.box(0.42, 0.5, 0.05), 0xffffff, { p: [0, 0.55, 0.19], cast: false });
    mesh(vendor, G.sphere(0.04, 6, 5), 0xc0392b, { p: [0.08, 0.6, 0.22], cast: false });
    g.add(vendor);
    this.vendor = vendor;
  }

  /** Tiệm 25caaaaa: phòng hồng, quầy pha chế có biển logo, bảng menu, bàn ghế cho cả đội ngồi ăn. */
  private buildKiosk(def: StallDef): void {
    const g = this.content;
    // Sàn trơn màu be ấm cho đỡ rối mắt, đỡ chói
    mesh(g, G.box(11, 0.1, 9), 0xdcb88c, { p: [0, 0, -1], receive: true }); // sàn màu be (vàng cam nhạt) cho đỡ chói
    mesh(g, G.box(11, 3.8, 0.15), 0xf4a7bd, { p: [0, 1.9, -5.4] });
    // Hai tường bên chạy suốt tới mép trước của sàn
    for (const sx of [-1, 1]) mesh(g, G.box(0.15, 3.8, 9.05), 0xf4a7bd, { p: [sx * 5.5, 1.9, -0.98] });
    // Cửa sổ hai bên tường: khung trắng, kính xanh nhạt, song chữ thập, bậu cửa có chậu hoa nhỏ
    const glass = new THREE.MeshBasicMaterial({ color: 0xcdeeff });
    for (const sx of [-1, 1]) {
      for (const z of [-3.0, 0.4]) {
        const w = group(g, { p: [sx * 5.4, 2.0, z], r: [0, sx > 0 ? -Math.PI / 2 : Math.PI / 2, 0] });
        mesh(w, G.box(1.7, 1.3, 0.06), 0xffffff, { cast: false });
        mesh(w, G.box(1.5, 1.1, 0.07), glass, { cast: false, receive: false });
        mesh(w, G.box(0.06, 1.1, 0.08), 0xffffff, { cast: false });
        mesh(w, G.box(1.5, 0.06, 0.08), 0xffffff, { cast: false });
        mesh(w, G.box(1.8, 0.08, 0.22), 0xf28fb0, { p: [0, -0.7, 0.08], cast: false }); // bậu cửa
        mesh(w, G.cyl(0.1, 0.08, 0.14, 10), 0xd9785b, { p: [0.45, -0.58, 0.1], cast: false });
        mesh(w, G.sphere(0.11, 8, 6), 0x7fc35a, { p: [0.45, -0.45, 0.1], cast: false });
      }
    }
    this.addLamps([[-2.6, 3.3, -1.4], [1.2, 3.3, -3.0], [2.4, 3.3, 0.9], [-0.8, 3.3, 1.6]], 3.8);
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
    // Bảng menu chân đứng (kiểu giá vẽ) đặt gần cửa, quay về phía người xem cho dễ đọc; bấm để gọi món cho cả đội
    const stand = group(g, { p: [-3.5, 0, 0.3], r: [0, 0.38, 0] });
    stand.userData.pick = { type: 'menuboard', id: def.id } satisfies Pick;
    for (const sx of [-0.95, 0.95]) mesh(stand, G.box(0.09, 2.9, 0.09), 0x8a5a35, { p: [sx, 1.4, 0.05], r: [-0.1, 0, 0] }); // hai chân trước
    mesh(stand, G.box(0.09, 2.8, 0.09), 0x8a5a35, { p: [0, 1.35, -0.45], r: [0.28, 0, 0] }); // chân chống sau
    mesh(stand, G.box(2.1, 0.08, 0.16), 0x8a5a35, { p: [0, 0.62, 0.1] }); // gờ đỡ bảng
    const board = group(stand, { p: [0, 1.75, 0.12], r: [-0.1, 0, 0] });
    mesh(board, G.box(2.3, 2.3, 0.1), 0x6b4a2f);
    mesh(board, G.box(2.12, 2.12, 0.05), 0x2f4f3f, { p: [0, 0, 0.05] });
    const title = signText('MENU', '#ffe08a', 1.4, 0.42);
    title.position.set(0, 0.78, 0.09);
    board.add(title);
    (def.menu ?? []).forEach((d, i) => {
      const y = 0.32 - i * 0.4;
      const name = signText(d.name, '#ffffff', 1.18, 0.3);
      name.position.set(-0.12, y, 0.09);
      board.add(name);
      const price = signText(`${d.price} xu`, '#ffe08a', 0.5, 0.3);
      price.position.set(0.8, y, 0.09);
      board.add(price);
      const icon = emojiSprite(d.icon, 0.3);
      icon.position.set(-0.88, y, 0.12);
      board.add(icon);
    });
    const hint = emojiSprite('👆', 0.5);
    hint.position.set(1.05, -1.0, 0.25);
    board.add(hint);
    this.bobbers.push({ obj: hint, y: -1.0, phase: 0 });
    // Bàn tròn + ghế đẩu: chỗ ngồi cho người trong đội
    // Bàn dễ thấy xếp trước (người trong đội ngồi theo thứ tự này); bàn góc trong sau bảng menu để cuối
    for (const [tx, tz] of [[0.4, -0.6], [-1.2, 1.4], [2.0, 1.6], [3.2, -1.4], [-3.4, -2.7]] as const) {
      mesh(g, G.cyl(0.55, 0.55, 0.06, 18), 0xf7a8c4, { p: [tx, 0.8, tz] }); // mặt bàn hồng
      mesh(g, G.cyl(0.06, 0.1, 0.78, 8), 0xf28fb0, { p: [tx, 0.4, tz] });
      // Ghế hai bên trái / phải bàn: nhìn từ cửa không ai che đĩa món của ai
      for (const a of [Math.PI / 2, -Math.PI / 2]) {
        const sx = tx + Math.sin(a) * 0.85;
        const sz = tz + Math.cos(a) * 0.85;
        mesh(g, G.cyl(0.22, 0.2, 0.45, 12), 0xf6c94c, { p: [sx, 0.22, sz] });
        this.seats.push({ p: [sx, 0.45, sz], table: [tx, tz] });
      }
    }
  }

  /**
   * Khách mua hàng (2-3 người): `spots` = chỗ đứng chọn hàng [x, z, hướng quay], `walker` = người đi dạo qua lại [x, z, quãng].
   * Người đi dạo có hay không và dáng người đổi theo sạp + ngày (có thể có trẻ em đi theo).
   */
  private addShoppers(index: number, spots: [number, number, number][], walker: [number, number, number]): void {
    const seed = index * 97 + this.day * 13;
    // Chỗ đầu tiên dành cho ông / bà chủ: đi từ ngoài vào (phía camera) rồi đứng quay vào hàng
    const [mine, ...rest] = spots;
    const [ox, oz, face] = mine;
    this.owner = new OwnerWalker(this.game, this.content, { x: ox + 0.4, z: oz + 3.2 }, () => ({ x: ox, z: oz, face }), undefined, 1.0, 1.2);
    this.owner.stay = true;
    this.owner.goTo({ x: ox, z: oz, face });
    // Khách khác: chỗ còn lại + người đi dạo (ngày chẵn / lẻ)
    const all = [...rest, walker];
    all.forEach(([x, z, k], i) => {
      const walks = i >= rest.length;
      const base = LOOKS[(seed + i * 5) % LOOKS.length];
      const { shape, look } = randomShape(seed + i * 7, i, base);
      const p = makePerson(look ?? base, 'none', shape);
      p.scale.setScalar(1.2);
      p.position.set(x, 0, z);
      if (!walks && (seed + i) % 2 === 0) mesh(p, G.cyl(0.16, 0.12, 0.22, 10), 0xc99a52, { p: [0.32, 0.25, 0.05] }); // giỏ đi chợ
      this.content.add(p);
      this.shoppers.push({ obj: p, x, z, range: walks ? k : 0, speed: 0.35, phase: i * 2.1 + seed, face: walks ? Math.PI : k });
    });
  }

  private updateShoppers(env: Env): void {
    for (const s of this.shoppers) {
      if (s.range > 0) {
        // Đi qua lại chậm, dừng ở hai đầu để ngó hàng
        const a = env.t * s.speed + s.phase;
        const u = Math.sin(a);
        const moving = Math.abs(Math.cos(a)) > 0.35;
        s.obj.position.x = s.x + u * s.range;
        s.obj.rotation.y = moving ? (Math.cos(a) > 0 ? Math.PI / 2 : -Math.PI / 2) : s.face;
        animatePerson(s.obj, env.t, { walk: moving ? 1 : 0 });
      } else {
        // Thỉnh thoảng cúi xuống chọn hàng / quay sang nhìn sạp bên
        const k = Math.sin(env.t * 0.4 + s.phase);
        s.obj.rotation.y = s.face + Math.sin(env.t * 0.23 + s.phase) * 0.25;
        animatePerson(s.obj, env.t, { reach: k > 0.75 ? 0.35 : 0 });
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
        g = group(this.content, { p: seat.p });
        const p = crewLook(this.game, l.who);
        // Quay mặt vào giữa bàn
        p.rotation.y = Math.atan2(seat.table[0] - seat.p[0], seat.table[1] - seat.p[2]);
        g.add(p);
        g.userData.person = p;
        // Đĩa trên mặt bàn (mặt bàn cao 0.83, ghế 0.45): dịch về phía tâm bàn
        const [tx, tz] = seat.table;
        const plate = group(g, { p: [(tx - seat.p[0]) * 0.5, 0.4, (tz - seat.p[2]) * 0.5] });
        mesh(plate, G.cyl(0.17, 0.12, 0.03, 14), 0xffffff, { cast: false });
        const dish = emojiSprite(l.icon, 0.34);
        dish.position.set(0, 0.17, 0);
        plate.add(dish);
        this.eaters.set(l.who, g);
      }
      animatePerson(g.userData.person, env.t, { sit: true, eat: true });
    });
  }

  private paintedSeason = -1;

  /** Đèn thả trần: dây + chao đèn + bóng sáng, kèm nguồn sáng (tối thì sáng lên). `ceil` = độ cao trần / mái. */
  private addLamps(points: V3[], ceil: number): void {
    for (const [x, y, z] of points) {
      const g = group(this.content, { p: [x, y, z] });
      mesh(g, G.cyl(0.012, 0.012, ceil - y, 4), 0x3b2a1e, { p: [0, (ceil - y) / 2, 0], cast: false });
      mesh(g, G.cone(0.28, 0.24, 14, ), 0xf2c14e, { p: [0, 0.02, 0], r: [Math.PI, 0, 0], cast: false });
      const bulb = new THREE.MeshBasicMaterial({ color: 0xbfb8a8 });
      mesh(g, G.sphere(0.09, 10, 8), bulb, { p: [0, -0.1, 0], cast: false });
      const light = new THREE.PointLight(0xffd9a0, 0, 0, 0);
      light.position.set(x, y - 0.2, z);
      this.content.add(light);
      this.lamps.push({ light, bulb });
    }
  }

  update(env: Env, dt = 0.016): void {
    // Đèn trong tiệm: luôn hơi sáng, trời tối thì sáng hẳn
    for (const l of this.lamps) {
      l.light.intensity = (0.12 + env.night * 1.1) / Math.max(1, this.lamps.length / 2);
      l.bulb.color.setHex(env.night > 0.3 ? 0xfff1c4 : 0xbfb8a8);
    }
    // Nền cỏ ngoài nhà đổi theo mùa (cây trồng bên trong giữ nguyên)
    if (this.paintedSeason !== env.season) {
      this.paintedSeason = env.season;
      paintSeason(this.root, env.season, false);
    }
    if (this.stallId && this.game.state.clock.day !== this.day) this.build(); // giá đổi theo ngày
    if (this.vendor) animatePerson(this.vendor, env.t, { wave: Math.max(0, Math.min(1, (Math.sin(env.t * 0.5) - 0.8) * 6)) });
    for (const b of this.bobbers) b.obj.position.y = b.y + Math.abs(Math.sin(env.t * 2.4 + b.phase)) * 0.05;
    // Hải sản bơi qua lại, quay đầu theo hướng bơi (emoji nhìn sang trái: bơi sang phải thì lật ngang)
    for (const s of this.swimmers) {
      const a = env.t * s.speed + s.phase;
      s.obj.position.x = s.x + Math.sin(a) * s.range;
      s.obj.position.y = s.y + Math.sin(a * 2.3) * 0.05;
      s.obj.scale.x = (Math.cos(a) > 0 ? -1 : 1) * s.size;
    }
    for (const b of this.bubbles) b.obj.position.y = b.y0 + ((env.t * 0.45 + b.phase) % 1) * b.h;
    this.updateEaters(env);
    this.updateShoppers(env);
    blinkLeds(this.leds, env.t);
    // Ông / bà chủ: tới nơi thì thỉnh thoảng cúi chọn hàng
    this.owner?.update(env.t, dt, { reach: Math.sin(env.t * 0.35 + 1) > 0.8 ? 0.35 : 0 });
  }
}

/** Model người trong đội theo vai (đầu bếp mũ trắng, bồi bàn mũ đỏ, nhân viên thuê mũ vàng, bác nông dân nón lá). */
export function crewLook(game: Game, who: string): THREE.Group {
  const { state, content } = game;
  if (who === 'farmer') return makePerson(LOOKS[2], 'straw', FARMER_SHAPE);
  if (who === 'shipper') {
    const p = makePerson({ shirt: 0x2fa84f, hair: 0x2a1f1a, skin: 0xf2c49b });
    mesh(p.userData.rig.head, G.sphere(0.27, 12, 8), 0x2fa84f, { p: [0, 0.24, -0.02], s: [1, 0.85, 1] }); // mũ bảo hiểm
    return p;
  }
  if (content.staff.has(who)) {
    const i = content.staff.all().findIndex((s) => s.id === who);
    return makePerson({ shirt: 0xffffff, hair: 0x3a2a1e, skin: i % 2 ? 0xffd9b8 : 0xf2c49b }, 'chef', { width: [1.2, 0.95, 1.05, 0.9][i % 4] });
  }
  const h = state.restaurant.helpers.find((x) => x.id === who);
  const p = makePerson(h ? { shirt: [0x5fae57, 0xe2703a, 0x9a6bd1, 0x3fb6a8][h.look % 4], hair: [0x3a2a1e, 0x1f1a17, 0x6b3f22, 0x2a1f1a][h.look % 4], skin: h.look % 2 ? 0xf2c49b : 0xffd9b8 } : { shirt: 0x3f8fd2, hair: 0x2a1f1a, skin: 0xffd9b8 }, 'none', h ? adultShape(h.look * 7 + 3, ['short', 'side', 'pony', 'bob']) : {});
  mesh(p.userData.rig.head, G.box(0.42, 0.06, 0.3), h ? 0xf2b23e : 0xe2574c, { p: [0, 0.36, 0.06], r: [-0.2, 0, 0] }); // mũ lưỡi trai
  return p;
}
