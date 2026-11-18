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
import { hudHtml, serviceAlerts, serviceHtml, settingsHtml, SPEEDS } from './hud';
import { isReserved, needOf } from '../sim/systems/service';
import { bump, Counter, floatText, flyIcon, fxLayer } from './juice';
import { panels, type UiState } from './panels';
import { FarmArea } from './three/areas/farm';
import { GreenhouseArea } from './three/areas/greenhouse';
import { MarketArea } from './three/areas/market';
import { RestaurantArea } from './three/areas/restaurant';
import { Stage, type Area, type Pick } from './three/stage';

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
    <div id="settings"></div>
    <div id="service"></div>
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
  const farm = new FarmArea(game);
  const greenhouse = new GreenhouseArea(game);
  // Nhà kính nằm bên trái nông trại trên thanh chuyển khu (vào được cả bằng cách bấm nhà kính ở nông trại)
  const areas: Area[] = [greenhouse, farm, restaurant, new MarketArea(game)];
  const stage = new Stage($('scene') as HTMLCanvasElement, game, areas);
  const ui: UiState = {
    area: areas.find((a) => a.id === params.get('area'))?.id ?? 'restaurant',
    drawer: panels.find((p) => p.id === params.get('tab'))?.id ?? null,
    speed: params.has('speed') && SPEEDS.includes(Number(params.get('speed'))) ? Number(params.get('speed')) : 1,
    selectedSlot: null,
    selectedStall: null,
    editLayout: import.meta.env.DEV && params.has('edit'),
    settings: false,
    passOpen: false,
    serving: null,
    // Chỉ bản dev: ?focus=pen mở bảng Nông trại chỉ với một loại ô / cối (để xem giao diện)
    farmFocus: import.meta.env.DEV ? params.get('focus') : null,
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
  game.bus.on('party/left', (e) => e.reason !== 'paid' && ui.area === 'restaurant' && sound.play('sad'));
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
  let lastDrawer: string | null = null;
  const renderDom = () => {
    const { state } = game;
    // Đóng bảng Nông trại (hoặc chuyển bảng khác) thì camera lướt về góc nhìn cả nông trại
    if (lastDrawer === 'farm' && ui.drawer !== 'farm' && (ui.area === 'farm' || ui.area === 'greenhouse')) {
      stage.unfocus();
      ui.farmFocus = null;
      ui.selectedSlot = null;
    }
    lastDrawer = ui.drawer;

    morph($('hud'), hudHtml(game, ui, money.value));
    morph($('settings'), settingsHtml(ui, sound.prefs));
    // Món đã chọn không còn ở quầy (khách bỏ về...) thì bỏ chọn
    if (ui.serving != null) {
      const o = state.restaurant.orders.find((x) => x.id === ui.serving);
      if (!o || o.status !== 'ready' || isReserved(game.ctx, o.id)) ui.serving = null;
    }
    morph($('service'), ui.area === 'restaurant' && !ui.editLayout ? serviceHtml(game, ui) : '');

    // Thanh chế độ sắp xếp bàn + nút chuyển khu hai bên
    const index = areas.findIndex((a) => a.id === ui.area);
    const prev = areas[index - 1];
    const next = areas[index + 1];
    morph(
      $('areabar'),
      ui.editLayout
        ? `<b data-key="edit">🪑 Đang sắp xếp bàn ghế</b><span>Kéo bàn tới chỗ mới. Bàn đang có khách và quầy trước bếp không dời được.</span>
           <div class="btns"><button class="mini"${cmd({ type: 'layout/reset' })}>↺ Về mặc định</button><button class="mini on"${uiAttr('edit')}>✔ Xong</button></div>`
        : '', // ngoài chế độ sắp xếp bàn thì không hiện gì (hướng dẫn nằm trong bảng Cài đặt)
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
    ui.farmFocus = null;
    ui.editLayout = false;
    stage.setArea(id);
    $('scene').animate([{ opacity: 0.15 }, { opacity: 1 }], { duration: 380, easing: 'ease-out' });
  };

  // Bấm vào vật thể trong cảnh 3D
  stage.onPick = (pick: Pick) => {
    if (pick.type === 'slot') {
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
    } else if (pick.type === 'stall') {
      ui.selectedStall = pick.id;
      ui.drawer = 'market';
    } else if (pick.type === 'pass') {
      ui.passOpen = !ui.passOpen;
      ui.serving = null;
      if (ui.passOpen) ui.drawer = null;
    } else if (pick.type === 'party') {
      servePartyAt(Number(pick.id));
    } else if (pick.type === 'table' && !ui.editLayout) {
      // Bấm vào bàn = bấm vào nhóm khách ở bàn đó (quầy ghế đơn có nhiều nhóm: ưu tiên nhóm hợp việc đang làm)
      const here = game.state.restaurant.parties.filter((p) => p.tableId === pick.id);
      const want = ui.serving != null ? here.find((p) => p.phase === 'waitingFood') : here.find((p) => needOf(p));
      const party = want ?? here[0];
      if (party) servePartyAt(party.id);
    }
    renderDom();
  };

  /** Người chơi bấm vào một nhóm khách: giao món đang cầm, hoặc mang menu / ghi món nếu họ đang cần. */
  const servePartyAt = (partyId: number) => {
    const party = game.state.restaurant.parties.find((p) => p.id === partyId);
    if (!party) return;
    if (ui.serving != null) {
      if (run({ type: 'service/deliver', orderId: ui.serving, partyId })) ui.serving = null;
      return;
    }
    const need = needOf(party);
    if (need === 'menu') run({ type: 'service/menu', partyId });
    else if (need === 'order') run({ type: 'service/takeOrder', partyId });
    else if (party.phase === 'waitingFood' && !ui.passOpen) toast('Món nấu xong sẽ ra quầy 🔔 — bấm quầy để lấy món.');
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
      if (ui.drawer === 'farm') ui.farmFocus = null; // mở từ nút: xem cả nông trại
    } else if (action === 'farmFocus') ui.farmFocus = arg || null;
    else if (action === 'speed') ui.speed = Number(arg);
    else if (action === 'settings') ui.settings = arg === 'close' ? false : !ui.settings;
    else if (action === 'pass') ui.passOpen = arg === 'close' ? false : !ui.passOpen;
    else if (action === 'serve') {
      ui.serving = arg ? Number(arg) : null;
      ui.passOpen = false;
      if (arg) sound.play('pop');
    }
    else if (action === 'music') sound.setMusic(!sound.prefs.music);
    else if (action === 'sfx') sound.setSfx(!sound.prefs.sfx);
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
    if (e.key === 'Escape' && ui.settings) ui.settings = false;
    else if (e.key === 'Escape' && (ui.serving != null || ui.passOpen)) [ui.serving, ui.passOpen] = [null, false];
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
