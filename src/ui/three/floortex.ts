import * as THREE from 'three';
import { seeded, toon } from './toon';

/**
 * TEXTURE SÀN + VỈA HÈ vẽ canvas kiểu bút sáp (giai đoạn 20): gạch bông (encaustic), gạch men ngọc đỏ, gạch xưa (đất nung),
 * gạch vỉa hè terrazzo. Mọi texture có cache, lặp ô; floorTexture chọn theo DecorDef.pattern.
 */

/** Cạnh một viên gạch bông trên sàn (m). */
export const FLOOR_TILE = 1.3;
const encausticCache = new Map<string, THREE.Texture>();
/**
 * Gạch bông vẽ kiểu BÚT SÁP (canvas, giản lược): nền màu `bg`, vòng tròn lớn màu kem viền `ink`, vòng chấm + 4 mũi nhọn,
 * lòng tròn nền với hoa 8 cánh kem; bốn góc là 1/4 cụm hoa nối sang viên bên cạnh; ron gạch.
 * Chất sáp: mép mọi hình run nhẹ như tô tay, mỗi mảng màu phủ nét tô chéo đậm nhạt, hạt giấy lộ ra, viền vẽ bằng nét sáp
 * hơi đứt quãng. Nhiễu có seed nên texture cố định giữa các lần tải.
 */
