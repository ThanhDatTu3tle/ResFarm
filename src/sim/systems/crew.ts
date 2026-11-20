import { randInt } from '../../core/rng';
import type { StaffDishDef } from '../../data';
import { spend } from '../helpers';
import type { BreakKind, MealLine, PendingMeal, Vitals, WaiterState } from '../state';

/** Hoá đơn lần trước đã báo chưa (theo state, không lưu vào save — chỉ để phát sự kiện một lần). */
const wasDue = new WeakMap<object, boolean>();
import { fail, ok, type SimContext, type System } from '../types';

/**
 * CẢ ĐỘI — đầu bếp, bồi bàn (người chơi điều khiển), nhân viên thuê, bác nông dân.
 *  - Năng lượng: tối đa `maxEnergyOf` (đầu bếp balance.crew.chefMaxEnergy, còn lại balance.crew.maxEnergy); mỗi việc tốn (nấu 1 món, phục vụ 1 việc, 1 việc đồng áng).
 *    Cạn thì xỉu: đứng im tới khi được bồi dưỡng (reviveCost xu), ăn ở chợ, hoặc ngủ qua đêm (đầy lại).
 *  - Giờ nghỉ: hết ca sáng, quán vắng khách thì đội quán ra chợ, về lúc crew.lunchBack; bác nông dân ra chợ
 *    crew.farmerLunch.from, về lúc .to. Hết ca cuối (tối) cả đội ra chợ ăn tối, không quay lại.
 *    Trong lúc ở chợ, việc ở quán / nông trại tạm ngưng (lệnh bị từ chối kèm lời nhắc — awayReason).
 *  - Ra chợ thì mỗi người vào crew.pending chờ người chơi gọi món (crew/order, StallDef.menu); quá hạn (giờ về − eatMinutes)
 *    chưa chọn thì tự chọn ngẫu nhiên (crew/autoOrder làm ngay). Tổng không vượt tiền đang có (hết tiền thì món rẻ hơn,
 *    không đủ thì nhịn). Ăn xong cộng năng lượng, ghi vào hoá đơn (crew.bill); khi cả đợt ăn xong (billDue) người chơi
 *    trả một lần (crew/pay) — tiền ăn của bác nông dân (về sớm hơn) gộp chung.
 */

export type CrewGroup = 'restaurant' | 'farm';

export interface CrewMember {
  /** id đầu bếp (StaffDef) / 'waiter' / id nhân viên thuê / 'farmer'. */
  who: string;
  name: string;
  icon: string;
  role: 'chef' | 'waiter' | 'helper' | 'shipper' | 'farmer';
  group: CrewGroup;
  vitals: Vitals;
}

/** Danh sách cả đội theo thứ tự hiển thị: bếp → phục vụ → bác nông dân. */
export function crewMembers(ctx: SimContext): CrewMember[] {
  const { state, content } = ctx;
  const r = state.restaurant;
  return [
    ...r.staff.map((s): CrewMember => {
      const def = content.staff.get(s.id);
      return { who: s.id, name: def.name, icon: def.icon, role: 'chef', group: 'restaurant', vitals: s };
    }),
    { who: 'waiter', name: 'Bồi bàn (bạn)', icon: '🙋', role: 'waiter', group: 'restaurant', vitals: r.waiter },
    ...r.helpers.map((h): CrewMember => ({ who: h.id, name: h.name, icon: '🧑‍🍳', role: 'helper', group: 'restaurant', vitals: h })),
    { who: 'shipper', name: 'Anh shipper', icon: '🛵', role: 'shipper', group: 'restaurant', vitals: r.shipper },
    { who: 'farmer', name: 'Bác nông dân', icon: '👨‍🌾', role: 'farmer', group: 'farm', vitals: state.farm.farmer },
  ];
}

/** Năng lượng tối đa của một người: đầu bếp ít hơn (nấu tốn sức), bồi bàn / nhân viên / bác nông dân nhiều hơn. */
export function maxEnergyOf(ctx: SimContext, who: string): number {
  const b = ctx.content.balance.crew;
  return ctx.content.staff.has(who) ? b.chefMaxEnergy : who === 'shipper' ? b.shipperMaxEnergy : b.maxEnergy;
}

export function memberOf(ctx: SimContext, who: string): CrewMember | undefined {
  return crewMembers(ctx).find((m) => m.who === who);
}

