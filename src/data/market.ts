import type { StallDef } from './types';

/** Thêm sạp: thêm 1 mục ở đây — khu chợ 3D tự dựng thêm sạp, bảng tên (= name) và bày hàng theo `items`. */
export const stalls: StallDef[] = [
  { id: 'meat', name: 'Chuyên thịt heo/lợn', icon: '🥩', markup: 1, items: ['beef', 'pork', 'chicken'] },
  { id: 'produce', name: 'Tạp hóa cậu Ba', icon: '🥬', markup: 1, items: ['cabbage', 'tomato', 'onion', 'carrot', 'potato', 'chili', 'cucumber', 'mushroom', 'egg', 'milk'] },
  { id: 'seafood', name: 'Hải sản Tuyết Nhung', icon: '🦐', markup: 1, items: ['fish', 'shrimp', 'squid', 'salmon'], standee: 'Chuyên các loại ốc, nghêu, sò' },
  { id: 'dry', name: 'Chuyên đồ khô, mì, bún, phở', icon: '🍥', markup: 1, items: ['noodle', 'rice_noodle', 'wheat_noodle', 'rice_cake', 'tofu', 'seaweed', 'flour', 'bread'] },
];