export function encausticTexture(bg: number, ink: number): THREE.Texture {
  const key = `${bg}-${ink}`;
  let tex = encausticCache.get(key);
  if (tex) return tex;
  const S = 512;
  const k = S / 256; // vẽ theo toạ độ 256 rồi nhân lên
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const cream = '#f6ecd6';
  const rnd = seeded(5150);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const c = canvas.getContext('2d')!;
  /** Đường khép kín run tay: điểm trên đường cong (cx, cy, rx, ry, xoay) có bán kính lệch ngẫu nhiên mượt. */
  const wobblyPath = (cx: number, cy: number, rx: number, ry: number, rot = 0, amp = 0.05) => {
    const n = 40;
    const ph = rnd() * 6.28;
    const f2 = 2 + Math.floor(rnd() * 3);
    c.beginPath();
    for (let j = 0; j <= n; j++) {
      const a = (j / n) * Math.PI * 2;
      const w = 1 + amp * (Math.sin(a * f2 + ph) * 0.6 + (rnd() - 0.5) * 0.5);
      const x = Math.cos(a) * rx * w;
      const y = Math.sin(a) * ry * w;
      const px = cx + x * Math.cos(rot) - y * Math.sin(rot);
      const py = cy + x * Math.sin(rot) + y * Math.cos(rot);
      if (j) c.lineTo(px * k, py * k);
      else c.moveTo(px * k, py * k);
    }
    c.closePath();
  };
  /** Tô một hình đã dựng path bằng màu sáp: nền màu + nét tô chéo trong vùng hình. */
  const crayonFill = (color: string) => {
    c.fillStyle = color;
    c.fill();
    c.save();
    c.clip();
    for (let j = 0; j < 90; j++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const len = (6 + rnd() * 16) * k;
      c.strokeStyle = rnd() < 0.5 ? 'rgba(60,30,10,0.10)' : 'rgba(255,250,235,0.14)';
      c.lineWidth = (1 + rnd() * 1.6) * k;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + len * 0.8, y - len * 0.6);
      c.stroke();
    }
    c.restore();
  };
  /** Viền sáp: vẽ 2 lượt lệch nhau chút, nét không đều. */
  const crayonStroke = (color: string, width: number) => {
    c.strokeStyle = color;
    c.lineJoin = c.lineCap = 'round';
    c.lineWidth = width * k;
    c.globalAlpha = 0.85;
    c.stroke();
    c.save();
    c.translate((rnd() - 0.5) * 1.5 * k, (rnd() - 0.5) * 1.5 * k);
    c.lineWidth = width * 0.6 * k;
    c.globalAlpha = 0.5;
    c.stroke();
    c.restore();
    c.globalAlpha = 1;
  };
  // Nền
  c.fillStyle = hex(bg);
  c.fillRect(0, 0, S, S);
  for (let j = 0; j < 900; j++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const len = (8 + rnd() * 20) * k;
    c.strokeStyle = rnd() < 0.55 ? 'rgba(90,50,10,0.08)' : 'rgba(255,245,215,0.12)';
    c.lineWidth = (1 + rnd() * 2) * k;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + len * 0.8, y - len * 0.6);
    c.stroke();
  }
  // Góc: 1/4 cụm hoa kem + nhuỵ đậm
  for (const [x, y] of [[0, 0], [256, 0], [0, 256], [256, 256]]) {
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 2 + Math.PI / 4;
      wobblyPath(x + Math.cos(a) * 26, y + Math.sin(a) * 26, 20, 8, a, 0.08);
      crayonFill(cream);
    }
    wobblyPath(x, y, 9, 9, 0, 0.12);
    crayonFill(hex(ink));
  }
  // Vòng tròn lớn kem + viền sáp
  wobblyPath(128, 128, 100, 100, 0, 0.025);
  crayonFill(cream);
  crayonStroke(hex(ink), 7);
  // Vòng chấm + 4 mũi nhọn
  for (let j = 0; j < 8; j++) {
    const a = (j / 8) * Math.PI * 2 + Math.PI / 8;
    wobblyPath(128 + Math.cos(a) * 76, 128 + Math.sin(a) * 76, 9, 9, 0, 0.14);
    crayonFill(hex(ink));
  }
  for (let j = 0; j < 4; j++) {
    const a = (j * Math.PI) / 2;
    const pt = (r: number, off: number) => [(128 + Math.cos(a) * r - Math.sin(a) * off) * k, (128 + Math.sin(a) * r + Math.cos(a) * off) * k] as const;
    c.beginPath();
    c.moveTo(...pt(62, -9 + (rnd() - 0.5) * 2));
    c.lineTo(...pt(98 + (rnd() - 0.5) * 3, (rnd() - 0.5) * 2));
    c.lineTo(...pt(62, 9 + (rnd() - 0.5) * 2));
    c.closePath();
    crayonFill(hex(ink));
  }
  // Lòng tròn nền + hoa 8 cánh kem + nhuỵ
  wobblyPath(128, 128, 54, 54, 0, 0.04);
  crayonFill(hex(bg));
  for (let j = 0; j < 8; j++) {
    const a = (j / 8) * Math.PI * 2;
    wobblyPath(128 + Math.cos(a) * 28, 128 + Math.sin(a) * 28, 21, 9, a, 0.1);
    crayonFill(cream);
  }
  wobblyPath(128, 128, 8, 8, 0, 0.15);
  crayonFill(hex(ink));
  // Hạt giấy: chấm sáng chỗ sáp không bám
  for (let j = 0; j < 2200; j++) {
    const r = (0.4 + rnd() * 0.9) * k;
    c.fillStyle = `rgba(255,250,238,${0.12 + rnd() * 0.25})`;
    c.fillRect(rnd() * S, rnd() * S, r, r);
  }
  // Ron gạch (nét sáp mảnh, run nhẹ)
  c.beginPath();
  c.rect(1.5 * k + (rnd() - 0.5) * k, 1.5 * k, S - 3 * k, S - 3 * k + (rnd() - 0.5) * k);
  crayonStroke('rgba(90,60,30,0.45)', 2);
  tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  encausticCache.set(key, tex);
  return tex;
}

// ---------- Bộ vẽ chung kiểu bút sáp ----------

/** Canvas vuông S px; trả texture lặp ô, `metres` = cạnh texture ngoài đời (m) → repeat theo FLOOR_TILE của mặt sàn. */
function crayonCanvas(S: number, metres: number, seed: number, draw: (c: CanvasRenderingContext2D, rnd: () => number) => void): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const c = canvas.getContext('2d')!;
  const rnd = seeded(seed);
  draw(c, rnd);
  // Nét sáp chéo + hạt giấy
  for (let j = 0; j < 700; j++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const len = 10 + rnd() * 26;
    c.strokeStyle = rnd() < 0.55 ? 'rgba(60,30,10,0.07)' : 'rgba(255,248,230,0.1)';
    c.lineWidth = 1.5 + rnd() * 2.5;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + len * 0.8, y - len * 0.6);
    c.stroke();
  }
  for (let j = 0; j < 1800; j++) {
    c.fillStyle = `rgba(255,250,238,${0.1 + rnd() * 0.2})`;
    c.fillRect(rnd() * S, rnd() * S, 1 + rnd(), 1 + rnd());
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.repeat.setScalar(FLOOR_TILE / metres);
  return tex;
}

