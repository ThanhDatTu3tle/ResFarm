import * as THREE from 'three';
import type { CuisineId } from '../../data';
import { makeBush, makePerson } from './models';
import type { Env } from './stage';
import { emojiSprite, G, group, mesh, toon } from './toon';

/**
 * HÌNH ẢNH THEO PHONG CÁCH QUÁN (Nhật / Hàn / Việt):
 *  - makeShopfront(): mặt tiền quán, dùng ở màn hình mở đầu (src/ui/title.ts).
 *  - decorateInterior(): đồ trang trí đặc trưng trong quán (RestaurantArea gọi lúc dựng phòng).
 *  - tableExtras() / seatStyle(): đồ trên bàn và kiểu ghế theo quán.
 * Màu sàn / tường / bàn ghế vẫn lấy từ nội thất đang dùng (DecorDef.colors), file này chỉ thêm đồ vật.
 */

/**
 * Biển chữ phẳng (gắn lên tường / bảng hiệu, không quay theo camera như textSprite). Chữ tự co cho vừa khung.
 * Rộng w, cao h (mét), mặt nhìn về +z.
 */
export function signText(text: string, color: string, w: number, h: number, glow = false): THREE.Mesh {
  const cw = 512;
  const ch = Math.round((cw * h) / w);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const c = canvas.getContext('2d')!;
  let size = ch * 0.72;
  const font = () => (c.font = `bold ${Math.round(size)}px Mali, system-ui, sans-serif`);
  font();
  const fit = (cw * 0.9) / Math.max(1, c.measureText(text).width);
  if (fit < 1) size *= fit;
  font();
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  if (glow) {
    c.shadowColor = color;
    c.shadowBlur = size * 0.35;
  }
  c.fillStyle = color;
  c.fillText(text, cw / 2, ch / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
}

/** Vật liệu phát sáng (đèn lồng, biển neon): sáng lên khi trời tối. */
function glowMat(color: number, base = 0.25): THREE.MeshToonMaterial {
  const m = toon(color, { emissive: color, emissiveIntensity: base });
  m.userData.glowBase = base;
  return m;
}

/** Đèn lồng giấy Nhật (chōchin): thân đỏ, hai vành đen. */
function chochin(parent: THREE.Object3D, x: number, y: number, z: number, s = 1, color = 0xd9433a): THREE.Group {
  const g = group(parent, { p: [x, y, z], s });
  mesh(g, G.sphere(0.22, 14, 10), glowMat(color), { s: [1, 1.35, 1], cast: false });
  for (const sy of [-1, 1]) mesh(g, G.cyl(0.13, 0.13, 0.06, 12), 0x2a1f1a, { p: [0, sy * 0.29, 0] });
  mesh(g, G.cyl(0.012, 0.012, 0.3, 4), 0x2a1f1a, { p: [0, 0.45, 0], cast: false });
  return g;
}

/** Đèn lồng lụa Hội An: thân tròn màu, chóp và đáy vàng đồng, tua rua. */
function hoiAnLantern(parent: THREE.Object3D, x: number, y: number, z: number, color: number, s = 1): THREE.Group {
  const g = group(parent, { p: [x, y, z], s });
  mesh(g, G.sphere(0.2, 12, 10), glowMat(color, 0.3), { s: [1, 1.15, 1], cast: false });
  mesh(g, G.cone(0.1, 0.1, 8), 0xd4a537, { p: [0, 0.27, 0] });
  mesh(g, G.cone(0.08, 0.08, 8), 0xd4a537, { p: [0, -0.26, 0], r: [Math.PI, 0, 0] });
  mesh(g, G.cyl(0.015, 0.03, 0.18, 5), color, { p: [0, -0.4, 0], cast: false }); // tua rua
  return g;
}

/** Rèm noren: các dải vải chàm treo trên thanh gỗ, giữa có hình tròn trắng. */
function noren(parent: THREE.Object3D, x: number, y: number, z: number, width: number, panels = 3, color = 0x2f3f75): THREE.Group {
  const g = group(parent, { p: [x, y, z] });
  mesh(g, G.cyl(0.03, 0.03, width + 0.3, 6), 0x6b4a2f, { r: [0, 0, Math.PI / 2] });
  const pw = width / panels;
  for (let i = 0; i < panels; i++) {
    const px = -width / 2 + pw * (i + 0.5);
    mesh(g, G.box(pw - 0.04, 0.75, 0.02), color, { p: [px, -0.4, 0], cast: false });
  }
  mesh(g, G.cyl(0.16, 0.16, 0.03, 18), 0xf6f1e4, { p: [0, -0.35, 0.02], r: [Math.PI / 2, 0, 0], cast: false });
  return g;
}

/** Mèo thần tài maneki-neko: mèo trắng ngồi, một tay vẫy. Trả về tay để vẫy. */
function manekiNeko(parent: THREE.Object3D, x: number, y: number, z: number, s = 1): THREE.Object3D {
  const g = group(parent, { p: [x, y, z], s });
  mesh(g, G.sphere(0.13, 12, 10), 0xffffff, { p: [0, 0.12, 0], s: [1, 1.1, 0.9] });
  mesh(g, G.sphere(0.11, 12, 10), 0xffffff, { p: [0, 0.32, 0] });
  for (const sx of [-1, 1]) mesh(g, G.cone(0.04, 0.07, 4), 0xffffff, { p: [sx * 0.06, 0.43, 0] });
  mesh(g, G.torus(0.07, 0.015, 6, 14), 0xd9433a, { p: [0, 0.22, 0.02], r: [Math.PI / 2 - 0.3, 0, 0] }); // vòng cổ
  mesh(g, G.sphere(0.025, 8, 6), 0xf2c94c, { p: [0, 0.19, 0.1] }); // chuông
  for (const sx of [-1, 1]) mesh(g, G.sphere(0.012, 6, 5), 0x2a1f1a, { p: [sx * 0.04, 0.34, 0.1], cast: false });
  const paw = group(g, { p: [0.09, 0.3, 0.03] });
  mesh(paw, G.capsule(0.03, 0.08), 0xffffff, { p: [0, 0.06, 0] });
  return paw;
}

/** Bonsai trong chậu thấp. */
function bonsai(parent: THREE.Object3D, x: number, z: number, s = 1): void {
  const g = group(parent, { p: [x, 0, z], s });
  mesh(g, G.box(0.7, 0.22, 0.45), 0x3b4f6b, { p: [0, 0.11, 0] });
  mesh(g, G.cyl(0.04, 0.07, 0.5, 6), 0x6b4a2f, { p: [0.05, 0.45, 0], r: [0, 0, 0.3] });
  for (const [px, py, sc] of [[-0.12, 0.72, 1], [0.22, 0.62, 0.8], [0.02, 0.86, 0.7]]) mesh(g, G.ico(0.18 * sc, 1), 0x3f7f4a, { p: [px, py, 0], s: [1.4, 0.7, 1] });
}

/** Quạt trần: trả về cánh quạt để quay. */
function ceilingFan(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
  const g = group(parent, { p: [x, y, z] });
  mesh(g, G.cyl(0.02, 0.02, 0.5, 5), 0x5a5f6a, { p: [0, 0.25, 0], cast: false });
  mesh(g, G.cyl(0.12, 0.1, 0.12, 10), 0xf3f0e8);
  const blades = group(g, { p: [0, -0.04, 0] });
  for (let i = 0; i < 3; i++) {
    const arm = group(blades, { r: [0, (i * Math.PI * 2) / 3, 0] });
    mesh(arm, G.box(0.75, 0.02, 0.16), 0x8a5a35, { p: [0.45, 0, 0], cast: false });
  }
  return blades;
}

/**
 * Ô che bàn của quán ốc: cụp lại lúc trời khô, bung ra khi mưa (decorateInterior cập nhật).
 * Bàn dựng lại / bán đi thì ô cũ tự bị bỏ (không còn gắn vào cảnh).
 */
const umbrellas = new Set<{ open: THREE.Object3D; closed: THREE.Object3D; k: number }>();

function attached(o: THREE.Object3D): boolean {
  let p: THREE.Object3D | null = o;
  while (p.parent) p = p.parent;
  return p.type === 'Scene' || !!p.userData.areaRoot;
}

/** Dây đèn võng giữa hai điểm, bóng vàng cách đều; trả về vật liệu bóng (sáng khi tối). */
function stringLights(r: THREE.Object3D, a: [number, number, number], b: [number, number, number], bulbMat: THREE.Material, sag = 0.35): void {
  const n = Math.max(3, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.55));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t));
  }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x6b6f78, transparent: true, opacity: 0.6 }));
  r.add(line);
  for (let i = 1; i < n; i++) mesh(r, G.sphere(0.075, 8, 6), bulbMat, { p: [pts[i].x, pts[i].y - 0.08, pts[i].z], cast: false });
}

