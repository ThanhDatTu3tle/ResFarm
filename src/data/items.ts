import type { ItemDef } from './types';

/** Thêm nguyên liệu mới: thêm 1 dòng ở đây, rồi cho nó một nguồn (sạp chợ hoặc producer). */
export const items: ItemDef[] = [
  // Nguyên liệu mặc định — không bao giờ hết
  { id: 'rice', name: 'Gạo', icon: '🍚', category: 'staple', infinite: true, basePrice: 0 },
  { id: 'water', name: 'Nước', icon: '💧', category: 'staple', infinite: true, basePrice: 0 },
  { id: 'oil', name: 'Dầu ăn', icon: '🫗', category: 'staple', infinite: true, basePrice: 0 },
  { id: 'salt', name: 'Muối', icon: '🧂', category: 'staple', infinite: true, basePrice: 0 },
  { id: 'fish_sauce', name: 'Nước mắm', icon: '🍶', category: 'staple', infinite: true, basePrice: 0 },

  // Rau củ
  { id: 'cabbage', name: 'Rau cải', icon: '🥬', category: 'vegetable', basePrice: 4 },
  { id: 'tomato', name: 'Cà chua', icon: '🍅', category: 'vegetable', basePrice: 5 },
  { id: 'onion', name: 'Hành tây', icon: '🧅', category: 'vegetable', basePrice: 3 },
  { id: 'carrot', name: 'Cà rốt', icon: '🥕', category: 'vegetable', basePrice: 4 },
  { id: 'potato', name: 'Khoai tây', icon: '🥔', category: 'vegetable', basePrice: 4 },
  { id: 'chili', name: 'Ớt', icon: '🌶️', category: 'vegetable', basePrice: 3 },

  // Thịt
  { id: 'pork', name: 'Thịt heo', icon: '🥓', category: 'meat', basePrice: 14 },
  { id: 'chicken', name: 'Thịt gà', icon: '🍗', category: 'meat', basePrice: 12 },
  { id: 'beef', name: 'Thịt bò', icon: '🥩', category: 'meat', basePrice: 20 },

  // Hải sản
  { id: 'fish', name: 'Cá', icon: '🐟', category: 'seafood', basePrice: 12 },
  { id: 'shrimp', name: 'Tôm', icon: '🦐', category: 'seafood', basePrice: 9 },
  { id: 'squid', name: 'Mực', icon: '🦑', category: 'seafood', basePrice: 13 },

  // Trứng sữa
  { id: 'egg', name: 'Trứng', icon: '🥚', category: 'dairy', basePrice: 4 },
  { id: 'milk', name: 'Sữa', icon: '🥛', category: 'dairy', basePrice: 6 },

  // Đồ khô — chỉ mua được ngoài chợ
  { id: 'noodle', name: 'Bánh phở', icon: '🍜', category: 'dry', basePrice: 5 },
];

export const categoryNames: Record<ItemDef['category'], string> = {
  staple: 'Luôn có sẵn',
  vegetable: 'Rau củ',
  meat: 'Thịt',
  seafood: 'Hải sản',
  dairy: 'Trứng sữa',
  dry: 'Đồ khô',
};
