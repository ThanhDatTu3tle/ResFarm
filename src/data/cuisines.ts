import type { CuisineDef } from './types';

/**
 * Bốn phong cách quán chọn ở màn hình mở đầu (Quán Ốc là quán vỉa hè: xe đẩy + bếp nướng dưới sạp dù, không có tường / WC / kho). Mỗi phong cách có thực đơn riêng (RecipeDef.cuisine)
 * và nội thất mặc định riêng (DecorDef.cuisine); nông trại và chợ dùng chung.
 * Hình mặt tiền + đồ trang trí trong quán: src/ui/three/cuisine.ts.
 */
export const cuisines: CuisineDef[] = [
  {
    id: 'jp',
    name: 'Quán Nhật',
    country: 'Nhật Bản',
    flag: '🇯🇵',
    blurb: 'Rèm noren, đèn lồng giấy, quầy sushi gỗ — sushi, cơm cuộn, mì ramen.',
    showcase: ['sushi_salmon', 'maki', 'ramen'],
    accent: '#d9534a',
    startInventory: [{ item: 'egg', qty: 30 }, { item: 'seaweed', qty: 24 }, { item: 'tofu', qty: 12 }],
  },
  {
    id: 'kr',
    name: 'Quán Hàn',
    country: 'Hàn Quốc',
    flag: '🇰🇷',
    blurb: 'Bàn nướng có ống hút khói, biển đèn neon — tokbokki, gà rán, kimbap.',
    showcase: ['tteokbokki', 'kr_fried_chicken', 'kimbap'],
    accent: '#3f6fd2',
    startInventory: [{ item: 'egg', qty: 30 }, { item: 'cabbage', qty: 24 }, { item: 'seaweed', qty: 16 }, { item: 'carrot', qty: 12 }, { item: 'chili', qty: 12 }],
  },
  {
    id: 'vn',
    name: 'Quán Việt',
    country: 'Việt Nam',
    flag: '🇻🇳',
    blurb: 'Đèn lồng Hội An, quạt trần, ghế nhựa đỏ — cơm gia đình, phở, bún bò, cơm tấm.',
    showcase: ['pho', 'bun_bo', 'com_tam'],
    accent: '#e2a028',
    startInventory: [{ item: 'egg', qty: 30 }, { item: 'cabbage', qty: 24 }, { item: 'tomato', qty: 24 }],
  },
  {
    id: 'oc',
    name: 'Quán Ốc',
    country: 'Vỉa hè',
    flag: '🐚',
    blurb: 'Xe đẩy ốc và bếp nướng than dưới sạp dù, ghế nhựa xanh đỏ, dây đèn vàng — hàu nướng, nghêu hấp, ốc hương.',
    showcase: ['hau_nuong_mo_hanh', 'ngheu_hap_thai', 'oc_huong_sot_pho_mai'],
    accent: '#e2703a',
    startInventory: [{ item: 'ngheu', qty: 24 }, { item: 'shrimp', qty: 18 }, { item: 'hau', qty: 18 }, { item: 'scallion', qty: 16 }, { item: 'chili', qty: 12 }],
  },
];
