import { describe, expect, it } from 'vitest';
import { createContent } from '../src/data';
import { Game } from '../src/sim/game';
import { modifier } from '../src/sim/helpers';
import { deserialize, serialize } from '../src/sim/save';
import { canPlaceTable, tablePos } from '../src/sim/layout';
import { activeTables, findSeats } from '../src/sim/systems/customers';
import { priceOf } from '../src/sim/systems/market';
import { calendarOf } from '../src/sim/calendar';
import { autoServeCommands } from '../src/sim/systems/service';
import { buildingRect, nextWaypoint, slotCenter, slotScale, workSpot } from '../src/sim/systems/farmer';
import { millCenter, millSpot } from '../src/sim/systems/mills';
import { moodOf } from '../src/sim/systems/customers';
import type { Party } from '../src/sim/state';

const content = createContent();
const newGame = (seed = 42) => new Game(content, { seed });

/** Người chơi chăm chỉ: mỗi phút game bấm hết những việc phục vụ đang cần. */
function serve(game: Game): void {
  for (const c of autoServeCommands(game.ctx)) game.dispatch(c);
}

/** Chạy tới khi hết ngày (màn tổng kết). waiter = true thì có người chơi phục vụ. */
function runDay(game: Game, waiter = true): void {
  for (let i = 0; i < 5000 && game.state.clock.phase !== 'summary'; i++) {
    if (waiter) serve(game);
    game.tick(1);
  }
  expect(game.state.clock.phase).toBe('summary');
}

/** Đặt sẵn 1 nhóm khách đã ngồi ở bàn `tableId` (bỏ qua xếp hàng). */
function seatParty(game: Game, tableId: string, size: number, seats: number[] = Array.from({ length: size }, (_, i) => i)): Party {
  const party: Party = { id: game.state.nextId++, size, phase: 'seated', tableId, seats, patience: 999, patienceMax: 999, timer: 0, orderIds: [], looks: seats.map(() => 0), called: false, wait: 0, regular: null };
  game.state.restaurant.parties.push(party);
  return party;
}

/** Game không có khách tự tới và thời tiết cố định — để dựng tình huống phục vụ bằng tay. */
function quietGame(): Game {
  const game = newGame();
  game.state.restaurant.spawnTimer = 1e9;
  game.state.weather = { id: 'cloudy', minutesLeft: 1e9 };
  return game;
}

describe('nội dung', () => {
  it('hợp lệ; quán khởi đầu có quầy 3 ghế đơn + 1 bàn bốn + 2 bàn đôi', () => {
    const start = content.tables.all().filter((t) => !t.requiresUpgrade);
    expect(start.map((t) => t.seats).sort()).toEqual([2, 2, 3, 4]);
    expect(start.filter((t) => t.shared)).toHaveLength(1);
  });
});

describe('xếp bàn', () => {
  it('khách lẻ ngồi quầy, nhóm 4 ngồi bàn bốn, nhóm 2 ngồi bàn đôi', () => {
    const { ctx } = newGame();
    expect(findSeats(ctx, 1)?.tableId).toBe('counter');
    expect(findSeats(ctx, 4)?.tableId).toBe('medium');
    expect(findSeats(ctx, 2)?.tableId).toBe('pair');
    expect(findSeats(ctx, 5)).toBeNull();
  });
});

describe('chợ', () => {
  it('mua hàng trừ tiền và cộng kho; không đủ tiền thì từ chối', () => {
    const game = newGame();
    const price = priceOf(game.ctx, 'produce', 'onion');
    const before = game.state.money;
    expect(game.dispatch({ type: 'market/buy', stallId: 'produce', itemId: 'onion', qty: 3 }).ok).toBe(true);
    expect(game.state.money).toBe(before - price * 3);
    expect(game.state.inventory.onion).toBe(3);
    expect(game.dispatch({ type: 'market/buy', stallId: 'meat', itemId: 'beef', qty: 999 }).ok).toBe(false);
    expect(game.dispatch({ type: 'market/buy', stallId: 'produce', itemId: 'beef', qty: 1 }).ok).toBe(false);
  });
});

describe('nông trại', () => {
  it('cuốc -> gieo -> tưới -> lớn -> thu hoạch; thu xong đất lại phải cuốc', () => {
    const game = newGame();
    const before = game.state.inventory.cabbage;
    game.state.weather = { id: 'cloudy', minutesLeft: 99999 };
    expect(game.dispatch({ type: 'farm/plant', slotId: 'field-0', producerId: 'cabbage' }).ok).toBe(false); // chưa cuốc
    expect(game.dispatch({ type: 'farm/till', slotId: 'field-0' }).ok).toBe(true);
    expect(game.dispatch({ type: 'farm/till', slotId: 'field-0' }).ok).toBe(false);
    expect(game.dispatch({ type: 'farm/plant', slotId: 'field-0', producerId: 'cabbage' }).ok).toBe(true);
    expect(game.dispatch({ type: 'farm/water', slotId: 'field-0' }).ok).toBe(true);
    expect(game.dispatch({ type: 'farm/water', slotId: 'field-0' }).ok).toBe(false); // còn ẩm
    expect(game.dispatch({ type: 'farm/harvest', slotId: 'field-0' }).ok).toBe(false);
    game.tick(content.producers.get('cabbage').growTime + 1);
    expect(game.dispatch({ type: 'farm/harvest', slotId: 'field-0' }).ok).toBe(true);
    expect(game.state.inventory.cabbage).toBeGreaterThanOrEqual(before + 3 - 24); // khách có thể đã ăn bớt
    expect(game.state.farm.slots[0].producerId).toBeNull();
    expect(game.state.farm.slots[0].tilled).toBe(false);
  });

  it('đất khô lớn chậm hơn đất được tưới; trời mưa thì khỏi tưới', () => {
    const progress = (weather: string, water: boolean) => {
      const g = newGame();
      g.state.weather = { id: weather, minutesLeft: 99999 };
      g.dispatch({ type: 'farm/till', slotId: 'field-0' });
      g.dispatch({ type: 'farm/plant', slotId: 'field-0', producerId: 'tomato' });
      if (water) g.dispatch({ type: 'farm/water', slotId: 'field-0' });
      g.tick(100);
      return g.state.farm.slots[0];
    };
    expect(progress('cloudy', true).progress).toBeCloseTo(100);
    expect(progress('cloudy', false).progress).toBeCloseTo(100 * content.balance.farm.dryGrowth);
    expect(progress('rain', false).wet).toBeGreaterThan(0);
    expect(progress('rain', false).progress).toBeGreaterThan(100);
  });

  it('có sẵn 1 ao cá; nới rộng ao thì thu được nhiều cá hơn', () => {
    const game = newGame();
    game.state.menu.active = [];
    game.state.money = 5000;
    game.state.level = 5;
    const fry = content.producers.get('fish_fry');
    const harvestOnce = () => {
      const before = game.state.inventory.fish ?? 0;
      expect(game.dispatch({ type: 'farm/plant', slotId: 'pond-0', producerId: 'fish_fry' }).ok).toBe(true);
      // Cá lớn lâu hơn phần còn lại của ngày nên phải cho qua ngày mới (sim dừng ở màn tổng kết).
      for (let i = 0; i < fry.growTime + 1; i++) {
        game.tick(1);
        if (game.state.clock.phase === 'summary') game.dispatch({ type: 'day/next' });
      }
      expect(game.dispatch({ type: 'farm/harvest', slotId: 'pond-0' }).ok).toBe(true);
      return (game.state.inventory.fish ?? 0) - before;
    };
    expect(harvestOnce()).toBe(5);
    expect(game.dispatch({ type: 'farm/upgradeSlot', slotId: 'pond-0' }).ok).toBe(true);
    expect(harvestOnce()).toBe(8);
    expect(game.dispatch({ type: 'farm/upgradeSlot', slotId: 'pond-0' }).ok).toBe(true);
    expect(game.dispatch({ type: 'farm/upgradeSlot', slotId: 'pond-0' }).ok).toBe(false);
    expect(game.dispatch({ type: 'farm/upgradeSlot', slotId: 'field-0' }).ok).toBe(false);
  });

  it('vật nuôi cho sản phẩm nhiều lần', () => {
    const game = newGame();
    const hen = content.producers.get('hen');
    game.state.menu.active = []; // không bán gì để kho không bị trừ
    const eggs = game.state.inventory.egg;
    expect(game.dispatch({ type: 'farm/plant', slotId: 'pen-0', producerId: 'hen' }).ok).toBe(true);
    game.tick(hen.growTime + 1);
    game.dispatch({ type: 'farm/harvest', slotId: 'pen-0' });
    game.tick(hen.regrowTime! + 1);
    game.dispatch({ type: 'farm/harvest', slotId: 'pen-0' });
    expect(game.state.inventory.egg).toBe(eggs + 6);
    expect(game.state.farm.slots.find((s) => s.id === 'pen-0')?.producerId).toBe('hen');
  });

  it('không trồng sai loại ô, không trồng khi chưa đủ cấp', () => {
    const game = newGame();
    expect(game.dispatch({ type: 'farm/plant', slotId: 'field-0', producerId: 'hen' }).ok).toBe(false);
    expect(game.dispatch({ type: 'farm/plant', slotId: 'field-0', producerId: 'potato' }).ok).toBe(false);
  });
});