/** Path khép kín run tay quanh hình elip / tròn. */
function wobble(c: CanvasRenderingContext2D, rnd: () => number, cx: number, cy: number, rx: number, ry: number, rot = 0, amp = 0.05): void {
  const n = 36;
  const ph = rnd() * 6.28;
  c.beginPath();
  for (let j = 0; j <= n; j++) {
    const a = (j / n) * Math.PI * 2;
    const w = 1 + amp * (Math.sin(a * 3 + ph) * 0.6 + (rnd() - 0.5) * 0.5);
    const x = Math.cos(a) * rx * w;
    const y = Math.sin(a) * ry * w;
    const px = cx + x * Math.cos(rot) - y * Math.sin(rot);
    const py = cy + x * Math.sin(rot) + y * Math.cos(rot);
    if (j) c.lineTo(px, py);
    else c.moveTo(px, py);
  }
  c.closePath();
}

/** Hình chữ nhật run tay (các góc lệch vài px). */
function wobblyRect(c: CanvasRenderingContext2D, rnd: () => number, x: number, y: number, w: number, h: number, j = 2): void {
  const p = (px: number, py: number) => [px + (rnd() - 0.5) * j, py + (rnd() - 0.5) * j] as const;
  c.beginPath();
  c.moveTo(...p(x, y));
  c.lineTo(...p(x + w, y));
  c.lineTo(...p(x + w, y + h));
  c.lineTo(...p(x, y + h));
  c.closePath();
}

// ---------- Gạch men ngọc đỏ ----------

let ngocdoTex: THREE.Texture | null = null;
/**
 * Gạch men ngọc đỏ: bàn cờ 2 kiểu viên - (A) nền trắng viền xanh ngọc, góc tam giác xanh, đĩa tròn đỏ đô với hoa 4 cánh
 * vàng nghệ nhuỵ trắng; (B) nền đỏ đô, ô vuông vàng nghệ, ngôi sao 4 cánh trắng giữa có dấu X xanh. Texture = 2×2 viên (1.6 m).
 */
export function ngocdoTexture(): THREE.Texture {
  if (ngocdoTex) return ngocdoTex;
  const S = 512;
  const T = S / 2;
  const red = '#8e3a30';
  const green = '#2f6b4f';
  const mustard = '#d6a24e';
  const white = '#f3efe6';
  ngocdoTex = crayonCanvas(S, 1.6, 4242, (c, rnd) => {
    for (let ty = 0; ty < 2; ty++)
      for (let tx = 0; tx < 2; tx++) {
        const x0 = tx * T;
        const y0 = ty * T;
        const cx = x0 + T / 2;
        const cy = y0 + T / 2;
        if ((tx + ty) % 2 === 0) {
          // Viên A
          c.fillStyle = green;
          c.fillRect(x0, y0, T, T);
          wobblyRect(c, rnd, x0 + 12, y0 + 12, T - 24, T - 24);
          c.fillStyle = white;
          c.fill();
          for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
            const kx = x0 + 22 + sx * (T - 44);
            const ky = y0 + 22 + sy * (T - 44);
            const dx = sx ? -1 : 1;
            const dy = sy ? -1 : 1;
            c.beginPath();
            c.moveTo(kx, ky);
            c.lineTo(kx + dx * 42, ky);
            c.lineTo(kx, ky + dy * 42);
            c.closePath();
            c.fillStyle = green;
            c.fill();
          }
          wobble(c, rnd, cx, cy, 92, 92, 0, 0.03);
          c.fillStyle = red;
          c.fill();
          for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) / 2 + Math.PI / 4;
            wobble(c, rnd, cx + Math.cos(a) * 36, cy + Math.sin(a) * 36, 34, 30, a, 0.08);
            c.fillStyle = mustard;
            c.fill();
          }
          wobble(c, rnd, cx, cy, 16, 16, 0, 0.1);
          c.fillStyle = white;
          c.fill();
        } else {
          // Viên B
          c.fillStyle = red;
          c.fillRect(x0, y0, T, T);
          wobblyRect(c, rnd, x0 + 44, y0 + 44, T - 88, T - 88);
          c.fillStyle = mustard;
          c.fill();
          // Sao 4 cánh: 4 đường cong lõm vào giữa
          const r = 84;
          c.beginPath();
          c.moveTo(cx, cy - r);
          c.quadraticCurveTo(cx + 18, cy - 18, cx + r, cy);
          c.quadraticCurveTo(cx + 18, cy + 18, cx, cy + r);
          c.quadraticCurveTo(cx - 18, cy + 18, cx - r, cy);
          c.quadraticCurveTo(cx - 18, cy - 18, cx, cy - r);
          c.closePath();
          c.fillStyle = white;
          c.fill();
          c.strokeStyle = green;
          c.lineCap = 'round';
          c.lineWidth = 11;
          for (const s of [-1, 1]) {
            c.beginPath();
            c.moveTo(cx - 20, cy - 20 * s);
            c.lineTo(cx + 20, cy + 20 * s);
            c.stroke();
          }
        }
        // Ron trắng mảnh
        c.strokeStyle = 'rgba(240,236,226,0.9)';
        c.lineWidth = 3;
        c.strokeRect(x0 + 1.5, y0 + 1.5, T - 3, T - 3);
      }
  });
  return ngocdoTex;
}

