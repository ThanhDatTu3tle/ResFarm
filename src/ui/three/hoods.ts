import * as THREE from 'three';
import { G, group, mesh } from './toon';

/**
 * ỐNG HÚT KHÓI trên bàn nướng quán Hàn: chụp inox tròn treo trên vỉ + ống co giãn lên trần.
 * Bật / tắt trong Cài đặt (lưu theo máy, mặc định bật) — chỉ ẩn / hiện, không dựng lại bàn.
 */

const PREF_KEY = 'quan-nha-vuon/hoods';
let enabled = true;
try {
  enabled = localStorage.getItem(PREF_KEY) !== '0';
} catch {
  /* không có localStorage: giữ mặc định */
}

/** Các ống đang dựng (bàn bị dựng lại thì ống cũ rời cảnh, lọc bỏ khi bật / tắt). */
const hoods = new Set<THREE.Object3D>();

export function hoodsEnabled(): boolean {
  return enabled;
}

export function setHoods(on: boolean): void {
  enabled = on;
  for (const h of hoods) {
    // Bàn đã gỡ khỏi quán (dựng lại) thì bỏ khỏi danh sách
    if (!h.parent?.parent) hoods.delete(h);
    else h.visible = on;
  }
  try {
    localStorage.setItem(PREF_KEY, on ? '1' : '0');
  } catch {
    /* bỏ qua */
  }
}

const STEEL = 0xc9ced3;
const DARK = 0x6d7379;

/** Chụp hút khói trên vỉ ở (x, z) của bàn cao `top`, ống thẳng lên tới `ceil` (m). */
export function buildHood(g: THREE.Object3D, top: number, x = 0, z = 0, ceil = 3.3): THREE.Object3D {
  const h = group(g, { p: [x, 0, z] });
  const y = top + 0.6;
  // Chụp loe dưới + đai viền
  mesh(h, G.cyl(0.1, 0.27, 0.2, 20), STEEL, { p: [0, y, 0] });
  mesh(h, G.torus(0.27, 0.014, 5, 22), DARK, { p: [0, y - 0.1, 0], r: [Math.PI / 2, 0, 0], cast: false });
  // Ống co giãn: 2 đoạn lồng nhau, có khớp
  const len = Math.max(0.4, ceil - (y + 0.1));
  mesh(h, G.cyl(0.085, 0.085, len * 0.55, 14), STEEL, { p: [0, y + 0.1 + (len * 0.55) / 2, 0] });
  mesh(h, G.cyl(0.07, 0.07, len * 0.5, 14), 0xb3b9bf, { p: [0, y + 0.1 + len * 0.75, 0] });
  for (const t of [0.15, 0.55]) mesh(h, G.torus(0.088, 0.012, 4, 14), DARK, { p: [0, y + 0.1 + len * t, 0], r: [Math.PI / 2, 0, 0], cast: false });
  h.visible = enabled;
  hoods.add(h);
  return h;
}