export interface InteriorDims {
  halfW: number;
  backZ: number;
  frontZ: number;
  kitchenZ: number;
  /** Mép trái gian bếp; bên trái là lối đi WC + kho. */
  kitchenX1: number;
  wallH: number;
}

/** Thứ cần cập nhật mỗi khung hình (quạt quay, mèo vẫy, đèn sáng theo đêm). */
export type InteriorAnimator = (env: Env, dt: number) => void;

/**
 * Đồ trang trí đặc trưng của quán, dựng thêm vào phòng có sẵn (tường, sàn, bếp, quầy ra món do RestaurantArea dựng).
 * Không đặt đồ trong vùng ăn (bàn kéo thả được): chỉ treo tường, treo trần, góc phòng và trên bếp.
 */
export function decorateInterior(cuisine: CuisineId, r: THREE.Object3D, d: InteriorDims): InteriorAnimator {
  const glows: THREE.MeshToonMaterial[] = [];
  const nightLights: THREE.PointLight[] = [];
  const spinners: THREE.Object3D[] = [];
  const wavers: THREE.Object3D[] = [];
  const swingers: THREE.Object3D[] = [];
  const back = d.backZ + 0.02;
  const kc = d.kitchenX1 + 3.1; // tâm dãy bếp (khớp RestaurantArea.kitchenCenter)

  if (cuisine === 'oc') {
    // Cột đèn bốn góc + dây đèn vàng giăng quanh và chéo qua khu bàn; hai chậu cây ở góc trước
    const bulb = glowMat(0xffd27a, 0.15);
    bulb.userData.night = true; // sáng theo đêm (không chỉ theo trời âm u)
    glows.push(bulb);
    const x = d.halfW + 0.15;
    const zb = d.kitchenZ + 0.6;
    const zf = d.frontZ + 0.2;
    for (const px of [-x, x]) for (const pz of [zb, zf]) mesh(r, G.cyl(0.05, 0.06, 3.7, 8), 0x5a5f66, { p: [px, 1.85, pz] });
    const h = 3.6;
    stringLights(r, [-x, h, zb], [-x, h, zf], bulb);
    stringLights(r, [x, h, zb], [x, h, zf], bulb);
    stringLights(r, [-x, h, zf], [x, h, zf], bulb, 0.45);
    stringLights(r, [-x, h, (zb + zf) / 2], [x, h, (zb + zf) / 2], bulb, 0.5);
    // Ánh đèn vàng hắt xuống sân: vài nguồn sáng ấm dưới dây đèn, chỉ bật khi trời tối
    for (const px of [-d.halfW * 0.55, d.halfW * 0.55]) {
      for (const pz of [zb + (zf - zb) * 0.3, zb + (zf - zb) * 0.8]) {
        const l = new THREE.PointLight(0xffc56b, 0, 7.5, 1.4);
        l.position.set(px, 3.0, pz);
        r.add(l);
        nightLights.push(l);
      }
    }
    for (const [px, pz] of [[-d.halfW + 0.5, d.frontZ - 0.5], [d.halfW - 0.5, d.frontZ - 0.5]]) {
      mesh(r, G.cyl(0.3, 0.24, 0.45), 0x8a8f99, { p: [px, 0.22, pz] });
      makeBush(r, { p: [px, 0.4, pz], s: 1 }, 0x4f9e4a);
    }
  } else if (cuisine === 'jp') {
    // Rèm noren trước gian bếp, đèn lồng đỏ treo trần, mèo thần tài, thẻ gỗ ghi món trên tường, bonsai ở góc
    noren(r, (d.kitchenX1 + d.halfW) / 2, 3.55, d.kitchenZ + 0.1, d.halfW - d.kitchenX1 - 0.3, 4);
    for (const x of [-d.halfW * 0.55, 0, d.halfW * 0.55]) swingers.push(chochin(r, x, 3.7, 1, 1.0)); // treo cao, không che khách
    for (const x of [-d.halfW + 0.6, d.halfW - 0.6]) swingers.push(chochin(r, x, 3.3, d.kitchenZ + 0.4, 0.9, 0xf3efe0));
    wavers.push(manekiNeko(r, kc - 1.55, 1.02, d.backZ + 0.55, 1.3)); // đầu dãy bếp, cạnh chảo
    for (let i = 0; i < 7; i++) {
      const x = kc - 1.26 + i * 0.42;
      mesh(r, G.box(0.32, 0.9 + (i % 2) * 0.12, 0.03), 0xe8cf9c, { p: [x, 2.65, back + 0.08], cast: false });
      mesh(r, G.box(0.06, 0.55, 0.01), 0x2a1f1a, { p: [x, 2.65, back + 0.1], cast: false }); // chữ thư pháp
    }
    for (const [x, z] of [[-d.halfW + 0.7, d.frontZ - 0.8], [d.halfW - 0.7, d.frontZ - 0.8]]) bonsai(r, x, z);
    // Bình phong tre mỏng hai bên tường
    for (const side of [-1, 1]) for (let i = 0; i < 9; i++) mesh(r, G.cyl(0.035, 0.035, 2.2, 6), 0x8fb35a, { p: [side * (d.halfW - 0.1), 1.1, d.frontZ - 3.4 + i * 0.09], cast: false });
  } else if (cuisine === 'kr') {
    // Biển neon trên tường sau, ống hút khói (dựng theo bàn ở tableExtras), poster, thùng soju, đèn kim loại
    const neon = glowMat(0xff5fa2, 0.9);
    const frame = group(r, { p: [kc - 0.4, 3.05, back + 0.06] });
    mesh(frame, G.box(2.6, 0.75, 0.05), 0x2a2d35);
    const sign = signText('맛집 ★', '#ff7ab8', 2.3, 0.6, true);
    sign.position.set(0, 0, 0.04);
    frame.add(sign);
    for (const sx of [-1, 1]) mesh(frame, G.box(0.06, 0.6, 0.04), neon, { p: [sx * 1.2, 0, 0.05], cast: false });
    mesh(frame, G.box(2.4, 0.05, 0.04), neon, { p: [0, -0.3, 0.05], cast: false });
    glows.push(neon);
    for (const [x, c] of [[-d.halfW + 0.02, 0xffd23e], [d.halfW - 0.02, 0x5fb7e8]] as const) {
      const p = group(r, { p: [x, 2.4, d.backZ + 2.2], r: [0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0] });
      mesh(p, G.box(1.1, 1.4, 0.03), c, { cast: false });
      const icon = emojiSprite(x < 0 ? '🍗' : '🍜', 0.7);
      icon.position.set(0, 0.1, 0.05);
      p.add(icon);
    }
    // Két soju xanh ở góc
    for (const [x, z] of [[-d.halfW + 0.7, d.frontZ - 0.8], [d.halfW - 0.7, d.frontZ - 0.8]]) {
      const crate = group(r, { p: [x, 0, z] });
      for (let k = 0; k < 2; k++) mesh(crate, G.box(0.7, 0.32, 0.5), 0x2f8f5a, { p: [0, 0.16 + k * 0.34, 0] });
      for (const bx of [-0.2, 0, 0.2]) mesh(crate, G.cyl(0.04, 0.05, 0.28, 8), 0x5fd08a, { p: [bx, 0.82, 0] });
    }
  } else {
    // Đèn lồng Hội An nhiều màu, quạt trần, chữ Phúc, mành tre (không đặt bàn thờ ở quán nào)
    const colors = [0xd9433a, 0xf2b23e, 0x9a4fc4, 0xe2703a, 0x3f9f6a];
    for (const [i, x] of [-d.halfW * 0.55, 0, d.halfW * 0.55].entries()) swingers.push(hoiAnLantern(r, x, 3.75, 1, colors[i], 1.15)); // treo cao, không che khách
    for (let i = 0; i < 9; i++) swingers.push(hoiAnLantern(r, -d.halfW + 0.9 + i * ((d.halfW * 2 - 1.8) / 8), 3.7, d.kitchenZ + 0.3, colors[i % colors.length], 0.7));
    for (const x of [-d.halfW * 0.3, d.halfW * 0.3]) spinners.push(ceilingFan(r, x, 4.05, -0.4));
    // Chữ Phúc trên giấy đỏ hình thoi
    const fu = group(r, { p: [(-d.halfW + d.kitchenX1) / 2, 3.3, back + 0.05], r: [0, 0, Math.PI / 4] }); // giữa hai cửa WC / kho
    mesh(fu, G.box(0.75, 0.75, 0.02), 0xd9433a, { cast: false });
    const word = signText('Phúc', '#f2c94c', 0.7, 0.4);
    word.position.set(0, 0, 0.02);
    word.rotation.z = -Math.PI / 4;
    fu.add(word);
    // Mành tre cuộn trên các cửa sổ
    mesh(r, G.cyl(0.1, 0.1, 2.5, 8), 0xd9b56a, { p: [d.halfW - 2, 3.45, back + 0.2], r: [0, 0, Math.PI / 2] });
    for (const [x, z] of [[d.halfW - 0.7, d.frontZ - 0.8]]) {
      mesh(r, G.cyl(0.35, 0.28, 0.5), 0xc8623e, { p: [x, 0.25, z] });
      makeBush(r, { p: [x, 0.45, z], s: 1.1 }, 0x4f9e4a);
    }
  }

  // Đèn lồng / neon: sáng dần khi trời tối
  for (const g of swingers) g.traverse((o) => o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial && o.material.userData.glowBase != null && glows.push(o.material));
  const phases = swingers.map((_, i) => i * 1.7);
  return (env, dt) => {
    for (const m of glows) m.emissiveIntensity = (m.userData.glowBase as number) + (m.userData.night ? Math.max(env.dim * 0.6, env.night * 2.2) : env.dim * 0.9);
    for (const l of nightLights) l.intensity = env.night * 1.3;
    // Ô che bàn (quán ốc): mưa thì bung, tạnh thì cụp
    if (cuisine === 'oc') {
      const want = env.rain > 0.2 ? 1 : 0;
      for (const u of umbrellas) {
        if (!attached(u.open)) {
          umbrellas.delete(u);
          continue;
        }
        u.k += (want - u.k) * Math.min(1, dt * 3);
        u.open.visible = u.k > 0.04;
        u.open.scale.set(Math.max(0.05, u.k), 0.4 + 0.6 * u.k, Math.max(0.05, u.k));
        u.closed.visible = u.k < 0.5;
      }
    }
    for (const s of spinners) s.rotation.y += dt * 5;
    for (const w of wavers) w.rotation.z = -0.4 + Math.sin(env.t * 4) * 0.45;
    swingers.forEach((s, i) => (s.rotation.z = Math.sin(env.t * 1.3 + phases[i]) * 0.05));
  };
}

