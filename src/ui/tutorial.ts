import { esc } from './dom';

/**
 * HƯỚNG DẪN CHƠI: vài trang ngắn, mở từ màn mở đầu (nút "Hướng dẫn chơi") hoặc trong game (Cài đặt → Hướng dẫn).
 * Chỉ là chữ + biểu tượng, không đụng state. Thêm trang: thêm 1 mục vào GUIDE.
 */
export interface GuidePage {
  icon: string;
  title: string;
  /** Mỗi dòng một ý; `**chữ**` in đậm. */
  points: string[];
}

export const GUIDE: GuidePage[] = [
  {
    icon: '🍲',
    title: 'Chào mừng tới Quán Nhà Vườn',
    points: [
      'Bạn là **chủ quán kiêm bồi bàn**: đón khách, bưng món, trồng rau nuôi gà, đi chợ.',
      'Một ngày từ 06:00 tới 24:00, chừng **12 phút** chơi. Quán mở 2 ca: **07:00–12:00** và **15:00–21:00**.',
      'Khách vui thì trả tiền + tip, quán lên **uy tín ⭐** và **cấp**, mở được món mới, nâng hạng quán, nâng hạng bếp.',
      'Thẻ **nhiệm vụ** cạnh số tiền dẫn bạn đi từng bước — làm theo là quen tay.',
    ],
  },
  {
    icon: '🙋',
    title: 'Đón khách',
    points: [
      'Khách vào ngồi, trên đầu hiện bong bóng **📖**: bấm vào khách (hoặc bàn) để mang menu.',
      'Khách chọn xong hiện **📝**: bấm tiếp để ghi món, đơn chuyển vào bếp.',
      'Mặt khách đổi dần 😄 → 😠 nếu chờ lâu; chờ quá thì **bỏ về** và quán mất uy tín.',
      'Khách ăn xong để lại chén dĩa dơ: bấm bàn để dọn. Hết ca sàn có **vết bẩn** — bấm một cái để lau.',
    ],
  },
  {
    icon: '🔔',
    title: 'Quầy line và màu bàn',
    points: [
      'Gọi món xong, mỗi bàn được một **màu**: bong bóng của khách đổi sang màu đó, đĩa của bàn trên quầy line có vòng cùng màu.',
      'Đầu bếp nấu xong đặt đĩa lên **quầy line**. **Bấm quầy**: bồi bàn ra lấy món nấu xong sớm nhất, **tối đa 2 món** một lượt.',
      'Món đang cầm hiện trên đầu bồi bàn với màu của bàn đã gọi — **bấm bàn cùng màu** để giao.',
      'Quầy line đầy đĩa thì bếp phải chờ — nhớ bưng món đều tay.',
    ],
  },
  {
    icon: '🌾',
    title: 'Nông trại',
    points: [
      'Bấm một ô đất: **bác nông dân** chạy tới cuốc → gieo → tưới → thu. Trời mưa khỏi tưới.',
      'Rau củ chỉ gieo ngoài trời **đúng mùa**; **nhà kính** trồng quanh năm.',
      'Chuồng cho trứng, sữa, thịt; ao cho cá, tôm; vườn cây cho trái cây.',
      'Ruộng lúa có **máy cày** tự thu và chở lúa tới **cối xay** làm bột, mì, bún.',
      'Bảng **Nhà nông** 🧰: thuê **người làm vườn** (bật việc thu hoạch, chuồng ao, tưới, gieo lại — họ tự làm) và sắm **dụng cụ** cho cả nhà làm nhanh hơn.',
    ],
  },
  {
    icon: '🧺',
    title: 'Chợ, Kho và Thực đơn',
    points: [
      'Thiếu nguyên liệu thì ra **Chợ**: bấm sạp để vào bên trong, bấm khay hàng để mua 1 / 5 / 10. Giá đổi mỗi ngày.',
      '**Kho** cho biết còn gì; **Thực đơn** để bật / tắt món đang bán và học món mới.',
      'Món nào **sắp hết nguyên liệu** sẽ có cảnh báo ⚠️ dưới số tiền — bấm vào để xem.',
    ],
  },
  {
    icon: '👥',
    title: 'Đội ngũ',
    points: [
      'Mỗi người có **năng lượng ⚡**: nấu một món, bưng một khay đều tốn sức; cạn là **xỉu**.',
      'Giờ nghỉ trưa và tối cả đội ra chợ ăn: bạn **chọn món** cho từng người rồi trả hoá đơn.',
      '**Nâng hạng bếp** (bảng Quán) để quầy line chứa nhiều đĩa hơn và **thuê thêm đầu bếp**.',
      'Có từ 2 đầu bếp, vào bảng **Nhân viên** giao cho mỗi người **nấu món nào**; nhân viên phục vụ thì giao việc bưng món, ghi món, dọn bàn, lau sàn — họ tự làm.',
    ],
  },
  {
    icon: '🌸',
    title: 'Mùa và lễ hội',
    points: [
      'Một năm **4 mùa**, mỗi mùa **14 ngày**. Mùa Đông ngoài trời đóng băng, chỉ nhà kính trồng được.',
      '**Món hợp mùa** bán đắt hơn; rau đúng mùa ở chợ rẻ hơn.',
      'Ngày lễ (Tết, Lễ hội pháo hoa, Trung thu, Giáng sinh, Tất niên) khách rất đông — chuẩn bị nguyên liệu từ hôm trước.',
    ],
  },
  {
    icon: '🎮',
    title: 'Điều khiển',
    points: [
      '**Kéo** để xoay camera, **lăn chuột / chụm hai ngón** để zoom vào chỗ bất kỳ, **bấm đúp** để về góc cũ.',
      'Nút tròn bên phải (dưới đồng hồ): Nông trại, Người làm vườn, Quán, Nhân viên. 🏆 Thành tựu cạnh tiền. Siêu thị ở thanh dưới; bảng Chợ mở khi bấm sạp ngoài chợ. Nút xanh dưới cùng: **chuyển khu**.',
      '**Space** tạm dừng / chạy tiếp; ⚙️ Cài đặt chỉnh tốc độ, âm thanh và mở lại hướng dẫn này.',
    ],
  },
];

