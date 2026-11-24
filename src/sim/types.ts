import type { EventBus } from '../core/events';
import type { Content, SlotType, MillType } from '../data';
import type { DayStats, GameState, FarmerTaskKind, HelperJob } from './state';
import type { GardenerJob } from '../data/farmhands';

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
  | { type: 'farmer/do'; slotId: string; kind: FarmerTaskKind; producerId?: string }
  | { type: 'farmer/doAll'; kind: 'harvest' | 'water' }
  | { type: 'farmer/cancel' }
  | { type: 'mill/buy'; millType: MillType }
  | { type: 'mill/setProduct'; millId: string; item: string }
  | { type: 'quest/claim' }
  | { type: 'profile/rename'; name: string }
  | { type: 'profile/renameOwner'; name: string }
  | { type: 'pet/adopt'; petId: string }
  | { type: 'pet/set'; petId: string; out: boolean }
  | { type: 'prop/buy'; propId: string }
  | { type: 'prop/move'; uid: string; x: number; y: number }
  | { type: 'prop/rotate'; uid: string }
  | { type: 'prop/store'; uid: string }
  | { type: 'prop/place'; uid: string }
  | { type: 'prop/sell'; uid: string }
  | { type: 'table/buy'; kind: string }
  | { type: 'table/sell'; tableId: string }
  | { type: 'layout/rotateTable'; tableId: string }
  | { type: 'restaurant/upgrade' }
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
  | { type: 'service/menu'; partyId: number }
  | { type: 'service/takeOrder'; partyId: number }
  | { type: 'service/deliver'; orderIds: number[]; partyId: number }
  | { type: 'service/clean'; tableId: string }
  | { type: 'service/mop'; stainId: number }
  | { type: 'contract/deliver'; contractId: number }
  /** Đơn giao tận nơi: nhận cuộc gọi (trừ nguyên liệu, món vào bếp) / từ chối. */
  | { type: 'takeout/accept'; id: number }
  | { type: 'takeout/decline'; id: number }
  /** Bồi bàn mang các món đơn giao tận nơi đang cầm tới quầy cashier. */
  | { type: 'service/handoff' }
  | { type: 'courier/hire' }
  | { type: 'courier/fire'; courierId: string }
  | { type: 'event/police'; choice: 'bribe' | 'table' }
  /** Bồi bàn ra quầy line lấy món nấu xong sớm nhất (tối đa balance.service.carryMax). */
  | { type: 'service/pickup' }
  /** Giao các món đang cầm của bàn này. */
  | { type: 'service/serve'; partyId: number }
  | { type: 'market/sell'; itemId: string; qty: number }
  | { type: 'kitchen/upgrade' }
  | { type: 'chef/hire' }
  | { type: 'chef/fire'; chefId: string }
  /** Giao / bỏ giao một món cho đầu bếp; recipeId null = cho nấu mọi món. */
  | { type: 'chef/setDish'; chefId: string; recipeId: string | null; on: boolean }
  | { type: 'helper/hire' }
  | { type: 'helper/fire'; helperId: string }
  | { type: 'helper/setJob'; helperId: string; job: HelperJob; on: boolean }
  | { type: 'gardener/hire' }
  | { type: 'gardener/fire'; gardenerId: string }
  | { type: 'gardener/setJob'; gardenerId: string; job: GardenerJob; on: boolean }
  | { type: 'tool/buy'; toolId: string }
  | { type: 'achievement/claim'; id: string }
  /** UI báo số bạn bè online hiện có (sim không biết mạng): giữ số lớn nhất từng có cho thành tựu kết bạn. */
  | { type: 'achievement/friends'; count: number }
  | { type: 'tutorial/next' }
  | { type: 'tutorial/skip' }
  | { type: 'crew/revive'; who: string }
  | { type: 'crew/pay' }
  | { type: 'crew/order'; who: string; stallId: string; dish: number }
  | { type: 'crew/autoOrder' }
  /** Bỏ một món đã gọi của người đang chọn (index trong các món của người đó; bỏ trống = món gọi sau cùng). */
  | { type: 'crew/unorder'; who: string; index?: number }
  /** Chốt bữa cho những ai đã gọi ít nhất một món. */
  | { type: 'crew/confirm' }
  | { type: 'day/end' }
  | { type: 'day/next' };

export type CommandType = Command['type'];
export type CommandOf<T extends CommandType> = Extract<Command, { type: T }>;
export type CommandResult = { ok: true } | { ok: false; reason: string };
export type CommandHandlers = {
  [T in CommandType]: (ctx: SimContext, cmd: CommandOf<T>) => CommandResult;
};

export const ok = (): CommandResult => ({ ok: true });
export const fail = (reason: string): CommandResult => ({ ok: false, reason });

/** serviceTimeout: chờ mang menu / chờ ghi món quá lâu. closed: còn xếp hàng lúc hết ca (quán nghỉ) — về vui vẻ, không trừ uy tín. */
export type LeaveReason = 'paid' | 'queueTimeout' | 'serviceTimeout' | 'foodTimeout' | 'noFood' | 'closed';

