import * as THREE from 'three';
import { createContent, defaultDecor, type Content, type CuisineId, type DecorDef } from '../../data';
import { FLOOR_TILE, floorTexture, WALL_TILE, wallTileTexture } from './floortex';
import { buildBoxStool, buildFloorSeat, buildStoneTable, buildZataku, ZATAKU_TOP } from './furniturejp';
import { buildCrateSeat, buildDrumStool, buildDrumTable, buildWalnutGrill } from './furniturekr';
import { joinedTables, buildBambooStool, buildBambooTable, buildInoxTable, buildSlatChair, SLAT_CHAIR_COLOR } from './furnitureoc';
import { buildRattanArmchair, buildSpindleChair, buildTurnedTable } from './furniturevn';
import { buildSeat, counterExtras, seatStyle, tableExtras } from './cuisine';
import { buildBarCounter, buildBarStool, buildChopstickSet, buildGrillInset, buildGrillTable, buildLeatherChair, buildOakChair, buildOakTable, buildPlasticChair, buildPlasticTable, buildWoodStool, buildWoodTable, woodMats } from './furniture';
import { G, group, mesh, toon } from './toon';

/**
 * MÔ HÌNH TRƯNG BÀY: dựng bộ bàn ghế / mẫu sàn / mẫu tường đứng riêng (không cần quán) để xem 3D -
 * dùng cho trang models (dev/models.ts) và hộp "Xem chi tiết" trong Siêu thị.
 */

let shared: Content | null = null;
const content = (): Content => (shared ??= createContent());

function furnitureMats(c: CuisineId) {
  const col = defaultDecor(content(), c).find((d) => d.slot === 'furniture')?.colors ?? {};
  return { top: toon(col.top ?? 0xe0a868), base: toon(col.base ?? 0x8a5a35), seat: toon(col.seat ?? 0xe2703a), back: toon(col.back ?? 0xb9733f) };
}

