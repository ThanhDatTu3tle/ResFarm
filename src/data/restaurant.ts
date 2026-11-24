import type { RoomDef, StaffDef, TableDef, UpgradeDef } from './types';

/**
 * Mặt bằng quán theo toạ độ 2D (gốc ở góc trên-trái, y tăng về phía cửa ra vào).
 * Quán khởi đầu nhỏ để còn chỗ nâng cấp: muốn nới rộng thì tăng width/height và vùng dining.
 */
export const room: RoomDef = {
  width: 620, // giai đoạn 14: rộng thêm 80 (trước 540) — mọi toạ độ x dời sang phải 40 để giữ giữa quán
  height: 480,
  kitchenDepth: 100,
  dining: { x1: 15, y1: 200, x2: 605, y2: 465 },
  // Tường sau kín bếp: treo tranh ở hai đầu tường bên (giữa hai cửa sổ hẹp quá, không vừa tranh ngang)
  art: [{ wall: 'left', at: 0.92 }, { wall: 'right', at: 0.92 }, { wall: 'left', at: 0.11 }],
  // Bếp gọn ở phía phải tường sau; phía trái là lối đi vào WC và kho hàng (chỉ là cảnh, xem areas/restaurant.ts).
  // Quầy ra món ở góc phải, giữa bếp và khu ăn; bồi bàn đứng chờ ngay trước quầy
  pass: { x: 510, y: 135 },
  waiterHome: { x: 510, y: 185 },
  // Giai đoạn 16: mặt bằng riêng của quán Nhật (quầy bếp chữ L, quán sâu) và quán Việt (bếp sát cửa bên trái)
  variants: {
    jp: {
      // Mặt hẹp ra đường, sâu vào trong. Quầy chữ L ôm gian bếp ở góc trái-sau: cạnh dài dọc tường trái (quầy ra món + 2 quầy đôi),
      // cạnh ngắn quay ra cửa (2 ghế đơn). WC + kho ở góc phải cuối quán.
      // Quầy ra món (quầy line) ở giữa tường sau, trước cửa sổ cạnh kho — bồi bàn bấm / tới lấy món dễ.
      plan: 'L',
      // Tường sau + tường trái kín quầy chữ L: tranh treo dọc tường phải
      art: [{ wall: 'right', at: 0.5 }, { wall: 'right', at: 0.1 }, { wall: 'right', at: 0.92 }],
      width: 460,
      height: 560,
      dining: { x1: 15, y1: 15, x2: 445, y2: 545 },
      pass: { x: 255, y: 25 },
      passStand: { x: 255, y: 75 },
      waiterHome: { x: 255, y: 115 },
      walls: [
        { x1: 0, y1: 0, x2: 192, y2: 360 },
        { x1: 180, y1: 0, x2: 330, y2: 50 },
        { x1: 330, y1: 0, x2: 460, y2: 80 },
      ],
    },
    vn: {
      // Bếp nấu ngay cửa bên trái (kiểu quán phở: nồi nước dùng, tủ kính bánh phở nhìn ra đường), dài nửa quán.
      // Quầy ra món ở đầu trong của bếp; phía sau là lối đi vào WC + kho. Không có quầy ghế đơn.
      plan: 'front',
      // Tường bắc (tường sau) còn trống giữa cửa kho và cửa sổ: 3 khung tranh
      art: [{ wall: 'back', at: 300 }, { wall: 'back', at: 212 }, { wall: 'back', at: 390 }],
      dining: { x1: 175, y1: 25, x2: 605, y2: 465 },
      pass: { x: 80, y: 222 },
      passStand: { x: 80, y: 188 },
      waiterHome: { x: 115, y: 150 },
      walls: [{ x1: 0, y1: 240, x2: 168, y2: 480 }],
    },
  },
  // Hạng quán (C3): phòng ăn sâu thêm về phía cửa; bếp, quầy ra món giữ nguyên chỗ
  // Mỗi bậc lên hạng thêm 1 chỗ thuê nhân viên phục vụ (tối đa 4 người ở hạng 5)
  tiers: [
    // Giai đoạn 15: từ hạng 2 quán còn nới về phía Đông (width): bếp dài ra, quầy trước bếp thêm ghế đơn
    { id: 1, name: 'Quán nhỏ', icon: '🏠', height: 480, cost: 0, level: 1, desc: 'Quán khởi nghiệp gọn gàng.' },
    { id: 2, name: 'Tiệm ăn', icon: '🏡', height: 570, width: 660, cost: 1000, level: 3, desc: 'Phòng ăn rộng thêm cả chiều dài lẫn chiều ngang, khách tới đông hơn 10%, thuê được 1 nhân viên.', modifiers: { spawnRate: 1.1 } },
    { id: 3, name: 'Quán đông khách', icon: '🏘️', height: 660, width: 720, cost: 3000, level: 4, desc: 'Rộng thêm nữa, bếp dài ra, quầy trước bếp thêm ghế; khách đông hơn 20%, thuê được 2 nhân viên.', modifiers: { spawnRate: 1.2 } },
    { id: 4, name: 'Nhà hàng', icon: '🏯', height: 750, width: 780, cost: 5000, level: 6, desc: 'Bếp dài rộng rãi, quầy thêm ghế; khách đông hơn 30%, giá món +5%, thuê được 3 nhân viên.', modifiers: { spawnRate: 1.3, dishPrice: 1.05 } },
    { id: 5, name: 'Nhà hàng nổi tiếng', icon: '🏰', height: 840, width: 840, cost: 8000, level: 8, desc: 'Rộng nhất: bếp dài cho 4 đầu bếp, quầy 6 ghế đơn; khách đông hơn 40%, giá món +10%, thuê được 4 nhân viên.', modifiers: { spawnRate: 1.4, dishPrice: 1.1 } },
  ],
};

