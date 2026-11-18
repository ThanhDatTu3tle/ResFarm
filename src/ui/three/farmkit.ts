import * as THREE from 'three';
import { G, group, mesh, toon } from './toon';

/**
 * Model riêng của nông trại: cối xay gió, nhà xay lúa (bánh xe nước), máy cày, kiện rơm,
 * viền đứt khúc đánh dấu chỗ mở rộng được. Nhìn về +z, chân ở y = 0.
 */

/** Cối xay gió: trả về cánh quạt (để quay theo gió) và chỗ chất bao lúa trước cửa. */
export function makeWindmill(): { g: THREE.Group; blades: THREE.Group; sacks: THREE.Group } {
  const g = group(null);
  mesh(g, G.cyl(0.9, 1.3, 4.2, 10), 0xf3e9d2, { p: [0, 2.1, 0] });
  for (const y of [1.2, 2.6]) mesh(g, G.cyl(1.02 - y * 0.1, 1.12 - y * 0.1, 0.12, 10), 0xc98b4f, { p: [y === 1.2 ? 0 : 0, y, 0] });
  mesh(g, G.cone(1.15, 1.2, 10), 0xc94a3f, { p: [0, 4.8, 0] });
  mesh(g, G.box(0.7, 1.3, 0.12), 0x7a4a2f, { p: [0, 0.65, 1.22] }); // cửa
  mesh(g, G.box(0.42, 0.42, 0.1), 0xbfe6ff, { p: [0, 3.0, 1.0] }); // cửa sổ
  const blades = group(g, { p: [0, 3.9, 1.05] });
  mesh(blades, G.sphere(0.2, 8, 6), 0x8a5a3a);
  for (let i = 0; i < 4; i++) {
    const arm = group(blades, { r: [0, 0, (i * Math.PI) / 2] });
    mesh(arm, G.box(0.08, 2.3, 0.06), 0x8a5a3a, { p: [0, 1.2, 0] });
    mesh(arm, G.box(0.5, 1.8, 0.03), 0xffffff, { p: [0.28, 1.4, 0] });
  }
  const sacks = group(g, { p: [0.95, 0, 1.5] });
  return { g, blades, sacks };
}

/** Nhà xay lúa: nhà gỗ mái ngói, bánh xe nước quay trong máng nước bên hông. */
export function makeRiceMill(waterMat: THREE.Material): { g: THREE.Group; wheel: THREE.Group; sacks: THREE.Group } {
  const g = group(null);
  mesh(g, G.box(2.4, 1.9, 2.2), 0xd9b98a, { p: [0, 0.95, 0] });
  for (const x of [-1.15, 1.15]) mesh(g, G.box(0.14, 1.9, 2.24), 0x8a5a35, { p: [x, 0.95, 0] });
  mesh(g, G.prism(), 0x9a4a32, { p: [0, 1.9, 0], r: [0, Math.PI / 2, 0], s: [2.8, 1.1, 2.9] });
  mesh(g, G.box(0.7, 1.2, 0.1), 0x6b3f22, { p: [0, 0.6, 1.12] });
  // Máng nước + bánh xe nước bên phải
  mesh(g, G.box(0.5, 0.25, 2.6), 0x8a8f99, { p: [1.6, 0.13, 0] });
  mesh(g, G.box(0.36, 0.05, 2.5), waterMat, { p: [1.6, 0.24, 0], cast: false });
  const wheel = group(g, { p: [1.6, 0.85, 0] });
  mesh(wheel, G.torus(0.8, 0.06, 6, 18), 0x6b4a2f, { r: [0, Math.PI / 2, 0] });
  for (let i = 0; i < 8; i++) {
    const spoke = group(wheel, { r: [(i * Math.PI) / 4, 0, 0] });
    mesh(spoke, G.box(0.05, 1.6, 0.05), 0x8a5a35);
    mesh(spoke, G.box(0.32, 0.22, 0.04), 0x8a5a35, { p: [0, 0.8, 0] });
  }
  const sacks = group(g, { p: [-0.9, 0, 1.45] });
  return { g, wheel, sacks };
}

/** Chất bao lúa / bao thành phẩm trước cối: n bao (tối đa 6). */
export function fillSacks(holder: THREE.Group, n: number, color = 0xe8d6a8): void {
  holder.clear();
  for (let i = 0; i < Math.min(6, n); i++) {
    const x = (i % 3) * 0.32 - 0.32;
    const y = Math.floor(i / 3) * 0.3;
    mesh(holder, G.capsule(0.15, 0.12), color, { p: [x, 0.17 + y, (i % 2) * 0.05], r: [0, 0, Math.PI / 2] });
  }
}

