import { balance } from './balance';
import type { MillTypeDef, ProducerDef, SlotTypeDef } from './types';

/**
 * Một NGÀY nông trại tính bằng phút game: cả ngày mở cửa (06:00 → 24:00) + phần cộng qua đêm (`balance.nightMinutes`).
 * Gieo lúc mấy giờ thì đúng giờ đó `n` ngày sau là chín (đất ẩm, chưa nâng cấp, ngoài trời).
 */
export const FARM_DAY = balance.closeMinute - balance.openMinute + balance.nightMinutes;
const days = (n: number) => Math.round(n * FARM_DAY);

export const slotTypes: SlotTypeDef[] = [
  { id: 'field', name: 'Ruộng', icon: '🌱', initial: 6, max: 15, basePrice: 80, priceGrowth: 1.45, level: 1, needsTilling: true, needsWater: true, layout: { x: -6.6, z: -1.6, cols: 3, dx: 2.6, dz: 2.75, size: 2.3, tierGrowth: 0 } },
  { id: 'pen', name: 'Chuồng', icon: '🏚️', animals: true, initial: 1, max: 6, basePrice: 200, priceGrowth: 1.6, level: 1, layout: { x: 4.6, z: -1.6, cols: 3, dx: 5.0, dz: 5.2, size: 4.2, tierGrowth: 0 } },
  {
    id: 'pond',
    name: 'Ao cá',
    icon: '🌊',
    // Một mặt ao chung, chia nhiều "ô nuôi" (mỗi ô một loại hải sản): bậc 1 nuôi 3 loại, mỗi lần nới rộng thêm 2 loại
    // (3 → 5 → 7 → 9, đủ 9 loại giống ở ao). Không mua ô lẻ - ô nuôi chỉ thêm khi nới rộng ao (perTier).
    initial: 3,
    max: 9,
    perTier: 2,
    basePrice: 350,
    priceGrowth: 1.7,
    level: 3,
    // Ao trên con suối phía hạ lưu (bên phải đường đất); size = bề ngang ao (hình méo tự nhiên, xem areas/farm.ts).
    // Mỗi bậc nới rộng to thêm 30%: 6 → 7.8 → 9.6 → 11.4 m. Bác đứng bờ sau ao.
    layout: { x: 9.5, z: 15, cols: 1, dx: 0, dz: 0, size: 6, tierGrowth: 0.3, work: 'back' },
    // Nới rộng ao: nuôi được nhiều hơn
    tiers: [
      { cost: 400, level: 2, yieldMul: 1.6 },
      { cost: 1000, level: 4, yieldMul: 2.4 },
      { cost: 2200, level: 6, yieldMul: 3.4 },
    ],
  },
  // Bên kia con suối, đối diện ruộng rau: cột sát sông là ruộng lúa nước, cột bên cạnh là ruộng lúa mì (ô to).
  // Thu hoạch tự động (máy cày) → gieo lại → chở tới cối (lúa mì: cối xay gió phía bắc; lúa nước: nhà xay lúa bên sông).
  { id: 'wheat', name: 'Ruộng lúa mì', icon: '🌾', initial: 1, max: 2, basePrice: 300, priceGrowth: 1.5, level: 1, mill: 'windmill', layout: { x: -1.5, z: 15.4, cols: 1, dx: 0, dz: 4.6, size: 3.8, tierGrowth: 0, work: 'back' } },
  // Nhà lồng / nhà màng phía nam ao: luống bên trong (2 dãy, lối đi ở giữa). Nới rộng = nhà dài thêm về phía đông, +4 luống mỗi lần.
  // Cây trong nhà kính không cần cuốc / tưới (có tưới nhỏ giọt) và lớn nhanh hơn 30%.
  { id: 'gplot', name: 'Luống nhà kính', icon: '🏡', initial: 6, max: 20, batch: 4, basePrice: 700, priceGrowth: 1.6, level: 3, growMul: 1.3, layout: { x: 0, z: 0, cols: 2, dx: 1.9, dz: 2.8, size: 1.5, tierGrowth: 0 }, building: { x: 4, z: 23.8, width: 5.2, colLength: 1.9, endLength: 0.8, door: { x: 3.3, z: 23.8 } } },
  // Vườn cây ăn quả: 4 gốc cạnh chuồng (phía đông), 6 gốc cạnh ao (phía đông, 3 hàng × 2 cột - hàng giữa z = 14.65
  // là 2 chỗ thêm, để ở cuối danh sách cho save cũ giữ nguyên vị trí cây); có sẵn 1 cam + 1 táo. Cây lâu năm, không cần cuốc / tưới.
  // Mỗi gốc có lối riêng: hàng trên đứng ở khe giữa 2 dãy chuồng / trước dãy chuồng, cụm cạnh ao đứng phía bắc hoặc phía nam; tới cụm này bác đi lối phụ
  // phía đông ao (balance.farmer.side) nên không chạy ngang xuyên ao.
  { id: 'orchard', name: 'Cây ăn quả', icon: '🌳', initial: 2, max: 10, basePrice: 260, priceGrowth: 1.3, level: 1, initialPlants: ['orange_tree', 'apple_tree'], layout: { x: 19.6, z: -0.8, cols: 2, dx: 3.8, dz: 5.2, size: 2.6, tierGrowth: 0, spots: [{ x: 19.6, z: -0.8 }, { x: 23.4, z: -0.8 }, { x: 19.6, z: 4.4 }, { x: 23.4, z: 4.4 }, { x: 19.6, z: 10.0, work: 'back' }, { x: 23.4, z: 10.0, work: 'back' }, { x: 19.6, z: 19.3 }, { x: 23.4, z: 19.3 }, { x: 19.6, z: 14.65, work: 'back' }, { x: 23.4, z: 14.65, work: 'back' }] } },
  { id: 'paddy', name: 'Ruộng lúa nước', icon: '🌾', initial: 1, max: 2, basePrice: 300, priceGrowth: 1.5, level: 2, mill: 'ricemill', layout: { x: -5.8, z: 15.4, cols: 1, dx: 0, dz: 4.6, size: 3.8, tierGrowth: 0, work: 'back' } },
];

