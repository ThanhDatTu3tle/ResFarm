import { randRange } from '../../core/rng';
import { seasonPriceFactor } from '../calendar';
import { addItem, spend } from '../helpers';
import { fail, ok, type SimContext, type System } from '../types';

/** Chợ: mua nguyên liệu ở các sạp; giá dao động theo ngày. */
export const marketSystem: System = {
  id: 'market',
  init: rollPrices,
  onDayStart: rollPrices,
  commands: {
    'market/buy'(ctx, cmd) {
      if (!ctx.content.stalls.has(cmd.stallId)) return fail('Không có sạp này.');
      if (!ctx.content.stalls.get(cmd.stallId).items.includes(cmd.itemId)) return fail('Sạp không bán món này.');
      if (!Number.isInteger(cmd.qty) || cmd.qty <= 0) return fail('Số lượng không hợp lệ.');
      if (!spend(ctx, priceOf(ctx, cmd.stallId, cmd.itemId) * cmd.qty)) return fail('Không đủ tiền.');
      addItem(ctx, cmd.itemId, cmd.qty);
      return ok();
    },
  },
};

/** Giá 1 đơn vị hôm nay tại sạp. */
export function priceOf(ctx: SimContext, stallId: string, itemId: string): number {
  const base = ctx.content.items.get(itemId).basePrice * ctx.content.stalls.get(stallId).markup;
  return Math.max(1, Math.round(base * (ctx.state.market.priceFactor[itemId] ?? 1) * seasonPriceFactor(ctx, itemId)));
}

function rollPrices(ctx: SimContext): void {
  const [min, max] = ctx.content.balance.marketSwing;
  const factors: Record<string, number> = {};
  for (const item of ctx.content.items.all()) {
    if (!item.infinite) factors[item.id] = randRange(ctx.state.rng, min, max);
  }
  ctx.state.market.priceFactor = factors;
}
