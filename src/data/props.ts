import type { PetDef, PropDef, TableKindDef } from './types';

/**
 * ĐỒ TRANG TRÍ đặt tự do trong khu ăn uống (F4). Mua ở Siêu thị → tự đặt vào chỗ trống, kéo đi chỗ khác ở chế độ
 * sắp xếp. w/h là kích thước chiếm chỗ (toạ độ 2D, 55 = 1 mét). Hiệu ứng chỉ tính một lần mỗi loại.
 * Model 3D theo `model` (ui/three/props.ts); kiểu chưa có model thì hiện emoji.
 */
export const props: PropDef[] = [
  // Dùng chung
  { id: 'fig_pot', name: 'Chậu bàng Singapore', icon: '🪴', model: 'fig', cost: 120, level: 1, w: 40, h: 40, modifiers: { patience: 1.03 } },
  { id: 'floor_lamp', name: 'Đèn cây vải lanh', icon: '💡', model: 'floorlamp', cost: 180, level: 2, w: 36, h: 36, modifiers: { tip: 1.03 } },
  { id: 'bonsai', name: 'Bonsai trên đôn gỗ', icon: '🌳', model: 'bonsai', cost: 260, level: 2, w: 40, h: 40, modifiers: { patience: 1.04 } },
  { id: 'aquarium', name: 'Bể cá cảnh', icon: '🐠', model: 'aquarium', cost: 420, level: 3, w: 80, h: 40, modifiers: { patience: 1.06 } },
  { id: 'bamboo', name: 'Khóm tre cảnh', icon: '🎋', model: 'bamboo', cost: 200, level: 2, w: 40, h: 40, modifiers: { spawnRate: 1.03 } },
  // Quán Việt
  { id: 'kumquat', name: 'Cây quất ngày Tết', icon: '🍊', model: 'kumquat', cost: 220, level: 2, cuisine: 'vn', w: 42, h: 42, modifiers: { tip: 1.04 } },
  { id: 'mai', name: 'Cây mai vàng', icon: '🌼', model: 'blossom_y', cost: 380, level: 3, cuisine: 'vn', w: 46, h: 46, modifiers: { spawnRate: 1.05 } },
  { id: 'battrang', name: 'Bình gốm Bát Tràng', icon: '🏺', model: 'vase', cost: 160, level: 1, cuisine: 'vn', w: 32, h: 32, modifiers: { dishPrice: 1.02 } },
  // Quán Nhật
  { id: 'sakura', name: 'Cây anh đào', icon: '🌸', model: 'blossom_p', cost: 380, level: 3, cuisine: 'jp', w: 46, h: 46, modifiers: { spawnRate: 1.05 } },
  { id: 'toro', name: 'Đèn đá tōrō', icon: '🏮', model: 'toro', cost: 240, level: 2, cuisine: 'jp', w: 36, h: 36, modifiers: { tip: 1.04 } },
  { id: 'maneki', name: 'Mèo thần tài', icon: '🐱', model: 'maneki', cost: 160, level: 1, cuisine: 'jp', w: 30, h: 30, modifiers: { dishPrice: 1.02 } },
  // Quán Hàn
  { id: 'onggi', name: 'Chum tương onggi', icon: '🏺', model: 'onggi', cost: 160, level: 1, cuisine: 'kr', w: 44, h: 36, modifiers: { dishPrice: 1.02 } },
  { id: 'kr_neon', name: 'Biển đèn neon đứng', icon: '🔆', model: 'neon', cost: 240, level: 2, cuisine: 'kr', w: 40, h: 30, modifiers: { tip: 1.04 } },
  { id: 'pine', name: 'Cây thông chậu sứ', icon: '🌲', model: 'pine', cost: 380, level: 3, cuisine: 'kr', w: 46, h: 46, modifiers: { spawnRate: 1.05 } },
  // Quà của khách quen (không bán)
  { id: 'gift_teddy', name: 'Gấu bông của Bé Na', icon: '🧸', model: 'teddy', cost: 0, level: 1, w: 40, h: 36, giftOnly: true, modifiers: { tip: 1.05 } },
  { id: 'gift_claw', name: 'Máy gắp thú của Cu Tí', icon: '🕹️', model: 'claw', cost: 0, level: 1, w: 44, h: 44, giftOnly: true, modifiers: { spawnRate: 1.05 } },
  { id: 'gift_books', name: 'Kệ sách của Chị Thảo', icon: '📚', model: 'books', cost: 0, level: 1, w: 70, h: 30, giftOnly: true, modifiers: { patience: 1.06 } },
  { id: 'gift_fridge', name: 'Tủ nước của Anh Tâm', icon: '🥤', model: 'fridge', cost: 0, level: 1, w: 44, h: 36, giftOnly: true, modifiers: { tip: 1.05 } },
  { id: 'gift_chalk', name: 'Bảng phấn của Cô Lan', icon: '🖍️', model: 'chalk', cost: 0, level: 1, w: 44, h: 30, giftOnly: true, modifiers: { spawnRate: 1.05 } },
  { id: 'gift_owl', name: 'Tượng cú gỗ của Chú Hùng', icon: '🦉', model: 'owl', cost: 0, level: 1, w: 34, h: 34, giftOnly: true, modifiers: { dishPrice: 1.03 } },
  { id: 'gift_orchid', name: 'Chậu lan của Bà Tư', icon: '🌺', model: 'orchid', cost: 0, level: 1, w: 34, h: 34, giftOnly: true, modifiers: { patience: 1.06 } },
  { id: 'gift_birdcage', name: 'Lồng chim của Ông Sáu', icon: '🐦', model: 'birdcage', cost: 0, level: 1, w: 36, h: 36, giftOnly: true, modifiers: { tip: 1.06 } },
];

/** Thú cưng của quán (F5): nuôi 1 con một lúc, đổi qua lại giữa các con đã nhận nuôi miễn phí. */
export const pets: PetDef[] = [
  { id: 'cat', name: 'Mèo mướp Mướp', icon: '🐈', cost: 500, level: 2, desc: 'Lim dim cạnh bàn, khách vuốt ve nên kiên nhẫn hơn.', modifiers: { patience: 1.06 } },
  { id: 'dog', name: 'Cún vàng Lu', icon: '🐕', cost: 600, level: 3, desc: 'Vẫy đuôi đón khách, người qua đường ghé vào nhiều hơn.', modifiers: { spawnRate: 1.06 } },
];

/** Bàn lẻ mua thêm ở Siêu thị (B7). Mua được nhiều lần, miễn khu ăn uống còn chỗ. */
export const tableKinds: TableKindDef[] = [
  { id: 'pair', name: 'Bàn đôi', icon: '🪑', seats: 2, w: 70, h: 70, cost: 250, level: 2 },
  { id: 'square', name: 'Bàn bốn', icon: '🍽️', seats: 4, w: 120, h: 76, cost: 450, level: 3 },
  { id: 'long', name: 'Bàn dài sáu ghế', icon: '🎉', seats: 6, w: 200, h: 84, cost: 800, level: 4 },
];
