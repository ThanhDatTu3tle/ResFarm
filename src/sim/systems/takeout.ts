import { randInt } from '../../core/rng';
import { seasonalPrice } from '../calendar';
import { addReputation, addXp, earn, hasAll, modifier, removeAll, spend } from '../helpers';
import type { ItemStack } from '../../data';
import type { CourierState, ShipperState, TakeoutOrder } from '../state';
import { fail, ok, type SimContext, type System } from '../types';
import { tire } from './crew';
import { bumpQuest } from './quests';

/**
 * ĐƠN GIAO TẬN NƠI (giai đoạn 18) — mở khi quán lên hạng `balance.takeout.tier` ("Quán đông khách"), có quầy cashier ở cửa.
 *  1. Trong giờ mở cửa, thỉnh thoảng có khách gọi điện tới quầy cashier (đơn 'calling', chuông reo `ring` phút).
 *  2. Người chơi nhận đơn (`takeout/accept`): trừ nguyên liệu, món vào hàng chờ bếp như món của khách tại quán
 *     (Order.takeoutId, partyId = 0); hẹn giao trong `due` phút. Từ chối / để chuông reo hết thì đơn 'missed'.
 *  3. Bếp nấu xong → món ra quầy line. Bồi bàn lấy món ở quầy line, bấm quầy cashier (`service/handoff`, xem service.ts)
 *     → mang tới quầy cashier đóng gói. Nhân viên phục vụ thuê cũng tự bưng món giao tận nơi ra quầy.
 *  4. Đủ món thì đơn 'packed'. Shipper rảnh (shipper thuê thêm trước, rồi tới anh shipper của quán) tự lấy túi chở đi:
 *     tới nhà khách giữa chuyến (`arrive`), về quán cuối chuyến (`until`) mới nhận tiền.
 *     Đúng hẹn: tiền món × priceMul + tip; trễ hẹn: chỉ `lateRatio`, mất chút uy tín.
 * Shipper thuê thêm (`courier/hire`) chỉ giao đơn giao tận nơi; anh shipper gốc vẫn giao cả đơn hàng nguyên liệu (contracts.ts).
 */
const CLIENTS: [string, string][] = [
  ['Chị Lan — văn phòng tầng 5', '👩‍💼'],
  ['Nhà anh Hùng hẻm 12', '🏠'],
  ['Ký túc xá sinh viên', '🎓'],
  ['Tiệm tóc cô Mai', '💇'],
  ['Phòng khám Bình An', '🏥'],
  ['Chú bảo vệ chung cư', '🏢'],
  ['Nhóm học bài nhà Vy', '📚'],
  ['Xưởng may Phú Thịnh', '🧵'],
  ['Ông bà Tư cuối phố', '👴'],
  ['Đội bóng phường', '⚽'],
];

/** Giao tận nơi đã mở chưa (quán đủ hạng). */
export function takeoutOpen(ctx: SimContext): boolean {
  return ctx.state.restaurant.tier >= ctx.content.balance.takeout.tier;
}

/** Đơn còn đang chạy (chưa giao xong / chưa bỏ). */
function active(t: TakeoutOrder): boolean {
  return t.status === 'calling' || t.status === 'cooking' || t.status === 'packed' || t.status === 'shipping';
}

/** Số đơn đang reo chờ nhận (badge). */
export function callingTakeouts(ctx: SimContext): number {
  return ctx.state.takeout.orders.filter((t) => t.status === 'calling').length;
}

/** Nguyên liệu cần cho cả đơn. */
export function takeoutItems(ctx: SimContext, t: TakeoutOrder): ItemStack[] {
  const need = new Map<string, number>();
  for (const id of t.dishes) for (const s of ctx.content.recipes.get(id).ingredients) need.set(s.item, (need.get(s.item) ?? 0) + s.qty);
  return [...need].map(([item, qty]) => ({ item, qty }));
}

/** Mọi người chở hàng: shipper thuê thêm trước (chuyên giao tận nơi), anh shipper gốc sau. */
function riders(ctx: SimContext): { who: string; v: ShipperState | CourierState }[] {
  const r = ctx.state.restaurant;
  return [...r.couriers.map((c) => ({ who: c.id, v: c })), { who: 'shipper', v: r.shipper }];
}

/** Một đơn đã đủ món ở quầy cashier: chuyển sang đóng gói, bỏ các món khỏi danh sách đơn bếp. */
export function checkPacked(ctx: SimContext, takeoutId: number): void {
  const r = ctx.state.restaurant;
  const t = ctx.state.takeout.orders.find((x) => x.id === takeoutId);
  if (!t || t.status !== 'cooking') return;
  const mine = r.orders.filter((o) => o.takeoutId === t.id);
  if (mine.length < t.orderIds.length || mine.some((o) => o.status !== 'served')) return;
  r.orders = r.orders.filter((o) => o.takeoutId !== t.id);
  t.status = 'packed';
  ctx.bus.emit('takeout/packed', { id: t.id });
}

