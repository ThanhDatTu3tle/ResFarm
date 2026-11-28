import * as THREE from 'three';
import { signText } from './cuisine';
import { LOOKS, animatePerson, makePerson } from './person';
import { G, group, mesh, seeded, toon } from './toon';

/**
 * BÃI ĐẤT HOANG bên Đông quán: cả khu đất trống phía Đông chia thành các lô dọc (lô k mở đường lên hạng k + 1) -
 * lô k = dải từ mép Đông của quán hạng k tới mép Đông hạng k + 1, chạy suốt từ mặt tiền tới mép sau của quán hạng cao nhất.
 * (Quán nâng hạng tự sâu thêm ra phía sau, phía sau không có đất hoang.)
 *  - Chưa dọn: đất nâu, xà bần, gạch vỡ, lốp xe cũ, ván gỗ, thùng phi rỉ, cỏ dại, cọc rào xiêu vẹo, biển "Đất hoang · Lô k".
 *  - Đang dọn: 2 anh thợ đội nón bảo hộ làm việc, rác biến dần theo tiến độ.
 *  - Đã dọn: đất cào phẳng, biển "Lô k · Sẵn sàng mở rộng".
 * Bấm vào lô (Pick {type:'lot'}) mở bảng Quán tới thẻ dọn lô / nâng hạng.
 */

export interface WastelandDims {
  /** Tường Tây của quán (đứng yên khi nâng hạng). */
  westX: number;
  /** Mặt tiền quán (đứng yên). */
  frontZ: number;
  /** Mép Đông / mép sau của quán ở từng hạng (phần tử i = hạng i + 1), toạ độ khu quán hiện tại. */
  tiers: { eastX: number; backZ: number }[];
  /** Hạng quán hiện tại (rào bao phần đất chưa thuộc quán). */
  tier: number;
  /** Kiểu rào theo quán. */
  cuisine: 'vn' | 'oc' | 'jp' | 'kr';
}

export interface LotStatus {
  tier: number;
  cleared: number;
  clearing?: { lot: number; left: number };
  /** Số phút dọn của lô đang dọn (để tính tiến độ). */
  clearMinutes?: number;
}

export interface WastelandView {
  update(s: LotStatus, t: number): void;
  /** Tâm lô (toạ độ khu quán) - để camera lướt tới. */
  centerOf(lot: number): { x: number; z: number } | null;
  /** Lô sáng nhấp nháy vài giây (lô kế tiếp được mở khi người chơi bấm vào bãi đất). */
  flash(lot: number): void;
}

type Rect = [number, number, number, number]; // x1, x2, z1, z2

interface Lot {
  id: number;
  center: { x: number; z: number };
  /** Viền sáng quanh lô (hiện khi nhấp nháy). */
  glow: THREE.Mesh;
  g: THREE.Group;
  junk: THREE.Object3D[];
  ground: THREE.Mesh[];
  sign: THREE.Group;
  signKey: string;
  workers: THREE.Group[];
}

const DIRT = 0x8a6a48;
const RAKED = 0xb08a5e;

