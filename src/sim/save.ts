import { decorFor, defaultDecor, type Content } from '../data';
import { createMill, createSlot, SAVE_VERSION, type GameState } from './state';

/**
 * Lưu/tải. State là JSON thuần nên lưu = JSON.stringify.
 * Khi đổi cấu trúc GameState: tăng SAVE_VERSION (state.ts) và thêm hàm chuyển đổi
 * migrations[phiên bản cũ] trả về state ở phiên bản kế tiếp.
 */
const migrations: Record<number, (old: any) => any> = {
  // v7 (chọn phong cách quán Nhật / Hàn / Việt): chủ dự án chốt bản này CHƠI LẠI TỪ ĐẦU — save v1–v6 bị bỏ qua
  // (deserialize trả null, màn hình mở đầu chỉ còn nút Ván mới). Các migration v1→v6 cũ đã xoá; xem lịch sử git nếu cần.
  // v7 -> v8: cối chế biến (lúa mì, lúa nước) + bác nông dân chở hàng. reconcile() tạo đủ cối khởi đầu.
  7: (s) => ({ ...s, farm: { ...s.farm, mills: [], farmer: { ...s.farm.farmer, carry: null } }, version: 8 }),
  // v8 -> v9: nhiệm vụ hệ thống (bắt đầu từ nhiệm vụ đầu tiên).
  8: (s) => ({ ...s, quests: { index: 0, progress: 0, done: false }, version: 9 }),
};

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** Trả null nếu save hỏng hoặc không nâng cấp được (khi đó tạo game mới). */
export function deserialize(raw: string | null, content: Content): GameState | null {
  if (!raw) return null;
  try {
    let data = JSON.parse(raw);
    while (data.version < SAVE_VERSION) {
      const migrate = migrations[data.version];
      if (!migrate) return null;
      data = migrate(data);
    }
    if (data.version !== SAVE_VERSION) return null;
    return reconcile(data as GameState, content);
  } catch {
    return null;
  }
}

/** Dọn các tham chiếu tới nội dung đã bị xoá/đổi tên để save cũ không làm vỡ game. */
function reconcile(state: GameState, content: Content): GameState {
  for (const id of Object.keys(state.inventory)) if (!content.items.has(id)) delete state.inventory[id];
  if (!content.cuisines.has(state.cuisine)) state.cuisine = 'vn';
  state.menu.unlocked = state.menu.unlocked.filter((id) => content.recipes.has(id) && content.recipes.get(id).cuisine === state.cuisine);
  state.menu.active = state.menu.active.filter((id) => state.menu.unlocked.includes(id));
  state.upgrades = state.upgrades.filter((id) => content.upgrades.has(id));

  const r = state.restaurant;
  r.orders = r.orders.filter((o) => content.recipes.has(o.recipeId));
  for (const p of r.parties) p.orderIds = p.orderIds.filter((id) => r.orders.some((o) => o.id === id));
  r.parties = r.parties.filter((p) => p.tableId == null || content.tables.has(p.tableId));
  // Bồi bàn: bỏ việc trỏ tới khách / món không còn; món đang bưng mà không còn trên tay thì trả về quầy
  const w = r.waiter;
  if (w.x < 0) Object.assign(w, content.room.waiterHome);
  w.tasks = w.tasks.filter((t) => r.parties.some((p) => p.id === t.partyId) && (t.kind !== 'deliver' || r.orders.some((o) => o.id === t.orderId)));
  if (w.carrying != null && !r.orders.some((o) => o.id === w.carrying)) w.carrying = null;
  for (const o of r.orders) if (o.status === 'carrying' && w.carrying !== o.id) o.status = 'ready';
  for (const p of r.parties) if (p.called && !w.tasks.some((t) => t.partyId === p.id && t.kind !== 'deliver')) p.called = false;
  r.staff = content.staff.all().map((def) => {
    const old = r.staff.find((s) => s.id === def.id);
    return { id: def.id, orderId: old && r.orders.some((o) => o.id === old.orderId) ? old.orderId : null };
  });

  // Nội thất: luôn sở hữu món mặc định của quán; slot nào đang dùng món không hợp lệ thì quay về mặc định.
  const allowed = new Set(decorFor(content, state.cuisine).map((d) => d.id));
  state.decor.owned = state.decor.owned.filter((id) => allowed.has(id));
  for (const def of defaultDecor(content, state.cuisine)) {
    if (!state.decor.owned.includes(def.id)) state.decor.owned.push(def.id);
    const used = state.decor.equipped[def.slot];
    if (!used || !state.decor.owned.includes(used) || content.decor.get(used).slot !== def.slot) state.decor.equipped[def.slot] = def.id;
  }
  for (const id of Object.keys(r.layout)) if (!content.tables.has(id)) delete r.layout[id];

  // Nhiệm vụ: danh sách ngắn đi thì coi như đã xong hết
  state.quests.index = Math.max(0, Math.min(state.quests.index, content.quests.length));

  if (!content.weathers.has(state.weather.id)) state.weather = { id: content.weathers.all()[0].id, minutesLeft: 0 };

  state.farm.slots = state.farm.slots.filter((s) => content.slotTypes.has(s.type));
  // Số ô khởi đầu tăng ở bản mới thì save cũ cũng được bù cho đủ.
  for (const type of content.slotTypes.all()) {
    for (let n = state.farm.slots.filter((s) => s.type === type.id).length; n < type.initial; n++) state.farm.slots.push(createSlot(type.id, n));
  }
  // Cối: bỏ loại không còn, đủ số cối khởi đầu, thành phẩm phải hợp lệ
  state.farm.mills = state.farm.mills.filter((m) => content.mills.has(m.type));
  for (const def of content.mills.all()) {
    for (let n = state.farm.mills.filter((m) => m.type === def.id).length; n < def.initial; n++) state.farm.mills.push(createMill(def.id, n, def.products[0]));
  }
  for (const m of state.farm.mills) if (!content.mills.get(m.type).products.includes(m.product)) m.product = content.mills.get(m.type).products[0];
  // Bác nông dân: bỏ việc trỏ tới ô / giống không còn
  const farmer = state.farm.farmer;
  if (farmer.x < -500) Object.assign(farmer, content.balance.farmer.home, { work: null });
  farmer.tasks = farmer.tasks.filter((t) => (t.kind === 'haul' ? state.farm.mills.some((m) => m.id === t.millId) : state.farm.slots.some((s) => s.id === t.slotId)) && (!t.producerId || content.producers.has(t.producerId)));
  if (farmer.carry && !content.items.has(farmer.carry.item)) farmer.carry = null;
  // Đang chở hàng mà mất việc chở (cối bị xoá) thì cho vào kho luôn
  if (farmer.carry && !farmer.tasks.some((t) => t.kind === 'haul')) {
    state.inventory[farmer.carry.item] = (state.inventory[farmer.carry.item] ?? 0) + farmer.carry.qty;
    farmer.carry = null;
  }
  if (!farmer.tasks.length) farmer.work = null;
  for (const slot of state.farm.slots) {
    if (slot.producerId && !content.producers.has(slot.producerId)) Object.assign(slot, { producerId: null, stage: 'growing', progress: 0, cyclesDone: 0 });
    if (slot.lastProducerId && !content.producers.has(slot.lastProducerId)) slot.lastProducerId = null;
  }
  return state;
}
