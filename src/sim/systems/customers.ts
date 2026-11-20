import { bumpQuest } from './quests';
import { criticDone } from './events';
import { festivalOf, seasonalPrice } from '../calendar';
import { tutorialHoldsGuests, tutorialLunch } from './tutorial';
import { randInt, randRange, weightedIndex } from '../../core/rng';
import { addReputation, addXp, earn, hasAll, modifier, removeAll } from '../helpers';
import { activeTables, occupiedSeats } from '../layout';
import type { Party } from '../state';
import { favoriteOf, pickRegular, regularPaid, regularTipBonus } from './regulars';

export { activeTables, occupiedSeats };
import type { LeaveReason, SimContext, System } from '../types';

/** Số kiểu ngoại hình khách mà scene biết vẽ. */
export const LOOK_COUNT = 8;

/** Bốn bậc tâm trạng khi chờ món: 0 vui vẻ, 1 bình thường, 2 chán nản, 3 tức giận. */
export type Mood = 0 | 1 | 2 | 3;

/** Tâm trạng hiện tại của nhóm (chỉ tụt khi món đã ra quầy mà người chơi chưa mang tới). */
export function moodOf(ctx: SimContext, party: Party): Mood {
  return Math.min(3, Math.floor(party.wait / ctx.content.balance.service.moodStep)) as Mood;
}

/**
 * Vòng đời khách: tới -> xếp hàng -> ngồi bàn (chờ menu) -> xem menu -> chờ ghi món -> chờ món -> ăn -> trả tiền.
 * Mang menu, ghi món, bưng món là việc của bồi bàn (người chơi) — xem systems/service.ts.
 */
export const customerSystem: System = {
  id: 'customers',
  init: rollTraffic,
  onDayStart: rollTraffic,
  update(ctx, dt) {
    const { state, content } = ctx;
    const b = content.balance;
    const r = state.restaurant;

    // Quá giờ khách phải về (12:30 / 21:30): khách đang ăn trả tiền luôn, còn lại mời về (không trừ uy tín)
    if (r.parties.length && !inSeating(ctx)) {
      for (const p of [...r.parties]) {
        if (p.phase === 'eating') pay(ctx, p);
        else leave(ctx, p, 'closed');
      }
    }

    if (state.clock.phase === 'open' && !acceptingGuests(ctx)) {
      // Ngoài giờ nhận khách (nghỉ trưa, sau giờ chót): mở ca lại là có khách ngay, không phải chờ hết lượt cũ
      r.spawnTimer = b.firstGuest;
    } else if (state.clock.phase === 'open' && !tutorialHoldsGuests(ctx)) {
      r.spawnTimer -= dt;
      if (r.spawnTimer <= 0) {
        r.spawnTimer = nextSpawnDelay(ctx);
        if (r.parties.filter((p) => p.phase === 'queue').length < b.maxQueue) spawnParty(ctx);
      }
    }

    // Duyệt bản sao vì party có thể bị xoá trong lúc duyệt. Thứ tự mảng = thứ tự tới => xếp bàn FIFO.
    for (const p of [...r.parties]) {
      switch (p.phase) {
        case 'queue': {
          const spot = findSeats(ctx, p.size);
          if (spot) {
            p.tableId = spot.tableId;
            p.seats = spot.seats;
            p.phase = 'seated';
            p.called = false;
            p.patience = p.patienceMax = b.service.menuPatience * modifier(ctx, 'patience');
            ctx.bus.emit('party/seated', { partyId: p.id, tableId: spot.tableId });
            ctx.bus.emit('party/needs', { partyId: p.id, need: 'menu' });
          } else if (!inShift(ctx)) {
            // Hết ca mà vẫn chưa có bàn: quán treo biển nghỉ, khách hẹn lần sau (để cả đội còn ra chợ nghỉ trưa)
            leave(ctx, p, 'closed');
          } else {
            p.patience -= dt;
            if (p.patience <= 0) leave(ctx, p, 'queueTimeout');
          }
          break;
        }
        case 'seated':
        case 'readyToOrder':
          // Đóng cửa mà khách chưa gọi món: mời khách về (không trừ uy tín) để cả đội nghỉ
          if (!inShift(ctx)) {
            leave(ctx, p, 'closed');
            break;
          }
          // Bồi bàn đang tới thì khách chờ được, không mất kiên nhẫn
          if (!p.called) {
            p.patience -= dt;
            if (p.patience <= 0) leave(ctx, p, 'serviceTimeout');
          }
          break;
        case 'browsing':
          p.timer -= dt;
          if (p.timer <= 0) {
            p.phase = 'readyToOrder';
            p.called = false;
            p.patience = p.patienceMax = b.service.orderPatience * modifier(ctx, 'patience');
            ctx.bus.emit('party/needs', { partyId: p.id, need: 'order' });
          }
          break;
        case 'waitingFood': {
          const mine = r.orders.filter((o) => o.partyId === p.id);
          if (mine.length && mine.every((o) => o.status === 'served')) {
            p.phase = 'eating';
            p.timer = eatMinutes(ctx, p.size);
            break;
          }
          // Tâm trạng chỉ tụt khi có món đã nấu xong mà chưa mang tới (việc của người chơi)
          if (mine.some((o) => o.status === 'ready' || o.status === 'carrying')) {
            p.wait += dt;
            if (p.wait >= b.service.moodStep * 4) {
              leave(ctx, p, 'foodTimeout');
              break;
            }
          }
          // Bếp quá tải: chờ quá lâu cũng bỏ về
          p.patience -= dt;
          if (p.patience <= 0) leave(ctx, p, 'foodTimeout');
          break;
        }
        case 'eating':
          p.timer -= dt;
          if (p.timer <= 0) pay(ctx, p);
          break;
      }
    }
  },
};