// ---------- Gạch xưa (gạch đất nung) ----------

let terracottaTex: THREE.Texture | null = null;
/** Gạch xưa: gạch đất nung vuông màu cam đỏ, mỗi viên đậm nhạt khác nhau, vài vệt mòn / ố, ron vữa xám. Texture = 4×4 viên (1.6 m). */
export function terracottaTexture(): THREE.Texture {
  if (terracottaTex) return terracottaTex;
  const S = 512;
  const N = 4;
  const T = S / N;
  terracottaTex = crayonCanvas(S, 1.6, 7777, (c, rnd) => {
    c.fillStyle = '#8a7a6a'; // vữa
    c.fillRect(0, 0, S, S);
    const tones = ['#c2643a', '#b85a34', '#cf7446', '#a9502e', '#c86a40'];
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        wobblyRect(c, rnd, i * T + 4, j * T + 4, T - 8, T - 8, 3);
        c.fillStyle = tones[Math.floor(rnd() * tones.length)];
        c.fill();
        // Vệt mòn sáng / ố sẫm
        if (rnd() < 0.6) {
          wobble(c, rnd, i * T + 20 + rnd() * (T - 40), j * T + 20 + rnd() * (T - 40), 10 + rnd() * 22, 6 + rnd() * 14, rnd() * 3, 0.3);
          c.fillStyle = rnd() < 0.5 ? 'rgba(240,200,160,0.25)' : 'rgba(70,40,25,0.2)';
          c.fill();
        }
      }
  });
  return terracottaTex;
}

// ---------- Gạch vỉa hè terrazzo ----------

let terrazzoTex: THREE.Texture | null = null;
/**
 * Gạch vỉa hè (terrazzo xi măng đá rửa): nền be lốm đốm đá vụn, rãnh lõm sẫm - lưới ô nhỏ, 3 vòng cung đồng tâm từ một góc
 * và vòng tròn nhỏ giữa viên; các viên xoay 90° xen kẽ nên rãnh nối thành hình cong liên tục. Texture = 2×2 viên (0.8 m).
 */