export function buildWasteland(parent: THREE.Group, d: WastelandDims): WastelandView {
  const lots: Lot[] = [];
  for (let k = 1; k < d.tiers.length; k++) {
    const a = d.tiers[k - 1];
    const b = d.tiers[k];
    const backZ = d.tiers[d.tiers.length - 1].backZ;
    if (b.eastX - a.eastX < 0.05) continue;
    const rects: Rect[] = [[a.eastX, b.eastX, backZ, d.frontZ]];
    lots.push(buildLot(parent, k, rects, b.eastX, d.frontZ));
  }
  // Rào chắn cao 1,8 m bao quanh phần đất hoang còn lại (che bớt cảnh bừa bộn), kiểu rào theo quán
  const cur = d.tiers[Math.min(d.tier, d.tiers.length) - 1];
  const fin = d.tiers[d.tiers.length - 1];
  if (fin.eastX - cur.eastX > 0.3) {
    const f = group(parent);
    f.userData.pick = { type: 'lot', id: String(d.tier) };
    const x1 = cur.eastX + 0.05;
    const x2 = fin.eastX + 0.15;
    const zF = d.frontZ - 0.05;
    const zB = fin.backZ - 0.15;
    // Mặt trước (phía đường): cột rào đúng ranh giới từng lô - mỗi ô rào một lô, biển treo giữa ô
    const cuts = d.tiers.slice(d.tier, -1).map((t) => t.eastX - x1);
    fenceRun(f, d.cuisine, [x1, zF], [x2, zF], [0, ...cuts, x2 - x1]);
    fenceRun(f, d.cuisine, [x2, zF], [x2, zB]); // mặt Đông
    fenceRun(f, d.cuisine, [x2, zB], [x1, zB]); // mặt sau
    if (cur.backZ - zB > 0.3) fenceRun(f, d.cuisine, [x1, zB], [x1, cur.backZ]); // đoạn sau lưng quán (phần quán sẽ sâu thêm)
  }
  const keys = new Map<number, string>();
  let flash: { lot: number; until: number } | null = null;
  let now = 0;
  return {
    centerOf: (id) => lots.find((l) => l.id === id)?.center ?? null,
    flash(id) {
      flash = { lot: id, until: -1 }; // tính mốc hết ở khung hình kế tiếp (theo đồng hồ env.t)
    },
    update(s, t) {
      now = t;
      if (flash && flash.until < 0) flash.until = t + 4;
      for (const lot of lots) {
        // Lô vừa được chọn: nền sáng lên + viền vàng nhấp nháy
        const on = !!flash && flash.lot === lot.id && now < flash.until;
        const pulse = on ? 0.5 + 0.5 * Math.sin(now * 6) : 0;
        lot.glow.visible = on;
        if (on) (lot.glow.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.45 * pulse;
        for (const m of lot.ground) {
          const mat = m.material as THREE.MeshToonMaterial;
          mat.emissive.setHex(0xffd27a);
          mat.emissiveIntensity = pulse * 0.45;
        }
        // Lô đã thành một phần của quán: ẩn hẳn
        const inside = lot.id < s.tier;
        lot.g.visible = !inside;
        if (inside) continue;
        const clearing = s.clearing?.lot === lot.id ? s.clearing : undefined;
        const done = lot.id <= s.cleared;
        const progress = done ? 1 : clearing && s.clearMinutes ? Math.max(0, Math.min(1, 1 - clearing.left / s.clearMinutes)) : 0;
        // Rác biến dần theo tiến độ dọn
        lot.junk.forEach((j, i) => (j.visible = i / lot.junk.length >= progress));
        for (const m of lot.ground) (m.material as THREE.MeshToonMaterial).color.setHex(done ? RAKED : DIRT);
        for (const [i, w] of lot.workers.entries()) {
          w.visible = !!clearing;
          if (clearing) {
            animatePerson(w, t + i * 1.7, { cook: 1 });
            w.rotation.y = Math.sin(t * 0.4 + i * 2) * 1.2;
          }
        }
        const key = done ? 'done' : clearing ? 'busy' : 'wild';
        if (keys.get(lot.id) !== key) {
          keys.set(lot.id, key);
          setSign(lot, key === 'done' ? `Lô ${lot.id} · Sẵn sàng mở rộng` : key === 'busy' ? `Lô ${lot.id} · Đang dọn` : `Đất hoang · Lô ${lot.id}`, key === 'done' ? '#2f7a3a' : key === 'busy' ? '#b5651f' : '#5a3a22');
        }
      }
    },
  };
}

function setSign(lot: Lot, text: string, color: string): void {
  const old = lot.sign.getObjectByName('text');
  if (old) {
    lot.sign.remove(old);
    (old as THREE.Mesh).geometry.dispose();
  }
  const s = signText(text, color, 1.5, 0.32);
  s.name = 'text';
  s.position.set(0, 1.05, 0.03);
  lot.sign.add(s);
}

function buildLot(parent: THREE.Group, id: number, rects: Rect[], eastX: number, frontZ: number): Lot {
  const g = group(parent);
  g.userData.pick = { type: 'lot', id: String(id) };
  const rnd = seeded(900 + id * 31);
  const junk: THREE.Object3D[] = [];
  const ground: THREE.Mesh[] = [];
  for (const [x1, x2, z1, z2] of rects) {
    ground.push(mesh(g, G.box(x2 - x1, 0.03, z2 - z1), toon(DIRT, {}), { p: [(x1 + x2) / 2, 0.006, (z1 + z2) / 2], cast: false, receive: true }));
    // Rác rải theo diện tích
    const n = Math.max(4, Math.round((x2 - x1) * (z2 - z1) * 1.4));
    for (let i = 0; i < n; i++) {
      const x = x1 + Math.min(0.3, (x2 - x1) / 2) + rnd() * Math.max(0.01, x2 - x1 - 0.6);
      const z = z1 + 0.5 + rnd() * Math.max(0.01, z2 - z1 - 1.1); // chừa mép trong hàng rào: rác không lòi ra chân rào
      junk.push(debris(g, x, z, rnd));
    }
  }
  // Trộn thứ tự để rác biến mất rải rác khắp lô (không theo từng dải)
  for (let i = junk.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [junk[i], junk[j]] = [junk[j], junk[i]];
  }
  // Biển gỗ cắm ở góc trước của dải phía Đông
  const bw = rects[0][1] - rects[0][0];
  const sw = Math.min(1.6, bw - 0.3); // mọi lô cùng cỡ biển (chỉ thu nhỏ khi ô rào quá hẹp)
  // Biển gỗ treo ở mặt ngoài hàng rào (phía đường), giữa dải lô
  const sign = group(g, { p: [eastX - bw / 2, 0, frontZ + 0.07], s: [sw / 1.6, 1, 1] });
  mesh(sign, G.box(1.6, 0.42, 0.04), 0xe9dcc0, { p: [0, 1.05, 0] });
  for (const sx of [-0.7, 0.7]) mesh(sign, G.cyl(0.025, 0.025, 0.03, 8), 0x6b6f75, { p: [sx, 1.18, 0.03], r: [Math.PI / 2, 0, 0], cast: false }); // đinh vít
  // Đội thợ (ẩn tới khi thuê dọn)
  const workers: THREE.Group[] = [];
  const [x1, x2, z1, z2] = rects[0];
  for (let i = 0; i < 2; i++) {
    const w = makePerson(LOOKS[(id * 3 + i * 5) % LOOKS.length]);
    w.position.set((x1 + x2) / 2 + (i ? 0.2 : -0.2), 0, z1 + (z2 - z1) * (i ? 0.35 : 0.7));
    // Nón bảo hộ vàng
    mesh(w, G.sphere(0.19, 12, 8), 0xf2c230, { p: [0, 1.72, 0], s: [1, 0.6, 1] });
    w.visible = false;
    g.add(w);
    workers.push(w);
  }
  // Viền sáng quanh lô (khung chữ nhật mỏng nằm sát mặt đất)
  const [gx1, gx2, gz1, gz2] = rects[0];
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.6, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.BufferGeometry(), glowMat);
  {
    const t = 0.12;
    const edges = new THREE.Group();
    for (const [x, z, sx, sz] of [[(gx1 + gx2) / 2, gz1 + t / 2, gx2 - gx1, t], [(gx1 + gx2) / 2, gz2 - t / 2, gx2 - gx1, t], [gx1 + t / 2, (gz1 + gz2) / 2, t, gz2 - gz1], [gx2 - t / 2, (gz1 + gz2) / 2, t, gz2 - gz1]] as const)
      mesh(edges, G.box(sx, 0.04, sz), glowMat, { p: [x, 0.04, z], cast: false });
    glow.add(edges);
  }
  glow.visible = false;
  g.add(glow);
  const lot: Lot = { id, g, junk, ground, sign, signKey: '', workers, glow, center: { x: (gx1 + gx2) / 2, z: (gz1 + gz2) / 2 } };
  return lot;
}