/**
 * Cối chế biến ở nông trại. Bác nông dân tự chở lúa tới; cối làm ra thành phẩm người chơi chọn và cho thẳng vào kho.
 * Thêm thành phẩm: thêm id nguyên liệu vào products (nguyên liệu phải có trong items.ts).
 */
export const mills: MillTypeDef[] = [
  { id: 'windmill', name: 'Cối xay gió', icon: '🌬️', input: 'wheat', products: ['flour', 'wheat_noodle', 'bread'], time: 10, initial: 1, max: 2, basePrice: 900, priceGrowth: 1.8, level: 2, layout: { x: -7.6, z: -7.6, cols: 2, dx: 4.2, dz: 0, spot: { x: 0, z: 1.95 } } }, // phía bắc, sau hàng rào (cổng ở lối dọc x = -8.3)
  { id: 'ricemill', name: 'Nhà xay lúa', icon: '🏚️', input: 'paddy_rice', products: ['noodle', 'rice_noodle', 'rice_cake'], time: 10, initial: 1, max: 2, basePrice: 900, priceGrowth: 1.8, level: 2, layout: { x: -9.4, z: 25.4, cols: 2, dx: 4.4, dz: 0, spot: { x: 0, z: -1.95 } } }, // sát bờ sông, bánh xe nước nhúng xuống sông
];

