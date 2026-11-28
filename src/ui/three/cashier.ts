import * as THREE from 'three';
import { signText } from './cuisine';
import { emojiSprite, G, group, mesh } from './toon';

/**
 * QUẦY CASHIER (giai đoạn 18 - đơn giao tận nơi): quầy gỗ nhỏ sát tường trước, cạnh cửa ra vào. Mặt quầy có máy tính tiền,
 * điện thoại bàn đỏ (reo khi khách gọi: rung + bong bóng ☎️), xiên hoá đơn, sổ ghi đơn; túi giấy đóng gói chờ shipper
 * xếp trên mặt quầy + dưới đất cạnh quầy (hiện theo số đơn đã đóng gói). Bảng "🛵 GIAO TẬN NƠI" ở mặt quầy quay ra cửa.
 * Gốc ở giữa chân quầy, mặt quầy (phía bồi bàn đứng) nhìn về +z.
 */
export interface CashierView {
  g: THREE.Group;
  /** t: giây thực; ringing: có cuộc gọi chờ nhận; bags: số đơn đã đóng gói đang chờ shipper. */
  update(t: number, ringing: boolean, bags: number): void;
}

/** Túi giấy kraft có quai + nhãn đỏ (gốc ở đáy túi). */
function paperBag(parent: THREE.Object3D, x: number, z: number, s = 1): THREE.Group {
  const g = group(parent, { p: [x, 0, z], s });
  mesh(g, G.box(0.26, 0.3, 0.16), 0xc99a62, { p: [0, 0.15, 0] });
  mesh(g, G.box(0.27, 0.04, 0.17), 0xb5854f, { p: [0, 0.29, 0], cast: false }); // miệng túi gấp
  mesh(g, G.torus(0.06, 0.008, 4, 10, Math.PI), 0x8a5a35, { p: [0, 0.31, 0], cast: false }); // quai
  mesh(g, G.box(0.12, 0.08, 0.005), 0xd9433a, { p: [0, 0.16, 0.082], cast: false }); // nhãn quán
  return g;
}

/**
 * sign: bảng "🛵 GIAO TẬN NƠI" gắn ở mặt nào cho camera (nhìn từ phía trước quán) thấy: 'back' = mặt sau quầy (−z),
 * 'front' = mặt quầy (+z, quầy quay ra khu ăn - quán ốc), 'end' = đầu quầy +x (quầy dọc, xoay −90°).
 */
