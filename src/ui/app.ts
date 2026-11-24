import { achievements } from '../data/achievements';
import { farmTools } from '../data/farmhands';
import type * as THREE from 'three';
import { bribeOf, defOf, policePending, seizableTable } from '../sim/systems/events';
import { addItem, canAfford } from '../sim/helpers';
import { clockText } from './format';
import { guideHtml } from './tutorial';
import { coachHtml } from './coach';
import { billDue } from '../sim/systems/crew';
import { tutorialJump } from '../sim/systems/tutorial';
import { seedTakeoutDemo } from '../sim/systems/takeout';
import { cleanOwner, ownerName, type GameState, type OwnerProfile, type TutorialStep } from '../sim/state';
import { inShift } from '../sim/systems/customers';
import { festivals, seasons } from '../data/calendar';
import { calendarOf } from '../sim/calendar';
import { createContent, decorFor, recipesFor, type Content, type CuisineId, type MillType } from '../data';
import { Game } from '../sim/game';
import { deserialize, readSnapshot, serialize } from '../sim/save';
import { addFriend, deleteMe, friendSnapshot, inviteLink, listFriends, onlineEnabled, pushSnapshot, qrSvg, removeFriend, setSharing, signIn, takeInvite, usedBefore } from './online';
import { friendsHtml, newFriendsView } from './friends';
import { needsWatering } from '../sim/systems/farm';
import { buildingRect, queuedKinds, slotCenter, slotCenterAt } from '../sim/systems/farmer';
import { millCenter, millCenterAt } from '../sim/systems/mills';
import type { Command } from '../sim/types';
import { cmd, esc, morph, ui as uiAttr } from './dom';
import { coins } from './format';
import { Sound } from './audio';
import { calendarHtml } from './calendar';
import { billHtml, buyHtml, lowStock, mealHtml, moneyText, periodSummaryHtml, renameHtml, tomorrowFestivalHtml, OFF_BAR, hudHtml, questHtml, serviceAlerts, serviceHtml, settingsHtml, SPEEDS } from './hud';
import { memberOf, reviveCostOf } from '../sim/systems/crew';
import { farmerBlocked } from '../sim/systems/farmer';
import { autoServeCommands, needOf } from '../sim/systems/service';
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
import { crayonEnabled, setCrayon } from './three/crayon';

/** Số lần vẽ lại DOM mỗi giây (cảnh 3D vẫn vẽ mỗi khung hình). */
const DOM_FPS = 8;
const AUTOSAVE_SECONDS = 10;

/**
 * Ghép sim + cảnh 3D + panel lại và chạy vòng lặp chính. Đây là nơi duy nhất biết tới cả ba.
 * opts.cuisine có giá trị = Ván mới với phong cách quán đó (ghi đè save cũ); không có = chơi tiếp từ save.
 * Màn hình mở đầu (title.ts) gọi hàm này sau khi người chơi chọn.
 */
