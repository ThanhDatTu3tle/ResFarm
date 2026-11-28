import * as THREE from 'three';
import { CrayonPass } from './crayon';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Game } from '../../sim/game';
import { G, mesh, seeded, toon, type V3 } from './toon';
import { calendarOf } from '../../sim/calendar';
import { wardrobe } from './models';

/** Thứ người chơi có thể bấm vào trong cảnh 3D. Gắn vào object bằng `obj.userData.pick = {...}`. */
export type Pick =
  | { type: 'slot'; id: string }
  | { type: 'stall'; id: string }
  | { type: 'table'; id: string }
  /** Một nhóm khách (bấm vào người hoặc bong bóng chat); id = String(party.id). */
  | { type: 'party'; id: string }
  /** Quầy ra món. */
  | { type: 'pass'; id: string }
  /** Quầy cashier nhận đơn giao tận nơi (giai đoạn 18). */
  | { type: 'cashier'; id: string }
  /** Lô đất hoang bên Đông quán (id = số lô): bấm mở bảng Quán tới thẻ dọn lô / nâng hạng. */
  | { type: 'lot'; id: string }
  /** Cối chế biến ở nông trại (id = MillState.id). */
  | { type: 'mill'; id: string }
  /** Chỗ trống mua thêm được ở nông trại: id = loại ô (SlotType) hoặc loại cối (MillType). */
  | { type: 'expand'; id: string }
  /** Toà nhà ở nông trại có khu bên trong (id = id của Area, vd 'greenhouse'): bấm để vào. */
  | { type: 'building'; id: string }
  /** Đồ trang trí trong quán (id = PropState.uid): kéo ở chế độ sắp xếp. */
  | { type: 'prop'; id: string }
  /** Vết bẩn trên sàn quán (id = String(stain.id)): bấm để lau. */
  | { type: 'stain'; id: string }
  /** Khay hàng trong quầy chợ (id = id nguyên liệu): mở bảng mua. */
  | { type: 'goods'; id: string }
  /** Bảng menu trong Tiệm 25caaaaa (id = id sạp): mở bảng gọi món cho cả đội. */
  | { type: 'menuboard'; id: string };

/** Môi trường chung cho mọi khu, tính lại mỗi khung hình từ state (giờ + thời tiết). Mọi giá trị 0..1 trừ `t`. */
export interface Env {
  /** Giây thực đã trôi (để làm animation). */
  t: number;
  day: number;
  night: number;
  rain: number;
  clouds: number;
  wind: number;
  dim: number;
  /** Nắng gắt buổi trưa 0..1 (sáng sớm / chiều tối ≈ 0, 12:00 = 1); 0 khi trời tối. */
  noon: number;
  /** Mùa: 0 Xuân, 1 Hạ, 2 Thu, 3 Đông (số nguyên, theo lịch). */
  season: number;
  /** Tuyết rơi 0..1 (mùa đông lúc nào cũng lất phất, trời "Tuyết rơi" thì dày). */
  snow: number;
  selectedSlot: string | null;
  /** Đang ở chế độ sắp xếp bàn ghế. */
  editLayout: boolean;
  /** Món (id đơn) người chơi vừa chọn ở quầy ra món, đang chờ chọn bàn để giao. */
  serving: number | null;
  /** Bàn / đồ trang trí đang chọn ở chế độ sắp xếp (id bàn hoặc uid đồ trang trí). */
  editSelected: string | null;
}

/**
 * Một KHU VỰC = một "màn hình" 3D. Thêm khu mới: viết class implements Area trong ./areas
 * rồi thêm vào mảng areas ở app.ts - nút chuyển khu tự xuất hiện.
 */
export interface Area {
  id: string;
  label: string;
  icon: string;
  root: THREE.Group;
  /** Góc nhìn mặc định; `orbit` là góc xoay ngang tối đa sang mỗi bên (radian). */
  view: { position: V3; target: V3; orbit: number; zoomOut?: number };
  /** Vùng mưa rơi (trong nhà thì chỉ mưa phía ngoài cửa sổ). */
  rainBox: { min: V3; max: V3 };
  /** Khu ngoài trời: có vệt gió bay ngang khi trời gió. */
  outdoor?: boolean;
  /** Mái che trong vùng mưa (toạ độ của root, mét): giọt mưa trong khung x/z này không vẽ (`y` = độ cao mái) - quán ốc: sạp dù + mái kéo dài khi mưa. */
  rainShelter?: RainShelter;
  /** Ban đêm tối thêm bao nhiêu (0..1) khi đang xem khu này - quán vỉa hè về đêm chỉ còn đèn vàng, lửa than. */
  nightDark?: number;
  /** Đồng bộ hình ảnh với game.state. dt: giây thực; speed: tốc độ game. */
  update(env: Env, dt: number, speed: number): void;
}

