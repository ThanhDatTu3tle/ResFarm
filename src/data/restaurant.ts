import type { RoomDef, StaffDef, TableDef, UpgradeDef } from './types';

/**
 * Mặt bằng quán theo toạ độ 2D (gốc ở góc trên-trái, y tăng về phía cửa ra vào).
 * Quán khởi đầu nhỏ để còn chỗ nâng cấp: muốn nới rộng thì tăng width/height và vùng dining.
 */
export const room: RoomDef = {
  width: 640,
  height: 540,
  kitchenDepth: 100,
  dining: { x1: 15, y1: 200, x2: 625, y2: 525 },
  // Bếp gọn ở phía phải tường sau; phía trái là lối đi vào WC và kho hàng (chỉ là cảnh, xem areas/restaurant.ts).
  // Quầy ra món ở góc phải, giữa bếp và khu ăn; bồi bàn đứng chờ ngay trước quầy
  pass: { x: 545, y: 135 },
  waiterHome: { x: 545, y: 185 },
};

/** x, y là vị trí MẶC ĐỊNH của tâm bàn; người chơi dời bàn thì vị trí mới nằm ở state.restaurant.layout. */
export const tables: TableDef[] = [
  // Dãy bàn dài 4 ghế đơn ngay trước bếp cho khách đi một mình — gắn với bếp nên không dời được
  { id: 'counter', name: 'Quầy trước bếp', seats: 4, shared: true, fixed: true, x: 330, y: 140, w: 280, h: 34 },
  { id: 'big', name: 'Bàn lớn', seats: 6, x: 350, y: 320, w: 200, h: 84 },
  { id: 'medium', name: 'Bàn vừa', seats: 4, x: 120, y: 285, w: 120, h: 76 },
  { id: 'pair', name: 'Bàn đôi', seats: 2, x: 545, y: 440, w: 70, h: 70 },
  // Mở rộng về sau
  { id: 'patio', name: 'Bàn góc vườn', seats: 4, requiresUpgrade: 'patio', x: 120, y: 445, w: 120, h: 76 },
];

export const staff: StaffDef[] = [
  { id: 'head_chef', name: 'Bếp trưởng', icon: '👨‍🍳', role: 'chef', speed: 1.3 },
  { id: 'sous_chef', name: 'Bếp phó', icon: '👩‍🍳', role: 'chef', speed: 1 },
];

/** Trang thiết bị — mua một lần, có hiệu lực mãi. (Sàn, tường, bàn ghế nằm ở decor.ts.) */
export const upgrades: UpgradeDef[] = [
  { id: 'decor', name: 'Cây cảnh & tranh treo', icon: '🪴', desc: 'Khách kiên nhẫn hơn 20%.', cost: 250, level: 2, modifiers: { patience: 1.2 } },
  { id: 'knives', name: 'Bộ dao bếp xịn', icon: '🔪', desc: 'Nấu nhanh hơn 15%.', cost: 300, level: 2, modifiers: { cookSpeed: 1.15 } },
  { id: 'irrigation', name: 'Hệ thống tưới', icon: '🚿', desc: 'Nông trại lớn nhanh hơn 25%.', cost: 450, level: 2, modifiers: { growSpeed: 1.25 } },
  { id: 'music', name: 'Dàn loa nhạc nhẹ', icon: '🎶', desc: 'Tiền tip tăng 50%.', cost: 400, level: 3, modifiers: { tip: 1.5 } },
  { id: 'sign', name: 'Biển hiệu đèn LED', icon: '💡', desc: 'Khách tới đông hơn 25%.', cost: 500, level: 3, modifiers: { spawnRate: 1.25 } },
  { id: 'patio', name: 'Thêm bàn góc vườn', icon: '⛱️', desc: 'Thêm 1 bàn 4 người.', cost: 800, level: 3 },
  { id: 'stove', name: 'Bếp công nghiệp', icon: '🔥', desc: 'Nấu nhanh hơn 25% nữa.', cost: 900, level: 4, requires: 'knives', modifiers: { cookSpeed: 1.25 } },
  { id: 'porcelain', name: 'Bộ bát đĩa sứ', icon: '🍽️', desc: 'Giá bán mọi món tăng 10%.', cost: 1200, level: 5, modifiers: { dishPrice: 1.1 } },
];
