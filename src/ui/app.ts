import type * as THREE from 'three';
import { createContent, type Content, type CuisineId, type MillType } from '../data';
import { Game } from '../sim/game';
import { deserialize, serialize } from '../sim/save';
import { needsWatering } from '../sim/systems/farm';
import { buildingRect, queuedKinds, slotCenter, slotCenterAt } from '../sim/systems/farmer';
import { millCenter, millCenterAt } from '../sim/systems/mills';
import type { Command } from '../sim/types';
import { cmd, esc, morph, ui as uiAttr } from './dom';
import { coins } from './format';
import { Sound } from './audio';
import { billHtml, buyHtml, mealHtml, hudHtml, questHtml, serviceAlerts, serviceHtml, settingsHtml, SPEEDS, trayFor } from './hud';
import { memberOf } from '../sim/systems/crew';
import { farmerBlocked } from '../sim/systems/farmer';
import { isReserved, needOf } from '../sim/systems/service';
import { resale } from '../sim/systems/home';
import { bump, Counter, floatText, flyIcon, fxLayer } from './juice';
import { panels, type UiState } from './panels';
import { FarmArea } from './three/areas/farm';
import { GreenhouseArea } from './three/areas/greenhouse';
import { MarketArea } from './three/areas/market';
import { RestaurantArea } from './three/areas/restaurant';
import { StallArea } from './three/areas/stall';
import { Stage, type Area, type Pick } from './three/stage';
import { portraitHtml } from './three/portraits';
import { tableById } from '../sim/layout';

const SAVE_KEY = 'quan-nha-vuon/save';
/** Số lần vẽ lại DOM mỗi giây (cảnh 3D vẫn vẽ mỗi khung hình). */
const DOM_FPS = 8;
const AUTOSAVE_SECONDS = 10;

/**
 * Ghép sim + cảnh 3D + panel lại và chạy vòng lặp chính. Đây là nơi duy nhất biết tới cả ba.
 * opts.cuisine có giá trị = Ván mới với phong cách quán đó (ghi đè save cũ); không có = chơi tiếp từ save.
 * Màn hình mở đầu (title.ts) gọi hàm này sau khi người chơi chọn.
 */
