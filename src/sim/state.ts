import type { RngState } from '../core/rng';
import { defaultDecor, recipesFor, type Content, type CuisineId, type DecorSlot, type ItemStack, type MillType, type SlotType } from '../data';

/**
 * TRẠNG THÁI GAME — chỉ gồm dữ liệu JSON thuần (không class, không hàm, không Map/Set)
 * để lưu/tải bằng JSON.stringify và dễ port sang engine khác.
 * Đổi cấu trúc ở đây => tăng SAVE_VERSION và thêm migration trong save.ts.
 */
export interface GameState {
  version: number;
  /** Phong cách quán chọn lúc tạo ván (Nhật / Hàn / Việt): quyết định thực đơn và nội thất. Không đổi trong ván. */
  cuisine: CuisineId;
  rng: RngState;
  /** Bộ đếm sinh id cho party/order. */
  nextId: number;
  clock: ClockState;
  money: number;
  xp: number;
  level: number;
  /** Uy tín 0..5 sao. */
  reputation: number;
  /** Số lượng từng nguyên liệu (nguyên liệu vô hạn không lưu ở đây). */
  inventory: Record<string, number>;
  menu: { unlocked: string[]; active: string[] };
  upgrades: string[];
  /** Nội thất đã mua và món đang dùng ở từng vị trí. */
  decor: { owned: string[]; equipped: Record<DecorSlot, string> };
  restaurant: RestaurantState;
  farm: { slots: FarmSlot[]; farmer: FarmerState; mills: MillState[] };
  /** Nhiệm vụ hệ thống: đang làm nhiệm vụ thứ `index` (content.quests), tiến độ, đã đạt mục tiêu chưa (chờ nhận thưởng). */
  quests: { index: number; progress: number; done: boolean };
  /** Khách quen đã từng ghé (id RegularDef -> số lần, ngày ghé gần nhất, đã tặng quà chưa). Chưa ghé lần nào thì không có mục. */
  regulars: Record<string, RegularState>;
  /** Quán của riêng mình: tên quán, thú cưng đang nuôi và các con đã nhận nuôi. */
  profile: { name: string; pet: string | null; pets: string[] };
  /** Hệ số giá chợ hôm nay theo từng nguyên liệu. */
  market: { priceFactor: Record<string, number> };
  weather: { id: string; minutesLeft: number };
  /** Cả đội (bếp, phục vụ, bác nông dân): giờ nghỉ ra chợ ăn, bữa đang ăn, hoá đơn chờ trả. */
  crew: CrewState;
  /** Đơn đặt hàng hôm nay. */
  contracts: Contract[];
  /** Sự kiện ngẫu nhiên hôm nay (null = không có). */
  event: EventState | null;
  /** season / year: cộng dồn từ đầu mùa / đầu năm (cộng lúc hết mỗi ngày) — để tổng kết mùa, năm. */
  stats: { today: DayStats; total: DayStats; season: DayStats; year: DayStats };
}

/** open: đang đón khách · closing: hết giờ, chờ khách cuối về · summary: tổng kết ngày, sim tạm dừng. */
export type DayPhase = 'open' | 'closing' | 'summary';

export interface ClockState {
  day: number;
  /** Phút trong ngày tính từ 00:00. */
  minute: number;
  phase: DayPhase;
}

/**
 * queue: xếp hàng chờ bàn · seated: đã ngồi, chờ bồi bàn mang menu · browsing: đang xem menu
 * · readyToOrder: chọn xong, chờ bồi bàn tới ghi món · waitingFood: chờ món · eating: đang ăn.
 */
export type PartyPhase = 'queue' | 'seated' | 'browsing' | 'readyToOrder' | 'waitingFood' | 'eating';

/** Một nhóm khách. */
export interface Party {
  id: number;
  size: number;
  phase: PartyPhase;
  tableId: string | null;
  /** Chỉ số ghế đang ngồi tại bàn (độ dài = size khi đã có bàn). */
  seats: number[];
  /** Kiên nhẫn còn lại (phút) cho pha chờ hiện tại. */
  patience: number;
  patienceMax: number;
  /** Đếm ngược cho pha gọi món / ăn. */
  timer: number;
  orderIds: number[];
  /** Ngoại hình từng khách (chỉ để vẽ). */
  looks: number[];
  /** Bồi bàn đã nhận việc cho nhóm này (đang trên đường mang menu / tới ghi món). */
  called: boolean;
  /** Phút món của nhóm đã nằm ở quầy ra món mà chưa được mang tới — quyết định tâm trạng. */
  wait: number;
  /** Khách quen dẫn đầu nhóm (ngồi ghế đầu tiên, looks[0] bỏ qua); null = khách vãng lai. */
  regular: string | null;
  /** Khách đặc biệt của sự kiện (id EventDef, vd 'critic'). */
  vip?: string;
}