export function terrazzoTexture(): THREE.Texture {
  if (terrazzoTex) return terrazzoTex;
  const S = 512;
  const T = S / 2;
  terrazzoTex = crayonCanvas(S, 0.8, 3131, (c, rnd) => {
    c.fillStyle = '#d8ccb4';
    c.fillRect(0, 0, S, S);
    // Đá vụn lốm đốm
    for (let j = 0; j < 2600; j++) {
      const r = 1 + rnd() * 2.2;
      c.fillStyle = ['rgba(250,246,236,0.8)', 'rgba(120,110,95,0.5)', 'rgba(170,150,120,0.6)'][Math.floor(rnd() * 3)];
      c.fillRect(rnd() * S, rnd() * S, r, r);
    }
    c.strokeStyle = 'rgba(110,90,60,0.75)';
    c.lineWidth = 4;
    c.lineCap = 'round';
    for (let ty = 0; ty < 2; ty++)
      for (let tx = 0; tx < 2; tx++) {
        c.save();
        c.translate(tx * T + T / 2, ty * T + T / 2);
        c.rotate(((tx + ty * 2) * Math.PI) / 2);
        c.translate(-T / 2, -T / 2);
        // Lưới rãnh nhỏ
        for (let k = 1; k < 6; k++) {
          c.beginPath();
          c.moveTo((k * T) / 6, 0);
          c.lineTo((k * T) / 6, T);
          c.moveTo(0, (k * T) / 6);
          c.lineTo(T, (k * T) / 6);
          c.globalAlpha = 0.35;
          c.stroke();
        }
        c.globalAlpha = 1;
        // Vòng cung đồng tâm từ góc + vòng tròn nhỏ
        for (const r of [T * 0.33, T * 0.6, T * 0.86]) {
          c.beginPath();
          c.arc(0, 0, r, 0, Math.PI / 2);
          c.stroke();
        }
        c.beginPath();
        c.arc(T * 0.62, T * 0.62, T * 0.14, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
    // Ron giữa các viên
    c.strokeStyle = 'rgba(90,75,55,0.9)';
    c.lineWidth = 5;
    for (const k of [0, T, S]) {
      c.beginPath();
      c.moveTo(k, 0);
      c.lineTo(k, S);
      c.moveTo(0, k);
      c.lineTo(S, k);
      c.stroke();
    }
  });
  return terrazzoTex;
}

const checkerCache = new Map<string, THREE.Texture>();

/** Gạch caro bàn cờ: ô vuông 30 cm xen kẽ màu `a` / `b`, ron mảnh, nét sáp nhẹ. */
function checkerTexture(a: number, b: number): THREE.Texture {
  const key = `${a}-${b}`;
  let tex = checkerCache.get(key);
  if (tex) return tex;
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  tex = crayonCanvas(256, 0.6, 77, (c) => {
    c.fillStyle = '#9a9a96';
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      c.fillStyle = hex((i + j) % 2 ? b : a);
      c.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
    }
  });
  checkerCache.set(key, tex);
  return tex;
}

/** Texture sàn theo kiểu hoa văn của món nội thất (`a` / `b` = màu nền / hoa văn cho gạch bông, màu hai ô caro). */
export function floorTexture(pattern: 'encaustic' | 'ngocdo' | 'terracotta' | 'checker' | 'concrete' | 'planks' | 'bamboo', a: number, b: number): THREE.Texture {
  if (pattern === 'bamboo') return bambooTexture(a, b);
  if (pattern === 'concrete') return concreteTexture();
  if (pattern === 'planks') return plankTexture(a, b);
  if (pattern === 'checker') return checkerTexture(a, b);
  if (pattern === 'ngocdo') return ngocdoTexture();
  if (pattern === 'terracotta') return terracottaTexture();
  return encausticTexture(a, b);
}

/** Lớp gạch terrazzo phủ lên dải vỉa hè trước quán (quán Việt, quán ốc): dài `len` m, rộng `width` m, tâm (0, y, z). */
export function terrazzoSidewalk(parent: THREE.Object3D, len: number, width: number, z: number, y = 0.003): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(len, width);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / FLOOR_TILE, (uv.getY(i) * width) / FLOOR_TILE);
  const m = new THREE.Mesh(geo, toon(0xffffff, { map: terrazzoTexture() }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, y, z);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Cỡ một viên gạch ốp tường (m) - gạch vuông nhỏ kiểu quán ăn châu Á. */
export const WALL_TILE = 0.22;

const wallTileCache = new Map<string, THREE.CanvasTexture>();

/** Gạch ốp tường: một viên vuông màu `tile`, ron (đường vữa) màu `grout`, bóng sáng nhẹ ở góc - lặp bằng `repeat`. */
export function wallTileTexture(tile: number, grout: number): THREE.CanvasTexture {
  const key = `${tile}-${grout}`;
  let tex = wallTileCache.get(key);
  if (tex) return tex;
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  g.fillStyle = hex(grout);
  g.fillRect(0, 0, S, S);
  g.fillStyle = hex(tile);
  g.fillRect(4, 4, S - 8, S - 8);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(6, 6, S * 0.35, 4);
  g.fillStyle = 'rgba(0,0,0,0.05)';
  g.fillRect(3, S - 9, S - 6, 6);
  tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  wallTileCache.set(key, tex);
  return tex;
}

/** Vẽ một nét / mảng lặp liền mép: gọi `draw` ở 9 vị trí dời ±S để texture lặp không lộ đường nối. */
function wrapDraw(S: number, draw: (ox: number, oy: number) => void): void {
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) draw(ox, oy);
}

