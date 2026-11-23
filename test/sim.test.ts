import { describe, expect, it } from 'vitest';
import { createContent, type CuisineId } from '../src/data';
import { Game } from '../src/sim/game';
import { modifier } from '../src/sim/helpers';
import { deserialize, exportSave, readSaveFile, serialize } from '../src/sim/save';
import { canPlaceTable, roomOf, seatSpots, serviceSpot, tablePos } from '../src/sim/layout';
import { activeTables, findSeats, spawnParty } from '../src/sim/systems/customers';
import { priceOf } from '../src/sim/systems/market';
import { calendarOf, festivalOf, seasonalPrice } from '../src/sim/calendar';
import { DAYS_PER_SEASON } from '../src/data/calendar';
import { FARM_DAY } from '../src/data/farm';
import { autoServeCommands } from '../src/sim/systems/service';
import { billDue, missingEnergy } from '../src/sim/systems/crew';
import { maxHelpers } from '../src/sim/systems/helpers';
import { sellPrice } from '../src/sim/systems/contracts';
import { buildingRect, nextWaypoint, slotCenter, slotScale, workSpot } from '../src/sim/systems/farmer';
import { millCenter, millSpot } from '../src/sim/systems/mills';
import { moodOf } from '../src/sim/systems/customers';
import { nextWaypoint as walkWaypoint } from '../src/sim/pathing';
import { ownerName, type FarmSlot, type Party } from '../src/sim/state';

const content = createContent();
const newGame = (seed = 42, cuisine?: CuisineId) => new Game(content, { seed, cuisine });

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

/**
 * Cho thời gian trôi `minutes` phút nông trại, qua nhiều ngày nếu cần (hết ngày thì sang ngày mới — qua đêm nông trại
 * được cộng `nightMinutes`). Cây / con lớn tính bằng ngày nên test nông trại dùng hàm này thay cho tick.
 */
function advance(game: Game, minutes: number): void {
  let left = minutes;
  for (let i = 0; i < 100000 && left > 0; i++) {
    if (game.state.clock.phase === 'summary') {
      game.dispatch({ type: 'day/next' });
      left -= content.balance.nightMinutes;
      continue;
    }
    const step = Math.min(left, 30);
    game.tick(step);
    left -= step;
  }
}

/** Đặt sẵn 1 nhóm khách đã ngồi ở bàn `tableId` (bỏ qua xếp hàng). */
function seatParty(game: Game, tableId: string, size: number, seats: number[] = Array.from({ length: size }, (_, i) => i)): Party {
  const party: Party = { id: game.state.nextId++, size, phase: 'seated', tableId, seats, patience: 999, patienceMax: 999, timer: 0, orderIds: [], looks: seats.map(() => 0), called: false, wait: 0, regular: null };
  game.state.restaurant.parties.push(party);
  return party;
}

/** Số ghế đang có khách ở một bàn. */
function occupiedSeatsOf(game: Game, tableId: string): number {
  return game.state.restaurant.parties.filter((p) => p.tableId === tableId).reduce((s, p) => s + p.seats.length, 0);
}

/** Game không có khách tự tới và thời tiết cố định — để dựng tình huống phục vụ bằng tay. */
/** Một nhóm khách mới tới (cỡ nhóm ngẫu nhiên theo luật), giữ nguyên trong hàng chờ. */
function spawnPartyFor(game: Game): Party {
  return spawnParty(game.ctx);
}

function quietGame(cuisine?: CuisineId): Game {
  const game = newGame(42, cuisine);
  game.state.restaurant.spawnTimer = 1e9;
  game.state.weather = { id: 'cloudy', minutesLeft: 1e9 };
  game.state.clock.minute = 8 * 60; // trong ca sáng (ngoài ca khách chưa gọi món sẽ về)
  return game;
}

describe('nội dung', () => {
  it('hợp lệ; quán khởi đầu có quầy 3 ghế đơn + 1 bàn bốn + 2 bàn đôi (quán ốc: 3 bàn đôi, không có quầy)', () => {
    const start = activeTables(newGame(42, 'kr').ctx);
    expect(start.map((t) => t.seats).sort()).toEqual([2, 2, 3, 4]);
    expect(start.filter((t) => t.shared)).toHaveLength(1);
    const oc = new Game(content, { seed: 1, cuisine: 'oc' });
    const street = activeTables(oc.ctx);
    expect(street.map((t) => t.seats).sort()).toEqual([2, 2, 2, 4]);
    expect(street.some((t) => t.shared)).toBe(false);
    for (const t of street) expect(canPlaceTable(oc.ctx, t.id, tablePos(oc.ctx, t).x, tablePos(oc.ctx, t).y), t.id).toBeNull();
    // Khách đi một mình ở quán ốc ngồi bàn đôi
    expect(findSeats(oc.ctx, 1)?.tableId).toMatch(/pair/);
  });

  it('giai đoạn 16: quán Nhật quầy chữ L (2 ghế đơn + 2 quầy đôi gắn cố định) + bàn bốn; quán Việt 2 bàn đơn + 2 bàn đôi + bàn bốn, không quầy', () => {
    const jp = new Game(content, { seed: 1, cuisine: 'jp' });
    const jt = activeTables(jp.ctx);
    expect(jt.map((t) => t.seats).sort()).toEqual([2, 2, 2, 4]);
    expect(jt.filter((t) => t.bar === 'east').map((t) => t.id).sort()).toEqual(['pair', 'pair2']);
    expect(jt.find((t) => t.id === 'counter')!.seats).toBe(2);
    expect(roomOf(jp.ctx).height).toBeGreaterThan(roomOf(jp.ctx).width); // quán Nhật: mặt hẹp ra đường, sâu vào trong
    expect(canPlaceTable(jp.ctx, 'pair', 300, 500)).toMatch(/cố định/);
    // Ghế quầy dọc nằm phía Đông quầy, ngoài khối bếp; chỗ bồi bàn đứng phục vụ cũng ngoài khối bếp
    for (const id of ['pair', 'pair2']) {
      const t = jt.find((x) => x.id === id)!;
      for (const s of seatSpots(t, tablePos(jp.ctx, t))) expect(s.x).toBeGreaterThan(t.x + t.w / 2);
      const stand = serviceSpot(t, tablePos(jp.ctx, t), [0, 1]);
      expect(roomOf(jp.ctx).walls!.some((w) => stand.x > w.x1 && stand.x < w.x2 && stand.y > w.y1 && stand.y < w.y2)).toBe(false);
    }
    const medium = jt.find((t) => t.id === 'medium')!;
    // Bàn bốn kê sát tường phải: không ghế nào nằm giữa bàn và tường; 2 ghế phía trong + 2 ghế ở 2 đầu bàn
    const mSeats = seatSpots(medium, tablePos(jp.ctx, medium));
    expect(mSeats.every((s) => s.x <= medium.x)).toBe(true);
    expect(mSeats.filter((s) => s.x < medium.x - medium.w / 2)).toHaveLength(2);
    expect(medium.x + medium.w / 2).toBeGreaterThan(roomOf(jp.ctx).dining.x2 - 10);
    expect(findSeats(jp.ctx, 4)?.tableId).toBe('medium');
    expect(roomOf(jp.ctx).passStand!.x).toBeGreaterThan(192); // quầy line ra giữa tường sau, ngoài quầy chữ L
    expect(canPlaceTable(jp.ctx, 'medium', 100, 200)).not.toBeNull(); // trong gian bếp
    const vn = new Game(content, { seed: 1, cuisine: 'vn' });
    const vt = activeTables(vn.ctx);
    expect(vt.map((t) => t.seats).sort()).toEqual([1, 1, 2, 2, 4]);
    expect(vt.some((t) => t.shared)).toBe(false);
    for (const t of vt) expect(canPlaceTable(vn.ctx, t.id, tablePos(vn.ctx, t).x, tablePos(vn.ctx, t).y), t.id).toBeNull();
    expect(findSeats(vn.ctx, 1)?.tableId).toMatch(/single/);
    expect(canPlaceTable(vn.ctx, 'pair', 80, 400)).not.toBeNull(); // bếp sát cửa bên trái
  });
});

describe('xếp bàn', () => {
  it('khách lẻ ngồi quầy, nhóm 4 ngồi bàn bốn, nhóm 2 ngồi bàn đôi', () => {
    const { ctx } = newGame(42, 'kr');
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
    advance(game, content.producers.get('cabbage').growTime + 1);
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
    // Thả cá giống một lần: lớn 5 ngày thu 15 con, sau đó cứ 5 ngày thu một lứa (không phải thả lại)
    expect(game.dispatch({ type: 'farm/plant', slotId: 'pond-0', producerId: 'fish_fry' }).ok).toBe(true);
    const harvestAfter = (minutes: number) => {
      const before = game.state.inventory.fish ?? 0;
      advance(game, minutes);
      expect(game.dispatch({ type: 'farm/harvest', slotId: 'pond-0' }).ok).toBe(true);
      return (game.state.inventory.fish ?? 0) - before;
    };
    expect(harvestAfter(fry.growTime + 1)).toBe(fry.yields[0].qty);
    expect(game.state.farm.slots.find((s) => s.id === 'pond-0')?.producerId).toBe('fish_fry');
    expect(game.dispatch({ type: 'farm/upgradeSlot', slotId: 'pond-0' }).ok).toBe(true);
    expect(harvestAfter(fry.regrowTime! + 1)).toBe(Math.round(fry.yields[0].qty * 1.6));
    expect(game.dispatch({ type: 'farm/upgradeSlot', slotId: 'pond-0' }).ok).toBe(true);
    expect(game.dispatch({ type: 'farm/upgradeSlot', slotId: 'pond-0' }).ok).toBe(false);
    expect(game.dispatch({ type: 'farm/upgradeSlot', slotId: 'field-0' }).ok).toBe(false);
  });

  it('thời gian lớn tính bằng ngày: rau cải 1 ngày, hành tây 5 ngày, heo 5, bò 7; cây ăn quả 8 ngày rồi 1 ngày một lứa', () => {
    const day = FARM_DAY;
    const days = (id: string) => content.producers.get(id).growTime / day;
    expect(days('cabbage')).toBe(1);
    expect(days('onion')).toBe(5);
    expect(days('hen')).toBe(2);
    expect(days('pig')).toBe(5);
    expect(days('cattle')).toBe(7);
    expect(days('dairy_cow')).toBe(7);
    expect(days('orange_tree')).toBe(8);
    expect(content.producers.get('orange_tree').regrowTime).toBe(day);
    expect(days('wheat')).toBe(3);
    const crops = content.producers.all().filter((p) => p.slot === 'field');
    expect(crops.every((p) => p.growTime >= day && p.growTime <= 5 * day)).toBe(true);
    // Ao nhanh hơn ~40%: cá 3 ngày, cá hồi 4, tôm / ốc / sò 3.5; lứa sau 3 ngày, 15 con
    expect(days('fish_fry')).toBe(3);
    expect(days('salmon_fry')).toBe(4);
    // Ốc, sò nuôi ở ao giống tôm
    for (const id of ['oc_huong_fry', 'oc_mong_tay_fry', 'so_diep_fry', 'ngheu_fry', 'hau_fry', 'oc_bu_fry']) {
      const p = content.producers.get(id);
      expect([p.slot, p.growTime / day, p.regrowTime! / day, p.yields[0].qty]).toEqual(['pond', 3.5, 3, 30]);
    }
  });

  it('kết thúc ngày sớm vẫn đủ 1 ngày nông trại: rau cải gieo sáng nay, sáng mai thu được', () => {
    const game = quietGame();
    game.state.money = 1000;
    game.state.clock.minute = 7 * 60;
    game.dispatch({ type: 'farm/till', slotId: 'field-0' });
    game.dispatch({ type: 'farm/plant', slotId: 'field-0', producerId: 'cabbage' });
    game.state.farm.slots[0].wet = 1e6;
    game.tick(21 * 60 - 7 * 60);
    expect(game.dispatch({ type: 'day/end' }).ok).toBe(true);
    for (let i = 0; i < 200 && game.state.clock.phase !== 'summary'; i++) game.tick(1);
    expect(game.dispatch({ type: 'day/next' }).ok).toBe(true);
    game.tick(60 + 1); // tới 07:01 sáng hôm sau
    expect(game.state.farm.slots[0].stage).toBe('ready');
  });

  it('sang mùa Đông gà mái đẻ, bò sữa hết lứa; gà thịt / heo vẫn còn (ngừng lớn)', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 5000, level: 5 });
    game.state.clock.day = 3 * DAYS_PER_SEASON; // ngày cuối mùa Thu
    expect(game.dispatch({ type: 'farm/buySlot', slotType: 'pen' }).ok).toBe(true); // ván mới chỉ có 1 chuồng
    expect(game.dispatch({ type: 'farm/plant', slotId: 'pen-0', producerId: 'hen' }).ok).toBe(true);
    expect(game.dispatch({ type: 'farm/plant', slotId: 'pen-1', producerId: 'pig' }).ok).toBe(true);
    let culled = 0;
    game.bus.on('farm/culled', (e) => (culled = e.count));
    runDay(game, false);
    game.dispatch({ type: 'day/next' });
    const pen = (id: string) => game.state.farm.slots.find((s) => s.id === id)!;
    expect(pen('pen-0').producerId).toBeNull();
    expect(pen('pen-1').producerId).toBe('pig');
    expect(culled).toBe(1);
  });

  it('vật nuôi cho sản phẩm nhiều lần', () => {
    const game = newGame();
    const hen = content.producers.get('hen');
    game.state.menu.active = []; // không bán gì để kho không bị trừ
    const eggs = game.state.inventory.egg;
    expect(game.dispatch({ type: 'farm/plant', slotId: 'pen-0', producerId: 'hen' }).ok).toBe(true);
    advance(game, hen.growTime + 1);
    game.dispatch({ type: 'farm/harvest', slotId: 'pen-0' });
    advance(game, hen.regrowTime! + 1);
    game.dispatch({ type: 'farm/harvest', slotId: 'pen-0' });
    expect(game.state.inventory.egg).toBe(eggs + 2 * hen.yields[0].qty); // thu 2 lứa
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

  it('xuất / nhập file save (E2): mở lại được, chặn file lạ và file từ bản mới hơn', () => {
    const a = newGame(9, 'jp');
    a.dispatch({ type: 'profile/rename', name: 'Quán Thử' });
    a.tick(300);
    const file = readSaveFile(exportSave(a.state), content);
    expect(file.ok).toBe(true);
    if (!file.ok) return;
    expect(file.state.profile.name).toBe('Quán Thử');
    expect(file.state.cuisine).toBe('jp');
    expect(serialize(new Game(content, { state: deserialize(file.raw, content)! }).state)).toBe(serialize(a.state));
    // Chuỗi save thô (chép từ localStorage) cũng mở được
    expect(readSaveFile(serialize(a.state), content).ok).toBe(true);
    for (const bad of ['{oops', '[]', '{"hello":1}', JSON.stringify({ kind: 'khac', save: {} })]) expect(readSaveFile(bad, content).ok).toBe(false);
    const newer = JSON.parse(serialize(a.state));
    newer.version += 1;
    const res = readSaveFile(JSON.stringify(newer), content);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain('mới hơn');
  });
});

