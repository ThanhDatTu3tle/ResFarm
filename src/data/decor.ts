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
  { id: 'floor_wood', name: 'Sàn gỗ thông', icon: '🪵', slot: 'floor', cost: 0, level: 1, isDefault: true, cuisine: 'vn', colors: { a: 0xc98b4f, b: 0xd9a066 } },
  { id: 'floor_tatami', name: 'Chiếu tatami', icon: '🟩', slot: 'floor', cost: 0, level: 1, isDefault: true, cuisine: 'jp', colors: { a: 0xd9cf8f, b: 0xc7bd7a } },
  { id: 'floor_concrete', name: 'Sàn xi măng mài', icon: '⬛', slot: 'floor', cost: 0, level: 1, isDefault: true, cuisine: 'kr', colors: { a: 0xb7b9bd, b: 0xa6a9ae } },
  { id: 'floor_hinoki', name: 'Sàn gỗ hinoki', icon: '🪵', slot: 'floor', cost: 450, level: 3, cuisine: 'jp', colors: { a: 0xe8cf9c, b: 0xdcc08a }, modifiers: { patience: 1.05 } },
  { id: 'floor_encaustic', name: 'Gạch bông', icon: '🌸', slot: 'floor', cost: 450, level: 3, cuisine: 'vn', colors: { a: 0xf1e4cf, b: 0x3f8f8a }, modifiers: { patience: 1.05 } },
  { id: 'floor_checker', name: 'Gạch caro đen trắng', icon: '🏁', slot: 'floor', cost: 450, level: 3, cuisine: 'kr', colors: { a: 0xf4f4f4, b: 0x3a3a40 }, modifiers: { patience: 1.05 } },
  { id: 'floor_tile', name: 'Gạch men sọc đỏ', icon: '🟥', slot: 'floor', cost: 300, level: 2, colors: { a: 0xf3ead8, b: 0xd96f4a } },
  { id: 'floor_walnut', name: 'Sàn gỗ óc chó', icon: '🟫', slot: 'floor', cost: 500, level: 3, colors: { a: 0x7a4f33, b: 0x8c5e3f } },
  { id: 'floor_marble', name: 'Đá cẩm thạch', icon: '⬜', slot: 'floor', cost: 900, level: 4, colors: { a: 0xe9eef2, b: 0xcfd8dc }, modifiers: { dishPrice: 1.05 } },

  // Sơn tường
  { id: 'wall_cream', name: 'Sơn kem', icon: '🎨', slot: 'wall', cost: 0, level: 1, isDefault: true, cuisine: 'vn', colors: { wall: 0xf8e3bd, trim: 0xb9733f } },
  { id: 'wall_shoji', name: 'Vách giấy shoji', icon: '🎨', slot: 'wall', cost: 0, level: 1, isDefault: true, cuisine: 'jp', colors: { wall: 0xf6f1e4, trim: 0x5a3a26 } },
  { id: 'wall_kr_orange', name: 'Sơn cam gạch', icon: '🎨', slot: 'wall', cost: 0, level: 1, isDefault: true, cuisine: 'kr', colors: { wall: 0xf3c9a4, trim: 0x4a4f5a } },
  { id: 'wall_hoian', name: 'Vàng Hội An', icon: '🏮', slot: 'wall', cost: 300, level: 2, cuisine: 'vn', colors: { wall: 0xf5cf5b, trim: 0x2f6f5a } },
  { id: 'wall_mint', name: 'Sơn xanh bạc hà', icon: '🎨', slot: 'wall', cost: 200, level: 2, colors: { wall: 0xcfead6, trim: 0x5f9e7a } },
  { id: 'wall_sky', name: 'Sơn xanh da trời', icon: '🎨', slot: 'wall', cost: 200, level: 2, colors: { wall: 0xcfe3f5, trim: 0x4f7fb0 } },
  { id: 'wall_rose', name: 'Sơn hồng phấn', icon: '🎨', slot: 'wall', cost: 350, level: 3, colors: { wall: 0xf7d3d3, trim: 0xb5553c } },
  { id: 'wall_brick', name: 'Tường gạch mộc', icon: '🧱', slot: 'wall', cost: 600, level: 4, colors: { wall: 0xd98b6a, trim: 0x7a4a3a }, modifiers: { tip: 1.1 } },

  // Bàn ghế
  { id: 'furn_basic', name: 'Bàn gỗ, ghế nhựa đỏ', icon: '🪑', slot: 'furniture', cost: 0, level: 1, isDefault: true, cuisine: 'vn', colors: { top: 0xe0a868, base: 0x8a5a35, seat: 0xd93a32, back: 0xd93a32 } },
  { id: 'furn_jp', name: 'Bàn gỗ tối, nệm zabuton', icon: '🪑', slot: 'furniture', cost: 0, level: 1, isDefault: true, cuisine: 'jp', colors: { top: 0x6b4a2f, base: 0x3b2a1e, seat: 0x3f5fa8, back: 0x6b4a2f } },
  { id: 'furn_kr', name: 'Bàn nướng inox', icon: '🪑', slot: 'furniture', cost: 0, level: 1, isDefault: true, cuisine: 'kr', colors: { top: 0x8a8f99, base: 0x4a4f5a, seat: 0xc9ced6, back: 0xc9ced6 } },
  { id: 'furn_white', name: 'Bàn ghế sơn trắng', icon: '🪑', slot: 'furniture', cost: 450, level: 2, colors: { top: 0xffffff, base: 0xd9d2c5, seat: 0x6fb7c9, back: 0xffffff }, modifiers: { patience: 1.05 } },
  { id: 'furn_oak', name: 'Gỗ sồi đệm xanh', icon: '🪑', slot: 'furniture', cost: 800, level: 3, colors: { top: 0xc98b4f, base: 0x5a3a22, seat: 0x3f8f6a, back: 0x5a3a22 }, modifiers: { patience: 1.1 } },
  { id: 'furn_luxury', name: 'Bộ sang trọng', icon: '👑', slot: 'furniture', cost: 1500, level: 5, colors: { top: 0x3b2a2a, base: 0x1f1a17, seat: 0xc8483a, back: 0xd4af37 }, modifiers: { patience: 1.15, tip: 1.15 } },
];