/** Lời nhắc khi người chơi bấm việc ở quán / nông trại mà người làm đang ở chợ; null = đang ở chỗ làm. */
export function awayReason(ctx: SimContext, group: CrewGroup): string | null {
  const c = ctx.state.crew;
  const b = ctx.content.balance.crew;
  const kind = group === 'restaurant' ? c.restaurantAway : c.farmerAway;
  if (!kind) return null;
  const back = group === 'restaurant' ? b.lunchBack : b.farmerLunch.to;
  const hh = `${String(Math.floor(back / 60)).padStart(2, '0')}:${String(back % 60).padStart(2, '0')}`;
  if (group === 'farm') return kind === 'lunch' ? `🍜 Bác nông dân đang ăn trưa ở chợ, ${hh} mới về nông trại.` : '🌙 Bác nông dân đã nghỉ, đang ăn tối ở chợ.';
  return kind === 'lunch' ? `🍜 Cả đội đang nghỉ trưa ở chợ, ${hh} mới về quán.` : '🌙 Quán đã đóng cửa, cả đội đang ăn tối ở chợ.';
}

/** Trừ năng lượng sau một việc; cạn thì xỉu (phát crew/fainted). Trả true nếu vừa xỉu. */
export function tire(ctx: SimContext, who: string, v: Vitals, amount: number): boolean {
  v.energy = Math.max(0, v.energy - amount);
  if (v.energy > 0 || v.fainted) return false;
  v.fainted = true;
  ctx.bus.emit('crew/fainted', { who });
  return true;
}

/** Bỏ hết việc của một người phục vụ (khách được gọi lại, món đang bưng trả về quầy). */
export function dropWork(ctx: SimContext, w: WaiterState): void {
  const r = ctx.state.restaurant;
  for (const t of w.tasks) {
    if (t.kind !== 'menu' && t.kind !== 'takeOrder') continue;
    const p = r.parties.find((x) => x.id === t.partyId);
    if (p) p.called = false;
  }
  for (const o of r.orders) if (w.carrying.includes(o.id)) o.status = 'ready';
  w.tasks = [];
  w.carrying = [];
}

/** Tổng tiền hoá đơn đang chờ trả. */
export function billTotal(ctx: SimContext): number {
  return ctx.state.crew.bill.reduce((s, l) => s + l.price, 0);
}

/** Các món ở hàng rong (kèm id hàng). */
function vendorDishes(ctx: SimContext): { stallId: string; dish: StaffDishDef }[] {
  return ctx.content.stalls.all().flatMap((s) => (s.menu ?? []).map((dish) => ({ stallId: s.id, dish })));
}

/** Tiền còn dùng được cho bữa ăn: tiền đang có trừ hoá đơn chưa trả và các món đã gọi. */
export function mealBudget(ctx: SimContext): number {
  const c = ctx.state.crew;
  return ctx.state.money - billTotal(ctx) - c.meals.reduce((s, l) => s + l.price, 0);
}

/** Năng lượng các món người này đã gọi trong bữa đang ăn (chưa cộng vào thanh). */
export function orderedEnergy(ctx: SimContext, who: string): number {
  return ctx.state.crew.meals.filter((l) => l.who === who).reduce((s, l) => s + l.energy, 0);
}

/** Năng lượng còn thiếu cho đầy thanh, đã tính các món đã gọi (≤ 0 = đã đủ). */
export function missingEnergy(ctx: SimContext, who: string): number {
  return maxEnergyOf(ctx, who) - (memberOf(ctx, who)?.vitals.energy ?? 0) - orderedEnergy(ctx, who);
}

/**
 * Người chơi gọi thêm một món cho người đang chờ: ăn trong crew.eatMinutes (không quá giờ về).
 * Gọi được nhiều món; tính cả món đã gọi mà đầy thanh năng lượng thì người đó xong (rời hàng chờ).
 */
function serveMeal(ctx: SimContext, p: PendingMeal, stallId: string, dish: StaffDishDef): void {
  addMeal(ctx, p, stallId, dish);
  if (missingEnergy(ctx, p.who) <= 0) ctx.state.crew.pending = ctx.state.crew.pending.filter((x) => x !== p);
}

