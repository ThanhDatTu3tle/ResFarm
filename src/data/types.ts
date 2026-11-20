/**
 * Kiểu của toàn bộ NỘI DUNG game (định nghĩa tĩnh, không đổi khi chơi).
 * Mọi thời lượng tính bằng PHÚT GAME. Trạng thái động nằm ở src/sim/state.ts.
 */

export interface ItemStack {
  item: string;
  qty: number;
}

export type ItemCategory = 'staple' | 'vegetable' | 'fruit' | 'meat' | 'seafood' | 'dairy' | 'dry';

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

/** Loại mục tiêu nhiệm vụ hệ thống (xem src/data/quests.ts). */
export type QuestGoalKind = 'serve' | 'happy' | 'harvest' | 'produce' | 'unlock' | 'revenue' | 'reputation' | 'contract' | 'level' | 'tier' | 'kitchen' | 'gardener' | 'tool' | 'day';

/** Một nhiệm vụ hệ thống: làm lần lượt theo thứ tự trong danh sách. */
export interface QuestDef {
  id: string;
  icon: string;
  title: string;
  /** Một câu mô tả mục tiêu, hiện trên HUD. */
  desc: string;
  goal: { kind: QuestGoalKind; target: number };
  reward: { money?: number; xp?: number };
  /** Chương (1, 2, 3...) — tên chương ở `questChapters` (src/data/quests.ts). */
  chapter: number;
}

/** Phong cách quán người chơi chọn lúc bắt đầu ván mới: quyết định thực đơn và nội thất. */
export type CuisineId = 'jp' | 'kr' | 'vn';

export interface CuisineDef {
  id: CuisineId;
  /** Tên quán hiện ở màn chọn. */
  name: string;
  /** Tên nước ngắn gọn (Nhật, Hàn, Việt). */
  country: string;
  flag: string;
  /** Một câu giới thiệu ở màn chọn. */
  blurb: string;
  /** Vài món tiêu biểu để giới thiệu (id món). */
  showcase: string[];
  /** Màu chủ đạo cho thẻ chọn ở màn hình mở đầu (CSS). */
  accent: string;
  /** Nguyên liệu có sẵn trong kho lúc bắt đầu (đủ nấu các món khởi đầu vài lượt). */
  startInventory: ItemStack[];
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
  /** Món thuộc thực đơn của quán nào. */
  cuisine: CuisineId;
  /** Món hợp mùa (chỉ số mùa 0 Xuân … 3 Đông): đúng mùa thì giá bán × `balance.seasons.dishBonus`. */
  seasons?: number[];
}

export type SlotType = 'field' | 'pen' | 'pond' | 'wheat' | 'paddy' | 'gplot' | 'orchard';

/** Loại cối chế biến ở nông trại: cối xay gió (lúa mì) và nhà xay lúa (lúa nước). */
export type MillType = 'windmill' | 'ricemill';

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
  /** Loại ô khác cũng trồng được giống này (vd rau củ trồng được cả trong nhà kính). */
  alsoIn?: SlotType[];
  cost: number;
  growTime: number;
  yields: ItemStack[];
  cycles: number | 'infinite';
  regrowTime?: number;
  /** Cấp độ tối thiểu để dùng. */
  level: number;
  /**
   * Mùa trồng được ngoài trời (0 Xuân, 1 Hạ, 2 Thu, 3 Đông). Bỏ trống = quanh năm (vẫn nghỉ mùa Đông nếu ở ngoài trời).
   * Sang mùa không hợp thì cây đang lớn ngoài trời héo. Trong nhà kính trồng quanh năm.
   */
  seasons?: number[];
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
  /** Chuồng / ao: người làm vườn lo bằng việc "Chuồng, ao" (thu xong thả lại con giống cũ). */
  animals?: boolean;
  /** Cần tưới (hoặc hứng mưa); đất khô thì cây lớn chậm. */
  needsWater?: boolean;
  /** Các bậc nới rộng ô: phần tử i là chi phí/điều kiện để lên bậc i + 2 và hệ số sản lượng ở bậc đó. */
  tiers?: { cost: number; level: number; yieldMul: number }[];
  /**
   * Vị trí trên bản đồ nông trại (mét): ô thứ i ở (x + (i % cols)·dx, z + ⌊i / cols⌋·dz).
   * size = cạnh ô; tierGrowth = mỗi bậc nới rộng ô to thêm bao nhiêu lần;
   * work = bác nông dân đứng ở mép nào của ô khi làm việc (mặc định 'front' — mép phía camera).
   * Cả sim (chỗ bác nông dân đứng) lẫn cảnh 3D đều đọc từ đây.
   */
  layout: {
    x: number;
    z: number;
    cols: number;
    dx: number;
    dz: number;
    size: number;
    tierGrowth: number;
    work?: 'front' | 'left' | 'back';
    /** Vị trí từng ô đặt tay (thay cho lưới x/z/cols/dx/dz) — dùng khi ô nằm thành nhiều cụm (vườn cây ăn quả). work riêng từng ô nếu có. */
    spots?: { x: number; z: number; work?: 'front' | 'left' | 'back' }[];
  };
  /** Ô khởi đầu đã trồng sẵn (producer theo thứ tự ô). */
  initialPlants?: string[];
  /**
   * Ruộng "tự động" (lúa mì, lúa nước): người chơi chỉ bấm thu hoạch, bác nông dân lái máy cày thu,
   * tự gieo lại giống cũ rồi chở hết sản lượng tới cối loại này để chế biến.
   */
  mill?: MillType;
  /** Mua thêm theo lô: mỗi lần mua thêm bấy nhiêu ô cùng lúc (luống nhà kính: nhà dài thêm, thêm 4 luống). */
  batch?: number;
  /** Hệ số tốc độ lớn riêng của loại ô (nhà kính lớn nhanh hơn ngoài trời). */
  growMul?: number;
  /**
   * Ô nằm TRONG một toà nhà trên bản đồ nông trại (nhà kính): không vẽ trên bản đồ, bác nông dân đứng ở cửa nhà (door).
   * x = mép tây (đầu có cửa), z = trục giữa nhà, width = bề ngang; nhà dài = cột luống × colLength + 2·endLength
   * (mỗi cột gồm 2 luống hai bên lối đi). Bên trong vẽ ở khu riêng (areas/greenhouse.ts).
   */
  building?: { x: number; z: number; width: number; colLength: number; endLength: number; door: { x: number; z: number } };
}

