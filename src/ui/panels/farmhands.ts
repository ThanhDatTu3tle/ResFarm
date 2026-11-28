import { farmTools, gardenerJobs } from '../../data/farmhands';
import type { Game } from '../../sim/game';
import type { GardenerState } from '../../sim/state';
import { maxGardeners } from '../../sim/systems/gardeners';
import { cmd, esc } from '../dom';
import { coins } from '../format';
import type { Panel } from './types';

const DOING: Record<string, string> = { till: '⛏️ đang cuốc đất', water: '💧 đang tưới', plant: '🌱 đang gieo / thả giống', harvest: '🧺 đang thu hoạch' };

function gardenerCard(game: Game, g: GardenerState): string {
  const slot = g.task ? game.state.farm.slots.find((s) => s.id === g.task!.slotId) : undefined;
  const where = slot ? ` · ${esc(game.content.slotTypes.get(slot.type).name.toLowerCase())}` : '';
  const status = game.state.crew.farmerAway ? '🍜 đang nghỉ cùng bác' : g.task ? `${DOING[g.task.kind] ?? '🚶 đang đi'}${where}` : '😌 rảnh - chưa có việc hợp';
  const jobs = gardenerJobs
    .map((j) => `<button class="mini${g.jobs[j.id] ? ' on' : ''}" title="${esc(j.desc)}"${cmd({ type: 'gardener/setJob', gardenerId: g.id, job: j.id, on: !g.jobs[j.id] })}>${j.icon} ${esc(j.name)}</button>`)
    .join('');
  return `<div class="card gardener" data-key="${g.id}">
    <div class="row"><span class="big">${['👩‍🌾', '👨‍🌾', '🧑‍🌾'][g.look % 3]}</span><div class="grow"><b>${esc(g.name)}</b><div class="muted">${status}</div></div></div>
    <div class="chips jobs">${jobs}</div>
    <div class="row end"><button class="mini ghost"${cmd({ type: 'gardener/fire', gardenerId: g.id })}>Cho nghỉ việc</button></div>
  </div>`;
}

/**
 * Bảng Nhà nông: thuê người làm vườn (tự làm việc người chơi bật) và sắm dụng cụ nông trại.
 * Luật nằm ở sim/systems/gardeners.ts + farmer.ts (`hasTool`); bảng chỉ đọc state.
 */
export const farmhandsPanel: Panel = {
  id: 'farmhands',
  label: 'Nhà nông',
  icon: '👒',
  badge(game) {
    const { state, content } = game;
    const canHire = state.farm.gardeners.length < maxGardeners(game.ctx) && state.money >= content.balance.gardeners.hireCost ? 1 : 0;
    return canHire;
  },
  render(game) {
    const { state, content, ctx } = game;
    const b = content.balance.gardeners;
    const list = state.farm.gardeners;
    const max = maxGardeners(ctx);
    const next = b.levels[list.length];
    const hire =
      list.length >= b.levels.length
        ? '<div class="muted">Đã đủ người làm vườn.</div>'
        : list.length < max
          ? `<button class="wide"${cmd({ type: 'gardener/hire' })}${state.money >= b.hireCost ? '' : ' disabled'}>➕ Thuê người làm vườn · ${coins(b.hireCost)}</button>`
          : `<div class="muted">🔒 Đạt cấp ${next} để thuê thêm người làm vườn (${list.length}/${b.levels.length}).</div>`;
    const tools = farmTools
      .map((t) => {
        const owned = state.farm.tools.includes(t.id);
        const locked = state.level < t.level;
        const action = owned
          ? '<span class="pill good">✔ Đã có</span>'
          : `<button${cmd({ type: 'tool/buy', toolId: t.id })}${!locked && state.money >= t.cost ? '' : ' disabled'}>${locked ? `🔒 Cấp ${t.level}` : coins(t.cost)}</button>`;
        return `<div class="row tool${owned ? ' owned' : ''}" data-key="tool-${t.id}"><span class="big">${t.icon}</span>
          <div class="grow"><b>${esc(t.name)}</b><div class="muted">${esc(t.desc)}</div></div>${action}</div>`;
      })
      .join('');
    return `<p class="muted">Người làm vườn tự đi làm những việc fen bật cho họ (ô gần nhất trước), chừa ô bác nông dân đang lo. Ruộng lúa vẫn do bác lái máy cày. Họ nghỉ trưa, nghỉ tối cùng giờ với bác.</p>
      <h3>👩‍🌾 Người làm vườn (${list.length}/${b.levels.length})</h3>
      ${list.map((g) => gardenerCard(game, g)).join('')}
      ${hire}
      <h3>🧰 Dụng cụ nông trại</h3>
      <p class="muted">Mua một lần dùng mãi, cả bác nông dân lẫn người làm vườn đều được nhờ.</p>
      <div class="card">${tools}</div>`;
  },
};