let concreteTex: THREE.Texture | null = null;

/** Sàn xi măng mài: một màu xám, loang lổ đậm nhạt và vết nứt mảnh chạy ngoằn ngoèo (ô lặp 3,9 m). */
export function concreteTexture(): THREE.Texture {
  if (concreteTex) return concreteTex;
  const S = 512;
  concreteTex = crayonCanvas(S, FLOOR_TILE * 3, 4242, (c, rnd) => {
    c.fillStyle = '#7e8183';
    c.fillRect(0, 0, S, S);
    // Loang lổ: mảng sáng / tối mờ, vài vệt ẩm sẫm hơn
    for (let i = 0; i < 70; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const r = 20 + rnd() * 90;
      const dark = rnd() < 0.55;
      const a = dark ? 0.05 + rnd() * 0.09 : 0.05 + rnd() * 0.08;
      wrapDraw(S, (ox, oy) => {
        const gr = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, dark ? `rgba(50,52,54,${a * 1.6})` : `rgba(215,216,214,${a})`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gr;
        c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      });
    }
    // Đốm nhỏ (vết bẩn, lỗ khí)
    for (let i = 0; i < 260; i++) {
      c.fillStyle = `rgba(60,62,64,${0.08 + rnd() * 0.18})`;
      c.beginPath();
      c.arc(rnd() * S, rnd() * S, 0.6 + rnd() * 1.8, 0, Math.PI * 2);
      c.fill();
    }
    // Vết nứt: đường gấp khúc ngẫu nhiên, có nhánh rẽ
    const crack = (x: number, y: number, ang: number, len: number, width: number, depth: number): void => {
      const pts: [number, number][] = [[x, y]];
      for (let k = 0; k < len; k++) {
        ang += (rnd() - 0.5) * 0.9;
        x += Math.cos(ang) * 9;
        y += Math.sin(ang) * 9;
        pts.push([x, y]);
        if (depth < 2 && rnd() < 0.06) crack(x, y, ang + (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd() * 0.6), Math.floor(len * 0.4), width * 0.6, depth + 1);
      }
      wrapDraw(S, (ox, oy) => {
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(205,206,204,0.35)';
        c.lineWidth = width + 1.4;
        c.beginPath();
        pts.forEach(([px, py], i) => (i ? c.lineTo(px + ox + 0.8, py + oy + 0.8) : c.moveTo(px + ox + 0.8, py + oy + 0.8)));
        c.stroke();
        c.strokeStyle = 'rgba(36,38,40,0.85)';
        c.lineWidth = width;
        c.beginPath();
        pts.forEach(([px, py], i) => (i ? c.lineTo(px + ox, py + oy) : c.moveTo(px + ox, py + oy)));
        c.stroke();
      });
    };
    for (let i = 0; i < 5; i++) crack(rnd() * S, rnd() * S, rnd() * Math.PI * 2, 18 + Math.floor(rnd() * 30), 2 + rnd() * 1.2, 0);
  });
  return concreteTex;
}

const plankCache = new Map<string, THREE.Texture>();

