import * as THREE from 'three';
import { AD_SLIDES, type AdSlide } from '../../data/ads';
import { G, group, mesh } from './toon';

/**
 * BIỂN LED QUẢNG CÁO LỚN (khu chợ, trước sạp thịt): màn hình 16:9 trên hai cột thép, khung đen viền nhôm, sàn thao tác
 * + lan can phía sau, 3 đèn rọi trên nóc. Màn chạy lần lượt các mẫu trong src/data/ads.ts (lướt ngang khi đổi mẫu),
 * có lưới điểm LED mờ phủ lên cho ra chất màn LED. Màn tự sáng (MeshBasic) nên đêm vẫn rực.
 * Gốc ở giữa hai chân cột, mặt màn nhìn về +z.
 */
export interface Billboard {
  g: THREE.Group;
  update(t: number, night: number): void;
}

const CW = 640;
const CH = 360;

const images = new Map<string, HTMLImageElement>();
function imageOf(src: string): HTMLImageElement | null {
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    images.set(src, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

/** Vẽ một mẫu quảng cáo vào khung (x lệch để lướt ngang). */
function drawSlide(c: CanvasRenderingContext2D, s: AdSlide, x: number): void {
  c.save();
  c.translate(x, 0);
  const img = s.image ? imageOf(s.image) : null;
  if (img) c.drawImage(img, 0, 0, CW, CH);
  else {
    const grad = c.createLinearGradient(0, 0, CW, CH);
    grad.addColorStop(0, s.bg[0]);
    grad.addColorStop(1, s.bg[1]);
    c.fillStyle = grad;
    c.fillRect(0, 0, CW, CH);
    // Vòng sáng trang trí góc phải
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.beginPath();
    c.arc(CW * 0.82, CH * 0.3, 150, 0, Math.PI * 2);
    c.fill();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (s.icon) {
      c.font = '120px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      c.fillText(s.icon, CW / 2, CH * 0.3);
    }
    c.fillStyle = s.color ?? '#ffffff';
    c.shadowColor = 'rgba(0,0,0,0.35)';
    c.shadowBlur = 8;
    c.font = 'bold 62px "Baloo 2", "Nunito", sans-serif';
    c.fillText(s.title, CW / 2, CH * 0.64, CW - 40);
    if (s.sub) {
      c.font = '600 30px "Nunito", sans-serif';
      c.fillText(s.sub, CW / 2, CH * 0.82, CW - 50);
    }
  }
  c.restore();
}

/** Lưới điểm LED: các chấm sẫm cách đều phủ lên màn. */
function ledGrid(c: CanvasRenderingContext2D): void {
  c.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < CH; y += 6) c.fillRect(0, y, CW, 1.5);
  for (let x = 0; x < CW; x += 6) c.fillRect(x, 0, 1.5, CH);
}

export function makeBillboard(slides: AdSlide[] = AD_SLIDES, W = 4.4): Billboard {
  const g = group(null);
  const H = (W * 9) / 16;
  const bottom = 2.9;
  const steel = 0x5a606b;
  // Hai cột thép + đế bê tông + giằng chéo
  for (const sx of [-1, 1]) {
    mesh(g, G.box(0.6, 0.3, 0.6), 0xb9b3a8, { p: [sx * W * 0.3, 0.15, 0] });
    mesh(g, G.cyl(0.13, 0.15, bottom + H * 0.5, 10), steel, { p: [sx * W * 0.3, (bottom + H * 0.5) / 2 + 0.3, -0.15] });
  }
  mesh(g, G.box(W * 0.6, 0.08, 0.08), steel, { p: [0, bottom - 0.6, -0.15], cast: false });
  // Khung màn: hộp đen, viền nhôm, lưng có gân
  const box = group(g, { p: [0, bottom + H / 2, 0] });
  mesh(box, G.box(W + 0.3, H + 0.3, 0.35), 0x23262b);
  for (const sy of [-1, 1]) mesh(box, G.box(W + 0.36, 0.06, 0.38), 0xb8c0c8, { p: [0, sy * (H / 2 + 0.15), 0], cast: false });
  for (const sx of [-1, 1]) mesh(box, G.box(0.06, H + 0.36, 0.38), 0xb8c0c8, { p: [sx * (W / 2 + 0.15), 0, 0], cast: false });
  for (let i = 0; i < 5; i++) mesh(box, G.box(0.05, H, 0.04), 0x34373e, { p: [-W / 2 + (i + 0.5) * (W / 5), 0, -0.2], cast: false });
  // Màn hình (canvas)
  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const screen = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  mesh(box, new THREE.PlaneGeometry(W, H), screen, { p: [0, 0, 0.18], cast: false, receive: false });
  // Sàn thao tác + lan can phía dưới màn, thang lên ở cột phải
  mesh(g, G.box(W + 0.4, 0.05, 0.6), 0x4a4f58, { p: [0, bottom - 0.12, 0.25], cast: false });
  for (let i = 0; i <= 8; i++) mesh(g, G.box(0.025, 0.4, 0.025), steel, { p: [-W / 2 - 0.15 + (i * (W + 0.3)) / 8, bottom + 0.08, 0.53], cast: false });
  mesh(g, G.box(W + 0.35, 0.03, 0.03), steel, { p: [0, bottom + 0.28, 0.53], cast: false });
  const lx = W * 0.3 + 0.22;
  for (const dz of [-0.28, -0.02]) mesh(g, G.box(0.03, bottom - 0.2, 0.03), steel, { p: [lx, (bottom - 0.2) / 2 + 0.3, dz], cast: false });
  for (let y = 0.6; y < bottom; y += 0.3) mesh(g, G.box(0.03, 0.025, 0.28), steel, { p: [lx, y, -0.15], cast: false });
  // 3 đèn rọi trên nóc, cần vươn ra trước
  const lamp = new THREE.MeshBasicMaterial({ color: 0xfff1c2 });
  for (const sx of [-1, 0, 1]) {
    mesh(g, G.box(0.04, 0.04, 0.6), steel, { p: [sx * W * 0.35, bottom + H + 0.2, 0.3], cast: false });
    mesh(g, G.cyl(0.08, 0.11, 0.16, 8), 0x23262b, { p: [sx * W * 0.35, bottom + H + 0.16, 0.62], r: [-0.9, 0, 0], cast: false });
    mesh(g, G.cyl(0.075, 0.075, 0.01, 8), lamp, { p: [sx * W * 0.35, bottom + H + 0.1, 0.67], r: [-0.9, 0, 0], cast: false });
  }
  const glow = new THREE.PointLight(0xbfe0ff, 0, 9, 1.4);
  glow.position.set(0, bottom + H / 2, 1.6);
  g.add(glow);

  let shown = -1;
  let drawnK = -1;
  // Đổi mẫu theo thời gian: mỗi mẫu `seconds` giây (mặc định 6), 0.6 s cuối lướt sang mẫu kế
  const durations = slides.map((s) => s.seconds ?? 6);
  const total = durations.reduce((a, b) => a + b, 0);
  return {
    g,
    update(t, night) {
      if (!slides.length) return;
      let at = t % total;
      let i = 0;
      while (at >= durations[i]) at -= durations[i++];
      const slide = 0.6;
      const k = Math.max(0, (at - (durations[i] - slide)) / slide); // 0 = đứng yên, 0..1 = đang lướt
      const ease = k * k * (3 - 2 * k);
      if (i !== shown || k > 0 || drawnK > 0) {
        ctx.clearRect(0, 0, CW, CH);
        drawSlide(ctx, slides[i], -ease * CW);
        if (k > 0) drawSlide(ctx, slides[(i + 1) % slides.length], CW - ease * CW);
        ledGrid(ctx);
        tex.needsUpdate = true;
        shown = i;
        // Ảnh quảng cáo chưa tải xong thì vẽ lại ở khung sau
        drawnK = slides[i].image && !imageOf(slides[i].image!) ? 1 : k;
      }
      lamp.color.setHex(night > 0.2 ? 0xfff6d8 : 0xd9d3c4);
      glow.intensity = night * 1.6;
    },
  };
}
