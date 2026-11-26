import * as THREE from 'three';
import { AD_SLIDES } from '../../data/ads';
import { CH, CW, drawSlide } from './billboard';
import { signText } from './cuisine';
import { carTrim, CHROME, GLASS, side, sideGlass, TRIM, wheel } from './farmkit';
import { G, group, mesh, toon } from './toon';

/**
 * TRẠM XE BUÝT + XE BUÝT (khu chợ, bên phải cây trước Tiệm 25caaaaa).
 *  - makeBusShelter(): mái kính cong nhẹ trên khung thép, vách kính sau, băng ghế dài, bảng tuyến + biển "TRẠM XE BUÝT"
 *    trên cột. Gốc ở giữa chân vách sau, mặt trạm (băng ghế) nhìn về +z (ra đường).
 *  - makeCityBus(): xe buýt thành phố xanh lá chạy theo +x, cửa trước + cửa giữa ở hông phía vỉa hè (−z) có thể mở
 *    (gập vào trong), bảng tuyến "25 · CHỢ" trên kính lái.
 */

export interface BusShelter {
  g: THREE.Group;
  /** Chỗ ngồi trên băng ghế (toạ độ trong g, ngồi quay mặt +z). */
  seats: { x: number; z: number }[];
  seatY: number;
}

export function makeBusShelter(W = 3.0): BusShelter {
  const g = group(null);
  const steel = 0x4a5a6b;
  const glass = toon(0xcfe8f5, { transparent: true, opacity: 0.35 });
  glass.depthWrite = false;
  const D = 1.3;
  const H = 2.5;
  // Khung: 4 cột, dầm nóc
  for (const sx of [-1, 1]) for (const z of [0, D]) mesh(g, G.box(0.08, H, 0.08), steel, { p: [sx * (W / 2), H / 2, z] });
  // Mái: tấm kính dốc nhẹ ra trước + viền nhôm
  const roof = group(g, { p: [0, H + 0.05, D / 2], r: [-0.08, 0, 0] });
  mesh(roof, G.box(W + 0.4, 0.06, D + 0.5), glass, { cast: false, receive: false });
  for (const sz of [-1, 1]) mesh(roof, G.box(W + 0.44, 0.1, 0.06), 0xd9e0e6, { p: [0, 0, sz * ((D + 0.5) / 2)] });
  mesh(roof, G.box(W + 0.44, 0.22, 0.08), 0x2f9e5a, { p: [0, -0.02, (D + 0.5) / 2 + 0.02] }); // diềm xanh phía trước
  // Vách kính sau + vách bên trái, viền khung
  mesh(g, G.box(W, H - 0.3, 0.03), glass, { p: [0, (H - 0.3) / 2 + 0.2, 0.02], cast: false, receive: false });
  mesh(g, G.box(0.03, H - 0.3, D - 0.2), glass, { p: [-W / 2, (H - 0.3) / 2 + 0.2, D / 2 - 0.05], cast: false, receive: false });
  for (const y of [0.2, H - 0.1]) mesh(g, G.box(W, 0.05, 0.06), steel, { p: [0, y, 0.02], cast: false });
  // Bảng quảng cáo nhỏ ở vách sau (nửa phải): hộp đèn
  const ad = group(g, { p: [W / 2 - 0.55, 1.35, 0.05] });
  mesh(ad, G.box(0.8, 1.2, 0.06), 0xf6f1e4);
  const adText = signText('25caaaaa', '#9a6bd1', 0.7, 0.22);
  adText.position.set(0, 0.25, 0.035);
  ad.add(adText);
  mesh(ad, G.cyl(0.14, 0.11, 0.36, 12), 0xf4a7c0, { p: [0, -0.2, 0.08], cast: false }); // ly trà sữa vẽ nổi
  // Băng ghế: mặt gỗ + chân thép
  const seatY = 0.45;
  mesh(g, G.box(W * 0.62, 0.06, 0.42), 0xb07a45, { p: [-W * 0.17, seatY, 0.35] });
  for (const sx of [-1, 1]) mesh(g, G.box(0.05, seatY, 0.36), steel, { p: [-W * 0.17 + sx * W * 0.28, seatY / 2, 0.35] });
  mesh(g, G.box(W * 0.62, 0.3, 0.04), 0xb07a45, { p: [-W * 0.17, seatY + 0.3, 0.14], r: [-0.12, 0, 0] });
  // Biển trạm trên cột riêng bên phải (tròn xanh + chữ "BUS"), bảng tuyến
  const pole = group(g, { p: [W / 2 + 0.5, 0, D + 0.1] });
  mesh(pole, G.cyl(0.04, 0.04, 2.9, 8), 0xb8c0c8, { p: [0, 1.45, 0] });
  const sign = group(pole, { p: [0, 2.7, 0] });
  mesh(sign, G.cyl(0.3, 0.3, 0.04, 20), 0x2f6fb0, { r: [Math.PI / 2, 0, 0] });
  const bus = signText('BUS', '#ffffff', 0.46, 0.2);
  bus.position.z = 0.025;
  sign.add(bus);
  const route = group(pole, { p: [0, 1.9, 0.04] });
  mesh(route, G.box(0.5, 0.55, 0.03), 0xf3f3f3);
  const r1 = signText('25', '#2f9e5a', 0.4, 0.24);
  r1.position.set(0, 0.1, 0.02);
  route.add(r1);
  const r2 = signText('Chợ ⇄ Bến xe', '#3b3f46', 0.46, 0.12);
  r2.position.set(0, -0.14, 0.02);
  route.add(r2);
  // Tên trạm trên diềm mái
  const name = signText('TRẠM XE BUÝT · CHỢ', '#ffffff', W * 0.7, 0.18);
  name.position.set(0, H - 0.04, D + 0.37); // trước mặt diềm xanh (mái dốc nên diềm thấp xuống chút)
  name.rotation.x = -0.08;
  g.add(name);
  return { g, seats: [-1.05, -0.45, 0.15].map((x) => ({ x: x * (W / 3.4), z: 0.32 })), seatY };
}