/** Kiểu ghế: ghế tựa (Nhật), ghế đẩu tròn inox (Hàn), ghế nhựa thấp (Việt). */
export type SeatStyle = 'chair' | 'stool' | 'plastic';
export function seatStyle(cuisine: CuisineId): SeatStyle {
  return cuisine === 'kr' ? 'stool' : cuisine === 'vn' || cuisine === 'oc' ? 'plastic' : 'chair';
}

/**
 * Đồ trên bàn (bàn thường, không phải quầy): Nhật — chai nước tương + ống đũa; Hàn — bếp nướng giữa bàn + ống hút khói
 * treo trên + chai soju; Việt — ống đũa + lọ tương ớt + hộp giấy. Gốc toạ độ ở tâm bàn, mặt bàn ở `top`.
 */
let umbrellaColor = 0;
export function tableExtras(cuisine: CuisineId, g: THREE.Object3D, top: number, w: number, d: number): void {
  if (cuisine === 'oc') {
    // Chén nước chấm, lọ ớt, hộp giấy; ô che giữa bàn (cụp, mưa thì bung — decorateInterior)
    mesh(g, G.cyl(0.07, 0.05, 0.05, 10), 0xffffff, { p: [-0.18, top + 0.03, 0.05] });
    mesh(g, G.cyl(0.04, 0.04, 0.02, 10), 0x7cc35c, { p: [-0.18, top + 0.06, 0.05], cast: false }); // muối tiêu chanh
    mesh(g, G.cyl(0.035, 0.04, 0.14, 8), 0xd9433a, { p: [0.18, top + 0.07, -0.05] });
    mesh(g, G.box(0.14, 0.08, 0.1), 0xffffff, { p: [0.05, top + 0.04, -0.15] });
    const colors = [0xe2473c, 0x3f7fd2, 0xf2b23e, 0x3f9f6a];
    const c = colors[umbrellaColor++ % colors.length];
    mesh(g, G.cyl(0.025, 0.025, 2.4, 6), 0xdfe5ea, { p: [0, top + 1.2 - 0.3, 0] });
    const closed = group(g, { p: [0, top + 2.0, 0] });
    mesh(closed, G.cone(0.13, 0.9, 8), c, { r: [Math.PI, 0, 0] });
    const open = group(g, { p: [0, top + 2.35, 0] });
    mesh(open, G.cone(1.05, 0.4, 12), c, { cast: false });
    for (let i = 0; i < 6; i++) mesh(open, G.box(0.03, 0.02, 1.2), 0xffffff, { p: [Math.sin((i * Math.PI) / 3) * 0.6, -0.2, Math.cos((i * Math.PI) / 3) * 0.6], r: [0, (i * Math.PI) / 3, 0], cast: false });
    open.visible = false;
    umbrellas.add({ open, closed, k: 0 });
  } else if (cuisine === 'kr') {
    mesh(g, G.cyl(0.26, 0.26, 0.06, 18), 0x2a2d35, { p: [0, top + 0.03, 0] });
    mesh(g, G.torus(0.22, 0.012, 4, 20), 0x8a8f99, { p: [0, top + 0.07, 0], r: [Math.PI / 2, 0, 0], cast: false });
    // Ống hút khói bạc treo từ trần xuống
    // treo cao (miệng ống ~2.9 m) để không che mặt khách
    mesh(g, G.cyl(0.07, 0.07, 1.0, 10), 0xc9ced6, { p: [0, top + 2.75, 0], cast: false });
    mesh(g, G.cone(0.3, 0.3, 14), 0xc9ced6, { p: [0, top + 2.15, 0], cast: false });
    mesh(g, G.cyl(0.035, 0.045, 0.24, 8), 0x5fd08a, { p: [w / 2 - 0.2, top + 0.12, d / 2 - 0.18] });
  } else if (cuisine === 'jp') {
    mesh(g, G.cyl(0.035, 0.04, 0.12, 8), 0x2a1f1a, { p: [0.12, top + 0.06, 0] });
    mesh(g, G.cyl(0.02, 0.02, 0.04, 6), 0xd9433a, { p: [0.12, top + 0.14, 0] });
    mesh(g, G.cyl(0.05, 0.05, 0.16, 10), 0x6b4a2f, { p: [-0.1, top + 0.08, 0] });
    for (const dx of [-0.02, 0.02]) mesh(g, G.cyl(0.008, 0.008, 0.22, 4), 0xe8cf9c, { p: [-0.1 + dx, top + 0.18, 0], cast: false });
  } else {
    mesh(g, G.cyl(0.05, 0.05, 0.16, 10), 0xd9d2c5, { p: [-0.1, top + 0.08, 0] });
    for (const dx of [-0.02, 0.02]) mesh(g, G.cyl(0.008, 0.008, 0.22, 4), 0xc98b4f, { p: [-0.1 + dx, top + 0.18, 0], cast: false });
    mesh(g, G.cyl(0.035, 0.04, 0.14, 8), 0xd9433a, { p: [0.08, top + 0.07, 0] });
    mesh(g, G.box(0.14, 0.08, 0.1), 0xffffff, { p: [0.08, top + 0.04, 0.14] });
  }
}