/** SỰ KIỆN sim phát ra cho UI (hiệu ứng, âm thanh, thông báo). UI không được sửa state khi nghe sự kiện. */
export interface SimEvents {
  'party/arrived': { partyId: number };
  'party/seated': { partyId: number; tableId: string };
  'party/left': { partyId: number; tableId: string | null; size: number; reason: LeaveReason; total: number; tip: number };
  'order/placed': { orderId: number; recipeId: string };
  /** Bếp nấu xong, món nằm ở quầy ra món. */
  'order/ready': { orderId: number; recipeId: string };
  /** Món đã được bồi bàn mang lên bàn. */
  'order/served': { orderId: number; recipeId: string };
  /** Nhóm khách cần bồi bàn: mang menu (menu) hoặc tới ghi món (order). */
  'party/needs': { partyId: number; need: 'menu' | 'order' };
  /** Bồi bàn vừa làm xong một việc. */
  'waiter/done': { kind: 'menu' | 'takeOrder' | 'pickup' | 'deliver' | 'handoff' | 'clean' | 'mop'; partyId: number | null };
  /** Đơn giao tận nơi: khách gọi tới · đủ món đóng gói · shipper chở đi · giao xong (về quán nhận tiền) · nhỡ cuộc gọi. */
  'takeout/call': { id: number };
  'takeout/packed': { id: number };
  'takeout/shipped': { id: number; who: string; until: number };
  'takeout/done': { id: number; money: number; tip: number; late: boolean };
  'takeout/missed': { id: number };
  /** Bắt đầu / hết một ca mở cửa (chỉ số trong balance.shifts). Hết ca thì sàn có thêm vết bẩn. */
  'shift/started': { index: number };
  'shift/ended': { index: number };
  /** Tới giờ ngưng nhận khách mới của ca (balance.shifts[i].lastCall). */
  'shift/lastCall': { index: number };
  /** Một người trong đội kiệt sức (who: id đầu bếp / 'waiter' / id nhân viên / 'farmer'). */
  'crew/fainted': { who: string };
  /** Đội quán / bác nông dân ra chợ (nghỉ trưa / ăn tối). */
  'crew/left': { group: 'restaurant' | 'farm'; kind: 'lunch' | 'dinner' };
  /** Hết giờ nghỉ trưa, về chỗ làm. */
  'crew/back': { group: 'restaurant' | 'farm' };
  /** Mọi người ăn xong — hoá đơn chờ thanh toán. */
  'crew/bill': { total: number };
  'farm/ready': { slotId: string };
  'farmer/done': { kind: FarmerTaskKind; slotId: string; ok: boolean; reason?: string };
  /** Cối vừa làm xong một mẻ thành phẩm (vào kho). */
  'mill/produced': { millId: string; item: string; qty: number };
  /** Nhiệm vụ hệ thống vừa đạt mục tiêu (chờ người chơi nhận thưởng). */
  'quest/completed': { questId: string };
  'quest/claimed': { questId: string; money: number };
  /** Người làm vườn vừa làm xong một việc. */
  'gardener/done': { gardenerId: string; kind: FarmerTaskKind; slotId: string };
  'tool/bought': { toolId: string };
  /** Ngày hướng dẫn sang bước mới (null = hết hướng dẫn). */
  'tutorial/step': { step: import('./state').TutorialStep | null };
  /** Vừa đạt một thành tựu (chờ nhận thưởng). */
  'achievement/reached': { id: string };
  'achievement/claimed': { id: string; money: number };
  /** Khách quen vừa tới quán (xếp hàng). */
  'regular/arrived': { regularId: string; partyId: number };
  /** Khách quen trả tiền xong: số tim mới, có lên tim không, được ăn món ruột không, quà tặng (id PropDef). */
  'regular/visited': { regularId: string; hearts: number; heartUp: boolean; fav: boolean; gift: string | null };
  /** Quán vừa lên hạng (phòng to hơn — cảnh quán cần dựng lại). */
  'restaurant/upgraded': { tier: number };
  /** Bếp lên hạng / thuê / cho nghỉ đầu bếp: cảnh quán cần dựng lại gian bếp. */
  'kitchen/changed': { tier: number; chefs: number };
  /** Đơn đặt hàng vừa giao xong / hết hạn. */
  'contract/done': { id: number; reward: number };
  'shipper/left': { id: number; until: number };
  'game/bankrupt': { money: number };
  'helper/sick': { id: string; name: string };
  'contract/expired': { id: number };
  /** Sự kiện ngẫu nhiên: báo trước buổi sáng (critic, inspector), bắt đầu, kết thúc (kết quả + xu thưởng / phạt). */
  'event/announced': { id: string; at: number };
  'event/started': { id: string };
  'event/ended': { id: string; result: 'good' | 'bad' | null; money: number; mess?: number; table?: string };
  'level/up': { level: number };
  'weather/changed': { id: string };
  /** Sáng ngày lễ (id FestivalDef, tiền mừng đã cộng). */
  'festival/started': { id: string; gift: number };
  /** Đầu mùa: số ô cây trái mùa ngoài trời vừa héo. */
  'farm/withered': { count: number };
  /** Sang mùa Đông: gà mái đẻ, bò sữa hết lứa. */
  'farm/culled': { count: number };
  /** Bão vừa quét qua: số ô rau / lúa bị dập (mất nửa tiến độ). */
  'farm/storm': { damaged: number };
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