export interface CityBus {
  g: THREE.Group;
  wheels: THREE.Object3D[];
  /** Mở cửa 0..1. */
  setDoors(k: number): void;
  /** Cửa giữa (toạ độ trong g): chỗ khách lên / xuống. */
  door: { x: number; z: number };
  length: number;
  /** Dán poster quảng cáo thứ i (theo src/data/ads.ts, cùng mẫu với biển LED) lên hai hông xe. */
  setAd(i: number): void;
}



export function makeCityBus(): CityBus {
  const g = group(null);
  const L = 7.2;
  const w = 2.0;
  const green = 0x2f9e5a;
  const H = 2.75;
  // Thân: hộp bo nhẹ ở đầu xe; nóc trắng
  mesh(g, side([[-L / 2, 0.42], [L / 2, 0.42], [L / 2 + 0.04, 0.9], [L / 2 - 0.05, H - 0.15], [L / 2 - 0.25, H], [-L / 2 + 0.1, H], [-L / 2, H - 0.12]], w), green);
  mesh(g, G.box(L - 0.4, 0.12, w - 0.2), 0xf3f3f3, { p: [-0.1, H + 0.06, 0] });
  mesh(g, G.box(1.6, 0.25, 1.1), 0xdcd6cb, { p: [-1.6, H + 0.2, 0] }); // máy lạnh nóc
  // Sọc vàng + trắng dọc thân
  mesh(g, G.box(L + 0.02, 0.12, w + 0.02), 0xf2c94c, { p: [0, 1.05, 0], cast: false });
  mesh(g, G.box(L + 0.02, 0.05, w + 0.02), 0xffffff, { p: [0, 1.17, 0], cast: false });
  mesh(g, G.box(L + 0.06, 0.18, w + 0.02), TRIM, { p: [0, 0.5, 0], cast: false }); // ốp gầm
  // Kính lái lớn + bảng tuyến LED phía trên
  mesh(g, G.box(0.03, 1.2, w - 0.16), GLASS, { p: [L / 2 + 0.01, 1.75, 0], cast: false });
  mesh(g, G.box(0.04, 0.26, w - 0.4), 0x1d1f23, { p: [L / 2 - 0.04, H - 0.22, 0], cast: false });
  const dest = signText('25 · CHỢ', '#ffb43a', w - 0.5, 0.2, true);
  dest.position.set(L / 2 - 0.01, H - 0.22, 0);
  dest.rotation.y = Math.PI / 2;
  g.add(dest);
  // Dãy cửa sổ (kính xuyên hai bên hông), chừa ô 2 và 4 cho cửa giữa / cửa trước
  for (let i = 0; i < 5; i++) {
    if (i === 2 || i === 4) continue;
    const a = -L / 2 + 0.35 + i * 1.18;
    sideGlass(g, [[a, 1.35], [a + 1.0, 1.35], [a + 1.0, 2.35], [a, 2.35]], w + 0.02);
  }
  // Cửa (hông −z): cửa trước sát đầu xe, cửa giữa; mỗi cửa 2 cánh kính gập
  const dz = -(w / 2 + 0.015);
  const doors: { m: THREE.Object3D; x: number; dir: number }[] = [];
  const door = { x: -L / 2 + 0.35 + 2 * 1.18 + 0.5, z: dz - 0.4 };
  for (const cx of [door.x, -L / 2 + 0.35 + 4 * 1.18 + 0.5]) {
    mesh(g, G.box(1.04, 2.1, 0.02), 0x1d1f23, { p: [cx, 1.5, dz + 0.01], cast: false }); // lòng cửa sẫm
    for (const s of [-1, 1]) {
      const hinge = group(g, { p: [cx + s * 0.5, 0, dz - 0.01] });
      const leaf = group(hinge, { p: [-s * 0.25, 0, 0] });
      mesh(leaf, G.box(0.48, 2.0, 0.03), 0xe9e4d8, { p: [0, 1.48, 0] });
      mesh(leaf, G.box(0.4, 1.3, 0.035), GLASS, { p: [0, 1.7, 0], cast: false });
      doors.push({ m: hinge, x: cx, dir: s });
    }
    mesh(g, G.box(1.1, 0.06, 0.25), CHROME, { p: [cx, 0.4, dz - 0.1], cast: false }); // bậc lên xuống
  }
  carTrim(g, { front: L / 2 + 0.04, back: -L / 2, w, lightY: 0.8, bumperY: 0.5, mirror: [L / 2 - 0.1, 2.3, w / 2 + 0.12] });
  // Quảng cáo dán kín hông xe (che luôn 2 ô cửa sổ giữa): hông phía đường nước chanh bạc hà, hông vỉa hè (giữa hai cửa thì hẹp) quảng cáo quán
  // Cao hết thân xe (từ ốp gầm tới mép nóc). Mỗi chuyến xe một poster khác (setAd)
  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  const adTex = new THREE.CanvasTexture(canvas);
  adTex.colorSpace = THREE.SRGBColorSpace;
  adTex.anisotropy = 4;
  const adMat = toon(0xffffff, { map: adTex });
  const adH = H - 0.62;
  const adY = 0.6 + adH / 2;
  mesh(g, new THREE.PlaneGeometry(4.1, adH), adMat, { p: [-0.55, adY, w / 2 + 0.025], cast: false, receive: false });
  mesh(g, new THREE.PlaneGeometry(2.5, adH), adMat, { p: [-2.25, adY, -(w / 2 + 0.025)], r: [0, Math.PI, 0], cast: false, receive: false });
  let adShown = -1;
  const setAd = (i: number) => {
    const n = ((i % AD_SLIDES.length) + AD_SLIDES.length) % AD_SLIDES.length;
    if (n === adShown) return;
    adShown = n;
    const c = canvas.getContext('2d')!;
    c.clearRect(0, 0, CW, CH);
    drawSlide(c, AD_SLIDES[n], 0);
    adTex.needsUpdate = true;
  };
  setAd(0);
  // Số xe phía đầu xe
  const tag = signText('25', '#ffffff', 0.5, 0.34);
  tag.position.set(2.75, 0.78, w / 2 + 0.02);
  g.add(tag);
  const wheels: THREE.Object3D[] = [];
  for (const x of [-L / 2 + 1.3, L / 2 - 1.4]) for (const z of [-(w / 2 - 0.12), w / 2 - 0.12]) wheels.push(wheel(g, x, z, 0.48, 0.3));
  return {
    g,
    wheels,
    door,
    length: L,
    setAd,
    setDoors(k) {
      for (const d of doors) d.m.rotation.y = d.dir * k * 1.35;
    },
  };
}

