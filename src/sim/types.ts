import type { EventBus } from '../core/events';
import type { Content, SlotType } from '../data';
import type { DayStats, GameState } from './state';

/** Ngữ cảnh truyền cho mọi system / handler. */
export interface SimContext {
  state: GameState;
  content: Content;
  bus: EventBus<SimEvents>;
}

/**
 * LỆNH — cách DUY NHẤT để UI (hay AI, test, mạng...) thay đổi trạng thái game.
 * Thêm lệnh mới: thêm vào union này, rồi viết handler trong system liên quan.
 */
export type Command =
  | { type: 'market/buy'; stallId: string; itemId: string; qty: number }
  | { type: 'farm/till'; slotId: string }
  | { type: 'farm/water'; slotId: string }
  | { type: 'farm/waterAll' }
  | { type: 'farm/upgradeSlot'; slotId: string }
  | { type: 'farm/plant'; slotId: string; producerId: string }
  | { type: 'farm/harvest'; slotId: string }
  | { type: 'farm/harvestAll' }
  | { type: 'farm/clear'; slotId: string }
  | { type: 'farm/buySlot'; slotType: SlotType }
  | { type: 'menu/unlock'; recipeId: string }
  | { type: 'menu/setActive'; recipeId: string; active: boolean }
  | { type: 'upgrade/buy'; upgradeId: string }
  | { type: 'decor/buy'; decorId: string }
  | { type: 'decor/equip'; decorId: string }
  | { type: 'layout/moveTable'; tableId: string; x: number; y: number }
  | { type: 'layout/reset' }
  | { type: 'day/next' };

export type CommandType = Command['type'];
export type CommandOf<T extends CommandType> = Extract<Command, { type: T }>;
export type CommandResult = { ok: true } | { ok: false; reason: string };
export type CommandHandlers = {
  [T in CommandType]: (ctx: SimContext, cmd: CommandOf<T>) => CommandResult;
};

export const ok = (): CommandResult => ({ ok: true });
export const fail = (reason: string): CommandResult => ({ ok: false, reason });

export type LeaveReason = 'paid' | 'queueTimeout' | 'foodTimeout' | 'noFood';

/** SỰ KIỆN sim phát ra cho UI (hiệu ứng, âm thanh, thông báo). UI không được sửa state khi nghe sự kiện. */
export interface SimEvents {
  'party/arrived': { partyId: number };
  'party/seated': { partyId: number; tableId: string };
  'party/left': { partyId: number; tableId: string | null; size: number; reason: LeaveReason; total: number; tip: number };
  'order/placed': { orderId: number; recipeId: string };
  'order/served': { orderId: number; recipeId: string };
  'farm/ready': { slotId: string };
  'level/up': { level: number };
  'weather/changed': { id: string };
  'day/ended': { day: number; stats: DayStats };
  'day/started': { day: number };
}

/**
 * Một SYSTEM = một mảng gameplay độc lập. Thêm tính năng mới = thêm system mới
 * và đăng ký trong game.ts (thứ tự trong mảng là thứ tự update).
 */
export interface System {
  id: string;
  /** Chạy 1 lần khi tạo game mới (không chạy khi tải save). */
  init?(ctx: SimContext): void;
  /** Chạy mỗi bước mô phỏng; dt tính bằng phút game (<= 1). */
  update?(ctx: SimContext, dt: number): void;
  /** Chạy khi sang ngày mới. */
  onDayStart?(ctx: SimContext): void;
  commands?: Partial<CommandHandlers>;
}
