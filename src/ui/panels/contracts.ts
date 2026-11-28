import { itemIcon } from '../three/itemicons';
import type { Game } from '../../sim/game';
import { stockOf } from '../../sim/helpers';
import { openContracts, shipperBlocked } from '../../sim/systems/contracts';
import { callingTakeouts, takeoutItems, takeoutOpen } from '../../sim/systems/takeout';
import { hasAll } from '../../sim/helpers';
import type { TakeoutOrder } from '../../sim/state';
import { cmd, esc, ui as uiAttr } from '../dom';
import { itemTipHtml } from '../sources';
import { clockText, coins } from '../format';
import type { Panel } from './types';

/**
 * Bảng Đơn hàng: các đơn đặt hàng hôm nay từ khách ngoài. Đủ hàng trong kho thì bấm "Giao hàng" nhận thưởng;
 * hạn giao là `balance.contracts.due`. Sáng mai có đơn mới.
 */
/** Một dòng trạng thái của đơn giao tận nơi đang làm. */
function takeoutStatus(game: Game, t: TakeoutOrder): string {
  const { state } = game;
  const r = state.restaurant;
  if (t.status === 'cooking') {
    const mine = r.orders.filter((o) => o.takeoutId === t.id);
    const at = (s: string[]) => mine.filter((o) => s.includes(o.status)).length;
    const bits = [
      at(['queued', 'cooking']) && `🍳 Bếp đang nấu ${at(['queued', 'cooking'])}`,
      at(['ready']) && `🔔 ${at(['ready'])} món ở quầy line - lấy rồi bấm quầy cashier`,
      at(['carrying']) && `🙋 Đang bưng ${at(['carrying'])}`,
      at(['served']) && `🛍️ Đã vào túi ${at(['served'])}/${t.orderIds.length}`,
    ].filter(Boolean);
    return bits.join(' · ');
  }
  if (t.status === 'packed') return '🛍️ Đã đóng gói - chờ shipper rảnh tới lấy';
  if (t.status === 'shipping') {
    const rider = [r.shipper, ...r.couriers].find((v) => v.trip?.takeoutId === t.id);
    return `🛵 Đang chở đi giao${rider?.trip?.arrive != null ? `, tới nơi khoảng ${clockText(Math.ceil(rider.trip.arrive / 10) * 10)}` : ''}`;
  }
  if (t.status === 'done') return t.late ? '⏰ Đã giao (trễ hẹn)' : '✔ Đã giao đúng hẹn';
  return '📵 Nhỡ cuộc gọi';
}

/** Mục Giao tận nơi (từ hạng balance.takeout.tier): cuộc gọi đang reo (nhận / từ chối) + các đơn đang làm. */
function takeoutHtml(game: Game): string {
  const { state, content, ctx } = game;
  const b = content.balance.takeout;
  if (!takeoutOpen(ctx)) return `<div class="card muted" data-key="takeout-locked">🛵 <b>Giao tận nơi</b>: nâng quán lên hạng ${esc(content.room.tiers[b.tier - 1].name)} để có quầy cashier ở cửa nhận đơn qua điện thoại.</div>`;
  const m = state.clock.minute;
  const list = state.takeout.orders.filter((t) => t.status !== 'missed' || m - t.expires < 60).slice().reverse();
  const cards = list
    .map((t) => {
      const dishes = t.dishes.map((id) => `<span class="chip">${content.recipes.get(id).icon} ${esc(content.recipes.get(id).name)}</span>`).join('');
      const tip = Math.round(t.price * b.tip);
      if (t.status === 'calling') {
        const enough = hasAll(ctx, takeoutItems(ctx, t));
        return `<div class="card takeout calling" data-key="t-${t.id}">
          <div class="row"><span class="big">☎️</span>
            <div class="grow"><b>${t.icon} ${esc(t.client)}</b><div class="muted">Giao trong ${b.due} phút · ${coins(t.price)} + tip ${coins(tip)} nếu đúng hẹn · cúp máy lúc ${clockText(t.expires)}</div></div></div>
          <div class="chips">${dishes}</div>
          ${enough ? '' : '<div class="low-note">⚠️ Kho không đủ nguyên liệu cho đơn này.</div>'}
          <div class="btns"><button class="ghost"${cmd({ type: 'takeout/decline', id: t.id })}>Từ chối</button><button class="primary"${cmd({ type: 'takeout/accept', id: t.id })}${enough ? '' : ' disabled'}>📝 Nhận đơn</button></div>
        </div>`;
      }
      const due = t.status === 'cooking' || t.status === 'packed' ? ` · hẹn giao trước ${clockText(t.due)}${m > t.due ? ' <b class="bad">(đã trễ)</b>' : ''}` : '';
      return `<div class="card takeout ${t.status}" data-key="t-${t.id}">
        <div class="row"><span class="big">${t.icon}</span><div class="grow"><b>${esc(t.client)}</b><div class="muted">${coins(t.price)}${due}</div></div></div>
        <div class="chips">${dishes}</div><div class="muted">${takeoutStatus(game, t)}</div>
      </div>`;
    })
    .join('');
  const riders = [state.restaurant.shipper, ...state.restaurant.couriers];
  const free = riders.filter((v) => !v.trip && !v.fainted).length;
  return `<h3 class="section">🛵 Giao tận nơi</h3>
    <p class="muted">Khách gọi tới quầy cashier ở cửa: nhận đơn thì món vào bếp. Món giao tận nơi ra quầy line có vòng màu giấy kraft 🛍️ - lấy món rồi bấm quầy cashier để đóng gói. Đủ món thì shipper rảnh tự chở đi (${free}/${riders.length} shipper đang rảnh). Đúng hẹn được tip, trễ hẹn chỉ nhận ${Math.round(b.lateRatio * 100)}% tiền.</p>
    ${cards || '<p class="muted">Chưa có khách gọi - điện thoại reo thì bấm quầy cashier nhé.</p>'}`;
}