describe('lịch', () => {
  it('ngày 1 là Thứ Hai mùng 1 mùa Xuân năm 1; qua mùa, qua năm đúng', () => {
    expect(calendarOf(1)).toEqual({ weekday: 0, dayOfSeason: 1, season: 0, year: 1 });
    expect(calendarOf(7).weekday).toBe(6);
    expect(calendarOf(8).weekday).toBe(0);
    expect(calendarOf(14)).toMatchObject({ dayOfSeason: 14, season: 0 });
    expect(calendarOf(15)).toMatchObject({ dayOfSeason: 1, season: 1, year: 1 });
    expect(calendarOf(57)).toMatchObject({ dayOfSeason: 1, season: 0, year: 2 });
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
    game.tick(content.balance.eatTime[party.size - 1][1] + 1);
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
    game.state.money = -content.balance.debtLimit; // đã nợ tới mức tối đa
    game.dispatch({ type: 'farmer/do', kind: 'till', slotId: 'field-0' });
    const broke = game.dispatch({ type: 'farmer/do', kind: 'plant', slotId: 'field-0', producerId: 'cabbage' });
    expect(broke).toEqual({ ok: false, reason: 'Không đủ tiền.' });
    expect(game.dispatch({ type: 'farmer/do', kind: 'till', slotId: 'field-0' }).ok).toBe(false);
    expect(game.state.farm.farmer.tasks).toHaveLength(1);
    expect(game.state.money).toBe(-content.balance.debtLimit); // chạy thử không được tiêu tiền thật
  });

  it('thu hoạch hết: xếp mọi ô chín theo đường ngắn, thu đủ, ô nào đã có việc thì không xếp lại', () => {
    const game = fresh();
    for (const id of ['field-0', 'field-5', 'field-2']) {
      Object.assign(game.state.farm.slots.find((s) => s.id === id)!, { tilled: true, producerId: 'cabbage', stage: 'ready' });
    }
    game.dispatch({ type: 'farmer/do', kind: 'harvest', slotId: 'field-5' });
    expect(game.dispatch({ type: 'farmer/doAll', kind: 'harvest' }).ok).toBe(true);
    expect(game.state.farm.farmer.tasks.map((t) => t.slotId)).toEqual(['field-5', 'field-2', 'field-0']);
    const before = game.state.inventory.cabbage ?? 0;
    untilIdle(game);
    expect((game.state.inventory.cabbage ?? 0) - before).toBe(3 * content.producers.get('cabbage').yields[0].qty);
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
      pos = nextWaypoint(pos, to, lanes, content.balance.farmer.side);
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
          if (vertical) expect([...lanes, ...(content.balance.farmer.side ?? []).map((s) => s.x)].some((l) => Math.abs(l - p.x) < 1e-6)).toBe(true);
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

describe('phong cách quán (Nhật / Hàn / Việt / Ốc)', () => {
  for (const cuisine of ['jp', 'kr', 'vn', 'oc'] as const) {
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
    game.tick(400);
    expect(mill.input).toBe(0);
    expect((game.state.inventory.flour ?? 0) - flour0).toBe(content.producers.get('wheat').yields[0].qty);
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
    // Ô nuôi của ao (perTier) chung một mặt ao: chỉ tính một lần
    const rects = game.state.farm.slots.filter((s, _, all) => !content.slotTypes.get(s.type).building && (!content.slotTypes.get(s.type).perTier || s === all.find((x) => x.type === s.type))).map((s) => {
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
          const next = nextWaypoint(pos, b, lanes, content.balance.farmer.side);
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

describe('ao nhiều loại', () => {
  it('ao có sẵn 3 ô nuôi (mỗi loại một ô), nới rộng thêm 2 ô mỗi bậc, tối đa 9; không mua ô lẻ', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 1e6, level: 10 });
    const ponds = () => game.state.farm.slots.filter((s) => s.type === 'pond');
    expect(ponds()).toHaveLength(3);
    expect(game.state.farm.slots.filter((s) => s.type === 'field')).toHaveLength(6);
    expect(game.state.farm.slots.filter((s) => s.type === 'pen')).toHaveLength(1);
    expect(game.dispatch({ type: 'farm/buySlot', slotType: 'pond' }).ok).toBe(false);
    expect(game.dispatch({ type: 'farm/plant', slotId: 'pond-0', producerId: 'fish_fry' }).ok).toBe(true);
    expect(game.dispatch({ type: 'farm/plant', slotId: 'pond-1', producerId: 'fish_fry' }).ok).toBe(false); // trùng loại
    expect(game.dispatch({ type: 'farm/plant', slotId: 'pond-1', producerId: 'shrimp_fry' }).ok).toBe(true);
    for (const n of [5, 7, 9]) {
      expect(game.dispatch({ type: 'farm/upgradeSlot', slotId: 'pond-2' }).ok).toBe(true);
      expect(ponds()).toHaveLength(n);
      expect(new Set(ponds().map((p) => p.tier)).size).toBe(1); // cả mặt ao cùng bậc
    }
    expect(game.dispatch({ type: 'farm/upgradeSlot', slotId: 'pond-0' }).ok).toBe(false); // đã tối đa
  });

  it('save cũ (v25): ao bậc 2 được bù thành 5 ô nuôi cùng bậc', () => {
    const game = quietGame();
    const old = JSON.parse(serialize(game.state));
    old.version = 25;
    old.farm.slots = old.farm.slots.filter((s: { type: string; id: string }) => s.type !== 'pond' || s.id === 'pond-0');
    old.farm.slots.find((s: { id: string }) => s.id === 'pond-0').tier = 2;
    const loaded = deserialize(JSON.stringify(old), content)!;
    const ponds = loaded.farm.slots.filter((s) => s.type === 'pond');
    expect(ponds.map((p) => p.id)).toEqual(['pond-0', 'pond-1', 'pond-2', 'pond-3', 'pond-4']);
    expect(ponds.every((p) => p.tier === 2)).toBe(true);
  });
});

describe('nhà kính', () => {
  it('6 luống có sẵn, nới dài thêm 4 luống mỗi lần (tối đa 20), rau trồng được không cần cuốc, lớn nhanh hơn ruộng', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 1e6, level: 10 });
    const plots = () => game.state.farm.slots.filter((s) => s.type === 'gplot');
    expect(plots()).toHaveLength(6);
    expect(game.dispatch({ type: 'farm/buySlot', slotType: 'gplot' }).ok).toBe(true);
    expect(plots()).toHaveLength(10);
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
    advance(game, content.producers.get('tomato').growTime / 1.3 + 60);
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

  it('món ruột được ưu tiên khi đang bán; đủ 3 tim thì tặng quà (vào kho, tự bày ra)', () => {
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
    // Quà vào kho (cất sẵn), người chơi tự bày ra
    const gift = game.state.restaurant.props.find((p) => p.def === 'gift_teddy')!;
    expect(gift.stored).toBe(true);
    expect(game.dispatch({ type: 'prop/place', uid: gift.uid }).ok).toBe(true);
    expect(gift.stored).toBe(false);
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
    // Giai đoạn 15: chó và mèo ở quán cùng lúc, hiệu ứng cộng cả hai; cho một bé nghỉ thì còn bé kia
    expect(game.state.profile.petsOut.sort()).toEqual(['cat', 'dog']);
    expect(modifier(game.ctx, 'patience')).toBeCloseTo(before * 1.06);
    expect(game.dispatch({ type: 'pet/set', petId: 'cat', out: false }).ok).toBe(true);
    expect(game.state.profile.petsOut).toEqual(['dog']);
    expect(modifier(game.ctx, 'patience')).toBeCloseTo(before);
    // Save cũ (v23, một con ở quán) lên v24
    const old = JSON.parse(serialize(game.state));
    old.version = 23;
    old.profile = { name: 'x', pet: 'cat', pets: ['cat', 'dog'] };
    expect(deserialize(JSON.stringify(old), content)!.profile).toEqual({ name: 'x', pets: ['cat', 'dog'], petsOut: ['cat'] });
  });

  it('giai đoạn 15: tủ kem (+30% kiên nhẫn) có ở Siêu thị', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 5000, level: 9 });
    const before = modifier(game.ctx, 'patience');
    expect(game.dispatch({ type: 'upgrade/buy', upgradeId: 'icecream' }).ok).toBe(true);
    expect(modifier(game.ctx, 'patience')).toBeCloseTo(before * 1.3);
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
    const game = quietGame('kr');
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
    expect(arrivals.every((m) => (m >= 7 * 60 && m < 12 * 60 + 1) || m >= 15 * 60)).toBe(true);
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
    expect(game.state.inventory.orange).toBe(content.producers.get('orange_tree').yields[0].qty);
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

  it('tự nhận việc được giao (mang menu — không tốn sức); tắt việc thì không nhận', () => {
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
    expect(h.energy).toBe(content.balance.crew.maxEnergy); // mang menu không tốn sức
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
    expect(game.dispatch({ type: 'crew/revive', who: h.id }).ok).toBe(true);
    expect(game.state.money).toBe(money - content.balance.crew.reviveCost);
    expect(h.fainted).toBe(false);
    expect(h.energy).toBe(content.balance.crew.maxEnergy / 2);
  });

  it('giai đoạn 15: từ 2 nhân viên — người đầu làm quản lý, mỗi người giữ một bàn; có ngày 1 người bệnh nghỉ; đi chậm hơn bồi bàn', async () => {
    const { isManager, teamMode } = await import('../src/sim/systems/helpers');
    const game = quietGame();
    Object.assign(game.state, { money: 1e6, level: 20 });
    while (game.dispatch({ type: 'restaurant/upgrade' }).ok);
    game.dispatch({ type: 'helper/hire' });
    expect(teamMode(game.ctx)).toBe(false);
    game.dispatch({ type: 'helper/hire' });
    const [a, b] = game.state.restaurant.helpers;
    expect(teamMode(game.ctx)).toBe(true);
    expect(isManager(game.ctx, a.id)).toBe(true);
    expect(isManager(game.ctx, b.id)).toBe(false);
    // Hai bàn cần menu: mỗi người nhận một bàn, giữ luôn bàn đó
    const p1 = seatParty(game, 'pair', 2);
    const p2 = seatParty(game, 'pair2', 2);
    game.tick(0.2);
    const held = [a.focus?.partyId, b.focus?.partyId].sort();
    expect(held).toEqual([p1.id, p2.id].sort());
    const owner = a.focus!.partyId === p1.id ? a : b;
    const other = owner === a ? b : a;
    // Bàn của người kia chọn món xong: chỉ người giữ bàn đó tới ghi món
    for (let i = 0; i < 80 && p1.phase !== 'readyToOrder' && p1.phase !== 'waitingFood'; i++) game.tick(0.5);
    for (let i = 0; i < 20 && p1.phase === 'readyToOrder'; i++) {
      expect(other.tasks.some((t) => 'partyId' in t && t.partyId === p1.id && t.kind === 'takeOrder')).toBe(false);
      game.tick(0.5);
    }
    expect(p1.phase).toBe('waitingFood');
    // Nhân viên thuê đi chậm hơn bồi bàn
    expect(content.balance.helpers.speedMul).toBeLessThan(1);
    // Bệnh nghỉ: chỉ khi có từ 2 nhân viên; người bệnh không làm, không ra chợ ăn cùng đội
    const sickDays = Array.from({ length: 30 }, (_, i) => {
      const g = new Game(content, { seed: 100 + i });
      Object.assign(g.state, { money: 1e6, level: 20 });
      while (g.dispatch({ type: 'restaurant/upgrade' }).ok);
      g.dispatch({ type: 'helper/hire' });
      g.dispatch({ type: 'helper/hire' });
      runDay(g, false);
      g.dispatch({ type: 'day/next' });
      return g.state.restaurant.helpers.filter((h) => h.sick).length;
    });
    expect(Math.max(...sickDays)).toBe(1);
    expect(sickDays.some((n) => n === 1)).toBe(true);
    expect(sickDays.some((n) => n === 0)).toBe(true);
  });

  it('giai đoạn 15: công an khu vực (chỉ quán ốc) — bồi dưỡng theo hạng quán hoặc mất một bàn đôi; save v22 lên v23', async () => {
    const { bribeOf, policePending, seizableTable } = await import('../src/sim/systems/events');
    const { events } = await import('../src/data/events');
    expect(events.find((e) => e.id === 'police')?.cuisines).toEqual(['oc']);
    const make = () => {
      const g = new Game(content, { seed: 7, cuisine: 'oc' });
      g.state.restaurant.spawnTimer = 1e9;
      g.state.clock.minute = 8 * 60;
      g.state.event = { id: 'police', at: 0, status: 'scheduled', minutesLeft: 0, partyId: null, result: null };
      g.tick(0.5);
      return g;
    };
    const g = make();
    expect(policePending(g.ctx)).not.toBeNull();
    expect(bribeOf(g.ctx)).toBe(200);
    g.state.restaurant.tier = content.room.tiers.length;
    expect(bribeOf(g.ctx)).toBe(700);
    g.state.restaurant.tier = 1;
    const money = g.state.money;
    expect(g.dispatch({ type: 'event/police', choice: 'bribe' }).ok).toBe(true);
    expect(g.state.money).toBe(money - 200);
    expect(policePending(g.ctx)).toBeNull();
    // Để thu bàn: mất một bàn đôi đang trống (bàn có khách không bị thu)
    const t = make();
    const pairs = () => activeTables(t.ctx).filter((x) => x.seats === 2);
    const before = pairs().length;
    seatParty(t, pairs()[0].id, 2);
    const target = seizableTable(t.ctx)!;
    expect(target.id).not.toBe(pairs()[0].id);
    expect(t.dispatch({ type: 'event/police', choice: 'table' }).ok).toBe(true);
    expect(pairs()).toHaveLength(before - 1);
    expect(t.state.restaurant.confiscated).toEqual([target.id]);
    // Lưu / tải lại vẫn mất bàn; save cũ v22 có confiscated rỗng
    const again = deserialize(serialize(t.state), content)!;
    expect(again.restaurant.confiscated).toEqual([target.id]);
    const old = JSON.parse(serialize(newGame().state));
    old.version = 22;
    delete old.restaurant.confiscated;
    expect(deserialize(JSON.stringify(old), content)!.restaurant.confiscated).toEqual([]);
    // Quán khác không bao giờ có công an
    for (let seed = 1; seed <= 60; seed++) {
      const v = new Game(content, { seed, cuisine: 'vn' });
      for (let d = 0; d < 3; d++) {
        runDay(v, false);
        v.dispatch({ type: 'day/next' });
        expect(v.state.event?.id).not.toBe('police');
      }
      if (seed > 6) break;
    }
  });

  it('giai đoạn 15: kéo bàn thả hơi lệch vào khe thì tự hít vào chỗ trống gần nhất', async () => {
    const { nearestPlaceable } = await import('../src/sim/layout');
    const game = quietGame();
    const pair = activeTables(game.ctx).find((t) => t.id === 'pair')!;
    const medium = activeTables(game.ctx).find((t) => t.id === 'medium')!;
    const at = tablePos(game.ctx, medium);
    // Đặt bàn đôi sát bàn bốn (vướng), chỗ trống gần nhất cách đó không xa
    const check = (x: number, y: number) => canPlaceTable(game.ctx, pair.id, x, y);
    const want = { x: at.x + 125, y: at.y };
    const fit = nearestPlaceable(check, want.x, want.y, 60);
    expect(fit).not.toBeNull();
    expect(check(fit!.x, fit!.y)).toBeNull();
    expect(Math.hypot(fit!.x - want.x, fit!.y - want.y)).toBeLessThanOrEqual(60);
    // Chỗ đã trống thì giữ nguyên
    const free = tablePos(game.ctx, pair);
    expect(nearestPlaceable(check, free.x, free.y)).toEqual(free);
  });

  it('save v11 được nâng cấp lên v12', () => {
    const old = JSON.parse(serialize(newGame().state));
    old.version = 11;
    delete old.restaurant.helpers;
    const state = deserialize(JSON.stringify(old), content)!;
    expect(state.restaurant.helpers).toEqual([]);
  });
});

describe('cả đội: năng lượng, giờ nghỉ ra chợ, hoá đơn', () => {
  it('đầu bếp (tối đa 30) nấu 1 món tốn 2, bồi bàn / bác nông dân (tối đa 50) làm 1 việc tốn 1; dọn bàn không tốn', () => {
    const game = quietGame();
    const party = seatParty(game, 'pair', 1, [0]);
    party.phase = 'readyToOrder';
    game.dispatch({ type: 'service/takeOrder', partyId: party.id });
    for (let i = 0; i < 200 && !game.state.restaurant.orders.some((o) => o.status === 'ready'); i++) game.tick(0.5);
    const max = content.balance.crew.maxEnergy;
    const chefMax = content.balance.crew.chefMaxEnergy;
    expect([chefMax, max]).toEqual([30, 50]);
    expect(game.state.restaurant.staff.map((s) => chefMax - s.energy).sort()).toEqual([0, content.balance.crew.chefPerDish]);
    expect(game.state.restaurant.waiter.energy).toBe(max - content.balance.crew.waiterPerTask);
    const slot = game.state.farm.slots.find((s) => s.type === 'field')!;
    expect(game.dispatch({ type: 'farmer/do', kind: 'till', slotId: slot.id }).ok).toBe(true);
    for (let i = 0; i < 100 && !slot.tilled; i++) game.tick(0.5);
    expect(game.state.farm.farmer.energy).toBe(max - content.balance.crew.farmerPerTask);
    // Dọn bàn không tốn sức
    const r = game.state.restaurant;
    r.dirty.pair = [0, 1];
    const e0 = r.waiter.energy;
    expect(game.dispatch({ type: 'service/clean', tableId: 'pair' }).ok).toBe(true);
    for (let i = 0; i < 40 && r.dirty.pair; i++) game.tick(0.25);
    expect(r.dirty.pair).toBeUndefined();
    expect(r.waiter.energy).toBe(e0);
    // Xỉu thì bồi dưỡng 50 xu
    expect(content.balance.crew.reviveCost).toBe(50);
  });

  it('bồi bàn kiệt sức thì không nhận việc, bồi dưỡng thì làm tiếp', () => {
    const game = quietGame();
    game.state.money = 500;
    const w = game.state.restaurant.waiter;
    w.energy = 1;
    const p1 = seatParty(game, 'pair', 2);
    p1.phase = 'readyToOrder'; // mang menu không tốn sức: cho ghi món (tốn 1) để kiệt sức
    game.dispatch({ type: 'service/takeOrder', partyId: p1.id });
    for (let i = 0; i < 100 && !w.fainted; i++) game.tick(0.5);
    expect(w.fainted).toBe(true);
    const p2 = seatParty(game, 'pair2', 2);
    expect(game.dispatch({ type: 'service/menu', partyId: p2.id }).ok).toBe(false);
    expect(game.dispatch({ type: 'crew/revive', who: 'waiter' }).ok).toBe(true);
    expect(game.dispatch({ type: 'service/menu', partyId: p2.id }).ok).toBe(true);
  });

  it('ca làm: 11:30 / 20:30 ngưng nhận khách; 12:00 đóng cửa thì khách chưa gọi món về (không trừ uy tín)', () => {
    const game = newGame();
    game.state.weather = { id: 'cloudy', minutesLeft: 1e9 };
    game.state.clock.minute = 11 * 60 + 30;
    game.state.restaurant.spawnTimer = 0;
    game.tick(1);
    expect(game.state.restaurant.parties).toHaveLength(0);
    const rep = game.state.reputation;
    const p = seatParty(game, 'pair', 2);
    p.patience = p.patienceMax = 999;
    game.state.clock.minute = 12 * 60 - 0.5;
    game.tick(1);
    expect(game.state.restaurant.parties).toHaveLength(0);
    expect(game.state.reputation).toBe(rep);
    expect(game.state.stats.today.guestsLost).toBe(0);
  });

  it('nghỉ trưa: người chơi gọi món cho từng người, quá hạn thì tự chọn; tiền ăn của bác gộp chung một hoá đơn', () => {
    const game = quietGame();
    game.state.money = 1000;
    const b = content.balance.crew;
    game.state.clock.minute = 11 * 60 + 50;
    game.state.restaurant.waiter.energy = 15;
    game.state.farm.farmer.energy = 20; // bác mệt nên nghỉ trưa (khoẻ trên 75% thì ở lại làm)
    game.tick(15);
    expect(game.state.crew.farmerAway).toBe('lunch');
    expect(game.state.crew.restaurantAway).toBe('lunch');
    // Đang ở chợ: không giao việc được
    const slot = game.state.farm.slots.find((s) => s.type === 'field')!;
    const r = game.dispatch({ type: 'farmer/do', kind: 'till', slotId: slot.id });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/ăn trưa/);
    const people = 5; // 2 đầu bếp + bồi bàn + anh shipper + bác nông dân
    expect(game.state.crew.pending).toHaveLength(people);
    // Người chơi chọn Matcha ở Tiệm 25caaaaa cho bồi bàn
    // Bồi bàn còn 15⚡ (tối đa 50): Matcha (+16) chưa đầy nên vẫn đang chọn; gọi thêm Combo gà (+22) là đầy → xong, không gọi thêm được
    expect(game.dispatch({ type: 'crew/order', who: 'waiter', stallId: 'snack', dish: 0 }).ok).toBe(true);
    expect(game.state.crew.pending.some((p) => p.who === 'waiter')).toBe(true);
    expect(missingEnergy(game.ctx, 'waiter')).toBe(b.maxEnergy - 15 - 16);
    // Bỏ món vừa gọi rồi gọi lại
    expect(game.dispatch({ type: 'crew/unorder', who: 'waiter' }).ok).toBe(true);
    expect(game.state.crew.meals.some((l) => l.who === 'waiter')).toBe(false);
    expect(game.dispatch({ type: 'crew/order', who: 'waiter', stallId: 'snack', dish: 0 }).ok).toBe(true);
    expect(game.dispatch({ type: 'crew/order', who: 'waiter', stallId: 'snack', dish: 2 }).ok).toBe(true);
    expect(game.state.crew.pending.some((p) => p.who === 'waiter')).toBe(false);
    expect(game.dispatch({ type: 'crew/order', who: 'waiter', stallId: 'snack', dish: 0 }).ok).toBe(false);
    expect(game.dispatch({ type: 'crew/unorder', who: 'waiter' }).ok).toBe(false);
    expect(game.state.crew.meals.filter((l) => l.who === 'waiter').map((l) => l.dish).join()).toMatch(/Matcha.*gà/);
    // Bác ăn nhanh (30 phút, quá hạn thì tự chọn món) rồi về nông trại, nhưng hoá đơn chưa hiện: đợi đội quán ăn xong
    game.tick(12 * 60 + b.eatMinutes - game.state.clock.minute + 1);
    expect(game.state.crew.farmerAway).toBeNull();
    expect(game.state.crew.pending.map((p) => p.who)).toEqual(['head_chef', 'sous_chef', 'shipper']); // đội quán còn hạn tới 13:30
    expect(billDue(game.ctx)).toBe(false);
    expect(game.dispatch({ type: 'crew/pay' }).ok).toBe(false);
    game.tick(b.lunchBack - game.state.clock.minute + 1);
    expect(game.state.crew.restaurantAway).toBeNull();
    expect(game.state.crew.bill.length).toBeGreaterThanOrEqual(people + 1); // bồi bàn ăn 2 món (bác mệt có thể ăn 2 món)
    expect(billDue(game.ctx)).toBe(true);
    expect(game.state.restaurant.waiter.energy).toBeGreaterThan(5);
    const total = game.state.crew.bill.reduce((s, l) => s + l.price, 0);
    expect(game.dispatch({ type: 'crew/pay' }).ok).toBe(true);
    expect(game.state.money).toBe(1000 - total);
    expect(game.state.crew.bill).toEqual([]);
  });

  it('nghỉ trưa: bác nông dân dạo chợ chờ đội quán tan ca rồi ăn chung; bác còn khoẻ thì ở lại làm', () => {
    const b = content.balance.crew;
    // Quán còn khách sau 12:00: bác ra chợ dạo trước, chưa gọi món
    const game = quietGame();
    game.state.money = 1000;
    game.state.farm.farmer.energy = 10;
    const guests = seatParty(game, 'pair', 2);
    guests.phase = 'eating';
    guests.timer = 1e9;
    game.state.clock.minute = 11 * 60 + 59;
    game.tick(2);
    expect(game.state.crew.farmerAway).toBe('lunch');
    expect(game.state.crew.farmerWaiting).toBe(true);
    expect(game.state.crew.pending).toHaveLength(0);
    // 12:30 khách phải về → đội quán ra chợ: cả đội (cả bác) gọi món chung một lượt
    game.tick(30);
    expect(game.state.crew.restaurantAway).toBe('lunch');
    expect(game.state.crew.pending.map((p) => p.who).sort()).toEqual(['farmer', 'head_chef', 'shipper', 'sous_chef', 'waiter']);
    expect(game.dispatch({ type: 'crew/autoOrder' }).ok).toBe(true);
    // Bác ăn 30 phút rồi về nông trại trước, đội quán ở lại tới giờ về
    game.tick(b.eatMinutes + 1);
    expect(game.state.crew.farmerAway).toBeNull();
    expect(game.state.crew.restaurantAway).toBe('lunch');
    expect(game.state.farm.farmer.energy).toBeGreaterThan(10);
    // Hoá đơn chung một lượt khi đội quán ăn xong
    game.tick(b.lunchBack - game.state.clock.minute + 1);
    expect(game.state.crew.bill.some((l) => l.who === 'farmer')).toBe(true);
    expect(billDue(game.ctx)).toBe(true);

    // Bác còn trên 75% năng lượng: trưa ở lại làm, không ra chợ
    const fresh = quietGame();
    fresh.state.clock.minute = 11 * 60 + 59;
    fresh.tick(5);
    expect(fresh.state.crew.farmerAway).toBeNull();
    expect(fresh.state.crew.pending.some((p) => p.who === 'farmer')).toBe(false);
    // Tối vẫn ra chợ ăn cùng cả đội
    fresh.state.clock.minute = 21 * 60;
    fresh.tick(2);
    expect(fresh.state.crew.farmerAway).toBe('dinner');
    expect(fresh.state.crew.pending.some((p) => p.who === 'farmer')).toBe(true);
  });

  it('nhóm đông: cùng lúc tối đa (số bàn bốn + 1) nhóm 3–4 người', () => {
    const game = quietGame();
    const fours = activeTables(game.ctx).filter((t) => !t.shared && t.seats >= 3 && t.seats <= 4).length;
    let big = 0;
    for (let i = 0; i < 30; i++) {
      const p = spawnPartyFor(game);
      if (p.size > 2) big++;
    }
    expect(big).toBeLessThanOrEqual(fours + 1);
  });

  it('giai đoạn 14: nợ tới 500 xu, quá thì phá sản; ngày đầu không mưa; tự chọn món chia đều; hướng dẫn xong thưởng 500', () => {
    const b = content.balance;
    // Được nợ tới -500
    const g = quietGame();
    g.state.money = 100;
    expect(g.dispatch({ type: 'market/buy', stallId: 'produce', itemId: 'cabbage', qty: 100 }).ok).toBe(true);
    expect(g.state.money).toBeLessThan(0);
    expect(g.state.money).toBeGreaterThanOrEqual(-b.debtLimit);
    expect(g.dispatch({ type: 'market/buy', stallId: 'produce', itemId: 'cabbage', qty: 200 }).ok).toBe(false);
    expect(g.state.bankrupt).toBe(false);
    // Hoá đơn ăn uống đẩy nợ quá mức → phá sản
    g.state.money = -b.debtLimit + 5;
    g.state.crew.bill = [{ who: 'waiter', name: 'x', stallId: 'snack', dish: 'x', icon: 'x', price: 50, energy: 5, until: 0, kind: 'lunch' }];
    g.dispatch({ type: 'crew/pay' });
    g.tick(1);
    expect(g.state.bankrupt).toBe(true);
    // Ngày đầu không mưa / bão (nhiều seed)
    for (let seed = 1; seed <= 40; seed++) {
      const w = content.weathers.get(new Game(content, { seed }).state.weather.id);
      expect(w.wetsSoil, `seed ${seed}`).toBeFalsy();
    }
    // Tự chọn món: ít tiền thì chia đều (ai cũng có món trước khi có người ăn món thứ hai), không âm tiền
    const m = quietGame();
    for (const s of m.state.restaurant.staff) s.energy = 2;
    m.state.restaurant.waiter.energy = 2;
    m.state.clock.minute = 12 * 60 + 1;
    m.tick(1);
    m.state.money = 60;
    expect(m.dispatch({ type: 'crew/autoOrder' }).ok).toBe(true);
    const who = new Set(m.state.crew.meals.map((l) => l.who));
    expect(who.size).toBeGreaterThanOrEqual(3);
    expect(m.state.crew.meals.reduce((s, l) => s + l.price, 0)).toBeLessThanOrEqual(60);
    // Hướng dẫn: làm xong thì +500 xu
    const t = new Game(content, { seed: 2, tutorial: true });
    const money = t.state.money;
    t.state.tutorial!.step = 'lunch';
    Object.assign(t.state.crew, { restaurantAway: 'lunch', pending: [], meals: [], bill: [] });
    t.tick(0.5);
    expect(t.state.tutorial!.step).toBe('done');
    expect(t.state.money).toBe(money + b.tutorialReward);
  });

  it('save giai đoạn 13 (v19) lên bản mới: quán rộng ra, bàn / đồ dời theo, có shipper, chưa phá sản', () => {
    const now = newGame(42, 'kr');
    const old = JSON.parse(serialize(now.state));
    old.version = 19;
    delete old.bankrupt;
    delete old.restaurant.shipper;
    for (const k of ['farmerWaiting', 'farmerBack', 'farmerLunchDay']) delete old.crew[k];
    old.restaurant.layout = { pair: { x: 430, y: 290 } };
    old.restaurant.waiter.x = 470;
    const s = deserialize(JSON.stringify(old), content)!;
    expect(s).not.toBeNull();
    expect(s.restaurant.layout.pair.x).toBe(470);
    expect(s.restaurant.waiter.x).toBe(510);
    expect(s.restaurant.shipper).toEqual({ energy: content.balance.crew.shipperMaxEnergy, fainted: false, trip: null });
    expect(s.bankrupt).toBe(false);
    expect(s.crew.farmerWaiting).toBe(false);
  });

  it('lên cấp: 3 cấp đầu giữ nhịp cũ, từ cấp 4 chậm hơn; lên sao chậm dần từ 3 sao', async () => {
    const { xpForLevel, addReputation } = await import('../src/sim/helpers');
    expect([1, 2, 3].map(xpForLevel)).toEqual([1, 2, 3].map((l) => Math.round(80 * Math.pow(l, 1.6))));
    expect(xpForLevel(4)).toBeGreaterThan(Math.round(80 * Math.pow(4, 1.6)));
    const g = quietGame();
    g.state.reputation = 2;
    addReputation(g.ctx, 0.1);
    expect(g.state.reputation).toBeCloseTo(2.1);
    g.state.reputation = 4.2;
    addReputation(g.ctx, 0.1);
    expect(g.state.reputation).toBeCloseTo(4.215);
    addReputation(g.ctx, -0.1);
    expect(g.state.reputation).toBeCloseTo(4.115);
  });

  it('ít tiền thì món rẻ hoặc nhịn: tổng không vượt số tiền đang có; gọi món quá túi thì báo lỗi', () => {
    const game = quietGame();
    game.state.money = 20;
    game.state.clock.minute = 12 * 60 + 1;
    game.tick(1);
    expect(game.dispatch({ type: 'crew/order', who: 'waiter', stallId: 'snack', dish: 2 }).ok).toBe(false);
    expect(game.dispatch({ type: 'crew/autoOrder' }).ok).toBe(true);
    const total = game.state.crew.meals.reduce((s, l) => s + l.price, 0);
    expect(total).toBeLessThanOrEqual(20);
  });

  it('tối 21:00 đóng cửa cả đội ra chợ ăn tối; kết thúc ngày sớm được; ngày mới đầy năng lượng', () => {
    const game = quietGame();
    game.state.money = 1000;
    game.state.restaurant.waiter.energy = 3;
    game.state.clock.minute = 20 * 60 + 50;
    game.tick(1);
    expect(game.state.crew.restaurantAway).toBeNull();
    expect(game.dispatch({ type: 'day/end' }).ok).toBe(false); // chưa tới 21:00
    game.tick(content.balance.crew.endDayAfter - game.state.clock.minute + 1);
    expect(game.state.crew.restaurantAway).toBe('dinner');
    expect(game.state.crew.farmerAway).toBe('dinner');
    expect(game.dispatch({ type: 'day/end' }).ok).toBe(true);
    game.tick(1);
    expect(game.state.clock.phase).toBe('summary');
    expect(game.state.crew.bill.length).toBeGreaterThan(0); // ai chưa chọn món thì tự chọn
    game.dispatch({ type: 'day/next' });
    expect(game.state.crew.bill).toEqual([]); // tự trả nếu quên
    expect(game.state.restaurant.waiter.energy).toBe(content.balance.crew.maxEnergy);
    expect(game.state.crew.restaurantAway).toBeNull();
  });

  it('hàng rong chỉ bán đồ ăn (không mua nguyên liệu); năng lượng cà phê < bánh tráng < hủ tiếu < Tiệm 25caaaaa', () => {
    const game = quietGame();
    game.state.money = 1000;
    expect(game.dispatch({ type: 'market/buy', stallId: 'snack', itemId: 'milk', qty: 1 }).ok).toBe(false);
    const avg = (id: string) => {
      const m = content.stalls.get(id).menu!;
      return m.reduce((s, d) => s + d.energy, 0) / m.length;
    };
    const gain = ['cafe', 'banhtrang', 'hutieu', 'snack'].map(avg);
    expect([...gain].sort((a, b) => a - b)).toEqual(gain);
  });

  it('save v12 được nâng cấp lên v13', () => {
    const old = JSON.parse(serialize(newGame().state));
    old.version = 12;
    delete old.crew;
    for (const s of old.restaurant.staff) delete s.energy;
    const state = deserialize(JSON.stringify(old), content)!;
    expect(state.crew.bill).toEqual([]);
    expect(state.restaurant.staff[0].energy).toBe(content.balance.crew.chefMaxEnergy);
  });

  it('khách tới đều: ngày vắng nhất (uy tín thấp, mưa, lưu lượng thấp) giờ nào trong ca cũng có khách; mở ca chiều có khách ngay', () => {
    for (const seed of [1, 2, 3]) {
      const game = new Game(content, { seed });
      Object.assign(game.state, { reputation: 0.5, traffic: 0.75, weather: { id: 'storm', minutesLeft: 1e9 } });
      const hours = new Set<number>();
      let firstAfternoon = Infinity;
      game.bus.on('party/arrived', () => {
        const m = game.state.clock.minute;
        hours.add(Math.floor(m / 60));
        if (m >= 15 * 60) firstAfternoon = Math.min(firstAfternoon, m);
      });
      // Khách không ai phục vụ thì bỏ về, hàng chờ không đầy mãi
      while (game.state.clock.minute < 20 * 60 + 30 && game.state.clock.phase === 'open') game.tick(1);
      for (const h of [7, 8, 9, 10, 15, 16, 17, 18, 19]) expect(hours.has(h), `seed ${seed}, ${h}h`).toBe(true);
      expect(firstAfternoon).toBeLessThan(15 * 60 + 15);
    }
  });

  it('ông / bà chủ: chọn lúc tạo ván (giới tính, tuổi 25..50, tên, tóc, quần áo), lưu / tải giữ nguyên; save cũ có ông chủ mặc định', () => {
    const mine = { gender: 'female', age: 42, name: '  Cô   Ba  Sài Gòn  ', hair: 'braid', outfit: 'aodai' } as const;
    const g = new Game(content, { seed: 3, cuisine: 'oc', owner: mine });
    expect(g.state.owner).toEqual({ gender: 'female', age: 42, name: 'Cô Ba Sài Gòn', hair: 'braid', outfit: 'aodai' });
    expect(ownerName(g.state.owner)).toBe('Cô Ba Sài Gòn');
    expect(deserialize(serialize(g.state), content)!.owner).toEqual(g.state.owner);
    expect(new Game(content, { seed: 3, owner: { gender: 'male', age: 90 } }).state.owner.age).toBe(50);
    expect(new Game(content, { seed: 3, owner: { gender: 'male', age: 3 } }).state.owner.age).toBe(25);
    // Tên quá dài bị cắt, kiểu tóc / quần áo lạ về mặc định
    const odd = new Game(content, { seed: 3, owner: { name: 'x'.repeat(40), hair: 'mohawk', outfit: 'spacesuit' } }).state.owner;
    expect([odd.name.length, odd.hair, odd.outfit]).toEqual([16, 'auto', 'auto']);
    // Tóc / quần áo theo giới tính: ông chủ không tết tóc, mặc áo kiểu + váy; tạp dề, áo dài thì ai cũng mặc được
    const man = new Game(content, { seed: 3, owner: { gender: 'male', hair: 'braid', outfit: 'blouse' } }).state.owner;
    expect([man.hair, man.outfit]).toEqual(['auto', 'auto']);
    const man2 = new Game(content, { seed: 3, owner: { gender: 'male', hair: 'undercut', outfit: 'aodai' } }).state.owner;
    expect([man2.hair, man2.outfit]).toEqual(['undercut', 'aodai']);
    const woman = new Game(content, { seed: 3, owner: { gender: 'female', hair: 'buzz', outfit: 'polo' } }).state.owner;
    expect([woman.hair, woman.outfit]).toEqual(['auto', 'auto']);
    expect(newGame().state.owner).toEqual({ gender: 'male', age: 30, name: '', hair: 'auto', outfit: 'auto' });
    expect(ownerName(newGame().state.owner)).toBe('Ông chủ');
    for (const v of [17, 18]) {
      const old = JSON.parse(serialize(newGame().state));
      old.version = v;
      if (v === 17) delete old.owner;
      else old.owner = { gender: 'female', age: 33 };
      expect(deserialize(JSON.stringify(old), content)!.owner).toEqual({ gender: v === 17 ? 'male' : 'female', age: v === 17 ? 30 : 33, name: '', hair: 'auto', outfit: 'auto' });
    }
  });
});

describe('mùa trong năm', () => {
  const winterDay = 3 * DAYS_PER_SEASON + 1; // mùng 1 mùa Đông năm 1

  it('mùa đông: ruộng ngoài trời đóng băng, nhà kính vẫn trồng; cây ngoài trời ngừng lớn', async () => {
    const { fitsSlot } = await import('../src/data');
    const game = quietGame();
    expect(game.dispatch({ type: 'farm/till', slotId: 'field-0' }).ok).toBe(true);
    expect(game.dispatch({ type: 'farm/plant', slotId: 'field-0', producerId: 'cabbage' }).ok).toBe(true);
    game.state.clock.day = winterDay;
    const field = game.state.farm.slots.find((s) => s.id === 'field-0')!;
    const before = field.progress;
    game.tick(60);
    expect(field.progress).toBe(before);
    expect(game.dispatch({ type: 'farm/till', slotId: 'field-1' }).ok).toBe(false);
    const plot = game.state.farm.slots.find((s) => s.type === 'gplot')!;
    const crop = content.producers.all().find((p) => fitsSlot(p, 'gplot') && p.level <= game.state.level)!;
    if (content.slotTypes.get('gplot').needsTilling) expect(game.dispatch({ type: 'farm/till', slotId: plot.id }).ok).toBe(true);
    expect(game.dispatch({ type: 'farm/plant', slotId: plot.id, producerId: crop.id }).ok).toBe(true);
    game.tick(30);
    expect(plot.progress).toBeGreaterThan(0);
  });

  it('tuyết chỉ rơi mùa đông, mùa đông không mưa', () => {
    const game = quietGame();
    const seen = (day: number) => {
      const ids = new Set<string>();
      game.state.clock.day = day;
      for (let i = 0; i < 300; i++) {
        game.state.clock.minute = 8 * 60;
        game.state.weather.minutesLeft = 0;
        game.tick(1);
        ids.add(game.state.weather.id);
      }
      return ids;
    };
    const spring = seen(1);
    const winter = seen(winterDay);
    expect(spring.has('snow')).toBe(false);
    expect(winter.has('snow')).toBe(true);
    expect(winter.has('rain')).toBe(false);
  });

  it('cộng dồn doanh thu theo mùa / năm, sang mùa mới thì đếm lại', () => {
    const game = newGame();
    game.state.clock.day = 4 * DAYS_PER_SEASON; // ngày cuối năm 1
    runDay(game);
    const today = game.state.stats.today;
    expect(today.revenue).toBeGreaterThan(0);
    expect(game.state.stats.season.revenue).toBe(today.revenue);
    expect(game.state.stats.year.revenue).toBe(today.revenue);
    game.dispatch({ type: 'day/next' });
    expect(calendarOf(game.state.clock.day)).toMatchObject({ dayOfSeason: 1, season: 0, year: 2 });
    expect(game.state.stats.season.revenue).toBe(0);
    expect(game.state.stats.year.revenue).toBe(0);
    expect(game.state.stats.total.revenue).toBeGreaterThan(0);
  });

  it('save v13 nâng lên v14 có thống kê mùa / năm', () => {
    const game = newGame();
    const old = JSON.parse(serialize(game.state));
    delete old.stats.season;
    delete old.stats.year;
    old.version = 13;
    const loaded = deserialize(JSON.stringify(old), content)!;
    expect(loaded.stats.season).toBeDefined();
    expect(loaded.stats.year.revenue).toBe(0);
  });
});

describe('mùa vụ và lễ hội', () => {
  const day = (season: number, d: number) => season * DAYS_PER_SEASON + d; // ngày của ván (năm 1)

  it('rau chỉ gieo ngoài trời đúng mùa, nhà kính quanh năm', () => {
    const game = quietGame();
    game.state.clock.day = day(1, 3); // mùa Hạ: rau cải (Xuân, Thu) trái mùa
    expect(game.dispatch({ type: 'farm/till', slotId: 'field-0' }).ok).toBe(true);
    const r = game.dispatch({ type: 'farm/plant', slotId: 'field-0', producerId: 'cabbage' });
    expect(r.ok).toBe(false);
    expect(game.dispatch({ type: 'farm/plant', slotId: 'field-0', producerId: 'tomato' }).ok).toBe(true);
    const plot = game.state.farm.slots.find((s) => s.type === 'gplot')!;
    if (content.slotTypes.get('gplot').needsTilling) game.dispatch({ type: 'farm/till', slotId: plot.id });
    expect(game.dispatch({ type: 'farm/plant', slotId: plot.id, producerId: 'cabbage' }).ok).toBe(true);
  });

  it('sang mùa mới cây trái mùa đang lớn ngoài trời thì héo, cây chín vẫn giữ', () => {
    const game = newGame();
    game.state.clock.day = day(0, DAYS_PER_SEASON);
    game.dispatch({ type: 'farm/till', slotId: 'field-0' });
    game.dispatch({ type: 'farm/plant', slotId: 'field-0', producerId: 'cabbage' }); // Xuân, Thu → héo khi sang Hạ
    game.dispatch({ type: 'farm/till', slotId: 'field-1' });
    game.dispatch({ type: 'farm/plant', slotId: 'field-1', producerId: 'tomato' }); // Xuân, Hạ → sống
    game.dispatch({ type: 'farm/till', slotId: 'field-2' });
    game.dispatch({ type: 'farm/plant', slotId: 'field-2', producerId: 'cabbage' }); // Xuân, Thu nhưng chín rồi
    const slot = (id: string) => game.state.farm.slots.find((s) => s.id === id)!;
    let withered = 0;
    game.bus.on('farm/withered', (e) => (withered = e.count));
    runDay(game, false);
    // Cả ngày rau đã chín: đặt lại trạng thái ngay trước lúc sang mùa
    for (const id of ['field-0', 'field-1']) Object.assign(slot(id), { stage: 'growing', progress: 0 });
    slot('field-2').stage = 'ready';
    game.dispatch({ type: 'day/next' });
    expect(withered).toBe(1);
    expect(slot('field-0').producerId).toBeNull();
    expect(slot('field-1').producerId).toBe('tomato');
    expect(slot('field-2').producerId).toBe('cabbage');
  });

  it('chợ: rau đúng mùa rẻ hơn, trái mùa đắt hơn', () => {
    const game = quietGame();
    game.state.market.priceFactor = {};
    const stall = content.stalls.all().find((s) => s.items.includes('cabbage'));
    if (!stall) return; // rau cải không bán ở chợ thì bỏ qua
    game.state.clock.day = day(0, 3);
    const spring = priceOf(game.ctx, stall.id, 'cabbage');
    game.state.clock.day = day(1, 3);
    const summer = priceOf(game.ctx, stall.id, 'cabbage');
    expect(spring).toBeLessThan(summer);
  });

  it('món hợp mùa bán đắt hơn đúng mùa của nó', () => {
    const game = quietGame();
    const pho = content.recipes.get('pho');
    game.state.clock.day = day(3, 3);
    expect(seasonalPrice(game.ctx, pho)).toBeGreaterThan(pho.price);
    game.state.clock.day = day(1, 3);
    expect(seasonalPrice(game.ctx, pho)).toBe(pho.price);
  });

  it('lễ hội: ngày 1 của ván không tính, Tết năm 2 có lì xì và khách đông hơn', () => {
    expect(festivalOf(1)).toBeNull();
    expect(festivalOf(day(2, 8))?.id).toBe('trung_thu');
    const game = newGame();
    game.state.clock.day = 4 * DAYS_PER_SEASON; // ngày cuối năm 1 (Tất niên)
    expect(modifier(game.ctx, 'tip')).toBeGreaterThan(1);
    runDay(game, false);
    game.state.crew.bill = []; // tiền ăn của đội tự trừ sáng hôm sau — bỏ ra để chỉ đo tiền mừng
    const before = game.state.money;
    game.dispatch({ type: 'day/next' }); // mùng 1 Tết năm 2
    expect(festivalOf(game.state.clock.day)?.id).toBe('tet');
    expect(game.state.money).toBe(before + 200);
    expect(modifier(game.ctx, 'spawnRate')).toBeGreaterThan(1);
  });
});

describe('bếp và quầy line', () => {
  it('nâng hạng bếp mới thuê thêm đầu bếp được; thêm chỗ nhân viên phục vụ', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 99999, level: 9 });
    expect(game.state.restaurant.staff).toHaveLength(2);
    expect(game.dispatch({ type: 'chef/hire' }).ok).toBe(false); // bếp nhỏ: 2 đầu bếp
    // Nâng bếp cần quán đã lên hạng Tiệm ăn
    expect(game.dispatch({ type: 'kitchen/upgrade' }).ok).toBe(false);
    expect(game.dispatch({ type: 'restaurant/upgrade' }).ok).toBe(true);
    const helpersBefore = maxHelpers(game.ctx);
    expect(game.dispatch({ type: 'kitchen/upgrade' }).ok).toBe(true);
    expect(maxHelpers(game.ctx)).toBe(helpersBefore + 1);
    expect(game.dispatch({ type: 'chef/hire' }).ok).toBe(true);
    expect(game.state.restaurant.staff).toHaveLength(3);
    expect(game.dispatch({ type: 'chef/hire' }).ok).toBe(false); // bếp đôi: 3 đầu bếp
    expect(game.dispatch({ type: 'chef/fire', chefId: 'head_chef' }).ok).toBe(false); // đầu bếp sẵn không cho nghỉ
    expect(game.dispatch({ type: 'chef/fire', chefId: 'line_cook_a' }).ok).toBe(true);
  });

  it('đầu bếp chỉ nấu món được giao; quầy line đầy thì bếp chờ', () => {
    const game = quietGame();
    const [a, b] = game.state.restaurant.staff;
    const [r1, r2] = game.state.menu.active;
    game.dispatch({ type: 'chef/setDish', chefId: a.id, recipeId: r1, on: true });
    game.dispatch({ type: 'chef/setDish', chefId: b.id, recipeId: r1, on: true });
    const order = (recipeId: string) => {
      const o = { id: game.state.nextId++, partyId: 0, seat: 0, recipeId, status: 'queued' as const, progress: 0 };
      game.state.restaurant.orders.push(o as never);
      return o;
    };
    const o2 = order(r2);
    game.tick(1);
    expect(game.state.restaurant.orders.find((o) => o.id === o2.id)!.status).toBe('queued'); // không ai nấu món r2
    game.dispatch({ type: 'chef/setDish', chefId: b.id, recipeId: null, on: true }); // b nấu mọi món
    game.tick(1);
    expect(game.state.restaurant.orders.find((o) => o.id === o2.id)!.status).toBe('cooking');
    // Quầy line đầy (6 đĩa tính cả món đang nấu): không nhận đơn mới
    game.state.restaurant.orders = [];
    for (const s of game.state.restaurant.staff) s.orderId = null;
    for (let i = 0; i < 6; i++) Object.assign(order(r1), { status: 'ready' });
    const waiting = order(r1);
    game.tick(1);
    expect(game.state.restaurant.orders.find((o) => o.id === waiting.id)!.status).toBe('queued');
  });

  it('save v14 nâng lên v15 có hạng bếp', () => {
    const game = newGame();
    const old = JSON.parse(serialize(game.state));
    delete old.restaurant.kitchenTier;
    old.version = 14;
    const loaded = deserialize(JSON.stringify(old), content)!;
    expect(loaded.restaurant.kitchenTier).toBe(1);
    expect(loaded.restaurant.staff.map((s) => s.id)).toEqual(['head_chef', 'sous_chef']);
  });
});