/** Sàn gỗ ván cũ: ván dài so le, mỗi tấm một tông (giữa `a` và `b`), vân gỗ lượn, mắt gỗ, khe ván sẫm (ô lặp 2,6 m). */
export function plankTexture(a: number, b: number): THREE.Texture {
  const key = `${a}-${b}`;
  let tex = plankCache.get(key);
  if (tex) return tex;
  const S = 520;
  const rows = 13;
  const rh = S / rows;
  const ch = (n: number, s: number) => (n >> s) & 255;
  const mix = (t: number, k: number) => {
    const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) * k;
    return `rgb(${Math.min(255, m(16))},${Math.min(255, m(8))},${Math.min(255, m(0))})`;
  };
  tex = crayonCanvas(S, FLOOR_TILE * 2, 909, (c, rnd) => {
    c.fillStyle = '#2b1a10';
    c.fillRect(0, 0, S, S);
    for (let r = 0; r < rows; r++) {
      const y = r * rh;
      // Mối nối ván so le, chạy vòng qua mép (lặp liền)
      const start = rnd() * S;
      const joints = [start];
      while (joints.length < 3) joints.push((joints[joints.length - 1] + 140 + rnd() * 160) % S);
      joints.sort((p, q) => p - q);
      for (let j = 0; j < joints.length; j++) {
        const x0 = joints[j];
        const x1 = j + 1 < joints.length ? joints[j + 1] : joints[0] + S;
        const t = rnd();
        const shade = 0.88 + rnd() * 0.22;
        for (const ox of [0, -S]) {
          c.save();
          c.beginPath();
          c.rect(x0 + ox + 1.5, y + 1.5, x1 - x0 - 3, rh - 3);
          c.clip();
          c.fillStyle = mix(t, shade);
          c.fillRect(x0 + ox, y, x1 - x0, rh);
          // Vân gỗ: các đường lượn dọc theo tấm
          for (let g = 0; g < 7; g++) {
            const gy = y + 3 + rnd() * (rh - 6);
            const ph = rnd() * 6.28;
            c.strokeStyle = rnd() < 0.6 ? `rgba(60,32,14,${0.12 + rnd() * 0.18})` : `rgba(255,230,180,${0.08 + rnd() * 0.1})`;
            c.lineWidth = 0.8 + rnd() * 1.4;
            c.beginPath();
            for (let x = x0 + ox; x <= x1 + ox; x += 6) {
              const yy = gy + Math.sin(x * 0.02 + ph) * 2.2;
              if (x === x0 + ox) c.moveTo(x, yy);
              else c.lineTo(x, yy);
            }
            c.stroke();
          }
          // Mắt gỗ
          if (rnd() < 0.35) {
            const kx = x0 + ox + 20 + rnd() * Math.max(10, x1 - x0 - 40);
            const ky = y + rh * (0.3 + rnd() * 0.4);
            for (let k = 3; k > 0; k--) {
              c.strokeStyle = `rgba(55,28,12,${0.25 + 0.15 * (3 - k)})`;
              c.lineWidth = 1.2;
              c.beginPath();
              c.ellipse(kx, ky, 3 + k * 3.5, 1.5 + k * 1.6, 0, 0, Math.PI * 2);
              c.stroke();
            }
          }
          // Mòn sáng giữa tấm
          const gr = c.createLinearGradient(0, y, 0, y + rh);
          gr.addColorStop(0, 'rgba(0,0,0,0.12)');
          gr.addColorStop(0.5, 'rgba(255,235,200,0.08)');
          gr.addColorStop(1, 'rgba(0,0,0,0.14)');
          c.fillStyle = gr;
          c.fillRect(x0 + ox, y, x1 - x0, rh);
          c.restore();
        }
      }
    }
  });
  plankCache.set(key, tex);
  return tex;
}

const bambooCache = new Map<string, THREE.Texture>();

/** Sàn tre: nan tre mảnh (~4 cm) xếp sát chạy ngang, mỗi nan một tông giữa `a` / `b`, vạch đốt tre so le, khe sẫm mảnh. */
export function bambooTexture(a: number, b: number): THREE.Texture {
  const key = `${a}-${b}`;
  let tex = bambooCache.get(key);
  if (tex) return tex;
  const S = 512;
  const rows = 32;
  const rh = S / rows;
  const ch = (n: number, s: number) => (n >> s) & 255;
  const mix = (t: number) => `rgb(${[16, 8, 0].map((s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t)).join(',')})`;
  tex = crayonCanvas(S, FLOOR_TILE * 1.3, 321, (c, rnd) => {
    for (let r = 0; r < rows; r++) {
      const y = r * rh;
      c.fillStyle = mix(rnd() * 0.8);
      c.fillRect(0, y, S, rh);
      // Bóng sáng giữa nan + khe sẫm
      c.fillStyle = 'rgba(255,240,210,0.18)';
      c.fillRect(0, y + rh * 0.3, S, rh * 0.2);
      c.fillStyle = 'rgba(70,40,15,0.45)';
      c.fillRect(0, y + rh - 1.2, S, 1.2);
      // Đốt tre: vạch ngang ngắn sẫm, so le giữa các nan (lặp liền mép)
      for (let x = (r % 3) * 60 + rnd() * 30; x < S; x += 150 + rnd() * 40) {
        c.fillStyle = 'rgba(90,55,20,0.5)';
        c.fillRect(x, y + 1, 3, rh - 2);
        c.fillStyle = 'rgba(255,235,200,0.25)';
        c.fillRect(x + 3, y + 1, 2, rh - 2);
      }
    }
  });
  bambooCache.set(key, tex);
  return tex;
}

