import type { CuisineId, RecipeDef } from './types';

/**
 * Thực đơn của cả 3 phong cách quán. Mỗi món thuộc đúng một quán (`cuisine`); người chơi chỉ thấy món của quán mình.
 * Thêm món mới: thêm 1 dòng `dish(...)` ở đây. Không cần sửa code nào khác
 * (muốn có model 3D riêng thì thêm vào DISHES trong src/ui/three/models.ts, không có thì quán hiện emoji).
 *
 * dish(quán, id, tên, biểu tượng, nguyên liệu "id:số lượng ...", độ khó (8..40), giá, cấp mở, tiền mở, độ ưa chuộng?)
 * cấp 1 + tiền 0 = món có sẵn từ đầu.
 */
/**
 * Số "phút nấu" bên dưới là ĐỘ KHÓ tương đối của món (8 = dễ nhất … 40 = khó nhất, giữ từ bản cũ).
 * `cookMinutes` đổi ra phút game sao cho bếp trưởng (tốc độ 1.6, chưa nâng cấp) nấu xong trong 4 → 10 giây thực.
 */
const COOK_EASY = 8;
const COOK_HARD = 40;
const COOK_SECONDS: [number, number] = [4, 10];
const HEAD_CHEF_SPEED = 1.6;
const MINUTES_PER_SECOND = 1.5;
function cookMinutes(difficulty: number): number {
  const k = Math.max(0, Math.min(1, (difficulty - COOK_EASY) / (COOK_HARD - COOK_EASY)));
  const seconds = COOK_SECONDS[0] + k * (COOK_SECONDS[1] - COOK_SECONDS[0]);
  return Math.round(seconds * MINUTES_PER_SECOND * HEAD_CHEF_SPEED * 10) / 10;
}

function dish(cuisine: CuisineId, id: string, name: string, icon: string, ingredients: string, cookTime: number, price: number, level: number, cost: number, popularity?: number): RecipeDef {
  return {
    id,
    name,
    icon,
    cuisine,
    ingredients: ingredients.split(' ').map((s) => {
      const [item, qty] = s.split(':');
      return { item, qty: Number(qty ?? 1) };
    }),
    cookTime: cookMinutes(cookTime),
    price,
    unlock: { level, cost },
    ...(popularity != null ? { popularity } : {}),
  };
}