export function startApp(root: HTMLElement, opts: { cuisine?: CuisineId; owner?: OwnerProfile; shopName?: string; content?: Content; preview?: CuisineId } = {}): void {
  const content = opts.content ?? createContent();

  // Tham số URL để thử nhanh: ?fresh (bỏ qua save, không ghi save) · ?seed=7 · ?ff=300 (tua 300 phút game)
  // · ?area=farm · ?tab=menu (mở sẵn ngăn kéo) · ?speed=4
  const params = new URLSearchParams(location.search);
  // Xem trước quán (màn chọn quán): ván tạm, không đọc / ghi save, không có ngày hướng dẫn
  const preview = opts.preview ?? null;
  // F1 · Thăm quán (?visit): bản chụp quán của bạn bè (tải từ máy chủ, cất trong sessionStorage) — chỉ xem, không lưu.
  // Ván của mình đã lưu trước khi sang đây nên giờ của mình đứng yên; về lại thì chạy tiếp.
  const visit = params.has('visit') ? (import.meta.env.DEV && content.cuisines.has(params.get('visit') ?? '') ? demoVisit(content, params.get('visit') as CuisineId) : readVisit(content)) : null;
  const fresh = params.has('fresh') || !!preview || !!visit;
  const saved = visit ?? (fresh || opts.cuisine ? null : loadSave(content));
  // ?cuisine=jp|kr|vn (kèm ?fresh) để thử nhanh một quán mà không qua màn hình mở đầu
  const paramCuisine = params.get('cuisine');
  const cuisine = opts.cuisine ?? preview ?? (paramCuisine && content.cuisines.has(paramCuisine) ? (paramCuisine as CuisineId) : 'vn');
  // Ván mới từ màn mở đầu: ngày 1 là ngày hướng dẫn (ván tạm ?fresh thì chỉ khi có ?tutorial)
  const tutorial = !preview && !visit && (!!opts.cuisine || params.has('tutorial'));
  const game = new Game(content, saved ? { state: saved } : { seed: params.has('seed') ? Number(params.get('seed')) : preview ? 11 : undefined, cuisine, tutorial, owner: opts.owner ?? paramOwner(params) });
  // Ván mới: tên quán người chơi đặt ở bước chọn quán (trống / sai thì giữ tên mặc định)
  if (!saved && opts.shopName) game.dispatch({ type: 'profile/rename', name: opts.shopName });
  // Giờ trong ngày theo người đi thăm (?at=phút) — chỉ để vẽ trời / đèn; mùa / năm giữ theo bản chụp của chủ quán
  const visitAt = visit ? Number(params.get('at')) : NaN;
  if (visit) prepareVisit(game);
  if (import.meta.env.DEV && !visit) {
    // ?tut=market — nhảy tới một bước của ngày hướng dẫn (intro / serve / hard / market / cook / farm / morning / lunch / done)
    const tut = params.get('tut');
    if (tut) tutorialJump(game.ctx, tut as TutorialStep);
    // Chỉ ở bản dev: ?rich (nhiều tiền + cấp 9) · ?do=[{"type":"farm/plant",...}] chạy sẵn một chuỗi lệnh
    // · ?weather=rain ép thời tiết · ?edit mở sẵn chế độ sắp xếp bàn
    if (params.has('rich')) Object.assign(game.state, { money: 99999, level: 9 });
    // ?max: quán "tối thượng" — mua / nâng / thuê hết mọi thứ (xem maxOut)
    if (params.has('max')) maxOut(game);
    // ?tier=3: quán vừa lên hạng đó (đủ cấp, bếp nâng theo cấp, thuê đủ người) — xem tierUp
    if (Number(params.get('tier')) > 0) tierUp(game, Number(params.get('tier')));
    // ?day=85 nhảy tới ngày đó trong lịch (xem mùa: 1 Xuân, 29 Hạ, 57 Thu, 85 Đông)
    if (Number(params.get('day')) > 0) game.state.clock.day = Math.floor(Number(params.get('day')));
    // ?event=critic ép sự kiện xảy ra ngay khi quán mở (critic / inspector / tour_bus / outage / big_tippers)
    const ev = params.get('event');
    if (ev) game.state.event = { id: ev, at: 0, status: 'scheduled', minutesLeft: defOf(ev).duration ?? 0, partyId: null, result: null };
    for (const command of JSON.parse(params.get('do') ?? '[]') as Command[]) game.dispatch(command);
    // ?takeout: có khách gọi đặt món giao tận nơi ngay khi quán mở cửa (quán phải đủ hạng — kèm ?do nâng hạng)
    // ?takeout=demo: dựng sẵn tình huống (1 đơn món đã ở quầy line, 1 đơn đã đóng gói, thuê sẵn 1 shipper) để thử nhanh
    if (params.get('takeout') === 'demo') seedTakeoutDemo(game.ctx);
    else if (params.has('takeout')) game.state.takeout.nextCall = 1;
    const weather = params.get('weather');
    if (weather && content.weathers.has(weather)) game.state.weather = { id: weather, minutesLeft: 100000 };
  }
  if (import.meta.env.DEV && params.has('ffserve')) {
    // Chỉ bản dev: ?ff=200&ffserve tua từng phút, tự mang menu + ghi món (không bưng) để xem bong bóng màu bàn và món trên quầy;
    // thêm &pickup thì bồi bàn ra quầy lấy món luôn
    for (let m = 0; m < (Number(params.get('ff')) || 0); m++) {
      for (const p of game.state.restaurant.parties) {
        const need = needOf(p);
        if (need === 'menu') game.dispatch({ type: 'service/menu', partyId: p.id });
        else if (need === 'order') game.dispatch({ type: 'service/takeOrder', partyId: p.id });
      }
      game.tick(1);
    }
    if (params.has('pickup') && game.dispatch({ type: 'service/pickup' }).ok) for (let i = 0; i < 30 && game.state.restaurant.waiter.tasks.length; i++) game.tick(0.5);
  } else if (import.meta.env.DEV && params.has('autopay')) {
    // Chỉ bản dev: ?ff=780&autopay tua tới tối mà không bị bảng gọi món / hoá đơn của đội che (tự chọn món, tự trả tiền)
    for (let m = 0; m < (Number(params.get('ff')) || 0); m++) {
      if (game.state.crew.pending.length) game.dispatch({ type: 'crew/autoOrder' });
      game.tick(1);
      if (billDue(game.ctx)) game.dispatch({ type: 'crew/pay' });
    }
  } else if (preview || visit) {
    // Xem trước / thăm quán (F2): tua tới giữa ca sáng, bồi bàn tự phục vụ để quán có khách đang ngồi ăn
    for (let m = 0; m < 110; m++) {
      previewAuto(game);
      game.tick(1);
    }
  } else game.tick(Number(params.get('ff')) || 0);

  root.innerHTML = `
    <section id="stage">
      <canvas id="scene"></canvas>
      <header id="hud"></header>
      <div id="areabar"></div>
      <nav id="tools"></nav>
    </section>
    <aside id="drawer"></aside>
    <div id="modal"></div>
    <div id="questdlg"></div>
    <div id="bill"></div>
    <div id="meal"></div>
    <div id="coach"></div>
    <div id="settings"></div>
    <div id="calendar"></div>
    <div id="bankrupt"></div>
    <div id="rename"></div>
    <div id="friends"></div>
    <div id="service"></div>
    <div id="buy"></div>
    <div id="guide"></div>
    <div id="toasts"></div>
    <div id="toasts-left"></div>
    ${preview ? previewBarHtml(content, preview) : ''}
    ${visit ? visitBarHtml(game.state) : ''}
    <div id="photobar"><button class="primary" data-ui="snap">📸 Chụp ảnh quán</button><button data-ui="photo:close">✕ Thoát</button></div>
    <div id="rotate">
      <div class="big">📱↻</div>
      <b>Xoay ngang thiết bị để chơi</b>
      <span>Màn hình ngang hiển thị được nhiều hơn.</span>
      <button class="primary" data-ui="fullscreen">Toàn màn hình + xoay ngang</button>
    </div>`;
  root.classList.toggle('previewing', !!preview);
  root.classList.toggle('visiting', !!visit);
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
  if (visit) stage.clockMinute = Number.isFinite(visitAt) && visitAt >= 0 && visitAt < 24 * 60 ? visitAt : 10 * 60;
  const ui: UiState = {
    area: areas.find((a) => a.id === params.get('area'))?.id ?? 'restaurant',
    drawer: panels.find((p) => p.id === params.get('tab'))?.id ?? null,
    speed: params.has('speed') && SPEEDS.includes(Number(params.get('speed'))) ? Number(params.get('speed')) : 1,
    // Chỉ bản dev: ?slot=field-0 (kèm ?focus=field&tab=farm) chọn sẵn một ô như vừa bấm ô đó trên cảnh
    selectedSlot: import.meta.env.DEV ? params.get('slot') : null,
    selectedStall: null,
    editLayout: import.meta.env.DEV && params.has('edit'),
    settings: import.meta.env.DEV && params.has('settings'), // ?settings: mở sẵn bảng Cài đặt (chỉ bản dev)
    // Chỉ bản dev: ?focus=pen mở bảng Nông trại chỉ với một loại ô / cối (để xem giao diện)
    farmFocus: import.meta.env.DEV ? params.get('focus') : null,
    editSelected: null,
    photo: false,
    questOpen: false,
    mealOpen: import.meta.env.DEV && params.has('meal'), // ?meal: mở sẵn bảng gọi món cho đội (chỉ bản dev)
    mealWho: null,
    mealStall: null,
    stallView: null,
    buyItem: null,
    guide: null,
    calendar: import.meta.env.DEV && params.has('cal') ? 0 : null, // ?cal: mở sẵn cuốn lịch (chỉ bản dev)
    rename: import.meta.env.DEV && params.has('rename') ? game.state.profile.name : null, // ?rename: mở sẵn hộp đổi tên quán (chỉ bản dev)
    renameKind: 'shop',
  };
  // Chỉ bản dev: ?stall=seafood mở thẳng bên trong một quầy chợ (sạp nguyên liệu / Tiệm 25caaaaa)
  const devStall = import.meta.env.DEV ? params.get('stall') : null;
  if (devStall && content.stalls.has(devStall)) {
    stall.show(devStall);
    ui.stallView = devStall;
    ui.area = 'stall';
  }
  stage.setArea(ui.area);

  /** Thông báo nổi; `pic` = HTML ảnh nhỏ đứng trước chữ (chân dung khách quen). */
  const toast = (text: string, kind = '', pic = '', ms = 2600) => {
    const el = document.createElement('div');
    el.className = `toast ${kind}${pic ? ' with-pic' : ''}`;
    el.innerHTML = pic + `<span>${esc(text)}</span>`;
    // Khách quen ghé / về: góc trái dưới thẻ nhiệm vụ (bên phải đã có đồng hồ + cột nút)
    $(kind.includes('regular') ? 'toasts-left' : 'toasts').appendChild(el);
    setTimeout(() => el.remove(), ms);
  };
  /**
   * Thông báo khách quen: mỗi lần chỉ hiện MỘT cái (~2 s), nhiều khách cùng lúc thì xếp hàng hiện lần lượt.
   * Canh mép phải theo thẻ nhiệm vụ (không sát lề trái — tai thỏ / Dynamic Island trên iPhone che mất).
   */
  const regularQueue: { text: string; kind: string; pic: string }[] = [];
  let regularBusy = false;
  const pumpRegular = () => {
    if (regularBusy) return;
    const item = regularQueue.shift();
    if (!item) return;
    regularBusy = true;
    const box = $('toasts-left');
    const quest = root.querySelector<HTMLElement>('.hud-top > .quest');
    const r = quest?.getBoundingClientRect();
    if (r && r.width > 0) {
      box.classList.add('anchored');
      box.style.left = `${Math.round(r.right)}px`;
      box.style.top = `${Math.round(r.bottom + 6)}px`;
      box.style.maxWidth = `${Math.round(r.width)}px`;
    } else {
      box.classList.remove('anchored');
      box.style.left = box.style.top = box.style.maxWidth = '';
    }
    toast(item.text, item.kind, item.pic, 2000);
    setTimeout(() => {
      regularBusy = false;
      pumpRegular();
    }, 2150);
  };
  const regularToast = (text: string, kind: string, pic: string) => {
    regularQueue.push({ text, kind, pic });
    if (regularQueue.length > 4) regularQueue.shift(); // dồn quá nhiều thì bỏ bớt cái cũ
    pumpRegular();
  };

  /** Đang rời trang sang chế độ thăm quán: đã lưu rồi, không ghi lại lúc pagehide. */
  let leaving = false;
  const save = () => {
    if (fresh || leaving) return;
    try {
      localStorage.setItem(SAVE_KEY, serialize(game.state));
    } catch {
      /* trình duyệt chặn lưu trữ: bỏ qua, game vẫn chơi được */
    }
  };

  // ---------- Âm thanh ----------
  const sound = new Sound();
  if (visit) sound.play = () => {}; // thăm quán: hoạt cảnh của quán bạn không phát chuông / tiếng thông báo
  // Trình duyệt chỉ cho phát tiếng sau thao tác đầu tiên
  // pointerdown chưa đủ để iOS cho phát tiếng (cần touchend / click): nghe cả mấy loại thao tác
  for (const type of ['pointerdown', 'touchend', 'click', 'keydown'] as const) root.addEventListener(type, () => sound.unlock(), { capture: true });
  window.addEventListener('keydown', () => sound.unlock());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && sound.unlock());

  let pauseHintAt = -1e9;
  const run = (command: Command) => {
    if (visit) return false; // đang thăm quán người khác: chỉ xem, không làm gì được
    const result = game.dispatch(command);
    // Mua / đổi một món thì thôi xem trước loại đó (các loại khác vẫn xem tiếp để phối màu)
    if (result.ok && (command.type === 'decor/buy' || command.type === 'decor/equip') && ui.decorPreview) {
      const slot = content.decor.get(command.decorId).slot;
      const { [slot]: _drop, ...rest } = ui.decorPreview;
      ui.decorPreview = Object.keys(rest).length ? rest : null;
    }
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
  const moneyNum = () => $('hud').querySelector('[data-key="money"] .num');
  const storeEl = () => $('tools').querySelector('[data-ui="drawer:inventory"]');

  restaurant.onPaid = (world, amount) => {
    if (ui.area !== 'restaurant') return;
    const from = stage.toScreen(world);
    const n = Math.max(1, Math.min(5, Math.round(amount / 25)));
    for (let i = 0; i < n; i++) flyIcon(fx, '', from, moneyEl(), {
        cls: 'coin',
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
  game.bus.on('achievement/reached', (e) => {
    const a = achievements.find((x) => x.id === e.id);
    if (a) toast(`${a.icon} Thành tựu mới: "${a.name}" — mở 🏆 Thành tựu để nhận thưởng`);
    sound.play('ripe');
  });
  game.bus.on('achievement/claimed', () => {
    sound.play('coin');
    bump(moneyEl(), 0.6);
  });
  game.bus.on('tool/bought', (e) => {
    const t = farmTools.find((x) => x.id === e.toolId);
    if (t) toast(`${t.icon} Đã sắm ${t.name}`);
  });
  game.bus.on('day/ended', () => sound.play('dayEnd'));
  game.bus.on('crew/fainted', (e) => {
    const m = memberOf(game.ctx, e.who);
    toast(`😵 ${m?.name ?? 'Nhân viên'} kiệt sức xỉu rồi! Bồi dưỡng ${reviveCostOf(game.ctx)} xu ở bảng Nhân viên, hoặc đợi giờ nghỉ ra chợ ăn.`, 'bad', '', 4200);
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
  // Mùa vụ, lễ hội
  game.bus.on('festival/started', (e) => {
    const f = festivals.find((x) => x.id === e.id);
    if (!f) return;
    toast(`${f.icon} Hôm nay là ${f.name}! ${f.desc}${e.gift ? ` Nhận ${e.gift} xu tiền mừng.` : ''}`, 'good', '', 5200);
    sound.play('levelup');
  });
  game.bus.on('farm/culled', (e) => toast(`🐔 Sang mùa Đông: ${e.count} chuồng gà mái / bò sữa đã hết lứa của năm. Mùa Xuân nuôi lứa mới nhé.`, 'bad', '', 5200));
  game.bus.on('farm/withered', (e) => toast(`🥀 Sang mùa mới: ${e.count} ô rau / lúa trái mùa ngoài trời đã héo. Xem bảng Nông trại để gieo giống hợp mùa.`, 'bad', '', 5200));
  game.bus.on('farm/storm', (e) => toast(`🌀 Bão quét qua nông trại: ${e.damaged} ô rau / lúa bị dập, chậm lớn hơn.`, 'bad', '', 4200));
  game.bus.on('day/started', () => {
    const cal = calendarOf(game.state.clock.day);
    if (cal.dayOfSeason !== 1 || game.state.clock.day <= 1) return;
    const s = seasons[cal.season];
    toast(`${s.icon} Bắt đầu mùa ${s.name}${s.frozen ? ' — ngoài trời đóng băng, chỉ nhà kính trồng được.' : '. Rau củ hợp mùa ở chợ rẻ hơn, món hợp mùa bán được giá.'}`, 'good', '', 4800);
  });
  // Món đang bán sắp hết nguyên liệu: báo một lần mỗi khi món tụt xuống dưới ngưỡng (trong giờ mở cửa)
  let lowShown = new Set<string>();
  const checkLowStock = () => {
    const low = lowStock(game);
    const ids = new Set(low.map((l) => l.recipe.id));
    if (game.state.clock.phase === 'open' && inShift(game.ctx)) {
      const fresh = low.filter((l) => !lowShown.has(l.recipe.id));
      // Không bật thông báo nổi nữa: dải cảnh báo dưới hàng tiền / sao gộp sẵn món hết + sắp hết; chỉ nảy nhẹ để để ý
      if (fresh.length) {
        const chip = root.querySelector<HTMLElement>('.stock-warn');
        if (chip) bump(chip, 0.4);
      }
    }
    lowShown = ids;
  };
  game.bus.on('order/ready', checkLowStock);
  game.bus.on('shift/started', checkLowStock);
  // Đơn đặt hàng + sự kiện ngẫu nhiên
  game.bus.on('helper/sick', (e) => {
    toast(`🤒 ${e.name} bị bệnh, xin nghỉ hôm nay. Quán bớt một người phục vụ.`, 'bad', undefined, 5000);
  });
  // Đơn giao tận nơi (giai đoạn 18)
  game.bus.on('takeout/call', (e) => {
    const t = game.state.takeout.orders.find((x) => x.id === e.id);
    toast(`☎️ ${t?.client ?? 'Khách'} gọi đặt món giao tận nơi — bấm quầy cashier để nhận đơn.`, 'good', '', 4600);
    sound.play('bell');
  });
  game.bus.on('takeout/missed', (e) => {
    const t = game.state.takeout.orders.find((x) => x.id === e.id);
    toast(`📵 ${t?.client ?? 'Khách'} chờ lâu quá nên cúp máy rồi.`, 'bad');
  });
  game.bus.on('takeout/packed', () => {
    toast('🛍️ Đơn giao tận nơi đã đóng gói xong, chờ shipper chở đi.', 'good');
    sound.play('pop');
  });
  game.bus.on('takeout/shipped', (e) => {
    const name = e.who === 'shipper' ? 'Anh shipper' : (game.state.restaurant.couriers.find((c) => c.id === e.who)?.name ?? 'Shipper');
    toast(`🛵 ${name} chở đơn đi giao, về khoảng ${clockText(Math.ceil(e.until / 10) * 10)}.`);
  });
  game.bus.on('takeout/done', (e) => {
    const t = game.state.takeout.orders.find((x) => x.id === e.id);
    toast(e.late ? `⏰ Giao trễ hẹn cho ${t?.client ?? 'khách'}: chỉ nhận +${e.money} xu.` : `🛵 Giao đúng hẹn cho ${t?.client ?? 'khách'}: +${e.money} xu, tip +${e.tip}.`, e.late ? 'bad' : 'good');
    sound.play('coin');
    bump(moneyEl(), 0.6);
  });
  game.bus.on('shipper/left', (e) => {
    toast(`🛵 Anh shipper chạy đi giao, về khoảng ${clockText(Math.ceil(e.until / 10) * 10)}.`);
  });
  game.bus.on('contract/done', (e) => {
    const c = game.state.contracts.find((x) => x.id === e.id);
    toast(`📋 Đã giao đơn cho ${c?.client ?? 'khách'}: +${e.reward} xu`, 'good');
    sound.play('coin');
    bump(moneyEl(), 0.6);
  });
  game.bus.on('day/started', () => {
    const n = game.state.contracts.length;
    if (n) setTimeout(() => toast(`📋 Có ${n} đơn đặt hàng mới — xem bảng Đơn hàng.`, '', '', 3600), 1600);
  });
  game.bus.on('event/announced', (e) => {
    const def = defOf(e.id);
    if (def.announce) setTimeout(() => toast(`${def.icon} ${def.announce!.replace('{time}', clockText(e.at))}`, '', '', 5200), 3200);
  });
  game.bus.on('event/started', (e) => {
    const def = defOf(e.id);
    toast(`${def.icon} ${def.start}`, def.id === 'outage' || def.id === 'police' ? 'bad' : 'good', '', 4800);
    sound.play('bell');
  });
  game.bus.on('event/ended', (e) => {
    const def = defOf(e.id);
    let text = `${def.icon} ${def.name} đã kết thúc.`;
    if (def.kind === 'critic') text = e.result === 'good' ? `🧐 Nhà phê bình khen nức nở! Uy tín +${def.reward?.rep}, thưởng ${e.money} xu.` : `🧐 Nhà phê bình không hài lòng — uy tín −${def.penalty?.rep}.`;
    else if (def.kind === 'police') text = e.money < 0 ? `👮 Đã "bồi dưỡng" ${-e.money} xu, công an khu vực cho qua.` : e.table ? `👮 Công an khu vực thu mất ${e.table}. Uy tín giảm nhẹ.` : '👮 Công an khu vực nhắc nhở rồi đi — lần sau nhớ dọn gọn lề đường.';
    else if (def.kind === 'inspector') text = e.result === 'good' ? `🕵️ Thanh tra khen quán sạch sẽ! Thưởng ${e.money} xu.` : `🕵️ Thanh tra phạt ${-e.money} xu vì ${e.mess} chỗ bẩn (vết bẩn, bàn chưa dọn).`;
    toast(text, e.result === 'bad' ? 'bad' : 'good', '', 5200);
    sound.play(e.result === 'bad' ? 'sad' : e.result === 'good' ? 'levelup' : 'pop');
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
    regularToast(`${def.name} ghé quán — "${def.greet}"`, 'regular', portraitHtml(def, 'toast-pic'));
    if (ui.area === 'restaurant') sound.play('bell');
  });
  game.bus.on('regular/visited', (e) => {
    const def = content.regulars.get(e.regularId);
    const max = content.balance.regulars.heartVisits.length;
    const parts = [e.fav ? `${def.name} khen món ruột ngon tuyệt!` : `${def.name} ăn ngon miệng.`];
    if (e.heartUp) parts.push(`Thân thiết lên ${'♥'.repeat(e.hearts)}${'♡'.repeat(max - e.hearts)}`);
    regularToast(parts.join(' '), 'regular good', portraitHtml(def, 'toast-pic'));
    if (e.gift) {
      const gift = content.props.get(e.gift);
      setTimeout(() => toast(`🎁 ${def.name} tặng quán "${gift.name}" — quà đã được chuyển vào kho.`, 'good', portraitHtml(def, 'toast-pic'), 5000), 900);
    }
    if (e.heartUp || e.gift) sound.play('levelup');
  });
  // Quán lên hạng: phòng to hơn nên dựng lại cả khu quán
  const rebuildRestaurant = () => {
    const next = new RestaurantArea(game);
    next.onPaid = restaurant.onPaid;
    restaurant.dispose();
    stage.replaceArea(restaurant, next);
    restaurant = next;
  };
  // Xem trước: chỉ chiếu lại một đoạn ~1,5 giờ của ca sáng (08:50 → 10:20) rồi tua về đầu — không bao giờ tới giờ đội ra chợ / gọi món
  // Thăm quán (F2) cũng chiếu lại như vậy: quán bạn có khách ra vào, nhân viên đi lại — chỉ là hoạt cảnh, không lưu
  const previewLoop = preview || visit ? { snap: structuredClone(game.state), from: game.state.clock.minute } : null;
  const rewindPreview = () => {
    if (!previewLoop) return;
    const s = game.state as unknown as Record<string, unknown>;
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, structuredClone(previewLoop.snap));
    rebuildRestaurant();
    const fade = root.querySelector<HTMLElement>('#preview-fade');
    fade?.classList.remove('on');
    void fade?.offsetWidth;
    fade?.classList.add('on');
  };
  game.bus.on('restaurant/upgraded', (e) => {
    const tier = content.room.tiers[e.tier - 1];
    rebuildRestaurant();
    toast(`${tier.icon} Quán lên hạng: ${tier.name}!`, 'good');
    sound.play('levelup');
  });
  // Bếp lên hạng / thuê thêm đầu bếp: dựng lại gian bếp + quầy line
  let lastKitchen = { tier: game.state.restaurant.kitchenTier, chefs: game.state.restaurant.staff.length };
  game.bus.on('kitchen/changed', (e) => {
    rebuildRestaurant();
    if (e.tier > lastKitchen.tier) {
      const t = content.balance.kitchen.tiers[e.tier - 1];
      toast(`${t.icon} Bếp lên hạng: ${t.name}! Thuê thêm đầu bếp ở bảng Nhân viên.`, 'good', '', 4200);
      sound.play('levelup');
    } else if (e.chefs > lastKitchen.chefs) {
      toast('🧑‍🍳 Đầu bếp mới vào bếp! Giao món cho từng người ở bảng Nhân viên.', 'good', '', 4200);
      sound.play('bell');
    }
    lastKitchen = { tier: e.tier, chefs: e.chefs };
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
    fitSideColumn();
    morph($('settings'), settingsHtml(ui, sound.prefs));
    morph($('friends'), friendsHtml(friends, content, onlineEnabled || (import.meta.env.DEV && params.get('friends') === 'demo')));
    morph($('calendar'), calendarHtml(game, ui));
    morph($('bankrupt'), state.bankrupt ? bankruptHtml() : policePending(game.ctx) ? policeHtml() : '');
    morph($('rename'), renameHtml(ui));
    morph($('guide'), ui.guide == null ? '' : guideHtml(ui.guide, uiAttr, 'Chơi tiếp'));
    morph($('questdlg'), questHtml(game, ui));
    // Thanh phục vụ: món đang cầm (màu theo bàn) / nhắc quầy line có món
    morph($('service'), ui.area === 'restaurant' && !ui.editLayout ? serviceHtml(game) : '');

    // Thanh chế độ sắp xếp bàn + nút chuyển khu hai bên
    const navAreas = areas.filter((a) => a.id !== 'stall' || ui.area === 'stall');
    const index = navAreas.findIndex((a) => a.id === ui.area);
    const prev = navAreas[index - 1];
    const next = navAreas[index + 1];
    morph(
      $('areabar'),
      ui.editLayout ? editBar() : '', // ngoài chế độ sắp xếp bàn thì không hiện gì (hướng dẫn nằm trong bảng Cài đặt)
    );
    // Thanh dưới: nút sang khu bên trái, các bảng (Khách quen, Thực đơn, Kho), nút sang khu bên phải.
    // Nút chuyển khu tô màu riêng cho dễ phân biệt với nút mở bảng.
    const navBtn = (side: 'left' | 'right', a: Area | undefined) => {
      if (!a) return '';
      // Đang ở khu khác mà quán có việc cần làm: hiện số việc trên nút sang quán
      const alerts = a.id === 'restaurant' ? serviceAlerts(game) : 0;
      const label = `<span class="big">${a.icon}</span><span>${esc(a.label)}</span>`;
      return `<button class="navbtn ${side}" data-key="nav-${side}-${a.id}"${uiAttr(`area:${a.id}`)} title="Sang ${esc(a.label)}">${side === 'left' ? `<i>‹</i>${label}` : `${label}<i>›</i>`}${alerts ? `<span class="badge">${alerts}</span>` : ''}</button>`;
    };
    morph(
      $('tools'),
      navBtn('left', prev) +
        panels
          .filter((p) => !OFF_BAR.includes(p.id))
          .map((p) => {
            const badge = p.badge?.(game) ?? 0;
            return `<button class="${ui.drawer === p.id ? 'on' : ''}" data-key="tool-${p.id}"${uiAttr(`drawer:${p.id}`)}>${p.icon} ${esc(p.label)}${badge ? `<span class="badge">${badge}</span>` : ''}</button>`;
          })
          .join('') +
        navBtn('right', next),
    );

    // Nút chuyển khu nằm ngay trên thanh công cụ: theo chiều cao thật của thanh (màn hẹp thanh xuống 2 hàng)
    root.style.setProperty('--tools-h', `${$('tools').offsetHeight || 40}px`);
    const panel = panels.find((p) => p.id === ui.drawer);
    $('drawer').classList.toggle('open', !!panel);
    morph(
      $('drawer'),
      panel
        ? `<div class="drawer-head" data-key="h-${panel.id}"><b>${panel.icon} ${esc(panel.label)}</b><button class="x-close"${uiAttr('drawer:')} aria-label="Đóng">✕</button></div>
           <div id="panel" data-key="${panel.id}">${panel.render(game, ui)}</div>`
        : '',
    );

    const today = state.stats.today;
    morph($('bill'), billHtml(game));
    morph($('meal'), mealHtml(game, ui));
    morph($('coach'), coachHtml(game, ui));
    morph($('buy'), ui.area === 'stall' ? buyHtml(game, ui) : '');
    morph(
      $('modal'),
      state.clock.phase !== 'summary'
        ? ''
        : `<div class="backdrop"><div class="dialog day-end">
            <h2>🌙 Hết ngày ${state.clock.day}</h2>
            <div class="stats">
              <div><span>Doanh thu</span><b>${coins(today.revenue)}</b></div>
              <div><span>Trong đó tip</span><b>${coins(today.tips)}</b></div>
              <div><span>Đã chi</span><b>${coins(today.spent)}</b></div>
              <div><span>Lãi trong ngày</span><b>${coins(today.revenue - today.spent)}</b></div>
              <div><span>Khách hài lòng</span><b>${today.guestsServed}</b></div>
              <div><span>Khách bỏ về</span><b>${today.guestsLost}</b></div>
            </div>
            <div class="day-body">
              ${tomorrowFestivalHtml(game)}
              ${periodSummaryHtml(game)}
              <h3>📦 Trong kho còn</h3>
              ${stockHtml()}
            </div>
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
      // Tranh treo tường: không kéo, "Đổi chỗ" = sang khung trống kế tiếp
      if (def.wall)
        return `<b data-key="edit">${def.icon} ${esc(def.name)}</b><span>Tranh treo trên tường — đổi sang khung khác hoặc cất kho.</span>
        <div class="btns"><button class="mini"${cmd({ type: 'prop/rotate', uid: prop.uid })}>⇄ Đổi chỗ</button><button class="mini"${cmd({ type: 'prop/store', uid: prop.uid })}>📦 Cất kho</button>${sell}<button class="mini"${uiAttr('editSel:')}>Bỏ chọn</button>${done}</div>`;
      return `<b data-key="edit">${def.icon} ${esc(def.name)}</b><span>Kéo để dời chỗ.</span>
        <div class="btns"><button class="mini"${cmd({ type: 'prop/rotate', uid: prop.uid })}>⟳ Xoay</button><button class="mini"${cmd({ type: 'prop/store', uid: prop.uid })}>📦 Cất kho</button>${sell}<button class="mini"${uiAttr('editSel:')}>Bỏ chọn</button>${done}</div>`;
    }
    return `<b data-key="edit">🪑 Đang sắp xếp quán</b><span>Kéo bàn ghế, đồ trang trí tới chỗ mới; bấm một món để xoay / cất. Bàn có khách và quầy trước bếp không dời được.</span>
      <div class="btns"><button class="mini"${cmd({ type: 'layout/reset' })}>↺ Bàn về mặc định</button>${done}</div>`;
  };


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

  // Bấm vào vật thể trong cảnh 3D (đang thăm quán: chỉ cho bấm nhà kính / sạp chợ để đi vào xem)
  stage.onPick = (pick: Pick, held: number) => (visit && pick.type !== 'building' && pick.type !== 'stall' ? undefined : onPick(pick, held));
  const onPick = (pick: Pick, _held: number) => {
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
    } else if (pick.type === 'cashier') {
      // Bấm quầy cashier: đang cầm món giao tận nơi thì mang tới đóng gói; không thì mở bảng Đơn hàng (nhận cuộc gọi)
      const r = game.state.restaurant;
      const carryingTakeout = r.waiter.carrying.some((id) => r.orders.find((o) => o.id === id)?.takeoutId != null);
      if (carryingTakeout) {
        if (run({ type: 'service/handoff' })) sound.play('pop');
      } else ui.drawer = 'contracts';
    } else if (pick.type === 'pass') {
      // Bấm quầy line: bồi bàn ra lấy món nấu xong sớm nhất (tối đa 2 món)
      if (run({ type: 'service/pickup' })) sound.play('pop');
    } else if (pick.type === 'party') {
      servePartyAt(Number(pick.id));
    } else if ((pick.type === 'table' || pick.type === 'prop') && ui.editLayout) {
      ui.editSelected = ui.editSelected === pick.id ? null : pick.id;
    } else if (pick.type === 'table' && !ui.editLayout) {
      // Bấm vào bàn = bấm vào nhóm khách ở bàn đó (quầy ghế đơn có nhiều nhóm: ưu tiên nhóm hợp việc đang làm)
      const here = game.state.restaurant.parties.filter((p) => p.tableId === pick.id);
      const carrying = game.state.restaurant.waiter.carrying.length > 0;
      const want = carrying ? here.find((p) => p.phase === 'waitingFood') ?? here.find((p) => needOf(p)) : here.find((p) => needOf(p));
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
    const w = game.state.restaurant.waiter;
    // Đang cầm món (hoặc đang ra quầy lấy) mà bấm bàn chờ món: giao món của bàn đó
    if (party.phase === 'waitingFood' && (w.carrying.length || w.tasks.some((t) => t.kind === 'pickup'))) {
      if (run({ type: 'service/serve', partyId })) sound.play('pop');
      return;
    }
    const need = needOf(party);
    if (need === 'menu') run({ type: 'service/menu', partyId });
    else if (need === 'order') run({ type: 'service/takeOrder', partyId });
    // Bàn đang chờ món, chưa cầm món: không nhắc nữa (đã có hướng dẫn chơi + ngày hướng dẫn)
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
    const [action, ...rest] = uiEl.dataset.ui!.split(':');
    const arg = rest.join(':');
    if (action === 'area') setArea(arg);
    else if (action === 'drawer') {
      ui.drawer = ui.drawer === arg || !arg ? null : arg;
      if (ui.drawer === 'farm') ui.farmFocus = null; // mở từ nút: xem cả nông trại
    } else if (action === 'farmFocus') ui.farmFocus = arg || null;
    else if (action === 'decorPreview') {
      // Xem trước nội thất ở Siêu thị: tô quán bằng màu món đó (bấm lần nữa / "Thôi" thì về như cũ), đang ở khu khác thì về quán
      // Mỗi loại (sàn / tường / bàn ghế) xem một món, xem cùng lúc nhiều loại được; bấm lại món đang xem thì thôi loại đó
      if (!arg || !content.decor.has(arg)) ui.decorPreview = null;
      else {
        const slot = content.decor.get(arg).slot;
        const next = { ...(ui.decorPreview ?? {}) };
        if (next[slot] === arg) delete next[slot];
        else next[slot] = arg;
        ui.decorPreview = Object.keys(next).length ? next : null;
      }
      if (ui.decorPreview && ui.area !== 'restaurant') setArea('restaurant');
    }
    else if (action === 'itemTip') ui.itemTip = ui.itemTip === arg ? null : arg;
    else if (action === 'speed') ui.speed = Number(arg);
    else if (action === 'settings') ui.settings = arg === 'close' ? false : !ui.settings;
    else if (action === 'preview') {
      // Xem trước xong: về màn chọn quán (back) hoặc sang bước chọn chủ quán với quán này (pick)
      location.href = `${location.pathname}?${arg === 'pick' ? 'choose' : 'pick'}=${preview}`;
      return;
    } else if (action === 'restart') {
      // Phá sản: xoá save, về màn mở đầu chơi ván mới
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch {
        /* trình duyệt chặn bộ nhớ: bỏ qua */
      }
      location.href = location.pathname;
      return;
    } else if (action === 'calendar') ui.calendar = arg === 'close' ? null : arg === 'open' ? (ui.calendar == null ? 0 : null) : Number(arg) || 0;
    else if (action === 'pickup') {
      if (run({ type: 'service/pickup' })) sound.play('pop');
    }
    else if (action === 'handoff') {
      if (run({ type: 'service/handoff' })) sound.play('pop');
    }
    else if (action === 'rename') {
      if (arg === 'close') ui.rename = null;
      else if (arg === 'ok') submitRename();
      else {
        ui.renameKind = arg === 'owner' ? 'owner' : 'shop';
        ui.rename = ui.renameKind === 'owner' ? game.state.owner.name : game.state.profile.name;
        renderDom();
        // Đặt con trỏ vào ô nhập, chọn sẵn tên cũ để gõ đè
        const input = root.querySelector<HTMLInputElement>('[data-rename-input]');
        input?.focus();
        input?.select();
        return;
      }
    } else if (action === 'photo') {
      ui.photo = arg !== 'close';
      if (ui.photo) Object.assign(ui, { drawer: null, settings: false, editLayout: false });
      root.classList.toggle('photo-mode', ui.photo);
    } else if (action === 'snap') {
      takePhoto();
      return;
    } else if (action === 'editSel') ui.editSelected = arg || null;
    else if (action === 'quest') ui.questOpen = arg !== 'close';
    else if (action === 'coach') {
      // Nút trên thẻ hướng dẫn: sang khu cần tới / vào thẳng sạp chợ
      const [kind, id] = arg.split(':');
      ui.drawer = null;
      if (kind === 'area') setArea(id);
      else if (kind === 'stall' && content.stalls.has(id)) {
        ui.stallView = id;
        ui.buyItem = null;
        stall.show(id);
        setArea('stall');
      }
    }
    else if (action === 'guide') {
      // Mở hướng dẫn từ Cài đặt: đóng Cài đặt, game vẫn tạm dừng tới khi đóng hướng dẫn
      ui.settings = false;
      ui.guide = arg === 'close' ? null : Number(arg) || 0;
    }
    else if (action === 'meal') {
      // "Xong": chốt bữa cho ai đã gọi ít nhất một món (ai chưa gọi thì quá hạn tự chọn) rồi đóng bảng
      if (arg === 'done') {
        const c = game.state.crew;
        if (c.pending.some((p) => c.meals.some((l) => l.who === p.who))) run({ type: 'crew/confirm' });
      }
      ui.mealOpen = arg !== 'close' && arg !== 'done';
      if (ui.mealOpen) ui.mealStall = null;
    } else if (action === 'mealWho') ui.mealWho = arg || null;
    else if (action === 'mealStall') ui.mealStall = arg || null;
    else if (action === 'buy') ui.buyItem = arg === 'close' ? null : arg;
    else if (action === 'noop') return;
    else if (action === 'music') sound.setMusic(!sound.prefs.music);
    else if (action === 'sfx') sound.setSfx(!sound.prefs.sfx);
    else if (action === 'crayon') setCrayon(!crayonEnabled());
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
    } else if (action === 'friends') {
      void friendsAction(arg);
      if (arg === 'close') renderDom();
      return;
    } else if (action === 'visit' && arg === 'home') {
      // Về quán mình: ván của mình chạy tiếp từ đúng chỗ đã lưu
      try {
        sessionStorage.removeItem(VISIT_KEY);
      } catch {
        /* bỏ qua */
      }
      location.href = loadSave(content) ? `${location.pathname}?play` : location.pathname;
      return;
    } else if (action === 'home') {
      // Về màn hình mở đầu: lưu rồi tải lại trang (màn mở đầu có Chơi tiếp / Ván mới)
      save();
      location.href = location.pathname;
      return;
    }
    renderDom();
  });
  window.addEventListener('pagehide', save);
  // ---------- F3 · Bạn bè online (Supabase, lớp A) ----------
  const friends = newFriendsView();
  /** Sang thăm quán bạn từ bản chụp trên máy chủ: lưu ván mình rồi mở chế độ thăm. */
  const goVisit = (raw: string) => {
    try {
      sessionStorage.setItem(VISIT_KEY, raw);
    } catch {
      return toast('Trình duyệt không cho lưu tạm dữ liệu, không mở được quán này.', 'bad', '', 4200);
    }
    save();
    leaving = true;
    location.href = `${location.pathname}?visit&at=${Math.floor(game.state.clock.minute)}`;
  };
  const friendError = (e: unknown) => (e as Error)?.message || 'Có lỗi, thử lại sau.';
  const friendName = (f: { owner_name: string; shop_name: string }) => (f.owner_name || 'chủ quán') + (f.shop_name ? ' (' + f.shop_name + ')' : '');
  /** Tải danh sách bạn, báo số bạn cho sim (thành tựu 🤝 Hội bạn thân). */
  const fetchFriends = async () => {
    const list = await listFriends();
    if (!visit && !preview) game.dispatch({ type: 'achievement/friends', count: list.length });
    return list;
  };
  /** Kết nối + tải danh sách bạn + mã QR. */
  const loadFriends = async () => {
    friends.status = 'loading';
    friends.error = '';
    renderDom();
    try {
      friends.me = await signIn();
      friends.friends = await fetchFriends();
      friends.qr = await qrSvg(inviteLink(friends.me.friend_code)).catch(() => '');
      friends.status = 'ready';
    } catch (e) {
      friends.status = 'error';
      friends.error = friendError(e);
    }
    renderDom();
  };
  /** Chạy một thao tác với máy chủ: khoá nút trong lúc chờ, lỗi thì hiện trong bảng. */
  const busy = async (job: () => Promise<void>) => {
    if (friends.busy) return;
    friends.busy = true;
    friends.error = '';
    renderDom();
    try {
      await job();
    } catch (e) {
      friends.error = friendError(e);
    }
    friends.busy = false;
    renderDom();
  };
  let lastPush = 0;
  /** Đang bật "cho ghé thăm": đẩy bản chụp quán mới (hết ngày, trước khi đi thăm bạn…); lỗi thì im lặng, lần sau đẩy lại. */
  const syncSnapshot = async (force = false) => {
    const me = friends.me;
    if (!me?.sharing || visit || preview || fresh) return;
    if (!force && performance.now() - lastPush < 60_000) return;
    lastPush = performance.now();
    try {
      me.snapshot_at = await pushSnapshot(me, game.state);
    } catch {
      /* mất mạng / máy chủ bận: bỏ qua */
    }
  };
  async function friendsAction(arg: string): Promise<void> {
    const [what, id] = arg.split(':');
    const me = friends.me;
    if (what === 'open') {
      friends.open = true;
      friends.removeId = null;
      friends.confirmDelete = false;
      if (onlineEnabled && (!me || friends.status !== 'ready')) await loadFriends();
      else if (onlineEnabled) await busy(async () => void (friends.friends = await fetchFriends()));
    } else if (what === 'close') {
      friends.open = false;
      friends.showQr = false;
    } else if (what === 'retry') await loadFriends();
    else if (what === 'refresh') await busy(async () => void (friends.friends = await fetchFriends()));
    else if (what === 'qr') {
      friends.showQr = !friends.showQr;
      renderDom();
    } else if (!me) return;
    else if (what === 'copy') {
      try {
        await navigator.clipboard.writeText(inviteLink(me.friend_code));
        toast('📋 Đã chép link mời — dán gửi cho bạn bè nhé.', 'good');
      } catch {
        friends.showQr = true;
        renderDom();
        toast('Trình duyệt không cho chép — link nằm dưới mã QR.', 'bad');
      }
    } else if (what === 'share') {
      const url = inviteLink(me.friend_code);
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) await nav.share({ title: 'Quán Nhà Vườn', text: 'Kết bạn với mình trong Quán Nhà Vườn (mã ' + me.friend_code + ') rồi ghé thăm quán nhau nhé!', url }).catch(() => {});
      else await friendsAction('copy');
    } else if (what === 'sharing') {
      await busy(async () => {
        save();
        friends.me = await setSharing(me, !me.sharing, game.state);
        lastPush = performance.now();
        toast(friends.me.sharing ? '🏡 Đã mở cửa cho bạn bè ghé thăm.' : '🔒 Đã đóng cửa với khách thăm.', 'good');
      });
    } else if (what === 'add') {
      const input = root.querySelector<HTMLInputElement>('[data-friend-code]');
      const code = (input?.value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!code) return;
      await busy(async () => {
        const f = await addFriend(code);
        if (input) input.value = '';
        friends.friends = await fetchFriends();
        toast('🤝 Đã kết bạn với ' + friendName(f) + '!', 'good', '', 3600);
      });
    } else if (what === 'remove' && id) {
      if (friends.removeId !== id) {
        friends.removeId = id;
        renderDom();
        return;
      }
      friends.removeId = null;
      await busy(async () => {
        await removeFriend(id);
        friends.friends = await fetchFriends();
      });
    } else if (what === 'visit' && id) {
      await busy(async () => {
        await syncSnapshot(true);
        const res = readSnapshot(await friendSnapshot(id), content);
        if (!res.ok) throw new Error(res.reason);
        goVisit(res.raw);
      });
    } else if (what === 'delete') {
      friends.confirmDelete = true;
      renderDom();
    } else if (what === 'deleteNo') {
      friends.confirmDelete = false;
      renderDom();
    } else if (what === 'deleteYes') {
      await busy(async () => {
        await deleteMe();
        Object.assign(friends, newFriendsView());
        toast('🗑 Đã gỡ hết dữ liệu online của bạn.', 'good');
      });
    }
  }
  if (import.meta.env.DEV && params.get('friends') === 'demo') {
    // Chỉ bản dev: ?friends=demo — bảng Bạn bè với dữ liệu mẫu (không cần máy chủ) để xem giao diện
    Object.assign(friends, { open: true, status: 'ready', me: { id: 'me', friend_code: 'K7Q2MX', sharing: true, snapshot_at: new Date(Date.now() - 3600e3).toISOString() } });
    friends.friends = [
      { id: 'a', owner_name: 'Lan', shop_name: 'Quán Nhà Lan', cuisine: 'jp', game_day: 31, sharing: true, snapshot_at: new Date(Date.now() - 600e3).toISOString() },
      { id: 'b', owner_name: 'Anh Tuấn', shop_name: 'Ốc Cô Ba', cuisine: 'oc', game_day: 12, sharing: true, snapshot_at: new Date(Date.now() - 2 * 86400e3).toISOString() },
      { id: 'c', owner_name: 'Minh', shop_name: 'Tiệm Mì Hàn', cuisine: 'kr', game_day: 4, sharing: false, snapshot_at: null },
    ];
    void qrSvg(inviteLink('K7Q2MX')).then((svg) => (friends.qr = svg));
  } else if (import.meta.env.DEV && params.has('friends')) void friendsAction('open'); // ?friends: mở sẵn bảng Bạn bè
  if (onlineEnabled && !visit && !preview) {
    // Hết ngày: đẩy quán mới cho bạn bè (khi đang bật cho ghé thăm)
    game.bus.on('day/started', () => void syncSnapshot(true));
    // Mở game bằng link mời: kết bạn luôn rồi mở bảng Bạn bè
    const invite = takeInvite();
    if (invite) {
      void (async () => {
        try {
          friends.me = await signIn();
          const f = await addFriend(invite);
          toast('🤝 Đã kết bạn với ' + friendName(f) + '!', 'good', '', 4200);
        } catch (e) {
          toast('🤝 ' + friendError(e), 'bad', '', 4200);
        }
        await friendsAction('open');
      })();
    } else if (usedBefore() && !fresh) {
      // Đã từng dùng tính năng bạn bè trên máy này: đăng nhập lại ngầm để hết ngày tự đẩy quán
      void signIn().then((me) => void (friends.me = me), () => {});
    }
  }

  /** Cột nút tròn dưới đồng hồ: màn thấp không đủ chỗ (tính cả thanh dưới nếu nằm ngang hàng) thì chia 2 cột. */
  function fitSideColumn(): void {
    const col = root.querySelector<HTMLElement>('.side-col');
    const clock = root.querySelector<HTMLElement>('.hud-right .clock');
    const first = col?.firstElementChild as HTMLElement | null;
    if (!col || !clock || !first) return;
    const gap = 6;
    const need = col.children.length * (first.offsetHeight + gap);
    const tools = $('tools').getBoundingClientRect();
    const colLeft = first.getBoundingClientRect().left;
    const floor = tools.height && tools.right > colLeft ? tools.top : window.innerHeight;
    col.classList.toggle('two-col', need > floor - clock.getBoundingClientRect().bottom - 16);
  }

  /** Công an khu vực (quán ốc): game dừng, chủ quán chọn bồi dưỡng hay để thu một bàn đôi. */
  function policeHtml(): string {
    const money = bribeOf(game.ctx);
    const table = seizableTable(game.ctx);
    const afford = canAfford(game.ctx, money);
    const neither = !table && !afford;
    return `<div class="backdrop"><div class="dialog police" role="dialog" aria-label="Công an khu vực">
      <h2>👮 Công an khu vực</h2>
      <p>"Quán bày bàn ghế lấn chiếm lề đường, cản lối người đi bộ. Chủ quán tính sao đây?"</p>
      <div class="police-choices">
        <button class="primary"${cmd({ type: 'event/police', choice: 'bribe' })}${afford ? '' : ' disabled'}>💵 Bồi dưỡng · ${coins(money)}</button>
        <button${cmd({ type: 'event/police', choice: 'table' })}${table || neither ? '' : ' disabled'}>${neither ? '🙏 Xin khất lần sau (mất uy tín)' : `🪑 Để công an thu ${table ? esc(table.name) : 'một bàn đôi'}`}</button>
      </div>
      <p class="muted">${table ? 'Bàn bị thu thì mất luôn, muốn có lại phải mua bàn mới ở Siêu thị. Uy tín giảm nhẹ.' : 'Bàn đôi nào cũng đang có khách — chỉ còn cách bồi dưỡng.'}</p>
    </div></div>`;
  }

  /** Màn phá sản: nợ quá mức cho phép, hết ván. */
  function bankruptHtml(): string {
    const { state, content } = game;
    return `<div class="backdrop"><div class="dialog bankrupt" role="dialog" aria-label="Phá sản">
      <h2>💸 Phá sản rồi!</h2>
      <p>Quán nợ ${moneyText(-state.money)} xu, quá mức cho phép (${content.balance.debtLimit} xu). Ván này dừng ở đây.</p>
      <p class="muted">Đã chơi ${state.clock.day} ngày · cấp ${state.level} · phục vụ ${state.stats.total.guestsServed ?? 0} khách.</p>
      <button class="primary"${uiAttr('restart')}>🌱 Chơi ván mới</button>
    </div></div>`;
  }

  /** Đổi tên theo ô nhập trong hộp đổi tên; lỗi (trống, quá dài) thì giữ hộp mở để sửa. */
  function submitRename(): void {
    const input = root.querySelector<HTMLInputElement>('[data-rename-input]');
    if (!input) return;
    if (ui.renameKind === 'owner') {
      if (run({ type: 'profile/renameOwner', name: input.value })) {
        ui.rename = null;
        toast(`🙋 Chào ${game.state.owner.name}!`, 'good');
      }
    } else if (run({ type: 'profile/rename', name: input.value })) {
      ui.rename = null;
      toast(`🏮 Biển hiệu mới: ${game.state.profile.name}`, 'good');
    }
  }

  // Phím tắt: Esc đóng Cài đặt, Space tạm dừng / chạy tiếp
  let resumeSpeed = 1;
  window.addEventListener('keydown', (e) => {
    if (ui.rename != null && e.key === 'Enter') submitRename();
    else if (ui.rename != null && e.key === 'Escape') ui.rename = null;
    else if (ui.rename != null) return; // đang gõ tên: không bắt phím tắt
    else if (e.key === 'Escape' && ui.guide != null) ui.guide = null;
    else if (e.key === 'Escape' && ui.mealOpen) ui.mealOpen = false;
    else if (e.key === 'Escape' && ui.buyItem) ui.buyItem = null;
    else if (e.key === 'Escape' && ui.questOpen) ui.questOpen = false;
    else if (e.key === 'Escape' && ui.photo) {
      ui.photo = false;
      root.classList.remove('photo-mode');
    } else if (e.key === 'Escape' && ui.settings) ui.settings = false;
    else if (e.key === 'Escape' && ui.calendar != null) ui.calendar = null;
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
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    // Mở bảng Cài đặt, bảng gọi món cho đội hay hoá đơn ăn uống thì game tạm dừng; đóng lại chạy tiếp ở tốc độ đã chọn
    // Sắp xếp bàn ghế, mở Siêu thị (mua đồ nâng cấp) cũng tạm dừng để người chơi thong thả
    const speed = visit ? 1 : game.state.bankrupt || !!policePending(game.ctx) || ui.settings || ui.editLayout || ui.drawer === 'shop' || ui.calendar != null || ui.rename != null || friends.open || ui.mealOpen || billDue(game.ctx) ? 0 : ui.speed;
    game.tick(dt * speed * content.balance.minutesPerSecond);
    // Xem trước nội thất chỉ khi bảng Siêu thị còn mở
    if (ui.drawer !== 'shop') ui.decorPreview = null;
    restaurant.previewDecor = ui.decorPreview ?? null;
    stage.env.selectedSlot = ui.selectedSlot;
    stage.env.editLayout = ui.editLayout;
    stage.env.editSelected = ui.editSelected;
    stage.render(dt, speed);
    sound.setRain(ui.area === 'restaurant' ? stage.env.rain * 0.4 : stage.env.rain);

    // Tiền: số trên HUD chạy dần tới giá trị thật, có chữ +/- nổi lên khi đổi
    const shown = money.step(game.state.money, dt);
    const el = moneyNum();
    if (el && el.textContent !== moneyText(shown)) el.textContent = moneyText(shown);
    const diff = Math.round(game.state.money - lastMoney);
    if (diff !== 0) {
      lastMoney = game.state.money;
      floatText(fx, diff > 0 ? `+${diff}` : `${diff}`, el, diff > 0 ? 'good' : 'bad');
      if (diff > 0) bump(el, 0.4);
    }
    if ((domTimer += dt) >= 1 / DOM_FPS) {
      domTimer = 0;
      // Xem trước: quán tự chạy (tự phục vụ, đội tự gọi món, tự trả tiền) — người xem chỉ ngắm
      if (preview || visit) previewAuto(game);
      if (previewLoop && game.state.clock.minute - previewLoop.from >= PREVIEW_LOOP_MINUTES) rewindPreview();
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

/** Độ dài đoạn chiếu lại khi xem trước quán (phút game; 90 phút ≈ 1 phút thực ở x1). */
const PREVIEW_LOOP_MINUTES = 90;

/** Xem trước quán: người phục vụ mẫu làm mọi việc, đội tự gọi món / trả tiền — không có bảng nào hiện lên chặn màn. */
function previewAuto(game: Game): void {
  for (const c of autoServeCommands(game.ctx)) game.dispatch(c);
  if (game.state.crew.pending.length) game.dispatch({ type: 'crew/autoOrder' });
  if (billDue(game.ctx)) game.dispatch({ type: 'crew/pay' });
  if (game.state.money < 100) game.state.money = 500; // ván xem trước không bao giờ hết tiền
}

const VISIT_KEY = 'quan-nha-vuon/visit';
/** Khoá save trong localStorage. */
const SAVE_KEY = 'quan-nha-vuon/save';

/** F1: bản chụp quán đang thăm (cất trong sessionStorage), null nếu không có / hỏng. */
function readVisit(content: Content): GameState | null {
  try {
    return deserialize(sessionStorage.getItem(VISIT_KEY), content);
  } catch {
    return null;
  }
}

/**
 * Chỉ bản dev: ?max — dựng ván "tối thượng" để xem quán khi đã mua hết: cấp cao, hạng quán + hạng bếp cao nhất, đủ đầu bếp /
 * nhân viên / shipper, mọi trang thiết bị, mọi món, nội thất đắt nhất mỗi loại, thú cưng, đồ trang trí, thêm bàn tới khi hết chỗ,
 * nông trại mua đủ ô / nới hết bậc / đủ cối, người làm vườn, dụng cụ. Đi qua lệnh thật nên luật đặt chỗ vẫn giữ.
 */
function maxOut(game: Game): void {
  const { content, state } = game;
  const run = (c: Command) => game.dispatch(c).ok;
  const repeat = (c: () => Command, max = 40) => {
    for (let i = 0; i < max && run(c()); i++);
  };
  Object.assign(state, { money: 9_999_999, level: 50, reputation: 5 });
  repeat(() => ({ type: 'restaurant/upgrade' }));
  repeat(() => ({ type: 'kitchen/upgrade' }));
  repeat(() => ({ type: 'chef/hire' }));
  repeat(() => ({ type: 'helper/hire' }));
  repeat(() => ({ type: 'courier/hire' }));
  for (const u of content.upgrades.all()) run({ type: 'upgrade/buy', upgradeId: u.id });
  for (const r of recipesFor(content, state.cuisine)) run({ type: 'menu/unlock', recipeId: r.id });
  // Nội thất: mỗi loại chọn món đắt nhất của phong cách quán này
  const best = new Map<string, { id: string; cost: number }>();
  for (const d of decorFor(content, state.cuisine)) if (d.cost > (best.get(d.slot)?.cost ?? -1)) best.set(d.slot, { id: d.id, cost: d.cost });
  for (const { id } of best.values()) {
    run({ type: 'decor/buy', decorId: id });
    run({ type: 'decor/equip', decorId: id });
  }
  for (const p of content.pets.all()) {
    run({ type: 'pet/adopt', petId: p.id });
    run({ type: 'pet/set', petId: p.id, out: true });
  }
  for (const p of content.props.all()) if (!p.giftOnly && (!p.cuisine || p.cuisine === state.cuisine)) run({ type: 'prop/buy', propId: p.id });
  // Thêm bàn: lần lượt từng loại, tới khi không còn chỗ
  const kinds = content.tableKinds.all();
  for (let i = 0, fails = 0; i < 60 && fails < kinds.length; i++) fails = run({ type: 'table/buy', kind: kinds[i % kinds.length].id }) ? 0 : fails + 1;
  // Nông trại
  for (const t of content.slotTypes.all()) repeat(() => ({ type: 'farm/buySlot', slotType: t.id }), 30);
  for (const s of state.farm.slots) repeat(() => ({ type: 'farm/upgradeSlot', slotId: s.id }), 10);
  for (const m of content.mills.all()) repeat(() => ({ type: 'mill/buy', millType: m.id as MillType }), 10);
  repeat(() => ({ type: 'gardener/hire' }));
  for (const t of farmTools) run({ type: 'tool/buy', toolId: t.id });
  // Kho đầy nguyên liệu (khỏi hiện cảnh báo hết hàng)
  for (const it of content.items.all()) if (!it.infinite) addItem(game.ctx, it.id, 200);
}

/**
 * Chỉ bản dev: ?tier=N — quán vừa lên hạng N: cấp người chơi = cấp mở hạng đó, nâng bếp tới hạng cao nhất cấp đó cho phép,
 * thuê đủ đầu bếp / nhân viên phục vụ. Bàn ghế, nội thất giữ như ván mới để thấy đúng phòng của hạng.
 */
function tierUp(game: Game, n: number): void {
  const { content, state } = game;
  const tier = content.room.tiers[Math.min(n, content.room.tiers.length) - 1];
  Object.assign(state, { money: 9_999_999, level: Math.max(state.level, tier.level) });
  while (state.restaurant.tier < tier.id && game.dispatch({ type: 'restaurant/upgrade' }).ok);
  while (game.dispatch({ type: 'kitchen/upgrade' }).ok);
  while (game.dispatch({ type: 'chef/hire' }).ok);
  while (game.dispatch({ type: 'helper/hire' }).ok);
  state.money = 500;
}

/**
 * Chỉ bản dev: ?visit=jp — quán mẫu để thử chế độ thăm quán mà không cần chọn file: bà chủ Lan, mùa Thu năm 1,
 * đã chạy tới giữa ca sáng có khách ngồi (giờ trong ngày vẫn lấy theo ?at=).
 */
function demoVisit(content: Content, cuisine: CuisineId): GameState {
  const g = new Game(content, { seed: 23, cuisine, owner: { gender: 'female', age: 28, name: 'Lan' } });
  g.dispatch({ type: 'profile/rename', name: 'Quán Nhà Lan' });
  g.state.clock.day = 29;
  for (let m = 0; m < 150; m++) {
    previewAuto(g);
    g.tick(1);
  }
  return g.state;
}

/**
 * F2: đưa bản chụp quán đang thăm về đầu ca sáng để chiếu lại cho có không khí (ván tạm, không bao giờ lưu):
 * đội đang ở chợ / bảng gọi món / hoá đơn / sự kiện / ngày hướng dẫn của ván đó bỏ qua; khách đang ngồi giữ nguyên.
 */
function prepareVisit(game: Game): void {
  const s = game.state;
  s.clock.minute = 7 * 60;
  s.clock.phase = 'open';
  s.crew = { ...s.crew, restaurantAway: null, farmerAway: null, pending: [], meals: [], bill: [], farmerWaiting: false, farmerBack: null };
  s.event = null;
  s.tutorial = null;
  s.bankrupt = false;
}

/** Thanh trên cùng khi thăm quán: quán của ai, mùa / năm của chủ quán, chuyển khu, nút về quán mình. */
function visitBarHtml(state: GameState): string {
  const cal = calendarOf(state.clock.day);
  return `<div id="preview-fade"></div><div id="visit-bar">
    <div class="vb-text"><b>🏡 Quán của ${esc(ownerName(state.owner))}</b><span>${esc(state.profile.name)} · Mùa ${esc(seasons[cal.season]?.name ?? '')}, năm ${cal.year}</span></div>
    <div class="vb-areas"><button data-ui="area:farm">🌾 Vườn</button><button data-ui="area:restaurant">🏠 Quán</button><button data-ui="area:market">🧺 Chợ</button></div>
    <button class="primary" data-ui="visit:home">← Về quán mình</button>
  </div>`;
}

/** Thanh trên cùng khi xem trước quán: tên quán, gợi ý thao tác camera, nút quay lại / chọn quán này. */
function previewBarHtml(content: Content, id: CuisineId): string {
  const c = content.cuisines.get(id);
  return `<div id="preview-fade"></div><div id="preview-bar" style="--accent:${c.accent}">
    <div class="pv-text"><b>👀 Xem trước ${esc(c.name)}</b><span>Kéo để xoay · lăn chuột / chụm hai ngón để phóng to · quán chiếu lại một đoạn ca sáng để bạn ngắm</span></div>
    <div class="pv-actions"><button data-ui="preview:back">← Chọn quán khác</button><button class="primary" data-ui="preview:pick">✔ Chọn quán này</button></div>
  </div>`;
}

/** ?owner=f35 (kèm ?fresh): ông chủ (m) / bà chủ (f) + tuổi cho ván tạm; thêm -tóc-quần áo-tên: ?owner=f35-braid-aodai-Cô Ba. */
function paramOwner(params: URLSearchParams): OwnerProfile | undefined {
  const v = params.get('owner');
  if (!v) return undefined;
  const [ga, hair, outfit, name] = v.split('-');
  return cleanOwner({ gender: ga.startsWith('f') ? 'female' : 'male', age: Number(ga.slice(1)) || 30, hair, outfit, name });
}