/** Bộ bàn + ghế như trong quán (bàn 2 / 4 người hoặc quầy ghế đơn), theo nội thất mặc định của quán. */
/** `style`: bộ bàn ghế cao cấp riêng quán Việt (DecorDef.style) - dùng màu của đúng món nội thất đó. */
export function tableSet(c: CuisineId, kind: 'pair' | 'four' | 'six' | 'counter', style?: 'oak_vn' | 'luxury_vn' | 'zataku_jp' | 'stone_jp' | 'drum_kr' | 'crate_kr' | 'walnut_kr'): THREE.Group {
  const g = group(null);
  const mats = furnitureMats(c);
  if (kind === 'counter') {
    const [w, d, top] = [2.2, 0.62, 1.1];
    const style = c === 'jp' || c === 'kr' ? c : null;
    const wood = woodMats(defaultDecor(content(), c).find((x) => x.slot === 'furniture')!.colors as { top: number; base: number; seat: number });
    if (style) buildBarCounter(g, style, w, d, top, wood, mats.base);
    else {
      mesh(g, G.box(w, top - 0.08, d), mats.base, { p: [0, (top - 0.08) / 2, 0] });
      mesh(g, G.box(w + 0.2, 0.08, d + 0.25), mats.top, { p: [0, top - 0.04, 0] });
    }
    counterExtras(c, g, top, w, d);
    [-0.7, 0, 0.7].forEach((x, i) => {
      const chair = group(g, { p: [x, 0, d / 2 + 0.5], r: [0, Math.PI, 0] });
      if (style) buildBarStool(chair, style, wood, mats.seat, i + 1);
      else {
        mesh(chair, G.cyl(0.05, 0.07, 0.72, 8), 0x5f6b77, { p: [0, 0.36, 0] });
        mesh(chair, G.cyl(0.26, 0.26, 0.08, 14), mats.seat, { p: [0, 0.74, 0] });
      }
    });
    return g;
  }
  const [w, d] = kind === 'pair' ? [1.27, 1.27] : kind === 'six' ? [3.4, 1.5] : [2.18, 1.38];
  const top = style === 'zataku_jp' ? ZATAKU_TOP : 0.8;
  const nSeed = kind === 'pair' ? 3 : 5;
  const furn = style ? content().decor.all().find((x) => x.style === style)! : defaultDecor(content(), c).find((x) => x.slot === 'furniture')!;
  const wood = c === 'vn' || c === 'jp' || c === 'kr' ? woodMats(furn.colors as { top: number; base: number; seat: number }) : null;
  if (wood && c === 'kr' && (!style || style === 'crate_kr')) buildGrillTable(g, w, d, top, wood, style ? toon((furn.colors as { base: number }).base) : mats.base, kind === 'pair' ? 3 : 5);
  else if (wood && style === 'zataku_jp') buildZataku(g, w, d, top, wood, nSeed);
  else if (wood && style === 'stone_jp') {
    buildStoneTable(g, w, d, top, wood, nSeed);
    if (c === 'kr') buildGrillInset(g, top);
  }
  else if (style === 'drum_kr') joinedTables(g, w, d, kind === 'six' ? 6 : kind === 'four' ? 4 : 2, nSeed, (sub, sw, sd, s2) => buildDrumTable(sub, sw, sd, top, s2));
  else if (wood && style === 'walnut_kr') buildWalnutGrill(g, w, d, top, wood, nSeed);
  else if (wood && c === 'jp') buildOakTable(g, w, d, top, wood, kind === 'pair' ? 3 : 5);
  else if (wood && (style === 'oak_vn' || style === 'luxury_vn')) buildTurnedTable(g, w, d, top, wood, style, kind === 'pair' ? 3 : 5);
  else if (wood) buildWoodTable(g, w, d, top, wood, kind === 'pair' ? 3 : 5);
  else if (c === 'oc') joinedTables(g, w, d, kind === 'pair' ? 2 : 4, 3, (sub, sw, sd, s) => buildPlasticTable(sub, sw, sd, top, mats, s));
  else {
    mesh(g, G.box(w, 0.1, d), mats.top, { p: [0, top - 0.05, 0] });
    mesh(g, G.box(w - 0.15, 0.06, d - 0.15), mats.base, { p: [0, top - 0.13, 0] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(g, G.cyl(0.06, 0.06, top - 0.1, 8), mats.base, { p: [sx * (w / 2 - 0.15), (top - 0.1) / 2, sz * (d / 2 - 0.15)] });
  }
  const seats: [number, number, number][] = kind === 'pair' ? [[-(w / 2 + 0.47), 0, Math.PI / 2], [w / 2 + 0.47, 0, -Math.PI / 2]]
    : kind === 'six' ? [-w / 3, 0, w / 3].flatMap((x): [number, number, number][] => [[x, -(d / 2 + 0.44), 0], [x, d / 2 + 0.44, Math.PI]])
    : [[-w / 4, -(d / 2 + 0.44), 0], [w / 4, -(d / 2 + 0.44), 0], [-w / 4, d / 2 + 0.44, Math.PI], [w / 4, d / 2 + 0.44, Math.PI]];
  tableExtras(c, g, top, w, d, kind === 'pair' ? 3 : 5, seats.map(([x, z]) => ({ x, z })));
  seats.forEach(([x, z, r], i) => {
    const chair = group(g, { p: [x, 0, z], r: [0, r, 0] });
    if (c === 'kr' && style === 'crate_kr') buildCrateSeat(chair, i + 1);
    else if (c === 'kr' && style === 'stone_jp') buildBoxStool(chair, wood!, i + 1);
    else if (c === 'kr' && style !== 'drum_kr') buildLeatherChair(chair, style ? toon((furn.colors as { seat: number }).seat) : mats.seat, i + 1);
    else if (wood && style === 'zataku_jp') buildFloorSeat(chair, wood, i + 1);
    else if (wood && style === 'stone_jp') buildBoxStool(chair, wood, i + 1);
    else if (style === 'drum_kr') buildDrumStool(chair, i + 1);
    else if (wood && c === 'jp') buildOakChair(chair, wood, mats.seat, i + 1);
    else if (wood && style === 'oak_vn') buildSpindleChair(chair, wood, i + 1);
    else if (wood && style === 'luxury_vn') buildRattanArmchair(chair, wood, i + 1);
    else if (wood) buildWoodStool(chair, wood, i + 1);
    else if (c === 'oc') buildPlasticChair(chair, mats.seat, i + 1);
    else buildSeat(seatStyle(c), chair, mats);
  });
  return g;
}

/** Gỗ nâu sẫm ánh ô liu của bộ sang trọng Quán Ốc. */
const OC_WOOD = { top: 0x7d6743, base: 0x634f30, seat: 0x7d6743 };

/** Quán Ốc bậc 2 (inox: bàn inox gấp + ghế nhựa lưng nan) và bộ sang trọng (wood: bàn gỗ + ghế lưng con tiện), đủ 4 cỡ bàn. */
export function ocSet(kind: 'single' | 'pair' | 'four' | 'six', style: 'inox' | 'wood' | 'bamboo'): THREE.Group {
  const g = group(null);
  const [w, d] = { single: [0.8, 0.8], pair: [1.27, 1.27], four: [2.18, 1.38], six: [3.4, 1.4] }[kind];
  const top = 0.75;
  const wood = style === 'wood' ? woodMats(OC_WOOD) : null;
  const seatsN = { single: 1, pair: 2, four: 4, six: 6 }[kind];
  if (wood) joinedTables(g, w, d, seatsN, 3, (sub, sw, sd, s) => buildWoodTable(sub, sw, sd, top, wood, s));
  else if (style === 'bamboo') joinedTables(g, w, d, seatsN, 3, (sub, sw, sd, s) => buildBambooTable(sub, sw, sd, top - 0.05, s));
  else joinedTables(g, w, d, seatsN, 3, (sub, sw, sd, s) => buildInoxTable(sub, sw, sd, top, s));
  buildChopstickSet(g, style === 'bamboo' ? top - 0.05 : top, 2, { scale: 0.8 });
  const chairMat = toon(SLAT_CHAIR_COLOR);
  const ex = w / 2 + 0.42;
  const ez = d / 2 + 0.42;
  const seats: [number, number, number][] =
    kind === 'single' ? [[0, ez, Math.PI]]
    : kind === 'pair' ? [[-ex, 0, Math.PI / 2], [ex, 0, -Math.PI / 2]]
    : kind === 'four' ? [[-w / 4, -ez, 0], [w / 4, -ez, 0], [-w / 4, ez, Math.PI], [w / 4, ez, Math.PI]]
    : [-w / 3, 0, w / 3].flatMap((x): [number, number, number][] => [[x, -ez, 0], [x, ez, Math.PI]]);
  seats.forEach(([x, z, r], i) => {
    const chair = group(g, { p: [x, 0, z], r: [0, r, 0] });
    if (wood) buildSpindleChair(chair, wood, i + 1);
    else if (style === 'bamboo') buildBambooStool(chair, i + 1);
    else buildSlatChair(chair, chairMat, i + 1);
  });
  return g;
}

export function lightUp(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x9a8a70, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 9, 6);
  scene.add(sun);
}

/** Đặt camera nhìn chéo 3/4 từ trên xuống, vừa khít khung vật thể. */
export function frame(camera: THREE.PerspectiveCamera, obj: THREE.Object3D, pad = 1.15): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(0.2, size.length() / 2);
  const dist = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * pad;
  const dir = new THREE.Vector3(0.55, 0.42, 1).normalize();
  camera.position.copy(center).addScaledVector(dir, dist);
  camera.near = dist / 50;
  camera.far = dist * 10;
  camera.updateProjectionMatrix();
  camera.lookAt(center);
  return center;
}