describe('một ngày kinh doanh', () => {
  it('có khách, có doanh thu, hết ngày thì tổng kết và sang ngày mới được', () => {
    const game = newGame();
    game.state.money = 5000;
    for (const item of ['egg', 'cabbage', 'tomato']) game.dispatch({ type: 'market/buy', stallId: 'produce', itemId: item, qty: 150 });
    runDay(game);
    const { today } = game.state.stats;
    console.log('Ngày 1:', today, 'uy tín', game.state.reputation.toFixed(2), 'cấp', game.state.level);
    expect(today.guestsServed).toBeGreaterThan(5); // 2 ca, khách thưa hơn bản cũ
    expect(today.revenue).toBeGreaterThan(0);
    expect(game.state.restaurant.parties).toHaveLength(0);
    expect(game.state.restaurant.orders).toHaveLength(0);

    expect(game.dispatch({ type: 'day/next' }).ok).toBe(true);
    expect(game.state.clock.day).toBe(2);
    expect(game.state.stats.today.revenue).toBe(0);
  });

  it('hết nguyên liệu thì khách bỏ về và uy tín giảm', () => {
    const game = newGame();
    game.state.inventory = {};
    runDay(game);
    expect(game.state.stats.today.guestsServed).toBe(0);
    expect(game.state.stats.today.guestsLost).toBeGreaterThan(0);
    expect(game.state.reputation).toBeLessThan(content.balance.startReputation);
  });

  it('không ai phục vụ thì khách ngồi chờ menu rồi bỏ về', () => {
    const game = newGame();
    runDay(game, false);
    expect(game.state.stats.today.guestsServed).toBe(0);
    expect(game.state.stats.today.guestsLost).toBeGreaterThan(0);
  });

  it('tất định: cùng seed cho cùng kết quả', () => {
    const a = newGame(7);
    const b = newGame(7);
    runDay(a);
    runDay(b);
    expect(serialize(a.state)).toBe(serialize(b.state));
  });
});

describe('siêu thị nội thất', () => {
  it('mua thì dùng luôn, đổi lại món cũ miễn phí, hiệu ứng tính theo món đang dùng', () => {
    const game = newGame();
    game.state.money = 5000;
    game.state.level = 5;
    expect(game.dispatch({ type: 'decor/equip', decorId: 'furn_oak' }).ok).toBe(false);
    expect(game.dispatch({ type: 'decor/buy', decorId: 'furn_oak' }).ok).toBe(true);
    expect(game.state.money).toBe(5000 - content.decor.get('furn_oak').cost);
    expect(game.state.decor.equipped.furniture).toBe('furn_oak');
    expect(game.dispatch({ type: 'decor/buy', decorId: 'furn_oak' }).ok).toBe(false);

    game.state.weather = { id: 'cloudy', minutesLeft: 9999 };
    expect(modifier(game.ctx, 'patience')).toBeCloseTo(1.1);
    expect(game.dispatch({ type: 'decor/equip', decorId: 'furn_basic' }).ok).toBe(true);
    expect(modifier(game.ctx, 'patience')).toBe(1);
    expect(game.state.money).toBe(5000 - content.decor.get('furn_oak').cost);
  });
});

describe('sắp xếp bàn', () => {
  it('bố cục mặc định hợp lệ (kể cả bàn mở rộng)', () => {
    const game = newGame();
    for (const t of activeTables(game.ctx).filter((t) => !t.fixed)) {
      const at = tablePos(game.ctx, t);
      expect(canPlaceTable(game.ctx, t.id, at.x, at.y), t.id).toBeNull();
    }
  });

  it('dời được bàn trống tới chỗ hợp lệ; chặn khi đè bàn khác, ra ngoài, bàn cố định, bàn có khách', () => {
    const game = newGame();
    expect(game.dispatch({ type: 'layout/moveTable', tableId: 'pair', x: 433, y: 371 }).ok).toBe(true);
    expect(game.state.restaurant.layout.pair).toEqual({ x: 435, y: 370 });
    expect(game.dispatch({ type: 'layout/moveTable', tableId: 'pair', x: 125, y: 300 }).ok).toBe(false);
    expect(game.dispatch({ type: 'layout/moveTable', tableId: 'pair', x: 10, y: 300 }).ok).toBe(false);
    expect(game.dispatch({ type: 'layout/moveTable', tableId: 'counter', x: 360, y: 300 }).ok).toBe(false);

    game.state.restaurant.parties.push({ id: 99, size: 2, phase: 'eating', tableId: 'pair', seats: [0, 1], patience: 1, patienceMax: 1, timer: 5, orderIds: [], looks: [0, 0], called: false, wait: 0, regular: null });
    expect(game.dispatch({ type: 'layout/moveTable', tableId: 'pair', x: 430, y: 290 }).ok).toBe(false);
    expect(game.dispatch({ type: 'layout/reset' }).ok).toBe(false);
    game.state.restaurant.parties = [];
    expect(game.dispatch({ type: 'layout/reset' }).ok).toBe(true);
    expect(game.state.restaurant.layout).toEqual({});
  });
});

describe('thời tiết', () => {
  it('đổi theo thời gian và mưa làm cây lớn nhanh hơn', () => {
    const game = newGame();
    const seen = new Set<string>();
    game.bus.on('weather/changed', (e) => seen.add(e.id));
    game.state.menu.active = [];
    for (let i = 0; i < 3000; i++) {
      game.tick(1);
      if (game.state.clock.phase === 'summary') game.dispatch({ type: 'day/next' });
    }
    expect(seen.size).toBeGreaterThan(1);

    const grown = (weather: string) => {
      const g = newGame();
      g.state.weather = { id: weather, minutesLeft: 9999 };
      g.dispatch({ type: 'farm/till', slotId: 'field-0' });
      g.dispatch({ type: 'farm/plant', slotId: 'field-0', producerId: 'cabbage' });
      g.tick(60);
      return g.state.farm.slots[0].progress;
    };
    expect(grown('rain')).toBeGreaterThan(grown('cloudy'));
  });
});