/** Kích thước một ô tranh tường (m): lặp ngang mỗi MURAL_W, cao bằng cả bức tường. */
export const MURAL_W = 8;
export const MURAL_H = 4.2;
const muralCache = new Map<string, THREE.CanvasTexture>();

/**
 * Tranh vẽ núi sơn thuỷ (tường quán Nhật): nền giấy màu `bg`, ba lớp núi mực nâu nhạt dần về xa, dải sương trắng,
 * vài cây thông, mặt trời tròn nhạt. Núi tính bằng tổng sóng sin tần số nguyên nên lặp ngang liền mép.
 */
export function muralTexture(bg: number, ink: number): THREE.CanvasTexture {
  const key = `${bg}-${ink}`;
  let tex = muralCache.get(key);
  if (tex) return tex;
  const W = 1024;
  const H = 540;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const rgba = (n: number, a: number) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  g.fillStyle = hex(bg);
  g.fillRect(0, 0, W, H);
  const rnd = seeded(77);
  // Mặt trời nhạt
  g.fillStyle = rgba(0xd98a5a, 0.35);
  g.beginPath();
  g.arc(W * 0.72, H * 0.24, 34, 0, Math.PI * 2);
  g.fill();
  const ridge = (base: number, amp: number, seed: number) => (x: number) => {
    const t = (x / W) * Math.PI * 2;
    return base - amp * (0.55 * Math.abs(Math.sin(t * 2 + seed)) + 0.3 * Math.abs(Math.sin(t * 5 + seed * 2)) + 0.15 * Math.sin(t * 11 + seed * 3));
  };
  // Ba lớp núi: xa nhạt, gần đậm; mỗi lớp có dải sương ở chân
  const layers: [number, number, number, number][] = [
    [H * 0.62, H * 0.42, 1.1, 0.22],
    [H * 0.74, H * 0.36, 2.3, 0.38],
    [H * 0.88, H * 0.3, 3.7, 0.55],
  ];
  for (const [base, amp, seed, a] of layers) {
    const f = ridge(base, amp, seed);
    g.fillStyle = rgba(ink, a);
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, f(x));
    g.lineTo(W, H);
    g.closePath();
    g.fill();
    // Nét vân núi (sườn) đậm hơn
    g.strokeStyle = rgba(ink, Math.min(1, a + 0.2));
    g.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const x0 = rnd() * W;
      g.beginPath();
      g.moveTo(x0, f(x0) + 4);
      g.lineTo(x0 + (rnd() - 0.5) * 30, f(x0) + 30 + rnd() * 40);
      g.stroke();
    }
    // Sương
    const mist = g.createLinearGradient(0, base - 10, 0, base + 30);
    mist.addColorStop(0, rgba(0xffffff, 0));
    mist.addColorStop(0.5, rgba(0xfaf5ea, 0.6));
    mist.addColorStop(1, rgba(0xffffff, 0));
    g.fillStyle = mist;
    g.fillRect(0, base - 10, W, 40);
  }
  // Vài cây thông nhỏ trên lớp núi gần
  const near = ridge(H * 0.88, H * 0.3, 3.7);
  for (let i = 0; i < 9; i++) {
    const x = ((i + 0.5) / 9) * W + (rnd() - 0.5) * 40;
    const y = near(x) + 6;
    g.fillStyle = rgba(ink, 0.8);
    g.fillRect(x - 1, y - 18, 2, 18);
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(x - 12 + k * 2, y - 8 - k * 7);
      g.lineTo(x + 12 - k * 2, y - 8 - k * 7);
      g.lineTo(x, y - 18 - k * 7);
      g.fill();
    }
  }
  tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  muralCache.set(key, tex);
  return tex;
}
