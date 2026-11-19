import type { StallDef } from './types';

/** Thêm sạp: thêm 1 mục ở đây — khu chợ 3D tự dựng thêm sạp, bảng tên (= name) và bày hàng theo `items`. */
export const stalls: StallDef[] = [
  { id: 'meat', name: 'Thịt bò/lợn cô Bủm', icon: '🥩', markup: 1, items: ['beef', 'pork', 'chicken'] },
  { id: 'produce', name: 'Tạp hóa cậu Ba', icon: '🥬', markup: 1, items: ['cabbage', 'tomato', 'onion', 'carrot', 'potato', 'chili', 'cucumber', 'mushroom', 'egg', 'milk'] },
  { id: 'seafood', name: 'Hải sản Tuyết Nhung', icon: '🦐', markup: 1, items: ['fish', 'shrimp', 'squid', 'salmon'], standee: 'Chuyên các loại ốc' },
  { id: 'dry', name: 'Chuyên đồ khô, mì, bún, phở', icon: '🍥', markup: 1, items: ['noodle', 'rice_noodle', 'wheat_noodle', 'rice_cake', 'tofu', 'seaweed', 'flour', 'bread'] },
  // Tiệm ăn vặt cạnh quầy đồ khô + hàng rong trên vỉa hè: chỉ bán đồ ăn cho cả đội giờ nghỉ (không bán nguyên liệu).
  // Năng lượng hồi tăng dần: cà phê < bánh tráng < hủ tiếu < Tiệm 25caaaaa.
  {
    id: 'snack', name: 'Tiệm 25caaaaa', icon: '🧋', markup: 1, kind: 'kiosk', items: [],
    menu: [
      { name: 'Matcha đá xay', icon: '🍵', price: 30, energy: 16 },
      { name: 'Xiên que chiên', icon: '🍢', price: 34, energy: 18 },
      { name: 'Combo gà rán khoai', icon: '🍗', price: 42, energy: 22 },
      { name: 'Mì Ý sốt bò bằm', icon: '🍝', price: 38, energy: 20 },
    ],
  },
  {
    id: 'hutieu', name: 'Hủ tiếu gõ chú Tư', icon: '🍜', markup: 1, kind: 'cart', spot: { x: -8.5, z: 6.4 }, items: [],
    menu: [
      { name: 'Hủ tiếu gõ', icon: '🍜', price: 22, energy: 13 },
      { name: 'Hủ tiếu khô', icon: '🥢', price: 24, energy: 14 },
      { name: 'Mì xào giòn', icon: '🍝', price: 27, energy: 15 },
    ],
  },
  {
    id: 'banhtrang', name: 'Bánh tráng trộn', icon: '🥢', markup: 1, kind: 'pole', spot: { x: 0.5, z: 6.8 }, items: [],
    menu: [
      { name: 'Bánh tráng trộn', icon: '🥗', price: 14, energy: 9 },
      { name: 'Bánh tráng nướng', icon: '🍕', price: 16, energy: 10 },
      { name: 'Bánh tráng cuốn', icon: '🌯', price: 18, energy: 11 },
    ],
  },
  {
    id: 'cafe', name: 'Cà phê dạo', icon: '☕', markup: 1, kind: 'bike', spot: { x: -4.2, z: 7.4 }, items: [],
    menu: [
      { name: 'Cà phê sữa đá', icon: '☕', price: 8, energy: 5 },
      { name: 'Bạc xỉu', icon: '🥛', price: 9, energy: 6 },
      { name: 'Bánh mì que', icon: '🥖', price: 10, energy: 7 },
    ],
  },
];