const bold = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

/**
 * Một trang hướng dẫn. `attr(action)` trả thuộc tính bấm của nơi dùng (màn mở đầu dùng data-title, trong game dùng data-ui);
 * các hành động: `guide:<số trang>` và `guide:close`. `finish` = nhãn nút ở trang cuối.
 */
export function guideHtml(page: number, attr: (action: string) => string, finish: string): string {
  const p = GUIDE[Math.max(0, Math.min(GUIDE.length - 1, page))];
  const i = GUIDE.indexOf(p);
  const last = i === GUIDE.length - 1;
  const dots = GUIDE.map((_, k) => `<button class="guide-dot${k === i ? ' on' : ''}"${attr(`guide:${k}`)} aria-label="Trang ${k + 1}"></button>`).join('');
  return `<div class="backdrop guide-backdrop" data-key="guide">
    <div class="dialog guide" role="dialog" aria-label="Hướng dẫn chơi">
      <div class="dialog-head"><h2><span class="guide-icon">${p.icon}</span> ${esc(p.title)}</h2><button class="x-close"${attr('guide:close')} aria-label="Đóng">✕</button></div>
      <ul class="guide-points">${p.points.map((s) => `<li>${bold(s)}</li>`).join('')}</ul>
      <div class="guide-foot">
        <button${attr(`guide:${i - 1}`)}${i === 0 ? ' disabled' : ''}>‹ Trước</button>
        <div class="guide-dots">${dots}<span class="muted">${i + 1}/${GUIDE.length}</span></div>
        ${last ? `<button class="primary"${attr('guide:close')}>${esc(finish)}</button>` : `<button class="primary"${attr(`guide:${i + 1}`)}>Tiếp ›</button>`}
      </div>
    </div>
  </div>`;
}
