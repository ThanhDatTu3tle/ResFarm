import type { ProducerDef, SlotTypeDef } from './types';

export const slotTypes: SlotTypeDef[] = [
  { id: 'field', name: 'Ruộng', icon: '🌱', initial: 9, max: 15, basePrice: 80, priceGrowth: 1.45, level: 1 },
  { id: 'pen', name: 'Chuồng', icon: '🏚️', initial: 2, max: 6, basePrice: 200, priceGrowth: 1.6, level: 1 },
  { id: 'pond', name: 'Ao', icon: '🌊', initial: 0, max: 4, basePrice: 350, priceGrowth: 1.7, level: 3 },
];

/** Thêm cây/con mới: thêm 1 mục ở đây (xem ProducerDef trong types.ts). */
export const producers: ProducerDef[] = [
  // Cây trồng — thu 1 lần
  { id: 'cabbage', name: 'Rau cải', icon: '🥬', slot: 'field', cost: 2, growTime: 180, yields: [{ item: 'cabbage', qty: 3 }], cycles: 1, level: 1 },
  { id: 'tomato', name: 'Cà chua', icon: '🍅', slot: 'field', cost: 3, growTime: 240, yields: [{ item: 'tomato', qty: 4 }], cycles: 1, level: 1 },
  { id: 'onion', name: 'Hành tây', icon: '🧅', slot: 'field', cost: 2, growTime: 200, yields: [{ item: 'onion', qty: 4 }], cycles: 1, level: 1 },
  { id: 'carrot', name: 'Cà rốt', icon: '🥕', slot: 'field', cost: 3, growTime: 260, yields: [{ item: 'carrot', qty: 4 }], cycles: 1, level: 2 },
  { id: 'potato', name: 'Khoai tây', icon: '🥔', slot: 'field', cost: 3, growTime: 300, yields: [{ item: 'potato', qty: 5 }], cycles: 1, level: 3 },
  { id: 'chili', name: 'Ớt', icon: '🌶️', slot: 'field', cost: 2, growTime: 220, yields: [{ item: 'chili', qty: 4 }], cycles: 1, level: 3 },

  // Vật nuôi cho sản phẩm định kỳ
  { id: 'hen', name: 'Gà mái đẻ', icon: '🐔', slot: 'pen', cost: 60, growTime: 240, yields: [{ item: 'egg', qty: 3 }], cycles: 'infinite', regrowTime: 150, level: 1 },
  { id: 'dairy_cow', name: 'Bò sữa', icon: '🐄', slot: 'pen', cost: 250, growTime: 480, yields: [{ item: 'milk', qty: 3 }], cycles: 'infinite', regrowTime: 240, level: 3 },

  // Vật nuôi lấy thịt — thu 1 lần
  { id: 'broiler', name: 'Gà thịt', icon: '🐥', slot: 'pen', cost: 15, growTime: 480, yields: [{ item: 'chicken', qty: 4 }], cycles: 1, level: 2 },
  { id: 'pig', name: 'Heo', icon: '🐖', slot: 'pen', cost: 30, growTime: 720, yields: [{ item: 'pork', qty: 6 }], cycles: 1, level: 2 },
  { id: 'cattle', name: 'Bò thịt', icon: '🐂', slot: 'pen', cost: 60, growTime: 1200, yields: [{ item: 'beef', qty: 7 }], cycles: 1, level: 3 },

  // Ao
  { id: 'fish_fry', name: 'Cá giống', icon: '🐟', slot: 'pond', cost: 20, growTime: 600, yields: [{ item: 'fish', qty: 5 }], cycles: 1, level: 3 },
  { id: 'shrimp_fry', name: 'Tôm giống', icon: '🦐', slot: 'pond', cost: 25, growTime: 600, yields: [{ item: 'shrimp', qty: 9 }], cycles: 1, level: 4 },
];
