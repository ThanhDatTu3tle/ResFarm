/**
 * Kiểu của toàn bộ NỘI DUNG game (định nghĩa tĩnh, không đổi khi chơi).
 * Mọi thời lượng tính bằng PHÚT GAME. Trạng thái động nằm ở src/sim/state.ts.
 */

export interface ItemStack {
  item: string;
  qty: number;
}

export type ItemCategory = 'staple' | 'vegetable' | 'meat' | 'seafood' | 'dairy' | 'dry';

/** Nguyên liệu / vật phẩm trong kho. */
export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  category: ItemCategory;
  /** Nguyên liệu mặc định, không bao giờ hết (gạo, nước, dầu ăn...). */
  infinite?: boolean;
  /** Giá tham chiếu ngoài chợ (trước hệ số sạp và biến động theo ngày). */
  basePrice: number;
}

/** Món ăn. */
export interface RecipeDef {
  id: string;
  name: string;
  icon: string;
  ingredients: ItemStack[];
  cookTime: number;
  price: number;
  /** Điều kiện mở khoá. level <= 1 và cost = 0 nghĩa là có sẵn từ đầu. */
  unlock: { level: number; cost: number };
  /** Trọng số khách chọn món (mặc định 1). */
  popularity?: number;
}

export type SlotType = 'field' | 'pen' | 'pond';

/**
 * "Nguồn sản xuất" đặt vào một ô nông trại: cây trồng, vật nuôi, ao cá...
 * Chu kỳ: trả `cost` -> chờ `growTime` -> thu `yields`.
 *  - cycles = 1: thu xong ô trống lại (rau, heo thịt).
 *  - cycles = 'infinite' (hoặc n > 1): sau mỗi lần thu chờ `regrowTime` rồi thu tiếp (gà đẻ, bò sữa).
 */
export interface ProducerDef {
  id: string;
  name: string;
  icon: string;
  slot: SlotType;
  cost: number;
  growTime: number;
  yields: ItemStack[];
  cycles: number | 'infinite';
  regrowTime?: number;
  /** Cấp độ tối thiểu để dùng. */
  level: number;
}

/** Loại ô nông trại và luật mua thêm ô. */
export interface SlotTypeDef {
  id: SlotType;
  name: string;
  icon: string;
  initial: number;
  max: number;
  /** Giá ô mua thêm thứ n (n tính từ 0) = basePrice * priceGrowth^n. */
  basePrice: number;
  priceGrowth: number;
  /** Cấp độ tối thiểu để MUA THÊM ô loại này (ô khởi đầu luôn có). */
  level: number;
  /** Đất phải được cuốc cho tơi xốp trước mỗi lần gieo. */
  needsTilling?: boolean;
  /** Cần tưới (hoặc hứng mưa); đất khô thì cây lớn chậm. */
  needsWater?: boolean;
  /** Các bậc nới rộng ô: phần tử i là chi phí/điều kiện để lên bậc i + 2 và hệ số sản lượng ở bậc đó. */
  tiers?: { cost: number; level: number; yieldMul: number }[];
}

/** Sạp hàng ngoài chợ. */
export interface StallDef {
  id: string;
  name: string;
  icon: string;
  /** Hệ số giá của sạp so với basePrice. */
  markup: number;
  items: string[];
}

/** Bàn trong quán. Toạ độ (tâm bàn) theo hệ quy chiếu của scene, sim không dùng tới. */
export interface TableDef {
  id: string;
  name: string;
  seats: number;
  /** true = ghế đơn dùng chung (quầy bar): mỗi nhóm khách chỉ chiếm số ghế của mình. */
  shared?: boolean;
  /** Cỡ nhóm lớn nhất được xếp vào (mặc định: 1 nếu shared, ngược lại = seats). */
  maxParty?: number;
  /** Chỉ có khi đã mua nâng cấp này. */
  requiresUpgrade?: string;
  /** Người chơi không dời được bàn này. */
  fixed?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StaffDef {
  id: string;
  name: string;
  icon: string;
  role: 'chef';
  /** Hệ số tốc độ nấu. */
  speed: number;
}

/** Các chỉ số có thể bị nâng cấp nhân lên. Thêm key mới ở đây rồi dùng modifier(ctx, key) trong system. */
export type ModifierKey = 'cookSpeed' | 'patience' | 'tip' | 'spawnRate' | 'growSpeed' | 'dishPrice';

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  level: number;
  /** Phải mua nâng cấp này trước. */
  requires?: string;
  /** Hệ số nhân cho từng chỉ số (vd { cookSpeed: 1.15 }). */
  modifiers?: Partial<Record<ModifierKey, number>>;
}

