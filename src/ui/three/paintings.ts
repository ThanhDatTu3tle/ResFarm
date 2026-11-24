import * as THREE from 'three';
import { G, mesh, seeded, toon } from './toon';

/**
 * TRANH TREO TƯỜNG (đồ trang trí `wall`, giai đoạn 20) — 3 bức mỗi quán Việt / Nhật / Hàn, vẽ bằng canvas lúc chạy
 * (không dùng ảnh ngoài), nét giản lược hơi run tay, phủ hạt giấy cho hợp phong cách màu sáp.
 * Model dựng mặt nhìn về +z, lưng sát z = 0, tâm tranh ở gốc; `userData.size` = [rộng, cao] (m) để chỗ treo căn khung chọn.
 */

type Draw = (c: CanvasRenderingContext2D, w: number, h: number, rnd: () => number) => void;
interface Painting {
  /** Cỡ phần tranh (m), chưa tính khung. */
  w: number;
  h: number;
  /** Khung: gỗ sẫm / gỗ sáng / cuộn treo (tranh cuộn Nhật, Hàn: trục gỗ trên dưới, không viền). */
  frame: 'dark' | 'light' | 'scroll';
  draw: Draw;
}

const texCache = new Map<string, THREE.Texture>();
function paintingTexture(id: string, p: Painting): THREE.Texture {
  let tex = texCache.get(id);
  if (tex) return tex;
  const W = 320;
  const H = Math.round((W * p.h) / p.w);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d')!;
  const rnd = seeded(id.length * 977 + id.charCodeAt(4));
  p.draw(c, W, H, rnd);
  // Hạt giấy + vài nét sáp chéo cho hợp phong cách màu sáp
  for (let i = 0; i < 500; i++) {
    c.fillStyle = `rgba(255,250,238,${0.08 + rnd() * 0.18})`;
    c.fillRect(rnd() * W, rnd() * H, 1 + rnd(), 1 + rnd());
  }
  c.lineWidth = 1.2;
  for (let i = 0; i < 120; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    c.strokeStyle = rnd() < 0.5 ? 'rgba(40,25,10,0.07)' : 'rgba(255,250,235,0.09)';
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 10, y - 7);
    c.stroke();
  }
  tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(id, tex);
  return tex;
}

/** Hình tròn / elip run tay nhẹ. */
function blob(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rnd: () => number, amp = 0.06): void {
  c.beginPath();
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (rnd() - 0.5) * amp;
    const px = x + Math.cos(a) * rx * k;
    const py = y + Math.sin(a) * ry * k;
    if (i) c.lineTo(px, py);
    else c.moveTo(px, py);
  }
  c.closePath();
}

function poly(c: CanvasRenderingContext2D, pts: number[][], fill: string): void {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
}