export interface RainShelter {
  x1: number;
  x2: number;
  z1: number;
  z2: number;
  y: number;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const SKY_DAY = new THREE.Color(0x9fd8f5);
const SKY_GREY = new THREE.Color(0x9aa7b3);
const SKY_DUSK = new THREE.Color(0xf7a86b);
const SKY_NIGHT = new THREE.Color(0x18213f);
const SUN_DAY = new THREE.Color(0xfff2d6);
const SUN_NIGHT = new THREE.Color(0x8fa8ff);
const RAIN_DROPS = 1100;
const FLAKES = 700;
/** Tâm nhìn được trôi xa nhất bao nhiêu mét khỏi tâm mặc định của khu khi zoom sát vào (zoom theo con trỏ). */
const TARGET_ROAM = 24;
/** Khu không nhớ góc nhìn: bên trong quầy chợ (mỗi lần vào một quầy khác nhau). */
const FRESH_VIEW = new Set(['stall', 'market']);
/** Tông trời / ánh nắng theo mùa [màu, mức pha] - Xuân giữ nguyên. */
const SEASON_SKY: [THREE.Color, number][] = [
  [new THREE.Color(0x9fd8f5), 0],
  [new THREE.Color(0x8fd3f7), 0.25],
  [new THREE.Color(0xf2c48e), 0.3],
  [new THREE.Color(0xd6e2ec), 0.55],
];
const SEASON_SUN: [THREE.Color, number][] = [
  [new THREE.Color(0xffffff), 0],
  [new THREE.Color(0xffc670), 0.35],
  [new THREE.Color(0xff9a4a), 0.45],
  [new THREE.Color(0xe4f0ff), 0.5],
];
const GROUND_WARM = new THREE.Color(0xd9c9a0);
const GROUND_SNOW = new THREE.Color(0xe8eef4);
const BASE_ASPECT = 1.6;
/** Thời gian bấm giữ để lau vết bẩn (mili-giây). */
export const HOLD_MS = 650;

/** Renderer + camera + ánh sáng + bầu trời/thời tiết dùng chung; hiển thị một Area tại một thời điểm. */
export class Stage {
  /** held = số mili-giây người chơi giữ con trỏ trước khi thả (vết bẩn cần bấm giữ). */
  onPick: (pick: Pick, held: number) => void = () => {};
  /** Đang giữ con trỏ trên một vật (để vẽ vòng tiến độ bấm giữ): vật + mili-giây đã giữ; null = không giữ. */
  holding: { pick: Pick; ms: number } | null = null;
  /** Trả true nếu vật này được phép kéo (khi đó camera tạm khoá trong lúc kéo). */
  dragFilter: (pick: Pick) => boolean = () => false;
  /** Gọi liên tục khi đang kéo, với toạ độ mặt đất (x, z) dưới con trỏ; end = true ở lần cuối khi thả. */
  onDrag: (pick: Pick, x: number, z: number, end: boolean) => void = () => {};
  readonly env: Env = { t: 0, day: 1, night: 0, rain: 0, clouds: 0, wind: 0, dim: 0, noon: 0, season: 0, snow: 0, selectedSlot: null, editLayout: false, serving: null, editSelected: null };

