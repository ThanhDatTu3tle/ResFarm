import type { StallDef } from './types';

/** Thêm sạp: thêm 1 mục ở đây — khu chợ 3D tự dựng thêm sạp và bày hàng theo `items`. */
export const stalls: StallDef[] = [
  { id: 'meat', name: 'Quầy thịt chú Tư', icon: '🥩', markup: 1, items: ['beef', 'pork', 'chicken'] },
  { id: 'produce', name: 'Sạp rau - trứng - sữa cô Ba', icon: '🥬', markup: 1, items: ['cabbage', 'tomato', 'onion', 'carrot', 'potato', 'chili', 'egg', 'milk', 'noodle'] },
  { id: 'seafood', name: 'Hàng hải sản dì Năm', icon: '🦐', markup: 1, items: ['fish', 'shrimp', 'squid'] },
];