describe('đơn đặt hàng, bán hàng dư, sự kiện', () => {
  it('bán hàng dư nửa giá; đồ có sẵn (gạo, nước) không bán được', () => {
    const game = quietGame();
    const id = Object.keys(game.state.inventory).find((k) => !content.items.get(k).infinite && game.state.inventory[k] > 0)!;
    const have = game.state.inventory[id];
    const money = game.state.money;
    expect(game.dispatch({ type: 'market/sell', itemId: id, qty: 2 }).ok).toBe(true);
    expect(game.state.inventory[id]).toBe(have - 2);
    expect(game.state.money).toBe(money + sellPrice(game.ctx, id) * 2);
    expect(sellPrice(game.ctx, id)).toBeLessThanOrEqual(Math.ceil(content.items.get(id).basePrice * 0.5 * 1.3));
    expect(game.dispatch({ type: 'market/sell', itemId: 'rice', qty: 1 }).ok).toBe(false);
  });

  it('mỗi ngày có đơn hàng; đủ hàng thì anh shipper đi giao (15–40 phút, tốn 5–10 sức), về mới nhận thưởng; quá hạn thì hết hạn', () => {
    const game = quietGame();
    expect(game.state.contracts.length).toBeGreaterThanOrEqual(2);
    const [c, c2] = game.state.contracts;
    for (const x of [...c.items, ...c2.items]) game.state.inventory[x.item] = (game.state.inventory[x.item] ?? 0) + x.qty * 2;
    const money = game.state.money;
    const s = game.state.restaurant.shipper;
    expect(s.energy).toBe(content.balance.crew.shipperMaxEnergy);
    expect(game.dispatch({ type: 'contract/deliver', contractId: c.id }).ok).toBe(true);
    expect(c.status).toBe('shipping');
    expect(s.trip!.until - game.state.clock.minute).toBeGreaterThanOrEqual(15);
    expect(s.trip!.until - game.state.clock.minute).toBeLessThanOrEqual(40);
    expect(content.balance.crew.shipperMaxEnergy - s.energy).toBeGreaterThanOrEqual(5);
    expect(content.balance.crew.shipperMaxEnergy - s.energy).toBeLessThanOrEqual(10);
    expect(game.state.money).toBe(money);
    // Shipper chưa về thì không giao đơn khác được
    const busy = game.dispatch({ type: 'contract/deliver', contractId: c2.id });
    expect(busy.ok).toBe(false);
    expect(!busy.ok && busy.reason).toMatch(/shipper/);
    game.tick(41);
    expect(c.status).toBe('done');
    expect(s.trip).toBeNull();
    expect(game.state.money).toBe(money + c.reward);
    expect(game.dispatch({ type: 'contract/deliver', contractId: c2.id }).ok).toBe(true);
    game.state.clock.minute = content.balance.contracts.due + 1;
    game.tick(1);
    expect(game.state.contracts.filter((x) => x.status === 'open')).toHaveLength(0);
  });

  it('thanh tra: quán sạch được thưởng, có vết bẩn thì bị phạt', () => {
    const clean = quietGame();
    clean.state.event = { id: 'inspector', at: 8 * 60, status: 'scheduled', minutesLeft: 0, partyId: null, result: null };
    clean.state.restaurant.stains = [];
    const m = clean.state.money;
    clean.tick(1);
    expect(clean.state.event!.result).toBe('good');
    expect(clean.state.money).toBeGreaterThan(m);

    const dirty = quietGame();
    dirty.state.event = { id: 'inspector', at: 8 * 60, status: 'scheduled', minutesLeft: 0, partyId: null, result: null };
    dirty.state.restaurant.dirty = { medium: [0, 1] };
    const m2 = dirty.state.money;
    dirty.tick(1);
    expect(dirty.state.event!.result).toBe('bad');
    expect(dirty.state.money).toBeLessThan(m2);
  });

  it('nhà phê bình tới thành khách đặc biệt; bỏ về thì mất uy tín', () => {
    const game = quietGame();
    game.state.event = { id: 'critic', at: 8 * 60, status: 'scheduled', minutesLeft: 0, partyId: null, result: null };
    game.tick(1);
    const critic = game.state.restaurant.parties.find((p) => p.vip === 'critic');
    expect(critic).toBeDefined();
    const rep = game.state.reputation;
    for (let i = 0; i < 400 && game.state.event!.status === 'active'; i++) game.tick(1); // không ai phục vụ
    expect(game.state.event!.result).toBe('bad');
    expect(game.state.reputation).toBeLessThan(rep);
  });

  it('xe du lịch: minibus chở một đoàn khách ngồi kín 100% bàn; cả đoàn về hết thì xe đi (sự kiện xong)', () => {
    const game = quietGame();
    seatParty(game, 'pair', 2);
    game.state.event = { id: 'tour_bus', at: 8 * 60, status: 'scheduled', minutesLeft: 0, partyId: null, result: null };
    game.tick(0.5);
    const tour = game.state.restaurant.parties.filter((p) => p.tour);
    // Mỗi bàn còn trống một nhóm đúng cỡ bàn, mỗi ghế quầy một khách
    const tables = activeTables(game.ctx);
    const seats = tables.filter((t) => t.id !== 'pair').reduce((s, t) => s + t.seats, 0);
    expect(tour.reduce((s, p) => s + p.size, 0)).toBe(seats);
    expect(game.state.event!.status).toBe('active');
    for (let i = 0; i < 30; i++) game.tick(0.5);
    for (const t of tables) expect(occupiedSeatsOf(game, t.id), t.id).toBe(t.seats);
    // Không ai phục vụ: đoàn bỏ về hết → sự kiện xong
    for (let i = 0; i < 600 && game.state.event!.status === 'active'; i++) game.tick(1);
    expect(game.state.event!.status).toBe('done');
    expect(game.state.restaurant.parties.some((p) => p.tour)).toBe(false);
  });

  it('giai đoạn 15: khách tới / ngồi xuống rồi mới cần menu — nhân viên không chạy tới trước khách', () => {
    const game = quietGame();
    Object.assign(game.state, { money: 1e6, level: 20 });
    game.dispatch({ type: 'restaurant/upgrade' });
    game.dispatch({ type: 'helper/hire' });
    const p = spawnPartyFor(game);
    expect(p.walking).toBeGreaterThan(0); // còn đi bộ / gửi xe ngoài bãi
    for (let i = 0; i < 40 && p.phase === 'queue'; i++) game.tick(0.25);
    expect(p.phase).toBe('seated');
    expect(p.walking).toBeGreaterThan(0); // đang đi vào ghế
    expect(game.dispatch({ type: 'service/menu', partyId: p.id }).ok).toBe(false);
    const patience = p.patience;
    const h = game.state.restaurant.helpers[0];
    while ((p.walking ?? 0) > 0) {
      expect(h.tasks.some((t) => 'partyId' in t && t.partyId === p.id)).toBe(false);
      expect(p.called).toBe(false);
      game.tick(0.1);
    }
    expect(p.patience).toBe(patience);
    for (let i = 0; i < 40 && p.phase === 'seated'; i++) game.tick(0.5);
    expect(p.phase).toBe('browsing');
  });

  it('giai đoạn 15: nâng hạng quán còn nới về phía Đông — quầy ra món dời theo, quầy trước bếp thêm ghế đơn', async () => {
    const { roomOf } = await import('../src/sim/layout');
    const game = quietGame('kr');
    Object.assign(game.state, { money: 1e6, level: 20 });
    const w1 = roomOf(game.ctx).width;
    const counter = () => activeTables(game.ctx).find((t) => t.id === 'counter')!;
    expect(counter().seats).toBe(3);
    while (game.dispatch({ type: 'restaurant/upgrade' }).ok);
    const room = roomOf(game.ctx);
    expect(room.width).toBeGreaterThan(w1);
    expect(room.pass.x - content.room.pass.x).toBe(room.width - w1);
    expect(counter().seats).toBe(6);
    // Mép trái quầy giữ nguyên, bố cục mặc định vẫn không chồng nhau
    expect(counter().x - counter().w / 2).toBe(content.tables.get('counter').x - content.tables.get('counter').w / 2);
    for (const t of activeTables(game.ctx)) if (!t.fixed) expect(canPlaceTable(game.ctx, t.id, tablePos(game.ctx, t).x, tablePos(game.ctx, t).y), t.id).toBeNull();
    // Quầy 6 ghế nhận đủ 6 khách lẻ
    for (let i = 0; i < 6; i++) expect(findSeats(game.ctx, 1)).not.toBeNull(), seatParty(game, 'counter', 1, [findSeats(game.ctx, 1)!.seats[0]]);
    expect(findSeats(game.ctx, 1)?.tableId).not.toBe('counter');
  });

  it('save v15 nâng lên v16 có đơn hàng + sự kiện', () => {
    const game = newGame();
    const old = JSON.parse(serialize(game.state));
    delete old.contracts;
    delete old.event;
    old.version = 15;
    const loaded = deserialize(JSON.stringify(old), content)!;
    expect(loaded.contracts).toEqual([]);
    expect(loaded.event).toBeNull();
  });
});

