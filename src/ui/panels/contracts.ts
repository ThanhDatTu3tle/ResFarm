import type { Game } from '../../sim/game';
import { stockOf } from '../../sim/helpers';
import { deliverable } from '../../sim/systems/contracts';
import { cmd, esc } from '../dom';
import { clockText, coins } from '../format';
import type { Panel } from './types';

/**
 * Bảng Đơn hàng: các đơn đặt hàng hôm nay từ khách ngoài. Đủ hàng trong kho thì bấm "Giao hàng" nhận thưởng;
 * hạn giao là `balance.contracts.due`. Sáng mai có đơn mới.
 */
export const contractsPanel: Panel = {
  id: 'contracts',
  label: 'Đơn hàng',
  icon: '📋',
  badge(game) {
    return deliverable(game.ctx);
  },
  render(game: Game) {
    const { state, content, ctx } = game;
    const due = content.balance.contracts.due;
    const list = state.contracts
      .map((c) => {
        const items = c.items
          .map((x) => {
            const item = content.items.get(x.item);
            const have = stockOf(ctx, x.item);
            return `<span class="chip ${c.status !== 'open' || have >= x.qty ? '' : 'bad'}" title="${esc(item.name)}">${item.icon} ${esc(item.name)} <b>${c.status === 'open' ? `${Math.min(have, x.qty)}/` : ''}${x.qty}</b></span>`;
          })
          .join('');
        const ready = c.items.every((x) => stockOf(ctx, x.item) >= x.qty);
        const action =
          c.status === 'done'
            ? '<span class="pill good">✔ Đã giao</span>'
            : c.status === 'expired'
              ? '<span class="pill">Hết hạn</span>'
              : `<button class="primary"${cmd({ type: 'contract/deliver', contractId: c.id })}${ready ? '' : ' disabled'}>${ready ? '📦 Giao hàng' : 'Chưa đủ hàng'}</button>`;
        return `<div class="card contract ${c.status}" data-key="c-${c.id}">
          <div class="row"><span class="big">${c.icon}</span>
            <div class="grow"><b>${esc(c.client)}</b><div class="muted">Thưởng ${coins(c.reward)} · ${c.xp} XP</div></div>
            ${action}</div>
          <div class="chips">${items}</div>
        </div>`;
      })
      .join('');
    return `<p class="muted">Khách ngoài đặt hàng mỗi sáng. Gom đủ hàng trong kho (tự trồng, nuôi hoặc mua ở chợ) rồi giao trước ${clockText(due)} để nhận thưởng cao hơn giá chợ. Quá giờ thì đơn hết hạn, không bị phạt.</p>
      ${list || '<p class="muted">Hôm nay chưa có đơn nào — sáng mai ghé lại nhé.</p>'}`;
  },
};