/** Còn nhận khách mới không (trong ca và chưa tới giờ ngưng nhận khách lastCall). */
export function acceptingGuests(ctx: SimContext, minute = ctx.state.clock.minute): boolean {
  return ctx.content.balance.shifts.some((s) => minute >= s.from && minute < s.lastCall);
}

/** Còn cho khách ngồi không (từ đầu ca tới giờ khách phải về `kickOut`; ngày hướng dẫn ca sáng về lúc 12:00). */
export function inSeating(ctx: SimContext, minute = ctx.state.clock.minute): boolean {
  return ctx.content.balance.shifts.some((s, i) => minute >= s.from && minute < (i === 0 && tutorialLunch(ctx) ? s.to : s.kickOut));
}

/** Thời gian ngồi ăn của nhóm `size` người (ngẫu nhiên trong khoảng `balance.eatTime`). */
function eatMinutes(ctx: SimContext, size: number): number {
  const table = ctx.content.balance.eatTime;
  const [lo, hi] = table[Math.max(0, Math.min(table.length - 1, size - 1))];
  return randRange(ctx.state.rng, lo, hi);
}

/** Lưu lượng khách mỗi sáng: ngày thường / ngày lễ (ngày hướng dẫn giữ 1). */
export function rollTraffic(ctx: SimContext): void {
  const { state, content } = ctx;
  const t = content.balance.traffic;
  const [lo, hi] = festivalOf(state.clock.day) ? t.festival : t.normal;
  state.traffic = state.tutorial ? 1 : Math.round(randRange(state.rng, lo, hi) * 100) / 100;
}

/** Đang trong một ca mở cửa (balance.shifts) không. */
export function inShift(ctx: SimContext, minute = ctx.state.clock.minute): boolean {
  return ctx.content.balance.shifts.some((s) => minute >= s.from && minute < s.to);
}

/** Tìm chỗ cho nhóm `size` người: ưu tiên bàn ít ghế thừa nhất (bỏ qua ghế còn chén dĩa dơ). */
export function findSeats(ctx: SimContext, size: number): { tableId: string; seats: number[] } | null {
  let best: { tableId: string; seats: number[]; waste: number } | null = null;
  for (const t of activeTables(ctx)) {
    if (size > (t.maxParty ?? (t.shared ? 1 : t.seats))) continue;
    const taken = [...occupiedSeats(ctx, t.id), ...(ctx.state.restaurant.dirty[t.id] ?? [])];
    if (!t.shared && taken.length > 0) continue;
    const free = Array.from({ length: t.seats }, (_, i) => i).filter((i) => !taken.includes(i));
    if (free.length < size) continue;
    const waste = t.shared ? 0 : t.seats - size;
    if (!best || waste < best.waste) best = { tableId: t.id, seats: free.slice(0, size), waste };
  }
  return best && { tableId: best.tableId, seats: best.seats };
}

