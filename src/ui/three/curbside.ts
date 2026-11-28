import * as THREE from 'three';
import { CAR_COLORS, CAR_KINDS, CHROME, GLASS, TRIM, carTrim, makeCar, makeScooter, setVehicleLights, side, sideGlass, slopeGlass, wheel } from './farmkit';
import { adultShape, animatePerson, LOOKS, makePerson } from './models';
import { signText } from './cuisine';
import { Chatter } from './chatter';
import { ROAD_MID, SIDEWALK } from './street';
import { terrazzoSidewalk } from './floortex';
import { arrivalMode } from '../../sim/systems/customers';
import { emojiSprite, G, group, mesh } from './toon';
import { mergeAdded } from './merge';

/**
 * TRƯỚC CỬA QUÁN (giai đoạn 15) - dùng chung cho cả 4 phong cách quán:
 *  - Vỉa hè + con đường 2 làn phía trước (quán ốc đã có sẵn đường trong street.ts, chỉ thêm xe cộ), xe chạy qua lại.
 *  - Bãi đậu ô tô sát tường TRÁI quán, bãi giữ xe máy nằm ngoài bãi ô tô (cùng bên trái), bác bảo vệ đứng cạnh chòi gác ở bãi xe máy.
 *    Bên phải quán để trống (dành cho mở rộng quán sau này).
 *  - Khách tới bằng 3 cách (chọn tất định theo id nhóm - chỉ là hình, sim không biết): đi bộ dọc vỉa hè, chạy xe máy vào bãi
 *    phải, lái ô tô vào bãi trái. Xe đậu tới khi cả nhóm ra về; khách đi bộ từ chỗ đậu tới cửa quán rồi mới vào.
 * Toạ độ mét của cảnh quán (cửa ở giữa, z = frontZ là mép trước quán).
 */

type Mode = 'walk' | 'moto' | 'car';
type P = [number, number];

interface GuestRide {
  g: THREE.Group;
  rider: THREE.Group | null;
  mode: Exclude<Mode, 'walk'>;
  slot: number;
  path: P[];
  phase: 'arrive' | 'parked' | 'leave';
  heading: number;
}

interface Through {
  g: THREE.Group;
  dir: 1 | -1;
  rider: THREE.Group | null;
  wheels: THREE.Object3D[];
}

const COLORS = [0xe2574c, 0x4a9bd8, 0xf2c94c, 0xf3f3f3, 0x2a2d35, 0x5fae57, 0x9a6bd1, 0xe2703a, 0xf08fb0, 0x8a96a3, 0x3fb6a8];
const ROAD_HALF = 26;
const DRIVE = 5.5; // m/giây thực
const THROUGH = 4.2;
/** Bãi xe máy: mép trong cách tường trái quán MOTO_X1 m (ngay ngoài bãi ô tô), rộng MOTO_W m. */
const MOTO_X1 = 5.8;
export const MOTO_W = 4.7;

export interface CurbDims {
  halfW: number;
  frontZ: number;
  /** Mép sau quán (bãi xe chạy dọc tường bên từ đây tới mép trước). */
  backZ: number;
  door: P;
  /** Quán ốc đã tự vẽ vỉa hè + đường (street.ts). */
  hasRoad: boolean;
  /** Vỉa hè lát gạch terrazzo rãnh cong (quán Việt). */
  terrazzo?: boolean;
}

/** Cả hai bãi đều bên trái quán: đầu xe quay về phía quán (+x). */
function parkedHeading(_mode: Exclude<Mode, 'walk'>): number {
  return 0;
}

export class Curbside {
  private rides = new Map<number, GuestRide>();
  private through: Through[] = [];
  private guard: THREE.Group;
  /** Bác bảo vệ nhắc khách lúc có xe máy vào bãi. */
  private guardTalk: Chatter;
  private lanes: [number, number];
  private motoSlots: P[] = [];
  private carSlots: P[] = [];
  private sidewalkZ: number;
  /** Minibus du lịch (sự kiện xe du lịch): đỗ sát vỉa hè trước cửa tới khi cả đoàn ra về. */
  private bus: { g: THREE.Group; phase: 'arrive' | 'parked' | 'leave'; wheels: THREE.Object3D[] } | null = null;
  private busStop: P;
  private tourIds = new Set<number>();
  /** Lối chạy xe dọc mỗi bãi (x): xe chạy theo lối này rồi rẽ vào chỗ, đầu xe hướng vào tường quán. */
  private aisle: { moto: number; car: number };

