import * as THREE from 'three';
import { G, group, mesh } from './toon';

/**
 * BIỂN ĐÈN TREO TƯỜNG (đồ trang trí `wall: true` cho quán Nhật / quán Hàn):
 *  - 'lightbox_jp' Cụm hộp đèn: nhiều hộp đèn chữ nhật lệch tầng ghép quanh một bảng chữ lớn (tô, sóng, hổ, matcha…).
 *  - 'neon_kr' Cụm biển neon: biển dọc chữ Hàn, biển tròn tô mì, mũi tên "HOT & SPICY", ô vuông người đi bộ / mũi tên.
 * Mặt tự sáng (MeshBasicMaterial + canvas), thân hộp sẫm. Dựng mặt nhìn về +z, lưng sát z = 0, tâm ở gốc;
 * `userData.size` = [rộng, cao] (m). Chữ chỉ là tên món / chữ chung, không dùng tên thương hiệu nào.
 */

type Paint = (c: CanvasRenderingContext2D, w: number, h: number) => void;

function face(w: number, h: number, paint: Paint): THREE.MeshBasicMaterial {
  const px = 128;
  const cw = Math.round(px * Math.max(1, w / h));
  const ch = Math.round(px * Math.max(1, h / w));
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const g = c.getContext('2d')!;
  paint(g, cw, ch);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex });
}

/** Hộp đèn: thân sẫm sâu `d`, mặt trước tự sáng vẽ bằng `paint`. Tâm mặt trước ở (x, y). */
function box(parent: THREE.Object3D, x: number, y: number, w: number, h: number, d: number, paint: Paint, body = 0x2a2a2e): void {
  mesh(parent, G.box(w, h, d), body, { p: [x, y, d / 2], cast: false });
  mesh(parent, new THREE.PlaneGeometry(w * 0.96, h * 0.96), face(w, h, paint), { p: [x, y, d + 0.003], cast: false, receive: false });
}