/** Thêm cây/con mới: thêm 1 mục ở đây (xem ProducerDef trong types.ts). */
export const producers: ProducerDef[] = [
  // Cây trồng - thu 1 lần. Thời gian lớn theo tỉ lệ ngoài đời (rau cải ~35 ngày … hành tây ~110 ngày) thu về 1 → 5 ngày.
  { id: 'cabbage', name: 'Rau cải', icon: '🥬', slot: 'field', seasons: [0, 2], alsoIn: ['gplot'], cost: 2, growTime: days(1), yields: [{ item: 'cabbage', qty: 6 }], cycles: 1, level: 1 },
  { id: 'cucumber', name: 'Dưa leo', icon: '🥒', slot: 'field', seasons: [0, 1], alsoIn: ['gplot'], cost: 2, growTime: days(2), yields: [{ item: 'cucumber', qty: 12 }], cycles: 1, level: 1 },
  { id: 'tomato', name: 'Cà chua', icon: '🍅', slot: 'field', seasons: [0, 1], alsoIn: ['gplot'], cost: 3, growTime: days(3), yields: [{ item: 'tomato', qty: 14 }], cycles: 1, level: 1 },
  { id: 'carrot', name: 'Cà rốt', icon: '🥕', slot: 'field', seasons: [0, 2], alsoIn: ['gplot'], cost: 3, growTime: days(3), yields: [{ item: 'carrot', qty: 16 }], cycles: 1, level: 2 },
  { id: 'chili', name: 'Ớt', icon: '🌶️', slot: 'field', seasons: [1, 2], alsoIn: ['gplot'], cost: 2, growTime: days(4), yields: [{ item: 'chili', qty: 28 }], cycles: 1, level: 3 },
  { id: 'potato', name: 'Khoai tây', icon: '🥔', slot: 'field', seasons: [1, 2], alsoIn: ['gplot'], cost: 3, growTime: days(4), yields: [{ item: 'potato', qty: 22 }], cycles: 1, level: 3 },
  { id: 'onion', name: 'Hành tây', icon: '🧅', slot: 'field', seasons: [0, 1, 2], alsoIn: ['gplot'], cost: 2, growTime: days(5), yields: [{ item: 'onion', qty: 40 }], cycles: 1, level: 1 },

  // Vật nuôi cho sản phẩm định kỳ: nuôi một lứa cho cả năm, sang mùa Đông thì hết lứa (`diesInWinter`), Xuân nuôi lứa mới
  { id: 'hen', name: 'Gà mái đẻ', icon: '🐔', slot: 'pen', cost: 60, growTime: days(2), yields: [{ item: 'egg', qty: 6 }], cycles: 'infinite', regrowTime: days(1), level: 1, diesInWinter: true },
  { id: 'dairy_cow', name: 'Bò sữa', icon: '🐄', slot: 'pen', cost: 250, growTime: days(7), yields: [{ item: 'milk', qty: 6 }], cycles: 'infinite', regrowTime: days(1), level: 3, diesInWinter: true },

  // Vật nuôi lấy thịt - thu 1 lần, muốn nữa thì nuôi lại
  { id: 'broiler', name: 'Gà thịt', icon: '🐥', slot: 'pen', cost: 15, growTime: days(2), yields: [{ item: 'chicken', qty: 8 }], cycles: 1, level: 2 },
  { id: 'pig', name: 'Heo', icon: '🐖', slot: 'pen', cost: 30, growTime: days(5), yields: [{ item: 'pork', qty: 16 }], cycles: 1, level: 2 },
  { id: 'cattle', name: 'Bò thịt', icon: '🐂', slot: 'pen', cost: 60, growTime: days(7), yields: [{ item: 'beef', qty: 20 }], cycles: 1, level: 3 },

  // Cây ăn quả: 7 ngày lớn + 1 ngày ra trái; hái xong cây cần 1 ngày hồi phục và ra trái lứa sau
  { id: 'orange_tree', name: 'Cây cam', icon: '🍊', slot: 'orchard', cost: 60, growTime: days(8), yields: [{ item: 'orange', qty: 12 }], cycles: 'infinite', regrowTime: days(1), level: 1 },
  { id: 'apple_tree', name: 'Cây táo', icon: '🍎', slot: 'orchard', cost: 60, growTime: days(8), yields: [{ item: 'apple', qty: 12 }], cycles: 'infinite', regrowTime: days(1), level: 1 },
  { id: 'mango_tree', name: 'Cây xoài', icon: '🥭', slot: 'orchard', cost: 90, growTime: days(8), yields: [{ item: 'mango', qty: 10 }], cycles: 'infinite', regrowTime: days(1), level: 2 },
  { id: 'banana_tree', name: 'Cây chuối', icon: '🍌', slot: 'orchard', cost: 70, growTime: days(8), yields: [{ item: 'banana', qty: 16 }], cycles: 'infinite', regrowTime: days(1), level: 2 },

  // Ruộng tự động (thu bằng máy cày, gieo lại tự động): 3 ngày
  { id: 'wheat', name: 'Lúa mì', icon: '🌾', slot: 'wheat', seasons: [0, 2], cost: 6, growTime: days(3), yields: [{ item: 'wheat', qty: 28 }], cycles: 1, level: 1 },
  { id: 'rice_crop', name: 'Lúa nước', icon: '🌾', slot: 'paddy', seasons: [1, 2], cost: 6, growTime: days(3), yields: [{ item: 'paddy_rice', qty: 30 }], cycles: 1, level: 2 },

  // Ao: thả giống một lần, lớn xong thu được nhiều lứa - thu xong 3 ngày sau lứa mới lớn để thu tiếp (giai đoạn 13: nhanh hơn ~40%, 15 con một lứa)
  { id: 'fish_fry', name: 'Cá giống', icon: '🐟', slot: 'pond', cost: 20, growTime: days(3), yields: [{ item: 'fish', qty: 30 }], cycles: 'infinite', regrowTime: days(3), level: 1 },
  { id: 'salmon_fry', name: 'Cá hồi giống', icon: '🐠', slot: 'pond', cost: 40, growTime: days(4), yields: [{ item: 'salmon', qty: 30 }], cycles: 'infinite', regrowTime: days(3), level: 3 },
  { id: 'shrimp_fry', name: 'Tôm giống', icon: '🦐', slot: 'pond', cost: 25, growTime: days(3.5), yields: [{ item: 'shrimp', qty: 30 }], cycles: 'infinite', regrowTime: days(3), level: 4 },
  // Ốc, sò: như tôm (3.5 ngày, 15 con mỗi lứa, 3 ngày một lứa)
  { id: 'oc_huong_fry', name: 'Ốc hương giống', icon: '🐚', slot: 'pond', cost: 30, growTime: days(3.5), yields: [{ item: 'oc_huong', qty: 30 }], cycles: 'infinite', regrowTime: days(3), level: 3 },
  { id: 'oc_mong_tay_fry', name: 'Ốc móng tay giống', icon: '🐚', slot: 'pond', cost: 25, growTime: days(3.5), yields: [{ item: 'oc_mong_tay', qty: 30 }], cycles: 'infinite', regrowTime: days(3), level: 3 },
  { id: 'so_diep_fry', name: 'Sò điệp giống', icon: '🐚', slot: 'pond', cost: 30, growTime: days(3.5), yields: [{ item: 'so_diep', qty: 30 }], cycles: 'infinite', regrowTime: days(3), level: 4 },
  { id: 'ngheu_fry', name: 'Nghêu giống', icon: '🦪', slot: 'pond', cost: 15, growTime: days(3.5), yields: [{ item: 'ngheu', qty: 30 }], cycles: 'infinite', regrowTime: days(3), level: 2 },
  { id: 'hau_fry', name: 'Hàu giống', icon: '🦪', slot: 'pond', cost: 30, growTime: days(3.5), yields: [{ item: 'hau', qty: 30 }], cycles: 'infinite', regrowTime: days(3), level: 4 },
  { id: 'oc_bu_fry', name: 'Ốc bươu giống', icon: '🐌', slot: 'pond', cost: 15, growTime: days(3.5), yields: [{ item: 'oc_bu', qty: 30 }], cycles: 'infinite', regrowTime: days(3), level: 2 },
];