  constructor(private root: THREE.Object3D, private d: CurbDims) {
    const { halfW, frontZ } = d;
    this.lanes = [frontZ + ROAD_MID - 1.2, frontZ + ROAD_MID + 1.6];
    this.busStop = [d.door[0] - 2.6, frontZ + SIDEWALK + 0.95];
    this.sidewalkZ = frontZ + 2.1;
    this.aisle = { moto: -halfW - MOTO_X1 - 3.9, car: -halfW - 4.6 };
    // Đường, vỉa hè, hai bãi xe (vạch, biển P): cảnh tĩnh → gộp mesh (merge.ts)
    mergeAdded(root, () => {
      if (!d.hasRoad) this.buildRoad();
      this.buildLots();
    }, false);
    this.guard = this.buildGuard(-halfW - MOTO_X1 - 5.1, frontZ + 1.4);
    this.guardTalk = new Chatter(this.guard, ['Gửi xe bên này nha!', 'Vô từ từ thôi nha!', 'Dắt xe vô trong nè!', 'Nhớ lấy vé xe nha!'], 1.95, 3, 0.2);
    this.buildThrough();
    // (chỉ bản dev) ?fullpark: lấp kín hai bãi bằng xe đậu sẵn để xem bãi đầy trông ra sao
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('fullpark')) this.fillLots();
  }

  /** Xe đậu kín bãi (chỉ để xem - không gắn với nhóm khách nào). */
  private fillLots(): void {
    this.motoSlots.forEach(([x, z], i) => {
      const g = makeScooter(COLORS[(i * 7 + 2) % COLORS.length], makePerson(LOOKS[i % LOOKS.length]));
      (g.children[g.children.length - 1] as THREE.Object3D).visible = false; // người lái đã xuống xe
      g.position.set(x, 0, z);
      g.rotation.y = parkedHeading('moto');
      this.root.add(g);
    });
    this.carSlots.forEach(([x, z], i) => {
      const g = makeCar(CAR_COLORS[(i * 5 + 1) % CAR_COLORS.length], CAR_KINDS[i % CAR_KINDS.length]);
      g.position.set(x, 0, z);
      g.rotation.y = parkedHeading('car');
      this.root.add(g);
    });
    this.motoSlots = [];
    this.carSlots = [];
  }

  /** Vỉa hè, bó vỉa, lòng đường + vạch giữa (như quán ốc) cho các quán trong nhà. */
  private buildRoad(): void {
    const r = this.root;
    const { frontZ } = this.d;
    mesh(r, G.box(70, 0.2, SIDEWALK), 0xcfcbc2, { p: [0, -0.1, frontZ + SIDEWALK / 2], cast: false });
    // Quán Việt: vỉa hè lát gạch terrazzo rãnh cong (floortex.ts)
    if (this.d.terrazzo) terrazzoSidewalk(r, 70, SIDEWALK - 0.12, frontZ + SIDEWALK / 2 - 0.06);
    mesh(r, G.box(70, 0.22, 0.25), 0xe6e2da, { p: [0, -0.05, frontZ + SIDEWALK], cast: false });
    mesh(r, G.box(70, 0.18, 7), 0x5c5f66, { p: [0, -0.14, frontZ + ROAD_MID], cast: false });
    for (let x = -30; x <= 30; x += 3) mesh(r, G.box(1.4, 0.02, 0.15), 0xf3efe6, { p: [x, -0.04, frontZ + ROAD_MID], cast: false });
  }

  /**
   * Bãi xe máy (phải) + bãi ô tô (trái) chạy DỌC theo tường bên của quán, đầu xe hướng vào tường - quán nâng hạng sâu thêm
   * thì bãi dài ra, thêm chỗ. Nền xám, vạch trắng, biển P ở đầu bãi sát vỉa hè.
   */
  private buildLots(): void {
    const r = this.root;
    const { halfW, frontZ, backZ } = this.d;
    const z1 = backZ + 0.6;
    const z2 = frontZ - 0.2;
    const len = z2 - z1;
    // Xe máy: 2 dãy dọc tường (dãy trong sát tường, dãy ngoài), mỗi chỗ cách 0.62 m
    // (bên trái, ngoài bãi ô tô; đầu xe quay về phía quán)
    const mx1 = -halfW - MOTO_X1;
    const mx2 = mx1 - MOTO_W;
    mesh(r, G.box(mx1 - mx2, 0.05, len + 0.4), 0xa4a7ad, { p: [(mx1 + mx2) / 2, 0.01, (z1 + z2) / 2], cast: false, receive: true });
    const nMoto = Math.floor(len / 0.62);
    for (const x of [mx1 - 0.65, mx1 - 2.35]) {
      for (let k = 0; k < nMoto; k++) this.motoSlots.push([x, z2 - 0.35 - k * 0.62]);
      for (let k = 0; k <= nMoto; k++) mesh(r, G.box(1.0, 0.01, 0.03), 0xf3efe6, { p: [x, 0.04, z2 - 0.04 - k * 0.62], cast: false });
    }
    // Ô tô: 1 dãy dọc tường, mỗi chỗ rộng 1.8 m
    const cx1 = -halfW - 0.5;
    const cx2 = -halfW - 5.6;
    mesh(r, G.box(cx1 - cx2, 0.05, len + 0.4), 0x9ea2a8, { p: [(cx1 + cx2) / 2, 0.01, (z1 + z2) / 2], cast: false, receive: true });
    const nCar = Math.floor(len / 1.8);
    for (let k = 0; k < nCar; k++) this.carSlots.push([-halfW - 1.9, z2 - 0.9 - k * 1.8]);
    for (let k = 0; k <= nCar; k++) mesh(r, G.box(2.6, 0.01, 0.05), 0xf3efe6, { p: [-halfW - 1.9, 0.04, z2 - k * 1.8], cast: false });
    this.sign(mx2 + 0.2, frontZ + 0.3, 'GIỮ XE', '🏍️');
    this.sign(cx2 + 0.2, frontZ + 0.3, 'Ô TÔ', '🚗');
  }

  private sign(x: number, z: number, text: string, icon: string): void {
    const g = group(this.root, { p: [x, 0, z] });
    mesh(g, G.cyl(0.04, 0.04, 1.9, 8), 0x8a96a3, { p: [0, 0.95, 0] });
    mesh(g, G.box(0.62, 0.62, 0.05), 0x2f6fbf, { p: [0, 2.05, 0] });
    const p = signText('P', '#ffffff', 0.5, 0.5);
    p.position.set(0, 2.05, 0.035);
    g.add(p);
    mesh(g, G.box(0.9, 0.28, 0.04), 0xfffaf1, { p: [0, 1.55, 0] });
    const t = signText(text, '#2f3a4a', 0.86, 0.26);
    t.position.set(0, 1.55, 0.03);
    g.add(t);
    const ic = emojiSprite(icon, 0.32);
    ic.position.set(0, 2.6, 0);
    g.add(ic);
  }

  /** Bác bảo vệ: áo xanh nhạt, quần xanh đen, mũ kê-pi, còi; chòi gác + ghế nhựa bên cạnh. */
  private buildGuard(x: number, z: number): THREE.Group {
    const r = this.root;
    const booth = group(r, { p: [x - 1.7, 0, z - 0.9] });
    mesh(booth, G.box(1.1, 2.0, 1.0), 0xe9e4d8, { p: [0, 1.0, 0] });
    mesh(booth, G.box(1.25, 0.1, 1.15), 0x2f6fbf, { p: [0, 2.05, 0] });
    mesh(booth, G.box(0.8, 0.6, 0.04), 0x9fd0ef, { p: [0, 1.35, 0.51], cast: false });
    const lbl = signText('BẢO VỆ', '#2f3a4a', 0.9, 0.2);
    lbl.position.set(0, 1.85, 0.52);
    booth.add(lbl);
    const stool = group(r, { p: [x - 0.9, 0, z + 0.2] });
    mesh(stool, G.cyl(0.2, 0.17, 0.05, 12), 0xe2574c, { p: [0, 0.42, 0] });
    for (const [sx, sz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) mesh(stool, G.cyl(0.025, 0.025, 0.42, 6), 0xe2574c, { p: [sx, 0.21, sz] });
    const p = makeGuard();
    p.position.set(x, 0, z);
    p.rotation.y = 0.4;
    r.add(p);
    return p;
  }

  /** Xe chạy ngang qua trên đường: ô tô, xe tải nhỏ, xe máy nhiều màu, 2 chiều. */
  private buildThrough(): void {
    const kinds = ['scooter', 'car', 'scooter', 'car', 'scooter', 'car', 'scooter', 'car'] as const;
    kinds.forEach((kind, i) => {
      const dir: 1 | -1 = i % 2 ? -1 : 1;
      const color = COLORS[(i * 3 + 1) % COLORS.length];
      const rider = kind === 'scooter' ? makePerson(LOOKS[(i * 5 + 3) % LOOKS.length], 'none', adultShape(i * 11 + 4)) : null;
      const g = kind === 'car' ? makeCar(CAR_COLORS[(i * 7 + 2) % CAR_COLORS.length], CAR_KINDS[(i >> 1) % CAR_KINDS.length]) : makeScooter(color, rider!);
      const lane = this.lanes[dir > 0 ? 0 : 1];
      g.position.set(-ROAD_HALF + (Math.floor(i / 2) + 0.3 + (i % 2) * 0.5) * (ROAD_HALF / 2), 0, lane + (rider ? ((i * 37) % 7) / 10 - 0.3 : 0));
      g.rotation.y = dir > 0 ? 0 : Math.PI;
      this.root.add(g);
      const wheels: THREE.Object3D[] = [];
      g.traverse((o) => o instanceof THREE.Mesh && o.geometry.type === 'CylinderGeometry' && o.rotation.x !== 0 && wheels.push(o));
      this.through.push({ g, dir, rider, wheels });
    });
  }

  /** Nhóm khách này tới bằng gì: theo sim (`arrivalMode`, sim tính luôn thời gian gửi xe trước khi vào quán). */
  private modeOf(partyId: number): Mode {
    return arrivalMode(partyId);
  }

  /** Còn đang chạy xe vào bãi / minibus chưa đỗ: chưa cho khách xuống xe. */
  holding(partyId: number): boolean {
    if (this.tourIds.has(partyId)) return this.bus?.phase !== 'parked';
    return this.rides.get(partyId)?.phase === 'arrive';
  }

  /** Cửa minibus (phía vỉa hè). */
  private busDoor(): P {
    return [this.busStop[0] + 1.3, this.d.frontZ + SIDEWALK - 0.35];
  }

  /** Chỗ khách xuất hiện (đầu đường vỉa hè, chỗ xe vừa đậu, hoặc cửa minibus). */
  spawnOf(partyId: number): P {
    if (this.tourIds.has(partyId)) return this.busDoor();
    const ride = this.rides.get(partyId);
    if (ride) return this.slotOf(ride);
    return [this.d.door[0] + (partyId % 2 ? 7 : -7), this.sidewalkZ];
  }

  /** Các điểm đi qua lúc vào quán: từ chỗ đậu ra vỉa hè (không xuyên tường bên), rồi tới cửa. */
  entryVia(partyId: number): P[] {
    const ride = this.rides.get(partyId);
    if (!ride) return [this.d.door];
    const aisle = this.aisle[ride.mode];
    return [[aisle, this.slotOf(ride)[1]], [aisle, this.sidewalkZ], this.d.door];
  }

  /** Đường ra về sau khi bước ra cửa: tới xe của nhóm, hoặc đi bộ dọc vỉa hè. */
  exitOf(partyId: number): P[] {
    const ride = this.rides.get(partyId);
    if (ride) {
      const aisle = this.aisle[ride.mode];
      const slot = this.slotOf(ride);
      return [[aisle, this.sidewalkZ], [aisle, slot[1]], slot];
    }
    if (this.tourIds.has(partyId)) return [this.busDoor()];
    return [[this.d.door[0] + (partyId % 2 ? -8 : 8), this.sidewalkZ]];
  }

  private makeBus(): { g: THREE.Group; wheels: THREE.Object3D[] } {
    return makeMinibus(this.root);
  }

  /** Minibus: có đoàn khách thì chạy tới đỗ trước cửa; đoàn về hết (sim lẫn trên cảnh) thì chạy đi. */
  private updateBus(dt: number, tour: number[], present: Set<number>, instant: boolean): void {
    for (const id of tour) this.tourIds.add(id);
    const anyLeft = tour.length > 0 || [...this.tourIds].some((id) => present.has(id));
    if (!this.bus && tour.length) {
      const { g, wheels } = this.makeBus();
      g.position.set(instant ? this.busStop[0] : -ROAD_HALF, 0, this.busStop[1]);
      this.bus = { g, wheels, phase: instant ? 'parked' : 'arrive' };
    }
    const bus = this.bus;
    if (!bus) return;
    if (bus.phase === 'parked' && !anyLeft) bus.phase = 'leave';
    if (bus.phase === 'parked') return;
    const target = bus.phase === 'arrive' ? this.busStop[0] : ROAD_HALF;
    const left = target - bus.g.position.x;
    // Chậm dần khi sắp đỗ
    const v = bus.phase === 'arrive' ? Math.max(1.2, Math.min(DRIVE, left * 1.2)) : DRIVE;
    const step = Math.min(left, v * dt);
    bus.g.position.x += step;
    for (const w of bus.wheels) w.rotation.y += step * 3;
    if (left - step < 1e-3) {
      if (bus.phase === 'arrive') bus.phase = 'parked';
      else {
        this.root.remove(bus.g);
        this.bus = null;
        this.tourIds.clear();
      }
    }
  }

  private slotOf(ride: GuestRide): P {
    const s = (ride.mode === 'moto' ? this.motoSlots : this.carSlots)[ride.slot];
    // Chỗ khách đứng xuống xe: phía đuôi xe (ngoài lối đi)
    return ride.mode === 'moto' ? [s[0] + 0.85, s[1]] : [s[0] - 1.6, s[1]];
  }

  /**
   * Mỗi khung hình: nhóm mới tới thì có thể chạy xe vào bãi; nhóm đã về hết (không còn ai trên cảnh) thì xe chạy đi.
   * `parties` = nhóm đang có trong sim, `present` = nhóm còn người trên cảnh, `instant` = lần vẽ đầu (xe đậu sẵn).
   */
  update(t: number, dt: number, night: number, all: { id: number; tour?: boolean }[], present: Set<number>, instant: boolean): void {
    const { lanes } = this;
    this.updateBus(dt, all.filter((p) => p.tour).map((p) => p.id), present, instant);
    const parties = all.filter((p) => !p.tour).map((p) => p.id);
    for (const id of parties) {
      if (this.rides.has(id) || present.has(id)) continue;
      const mode = this.modeOf(id);
      if (mode === 'walk') continue;
      const slots = mode === 'moto' ? this.motoSlots : this.carSlots;
      const used = new Set([...this.rides.values()].filter((r) => r.mode === mode).map((r) => r.slot));
      const slot = slots.findIndex((_, i) => !used.has(i));
      if (slot < 0) continue; // bãi đầy: nhóm này đi bộ (gửi xe chỗ khác)
      const [sx, sz] = slots[slot];
      const color = COLORS[(id * 5) % COLORS.length];
      const rider = mode === 'moto' ? makePerson(LOOKS[id % LOOKS.length], 'none', adultShape(id * 3 + 1)) : null;
      const g = mode === 'moto' ? makeScooter(color, rider!) : makeCar(CAR_COLORS[(id * 5) % CAR_COLORS.length], CAR_KINDS[(id * 7) % CAR_KINDS.length]);
      // Chạy trên đường tới đầu bãi → rẽ vào lối đi dọc bãi → quay đầu xe vào tường quán
      const aisle = this.aisle[mode];
      const path: P[] = mode === 'moto' ? [[aisle + 12, lanes[1]], [aisle, lanes[1]], [aisle, sz], [sx, sz]] : [[aisle - 12, lanes[0]], [aisle, lanes[0]], [aisle, sz], [sx, sz]];
      const ride: GuestRide = { g, rider, mode, slot, path, phase: instant ? 'parked' : 'arrive', heading: 0 };
      const start = instant ? path[path.length - 1] : path[0];
      g.position.set(start[0], 0, start[1]);
      ride.heading = instant ? parkedHeading(mode) : mode === 'moto' ? Math.PI : 0;
      g.rotation.y = ride.heading;
      if (instant) ride.path = [];
      else ride.path.shift();
      if (rider) rider.visible = !instant;
      this.root.add(g);
      this.rides.set(id, ride);
    }
    // Nhóm đã ra về hết người: xe lùi ra đường rồi chạy mất
    const alive = new Set(parties);
    for (const [id, ride] of this.rides) {
      if (ride.phase !== 'parked' || alive.has(id) || present.has(id)) continue;
      const aisle = this.aisle[ride.mode];
      const pz = ride.g.position.z;
      ride.path = ride.mode === 'moto' ? [[aisle, pz], [aisle, lanes[0]], [aisle + 16, lanes[0]]] : [[aisle, pz], [aisle, lanes[1]], [aisle - 16, lanes[1]]];
      ride.phase = 'leave';
      if (ride.rider) ride.rider.visible = true;
    }
    for (const [id, ride] of this.rides) {
      if (ride.phase === 'parked') continue;
      let budget = DRIVE * dt;
      while (budget > 0 && ride.path.length) {
        const [tx, tz] = ride.path[0];
        const p = ride.g.position;
        const dx = tx - p.x;
        const dz = tz - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1e-6) {
          ride.path.shift();
          continue;
        }
        const want = Math.atan2(-dz, dx);
        let diff = want - ride.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ride.heading += diff * Math.min(1, dt * 8);
        ride.g.rotation.y = ride.heading;
        const step = Math.min(dist, budget);
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;
        budget -= step;
        if (step >= dist) ride.path.shift();
      }
      if (ride.rider) animatePerson(ride.rider, t, { sit: true, ride: true });
      if (!ride.path.length) {
        if (ride.phase === 'arrive') {
          ride.phase = 'parked';
          ride.heading = parkedHeading(ride.mode);
          ride.g.rotation.y = ride.heading;
          if (ride.rider) ride.rider.visible = false;
        } else {
          this.root.remove(ride.g);
          this.rides.delete(id);
        }
      }
    }
    // Xe chạy qua
    for (const v of this.through) {
      v.g.position.x += v.dir * THROUGH * dt;
      if (v.g.position.x > ROAD_HALF) v.g.position.x = -ROAD_HALF;
      if (v.g.position.x < -ROAD_HALF) v.g.position.x = ROAD_HALF;
      for (const w of v.wheels) w.rotation.y += THROUGH * dt * 3;
      v.g.position.y = Math.abs(Math.sin(t * 14 + v.g.position.x)) * 0.012;
      if (v.rider) animatePerson(v.rider, t, { sit: true, ride: true });
    }
    setVehicleLights(night);
    // Bác bảo vệ: xe máy đang vào bãi thì quay ra vẫy tay chỉ chỗ; rảnh thì đứng ngó đường
    const busy = [...this.rides.values()].some((r) => r.mode === 'moto' && r.phase !== 'parked');
    const face = busy ? 1.2 : 0.4 + Math.sin(t * 0.3) * 0.5;
    this.guard.rotation.y += (face - this.guard.rotation.y) * Math.min(1, dt * 3);
    animatePerson(this.guard, t, { wave: busy ? 1 : 0 });
    this.guardTalk.update(t, busy);
  }
}

