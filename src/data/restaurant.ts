import type { RoomDef, StaffDef, TableDef, UpgradeDef } from './types';

/**
 * Mặt bằng quán theo toạ độ 2D (gốc ở góc trên-trái, y tăng về phía cửa ra vào).
 * Quán khởi đầu nhỏ để còn chỗ nâng cấp: muốn nới rộng thì tăng width/height và vùng dining.
 */
export const room: RoomDef = {
  width: 540,
  height: 480,
  kitchenDepth: 100,
  dining: { x1: 15, y1: 200, x2: 525, y2: 465 },
  // Bếp gọn ở phía phải tường sau; phía trái là lối đi vào WC và kho hàng (chỉ là cảnh, xem areas/restaurant.ts).
  // Quầy ra món ở góc phải, giữa bếp và khu ăn; bồi bàn đứng chờ ngay trước quầy
  pass: { x: 470, y: 135 },
  waiterHome: { x: 470, y: 185 },
  // Hạng quán (C3): phòng ăn sâu thêm về phía cửa; bếp, quầy ra món giữ nguyên chỗ
  // Mỗi bậc lên hạng thêm 1 chỗ thuê nhân viên phục vụ (tối đa 4 người ở hạng 5)
  tiers: [
    { id: 1, name: 'Quán nhỏ', icon: '🏠', height: 480, cost: 0, level: 1, desc: 'Quán khởi nghiệp gọn gàng.' },
    { id: 2, name: 'Tiệm ăn', icon: '🏡', height: 570, cost: 1500, level: 3, desc: 'Phòng ăn rộng thêm, khách tới đông hơn 10%, thuê được 1 nhân viên.', modifiers: { spawnRate: 1.1 } },
    { id: 3, name: 'Quán đông khách', icon: '🏘️', height: 660, cost: 3000, level: 4, desc: 'Rộng thêm nữa, khách đông hơn 20%, thuê được 2 nhân viên.', modifiers: { spawnRate: 1.2 } },
    { id: 4, name: 'Nhà hàng', icon: '🏯', height: 750, cost: 5000, level: 6, desc: 'Khách đông hơn 30%, giá món +5%, thuê được 3 nhân viên.', modifiers: { spawnRate: 1.3, dishPrice: 1.05 } },
    { id: 5, name: 'Nhà hàng nổi tiếng', icon: '🏰', height: 840, cost: 8000, level: 8, desc: 'Khách đông hơn 40%, giá món +10%, thuê được 4 nhân viên.', modifiers: { spawnRate: 1.4, dishPrice: 1.1 } },
  ],
};

/** x, y là vị trí MẶC ĐỊNH của tâm bàn; người chơi dời bàn thì vị trí mới nằm ở state.restaurant.layout. */
export const tables: TableDef[] = [
  // Dãy 3 ghế đơn ngay trước bếp cho khách đi một mình — gắn với bếp nên không dời được
  { id: 'counter', name: 'Quầy trước bếp', seats: 3, shared: true, fixed: true, x: 285, y: 140, w: 210, h: 34 },
  { id: 'medium', name: 'Bàn bốn', seats: 4, x: 125, y: 300, w: 120, h: 76 },
  { id: 'pair', name: 'Bàn đôi', seats: 2, x: 430, y: 290, w: 70, h: 70 },
  { id: 'pair2', name: 'Bàn đôi góc', seats: 2, x: 120, y: 420, w: 70, h: 70 },
];

export const staff: StaffDef[] = [
  { id: 'head_chef', name: 'Bếp trưởng', icon: '👨‍🍳', role: 'chef', speed: 1.6 },
  { id: 'sous_chef', name: 'Bếp phó', icon: '👩‍🍳', role: 'chef', speed: 1.6 }, // nấu nhanh bằng bếp trưởng
  // Đầu bếp thuê thêm khi nâng hạng bếp (chậm hơn một chút)
  { id: 'line_cook_a', name: 'Bếp phụ An', icon: '🧑‍🍳', role: 'chef', speed: 1.35, hire: true },
  { id: 'line_cook_b', name: 'Bếp phụ Bình', icon: '🧑‍🍳', role: 'chef', speed: 1.35, hire: true },
];

/** Trang thiết bị — mua một lần, có hiệu lực mãi. (Sàn, tường, bàn ghế nằm ở decor.ts.) */
export const upgrades: UpgradeDef[] = [
  { id: 'decor', name: 'Cây cảnh & tranh treo', icon: '🪴', desc: 'Khách kiên nhẫn hơn 20%.', cost: 250, level: 2, modifiers: { patience: 1.2 } },
  { id: 'knives', name: 'Bộ dao bếp xịn', icon: '🔪', desc: 'Nấu nhanh hơn 15%.', cost: 300, level: 2, modifiers: { cookSpeed: 1.15 } },
  { id: 'irrigation', name: 'Hệ thống tưới', icon: '🚿', desc: 'Nông trại lớn nhanh hơn 25%.', cost: 450, level: 2, modifiers: { growSpeed: 1.25 } },
  { id: 'music', name: 'Dàn loa nhạc nhẹ', icon: '🎶', desc: 'Tiền tip tăng 50%.', cost: 400, level: 3, modifiers: { tip: 1.5 } },
  { id: 'sign', name: 'Biển hiệu đèn LED', icon: '💡', desc: 'Khách tới đông hơn 25%.', cost: 500, level: 3, modifiers: { spawnRate: 1.25 } },
  { id: 'stove', name: 'Bếp công nghiệp', icon: '🔥', desc: 'Nấu nhanh hơn 25% nữa.', cost: 900, level: 4, requires: 'knives', modifiers: { cookSpeed: 1.25 } },
  { id: 'porcelain', name: 'Bộ bát đĩa sứ', icon: '🍽️', desc: 'Giá bán mọi món tăng 10%.', cost: 1200, level: 5, modifiers: { dishPrice: 1.1 } },
];