describe('lưu / tải', () => {
  it('tải lại giữa chừng rồi chạy tiếp cho kết quả y hệt', () => {
    const a = newGame(9);
    a.tick(300);
    const b = new Game(content, { state: deserialize(serialize(a.state), content)! });
    a.tick(200);
    b.tick(200);
    expect(serialize(b.state)).toBe(serialize(a.state));
  });

  it('save trước v7 (chưa có phong cách quán) bị bỏ qua: chơi lại từ đầu', () => {
    const old = JSON.parse(serialize(newGame().state));
    old.version = 6;
    delete old.cuisine;
    expect(deserialize(JSON.stringify(old), content)).toBeNull();
  });

  it('save hỏng trả về null', () => {
    expect(deserialize('{oops', content)).toBeNull();
    expect(deserialize(null, content)).toBeNull();
  });
});

describe('lịch', () => {
  it('ngày 1 là Thứ Hai mùng 1 mùa Xuân năm 1; qua mùa, qua năm đúng', () => {
    expect(calendarOf(1)).toEqual({ weekday: 0, dayOfSeason: 1, season: 0, year: 1 });
    expect(calendarOf(7).weekday).toBe(6);
    expect(calendarOf(8).weekday).toBe(0);
    expect(calendarOf(28)).toMatchObject({ dayOfSeason: 28, season: 0 });
    expect(calendarOf(29)).toMatchObject({ dayOfSeason: 1, season: 1, year: 1 });
    expect(calendarOf(113)).toMatchObject({ dayOfSeason: 1, season: 0, year: 2 });
  });
});

describe('phục vụ (người chơi là bồi bàn)', () => {
  it('mang menu -> khách xem 3–7 giây -> ghi món -> bếp nấu -> bưng món -> khách ăn và trả tiền', () => {
    const game = quietGame();
    const r = game.state.restaurant;
    const party = seatParty(game, 'pair', 2);
    const money = game.state.money;

    expect(game.dispatch({ type: 'service/takeOrder', partyId: party.id }).ok).toBe(false); // chưa xem menu
    expect(game.dispatch({ type: 'service/menu', partyId: party.id }).ok).toBe(true);
    expect(game.dispatch({ type: 'service/menu', partyId: party.id }).ok).toBe(false); // đã giao việc rồi
    const start = { x: r.waiter.x, y: r.waiter.y };
    game.tick(0.1);
    expect(party.phase).toBe('seated'); // bồi bàn còn đang đi tới
    expect(Math.hypot(r.waiter.x - start.x, r.waiter.y - start.y)).toBeGreaterThan(0);
    game.tick(3);
    expect(party.phase).toBe('browsing');
    const [min, max] = content.balance.service.browseTime;
    expect(party.timer).toBeGreaterThanOrEqual(min - 3);
    expect(party.timer).toBeLessThanOrEqual(max);

    game.tick(max + 0.1);
    expect(party.phase).toBe('readyToOrder');
    expect(game.dispatch({ type: 'service/takeOrder', partyId: party.id }).ok).toBe(true);
    game.tick(3);
    expect(party.phase).toBe('waitingFood');
    expect(party.orderIds).toHaveLength(2);

    // Bếp nấu xong thì món nằm ở quầy, KHÔNG tự lên bàn
    for (let i = 0; i < 120 && !r.orders.every((o) => o.status === 'ready'); i++) game.tick(1);
    expect(r.orders).toHaveLength(2);
    expect(r.orders.every((o) => o.status === 'ready')).toBe(true);
    expect(party.phase).toBe('waitingFood');

    for (const o of [...r.orders]) expect(game.dispatch({ type: 'service/deliver', orderIds: [o.id], partyId: party.id }).ok).toBe(true);
    game.tick(10);
    expect(r.orders.every((o) => o.status === 'served')).toBe(true);
    expect(party.phase).toBe('eating');
    game.tick(content.balance.eatTime + 1);
    expect(r.parties).toHaveLength(0);
    expect(game.state.money).toBeGreaterThan(money);
  });

  it('giao nhầm bàn bị từ chối; hai bàn gọi cùng món thì món ra trước giao bàn nào cũng được', () => {
    const game = quietGame();
    const r = game.state.restaurant;
    game.state.menu.active = ['egg_rice'];
    const a = seatParty(game, 'pair', 1, [0]);
    const b = seatParty(game, 'medium', 1, [0]);
    for (const p of [a, b]) Object.assign(p, { phase: 'readyToOrder' });
    for (const p of [a, b]) game.dispatch({ type: 'service/takeOrder', partyId: p.id });
    game.tick(6);
    expect(a.phase).toBe('waitingFood');
    expect(b.phase).toBe('waitingFood');

    // Bếp chỉ mới xong món của A: giao cho B (cũng gọi cơm trứng) -> hai đơn đổi chủ
    const orderA = r.orders.find((o) => o.partyId === a.id)!;
    const orderB = r.orders.find((o) => o.partyId === b.id)!;
    Object.assign(orderA, { status: 'ready' });
    Object.assign(orderB, { status: 'queued' });
    r.staff.forEach((s) => (s.orderId = null));
    game.state.menu.active = [];
    const stranger = seatParty(game, 'pair2', 1, [0]);
    Object.assign(stranger, { phase: 'waitingFood' });
    expect(game.dispatch({ type: 'service/deliver', orderIds: [orderA.id], partyId: stranger.id }).ok).toBe(false);
    expect(game.dispatch({ type: 'service/deliver', orderIds: [orderA.id], partyId: b.id }).ok).toBe(true);
    expect(orderA.partyId).toBe(b.id);
    expect(orderB.partyId).toBe(a.id);
    expect(a.orderIds).toEqual([orderB.id]);
    expect(b.orderIds).toEqual([orderA.id]);
    expect(game.dispatch({ type: 'service/deliver', orderIds: [orderA.id], partyId: b.id }).ok).toBe(false); // đã có người bưng
  });

  it('món nằm ở quầy lâu: cứ moodStep phút tụt một bậc tâm trạng, quá bậc tức giận thì bỏ về', () => {
    const game = quietGame();
    const r = game.state.restaurant;
    const step = content.balance.service.moodStep;
    const party = seatParty(game, 'pair', 1, [0]);
    Object.assign(party, { phase: 'readyToOrder' });
    game.dispatch({ type: 'service/takeOrder', partyId: party.id });
    game.tick(4);
    expect(party.phase).toBe('waitingFood');
    // Lúc bếp còn nấu thì tâm trạng không tụt
    game.tick(5);
    expect(moodOf(game.ctx, party)).toBe(0);
    for (const o of r.orders) Object.assign(o, { status: 'ready' });
    r.staff.forEach((s) => (s.orderId = null));
    game.tick(step + 0.5);
    expect(moodOf(game.ctx, party)).toBe(1);
    game.tick(step);
    expect(moodOf(game.ctx, party)).toBe(2);
    game.tick(step);
    expect(moodOf(game.ctx, party)).toBe(3);
    game.tick(step);
    expect(r.parties).toHaveLength(0);
    expect(game.state.stats.today.guestsLost).toBe(1);
  });

  it('khách chờ menu quá lâu thì bỏ về', () => {
    const game = quietGame();
    const party = seatParty(game, 'pair', 2);
    Object.assign(party, { patience: 5, patienceMax: 5 });
    game.tick(6);
    expect(game.state.restaurant.parties).toHaveLength(0);
  });

});