  private renderer: THREE.WebGLRenderer;
  /** Vẽ cảnh qua lượt viền lem kiểu bút sáp (crayon.ts; tắt trong Cài đặt thì vẽ thẳng). */
  private pass: CrayonPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, BASE_ASPECT, 0.5, 120);
  private hemi = new THREE.HemisphereLight(0xffffff, 0xd9c9a0, 1.9);
  private sun = new THREE.DirectionalLight(0xfff2d6, 2.5);
  private sky = new THREE.Color();
  private current: Area;
  private clouds: THREE.Group[] = [];
  private cloudMat = toon(0xffffff, {});
  private stars: THREE.Points;
  private rain: THREE.LineSegments;
  private rainSeed: Float32Array;
  /** Hạt rơi theo mùa: bông tuyết (Đông) hoặc lá vàng cam (Thu). */
  private flakes: THREE.Points;
  private flakeSeed: Float32Array;
  /** Vệt gió (sợi trắng mảnh bay ngang) ở khu ngoài trời; life < 0 = đang nghỉ. */
  private streaks: { m: THREE.Line; life: number; max: number; speed: number; phase: number }[] = [];
  /** Camera đang lướt tới một chỗ (bấm ô nông trại) hoặc lướt về góc mặc định. */
  /** Góc nhìn đã nhớ của từng khu (setArea): rời khu thì lưu, quay lại thì trả. */
  private views = new Map<string, { target: THREE.Vector3; position: THREE.Vector3 }>();
  private camTween: { fromT: THREE.Vector3; toT: THREE.Vector3; fromP: THREE.Vector3; toP: THREE.Vector3; k: number; dur?: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private firstFrame = true;
  /** Giờ trong ngày để vẽ trời / đèn (phút từ 00:00) thay cho giờ của sim - chế độ thăm quán (F2): sim chạy một đoạn ca, trời theo giờ người đi thăm. */
  clockMinute: number | null = null;
  private controls: OrbitControls;
  private dragging: Pick | null = null;
  private lastAspect = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private game: Game,
    private areas: Area[],
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.pass = new CrayonPass(this.renderer);
    this.raycaster.layers.enableAll(); // bấm trúng cả đồ ở lớp phủ (crayon.ts tách bong bóng sang lớp riêng)
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = this.sky;

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    // Mây
    const rnd = seeded(11);
    for (let i = 0; i < 9; i++) {
      const cloud = new THREE.Group();
      for (let k = 0; k < 4; k++) mesh(cloud, G.ico(1, 1), this.cloudMat, { p: [(k - 1.5) * 1.1, rnd() * 0.4, rnd() * 0.6], s: 0.8 + rnd() * 0.7, cast: false, receive: false });
      cloud.position.set(-24 + rnd() * 48, 9 + rnd() * 4, -18 + rnd() * 10);
      cloud.scale.setScalar(0.8 + rnd() * 0.6);
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }

    // Sao
    const starPos = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) {
      const a = rnd() * Math.PI * 2;
      const up = 0.12 + rnd() * 0.85;
      const flat = Math.sqrt(1 - up * up);
      starPos.set([Math.cos(a) * flat * 70, up * 70, Math.sin(a) * flat * 70], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0, depthWrite: false }));
    this.scene.add(this.stars);

    // Mưa
    this.rainSeed = new Float32Array(RAIN_DROPS * 3).map(() => Math.random());
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_DROPS * 6), 3));
    this.rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xd6ecff, transparent: true, opacity: 0, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);

    // Tuyết / lá rơi: chấm tròn mềm vẽ bằng canvas
    const dot = document.createElement('canvas');
    dot.width = dot.height = 32;
    const dc = dot.getContext('2d')!;
    const grad = dc.createRadialGradient(16, 16, 2, 16, 16, 15);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    dc.fillStyle = grad;
    dc.fillRect(0, 0, 32, 32);
    this.flakeSeed = new Float32Array(FLAKES * 4).map(() => Math.random());
    const flakeGeo = new THREE.BufferGeometry();
    flakeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FLAKES * 3), 3));
    this.flakes = new THREE.Points(
      flakeGeo,
      new THREE.PointsMaterial({ map: new THREE.CanvasTexture(dot), size: 0.16, transparent: true, depthWrite: false, color: 0xffffff }),
    );
    this.flakes.frustumCulled = false;
    this.flakes.visible = false;
    this.scene.add(this.flakes);

    for (const area of areas) {
      area.root.visible = false;
      this.scene.add(area.root);
    }
    this.current = areas[0];

    // Con trỏ: kéo vật (nếu dragFilter cho phép) hoặc bấm chọn (con trỏ gần như không di chuyển).
    // Đăng ký TRƯỚC OrbitControls để kịp khoá camera khi bắt đầu kéo vật.
    let down: { x: number; y: number; at: number; pick: Pick | null } | null = null;
    canvas.addEventListener('pointerdown', (e) => {
      const pick = this.pickAt(e.clientX, e.clientY);
      down = { x: e.clientX, y: e.clientY, at: performance.now(), pick };
      if (pick && this.dragFilter(pick)) {
        this.dragging = pick;
        this.controls.enabled = false;
        canvas.setPointerCapture(e.pointerId);
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.dragging) {
        const g = this.groundAt(e.clientX, e.clientY);
        if (g) this.onDrag(this.dragging, g.x, g.z, false);
      } else if (e.pointerType === 'mouse') {
        canvas.style.cursor = this.pickAt(e.clientX, e.clientY) ? 'pointer' : 'grab';
      }
    });
    const release = (e: PointerEvent) => {
      const tap = !!down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8;
      if (this.dragging) {
        const g = this.groundAt(e.clientX, e.clientY);
        const picked = this.dragging;
        this.onDrag(picked, g?.x ?? 0, g?.z ?? 0, true);
        this.dragging = null;
        this.controls.enabled = true;
        // Chỉ bấm (không kéo) vật kéo được: coi như bấm chọn (hiện nút xoay / cất / bán)
        if (tap) this.onPick(picked, performance.now() - down!.at);
      } else if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) {
        const pick = this.pickAt(e.clientX, e.clientY);
        if (pick) this.onPick(pick, performance.now() - down.at);
      }
      down = null;
      this.holding = null;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('dblclick', () => this.resetView());

    // Camera: kéo để xoay, lăn chuột / chụm hai ngón để phóng to thu nhỏ, bấm đúp để về góc mặc định
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.rotateSpeed = 0.6;
    this.controls.minPolarAngle = 0.3;
    this.controls.maxPolarAngle = 1.36;
    // Zoom vào đúng chỗ con trỏ / tâm hai ngón đang chụm (không chỉ giữa màn hình); xem clampTarget
    this.controls.zoomToCursor = true;

    this.setArea(areas[0].id);
  }

  /**
   * Làm nóng trước các khu đang ẩn (chợ, nông trại, nhà kính, trong quầy chợ): lần đầu một vật liệu hiện ra, card đồ hoạ
   * mới biên dịch shader + nạp texture nên chuyển khu lần đầu bị khựng. Gọi lúc rảnh sau khi vào game: lần lượt từng khu,
   * bật hiện tạm thời để biên dịch shader (compileAsync, chạy song song nếu trình duyệt hỗ trợ) và nạp sẵn texture lên card.
   */
  async warmUp(): Promise<void> {
    const r = this.renderer;
    for (const area of [...this.areas]) {
      if (area === this.current || !this.areas.includes(area)) continue;
      const was = area.root.visible;
      area.root.visible = true;
      const job = r.compileAsync(area.root, this.camera, this.scene).catch(() => undefined);
      area.root.visible = was;
      const textures = new Set<THREE.Texture>();
      area.root.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        for (const mat of Array.isArray(m) ? m : m ? [m] : []) for (const v of Object.values(mat)) if (v instanceof THREE.Texture) textures.add(v);
      });
      for (const t of textures) r.initTexture(t);
      await job;
      // Nhường khung hình cho game giữa các khu
      await new Promise((ok) => requestAnimationFrame(ok));
    }
  }

  /** Thay một khu bằng bản dựng mới (vd quán lên hạng, phòng to hơn). Đang xem khu đó thì chuyển sang bản mới luôn. */
  replaceArea(old: Area, next: Area): void {
    const i = this.areas.indexOf(old);
    if (i < 0) return;
    this.scene.remove(old.root);
    this.areas[i] = next;
    next.root.visible = false;
    this.scene.add(next.root);
    if (this.current === old) {
      this.current = next;
      next.root.visible = true;
      this.resetView();
    }
  }

  get areaId(): string {
    return this.current.id;
  }

  setArea(id: string): void {
    const next = this.areas.find((a) => a.id === id);
    if (!next) return;
    // Nhớ góc nhìn (xoay / zoom) của khu đang rời - quay lại thì y như lúc đi. Đang lướt camera thì nhớ điểm cuối.
    if (next !== this.current && !FRESH_VIEW.has(this.current.id)) {
      const tw = this.camTween;
      this.views.set(this.current.id, { target: (tw?.toT ?? this.controls.target).clone(), position: (tw?.toP ?? this.camera.position).clone() });
    }
    this.current.root.visible = false;
    this.current = next;
    next.root.visible = true;
    this.camTween = null;
    this.resetView();
    const saved = FRESH_VIEW.has(next.id) ? undefined : this.views.get(next.id);
    if (saved) {
      this.controls.target.copy(saved.target);
      this.camera.position.copy(saved.position);
      this.controls.update();
    }
  }

  /** Đưa camera về góc mặc định của khu hiện tại và đặt lại giới hạn xoay/zoom. */
  resetView(): void {
    const { position, target, orbit } = this.current.view;
    const aspect = this.camera.aspect;
    // Màn hình hẹp/dọc: lùi camera để vẫn thấy trọn bề ngang của khu.
    const pull = Math.max(1, BASE_ASPECT / aspect);
    const offset = new THREE.Vector3(position[0] - target[0], position[1] - target[1], position[2] - target[2]).multiplyScalar(pull);
    const c = this.controls;
    c.target.set(...target);
    this.camera.position.copy(c.target).add(offset);
    const distance = offset.length();
    c.minDistance = distance * 0.3;
    // `zoomOut`: khu cho lùi xa hơn mặc định (quán: thấy cả bãi đất hoang quanh quán)
    c.maxDistance = distance * (this.current.view.zoomOut ?? 1.25);
    const azimuth = Math.atan2(offset.x, offset.z);
    c.minAzimuthAngle = azimuth - orbit;
    c.maxAzimuthAngle = azimuth + orbit;
    // Chợ: mở ra là lùi hết cỡ để thấy trọn biển LED quảng cáo
    if (this.current.id === 'market') this.camera.position.copy(c.target).add(offset.setLength(c.maxDistance));
    c.update();
  }

  /**
   * Lướt camera lại gần một điểm trên mặt đất (giữ nguyên hướng nhìn hiện tại), gần hơn mặc định theo `closer` (0.6 = còn 60% khoảng cách).
   * Dùng khi bấm ô nông trại để người chơi thấy đúng chỗ mình vừa chọn.
   */
  focusOn(x: number, z: number, closer = 0.62, y = 0): void {
    const c = this.controls;
    const { position, target } = this.current.view;
    const pull = Math.max(1, BASE_ASPECT / this.camera.aspect);
    const base = new THREE.Vector3(position[0] - target[0], position[1] - target[1], position[2] - target[2]).multiplyScalar(pull).length();
    const dir = this.camera.position.clone().sub(c.target).normalize();
    const toT = new THREE.Vector3(x, y, z);
    // Cho phép lại gần hơn giới hạn zoom thường (bấm sạp chợ: lướt hẳn vào sạp)
    c.minDistance = Math.min(c.minDistance, base * closer * 0.95);
    this.camTween = { fromT: c.target.clone(), toT, fromP: this.camera.position.clone(), toP: toT.clone().add(dir.multiplyScalar(base * closer)), k: 0 };
  }

  /**
   * Lướt camera nhìn vào (x, z) theo một góc cố định: `offset` = vị trí camera so với điểm nhìn (m).
   * `snap` = đặt ngay không lướt. Dùng cho bãi đất hoang (góc chéo từ trước bên phải, thấy trọn các lô).
   */
  focusAt(x: number, z: number, offset: [number, number, number], snap = false): void {
    const c = this.controls;
    const toT = new THREE.Vector3(x, 0, z);
    const toP = toT.clone().add(new THREE.Vector3(...offset));
    c.maxDistance = Math.max(c.maxDistance, toP.distanceTo(toT) * 1.05);
    if (snap) {
      c.target.copy(toT);
      this.camera.position.copy(toP);
      c.update();
      this.camTween = null;
      return;
    }
    this.camTween = { fromT: c.target.clone(), toT, fromP: this.camera.position.clone(), toP, k: 0, dur: 0.9 };
  }

  /** Đặt ngay camera nhìn vào (x, z) như focusOn nhưng không lướt (chuyển cảnh: dựng khu mới ở đúng góc cũ). */
  snapFocus(x: number, z: number, closer = 0.62): void {
    this.focusOn(x, z, closer);
    const tw = this.camTween!;
    this.controls.target.copy(tw.toT);
    this.camera.position.copy(tw.toP);
    this.controls.update();
    this.camTween = null;
  }

  /** Lướt camera về góc mặc định của khu hiện tại (bỏ zoom của focusOn); `dur` = thời gian lướt (giây). */
  unfocus(dur = 0.55): void {
    const { position, target } = this.current.view;
    const pull = Math.max(1, BASE_ASPECT / this.camera.aspect);
    const toT = new THREE.Vector3(...target);
    const toP = toT.clone().add(new THREE.Vector3(position[0] - target[0], position[1] - target[1], position[2] - target[2]).multiplyScalar(pull));
    this.camTween = { fromT: this.controls.target.clone(), toT, fromP: this.camera.position.clone(), toP, k: 0, dur };
  }

  private updateTween(dt: number): void {
    const tw = this.camTween;
    if (!tw) return;
    tw.k = Math.min(1, tw.k + dt / (tw.dur ?? 0.55));
    // Lướt dài (chuyển cảnh): nhanh dần rồi chậm dần; lướt ngắn: chậm dần
    const e = (tw.dur ?? 0.55) > 1 ? (tw.k < 0.5 ? 4 * tw.k ** 3 : 1 - (-2 * tw.k + 2) ** 3 / 2) : 1 - Math.pow(1 - tw.k, 3);
    this.controls.target.lerpVectors(tw.fromT, tw.toT, e);
    this.camera.position.lerpVectors(tw.fromP, tw.toP, e);
    this.controls.update();
    if (tw.k >= 1) this.camTween = null;
  }

  /**
   * Zoom theo con trỏ làm tâm nhìn trôi đi: càng lại gần thì được trôi xa khỏi tâm mặc định của khu (tối đa TARGET_ROAM m),
   * lùi ra hết cỡ thì tâm nhìn tự kéo về giữa khu - không bao giờ lạc ra ngoài bản đồ.
   */
  private clampTarget(): void {
    const c = this.controls;
    const [tx, ty, tz] = this.current.view.target;
    const d = this.camera.position.distanceTo(c.target);
    const near = c.minDistance;
    const far = c.maxDistance;
    const roam = TARGET_ROAM * Math.max(0, Math.min(1, (far - d) / Math.max(0.001, far - near)));
    const dx = c.target.x - tx;
    const dz = c.target.z - tz;
    const len = Math.hypot(dx, dz);
    const dy = c.target.y - ty;
    if (len <= roam && Math.abs(dy) <= 2) return;
    const k = len > roam ? roam / len : 1;
    const fix = new THREE.Vector3(tx + dx * k - c.target.x, Math.max(-2, Math.min(2, dy)) + ty - c.target.y, tz + dz * k - c.target.z);
    c.target.add(fix);
    this.camera.position.add(fix);
  }

  /** Toạ độ màn hình (px, theo viewport) của một điểm trong thế giới 3D - để hiệu ứng DOM bay ra từ vật thể. */
  toScreen(world: THREE.Vector3): { x: number; y: number } {
    const ndc = world.clone().project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((ndc.x + 1) / 2) * rect.width, y: rect.top + ((1 - ndc.y) / 2) * rect.height };
  }

  /** Vẽ một khung hình. Mọi khu đều được update để khi chuyển sang là thấy đúng trạng thái. */
  render(dt: number, speed: number): void {
    this.resize();
    this.updateEnv(dt, speed);
    for (const area of this.areas) area.update(this.env, dt, speed);
    this.updateSky(dt);
    this.updateStreaks(dt);
    this.updateFlakes(dt);
    this.updateTween(dt);
    if (!this.camTween) this.clampTarget();
    this.pass.render(this.scene, this.camera);
    this.firstFrame = false;
  }

  private resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (Math.abs(this.camera.aspect - this.lastAspect) > 0.02) {
      this.lastAspect = this.camera.aspect;
      this.views.clear(); // xoay máy / đổi cỡ cửa sổ: góc nhìn đã nhớ không còn hợp
      this.resetView();
    }
    this.controls.update();
  }

  private updateEnv(dt: number, speed: number): void {
    const { state, content } = this.game;
    const env = this.env;
    env.t += dt;
    const m = this.clockMinute ?? state.clock.minute;
    env.day = smooth(330, 420, m) * (1 - smooth(1050, 1170, m));
    env.night = 1 - env.day;
    const target = content.weathers.get(state.weather.id).visual;
    env.season = calendarOf(state.clock.day).season;
    wardrobe.winter = env.season === 3;
    wardrobe.rain = env.rain > 0.3;
    const snowTarget = env.season === 3 ? Math.max(0.35, target.snow ?? 0) : 0;
    const k = this.firstFrame ? 1 : Math.min(1, dt * 0.6 * Math.max(1, speed));
    env.rain += (target.rain - env.rain) * k;
    env.clouds += (target.clouds - env.clouds) * k;
    env.dim += (target.dim - env.dim) * k;
    env.snow += (snowTarget - env.snow) * k;
    // Nắng: 06:00 → 18:00 là nửa vòng; gắt nhất lúc 12:00, nhẹ lúc sáng sớm và chiều
    const arc = Math.max(0, Math.sin(((m - 360) / 720) * Math.PI));
    env.noon = arc * arc * env.day * (1 - env.dim);
    // Gió: nền theo thời tiết + gió nhẹ thay đổi theo giờ (sáng lặng, chiều lộng) và từng cơn ngẫu nhiên trong ngày.
    // Chỉ là hình ảnh nên dùng hàm tất định theo ngày/giờ, không đụng RNG của sim.
    const d = state.clock.day;
    const afternoon = smooth(600, 900, m) * (1 - smooth(1080, 1260, m));
    const gust = Math.max(0, Math.sin(m * 0.031 + d * 1.7) * Math.sin(m * 0.0113 + d * 0.9));
    const breeze = 0.08 + 0.22 * afternoon + 0.45 * gust * (0.4 + 0.6 * afternoon);
    // Mùa thu gió lộng hơn hẳn
    const autumn = env.season === 2 ? 0.3 : 0;
    const windTarget = Math.min(1, Math.max(target.wind, breeze) + target.wind * 0.3 * gust + autumn);
    env.wind += (windTarget - env.wind) * Math.min(1, dt * 0.8);
  }

  /**
   * Vệt gió: vài sợi chỉ mảnh (nét 1 px), ngắn, uốn lượn, mờ, trôi ngang qua khung nhìn khu ngoài trời - chỉ để "có cảm giác" gió.
   * Gió nhẹ: thỉnh thoảng 1–2 sợi; gió mạnh: tối đa STREAKS sợi, trôi nhanh và lượn nhiều hơn.
   */
  private updateStreaks(dt: number): void {
    const env = this.env;
    const STREAKS = 6;
    const POINTS = 10;
    const want = this.current.outdoor ? Math.min(STREAKS, Math.round(Math.max(0, env.wind - 0.15) * 7)) : 0;
    while (this.streaks.length < STREAKS) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(POINTS * 3), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      line.visible = false;
      line.frustumCulled = false;
      this.scene.add(line);
      this.streaks.push({ m: line, life: -1, max: 1, speed: 1, phase: Math.random() * 6 });
    }
    const t = this.controls.target;
    let active = this.streaks.filter((s) => s.life >= 0).length;
    for (const s of this.streaks) {
      if (s.life < 0) {
        if (active >= want || Math.random() > dt * 0.8) continue;
        s.life = 0;
        s.max = 1.8 + Math.random() * 1.2;
        s.speed = 2.5 + env.wind * 4 + Math.random();
        s.m.position.set(t.x - 14 + Math.random() * 22, 0.8 + Math.random() * 2.5, t.z - 8 + Math.random() * 16);
        s.m.visible = true;
        active++;
      }
      s.life += dt;
      const k = Math.min(1, s.life / s.max);
      s.m.position.x += s.speed * dt;
      // Sợi dài ~1.2 m, uốn lượn như dải lụa: sóng chạy dọc sợi theo thời gian
      const pos = s.m.geometry.getAttribute('position') as THREE.BufferAttribute;
      const amp = 0.08 + env.wind * 0.1;
      for (let i = 0; i < POINTS; i++) {
        const u = i / (POINTS - 1);
        pos.setXYZ(i, u * 1.2, Math.sin(u * 5 + env.t * 5 + s.phase) * amp * u, Math.cos(u * 3 + env.t * 3 + s.phase) * amp * 0.6);
      }
      pos.needsUpdate = true;
      (s.m.material as THREE.LineBasicMaterial).opacity = 0.45 * Math.sin(k * Math.PI) * (0.5 + 0.5 * env.day);
      if (k >= 1 || !this.current.outdoor) {
        s.life = -1;
        s.m.visible = false;
        active--;
      }
    }
  }

  private updateSky(dt: number): void {
    const env = this.env;
    const dusk = 4 * env.day * (1 - env.day);

    this.sky.copy(SKY_DAY).lerp(SKY_GREY, env.dim);
    // Tông trời theo mùa: Hạ trong và nắng, Thu ngả cam, Đông nhạt màu
    const [skyTint, skyK] = SEASON_SKY[env.season];
    if (skyK) this.sky.lerp(skyTint, skyK);
    this.sky.copy(SKY_NIGHT.clone().lerp(this.sky, env.day)).lerp(SKY_DUSK, dusk * 0.55);

    // Sáng sớm / chiều: nắng dịu; trưa: nắng gắt, cảnh sáng hơn hẳn
    this.hemi.intensity = 0.6 + (0.9 + 0.8 * env.noon) * env.day * (1 - 0.35 * env.dim);
    this.hemi.color.copy(SUN_NIGHT).lerp(new THREE.Color(0xffffff), env.day);
    this.sun.intensity = 0.5 + (1.15 + 1.9 * env.noon) * env.day * (1 - 0.6 * env.dim);
    // Khu tối hơn về đêm (quán ốc vỉa hè): giảm ánh trời, để đèn trong khu tự chiếu sáng
    const dark = (this.current.nightDark ?? 0) * env.night;
    this.hemi.intensity *= 1 - dark;
    this.sun.intensity *= 1 - dark * 0.9;
    this.sun.color.copy(SUN_NIGHT).lerp(SUN_DAY, env.day).lerp(SKY_DUSK, dusk * 0.5 + (1 - env.noon) * env.day * 0.3);
    // Ánh nắng theo mùa: Hạ vàng cam, Thu cam đậm, Đông trắng lạnh
    const [sunTint, sunK] = SEASON_SUN[env.season];
    if (sunK) {
      this.sun.color.lerp(sunTint, sunK * env.day);
      this.hemi.color.lerp(sunTint, sunK * 0.6 * env.day);
    }
    this.hemi.groundColor.copy(env.season === 3 ? GROUND_SNOW : GROUND_WARM);
    const angle = ((this.game.state.clock.minute - 360) / 720) * Math.PI;
    const [tx, ty, tz] = this.current.view.target;
    this.sun.position.set(tx - Math.cos(angle) * 14, ty + 8 + Math.max(0, Math.sin(angle)) * 12, tz + 10);
    this.sun.target.position.set(tx, ty, tz);

    (this.stars.material as THREE.PointsMaterial).opacity = env.night * (1 - env.clouds * 0.8);

    // Mây: số đám theo độ mây, trôi theo gió, xám đi khi trời xấu
    this.cloudMat.color.setRGB(1, 1, 1).lerp(new THREE.Color(0x76808c), env.dim).multiplyScalar(0.45 + 0.55 * env.day);
    this.clouds.forEach((cloud, i) => {
      cloud.visible = i < Math.round(2 + env.clouds * 7);
      cloud.position.x += dt * (0.25 + env.wind * 2.2);
      if (cloud.position.x > 26) cloud.position.x = -26;
    });

    // Mưa
    const mat = this.rain.material as THREE.LineBasicMaterial;
    mat.opacity = env.rain * 0.75;
    this.rain.visible = env.rain > 0.03;
    if (this.rain.visible) {
      const { min, max } = this.current.rainBox;
      const pos = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
      const slant = 0.15 + env.wind * 0.6;
      const roof = this.current.rainShelter;
      for (let i = 0; i < RAIN_DROPS; i++) {
        const y = (this.rainSeed[i * 3 + 1] = (this.rainSeed[i * 3 + 1] - dt * 1.6 + 1) % 1);
        const px = min[0] + this.rainSeed[i * 3] * (max[0] - min[0]) + (1 - y) * slant * 4;
        const py = min[1] + y * (max[1] - min[1]);
        const pz = min[2] + this.rainSeed[i * 3 + 2] * (max[2] - min[2]);
        // Trong khung mái che: không vẽ (cả giọt phía trên mái - camera nhìn từ trên xuống sẽ thấy như mưa trong quán)
        if (roof && px > roof.x1 && px < roof.x2 && pz > roof.z1 && pz < roof.z2) {
          pos.setXYZ(i * 2, 0, -100, 0);
          pos.setXYZ(i * 2 + 1, 0, -100, 0);
          continue;
        }
        pos.setXYZ(i * 2, px, py, pz);
        pos.setXYZ(i * 2 + 1, px - slant * 0.5, py + 0.55, pz);
      }
      pos.needsUpdate = true;
    }
  }

  /** Tuyết rơi lả tả (Đông) / lá vàng cam bay theo gió (Thu) trong vùng mưa của khu đang xem. */
  private updateFlakes(dt: number): void {
    const env = this.env;
    const autumn = env.season === 2;
    const count = env.season === 3 ? Math.round(FLAKES * env.snow) : autumn ? Math.round(30 + env.wind * 70) : 0;
    this.flakes.visible = count > 0;
    if (!count) return;
    const mat = this.flakes.material as THREE.PointsMaterial;
    mat.color.setHex(autumn ? 0xe08a2e : 0xffffff);
    mat.size = autumn ? 0.6 : 0.42 + env.snow * 0.12;
    mat.opacity = autumn ? 0.95 : 0.9;
    const { min, max } = this.current.rainBox;
    const pos = this.flakes.geometry.getAttribute('position') as THREE.BufferAttribute;
    const fall = autumn ? 0.16 : 0.12 + env.snow * 0.06;
    const drift = autumn ? 0.6 + env.wind * 2.5 : 0.3 + env.wind;
    const s = this.flakeSeed;
    for (let i = 0; i < FLAKES; i++) {
      if (i >= count) {
        pos.setXYZ(i, 0, -100, 0);
        continue;
      }
      const y = (s[i * 4 + 1] = (s[i * 4 + 1] - dt * fall * (0.7 + s[i * 4 + 3] * 0.6) + 1) % 1);
      const wob = Math.sin(env.t * (1.2 + s[i * 4 + 3]) + i) * 0.35;
      const w = max[0] - min[0];
      const px = min[0] + ((((s[i * 4] * w + (1 - y) * drift * 4 + wob) % w) + w) % w);
      pos.setXYZ(i, px, min[1] + y * (max[1] - min[1]), min[2] + s[i * 4 + 2] * (max[2] - min[2]) + wob * 0.5);
    }
    pos.needsUpdate = true;
  }

  private aim(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
  }

  /** Điểm trên mặt đất (y = 0) dưới con trỏ. */
  private groundAt(clientX: number, clientY: number): THREE.Vector3 | null {
    this.aim(clientX, clientY);
    return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  }

  private pickAt(clientX: number, clientY: number): Pick | null {
    this.aim(clientX, clientY);
    hits: for (const hit of this.raycaster.intersectObject(this.current.root, true)) {
      // Raycaster không tự bỏ qua vật đang ẩn (bong bóng đã tắt...) nên tự kiểm tra
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (!o.visible) continue hits;
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
        if (o.userData.pick) return o.userData.pick as Pick;
      }
    }
    return null;
  }
}

/** Cho các node có userData.sway đung đưa theo gió. Gọi trong Area.update. */
export function sway(nodes: THREE.Object3D[], env: Env): void {
  const amp = 0.02 + env.wind * 0.11;
  for (const n of nodes) {
    n.rotation.z = Math.sin(env.t * (1.2 + env.wind * 2) + n.userData.sway) * amp;
    n.rotation.x = Math.cos(env.t * 0.9 + n.userData.sway) * amp * 0.5;
  }
}

export function collectSway(root: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o.userData.sway !== undefined) out.push(o);
  });
  return out;
}