describe('bưng món theo màu bàn', () => {
  /** Hai bàn đã gọi món, món đã ra quầy theo thứ tự cho trước. */
  function setup() {
    const game = quietGame();
    const [r1, r2] = game.state.menu.active;
    const a = seatParty(game, 'pair', 2);
    const b = seatParty(game, 'medium', 1);
    for (const p of [a, b]) {
      p.phase = 'readyToOrder';
      game.state.inventory = { ...game.state.inventory };
    }
    const order = (party: Party, recipeId: string, readyAt: number) => {
      const o = { id: game.state.nextId++, partyId: party.id, recipeId, status: 'ready' as const, progress: 999, readyAt };
      game.state.restaurant.orders.push(o);
      party.orderIds.push(o.id);
      party.phase = 'waitingFood';
      return o;
    };
    const oB = order(b, r2, 10); // ra quầy sớm nhất
    const oA1 = order(a, r1, 20);
    const oA2 = order(a, r2, 30);
    a.color = 0;
    b.color = 1;
    return { game, a, b, oA1, oA2, oB };
  }
  const walk = (game: Game) => {
    for (let i = 0; i < 200 && game.state.restaurant.waiter.tasks.length; i++) game.tick(1);
  };

  it('bấm quầy: bồi bàn lấy tối đa 2 món, món ra quầy trước lấy trước', () => {
    const { game, oB, oA1, oA2 } = setup();
    expect(game.dispatch({ type: 'service/pickup' }).ok).toBe(true);
    walk(game);
    expect(game.state.restaurant.waiter.carrying).toEqual([oB.id, oA1.id]);
    expect(game.state.restaurant.orders.find((o) => o.id === oA2.id)!.status).toBe('ready');
    expect(game.dispatch({ type: 'service/pickup' }).ok).toBe(false); // tay đầy
  });

  it('bấm bàn: chỉ giao món của bàn đó; bàn không gọi món đang cầm thì báo lỗi', () => {
    const { game, a, b, oB, oA1 } = setup();
    game.dispatch({ type: 'service/pickup' });
    walk(game);
    // Bàn b chỉ gọi món r2; bàn a cũng gọi r2 nhưng món r2 đang cầm là của b — bấm a chỉ giao món của a
    expect(game.dispatch({ type: 'service/serve', partyId: a.id }).ok).toBe(true);
    walk(game);
    expect(game.state.restaurant.orders.find((o) => o.id === oA1.id)!.status).toBe('served');
    expect(game.state.restaurant.orders.find((o) => o.id === oB.id)!.partyId).toBe(b.id);
    expect(game.state.restaurant.waiter.carrying).toEqual([oB.id]);
    expect(game.dispatch({ type: 'service/serve', partyId: b.id }).ok).toBe(true);
    walk(game);
    expect(game.state.restaurant.waiter.carrying).toEqual([]);
    expect(game.dispatch({ type: 'service/serve', partyId: a.id }).ok).toBe(false); // không cầm gì
    game.dispatch({ type: 'service/pickup' });
    walk(game); // lấy nốt món r2 của bàn a
    expect(game.dispatch({ type: 'service/serve', partyId: b.id }).ok).toBe(false); // món đang cầm không phải của b
  });

  it('khách giận bỏ về lúc bồi bàn đang bưng món của họ: món trên tay tự bỏ đi', () => {
    const { game, b, oB, oA1 } = setup();
    game.dispatch({ type: 'service/pickup' });
    walk(game);
    expect(game.state.restaurant.waiter.carrying).toEqual([oB.id, oA1.id]);
    // Bàn b chờ quá lâu → bỏ về; món của b trên tay bồi bàn mất theo, món của a vẫn cầm
    b.wait = 1e6;
    game.tick(1);
    expect(game.state.restaurant.parties.some((p) => p.id === b.id)).toBe(false);
    expect(game.state.restaurant.waiter.carrying).toEqual([oA1.id]);
  });

  it('món trên tay không còn chủ (đơn mồ côi) thì bồi bàn tự bỏ, không kẹt tay', () => {
    const { game, b, oB, oA1 } = setup();
    game.dispatch({ type: 'service/pickup' });
    walk(game);
    // Nhóm b biến mất mà đơn vẫn còn (vd save cũ, đổi chủ món) — trước đây bồi bàn cầm mãi không giao được
    const r = game.state.restaurant;
    r.parties = r.parties.filter((p) => p.id !== b.id);
    game.tick(1);
    expect(r.waiter.carrying).toEqual([oA1.id]);
    expect(r.orders.some((o) => o.id === oB.id)).toBe(false);
    expect(game.dispatch({ type: 'service/pickup' }).ok).toBe(true); // tay còn chỗ, lấy tiếp được
  });

  it('gọi món thì bàn được gán màu, hai bàn đang chờ không trùng màu', () => {
    const game = quietGame();
    const a = seatParty(game, 'pair', 2);
    const b = seatParty(game, 'medium', 2);
    for (const p of [a, b]) {
      p.phase = 'readyToOrder';
      game.dispatch({ type: 'service/takeOrder', partyId: p.id });
    }
    walk(game);
    expect(a.color).toBeDefined();
    expect(b.color).toBeDefined();
    expect(a.color).not.toBe(b.color);
  });
});