/** Thêm một món vào bữa đang ăn của người này (một người có thể ăn vài món khi tự chọn). */
function addMeal(ctx: SimContext, p: PendingMeal, stallId: string, dish: StaffDishDef): void {
  const until = Math.min(p.back, ctx.state.clock.minute + ctx.content.balance.crew.eatMinutes);
  ctx.state.crew.meals.push({ who: p.who, name: p.name, stallId, dish: dish.name, icon: dish.icon, price: dish.price, energy: dish.energy, until, kind: p.kind });
}

/**
 * Tự chọn món (người chơi bấm "Để mọi người tự chọn" hoặc quá hạn): ăn cho ĐẦY năng lượng.
 * Mỗi lượt chọn ngẫu nhiên một món đủ bù phần còn thiếu (không có thì món nhiều ⚡ nhất), lặp tới khi no hoặc hết tiền.
 * Đang đầy sức thì vẫn ăn một món cho bữa đó. Không đủ tiền món nào thì nhịn.
 */
function autoPick(ctx: SimContext, p: PendingMeal): void {
  const { state } = ctx;
  const c = state.crew;
  c.pending = c.pending.filter((x) => x !== p);
  // Tính cả món người chơi đã gọi dở cho người này: chỉ gọi thêm phần còn thiếu
  let missing = missingEnergy(ctx, p.who);
  const hadMeal = c.meals.some((l) => l.who === p.who);
  if (hadMeal && missing <= 0) return;
  for (let n = 0; n < 4; n++) {
    const budget = mealBudget(ctx);
    const affordable = vendorDishes(ctx).filter((d) => d.dish.price <= budget);
    if (!affordable.length) break;
    const enough = affordable.filter((d) => d.dish.energy >= missing);
    const pick = enough.length ? enough[randInt(state.rng, 0, enough.length - 1)] : affordable.reduce((a, b) => (b.dish.energy > a.dish.energy ? b : a));
    addMeal(ctx, p, pick.stallId, pick.dish);
    missing -= pick.dish.energy;
    if (missing <= 0) break;
  }
}

/**
 * Ra chợ. Đội quán: ai cũng vào hàng chờ gọi món. Bác nông dân: ra chợ dạo trước (`farmerWaiting`), đợi đội quán tan ca
 * rồi mới gọi món chung một lượt (`farmerJoins`); đội quán đã ở chợ sẵn thì bác vào ăn luôn.
 */
/**
 * "Để mọi người tự chọn": chia đều cho cả nhóm, không để tiền âm. Mỗi lượt người đang thiếu sức nhiều nhất (theo tỉ lệ
 * thanh năng lượng, tính cả món đã gọi) được gọi thêm một món: món rẻ nhất đủ bù phần thiếu, không có thì món nhiều ⚡ / xu
 * nhất còn mua được. Hết tiền thì dừng — ai cũng được chia phần trước khi có người ăn thêm món thứ hai.
 */
function autoPickFair(ctx: SimContext, people: PendingMeal[]): void {
  const c = ctx.state.crew;
  c.pending = c.pending.filter((p) => !people.includes(p));
  const ratio = (who: string) => 1 - missingEnergy(ctx, who) / maxEnergyOf(ctx, who);
  const ate = new Set(c.meals.map((l) => l.who));
  for (let guard = 0; guard < 40; guard++) {
    // Ai chưa có món nào thì ưu tiên (ít nhất một món cho bữa này), rồi tới người thiếu sức nhất
    const hungry = people.filter((p) => !ate.has(p.who) || missingEnergy(ctx, p.who) > 0);
    if (!hungry.length) break;
    hungry.sort((a, b) => Number(ate.has(a.who)) - Number(ate.has(b.who)) || ratio(a.who) - ratio(b.who));
    const p = hungry[0];
    const budget = mealBudget(ctx);
    const affordable = vendorDishes(ctx).filter((d) => d.dish.price <= budget);
    if (!affordable.length) break;
    const missing = missingEnergy(ctx, p.who);
    const enough = affordable.filter((d) => d.dish.energy >= missing).sort((a, b) => a.dish.price - b.dish.price);
    const pick = enough[0] ?? affordable.reduce((a, b) => (b.dish.energy / b.dish.price > a.dish.energy / a.dish.price ? b : a));
    addMeal(ctx, p, pick.stallId, pick.dish);
    ate.add(p.who);
  }
}