/** Một đơn đặt hàng từ khách ngoài (systems/contracts.ts). */
export interface Contract {
  id: number;
  client: string;
  icon: string;
  items: ItemStack[];
  reward: number;
  xp: number;
  status: 'open' | 'done' | 'expired';
}

/** Sự kiện ngẫu nhiên hôm nay (systems/events.ts). */
export interface EventState {
  /** id EventDef. */
  id: string;
  /** Phút trong ngày sự kiện bắt đầu. */
  at: number;
  status: 'scheduled' | 'active' | 'done';
  /** Sự kiện kiểu modifier: còn bao nhiêu phút. */
  minutesLeft: number;
  /** critic: nhóm khách đặc biệt. */
  partyId: number | null;
  result: 'good' | 'bad' | null;
}

export interface RegularState {
  /** Số lần ghé đã trả tiền. */
  visits: number;
  /** Ngày ghé gần nhất (mỗi khách quen ghé tối đa 1 lần / ngày). */
  lastDay: number;
  /** Đã tặng quà (đồ trang trí) chưa. */
  gifted: boolean;
}

/** Một món đồ trang trí đã mua. */
export interface PropState {
  uid: string;
  /** id PropDef. */
  def: string;
  x: number;
  y: number;
  /** 0 hoặc 1 (xoay 90°). */
  rot: number;
  /** Đang cất trong kho (không bày, không có hiệu ứng). */
  stored: boolean;
}

/** queued: chờ bếp · cooking: đang nấu · ready: nằm ở quầy ra món · carrying: bồi bàn đang bưng · served: đã lên bàn. */
export type OrderStatus = 'queued' | 'cooking' | 'ready' | 'carrying' | 'served';

export interface Order {
  id: number;
  partyId: number;
  recipeId: string;
  status: OrderStatus;
  /** Phút-công đã nấu, so với recipe.cookTime. */
  progress: number;
  /** Món ruột của khách quen trong nhóm. */
  fav?: boolean;
}

/** Sức của một người trong đội: mỗi việc tốn năng lượng, cạn thì xỉu (đứng im tới khi được bồi dưỡng / ăn / ngủ). */
export interface Vitals {
  energy: number;
  fainted: boolean;
}

export interface StaffState extends Vitals {
  /** id của StaffDef. */
  id: string;
  orderId: number | null;
  /** Món đầu bếp này được giao nấu (id món). Không có / null = nấu mọi món. */
  dishes?: string[] | null;
}

/** lunch: nghỉ trưa (sau ca sáng) · dinner: tối sau khi đóng cửa. */
export type BreakKind = 'lunch' | 'dinner';

/** Một người trong đội ăn một món ở hàng rong (dòng trong hoá đơn). `who`: id đầu bếp / 'waiter' / id nhân viên / 'farmer'. */
export interface MealLine {
  who: string;
  name: string;
  stallId: string;
  dish: string;
  icon: string;
  price: number;
  energy: number;
  /** Phút trong ngày ăn xong (lúc đó mới cộng năng lượng). */
  until: number;
  kind: BreakKind;
}

/** Một người ra chợ đang chờ gọi món. */
export interface PendingMeal {
  who: string;
  name: string;
  kind: BreakKind;
  /** Quá phút này chưa chọn thì tự chọn ngẫu nhiên. */
  deadline: number;
  /** Giờ phải về chỗ làm (ăn xong trước giờ này). */
  back: number;
}

export interface CrewState {
  /** Đội quán (bếp + phục vụ) đang ở chợ; null = đang ở quán. */
  restaurantAway: BreakKind | null;
  /** Bác nông dân đang ở chợ; null = ở nông trại. */
  farmerAway: BreakKind | null;
  /** Người đã ra chợ nhưng chưa gọi món (người chơi chọn; quá hạn thì tự chọn ngẫu nhiên). */
  pending: PendingMeal[];
  /** Bữa đang ăn (vẽ người ngồi ở hàng rong; ăn xong chuyển sang hoá đơn). */
  meals: MealLine[];
  /** Hoá đơn chờ người chơi thanh toán (hiện khi mọi người ăn xong). */
  bill: MealLine[];
}