describe('người làm vườn + dụng cụ', () => {
  /** Ván yên tĩnh, cấp đủ thuê người làm vườn, nhiều tiền. */
  function farmGame(level = 6): Game {
    const game = quietGame();
    game.state.level = level;
    game.state.money = 99999;
    return game;
  }

  it('thuê theo cấp: mỗi chỗ mở ở một cấp, đủ chỗ thì không thuê thêm', () => {
    const game = farmGame(1);
    expect(game.dispatch({ type: 'gardener/hire' }).ok).toBe(false);
    game.state.level = 2;
    expect(game.dispatch({ type: 'gardener/hire' }).ok).toBe(true);
    expect(game.dispatch({ type: 'gardener/hire' }).ok).toBe(false);
    game.state.level = 6;
    expect(game.dispatch({ type: 'gardener/hire' }).ok).toBe(true);
    expect(game.dispatch({ type: 'gardener/hire' }).ok).toBe(true);
    expect(game.dispatch({ type: 'gardener/hire' }).ok).toBe(false);
    expect(new Set(game.state.farm.gardeners.map((g) => g.name)).size).toBe(3);
  });

  it('tự thu hoạch rau chín, tự cuốc rồi gieo lại giống cũ', () => {
    const game = farmGame();
    const field = game.state.farm.slots.find((s) => s.id === 'field-0')!;
    game.dispatch({ type: 'farm/till', slotId: field.id });
    game.dispatch({ type: 'farm/plant', slotId: field.id, producerId: 'onion' });
    field.stage = 'ready' as FarmSlot['stage'];
    game.dispatch({ type: 'gardener/hire' });
    const before = game.state.inventory.onion ?? 0;
    let harvested = false;
    for (let i = 0; i < 120 && !(harvested && field.producerId === 'onion' && field.stage === 'growing'); i++) {
      game.tick(1);
      harvested ||= (game.state.inventory.onion ?? 0) > before;
    }
    expect(game.state.inventory.onion).toBeGreaterThan(before);
    expect(field.producerId).toBe('onion');
    expect(field.stage).toBe('growing');
  });

  it('chỉ làm việc được bật; không đụng ruộng lúa; tắt hết thì đứng yên', () => {
    const game = farmGame();
    game.dispatch({ type: 'gardener/hire' });
    const g = game.state.farm.gardeners[0];
    for (const job of ['harvest', 'animals', 'water', 'replant'] as const) game.dispatch({ type: 'gardener/setJob', gardenerId: g.id, job, on: false });
    for (const s of game.state.farm.slots) if (s.producerId) s.stage = 'ready';
    const at = { x: g.x, z: g.z };
    game.tick(30);
    expect({ x: g.x, z: g.z }).toEqual(at);
    game.dispatch({ type: 'gardener/setJob', gardenerId: g.id, job: 'harvest', on: true });
    game.tick(0.2);
    const slot = game.state.farm.slots.find((s) => s.id === g.task?.slotId)!;
    expect(g.task?.kind).toBe('harvest');
    expect(content.slotTypes.get(slot.type).mill).toBeUndefined();
    expect(content.slotTypes.get(slot.type).animals).toBeFalsy();
  });

  it('bác nông dân và người làm vườn không giành cùng một ô', () => {
    const game = farmGame();
    game.dispatch({ type: 'gardener/hire' });
    const tree = game.state.farm.slots.find((s) => s.type === 'orchard' && s.producerId)!;
    tree.stage = 'ready';
    game.tick(0.2);
    const g = game.state.farm.gardeners[0];
    expect(g.task?.slotId).toBe(tree.id);
    expect(game.dispatch({ type: 'farmer/do', kind: 'harvest', slotId: tree.id }).ok).toBe(false);
  });

  it('nghỉ trưa cùng bác: đứng yên khi bác ra chợ', () => {
    const game = farmGame();
    game.dispatch({ type: 'gardener/hire' });
    for (const s of game.state.farm.slots) if (s.producerId) s.stage = 'ready';
    game.state.crew.farmerAway = 'lunch';
    const g = game.state.farm.gardeners[0];
    const at = { x: g.x, z: g.z };
    game.tick(5);
    expect({ x: g.x, z: g.z }).toEqual(at);
  });

  it('dụng cụ: mua theo cấp, mỗi món một lần; bình tưới lớn tưới cả hàng; giày + liềm làm nhanh hơn', async () => {
    const { walkSpeed, workTimeOf } = await import('../src/sim/systems/farmer');
    const game = farmGame(1);
    expect(game.dispatch({ type: 'tool/buy', toolId: 'big_can' }).ok).toBe(false); // cần cấp 2
    game.state.level = 6;
    const task = { kind: 'harvest' as const, slotId: 'field-0' };
    const v0 = walkSpeed(game.ctx, task, 3);
    const w0 = workTimeOf(game.ctx, task, 1);
    for (const id of ['big_can', 'boots', 'sickle']) expect(game.dispatch({ type: 'tool/buy', toolId: id }).ok).toBe(true);
    expect(game.dispatch({ type: 'tool/buy', toolId: 'boots' }).ok).toBe(false);
    expect(walkSpeed(game.ctx, task, 3)).toBeGreaterThan(v0);
    expect(workTimeOf(game.ctx, task, 1)).toBeLessThan(w0);
    // Hàng đầu ruộng: field-0..2 cùng hàng, field-3 ở hàng sau; gieo cả 4, đất khô
    for (const id of ['field-0', 'field-1', 'field-2', 'field-3']) {
      game.dispatch({ type: 'farm/till', slotId: id });
      game.dispatch({ type: 'farm/plant', slotId: id, producerId: 'onion' });
      game.state.farm.slots.find((s) => s.id === id)!.wet = 0;
    }
    expect(game.dispatch({ type: 'farmer/do', kind: 'water', slotId: 'field-0' }).ok).toBe(true);
    for (let i = 0; i < 60 && game.state.farm.farmer.tasks.length; i++) game.tick(1);
    const wet = (id: string) => game.state.farm.slots.find((s) => s.id === id)!.wet > 0;
    expect(wet('field-1') && wet('field-2')).toBe(true);
    expect(wet('field-3')).toBe(false);
  });
});

