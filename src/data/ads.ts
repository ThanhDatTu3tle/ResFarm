/**
 * QUẢNG CÁO TRÊN BIỂN LED Ở CHỢ (trước sạp Thịt lợn cô Bủm). Biển chạy lần lượt từng mẫu, mỗi mẫu `seconds` giây.
 *
 * Hiện chỉ là quảng cáo vui trong game. Sau này game public có thể thay bằng quảng cáo thật: thêm mẫu có `image`
 * (đường dẫn ảnh tỉ lệ 16:9, vd '/ads/brand.png' trong thư mục public) — có ảnh thì biển vẽ ảnh thay cho chữ.
 */
export interface AdSlide {
  /** Dòng chữ lớn. */
  title: string;
  /** Dòng chữ nhỏ bên dưới. */
  sub?: string;
  icon?: string;
  /** Màu nền (hai màu chuyển sắc) và màu chữ. */
  bg: [string, string];
  color?: string;
  /** Ảnh quảng cáo (16:9). Có thì vẽ ảnh, bỏ qua chữ. */
  image?: string;
  seconds?: number;
}

export const AD_SLIDES: AdSlide[] = [
  { title: 'Quán Nhà Vườn', sub: 'Ngon như cơm nhà · Mở cửa mỗi ngày', icon: '🍲', bg: ['#e2574c', '#f2a23a'] },
  { title: 'Trà sữa 25caaaaa', sub: 'Mua 2 ly tặng thêm trân châu!', icon: '🧋', bg: ['#f4a7c0', '#9a6bd1'] },
  { title: 'Chanh Bạc Hà', sub: 'Thanh mát x2 · Sảng khoái cả ngày', icon: '🍋', bg: ['#5ec3ee', '#3fae4a'] },
  { title: 'Rau sạch nông trại', sub: 'Hái sáng nay · Bán chiều nay', icon: '🥬', bg: ['#3f9e57', '#a6d65a'] },
  { title: 'Xe buýt số 25', sub: 'Chợ ⇄ Bến xe · 10 phút một chuyến', icon: '🚌', bg: ['#2f6fb0', '#3fb6a8'] },
  { title: 'Chỗ này cho thuê!', sub: 'Đặt quảng cáo của bạn tại đây', icon: '📣', bg: ['#2f3a4a', '#5a6b84'], color: '#ffe27a' },
];