/** Máy cày nhỏ (bác nông dân ngồi trên): thân đỏ, bánh sau to, thùng chở phía sau. Trả về thùng chở để chất lúa. */
export function makeTractor(): { g: THREE.Group; bed: THREE.Group; wheels: THREE.Object3D[] } {
  const g = group(null);
  mesh(g, G.box(0.8, 0.45, 1.1), 0xd9433a, { p: [0, 0.55, 0.25] });
  mesh(g, G.box(0.7, 0.35, 0.6), 0xd9433a, { p: [0, 0.6, 0.95] }); // nắp máy
  mesh(g, G.cyl(0.05, 0.05, 0.4, 6), 0x3b3f46, { p: [0.2, 0.95, 1.05] }); // ống khói
  mesh(g, G.box(0.5, 0.08, 0.4), 0x3b3f46, { p: [0, 0.82, 0.05] }); // ghế
  const wheels: THREE.Object3D[] = [];
  for (const [x, z, r] of [[-0.48, -0.05, 0.42], [0.48, -0.05, 0.42], [-0.42, 1.0, 0.25], [0.42, 1.0, 0.25]] as const) {
    const w = mesh(g, G.cyl(r, r, 0.2, 14), 0x2a2d35, { p: [x, r, z], r: [0, 0, Math.PI / 2] });
    mesh(w, G.cyl(r * 0.5, r * 0.5, 0.22, 10), 0xf2c94c);
    wheels.push(w);
  }
  // Thùng chở phía sau
  const bed = group(g, { p: [0, 0.35, -0.85] });
  mesh(bed, G.box(0.95, 0.12, 0.9), 0x8a5a35);
  for (const [x, z, w, d] of [[-0.45, 0, 0.06, 0.9], [0.45, 0, 0.06, 0.9], [0, -0.42, 0.95, 0.06]] as const) mesh(bed, G.box(w, 0.3, d), 0x8a5a35, { p: [x, 0.18, z] });
  return { g, bed, wheels };
}

/** Kiện rơm tròn. */
export function hayBale(parent: THREE.Object3D, x: number, z: number, r = 0): void {
  const g = group(parent, { p: [x, 0, z], r: [0, r, 0] });
  mesh(g, G.cyl(0.32, 0.32, 0.5, 12), 0xe8c55a, { p: [0, 0.32, 0], r: [Math.PI / 2, 0, 0] });
  mesh(g, G.torus(0.32, 0.02, 4, 14), 0xc9a040, { p: [0, 0.32, 0.12], cast: false });
  mesh(g, G.torus(0.32, 0.02, 4, 14), 0xc9a040, { p: [0, 0.32, -0.12], cast: false });
}

/** Rơm rải trên nền chuồng: vài vệt rơm mảnh. */
export function strawLitter(parent: THREE.Object3D, w: number, d: number, seed: () => number): void {
  for (let i = 0; i < 26; i++) {
    mesh(parent, G.box(0.35, 0.02, 0.04), i % 2 ? 0xe8c55a : 0xd9b048, { p: [(seed() - 0.5) * w, 0.09, (seed() - 0.5) * d], r: [0, seed() * Math.PI, 0], cast: false });
  }
}

const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });

/** Viền đứt khúc hình vuông cạnh `size` (chỗ mua thêm ô / cối), nằm sát mặt đất. */
export function dashedRect(parent: THREE.Object3D, size: number, dash = 0.45, depth = size): THREE.Group {
  const g = group(parent);
  const hx = size / 2;
  const hz = depth / 2;
  const nx = Math.max(2, Math.round(size / (dash * 1.8)));
  const nz = Math.max(2, Math.round(depth / (dash * 1.8)));
  for (const az of [-hz, hz]) for (let i = 0; i < nx; i++) mesh(g, G.box(dash, 0.03, 0.09), dashMat, { p: [-hx + (size * (i + 0.5)) / nx, 0.04, az], cast: false, receive: false });
  for (const ax of [-hx, hx]) for (let i = 0; i < nz; i++) mesh(g, G.box(0.09, 0.03, dash), dashMat, { p: [ax, 0.04, -hz + (depth * (i + 0.5)) / nz], cast: false, receive: false });
  mesh(g, G.box(size, 0.01, depth), toon(0xffffff, { transparent: true, opacity: 0.12 }), { p: [0, 0.02, 0], cast: false, receive: false });
  return g;
}

