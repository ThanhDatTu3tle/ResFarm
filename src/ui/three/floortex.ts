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
 * Gạch men ngọc đỏ: bàn cờ 2 kiểu viên — (A) nền trắng viền xanh ngọc, góc tam giác xanh, đĩa tròn đỏ đô với hoa 4 cánh
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
 * Gạch vỉa hè (terrazzo xi măng đá rửa): nền be lốm đốm đá vụn, rãnh lõm sẫm — lưới ô nhỏ, 3 vòng cung đồng tâm từ một góc
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

/** Texture sàn theo kiểu hoa văn của món nội thất (`a` / `b` = màu nền / hoa văn cho gạch bông). */
export function floorTexture(pattern: 'encaustic' | 'ngocdo' | 'terracotta', a: number, b: number): THREE.Texture {
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