/** Việc của bồi bàn, làm lần lượt theo thứ tự người chơi giao. */
export type WaiterTask =
  | { kind: 'menu'; partyId: number }
  | { kind: 'takeOrder'; partyId: number }
  /** Bưng cả khay: lấy các món ở quầy rồi giao một lượt cho bàn. */
  | { kind: 'deliver'; orderIds: number[]; partyId: number }
  /** Dọn chén dĩa dơ ở bàn. */
  | { kind: 'clean'; tableId: string }
  /** Lau một vết bẩn trên sàn. */
  | { kind: 'mop'; stainId: number };

export interface WaiterState extends Vitals {
  /** Vị trí theo toạ độ mặt bằng. */
  x: number;
  y: number;
  tasks: WaiterTask[];
  /** Các món đang bưng trên khay (id đơn), rỗng = tay không. */
  carrying: number[];
}

/** Việc giao được cho nhân viên thuê: bưng món, mang menu + ghi món, dọn bàn, lau sàn. */
export type HelperJob = 'serve' | 'menu' | 'clean' | 'mop';

/** Nhân viên phục vụ thuê thêm: đi lại / làm việc như bồi bàn nhưng tự nhận việc theo `jobs`; có năng lượng. */
export interface HelperState extends WaiterState {
  id: string;
  name: string;
  /** Kiểu áo (chỉ để vẽ). */
  look: number;
  jobs: Record<HelperJob, boolean>;
}

export interface RestaurantState {
  parties: Party[];
  orders: Order[];
  staff: StaffState[];
  /** Hạng bếp (1..balance.kitchen.tiers.length): số đầu bếp tối đa, sức chứa quầy line. */
  kitchenTier: number;
  /** Phút còn lại tới lượt khách kế tiếp. */
  spawnTimer: number;
  /** Vị trí bàn người chơi đã dời (tableId -> tâm bàn, rot = đang xoay 90°). Bàn gốc không có ở đây thì ở vị trí mặc định; bàn mua thêm luôn có. */
  layout: Record<string, { x: number; y: number; rot?: boolean }>;
  /** Bàn lẻ mua thêm (id bàn, loại TableKindDef). */
  extraTables: { id: string; kind: string }[];
  /** Đồ trang trí đã mua (đang bày hoặc cất kho). */
  props: PropState[];
  /** Hạng quán (1 = Quán nhỏ), chỉ số trong content.room.tiers + 1. */
  tier: number;
  /** Chén dĩa dơ khách để lại: tableId -> các ghế còn dơ. Ghế dơ không xếp khách được tới khi dọn. */
  dirty: Record<string, number[]>;
  /** Vết bẩn trên sàn (toạ độ mặt bằng), level 1..maxLevel. */
  stains: { id: number; x: number; y: number; level: number }[];
  /** Bồi bàn — do người chơi điều khiển bằng cách bấm vào khách / quầy ra món. */
  waiter: WaiterState;
  /** Nhân viên phục vụ thuê thêm (mỗi bậc hạng quán thêm 1 chỗ). */
  helpers: HelperState[];
}

export interface FarmSlot {
  id: string;
  type: SlotType;
  producerId: string | null;
  stage: 'growing' | 'ready';
  progress: number;
  cyclesDone: number;
  /** Thứ vừa trồng/nuôi gần nhất, để trồng lại nhanh. */
  lastProducerId: string | null;
  /** Đất đã được cuốc tơi xốp (chỉ có ý nghĩa với loại ô needsTilling). */
  tilled: boolean;
  /** Số phút đất còn ẩm (chỉ có ý nghĩa với loại ô needsWater). */
  wet: number;
  /** Bậc nới rộng của ô, bắt đầu từ 1. */
  tier: number;
}

/** 'haul' = chở nông sản trên tay tới cối (millId); việc này do sim tự xếp sau khi thu ruộng tự động. */
export type FarmerTaskKind = 'till' | 'water' | 'plant' | 'harvest' | 'clear' | 'visit' | 'haul';

/** Một việc của bác nông dân; 'visit' = chỉ chạy tới ô (người chơi bấm để xem/chọn giống). */
export interface FarmerTask {
  kind: FarmerTaskKind;
  slotId: string;
  /** Chỉ có ở việc 'haul': chở tới cối nào. */
  millId?: string;
  /** Chỉ có ở việc 'plant'. */
  producerId?: string;
}

/** Bác nông dân — vị trí trên bản đồ nông trại (mét) và hàng việc người chơi giao. */
export interface FarmerState extends Vitals {
  x: number;
  z: number;
  tasks: FarmerTask[];
  /** Phút còn lại của việc đầu hàng khi đã tới nơi; null = đang đi hoặc rảnh. */
  work: number | null;
  /** Nông sản đang chở trên máy cày (sau khi thu ruộng tự động, trước khi đổ vào cối). */
  carry: ItemStack | null;
}

