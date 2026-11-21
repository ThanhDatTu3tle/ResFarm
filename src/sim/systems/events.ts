import { events, type EventDef } from '../../data/events';
import { rand, randInt, weightedIndex } from '../../core/rng';
import { festivalOf } from '../calendar';
import { addReputation, canAfford, earn, spend } from '../helpers';
import { activeTables } from '../layout';
import type { Party } from '../state';
import { fail, ok, type SimContext, type System } from '../types';
import type { TableDef } from '../../data';
import { acceptingGuests, spawnParty, spawnTour } from './customers';

/**
 * SỰ KIỆN NGẪU NHIÊN (danh sách ở src/data/events.ts). Mỗi sáng tung xúc xắc: có sự kiện thì hẹn một giờ trong ca
 * (`state.event`, status `scheduled`). Tới giờ (quán đang nhận khách, đội không ở chợ) thì bắt đầu:
 *  - critic: thêm một khách đặc biệt (`Party.vip`); kết quả tính lúc khách trả tiền / bỏ về (`criticDone`).
 *  - inspector: kiểm tra ngay vết bẩn + bàn dơ rồi thưởng / phạt.
 *  - modifier: hiệu ứng nhân vào `modifier()` trong `duration` phút (xem `eventEffect`).
 */
export const eventSystem: System = {
  id: 'events',
  init: rollEvent,
  onDayStart: rollEvent,
  update(ctx, dt) {
    const e = ctx.state.event;
    if (!e) return;
    if (e.status === 'scheduled') {
      if (ctx.state.clock.minute < e.at || !acceptingGuests(ctx) || ctx.state.crew.restaurantAway) return;
      startEvent(ctx, defOf(e.id));
    } else if (e.status === 'active' && defOf(e.id).kind === 'tour') {
      // Xe du lịch đợi tới khi cả đoàn ra về
      if (!ctx.state.restaurant.parties.some((p) => p.tour)) {
        e.status = 'done';
        ctx.bus.emit('event/ended', { id: e.id, result: null, money: 0 });
      }
    } else if (e.status === 'active' && defOf(e.id).kind === 'modifier') {
      e.minutesLeft -= dt;
      if (e.minutesLeft <= 0) {
        e.status = 'done';
        ctx.bus.emit('event/ended', { id: e.id, result: null, money: 0 });
      }
    }
  },
  commands: {
    // Công an khu vực (quán ốc): "bồi dưỡng" hoặc để thu một bàn đôi
    'event/police'(ctx, cmd) {
      const e = policePending(ctx);
      if (!e) return fail('Không có công an nào đang chờ.');
      const def = defOf(e.id);
      if (cmd.choice === 'bribe') {
        const money = bribeOf(ctx);
        if (!spend(ctx, money)) return fail('Không đủ tiền bồi dưỡng.');
        e.result = 'good';
        e.status = 'done';
        ctx.bus.emit('event/ended', { id: def.id, result: 'good', money: -money });
        return ok();
      }
      const table = seizableTable(ctx);
      if (!table) {
        if (canAfford(ctx, bribeOf(ctx))) return fail('Không còn bàn đôi trống nào để công an thu.');
        // Hết tiền mà cũng không còn bàn đôi trống: công an nhắc nhở rồi đi, quán mất chút uy tín
        addReputation(ctx, -(def.penalty?.rep ?? 0) * 2);
        e.result = 'bad';
        e.status = 'done';
        ctx.bus.emit('event/ended', { id: def.id, result: 'bad', money: 0 });
        return ok();
      }
      seize(ctx, table);
      addReputation(ctx, -(def.penalty?.rep ?? 0));
      e.result = 'bad';
      e.status = 'done';
      ctx.bus.emit('event/ended', { id: def.id, result: 'bad', money: 0, table: table.name });
      return ok();
    },
  },
};

/** Công an khu vực đang đứng chờ chủ quán quyết (game dừng trong lúc này). */
export function policePending(ctx: SimContext) {
  const e = ctx.state.event;
  return e && e.status === 'active' && defOf(e.id).kind === 'police' ? e : null;
}

/** Tiền "bồi dưỡng" theo hạng quán: hạng 1 thấp nhất, hạng cao nhất nhiều nhất (làm tròn 10 xu). */
export function bribeOf(ctx: SimContext): number {
  const [lo, hi] = defOf('police').bribe ?? [200, 700];
  const tiers = ctx.content.room.tiers.length;
  const k = tiers > 1 ? (ctx.state.restaurant.tier - 1) / (tiers - 1) : 0;
  return Math.round((lo + (hi - lo) * k) / 10) * 10;
}

/** Bàn đôi công an thu được: bàn đôi đang trống khách (ưu tiên bàn mua thêm, rồi bàn gốc). null = không có. */
export function seizableTable(ctx: SimContext): TableDef | null {
  const r = ctx.state.restaurant;
  const pairs = activeTables(ctx).filter((t) => t.seats === 2 && !t.shared && !t.fixed && !r.parties.some((p) => p.tableId === t.id));
  return pairs.find((t) => r.extraTables.some((x) => x.id === t.id)) ?? pairs[0] ?? null;
}

