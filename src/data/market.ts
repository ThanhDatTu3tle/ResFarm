import type { StallDef } from './types';

/** Thêm sạp: thêm 1 mục ở đây — khu chợ 3D tự dựng thêm sạp, bảng tên (= name) và bày hàng theo `items`. */
export const stalls: StallDef[] = [
  { id: 'meat', name: 'Thịt bò/lợn cô Bủm', icon: '🥩', markup: 1, items: ['beef', 'pork', 'chicken'] },
  { id: 'produce', name: 'Tạp hóa cậu Ba', icon: '🥬', markup: 1, items: ['cabbage', 'tomato', 'onion', 'carrot', 'potato', 'chili', 'cucumber', 'mushroom', 'egg', 'milk'] },
  { id: 'seafood', name: 'Hải sản Tuyết Nhung', icon: '🦐', markup: 1, items: ['fish', 'shrimp', 'squid', 'salmon'], standee: 'Chuyên các loại ốc' },
  { id: 'dry', name: 'Chuyên đồ khô, mì, bún, phở', icon: '🍥', markup: 1, items: ['noodle', 'rice_noodle', 'wheat_noodle', 'rice_cake', 'tofu', 'seaweed', 'flour', 'bread'] },
  // Tiệm nhỏ cạnh quầy đồ khô
  { id: 'snack', name: 'Tiệm 25caaaaa', icon: '🧋', markup: 1.1, kind: 'kiosk', staffMeal: { price: 45, energy: 80, minutes: 70 }, items: ['milk', 'banana', 'orange', 'apple', 'rice_cake'] },
  // Hàng rong trên vỉa hè
  { id: 'hutieu', name: 'Hủ tiếu gõ chú Tư', icon: '🍜', markup: 1.1, kind: 'cart', spot: { x: -8.5, z: 6.4 }, staffMeal: { price: 35, energy: 60, minutes: 60 }, items: ['noodle', 'pork', 'shrimp'] },
  { id: 'banhtrang', name: 'Bánh tráng trộn', icon: '🥢', markup: 1.1, kind: 'pole', spot: { x: 0.5, z: 6.8 }, staffMeal: { price: 25, energy: 40, minutes: 50 }, items: ['egg', 'chili', 'mango', 'squid'] },
  { id: 'cafe', name: 'Cà phê dạo', icon: '☕', markup: 1.1, kind: 'bike', spot: { x: 9, z: 6.4 }, staffMeal: { price: 15, energy: 25, minutes: 40 }, items: ['milk', 'bread', 'egg'] },
];