export const contractsPanel: Panel = {
  id: 'contracts',
  label: 'Đơn hàng',
  icon: '📋',
  // Số đơn còn mở trong ngày (để người chơi biết có đơn đang chờ)
  badge(game) {
    return openContracts(game.ctx) + callingTakeouts(game.ctx);
  },
  render(game: Game, ui) {
    const { state, content, ctx } = game;
    const due = content.balance.contracts.due;
    const blocked = shipperBlocked(ctx);
    const s = state.restaurant.shipper;
    const shipperLine = s.trip
      ? `🛵 Anh shipper đang đi giao${s.trip.takeoutId != null ? ' (đơn giao tận nơi)' : ''}, về khoảng ${clockText(Math.ceil(s.trip.until / 10) * 10)}.`
      : blocked
        ? `🛵 ${blocked}`
        : `🛵 Anh shipper đang ở quán, sẵn sàng đi giao (⚡ ${Math.round(s.energy)}/${content.balance.crew.shipperMaxEnergy}).`;
    const list = state.contracts
      .map((c) => {
        const items = c.items
          .map((x) => {
            const item = content.items.get(x.item);
            const have = stockOf(ctx, x.item);
            const key = `${c.id}:${x.item}`;
            return `<button class="chip item-chip ${c.status !== 'open' || have >= x.qty ? '' : 'bad'}${ui.itemTip === key ? ' on' : ''}" title="Bấm để xem ${esc(item.name)} kiếm ở đâu"${uiAttr(`itemTip:${key}`)}>${itemIcon(item)} ${esc(item.name)} <b>${c.status === 'open' ? `${Math.min(have, x.qty)}/` : ''}${x.qty}</b></button>`;
          })
          .join('');
        // Tooltip: nguyên liệu đang chọn kiếm ở đâu (chợ / trồng / nuôi / chế biến)
        const tipItem = ui.itemTip?.startsWith(`${c.id}:`) ? ui.itemTip.slice(String(c.id).length + 1) : null;
        const tip = tipItem && content.items.has(tipItem) ? itemTipHtml(game, tipItem) : '';
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
          <div class="chips">${items}</div>${tip}
        </div>`;
      })
      .join('');
    return `${takeoutHtml(game)}<h3 class="section">📦 Đơn hàng nguyên liệu</h3><div class="card shipper-line">${shipperLine}</div><p class="muted">Khách ngoài đặt hàng mỗi sáng. Gom đủ hàng trong kho (tự trồng, nuôi hoặc mua ở chợ) rồi bấm giao trước ${clockText(due)}: anh shipper chở đi (15–40 phút), giao xong nhận thưởng cao hơn giá chợ. Mỗi lần chỉ giao được một đơn. Quá giờ thì đơn hết hạn, không bị phạt.</p>
      ${list || '<p class="muted">Hôm nay chưa có đơn nào - sáng mai ghé lại nhé.</p>'}`;
  },
};