/** Một cối chế biến ở nông trại. */
export interface MillState {
  id: string;
  type: MillType;
  /** Thành phẩm đang chọn làm (id nguyên liệu, thuộc MillTypeDef.products). */
  product: string;
  /** Số đơn vị nguyên liệu thô đang chờ chế biến. */
  input: number;
  /** Phút đã chế biến đơn vị hiện tại. */
  progress: number;
}

export interface DayStats {
  revenue: number;
  tips: number;
  spent: number;
  dishes: number;
  guestsServed: number;
  guestsLost: number;
}

export const SAVE_VERSION = 16;

/** Tên quán mặc định khi tạo ván mới. */
export const DEFAULT_SHOP_NAME = 'Quán Nhà Vườn';

export function emptyStats(): DayStats {
  return { revenue: 0, tips: 0, spent: 0, dishes: 0, guestsServed: 0, guestsLost: 0 };
}

export function createMill(type: MillType, index: number, product: string): MillState {
  return { id: `${type}-${index}`, type, product, input: 0, progress: 0 };
}

/** Ô khởi đầu có trồng sẵn (SlotTypeDef.initialPlants, vd vườn cây có sẵn cam + táo): đặt producer vào ô. */
export function plantInitial(content: Content, slot: FarmSlot, index: number): FarmSlot {
  const producerId = content.slotTypes.get(slot.type).initialPlants?.[index];
  if (producerId) Object.assign(slot, { producerId, lastProducerId: producerId, stage: 'growing', progress: 0 });
  return slot;
}

export function createSlot(type: SlotType, index: number): FarmSlot {
  return { id: `${type}-${index}`, type, producerId: null, stage: 'growing', progress: 0, cyclesDone: 0, lastProducerId: null, tilled: false, wet: 0, tier: 1 };
}

export function createInitialState(content: Content, seed: number, cuisine: CuisineId = 'vn'): GameState {
  const b = content.balance;
  const starters = recipesFor(content, cuisine)
    .filter((r) => r.unlock.level <= 1 && r.unlock.cost === 0)
    .map((r) => r.id);
  const inventory: Record<string, number> = {};
  for (const s of content.cuisines.get(cuisine).startInventory) inventory[s.item] = s.qty;
  const decor = defaultDecor(content, cuisine);

  return {
    version: SAVE_VERSION,
    cuisine,
    rng: { s: seed | 0 },
    nextId: 1,
    clock: { day: 1, minute: b.openMinute, phase: 'open' },
    money: b.startMoney,
    xp: 0,
    level: 1,
    reputation: b.startReputation,
    inventory,
    menu: { unlocked: [...starters], active: [...starters] },
    upgrades: [],
    decor: {
      owned: decor.map((d) => d.id),
      equipped: Object.fromEntries(decor.map((d) => [d.slot, d.id])) as Record<DecorSlot, string>,
    },
    restaurant: {
      parties: [],
      orders: [],
      staff: content.staff.all().filter((s) => !s.hire).map((s) => ({ id: s.id, orderId: null, energy: b.crew.maxEnergy, fainted: false })),
      kitchenTier: 1,
      spawnTimer: 10,
      layout: {},
      extraTables: [],
      props: [],
      tier: 1,
      waiter: { ...content.room.waiterHome, tasks: [], carrying: [], energy: b.crew.maxEnergy, fainted: false },
      helpers: [],
      dirty: {},
      stains: [],
    },
    farm: {
      slots: content.slotTypes.all().flatMap((t) => Array.from({ length: t.initial }, (_, i) => plantInitial(content, createSlot(t.id, i), i))),
      farmer: { ...b.farmer.home, tasks: [], work: null, carry: null, energy: b.crew.maxEnergy, fainted: false },
      mills: content.mills.all().flatMap((m) => Array.from({ length: m.initial }, (_, i) => createMill(m.id, i, m.products[0]))),
    },
    market: { priceFactor: {} },
    quests: { index: 0, progress: 0, done: false },
    regulars: {},
    profile: { name: DEFAULT_SHOP_NAME, pet: null, pets: [] },
    weather: { id: content.weathers.all()[0].id, minutesLeft: 0 },
    crew: { restaurantAway: null, farmerAway: null, pending: [], meals: [], bill: [] },
    contracts: [],
    event: null,
    stats: { today: emptyStats(), total: emptyStats(), season: emptyStats(), year: emptyStats() },
  };
}
