import type { Game } from '../../sim/game';
import { stockOf } from '../../sim/helpers';
import { openContracts, shipperBlocked } from '../../sim/systems/contracts';
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
  // Số đơn còn mở trong ngày (để người chơi biết có đơn đang chờ)
  badge(game) {
    return openContracts(game.ctx);
  },
  render(game: Game) {
    const { state, content, ctx } = game;
    const due = content.balance.contracts.due;
    const blocked = shipperBlocked(ctx);
    const s = state.restaurant.shipper;
    const shipperLine = s.trip
      ? `🛵 Anh shipper đang đi giao, về khoảng ${clockText(Math.ceil(s.trip.until / 10) * 10)}.`
      : blocked
        ? `🛵 ${blocked}`
        : `🛵 Anh shipper đang ở quán, sẵn sàng đi giao (⚡ ${Math.round(s.energy)}/${content.balance.crew.shipperMaxEnergy}).`;
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
              : c.status === 'shipping'
                ? '<span class="pill">🛵 Đang giao…</span>'
                : `<button class="primary"${cmd({ type: 'contract/deliver', contractId: c.id })}${ready && !blocked ? '' : ' disabled'}>${!ready ? 'Chưa đủ hàng' : blocked ? 'Shipper bận' : '🛵 Giao hàng'}</button>`;
        return `<div class="card contract ${c.status}" data-key="c-${c.id}">
          <div class="row"><span class="big">${c.icon}</span>
            <div class="grow"><b>${esc(c.client)}</b><div class="muted">Thưởng ${coins(c.reward)} · ${c.xp} XP</div></div>
            ${action}</div>
          <div class="chips">${items}</div>
        </div>`;
      })
      .join('');
    return `<div class="card shipper-line">${shipperLine}</div><p class="muted">Khách ngoài đặt hàng mỗi sáng. Gom đủ hàng trong kho (tự trồng, nuôi hoặc mua ở chợ) rồi bấm giao trước ${clockText(due)}: anh shipper chở đi (15–40 phút), giao xong nhận thưởng cao hơn giá chợ. Mỗi lần chỉ giao được một đơn. Quá giờ thì đơn hết hạn, không bị phạt.</p>
      ${list || '<p class="muted">Hôm nay chưa có đơn nào — sáng mai ghé lại nhé.</p>'}`;
  },
};
