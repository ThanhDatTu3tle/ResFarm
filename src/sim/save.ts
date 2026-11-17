import type { Content } from '../data';
import { createSlot, SAVE_VERSION, type GameState } from './state';

/**
 * Lưu/tải. State là JSON thuần nên lưu = JSON.stringify.
 * Khi đổi cấu trúc GameState: tăng SAVE_VERSION (state.ts) và thêm hàm chuyển đổi
 * migrations[phiên bản cũ] trả về state ở phiên bản kế tiếp.
 */
const migrations: Record<number, (old: any) => any> = {
  // v1 -> v2: thêm thời tiết (id rỗng sẽ được reconcile() thay bằng thời tiết mặc định).
  1: (s) => ({ ...s, weather: { id: '', minutesLeft: 0 }, version: 2 }),
  // v2 -> v3: thêm nội thất và bố cục bàn (reconcile() điền món mặc định).
  // v3 -> v4: ô nông trại có thêm trạng thái đất + bậc nới rộng (ruộng cũ coi như đã cuốc để không làm khó save cũ).
  3: (s) => ({ ...s, farm: { ...s.farm, slots: s.farm.slots.map((slot: object) => ({ ...slot, tilled: true, wet: 0, tier: 1 })) }, version: 4 }),
  2: (s) => ({ ...s, decor: { owned: [], equipped: {} }, restaurant: { ...s.restaurant, layout: {} }, version: 3 }),
  // v4 -> v5: thêm bồi bàn. Khách đang 'ordering' (bản cũ tự gọi món) thành 'seated' chờ menu; vị trí bồi bàn
  // để reconcile() đặt về chỗ đứng chờ.
  4: (s) => ({
    ...s,
    restaurant: {
      ...s.restaurant,
      parties: s.restaurant.parties.map((p: { phase: string }) => ({ ...p, phase: p.phase === 'ordering' ? 'seated' : p.phase, called: false, wait: 0 })),
      waiter: { x: -1, y: -1, tasks: [], carrying: null },
    },
    version: 5,
  }),
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
  state.menu.unlocked = state.menu.unlocked.filter((id) => content.recipes.has(id));
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

  // Nội thất: luôn sở hữu món mặc định; slot nào đang dùng món không hợp lệ thì quay về mặc định.
  state.decor.owned = state.decor.owned.filter((id) => content.decor.has(id));
  for (const def of content.decor.all().filter((d) => d.isDefault)) {
    if (!state.decor.owned.includes(def.id)) state.decor.owned.push(def.id);
    const used = state.decor.equipped[def.slot];
    if (!used || !state.decor.owned.includes(used) || content.decor.get(used).slot !== def.slot) state.decor.equipped[def.slot] = def.id;
  }
  for (const id of Object.keys(r.layout)) if (!content.tables.has(id)) delete r.layout[id];

  if (!content.weathers.has(state.weather.id)) state.weather = { id: content.weathers.all()[0].id, minutesLeft: 0 };

  state.farm.slots = state.farm.slots.filter((s) => content.slotTypes.has(s.type));
  // Số ô khởi đầu tăng ở bản mới thì save cũ cũng được bù cho đủ.
  for (const type of content.slotTypes.all()) {
    for (let n = state.farm.slots.filter((s) => s.type === type.id).length; n < type.initial; n++) state.farm.slots.push(createSlot(type.id, n));
  }
  for (const slot of state.farm.slots) {
    if (slot.producerId && !content.producers.has(slot.producerId)) Object.assign(slot, { producerId: null, stage: 'growing', progress: 0, cyclesDone: 0 });
    if (slot.lastProducerId && !content.producers.has(slot.lastProducerId)) slot.lastProducerId = null;
  }
  return state;
}