function nextSpawnDelay(ctx: SimContext): number {
  const { state, content } = ctx;
  const b = content.balance;
  const repFactor = 0.5 + (state.reputation / 5) * 1.2;
  const rush = b.rushHours.find((h) => state.clock.minute >= h.from && state.clock.minute < h.to)?.factor ?? 1;
  const delay = (b.spawnInterval * randRange(state.rng, 0.6, 1.4)) / (repFactor * rush * state.traffic * modifier(ctx, 'spawnRate'));
  // Ngày vắng (uy tín thấp, mưa, lưu lượng thấp) vẫn không để quá `spawnMaxGap` phút không có ai
  return Math.min(delay, b.spawnMaxGap * randRange(state.rng, 0.7, 1));
}

/** Thêm một nhóm khách vào hàng chờ. `opts`: nhóm đặc biệt của sự kiện (vd nhà phê bình đi một mình). */
export function spawnParty(ctx: SimContext, opts: { size?: number; vip?: string; want?: string; tutorial?: boolean } = {}): Party {
  const { state, content } = ctx;
  const regular = opts.vip || opts.tutorial ? null : pickRegular(ctx);
  let size = opts.size ?? Math.max(1, weightedIndex(state.rng, content.balance.partySizeWeights));
  if (regular) size = Math.min(size, content.balance.regulars.maxPartySize);
  // Không có bàn đủ chỗ thì nhóm nhỏ lại cho vừa bàn lớn nhất đang có (quán nhỏ chỉ có bàn bốn)
  size = Math.min(size, Math.max(1, ...activeTables(ctx).map((t) => t.maxParty ?? (t.shared ? 1 : t.seats))));
  const patience = content.balance.queuePatience * modifier(ctx, 'patience');
  const party: Party = {
    id: state.nextId++,
    size,
    phase: 'queue',
    tableId: null,
    seats: [],
    patience,
    patienceMax: patience,
    timer: 0,
    orderIds: [],
    looks: Array.from({ length: size }, () => randInt(state.rng, 0, LOOK_COUNT - 1)),
    called: false,
    wait: 0,
    regular: regular?.id ?? null,
    ...(opts.vip ? { vip: opts.vip } : {}),
    ...(opts.want ? { want: opts.want } : {}),
  };
  state.restaurant.parties.push(party);
  ctx.bus.emit('party/arrived', { partyId: party.id });
  if (regular) ctx.bus.emit('regular/arrived', { regularId: regular.id, partyId: party.id });
  return party;
}

/** Khách nhận menu: xem trong 3–7 giây thực rồi mới chọn xong. */
export function startBrowsing(ctx: SimContext, party: Party): void {
  const [min, max] = ctx.content.balance.service.browseTime;
  party.phase = 'browsing';
  party.called = false;
  party.timer = randRange(ctx.state.rng, min, max);
}

/**
 * Bồi bàn ghi món: mỗi khách gọi 1 món trong số món đang bán VÀ còn đủ nguyên liệu; nguyên liệu bị trừ ngay.
 * Không còn món nào nấu được thì cả nhóm bỏ về.
 */
export function placeOrders(ctx: SimContext, party: Party): void {
  const { state, content } = ctx;
  for (let i = 0; i < party.size; i++) {
    const ids = party.want && i === 0 && !state.menu.active.includes(party.want) ? [...state.menu.active, party.want] : state.menu.active;
    const options = ids.map((id) => content.recipes.get(id)).filter((r) => hasAll(ctx, r.ingredients));
    if (!options.length) break;
    // Khách quen (ghế đầu) gọi món ruột nếu quán đang bán và còn nguyên liệu
    const fav = i === 0 && party.regular ? options.find((r) => r.id === favoriteOf(ctx, party.regular!)) : undefined;
    // Ngày hướng dẫn: khách của bước "món khó" gọi đúng món đã định
    const wanted = i === 0 && party.want ? options.find((r) => r.id === party.want) : undefined;
    const recipe = wanted ?? fav ?? options[weightedIndex(state.rng, options.map((r) => r.popularity ?? 1))];
    removeAll(ctx, recipe.ingredients);
    const order = { id: state.nextId++, partyId: party.id, recipeId: recipe.id, status: 'queued' as const, progress: 0, ...(fav ? { fav: true } : {}) };
    state.restaurant.orders.push(order);
    party.orderIds.push(order.id);
    ctx.bus.emit('order/placed', { orderId: order.id, recipeId: recipe.id });
  }
  if (!party.orderIds.length) {
    leave(ctx, party, 'noFood');
    return;
  }
  // Màu bàn: màu đầu tiên chưa bàn nào đang dùng (hết màu thì quay vòng)
  if (party.color == null) {
    const used = new Set(state.restaurant.parties.filter((p) => p !== party && p.color != null).map((p) => p.color));
    const n = content.balance.service.partyColors;
    party.color = Array.from({ length: n }, (_, i) => i).find((i) => !used.has(i)) ?? party.id % n;
  }
  const patience = (content.balance.foodPatience + content.balance.foodPatiencePerGuest * party.size) * modifier(ctx, 'patience');
  party.phase = 'waitingFood';
  party.called = false;
  party.wait = 0;
  party.patience = party.patienceMax = patience;
}