export function startApp(root: HTMLElement, opts: { cuisine?: CuisineId; content?: Content } = {}): void {
  const content = opts.content ?? createContent();

  // Tham số URL để thử nhanh: ?fresh (bỏ qua save, không ghi save) · ?seed=7 · ?ff=300 (tua 300 phút game)
  // · ?area=farm · ?tab=menu (mở sẵn ngăn kéo) · ?speed=4
  const params = new URLSearchParams(location.search);
  const fresh = params.has('fresh');
  const saved = fresh || opts.cuisine ? null : loadSave(content);
  // ?cuisine=jp|kr|vn (kèm ?fresh) để thử nhanh một quán mà không qua màn hình mở đầu
  const paramCuisine = params.get('cuisine');
  const cuisine = opts.cuisine ?? (paramCuisine && content.cuisines.has(paramCuisine) ? (paramCuisine as CuisineId) : 'vn');
  const game = new Game(content, saved ? { state: saved } : { seed: params.has('seed') ? Number(params.get('seed')) : undefined, cuisine });
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
    <div id="questdlg"></div>
    <div id="bill"></div>
    <div id="meal"></div>
    <div id="settings"></div>
    <div id="service"></div>
    <div id="buy"></div>
    <div id="toasts"></div>
    <div id="photobar"><button class="primary" data-ui="snap">📸 Chụp ảnh quán</button><button data-ui="photo:close">✕ Thoát</button></div>
    <div id="rotate">
      <div class="big">📱↻</div>
      <b>Xoay ngang thiết bị để chơi</b>
      <span>Màn hình ngang hiển thị được nhiều hơn.</span>
      <button class="primary" data-ui="fullscreen">Toàn màn hình + xoay ngang</button>
    </div>`;
  const $ = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;

  // Thứ tự mảng = thứ tự các khu từ trái sang phải khi bấm nút chuyển khu.
  let restaurant = new RestaurantArea(game);
  const farm = new FarmArea(game);
  const greenhouse = new GreenhouseArea(game);
  // Nhà kính nằm bên trái nông trại trên thanh chuyển khu (vào được cả bằng cách bấm nhà kính ở nông trại)
  const market = new MarketArea(game);
  // Bên trong quầy chợ: chỉ vào được bằng cách bấm sạp ở chợ (không có trên thanh chuyển khu, trừ nút quay về Chợ)
  const stall = new StallArea(game);
  const areas: Area[] = [greenhouse, farm, restaurant, market, stall];
  const stage = new Stage($('scene') as HTMLCanvasElement, game, areas);
  const ui: UiState = {
    area: areas.find((a) => a.id === params.get('area'))?.id ?? 'restaurant',
    drawer: panels.find((p) => p.id === params.get('tab'))?.id ?? null,
    speed: params.has('speed') && SPEEDS.includes(Number(params.get('speed'))) ? Number(params.get('speed')) : 1,
    selectedSlot: null,
    selectedStall: null,
    editLayout: import.meta.env.DEV && params.has('edit'),
    settings: false,
    passOpen: import.meta.env.DEV && params.has('pass'), // chỉ bản dev: ?pass mở sẵn khay quầy ra món
    serving: null,
    // Chỉ bản dev: ?focus=pen mở bảng Nông trại chỉ với một loại ô / cối (để xem giao diện)
    farmFocus: import.meta.env.DEV ? params.get('focus') : null,
    editSelected: null,
    photo: false,
    tray2: [],
    tray4: [],
    trayPick: null,
    questOpen: false,
    mealOpen: false,
    mealWho: null,
    mealStall: null,
    stallView: null,
    buyItem: null,
  };
  stage.setArea(ui.area);

  /** Thông báo nổi; `pic` = HTML ảnh nhỏ đứng trước chữ (chân dung khách quen). */
  const toast = (text: string, kind = '', pic = '', ms = 2600) => {
    const el = document.createElement('div');
    el.className = `toast ${kind}${pic ? ' with-pic' : ''}`;
    el.innerHTML = pic + `<span>${esc(text)}</span>`;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), ms);
  };

  const save = () => {
    if (fresh) return;
    try {
      localStorage.setItem(SAVE_KEY, serialize(game.state));
    } catch {
      /* trình duyệt chặn lưu trữ: bỏ qua, game vẫn chơi được */
    }
  };

  // ---------- Âm thanh ----------
  const sound = new Sound();
  // Trình duyệt chỉ cho phát tiếng sau thao tác đầu tiên
  root.addEventListener('pointerdown', () => sound.unlock(), { capture: true });

  let pauseHintAt = -1e9;
  const run = (command: Command) => {
    const result = game.dispatch(command);
    if (!result.ok) {
      toast(result.reason, 'bad');
      sound.play('error');
    } else if (ui.speed === 0 && /^(farmer|service)\//.test(command.type) && performance.now() - pauseHintAt > 4000) {
      // Giao việc lúc đang tạm dừng: nhân vật nhận việc nhưng đứng yên tới khi chạy tiếp — nhắc kẻo tưởng hỏng
      pauseHintAt = performance.now();
      toast('⏸ Game đang tạm dừng — chạy tiếp (⚙️ hoặc phím Space) để nhân vật bắt đầu làm');
    }
    return result.ok;
  };

  // ---------- Juice: thứ bay về HUD, số tiền chạy dần ----------
  const fx = fxLayer(root);
  const money = new Counter(game.state.money);
  let lastMoney = game.state.money;
  const moneyEl = () => $('hud').querySelector('[data-key="money"]');
  const storeEl = () => $('tools').querySelector('[data-ui="drawer:inventory"]');

  restaurant.onPaid = (world, amount) => {
    if (ui.area !== 'restaurant') return;
    const from = stage.toScreen(world);
    const n = Math.max(1, Math.min(5, Math.round(amount / 25)));
    for (let i = 0; i < n; i++) flyIcon(fx, '🪙', from, moneyEl(), {
        delay: i * 80,
        size: 22,
        onArrive: () => {
          bump(moneyEl(), 0.5);
          sound.play('coin');
        },
      });
  };
  const onHarvest = (area: string) => (_slotId: string, world: THREE.Vector3, icons: string[]) => {
    if (ui.area !== area) return;
    const from = stage.toScreen(world);
    sound.play('harvest');
    icons.forEach((icon, i) =>
      flyIcon(fx, icon, from, storeEl(), {
        delay: 250 + i * 90,
        onArrive: () => {
          bump(storeEl(), 0.6);
          sound.play('pop');
        },
      }),
    );
  };
  farm.onHarvest = onHarvest('farm');
  greenhouse.onHarvest = onHarvest('greenhouse');
  // Âm thanh của từng khu chỉ phát khi đang xem khu đó, cho đỡ ồn
  farm.onAction = (kind) => {
    if (ui.area === 'farm') sound.play(kind === 'till' ? 'dig' : kind);
  };
  greenhouse.onAction = (kind) => {
    if (ui.area === 'greenhouse') sound.play(kind);
  };
  // Bác nông dân tới nơi mà việc không làm được nữa (vd tiền đã tiêu vào việc khác) thì báo lại
  game.bus.on('farmer/done', (e) => {
    if (e.ok || !e.reason) return;
    toast(`🧑‍🌾 ${e.reason}`, 'bad');
    if (ui.area === 'farm') sound.play('error');
  });
  game.bus.on('party/needs', () => ui.area === 'restaurant' && sound.play('bell'));
  game.bus.on('order/ready', () => ui.area === 'restaurant' && sound.play('ripe'));
  game.bus.on('waiter/done', (e) => e.kind === 'pickup' && ui.area === 'restaurant' && sound.play('pop'));
  game.bus.on('order/served', () => ui.area === 'restaurant' && sound.play('serve'));
  game.bus.on('party/left', (e) => e.reason !== 'paid' && e.reason !== 'closed' && ui.area === 'restaurant' && sound.play('sad'));
  game.bus.on('level/up', () => sound.play('levelup'));
  // Nhiệm vụ hệ thống: báo khi đạt mục tiêu, nhận thưởng thì xu nảy
  game.bus.on('quest/completed', (e) => {
    const q = content.quests.find((x) => x.id === e.questId);
    if (q) toast(`🎯 Hoàn thành nhiệm vụ "${q.title}" — bấm Nhận thưởng`);
    sound.play('ripe');
  });
  game.bus.on('quest/claimed', () => {
    sound.play('coin');
    bump(moneyEl(), 0.6);
  });
  game.bus.on('day/ended', () => sound.play('dayEnd'));
  game.bus.on('crew/fainted', (e) => {
    const m = memberOf(game.ctx, e.who);
    toast(`😵 ${m?.name ?? 'Nhân viên'} kiệt sức xỉu rồi! Bồi dưỡng ${content.balance.crew.reviveCost} xu ở bảng Nhân viên, hoặc đợi giờ nghỉ ra chợ ăn.`, 'bad', '', 4200);
    sound.play('sad');
  });
  game.bus.on('crew/left', (e) => {
    if (e.group === 'farm') toast(e.kind === 'lunch' ? '🍜 Bác nông dân ra chợ ăn trưa, 13:00 về.' : '🌙 Bác nông dân nghỉ, ra chợ ăn tối.', '', '', 3200);
    else toast(e.kind === 'lunch' ? '🍜 Quán vắng khách — cả đội ra chợ ăn trưa, 14:00 về chuẩn bị ca chiều.' : '🌙 Quán đóng cửa — cả đội ra chợ ăn tối, chơi bời.', '', '', 3600);
  });
  game.bus.on('crew/back', (e) => toast(e.group === 'farm' ? '👨‍🌾 Bác nông dân về nông trại rồi.' : '🙌 Cả đội về quán, sẵn sàng ca chiều!', 'good'));
  game.bus.on('crew/bill', () => sound.play('bell'));
  // Cả đội vừa ra chợ: mở bảng gọi món cho người chơi chọn (đóng lại thì quá hạn mọi người tự chọn)
  game.bus.on('crew/left', () => {
    if (game.state.crew.pending.length && !ui.settings) [ui.mealOpen, ui.mealStall] = [true, null];
  });
  game.bus.on('shift/lastCall', () => toast('🔕 Ngưng nhận khách mới — phục vụ nốt khách đang ở quán rồi đóng cửa.', '', '', 3600));
  game.bus.on('shift/started', (e) => {
    toast(`🔔 Mở cửa ${e.index === 0 ? 'ca sáng' : 'ca chiều tối'}! Khách sắp tới.`, 'good');
    sound.play('bell');
  });
  game.bus.on('shift/ended', (e) => {
    const next = content.balance.shifts[e.index + 1];
    toast(next ? `😴 Đóng cửa nghỉ trưa — mở lại lúc ${String(next.from / 60).padStart(2, '0')}:00. Khách về hết thì cả đội ra chợ ăn trưa. Sàn có vết bẩn, bấm vào để lau.` : '🌙 Quán đóng cửa. Khách về hết thì cả đội ra chợ ăn tối.', '', '', 4200);
  });
  // Khách quen: thông báo có chân dung lúc ghé quán; lên tim / được ăn món ruột / tặng quà
  game.bus.on('regular/arrived', (e) => {
    const def = content.regulars.get(e.regularId);
    toast(`${def.name} ghé quán — "${def.greet}"`, 'regular', portraitHtml(def, 'toast-pic'), 3600);
    if (ui.area === 'restaurant') sound.play('bell');
  });
  game.bus.on('regular/visited', (e) => {
    const def = content.regulars.get(e.regularId);
    const max = content.balance.regulars.heartVisits.length;
    const parts = [e.fav ? `${def.name} khen món ruột ngon tuyệt!` : `${def.name} ăn ngon miệng.`];
    if (e.heartUp) parts.push(`Thân thiết lên ${'♥'.repeat(e.hearts)}${'♡'.repeat(max - e.hearts)}`);
    toast(parts.join(' '), 'regular good', portraitHtml(def, 'toast-pic'), 3600);
    if (e.gift) {
      const gift = content.props.get(e.gift);
      setTimeout(() => toast(`🎁 ${def.name} tặng quán "${gift.name}"! Xem ở chế độ sắp xếp bàn ghế.`, 'good', portraitHtml(def, 'toast-pic'), 5000), 900);
    }
    if (e.heartUp || e.gift) sound.play('levelup');
  });
  // Quán lên hạng: phòng to hơn nên dựng lại cả khu quán
  game.bus.on('restaurant/upgraded', (e) => {
    const tier = content.room.tiers[e.tier - 1];
    const next = new RestaurantArea(game);
    next.onPaid = restaurant.onPaid;
    restaurant.dispose();
    stage.replaceArea(restaurant, next);
    restaurant = next;
    toast(`${tier.icon} Quán lên hạng: ${tier.name}!`, 'good');
    sound.play('levelup');
  });

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

  /** Kho cuối ngày: mọi nguyên liệu / thành phẩm còn lại (theo nhóm), để biết mai cần mua gì. */
  const stockHtml = () => {
    const left = content.items.all().filter((i) => !i.infinite && (game.state.inventory[i.id] ?? 0) > 0);
    if (!left.length) return '<p class="muted">Kho trống trơn — mai nhớ đi chợ nhé!</p>';
    return '<div class="stock-grid">' + left.map((i) => `<span class="chip stock" title="${esc(i.name)}"><span class="big">${i.icon}</span>${esc(i.name)} <b>${game.state.inventory[i.id]}</b></span>`).join('') + '</div>';
  };

  // ---------- Vẽ DOM ----------
  let lastDrawer: string | null = null;
  const renderDom = () => {
    const { state } = game;
    // Đóng bảng Nông trại (hoặc chuyển bảng khác) thì camera lướt về góc nhìn cả nông trại
    if (lastDrawer === 'farm' && ui.drawer !== 'farm' && (ui.area === 'farm' || ui.area === 'greenhouse')) {
      stage.unfocus();
      ui.farmFocus = null;
      ui.selectedSlot = null;
    }
    // Đóng bảng Chợ thì camera lướt về toàn cảnh chợ
    if (lastDrawer === 'market' && ui.drawer !== 'market' && ui.area === 'market') stage.unfocus();
    lastDrawer = ui.drawer;

    morph($('hud'), hudHtml(game, ui, money.value));
    morph($('settings'), settingsHtml(ui, sound.prefs));
    // Món đã chọn không còn ở quầy (khách bỏ về...) thì bỏ chọn
    if (ui.serving != null) {
      const o = state.restaurant.orders.find((x) => x.id === ui.serving);
      if (!o || o.status !== 'ready' || isReserved(game.ctx, o.id)) ui.serving = null;
    }
    // Khay: bỏ món không còn ở quầy (khách bỏ về...), khay đủ bộ cho một bàn thì giao luôn
    const stillReady = (id: number) => state.restaurant.orders.some((o) => o.id === id && o.status === 'ready' && !isReserved(game.ctx, o.id));
    ui.tray2 = ui.tray2.filter(stillReady);
    ui.tray4 = ui.tray4.filter(stillReady);
    if (ui.trayPick && !(ui.trayPick === 2 ? ui.tray2 : ui.tray4).length) ui.trayPick = null;
    morph($('questdlg'), questHtml(game, ui));
    // Quầy ra món mở thì hiện dọc bên phải như ngăn kéo (cảnh 3D thu hẹp lại, vẫn thấy hết bàn để bấm);
    // đóng quầy mà đang cầm món thì hiện thanh nhắc nhỏ phía dưới
    const passHere = ui.passOpen && ui.area === 'restaurant' && !ui.editLayout;
    morph($('service'), ui.area === 'restaurant' && !ui.editLayout && !passHere ? serviceHtml(game, ui) : '');

    // Thanh chế độ sắp xếp bàn + nút chuyển khu hai bên
    const navAreas = areas.filter((a) => a.id !== 'stall' || ui.area === 'stall');
    const index = navAreas.findIndex((a) => a.id === ui.area);
    const prev = navAreas[index - 1];
    const next = navAreas[index + 1];
    morph(
      $('areabar'),
      ui.editLayout ? editBar() : '', // ngoài chế độ sắp xếp bàn thì không hiện gì (hướng dẫn nằm trong bảng Cài đặt)
    );
    morph(
      $('nav'),
      [prev && ['left', '‹', prev], next && ['right', '›', next]]
        .map((entry) => {
          if (!entry) return '';
          const [side, arrow, a] = entry as [string, string, Area];
          // Đang ở khu khác mà quán có việc cần làm: hiện số việc trên nút sang quán
          const alerts = a.id === 'restaurant' ? serviceAlerts(game) : 0;
          return `<button class="side ${side}" data-key="${side}-${a.id}"${uiAttr(`area:${a.id}`)}><i>${arrow}</i><span class="big">${a.icon}</span><span>${esc(a.label)}</span>${alerts ? `<span class="badge">${alerts}</span>` : ''}</button>`;
        })
        .join(''),
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

    // Nút chuyển khu nằm ngay trên thanh công cụ: theo chiều cao thật của thanh (màn hẹp thanh xuống 2 hàng)
    root.style.setProperty('--tools-h', `${$('tools').offsetHeight || 40}px`);
    const panel = passHere ? undefined : panels.find((p) => p.id === ui.drawer);
    $('drawer').classList.toggle('open', !!panel || passHere);
    morph(
      $('drawer'),
      passHere
        ? `<div id="panel" class="pass-panel" data-key="pass">${serviceHtml(game, ui)}</div>`
        : panel
        ? `<div class="drawer-head" data-key="h-${panel.id}"><b>${panel.icon} ${esc(panel.label)}</b><button class="mini"${uiAttr('drawer:')}>✕</button></div>
           <div id="panel" data-key="${panel.id}">${panel.render(game, ui)}</div>`
        : '',
    );

    const today = state.stats.today;
    morph($('bill'), billHtml(game));
    morph($('meal'), mealHtml(game, ui));
    morph($('buy'), ui.area === 'stall' ? buyHtml(game, ui) : '');
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
            <h3>📦 Trong kho còn</h3>
            ${stockHtml()}
            <p class="muted">Qua đêm nông trại vẫn tiếp tục lớn. Giá chợ ngày mai sẽ thay đổi.</p>
            <button class="primary"${cmd({ type: 'day/next' })}>☀️ Bắt đầu ngày mới</button>
          </div></div>`,
    );
  };

  /** Thanh trên cùng ở chế độ sắp xếp: hướng dẫn, và nút cho món đang chọn (xoay / cất kho / bán lại). */
  const editBar = (): string => {
    const { state, ctx } = game;
    const sel = ui.editSelected;
    const table = sel ? tableById(ctx, sel) : null;
    const prop = sel ? state.restaurant.props.find((p) => p.uid === sel && !p.stored) : null;
    if (sel && !table && !prop) ui.editSelected = null;
    const done = `<button class="mini on"${uiAttr('edit')}>✔ Xong</button>`;
    if (table && !table.fixed) {
      const sell = table.kind ? `<button class="mini"${cmd({ type: 'table/sell', tableId: table.id })}>💰 Bán lại ${coins(resale(ctx, content.tableKinds.get(table.kind).cost))}</button>` : '';
      return `<b data-key="edit">🪑 ${esc(table.name)}</b><span>Kéo để dời, hoặc xoay 90°.</span>
        <div class="btns"><button class="mini"${cmd({ type: 'layout/rotateTable', tableId: table.id })}>⟳ Xoay</button>${sell}<button class="mini"${uiAttr('editSel:')}>Bỏ chọn</button>${done}</div>`;
    }
    if (prop) {
      const def = content.props.get(prop.def);
      const sell = def.giftOnly ? '' : `<button class="mini"${cmd({ type: 'prop/sell', uid: prop.uid })}>💰 Bán ${coins(resale(ctx, def.cost))}</button>`;
      return `<b data-key="edit">${def.icon} ${esc(def.name)}</b><span>Kéo để dời chỗ.</span>
        <div class="btns"><button class="mini"${cmd({ type: 'prop/rotate', uid: prop.uid })}>⟳ Xoay</button><button class="mini"${cmd({ type: 'prop/store', uid: prop.uid })}>📦 Cất kho</button>${sell}<button class="mini"${uiAttr('editSel:')}>Bỏ chọn</button>${done}</div>`;
    }
    return `<b data-key="edit">🪑 Đang sắp xếp quán</b><span>Kéo bàn ghế, đồ trang trí tới chỗ mới; bấm một món để xoay / cất. Bàn có khách và quầy trước bếp không dời được.</span>
      <div class="btns"><button class="mini"${cmd({ type: 'layout/reset' })}>↺ Bàn về mặc định</button>${done}</div>`;
  };

  /** Thêm món vào khay (khay đầy thì sang khay kia). Người chơi bấm khay rồi bấm bàn để bưng. */
  const addToTray = (orderId: number, kind: 2 | 4) => {
    if (ui.tray2.includes(orderId) || ui.tray4.includes(orderId)) return;
    const pick = kind === 2 ? (ui.tray2.length < 2 ? 2 : ui.tray4.length < 4 ? 4 : 0) : ui.tray4.length < 4 ? 4 : ui.tray2.length < 2 ? 2 : 0;
    if (!pick) return void toast('Hai khay đều đầy rồi — bỏ bớt món ra nhé.', 'bad');
    (pick === 2 ? ui.tray2 : ui.tray4).push(orderId);
    sound.play('pop');
  };

  // Kéo món từ quầy thả vào khay (chuột lẫn cảm ứng): kéo một bản sao đi theo ngón tay, thả trên khay nào thì vào khay đó
  let dragDish: { id: number; x: number; y: number; ghost: HTMLElement | null } | null = null;
  let swallowClick = false;
  root.addEventListener('pointerdown', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-order]');
    if (el) dragDish = { id: Number(el.dataset.order), x: e.clientX, y: e.clientY, ghost: null };
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragDish) return;
    if (!dragDish.ghost && Math.hypot(e.clientX - dragDish.x, e.clientY - dragDish.y) > 6) {
      const src = root.querySelector<HTMLElement>(`[data-order="${dragDish.id}"] .dish-icon`);
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.textContent = src?.textContent ?? '🍽️';
      document.body.appendChild(ghost);
      dragDish.ghost = ghost;
    }
    if (dragDish.ghost) {
      dragDish.ghost.style.transform = `translate(${e.clientX - 24}px, ${e.clientY - 24}px)`;
      for (const t of root.querySelectorAll('.tray')) t.classList.toggle('over', t === document.elementFromPoint(e.clientX, e.clientY)?.closest('.tray'));
    }
  });
  window.addEventListener('pointerup', (e) => {
    if (!dragDish) return;
    const d = dragDish;
    dragDish = null;
    if (!d.ghost) return; // không kéo: để click xử lý như bấm thường
    d.ghost.remove();
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 0);
    const tray = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('.tray');
    for (const t of root.querySelectorAll('.tray')) t.classList.remove('over');
    if (tray) addToTray(d.id, Number(tray.dataset.tray) as 2 | 4);
    renderDom();
  });

  /** Chế độ chụp ảnh: vẽ một khung hình rồi tải về ảnh PNG đặt theo tên quán. */
  const takePhoto = () => {
    stage.render(0, 0);
    const canvas = $('scene') as HTMLCanvasElement;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${game.state.profile.name.replace(/[^\p{L}\p{N}]+/gu, '-')}-ngay-${game.state.clock.day}.png`;
    a.click();
    sound.play('pop');
    $('stage').animate([{ filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], { duration: 350, easing: 'ease-out' });
  };

  // ---------- Tương tác ----------
  const setArea = (id: string) => {
    if (id === ui.area) return;
    ui.area = id;
    ui.selectedSlot = null;
    ui.farmFocus = null;
    ui.editLayout = false;
    ui.buyItem = null;
    if (id !== 'stall') ui.stallView = null;
    stage.setArea(id);
    $('scene').animate([{ opacity: 0.15 }, { opacity: 1 }], { duration: 380, easing: 'ease-out' });
  };

  // Bấm vào vật thể trong cảnh 3D
  stage.onPick = (pick: Pick) => {
    if (pick.type === 'slot') {
      // Bác đang ở chợ / kiệt sức: nhắc (vẫn mở bảng để xem)
      const blocked = farmerBlocked(game.ctx);
      if (blocked) toast(blocked);
      const slot = game.state.farm.slots.find((s) => s.id === pick.id);
      const type = slot && content.slotTypes.get(slot.type);
      // Camera lướt lại gần ô vừa bấm (vừa phải) và bảng Nông trại chỉ hiện loại ô này
      if (slot) {
        // Luống trong nhà kính nằm ở khu riêng (toạ độ khác) nên không lướt camera
        if (!type?.building) {
          const c = slotCenter(game.ctx, slot);
          stage.focusOn(c.x, c.z, slot.type === 'field' ? 0.55 : 0.62);
        }
        ui.farmFocus = slot.type;
      }
      // Bác nông dân nhận việc hợp trạng thái ô rồi chạy tới làm (systems/farmer.ts).
      // Ô đã có việc chờ, hoặc không có gì để làm ngay: bác chạy tới xem và mở bảng để chọn giống / xem thông tin.
      const queued = slot ? queuedKinds(game.ctx, slot.id) : [];
      if (slot && !queued.length && slot.producerId && slot.stage === 'ready') {
        run({ type: 'farmer/do', kind: 'harvest', slotId: slot.id });
      } else if (slot && !queued.length && !slot.producerId && type?.needsTilling && !slot.tilled) {
        run({ type: 'farmer/do', kind: 'till', slotId: slot.id });
      } else if (slot && !queued.length && slot.producerId && needsWatering(game.ctx, slot)) {
        run({ type: 'farmer/do', kind: 'water', slotId: slot.id });
      } else {
        if (slot && !queued.length) game.dispatch({ type: 'farmer/do', kind: 'visit', slotId: slot.id });
        ui.selectedSlot = pick.id;
        ui.drawer = 'farm';
      }
    } else if (pick.type === 'mill') {
      const mill = game.state.farm.mills.find((m) => m.id === pick.id);
      if (mill) {
        const c = millCenter(game.ctx, mill);
        stage.focusOn(c.x, c.z, 0.6);
        ui.farmFocus = mill.type;
        ui.selectedSlot = null;
        ui.drawer = 'farm';
      }
    } else if (pick.type === 'expand') {
      // Chỗ trống mua thêm: lướt tới chỗ trống đầu tiên của loại đó, mở bảng có nút mua
      const slotType = content.slotTypes.has(pick.id) ? content.slotTypes.get(pick.id) : null;
      const owned = slotType ? game.state.farm.slots.filter((s) => s.type === slotType.id) : [];
      // Loại ô đã đủ số lượng (ao): viền đứt khúc là chỗ NỚI RỘNG ô có sẵn → chọn ô đó để bảng hiện nút nới rộng
      const grow = slotType && owned.length >= slotType.max ? owned[0] : null;
      const house = slotType?.building ? buildingRect(game.ctx, slotType.id) : null;
      const c = house
        ? { x: house.x2 + 2, z: (house.z1 + house.z2) / 2 }
        : grow
        ? slotCenter(game.ctx, grow)
        : slotType
          ? slotCenterAt(game.ctx, slotType.id, owned.length)
          : millCenterAt(game.ctx, pick.id as MillType, game.state.farm.mills.filter((m) => m.type === pick.id).length);
      if (ui.area === 'farm') stage.focusOn(c.x, c.z, 0.62);
      ui.farmFocus = pick.id;
      ui.selectedSlot = grow?.id ?? null;
      ui.drawer = 'farm';
    } else if (pick.type === 'building') {
      // Bấm nhà kính ở nông trại: vào khu bên trong
      setArea(pick.id);
    } else if (pick.type === 'stall' && content.stalls.has(pick.id) && (content.stalls.get(pick.id).kind ?? 'stall') !== 'kiosk' && !content.stalls.get(pick.id).items.length) {
      // Hàng rong (xe hủ tiếu, gánh bánh tráng, xe cà phê): lướt camera tới, mở bảng xem thực đơn
      if (ui.area === 'market') {
        const c = market.stallCenter(pick.id);
        if (c) stage.focusOn(c.x, c.z, 0.26, 1.3);
      }
      ui.selectedStall = pick.id;
      ui.drawer = 'market';
    } else if (pick.type === 'stall') {
      // Sạp nguyên liệu + Tiệm 25caaaaa: vào hẳn bên trong quầy (khu riêng, như nhà kính)
      ui.stallView = pick.id;
      ui.buyItem = null;
      ui.drawer = null;
      stall.show(pick.id);
      setArea('stall');
    } else if (pick.type === 'goods') {
      ui.buyItem = ui.buyItem === pick.id ? null : pick.id;
      sound.play('pop');
    } else if (pick.type === 'menuboard') {
      ui.mealOpen = true;
      ui.mealStall = pick.id;
    } else if (pick.type === 'stain') {
      if (run({ type: 'service/mop', stainId: Number(pick.id) })) sound.play('pop');
    } else if (pick.type === 'pass') {
      ui.passOpen = !ui.passOpen;
      ui.serving = null;
      ui.trayPick = null;
      if (ui.passOpen) ui.drawer = null;
    } else if (pick.type === 'party') {
      servePartyAt(Number(pick.id));
    } else if ((pick.type === 'table' || pick.type === 'prop') && ui.editLayout) {
      ui.editSelected = ui.editSelected === pick.id ? null : pick.id;
    } else if (pick.type === 'table' && !ui.editLayout) {
      // Bấm vào bàn = bấm vào nhóm khách ở bàn đó (quầy ghế đơn có nhiều nhóm: ưu tiên nhóm hợp việc đang làm)
      const here = game.state.restaurant.parties.filter((p) => p.tableId === pick.id);
      const want = ui.serving != null || ui.trayPick ? here.find((p) => p.phase === 'waitingFood') : here.find((p) => needOf(p));
      // Bàn có chén dĩa dơ (và không ai cần phục vụ ngay): dọn bàn
      if (!want && game.state.restaurant.dirty[pick.id]?.length) run({ type: 'service/clean', tableId: pick.id });
      else {
        const party = want ?? here[0];
        if (party) servePartyAt(party.id);
      }
    }
    renderDom();
  };

  /** Người chơi bấm vào một nhóm khách: giao món đang cầm, hoặc mang menu / ghi món nếu họ đang cần. */
  const servePartyAt = (partyId: number) => {
    const party = game.state.restaurant.parties.find((p) => p.id === partyId);
    if (!party) return;
    if (ui.serving != null) {
      if (run({ type: 'service/deliver', orderIds: [ui.serving], partyId })) ui.serving = null;
      return;
    }
    if (ui.trayPick) {
      const kind = ui.trayPick;
      const ids = kind === 2 ? ui.tray2 : ui.tray4;
      if (run({ type: 'service/deliver', orderIds: [...ids], partyId })) {
        sound.play('pop');
        if (kind === 2) ui.tray2 = [];
        else ui.tray4 = [];
        ui.trayPick = null;
      }
      return;
    }
    const need = needOf(party);
    if (need === 'menu') run({ type: 'service/menu', partyId });
    else if (need === 'order') run({ type: 'service/takeOrder', partyId });
    else if (party.phase === 'waitingFood' && !ui.passOpen) toast('Món nấu xong sẽ ra quầy 🔔 — bấm quầy, xếp món vào khay rồi bấm khay, bấm bàn để bưng.');
  };

  // Kéo bàn khi đang ở chế độ sắp xếp
  // Kéo bàn / đồ trang trí khi đang ở chế độ sắp xếp; thả ra thì chọn luôn món đó (hiện nút xoay / cất / bán)
  stage.dragFilter = (pick) => ui.editLayout && ((pick.type === 'table' && !tableById(game.ctx, pick.id)?.fixed) || pick.type === 'prop');
  stage.onDrag = (pick, x, z, end) => {
    if (!end) return restaurant.dragItem(pick.type === 'prop' ? 'prop' : 'table', pick.id, x, z);
    const drop = restaurant.endDrag();
    if (!drop) return;
    ui.editSelected = drop.id;
    if (drop.kind === 'table') run({ type: 'layout/moveTable', tableId: drop.id, x: drop.x, y: drop.y });
    else run({ type: 'prop/move', uid: drop.id, x: drop.x, y: drop.y });
    renderDom();
  };

  root.addEventListener('click', (event) => {
    if (swallowClick) return;
    const target = event.target as Element;
    if (target.closest('button:not(:disabled)')) sound.play('click');
    const cmdEl = target.closest<HTMLElement>('[data-cmd]');
    if (cmdEl) {
      const command = JSON.parse(cmdEl.dataset.cmd!) as Command;
      const r = cmdEl.getBoundingClientRect();
      // Mua ở chợ: hàng bay từ nút bấm về Kho
      if (run(command) && command.type === 'market/buy') {
        const icon = content.items.get(command.itemId).icon;
        sound.play('buy');
        for (let i = 0; i < Math.min(3, command.qty); i++)
          flyIcon(fx, icon, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, storeEl(), {
            delay: i * 70,
            onArrive: () => {
              bump(storeEl(), 0.5);
              sound.play('pop');
            },
          });
      }
      renderDom();
      return;
    }
    const uiEl = target.closest<HTMLElement>('[data-ui]');
    if (!uiEl) return;
    const [action, arg = ''] = uiEl.dataset.ui!.split(':');
    if (action === 'area') setArea(arg);
    else if (action === 'drawer') {
      ui.drawer = ui.drawer === arg || !arg ? null : arg;
      if (ui.drawer) ui.passOpen = false;
      if (ui.drawer === 'farm') ui.farmFocus = null; // mở từ nút: xem cả nông trại
    } else if (action === 'farmFocus') ui.farmFocus = arg || null;
    else if (action === 'speed') ui.speed = Number(arg);
    else if (action === 'settings') ui.settings = arg === 'close' ? false : !ui.settings;
    else if (action === 'pass') ui.passOpen = arg === 'close' ? false : !ui.passOpen;
    else if (action === 'serve') {
      ui.serving = arg && ui.serving !== Number(arg) ? Number(arg) : null;
      ui.trayPick = null;
      if (arg) sound.play('pop');
    } else if (action === 'trayPick') {
      const kind = Number(arg) as 2 | 4;
      const ids = kind === 2 ? ui.tray2 : ui.tray4;
      if (!ids.length) toast('Khay trống — kéo món ở quầy vào khay trước.');
      else {
        ui.trayPick = ui.trayPick === kind ? null : kind;
        ui.serving = null;
        if (ui.trayPick) sound.play('pop');
      }
    }
    else if (action === 'rename') {
      const name = window.prompt('Đặt tên cho quán (tối đa 24 ký tự):', game.state.profile.name);
      if (name != null && run({ type: 'profile/rename', name })) toast(`🏮 Biển hiệu mới: ${game.state.profile.name}`, 'good');
    } else if (action === 'photo') {
      ui.photo = arg !== 'close';
      if (ui.photo) Object.assign(ui, { drawer: null, settings: false, passOpen: false, editLayout: false });
      root.classList.toggle('photo-mode', ui.photo);
    } else if (action === 'snap') {
      takePhoto();
      return;
    } else if (action === 'editSel') ui.editSelected = arg || null;
    else if (action === 'tray') addToTray(Number(arg), trayFor(game, Number(arg)));
    else if (action === 'trayOut') [ui.tray2, ui.tray4] = [ui.tray2.filter((id) => id !== Number(arg)), ui.tray4.filter((id) => id !== Number(arg))];
    else if (action === 'trayClear') {
      if (arg === '2') ui.tray2 = [];
      else ui.tray4 = [];
      if (ui.trayPick === Number(arg)) ui.trayPick = null;
    }
    else if (action === 'quest') ui.questOpen = arg !== 'close';
    else if (action === 'meal') {
      ui.mealOpen = arg !== 'close';
      if (arg !== 'close') ui.mealStall = null;
    } else if (action === 'mealWho') ui.mealWho = arg || null;
    else if (action === 'mealStall') ui.mealStall = arg || null;
    else if (action === 'buy') ui.buyItem = arg === 'close' ? null : arg;
    else if (action === 'noop') return;
    else if (action === 'music') sound.setMusic(!sound.prefs.music);
    else if (action === 'sfx') sound.setSfx(!sound.prefs.sfx);
    else if (action === 'slot') ui.selectedSlot = ui.selectedSlot === arg ? null : arg;
    else if (action === 'stall') ui.selectedStall = arg || null;
    else if (action === 'edit') {
      const on = !ui.editLayout;
      setArea('restaurant');
      ui.editLayout = on;
      ui.editSelected = null;
      if (on) ui.drawer = null;
    } else if (action === 'fullscreen') {
      // Khoá xoay ngang chỉ được trình duyệt cho phép khi đang toàn màn hình (Android); iOS thì người chơi tự xoay máy.
      const lock = () => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {});
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.().then(lock).catch(() => {});
    }
    else if (action === 'home') {
      // Về màn hình mở đầu: lưu rồi tải lại trang (màn mở đầu có Chơi tiếp / Ván mới)
      save();
      location.href = location.pathname;
      return;
    }
    renderDom();
  });
  window.addEventListener('pagehide', save);
  // Phím tắt: Esc đóng Cài đặt, Space tạm dừng / chạy tiếp
  let resumeSpeed = 1;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.mealOpen) ui.mealOpen = false;
    else if (e.key === 'Escape' && ui.buyItem) ui.buyItem = null;
    else if (e.key === 'Escape' && ui.questOpen) ui.questOpen = false;
    else if (e.key === 'Escape' && ui.photo) {
      ui.photo = false;
      root.classList.remove('photo-mode');
    } else if (e.key === 'Escape' && ui.settings) ui.settings = false;
    else if (e.key === 'Escape' && (ui.serving != null || ui.trayPick)) [ui.serving, ui.trayPick] = [null, null];
    else if (e.key === 'Escape' && ui.passOpen) ui.passOpen = false;
    else if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
      e.preventDefault();
      if (ui.speed > 0) [resumeSpeed, ui.speed] = [ui.speed, 0];
      else ui.speed = resumeSpeed;
    } else return;
    renderDom();
  });

  // ---------- Vòng lặp chính ----------
  let last = performance.now();
  let domTimer = 0;
  let saveTimer = 0;
  const frame = (now: number) => {
    // Giới hạn dt: tab bị ẩn thì game tạm dừng thay vì tua một mạch.
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    // Mở bảng Cài đặt thì game tạm dừng; đóng lại chạy tiếp ở tốc độ đã chọn
    const speed = ui.settings ? 0 : ui.speed;
    game.tick(dt * speed * content.balance.minutesPerSecond);
    stage.env.selectedSlot = ui.selectedSlot;
    stage.env.editLayout = ui.editLayout;
    stage.env.serving = ui.serving;
    stage.env.editSelected = ui.editSelected;
    stage.render(dt, speed);
    sound.setRain(ui.area === 'restaurant' ? stage.env.rain * 0.4 : stage.env.rain);

    // Tiền: số trên HUD chạy dần tới giá trị thật, có chữ +/- nổi lên khi đổi
    const shown = money.step(game.state.money, dt);
    const el = moneyEl();
    if (el && el.textContent !== coins(shown)) el.textContent = coins(shown);
    const diff = Math.round(game.state.money - lastMoney);
    if (diff !== 0) {
      lastMoney = game.state.money;
      floatText(fx, diff > 0 ? `+${diff}` : `${diff}`, el, diff > 0 ? 'good' : 'bad');
      if (diff > 0) bump(el, 0.4);
    }
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
  // window.stage: tự vẽ khung hình (stage.render(dt, 1)) khi preview bị bóp requestAnimationFrame.
  if (import.meta.env.DEV) Object.assign(window as unknown as { game: Game; stage: Stage }, { game, stage });
}

/** Save hợp lệ của phiên bản hiện tại, hoặc null (chưa có / hỏng / từ bản cũ trước khi có phong cách quán). */
export function loadSave(content: Content): ReturnType<typeof deserialize> {
  return deserialize(readSave(), content);
}

function readSave(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}