export const recipes: RecipeDef[] = [
  // ---------- 🇻🇳 Quán Việt ----------
  dish('vn', 'egg_rice', 'Cơm trứng chiên', '🍳', 'rice oil egg:2', 15, 18, 1, 0),
  dish('vn', 'stir_cabbage', 'Rau cải xào', '🥗', 'cabbage:2 oil salt', 12, 16, 1, 0),
  dish('vn', 'tomato_soup', 'Canh cà chua trứng', '🍲', 'tomato:2 egg water', 18, 22, 1, 0),
  dish('vn', 'chicken_rice', 'Cơm gà', '🍛', 'rice chicken onion', 25, 38, 2, 150),
  dish('vn', 'banh_mi', 'Bánh mì thịt', '🥖', 'bread pork cucumber', 15, 36, 2, 180, 1.3),
  dish('vn', 'com_tam', 'Cơm tấm sườn', '🍱', 'rice pork egg fish_sauce', 28, 42, 2, 180, 1.3),
  dish('vn', 'braised_pork', 'Thịt kho trứng', '🥘', 'pork egg:2 fish_sauce', 30, 44, 2, 200),
  dish('vn', 'hu_tieu', 'Hủ tiếu Nam Vang', '🍜', 'rice_noodle pork shrimp water', 26, 46, 2, 250),
  dish('vn', 'flan', 'Bánh flan', '🍮', 'egg:2 milk:2', 20, 34, 3, 300, 0.7),
  dish('vn', 'fruit_plate', 'Đĩa trái cây', '🍉', 'orange apple mango', 8, 30, 1, 60, 0.8),
  dish('vn', 'che_chuoi', 'Chè chuối', '🍌', 'banana:2 milk', 14, 26, 2, 120, 0.7),
  dish('vn', 'fried_fish', 'Cá chiên sốt cà', '🐠', 'fish tomato:2 oil', 28, 50, 3, 350),
  dish('vn', 'pho', 'Phở bò', '🍜', 'noodle beef onion water', 30, 58, 3, 400, 1.4),
  dish('vn', 'bun_bo', 'Bún bò Huế', '🌶️', 'rice_noodle beef chili water', 32, 60, 3, 450, 1.2),
  dish('vn', 'com_gia_dinh', 'Cơm gia đình', '🍚', 'rice pork cabbage tomato egg', 40, 78, 4, 500, 1.1),
  dish('vn', 'chili_shrimp', 'Tôm rang ớt', '🍤', 'shrimp:3 chili onion', 25, 66, 4, 600),
  dish('vn', 'stir_squid', 'Mực xào sa tế', '🦑', 'squid:2 onion chili', 25, 68, 4, 600),
  dish('vn', 'chicken_curry', 'Cà ri gà', '🫕', 'chicken potato:2 carrot milk', 35, 72, 4, 650),
  dish('vn', 'shaking_beef', 'Bò lúc lắc', '🍖', 'beef:2 potato onion', 35, 96, 5, 1000),

  // ---------- 🇯🇵 Quán Nhật ----------
  dish('jp', 'onigiri', 'Cơm nắm onigiri', '🍙', 'rice seaweed salt', 12, 16, 1, 0, 1.2),
  dish('jp', 'tamagoyaki', 'Trứng cuộn tamagoyaki', '🍳', 'egg:2 soy_sauce oil', 15, 20, 1, 0),
  dish('jp', 'fruit_sando', 'Sandwich trái cây', '🥪', 'bread orange apple milk', 10, 32, 1, 60, 0.8),
  dish('jp', 'miso_soup', 'Súp miso', '🥣', 'tofu seaweed miso water', 15, 20, 1, 0),
  dish('jp', 'maki', 'Cơm cuộn maki', '🍣', 'rice seaweed cucumber fish', 22, 36, 2, 150, 1.2),
  dish('jp', 'teriyaki', 'Gà teriyaki', '🍗', 'chicken soy_sauce rice', 25, 40, 2, 200),
  dish('jp', 'katsu_sando', 'Sandwich heo chiên xù', '🥪', 'bread pork flour', 22, 50, 3, 300),
  dish('jp', 'sushi_salmon', 'Sushi cá hồi', '🍣', 'rice salmon', 20, 48, 3, 300, 1.4),
  dish('jp', 'tempura', 'Tôm tempura', '🍤', 'shrimp:2 flour oil', 24, 50, 3, 350),
  dish('jp', 'ramen', 'Mì ramen', '🍜', 'wheat_noodle pork egg miso water', 32, 58, 3, 400, 1.4),
  dish('jp', 'udon', 'Mì udon nấm', '🍲', 'wheat_noodle mushroom soy_sauce water', 26, 46, 3, 350),
  dish('jp', 'takoyaki', 'Bánh takoyaki', '🐙', 'flour squid egg', 24, 54, 4, 500, 1.1),
  dish('jp', 'katsudon', 'Cơm heo chiên xù', '🍛', 'rice pork egg flour', 32, 66, 4, 600),
  dish('jp', 'sashimi', 'Sashimi thập cẩm', '🐟', 'salmon:2 fish', 22, 84, 4, 700),
  dish('jp', 'gyudon', 'Cơm bò gyudon', '🥩', 'rice beef:2 onion soy_sauce', 32, 92, 5, 1000),

  // ---------- 🇰🇷 Quán Hàn ----------
  dish('kr', 'kimbap', 'Cơm cuộn kimbap', '🍙', 'rice seaweed carrot egg', 18, 22, 1, 0, 1.2),
  dish('kr', 'kimchi', 'Kimchi cải thảo', '🥬', 'cabbage:2 chili gochujang', 12, 16, 1, 0),
  dish('kr', 'gyeran_jjim', 'Trứng hấp gyeran-jjim', '🥚', 'egg:2 water salt', 15, 20, 1, 0),
  dish('kr', 'hwachae', 'Trà trái cây hwachae', '🍹', 'apple orange banana water', 8, 30, 1, 60, 0.8),
  dish('kr', 'tteokbokki', 'Tokbokki', '🍢', 'rice_cake:2 gochujang onion', 20, 34, 2, 150, 1.4),
  dish('kr', 'kr_fried_chicken', 'Gà rán Hàn Quốc', '🍗', 'chicken flour oil gochujang', 28, 46, 2, 250, 1.4),
  dish('kr', 'gilgeori_toast', 'Bánh mì nướng đường phố', '🍞', 'bread egg cabbage', 15, 30, 2, 150, 1.2),
  dish('kr', 'ramyeon', 'Mì cay ramyeon', '🍜', 'wheat_noodle egg chili water', 22, 38, 2, 200),
  dish('kr', 'kimchi_stew', 'Canh kimchi jjigae', '🍲', 'cabbage pork tofu gochujang', 30, 50, 3, 350),
  dish('kr', 'bibimbap', 'Cơm trộn bibimbap', '🥗', 'rice egg carrot mushroom beef', 30, 58, 3, 400, 1.2),
  dish('kr', 'sundubu', 'Canh đậu phụ non cay', '🥘', 'tofu:2 shrimp egg gochujang', 28, 54, 3, 400),
  dish('kr', 'bulgogi', 'Bò nướng bulgogi', '🥩', 'beef onion soy_sauce', 32, 72, 4, 600, 1.1),
  dish('kr', 'samgyeopsal', 'Ba chỉ nướng', '🥓', 'pork:2 cabbage', 30, 66, 4, 550),
  dish('kr', 'pajeon', 'Bánh xèo hải sản pajeon', '🥞', 'flour squid shrimp egg', 30, 80, 5, 900),
  dish('kr', 'galbijjim', 'Sườn bò om galbi-jjim', '🍖', 'beef:2 carrot potato soy_sauce', 40, 98, 5, 1100),

  // ---------- 🐚 Quán Ốc (vỉa hè) ----------
  dish('oc', 'tom_nuong', 'Tôm nướng', '🍤', 'shrimp:3 chili salt', 14, 44, 1, 0),
  dish('oc', 'ngheu_hap_thai', 'Nghêu hấp thái', '🍲', 'ngheu:4 chili water', 16, 48, 1, 0),
  dish('oc', 'hau_nuong_mo_hanh', 'Hàu nướng mỡ hành', '🦪', 'hau:3 scallion oil', 15, 58, 1, 0),
  dish('oc', 'mi_xao_oc_mong_tay', 'Mì xào ốc móng tay', '🍝', 'wheat_noodle oc_mong_tay:2 cabbage oil', 22, 46, 2, 150),
  dish('oc', 'oc_bu_nhoi_thit', 'Ốc bươu nhồi thịt', '🐌', 'oc_bu:3 pork onion', 30, 60, 2, 200),
  dish('oc', 'so_diep_nuong_mo_hanh', 'Sò điệp nướng mỡ hành', '🐚', 'so_diep:3 scallion oil', 18, 66, 2, 250),
  dish('oc', 'hau_nuong_pho_mai', 'Hàu nướng phô mai', '🧀', 'hau:3 cheese', 20, 66, 3, 300),
  dish('oc', 'so_diep_nuong_pho_mai', 'Sò điệp nướng phô mai', '🧀', 'so_diep:3 cheese', 22, 74, 3, 350),
  dish('oc', 'oc_huong_sot_pho_mai', 'Ốc hương sốt phô mai', '🐚', 'oc_huong:3 cheese milk', 28, 78, 4, 500),
];