describe('bồi bàn — lỗi đã sửa', () => {
  it('ghi món cho bàn hết nguyên liệu (khách bỏ về) không làm mất việc kế tiếp của bàn khác', () => {
    const game = quietGame();
    const hungry = seatParty(game, 'pair', 2);
    hungry.phase = 'readyToOrder';
    const next = seatParty(game, 'medium', 2);
    game.state.inventory = {}; // hết sạch nguyên liệu: bàn 'pair' sẽ bỏ về lúc ghi món
    expect(game.dispatch({ type: 'service/takeOrder', partyId: hungry.id }).ok).toBe(true);
    expect(game.dispatch({ type: 'service/menu', partyId: next.id }).ok).toBe(true);
    game.tick(30);
    expect(game.state.restaurant.parties.some((p) => p.id === hungry.id)).toBe(false);
    expect(game.state.restaurant.parties.find((p) => p.id === next.id)!.phase).not.toBe('seated');
  });
});

describe('bác nông dân', () => {
  /** Tua tới khi bác làm hết hàng việc (tối đa `limit` phút game). */
  function untilIdle(game: Game, limit = 200): void {
    for (let i = 0; i < limit * 2 && game.state.farm.farmer.tasks.length; i++) game.tick(0.5);
    expect(game.state.farm.farmer.tasks).toHaveLength(0);
  }
  const fresh = () => {
    const g = newGame();
    g.state.weather = { id: 'cloudy', minutesLeft: 99999 };
    g.state.menu.active = [];
    return g;
  };

  it('bấm ô thì bác chạy tới, làm xong mới có tác dụng, rồi đứng lại ở mép ô', () => {
    const game = fresh();
    const done: string[] = [];
    game.bus.on('farmer/done', (e) => done.push(`${e.kind}:${e.slotId}:${e.ok}`));
    const slot = () => game.state.farm.slots.find((s) => s.id === 'field-0')!;
    expect(game.dispatch({ type: 'farmer/do', kind: 'till', slotId: 'field-0' }).ok).toBe(true);
    expect(slot().tilled).toBe(false); // chưa tới nơi
    game.tick(0.5);
    expect(slot().tilled).toBe(false);
    untilIdle(game);
    expect(slot().tilled).toBe(true);
    expect(done).toEqual(['till:field-0:true']);
    const spot = workSpot(game.ctx, slot());
    expect(game.state.farm.farmer).toMatchObject({ x: spot.x, z: spot.z, work: null });
  });

  it('xếp hàng việc nối tiếp trên cùng ô: cuốc -> gieo -> tưới đều hợp lệ ngay lúc bấm', () => {
    const game = fresh();
    expect(game.dispatch({ type: 'farmer/do', kind: 'till', slotId: 'field-4' }).ok).toBe(true);
    expect(game.dispatch({ type: 'farmer/do', kind: 'plant', slotId: 'field-4', producerId: 'cabbage' }).ok).toBe(true);
    expect(game.dispatch({ type: 'farmer/do', kind: 'water', slotId: 'field-4' }).ok).toBe(true);
    untilIdle(game);
    expect(game.state.farm.slots.find((s) => s.id === 'field-4')).toMatchObject({ tilled: true, producerId: 'cabbage' });
    expect(game.state.farm.slots.find((s) => s.id === 'field-4')!.wet).toBeGreaterThan(0);
  });

  it('báo lỗi ngay lúc bấm: đất chưa cuốc, không đủ tiền, việc trùng', () => {
    const game = fresh();
    expect(game.dispatch({ type: 'farmer/do', kind: 'plant', slotId: 'field-0', producerId: 'cabbage' }).ok).toBe(false);
    game.state.money = 0;
    game.dispatch({ type: 'farmer/do', kind: 'till', slotId: 'field-0' });
    const broke = game.dispatch({ type: 'farmer/do', kind: 'plant', slotId: 'field-0', producerId: 'cabbage' });
    expect(broke).toEqual({ ok: false, reason: 'Không đủ tiền.' });
    expect(game.dispatch({ type: 'farmer/do', kind: 'till', slotId: 'field-0' }).ok).toBe(false);
    expect(game.state.farm.farmer.tasks).toHaveLength(1);
    expect(game.state.money).toBe(0); // chạy thử không được tiêu tiền thật
  });

  it('thu hoạch hết: xếp mọi ô chín theo đường ngắn, thu đủ, ô nào đã có việc thì không xếp lại', () => {
    const game = fresh();
    for (const id of ['field-0', 'field-8', 'field-2']) {
      Object.assign(game.state.farm.slots.find((s) => s.id === id)!, { tilled: true, producerId: 'cabbage', stage: 'ready' });
    }
    game.dispatch({ type: 'farmer/do', kind: 'harvest', slotId: 'field-8' });
    expect(game.dispatch({ type: 'farmer/doAll', kind: 'harvest' }).ok).toBe(true);
    expect(game.state.farm.farmer.tasks.map((t) => t.slotId)).toEqual(['field-8', 'field-2', 'field-0']);
    const before = game.state.inventory.cabbage ?? 0;
    untilIdle(game);
    expect((game.state.inventory.cabbage ?? 0) - before).toBe(9);
    expect(game.dispatch({ type: 'farmer/doAll', kind: 'harvest' }).ok).toBe(false);
  });

  it('huỷ việc: việc đang làm dở vẫn làm xong, việc chưa tới lượt bị bỏ', () => {
    const game = fresh();
    game.dispatch({ type: 'farmer/do', kind: 'till', slotId: 'field-0' });
    game.dispatch({ type: 'farmer/do', kind: 'till', slotId: 'field-1' });
    for (let i = 0; i < 400 && game.state.farm.farmer.work == null; i++) game.tick(0.1); // tới ô đầu
    expect(game.dispatch({ type: 'farmer/cancel' }).ok).toBe(true);
    untilIdle(game);
    expect(game.state.farm.slots.find((s) => s.id === 'field-0')!.tilled).toBe(true);
    expect(game.state.farm.slots.find((s) => s.id === 'field-1')!.tilled).toBe(false);
  });

});

describe('bác nông dân đi theo lối', () => {
  const lanes = content.balance.farmer.lanes;
  const walk = (from: { x: number; z: number }, to: { x: number; z: number }) => {
    const points = [from];
    let pos = from;
    for (let i = 0; i < 6; i++) {
      pos = nextWaypoint(pos, to, lanes);
      points.push(pos);
      if (pos === to) break;
    }
    return points;
  };

  it('chỉ đi ngang hoặc dọc, và chỉ đi dọc trên lối', () => {
    const game = newGame();
    const spots = game.state.farm.slots.map((s) => workSpot(game.ctx, s));
    const starts = [content.balance.farmer.home, ...spots];
    for (const a of starts) {
      for (const b of spots) {
        const pts = walk(a, b);
        expect(pts[pts.length - 1]).toBe(b);
        for (let i = 1; i < pts.length; i++) {
          const [p, q] = [pts[i - 1], pts[i]];
          const vertical = Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.z - q.z) > 1e-6;
          const horizontal = Math.abs(p.z - q.z) < 1e-6;
          expect(vertical || horizontal).toBe(true);
          if (vertical) expect(lanes.some((l) => Math.abs(l - p.x) < 1e-6)).toBe(true);
        }
      }
    }
  });

  it('từ chỗ đứng ban đầu ra ruộng góc trái: ra đường đất, chạy dọc, rồi rẽ ngang vào khe ruộng', () => {
    const game = newGame();
    const spot = workSpot(game.ctx, game.state.farm.slots.find((s) => s.id === 'field-0')!);
    const pts = walk(content.balance.farmer.home, spot);
    expect(pts.slice(1)).toEqual([{ x: 1.25, z: spot.z }, spot]);
  });
});

