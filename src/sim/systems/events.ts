import { events, type EventDef } from '../../data/events';
import { rand, randInt, weightedIndex } from '../../core/rng';
import { festivalOf } from '../calendar';
import { addReputation, earn } from '../helpers';
import type { Party } from '../state';
import type { SimContext, System } from '../types';
import { acceptingGuests, spawnParty } from './customers';

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
    } else if (e.status === 'active' && defOf(e.id).kind === 'modifier') {
      e.minutesLeft -= dt;
      if (e.minutesLeft <= 0) {
        e.status = 'done';
        ctx.bus.emit('event/ended', { id: e.id, result: null, money: 0 });
      }
    }
  },
};

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
  const def = events[weightedIndex(state.rng, events.map((e) => e.weight))];
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