const text = (c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, font = 'bold') => {
  c.fillStyle = color;
  c.font = `${font} ${size}px "Mali", "Malgun Gothic", "Yu Gothic", "Noto Sans KR", "Noto Sans JP", sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(s, x, y);
};
const vtext = (c: CanvasRenderingContext2D, s: string, x: number, y0: number, y1: number, color: string) => {
  const ch = [...s];
  const step = (y1 - y0) / ch.length;
  ch.forEach((k, i) => text(c, k, x, y0 + step * (i + 0.5), Math.min(step * 0.8, 60), color));
};

/** Cụm hộp đèn kiểu quán Nhật (ramen / izakaya). */
export function makeLightboxJp(g: THREE.Group): void {
  const r = group(g);
  // Bảng chữ lớn ở giữa
  box(r, -0.05, 0.12, 1.0, 0.36, 0.14, (c, w, h) => {
    c.fillStyle = '#e8452c';
    c.fillRect(0, 0, w, h);
    text(c, 'RAMEN', w * 0.5, h * 0.55, h * 0.55, '#fff3e0');
  }, 0xc23a26);
  box(r, 0.08, -0.22, 0.8, 0.3, 0.14, (c, w, h) => {
    c.fillStyle = '#e8452c';
    c.fillRect(0, 0, w, h);
    text(c, 'だし', w * 0.5, h * 0.55, h * 0.6, '#fff3e0');
  }, 0xc23a26);
  // Hộp nhỏ quanh: sóng biển, matcha, tô mì, hổ, vạch vàng đen
  box(r, -0.42, 0.48, 0.34, 0.36, 0.16, (c, w, h) => {
    c.fillStyle = '#2f6f86';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#e8f4f6';
    c.lineWidth = 5;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.arc(w * 0.3 + i * 18, h * 0.65, 16, Math.PI, 0);
      c.stroke();
    }
    text(c, '東京', w * 0.5, h * 0.25, h * 0.2, '#ffe9a8');
  });
  box(r, 0.2, 0.42, 0.34, 0.22, 0.14, (c, w, h) => {
    for (let i = 0; i < 6; i++) {
      c.fillStyle = i % 2 ? '#1d1d1f' : '#f2c230';
      c.fillRect((i * w) / 6, 0, w / 6, h);
    }
  });
  box(r, 0.56, 0.32, 0.36, 0.32, 0.16, (c, w, h) => {
    c.fillStyle = '#d9c8e8';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#3f8f4f';
    c.beginPath();
    c.arc(w / 2, h * 0.58, h * 0.26, 0, Math.PI * 2);
    c.fill();
    text(c, '抹茶', w * 0.5, h * 0.2, h * 0.2, '#2a5a32');
  });
  box(r, -0.58, -0.26, 0.24, 0.5, 0.15, (c, w, h) => {
    c.fillStyle = '#e8452c';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#1d1d1f';
    c.beginPath();
    c.arc(w / 2, h * 0.72, w * 0.36, 0, Math.PI);
    c.fill();
    c.strokeStyle = '#f2c230';
    c.lineWidth = 4;
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.moveTo(w * 0.3 + i * 8, h * 0.15);
      c.lineTo(w * 0.3 + i * 8, h * 0.68);
      c.stroke();
    }
  });
  box(r, 0.6, -0.12, 0.3, 0.3, 0.15, (c, w, h) => {
    c.fillStyle = '#26365a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#f08a2a';
    c.fillRect(w * 0.2, h * 0.3, w * 0.6, h * 0.4);
    c.fillStyle = '#1d1d1f';
    for (let i = 0; i < 4; i++) c.fillRect(w * 0.25 + i * w * 0.15, h * 0.3, w * 0.05, h * 0.4);
  });
  box(r, -0.18, -0.6, 0.3, 0.42, 0.15, (c, w, h) => {
    c.fillStyle = '#f3e3b8';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c23a26';
    c.lineWidth = 6;
    c.strokeRect(6, 6, w - 12, h - 12);
    vtext(c, 'ラーメン', w / 2, 16, h - 16, '#c23a26');
  });
  box(r, 0.4, -0.5, 0.4, 0.26, 0.15, (c, w, h) => {
    c.fillStyle = '#f6efe0';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#e09a2a';
    c.beginPath();
    c.arc(w * 0.3, h * 0.55, h * 0.32, 0, Math.PI * 2);
    c.fill();
    text(c, '拉麺', w * 0.72, h * 0.5, h * 0.36, '#c23a26');
  });
  g.userData.size = [1.6, 1.5];
}

/** Cụm biển neon / hộp đèn kiểu phố ẩm thực Hàn. */
export function makeNeonKr(g: THREE.Group): void {
  const r = group(g);
  const red = '#e8452c';
  // Biển dọc chữ Hàn
  box(r, -0.55, -0.05, 0.22, 1.2, 0.12, (c, w, h) => {
    c.fillStyle = red;
    c.fillRect(0, 0, w, h);
    vtext(c, '치즈핫도그', w / 2, 20, h - 60, '#fff3e0');
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(w / 2, h - 30, w * 0.28, 0, Math.PI * 2);
    c.fill();
    text(c, '24', w / 2, h - 30, w * 0.3, red);
  }, 0xb5321f);
  box(r, -0.28, -0.15, 0.2, 1.0, 0.12, (c, w, h) => {
    c.fillStyle = '#c8352e';
    c.fillRect(0, 0, w, h);
    vtext(c, '맛집', w / 2, 20, h * 0.55, '#fff3e0');
    c.fillStyle = '#2f9b8f';
    c.beginPath();
    c.arc(w / 2, h * 0.78, w * 0.32, 0, Math.PI * 2);
    c.fill();
  }, 0x9e2a22);
  // Biển tròn: tô mì + đũa
  const disc = group(r, { p: [0.12, 0.38, 0] });
  mesh(disc, G.cyl(0.32, 0.32, 0.1, 28), 0xb5321f, { p: [0, 0, 0.05], r: [Math.PI / 2, 0, 0], cast: false });
  mesh(disc, new THREE.CircleGeometry(0.3, 28), face(0.6, 0.6, (c, w, h) => {
    c.fillStyle = red;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff3e0';
    c.beginPath();
    c.arc(w / 2, h * 0.55, w * 0.25, 0, Math.PI);
    c.fill();
    c.strokeStyle = '#fff3e0';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(w * 0.55, h * 0.2);
    c.lineTo(w * 0.7, h * 0.55);
    c.stroke();
    text(c, '매운맛', w / 2, h * 0.86, h * 0.1, '#fff3e0');
  }), { p: [0, 0, 0.103], cast: false, receive: false });
  // Mũi tên "HOT & SPICY" chỉ xuống
  box(r, 0.58, 0.05, 0.2, 0.8, 0.12, (c, w, h) => {
    c.fillStyle = red;
    c.fillRect(0, 0, w, h);
    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(Math.PI / 2);
    text(c, 'HOT & SPICY', 0, 0, w * 0.42, '#fff3e0');
    c.restore();
  }, 0xb5321f);
  const tip = mesh(r, G.cyl(0, 0.2, 0.22, 3), 0xe8452c, { p: [0.58, -0.47, 0.06], r: [0, 0, Math.PI], cast: false });
  tip.scale.z = 0.4;
  // Ô vuông: người đi bộ (cam), mũi tên (xanh ngọc)
  box(r, 0.05, -0.08, 0.26, 0.26, 0.12, (c, w, h) => {
    c.fillStyle = '#f08a2a';
    c.fillRect(0, 0, w, h);
    text(c, '🚶', w / 2, h / 2, h * 0.6, '#ffffff');
  }, 0xb5651f);
  box(r, 0.1, -0.4, 0.28, 0.28, 0.12, (c, w, h) => {
    c.fillStyle = '#2f9b8f';
    c.fillRect(0, 0, w, h);
    text(c, '↗', w / 2, h / 2, h * 0.7, '#ffffff');
  }, 0x23756c);
  g.userData.size = [1.5, 1.4];
}
