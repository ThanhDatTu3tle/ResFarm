import { Registry } from '../core/registry';
import { balance } from './balance';
import { cuisines } from './cuisines';
import { decor } from './decor';
import { mills, producers, slotTypes } from './farm';
import { quests } from './quests';
import { regulars } from './regulars';
import { pets, props, tableKinds } from './props';
import { items } from './items';
import { stalls } from './market';
import { recipes } from './recipes';
import { room, staff, tables, upgrades } from './restaurant';
import { weathers } from './weather';
import type { Balance, CuisineDef, CuisineId, MillTypeDef, ItemDef, ProducerDef, RecipeDef, SlotTypeDef, DecorDef, DecorSlot, RoomDef, StaffDef, StallDef, TableDef, UpgradeDef, WeatherDef, SlotType, QuestDef, RegularDef, PropDef, PetDef, TableKindDef } from './types';

export * from './types';

/** Toàn bộ nội dung game đã lập chỉ mục. Sim nhận Content qua tham số nên test có thể truyền nội dung riêng. */
export interface Content {
  items: Registry<ItemDef>;
  recipes: Registry<RecipeDef>;
  producers: Registry<ProducerDef>;
  slotTypes: Registry<SlotTypeDef>;
  stalls: Registry<StallDef>;
  tables: Registry<TableDef>;
  staff: Registry<StaffDef>;
  upgrades: Registry<UpgradeDef>;
  weathers: Registry<WeatherDef>;
  decor: Registry<DecorDef>;
  cuisines: Registry<CuisineDef>;
  mills: Registry<MillTypeDef>;
  /** Nhiệm vụ hệ thống theo thứ tự làm. */
  quests: QuestDef[];
  regulars: Registry<RegularDef>;
  props: Registry<PropDef>;
  pets: Registry<PetDef>;
  tableKinds: Registry<TableKindDef>;
  room: RoomDef;
  balance: Balance;
}

export interface RawContent {
  items: ItemDef[];
  recipes: RecipeDef[];
  producers: ProducerDef[];
  slotTypes: SlotTypeDef[];
  stalls: StallDef[];
  tables: TableDef[];
  staff: StaffDef[];
  upgrades: UpgradeDef[];
  weathers: WeatherDef[];
  decor: DecorDef[];
  cuisines: CuisineDef[];
  mills: MillTypeDef[];
  quests: QuestDef[];
  regulars: RegularDef[];
  props: PropDef[];
  pets: PetDef[];
  tableKinds: TableKindDef[];
  room: RoomDef;
  balance: Balance;
}

export const defaultRawContent: RawContent = { items, recipes, producers, slotTypes, stalls, tables, staff, upgrades, weathers, decor, cuisines, mills, quests, regulars, props, pets, tableKinds, room, balance };

/** Dựng Content và kiểm tra tham chiếu chéo; ném lỗi nếu dữ liệu sai. */
export function createContent(raw: RawContent = defaultRawContent): Content {
  const content: Content = {
    items: new Registry('item', raw.items),
    recipes: new Registry('recipe', raw.recipes),
    producers: new Registry('producer', raw.producers),
    slotTypes: new Registry('slotType', raw.slotTypes),
    stalls: new Registry('stall', raw.stalls),
    tables: new Registry('table', raw.tables),
    staff: new Registry('staff', raw.staff),
    upgrades: new Registry('upgrade', raw.upgrades),
    weathers: new Registry('weather', raw.weathers),
    decor: new Registry('decor', raw.decor),
    cuisines: new Registry('cuisine', raw.cuisines),
    mills: new Registry('mill', raw.mills),
    quests: raw.quests,
    regulars: new Registry('regular', raw.regulars),
    props: new Registry('prop', raw.props),
    pets: new Registry('pet', raw.pets),
    tableKinds: new Registry('tableKind', raw.tableKinds),
    room: raw.room,
    balance: raw.balance,
  };
  const errors = validateContent(content);
  if (errors.length) throw new Error('Dữ liệu nội dung không hợp lệ:\n- ' + errors.join('\n- '));
  return content;
}