const PAINTINGS: Record<string, Painting> = {
  // ---------- Quán Việt ----------
  /** Phố cổ: dãy nhà ống vàng mái ngói, cửa chớp xanh, cột điện dây chằng chịt, trời chiều. */
  art_phoco: {
    w: 1.1,
    h: 0.8,
    frame: 'dark',
    draw(c, W, H, rnd) {
      const sky = c.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#f6d9a8');
      sky.addColorStop(1, '#f3e9d2');
      c.fillStyle = sky;
      c.fillRect(0, 0, W, H);
      const houses = [
        ['#e9b949', 70, 0.42],
        ['#e5a35a', 60, 0.5],
        ['#efc66a', 80, 0.36],
        ['#d98f55', 55, 0.48],
        ['#e9b949', 60, 0.4],
      ] as const;
      let x = 0;
      for (const [col, w, top] of houses) {
        const y = H * top;
        poly(c, [[x - 4, y + 6], [x + w / 2, y - 22], [x + w + 4, y + 6]], '#9e4a30'); // mái ngói
        c.fillStyle = col;
        c.fillRect(x, y + 4, w, H - y);
        for (const wy of [y + 22, y + 62])
          if (wy < H - 30) {
            c.fillStyle = '#4f8a4c';
            c.fillRect(x + w * 0.25, wy, w * 0.5, 24);
            c.fillStyle = '#3c6b3a';
            c.fillRect(x + w / 2 - 1, wy, 2, 24);
          }
        x += w;
      }
      // Cột điện + dây
      c.fillStyle = '#5a4a3a';
      c.fillRect(W * 0.72, H * 0.12, 5, H);
      c.strokeStyle = 'rgba(40,30,25,0.8)';
      c.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.moveTo(0, H * (0.16 + i * 0.025));
        c.quadraticCurveTo(W * 0.4, H * (0.26 + i * 0.03 + rnd() * 0.02), W * 0.72, H * (0.14 + i * 0.02));
        c.quadraticCurveTo(W * 0.86, H * (0.2 + i * 0.02), W, H * (0.16 + i * 0.03));
        c.stroke();
      }
      // Lòng đường + người đạp xe
      c.fillStyle = '#c9b59a';
      c.fillRect(0, H * 0.9, W, H * 0.1);
      c.strokeStyle = '#3a2a1e';
      c.lineWidth = 2.5;
      for (const bx of [W * 0.4, W * 0.48]) {
        blob(c, bx, H * 0.9, 9, 9, rnd);
        c.stroke();
      }
      c.fillStyle = '#e9d27a';
      poly(c, [[W * 0.42, H * 0.74], [W * 0.46, H * 0.74], [W * 0.44, H * 0.7]], '#d9b04a'); // nón lá
      c.fillStyle = '#f4ede0';
      c.fillRect(W * 0.43, H * 0.75, 7, 18);
    },
  },
  /** Tranh gà Đông Hồ (kiểu tranh dân gian): gà trống đỏ vàng trên nền giấy điệp, viền đen dày, gà con. */
  art_dongho: {
    w: 0.75,
    h: 0.95,
    frame: 'light',
    draw(c, W, H, rnd) {
      c.fillStyle = '#f1e3c4';
      c.fillRect(0, 0, W, H);
      c.lineWidth = 4;
      c.strokeStyle = '#2a1d14';
      const cx = W * 0.5;
      const cy = H * 0.5;
      // Đuôi
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.moveTo(cx + 30, cy - 10);
        c.quadraticCurveTo(cx + 120, cy - 120 + i * 30, cx + 70 + i * 8, cy + 30 + i * 12);
        c.strokeStyle = ['#2f6f5a', '#d9433a', '#2a1d14', '#e2a63a', '#2f6f5a'][i];
        c.lineWidth = 9;
        c.stroke();
      }
      // Thân, cánh, đầu
      blob(c, cx - 10, cy + 20, 70, 55, rnd);
      c.fillStyle = '#d9433a';
      c.fill();
      c.lineWidth = 4;
      c.strokeStyle = '#2a1d14';
      c.stroke();
      blob(c, cx + 5, cy + 22, 42, 28, rnd);
      c.fillStyle = '#e2a63a';
      c.fill();
      c.stroke();
      blob(c, cx - 70, cy - 50, 26, 30, rnd);
      c.fillStyle = '#d9433a';
      c.fill();
      c.stroke();
      poly(c, [[cx - 82, cy - 82], [cx - 70, cy - 98], [cx - 58, cy - 82]], '#c2302a'); // mào
      poly(c, [[cx - 96, cy - 52], [cx - 112, cy - 46], [cx - 96, cy - 40]], '#e2a63a'); // mỏ
      c.fillStyle = '#2a1d14';
      c.beginPath();
      c.arc(cx - 76, cy - 56, 4, 0, Math.PI * 2);
      c.fill();
      // Chân
      c.lineWidth = 5;
      for (const lx of [cx - 25, cx + 5]) {
        c.beginPath();
        c.moveTo(lx, cy + 70);
        c.lineTo(lx, cy + 110);
        c.lineTo(lx - 14, cy + 120);
        c.stroke();
      }
      // Gà con
      for (const [x, y] of [[W * 0.2, H * 0.88], [W * 0.78, H * 0.9]]) {
        blob(c, x, y, 18, 14, rnd);
        c.fillStyle = '#efc95a';
        c.fill();
        c.lineWidth = 3;
        c.stroke();
      }
    },
  },
  /** Đồng quê: ruộng lúa bậc thang xanh, người đội nón lá, trâu, rặng tre, mặt trời. */
  art_dongque: {
    w: 1.1,
    h: 0.75,
    frame: 'dark',
    draw(c, W, H, rnd) {
      c.fillStyle = '#cfe6ea';
      c.fillRect(0, 0, W, H);
      blob(c, W * 0.78, H * 0.2, 22, 22, rnd);
      c.fillStyle = '#f2b23e';
      c.fill();
      poly(c, [[0, H * 0.45], [W * 0.3, H * 0.25], [W * 0.6, H * 0.42], [W, H * 0.3], [W, H * 0.55], [0, H * 0.6]], '#8fb88a'); // núi xa
      const greens = ['#9ed06a', '#7fbf4a', '#b5d86a', '#6aa83e'];
      for (let i = 0; i < 4; i++) {
        const y = H * (0.52 + i * 0.12);
        c.beginPath();
        c.moveTo(0, y);
        c.quadraticCurveTo(W * 0.5, y - 18 + rnd() * 10, W, y + 6);
        c.lineTo(W, H);
        c.lineTo(0, H);
        c.closePath();
        c.fillStyle = greens[i];
        c.fill();
      }
      // Rặng tre bên trái
      for (let i = 0; i < 6; i++) {
        blob(c, 20 + i * 14, H * 0.45 - (i % 2) * 10, 16, 34, rnd, 0.2);
        c.fillStyle = i % 2 ? '#4f8a3c' : '#5f9e44';
        c.fill();
      }
      // Trâu
      blob(c, W * 0.66, H * 0.76, 30, 16, rnd);
      c.fillStyle = '#5a4a44';
      c.fill();
      blob(c, W * 0.58, H * 0.72, 10, 9, rnd);
      c.fill();
      c.fillRect(W * 0.64, H * 0.8, 4, 14);
      c.fillRect(W * 0.72, H * 0.8, 4, 14);
      // Người đội nón lá
      poly(c, [[W * 0.36, H * 0.7], [W * 0.44, H * 0.7], [W * 0.4, H * 0.63]], '#e8cf8a');
      c.fillStyle = '#3f5f9a';
      c.fillRect(W * 0.385, H * 0.7, 9, 22);
    },
  },

  // ---------- Quán Nhật ----------
  /** Sóng lớn và núi Phú Sĩ phủ tuyết (kiểu khắc gỗ giản lược). */
  art_fuji: {
    w: 1.1,
    h: 0.75,
    frame: 'dark',
    draw(c, W, H, rnd) {
      c.fillStyle = '#efe3c8';
      c.fillRect(0, 0, W, H);
      blob(c, W * 0.78, H * 0.22, 24, 24, rnd);
      c.fillStyle = '#d9433a';
      c.fill();
      poly(c, [[W * 0.35, H * 0.7], [W * 0.55, H * 0.28], [W * 0.75, H * 0.7]], '#4a6a9a');
      poly(c, [[W * 0.48, H * 0.42], [W * 0.55, H * 0.28], [W * 0.62, H * 0.42], [W * 0.58, H * 0.4], [W * 0.55, H * 0.44], [W * 0.52, H * 0.4]], '#f6f3ea');
      // Sóng
      for (let i = 0; i < 3; i++) {
        const y = H * (0.62 + i * 0.13);
        c.beginPath();
        c.moveTo(0, y);
        for (let x = 0; x <= W; x += 40) c.quadraticCurveTo(x + 20, y - 26 - rnd() * 8, x + 40, y);
        c.lineTo(W, H);
        c.lineTo(0, H);
        c.closePath();
        c.fillStyle = ['#2f5f9a', '#3f7fc0', '#24497a'][i];
        c.fill();
        c.strokeStyle = '#f6f3ea';
        c.lineWidth = 3;
        c.stroke();
      }
      // Ngọn sóng lớn bên trái
      c.beginPath();
      c.moveTo(0, H * 0.75);
      c.quadraticCurveTo(W * 0.05, H * 0.2, W * 0.3, H * 0.3);
      c.quadraticCurveTo(W * 0.18, H * 0.38, W * 0.2, H * 0.55);
      c.lineTo(W * 0.25, H);
      c.lineTo(0, H);
      c.closePath();
      c.fillStyle = '#2f5f9a';
      c.fill();
      c.strokeStyle = '#f6f3ea';
      c.stroke();
      c.fillStyle = '#f6f3ea';
      for (let i = 0; i < 7; i++) {
        blob(c, W * (0.18 + i * 0.02), H * (0.27 + (i % 2) * 0.02), 6, 6, rnd);
        c.fill();
      }
    },
  },
  /** Tranh cuộn thư pháp: vòng tròn ensō mực tàu, dấu triện đỏ, nền giấy kem. */
  art_enso: {
    w: 0.55,
    h: 1.15,
    frame: 'scroll',
    draw(c, W, H, rnd) {
      c.fillStyle = '#f4ecd9';
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#c9b48a';
      c.fillRect(0, 0, W, H * 0.08);
      c.fillRect(0, H * 0.92, W, H * 0.08);
      // Ensō: nét cọ dày dần rồi mảnh, hở một khúc
      const cx = W / 2;
      const cy = H * 0.42;
      for (let i = 0; i < 300; i++) {
        const t = i / 300;
        const a = -1.2 + t * Math.PI * 1.85;
        const r = 95 + Math.sin(t * 9) * 3;
        const wdt = 22 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + 3;
        c.fillStyle = `rgba(25,20,18,${0.85 - rnd() * 0.2})`;
        c.beginPath();
        c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, wdt / 2, 0, Math.PI * 2);
        c.fill();
      }
      // Hàng chữ dọc giản lược + triện đỏ
      c.fillStyle = 'rgba(25,20,18,0.85)';
      for (let i = 0; i < 4; i++) c.fillRect(cx - 6 + (rnd() - 0.5) * 6, H * (0.66 + i * 0.05), 12 + rnd() * 8, 8);
      c.fillStyle = '#c8322b';
      c.fillRect(cx + 26, H * 0.82, 22, 22);
    },
  },
  /** Cá chép koi đỏ trắng bơi giữa lá sen trên nước xanh. */
  art_koi: {
    w: 0.95,
    h: 0.75,
    frame: 'light',
    draw(c, W, H, rnd) {
      c.fillStyle = '#5f9fb0';
      c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,0.25)';
      c.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        blob(c, rnd() * W, rnd() * H, 20 + rnd() * 30, 8 + rnd() * 10, rnd, 0.1);
        c.stroke();
      }
      for (const [x, y, r] of [[W * 0.2, H * 0.25, 34], [W * 0.82, H * 0.75, 40], [W * 0.75, H * 0.2, 24]]) {
        blob(c, x, y, r, r * 0.85, rnd);
        c.fillStyle = '#4f9e4a';
        c.fill();
        poly(c, [[x, y], [x + r, y - 6], [x + r, y + 6]], '#5f9fb0'); // khía lá sen
      }
      const koi = (x: number, y: number, a: number, spot: string) => {
        c.save();
        c.translate(x, y);
        c.rotate(a);
        blob(c, 0, 0, 46, 16, rnd);
        c.fillStyle = '#f6f1e4';
        c.fill();
        blob(c, -8, -2, 18, 10, rnd, 0.2);
        c.fillStyle = spot;
        c.fill();
        blob(c, 30, 0, 10, 9, rnd);
        c.fill();
        poly(c, [[-44, 0], [-66, -16], [-60, 0], [-66, 16]], spot);
        c.restore();
      };
      koi(W * 0.45, H * 0.45, -0.4, '#e2573a');
      koi(W * 0.6, H * 0.62, 2.6, '#f2a23a');
    },
  },

  // ---------- Quán Hàn ----------
  /** Tranh dân gian minhwa: hổ vằn ngồi dưới cây thông, chim ác là trên cành. */
  art_tiger: {
    w: 0.75,
    h: 0.95,
    frame: 'scroll',
    draw(c, W, H, rnd) {
      c.fillStyle = '#efe1bf';
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#c9b48a';
      c.fillRect(0, 0, W, H * 0.06);
      c.fillRect(0, H * 0.94, W, H * 0.06);
      // Cây thông
      c.fillStyle = '#6b4a2f';
      c.fillRect(W * 0.12, H * 0.1, 14, H * 0.6);
      for (const [x, y] of [[W * 0.2, H * 0.14], [W * 0.38, H * 0.2], [W * 0.1, H * 0.3]]) {
        blob(c, x, y, 50, 18, rnd, 0.2);
        c.fillStyle = '#3f6f4a';
        c.fill();
      }
      // Chim ác là
      blob(c, W * 0.42, H * 0.12, 14, 9, rnd);
      c.fillStyle = '#1f2a3a';
      c.fill();
      blob(c, W * 0.44, H * 0.13, 7, 5, rnd);
      c.fillStyle = '#f6f3ea';
      c.fill();
      // Hổ ngồi
      const cx = W * 0.55;
      const cy = H * 0.62;
      blob(c, cx, cy, 70, 80, rnd);
      c.fillStyle = '#e8963a';
      c.fill();
      blob(c, cx - 5, cy - 95, 46, 40, rnd);
      c.fill();
      c.strokeStyle = '#2a1d14';
      c.lineWidth = 6;
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.moveTo(cx - 60 + i * 22, cy - 50 + (i % 2) * 20);
        c.lineTo(cx - 48 + i * 22, cy + 20);
        c.stroke();
      }
      c.fillStyle = '#f6f3ea';
      blob(c, cx - 5, cy - 82, 22, 14, rnd);
      c.fill();
      c.fillStyle = '#2a1d14';
      for (const ex of [cx - 22, cx + 12]) {
        blob(c, ex, cy - 104, 9, 9, rnd);
        c.fill();
      }
      c.fillStyle = '#f2c94c';
      for (const ex of [cx - 22, cx + 12]) {
        blob(c, ex, cy - 104, 4, 4, rnd);
        c.fill();
      }
    },
  },
  /** Hoa mẫu đơn hồng đỏ trên cành, lá xanh, nền kem (tranh cuộn). */
  art_peony: {
    w: 0.55,
    h: 1.15,
    frame: 'scroll',
    draw(c, W, H, rnd) {
      c.fillStyle = '#f3ead6';
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#9fb8c9';
      c.fillRect(0, 0, W, H * 0.06);
      c.fillRect(0, H * 0.94, W, H * 0.06);
      c.strokeStyle = '#5a4a3a';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(W * 0.5, H * 0.92);
      c.quadraticCurveTo(W * 0.3, H * 0.6, W * 0.55, H * 0.25);
      c.stroke();
      for (const [x, y] of [[W * 0.3, H * 0.7], [W * 0.65, H * 0.55], [W * 0.35, H * 0.45]]) {
        blob(c, x, y, 34, 16, rnd, 0.2);
        c.fillStyle = '#4f8a4c';
        c.fill();
      }
      for (const [x, y, r, col] of [[W * 0.55, H * 0.25, 58, '#d9536a'], [W * 0.42, H * 0.55, 46, '#e98aa0'], [W * 0.62, H * 0.75, 36, '#c8322b']] as const) {
        for (let k = 0; k < 3; k++) {
          blob(c, x, y, r * (1 - k * 0.25), r * (0.8 - k * 0.2), rnd, 0.25);
          c.fillStyle = k === 1 ? '#f6d2da' : col;
          c.fill();
        }
        c.fillStyle = '#f2c94c';
        blob(c, x, y, 8, 6, rnd);
        c.fill();
      }
    },
  },
  /** Mái nhà hanok cong dưới trăng tròn, trời đêm xanh tím. */
  art_hanok: {
    w: 1.1,
    h: 0.75,
    frame: 'dark',
    draw(c, W, H, rnd) {
      const sky = c.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#2a3566');
      sky.addColorStop(1, '#5a5f9a');
      c.fillStyle = sky;
      c.fillRect(0, 0, W, H);
      blob(c, W * 0.75, H * 0.25, 34, 34, rnd);
      c.fillStyle = '#f6eab8';
      c.fill();
      c.fillStyle = 'rgba(255,255,240,0.8)';
      for (let i = 0; i < 25; i++) c.fillRect(rnd() * W, rnd() * H * 0.5, 2, 2);
      for (const [x0, w, y] of [[W * 0.05, W * 0.5, H * 0.55], [W * 0.45, W * 0.55, H * 0.62]]) {
        // Mái cong: hai đầu vểnh lên
        c.beginPath();
        c.moveTo(x0 - 10, y - 16);
        c.quadraticCurveTo(x0 + w / 2, y + 14, x0 + w + 10, y - 16);
        c.lineTo(x0 + w - 20, y - 50);
        c.lineTo(x0 + 20, y - 50);
        c.closePath();
        c.fillStyle = '#2f3440';
        c.fill();
        c.fillStyle = '#c9a77a';
        c.fillRect(x0 + 10, y, w - 20, H - y);
        c.fillStyle = '#f2d48a';
        for (let i = 0; i < 3; i++) c.fillRect(x0 + 24 + i * (w - 48) / 3, y + 16, (w - 60) / 3 - 6, 30);
      }
      c.fillStyle = '#1f2433';
      c.fillRect(0, H * 0.92, W, H * 0.08);
    },
  },
};

