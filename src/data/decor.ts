import type { DecorDef, DecorSlot } from './types';

export const decorSlotNames: Record<DecorSlot, string> = {
  floor: 'Sàn nhà',
  wall: 'Sơn tường',
  furniture: 'Bàn ghế',
};

/**
 * Nội thất bán ở Siêu thị. Mỗi vị trí (slot) dùng 1 món tại một thời điểm; mua rồi thì đổi qua lại miễn phí.
 * Thêm món mới: thêm 1 mục ở đây — cảnh quán tự đổi màu theo `colors`:
 *   floor:     a, b              (hai tông ván sàn xen kẽ)
 *   wall:      wall, trim        (mảng tường, chân tường/khung)
 *   furniture: top, base, seat, back
 */
export const decor: DecorDef[] = [
  // Sàn nhà
  // Quán Việt lát sẵn gạch bông vàng (id giữ 'floor_wood' cho save cũ)
  { id: 'floor_wood', name: 'Gạch bông vàng', icon: '🌼', slot: 'floor', cost: 0, level: 1, isDefault: true, cuisine: 'vn', pattern: 'encaustic', colors: { a: 0xd9a23b, b: 0x8e2f25 } },
  { id: 'floor_tatami', name: 'Chiếu tatami', icon: '🟩', slot: 'floor', cost: 0, level: 1, isDefault: true, cuisine: 'jp', colors: { a: 0xd9cf8f, b: 0xc7bd7a } },
  { id: 'floor_concrete', name: 'Sàn xi măng mài', icon: '⬛', slot: 'floor', cost: 0, level: 1, isDefault: true, cuisine: 'kr', pattern: 'concrete', colors: { a: 0x7e8183, b: 0x7e8183 } },
  { id: 'floor_hinoki', name: 'Sàn gỗ hinoki', icon: '🪵', slot: 'floor', cost: 450, level: 3, cuisine: 'jp', colors: { a: 0xe8cf9c, b: 0xdcc08a }, modifiers: { patience: 1.05 } },
  { id: 'floor_encaustic', name: 'Gạch bông xanh ngọc', icon: '🌸', slot: 'floor', cost: 450, level: 3, cuisines: ['vn', 'oc'], pattern: 'encaustic', colors: { a: 0x5f9a6a, b: 0x2a5a3c }, modifiers: { patience: 1.05 } },
  { id: 'floor_checker', name: 'Gạch caro đen trắng', icon: '🏁', slot: 'floor', cost: 450, level: 3, cuisine: 'kr', pattern: 'checker', colors: { a: 0xf4f4f4, b: 0x2e2e33 }, modifiers: { patience: 1.05 } },
  // Quán Ốc ngoài trời: nền bê tông, nâng cấp là gạch hoa lề đường (ô vuông xen hai màu)
  { id: 'floor_street', name: 'Nền bê tông vỉa hè', icon: '⬛', slot: 'floor', cost: 0, level: 1, isDefault: true, cuisine: 'oc', colors: { a: 0xaeaca6, b: 0xa29f99 } },
  // Quán Ốc dùng chung nền gạch với quán Việt (giai đoạn 20): 2 nền lề đường riêng ngừng bán (save cũ được trả tiền)
  { id: 'floor_gach_do', name: 'Gạch lề đường đỏ', icon: '🟥', slot: 'floor', cost: 300, level: 2, cuisine: 'oc', exclude: ['oc'], colors: { a: 0xc95f4c, b: 0xe2b8a0 }, modifiers: { patience: 1.03 } },
  { id: 'floor_gach_hoa', name: 'Gạch hoa lề đường', icon: '🌼', slot: 'floor', cost: 500, level: 3, cuisine: 'oc', exclude: ['oc'], colors: { a: 0xe9e1cf, b: 0x5f9a8f }, modifiers: { patience: 1.05 } },
  { id: 'floor_tile', name: 'Gạch men caro đỏ', icon: '🟥', slot: 'floor', cost: 300, level: 2, exclude: ['vn', 'oc'], pattern: 'checker', colors: { a: 0xf3ead8, b: 0xc9503a } },
  // Quán Việt + quán ốc (đặc trưng Việt Nam): gạch men ngọc đỏ, gạch xưa đất nung
  { id: 'floor_ngocdo', name: 'Gạch men ngọc đỏ', icon: '🟥', slot: 'floor', cost: 450, level: 3, cuisines: ['vn', 'oc'], pattern: 'ngocdo', colors: { a: 0x8e3a30, b: 0x2f6b4f }, modifiers: { patience: 1.05 } },
  { id: 'floor_gachxua', name: 'Sàn gạch xưa', icon: '🧱', slot: 'floor', cost: 650, level: 4, cuisines: ['vn', 'oc'], pattern: 'terracotta', colors: { a: 0xc2643a, b: 0xa9502e }, modifiers: { patience: 1.07 } },
  { id: 'floor_walnut', name: 'Sàn gỗ óc chó', icon: '🟫', slot: 'floor', cost: 500, level: 3, exclude: ['vn', 'oc'], pattern: 'planks', colors: { a: 0xb07a45, b: 0x7a4d2a } },
  { id: 'floor_marble', name: 'Đá cẩm thạch', icon: '⬜', slot: 'floor', cost: 900, level: 4, exclude: ['vn', 'oc'], colors: { a: 0xe9eef2, b: 0xcfd8dc }, modifiers: { dishPrice: 1.05 } },

  // Sơn tường
  // Quán Việt: tường vàng cam, chân tường gỗ (khung cửa sổ xanh lá vẽ riêng — id giữ 'wall_cream' cho save cũ)
  { id: 'wall_cream', name: 'Sơn vàng cam', icon: '🎨', slot: 'wall', cost: 0, level: 1, isDefault: true, cuisine: 'vn', colors: { wall: 0xe8ad45, trim: 0xb9733f } },
  { id: 'wall_shoji', name: 'Vách giấy shoji', icon: '🎨', slot: 'wall', cost: 0, level: 1, isDefault: true, cuisine: 'jp', colors: { wall: 0xf6f1e4, trim: 0x5a3a26 } },
  // Ngừng bán (quán Hàn đổi mặc định sang giấy hanji; save cũ được trả tiền)
  { id: 'wall_kr_orange', name: 'Sơn cam gạch', icon: '🎨', slot: 'wall', cost: 0, level: 1, cuisine: 'kr', exclude: ['kr'], colors: { wall: 0xf3c9a4, trim: 0x4a4f5a } },
  // Quán Ốc không có tường: "sơn tường" = màu sạp dù che bếp (wall = sọc chính, trim = sọc phụ)
  { id: 'wall_oc_tent', name: 'Dù sọc đỏ trắng', icon: '⛱️', slot: 'wall', cost: 0, level: 1, isDefault: true, cuisine: 'oc', colors: { wall: 0xe2473c, trim: 0xfaf3e6 } },
  { id: 'wall_oc_blue', name: 'Dù sọc xanh trắng', icon: '⛱️', slot: 'wall', cost: 200, level: 2, cuisine: 'oc', colors: { wall: 0x3f7fd2, trim: 0xfaf3e6 } },
  { id: 'wall_hoian', name: 'Vàng Hội An', icon: '🏮', slot: 'wall', cost: 300, level: 2, cuisine: 'vn', colors: { wall: 0xf5cf5b, trim: 0x2f6f5a } },
  // Quán Nhật: vách gỗ tuyết tùng → tường đất sét kiểu Kyoto → đỏ chu sa cổng torii (giai đoạn 20; màu sơn chung không bán cho Nhật / Hàn)
  { id: 'wall_sugi_jp', name: 'Vách gỗ tuyết tùng', icon: '🪵', slot: 'wall', cost: 200, level: 2, cuisine: 'jp', colors: { wall: 0xd6ad7c, trim: 0x4a3020 } },
  { id: 'wall_clay_jp', name: 'Tường đất sét Kyoto', icon: '🏯', slot: 'wall', cost: 350, level: 3, cuisine: 'jp', colors: { wall: 0xcaa476, trim: 0x3e3a36 } },
  { id: 'wall_shu_jp', name: 'Đỏ chu sa cổng torii', icon: '⛩️', slot: 'wall', cost: 600, level: 4, cuisine: 'jp', colors: { wall: 0xc9482f, trim: 0x2a2420 }, modifiers: { tip: 1.1 } },
  // Quán Hàn: giấy hanji (mặc định) → ốp gạch trắng (gạch vuông nhỏ, ron xám) → tường xi măng thô quán pocha
  { id: 'wall_hanji_kr', name: 'Giấy dán hanji', icon: '📜', slot: 'wall', cost: 0, level: 1, isDefault: true, cuisine: 'kr', colors: { wall: 0xf0e4c8, trim: 0x6b4a32 } },
  { id: 'wall_tile_kr', name: 'Ốp gạch trắng', icon: '⬜', slot: 'wall', cost: 350, level: 3, cuisine: 'kr', pattern: 'walltile', colors: { wall: 0xffffff, trim: 0x8f908c }, modifiers: { patience: 1.05 } },
  // Ngừng bán (save cũ được trả tiền)
  { id: 'wall_dancheong_kr', name: 'Xanh ngọc dancheong', icon: '🏮', slot: 'wall', cost: 350, level: 3, cuisine: 'kr', exclude: ['kr'], colors: { wall: 0x3f8f80, trim: 0xb8402e } },
  { id: 'wall_pocha_kr', name: 'Tường xi măng pocha', icon: '🧱', slot: 'wall', cost: 600, level: 4, cuisine: 'kr', colors: { wall: 0x9d958c, trim: 0x2f3237 }, modifiers: { tip: 1.1 } },
  { id: 'wall_mint', name: 'Sơn xanh bạc hà', icon: '🎨', slot: 'wall', cost: 200, level: 2, exclude: ['oc', 'jp', 'kr'], colors: { wall: 0xcfead6, trim: 0x5f9e7a } },
  { id: 'wall_sky', name: 'Sơn xanh da trời', icon: '🎨', slot: 'wall', cost: 200, level: 2, exclude: ['oc', 'jp', 'kr'], colors: { wall: 0xcfe3f5, trim: 0x4f7fb0 } },
  { id: 'wall_rose', name: 'Sơn hồng phấn', icon: '🎨', slot: 'wall', cost: 350, level: 3, exclude: ['oc', 'jp', 'kr'], colors: { wall: 0xf7d3d3, trim: 0xb5553c } },
  { id: 'wall_brick', name: 'Tường gạch mộc', icon: '🧱', slot: 'wall', cost: 600, level: 4, exclude: ['oc', 'jp', 'kr'], colors: { wall: 0xd98b6a, trim: 0x7a4a3a }, modifiers: { tip: 1.1 } },

  // Bàn ghế
  { id: 'furn_basic', name: 'Bàn ghế gỗ mộc', icon: '🪑', slot: 'furniture', cost: 0, level: 1, isDefault: true, cuisine: 'vn', colors: { top: 0x8e5634, base: 0x5e3520, seat: 0x8e5634, back: 0x5e3520 } },
  { id: 'furn_jp', name: 'Bàn ghế gỗ sồi, đệm xám xanh', icon: '🪑', slot: 'furniture', cost: 0, level: 1, isDefault: true, cuisine: 'jp', colors: { top: 0xe2bd86, base: 0xd2a46a, seat: 0x5d6e84, back: 0xd2a46a } },
  { id: 'furn_kr', name: 'Bàn nướng gỗ xám, ghế da bò', icon: '🪑', slot: 'furniture', cost: 0, level: 1, isDefault: true, cuisine: 'kr', colors: { top: 0xd3cec6, base: 0x2e3137, seat: 0xb5703a, back: 0xb5703a } },
  { id: 'furn_oc', name: 'Bàn ghế nhựa xanh đỏ', icon: '🪑', slot: 'furniture', cost: 0, level: 1, isDefault: true, cuisine: 'oc', colors: { top: 0x3f8fd2, base: 0x2f6fb0, seat: 0xd93a32, back: 0x3f8fd2 } },
  { id: 'furn_white', name: 'Bàn ghế sơn trắng', icon: '🪑', slot: 'furniture', cost: 450, level: 2, exclude: ['jp', 'kr'], colors: { top: 0xe8dcc2, base: 0xcbbfa6, seat: 0x6fb7c9, back: 0xe8dcc2 }, modifiers: { patience: 1.05 } },
  { id: 'furn_oak', name: 'Gỗ sồi đệm xanh', icon: '🪑', slot: 'furniture', cost: 800, level: 3, exclude: ['vn', 'oc', 'jp', 'kr'], colors: { top: 0xc98b4f, base: 0x5a3a22, seat: 0x3f8f6a, back: 0x5a3a22 }, modifiers: { patience: 1.1 } },
  { id: 'furn_luxury', name: 'Bộ sang trọng', icon: '👑', slot: 'furniture', cost: 1500, level: 5, exclude: ['vn', 'oc', 'jp', 'kr'], colors: { top: 0x3b2a2a, base: 0x1f1a17, seat: 0xc8483a, back: 0xd4af37 }, modifiers: { patience: 1.15, tip: 1.15 } },
  // Quán Việt: bàn ghế có model riêng (furniturevn.ts) — gỗ chân tiện vàng cam, bộ gỗ sẫm ghế bành mây
  { id: 'furn_oak_vn', name: 'Bàn ghế gỗ sồi xịn', icon: '🪑', slot: 'furniture', cost: 800, level: 3, cuisine: 'vn', style: 'oak_vn', colors: { top: 0xd08a42, base: 0xb8742f, seat: 0xd08a42, back: 0xb8742f }, modifiers: { patience: 1.1 } },
  // Quán Ốc (quán nhậu lề đường): bàn 4 / bàn 6 ghép từ bàn đôi. Bàn inox và bàn tre cùng bậc, cùng giá, cùng chỉ số
  // Quán Nhật: bàn bệt (zataku) ngồi đôn gỗ → bộ sang trọng bàn đá (quán Hàn dùng chung) (tấm gỗ cũ kê đá cuội + khối gỗ, đôn gỗ hộp)
  { id: 'furn_zataku_jp', name: 'Bàn bệt gỗ, đôn ngồi', icon: '🪑', slot: 'furniture', cost: 800, level: 3, cuisine: 'jp', style: 'zataku_jp', colors: { top: 0xd39a58, base: 0xc2884a, seat: 0xd39a58, back: 0xc2884a }, modifiers: { patience: 1.1 } },
  { id: 'furn_stone_jp', name: 'Bộ sang trọng (bàn đá)', icon: '👑', slot: 'furniture', cost: 1500, level: 5, cuisines: ['jp', 'kr'], style: 'stone_jp', colors: { top: 0x9a6a42, base: 0x7a5234, seat: 0x9a6a42, back: 0x7a5234 }, modifiers: { patience: 1.15, tip: 1.15 } },
  // Quán Hàn: bàn thùng phuy (pocha) hoặc bàn nướng gỗ sáng + ghế két bia (cùng bậc) → bộ sang trọng bàn đá (chung với quán Nhật)
  { id: 'furn_drum_kr', name: 'Bàn thùng phuy, đôn tròn', icon: '🛢️', slot: 'furniture', cost: 800, level: 3, cuisine: 'kr', style: 'drum_kr', colors: { top: 0x5f7f86, base: 0x4b666c, seat: 0xc8352e, back: 0xc8352e }, modifiers: { patience: 1.1 } },
  { id: 'furn_crate_kr', name: 'Bàn nướng gỗ sáng, ghế két bia', icon: '🍺', slot: 'furniture', cost: 800, level: 3, cuisine: 'kr', style: 'crate_kr', colors: { top: 0xd9c094, base: 0x1f2125, seat: 0xb02a26, back: 0xb02a26 }, modifiers: { patience: 1.1 } },
  // Ngừng bán: quán Hàn dùng chung bộ sang trọng bàn đá với quán Nhật (save cũ được trả tiền)
  { id: 'furn_walnut_kr', name: 'Bộ sang trọng (gỗ óc chó)', icon: '👑', slot: 'furniture', cost: 1500, level: 5, cuisine: 'kr', exclude: ['kr'], style: 'walnut_kr', colors: { top: 0x5a3d2b, base: 0x2b2420, seat: 0x7a2f2a, back: 0x7a2f2a }, modifiers: { patience: 1.15, tip: 1.15 } },
  { id: 'furn_inox_oc', name: 'Bàn inox, ghế nhựa lưng nan', icon: '🪑', slot: 'furniture', cost: 800, level: 3, cuisine: 'oc', style: 'inox_oc', colors: { top: 0xcdd3db, base: 0xaeb5be, seat: 0x8e2f2a, back: 0x8e2f2a }, modifiers: { patience: 1.1 } },
  { id: 'furn_bamboo_oc', name: 'Bàn tre, ghế đẩu tre', icon: '🎋', slot: 'furniture', cost: 800, level: 3, cuisine: 'oc', style: 'bamboo_oc', colors: { top: 0xecd39e, base: 0xe2c48a, seat: 0xecd39e, back: 0xe2c48a }, modifiers: { patience: 1.1 } },
  { id: 'furn_wood_oc', name: 'Bộ sang trọng', icon: '👑', slot: 'furniture', cost: 1500, level: 5, cuisine: 'oc', style: 'wood_oc', colors: { top: 0x7d6743, base: 0x634f30, seat: 0x7d6743, back: 0x634f30 }, modifiers: { patience: 1.15, tip: 1.15 } },
  { id: 'furn_luxury_vn', name: 'Bộ sang trọng', icon: '👑', slot: 'furniture', cost: 1500, level: 5, cuisine: 'vn', style: 'luxury_vn', colors: { top: 0x4a2c1c, base: 0x3a2216, seat: 0xc9a66b, back: 0x3a2216 }, modifiers: { patience: 1.15, tip: 1.15 } },
];