type Rider = { g: THREE.Group; state: 'sit' | 'walk' | 'gone'; seat: number; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; then: 'sit' | 'gone' };

/**
 * Trạm có khách: vài người ngồi chờ trên băng ghế. Xe buýt dừng (onBusStop) thì một người đứng dậy đi ra cửa xe rồi
 * lên xe, một người khác bước xuống đi dọc vỉa hè; xe đi rồi một lúc sau có người mới tới ngồi chờ.
 * Toạ độ đều là toạ độ cảnh (parent), trạm đặt ở `at` quay mặt +z.
 */
export class BusStopScene {
  readonly shelter: BusShelter;
  private riders: Rider[] = [];
  private nextArrive = -1;
  private seed = 0;

  constructor(
    private parent: THREE.Object3D,
    private at: { x: number; z: number },
    private makeGuest: (i: number) => THREE.Group,
    private animate: (g: THREE.Object3D, t: number, pose: { walk?: number; sit?: boolean }) => void,
  ) {
    this.shelter = makeBusShelter();
    this.shelter.g.position.set(at.x, 0, at.z);
    parent.add(this.shelter.g);
    for (const seat of [0, 2]) this.spawnSeated(seat);
  }

  private seatPos(i: number): THREE.Vector3 {
    const s = this.shelter.seats[i];
    return new THREE.Vector3(this.at.x + s.x, this.shelter.seatY + 0.03, this.at.z + s.z);
  }

