import type { ModifierKey } from './types';

/**
 * SỰ KIỆN NGẪU NHIÊN trong quán: mỗi ngày (trừ ngày đầu và ngày lễ) có xác suất `balance.events.chance` xảy ra 1 sự kiện,
 * vào một giờ ngẫu nhiên trong ca. Thêm sự kiện: thêm 1 mục ở đây; kiểu mới (`kind`) thì thêm nhánh trong systems/events.ts.
 *  - critic: một vị khách đặc biệt tới quán; phục vụ vui vẻ thì thưởng, để khách bực / bỏ về thì mất uy tín.
 *  - inspector: thanh tra vệ sinh kiểm tra lúc tới: sàn sạch, bàn sạch thì thưởng; mỗi vết bẩn / bàn dơ bị phạt.
 *  - modifier: hiệu ứng nhân vào `modifier()` trong `duration` phút (xe du lịch, mất điện, khách sộp...).
 *  - tour: minibus du lịch đỗ trước quán, một đoàn khách vào ngồi kín 100% bàn còn trống (`Party.tour`); xe đợi tới khi
 *    cả đoàn ăn xong ra về.
 *  - police: (chỉ quán ốc vỉa hè) công an khu vực ghé nhắc lấn chiếm lề đường - game dừng, chủ quán chọn "bồi dưỡng"
 *    (`bribe`: [hạng 1, hạng cao nhất] xu, theo hạng quán) hoặc để công an thu một bàn đôi (lệnh `event/police`).
 */
export interface EventDef {
  id: string;
  name: string;
  icon: string;
  kind: 'critic' | 'inspector' | 'modifier' | 'police' | 'tour';
  /** Chỉ xảy ra ở các phong cách quán này (bỏ trống = mọi quán). */
  cuisines?: string[];
  /** police: số xu "bồi dưỡng" ở hạng quán thấp nhất / cao nhất (ở giữa chia đều theo hạng). */
  bribe?: [number, number];
  weight: number;
  /** Báo trước từ sáng (critic, inspector) - người chơi có thời gian chuẩn bị. */
  announce?: string;
  /** Lời báo lúc sự kiện bắt đầu. */
  start: string;
  duration?: number;
  effects?: Partial<Record<ModifierKey, number>>;
  /** Thưởng khi thành công (xu, uy tín). */
  reward?: { money: number; rep: number };
  /** Phạt khi thất bại: critic = uy tín mất; inspector = xu phạt mỗi chỗ bẩn (tối đa `max`) + uy tín. */
  penalty?: { money: number; rep: number; max?: number };
}

export const events: EventDef[] = [
  {
    id: 'critic',
    name: 'Nhà phê bình ẩm thực',
    icon: '🧐',
    kind: 'critic',
    weight: 3,
    announce: 'Nghe nói hôm nay có nhà phê bình ẩm thực ghé quán khoảng {time} - phục vụ thật nhanh nhé!',
    start: 'Nhà phê bình ẩm thực vừa tới! Mang menu, ghi món, bưng món thật nhanh.',
    reward: { money: 150, rep: 0.3 },
    penalty: { money: 0, rep: 0.3 },
  },
  {
    id: 'inspector',
    name: 'Thanh tra vệ sinh',
    icon: '🕵️',
    kind: 'inspector',
    weight: 3,
    announce: 'Thanh tra vệ sinh sẽ ghé kiểm tra khoảng {time} - lau sàn, dọn bàn trước nhé!',
    start: 'Thanh tra vệ sinh đang kiểm tra quán…',
    reward: { money: 120, rep: 0.1 },
    penalty: { money: 40, rep: 0.1, max: 200 },
  },
  {
    id: 'tour_bus',
    name: 'Xe du lịch ghé',
    icon: '🚌',
    kind: 'tour',
    weight: 3,
    // Giai đoạn 15: một chiếc minibus đỗ trước quán, cả đoàn khách vào ngồi kín mọi bàn còn trống
    start: 'Một chiếc minibus du lịch vừa đỗ trước cửa - cả đoàn khách kéo vào, ngồi kín mọi bàn!',
  },
  {
    id: 'outage',
    name: 'Mất điện',
    icon: '🕯️',
    kind: 'modifier',
    weight: 2,
    start: 'Cúp điện! Bếp phải nấu bằng bếp than, chậm hơn một nửa trong 1 tiếng.',
    duration: 60,
    effects: { cookSpeed: 0.5 },
  },
  {
    id: 'big_tippers',
    name: 'Khách sộp',
    icon: '💸',
    kind: 'modifier',
    weight: 2,
    start: 'Mấy đoàn khách sộp đang đi ăn quanh khu - tip gấp đôi trong 2 tiếng!',
    duration: 120,
    effects: { tip: 2 },
  },
  {
    id: 'police',
    name: 'Công an khu vực',
    icon: '👮',
    kind: 'police',
    cuisines: ['oc'],
    weight: 2,
    start: 'Công an khu vực ghé hỏi thăm: quán bày bàn ghế lấn chiếm lề đường!',
    bribe: [200, 700],
    penalty: { money: 0, rep: 0.1 },
  },
];
