/**
 * SỔ TAY (cơ sở dữ liệu tra cứu) - tự sinh từ src/data, đổi số trong game thì chạy lại là khớp.
 *
 *   npm run sotay                 → notes/so-tay-quan-nha-vuon.html (notes/ không lên GitHub)
 *   npm run sotay -- <đường-dẫn>  → ghi ra chỗ khác
 *
 * Cách làm: nạp các module data bằng Vite (đọc thẳng TypeScript), tính sẵn vài con số dẫn xuất
 * (giây thực, giá vốn, lãi mỗi món / mỗi vụ...), nhúng tất cả thành JSON vào khuôn scripts/so-tay.html.
 * Script chỉ ĐỌC data, không đụng sim / UI.
 */
import { createServer } from 'vite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, process.argv[2] ?? 'notes/so-tay-quan-nha-vuon.html');

const vite = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
let db;
try {
  const load = (p) => vite.ssrLoadModule(p);
  const [data, items, decor, farmhands, achievements, calendar, events, quests, farm] = await Promise.all([
    load('/src/data/index.ts'),
    load('/src/data/items.ts'),
    load('/src/data/decor.ts'),
    load('/src/data/farmhands.ts'),
    load('/src/data/achievements.ts'),
    load('/src/data/calendar.ts'),
    load('/src/data/events.ts'),
    load('/src/data/quests.ts'),
    load('/src/data/farm.ts'),
  ]);
  // Gói nâng hạng + đủ bàn: chạy thử lõi mô phỏng (Game) cho từng quán
  const [simGame, simHome, simLayout] = await Promise.all([load('/src/sim/game.ts'), load('/src/sim/systems/home.ts'), load('/src/sim/layout.ts')]);
  const raw = data.defaultRawContent;
  data.createContent(raw); // ném lỗi nếu data sai → không sinh Sổ tay từ data hỏng
  const kits = tierKits(data, raw, simGame, simHome, simLayout);
  db = build(raw, { items, decor, farmhands, achievements, calendar, events, quests, farm });
  db.tierKits = kits;
  db.fullKitDiscount = simHome.FULL_KIT_DISCOUNT;
} finally {
  await vite.close();
}

const html = readFileSync(resolve(root, 'scripts/so-tay.html'), 'utf8').replace('/*__DB__*/null', () => JSON.stringify(db).replace(/</g, '\\u003c'));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
const counts = Object.entries(db.counts).map(([k, v]) => `${v} ${k}`).join(', ');
console.log(`Sổ tay → ${out}\n  ${counts}`);

// ---------------------------------------------------------------------------