/**
 * Đường viền ao méo tự nhiên (khép kín, mặt phẳng xz): bề ngang tối đa = 2·rx, bề dọc ≈ 2·rz.
 * Cùng seed thì cùng hình — dùng chung cho mặt ao, bờ ao và viền đứt khúc "nới rộng ao".
 */
export function pondOutline(rx: number, rz: number, seed = 1, n = 48): THREE.Vector2[] {
  const wobble = (a: number) => 1 + 0.1 * Math.sin(2 * a + 0.7 + seed) + 0.07 * Math.sin(3 * a + 2.1 + seed * 1.3) + 0.04 * Math.sin(5 * a + 1 + seed * 0.7);
  const max = 1.21;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = wobble(a) / max;
    return new THREE.Vector2(Math.cos(a) * rx * k, Math.sin(a) * rz * k);
  });
}

/** Khối phẳng theo đường viền (mặt ao, bờ ao): dày `h`, đáy ở y = 0. */
export function outlineSlab(points: THREE.Vector2[], h: number): THREE.BufferGeometry {
  // Shape vẽ trên mặt xy với y = -z, rồi xoay nằm xuống mặt đất và đùn lên trên
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, -p.y)));
  return new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2);
}

/** Viền đứt khúc theo một đường khép kín (vd ao sau khi nới rộng). */
export function dashedOutline(parent: THREE.Object3D, points: THREE.Vector2[], dash = 0.45): THREE.Group {
  const g = group(parent);
  const n = points.length;
  const step = dash * 1.8;
  let next = 0; // quãng đường (dọc viền) tới nét kế tiếp
  let walked = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const len = a.distanceTo(b);
    while (next < walked + len) {
      const k = (next - walked) / len;
      mesh(g, G.box(dash, 0.03, 0.09), dashMat, { p: [a.x + (b.x - a.x) * k, 0.04, a.y + (b.y - a.y) * k], r: [0, -Math.atan2(b.y - a.y, b.x - a.x), 0], cast: false, receive: false });
      next += step;
    }
    walked += len;
  }
  return g;
}

/** Viền đứt khúc hình tròn đường kính `size`. */
export function dashedCircle(parent: THREE.Object3D, size: number, dash = 0.45): THREE.Group {
  const g = group(parent);
  const r = size / 2;
  const n = Math.max(8, Math.round((Math.PI * size) / (dash * 1.8)));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    mesh(g, G.box(dash, 0.03, 0.09), dashMat, { p: [Math.cos(a) * r, 0.04, Math.sin(a) * r], r: [0, -a + Math.PI / 2, 0], cast: false, receive: false });
  }
  mesh(g, G.cyl(r, r, 0.01, 24), toon(0xffffff, { transparent: true, opacity: 0.12 }), { p: [0, 0.02, 0], cast: false, receive: false });
  return g;
}

/** Mặt ruộng lúa: lưới khóm lúa. stage 0 mạ non, 1 lúa xanh, 2 chín vàng (lúa mì vàng óng, lúa nước vàng xanh trĩu bông). */
export function grainField(parent: THREE.Object3D, size: number, kind: 'wheat' | 'rice', stage: 0 | 1 | 2): THREE.Group {
  const g = group(parent);
  const n = 6;
  const step = (size - 0.6) / (n - 1);
  const h = [0.18, 0.42, 0.6][stage];
  const stem = stage === 2 ? (kind === 'wheat' ? 0xe0b63e : 0xc9c35a) : stage === 1 ? 0x6fbf4a : 0x8fd16a;
  const head = kind === 'wheat' ? 0xf0c850 : 0xe8d27a;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = -size / 2 + 0.3 + i * step + (j % 2) * 0.08;
      const z = -size / 2 + 0.3 + j * step;
      const tuft = group(g, { p: [x, 0, z], r: [0, (i * 7 + j * 3) % 6, 0] });
      tuft.userData.sway = (i * 0.7 + j * 1.3) % 6;
      for (let k = 0; k < 3; k++) {
        const lean = (k - 1) * 0.18;
        mesh(tuft, G.cone(0.035, h, 4), stem, { p: [lean * 0.4, h / 2, (k % 2) * 0.05], r: [0, 0, lean], cast: false });
        if (stage === 2) mesh(tuft, G.capsule(0.03, 0.1), head, { p: [lean * h, h + 0.02, (k % 2) * 0.05], r: [0.3, 0, lean + (kind === 'rice' ? 0.5 : 0)], cast: false });
      }
    }
  }
  return g;
}

