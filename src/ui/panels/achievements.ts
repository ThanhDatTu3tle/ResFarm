import { achievements } from '../../data/achievements';
import type { Game } from '../../sim/game';
import { achievementValue, claimableAchievements } from '../../sim/systems/achievements';
import { cmd, esc } from '../dom';
import { coins } from '../format';
import type { Panel } from './types';
import { onlineEnabled } from '../online';

/** Sổ thành tựu: huy hiệu đã đạt (sáng) / chưa đạt (mờ, có thanh tiến độ); đạt rồi bấm nhận thưởng. */
export const achievementsPanel: Panel = {
  id: 'achievements',
  label: 'Thành tựu',
  icon: '🏆',
  badge: (game) => claimableAchievements(game.ctx).length,
  render(game: Game) {
    const a = game.state.achievements;
    const reward = (r: { money?: number; xp?: number }) => [r.money ? coins(r.money) : '', r.xp ? `${r.xp} XP` : ''].filter(Boolean).join(' · ');
    // Bản không nối máy chủ bạn bè: ẩn thành tựu kết bạn (không làm được)
    const list = achievements.filter((d) => d.stat !== 'friends' || onlineEnabled);
    const cards = list
      .map((d) => {
        const done = a.done.includes(d.id);
        const claimed = a.claimed.includes(d.id);
        const value = Math.min(d.target, achievementValue(game.ctx, d.stat));
        const shown = d.stat === 'reputation' ? value.toFixed(1) : Math.floor(value).toLocaleString('vi-VN');
        const foot = claimed
          ? '<span class="pill good">✔ Đã nhận</span>'
          : done
            ? `<button class="primary mini"${cmd({ type: 'achievement/claim', id: d.id })}>🎁 Nhận ${reward(d.reward)}</button>`
            : `<div class="quest-bar"><i style="width:${Math.round((value / d.target) * 100)}%"></i><span>${shown}/${d.target.toLocaleString('vi-VN')}</span></div>`;
        return `<div class="badge-card${done ? ' done' : ''}${done && !claimed ? ' ready' : ''}" data-key="ach-${d.id}" title="${esc(d.desc)}">
          <span class="badge-icon">${d.icon}</span><b>${esc(d.name)}</b><small>${esc(d.desc)}</small>${foot}</div>`;
      })
      .join('');
    return `<p class="muted">Đã đạt <b>${a.done.filter((id) => list.some((d) => d.id === id)).length}/${list.length}</b> huy hiệu. Thưởng thành tựu không tính vào doanh thu ngày.</p>
      <div class="badge-grid">${cards}</div>`;
  },
};