export function makeCashierCounter(sign: 'back' | 'front' | 'end' = 'back'): CashierView {
  const g = group(null);
  const W = 1.8;
  const H = 1.0;
  const D = 0.62;
  const wood = 0xb07a45;
  // Thân quầy: gỗ, mặt đá sáng, chỉ viền, chân đế sẫm
  mesh(g, G.box(W, H - 0.06, D), wood, { p: [0, (H - 0.06) / 2, 0] });
  mesh(g, G.box(W + 0.08, 0.06, D + 0.08), 0xf1ece2, { p: [0, H - 0.03, 0.02] });
  mesh(g, G.box(W + 0.02, 0.08, D + 0.02), 0x6b4428, { p: [0, 0.04, 0], cast: false });
  for (const sx of [-1, 1]) mesh(g, G.box(0.04, H - 0.14, 0.02), 0x8a5a35, { p: [sx * (W / 2 - 0.25), H / 2 - 0.02, D / 2 + 0.005], cast: false });
  // Bảng "🛵 GIAO TẬN NƠI" ở mặt quầy quay ra cửa / ra đường (−z) - camera nhìn từ phía trước quán thấy mặt này
  const end = sign === 'end';
  const pw = end ? 0.56 : 1.3;
  const plate = group(g, sign === 'end' ? { p: [W / 2 + 0.012, 0.55, 0], r: [0, Math.PI / 2, 0] } : sign === 'front' ? { p: [0, 0.55, D / 2 + 0.012] } : { p: [0, 0.55, -D / 2 - 0.012], r: [0, Math.PI, 0] });
  mesh(plate, G.box(pw, end ? 0.46 : 0.34, 0.015), 0x2f9e5a);
  const t = signText(end ? 'GIAO TẬN NƠI' : '🛵 GIAO TẬN NƠI', '#ffffff', pw - 0.08, end ? 0.36 : 0.26);
  t.position.z = 0.01;
  plate.add(t);
  // Máy tính tiền: thân, màn hình nghiêng (quay về phía bồi bàn), bàn phím
  const reg = group(g, { p: [0.5, H, 0.05] });
  mesh(reg, G.box(0.42, 0.12, 0.34), 0x3b3f46, { p: [0, 0.06, 0] });
  mesh(reg, G.box(0.36, 0.03, 0.2), 0x5a606b, { p: [0, 0.13, 0.04], r: [-0.2, 0, 0], cast: false });
  const screen = group(reg, { p: [0, 0.26, -0.1], r: [0.35, 0, 0] });
  mesh(screen, G.box(0.3, 0.2, 0.03), 0x23262b);
  mesh(screen, G.box(0.26, 0.15, 0.005), new THREE.MeshBasicMaterial({ color: 0x7fe0c0 }), { p: [0, 0, 0.017], cast: false });
  mesh(reg, G.box(0.05, 0.14, 0.05), 0x23262b, { p: [0, 0.18, -0.12], cast: false });
  // Điện thoại bàn đỏ: đế + ống nghe (rung khi reo)
  const phone = group(g, { p: [-0.05, H, 0.1] });
  mesh(phone, G.box(0.24, 0.08, 0.2), 0xd9433a, { p: [0, 0.04, 0] });
  mesh(phone, G.box(0.14, 0.01, 0.1), 0xf3f3f3, { p: [0, 0.085, 0.03], cast: false });
  const handset = group(phone, { p: [0, 0.11, -0.04] });
  mesh(handset, G.box(0.26, 0.04, 0.06), 0xc2382f);
  for (const sx of [-1, 1]) mesh(handset, G.box(0.06, 0.05, 0.08), 0xc2382f, { p: [sx * 0.11, -0.02, 0], cast: false });
  mesh(phone, G.torus(0.05, 0.008, 4, 10), 0x2a2d35, { p: [0.14, 0.03, 0.05], r: [0, 0, Math.PI / 2], cast: false });
  // Xiên hoá đơn + sổ ghi đơn
  mesh(g, G.cyl(0.04, 0.05, 0.02, 10), 0x3b3f46, { p: [0.2, H + 0.01, -0.18], cast: false });
  mesh(g, G.cyl(0.004, 0.004, 0.16, 4), 0xdfe5ea, { p: [0.2, H + 0.09, -0.18], cast: false });
  for (let k = 0; k < 3; k++) mesh(g, G.box(0.09, 0.005, 0.12), 0xfffaf1, { p: [0.2, H + 0.04 + k * 0.03, -0.18], r: [0, k * 0.5, 0.1], cast: false });
  mesh(g, G.box(0.2, 0.02, 0.26), 0x2f6fb0, { p: [-0.3, H + 0.01, -0.12], r: [0, 0.2, 0], cast: false });
  // Túi giấy đã đóng gói chờ shipper: 2 túi trên mặt quầy (đầu trái), thêm 2 túi dưới đất cạnh quầy
  const bags: THREE.Group[] = [];
  for (const [x, y, z] of [[-0.72, H, -0.05], [-0.48, H, -0.12], [-W / 2 - 0.25, 0, -0.1], [-W / 2 - 0.25, 0, 0.22]] as const) {
    const b = paperBag(g, x, z, 0.95);
    b.position.y = y;
    b.visible = false;
    bags.push(b);
  }
  // Bong bóng ☎️ khi điện thoại reo
  const bell = emojiSprite('☎️', 0.55);
  bell.position.set(-0.05, H + 0.6, 0.1);
  bell.visible = false;
  g.add(bell);
  return {
    g,
    update(time, ringing, n) {
      // Reo: ống nghe rung từng hồi, bong bóng nhún
      const on = ringing && Math.sin(time * 5) > -0.2;
      handset.rotation.z = on ? Math.sin(time * 48) * 0.12 : 0;
      handset.position.y = 0.11 + (on ? Math.abs(Math.sin(time * 48)) * 0.02 : 0);
      bell.visible = ringing;
      if (ringing) {
        bell.position.y = H + 0.6 + Math.abs(Math.sin(time * 4)) * 0.12;
        bell.material.rotation = Math.sin(time * 20) * 0.25;
      }
      bags.forEach((b, i) => (b.visible = i < n));
    },
  };
}
