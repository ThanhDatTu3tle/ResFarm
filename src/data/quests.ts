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
 */
export const quests: QuestDef[] = [
  { id: 'first_guests', icon: '🍽️', title: 'Khai trương', desc: 'Phục vụ xong 3 nhóm khách', goal: { kind: 'serve', target: 3 }, reward: { money: 50, xp: 10 } },
  { id: 'green_thumb', icon: '🌱', title: 'Tay nhà nông', desc: 'Thu hoạch 4 lần ở nông trại', goal: { kind: 'harvest', target: 4 }, reward: { money: 60, xp: 15 } },
  { id: 'new_dish', icon: '📖', title: 'Thực đơn phong phú', desc: 'Mở khoá thêm 1 món mới', goal: { kind: 'unlock', target: 1 }, reward: { money: 100, xp: 20 } },
  { id: 'happy_guests', icon: '💖', title: 'Khách vui lòng', desc: '8 nhóm khách để lại tiền tip', goal: { kind: 'happy', target: 8 }, reward: { money: 150, xp: 30 } },
  { id: 'millwork', icon: '🌬️', title: 'Cối quay đều', desc: 'Cối xay làm ra 16 thành phẩm', goal: { kind: 'produce', target: 16 }, reward: { money: 200, xp: 40 } },
  { id: 'busy_day', icon: '🔥', title: 'Ngày đắt hàng', desc: 'Doanh thu một ngày đạt 600 xu', goal: { kind: 'revenue', target: 600 }, reward: { money: 300, xp: 60 } },
  { id: 'famous', icon: '⭐', title: 'Quán có tiếng', desc: 'Uy tín của quán đạt 4 sao', goal: { kind: 'reputation', target: 4 }, reward: { money: 500, xp: 100 } },
];