describe('chuỗi nhiệm vụ dài + sổ thành tựu', () => {
  it('nhiệm vụ nào cũng có chương; mục tiêu trạng thái mới (người làm vườn, ngày) đọc từ state', async () => {
    const { questChapters } = await import('../src/data/quests');
    expect(content.quests.length).toBeGreaterThanOrEqual(20);
    for (const q of content.quests) expect(questChapters[q.chapter - 1]).toBeDefined();
    const game = quietGame();
    const at = (id: string) => content.quests.findIndex((q) => q.id === id);
    game.state.quests.index = at('gardener_1');
    game.state.level = 3;
    game.state.money = 9999;
    game.tick(1);
    expect(game.state.quests.done).toBe(false);
    game.dispatch({ type: 'gardener/hire' });
    game.tick(1);
    expect(game.state.quests.done).toBe(true);
    game.state.quests = { index: at('year_1'), progress: 0, done: false };
    game.state.clock.day = 57;
    game.tick(1);
    expect(game.state.quests.done).toBe(true);
  });

  it('giao đơn hàng tính vào nhiệm vụ "contract" và bộ đếm thành tựu', () => {
    const game = newGame(3);
    game.state.clock.day = 3;
    game.state.quests = { index: content.quests.findIndex((q) => q.id === 'contracts_3'), progress: 0, done: false };
    const c = game.state.contracts[0];
    expect(c).toBeDefined();
    for (const x of c.items) game.state.inventory[x.item] = (game.state.inventory[x.item] ?? 0) + x.qty;
    expect(game.dispatch({ type: 'contract/deliver', contractId: c.id }).ok).toBe(true);
    game.state.clock.minute = 8 * 60;
    game.state.weather = { id: 'cloudy', minutesLeft: 1e9 };
    game.tick(41); // anh shipper giao xong
    expect(game.state.quests.progress).toBe(1);
    expect(game.state.achievements.counts.contract).toBe(1);
  });

  it('thành tựu: đạt mốc thì báo một lần, nhận thưởng một lần (không tính doanh thu)', () => {
    const game = quietGame();
    const reached: string[] = [];
    game.bus.on('achievement/reached', (e) => reached.push(e.id));
    game.state.achievements.counts.harvest = 49;
    game.tick(1);
    expect(game.state.achievements.done).not.toContain('harvest_50');
    game.state.achievements.counts.harvest = 50;
    game.tick(1);
    game.tick(1);
    expect(reached.filter((id) => id === 'harvest_50')).toHaveLength(1);
    const money = game.state.money;
    const revenue = game.state.stats.today.revenue;
    expect(game.dispatch({ type: 'achievement/claim', id: 'harvest_50' }).ok).toBe(true);
    expect(game.state.money).toBeGreaterThan(money);
    expect(game.state.stats.today.revenue).toBe(revenue);
    expect(game.dispatch({ type: 'achievement/claim', id: 'harvest_50' }).ok).toBe(false);
    expect(game.dispatch({ type: 'achievement/claim', id: 'serve_1000' }).ok).toBe(false);
  });

  it('thu hoạch đếm vào thành tựu dù nhiệm vụ đang làm là loại khác', () => {
    const game = quietGame();
    const tree = game.state.farm.slots.find((s) => s.type === 'orchard' && s.producerId)!;
    tree.stage = 'ready';
    game.state.quests.index = content.quests.findIndex((q) => q.id === 'new_dish');
    expect(game.dispatch({ type: 'farm/harvest', slotId: tree.id }).ok).toBe(true);
    expect(game.state.achievements.counts.harvest).toBe(1);
  });

  it('save v16 nâng lên v17: có dụng cụ, người làm vườn, sổ thành tựu', () => {
    const game = newGame();
    const old = JSON.parse(serialize(game.state));
    delete old.farm.tools;
    delete old.farm.gardeners;
    delete old.achievements;
    old.version = 16;
    const loaded = deserialize(JSON.stringify(old), content)!;
    expect(loaded.farm.tools).toEqual([]);
    expect(loaded.farm.gardeners).toEqual([]);
    expect(loaded.achievements).toEqual({ counts: {}, done: [], claimed: [] });
  });
});

