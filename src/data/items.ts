import type { ItemDef } from './types';

/** Thêm nguyên liệu mới: thêm 1 dòng ở đây, rồi cho nó một nguồn (sạp chợ hoặc producer). */
export const items: ItemDef[] = [
  // Nguyên liệu mặc định — không bao giờ hết
  { id: 'rice', name: 'Gạo', icon: '🍚', category: 'staple', infinite: true, basePrice: 0 },
  { id: 'water', name: 'Nước', icon: '💧', category: 'staple', infinite: true, basePrice: 0 },
  { id: 'oil', name: 'Dầu ăn', icon: '🫗', category: 'staple', infinite: true, basePrice: 0 },
  { id: 'salt', name: 'Muối', icon: '🧂', category: 'staple', infinite: true, basePrice: 0 },
  { id: 'fish_sauce', name: 'Nước mắm', icon: '🍶', category: 'staple', infinite: true, basePrice: 0 },
  { id: 'soy_sauce', name: 'Nước tương', icon: '🫙', category: 'staple', infinite: true, basePrice: 0 },
  { id: 'miso', name: 'Tương miso', icon: '🥣', category: 'staple', infinite: true, basePrice: 0 },
  { id: 'gochujang', name: 'Tương ớt Hàn', icon: '🥫', category: 'staple', infinite: true, basePrice: 0 },

  // Rau củ
  { id: 'cabbage', name: 'Rau cải', icon: '🥬', category: 'vegetable', basePrice: 4 },
  { id: 'tomato', name: 'Cà chua', icon: '🍅', category: 'vegetable', basePrice: 5 },
  { id: 'onion', name: 'Hành tây', icon: '🧅', category: 'vegetable', basePrice: 3 },
  { id: 'carrot', name: 'Cà rốt', icon: '🥕', category: 'vegetable', basePrice: 4 },
  { id: 'potato', name: 'Khoai tây', icon: '🥔', category: 'vegetable', basePrice: 4 },
  { id: 'chili', name: 'Ớt', icon: '🌶️', category: 'vegetable', basePrice: 3 },
  { id: 'cucumber', name: 'Dưa leo', icon: '🥒', category: 'vegetable', basePrice: 4 },
  { id: 'mushroom', name: 'Nấm', icon: '🍄', category: 'vegetable', basePrice: 5 },

  // Thịt
  { id: 'pork', name: 'Thịt heo', icon: '🥓', category: 'meat', basePrice: 14 },
  { id: 'chicken', name: 'Thịt gà', icon: '🍗', category: 'meat', basePrice: 12 },
  { id: 'beef', name: 'Thịt bò', icon: '🥩', category: 'meat', basePrice: 20 },

  // Hải sản
  { id: 'fish', name: 'Cá', icon: '🐟', category: 'seafood', basePrice: 12 },
  { id: 'shrimp', name: 'Tôm', icon: '🦐', category: 'seafood', basePrice: 9 },
  { id: 'squid', name: 'Mực', icon: '🦑', category: 'seafood', basePrice: 13 },
  { id: 'salmon', name: 'Cá hồi', icon: '🐠', category: 'seafood', basePrice: 18 },

  // Trứng sữa
  { id: 'egg', name: 'Trứng', icon: '🥚', category: 'dairy', basePrice: 4 },
  { id: 'milk', name: 'Sữa', icon: '🥛', category: 'dairy', basePrice: 6 },

  // Đồ khô — chỉ mua được ngoài chợ
  { id: 'noodle', name: 'Bánh phở', icon: '🍜', category: 'dry', basePrice: 5 },
  { id: 'rice_noodle', name: 'Bún', icon: '🍥', category: 'dry', basePrice: 4 },
  { id: 'wheat_noodle', name: 'Mì sợi', icon: '🍝', category: 'dry', basePrice: 4 },
  { id: 'rice_cake', name: 'Bánh gạo', icon: '🍡', category: 'dry', basePrice: 4 },
  { id: 'tofu', name: 'Đậu phụ', icon: '🧈', category: 'dry', basePrice: 4 },
  { id: 'seaweed', name: 'Rong biển', icon: '🌿', category: 'dry', basePrice: 3 },
  { id: 'flour', name: 'Bột mì', icon: '🫓', category: 'dry', basePrice: 2 },
  { id: 'bread', name: 'Bánh mì', icon: '🥖', category: 'dry', basePrice: 4 },

  // Nông sản thô — chỉ để chở tới cối chế biến (không bán ngoài chợ)
  { id: 'wheat', name: 'Lúa mì', icon: '🌾', category: 'vegetable', basePrice: 2 },
  { id: 'paddy_rice', name: 'Lúa (thóc)', icon: '🎑', category: 'vegetable', basePrice: 2 },
];

export const categoryNames: Record<ItemDef['category'], string> = {
  staple: 'Luôn có sẵn',
  vegetable: 'Rau củ',
  meat: 'Thịt',
  seafood: 'Hải sản',
  dairy: 'Trứng sữa',
  dry: 'Đồ khô',
};
