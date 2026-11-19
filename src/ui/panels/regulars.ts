import { heartsOf, isRegularUnlocked, favoriteOf } from '../../sim/systems/regulars';
import { esc } from '../dom';
import { portraitHtml } from '../three/portraits';
import type { Panel } from './types';

/** Bảng Khách quen: chân dung (render từ model 3D), số tim, món ruột, lần ghé; khách chưa mở hiện điều kiện. */
export const regularsPanel: Panel = {
  id: 'regulars',
  label: 'Khách quen',
  icon: '💞',
  badge(game) {
    return game.state.restaurant.parties.filter((p) => p.regular).length;
  },
  render(game) {
    const { state, content, ctx } = game;
    const b = content.balance.regulars;
    const max = b.heartVisits.length;
    const here = new Set(state.restaurant.parties.map((p) => p.regular));
    const cards = content.regulars
      .all()
      .map((def) => {
        if (!isRegularUnlocked(ctx, def)) {
          return `<div class="card regular locked" data-key="${def.id}"><div class="row">
            <span class="portrait emoji">❔</span>
            <div class="grow"><b>Khách bí ẩn</b>
              <div class="muted">Ghé quán khi uy tín đạt ${def.unlock.reputation.toFixed(1)} ⭐ và quán cấp ${def.unlock.level}.</div></div></div></div>`;
        }
        const rs = state.regulars[def.id];
        const hearts = heartsOf(ctx, def.id);
        const fav = content.recipes.get(favoriteOf(ctx, def.id));
        const favState = state.menu.active.includes(fav.id) ? 'đang bán' : state.menu.unlocked.includes(fav.id) ? 'chưa bật bán' : 'chưa mở khoá';
        const nextAt = b.heartVisits[hearts];
        const gift = content.props.get(def.gift);
        const giftLine = rs?.gifted ? `🎁 Đã tặng: ${gift.icon} ${esc(gift.name)}` : `🎁 Đủ ${b.giftHearts} tim sẽ tặng quà`;
        return `<div class="card regular ${here.has(def.id) ? 'here' : ''}" data-key="${def.id}"><div class="row">
          ${portraitHtml(def)}
          <div class="grow">
            <div class="row tight"><b class="grow">${esc(def.name)}</b>${here.has(def.id) ? '<span class="pill">Đang ở quán</span>' : ''}</div>
            <div class="hearts">${'♥'.repeat(hearts)}<i>${'♡'.repeat(max - hearts)}</i></div>
            <div class="muted">${esc(def.bio)}</div>
            <div class="muted">Món ruột: ${fav.icon} <b>${esc(fav.name)}</b> <em class="${favState === 'đang bán' ? 'ok' : 'warn'}">(${favState})</em></div>
            <div class="muted">Đã ghé ${rs?.visits ?? 0} lần${nextAt != null ? ` · thêm ${nextAt - (rs?.visits ?? 0)} lần nữa lên tim` : ' · thân thiết nhất'} · ${giftLine}</div>
          </div></div></div>`;
      })
      .join('');
    return `<p class="muted">Khách quen có <b>phụ kiện riêng</b> (nơ, mũ, kính, gậy...), <b>vòng sáng hồng</b> dưới chân và <b>⭐</b> trên đầu.
      Phục vụ đúng <b>món ruột</b> (bong bóng có 💖) thì tip nhiều hơn; càng thân càng tip hậu.</p>${cards}`;
  },
};