/**
 * Món hợp mùa (0 Xuân, 1 Hạ, 2 Thu, 3 Đông): đúng mùa bán đắt hơn (`balance.seasons.dishBonus`).
 * Xuân món tươi mát, Hạ món lạnh / trái cây, Thu món nướng / om, Đông món nước nóng.
 */
const SEASONAL: Record<string, number[]> = {
  // Quán Việt
  banh_mi: [0], stir_cabbage: [0], com_tam: [0],
  che_chuoi: [1], fruit_plate: [1], flan: [1],
  braised_pork: [2], chicken_curry: [2], shaking_beef: [2],
  pho: [3], bun_bo: [3], hu_tieu: [3], tomato_soup: [3],
  // Quán Nhật
  onigiri: [0], maki: [0], sushi_salmon: [0],
  fruit_sando: [1], sashimi: [1], takoyaki: [1],
  teriyaki: [2], gyudon: [2], katsudon: [2],
  ramen: [3], udon: [3], miso_soup: [3],
  // Quán Hàn
  kimbap: [0], bibimbap: [0], pajeon: [0],
  hwachae: [1], kr_fried_chicken: [1],
  samgyeopsal: [2], bulgogi: [2], galbijjim: [2],
  kimchi_stew: [3], sundubu: [3], ramyeon: [3],
  // Quán Ốc
  so_diep_nuong_mo_hanh: [0], mi_xao_oc_mong_tay: [0],
  tom_nuong: [1], ngheu_hap_thai: [1], hau_nuong_mo_hanh: [1],
  oc_bu_nhoi_thit: [2], so_diep_nuong_pho_mai: [2],
  hau_nuong_pho_mai: [3], oc_huong_sot_pho_mai: [3],
};
for (const r of recipes) if (SEASONAL[r.id]) r.seasons = SEASONAL[r.id];
