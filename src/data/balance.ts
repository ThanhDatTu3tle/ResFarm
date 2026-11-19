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
  reputation: { paid: 0.02, paidBonus: 0.06, timeout: -0.1, noFood: -0.1 },
  service: {
    waiterSpeed: 430, // băng qua quán mất ~4 giây thực (chậm lại cho dễ theo dõi)
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
  helpers: { hireCost: 300, maxEnergy: 100, energyPerTask: 3, reviveCost: 100, reviveEnergy: 60, overnightEnergy: 40, names: ['Bé Mận', 'Anh Bin', 'Chị Hoa', 'Cu Tèo'] },
  // Ca sáng 07:00–12:00, nghỉ trưa (đi chợ, ra nông trại), ca chiều tối 15:00–20:00
  shifts: [
    { from: 7 * 60, to: 12 * 60 },
    { from: 15 * 60, to: 20 * 60 },
  ],
  stains: { perShift: 3, max: 10, maxLevel: 3, patiencePerLevel: 0.015, minPatience: 0.8 },
};
