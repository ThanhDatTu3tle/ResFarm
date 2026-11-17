import { createContent } from '../data';
import { Game } from '../sim/game';
import { xpForLevel } from '../sim/helpers';
import { deserialize, serialize } from '../sim/save';
import type { Command } from '../sim/types';
import { bar, cmd, esc, morph, ui as uiAttr } from './dom';
import { clockText, coins } from './format';
import { panels, type UiState } from './panels';
import { FarmArea } from './three/areas/farm';
import { MarketArea } from './three/areas/market';
import { RestaurantArea } from './three/areas/restaurant';
import { Stage, type Area, type Pick } from './three/stage';

const SAVE_KEY = 'quan-nha-vuon/save';
const SPEEDS = [0, 1, 2, 4];
/** Số lần vẽ lại DOM mỗi giây (cảnh 3D vẫn vẽ mỗi khung hình). */
const DOM_FPS = 8;
const AUTOSAVE_SECONDS = 10;

/** Ghép sim + cảnh 3D + panel lại và chạy vòng lặp chính. Đây là nơi duy nhất biết tới cả ba. */
export function startApp(root: HTMLElement): void {
  const content = createContent();

  // Tham số URL để thử nhanh: ?fresh (bỏ qua save, không ghi save) · ?seed=7 · ?ff=300 (tua 300 phút game)
  // · ?area=farm · ?tab=menu (mở sẵn ngăn kéo) · ?speed=4
  const params = new URLSearchParams(location.search);
  const fresh = params.has('fresh');
  const saved = fresh ? null : deserialize(readSave(), content);
  const game = new Game(content, saved ? { state: saved } : { seed: params.has('seed') ? Number(params.get('seed')) : undefined });
  if (import.meta.env.DEV) {
    // Chỉ ở bản dev: ?rich (nhiều tiền + cấp 9) · ?do=[{"type":"farm/plant",...}] chạy sẵn một chuỗi lệnh
    // · ?weather=rain ép thời tiết · ?edit mở sẵn chế độ sắp xếp bàn
    if (params.has('rich')) Object.assign(game.state, { money: 99999, level: 9 });
    for (const command of JSON.parse(params.get('do') ?? '[]') as Command[]) game.dispatch(command);
    const weather = params.get('weather');
    if (weather && content.weathers.has(weather)) game.state.weather = { id: weather, minutesLeft: 100000 };
  }
  game.tick(Number(params.get('ff')) || 0);

  root.innerHTML = `
    <section id="stage">
      <canvas id="scene"></canvas>
      <header id="hud"></header>
      <div id="areabar"></div>
      <div id="nav"></div>
      <nav id="tools"></nav>
    </section>
    <aside id="drawer"></aside>
    <div id="modal"></div>
    <div id="toasts"></div>
    <div id="rotate">
      <div class="big">📱↻</div>
      <b>Xoay ngang thiết bị để chơi</b>
      <span>Màn hình ngang hiển thị được nhiều hơn.</span>
      <button class="primary" data-ui="fullscreen">Toàn màn hình + xoay ngang</button>
    </div>`;
  const $ = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;

  // Thứ tự mảng = thứ tự các khu từ trái sang phải khi bấm nút chuyển khu.
  const restaurant = new RestaurantArea(game);
  const areas: Area[] = [new FarmArea(game), restaurant, new MarketArea(game)];
  const stage = new Stage($('scene') as HTMLCanvasElement, game, areas);
  const ui: UiState = {
    area: areas.find((a) => a.id === params.get('area'))?.id ?? 'restaurant',
    drawer: panels.find((p) => p.id === params.get('tab'))?.id ?? null,
    speed: params.has('speed') && SPEEDS.includes(Number(params.get('speed'))) ? Number(params.get('speed')) : 1,
    selectedSlot: null,
    selectedStall: null,
    editLayout: import.meta.env.DEV && params.has('edit'),
  };
  stage.setArea(ui.area);

  const toast = (text: string, kind = '') => {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 2600);
  };

  const save = () => {
    if (fresh) return;
    try {
      localStorage.setItem(SAVE_KEY, serialize(game.state));
    } catch {
      /* trình duyệt chặn lưu trữ: bỏ qua, game vẫn chơi được */
    }
  };

  const run = (command: Command) => {
    const result = game.dispatch(command);
    if (!result.ok) toast(result.reason, 'bad');
  };

  // ---------- Sự kiện sim -> thông báo ----------
  let lastNoFoodToast = 0;
  game.bus.on('level/up', (e) => toast(`🎉 Quán lên cấp ${e.level}!`, 'good'));
  game.bus.on('day/ended', save);
  game.bus.on('weather/changed', (e) => {
    const w = content.weathers.get(e.id);
    toast(`${w.icon} Trời chuyển: ${w.name}`);
  });
  game.bus.on('party/left', (e) => {
    if (e.reason === 'noFood' && performance.now() - lastNoFoodToast > 6000) {
      lastNoFoodToast = performance.now();
      toast('Khách bỏ về vì quán hết nguyên liệu!', 'bad');
    }
  });

  // ---------- Vẽ DOM ----------
  const renderDom = () => {
    const { state } = game;
    const b = content.balance;
    const rush = state.clock.phase === 'open' && b.rushHours.some((h) => state.clock.minute >= h.from && state.clock.minute < h.to);
    const status = state.clock.phase === 'open' ? (rush ? '🔥 Giờ cao điểm' : 'Đang mở cửa') : 'Đã đóng cửa';
    const weather = content.weathers.get(state.weather.id);

    morph(
      $('hud'),
      `<div class="hud-group">
        <span class="stat">${coins(state.money)}</span>
        <span class="stat" title="Uy tín">⭐ ${state.reputation.toFixed(1)}</span>
        <span class="stat" title="Kinh nghiệm">Cấp ${state.level} ${bar(state.xp / xpForLevel(state.level))}</span>
      </div>
      <div class="hud-group">
        <span class="stat" title="Thời tiết">${weather.icon} ${esc(weather.name)}</span>
        <span class="stat">Ngày ${state.clock.day} · ${clockText(state.clock.minute)}</span>
        <span class="stat status">${status}</span>
        <span class="btns">${SPEEDS.map((s) => `<button class="${ui.speed === s ? 'on' : ''}"${uiAttr(`speed:${s}`)}>${s === 0 ? '⏸' : `x${s}`}</button>`).join('')}</span>
        <button class="mini"${uiAttr('fullscreen')} title="Toàn màn hình">⛶</button>
        <button class="mini"${uiAttr('reset')} title="Xoá save và chơi lại từ đầu">↺</button>
      </div>`,
    );

    // Tên khu + nút chuyển khu hai bên
    const index = areas.findIndex((a) => a.id === ui.area);
    const area = areas[index];
    const prev = areas[index - 1];
    const next = areas[index + 1];
    morph(
      $('areabar'),
      ui.editLayout
        ? `<b data-key="edit">🪑 Đang sắp xếp bàn ghế</b><span>Kéo bàn tới chỗ mới. Bàn đang có khách và quầy trước bếp không dời được.</span>
           <div class="btns"><button class="mini"${cmd({ type: 'layout/reset' })}>↺ Về mặc định</button><button class="mini on"${uiAttr('edit')}>✔ Xong</button></div>`
        : `<b data-key="name">${area.icon} ${esc(area.label)}</b><span>${esc(area.hint)}</span>`,
    );
    morph(
      $('nav'),
      `${prev ? `<button class="side left" data-key="l-${prev.id}"${uiAttr(`area:${prev.id}`)}><i>‹</i><span class="big">${prev.icon}</span><span>${esc(prev.label)}</span></button>` : ''}
       ${next ? `<button class="side right" data-key="r-${next.id}"${uiAttr(`area:${next.id}`)}><i>›</i><span class="big">${next.icon}</span><span>${esc(next.label)}</span></button>` : ''}`,
    );

    morph(
      $('tools'),
      panels
        .map((p) => {
          const badge = p.badge?.(game) ?? 0;
          return `<button class="${ui.drawer === p.id ? 'on' : ''}"${uiAttr(`drawer:${p.id}`)}>${p.icon} ${esc(p.label)}${badge ? `<span class="badge">${badge}</span>` : ''}</button>`;
        })
        .join(''),
    );

    const panel = panels.find((p) => p.id === ui.drawer);
    $('drawer').classList.toggle('open', !!panel);
    morph(
      $('drawer'),
      panel
        ? `<div class="drawer-head" data-key="h-${panel.id}"><b>${panel.icon} ${esc(panel.label)}</b><button class="mini"${uiAttr('drawer:')}>✕</button></div>
           <div id="panel" data-key="${panel.id}">${panel.render(game, ui)}</div>`
        : '',
    );

    const today = state.stats.today;
    morph(
      $('modal'),
      state.clock.phase !== 'summary'
        ? ''
        : `<div class="backdrop"><div class="dialog">
            <h2>🌙 Hết ngày ${state.clock.day}</h2>
            <div class="stats">
              <div><span>Doanh thu</span><b>${coins(today.revenue)}</b></div>
              <div><span>Trong đó tip</span><b>${coins(today.tips)}</b></div>
              <div><span>Đã chi</span><b>${coins(today.spent)}</b></div>
              <div><span>Lãi trong ngày</span><b>${coins(today.revenue - today.spent)}</b></div>
              <div><span>Khách hài lòng</span><b>${today.guestsServed}</b></div>
              <div><span>Khách bỏ về</span><b>${today.guestsLost}</b></div>
            </div>
            <p class="muted">Qua đêm nông trại vẫn tiếp tục lớn. Giá chợ ngày mai sẽ thay đổi.</p>
            <button class="primary"${cmd({ type: 'day/next' })}>☀️ Bắt đầu ngày mới</button>
          </div></div>`,
    );
  };

  // ---------- Tương tác ----------
  const setArea = (id: string) => {
    if (id === ui.area) return;
    ui.area = id;
    ui.selectedSlot = null;
    ui.editLayout = false;
    stage.setArea(id);
    $('scene').animate([{ opacity: 0.15 }, { opacity: 1 }], { duration: 380, easing: 'ease-out' });
  };

  // Bấm vào vật thể trong cảnh 3D
  stage.onPick = (pick: Pick) => {
    if (pick.type === 'slot') {
      const slot = game.state.farm.slots.find((s) => s.id === pick.id);
      if (slot?.producerId && slot.stage === 'ready') {
        run({ type: 'farm/harvest', slotId: slot.id });
      } else {
        ui.selectedSlot = pick.id;
        ui.drawer = 'farm';
      }
    } else if (pick.type === 'stall') {
      ui.selectedStall = pick.id;
      ui.drawer = 'market';
    }
    renderDom();
  };

  // Kéo bàn khi đang ở chế độ sắp xếp
  stage.dragFilter = (pick) => ui.editLayout && pick.type === 'table' && !content.tables.get(pick.id).fixed;
  stage.onDrag = (pick, x, z, end) => {
    if (!end) return restaurant.dragTable(pick.id, x, z);
    const drop = restaurant.endDrag();
    if (drop) run({ type: 'layout/moveTable', ...drop });
  };

  root.addEventListener('click', (event) => {
    const target = event.target as Element;
    const cmdEl = target.closest<HTMLElement>('[data-cmd]');
    if (cmdEl) {
      run(JSON.parse(cmdEl.dataset.cmd!) as Command);
      renderDom();
      return;
    }
    const uiEl = target.closest<HTMLElement>('[data-ui]');
    if (!uiEl) return;
    const [action, arg = ''] = uiEl.dataset.ui!.split(':');
    if (action === 'area') setArea(arg);
    else if (action === 'drawer') ui.drawer = ui.drawer === arg || !arg ? null : arg;
    else if (action === 'speed') ui.speed = Number(arg);
    else if (action === 'slot') ui.selectedSlot = ui.selectedSlot === arg ? null : arg;
    else if (action === 'stall') ui.selectedStall = arg || null;
    else if (action === 'edit') {
      const on = !ui.editLayout;
      setArea('restaurant');
      ui.editLayout = on;
      if (on) ui.drawer = null;
    } else if (action === 'fullscreen') {
      // Khoá xoay ngang chỉ được trình duyệt cho phép khi đang toàn màn hình (Android); iOS thì người chơi tự xoay máy.
      const lock = () => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {});
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.().then(lock).catch(() => {});
    }
    else if (action === 'reset' && confirm('Xoá toàn bộ tiến trình và chơi lại từ đầu?')) {
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch {
        /* bỏ qua */
      }
      window.removeEventListener('pagehide', save);
      location.reload();
      return;
    }
    renderDom();
  });
  window.addEventListener('pagehide', save);

  // ---------- Vòng lặp chính ----------
  let last = performance.now();
  let domTimer = 0;
  let saveTimer = 0;
  const frame = (now: number) => {
    // Giới hạn dt: tab bị ẩn thì game tạm dừng thay vì tua một mạch.
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    game.tick(dt * ui.speed * content.balance.minutesPerSecond);
    stage.env.selectedSlot = ui.selectedSlot;
    stage.env.editLayout = ui.editLayout;
    stage.render(dt, ui.speed);
    if ((domTimer += dt) >= 1 / DOM_FPS) {
      domTimer = 0;
      renderDom();
    }
    if ((saveTimer += dt) >= AUTOSAVE_SECONDS) {
      saveTimer = 0;
      save();
    }
    requestAnimationFrame(frame);
  };
  renderDom();
  requestAnimationFrame(frame);

  // Tiện cho việc debug / để AI agent kiểm tra qua console.
  if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
}

function readSave(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}