describe('phong cách quán (Nhật / Hàn / Việt)', () => {
  for (const cuisine of ['jp', 'kr', 'vn'] as const) {
    it(`quán ${cuisine}: chỉ có món của quán mình, nội thất riêng, nấu được món khởi đầu và chạy trọn ngày`, () => {
      const game = new Game(content, { seed: 11, cuisine });
      const { state } = game;
      expect(state.cuisine).toBe(cuisine);
      expect(state.menu.unlocked.length).toBeGreaterThan(0);
      for (const id of state.menu.unlocked) expect(content.recipes.get(id).cuisine).toBe(cuisine);
      for (const id of Object.values(state.decor.equipped)) {
        const only = content.decor.get(id).cuisine;
        expect(only === undefined || only === cuisine).toBe(true);
      }
      // Kho đầu ván đủ nấu mỗi món khởi đầu ít nhất 5 phần
      for (const id of state.menu.unlocked) {
        for (const ing of content.recipes.get(id).ingredients) {
          if (content.items.get(ing.item).infinite) continue;
          expect(state.inventory[ing.item] ?? 0).toBeGreaterThanOrEqual(ing.qty * 5);
        }
      }
      runDay(game);
      expect(game.state.stats.total.dishes).toBeGreaterThan(0);
    });
  }

  it('không mở được món / mua được nội thất của quán khác', () => {
    const game = new Game(content, { seed: 3, cuisine: 'jp' });
    Object.assign(game.state, { money: 99999, level: 9 });
    expect(game.dispatch({ type: 'menu/unlock', recipeId: 'pho' }).ok).toBe(false);
    expect(game.dispatch({ type: 'menu/unlock', recipeId: 'ramen' }).ok).toBe(true);
    expect(game.dispatch({ type: 'decor/buy', decorId: 'floor_encaustic' }).ok).toBe(false);
    expect(game.dispatch({ type: 'decor/buy', decorId: 'floor_hinoki' }).ok).toBe(true);
    expect(game.dispatch({ type: 'decor/buy', decorId: 'floor_marble' }).ok).toBe(true); // đồ dùng chung
  });

  it('lưu / tải giữ phong cách quán; món lạ trong save bị dọn', () => {
    const game = new Game(content, { seed: 5, cuisine: 'kr' });
    const raw = JSON.parse(serialize(game.state));
    raw.menu.unlocked.push('pho');
    raw.menu.active.push('pho');
    const state = deserialize(JSON.stringify(raw), content)!;
    expect(state.cuisine).toBe('kr');
    expect(state.menu.unlocked).not.toContain('pho');
    expect(state.menu.active).not.toContain('pho');
  });
});

describe('ruộng tự động + cối chế biến', () => {
  /** Tua tới khi bác làm hết hàng việc. */
  const settle = (game: Game, limit = 600) => {
    for (let i = 0; i < limit && game.state.farm.farmer.tasks.length; i++) game.tick(1);
    expect(game.state.farm.farmer.tasks).toHaveLength(0);
  };

  it('thu ruộng lúa mì: bác gieo lại, chở lúa tới cối xay gió, cối ra bột mì vào kho', () => {
    const game = quietGame();
    game.state.money = 1000;
    const slot = game.state.farm.slots.find((s) => s.type === 'wheat')!;
    expect(game.dispatch({ type: 'farmer/do', kind: 'plant', slotId: slot.id, producerId: 'wheat' }).ok).toBe(true);
    settle(game);
    Object.assign(slot, { stage: 'ready' });
    const flour0 = game.state.inventory.flour ?? 0;
    expect(game.dispatch({ type: 'farmer/do', kind: 'harvest', slotId: slot.id }).ok).toBe(true);
    settle(game);
    // Gieo lại tự động, không còn lúa mì trong kho hay trên máy cày
    expect(slot).toMatchObject({ producerId: 'wheat', stage: 'growing' });
    expect(game.state.inventory.wheat ?? 0).toBe(0);
    expect(game.state.farm.farmer.carry).toBeNull();
    const mill = game.state.farm.mills.find((m) => m.type === 'windmill')!;
    expect(mill.input).toBeGreaterThan(0);
    game.tick(200);
    expect(mill.input).toBe(0);
    expect((game.state.inventory.flour ?? 0) - flour0).toBe(8);
  });

  it('đổi thành phẩm của cối, mua thêm cối (tối đa 2), không giao tay việc chở hàng', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 99999, level: 9 });
    const mill = game.state.farm.mills.find((m) => m.type === 'ricemill')!;
    expect(game.dispatch({ type: 'mill/setProduct', millId: mill.id, item: 'rice_noodle' }).ok).toBe(true);
    expect(game.dispatch({ type: 'mill/setProduct', millId: mill.id, item: 'bread' }).ok).toBe(false);
    mill.input = 3;
    game.tick(40);
    expect(game.state.inventory.rice_noodle).toBe(3);
    expect(game.dispatch({ type: 'mill/buy', millType: 'windmill' }).ok).toBe(true);
    expect(game.dispatch({ type: 'mill/buy', millType: 'windmill' }).ok).toBe(false);
    expect(game.dispatch({ type: 'farmer/do', kind: 'haul', slotId: 'wheat-0' }).ok).toBe(false);
  });

  it('huỷ bớt việc vẫn giữ việc chở hàng tới cối', () => {
    const game = quietGame();
    const f = game.state.farm.farmer;
    f.carry = { item: 'wheat', qty: 5 };
    f.tasks = [{ kind: 'till', slotId: 'field-0' }, { kind: 'haul', slotId: 'wheat-0', millId: 'windmill-0' }];
    expect(game.dispatch({ type: 'farmer/cancel' }).ok).toBe(true);
    expect(f.tasks.map((t) => t.kind)).toEqual(['haul']);
    settle(game);
    expect(game.state.farm.mills.find((m) => m.id === 'windmill-0')!.input + (game.state.inventory.flour ?? 0)).toBeGreaterThan(0);
  });

  it('mua đủ mọi ô và cối: đường đi của bác không xuyên qua ô hay cối nào', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 1e7, level: 20 });
    for (const t of content.slotTypes.all()) while (game.dispatch({ type: 'farm/buySlot', slotType: t.id }).ok);
    for (const m of content.mills.all()) while (game.dispatch({ type: 'mill/buy', millType: m.id }).ok);
    for (const s of game.state.farm.slots) s.tier = (content.slotTypes.get(s.type).tiers?.length ?? 0) + 1; // ao to nhất
    const rects = game.state.farm.slots.filter((s) => !content.slotTypes.get(s.type).building).map((s) => {
      const c = slotCenter(game.ctx, s);
      const h = (content.slotTypes.get(s.type).layout.size * slotScale(game.ctx, s)) / 2;
      return { id: s.id, x1: c.x - h, x2: c.x + h, z1: c.z - h, z2: c.z + h };
    });
    for (const t of content.slotTypes.all()) {
      const b = buildingRect(game.ctx, t.id);
      if (b) rects.push({ id: t.id, ...b });
    }
    for (const m of game.state.farm.mills) {
      const c = millCenter(game.ctx, m);
      rects.push({ id: m.id, x1: c.x - 1.3, x2: c.x + 1.3, z1: c.z - 1.3, z2: c.z + 1.3 });
    }
    // Không ô / cối nào chồng lên nhau
    for (const a of rects) for (const b of rects) if (a !== b) expect(a.x1 < b.x2 && a.x2 > b.x1 && a.z1 < b.z2 && a.z2 > b.z1, `${a.id} chồng ${b.id}`).toBe(false);
    const spots = [...game.state.farm.slots.map((s) => workSpot(game.ctx, s)), ...game.state.farm.mills.map((m) => millSpot(game.ctx, m))];
    const lanes = content.balance.farmer.lanes;
    for (const a of [content.balance.farmer.home, ...spots]) {
      for (const b of spots) {
        let pos = a;
        for (let i = 0; i < 6 && pos !== b; i++) {
          const next = nextWaypoint(pos, b, lanes);
          for (const r of rects) {
            // Đoạn thẳng ngang/dọc cắt phần trong của ô?
            const x1 = Math.min(pos.x, next.x), x2 = Math.max(pos.x, next.x), z1 = Math.min(pos.z, next.z), z2 = Math.max(pos.z, next.z);
            const hit = x1 < r.x2 - 0.01 && x2 > r.x1 + 0.01 && z1 < r.z2 - 0.01 && z2 > r.z1 + 0.01;
            if (hit) expect.fail(`(${pos.x.toFixed(1)},${pos.z.toFixed(1)}) → (${next.x.toFixed(1)},${next.z.toFixed(1)}) xuyên ${r.id}`); // chỉ gọi expect khi trúng cho nhanh
          }
          pos = next;
        }
      }
    }
  });
});