function build(raw, m) {
  const b = raw.balance;
  const mps = b.minutesPerSecond;
  const sec = (min) => (min == null ? null : Math.round((min / mps) * 10) / 10);
  const itemById = Object.fromEntries(raw.items.map((i) => [i.id, i]));
  const headChef = raw.staff.find((s) => s.id === 'head_chef') ?? raw.staff[0];

  // Nguồn của từng nguyên liệu
  const src = Object.fromEntries(raw.items.map((i) => [i.id, { stalls: [], producers: [], mills: [], recipes: [] }]));
  for (const s of raw.stalls) for (const id of s.items) src[id]?.stalls.push({ id: s.id, price: Math.max(1, Math.round(itemById[id].basePrice * s.markup)) });
  for (const p of raw.producers) for (const y of p.yields) src[y.item]?.producers.push(p.id);
  for (const ml of raw.mills) for (const id of ml.products) src[id]?.mills.push(ml.id);
  for (const r of raw.recipes) for (const ing of r.ingredients) src[ing.item]?.recipes.push(r.id);

  /** Giá một đơn vị để tính giá vốn: sạp rẻ nhất (giá gốc × hệ số sạp), không bán ở chợ thì giá gốc. */
  const unitCost = (id) => {
    const it = itemById[id];
    if (!it || it.infinite) return 0;
    const st = src[id].stalls;
    return st.length ? Math.min(...st.map((s) => s.price)) : it.basePrice;
  };

  const items = raw.items.map((i) => ({
    ...i,
    categoryName: m.items.categoryNames[i.category],
    sellPrice: i.infinite ? null : Math.max(1, Math.round(i.basePrice * b.contracts.sellRatio)),
    ...src[i.id],
  }));

  const recipes = raw.recipes.map((r) => {
    const cost = r.ingredients.reduce((s, g) => s + g.qty * unitCost(g.item), 0);
    const cookSec = Math.round((r.cookTime / headChef.speed / mps) * 10) / 10;
    return { ...r, cookSec, cost, profit: r.price - cost, profitPerSec: Math.round(((r.price - cost) / cookSec) * 10) / 10, seasonPrice: r.seasons ? Math.round(r.price * b.seasons.dishBonus) : null };
  });

  const producers = raw.producers.map((p) => {
    const value = p.yields.reduce((s, y) => s + y.qty * (itemById[y.item]?.basePrice ?? 0), 0);
    const day = m.farm.FARM_DAY;
    return { ...p, growDays: p.growTime / day, regrowDays: p.regrowTime == null ? null : p.regrowTime / day, yieldValue: value, firstProfit: value - p.cost };
  });

  const slotTypes = raw.slotTypes.map((t) => ({
    ...t,
    prices: Array.from({ length: Math.max(0, t.max - t.initial) }, (_, n) => Math.round(t.basePrice * t.priceGrowth ** n)),
    producers: raw.producers.filter((p) => p.slot === t.id || p.alsoIn?.includes(t.id)).map((p) => p.id),
  }));
  const mills = raw.mills.map((ml) => ({ ...ml, timeSec: sec(ml.time), prices: Array.from({ length: Math.max(0, ml.max - ml.initial) }, (_, n) => Math.round(ml.basePrice * ml.priceGrowth ** n)) }));

  const stalls = raw.stalls.map((s) => ({ ...s, goods: s.items.map((id) => ({ id, price: Math.max(1, Math.round(itemById[id].basePrice * s.markup)) })) }));

  const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`;
  const overview = {
    mps,
    dayMinutes: b.closeMinute - b.openMinute,
    dayRealMin: Math.round((b.closeMinute - b.openMinute) / mps / 60),
    open: hhmm(b.openMinute),
    close: hhmm(b.closeMinute),
    daysPerSeason: m.calendar.DAYS_PER_SEASON,
    shifts: b.shifts.map((s) => ({ from: hhmm(s.from), lastCall: hhmm(s.lastCall), to: hhmm(s.to), kickOut: hhmm(s.kickOut) })),
    eatTime: b.eatTime.map(([a, z], i) => ({ size: i + 1, from: sec(a), to: sec(z) })),
    partySizeWeights: b.partySizeWeights,
    traffic: b.traffic,
    startMoney: b.startMoney,
    startReputation: b.startReputation,
    spawnSec: sec(b.spawnInterval),
    rushHours: b.rushHours.map((r) => ({ from: hhmm(r.from), to: hhmm(r.to), factor: r.factor })),
    patience: { queue: sec(b.queuePatience), food: sec(b.foodPatience), perGuest: sec(b.foodPatiencePerGuest), menu: sec(b.service.menuPatience), order: sec(b.service.orderPatience), moodStep: sec(b.service.moodStep), browse: b.service.browseTime.map(sec) },
    service: { carryMax: b.service.carryMax, mopSec: sec(b.service.mopTime), moodTip: b.service.moodTip, partyColors: b.service.partyColors, tipRate: b.tipRate },
    reputation: b.reputation,
    xpPerCoin: b.xpPerCoin,
    crew: { ...b.crew, lunchBack: hhmm(b.crew.lunchBack), farmerLunch: { from: hhmm(b.crew.farmerLunch.from), to: hhmm(b.crew.farmerLunch.to) }, endDayAfter: hhmm(b.crew.endDayAfter), eatSec: sec(b.crew.eatMinutes), dinnerSec: sec(b.crew.dinnerMinutes) },
    farm: { waterSec: sec(b.farm.waterDuration), dryGrowth: b.farm.dryGrowth, farmerSpeed: b.farmer.speed, farmerWorkSec: sec(b.farmer.workTime) },
    market: { swing: b.marketSwing, seasons: b.seasons },
    contracts: { ...b.contracts, due: hhmm(b.contracts.due) },
    events: b.events,
    stains: b.stains,
    lowStockPortions: b.lowStockPortions,
    resellRate: b.resellRate,
    regulars: b.regulars,
  };

  const kitchenTiers = b.kitchen.tiers.map((t, i) => ({ id: i + 1, ...t }));
  const gardeners = { ...b.gardeners, workSec: sec(b.gardeners.workTime), jobs: m.farmhands.gardenerJobs };
  const helpers = b.helpers;

  const weathers = raw.weathers.map((w) => ({ ...w, durationSec: w.duration.map(sec) }));
  const regulars = raw.regulars.map((r) => ({ id: r.id, name: r.name, icon: r.icon, bio: r.bio, greet: r.greet, favorites: r.favorites, unlock: r.unlock, gift: r.gift, build: r.style.build }));

  const db = {
    generated: new Date().toISOString(),
    overview,
    cuisines: raw.cuisines,
    items,
    recipes,
    producers,
    slotTypes,
    mills,
    stalls,
    tables: raw.tables,
    tableKinds: raw.tableKinds,
    staff: raw.staff,
    kitchenTiers,
    chefHireCost: b.kitchen.chefHireCost,
    upgrades: raw.upgrades,
    roomTiers: raw.room.tiers,
    decor: raw.decor.map(({ colors, ...d }) => ({ ...d, slotName: m.decor.decorSlotNames[d.slot], colors })),
    props: raw.props,
    pets: raw.pets,
    regulars,
    gardeners,
    helpers,
    tools: m.farmhands.farmTools,
    quests: raw.quests,
    questChapters: m.quests.questChapters,
    achievements: m.achievements.achievements,
    seasons: m.calendar.seasons,
    festivals: m.calendar.festivals,
    weathers,
    events: m.events.events,
  };
  db.counts = {
    'nguyên liệu': items.length,
    'món': recipes.length,
    'giống / con': producers.length,
    'sạp': stalls.length,
    'nhiệm vụ': raw.quests.length,
    'thành tựu': db.achievements.length,
  };
  return db;
}

/**
 * Mỗi quán, mỗi hạng: số bàn tối đa theo số ghế (đã trang bị đủ) và giá gói "nâng hạng + đủ bàn"
 * tính từ hạng trước đã trang bị đủ (đúng luật trong game - fullKitPlan).
 */
function tierKits(data, raw, simGame, simHome, simLayout) {
  const rows = [];
  for (const cu of raw.cuisines.map((c) => c.id)) {
    const game = new simGame.Game(data.createContent(raw), { seed: 1, cuisine: cu });
    game.state.level = 99;
    const count = () => {
      const by = {};
      for (const t of simLayout.activeTables(game.ctx)) if (!t.shared) by[t.seats] = (by[t.seats] ?? 0) + 1;
      return by;
    };
    rows.push({ cuisine: cu, tier: 1, tables: count(), plan: null });
    for (;;) {
      const plan = simHome.fullKitPlan(game.ctx);
      if (!plan) break;
      game.state.money = 1e9;
      const ok = plan.tables.length ? game.dispatch({ type: 'restaurant/upgradeFull' }).ok : game.dispatch({ type: 'restaurant/upgrade' }).ok;
      if (!ok) break;
      rows.push({ cuisine: cu, tier: game.state.restaurant.tier, tables: count(), plan: { upgradeCost: plan.upgradeCost, tablesCost: plan.full - plan.upgradeCost, full: plan.full, price: plan.tables.length ? plan.price : plan.full } });
    }
  }
  return rows;
}