/** Một món rác ngẫu nhiên: đống xà bần, gạch vỡ, lốp xe, ván gỗ, thùng phi rỉ, bụi cỏ dại, cọc rào xiêu. */
function debris(g: THREE.Group, x: number, z: number, rnd: () => number): THREE.Object3D {
  const o = group(g, { p: [x, 0, z], r: [0, rnd() * Math.PI * 2, 0] });
  const k = rnd();
  if (k < 0.22) {
    // Đống xà bần
    for (let i = 0; i < 5; i++) mesh(o, G.box(0.18 + rnd() * 0.2, 0.1 + rnd() * 0.12, 0.16 + rnd() * 0.2), [0x9a958c, 0xb3ada3, 0x7d7870][i % 3], { p: [(rnd() - 0.5) * 0.4, 0.06 + i * 0.04, (rnd() - 0.5) * 0.4], r: [rnd(), rnd(), rnd()] });
  } else if (k < 0.38) {
    // Gạch vỡ
    for (let i = 0; i < 4; i++) mesh(o, G.box(0.2, 0.07, 0.1), 0xb5583a, { p: [(rnd() - 0.5) * 0.5, 0.04 + (i > 2 ? 0.07 : 0), (rnd() - 0.5) * 0.5], r: [0, rnd() * 3, rnd() * 0.3] });
  } else if (k < 0.5) {
    // Lốp xe cũ
    mesh(o, G.torus(0.22, 0.08, 6, 14), 0x26282c, { p: [0, 0.08, 0], r: [Math.PI / 2, 0, 0] });
    if (rnd() < 0.5) mesh(o, G.torus(0.22, 0.08, 6, 14), 0x2f3136, { p: [0.05, 0.24, 0.02], r: [Math.PI / 2 + 0.2, 0, 0] });
  } else if (k < 0.62) {
    // Ván gỗ mục
    for (let i = 0; i < 3; i++) mesh(o, G.box(0.9, 0.03, 0.14), [0x7a5a3a, 0x6b4e32, 0x8c6a44][i], { p: [0, 0.02 + i * 0.03, (i - 1) * 0.12], r: [0, (rnd() - 0.5) * 0.5, 0] });
  } else if (k < 0.7) {
    // Thùng phi rỉ sét (đổ nghiêng hoặc đứng)
    const tipped = rnd() < 0.5;
    mesh(o, G.cyl(0.22, 0.22, 0.6, 12), 0x9a5a32, { p: [0, tipped ? 0.22 : 0.3, 0], r: [tipped ? Math.PI / 2 : 0, 0, 0] });
  } else if (k < 0.82) {
    // Cọc rào xiêu vẹo + đoạn dây kẽm
    for (const sx of [-0.4, 0.4]) mesh(o, G.box(0.06, 0.8, 0.06), 0x6b4a2e, { p: [sx, 0.4, 0], r: [0, 0, (rnd() - 0.5) * 0.4] });
    mesh(o, G.box(0.85, 0.015, 0.015), 0x8a8f96, { p: [0, 0.55, 0], cast: false });
  } else {
    // Bụi cỏ dại
    for (let i = 0; i < 5; i++) mesh(o, G.cone(0.06, 0.35 + rnd() * 0.25, 5), [0x6f8f3a, 0x8aa04a, 0x5f7f32][i % 3], { p: [(rnd() - 0.5) * 0.35, 0.17, (rnd() - 0.5) * 0.35], r: [(rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5], cast: false });
  }
  return o;
}

// ---------- Hàng rào theo quán ----------

const FENCE_H = 1.8;
const fenceTex = new Map<string, THREE.Texture>();

/** Vân tấm rào (lặp theo chiều dài): tôn sóng, tre, tấm công trình. */
function fenceTexture(kind: 'vn' | 'oc' | 'kr'): THREE.Texture {
  let t = fenceTex.get(kind);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  if (kind === 'vn') {
    // Tôn sóng xanh dương, viền trắng trên
    g.fillStyle = '#2f6fbf';
    g.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 16) {
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x, 0, 5, 128);
      g.fillStyle = 'rgba(0,0,0,0.14)';
      g.fillRect(x + 9, 0, 4, 128);
    }
    g.fillStyle = '#f4f1ea';
    g.fillRect(0, 0, 128, 12);
  } else if (kind === 'oc') {
    // Tôn cũ: mảng rỉ cam nâu xen tôn xám, sóng dọc
    g.fillStyle = '#8f9499';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#a35a32';
    g.fillRect(0, 70, 128, 58);
    g.fillStyle = 'rgba(163,90,50,0.7)';
    for (let i = 0; i < 9; i++) g.fillRect((i * 37) % 128, 40 + (i * 13) % 30, 10 + (i % 3) * 8, 40);
    for (let x = 0; x < 128; x += 12) {
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(x, 0, 4, 128);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(x + 7, 0, 3, 128);
    }
  } else {
    // Tấm công trình trắng, dải xanh lá ở chân + vạch xanh mảnh ở mép trên, khe nối tấm
    g.fillStyle = '#f2f2ee';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#2f9b6f';
    g.fillRect(0, 100, 128, 28);
    g.fillRect(0, 8, 128, 6);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(126, 0, 2, 128);
  }
  t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  fenceTex.set(kind, t);
  return t;
}