describe('nhịp quán (giai đoạn 11b)', () => {
  it('bếp trưởng nấu mỗi món trong 4–10 giây thực, món khó lâu hơn món dễ', () => {
    const secs = content.recipes.all().map((r) => r.cookTime / (1.6 * content.balance.minutesPerSecond));
    for (const s of secs) {
      expect(s).toBeGreaterThanOrEqual(3.99);
      expect(s).toBeLessThanOrEqual(10.01);
    }
    expect(Math.max(...secs) - Math.min(...secs)).toBeGreaterThan(4);
  });

  it('thời gian ăn theo số khách: 1 người 10–15 s … 5–6 người 45–60 s', () => {
    const s = (m: number) => m / content.balance.minutesPerSecond;
    const t = content.balance.eatTime;
    expect([s(t[0][0]), s(t[0][1])]).toEqual([10, 15]);
    expect([s(t[1][0]), s(t[1][1])]).toEqual([15, 30]);
    expect([s(t[3][0]), s(t[3][1])]).toEqual([30, 45]);
    expect([s(t[5][0]), s(t[5][1])]).toEqual([45, 60]);
  });

  it('11:00 ngưng nhận khách; 12:30 khách đang ăn trả tiền rồi về, khách chờ món được mời về', () => {
    const game = quietGame();
    expect(content.balance.shifts[0].lastCall).toBe(11 * 60);
    const eating = seatParty(game, 'pair', 2);
    eating.phase = 'eating';
    eating.timer = 999;
    const r = game.state.restaurant;
    const money = game.state.money;
    game.state.clock.minute = 12 * 60 + 29;
    game.tick(2);
    expect(r.parties).toHaveLength(0);
    expect(game.state.money).toBeGreaterThanOrEqual(money);
  });

  it('lưu lượng khách tung mỗi sáng trong khoảng, ngày lễ đông hơn', () => {
    const game = newGame(9);
    const seen: number[] = [];
    for (let d = 0; d < 12; d++) {
      runDay(game, false);
      game.state.crew.bill = [];
      game.dispatch({ type: 'day/next' });
      seen.push(game.state.traffic);
      const [lo, hi] = festivalOf(game.state.clock.day) ? content.balance.traffic.festival : content.balance.traffic.normal;
      expect(game.state.traffic).toBeGreaterThanOrEqual(lo);
      expect(game.state.traffic).toBeLessThanOrEqual(hi);
    }
    expect(new Set(seen).size).toBeGreaterThan(3);
  });

  it('bồi bàn đi vòng, không cắt ngang mặt bàn', async () => {
    const { nextWaypoint } = await import('../src/sim/pathing');
    const { activeTables, tablePos } = await import('../src/sim/layout');
    const game = quietGame();
    const t = activeTables(game.ctx).find((x) => !x.shared && x.seats >= 4)!;
    const at = tablePos(game.ctx, t);
    const from = { x: at.x - t.w / 2 - 40, y: at.y };
    const to = { x: at.x + t.w / 2 + 40, y: at.y };
    const body = { x1: at.x - t.w / 2, y1: at.y - t.h / 2, x2: at.x + t.w / 2, y2: at.y + t.h / 2 };
    let p = { ...from };
    for (let i = 0; i < 400 && Math.hypot(p.x - to.x, p.y - to.y) > 0.5; i++) {
      const next = nextWaypoint(game.ctx, p, to);
      const d = Math.hypot(next.x - p.x, next.y - p.y);
      const k = Math.min(1, 3 / d);
      p = { x: p.x + (next.x - p.x) * k, y: p.y + (next.y - p.y) * k };
      expect(p.x > body.x1 && p.x < body.x2 && p.y > body.y1 && p.y < body.y2).toBe(false);
    }
    expect(Math.hypot(p.x - to.x, p.y - to.y)).toBeLessThan(1);
  });

  it('lau sàn: đứng lau một lúc rồi vết bẩn mới hết', () => {
    const game = quietGame();
    const r = game.state.restaurant;
    r.stains = [{ id: 1, x: r.waiter.x, y: r.waiter.y, level: 1 }];
    expect(game.dispatch({ type: 'service/mop', stainId: 1 }).ok).toBe(true);
    game.tick(0.5);
    expect(r.stains).toHaveLength(1);
    expect(r.waiter.work).toBeGreaterThan(0);
    game.tick(content.balance.service.mopTime + 1);
    expect(r.stains).toHaveLength(0);
  });
});

describe('ngày hướng dẫn', () => {
  it('đi trọn kịch bản: bưng món dễ → món thiếu nguyên liệu → ra chợ → nông trại → nghỉ trưa → xong', () => {
    const game = new Game(content, { seed: 42, tutorial: true });
    const t = () => game.state.tutorial;
    const run = (until: () => boolean, max = 3000) => {
      for (let i = 0; i < max && !until(); i++) {
        for (const c of autoServeCommands(game.ctx)) game.dispatch(c);
        game.tick(1);
      }
      expect(until()).toBe(true);
    };
    expect(t()?.step).toBe('intro');
    const m0 = game.state.clock.minute;
    game.tick(30);
    expect(game.state.clock.minute).toBe(m0); // lời chào: dừng giờ
    expect(game.dispatch({ type: 'tutorial/next' }).ok).toBe(true);
    expect(t()?.step).toBe('serve');

    run(() => t()?.step !== 'serve');
    expect(game.state.stats.today.guestsServed).toBeGreaterThanOrEqual(3);
    expect(t()?.step).toBe('hard');
    run(() => t()?.step === 'market');
    // Dừng giờ, khách vẫn chờ; ghi món bị từ chối cho tới khi mua đủ
    const minute = game.state.clock.minute;
    game.tick(20);
    expect(game.state.clock.minute).toBe(minute);
    const party = game.state.restaurant.parties.find((p) => p.want)!;
    expect(game.dispatch({ type: 'service/takeOrder', partyId: party.id }).ok).toBe(false);
    const item = t()!.item!;
    const stall = content.stalls.all().find((s) => s.items.includes(item))!;
    expect(game.dispatch({ type: 'market/buy', stallId: stall.id, itemId: item, qty: 5 }).ok).toBe(true);
    game.tick(0.1);
    expect(t()?.step).toBe('cook');
    run(() => t()?.step === 'farm');
    expect(game.state.restaurant.orders.length).toBe(0);

    // Nông trại: giờ dừng nhưng bác vẫn đi làm
    const fm = game.state.clock.minute;
    expect(game.dispatch({ type: 'farmer/do', kind: 'till', slotId: 'field-0' }).ok).toBe(true);
    expect(game.dispatch({ type: 'farmer/do', kind: 'plant', slotId: 'field-0', producerId: 'cabbage' }).ok).toBe(true);
    expect(game.dispatch({ type: 'farmer/do', kind: 'plant', slotId: 'wheat-0', producerId: 'wheat' }).ok).toBe(true);
    expect(game.dispatch({ type: 'farmer/do', kind: 'plant', slotId: 'pen-0', producerId: 'hen' }).ok).toBe(true);
    for (let i = 0; i < 200 && t()?.step === 'farm'; i++) game.tick(1);
    expect(t()?.step).toBe('morning');
    expect(game.state.clock.minute).toBe(fm);

    run(() => t()?.step === 'lunch');
    run(() => game.state.crew.restaurantAway != null && game.state.restaurant.parties.length === 0);
    expect(game.state.clock.minute).toBeLessThan(12 * 60 + 5); // ngày hướng dẫn: khách về hết lúc 12:00
    game.dispatch({ type: 'crew/autoOrder' });
    run(() => billDue(game.ctx));
    expect(game.dispatch({ type: 'crew/pay' }).ok).toBe(true);
    game.tick(0.1);
    expect(t()?.step).toBe('done');
    expect(game.dispatch({ type: 'tutorial/next' }).ok).toBe(true);
    expect(t()).toBeNull();
  });

  it('bỏ qua được; ván thường không có hướng dẫn; sang ngày 2 thì hết', () => {
    expect(newGame().state.tutorial).toBeNull();
    const game = new Game(content, { seed: 1, tutorial: true });
    expect(game.dispatch({ type: 'tutorial/skip' }).ok).toBe(true);
    expect(game.state.tutorial).toBeNull();
    const g2 = new Game(content, { seed: 1, tutorial: true });
    g2.dispatch({ type: 'tutorial/next' });
    g2.state.tutorial!.step = 'morning'; // (bỏ qua các bước có kịch bản để chạy hết ngày)
    runDay(g2, true);
    g2.state.crew.bill = [];
    g2.dispatch({ type: 'day/next' });
    expect(g2.state.tutorial).toBeNull();
  });

  it('các bước có kịch bản: không có khách lạ tới', () => {
    const game = new Game(content, { seed: 5, tutorial: true });
    game.dispatch({ type: 'tutorial/next' });
    for (let i = 0; i < 120; i++) {
      game.tick(1);
      expect(game.state.restaurant.parties.length).toBeLessThanOrEqual(1);
    }
  });
});

