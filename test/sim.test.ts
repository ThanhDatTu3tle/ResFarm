import { describe, expect, it } from 'vitest';
import { createContent } from '../src/data';
import { Game } from '../src/sim/game';
import { modifier } from '../src/sim/helpers';
import { deserialize, serialize } from '../src/sim/save';
import { canPlaceTable, tablePos } from '../src/sim/layout';
import { activeTables, findSeats } from '../src/sim/systems/customers';
import { priceOf } from '../src/sim/systems/market';

const content = createContent();
const newGame = (seed = 42) => new Game(content, { seed });

/** Chạy tới khi hết ngày (màn tổng kết). */
function runDay(game: Game): void {
  for (let i = 0; i < 5000 && game.state.clock.phase !== 'summary'; i++) game.tick(1);
  expect(game.state.clock.phase).toBe('summary');
}

describe('nội dung', () => {
  it('hợp lệ; quán khởi đầu có quầy 4 ghế đơn + bàn 6, bàn 4, bàn đôi', () => {
    const start = content.tables.all().filter((t) => !t.requiresUpgrade);
    expect(start.map((t) => t.seats).sort()).toEqual([2, 4, 4, 6]);
    expect(start.filter((t) => t.shared)).toHaveLength(1);
  });
});

describe('xếp bàn', () => {
  it('khách lẻ ngồi quầy, nhóm 6 ngồi bàn lớn, nhóm 2 ngồi bàn đôi', () => {
    const { ctx } = newGame();
    expect(findSeats(ctx, 1)?.tableId).toBe('counter');
    expect(findSeats(ctx, 6)?.tableId).toBe('big');
    expect(findSeats(ctx, 2)?.tableId).toBe('pair');
    expect(findSeats(ctx, 7)).toBeNull();
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
    expect(today.guestsServed).toBeGreaterThan(10);
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
    game.state.upgrades.push('patio');
    for (const t of activeTables(game.ctx).filter((t) => !t.fixed)) {
      const at = tablePos(game.ctx, t);
      expect(canPlaceTable(game.ctx, t.id, at.x, at.y), t.id).toBeNull();
    }
  });

  it('dời được bàn trống tới chỗ hợp lệ; chặn khi đè bàn khác, ra ngoài, bàn cố định, bàn có khách', () => {
    const game = newGame();
    expect(game.dispatch({ type: 'layout/moveTable', tableId: 'pair', x: 612, y: 301 }).ok).toBe(true);
    expect(game.state.restaurant.layout.pair).toEqual({ x: 610, y: 300 });
    expect(game.dispatch({ type: 'layout/moveTable', tableId: 'pair', x: 400, y: 340 }).ok).toBe(false);
    expect(game.dispatch({ type: 'layout/moveTable', tableId: 'pair', x: 10, y: 300 }).ok).toBe(false);
    expect(game.dispatch({ type: 'layout/moveTable', tableId: 'counter', x: 360, y: 300 }).ok).toBe(false);

    game.state.restaurant.parties.push({ id: 99, size: 2, phase: 'eating', tableId: 'pair', seats: [0, 1], patience: 1, patienceMax: 1, timer: 5, orderIds: [], looks: [0, 0] });
    expect(game.dispatch({ type: 'layout/moveTable', tableId: 'pair', x: 610, y: 440 }).ok).toBe(false);
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

  it('save phiên bản 1 được nâng cấp: có thời tiết và đủ 9 ô ruộng', () => {
    const old = JSON.parse(serialize(newGame().state));
    old.version = 1;
    delete old.weather;
    delete old.decor;
    delete old.restaurant.layout;
    old.farm.slots = old.farm.slots.filter((s: { id: string }) => ['field-0', 'field-1', 'pen-0'].includes(s.id));
    const state = deserialize(JSON.stringify(old), content)!;
    expect(content.weathers.has(state.weather.id)).toBe(true);
    expect(state.farm.slots.filter((s) => s.type === 'field')).toHaveLength(9);
    expect(state.farm.slots.filter((s) => s.type === 'pond')).toHaveLength(1);
    expect(state.farm.slots.find((s) => s.id === 'field-0')).toMatchObject({ tilled: true, wet: 0, tier: 1 });
    expect(state.decor.equipped.floor).toBe('floor_wood');
    expect(state.restaurant.layout).toEqual({});
    new Game(content, { state }).tick(500);
  });

  it('save hỏng trả về null', () => {
    expect(deserialize('{oops', content)).toBeNull();
    expect(deserialize(null, content)).toBeNull();
  });
});