function depart(ctx: SimContext, group: CrewGroup, kind: BreakKind): void {
  const { state, content } = ctx;
  const b = content.balance.crew;
  const r = state.restaurant;
  if (group === 'farm') {
    state.crew.farmerAway = kind;
    state.crew.farmerWaiting = true;
    state.crew.farmerBack = null;
    ctx.bus.emit('crew/left', { group, kind });
    if (state.crew.restaurantAway === kind) farmerJoins(ctx, kind);
    return;
  }
  state.crew.restaurantAway = kind;
  for (const w of [r.waiter, ...r.helpers]) dropWork(ctx, w);
  const back = kind === 'dinner' ? state.clock.minute + b.dinnerMinutes : b.lunchBack;
  const deadline = Math.max(state.clock.minute, back - b.eatMinutes);
  for (const m of crewMembers(ctx).filter((x) => x.group === group)) state.crew.pending.push({ who: m.who, name: m.name, kind, deadline, back });
  if (state.crew.farmerWaiting && state.crew.farmerAway === kind) farmerJoins(ctx, kind);
  ctx.bus.emit('crew/left', { group, kind });
}

/** Bác nông dân đang dạo chợ vào ăn cùng đội: gọi món chung, ăn nhanh (eatMinutes) rồi về nông trại (bữa tối thì ở lại). */
function farmerJoins(ctx: SimContext, kind: BreakKind): void {
  const { state, content } = ctx;
  const b = content.balance.crew;
  const m = state.clock.minute;
  const team = state.crew.pending.find((p) => p.kind === kind);
  const back = kind === 'dinner' ? (team?.back ?? m + b.dinnerMinutes) : m + b.eatMinutes;
  const deadline = team ? Math.min(team.deadline, back) : m;
  state.crew.pending.push({ who: 'farmer', name: memberOf(ctx, 'farmer')?.name ?? 'Bác nông dân', kind, deadline, back });
  state.crew.farmerWaiting = false;
  state.crew.farmerBack = kind === 'lunch' ? back : null;
}

/**
 * Hoá đơn hiện lúc mọi người của đợt nghỉ này đã ăn xong: không còn ai chờ gọi món / đang ăn, và đội quán không còn
 * "sắp ra chợ" (đang trong giờ nghỉ mà quán chưa vắng khách) — bác nông dân về sớm hơn nên tiền ăn của bác gộp chung.
 */
export function billDue(ctx: SimContext): boolean {
  const c = ctx.state.crew;
  if (!c.bill.length || c.meals.length || c.pending.length) return false;
  return !(breakAt(ctx, 'restaurant') && !c.restaurantAway);
}

/** Nợ quá balance.debtLimit: phá sản, hết ván (UI hiện màn phá sản, mời chơi lại). */
export function checkBankrupt(ctx: SimContext): void {
  if (ctx.state.bankrupt || ctx.state.money >= -ctx.content.balance.debtLimit) return;
  ctx.state.bankrupt = true;
  ctx.bus.emit('game/bankrupt', { money: ctx.state.money });
}

/** Ăn xong một món: cộng năng lượng (tỉnh lại nếu đang xỉu), chuyển sang hoá đơn. */
function finishMeal(ctx: SimContext, line: MealLine): void {
  const c = ctx.state.crew;
  const m = memberOf(ctx, line.who);
  if (m) {
    m.vitals.energy = Math.min(maxEnergyOf(ctx, line.who), m.vitals.energy + line.energy);
    if (m.vitals.energy > 0) m.vitals.fainted = false;
  }
  c.meals = c.meals.filter((x) => x !== line);
  c.bill.push(line);
}

/** Về chỗ làm sau giờ nghỉ trưa: nghỉ ngơi cũng hồi chút sức. */
function comeBack(ctx: SimContext, group: CrewGroup): void {
  const { state, content } = ctx;
  const b = content.balance.crew;
  const mine = (who: string) => memberOf(ctx, who)?.group === group;
  for (const p of state.crew.pending.filter((x) => mine(x.who))) autoPick(ctx, p);
  for (const line of state.crew.meals.filter((l) => mine(l.who))) finishMeal(ctx, line);
  for (const m of crewMembers(ctx).filter((x) => x.group === group)) {
    m.vitals.energy = Math.min(maxEnergyOf(ctx, m.who), m.vitals.energy + b.restEnergy);
    m.vitals.fainted = false;
  }
  if (group === 'restaurant') {
    state.crew.restaurantAway = null;
    const door = { x: content.room.width / 2, y: content.room.dining.y2 };
    for (const w of [state.restaurant.waiter, ...state.restaurant.helpers]) Object.assign(w, door);
  } else {
    state.crew.farmerAway = null;
    state.crew.farmerWaiting = false;
    state.crew.farmerBack = null;
    Object.assign(state.farm.farmer, content.balance.farmer.home);
  }
  ctx.bus.emit('crew/back', { group });
}

