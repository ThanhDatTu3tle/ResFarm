import type { Balance } from './types';

/** Mọi con số cân bằng nằm ở đây. Thời lượng tính bằng phút game. */
export const balance: Balance = {
  minutesPerSecond: 1.5, // 1 ngày (06:00 → 24:00 = 1080 phút game) = 12 phút thực ở x1
  openMinute: 6 * 60,
  closeMinute: 24 * 60,
  nightMinutes: 600,

  startMoney: 200,
  startReputation: 2.5,
  // Nguyên liệu khởi đầu: theo từng phong cách quán (CuisineDef.startInventory trong cuisines.ts)

  // Các mốc phục vụ dưới đây đã nhân ~2.1 khi đổi minutesPerSecond 0.7 → 1.5 để giữ nhịp theo giây thực như cũ
  spawnInterval: 100, // ~67 giây thực một nhóm (thưa hơn bản cũ một chút)
  maxQueue: 5,
  rushHours: [
    { from: 11 * 60, to: 12 * 60, factor: 1.6 },
    { from: 18 * 60, to: 20 * 60, factor: 1.6 },
  ],
  partySizeWeights: [0, 35, 35, 12, 12, 3, 3], // nhóm 5–6 người chỉ vừa khi đã mua bàn dài; không có thì bớt còn 4

  queuePatience: 130,
  foodPatience: 200,
  foodPatiencePerGuest: 50, // bàn đông chờ món lâu hơn (bưng cả bàn một lượt)
  eatTime: 60,

  tipRate: 0.2,
  xpPerCoin: 0.5,
  reputation: { paid: 0.01, paidBonus: 0.03, timeout: -0.1, noFood: -0.1 }, // G10: uy tín lên chậm hơn (~0.4 sao/ngày khi phục vụ tốt) để khách quen mở dần
  service: {
    waiterSpeed: 300, // băng qua quán mất ~6 giây thực (đi thong thả cho dễ theo dõi)
    browseTime: [4.5, 10.5], // 3–7 giây thực
    menuPatience: 96, // ~64 giây thực
    orderPatience: 96,
    moodStep: 15, // 10 giây thực mỗi bậc
    moodTip: [1, 0.6, 0.25, 0],
  },
  farmer: { home: { x: 1.25, z: 5.4 }, lanes: [1.25], speed: 3.7, workTime: 1.1 }, // chạy ~5.6 m/giây thực, làm mỗi việc ~0.7 giây
  farm: { waterDuration: 300, dryGrowth: 0.35 },
  marketSwing: [0.8, 1.25],
  regulars: { chance: 0.22, heartVisits: [1, 3, 6, 10, 15], tipPerHeart: 0.12, favoriteTip: 0.5, favoriteRep: 0.04, giftHearts: 3, maxPartySize: 2 },
  resellRate: 0.5,
  helpers: { hireCost: 300, names: ['Bé Mận', 'Anh Bin', 'Chị Hoa', 'Cu Tèo'] },
  // Mỗi người 30 năng lượng; ngủ qua đêm đầy lại. Nghỉ trưa: quán đóng 12:00, cả đội ra chợ (đội quán 14:00 về,
  // bác nông dân 13:00 về). Tối: quán đóng 21:00, cả đội ra chợ ăn tối. Người chơi chọn món cho từng người; quá hạn thì tự chọn.
  crew: {
    maxEnergy: 30,
    chefPerDish: 2,
    waiterPerTask: 1,
    farmerPerTask: 1,
    reviveCost: 100,
    reviveEnergy: 15,
    restEnergy: 10,
    lunchBack: 14 * 60,
    farmerLunch: { from: 12 * 60, to: 13 * 60 },
    dinnerMinutes: 60,
    eatMinutes: 30,
    endDayAfter: 21 * 60, // quán đóng cửa tối là kết thúc ngày được
  },
  // Ca sáng 07:00–12:00, nghỉ trưa (đi chợ, ra nông trại), ca chiều tối 15:00–20:00
  // Ca sáng 07:00–12:00 (11:30 ngưng nhận khách), ca chiều tối 15:00–21:00 (20:30 ngưng nhận khách)
  shifts: [
    { from: 7 * 60, lastCall: 11 * 60 + 30, to: 12 * 60 },
    { from: 15 * 60, lastCall: 20 * 60 + 30, to: 21 * 60 },
  ],
  stains: { perShift: 3, max: 10, maxLevel: 3, patiencePerLevel: 0.015, minPatience: 0.8 },
};