/** Mẫu sàn 2,6 m vuông: gạch hoa văn (DecorDef.pattern) hoặc ván sọc hai màu a / b. */
function floorSample(d: DecorDef): THREE.Group {
  const g = group(null);
  const S = 2.6;
  const c = d.colors as { a: number; b: number };
  mesh(g, G.box(S + 0.1, 0.1, S + 0.1), 0x6b5a48, { p: [0, -0.05, 0] });
  if (d.pattern && d.pattern !== 'walltile') {
    const geo = new THREE.PlaneGeometry(S, S);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * S) / FLOOR_TILE, (uv.getY(i) * S) / FLOOR_TILE);
    mesh(g, geo, toon(0xffffff, { map: floorTexture(d.pattern, c.a, c.b) }), { p: [0, 0.002, 0], r: [-Math.PI / 2, 0, 0], cast: false });
  } else {
    const n = 8;
    for (let i = 0; i < n; i++) mesh(g, G.box(S / n, 0.02, S), i % 2 ? c.b : c.a, { p: [-S / 2 + (i + 0.5) * (S / n), 0.01, 0], cast: false });
  }
  return g;
}

/** Mẫu góc tường: hai mảng tường vuông góc + nẹp chân tường + chút sàn (gạch ốp nếu là tường 'walltile'). */
function wallSample(d: DecorDef): THREE.Group {
  const g = group(null);
  const c = d.colors as { wall: number; trim: number };
  const [W, H] = [2.4, 2.2];
  mesh(g, G.box(W + 0.3, 0.06, W + 0.3), 0xc9b89c, { p: [0, -0.03, 0] });
  const tile = d.pattern === 'walltile';
  for (const side of [0, 1]) {
    const seg = group(g, side ? { p: [-W / 2, 0, 0], r: [0, Math.PI / 2, 0] } : { p: [0, 0, -W / 2] });
    mesh(seg, G.box(W, H, 0.16), c.wall, { p: [0, H / 2, -0.08] });
    mesh(seg, G.box(W, 0.16, 0.04), c.trim, { p: [0, 0.08, 0.02] });
    mesh(seg, G.box(W, 0.06, 0.05), c.trim, { p: [0, H - 0.03, 0.02] });
    if (tile) {
      const tex = wallTileTexture(c.wall, c.trim).clone();
      tex.repeat.set(W / WALL_TILE, (H - 0.22) / WALL_TILE);
      tex.needsUpdate = true;
      mesh(seg, new THREE.PlaneGeometry(W, H - 0.22), toon(0xffffff, { map: tex }), { p: [0, 0.16 + (H - 0.22) / 2, 0.005], cast: false });
    }
  }
  return g;
}

/** Model xem chi tiết một món nội thất ở Siêu thị: bộ bàn 4 + ghế (bàn ghế), mẫu sàn, mẫu góc tường. */
export function decorModel(d: DecorDef, cuisine: CuisineId, seats = 4): THREE.Object3D {
  if (d.slot === 'floor') return floorSample(d);
  if (d.slot === 'wall') return wallSample(d);
  const kind = seats >= 6 ? 'six' : seats >= 4 ? 'four' : 'pair';
  if (cuisine === 'oc') {
    const oc = { inox_oc: 'inox', bamboo_oc: 'bamboo', wood_oc: 'wood' } as const;
    const st = d.style && d.style in oc ? oc[d.style as keyof typeof oc] : null;
    return st ? ocSet(seats <= 1 ? 'single' : kind, st) : tableSet('oc', kind === 'six' ? 'four' : kind);
  }
  return tableSet(cuisine, kind, d.style as Parameters<typeof tableSet>[2]);
}