function seize(ctx: SimContext, t: TableDef): void {
  const r = ctx.state.restaurant;
  if (r.extraTables.some((x) => x.id === t.id)) r.extraTables = r.extraTables.filter((x) => x.id !== t.id);
  else r.confiscated.push(t.id);
  delete r.layout[t.id];
  delete r.dirty[t.id];
}

export function defOf(id: string): EventDef {
  return events.find((e) => e.id === id) ?? events[0];
}

/** Sáng: có sự kiện không, loại nào, mấy giờ. Ngày đầu và ngày lễ không có (lễ đã đủ đông). */
function rollEvent(ctx: SimContext): void {
  const { state, content } = ctx;
  state.event = null;
  const b = content.balance.events;
  if (state.clock.day < b.fromDay || festivalOf(state.clock.day)) return;
  if (rand(state.rng) >= b.chance) return;
  const pool = events.filter((e) => !e.cuisines || e.cuisines.includes(state.cuisine));
  const def = pool[weightedIndex(state.rng, pool.map((e) => e.weight))];
  // Giờ ngẫu nhiên trong một ca, cách đầu ca 1 tiếng và trước giờ ngưng nhận khách 1 tiếng
  const shift = content.balance.shifts[randInt(state.rng, 0, content.balance.shifts.length - 1)];
  const at = randInt(state.rng, shift.from + 60, Math.max(shift.from + 60, shift.lastCall - 60));
  state.event = { id: def.id, at, status: 'scheduled', minutesLeft: def.duration ?? 0, partyId: null, result: null };
  if (def.announce) ctx.bus.emit('event/announced', { id: def.id, at });
}

function startEvent(ctx: SimContext, def: EventDef): void {
  const e = ctx.state.event!;
  e.status = 'active';
  ctx.bus.emit('event/started', { id: def.id });
  if (def.kind === 'critic') {
    const party = spawnParty(ctx, { size: 1, vip: def.id });
    e.partyId = party.id;
  } else if (def.kind === 'inspector') inspect(ctx, def);
  else if (def.kind === 'tour' && !spawnTour(ctx)) {
    e.status = 'done'; // quán kín bàn rồi: xe chạy luôn
    ctx.bus.emit('event/ended', { id: def.id, result: null, money: 0 });
  }
}

/** Thanh tra: mỗi vết bẩn trên sàn và mỗi bàn còn chén dĩa dơ là một lỗi. */
function inspect(ctx: SimContext, def: EventDef): void {
  const r = ctx.state.restaurant;
  const e = ctx.state.event!;
  const mess = r.stains.length + Object.values(r.dirty).filter((seats) => seats.length).length;
  let money = 0;
  if (!mess) {
    money = def.reward?.money ?? 0;
    earn(ctx, money);
    addReputation(ctx, def.reward?.rep ?? 0);
    e.result = 'good';
  } else {
    const p = def.penalty!;
    money = -Math.min(p.max ?? Infinity, p.money * mess);
    // Phạt trừ thẳng vào tiền (không để âm)
    ctx.state.money = Math.max(0, ctx.state.money + money);
    ctx.state.stats.today.spent -= money;
    ctx.state.stats.total.spent -= money;
    addReputation(ctx, -p.rep);
    e.result = 'bad';
  }
  e.status = 'done';
  ctx.bus.emit('event/ended', { id: def.id, result: e.result, money, mess });
}

/**
 * Khách đặc biệt (nhà phê bình) vừa xong: trả tiền vui vẻ (tâm trạng đủ tốt) = thành công, còn lại = thất bại.
 * customers.ts gọi lúc khách trả tiền (`happy` theo tâm trạng) hoặc bỏ về (`happy = false`).
 */
export function criticDone(ctx: SimContext, party: Party, happy: boolean): void {
  const e = ctx.state.event;
  if (!e || e.partyId !== party.id || e.status !== 'active') return;
  const def = defOf(e.id);
  let money = 0;
  if (happy) {
    money = def.reward?.money ?? 0;
    earn(ctx, money);
    addReputation(ctx, def.reward?.rep ?? 0);
  } else addReputation(ctx, -(def.penalty?.rep ?? 0));
  e.result = happy ? 'good' : 'bad';
  e.status = 'done';
  ctx.bus.emit('event/ended', { id: def.id, result: e.result, money });
}

/** Hệ số hiệu ứng của sự kiện đang diễn ra (cho `modifier()`). */
export function eventEffect(ctx: SimContext, key: keyof NonNullable<EventDef['effects']>): number {
  const e = ctx.state.event;
  if (!e || e.status !== 'active') return 1;
  return defOf(e.id).effects?.[key] ?? 1;
}
