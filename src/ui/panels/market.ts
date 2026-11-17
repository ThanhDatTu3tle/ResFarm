import { stockOf } from '../../sim/helpers';
import { priceOf } from '../../sim/systems/market';
import { cmd, esc, ui } from '../dom';
import { coins } from '../format';
import type { Panel } from './types';

const BUY_SIZES = [1, 5, 10];

export const marketPanel: Panel = {
  id: 'market',
  label: 'Chợ',
  icon: '🧺',
  render(game, uiState) {
    const { state, content, ctx } = game;
    const all = content.stalls.all();
    const shown = all.filter((s) => !uiState.selectedStall || s.id === uiState.selectedStall);
    const stalls = (shown.length ? shown : all)
      .map((stall) => {
        const rows = stall.items
          .map((id) => {
            const item = content.items.get(id);
            const price = priceOf(ctx, stall.id, id);
            const factor = state.market.priceFactor[id] ?? 1;
            const trend = factor > 1.08 ? '<span class="bad-text" title="Hôm nay đắt">▲</span>' : factor < 0.92 ? '<span class="good-text" title="Hôm nay rẻ">▼</span>' : '';
            const buttons = BUY_SIZES.map(
              (n) => `<button${cmd({ type: 'market/buy', stallId: stall.id, itemId: id, qty: n })}${state.money >= price * n ? '' : ' disabled'}>+${n}</button>`,
            ).join('');
            return `<div class="row" data-key="${id}">
              <span class="big">${item.icon}</span>
              <div class="grow"><b>${esc(item.name)}</b>
                <div class="muted">${coins(price)} ${trend} · trong kho: ${stockOf(ctx, id)}</div></div>
              <div class="btns">${buttons}</div></div>`;
          })
          .join('');
        return `<h3 data-key="h-${stall.id}">${stall.icon} ${esc(stall.name)}</h3>${rows}`;
      })
      .join('');
    const showAll = uiState.selectedStall ? `<button class="mini"${ui('stall:')}>Xem tất cả sạp</button>` : '';
    return `<div class="row"><p class="muted grow">Giá chợ đổi mỗi ngày. Tự trồng, tự nuôi thì rẻ hơn nhiều nhưng phải chờ.</p>${showAll}</div>${stalls}`;
  },
};