  private guest(): THREE.Group {
    const g = this.makeGuest(this.seed++);
    this.parent.add(g);
    return g;
  }

  private spawnSeated(seat: number): void {
    const g = this.guest();
    const p = this.seatPos(seat);
    g.position.copy(p);
    this.riders.push({ g, state: 'sit', seat, from: p, to: p, t0: 0, dur: 0, then: 'sit' });
  }

  private walk(r: Rider, to: THREE.Vector3, t: number, speed: number, then: 'sit' | 'gone'): void {
    r.from = r.g.position.clone().setY(0);
    r.to = to.clone().setY(0);
    r.t0 = t;
    r.dur = Math.max(0.3, r.from.distanceTo(r.to) / speed);
    r.state = 'walk';
    r.then = then;
  }

  /** Xe buýt vừa dừng, cửa ở `door` (toạ độ cảnh): một người lên, một người xuống. Trả về thời gian nên mở cửa (s). */
  onBusStop(door: { x: number; z: number }, t: number): number {
    const d = new THREE.Vector3(door.x, 0, door.z);
    const boarding = this.riders.find((r) => r.state === 'sit');
    if (boarding) this.walk(boarding, d, t, 2.4, 'gone');
    const off = { g: this.guest(), state: 'sit' as const, seat: -1, from: d, to: d, t0: t, dur: 0, then: 'gone' as const };
    off.g.position.copy(d);
    this.riders.push(off);
    this.walk(off, new THREE.Vector3(door.x - 9, 0, this.at.z + 0.2), t, 1.3, 'gone');
    this.nextArrive = t + 7;
    return boarding ? Math.min(2.2, 0.5 + boarding.dur) : 1.4;
  }

  update(t: number): void {
    // Người mới tới trạm ngồi vào ghế trống
    if (this.nextArrive > 0 && t >= this.nextArrive) {
      this.nextArrive = -1;
      const taken = new Set(this.riders.filter((r) => r.then === 'sit').map((r) => r.seat));
      const seat = [0, 1, 2].find((i) => !taken.has(i));
      if (seat != null) {
        const g = this.guest();
        g.position.set(this.at.x + 6, 0, this.at.z + 1.1);
        const r: Rider = { g, state: 'walk', seat, from: g.position.clone(), to: g.position.clone(), t0: t, dur: 0, then: 'sit' };
        this.riders.push(r);
        this.walk(r, this.seatPos(seat).setZ(this.at.z + 0.75), t, 1.2, 'sit');
      }
      if (this.riders.filter((r) => r.then === 'sit').length < 2) this.nextArrive = t + 4;
    }
    for (const r of this.riders) {
      if (r.state === 'walk') {
        const k = Math.min(1, (t - r.t0) / r.dur);
        r.g.position.lerpVectors(r.from, r.to, k);
        const dx = r.to.x - r.from.x;
        const dz = r.to.z - r.from.z;
        if (Math.abs(dx) + Math.abs(dz) > 0.01) r.g.rotation.y = Math.atan2(dx, dz);
        this.animate(r.g, t, { walk: 1 });
        if (k >= 1) {
          if (r.then === 'gone') r.state = 'gone';
          else {
            r.state = 'sit';
            r.g.position.copy(this.seatPos(r.seat));
          }
        }
      } else if (r.state === 'sit') {
        r.g.rotation.y = 0;
        this.animate(r.g, t, { sit: true });
      }
    }
    for (const r of this.riders.filter((x) => x.state === 'gone')) this.parent.remove(r.g);
    this.riders = this.riders.filter((r) => r.state !== 'gone');
  }
}