/** x, y là vị trí MẶC ĐỊNH của tâm bàn; người chơi dời bàn thì vị trí mới nằm ở state.restaurant.layout. */
export const tables: TableDef[] = [
  // Dãy 3 ghế đơn ngay trước bếp cho khách đi một mình — gắn với bếp nên không dời được
  // Quán Nhật: cạnh ngắn của quầy chữ L (2 ghế đơn quay vào bếp); quán Việt không có quầy ghế đơn
  { id: 'counter', name: 'Quầy trước bếp', seats: 3, shared: true, fixed: true, x: 325, y: 140, w: 210, h: 34, cuisines: ['jp', 'kr'], byCuisine: { jp: { name: 'Quầy ghế đơn', seats: 2, x: 99, y: 340, w: 178, h: 36 } } },
  // Quán ốc vỉa hè: không có quầy ghế đơn, thay bằng một bộ bàn đôi nhựa nữa
  { id: 'pair_oc', name: 'Bàn đôi vỉa hè', seats: 2, x: 470, y: 378, w: 70, h: 70, cuisines: ['oc'] },
  { id: 'medium', name: 'Bàn bốn', seats: 4, x: 165, y: 300, w: 120, h: 76, byCuisine: { jp: { name: 'Bàn bốn sát tường', fixed: true, wall: 'east', x: 442, y: 263, w: 76, h: 120 }, vn: { x: 300, y: 110 } } },
  // Quán Nhật: 2 bàn đôi là 2 khúc quầy đôi trên cạnh dài của quầy chữ L (gắn cố định, ghế quay vào bếp)
  { id: 'pair', name: 'Bàn đôi', seats: 2, x: 470, y: 290, w: 70, h: 70, byCuisine: { jp: { name: 'Quầy đôi', fixed: true, bar: 'east', x: 170, y: 115, w: 36, h: 90 }, vn: { x: 480, y: 110 }, oc: { x: 470, y: 265 } } },
  { id: 'pair2', name: 'Bàn đôi góc', seats: 2, x: 160, y: 420, w: 70, h: 70, byCuisine: { jp: { name: 'Quầy đôi trong', fixed: true, bar: 'east', x: 170, y: 245, w: 36, h: 90 }, vn: { x: 300, y: 300 } } },
  // Quán Việt: 2 bàn đơn cho khách đi một mình (thay quầy ghế đơn)
  { id: 'single', name: 'Bàn đơn', seats: 1, x: 470, y: 262, w: 52, h: 52, cuisines: ['vn'] },
  { id: 'single2', name: 'Bàn đơn cạnh cửa sổ', seats: 1, x: 556, y: 262, w: 52, h: 52, cuisines: ['vn'] },
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
  // Giai đoạn 15: tủ kem đặt trong quán — khách ngó kem trong lúc chờ, kiên nhẫn hơn
  { id: 'icecream', name: 'Tủ kem', icon: '🍦', desc: 'Khách kiên nhẫn hơn 30%.', cost: 700, level: 4, modifiers: { patience: 1.3 } },
];