/**
 * Minibus du lịch 16 chỗ (chạy theo +x): mũi xe dốc, kính chắn gió lớn, dãy cửa sổ hai bên, cửa trượt phía vỉa hè (−z),
 * sọc cam + xanh ngọc dọc thân, cục lạnh trên nóc, chữ "DU LỊCH" bên hông phía đường.
 */
export function makeMinibus(parent: THREE.Object3D | null = null): { g: THREE.Group; wheels: THREE.Object3D[] } {
  const g = group(parent);
  const w = 1.6;
  const white = 0xf6f3ec;
  mesh(g, side([[-2.2, 0.36], [2.2, 0.36], [2.24, 0.78], [2.1, 0.98], [1.7, 1.12], [1.2, 1.98], [1.05, 2.04], [-2.1, 2.04], [-2.2, 1.94]], w), white);
  slopeGlass(g, [1.7, 1.12], [1.2, 1.98], w - 0.2);
  // Cửa sổ: ghế lái (vát theo kính trước) + 4 ô khoang khách
  sideGlass(g, [[1.0, 1.24], [1.56, 1.24], [1.18, 1.86], [1.0, 1.86]], w + 0.02);
  for (const [a, b] of [[0.25, 0.86], [-0.45, 0.15], [-1.15, -0.55], [-1.98, -1.25]]) sideGlass(g, [[a, 1.24], [b, 1.24], [b, 1.86], [a, 1.86]], w + 0.02);
  mesh(g, G.box(0.02, 0.55, w - 0.3), GLASS, { p: [-2.21, 1.55, 0], cast: false }); // kính sau
  // Sọc dọc thân
  mesh(g, G.box(4.3, 0.14, w + 0.02), 0xf28c28, { p: [-0.05, 0.82, 0], cast: false });
  mesh(g, G.box(4.3, 0.05, w + 0.02), 0x3fb6a8, { p: [-0.05, 0.95, 0], cast: false });
  mesh(g, G.box(4.42, 0.16, w + 0.02), TRIM, { p: [0, 0.44, 0], cast: false }); // ốp gầm
  // Cửa trượt phía vỉa hè: tấm cửa, kính trên, tay nắm, ray trượt
  const dz = -(w / 2 + 0.012);
  mesh(g, G.box(0.62, 1.4, 0.02), 0xe9e4d8, { p: [0.62, 1.12, dz] });
  mesh(g, G.box(0.5, 0.5, 0.025), GLASS, { p: [0.62, 1.56, dz], cast: false });
  mesh(g, G.box(0.12, 0.03, 0.03), CHROME, { p: [0.4, 1.12, dz - 0.01], cast: false });
  mesh(g, G.box(1.6, 0.025, 0.03), TRIM, { p: [-0.1, 1.2, dz], cast: false });
  // Nóc: cục lạnh + thanh giá
  mesh(g, G.box(1.1, 0.16, 0.9), 0xdcd6cb, { p: [-0.6, 2.12, 0] });
  for (let i = 0; i < 4; i++) mesh(g, G.box(0.9, 0.02, 0.1), 0xb8b2a6, { p: [-0.6, 2.21, -0.3 + i * 0.2], cast: false });
  for (const s of [-1, 1]) mesh(g, G.box(2.8, 0.04, 0.04), TRIM, { p: [-0.5, 2.08, s * (w / 2 - 0.08)] });
  carTrim(g, { front: 2.24, back: -2.2, w, lightY: 0.74, bumperY: 0.44, mirror: [1.62, 1.4, w / 2 + 0.08], grille: 0.2 });
  const sign = signText('DU LỊCH', '#e2703a', 1.6, 0.3);
  sign.position.set(-0.5, 1.08, w / 2 + 0.02);
  g.add(sign);
  const wheels: THREE.Object3D[] = [];
  for (const x of [-1.4, 1.3]) for (const z of [-0.78, 0.78]) wheels.push(wheel(g, x, z, 0.36, 0.22));
  return { g, wheels };
}

