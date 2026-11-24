/**
 * SỔ THÀNH TỰU — huy hiệu cho người chơi lâu. Đạt mốc thì hiện huy hiệu và nhận thưởng một lần.
 * Thêm thành tựu: thêm 1 mục (giữ nguyên id đã phát hành). Chỉ số (`stat`) xem `achievementValue` trong sim/systems/achievements.ts:
 *   serve      số nhóm khách đã phục vụ xong (đếm từ giai đoạn 11)
 *   happy      số nhóm khách để lại tip
 *   harvest    số lần thu hoạch ở nông trại
 *   produce    số thành phẩm cối làm ra
 *   contract   số đơn hàng đã giao
 *   revenue    tổng doanh thu từ đầu ván
 *   day        đang ở ngày thứ mấy
 *   level      cấp độ
 *   reputation uy tín (sao)
 *   recipes    số món đã mở khoá
 *   gardener   số người làm vườn đang thuê
 *   tool       số dụng cụ nông trại đã sắm
 *   friends    số bạn bè online nhiều nhất từng có (UI báo vào sim bằng lệnh `achievement/friends` mỗi lần tải danh sách bạn)
 */
export type AchievementStat = 'serve' | 'happy' | 'harvest' | 'produce' | 'contract' | 'revenue' | 'day' | 'level' | 'reputation' | 'recipes' | 'gardener' | 'tool' | 'friends';

export interface AchievementDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  stat: AchievementStat;
  target: number;
  reward: { money?: number; xp?: number };
}

export const achievements: AchievementDef[] = [
  { id: 'serve_50', icon: '🍽️', name: 'Quán quen', desc: 'Phục vụ xong 50 nhóm khách', stat: 'serve', target: 50, reward: { money: 150, xp: 30 } },
  { id: 'serve_200', icon: '🍜', name: 'Quán đông khách', desc: 'Phục vụ xong 200 nhóm khách', stat: 'serve', target: 200, reward: { money: 400, xp: 80 } },
  { id: 'serve_1000', icon: '🏮', name: 'Quán trăm năm', desc: 'Phục vụ xong 1000 nhóm khách', stat: 'serve', target: 1000, reward: { money: 1500, xp: 300 } },
  { id: 'happy_30', icon: '😊', name: 'Nụ cười đầu tiên', desc: '30 nhóm khách để lại tiền tip', stat: 'happy', target: 30, reward: { money: 120, xp: 25 } },
  { id: 'happy_150', icon: '💖', name: 'Khách thương', desc: '150 nhóm khách để lại tiền tip', stat: 'happy', target: 150, reward: { money: 400, xp: 80 } },
  { id: 'happy_500', icon: '💝', name: 'Ai cũng mến', desc: '500 nhóm khách để lại tiền tip', stat: 'happy', target: 500, reward: { money: 1200, xp: 250 } },
  { id: 'harvest_50', icon: '🧺', name: 'Một giỏ đầy', desc: 'Thu hoạch 50 lần', stat: 'harvest', target: 50, reward: { money: 120, xp: 25 } },
  { id: 'harvest_200', icon: '🥕', name: 'Mùa bội thu', desc: 'Thu hoạch 200 lần', stat: 'harvest', target: 200, reward: { money: 400, xp: 80 } },
  { id: 'harvest_800', icon: '🚜', name: 'Đại điền chủ', desc: 'Thu hoạch 800 lần', stat: 'harvest', target: 800, reward: { money: 1200, xp: 250 } },
  { id: 'produce_50', icon: '🌬️', name: 'Cối quay vù vù', desc: 'Cối làm ra 50 thành phẩm', stat: 'produce', target: 50, reward: { money: 150, xp: 30 } },
  { id: 'produce_300', icon: '🍞', name: 'Lò bột của làng', desc: 'Cối làm ra 300 thành phẩm', stat: 'produce', target: 300, reward: { money: 500, xp: 100 } },
  { id: 'contract_5', icon: '📦', name: 'Giao hàng tận tình', desc: 'Giao 5 đơn hàng', stat: 'contract', target: 5, reward: { money: 150, xp: 30 } },
  { id: 'contract_25', icon: '🚚', name: 'Mối hàng tin cậy', desc: 'Giao 25 đơn hàng', stat: 'contract', target: 25, reward: { money: 600, xp: 120 } },
  { id: 'revenue_5k', icon: '💰', name: 'Hũ tiền đầu tiên', desc: 'Tổng doanh thu đạt 5.000 xu', stat: 'revenue', target: 5000, reward: { money: 200, xp: 40 } },
  { id: 'revenue_30k', icon: '💎', name: 'Làm ăn phát đạt', desc: 'Tổng doanh thu đạt 30.000 xu', stat: 'revenue', target: 30000, reward: { money: 800, xp: 160 } },
  { id: 'revenue_100k', icon: '👑', name: 'Đại gia ẩm thực', desc: 'Tổng doanh thu đạt 100.000 xu', stat: 'revenue', target: 100000, reward: { money: 2000, xp: 400 } },
  { id: 'season_1', icon: '🌸', name: 'Qua mùa đầu tiên', desc: 'Mở quán hết một mùa (14 ngày)', stat: 'day', target: 15, reward: { money: 200, xp: 40 } },
  { id: 'year_1', icon: '🎂', name: 'Tròn một năm', desc: 'Mở quán hết bốn mùa', stat: 'day', target: 57, reward: { money: 1000, xp: 200 } },
  { id: 'level_5', icon: '⭐', name: 'Chủ quán lành nghề', desc: 'Đạt cấp 5', stat: 'level', target: 5, reward: { money: 300, xp: 0 } },
  { id: 'rep_45', icon: '🌟', name: 'Năm sao lấp lánh', desc: 'Uy tín quán đạt 4.5 sao', stat: 'reputation', target: 4.5, reward: { money: 600, xp: 120 } },
  { id: 'recipes_8', icon: '📖', name: 'Thực đơn dày cộp', desc: 'Mở khoá 8 món', stat: 'recipes', target: 8, reward: { money: 300, xp: 60 } },
  { id: 'gardener_3', icon: '👩‍🌾', name: 'Đội làm vườn', desc: 'Thuê đủ 3 người làm vườn', stat: 'gardener', target: 3, reward: { money: 400, xp: 80 } },
  // Giai đoạn 20: bạn bè online (bản không nối máy chủ thì bảng Thành tựu ẩn mục này)
  { id: 'friends_3', icon: '🤝', name: 'Hội bạn thân', desc: 'Kết bạn với 3 người chơi khác (🤝 Bạn bè)', stat: 'friends', target: 3, reward: { money: 300, xp: 60 } },
  { id: 'tool_all', icon: '🧰', name: 'Đủ đồ nghề', desc: 'Sắm đủ 4 dụng cụ nông trại', stat: 'tool', target: 4, reward: { money: 400, xp: 80 } },
];
