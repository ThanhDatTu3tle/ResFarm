import type { Game } from '../sim/game';
import { needOf, readyOrders } from '../sim/systems/service';
import { farmChecklist, tutorialFrozen, tutorialNeed } from '../sim/systems/tutorial';
import { cmd, esc } from './dom';
import type { UiState } from './panels';

const uiAttr = (action: string) => ` data-ui="${esc(action)}"`;

/** Số bước hiện trên thẻ ("Bước n/5"). */
const STEP_NO: Record<string, number> = { serve: 1, hard: 2, market: 3, cook: 3, farm: 4, morning: 5, lunch: 5 };

/** Gợi ý việc kế tiếp ở quán, theo trạng thái nhóm khách đầu tiên. */
function restaurantHint(game: Game): string {
  const { state, ctx } = game;
  const r = state.restaurant;
  const w = r.waiter;
  if (w.carrying.length) return 'Bồi bàn đang cầm món — <b>bấm vào bàn cùng màu</b> với bong bóng trên đầu để giao.';
  if (readyOrders(ctx).length) return 'Món đã ra <b>quầy line</b> (đĩa có vòng màu). <b>Bấm quầy line</b> để bồi bàn ra lấy món.';
  const dirty = Object.keys(r.dirty).some((id) => r.dirty[id]?.length);
  const p = r.parties[0];
  if (!p) return dirty ? 'Khách về để lại chén dĩa dơ — <b>bấm vào bàn đó</b> để dọn.' : 'Đợi khách tới nhé…';
  if (p.called) return 'Bồi bàn đang tới chỗ khách…';
  const need = needOf(p);
  if (need === 'menu') return 'Khách vừa ngồi, bong bóng 📖 — <b>bấm vào khách</b> để mang menu.';
  if (need === 'order') return 'Khách chọn xong (bong bóng 📝) — <b>bấm vào khách</b> để ghi món. Bếp sẽ tự nấu.';
  if (p.phase === 'queue') return 'Khách đang vào bàn…';
  if (p.phase === 'browsing') return 'Khách đang xem menu…';
  if (p.phase === 'waitingFood') return 'Bếp đang nấu — món xong sẽ ra quầy line.';
  if (p.phase === 'eating') return 'Khách đang ăn ngon miệng 😋 Ăn xong sẽ trả tiền.';
  return dirty ? 'Bấm vào bàn có chén dĩa dơ để dọn.' : '';
}

function card(game: Game, ui: UiState, title: string, body: string, actions = ''): string {
  const t = game.state.tutorial!;
  const no = STEP_NO[t.step];
  const paused = tutorialFrozen(game.ctx) ? '<span class="coach-pause">⏸ Thời gian đang dừng</span>' : '';
  void ui;
  return `<div class="coach${t.step === 'farm' ? ' right' : ''}" data-key="coach-${t.step}">
    <div class="coach-head">${no ? `<em>Bước ${no}/5</em>` : ''}<b>${title}</b>${paused}</div>
    <div class="coach-body">${body}</div>
    <div class="coach-actions">${actions}<button class="mini ghost"${cmd({ type: 'tutorial/skip' })}>Bỏ qua hướng dẫn</button></div>
  </div>`;
}

const goBtn = (area: string, label: string) => `<button class="mini primary"${uiAttr(`coach:area:${area}`)}>${label}</button>`;

/**
 * Thẻ chỉ dẫn của ngày hướng dẫn (state.tutorial — luật ở sim/systems/tutorial.ts). Lời chào và lời kết là hộp giữa màn hình,
 * các bước khác là thẻ nhỏ trên cùng, có nút đưa thẳng tới khu cần làm.
 */