describe('nhà kính', () => {
  it('8 luống có sẵn, nới dài thêm 4 luống mỗi lần (tối đa 20), rau trồng được không cần cuốc, lớn nhanh hơn ruộng', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 1e6, level: 10 });
    const plots = () => game.state.farm.slots.filter((s) => s.type === 'gplot');
    expect(plots()).toHaveLength(8);
    expect(game.dispatch({ type: 'farm/buySlot', slotType: 'gplot' }).ok).toBe(true);
    expect(plots()).toHaveLength(12);
    while (game.dispatch({ type: 'farm/buySlot', slotType: 'gplot' }).ok);
    expect(plots()).toHaveLength(20);
    // Cà chua trồng thẳng (không cuốc) trong nhà kính và cả ngoài ruộng đã cuốc: nhà kính chín trước
    const gp = plots()[0];
    const field = game.state.farm.slots.find((s) => s.id === 'field-0')!;
    field.tilled = true;
    expect(game.dispatch({ type: 'farm/plant', slotId: gp.id, producerId: 'tomato' }).ok).toBe(true);
    expect(game.dispatch({ type: 'farm/plant', slotId: field.id, producerId: 'tomato' }).ok).toBe(true);
    expect(game.dispatch({ type: 'farm/plant', slotId: plots()[1].id, producerId: 'hen' }).ok).toBe(false);
    field.wet = 1e6;
    game.tick(200);
    expect(gp.stage).toBe('ready');
    expect(field.stage).toBe('growing');
    // Bác nông dân vào cửa nhà kính để làm việc
    expect(workSpot(game.ctx, gp)).toEqual(content.slotTypes.get('gplot').building!.door);
  });
});

describe('nhiệm vụ hệ thống', () => {
  it('làm lần lượt: đạt mục tiêu thì chờ nhận thưởng, nhận xong mở nhiệm vụ kế; thưởng không tính vào doanh thu', () => {
    const game = newGame(7);
    expect(content.quests.length).toBeGreaterThanOrEqual(5);
    expect(game.state.quests).toEqual({ index: 0, progress: 0, done: false });
    expect(game.dispatch({ type: 'quest/claim' }).ok).toBe(false); // chưa xong
    runDay(game);
    expect(game.state.quests.done).toBe(true); // phục vụ đủ 3 nhóm khách trong ngày đầu
    const money = game.state.money;
    const revenue = game.state.stats.today.revenue;
    expect(game.dispatch({ type: 'quest/claim' }).ok).toBe(true);
    expect(game.state.money).toBe(money + (content.quests[0].reward.money ?? 0));
    expect(game.state.stats.today.revenue).toBe(revenue);
    expect(game.state.quests).toEqual({ index: 1, progress: 0, done: false });
  });

  it('nhiệm vụ đếm chỉ đếm khi đang làm; nhiệm vụ trạng thái đọc từ state', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 5000, level: 9 });
    // Đang ở nhiệm vụ 1 (phục vụ khách): thu hoạch không được tính
    const field = game.state.farm.slots.find((s) => s.id === 'field-0')!;
    Object.assign(field, { tilled: true });
    game.dispatch({ type: 'farm/plant', slotId: field.id, producerId: 'cabbage' });
    Object.assign(field, { stage: 'ready' });
    game.dispatch({ type: 'farm/harvest', slotId: field.id });
    expect(game.state.quests.progress).toBe(0);
    // Sang nhiệm vụ "mở khoá món" (thứ 3): mở 1 món là xong
    const unlockIndex = content.quests.findIndex((q) => q.goal.kind === 'unlock');
    game.state.quests = { index: unlockIndex, progress: 0, done: false };
    game.tick(1);
    expect(game.state.quests.done).toBe(false);
    const locked = content.recipes.all().find((r) => r.cuisine === game.state.cuisine && r.unlock.cost > 0)!;
    expect(game.dispatch({ type: 'menu/unlock', recipeId: locked.id }).ok).toBe(true);
    game.tick(1);
    expect(game.state.quests.done).toBe(true);
  });

  it('save v8 được nâng cấp: bắt đầu từ nhiệm vụ đầu tiên', () => {
    const old = JSON.parse(serialize(newGame().state));
    old.version = 8;
    delete old.quests;
    const state = deserialize(JSON.stringify(old), content)!;
    expect(state.quests).toEqual({ index: 0, progress: 0, done: false });
  });
});

describe('khách quen', () => {
  it('khách quen tới (tối đa 2 người), trả tiền thì được ghi nhận; mỗi ngày mỗi người ghé 1 lần', () => {
    const game = newGame(3);
    content.balance.regulars.chance = 1;
    try {
      for (let i = 0; i < 400 && !game.state.restaurant.parties.some((p) => p.regular); i++) game.tick(1);
      const party = game.state.restaurant.parties.find((p) => p.regular)!;
      expect(party).toBeTruthy();
      expect(party.size).toBeLessThanOrEqual(2);
      expect(['be_na', 'cu_ti']).toContain(party.regular); // chỉ 2 khách quen mở từ đầu
      expect(game.state.regulars[party.regular!].lastDay).toBe(1);
      const events: string[] = [];
      game.bus.on('regular/visited', (e) => events.push(e.regularId));
      runDay(game);
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(new Set(events).size).toBe(events.length); // không ai ghé 2 lần trong ngày
    } finally {
      content.balance.regulars.chance = 0.22;
    }
  });

  it('món ruột được ưu tiên khi đang bán; đủ 3 tim thì tặng quà (đồ trang trí bày sẵn)', () => {
    const game = quietGame();
    const party = seatParty(game, 'pair', 1);
    party.regular = 'be_na';
    game.state.menu.unlocked.push('flan');
    game.state.menu.active.push('flan');
    for (const ing of content.recipes.get('flan').ingredients) game.state.inventory[ing.item] = 20;
    game.state.regulars.be_na = { visits: 5, lastDay: 0, gifted: false };
    const visited: { hearts: number; gift: string | null }[] = [];
    game.bus.on('regular/visited', (e) => visited.push(e));
    let fav = false;
    for (let i = 0; i < 600 && game.state.restaurant.parties.includes(party); i++) {
      serve(game);
      game.tick(1);
      fav ||= game.state.restaurant.orders.some((o) => o.partyId === party.id && o.recipeId === 'flan' && o.fav);
    }
    expect(fav).toBe(true);
    expect(visited[0].hearts).toBe(3);
    expect(visited[0].gift).toBe('gift_teddy');
    expect(game.state.restaurant.props.some((p) => p.def === 'gift_teddy' && !p.stored)).toBe(true);
  });
});

