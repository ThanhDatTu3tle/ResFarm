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
  spawnInterval: 52, // ~35 giây thực một nhóm (trước khi nhân uy tín, giờ cao điểm, lưu lượng ngày)
  // Khoảng cách tối đa giữa hai nhóm khách (phút game, ~27 giây thực): giờ nào trong ca cũng có khách dù vắng; đầu ca khách tới sau `firstGuest`
  spawnMaxGap: 40,
  firstGuest: 6,
  maxQueue: 5,
  rushHours: [
    { from: 11 * 60, to: 12 * 60, factor: 1.6 },
    { from: 18 * 60, to: 20 * 60, factor: 1.6 },
    { from: 15 * 60, to: 17 * 60, factor: 1.2 }, // khách đi chơi chiều ghé quán
  ],
  partySizeWeights: [0, 35, 35, 12, 12, 3, 3], // nhóm 5–6 người chỉ vừa khi đã mua bàn dài; không có thì bớt còn 4

  queuePatience: 130,
  foodPatience: 200,
  foodPatiencePerGuest: 50, // bàn đông chờ món lâu hơn (bưng cả bàn một lượt)
  // Ngồi ăn (phút game, 1.5 phút = 1 giây thực): 1 người 10–15 s, 2 người 15–30 s, 3–4 người 30–45 s, 5–6 người 45–60 s
  eatTime: [
    [15, 22.5],
    [22.5, 45],
    [45, 67.5],
    [45, 67.5],
    [67.5, 90],
    [67.5, 90],
  ],
  // Mỗi sáng tung lưu lượng khách: ngày thường 0.75–1.35, ngày lễ 1.3–1.5 (nhân thêm hiệu ứng lễ)
  traffic: { normal: [0.75, 1.35], festival: [1.3, 1.5] },

  tipRate: 0.2,
  xpPerCoin: 0.5,
  reputation: { paid: 0.01, paidBonus: 0.03, timeout: -0.1, noFood: -0.1 }, // G10: uy tín lên chậm hơn (~0.4 sao/ngày khi phục vụ tốt) để khách quen mở dần
  service: {
    waiterSpeed: 300,
    carryMax: 2,
    mopTime: 3, // đứng lau vết bẩn ~2 giây thực
    partyColors: 8, // băng qua quán mất ~6 giây thực (đi thong thả cho dễ theo dõi)
    browseTime: [4.5, 10.5], // 3–7 giây thực
    menuPatience: 96, // ~64 giây thực
    orderPatience: 96,
    moodStep: 15, // 10 giây thực mỗi bậc
    moodTip: [1, 0.6, 0.25, 0],
  },
  farmer: { home: { x: 1.25, z: 5.4 }, lanes: [1.25], speed: 3.7, workTime: 1.1 }, // chạy ~5.6 m/giây thực, làm mỗi việc ~0.7 giây
  farm: { waterDuration: 1680, dryGrowth: 0.35 }, // tưới một lần giữ ẩm 1 ngày nông trại (1080 + nightMinutes)
  marketSwing: [0.8, 1.25],
  kitchen: {
    tiers: [
      { name: 'Bếp nhỏ', icon: '🍳', cost: 0, level: 1, chefs: 2, passSlots: 6, helpers: 0, desc: 'Một dãy bếp, quầy line 6 đĩa.' },
      { name: 'Bếp đôi', icon: '🔥', cost: 1200, level: 3, chefs: 3, passSlots: 8, helpers: 1, desc: 'Thêm bếp phụ + bàn sơ chế: thuê được 3 đầu bếp, quầy line 8 đĩa, thêm 1 chỗ nhân viên phục vụ.' },
      { name: 'Bếp chuyên nghiệp', icon: '🏅', cost: 2800, level: 5, chefs: 4, passSlots: 10, helpers: 2, desc: 'Bếp công nghiệp: 4 đầu bếp, quầy line 10 đĩa, thêm 2 chỗ nhân viên phục vụ.' },
    ],
    chefHireCost: 400,
  },
  lowStockPortions: 3,
  events: { chance: 0.55, fromDay: 2 },
  contracts: { perDay: 2, extraAtLevel: 4, due: 21 * 60, rewardMul: [1.6, 2.2], xpRatio: 0.3, rep: 0.02, sellRatio: 0.5 },
  // Rau củ đúng mùa rẻ hơn, trái mùa đắt hơn; món hợp mùa bán đắt hơn 20%
  seasons: { inSeasonPrice: 0.85, offSeasonPrice: 1.3, dishBonus: 1.2 },
  regulars: { chance: 0.22, heartVisits: [1, 3, 6, 10, 15], tipPerHeart: 0.12, favoriteTip: 0.5, favoriteRep: 0.04, giftHearts: 3, maxPartySize: 2 },
  resellRate: 0.5,
  helpers: { hireCost: 300, names: ['Bé Mận', 'Anh Bin', 'Chị Hoa', 'Cu Tèo'] },
  // Người làm vườn: chậm hơn bác nông dân một chút; nghỉ cùng giờ với bác
  gardeners: { hireCost: 350, levels: [2, 4, 6], names: ['Cô Lài', 'Chú Tư', 'Anh Sáu'], speed: 3.0, workTime: 1.4, homes: [{ x: 0.2, z: 5.4 }, { x: 2.3, z: 5.4 }, { x: 1.25, z: 6.4 }] },
  // Mỗi người 30 năng lượng; ngủ qua đêm đầy lại. Nghỉ trưa: quán đóng 12:00, cả đội ra chợ (đội quán 14:00 về,
  // bác nông dân 13:00 về). Tối: quán đóng 21:00, cả đội ra chợ ăn tối. Người chơi chọn món cho từng người; quá hạn thì tự chọn.
  crew: {
    maxEnergy: 40,
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
  // Ca sáng 07:00–12:00 (11:00 ngưng nhận khách, 12:30 khách về hết), ca chiều tối 15:00–21:00 (20:30 ngưng nhận khách, 21:30 khách về hết)
  shifts: [
    { from: 7 * 60, lastCall: 11 * 60, to: 12 * 60, kickOut: 12 * 60 + 30 },
    { from: 15 * 60, lastCall: 20 * 60 + 30, to: 21 * 60, kickOut: 21 * 60 + 30 },
  ],
  stains: { perShift: 3, max: 10, maxLevel: 3, patiencePerLevel: 0.015, minPatience: 0.8 },
};