/** Đồ trên quầy dài: Nhật — tủ kính sushi; Hàn — khay kimchi; Việt — rổ rau thơm. Quầy chạy dọc x, sâu d. */
export function counterExtras(cuisine: CuisineId, g: THREE.Object3D, top: number, w: number, d: number): void {
  if (cuisine === 'oc') {
    // Bàn dài nhựa: rổ rau thơm, chai tương ớt, chén muối tiêu chanh
    for (const x of [-w * 0.3, w * 0.3]) {
      mesh(g, G.cyl(0.15, 0.11, 0.07, 12), 0x3f8fd2, { p: [x, top + 0.04, -d / 2 + 0.1] });
      mesh(g, G.ico(0.09, 0), 0x5fae57, { p: [x, top + 0.1, -d / 2 + 0.1], s: [1.3, 0.6, 1.3] });
      mesh(g, G.cyl(0.035, 0.04, 0.14, 8), 0xd9433a, { p: [x + 0.3, top + 0.07, -d / 2 + 0.1] });
    }
  } else if (cuisine === 'jp') {
    const z = -d / 2 + 0.05;
    mesh(g, G.box(w * 0.8, 0.24, 0.26), toon(0xdff3ff, { transparent: true, opacity: 0.4 }), { p: [0, top + 0.12, z], cast: false });
    for (let i = 0; i < 8; i++) mesh(g, G.box(0.14, 0.04, 0.08), i % 2 ? 0xf28c5a : 0xf6f1e4, { p: [-w * 0.35 + i * (w * 0.7 / 7), top + 0.03, z], cast: false });
  } else if (cuisine === 'kr') {
    for (const x of [-w * 0.3, w * 0.3]) {
      mesh(g, G.cyl(0.12, 0.1, 0.05, 12), 0xf3f0e8, { p: [x, top + 0.025, -d / 2 + 0.08] });
      mesh(g, G.sphere(0.07, 8, 6), 0xd9433a, { p: [x, top + 0.06, -d / 2 + 0.08], s: [1, 0.5, 1] });
    }
  } else {
    for (const x of [-w * 0.3, w * 0.3]) {
      mesh(g, G.cyl(0.16, 0.12, 0.08, 12), 0xc9a066, { p: [x, top + 0.04, -d / 2 + 0.08] });
      mesh(g, G.ico(0.1, 0), 0x5fae57, { p: [x, top + 0.1, -d / 2 + 0.08], s: [1.3, 0.6, 1.3] });
    }
  }
}