describe('quán của riêng mình', () => {
  it('đặt tên quán, nhận nuôi thú cưng (có hiệu ứng), đổi qua lại miễn phí', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 5000, level: 9 });
    expect(game.dispatch({ type: 'profile/rename', name: '  Quán   Bé Na ' }).ok).toBe(true);
    expect(game.state.profile.name).toBe('Quán Bé Na');
    expect(game.dispatch({ type: 'profile/rename', name: '' }).ok).toBe(false);
    const before = modifier(game.ctx, 'patience');
    expect(game.dispatch({ type: 'pet/adopt', petId: 'cat' }).ok).toBe(true);
    expect(modifier(game.ctx, 'patience')).toBeCloseTo(before * 1.06);
    game.dispatch({ type: 'pet/adopt', petId: 'dog' });
    const money = game.state.money;
    expect(game.dispatch({ type: 'pet/adopt', petId: 'cat' }).ok).toBe(true);
    expect(game.state.money).toBe(money);
    expect(game.state.profile.pet).toBe('cat');
  });

  it('đồ trang trí: mua tự đặt chỗ trống, không chồng bàn; dời / xoay / cất / bán lại; hiệu ứng mỗi loại tính 1 lần', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 5000, level: 9 });
    const base = modifier(game.ctx, 'patience');
    expect(game.dispatch({ type: 'prop/buy', propId: 'fig_pot' }).ok).toBe(true);
    expect(game.dispatch({ type: 'prop/buy', propId: 'fig_pot' }).ok).toBe(true);
    expect(modifier(game.ctx, 'patience')).toBeCloseTo(base * 1.03);
    expect(game.dispatch({ type: 'prop/buy', propId: 'sakura' }).ok).toBe(false); // của quán Nhật
    expect(game.dispatch({ type: 'prop/buy', propId: 'gift_teddy' }).ok).toBe(false);
    const [a, b] = game.state.restaurant.props;
    expect(a.x !== b.x || a.y !== b.y).toBe(true);
    // Dời đè lên bàn bốn: không được
    const big = tablePos(game.ctx, activeTables(game.ctx).find((t) => t.id === 'medium')!);
    expect(game.dispatch({ type: 'prop/move', uid: a.uid, ...big }).ok).toBe(false);
    expect(game.dispatch({ type: 'prop/rotate', uid: a.uid }).ok).toBe(true);
    game.dispatch({ type: 'prop/store', uid: a.uid });
    game.dispatch({ type: 'prop/store', uid: b.uid });
    expect(modifier(game.ctx, 'patience')).toBeCloseTo(base);
    expect(game.dispatch({ type: 'prop/place', uid: a.uid }).ok).toBe(true);
    const money = game.state.money;
    expect(game.dispatch({ type: 'prop/sell', uid: b.uid }).ok).toBe(true);
    expect(game.state.money).toBe(money + 60);
  });

  it('mua thêm bàn (khách ngồi được), xoay bàn 90° (ghế xoay theo), bán lại bàn', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 5000, level: 9 });
    expect(game.dispatch({ type: 'table/buy', kind: 'pair' }).ok).toBe(true);
    const extra = game.state.restaurant.extraTables[0];
    expect(activeTables(game.ctx).some((t) => t.id === extra.id)).toBe(true);
    for (const t of activeTables(game.ctx).filter((t) => !t.fixed)) {
      const at = tablePos(game.ctx, t);
      expect(canPlaceTable(game.ctx, t.id, at.x, at.y)).toBeNull();
    }
    expect(game.dispatch({ type: 'layout/rotateTable', tableId: 'medium' }).ok).toBe(true);
    const medium = activeTables(game.ctx).find((t) => t.id === 'medium')!;
    expect(medium.rotated).toBe(true);
    expect([medium.w, medium.h]).toEqual([76, 120]);
    seatParty(game, 'pair', 2);
    seatParty(game, 'pair2', 2);
    expect(findSeats(game.ctx, 2)?.tableId).toBe(extra.id);
    expect(game.dispatch({ type: 'table/sell', tableId: 'pair' }).ok).toBe(false);
    expect(game.dispatch({ type: 'table/sell', tableId: extra.id }).ok).toBe(true);
    game.state.restaurant.parties = [];
    game.dispatch({ type: 'layout/reset' });
    expect(activeTables(game.ctx).find((t) => t.id === 'medium')!.rotated).toBeFalsy();
  });

  it('nâng hạng quán: cần cấp + tiền, khu ăn uống sâu thêm, có hiệu ứng lượng khách', () => {
    const game = quietGame();
    game.state.money = 99999;
    expect(game.dispatch({ type: 'restaurant/upgrade' }).ok).toBe(false); // cấp 1
    game.state.level = 9;
    const spawn = modifier(game.ctx, 'spawnRate');
    expect(game.dispatch({ type: 'restaurant/upgrade' }).ok).toBe(true);
    expect(game.state.restaurant.tier).toBe(2);
    expect(modifier(game.ctx, 'spawnRate')).toBeCloseTo(spawn * 1.1);
    expect(canPlaceTable(game.ctx, 'pair', 120, 520)).toBeNull(); // vùng mới mở
    while (game.dispatch({ type: 'restaurant/upgrade' }).ok);
    expect(game.state.restaurant.tier).toBe(content.room.tiers.length);
  });

  it('save v9 được nâng cấp lên v10', () => {
    const old = JSON.parse(serialize(newGame().state));
    old.version = 9;
    delete old.regulars;
    delete old.profile;
    delete old.restaurant.props;
    delete old.restaurant.extraTables;
    delete old.restaurant.tier;
    const state = deserialize(JSON.stringify(old), content)!;
    expect(state.profile.name).toBe('Quán Nhà Vườn');
    expect(state.restaurant.tier).toBe(1);
    expect(state.restaurant.props).toEqual([]);
  });
});

