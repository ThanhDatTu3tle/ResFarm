import type { Balance } from './types';

/** Mọi con số cân bằng nằm ở đây. Thời lượng tính bằng phút game. */
export const balance: Balance = {
  minutesPerSecond: 0.7, // 1 ngày mở cửa (14 giờ game = 840 phút game) = 20 phút thực ở x1
  openMinute: 8 * 60,
  closeMinute: 22 * 60,
  nightMinutes: 600,

  startMoney: 200,
  startReputation: 2.5,
  startInventory: [
    { item: 'egg', qty: 30 },
    { item: 'cabbage', qty: 24 },
    { item: 'tomato', qty: 24 },
  ],

  spawnInterval: 40,
  maxQueue: 5,
  rushHours: [
    { from: 11 * 60, to: 13 * 60, factor: 1.8 },
    { from: 18 * 60, to: 20 * 60, factor: 1.8 },
  ],
  partySizeWeights: [0, 35, 35, 10, 10, 4, 6],

  queuePatience: 60,
  foodPatience: 120,
  foodPatiencePerGuest: 12,
  eatTime: 30,

  tipRate: 0.2,
  xpPerCoin: 0.5,
  reputation: { paid: 0.02, paidBonus: 0.06, timeout: -0.1, noFood: -0.1 },
  service: {
    waiterSpeed: 330, // băng qua quán mất ~3 giây thực
    browseTime: [2.1, 4.9], // 3–7 giây thực
    menuPatience: 45, // ~64 giây thực
    orderPatience: 45,
    moodStep: 7, // 10 giây thực mỗi bậc
    moodTip: [1, 0.6, 0.25, 0],
  },
  farm: { waterDuration: 300, dryGrowth: 0.35 },
  marketSwing: [0.8, 1.25],
};
