import type { QuestDef } from './types';

/**
 * NHIỆM VỤ HỆ THỐNG — làm lần lượt từ trên xuống (dễ → khó), mỗi lúc một nhiệm vụ.
 * Xong thì người chơi bấm "Nhận thưởng" trên HUD để lấy thưởng và mở nhiệm vụ kế.
 * Thêm / đổi nhiệm vụ: sửa danh sách này (giữ nguyên id đã phát hành; thêm mới thì thêm vào CUỐI để save cũ không lệch).
 *
 * Loại mục tiêu (goal.kind):
 *   serve      phục vụ xong (khách trả tiền) N nhóm khách
 *   happy      N nhóm khách để lại tiền tip (phục vụ nhanh, khách vui)
 *   harvest    thu hoạch N lần ở nông trại (ruộng, chuồng, ao, ruộng lúa, nhà kính)
 *   produce    cối chế biến làm ra N thành phẩm
 *   unlock     mở khoá thêm N món (không tính món có sẵn từ đầu)
 *   revenue    doanh thu trong MỘT ngày đạt N xu
 *   reputation uy tín quán đạt N sao
 *   contract   giao N đơn hàng
 *   level      đạt cấp N
 *   tier       hạng quán đạt N
 *   kitchen    hạng bếp đạt N
 *   gardener   đang thuê N người làm vườn
 *   tool       đã sắm N dụng cụ nông trại
 *   day        mở quán tới ngày thứ N
 */

/** Tên các chương (chương 1 = phần tử 0). */
export const questChapters = ['Khai trương', 'Làm ăn khấm khá', 'Mở rộng cơ ngơi', 'Quán nổi tiếng'];
export const quests: QuestDef[] = [
  { id: 'first_guests', icon: '🍽️', title: 'Khai trương', desc: 'Phục vụ xong 3 nhóm khách', goal: { kind: 'serve', target: 3 }, reward: { money: 50, xp: 10 }, chapter: 1 },
  { id: 'green_thumb', icon: '🌱', title: 'Tay nhà nông', desc: 'Thu hoạch 4 lần ở nông trại', goal: { kind: 'harvest', target: 4 }, reward: { money: 60, xp: 15 }, chapter: 1 },
  { id: 'new_dish', icon: '📖', title: 'Thực đơn phong phú', desc: 'Mở khoá thêm 1 món mới', goal: { kind: 'unlock', target: 1 }, reward: { money: 100, xp: 20 }, chapter: 1 },
  { id: 'happy_guests', icon: '💖', title: 'Khách vui lòng', desc: '8 nhóm khách để lại tiền tip', goal: { kind: 'happy', target: 8 }, reward: { money: 150, xp: 30 }, chapter: 1 },
  { id: 'millwork', icon: '🌬️', title: 'Cối quay đều', desc: 'Cối xay làm ra 16 thành phẩm', goal: { kind: 'produce', target: 16 }, reward: { money: 200, xp: 40 }, chapter: 2 },
  { id: 'busy_day', icon: '🔥', title: 'Ngày đắt hàng', desc: 'Doanh thu một ngày đạt 600 xu', goal: { kind: 'revenue', target: 600 }, reward: { money: 300, xp: 60 }, chapter: 2 },
  { id: 'famous', icon: '⭐', title: 'Quán có tiếng', desc: 'Uy tín của quán đạt 4 sao', goal: { kind: 'reputation', target: 4 }, reward: { money: 500, xp: 100 }, chapter: 2 },
  // Giai đoạn 11: chuỗi dài thêm (thêm vào cuối để save cũ không lệch)
  { id: 'level_3', icon: '📈', title: 'Lên tay nghề', desc: 'Đạt cấp 3', goal: { kind: 'level', target: 3 }, reward: { money: 200, xp: 0 }, chapter: 2 },
  { id: 'contracts_3', icon: '📦', title: 'Mối hàng đầu tiên', desc: 'Giao 3 đơn hàng', goal: { kind: 'contract', target: 3 }, reward: { money: 250, xp: 50 }, chapter: 2 },
  { id: 'gardener_1', icon: '👩‍🌾', title: 'Thêm tay làm vườn', desc: 'Thuê 1 người làm vườn', goal: { kind: 'gardener', target: 1 }, reward: { money: 200, xp: 40 }, chapter: 3 },
  { id: 'tool_1', icon: '🧰', title: 'Sắm đồ nghề', desc: 'Mua 1 dụng cụ nông trại', goal: { kind: 'tool', target: 1 }, reward: { money: 150, xp: 30 }, chapter: 3 },
  { id: 'kitchen_2', icon: '🔥', title: 'Bếp đôi', desc: 'Nâng hạng bếp lên Bếp đôi', goal: { kind: 'kitchen', target: 2 }, reward: { money: 400, xp: 80 }, chapter: 3 },
  { id: 'tier_2', icon: '🏠', title: 'Quán rộng rãi', desc: 'Nâng hạng quán lên hạng 2', goal: { kind: 'tier', target: 2 }, reward: { money: 400, xp: 80 }, chapter: 3 },
  { id: 'harvest_40', icon: '🧺', title: 'Vựa rau nhà vườn', desc: 'Thu hoạch 40 lần', goal: { kind: 'harvest', target: 40 }, reward: { money: 350, xp: 70 }, chapter: 3 },
  { id: 'season_1', icon: '🌸', title: 'Trọn một mùa', desc: 'Mở quán tới ngày 15 (qua hết mùa Xuân)', goal: { kind: 'day', target: 15 }, reward: { money: 400, xp: 80 }, chapter: 3 },
  { id: 'level_5', icon: '🎓', title: 'Chủ quán lành nghề', desc: 'Đạt cấp 5', goal: { kind: 'level', target: 5 }, reward: { money: 500, xp: 0 }, chapter: 4 },
  { id: 'serve_80', icon: '🍜', title: 'Khách nườm nượp', desc: 'Phục vụ xong 80 nhóm khách', goal: { kind: 'serve', target: 80 }, reward: { money: 600, xp: 120 }, chapter: 4 },
  { id: 'kitchen_3', icon: '🏅', title: 'Bếp chuyên nghiệp', desc: 'Nâng hạng bếp lên Bếp chuyên nghiệp', goal: { kind: 'kitchen', target: 3 }, reward: { money: 800, xp: 160 }, chapter: 4 },
  { id: 'busy_day_2', icon: '💸', title: 'Ngày hốt bạc', desc: 'Doanh thu một ngày đạt 1500 xu', goal: { kind: 'revenue', target: 1500 }, reward: { money: 800, xp: 160 }, chapter: 4 },
  { id: 'contracts_15', icon: '🚚', title: 'Nhà cung cấp uy tín', desc: 'Giao 15 đơn hàng', goal: { kind: 'contract', target: 15 }, reward: { money: 900, xp: 180 }, chapter: 4 },
  { id: 'famous_5', icon: '🌟', title: 'Danh tiếng lẫy lừng', desc: 'Uy tín của quán đạt 4.8 sao', goal: { kind: 'reputation', target: 4.8 }, reward: { money: 1200, xp: 240 }, chapter: 4 },
  { id: 'year_1', icon: '🎂', title: 'Tròn một năm', desc: 'Mở quán tới ngày 57 (đi hết bốn mùa)', goal: { kind: 'day', target: 57 }, reward: { money: 1500, xp: 300 }, chapter: 4 },
];