/** Trả về danh sách lỗi dữ liệu (rỗng = hợp lệ). */
export function validateContent(c: Content): string[] {
  const errors: string[] = [];
  const needItem = (id: string, where: string) => {
    if (!c.items.has(id)) errors.push(`${where}: nguyên liệu "${id}" không tồn tại`);
  };

  const obtainable = new Set<string>();
  for (const stall of c.stalls.all()) {
    for (const id of stall.items) {
      needItem(id, `sạp ${stall.id}`);
      if (c.items.has(id) && c.items.get(id).infinite) errors.push(`sạp ${stall.id}: "${id}" là nguyên liệu vô hạn, không cần bán`);
      obtainable.add(id);
    }
  }
  for (const p of c.producers.all()) {
    if (!c.slotTypes.has(p.slot)) errors.push(`producer ${p.id}: loại ô "${p.slot}" không tồn tại`);
    if (p.cycles !== 1 && p.regrowTime == null) errors.push(`producer ${p.id}: nhiều chu kỳ thì cần regrowTime`);
    for (const y of p.yields) {
      needItem(y.item, `producer ${p.id}`);
      obtainable.add(y.item);
    }
  }
  for (const m of c.mills.all()) {
    needItem(m.input, `cối ${m.id}`);
    for (const p of m.products) {
      needItem(p, `cối ${m.id}`);
      obtainable.add(p);
    }
    if (!m.products.length) errors.push(`cối ${m.id}: cần ít nhất 1 thành phẩm`);
  }
  for (const t of c.slotTypes.all()) {
    for (const id of t.initialPlants ?? []) if (!c.producers.has(id) || !fitsSlot(c.producers.get(id), t.id)) errors.push(`loại ô ${t.id}: cây trồng sẵn "${id}" không trồng được ở đây`);
    if (t.layout.spots && t.layout.spots.length < t.max) errors.push(`loại ô ${t.id}: thiếu vị trí (spots) cho ${t.max} ô`);
  }
  for (const t of c.slotTypes.all()) if (t.mill && !c.mills.has(t.mill)) errors.push(`loại ô ${t.id}: cối "${t.mill}" không tồn tại`);
  const questIds = new Set<string>();
  for (const q of c.quests) {
    if (questIds.has(q.id)) errors.push(`nhiệm vụ ${q.id}: trùng id`);
    questIds.add(q.id);
    if (!(q.goal.target > 0)) errors.push(`nhiệm vụ ${q.id}: mục tiêu phải > 0`);
  }
  for (const r of c.recipes.all()) {
    if (!r.ingredients.length) errors.push(`món ${r.id}: không có nguyên liệu`);
    for (const ing of r.ingredients) {
      needItem(ing.item, `món ${r.id}`);
      if (c.items.has(ing.item) && !c.items.get(ing.item).infinite && !obtainable.has(ing.item)) {
        errors.push(`món ${r.id}: "${ing.item}" không có nguồn nào (chợ hoặc nông trại)`);
      }
    }
  }
  for (const cu of c.cuisines.all()) {
    if (!c.recipes.all().some((r) => r.cuisine === cu.id && r.unlock.level <= 1 && r.unlock.cost === 0)) errors.push(`quán ${cu.id}: không có món khởi đầu nào`);
    for (const id of cu.showcase) if (!c.recipes.has(id) || c.recipes.get(id).cuisine !== cu.id) errors.push(`quán ${cu.id}: món giới thiệu "${id}" không thuộc thực đơn`);
    for (const s of cu.startInventory) needItem(s.item, `startInventory của quán ${cu.id}`);
  }
  for (const r of c.recipes.all()) if (!c.cuisines.has(r.cuisine)) errors.push(`món ${r.id}: quán "${r.cuisine}" không tồn tại`);
  for (const t of c.tables.all()) {
    if (t.requiresUpgrade && !c.upgrades.has(t.requiresUpgrade)) errors.push(`bàn ${t.id}: nâng cấp "${t.requiresUpgrade}" không tồn tại`);
  }
  for (const u of c.upgrades.all()) {
    if (u.requires && !c.upgrades.has(u.requires)) errors.push(`nâng cấp ${u.id}: "${u.requires}" không tồn tại`);
  }
  for (const cu of c.cuisines.all()) {
    for (const slot of ['floor', 'wall', 'furniture'] satisfies DecorSlot[]) {
      const defaults = defaultDecor(c, cu.id).filter((d) => d.slot === slot);
      if (defaults.length !== 1 || defaults[0].cost !== 0) errors.push(`quán ${cu.id}, nội thất "${slot}": cần đúng 1 món mặc định giá 0`);
    }
  }
  if (!c.weathers.all().length) errors.push('cần ít nhất 1 kiểu thời tiết');
  for (const r of c.regulars.all()) {
    for (const cu of c.cuisines.all()) {
      const fav = r.favorites[cu.id];
      if (!c.recipes.has(fav) || c.recipes.get(fav).cuisine !== cu.id) errors.push(`khách quen ${r.id}: món ruột "${fav}" không thuộc thực đơn quán ${cu.id}`);
    }
    if (!c.props.has(r.gift)) errors.push(`khách quen ${r.id}: quà "${r.gift}" không tồn tại`);
  }
  for (const p of c.props.all()) if (p.cuisine && !c.cuisines.has(p.cuisine)) errors.push(`đồ trang trí ${p.id}: quán "${p.cuisine}" không tồn tại`);
  const tiers = c.room.tiers;
  if (!tiers.length || tiers[0].height !== c.room.height) errors.push('hạng quán: hạng 1 phải có height bằng room.height');
  tiers.forEach((t, i) => {
    if (t.id !== i + 1) errors.push(`hạng quán thứ ${i + 1}: id phải là ${i + 1}`);
    if (i && t.height <= tiers[i - 1].height) errors.push(`hạng quán ${t.id}: phòng phải sâu hơn hạng trước`);
  });
  return errors;
}

/** Mặt bằng hạng 1 của quán phong cách này: mặt bằng chung + phần ghi đè riêng (room.variants). */
export function roomFor(c: Content, cuisine: CuisineId): RoomDef {
  const v = c.room.variants?.[cuisine];
  return v ? { ...c.room, ...v } : c.room;
}

/** Nội thất bán cho quán phong cách này (món riêng của quán + món dùng chung). */
export function decorFor(c: Content, cuisine: CuisineId): DecorDef[] {
  return c.decor.all().filter((d) => !d.cuisine || d.cuisine === cuisine);
}

/** Nội thất có sẵn từ đầu của quán phong cách này (mỗi slot một món). */
export function defaultDecor(c: Content, cuisine: CuisineId): DecorDef[] {
  return decorFor(c, cuisine).filter((d) => d.isDefault);
}

/** Giống này trồng / nuôi được ở loại ô này không (ô chính hoặc alsoIn). */
export function fitsSlot(p: ProducerDef, type: SlotType): boolean {
  return p.slot === type || !!p.alsoIn?.includes(type);
}

/** Thực đơn đầy đủ của quán phong cách này. */
export function recipesFor(c: Content, cuisine: CuisineId): RecipeDef[] {
  return c.recipes.all().filter((r) => r.cuisine === cuisine);
}
