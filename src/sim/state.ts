import type { RngState } from '../core/rng';
import type { Content, DecorSlot, SlotType } from '../data';

/**
 * TRẠNG THÁI GAME — chỉ gồm dữ liệu JSON thuần (không class, không hàm, không Map/Set)
 * để lưu/tải bằng JSON.stringify và dễ port sang engine khác.
 * Đổi cấu trúc ở đây => tăng SAVE_VERSION và thêm migration trong save.ts.
 */
export interface GameState {
  version: number;
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
  farm: { slots: FarmSlot[] };
  /** Hệ số giá chợ hôm nay theo từng nguyên liệu. */
  market: { priceFactor: Record<string, number> };
  weather: { id: string; minutesLeft: number };
  stats: { today: DayStats; total: DayStats };
}

/** open: đang đón khách · closing: hết giờ, chờ khách cuối về · summary: tổng kết ngày, sim tạm dừng. */
export type DayPhase = 'open' | 'closing' | 'summary';

export interface ClockState {
  day: number;
  /** Phút trong ngày tính từ 00:00. */
  minute: number;
  phase: DayPhase;
}

export type PartyPhase = 'queue' | 'ordering' | 'waitingFood' | 'eating';

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
}

export type OrderStatus = 'queued' | 'cooking' | 'served';

export interface Order {
  id: number;
  partyId: number;
  recipeId: string;
  status: OrderStatus;
  /** Phút-công đã nấu, so với recipe.cookTime. */
  progress: number;
}

export interface StaffState {
  /** id của StaffDef. */
  id: string;
  orderId: number | null;
}

export interface RestaurantState {
  parties: Party[];
  orders: Order[];
  staff: StaffState[];
  /** Phút còn lại tới lượt khách kế tiếp. */
  spawnTimer: number;
  /** Vị trí bàn người chơi đã dời (tableId -> tâm bàn). Bàn không có ở đây thì ở vị trí mặc định. */
  layout: Record<string, { x: number; y: number }>;
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
}

export interface DayStats {
  revenue: number;
  tips: number;
  spent: number;
  dishes: number;
  guestsServed: number;
  guestsLost: number;
}

export const SAVE_VERSION = 3;

export function emptyStats(): DayStats {
  return { revenue: 0, tips: 0, spent: 0, dishes: 0, guestsServed: 0, guestsLost: 0 };
}

export function createSlot(type: SlotType, index: number): FarmSlot {
  return { id: `${type}-${index}`, type, producerId: null, stage: 'growing', progress: 0, cyclesDone: 0, lastProducerId: null };
}

export function createInitialState(content: Content, seed: number): GameState {
  const b = content.balance;
  const starters = content.recipes
    .all()
    .filter((r) => r.unlock.level <= 1 && r.unlock.cost === 0)
    .map((r) => r.id);
  const inventory: Record<string, number> = {};
  for (const s of b.startInventory) inventory[s.item] = s.qty;
  const defaultDecor = content.decor.all().filter((d) => d.isDefault);

  return {
    version: SAVE_VERSION,
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
      owned: defaultDecor.map((d) => d.id),
      equipped: Object.fromEntries(defaultDecor.map((d) => [d.slot, d.id])) as Record<DecorSlot, string>,
    },
    restaurant: {
      parties: [],
      orders: [],
      staff: content.staff.all().map((s) => ({ id: s.id, orderId: null })),
      spawnTimer: 10,
      layout: {},
    },
    farm: {
      slots: content.slotTypes.all().flatMap((t) => Array.from({ length: t.initial }, (_, i) => createSlot(t.id, i))),
    },
    market: { priceFactor: {} },
    weather: { id: content.weathers.all()[0].id, minutesLeft: 0 },
    stats: { today: emptyStats(), total: emptyStats() },
  };
}