/** Cối chế biến: nhận nguyên liệu thô (input) do bác nông dân chở tới, làm ra một trong các thành phẩm (products). */
export interface MillTypeDef {
  id: MillType;
  name: string;
  icon: string;
  /** Nguyên liệu thô nhận vào (vd lúa mì). */
  input: string;
  /** Thành phẩm có thể chọn; mỗi 1 đơn vị input ra 1 đơn vị thành phẩm. Phần tử đầu là mặc định. */
  products: string[];
  /** Phút game để chế biến 1 đơn vị. */
  time: number;
  initial: number;
  max: number;
  /** Giá cối mua thêm thứ n (n tính từ 0) = basePrice * priceGrowth^n. */
  basePrice: number;
  priceGrowth: number;
  level: number;
  /** Cối thứ i ở (x + (i % cols)·dx, z + ⌊i / cols⌋·dz); bác nông dân đứng ở (tâm + spot) khi đổ hàng. */
  layout: { x: number; z: number; cols: number; dx: number; dz: number; spot: { x: number; z: number } };
}

/** Sạp hàng ngoài chợ. */
export interface StallDef {
  id: string;
  name: string;
  icon: string;
  /** Hệ số giá của sạp so với basePrice. */
  markup: number;
  items: string[];
  /** Bảng chân đứng nhỏ cạnh sạp (dòng chữ giới thiệu thêm), không có thì thôi. */
  standee?: string;
  /** Kiểu bày hàng bên trong sạp: 'trays' khay trên quầy gỗ (mặc định), 'tanks' bể nước cho hải sản bơi (người bán đứng giữa). */
  interior?: 'trays' | 'tanks';
  /**
   * Kiểu hàng quán (hình 3D): 'stall' sạp mái bạt trong dãy chợ (mặc định), 'kiosk' tiệm nhỏ trong dãy chợ,
   * 'cart' xe đẩy, 'pole' gánh hàng rong, 'bike' xe đạp bán dạo — ba kiểu sau đứng trên vỉa hè ở `spot`.
   */
  kind?: 'stall' | 'kiosk' | 'cart' | 'pole' | 'bike';
  /** Chỗ đứng trên vỉa hè (x, z ở khu chợ) cho hàng rong. */
  spot?: { x: number; z: number };
  /**
   * Hàng rong / tiệm ăn vặt: thực đơn cho cả đội ra ăn giờ nghỉ (KHÔNG phải nguyên liệu — mua không vào kho).
   * Có `menu` thì `items` để trống.
   */
  menu?: StaffDishDef[];
}