/** Mặt bằng quán, cùng hệ toạ độ 2D với TableDef. */
export interface RoomDef {
  width: number;
  height: number;
  /** Bề sâu khu bếp tính từ tường sau. */
  kitchenDepth: number;
  /** Vùng được phép đặt bàn. */
  dining: { x1: number; y1: number; x2: number; y2: number };
  /** Quầy ra món (bếp nấu xong đặt món ở đây, bồi bàn tới lấy). */
  pass: { x: number; y: number };
  /** Chỗ bồi bàn đứng chờ khi rảnh. */
  waiterHome: { x: number; y: number };
}

export type DecorSlot = 'floor' | 'wall' | 'furniture';

/** Một món nội thất bán ở Siêu thị (sàn, sơn tường, bộ bàn ghế). */
export interface DecorDef {
  id: string;
  name: string;
  icon: string;
  slot: DecorSlot;
  cost: number;
  level: number;
  /** Món có sẵn từ đầu của slot này (mỗi slot đúng 1 món, cost = 0). */
  isDefault?: boolean;
  /** Màu cho tầng hiển thị, dạng 0xRRGGBB; tên khoá theo slot (xem decor.ts). */
  colors: Record<string, number>;
  /** Hệ số gameplay khi đang dùng món này. */
  modifiers?: Partial<Record<ModifierKey, number>>;
}

/** Một kiểu thời tiết. Sim dùng "effects"; phần "visual" là gợi ý cho tầng hiển thị (0..1). */
export interface WeatherDef {
  id: string;
  name: string;
  icon: string;
  /** Trọng số xuất hiện. */
  weight: number;
  /** Thời lượng [ngắn nhất, dài nhất] tính bằng phút game. */
  duration: [number, number];
  /** Hệ số nhân lên các chỉ số khi thời tiết này diễn ra. */
  effects?: Partial<Record<ModifierKey, number>>;
  /** Trời này làm ẩm đất (khỏi tưới). */
  wetsSoil?: boolean;
  visual: { rain: number; clouds: number; wind: number; dim: number };
}

/** Hằng số cân bằng game. */
export interface Balance {
  /** 1 giây thực (tốc độ x1) = bao nhiêu phút game. */
  minutesPerSecond: number;
  openMinute: number;
  closeMinute: number;
  /** Số phút nông trại được cộng thêm qua đêm. */
  nightMinutes: number;
  startMoney: number;
  startReputation: number;
  startInventory: ItemStack[];
  /** Khoảng cách trung bình giữa hai lượt khách (phút) ở uy tín trung bình. */
  spawnInterval: number;
  maxQueue: number;
  rushHours: { from: number; to: number; factor: number }[];
  /** Trọng số cỡ nhóm khách, chỉ số mảng = số người. */
  partySizeWeights: number[];
  queuePatience: number;
  foodPatience: number;
  foodPatiencePerGuest: number;
  eatTime: number;
  tipRate: number;
  xpPerCoin: number;
  reputation: { paid: number; paidBonus: number; timeout: number; noFood: number };
  /** Khâu phục vụ (người chơi đóng vai bồi bàn). */
  service: {
    /** Tốc độ đi của bồi bàn: đơn vị mặt bằng (55 = 1 mét) mỗi phút game. */
    waiterSpeed: number;
    /** Khách xem menu mất bao lâu [min, max] (phút game). */
    browseTime: [number, number];
    /** Khách chờ được mang menu tới bao lâu thì bỏ về. */
    menuPatience: number;
    /** Khách chờ được tới ghi món bao lâu thì bỏ về. */
    orderPatience: number;
    /** Món đã ra quầy mà chưa mang tới: cứ chừng này phút khách tụt một bậc tâm trạng; quá bậc cuối thì bỏ về. */
    moodStep: number;
    /** Hệ số tip theo tâm trạng: vui vẻ, bình thường, chán nản, tức giận. */
    moodTip: [number, number, number, number];
  };
  farm: {
    /** Một lần tưới (hoặc một cơn mưa) giữ ẩm đất bao nhiêu phút. */
    waterDuration: number;
    /** Hệ số tốc độ lớn khi đất khô. */
    dryGrowth: number;
  };
  /** Biên độ giá chợ theo ngày [min, max]. */
  marketSwing: [number, number];
}