/** Ăn xong hết các bữa đang dở (hết ngày / kết thúc ngày sớm); ai chưa gọi món thì tự chọn. */
function finishAll(ctx: SimContext): void {
  for (const p of [...ctx.state.crew.pending]) autoPick(ctx, p);
  for (const line of [...ctx.state.crew.meals]) finishMeal(ctx, line);
}

/** Đang ở giờ nào của ngày: nghỉ trưa / tối / không. */
function breakAt(ctx: SimContext, group: CrewGroup): BreakKind | null {
  const { clock } = ctx.state;
  const { shifts, crew: b } = ctx.content.balance;
  const m = clock.minute;
  if (m >= shifts[shifts.length - 1].to) return 'dinner';
  if (group === 'farm') return m >= b.farmerLunch.from && m < b.farmerLunch.to ? 'lunch' : null;
  return m >= shifts[0].to && m < b.lunchBack ? 'lunch' : null;
}

export const crewSystem: System = {
  id: 'crew',
  update(ctx) {
    const { state, content } = ctx;
    const c = state.crew;
    const b = content.balance.crew;
    const m = state.clock.minute;
    if (state.clock.phase === 'summary') return;
    // Đội quán: hết ca và quán đã vắng khách thì ra chợ
    if (!c.restaurantAway) {
      const kind = breakAt(ctx, 'restaurant');
      if (kind && !state.restaurant.parties.length) depart(ctx, 'restaurant', kind);
    } else if (c.restaurantAway === 'lunch' && m >= b.lunchBack) comeBack(ctx, 'restaurant');
    // Bác nông dân: đúng giờ ra chợ dạo (việc đang làm dở để đó, về làm tiếp). Trưa mà bác còn khoẻ (trên 75%) thì ở lại làm.
    if (!c.farmerAway) {
      const kind = breakAt(ctx, 'farm');
      if (kind === 'dinner') depart(ctx, 'farm', kind);
      else if (kind === 'lunch' && c.farmerLunchDay !== state.clock.day) {
        c.farmerLunchDay = state.clock.day;
        const f = state.farm.farmer;
        if (f.energy <= maxEnergyOf(ctx, 'farmer') * b.farmerSkipLunchAbove || f.fainted) depart(ctx, 'farm', kind);
      }
    } else if (c.farmerAway === 'lunch') {
      // Đội quán tan ca quá muộn (gần giờ về): bác ăn một mình cho kịp
      if (c.farmerWaiting && m >= b.lunchBack - b.eatMinutes) farmerJoins(ctx, 'lunch');
      // Bác ăn xong (hết món) thì về nông trại làm tiếp, không đợi đội quán
      const eating = c.pending.some((p) => p.who === 'farmer') || c.meals.some((l) => l.who === 'farmer');
      if (!c.farmerWaiting && c.farmerBack != null && m >= c.farmerBack && !eating) comeBack(ctx, 'farm');
    }
    for (const p of c.pending.filter((x) => x.deadline <= m)) autoPick(ctx, p);
    for (const line of c.meals.filter((l) => l.until <= m)) finishMeal(ctx, line);
    checkBankrupt(ctx);
    // Báo một lần khi hoá đơn tới lúc trả
    const due = billDue(ctx);
    if (due && !wasDue.get(ctx.state)) ctx.bus.emit('crew/bill', { total: billTotal(ctx) });
    wasDue.set(ctx.state, due);
  },
  onDayStart(ctx) {
    const { state, content } = ctx;
    finishAll(ctx);
    // Hoá đơn tối qua chưa trả thì tự trả (không vượt số tiền đang có)
    if (state.crew.bill.length) payBill(ctx);
    checkBankrupt(ctx);
    state.crew.restaurantAway = null;
    state.crew.farmerAway = null;
    state.crew.farmerWaiting = false;
    state.crew.farmerBack = null;
    // Ngủ một đêm: ai cũng đầy năng lượng
    for (const m of crewMembers(ctx)) Object.assign(m.vitals, { energy: maxEnergyOf(ctx, m.who), fainted: false });
    Object.assign(state.restaurant.waiter, content.room.waiterHome);
    for (const h of state.restaurant.helpers) Object.assign(h, content.room.waiterHome);
  },
  commands: {
    'crew/order'(ctx, cmd) {
      const c = ctx.state.crew;
      const p = c.pending.find((x) => x.who === cmd.who);
      if (!p) return fail('Người này đã gọi đủ món rồi.');
      const stall = ctx.content.stalls.has(cmd.stallId) ? ctx.content.stalls.get(cmd.stallId) : null;
      const dish = stall?.menu?.[cmd.dish];
      if (!dish) return fail('Hàng này không có món đó.');
      if (dish.price > mealBudget(ctx)) return fail('Không đủ tiền cho món này — chọn món rẻ hơn nhé.');
      serveMeal(ctx, p, cmd.stallId, dish);
      return ok();
    },
    'crew/unorder'(ctx, cmd) {
      // Bỏ món vừa gọi (chỉ khi người đó còn đang chọn món, chưa xác nhận xong)
      const c = ctx.state.crew;
      if (!c.pending.some((x) => x.who === cmd.who)) return fail('Người này đã chọn xong món rồi.');
      const mine = c.meals.filter((l) => l.who === cmd.who);
      const line = mine[cmd.index ?? mine.length - 1];
      if (!line) return fail('Người này chưa gọi món nào.');
      c.meals = c.meals.filter((l) => l !== line);
      return ok();
    },
    'crew/confirm'(ctx) {
      // "Xong": ai đã gọi ít nhất một món thì chốt bữa (rời hàng chờ); ai chưa gọi thì vẫn chờ, quá hạn tự chọn
      const c = ctx.state.crew;
      const before = c.pending.length;
      c.pending = c.pending.filter((p) => !c.meals.some((l) => l.who === p.who));
      return before === c.pending.length && before ? fail('Chưa ai được gọi món — chọn món hoặc để mọi người tự chọn nhé.') : ok();
    },
    'crew/autoOrder'(ctx) {
      if (!ctx.state.crew.pending.length) return fail('Mọi người đã có món rồi.');
      autoPickFair(ctx, [...ctx.state.crew.pending]);
      return ok();
    },
    'crew/pay'(ctx) {
      if (!billDue(ctx)) return fail('Mọi người chưa ăn xong.');
      payBill(ctx);
      return ok();
    },
    'crew/revive'(ctx, cmd) {
      const m = memberOf(ctx, cmd.who);
      if (!m || !m.vitals.fainted) return fail('Người này vẫn khoẻ.');
      const reason = awayReason(ctx, m.group);
      if (reason) return fail(reason);
      if (!spend(ctx, ctx.content.balance.crew.reviveCost)) return fail('Không đủ tiền bồi dưỡng.');
      m.vitals.fainted = false;
      m.vitals.energy = ctx.content.balance.crew.reviveEnergy;
      return ok();
    },
    'day/end'(ctx) {
      const { state, content } = ctx;
      if (state.clock.phase !== 'open') return fail('Ngày đang kết thúc rồi.');
      if (state.clock.minute < content.balance.crew.endDayAfter) return fail('Sau 21:00 mới kết thúc ngày sớm được.');
      if (state.restaurant.parties.length) return fail('Quán còn khách, đợi khách về hết đã.');
      finishAll(ctx);
      state.clock.phase = 'closing';
      return ok();
    },
  },
};

/** Trả hoá đơn ăn uống: trừ tiền (tối đa số đang có — lúc gọi món đã giữ không vượt), xoá hoá đơn. */
function payBill(ctx: SimContext): void {
  const { state } = ctx;
  // Trả đủ hoá đơn, kể cả phải nợ (quá mức nợ thì phá sản — checkBankrupt)
  const amount = billTotal(ctx);
  state.money -= amount;
  state.stats.today.spent += amount;
  state.stats.total.spent += amount;
  state.crew.bill = [];
}
