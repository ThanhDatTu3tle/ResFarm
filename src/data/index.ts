import { Registry } from '../core/registry';
import { balance } from './balance';
import { decor } from './decor';
import { producers, slotTypes } from './farm';
import { items } from './items';
import { stalls } from './market';
import { recipes } from './recipes';
import { room, staff, tables, upgrades } from './restaurant';
import { weathers } from './weather';
import type { Balance, ItemDef, ProducerDef, RecipeDef, SlotTypeDef, DecorDef, DecorSlot, RoomDef, StaffDef, StallDef, TableDef, UpgradeDef, WeatherDef } from './types';

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
  room: RoomDef;
  balance: Balance;
}

export const defaultRawContent: RawContent = { items, recipes, producers, slotTypes, stalls, tables, staff, upgrades, weathers, decor, room, balance };

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
  for (const r of c.recipes.all()) {
    if (!r.ingredients.length) errors.push(`món ${r.id}: không có nguyên liệu`);
    for (const ing of r.ingredients) {
      needItem(ing.item, `món ${r.id}`);
      if (c.items.has(ing.item) && !c.items.get(ing.item).infinite && !obtainable.has(ing.item)) {
        errors.push(`món ${r.id}: "${ing.item}" không có nguồn nào (chợ hoặc nông trại)`);
      }
    }
  }
  if (!c.recipes.all().some((r) => r.unlock.level <= 1 && r.unlock.cost === 0)) errors.push('không có món khởi đầu nào');
  for (const t of c.tables.all()) {
    if (t.requiresUpgrade && !c.upgrades.has(t.requiresUpgrade)) errors.push(`bàn ${t.id}: nâng cấp "${t.requiresUpgrade}" không tồn tại`);
  }
  for (const u of c.upgrades.all()) {
    if (u.requires && !c.upgrades.has(u.requires)) errors.push(`nâng cấp ${u.id}: "${u.requires}" không tồn tại`);
  }
  for (const slot of ['floor', 'wall', 'furniture'] satisfies DecorSlot[]) {
    const defaults = c.decor.all().filter((d) => d.slot === slot && d.isDefault);
    if (defaults.length !== 1 || defaults[0].cost !== 0) errors.push(`nội thất "${slot}": cần đúng 1 món mặc định giá 0`);
  }
  if (!c.weathers.all().length) errors.push('cần ít nhất 1 kiểu thời tiết');
  for (const s of c.balance.startInventory) needItem(s.item, 'startInventory');
  return errors;
}