// ---------- Nhà lồng / nhà màng ----------

const filmMat = new THREE.MeshToonMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
const filmMatInside = new THREE.MeshToonMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false });

/**
 * Khung nhà màng mái vòm dài `length` (theo +x, từ x = 0), rộng `width` (z ở giữa): cột + vòm thép trắng mỗi `rib` mét,
 * xà dọc, màng phủ trong mờ, đầu tây có cửa, đầu đông có quạt thông gió. inside = true: màng mỏng hơn (nhìn từ trong).
 * Trả về các cánh quạt để quay.
 */
export function makeGreenhouse(length: number, width: number, rib: number, inside = false): { g: THREE.Group; fans: THREE.Object3D[] } {
  const g = group(null);
  const r = width / 2;
  const wall = 1.0; // chân tường thẳng trước khi uốn vòm
  const steel = 0xf2f4f6;
  const film = inside ? filmMatInside : filmMat;
  mesh(g, G.box(length + 0.3, 0.12, width + 0.3), 0xcfd3d6, { p: [length / 2, 0.06, 0], cast: false }); // móng
  const ribs = Math.max(1, Math.round(length / rib));
  for (let i = 0; i <= ribs; i++) {
    const x = (i / ribs) * length;
    for (const side of [-1, 1]) mesh(g, G.box(0.08, wall, 0.08), steel, { p: [x, wall / 2, side * r] });
    mesh(g, G.torus(r, 0.04, 5, 18, Math.PI), steel, { p: [x, wall, 0], r: [0, Math.PI / 2, 0] });
  }
  // Xà dọc: nóc + hai bên vai vòm + chân tường
  for (const a of [Math.PI / 2, Math.PI / 4, (3 * Math.PI) / 4]) mesh(g, G.box(length, 0.05, 0.05), steel, { p: [length / 2, wall + Math.sin(a) * r, Math.cos(a) * r] });
  for (const side of [-1, 1]) mesh(g, G.box(length, 0.06, 0.06), steel, { p: [length / 2, wall, side * r] });
  // Màng phủ: vòm (nửa trụ) + hai vách thẳng
  const roof = new THREE.CylinderGeometry(r, r, length, 20, 1, true, 0, Math.PI);
  mesh(g, roof, film, { p: [length / 2, wall, 0], r: [Math.PI / 2, 0, Math.PI / 2], cast: false, receive: false });
  for (const side of [-1, 1]) mesh(g, G.box(length, wall, 0.02), film, { p: [length / 2, wall / 2, side * r], cast: false, receive: false });
  // Vách hai đầu: nửa đĩa trên + chữ nhật dưới
  const endTop = new THREE.CircleGeometry(r, 20, 0, Math.PI);
  for (const x of [0, length]) {
    mesh(g, endTop, film, { p: [x, wall, 0], r: [0, Math.PI / 2, 0], cast: false, receive: false });
    mesh(g, G.box(0.02, wall, width), film, { p: [x, wall / 2, 0], cast: false, receive: false });
  }
  // Cửa đầu tây (khung xanh lá, cửa mở) + biển nhỏ
  mesh(g, G.box(0.1, 2.1, 0.08), 0x3f8f5a, { p: [-0.02, 1.05, -0.6] });
  mesh(g, G.box(0.1, 2.1, 0.08), 0x3f8f5a, { p: [-0.02, 1.05, 0.6] });
  mesh(g, G.box(0.1, 0.08, 1.28), 0x3f8f5a, { p: [-0.02, 2.1, 0] });
  mesh(g, G.box(0.04, 2.0, 0.6), film, { p: [-0.25, 1.0, -0.9], r: [0, 0.7, 0], cast: false, receive: false }); // cánh cửa mở
  // Quạt thông gió đầu đông
  const fans: THREE.Object3D[] = [];
  for (const z of [-r * 0.45, r * 0.45]) {
    const f = group(g, { p: [length + 0.04, 1.2, z], r: [0, Math.PI / 2, 0] });
    mesh(f, G.box(0.9, 0.9, 0.12), 0x5f6b77);
    mesh(f, G.cyl(0.38, 0.38, 0.13, 16), 0x2a2d35, { r: [Math.PI / 2, 0, 0] });
    const blades = group(f, { p: [0, 0, 0.08] });
    for (let k = 0; k < 3; k++) mesh(blades, G.box(0.08, 0.6, 0.02), 0xcfd6dc, { r: [0, 0, (k * Math.PI * 2) / 3] });
    fans.push(blades);
  }
  return { g, fans };
}