/** Bác bảo vệ bãi giữ xe: áo xanh nhạt, mũ kê-pi xanh đậm, cầu vai, thắt lưng, còi vàng. */
export function makeGuard(): THREE.Group {
  const p = makePerson({ shirt: 0x9cc3e6, hair: 0x9a948c, skin: 0xe8b88a }, 'none', { build: 'elder', width: 1.15, hair: 'short' });
  const rig = p.userData.rig;
  const cap = group(rig.head, { p: [0, 0.3, 0.01] });
  mesh(cap, G.cyl(0.25, 0.23, 0.12, 14), 0x23304a, { p: [0, 0.04, 0] });
  mesh(cap, G.cyl(0.28, 0.28, 0.03, 16), 0x23304a, { p: [0, 0.11, 0.02] });
  mesh(cap, G.box(0.24, 0.025, 0.12), 0x111111, { p: [0, -0.02, 0.24], r: [0.25, 0, 0] });
  mesh(cap, G.box(0.08, 0.06, 0.02), 0xf2c14e, { p: [0, 0.05, 0.245], cast: false });
  for (const side of [-1, 1]) mesh(rig.body, G.box(0.1, 0.03, 0.16), 0x23304a, { p: [side * 0.2, 0.47, 0] }); // cầu vai
  mesh(rig.body, G.box(0.42, 0.05, 0.3), 0x2a2d35, { p: [0, -0.02, 0] }); // thắt lưng
  mesh(rig.body, G.box(0.05, 0.12, 0.02), 0xf2c14e, { p: [0.12, 0.33, 0.215], cast: false }); // còi
  return p;
}
