import { categoryNames } from '../../data/items';
import type { ItemCategory } from '../../data';
import { stockOf } from '../../sim/helpers';
import { sellPrice } from '../../sim/systems/contracts';
import { cmd, esc } from '../dom';
import { coins, qty } from '../format';
import type { Panel } from './types';

/**
 * Bảng Kho: mọi nguyên liệu theo nhóm. Món đang có trong kho bán lại được (nửa giá gốc, theo mùa) — tiện khi nông trại
 * thu nhiều hơn quán dùng. Đồ có sẵn (gạo, nước, gia vị) không bán.
 */
export const inventoryPanel: Panel = {
  id: 'inventory',
  label: 'Kho',
  icon: '📦',
  render(game) {
    const { content, ctx } = game;
    const sections = (Object.keys(categoryNames) as ItemCategory[])
      .map((category) => {
        const items = content.items.all().filter((i) => i.category === category);
        if (!items.length) return '';
        const rows = items
          .filter((i) => !i.infinite && stockOf(ctx, i.id) > 0)
          .map((i) => {
            const have = stockOf(ctx, i.id);
            const price = sellPrice(ctx, i.id);
            const sell = (n: number, label: string) => `<button class="mini"${cmd({ type: 'market/sell', itemId: i.id, qty: n })}>${label}</button>`;
            return `<div class="row stock-row" data-key="${i.id}"><span class="big">${i.icon}</span>
              <div class="grow"><b>${esc(i.name)}</b> <span class="pill">${qty(have)}</span><div class="muted">Bán lại ${coins(price)} / 1</div></div>
              <div class="btns">${sell(1, 'Bán 1')}${have > 5 ? sell(5, 'Bán 5') : ''}${sell(have, `Bán hết · ${coins(price * have)}`)}</div></div>`;
          })
          .join('');
        const chips = items
          .filter((i) => i.infinite || stockOf(ctx, i.id) <= 0)
          .map((i) => {
            const have = stockOf(ctx, i.id);
            return `<div class="chip stock ${have ? '' : 'bad'}"><span class="big">${i.icon}</span>${esc(i.name)} <b>${qty(have)}</b></div>`;
          })
          .join('');
        return `<h3>${categoryNames[category]}</h3>${rows}${chips ? `<div class="chips">${chips}</div>` : ''}`;
      })
      .join('');
    return `<p class="muted">Kho thừa hàng thì bán lại cho chợ bằng nửa giá gốc (rau đúng mùa rẻ hơn). Có đơn đặt hàng thì giao ở bảng Đơn hàng sẽ lời hơn.</p>${sections}`;
  },
};