function scheduleNext(ctx: SimContext, from: number): void {
  const [a, b] = ctx.content.balance.takeout.every;
  ctx.state.takeout.nextCall = from + randInt(ctx.state.rng, a, b);
}

/** Khách gọi tới: 1..dishes món trong thực đơn đang bán (món có thể trùng). */
function ring(ctx: SimContext): void {
  const { state, content } = ctx;
  const b = content.balance.takeout;
  const menu = state.menu.active.filter((id) => content.recipes.has(id));
  if (!menu.length) return;
  const n = randInt(state.rng, 1, b.dishes);
  const dishes = Array.from({ length: n }, () => menu[randInt(state.rng, 0, menu.length - 1)]);
  const used = new Set(state.takeout.orders.filter(active).map((t) => t.client));
  const pool = CLIENTS.filter(([c]) => !used.has(c));
  const [client, icon] = pool[randInt(state.rng, 0, pool.length - 1)] ?? CLIENTS[0];
  const price = Math.round(dishes.reduce((s, id) => s + seasonalPrice(ctx, content.recipes.get(id)), 0) * b.priceMul * modifier(ctx, 'dishPrice'));
  const t: TakeoutOrder = { id: state.nextId++, client, icon, dishes, orderIds: [], status: 'calling', expires: state.clock.minute + b.ring, due: 0, price };
  state.takeout.orders.push(t);
  ctx.bus.emit('takeout/call', { id: t.id });
}

/** Chuyến giao xong (về tới quán): nhận tiền đơn. */
function finishTakeoutTrip(ctx: SimContext, v: ShipperState | CourierState): void {
  const id = v.trip?.takeoutId;
  v.trip = null;
  const t = ctx.state.takeout.orders.find((x) => x.id === id);
  if (!t || t.status !== 'shipping') return;
  const b = ctx.content.balance.takeout;
  const money = t.late ? Math.round(t.price * b.lateRatio) : t.price;
  const tip = t.late ? 0 : Math.round(t.price * b.tip);
  earn(ctx, money + tip);
  ctx.state.stats.today.tips += tip;
  ctx.state.stats.total.tips += tip;
  addXp(ctx, Math.round(t.price * b.xpRatio));
  addReputation(ctx, t.late ? b.lateRep : b.rep);
  t.status = 'done';
  bumpQuest(ctx, 'serve');
  ctx.bus.emit('takeout/done', { id: t.id, money, tip, late: !!t.late });
}