/** Dựng một ghế theo kiểu quán vào `chair` (gốc ở tâm mặt đất của ghế, nhìn về +z). */
export function buildSeat(style: SeatStyle, chair: THREE.Object3D, mats: { seat: THREE.Material; back: THREE.Material; base: THREE.Material }): void {
  if (style === 'stool') {
    mesh(chair, G.cyl(0.2, 0.2, 0.06, 16), mats.seat, { p: [0, 0.46, 0] });
    mesh(chair, G.cyl(0.04, 0.04, 0.4, 8), mats.base, { p: [0, 0.23, 0] });
    mesh(chair, G.cyl(0.18, 0.2, 0.03, 14), mats.base, { p: [0, 0.015, 0] });
  } else if (style === 'plastic') {
    mesh(chair, G.box(0.42, 0.05, 0.42), mats.seat, { p: [0, 0.44, 0] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(chair, G.box(0.06, 0.44, 0.06), mats.seat, { p: [sx * 0.17, 0.22, sz * 0.17], r: [sz * 0.08, 0, -sx * 0.08] });
    mesh(chair, G.box(0.34, 0.04, 0.34), mats.seat, { p: [0, 0.14, 0] }); // thanh giằng
  } else {
    mesh(chair, G.box(0.48, 0.07, 0.46), mats.base, { p: [0, 0.44, 0] });
    mesh(chair, G.box(0.42, 0.06, 0.4), mats.seat, { p: [0, 0.5, 0.01] }); // nệm zabuton
    mesh(chair, G.box(0.48, 0.5, 0.06), mats.back, { p: [0, 0.75, -0.21] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(chair, G.cyl(0.035, 0.035, 0.44, 6), mats.base, { p: [sx * 0.19, 0.22, sz * 0.18] });
  }
}

// ---------- Mặt tiền quán (màn hình mở đầu) ----------

/** Người đứng trước quán vẫy chào (chủ quán), để màn chọn có sức sống. Trả về group để animatePerson. */
export function shopkeeper(cuisine: CuisineId): THREE.Group {
  const look = cuisine === 'jp' ? { shirt: 0x2f3f75, hair: 0x1f1a17, skin: 0xffd9b8 } : cuisine === 'kr' ? { shirt: 0xff7ab8, hair: 0x3a2a1e, skin: 0xffe1c7 } : cuisine === 'oc' ? { shirt: 0x3fb6a8, hair: 0x3a2a1e, skin: 0xf2c49b } : { shirt: 0xf2b23e, hair: 0x1f1a17, skin: 0xf2c49b };
  return makePerson(look, cuisine === 'vn' ? 'straw' : 'none');
}

/**
 * Mặt tiền quán, gốc ở giữa mép trước nền nhà, nhìn về +z. Rộng ~6 m, sâu ~4 m.
 * Trả về group + danh sách vật liệu phát sáng (để màn mở đầu cho sáng nhấp nháy nhẹ).
 */
export function makeShopfront(cuisine: CuisineId): { g: THREE.Group; glows: THREE.MeshToonMaterial[] } {
  const g = group(null);
  const glows: THREE.MeshToonMaterial[] = [];
  const W = 6;
  const D = 4;
  const H = 3.2;
  mesh(g, G.box(W + 1, 0.2, D + 1.6), 0xcfc6b5, { p: [0, 0.1, -D / 2 + 0.6] }); // nền / vỉa hè

  if (cuisine === 'oc') {
    // Quán ốc vỉa hè: sạp dù sọc đỏ trắng che xe đẩy + bếp nướng, bảng chân đứng, bàn nhựa xanh ghế đỏ có ô, dây đèn vàng
    mesh(g, G.box(W + 1, 0.04, D + 1.6), 0xaeaca6, { p: [0, 0.22, -D / 2 + 0.6], cast: false }); // nền bê tông
    for (const x of [-2.6, 2.6]) for (const z of [-3.2, -0.4]) mesh(g, G.cyl(0.05, 0.05, 3.3, 8), 0x8a8f99, { p: [x, 0.2 + 1.65, z] });
    for (let i = 0; i < 10; i++) mesh(g, G.box(0.6, 0.06, 3.6), i % 2 ? 0xfaf3e6 : 0xe2473c, { p: [-2.7 + (i + 0.5) * 0.54, 3.55, -1.8], r: [-0.08, 0, 0] });
    // Xe đẩy + tủ kính
    const cart = group(g, { p: [-0.9, 0.2, -1.9] });
    mesh(cart, G.box(1.9, 0.75, 0.85), 0xc8d0d5, { p: [0, 0.62, 0] });
    for (const sx of [-1, 1]) mesh(cart, G.cyl(0.22, 0.22, 0.08, 14), 0x2a2d35, { p: [sx * 0.65, 0.22, 0.45], r: [Math.PI / 2, 0, 0] });
    const panel = group(cart, { p: [0, 0.62, 0.44] });
    mesh(panel, G.box(1.6, 0.48, 0.02), 0xd9433a);
    const w = signText('ỐC · SÒ · HÀU', '#ffe7a3', 1.5, 0.38);
    w.position.z = 0.02;
    panel.add(w);
    mesh(cart, G.box(1.8, 0.42, 0.65), toon(0xdff3ff, { transparent: true, opacity: 0.35 }), { p: [0, 1.24, -0.05], cast: false });
    for (const [i, icon] of ['🐚', '🦪', '🦐'].entries()) {
      const sp = emojiSprite(icon, 0.3);
      sp.position.set(-0.55 + i * 0.55, 1.2, -0.05);
      cart.add(sp);
    }
    // Bếp nướng có than hồng
    const grill = group(g, { p: [1.4, 0.2, -1.9] });
    mesh(grill, G.box(1.2, 0.3, 0.6), 0x3b3f46, { p: [0, 0.85, 0] });
    for (const sx of [-1, 1]) mesh(grill, G.box(0.06, 0.72, 0.5), 0x3b3f46, { p: [sx * 0.5, 0.36, 0] });
    const coal = glowMat(0xff7a2a, 1.2);
    glows.push(coal);
    mesh(grill, G.box(1.1, 0.05, 0.5), coal, { p: [0, 1.02, 0], cast: false });
    const oyster = emojiSprite('🦪', 0.3);
    oyster.position.set(0, 1.2, 0);
    grill.add(oyster);
    // Bảng chân đứng bên trái xe
    const board = group(g, { p: [-2.9, 0.2, 0.5], r: [0, 0.25, 0] });
    for (const sx of [-1, 1]) mesh(board, G.box(0.06, 1.5, 0.06), 0x6b4a2f, { p: [sx * 0.6, 0.75, 0] });
    mesh(board, G.box(1.4, 0.85, 0.05), 0x2f3a33, { p: [0, 1.1, 0.05] });
    const t = signText('QUÁN ỐC', '#ffe7a3', 1.25, 0.5);
    t.position.set(0, 1.12, 0.09);
    board.add(t);
    // Bàn nhựa xanh + ghế đỏ + ô
    const table = group(g, { p: [1.6, 0.2, 1.3] });
    mesh(table, G.box(0.8, 0.05, 0.6), 0x3f8fd2, { p: [0, 0.48, 0] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(table, G.box(0.05, 0.46, 0.05), 0x2f6fb0, { p: [sx * 0.35, 0.23, sz * 0.25] });
    mesh(table, G.cyl(0.02, 0.02, 2.2, 6), 0xdfe5ea, { p: [0, 1.4, 0] });
    mesh(table, G.cone(1.0, 0.4, 12), 0x3f7fd2, { p: [0, 2.5, 0] });
    for (const [sx, sz] of [[-0.7, 0], [0.7, 0], [0, 0.6]]) {
      const stool = group(table, { p: [sx, 0, sz] });
      buildSeat('plastic', stool, { seat: toon(0xd93a32), back: toon(0xd93a32), base: toon(0xd93a32) });
      stool.scale.setScalar(0.7);
    }
    // Dây đèn vàng từ cột sạp ra cột đèn trước
    const bulb = glowMat(0xffd27a, 0.6);
    glows.push(bulb);
    mesh(g, G.cyl(0.04, 0.05, 3.2, 8), 0x5a5f66, { p: [3.1, 1.8, 1.8] });
    stringLights(g, [-2.6, 3.4, -0.4], [3.1, 3.3, 1.8], bulb, 0.4);
  } else if (cuisine === 'jp') {
    // Nhà gỗ tối, mái ngói xám hai lớp, cửa lùa shoji, rèm noren, đèn lồng đỏ, biển gỗ
    mesh(g, G.box(W, H, D), 0x5a3a26, { p: [0, 0.2 + H / 2, -D / 2] });
    for (const x of [-W / 2 + 0.1, W / 2 - 0.1, -1.2, 1.2]) mesh(g, G.box(0.18, H, 0.12), 0x3b2a1e, { p: [x, 0.2 + H / 2, 0.04] });
    const shoji = group(g, { p: [0, 0.2, 0.06] });
    mesh(shoji, G.box(2.2, 2.2, 0.06), 0xf6f1e4, { p: [0, 1.1, 0] });
    for (const x of [-0.75, -0.25, 0.25, 0.75]) mesh(shoji, G.box(0.04, 2.2, 0.08), 0x3b2a1e, { p: [x, 1.1, 0] });
    for (const y of [0.5, 1.0, 1.5, 2.0]) mesh(shoji, G.box(2.2, 0.04, 0.08), 0x3b2a1e, { p: [0, y, 0] });
    noren(g, 0, 2.65, 0.35, 2.3, 3);
    for (const x of [-2.1, 2.1]) {
      const lantern = chochin(g, x, 1.9, 0.4, 1.4);
      lantern.traverse((o) => o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial && o.material.userData.glowBase != null && glows.push(o.material));
    }
    // Mái hai lớp + diềm cong
    mesh(g, G.prism(), 0x4f5868, { p: [0, 0.2 + H, -D / 2], r: [0, Math.PI / 2, 0], s: [D + 1.2, 1.2, W + 1.2] });
    mesh(g, G.box(W + 1.4, 0.12, 0.5), 0x3b4250, { p: [0, 0.2 + H, 0.55] });
    mesh(g, G.box(W + 0.6, 0.1, 0.6), 0x3b4250, { p: [0, 0.2 + H - 0.75, 0.45] }); // mái hiên trên cửa
    const board = group(g, { p: [0, 0.2 + H + 0.35, 0.35] });
    mesh(board, G.box(1.8, 0.55, 0.08), 0x6b4a2f);
    const t = signText('寿司 · 和食', '#f6f1e4', 1.7, 0.5);
    t.position.set(0, 0, 0.05);
    board.add(t);
    bonsai(g, -2.6, 0.6, 0.9);
  } else if (cuisine === 'kr') {
    // Nhà hiện đại: tường kem viền cam, kính lớn, mái che sọc, biển neon hồng, bàn nhựa ngoài vỉa hè
    mesh(g, G.box(W, H + 0.6, D), 0xf6efe4, { p: [0, 0.2 + (H + 0.6) / 2, -D / 2] });
    mesh(g, G.box(W + 0.1, 0.3, D + 0.1), 0xf28c3c, { p: [0, 0.2 + H + 0.75, -D / 2] }); // diềm mái bằng
    const glass = toon(0xbfe6ff, { transparent: true, opacity: 0.55 });
    mesh(g, G.box(3.4, 1.9, 0.06), glass, { p: [-0.9, 1.35, 0.04], cast: false });
    mesh(g, G.box(1.1, 2.2, 0.06), 0x2a2d35, { p: [2.0, 1.3, 0.04] }); // cửa
    mesh(g, G.box(3.5, 0.08, 0.1), 0x2a2d35, { p: [-0.9, 2.32, 0.06] });
    // Mái che sọc đỏ trắng
    for (let i = 0; i < 10; i++) mesh(g, G.box(W / 10, 0.06, 1.1), i % 2 ? 0xffffff : 0xe2473c, { p: [-W / 2 + (i + 0.5) * (W / 10), 2.75, 0.5], r: [0.35, 0, 0] });
    const neon = glowMat(0xff5fa2, 1.2);
    glows.push(neon);
    const frame = group(g, { p: [0, 3.45, 0.12] });
    mesh(frame, G.box(3, 0.7, 0.08), 0x2a2d35);
    mesh(frame, G.box(2.8, 0.05, 0.04), neon, { p: [0, -0.28, 0.06], cast: false });
    mesh(frame, G.box(2.8, 0.05, 0.04), neon, { p: [0, 0.28, 0.06], cast: false });
    const t = signText('치킨 · 분식', '#ff9fd0', 2.8, 0.6, true);
    t.position.set(0, 0, 0.05);
    frame.add(t);
    // Bàn nhựa cam + ghế đẩu + chai soju
    const table = group(g, { p: [1.2, 0.2, 1.3] });
    mesh(table, G.cyl(0.45, 0.45, 0.05, 16), 0xf28c3c, { p: [0, 0.62, 0] });
    mesh(table, G.cyl(0.05, 0.08, 0.6, 8), 0x8a8f99, { p: [0, 0.3, 0] });
    for (const bx of [-0.12, 0.1]) mesh(table, G.cyl(0.04, 0.05, 0.24, 8), 0x5fd08a, { p: [bx, 0.76, 0.05] });
    for (const sx of [-0.75, 0.75]) {
      const stool = group(table, { p: [sx, 0, 0] });
      mesh(stool, G.cyl(0.18, 0.18, 0.05, 14), 0xf28c3c, { p: [0, 0.42, 0] });
      mesh(stool, G.cyl(0.04, 0.04, 0.4, 8), 0x8a8f99, { p: [0, 0.2, 0] });
    }
  } else {
    // Nhà Hội An: tường vàng, mái ngói đỏ, cửa chớp xanh, dây đèn lồng, ghế nhựa đỏ, bàn inox thấp, giàn hoa giấy
    mesh(g, G.box(W, H, D), 0xf5cf5b, { p: [0, 0.2 + H / 2, -D / 2] });
    mesh(g, G.box(W + 0.04, 0.4, D + 0.04), 0xe9bb48, { p: [0, 0.4, -D / 2] }); // chân tường
    for (const x of [-2.1, 2.1]) {
      mesh(g, G.box(1.1, 1.4, 0.06), 0x2f6f5a, { p: [x, 1.7, 0.04] });
      for (const y of [1.3, 1.55, 1.8, 2.05]) mesh(g, G.box(1.1, 0.04, 0.09), 0x255a48, { p: [x, y, 0.06] });
    }
    mesh(g, G.box(1.6, 2.3, 0.06), 0x7a4a2f, { p: [0, 1.35, 0.04] }); // cửa gỗ
    mesh(g, G.prism(), 0xc0573a, { p: [0, 0.2 + H, -D / 2], r: [0, Math.PI / 2, 0], s: [D + 1.4, 1.4, W + 1] });
    for (let i = 0; i < 12; i++) mesh(g, G.box(0.06, 0.06, D + 1.4), 0x9a3f2a, { p: [-W / 2 - 0.4 + i * ((W + 0.8) / 11), 0.2 + H + 0.03, -D / 2], cast: false });
    const board = group(g, { p: [0, 3.0, 0.15] });
    mesh(board, G.box(2.6, 0.55, 0.08), 0xc8302a);
    const t = signText('QUÁN VIỆT', '#ffd23e', 2.5, 0.5);
    t.position.set(0, 0, 0.05);
    board.add(t);
    const colors = [0xd9433a, 0xf2b23e, 0x9a4fc4, 0x3f9f6a, 0xe2703a, 0xd9433a, 0xf2b23e];
    colors.forEach((c, i) => {
      const lantern = hoiAnLantern(g, -2.7 + i * 0.9, 3.55 - Math.sin((i / 6) * Math.PI) * 0.25, 0.75, c, 0.75);
      lantern.traverse((o) => o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial && o.material.userData.glowBase != null && glows.push(o.material));
    });
    const table = group(g, { p: [-1.4, 0.2, 1.3] });
    mesh(table, G.box(0.9, 0.04, 0.6), 0xcfd6dc, { p: [0, 0.5, 0] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(table, G.cyl(0.02, 0.02, 0.5, 6), 0x9aa6b2, { p: [sx * 0.4, 0.25, sz * 0.25] });
    mesh(table, G.cyl(0.08, 0.06, 0.06, 12), 0xffffff, { p: [0, 0.55, 0] });
    for (const [sx, sz] of [[-0.75, 0], [0.75, 0], [0, 0.6]]) {
      const stool = group(table, { p: [sx, 0, sz] });
      buildSeat('plastic', stool, { seat: toon(0xd93a32), back: toon(0xd93a32), base: toon(0xd93a32) });
      stool.scale.setScalar(0.8);
    }
    for (const [x, z] of [[2.9, -0.2]]) {
      mesh(g, G.cyl(0.3, 0.25, 0.4), 0xc8623e, { p: [x, 0.4, z] });
      makeBush(g, { p: [x, 0.6, z], s: 1.1 }, 0xe0559a);
    }
  }
  return { g, glows };
}