describe('bữa ăn của đội', () => {
  it('để mọi người tự chọn: ai cũng ăn tới đầy năng lượng (đủ tiền)', () => {
    const game = quietGame();
    game.state.money = 9999;
    for (const s of game.state.restaurant.staff) s.energy = 3;
    game.state.restaurant.waiter.energy = 5;
    for (let i = 0; i < 400 && !game.state.crew.restaurantAway; i++) game.tick(1);
    expect(game.state.crew.restaurantAway).toBe('lunch');
    expect(game.dispatch({ type: 'crew/autoOrder' }).ok).toBe(true);
    game.tick(content.balance.crew.eatMinutes + 1);
    for (const s of game.state.restaurant.staff) expect(s.energy).toBe(content.balance.crew.chefMaxEnergy);
    expect(game.state.restaurant.waiter.energy).toBe(content.balance.crew.maxEnergy);
  });
});

describe('xỉu + bồi dưỡng tăng giá + nhịn bữa tối', () => {
  const toSummary = (game: Game) => {
    for (let i = 0; i < 400 && game.state.clock.phase !== 'summary'; i++) game.tick(5);
    expect(game.state.clock.phase).toBe('summary');
  };

  it('đầu bếp, bác nông dân, shipper xỉu được bồi dưỡng: 50 xu lần đầu, mỗi lần sau +25, hồi nửa sức; sang ngày tính lại', () => {
    const game = newGame();
    const { state } = game;
    state.money = 1000;
    const b = content.balance.crew;
    const chef = state.restaurant.staff[0];
    const who = [
      { id: chef.id, v: chef, max: b.chefMaxEnergy },
      { id: 'farmer', v: state.farm.farmer, max: b.maxEnergy },
      { id: 'shipper', v: state.restaurant.shipper, max: b.shipperMaxEnergy },
    ];
    who.forEach(({ id, v, max }, i) => {
      Object.assign(v, { energy: 0, fainted: true });
      const money = state.money;
      expect(game.dispatch({ type: 'crew/revive', who: id }).ok).toBe(true);
      expect(money - state.money).toBe(b.reviveCost + b.reviveStep * i);
      expect(v.fainted).toBe(false);
      expect(v.energy).toBe(Math.round(max * b.reviveRatio));
    });
    expect(game.dispatch({ type: 'crew/revive', who: 'farmer' }).ok).toBe(false); // đang khoẻ
    toSummary(game);
    game.dispatch({ type: 'day/next' });
    expect(state.crew.revives).toBe(0);
  });

  it('hết tiền, cả đội nhịn bữa tối thì sáng hôm sau than đói; có ăn thì không', () => {
    const broke = newGame();
    broke.state.money = 0;
    toSummary(broke);
    broke.dispatch({ type: 'day/next' });
    expect(broke.state.crew.hungry).toEqual(expect.arrayContaining(['waiter', 'farmer', 'shipper', broke.state.restaurant.staff[0].id]));
    const r = content.balance.crew.hungryWakeRatio;
    expect(broke.state.farm.farmer.energy).toBe(Math.round(content.balance.crew.maxEnergy * r));
    expect(broke.state.restaurant.shipper.energy).toBe(Math.round(content.balance.crew.shipperMaxEnergy * r));
    expect(broke.state.restaurant.staff[0].energy).toBe(Math.round(content.balance.crew.chefMaxEnergy * r));
    const fed = newGame();
    fed.state.money = 5000;
    toSummary(fed);
    fed.dispatch({ type: 'day/next' });
    expect(fed.state.crew.hungry).toEqual([]);
    expect(fed.state.crew.dinnerAte).toBeNull();
    expect(fed.state.farm.farmer.energy).toBe(content.balance.crew.maxEnergy);
  });
});

describe('đơn giao tận nơi (giai đoạn 18)', () => {
  /** Quán hạng "Quán đông khách" (có quầy cashier), nhiều tiền, đủ nguyên liệu. */
  function shop() {
    const game = quietGame();
    const { state } = game;
    state.level = 9;
    state.money = 99999;
    state.restaurant.tier = content.balance.takeout.tier;
    for (const id of Object.keys(state.inventory)) state.inventory[id] = 99;
    for (const r of state.menu.active) for (const s of content.recipes.get(r).ingredients) state.inventory[s.item] = 99;
    return game;
  }
  const run = (game: Game, minutes: number, until?: () => boolean) => {
    for (let i = 0; i < minutes && !until?.(); i++) game.tick(1);
  };

  it('chưa đủ hạng thì không có quầy cashier, không có cuộc gọi', () => {
    const game = quietGame();
    expect(roomOf(game.ctx).cashier).toBeUndefined();
    run(game, 200);
    expect(game.state.takeout.orders).toEqual([]);
    expect(game.dispatch({ type: 'courier/hire' }).ok).toBe(false);
  });

  it('khách gọi → nhận đơn → bếp nấu → bồi bàn mang ra quầy cashier → đóng gói → shipper giao → nhận tiền', () => {
    const game = shop();
    const { state } = game;
    const cashier = roomOf(game.ctx).cashier!;
    expect(cashier).toBeTruthy();
    // Quầy cashier là khối cố định: không đặt bàn đè lên
    expect(roomOf(game.ctx).walls!.some((w) => w.x1 < cashier.x && w.x2 > cashier.x && w.y1 < cashier.y && w.y2 > cashier.y)).toBe(true);
    expect(cashier.x).toBeGreaterThan(roomOf(game.ctx).width / 2); // bên phải cửa
    expect(cashier.seats.length).toBeGreaterThan(0); // dãy ghế chờ sau lưng nhân viên
    // Đầu quầy sát tường trước; khách từ cửa vào ghế chờ phải đi vòng qua đầu trong của quầy (không xuyên quầy)
    const room = roomOf(game.ctx);
    const block = room.walls!.find((w) => w.x1 < cashier.x && w.x2 > cashier.x)!;
    expect(block.y2).toBe(room.height);
    const door = { x: room.width / 2, y: room.height - 5 };
    let at = door;
    let minY = at.y;
    for (let i = 0; i < 12 && (at.x !== cashier.seats[0].x || at.y !== cashier.seats[0].y); i++) {
      at = walkWaypoint(game.ctx, at, cashier.seats[0]);
      minY = Math.min(minY, at.y);
    }
    expect(at).toEqual(cashier.seats[0]);
    expect(minY).toBeLessThan(block.y1);
    run(game, 200, () => state.takeout.orders.some((t) => t.status === 'calling'));
    const t = state.takeout.orders.find((x) => x.status === 'calling')!;
    expect(t).toBeTruthy();
    expect(game.dispatch({ type: 'takeout/accept', id: t.id }).ok).toBe(true);
    expect(t.status).toBe('cooking');
    expect(t.orderIds).toHaveLength(t.dishes.length);
    // Nấu xong hết rồi bồi bàn lấy ở quầy line, bấm quầy cashier
    run(game, 300, () => state.restaurant.orders.filter((o) => o.takeoutId === t.id).every((o) => o.status === 'ready'));
    const money = state.money;
    for (let round = 0; round < 5 && t.status === 'cooking'; round++) {
      expect(game.dispatch({ type: 'service/pickup' }).ok).toBe(true);
      run(game, 60, () => !state.restaurant.waiter.tasks.length);
      expect(game.dispatch({ type: 'service/handoff' }).ok).toBe(true);
      run(game, 60, () => !state.restaurant.waiter.tasks.length);
    }
    expect(t.status === 'packed' || t.status === 'shipping').toBe(true);
    expect(state.restaurant.orders.some((o) => o.takeoutId === t.id)).toBe(false);
    run(game, 5);
    expect(t.status).toBe('shipping');
    expect(state.restaurant.shipper.trip?.takeoutId).toBe(t.id);
    run(game, 60, () => t.status === 'done');
    expect(t.status).toBe('done');
    expect(t.late).toBe(false);
    expect(state.money).toBe(money + t.price + Math.round(t.price * content.balance.takeout.tip));
    expect(state.restaurant.shipper.trip).toBeNull();
  });

  it('quán ốc: quầy cashier ngay bên phải quầy line, không có ghế chờ', () => {
    const game = newGame(42, 'oc');
    game.state.restaurant.tier = content.balance.takeout.tier;
    const room = roomOf(game.ctx);
    const c = room.cashier!;
    expect(c.face).toBe('down');
    expect(c.seats).toEqual([]);
    expect(c.x).toBeGreaterThan(room.pass.x);
    expect(Math.abs(c.y - room.pass.y)).toBeLessThan(30);
  });

  it('thiếu nguyên liệu không nhận được; chuông reo quá lâu thì khách cúp máy', () => {
    const game = shop();
    const { state } = game;
    run(game, 200, () => state.takeout.orders.some((t) => t.status === 'calling'));
    const t = state.takeout.orders.find((x) => x.status === 'calling')!;
    for (const id of Object.keys(state.inventory)) state.inventory[id] = 0;
    expect(game.dispatch({ type: 'takeout/accept', id: t.id }).ok).toBe(false);
    run(game, content.balance.takeout.ring + 2);
    expect(t.status).toBe('missed');
  });

  it('giao trễ hẹn chỉ nhận một phần tiền; shipper thuê thêm nhận giao trước anh shipper gốc', () => {
    const game = shop();
    const { state } = game;
    expect(game.dispatch({ type: 'courier/hire' }).ok).toBe(true);
    expect(game.dispatch({ type: 'courier/hire' }).ok).toBe(false); // tối đa 1
    const courier = state.restaurant.couriers[0];
    run(game, 200, () => state.takeout.orders.some((t) => t.status === 'calling'));
    const t = state.takeout.orders.find((x) => x.status === 'calling')!;
    game.dispatch({ type: 'takeout/accept', id: t.id });
    // Giả như bếp nấu chậm: hẹn đã qua
    t.due = state.clock.minute - 1;
    for (let round = 0; round < 8 && t.status === 'cooking'; round++) {
      run(game, 300, () => state.restaurant.orders.some((o) => o.takeoutId === t.id && o.status === 'ready'));
      game.dispatch({ type: 'service/pickup' });
      run(game, 60, () => !state.restaurant.waiter.tasks.length);
      game.dispatch({ type: 'service/handoff' });
      run(game, 60, () => !state.restaurant.waiter.tasks.length);
    }
    run(game, 3);
    expect(courier.trip?.takeoutId).toBe(t.id);
    expect(state.restaurant.shipper.trip).toBeNull();
    const money = state.money;
    run(game, 60, () => t.status === 'done');
    expect(t.late).toBe(true);
    expect(state.money).toBe(money + Math.round(t.price * content.balance.takeout.lateRatio));
  });

  it('nhân viên phục vụ thuê tự mang món giao tận nơi ra quầy cashier', () => {
    const game = shop();
    const { state } = game;
    expect(game.dispatch({ type: 'helper/hire' }).ok).toBe(true);
    run(game, 200, () => state.takeout.orders.some((t) => t.status === 'calling'));
    const t = state.takeout.orders.find((x) => x.status === 'calling')!;
    game.dispatch({ type: 'takeout/accept', id: t.id });
    run(game, 600, () => t.status !== 'cooking');
    expect(['packed', 'shipping', 'done']).toContain(t.status);
  });

  it('save cũ (v27) nâng lên có giao tận nơi + mảng shipper thuê', () => {
    const game = newGame();
    const old = JSON.parse(serialize(game.state));
    delete old.takeout;
    delete old.restaurant.couriers;
    old.version = 27;
    const loaded = deserialize(JSON.stringify(old), content)!;
    expect(loaded.takeout).toEqual({ orders: [], nextCall: 0 });
    expect(loaded.restaurant.couriers).toEqual([]);
  });
});