const frameMats = { dark: toon(0x3b2618), light: toon(0xb98a55), mat: toon(0xf3ead6), rod: toon(0x5a3a26) };

/** Dựng tranh `id` (nếu có) vào nhóm `g`. Trả false nếu không phải mẫu tranh. */
export function buildPainting(g: THREE.Object3D, id: string): boolean {
  const p = PAINTINGS[id];
  if (!p) return false;
  const pic = new THREE.MeshBasicMaterial({ map: paintingTexture(id, p), toneMapped: false });
  if (p.frame === 'scroll') {
    // Tranh cuộn: tấm giấy + trục gỗ tròn trên dưới + dây treo
    mesh(g, new THREE.PlaneGeometry(p.w, p.h), pic, { p: [0, 0, 0.02], cast: false });
    for (const sy of [-1, 1]) mesh(g, G.cyl(0.025, 0.025, p.w + 0.12, 8), frameMats.rod, { p: [0, sy * (p.h / 2 + 0.01), 0.03], r: [0, 0, Math.PI / 2] });
    mesh(g, G.cyl(0.005, 0.005, 0.3, 4), frameMats.rod, { p: [-0.12, p.h / 2 + 0.12, 0.01], r: [0, 0, 0.9], cast: false });
    mesh(g, G.cyl(0.005, 0.005, 0.3, 4), frameMats.rod, { p: [0.12, p.h / 2 + 0.12, 0.01], r: [0, 0, -0.9], cast: false });
    g.userData.size = [p.w + 0.12, p.h + 0.1];
    return true;
  }
  // Khung gỗ dày + viền giấy (passe-partout) + tranh
  const f = 0.07;
  const m = 0.05;
  const fm = frameMats[p.frame];
  const ow = p.w + 2 * (f + m);
  const oh = p.h + 2 * (f + m);
  mesh(g, G.box(ow - 2 * f, oh - 2 * f, 0.02), frameMats.mat, { p: [0, 0, 0.01] });
  for (const sy of [-1, 1]) mesh(g, G.box(ow, f, 0.06), fm, { p: [0, sy * (oh / 2 - f / 2), 0.03] });
  for (const sx of [-1, 1]) mesh(g, G.box(f, oh - 2 * f, 0.06), fm, { p: [sx * (ow / 2 - f / 2), 0, 0.03] });
  mesh(g, new THREE.PlaneGeometry(p.w, p.h), pic, { p: [0, 0, 0.022], cast: false });
  g.userData.size = [ow, oh];
  return true;
}
