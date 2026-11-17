import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Game } from '../../sim/game';
import { G, mesh, seeded, toon, type V3 } from './toon';

/** Thứ người chơi có thể bấm vào trong cảnh 3D. Gắn vào object bằng `obj.userData.pick = {...}`. */
export type Pick = { type: 'slot'; id: string } | { type: 'stall'; id: string } | { type: 'table'; id: string };

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
  selectedSlot: string | null;
  /** Đang ở chế độ sắp xếp bàn ghế. */
  editLayout: boolean;
}

/**
 * Một KHU VỰC = một "màn hình" 3D. Thêm khu mới: viết class implements Area trong ./areas
 * rồi thêm vào mảng areas ở app.ts — nút chuyển khu tự xuất hiện.
 */
export interface Area {
  id: string;
  label: string;
  icon: string;
  /** Gợi ý thao tác hiện dưới tên khu. */
  hint: string;
  root: THREE.Group;
  /** Góc nhìn mặc định; `orbit` là góc xoay ngang tối đa sang mỗi bên (radian). */
  view: { position: V3; target: V3; orbit: number };
  /** Vùng mưa rơi (trong nhà thì chỉ mưa phía ngoài cửa sổ). */
  rainBox: { min: V3; max: V3 };
  /** Đồng bộ hình ảnh với game.state. dt: giây thực; speed: tốc độ game. */
  update(env: Env, dt: number, speed: number): void;
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
const BASE_ASPECT = 1.6;

/** Renderer + camera + ánh sáng + bầu trời/thời tiết dùng chung; hiển thị một Area tại một thời điểm. */
export class Stage {
  onPick: (pick: Pick) => void = () => {};
  /** Trả true nếu vật này được phép kéo (khi đó camera tạm khoá trong lúc kéo). */
  dragFilter: (pick: Pick) => boolean = () => false;
  /** Gọi liên tục khi đang kéo, với toạ độ mặt đất (x, z) dưới con trỏ; end = true ở lần cuối khi thả. */
  onDrag: (pick: Pick, x: number, z: number, end: boolean) => void = () => {};
  readonly env: Env = { t: 0, day: 1, night: 0, rain: 0, clouds: 0, wind: 0, dim: 0, selectedSlot: null, editLayout: false };

  private renderer: THREE.WebGLRenderer;
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
  private raycaster = new THREE.Raycaster();
  private firstFrame = true;
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

    for (const area of areas) {
      area.root.visible = false;
      this.scene.add(area.root);
    }
    this.current = areas[0];

    // Con trỏ: kéo vật (nếu dragFilter cho phép) hoặc bấm chọn (con trỏ gần như không di chuyển).
    // Đăng ký TRƯỚC OrbitControls để kịp khoá camera khi bắt đầu kéo vật.
    let down: { x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY };
      const pick = this.pickAt(e.clientX, e.clientY);
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
      if (this.dragging) {
        const g = this.groundAt(e.clientX, e.clientY);
        this.onDrag(this.dragging, g?.x ?? 0, g?.z ?? 0, true);
        this.dragging = null;
        this.controls.enabled = true;
      } else if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) {
        const pick = this.pickAt(e.clientX, e.clientY);
        if (pick) this.onPick(pick);
      }
      down = null;
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

    this.setArea(areas[0].id);
  }

  get areaId(): string {
    return this.current.id;
  }

  setArea(id: string): void {
    const next = this.areas.find((a) => a.id === id);
    if (!next) return;
    this.current.root.visible = false;
    this.current = next;
    next.root.visible = true;
    this.resetView();
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
    c.minDistance = distance * 0.4;
    c.maxDistance = distance * 1.25;
    const azimuth = Math.atan2(offset.x, offset.z);
    c.minAzimuthAngle = azimuth - orbit;
    c.maxAzimuthAngle = azimuth + orbit;
    c.update();
  }

  /** Vẽ một khung hình. Mọi khu đều được update để khi chuyển sang là thấy đúng trạng thái. */
  render(dt: number, speed: number): void {
    this.resize();
    this.updateEnv(dt, speed);
    for (const area of this.areas) area.update(this.env, dt, speed);
    this.updateSky(dt);
    this.renderer.render(this.scene, this.camera);
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
      this.resetView();
    }
    this.controls.update();
  }

  private updateEnv(dt: number, speed: number): void {
    const { state, content } = this.game;
    const env = this.env;
    env.t += dt;
    const m = state.clock.minute;
    env.day = smooth(330, 420, m) * (1 - smooth(1050, 1170, m));
    env.night = 1 - env.day;
    const target = content.weathers.get(state.weather.id).visual;
    const k = this.firstFrame ? 1 : Math.min(1, dt * 0.6 * Math.max(1, speed));
    env.rain += (target.rain - env.rain) * k;
    env.clouds += (target.clouds - env.clouds) * k;
    env.wind += (target.wind - env.wind) * k;
    env.dim += (target.dim - env.dim) * k;
  }

  private updateSky(dt: number): void {
    const env = this.env;
    const dusk = 4 * env.day * (1 - env.day);

    this.sky.copy(SKY_DAY).lerp(SKY_GREY, env.dim);
    this.sky.copy(SKY_NIGHT.clone().lerp(this.sky, env.day)).lerp(SKY_DUSK, dusk * 0.55);

    this.hemi.intensity = 0.6 + 1.3 * env.day * (1 - 0.35 * env.dim);
    this.hemi.color.copy(SUN_NIGHT).lerp(new THREE.Color(0xffffff), env.day);
    this.sun.intensity = 0.5 + 2 * env.day * (1 - 0.6 * env.dim);
    this.sun.color.copy(SUN_NIGHT).lerp(SUN_DAY, env.day).lerp(SKY_DUSK, dusk * 0.5);
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
      for (let i = 0; i < RAIN_DROPS; i++) {
        const y = (this.rainSeed[i * 3 + 1] = (this.rainSeed[i * 3 + 1] - dt * 1.6 + 1) % 1);
        const px = min[0] + this.rainSeed[i * 3] * (max[0] - min[0]) + (1 - y) * slant * 4;
        const py = min[1] + y * (max[1] - min[1]);
        const pz = min[2] + this.rainSeed[i * 3 + 2] * (max[2] - min[2]);
        pos.setXYZ(i * 2, px, py, pz);
        pos.setXYZ(i * 2 + 1, px - slant * 0.5, py + 0.55, pz);
      }
      pos.needsUpdate = true;
    }
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
    for (const hit of this.raycaster.intersectObject(this.current.root, true)) {
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