describe('ca làm, khay bưng nhiều món, dọn dẹp (đợt 14)', () => {
  it('ngày 06:00–24:00; chỉ đón khách trong 2 ca, giờ nghỉ trưa không có khách mới; hết ca sàn có vết bẩn', () => {
    const game = newGame(5);
    expect(game.state.clock.minute).toBe(6 * 60);
    const events: string[] = [];
    game.bus.on('shift/started', (e) => events.push(`start${e.index}`));
    game.bus.on('shift/ended', (e) => events.push(`end${e.index}`));
    const arrivals: number[] = [];
    game.bus.on('party/arrived', () => arrivals.push(game.state.clock.minute));
    game.tick(15 * 60 - 6 * 60 + 1); // tới 15:01
    expect(events).toEqual(['start0', 'end0', 'start1']);
    expect(arrivals.length).toBeGreaterThan(0);
    expect(arrivals.every((m) => m >= 7 * 60 && m < 12 * 60 + 1)).toBe(true);
    expect(game.state.restaurant.stains.length).toBe(content.balance.stains.perShift);
  });

  it('khay: giao 2 món của bàn trong một lượt (bồi bàn bưng cả khay)', () => {
    const game = quietGame();
    const r = game.state.restaurant;
    game.state.menu.active = ['egg_rice'];
    const party = seatParty(game, 'pair', 2);
    Object.assign(party, { phase: 'readyToOrder' });
    game.dispatch({ type: 'service/takeOrder', partyId: party.id });
    game.tick(3);
    expect(r.orders).toHaveLength(2);
    for (const o of r.orders) o.status = 'ready';
    r.staff.forEach((s) => (s.orderId = null));
    expect(game.dispatch({ type: 'service/deliver', orderIds: r.orders.map((o) => o.id), partyId: party.id }).ok).toBe(true);
    expect(r.waiter.tasks).toHaveLength(1);
    let carried = 0;
    for (let i = 0; i < 20 && !r.orders.every((o) => o.status === 'served'); i++) {
      game.tick(0.25);
      carried = Math.max(carried, r.waiter.carrying.length);
    }
    expect(carried).toBe(2);
    expect(r.orders.every((o) => o.status === 'served')).toBe(true);
    game.tick(0.1);
    expect(party.phase).toBe('eating');
  });

  it('khách trả tiền để lại chén dĩa dơ: bàn dơ không xếp khách tới khi dọn; bồi bàn rảnh thì đứng yên tại chỗ', () => {
    const game = quietGame();
    const r = game.state.restaurant;
    const party = seatParty(game, 'pair', 2);
    Object.assign(party, { phase: 'eating', timer: 0.5 });
    game.tick(1);
    expect(r.parties).toHaveLength(0);
    expect(r.dirty.pair).toEqual([0, 1]);
    seatParty(game, 'pair2', 2);
    seatParty(game, 'medium', 3);
    expect(findSeats(game.ctx, 2)).toBeNull(); // bàn đôi dơ, các bàn khác có khách
    expect(game.dispatch({ type: 'service/clean', tableId: 'pair' }).ok).toBe(true);
    expect(game.dispatch({ type: 'service/clean', tableId: 'pair' }).ok).toBe(false);
    for (let i = 0; i < 20 && r.dirty.pair; i++) game.tick(0.25);
    expect(r.dirty.pair).toBeUndefined();
    expect(findSeats(game.ctx, 2)?.tableId).toBe('pair');
    const at = { x: r.waiter.x, y: r.waiter.y };
    game.tick(5);
    expect({ x: r.waiter.x, y: r.waiter.y }).toEqual(at);
  });

  it('vết bẩn làm khách kém kiên nhẫn; lau xong thì hết', () => {
    const game = quietGame();
    const r = game.state.restaurant;
    const clean = modifier(game.ctx, 'patience');
    r.stains.push({ id: 900, x: 200, y: 300, level: 2 });
    expect(modifier(game.ctx, 'patience')).toBeLessThan(clean);
    expect(game.dispatch({ type: 'service/mop', stainId: 900 }).ok).toBe(true);
    for (let i = 0; i < 20 && r.stains.length; i++) game.tick(0.25);
    expect(r.stains).toHaveLength(0);
    expect(modifier(game.ctx, 'patience')).toBeCloseTo(clean);
  });

  it('vườn cây ăn quả: có sẵn cam + táo đang lớn, cây ra trái mãi', () => {
    const game = quietGame();
    const trees = game.state.farm.slots.filter((s) => s.type === 'orchard');
    expect(trees.map((s) => s.producerId)).toEqual(['orange_tree', 'apple_tree']);
    trees[0].stage = 'ready';
    expect(game.dispatch({ type: 'farm/harvest', slotId: trees[0].id }).ok).toBe(true);
    expect(game.state.inventory.orange).toBe(6);
    expect(trees[0].producerId).toBe('orange_tree');
  });

  it('save v10 được nâng cấp lên v11 (khay, chén dĩa dơ, vết bẩn; quán nhỏ lại thì bàn cũ ngoài phòng về chỗ)', () => {
    const old = JSON.parse(serialize(newGame().state));
    old.version = 10;
    old.restaurant.waiter.carrying = null;
    old.restaurant.waiter.tasks = [];
    delete old.restaurant.dirty;
    delete old.restaurant.stains;
    old.restaurant.layout = { pair: { x: 560, y: 500 }, big: { x: 300, y: 300 } };
    const state = deserialize(JSON.stringify(old), content)!;
    expect(state.restaurant.waiter.carrying).toEqual([]);
    expect(state.restaurant.dirty).toEqual({});
    expect(state.restaurant.layout).toEqual({});
  });
});

describe('nhân viên phục vụ thuê thêm', () => {
  it('chỉ thuê được khi lên hạng quán (mỗi bậc +1, tối đa 4)', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 1e6, level: 20 });
    expect(game.dispatch({ type: 'helper/hire' }).ok).toBe(false);
    game.dispatch({ type: 'restaurant/upgrade' });
    expect(game.dispatch({ type: 'helper/hire' }).ok).toBe(true);
    expect(game.dispatch({ type: 'helper/hire' }).ok).toBe(false);
    while (game.dispatch({ type: 'restaurant/upgrade' }).ok);
    while (game.dispatch({ type: 'helper/hire' }).ok);
    expect(game.state.restaurant.helpers).toHaveLength(4);
    expect(new Set(game.state.restaurant.helpers.map((h) => h.name)).size).toBe(4);
  });

  it('tự nhận việc được giao (mang menu), tốn năng lượng; tắt việc thì không nhận', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 1e6, level: 20 });
    game.dispatch({ type: 'restaurant/upgrade' });
    game.dispatch({ type: 'helper/hire' });
    const h = game.state.restaurant.helpers[0];
    game.dispatch({ type: 'helper/setJob', helperId: h.id, job: 'menu', on: false });
    const party = seatParty(game, 'pair', 2);
    game.tick(2);
    expect(party.phase).toBe('seated');
    game.dispatch({ type: 'helper/setJob', helperId: h.id, job: 'menu', on: true });
    for (let i = 0; i < 40 && party.phase === 'seated'; i++) game.tick(0.5);
    expect(party.phase).toBe('browsing');
    expect(h.energy).toBe(content.balance.helpers.maxEnergy - content.balance.helpers.energyPerTask);
  });

  it('cạn năng lượng thì xỉu (bỏ việc), bồi dưỡng 100 xu thì tỉnh lại', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 1e6, level: 20 });
    game.dispatch({ type: 'restaurant/upgrade' });
    game.dispatch({ type: 'helper/hire' });
    const h = game.state.restaurant.helpers[0];
    h.energy = 1;
    const party = seatParty(game, 'pair', 2);
    for (let i = 0; i < 40 && !h.fainted; i++) game.tick(0.5);
    expect(h.fainted).toBe(true);
    // Đang xỉu thì không nhận việc nữa
    const other = seatParty(game, 'pair2', 2);
    game.tick(5);
    expect(other.called).toBe(false);
    void party;
    const money = game.state.money;
    expect(game.dispatch({ type: 'helper/revive', helperId: h.id }).ok).toBe(true);
    expect(game.state.money).toBe(money - content.balance.helpers.reviveCost);
    expect(h.fainted).toBe(false);
    expect(h.energy).toBe(content.balance.helpers.reviveEnergy);
  });

  it('chỉ đi ăn hàng rong trong giờ nghỉ: vắng mặt một lúc rồi về, năng lượng tăng theo món', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 1e6, level: 20 });
    game.dispatch({ type: 'restaurant/upgrade' });
    game.dispatch({ type: 'helper/hire' });
    const h = game.state.restaurant.helpers[0];
    h.energy = 10;
    game.state.clock.minute = 9 * 60; // đang trong ca sáng
    expect(game.dispatch({ type: 'helper/eat', helperId: h.id, stallId: 'hutieu' }).ok).toBe(false);
    game.state.clock.minute = 12 * 60 + 30; // nghỉ trưa
    expect(game.dispatch({ type: 'helper/eat', helperId: h.id, stallId: 'meat' }).ok).toBe(false); // sạp thịt không bán đồ ăn
    expect(game.dispatch({ type: 'helper/eat', helperId: h.id, stallId: 'hutieu' }).ok).toBe(true);
    expect(h.away?.stallId).toBe('hutieu');
    game.tick(content.stalls.get('hutieu').staffMeal!.minutes + 1);
    expect(h.away).toBeNull();
    expect(h.energy).toBe(10 + content.stalls.get('hutieu').staffMeal!.energy);
    // Thứ tự năng lượng: cà phê < bánh tráng < hủ tiếu < tiệm ăn vặt
    const gain = ['cafe', 'banhtrang', 'hutieu', 'snack'].map((id) => content.stalls.get(id).staffMeal!.energy);
    expect([...gain].sort((a, b) => a - b)).toEqual(gain);
  });

  it('save v11 được nâng cấp lên v12', () => {
    const old = JSON.parse(serialize(newGame().state));
    old.version = 11;
    delete old.restaurant.helpers;
    const state = deserialize(JSON.stringify(old), content)!;
    expect(state.restaurant.helpers).toEqual([]);
  });
});
