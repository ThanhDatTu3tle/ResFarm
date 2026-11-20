import { farmTools } from '../data/farmhands';
import { decorFor, defaultDecor, type Content } from '../data';
import { EventBus } from '../core/events';
import { canPlaceTable } from './layout';
import { resolveOverlaps } from './systems/home';
import type { SimContext } from './types';
import { cleanOwner, createMill, createSlot, plantInitial, DEFAULT_SHOP_NAME, SAVE_VERSION, type GameState } from './state';

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
  // v9 -> v10: khách quen (F2) + quán của riêng mình (tên, thú cưng, đồ trang trí, bàn mua thêm, hạng quán).
  9: (s) => ({
    ...s,
    regulars: {},
    profile: { name: DEFAULT_SHOP_NAME, pet: null, pets: [] },
    restaurant: { ...s.restaurant, extraTables: [], props: [], tier: 1, parties: s.restaurant.parties.map((p: object) => ({ ...p, regular: null })) },
    version: 10,
  }),
  // v10 -> v11: khay bưng nhiều món, chén dĩa dơ, vết bẩn sàn; quán khởi đầu nhỏ lại (reconcile dời đồ nằm ngoài phòng).
  10: (s) => ({
    ...s,
    restaurant: {
      ...s.restaurant,
      dirty: {},
      stains: [],
      waiter: {
        ...s.restaurant.waiter,
        carrying: s.restaurant.waiter.carrying == null ? [] : [s.restaurant.waiter.carrying],
        tasks: s.restaurant.waiter.tasks.map((t: { kind: string; orderId?: number }) => (t.kind === 'deliver' ? { kind: 'deliver', orderIds: [t.orderId], partyId: (t as unknown as { partyId: number }).partyId } : t)),
      },
    },
    version: 11,
  }),
  // v11 -> v12: nhân viên phục vụ thuê thêm.
  11: (s) => ({ ...s, restaurant: { ...s.restaurant, helpers: [] }, version: 12 }),
  // v12 -> v13: năng lượng cho cả đội (bếp, bồi bàn, bác nông dân; tối đa 30, nay 40), giờ nghỉ ra chợ ăn + hoá đơn; nhân viên thuê bỏ `away`.
  12: (s) => {
    const full = { energy: 40, fainted: false };
    return {
      ...s,
      crew: { restaurantAway: null, farmerAway: null, pending: [], meals: [], bill: [] },
      restaurant: {
        ...s.restaurant,
        staff: s.restaurant.staff.map((x: object) => ({ ...x, ...full })),
        waiter: { ...s.restaurant.waiter, ...full },
        helpers: s.restaurant.helpers.map(({ away: _away, ...h }: { away: unknown }) => ({ ...h, ...full })),
      },
      farm: { ...s.farm, farmer: { ...s.farm.farmer, ...full } },
      version: 13,
    };
  },
  // v13 -> v14: thống kê theo mùa / năm (bắt đầu đếm từ lúc nâng cấp).
  13: (s) => ({ ...s, stats: { ...s.stats, season: { ...s.stats.today }, year: { ...s.stats.today } }, version: 14 }),
  // v14 -> v15: hạng bếp (bếp + quầy line), đầu bếp thuê thêm.
  14: (s) => ({ ...s, restaurant: { ...s.restaurant, kitchenTier: 1 }, version: 15 }),
  // v15 -> v16: đơn đặt hàng, sự kiện ngẫu nhiên (bắt đầu từ ngày hôm sau).
  15: (s) => ({ ...s, contracts: [], event: null, version: 16 }),
  // v16 -> v17: người làm vườn, dụng cụ nông trại, sổ thành tựu.
  16: (s) => ({ ...s, farm: { ...s.farm, tools: [], gardeners: [] }, achievements: { counts: {}, done: [], claimed: [] }, traffic: 1, tutorial: null, version: 17 }),
  // v17 -> v18: ông / bà chủ quán (giới tính + tuổi), ván cũ mặc định ông chủ 30 tuổi.
  17: (s) => ({ ...s, owner: { gender: 'male', age: 30 }, version: 18 }),
  // v18 -> v19: tên, kiểu tóc, quần áo của chủ quán (cleanOwner điền mặc định).
  18: (s) => ({ ...s, owner: { ...s.owner, name: '', hair: 'auto', outfit: 'auto' }, version: 19 }),
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
  state.owner = cleanOwner(state.owner);
  state.menu.unlocked = state.menu.unlocked.filter((id) => content.recipes.has(id) && content.recipes.get(id).cuisine === state.cuisine);
  state.menu.active = state.menu.active.filter((id) => state.menu.unlocked.includes(id));
  state.upgrades = state.upgrades.filter((id) => content.upgrades.has(id));

  const r = state.restaurant;
  r.orders = r.orders.filter((o) => content.recipes.has(o.recipeId));
  for (const p of r.parties) p.orderIds = p.orderIds.filter((id) => r.orders.some((o) => o.id === id));
  // Quán của riêng mình: hạng, bàn mua thêm, đồ trang trí, thú cưng
  r.tier = Math.max(1, Math.min(content.room.tiers.length, Math.floor(r.tier) || 1));
  r.extraTables = r.extraTables.filter((t) => content.tableKinds.has(t.kind) && r.layout[t.id]);
  r.props = r.props.filter((p) => content.props.has(p.def) && (!content.props.get(p.def).cuisine || content.props.get(p.def).cuisine === state.cuisine));
  const profile = state.profile;
  profile.name = String(profile.name ?? '').slice(0, 24) || DEFAULT_SHOP_NAME;
  profile.pets = profile.pets.filter((id) => content.pets.has(id));
  if (profile.pet && !profile.pets.includes(profile.pet)) profile.pet = null;
  for (const id of Object.keys(state.regulars)) if (!content.regulars.has(id)) delete state.regulars[id];
  const tableIds = new Set([...content.tables.all().map((t) => t.id), ...r.extraTables.map((t) => t.id)]);
  r.parties = r.parties.filter((p) => p.tableId == null || tableIds.has(p.tableId));
  for (const p of r.parties) if (p.regular && !content.regulars.has(p.regular)) p.regular = null;
  // Nông trại: dụng cụ còn trong data, số người làm vườn theo chỗ đã mở, việc trỏ tới ô không còn thì bỏ
  const farm = state.farm;
  if (typeof state.traffic !== 'number' || !(state.traffic > 0)) state.traffic = 1;
  if (state.tutorial === undefined) state.tutorial = null;
  farm.tools = farm.tools.filter((id) => farmTools.some((t) => t.id === id));
  farm.gardeners = farm.gardeners.slice(0, content.balance.gardeners.levels.filter((l) => state.level >= l).length);
  for (const g of farm.gardeners) {
    if (g.task && !farm.slots.some((s) => s.id === g.task!.slotId)) Object.assign(g, { task: null, work: null });
  }
  for (const id of state.achievements.claimed) if (!state.achievements.done.includes(id)) state.achievements.done.push(id);
  // Bồi bàn: bỏ việc trỏ tới khách / món không còn; món đang bưng mà không còn trên tay thì trả về quầy
  if (r.waiter.x < 0) Object.assign(r.waiter, content.room.waiterHome);
  // Chỗ nhân viên: theo hạng quán + phần cộng của hạng bếp (khớp maxHelpers trong systems/helpers.ts)
  const kitchenBonus = content.balance.kitchen.tiers[Math.max(1, Math.floor(r.kitchenTier) || 1) - 1]?.helpers ?? 0;
  r.helpers = r.helpers.slice(0, Math.min(4, Math.max(0, r.tier - 1) + kitchenBonus));
  for (const w of [r.waiter, ...r.helpers]) {
  w.tasks = w.tasks.filter((t) => {
    if (t.kind === 'clean') return tableIds.has(t.tableId);
    if (t.kind === 'mop') return r.stains.some((s) => s.id === t.stainId);
    if (t.kind === 'pickup') return true;
    if (!r.parties.some((p) => p.id === t.partyId)) return false;
    if (t.kind === 'deliver') t.orderIds = t.orderIds.filter((id) => r.orders.some((o) => o.id === id));
    return t.kind !== 'deliver' || t.orderIds.length > 0;
  });
  w.carrying = w.carrying.filter((id) => r.orders.some((o) => o.id === id));
  }
  const workers = [r.waiter, ...r.helpers];
  for (const o of r.orders) if (o.status === 'carrying' && !workers.some((w) => w.carrying.includes(o.id))) o.status = 'ready';
  for (const p of r.parties) if (p.called && !workers.some((w) => w.tasks.some((t) => (t.kind === 'menu' || t.kind === 'takeOrder') && t.partyId === p.id))) p.called = false;
  for (const id of Object.keys(r.dirty)) if (!tableIds.has(id)) delete r.dirty[id];
  // Đầu bếp: luôn có các đầu bếp sẵn (không `hire`), giữ đầu bếp thuê thêm còn trong data; món được giao chỉ giữ món còn tồn tại
  r.kitchenTier = Math.max(1, Math.min(content.balance.kitchen.tiers.length, Math.floor(r.kitchenTier) || 1));
  r.staff = content.staff
    .all()
    .filter((def) => !def.hire || r.staff.some((s) => s.id === def.id))
    .map((def) => {
      const old = r.staff.find((s) => s.id === def.id);
      const max = content.balance.crew.chefMaxEnergy;
      const dishes = old?.dishes ? old.dishes.filter((id) => content.recipes.has(id)) : null;
      return { id: def.id, orderId: old && r.orders.some((o) => o.id === old.orderId) ? old.orderId : null, energy: Math.min(max, old?.energy ?? max), fainted: old?.fainted ?? false, ...(dishes ? { dishes } : {}) };
    });

  // Nội thất: luôn sở hữu món mặc định của quán; slot nào đang dùng món không hợp lệ thì quay về mặc định.
  const allowed = new Set(decorFor(content, state.cuisine).map((d) => d.id));
  state.decor.owned = state.decor.owned.filter((id) => allowed.has(id));
  for (const def of defaultDecor(content, state.cuisine)) {
    if (!state.decor.owned.includes(def.id)) state.decor.owned.push(def.id);
    const used = state.decor.equipped[def.slot];
    if (!used || !state.decor.owned.includes(used) || content.decor.get(used).slot !== def.slot) state.decor.equipped[def.slot] = def.id;
  }
  for (const id of Object.keys(r.layout)) if (!tableIds.has(id)) delete r.layout[id];

  // Quán nhỏ lại / bàn gốc đổi chỗ: bàn gốc nằm sai chỗ thì về mặc định; bàn thêm, đồ trang trí bị đè thì dời / cất kho
  fixLayout({ state, content, bus: new EventBus() });

  // Nhiệm vụ: danh sách ngắn đi thì coi như đã xong hết
  state.quests.index = Math.max(0, Math.min(state.quests.index, content.quests.length));

  if (!content.weathers.has(state.weather.id)) state.weather = { id: content.weathers.all()[0].id, minutesLeft: 0 };

  state.farm.slots = state.farm.slots.filter((s) => content.slotTypes.has(s.type));
  // Số ô khởi đầu tăng ở bản mới thì save cũ cũng được bù cho đủ.
  for (const type of content.slotTypes.all()) {
    for (let n = state.farm.slots.filter((s) => s.type === type.id).length; n < type.initial; n++) state.farm.slots.push(plantInitial(content, createSlot(type.id, n), n));
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
  // Đội: bữa ăn / hoá đơn ở hàng rong đã bị xoá thì bỏ
  const vendor = (l: { stallId: string }) => content.stalls.has(l.stallId);
  state.crew.meals = state.crew.meals.filter(vendor);
  state.crew.pending ??= [];
  state.crew.bill = state.crew.bill.filter(vendor);
  for (const slot of state.farm.slots) {
    if (slot.producerId && !content.producers.has(slot.producerId)) Object.assign(slot, { producerId: null, stage: 'growing', progress: 0, cyclesDone: 0 });
    if (slot.lastProducerId && !content.producers.has(slot.lastProducerId)) slot.lastProducerId = null;
  }
  return state;
}

/** Bàn gốc đặt ở chỗ không còn hợp lệ (phòng nhỏ lại) thì về chỗ mặc định; rồi dời bàn thêm / đồ trang trí bị đè. */
function fixLayout(ctx: SimContext): void {
  const r = ctx.state.restaurant;
  for (const t of ctx.content.tables.all()) {
    const at = r.layout[t.id];
    if (at && canPlaceTable(ctx, t.id, at.x, at.y) && !r.parties.some((p) => p.tableId === t.id)) delete r.layout[t.id];
  }
  resolveOverlaps(ctx);
}
