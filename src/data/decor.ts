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
  { id: 'floor_concrete', name: 'Sàn xi măng mài', icon: '⬛', slot: 'floor', cost: 0, level: 1, isDefault: true, cuisine: 'kr', colors: { a: 0xb7b9bd, b: 0xa6a9ae } },
  { id: 'floor_hinoki', name: 'Sàn gỗ hinoki', icon: '🪵', slot: 'floor', cost: 450, level: 3, cuisine: 'jp', colors: { a: 0xe8cf9c, b: 0xdcc08a }, modifiers: { patience: 1.05 } },
  { id: 'floor_encaustic', name: 'Gạch bông xanh ngọc', icon: '🌸', slot: 'floor', cost: 450, level: 3, cuisines: ['vn', 'oc'], pattern: 'encaustic', colors: { a: 0x5f9a6a, b: 0x2a5a3c }, modifiers: { patience: 1.05 } },
  { id: 'floor_checker', name: 'Gạch caro đen trắng', icon: '🏁', slot: 'floor', cost: 450, level: 3, cuisine: 'kr', colors: { a: 0xf4f4f4, b: 0x3a3a40 }, modifiers: { patience: 1.05 } },
  // Quán Ốc ngoài trời: nền bê tông, nâng cấp là gạch hoa lề đường (ô vuông xen hai màu)
  { id: 'floor_street', name: 'Nền bê tông vỉa hè', icon: '⬛', slot: 'floor', cost: 0, level: 1, isDefault: true, cuisine: 'oc', colors: { a: 0xaeaca6, b: 0xa29f99 } },
  // Quán Ốc dùng chung nền gạch với quán Việt (giai đoạn 20): 2 nền lề đường riêng ngừng bán (save cũ được trả tiền)
  { id: 'floor_gach_do', name: 'Gạch lề đường đỏ', icon: '🟥', slot: 'floor', cost: 300, level: 2, cuisine: 'oc', exclude: ['oc'], colors: { a: 0xc95f4c, b: 0xe2b8a0 }, modifiers: { patience: 1.03 } },
  { id: 'floor_gach_hoa', name: 'Gạch hoa lề đường', icon: '🌼', slot: 'floor', cost: 500, level: 3, cuisine: 'oc', exclude: ['oc'], colors: { a: 0xe9e1cf, b: 0x5f9a8f }, modifiers: { patience: 1.05 } },
  { id: 'floor_tile', name: 'Gạch men sọc đỏ', icon: '🟥', slot: 'floor', cost: 300, level: 2, exclude: ['vn', 'oc'], colors: { a: 0xf3ead8, b: 0xd96f4a } },
  // Quán Việt + quán ốc (đặc trưng Việt Nam): gạch men ngọc đỏ, gạch xưa đất nung
  { id: 'floor_ngocdo', name: 'Gạch men ngọc đỏ', icon: '🟥', slot: 'floor', cost: 450, level: 3, cuisines: ['vn', 'oc'], pattern: 'ngocdo', colors: { a: 0x8e3a30, b: 0x2f6b4f }, modifiers: { patience: 1.05 } },
  { id: 'floor_gachxua', name: 'Sàn gạch xưa', icon: '🧱', slot: 'floor', cost: 650, level: 4, cuisines: ['vn', 'oc'], pattern: 'terracotta', colors: { a: 0xc2643a, b: 0xa9502e }, modifiers: { patience: 1.07 } },
  { id: 'floor_walnut', name: 'Sàn gỗ óc chó', icon: '🟫', slot: 'floor', cost: 500, level: 3, exclude: ['vn', 'oc'], colors: { a: 0x7a4f33, b: 0x8c5e3f } },
  { id: 'floor_marble', name: 'Đá cẩm thạch', icon: '⬜', slot: 'floor', cost: 900, level: 4, exclude: ['vn', 'oc'], colors: { a: 0xe9eef2, b: 0xcfd8dc }, modifiers: { dishPrice: 1.05 } },

  // Sơn tường
  // Quán Việt: tường vàng cam, chân tường gỗ (khung cửa sổ xanh lá vẽ riêng — id giữ 'wall_cream' cho save cũ)
  { id: 'wall_cream', name: 'Sơn vàng cam', icon: '🎨', slot: 'wall', cost: 0, level: 1, isDefault: true, cuisine: 'vn', colors: { wall: 0xe8ad45, trim: 0xb9733f } },
  { id: 'wall_shoji', name: 'Vách giấy shoji', icon: '🎨', slot: 'wall', cost: 0, level: 1, isDefault: true, cuisine: 'jp', colors: { wall: 0xf6f1e4, trim: 0x5a3a26 } },
  { id: 'wall_kr_orange', name: 'Sơn cam gạch', icon: '🎨', slot: 'wall', cost: 0, level: 1, isDefault: true, cuisine: 'kr', colors: { wall: 0xf3c9a4, trim: 0x4a4f5a } },
  // Quán Ốc không có tường: "sơn tường" = màu sạp dù che bếp (wall = sọc chính, trim = sọc phụ)
  { id: 'wall_oc_tent', name: 'Dù sọc đỏ trắng', icon: '⛱️', slot: 'wall', cost: 0, level: 1, isDefault: true, cuisine: 'oc', colors: { wall: 0xe2473c, trim: 0xfaf3e6 } },
  { id: 'wall_oc_blue', name: 'Dù sọc xanh trắng', icon: '⛱️', slot: 'wall', cost: 200, level: 2, cuisine: 'oc', colors: { wall: 0x3f7fd2, trim: 0xfaf3e6 } },
  { id: 'wall_hoian', name: 'Vàng Hội An', icon: '🏮', slot: 'wall', cost: 300, level: 2, cuisine: 'vn', colors: { wall: 0xf5cf5b, trim: 0x2f6f5a } },
  { id: 'wall_mint', name: 'Sơn xanh bạc hà', icon: '🎨', slot: 'wall', cost: 200, level: 2, exclude: ['oc'], colors: { wall: 0xcfead6, trim: 0x5f9e7a } },
  { id: 'wall_sky', name: 'Sơn xanh da trời', icon: '🎨', slot: 'wall', cost: 200, level: 2, exclude: ['oc'], colors: { wall: 0xcfe3f5, trim: 0x4f7fb0 } },
  { id: 'wall_rose', name: 'Sơn hồng phấn', icon: '🎨', slot: 'wall', cost: 350, level: 3, exclude: ['oc'], colors: { wall: 0xf7d3d3, trim: 0xb5553c } },
  { id: 'wall_brick', name: 'Tường gạch mộc', icon: '🧱', slot: 'wall', cost: 600, level: 4, exclude: ['oc'], colors: { wall: 0xd98b6a, trim: 0x7a4a3a }, modifiers: { tip: 1.1 } },

  // Bàn ghế
  { id: 'furn_basic', name: 'Bàn ghế gỗ mộc', icon: '🪑', slot: 'furniture', cost: 0, level: 1, isDefault: true, cuisine: 'vn', colors: { top: 0x8e5634, base: 0x5e3520, seat: 0x8e5634, back: 0x5e3520 } },
  { id: 'furn_jp', name: 'Bàn ghế gỗ sồi, đệm xám xanh', icon: '🪑', slot: 'furniture', cost: 0, level: 1, isDefault: true, cuisine: 'jp', colors: { top: 0xe2bd86, base: 0xd2a46a, seat: 0x5d6e84, back: 0xd2a46a } },
  { id: 'furn_kr', name: 'Bàn nướng gỗ xám, ghế da bò', icon: '🪑', slot: 'furniture', cost: 0, level: 1, isDefault: true, cuisine: 'kr', colors: { top: 0xd3cec6, base: 0x2e3137, seat: 0xb5703a, back: 0xb5703a } },
  { id: 'furn_oc', name: 'Bàn ghế nhựa xanh đỏ', icon: '🪑', slot: 'furniture', cost: 0, level: 1, isDefault: true, cuisine: 'oc', colors: { top: 0x3f8fd2, base: 0x2f6fb0, seat: 0xd93a32, back: 0x3f8fd2 } },
  { id: 'furn_white', name: 'Bàn ghế sơn trắng', icon: '🪑', slot: 'furniture', cost: 450, level: 2, colors: { top: 0xe8dcc2, base: 0xcbbfa6, seat: 0x6fb7c9, back: 0xe8dcc2 }, modifiers: { patience: 1.05 } },
  { id: 'furn_oak', name: 'Gỗ sồi đệm xanh', icon: '🪑', slot: 'furniture', cost: 800, level: 3, exclude: ['vn', 'oc'], colors: { top: 0xc98b4f, base: 0x5a3a22, seat: 0x3f8f6a, back: 0x5a3a22 }, modifiers: { patience: 1.1 } },
  { id: 'furn_luxury', name: 'Bộ sang trọng', icon: '👑', slot: 'furniture', cost: 1500, level: 5, exclude: ['vn', 'oc'], colors: { top: 0x3b2a2a, base: 0x1f1a17, seat: 0xc8483a, back: 0xd4af37 }, modifiers: { patience: 1.15, tip: 1.15 } },
  // Quán Việt: bàn ghế có model riêng (furniturevn.ts) — gỗ chân tiện vàng cam, bộ gỗ sẫm ghế bành mây
  { id: 'furn_oak_vn', name: 'Bàn ghế gỗ sồi xịn', icon: '🪑', slot: 'furniture', cost: 800, level: 3, cuisine: 'vn', style: 'oak_vn', colors: { top: 0xd08a42, base: 0xb8742f, seat: 0xd08a42, back: 0xb8742f }, modifiers: { patience: 1.1 } },
  // Quán Ốc (quán nhậu lề đường): bàn 4 / bàn 6 ghép từ bàn đôi. Bàn inox và bàn tre cùng bậc, cùng giá, cùng chỉ số
  { id: 'furn_inox_oc', name: 'Bàn inox, ghế nhựa lưng nan', icon: '🪑', slot: 'furniture', cost: 800, level: 3, cuisine: 'oc', style: 'inox_oc', colors: { top: 0xcdd3db, base: 0xaeb5be, seat: 0x8e2f2a, back: 0x8e2f2a }, modifiers: { patience: 1.1 } },
  { id: 'furn_bamboo_oc', name: 'Bàn tre, ghế đẩu tre', icon: '🎋', slot: 'furniture', cost: 800, level: 3, cuisine: 'oc', style: 'bamboo_oc', colors: { top: 0xecd39e, base: 0xe2c48a, seat: 0xecd39e, back: 0xe2c48a }, modifiers: { patience: 1.1 } },
  { id: 'furn_wood_oc', name: 'Bộ sang trọng', icon: '👑', slot: 'furniture', cost: 1500, level: 5, cuisine: 'oc', style: 'wood_oc', colors: { top: 0x7d6743, base: 0x634f30, seat: 0x7d6743, back: 0x634f30 }, modifiers: { patience: 1.15, tip: 1.15 } },
  { id: 'furn_luxury_vn', name: 'Bộ sang trọng', icon: '👑', slot: 'furniture', cost: 1500, level: 5, cuisine: 'vn', style: 'luxury_vn', colors: { top: 0x4a2c1c, base: 0x3a2216, seat: 0xc9a66b, back: 0x3a2216 }, modifiers: { patience: 1.15, tip: 1.15 } },
];