/** Một đoạn rào thẳng từ a tới b (toạ độ x, z), cao FENCE_H, có cột mỗi ~2 m. */
function fenceRun(parent: THREE.Object3D, cuisine: 'vn' | 'oc' | 'jp' | 'kr', a: [number, number], b: [number, number], at?: number[]): void {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.1) return;
  const seg = group(parent, { p: [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2], r: [0, -Math.atan2(b[1] - a[1], b[0] - a[0]), 0] });
  // Vị trí cột (tính từ đầu đoạn): cho sẵn (ranh giới lô) hoặc chia đều ~2 m
  const n = Math.max(1, Math.round(len / 2));
  const postX = (at ?? Array.from({ length: n + 1 }, (_, i) => (i * len) / n)).map((d) => d - len / 2);
  const H = FENCE_H;
  if (cuisine === 'jp') {
    // Rào tre takegaki: tre dựng sát nhau, 3 nẹp tre ngang, dây đen buộc, cột tre to
    const nb = Math.round(len / 0.09);
    for (let i = 0; i < nb; i++) {
      const x = -len / 2 + (i + 0.5) * (len / nb);
      const h = H - 0.04 + (i % 3) * 0.03;
      mesh(seg, G.cyl(0.04, 0.04, h, 6), i % 4 === 0 ? 0xa9a15a : 0xc2b672, { p: [x, h / 2, 0], cast: false });
    }
    for (const y of [0.35, 0.95, 1.55]) {
      mesh(seg, G.box(len, 0.07, 0.07), 0x8f8a4a, { p: [0, y, 0.07] });
      for (const x of postX) mesh(seg, G.box(0.1, 0.1, 0.1), 0x1f1a16, { p: [x, y, 0.08], cast: false });
    }
    for (const x of postX) mesh(seg, G.cyl(0.07, 0.07, H + 0.12, 8), 0x7d7642, { p: [x, (H + 0.12) / 2, 0.02] });
    return;
  }
  // Tấm rào: hộp mỏng phủ texture lặp theo chiều dài (2 mặt)
  const kind = cuisine === 'oc' ? 'oc' : cuisine === 'kr' ? 'kr' : 'vn';
  const tex = fenceTexture(kind).clone();
  tex.repeat.set(len / (kind === 'kr' ? 2 : 1.6), 1);
  tex.needsUpdate = true;
  const mat = new THREE.MeshToonMaterial({ map: tex });
  mesh(seg, G.box(len, H, 0.05), mat, { p: [0, H / 2, 0] });
  const postColor = cuisine === 'oc' ? 0x6b4a2e : cuisine === 'kr' ? 0x9aa0a6 : 0x7d8691;
  for (const x of postX) {
    if (cuisine === 'oc') mesh(seg, G.box(0.1, H + 0.15, 0.1), postColor, { p: [x, (H + 0.15) / 2, 0.06] });
    else mesh(seg, G.box(0.08, H + 0.05, 0.08), postColor, { p: [x, (H + 0.05) / 2, 0.05] });
  }
  if (cuisine === 'vn') mesh(seg, G.box(len, 0.06, 0.1), 0xf4f1ea, { p: [0, H + 0.02, 0] }); // nẹp trắng mép trên
  if (cuisine === 'oc') {
    // Vài mảng bạt xanh chắp vá
    for (let i = 0; i < Math.max(1, Math.floor(len / 4)); i++) {
      const x = -len / 2 + ((i + 0.6) * len) / Math.max(1, Math.floor(len / 4)) - 0.8;
      mesh(seg, G.box(1.1, 0.9, 0.02), 0x2f7fc8, { p: [x, 0.95, 0.04], r: [0, 0, (i % 2 ? 1 : -1) * 0.06], cast: false });
    }
  }
}