export function coachHtml(game: Game, ui: UiState): string {
  const t = game.state.tutorial;
  if (!t || ui.photo) return '';
  const { content, ctx, state } = game;
  switch (t.step) {
    case 'intro':
      return `<div class="backdrop coach-modal" data-key="coach-intro">
        <div class="dialog coach-dialog" role="dialog" aria-label="Ngày đầu mở quán">
          <h2>🎉 Ngày đầu mở quán!</h2>
          <p>Hôm nay mình đi cùng bạn một vòng: <b>đón khách và bưng món</b>, ra <b>Chợ</b> mua nguyên liệu còn thiếu, xuống <b>Nông trại</b> trồng trọt để tự có nguyên liệu, rồi trưa nay cả đội cùng <b>ra chợ ăn</b>.</p>
          <p class="muted">Ở những bước cần đi xa, thời gian sẽ tạm dừng để bạn thong thả làm. Buổi chiều là của bạn — chơi tự do.</p>
          <div class="row end"><button class="ghost"${cmd({ type: 'tutorial/skip' })}>Bỏ qua hướng dẫn</button><button class="primary"${cmd({ type: 'tutorial/next' })}>Bắt đầu ▶</button></div>
        </div>
      </div>`;
    case 'serve': {
      const away = ui.area !== 'restaurant' ? goBtn('restaurant', '🍜 Về Quán') : '';
      return card(game, ui, '🍽️ Đón khách, bưng món', `${restaurantHint(game)}<div class="muted">Phục vụ xong ${Math.min(3, state.stats.today.guestsServed)}/3 khách.</div>`, away);
    }
    case 'hard': {
      const away = ui.area !== 'restaurant' ? goBtn('restaurant', '🍜 Về Quán') : '';
      return card(game, ui, '🧑‍🍳 Khách gọi món khác', `Có khách mới. ${restaurantHint(game)}`, away);
    }
    case 'market': {
      const need = tutorialNeed(ctx);
      if (!need || !t.recipe) return '';
      const item = content.items.get(need.item);
      const recipe = content.recipes.get(t.recipe);
      const stall = need.stallId ? content.stalls.get(need.stallId) : null;
      const inStall = ui.area === 'stall' && ui.stallView === need.stallId;
      const step = inStall
        ? `Bấm vào khay <b>${item.icon} ${esc(item.name)}</b> rồi mua <b>ít nhất ${need.qty}</b> (mua 5 cho dư dùng).`
        : ui.area === 'market' || ui.area === 'stall'
          ? `Bấm vào sạp <b>${stall ? `${stall.icon} ${esc(stall.name)}` : 'bán nguyên liệu này'}</b> để vào bên trong.`
          : 'Sang khu <b>Chợ</b> (nút chuyển khu dưới màn hình, hoặc bấm nút bên dưới).';
      const btn = inStall ? '' : ui.area === 'market' || ui.area === 'stall' ? (stall ? `<button class="mini primary"${uiAttr(`coach:stall:${stall.id}`)}>${stall.icon} Vào sạp</button>` : '') : goBtn('market', '🧺 Sang Chợ');
      return card(game, ui, '🧺 Ra chợ mua nguyên liệu', `Khách gọi <b>${recipe.icon} ${esc(recipe.name)}</b> nhưng quán hết <b>${item.icon} ${esc(item.name)}</b>. ${step}`, btn);
    }
    case 'cook': {
      const away = ui.area !== 'restaurant' ? goBtn('restaurant', '🍜 Về Quán') : '';
      const recipe = t.recipe ? content.recipes.get(t.recipe) : null;
      return card(game, ui, '✅ Đủ nguyên liệu rồi!', `${ui.area !== 'restaurant' ? 'Về Quán nấu cho khách. ' : ''}${restaurantHint(game)}${recipe ? `<div class="muted">Món khách chờ: ${recipe.icon} ${esc(recipe.name)}</div>` : ''}`, away);
    }
    case 'farm': {
      const list = farmChecklist(ctx)
        .map((c) => `<li class="${c.done ? 'done' : ''}">${c.done ? '✅' : c.icon} ${esc(c.text)}</li>`)
        .join('');
      const btn = ui.area !== 'farm' ? goBtn('farm', '🌾 Sang Nông trại') : '';
      return card(
        game,
        ui,
        '🌾 Tự trồng nguyên liệu',
        `Bấm vào chỗ <b>nhấp nháy vàng</b> 👇 để <b>bác nông dân</b> đi làm (giờ dừng nhưng bác vẫn đi):
        <ul class="coach-list">${list}</ul>
        <div class="muted">Lúa mì → cối xay gió ra bột mì. Cấp 2 mở lúa nước (bột gạo, bún) và heo (thịt).</div>`,
        btn,
      );
    }
    case 'morning':
      return card(game, ui, '👍 Làm tốt lắm!', 'Giờ khách tới tự do. Phục vụ tới <b>11:00</b> là ngưng nhận khách; <b>12:00</b> quán nghỉ trưa, cả đội ra chợ ăn.', ui.area !== 'restaurant' ? goBtn('restaurant', '🍜 Về Quán') : '');
    case 'lunch': {
      if (ui.mealOpen) return '';
      const c = state.crew;
      const body = c.bill.length
        ? 'Mọi người ăn xong rồi — bấm <b>Thanh toán</b> trên hoá đơn.'
        : c.pending.length
          ? 'Mỗi người có <b>năng lượng ⚡</b> — nấu, bưng, cuốc đất đều tốn sức, cạn là xỉu. Giờ nghỉ là lúc nạp lại: bấm <b>Gọi món cho đội</b> và chọn món cho từng người (món nhiều ⚡ hồi sức nhiều).'
          : 'Khách về hết, cả đội đang ra chợ ăn trưa…';
      return card(game, ui, '🍜 Nghỉ trưa, nạp năng lượng', body, c.pending.length ? `<button class="mini primary"${uiAttr('meal')}>🍜 Gọi món cho đội</button>` : '');
    }
    case 'done':
      return `<div class="backdrop coach-modal" data-key="coach-done">
        <div class="dialog coach-dialog" role="dialog" aria-label="Xong ngày hướng dẫn">
          <h2>🌟 Bạn đã sẵn sàng!</h2>
          <p class="coach-reward">🎁 Thưởng hoàn thành hướng dẫn: <b>+${game.content.balance.tutorialReward} xu</b></p>
          <p>Từ chiều nay quán là của bạn: tự đón khách, đi chợ, chăm nông trại. Nhớ để ý <b>năng lượng</b> của cả đội và <b>nguyên liệu</b> trong kho.</p>
          <p class="muted">Xem lại cách chơi bất cứ lúc nào ở Cài đặt → Hướng dẫn.</p>
          <div class="row end"><button class="primary"${cmd({ type: 'tutorial/next' })}>Chơi thôi ▶</button></div>
        </div>
      </div>`;
  }
  return ''; // bước lạ (vd. ?tut= gõ sai ở bản dev): không hiện gì, khỏi in chữ "undefined"
}

/** Dòng nhắc trong bảng gọi món của đội ở ngày hướng dẫn. */
export function mealCoachTip(game: Game): string {
  if (game.state.tutorial?.step !== 'lunch') return '';
  return '<p class="coach-tip">💡 Chọn người rồi bấm món. Số <b>+⚡</b> là năng lượng hồi lại — chọn sao cho ai cũng đầy sức cho ca chiều.</p>';
}
