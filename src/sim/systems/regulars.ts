import { rand, randInt } from '../../core/rng';
import type { RegularDef } from '../../data';
import type { Party, RegularState } from '../state';
import type { SimContext } from '../types';
import { givePropGift } from './home';

/**
 * KHÁCH QUEN (F2) — không phải system riêng: customers.ts gọi các hàm ở đây lúc khách tới, gọi món và trả tiền.
 *  - Tới: mỗi nhóm khách mới có balance.regulars.chance là khách quen (trong số khách đã mở, chưa ghé hôm nay,
 *    không đang ở quán). Khách quen ngồi ghế đầu của nhóm, nhóm tối đa maxPartySize người.
 *  - Gọi món: món ruột đang bán và đủ nguyên liệu thì khách quen gọi món đó (order.fav).
 *  - Trả tiền: tip thêm theo tim (+ món ruột), lên tim theo số lần ghé; đủ giftHearts tim thì tặng đồ trang trí.
 */

/** Số tim của khách quen (0..heartVisits.length) theo số lần ghé. */
export function heartsOf(ctx: SimContext, id: string): number {
  const visits = ctx.state.regulars[id]?.visits ?? 0;
  return ctx.content.balance.regulars.heartVisits.filter((v) => visits >= v).length;
}

/** Khách quen đã bắt đầu ghé quán (đủ uy tín và cấp; người đã từng ghé thì luôn còn ghé). */
export function isRegularUnlocked(ctx: SimContext, def: RegularDef): boolean {
  const { state } = ctx;
  return !!state.regulars[def.id] || (state.reputation >= def.unlock.reputation && state.level >= def.unlock.level);
}

function stateOf(ctx: SimContext, id: string): RegularState {
  return (ctx.state.regulars[id] ??= { visits: 0, lastDay: 0, gifted: false });
}

/** Chọn khách quen cho nhóm khách sắp tới (null = khách vãng lai). Có dùng rng nên chỉ gọi lúc thật sự tạo khách. */
export function pickRegular(ctx: SimContext): RegularDef | null {
  const { state, content } = ctx;
  const present = new Set(state.restaurant.parties.map((p) => p.regular));
  const pool = content.regulars.all().filter((r) => isRegularUnlocked(ctx, r) && !present.has(r.id) && (state.regulars[r.id]?.lastDay ?? 0) !== state.clock.day);
  if (!pool.length || rand(state.rng) >= content.balance.regulars.chance) return null;
  const def = pool[randInt(state.rng, 0, pool.length - 1)];
  stateOf(ctx, def.id).lastDay = state.clock.day;
  return def;
}

/** Món ruột của khách quen ở quán hiện tại. */
export function favoriteOf(ctx: SimContext, id: string): string {
  return ctx.content.regulars.get(id).favorites[ctx.state.cuisine];
}

/** Hệ số tip thêm cho nhóm có khách quen (tính theo số tim trước lần ghé này). */
export function regularTipBonus(ctx: SimContext, party: Party): number {
  if (!party.regular) return 1;
  const b = ctx.content.balance.regulars;
  const fav = ctx.state.restaurant.orders.some((o) => o.partyId === party.id && o.fav);
  return 1 + b.tipPerHeart * heartsOf(ctx, party.regular) + (fav ? b.favoriteTip : 0);
}

/** Khách quen trả tiền xong: thêm lần ghé, lên tim, có thể tặng quà. Trả về kết quả để customers.ts phát sự kiện. */
export function regularPaid(ctx: SimContext, party: Party): { hearts: number; heartUp: boolean; fav: boolean; gift: string | null } | null {
  if (!party.regular) return null;
  const { content } = ctx;
  const def = content.regulars.get(party.regular);
  const rs = stateOf(ctx, def.id);
  const before = heartsOf(ctx, def.id);
  rs.visits++;
  const hearts = heartsOf(ctx, def.id);
  const fav = ctx.state.restaurant.orders.some((o) => o.partyId === party.id && o.fav);
  let gift: string | null = null;
  if (!rs.gifted && hearts >= content.balance.regulars.giftHearts) {
    rs.gifted = true;
    givePropGift(ctx, def.gift);
    gift = def.gift;
  }
  return { hearts, heartUp: hearts > before, fav, gift };
}