function pay(ctx: SimContext, party: Party): void {
  const { state, content } = ctx;
  const b = content.balance;
  const priceMul = modifier(ctx, 'dishPrice');
  let total = 0;
  for (const id of party.orderIds) {
    const order = state.restaurant.orders.find((o) => o.id === id);
    if (order) total += Math.round(seasonalPrice(ctx, content.recipes.get(order.recipeId)) * priceMul);
  }
  // Hài lòng theo tâm trạng lúc được phục vụ xong (vui vẻ = tip đủ, tức giận = không tip)
  const mood = moodOf(ctx, party);
  const satisfaction = b.service.moodTip[mood];
  // Nhà phê bình: hài lòng (vui / bình thường) thì khen, bực bội thì chê
  if (party.vip) criticDone(ctx, party, mood <= 1);
  const tip = Math.round(total * b.tipRate * satisfaction * modifier(ctx, 'tip') * regularTipBonus(ctx, party));
  earn(ctx, total + tip);
  state.stats.today.tips += tip;
  state.stats.total.tips += tip;
  addXp(ctx, Math.round(total * b.xpPerCoin));
  addReputation(ctx, b.reputation.paid + b.reputation.paidBonus * satisfaction);
  bumpQuest(ctx, 'serve');
  if (tip > 0) bumpQuest(ctx, 'happy');
  // Khách về để lại chén dĩa dơ ở chỗ ngồi: bồi bàn phải dọn mới xếp khách mới vào được
  if (party.tableId) state.restaurant.dirty[party.tableId] = [...(state.restaurant.dirty[party.tableId] ?? []), ...party.seats];
  const visit = regularPaid(ctx, party);
  if (visit?.fav) addReputation(ctx, b.regulars.favoriteRep);
  leave(ctx, party, 'paid', total, tip);
  if (visit) ctx.bus.emit('regular/visited', { regularId: party.regular!, ...visit });
}

/** Xoá nhóm khách khỏi quán (kèm đơn của họ) và ghi nhận kết quả. */
function leave(ctx: SimContext, party: Party, reason: LeaveReason, total = 0, tip = 0): void {
  const { state, content } = ctx;
  const r = state.restaurant;
  r.orders = r.orders.filter((o) => o.partyId !== party.id);
  for (const s of r.staff) if (s.orderId != null && party.orderIds.includes(s.orderId)) s.orderId = null;
  // Bồi bàn bỏ các việc của nhóm này; món đang bưng của họ thì coi như đổ đi
  for (const w of [r.waiter, ...r.helpers]) {
    w.tasks = w.tasks.filter((t) => !('partyId' in t) || t.partyId !== party.id);
    w.carrying = w.carrying.filter((id) => !party.orderIds.includes(id));
  }
  r.parties = r.parties.filter((p) => p.id !== party.id);
  if (party.vip && reason !== 'paid') criticDone(ctx, party, false);

  if (reason === 'closed') {
    ctx.bus.emit('party/left', { partyId: party.id, tableId: party.tableId, size: party.size, reason, total, tip });
    return;
  }
  const key = reason === 'paid' ? 'guestsServed' : 'guestsLost';
  state.stats.today[key] += party.size;
  state.stats.total[key] += party.size;
  if (reason === 'noFood') addReputation(ctx, content.balance.reputation.noFood);
  else if (reason !== 'paid') addReputation(ctx, content.balance.reputation.timeout);

  ctx.bus.emit('party/left', { partyId: party.id, tableId: party.tableId, size: party.size, reason, total, tip });
}