/** Một món ở hàng rong: giá, năng lượng hồi lại cho người ăn. */
export interface StaffDishDef {
  name: string;
  icon: string;
  price: number;
  energy: number;
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
  /** Bàn đang xoay 90° (w/h đã đổi chỗ; ghế xếp theo hai cạnh còn lại). Chỉ có ở bàn trả về từ activeTables(). */
  rotated?: boolean;
  /** Bàn mua thêm: loại bàn (TableKindDef) — bán lại được. */
  kind?: string;
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
  /** Đầu bếp thuê thêm (không có sẵn lúc mở quán): cần bếp đủ hạng (`balance.kitchen.tiers[].chefs`). */
  hire?: boolean;
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
  /** Các hạng quán; hạng 1 = kích thước gốc (height). */
  tiers: TierDef[];
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
  /** Món có sẵn từ đầu của slot này (mỗi phong cách quán có đúng 1 món mặc định mỗi slot, cost = 0). */
  isDefault?: boolean;
  /** Chỉ dành cho quán phong cách này; bỏ trống = quán nào cũng mua được. */
  cuisine?: CuisineId;
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
  /** Trọng số riêng từng mùa [Xuân, Hạ, Thu, Đông] (bỏ trống = `weight` cho mọi mùa; 0 = không có ở mùa đó). */
  seasonWeights?: [number, number, number, number];
  /** Thời lượng [ngắn nhất, dài nhất] tính bằng phút game. */
  duration: [number, number];
  /** Hệ số nhân lên các chỉ số khi thời tiết này diễn ra. */
  effects?: Partial<Record<ModifierKey, number>>;
  /** Trời này làm ẩm đất (khỏi tưới). */
  wetsSoil?: boolean;
  /** Đất khô nhanh gấp mấy lần (nắng nóng). */
  dryRate?: number;
  /** Bão: lúc trời chuyển sang kiểu này, mỗi ô rau / lúa ngoài trời đang lớn có xác suất này bị dập, mất nửa tiến độ. */
  damage?: number;
  /** snow: tuyết rơi 0..1 (mùa đông lúc nào cũng có tuyết lất phất). */
  visual: { rain: number; clouds: number; wind: number; dim: number; snow?: number };
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
  /** Khoảng cách trung bình giữa hai lượt khách (phút) ở uy tín trung bình. */
  spawnInterval: number;
  maxQueue: number;
  rushHours: { from: number; to: number; factor: number }[];
  /** Trọng số cỡ nhóm khách, chỉ số mảng = số người. */
  partySizeWeights: number[];
  queuePatience: number;
  foodPatience: number;
  foodPatiencePerGuest: number;
  /** Thời gian ngồi ăn [ngắn nhất, dài nhất] theo số khách (phần tử i = nhóm i + 1 người). */
  eatTime: [number, number][];
  /** Lưu lượng khách theo ngày: hệ số ngẫu nhiên mỗi sáng (ngày thường / ngày lễ — nhân thêm với hiệu ứng lễ). */
  traffic: { normal: [number, number]; festival: [number, number] };
  tipRate: number;
  xpPerCoin: number;
  reputation: { paid: number; paidBonus: number; timeout: number; noFood: number };
  /** Khâu phục vụ (người chơi đóng vai bồi bàn). */
  service: {
    /** Tốc độ đi của bồi bàn: đơn vị mặt bằng (55 = 1 mét) mỗi phút game. */
    waiterSpeed: number;
    /** Bồi bàn cầm tối đa bao nhiêu món một lượt. */
    carryMax: number;
    /** Phút game đứng lau một vết bẩn. */
    mopTime: number;
    /** Số màu bàn (bong bóng + món cùng màu) — khớp bảng màu trong UI. */
    partyColors: number;
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
  farmer: {
    /** Chỗ bác nông dân đứng lúc mới vào game (mét). */
    home: { x: number; z: number };
    /** Toạ độ x các lối đi dọc (mét): bác chỉ chạy dọc trên các lối này, còn lại đi ngang theo khe giữa các hàng ô. */
    lanes: number[];
    /** Tốc độ chạy: mét mỗi phút game. */
    speed: number;
    /** Thời gian làm một việc (cuốc, tưới, gieo, thu) khi đã tới nơi, phút game. */
    workTime: number;
  };
  farm: {
    /** Một lần tưới (hoặc một cơn mưa) giữ ẩm đất bao nhiêu phút. */
    waterDuration: number;
    /** Hệ số tốc độ lớn khi đất khô. */
    dryGrowth: number;
  };
  /**
   * Hạng bếp (bếp + quầy line): mỗi hạng một số đầu bếp tối đa, số đĩa quầy line giữ được (đầy thì bếp chờ),
   * số chỗ nhân viên phục vụ cộng thêm. Hạng 1 có sẵn (cost 0). `chefHireCost`: phí thuê một đầu bếp.
   */
  kitchen: { tiers: { name: string; icon: string; cost: number; level: number; chefs: number; passSlots: number; helpers: number; desc: string }[]; chefHireCost: number };
  /** Sự kiện ngẫu nhiên: xác suất mỗi ngày, bắt đầu từ ngày thứ mấy. */
  events: { chance: number; fromDay: number };
  /**
   * Đơn đặt hàng: số đơn mỗi ngày (+1 từ cấp `extraAtLevel`), hạn giao (phút trong ngày), thưởng = giá gốc × [min, max],
   * XP = thưởng × `xpRatio`, uy tín mỗi đơn; `sellRatio` = giá bán lại hàng dư so với giá gốc.
   */
  contracts: { perDay: number; extraAtLevel: number; due: number; rewardMul: [number, number]; xpRatio: number; rep: number; sellRatio: number };
  /** Món còn nấu được ít hơn số phần này thì báo "sắp hết nguyên liệu". */
  lowStockPortions: number;
  /** Biên độ giá chợ theo ngày [min, max]. */
  marketSwing: [number, number];
  /** Mùa vụ: giá chợ của nông sản đúng mùa / trái mùa (nhân thêm), giá món hợp mùa. */
  seasons: { inSeasonPrice: number; offSeasonPrice: number; dishBonus: number };
  /** Khách quen (F2). */
  regulars: {
    /** Xác suất một nhóm khách mới là khách quen (khi còn khách quen chưa ghé hôm nay). */
    chance: number;
    /** Số lần ghé (đã trả tiền) để đạt mỗi bậc tim: phần tử thứ i = mốc của tim thứ i + 1. */
    heartVisits: number[];
    /** Tip cộng thêm theo mỗi tim (0.12 = +12%). */
    tipPerHeart: number;
    /** Tip cộng thêm khi được ăn đúng món ruột. */
    favoriteTip: number;
    /** Uy tín cộng thêm khi khách quen được ăn món ruột. */
    favoriteRep: number;
    /** Đạt số tim này thì khách quen tặng quà (đồ trang trí riêng). */
    giftHearts: number;
    /** Khách quen đi cùng tối đa bao nhiêu người (tính cả họ). */
    maxPartySize: number;
  };
  /** Bán lại đồ trang trí / bàn mua thêm được bao nhiêu phần giá mua. */
  resellRate: number;
  /** Nhân viên phục vụ thuê thêm: phí thuê, tên lần lượt. */
  helpers: { hireCost: number; names: string[] };
  /** Người làm vườn: giá thuê, cấp mở từng chỗ (chỗ thứ i mở ở cấp levels[i]), tên, tốc độ (m/phút game), phút làm 1 việc, chỗ đứng chờ. */
  gardeners: { hireCost: number; levels: number[]; names: string[]; speed: number; workTime: number; homes: { x: number; z: number }[] };
  /**
   * Cả đội (đầu bếp, bồi bàn, nhân viên thuê, bác nông dân): năng lượng tối đa, mỗi việc tốn bao nhiêu, bồi dưỡng khi xỉu;
   * giờ nghỉ: đội quán về lúc lunchBack, bác nông dân ra chợ farmerLunch.from và về farmerLunch.to; tối (sau ca cuối) ra chợ ăn dinnerMinutes phút.
   * Ăn xong mà còn tiền ít thì chọn món rẻ, không đủ thì nhịn (tổng hoá đơn không vượt số tiền đang có).
   */
  crew: {
    maxEnergy: number;
    chefPerDish: number;
    waiterPerTask: number;
    farmerPerTask: number;
    reviveCost: number;
    reviveEnergy: number;
    /** Nghỉ ngơi trong giờ nghỉ cũng hồi chút sức (cộng thêm ngoài món ăn). */
    restEnergy: number;
    lunchBack: number;
    farmerLunch: { from: number; to: number };
    dinnerMinutes: number;
    /** Gọi món xong thì ăn bao lâu (phút game); hết hạn gọi món = giờ về trừ đi chừng này, chưa chọn thì tự chọn ngẫu nhiên. */
    eatMinutes: number;
    /** Sau giờ này hiện nút "Kết thúc ngày". */
    endDayAfter: number;
  };
  /** Các ca mở cửa đón khách trong ngày (phút từ 00:00). Ngoài ca: không có khách mới (nghỉ trưa / đêm). */
  /** from: mở cửa · lastCall: ngưng nhận khách mới · to: đóng cửa (khách chưa gọi món thì về, cả đội ra chợ khi quán vắng). */
  /** to = giờ đóng cửa (khách chưa gọi món về); kickOut = giờ khách đang ăn / chờ món phải về hết. */
  shifts: { from: number; lastCall: number; to: number; kickOut: number }[];
  /** Vết bẩn trên sàn: mỗi ca xong thêm perShift vết (vết cũ bẩn thêm 1 bậc), tối đa max; mỗi bậc bẩn bớt patiencePerLevel kiên nhẫn. */
  stains: { perShift: number; max: number; maxLevel: number; patiencePerLevel: number; minPatience: number };
}

// ---------- Khách quen (F2) ----------

/** Dáng người: trẻ em (nhỏ, đầu to), thiếu niên, người lớn, người già (hơi khom). */
export type PersonBuild = 'kid' | 'teen' | 'adult' | 'elder';
export type HairStyle = 'short' | 'spiky' | 'long' | 'pony' | 'twin' | 'bun' | 'bald';
/** Phụ kiện. Khách vãng lai không bao giờ có phụ kiện — thấy phụ kiện là biết khách quen. */
export type Accessory =
  | 'bow'
  | 'backpack'
  | 'capBack'
  | 'glasses'
  | 'readingGlasses'
  | 'bag'
  | 'helmet'
  | 'jacket'
  | 'scarf'
  | 'towel'
  | 'beard'
  | 'mustache'
  | 'cane'
  | 'fedora';

/** Ngoại hình chi tiết (chỉ tầng hiển thị dùng; để ở data để thêm khách quen chỉ cần sửa data). */
export interface PersonStyle {
  build: PersonBuild;
  hair: HairStyle;
  hairColor: number;
  skin: number;
  shirt: number;
  bottom: 'pants' | 'skirt' | 'shorts';
  bottomColor: number;
  acc: Accessory[];
  /** Màu phụ kiện chính (nơ, khăn, túi...). */
  accent: number;
}

export interface RegularDef {
  id: string;
  name: string;
  /** Emoji đại diện (dùng khi chưa có chân dung). */
  icon: string;
  /** Một câu giới thiệu trong bảng Khách quen. */
  bio: string;
  /** Câu chào khi ghé quán (hiện trong thông báo). */
  greet: string;
  style: PersonStyle;
  /** Món ruột theo từng phong cách quán. */
  favorites: Record<CuisineId, string>;
  /** Khách quen bắt đầu ghé khi quán đạt uy tín và cấp này. */
  unlock: { reputation: number; level: number };
  /** Đồ trang trí khách tặng khi đủ balance.regulars.giftHearts tim (id PropDef). */
  gift: string;
}

// ---------- Quán của riêng mình (Giai đoạn 3) ----------

/** Đồ trang trí đặt tự do trong khu ăn uống (F4). */
export interface PropDef {
  id: string;
  name: string;
  icon: string;
  /** Kiểu model 3D (xem ui/three/props.ts); kiểu lạ thì hiện emoji. */
  model: string;
  cost: number;
  level: number;
  /** Chỉ hợp quán phong cách này; bỏ trống = quán nào cũng dùng được. */
  cuisine?: CuisineId;
  /** Kích thước chiếm chỗ trên mặt bằng (toạ độ 2D của quán, chưa xoay). */
  w: number;
  h: number;
  /** Hiệu ứng khi có ít nhất 1 món loại này đang bày (nhiều món cùng loại không cộng dồn). */
  modifiers?: Partial<Record<ModifierKey, number>>;
  /** true = không bán ở Siêu thị, chỉ có khi khách quen tặng. */
  giftOnly?: boolean;
}

/** Thú cưng của quán (F5). */
export interface PetDef {
  id: string;
  name: string;
  icon: string;
  cost: number;
  level: number;
  desc: string;
  modifiers?: Partial<Record<ModifierKey, number>>;
}

/** Hạng quán (C3): phòng ăn sâu hơn theo hạng. */
export interface TierDef {
  /** 1, 2, 3... */
  id: number;
  name: string;
  icon: string;
  /** Chiều sâu phòng (toạ độ 2D, thay RoomDef.height); khu ăn uống giãn theo. */
  height: number;
  cost: number;
  level: number;
  desc: string;
  modifiers?: Partial<Record<ModifierKey, number>>;
}

/** Bàn lẻ mua thêm ở Siêu thị (B7). Mỗi lần mua tạo một bàn mới trong state.restaurant.extraTables. */
export interface TableKindDef {
  id: string;
  name: string;
  icon: string;
  seats: number;
  w: number;
  h: number;
  cost: number;
  level: number;
}