// ---------- Xe cộ (khu chợ) ----------

/** Đèn pha / đèn hậu dùng chung: sáng lên khi trời tối (khu gọi setVehicleLights). */
const headMat = new THREE.MeshToonMaterial({ color: 0xfff6d0, emissive: 0xffe8a0, emissiveIntensity: 0 });
const tailMat = new THREE.MeshToonMaterial({ color: 0xd9433a, emissive: 0xff3020, emissiveIntensity: 0 });
export function setVehicleLights(night: number): void {
  headMat.emissiveIntensity = night * 1.8;
  tailMat.emissiveIntensity = night * 1.2;
}

function wheel(g: THREE.Object3D, x: number, z: number, r: number, w = 0.18): THREE.Mesh {
  const m = mesh(g, G.cyl(r, r, w, 12), 0x2a2d35, { p: [x, r, z], r: [Math.PI / 2, 0, 0] });
  mesh(m, G.cyl(r * 0.45, r * 0.45, w + 0.02, 8), 0xcfd6dc);
  return m;
}

/** Xe ô tô con bo tròn, chạy theo +x. */
export function makeCar(color: number): THREE.Group {
  const g = group(null);
  mesh(g, G.box(2.3, 0.55, 1.15), color, { p: [0, 0.55, 0] });
  mesh(g, G.box(1.3, 0.5, 1.05), color, { p: [-0.15, 1.05, 0] });
  mesh(g, G.box(1.32, 0.38, 1.07), 0xbfe6ff, { p: [-0.15, 1.05, 0], s: [1, 1, 1] }).scale.set(0.98, 0.8, 1.01); // kính
  for (const z of [-0.33, 0.33]) mesh(g, G.box(0.06, 0.12, 0.22), headMat, { p: [1.16, 0.6, z], cast: false });
  for (const z of [-0.38, 0.38]) mesh(g, G.box(0.06, 0.12, 0.18), tailMat, { p: [-1.16, 0.62, z], cast: false });
  for (const x of [-0.75, 0.75]) for (const z of [-0.55, 0.55]) wheel(g, x, z, 0.28);
  return g;
}

/** Xe tải nhỏ chở hàng (thùng sau có bạt). */
export function makeTruck(color: number): THREE.Group {
  const g = group(null);
  mesh(g, G.box(1.0, 1.0, 1.3), color, { p: [1.15, 0.85, 0] }); // cabin
  mesh(g, G.box(0.06, 0.45, 1.1), 0xbfe6ff, { p: [1.66, 1.05, 0], cast: false });
  mesh(g, G.box(2.1, 1.25, 1.4), 0x6f8f6a, { p: [-0.5, 1.0, 0] }); // thùng bạt
  mesh(g, G.box(2.15, 0.12, 1.45), 0x4f6f4a, { p: [-0.5, 1.66, 0] });
  for (const z of [-0.4, 0.4]) mesh(g, G.box(0.06, 0.14, 0.24), headMat, { p: [1.66, 0.55, z], cast: false });
  for (const x of [-1.0, 0.2, 1.15]) for (const z of [-0.62, 0.62]) wheel(g, x, z, 0.3);
  return g;
}

/** Xe máy (xe tay ga) có người lái đội mũ bảo hiểm; `rider` là người ngồi (makePerson) để khu animate. */
export function makeScooter(color: number, rider: THREE.Group): THREE.Group {
  const g = group(null);
  mesh(g, G.box(1.1, 0.28, 0.32), color, { p: [0, 0.45, 0] });
  mesh(g, G.box(0.35, 0.5, 0.3), color, { p: [0.42, 0.65, 0], r: [0, 0, -0.25] }); // đầu xe
  mesh(g, G.box(0.06, 0.06, 0.6), 0x3b3f46, { p: [0.55, 0.98, 0] }); // tay lái
  mesh(g, G.box(0.5, 0.12, 0.34), 0x2a2d35, { p: [-0.2, 0.66, 0] }); // yên
  mesh(g, G.box(0.05, 0.1, 0.14), headMat, { p: [0.62, 0.8, 0], cast: false });
  for (const x of [-0.42, 0.45]) wheel(g, x, 0, 0.22, 0.12);
  rider.position.set(-0.15, 0.32, 0);
  rider.rotation.y = Math.PI / 2;
  mesh(rider.userData.rig.head, G.sphere(0.27, 12, 8), 0xf2b23e, { p: [0, 0.24, -0.02], s: [1, 0.85, 1] }); // mũ bảo hiểm
  g.add(rider);
  return g;
}