export const takeoutSystem: System = {
  id: 'takeout',
  onDayStart(ctx) {
    // Qua đêm: chuyến đang chạy coi như giao xong; đơn chưa nấu xong thì huỷ (món trong bếp bỏ đi)
    for (const { v } of riders(ctx)) if (v.trip?.takeoutId != null) finishTakeoutTrip(ctx, v);
    const r = ctx.state.restaurant;
    r.orders = r.orders.filter((o) => o.takeoutId == null);
    ctx.state.takeout.orders = [];
    ctx.state.takeout.nextCall = 0;
  },
  update(ctx) {
    const { state, content } = ctx;
    const b = content.balance.takeout;
    const m = state.clock.minute;
    // Chuyến giao: tới nhà khách (xét đúng / trễ hẹn), về tới quán thì nhận tiền
    for (const { v } of riders(ctx)) {
      const trip = v.trip;
      if (trip?.takeoutId == null) continue;
      const t = state.takeout.orders.find((x) => x.id === trip.takeoutId);
      if (t && trip.arrive != null && m >= trip.arrive && t.late == null) t.late = trip.arrive > t.due;
      if (m >= trip.until) finishTakeoutTrip(ctx, v);
    }
    // Chuông reo quá lâu không ai nhận: khách cúp máy
    for (const t of state.takeout.orders) {
      if (t.status === 'calling' && m >= t.expires) {
        t.status = 'missed';
        ctx.bus.emit('takeout/missed', { id: t.id });
      }
    }
    if (!takeoutOpen(ctx)) return;
    // Đơn đã đóng gói: shipper rảnh tự lấy đi giao
    for (const t of state.takeout.orders.filter((x) => x.status === 'packed')) {
      const rider = riders(ctx).find(({ v }) => !v.trip && !v.fainted);
      if (!rider || state.crew.restaurantAway) break;
      const len = randInt(state.rng, b.trip[0], b.trip[1]);
      rider.v.trip = { takeoutId: t.id, arrive: m + Math.round(len / 2), until: m + len };
      t.status = 'shipping';
      tire(ctx, rider.who, rider.v, randInt(state.rng, b.energy[0], b.energy[1]));
      ctx.bus.emit('takeout/shipped', { id: t.id, who: rider.who, until: m + len });
    }
    // Cuộc gọi mới: chỉ trong giờ mở cửa, cả đội đang ở quán, chưa quá nhiều đơn dở dang
    if (state.clock.phase !== 'open' || state.crew.restaurantAway) return;
    if (!state.takeout.nextCall) scheduleNext(ctx, m);
    if (m < state.takeout.nextCall) return;
    scheduleNext(ctx, m);
    if (state.takeout.orders.filter((t) => active(t) && t.status !== 'shipping').length >= b.maxOpen) return;
    ring(ctx);
  },
  commands: {
    'takeout/accept'(ctx, cmd) {
      const { state, content } = ctx;
      const t = state.takeout.orders.find((x) => x.id === cmd.id);
      if (!t || t.status !== 'calling') return fail('Cuộc gọi này đã kết thúc.');
      if (state.crew.restaurantAway) return fail('Cả đội đang ở chợ — về quán rồi mới nhận đơn được.');
      const items = takeoutItems(ctx, t);
      if (!hasAll(ctx, items)) return fail('Kho không đủ nguyên liệu cho đơn này.');
      removeAll(ctx, items);
      for (const recipeId of t.dishes) {
        const order = { id: state.nextId++, partyId: 0, recipeId, status: 'queued' as const, progress: 0, takeoutId: t.id };
        state.restaurant.orders.push(order);
        t.orderIds.push(order.id);
        ctx.bus.emit('order/placed', { orderId: order.id, recipeId });
      }
      t.status = 'cooking';
      t.due = state.clock.minute + content.balance.takeout.due;
      return ok();
    },
    'takeout/decline'(ctx, cmd) {
      const t = ctx.state.takeout.orders.find((x) => x.id === cmd.id);
      if (!t || t.status !== 'calling') return fail('Cuộc gọi này đã kết thúc.');
      t.status = 'missed';
      return ok();
    },
    'courier/hire'(ctx) {
      const { state, content } = ctx;
      const b = content.balance.takeout;
      const r = state.restaurant;
      if (!takeoutOpen(ctx)) return fail(`Nâng quán lên hạng ${content.room.tiers[b.tier - 1].name} để mở giao tận nơi.`);
      if (r.couriers.length >= b.maxCouriers) return fail('Đã đủ shipper rồi.');
      if (!spend(ctx, b.hireCost)) return fail('Không đủ tiền.');
      r.couriers.push({ id: `courier${state.nextId++}`, name: COURIER_NAMES[r.couriers.length % COURIER_NAMES.length], energy: content.balance.crew.shipperMaxEnergy, fainted: false, trip: null });
      return ok();
    },
    'courier/fire'(ctx, cmd) {
      const r = ctx.state.restaurant;
      const c = r.couriers.find((x) => x.id === cmd.courierId);
      if (!c) return fail('Không có shipper này.');
      if (c.trip) return fail('Shipper đang đi giao — đợi về rồi cho nghỉ.');
      r.couriers = r.couriers.filter((x) => x !== c);
      ctx.state.crew.pending = ctx.state.crew.pending.filter((p) => p.who !== c.id);
      return ok();
    },
  },
};

const COURIER_NAMES = ['Anh Tài', 'Chị Ngân', 'Anh Lộc'];

/**
 * (Chỉ bản dev, ?takeout=demo) Dựng sẵn tình huống để thử: thuê 1 shipper, một đơn đã nấu xong nằm ở quầy line (bưng ra
 * quầy cashier), một đơn đã đóng gói (shipper chở đi ngay), và khách gọi tới ngay khi quán mở. Quán phải đủ hạng.
 */
export function seedTakeoutDemo(ctx: SimContext): void {
  const { state, content } = ctx;
  if (!takeoutOpen(ctx)) return;
  if (!state.restaurant.couriers.length) {
    state.money += content.balance.takeout.hireCost;
    takeoutSystem.commands!['courier/hire']!(ctx, { type: 'courier/hire' });
  }
  const menu = state.menu.active;
  const m = state.clock.minute;
  const mk = (client: [string, string], dishes: string[], status: TakeoutOrder['status']): TakeoutOrder => {
    const price = Math.round(dishes.reduce((s, id) => s + seasonalPrice(ctx, content.recipes.get(id)), 0) * content.balance.takeout.priceMul);
    return { id: state.nextId++, client: client[0], icon: client[1], dishes, orderIds: [], status, expires: m, due: m + content.balance.takeout.due, price };
  };
  const cooking = mk(CLIENTS[2], [menu[0], menu[1] ?? menu[0]], 'cooking');
  for (const recipeId of cooking.dishes) {
    const o = { id: state.nextId++, partyId: 0, recipeId, status: 'ready' as const, progress: 999, readyAt: state.clock.day * 1440 + m, takeoutId: cooking.id };
    state.restaurant.orders.push(o);
    cooking.orderIds.push(o.id);
  }
  state.takeout.orders.push(cooking, mk(CLIENTS[0], [menu[0]], 'packed'));
  state.takeout.nextCall = 1;
}
