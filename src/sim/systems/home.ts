import { spend } from '../helpers';
import { activeTables, canPlaceProp, canPlaceTable, findFreeSpot, footprint, freeArtSlot, LAYOUT_GRID, occupiedSeats, propRect, roomOf, tableById, withRotation } from '../layout';
import { OWNER_NAME_MAX, type PropState } from '../state';
import { fail, ok, type SimContext, type System } from '../types';

/**
 * QUÁN CỦA RIÊNG MÌNH (Giai đoạn 3):
 *  - F5: đặt tên quán, nhận nuôi thú cưng (1 con đang ở quán, đổi qua lại miễn phí).
 *  - F4: đồ trang trí đặt tự do — mua là tự đặt vào chỗ trống; dời, xoay, cất kho, bày lại, bán lại.
 *  - B2: xoay bàn 90°. B7: mua thêm bàn lẻ, bán lại khi không cần.
 *  - C3: nâng hạng quán (phòng ăn sâu thêm, xem roomOf trong layout.ts).
 * Hiệu ứng của thú cưng, đồ trang trí và hạng quán được gộp trong modifier() ở helpers.ts.
 */
export const homeSystem: System = {
  id: 'home',
  commands: {
    'profile/rename'(ctx, cmd) {
      const name = cmd.name.replace(/\s+/g, ' ').trim();
      if (!name) return fail('Tên quán không được để trống.');
      if (name.length > 24) return fail('Tên quán tối đa 24 ký tự.');
      ctx.state.profile.name = name;
      return ok();
    },
    'profile/renameOwner'(ctx, cmd) {
      const name = cmd.name.replace(/\s+/g, ' ').trim();
      if (!name) return fail('Tên không được để trống.');
      if (name.length > OWNER_NAME_MAX) return fail(`Tên tối đa ${OWNER_NAME_MAX} ký tự.`);
      ctx.state.owner.name = name;
      return ok();
    },
    'pet/adopt'(ctx, cmd) {
      const { state, content } = ctx;
      if (!content.pets.has(cmd.petId)) return fail('Không có thú cưng này.');
      const def = content.pets.get(cmd.petId);
      if (!state.profile.pets.includes(def.id)) {
        if (state.level < def.level) return fail(`Cần cấp ${def.level}.`);
        if (!spend(ctx, def.cost)) return fail('Không đủ tiền.');
        state.profile.pets.push(def.id);
      }
      if (!state.profile.petsOut.includes(def.id)) state.profile.petsOut.push(def.id);
      return ok();
    },
    // Cho một bé ra quán / về nhà nghỉ (nhiều bé ở quán cùng lúc được)
    'pet/set'(ctx, cmd) {
      const p = ctx.state.profile;
      if (!p.pets.includes(cmd.petId)) return fail('Chưa nhận nuôi bé này.');
      p.petsOut = p.petsOut.filter((id) => id !== cmd.petId);
      if (cmd.out) p.petsOut.push(cmd.petId);
      return ok();
    },

    // ---------- Đồ trang trí ----------
    'prop/buy'(ctx, cmd) {
      const { state, content } = ctx;
      if (!content.props.has(cmd.propId)) return fail('Không có món này.');
      const def = content.props.get(cmd.propId);
      if (def.giftOnly) return fail('Món này chỉ có khi khách quen tặng.');
      if (def.cuisine && def.cuisine !== state.cuisine) return fail('Món này không hợp phong cách quán.');
      if (state.level < def.level) return fail(`Cần cấp ${def.level}.`);
      if (def.wall) {
        const slot = freeArtSlot(ctx);
        if (slot == null) return fail('Tường hết chỗ treo tranh — cất bớt tranh vào kho.');
        if (!spend(ctx, def.cost)) return fail('Không đủ tiền.');
        state.restaurant.props.push({ uid: `p${state.nextId++}`, def: def.id, x: slot, y: 0, rot: 0, stored: false });
        return ok();
      }
      const spot = findFreeSpot(ctx, (x, y) => propRect(def, x, y, 0));
      if (!spot) return fail('Khu ăn uống hết chỗ trống — dời bớt bàn hoặc cất bớt đồ.');
      if (!spend(ctx, def.cost)) return fail('Không đủ tiền.');
      state.restaurant.props.push({ uid: `p${state.nextId++}`, def: def.id, x: spot.x, y: spot.y, rot: 0, stored: false });
      return ok();
    },
    'prop/move'(ctx, cmd) {
      const prop = findProp(ctx, cmd.uid);
      if (!prop || prop.stored) return fail('Món này đang cất trong kho.');
      if (ctx.content.props.get(prop.def).wall) return fail('Tranh treo trên tường — bấm "Đổi chỗ" để chuyển sang khung khác.');
      const x = snap(cmd.x);
      const y = snap(cmd.y);
      const problem = canPlaceProp(ctx, prop.uid, x, y, prop.rot);
      if (problem) return fail(problem);
      Object.assign(prop, { x, y });
      return ok();
    },
    'prop/rotate'(ctx, cmd) {
      const prop = findProp(ctx, cmd.uid);
      if (!prop || prop.stored) return fail('Món này đang cất trong kho.');
      // Tranh treo tường: "xoay" = chuyển sang khung trống kế tiếp
      if (ctx.content.props.get(prop.def).wall) {
        const slot = freeArtSlot(ctx, prop.uid, prop.x + 1);
        if (slot == null || slot === prop.x) return fail('Không còn khung trống nào khác trên tường.');
        prop.x = slot;
        return ok();
      }
      const rot = (prop.rot + 1) % 2;
      const problem = canPlaceProp(ctx, prop.uid, prop.x, prop.y, rot);
      if (problem) return fail(`Không xoay được: ${problem.toLowerCase()}`);
      prop.rot = rot;
      return ok();
    },
    'prop/store'(ctx, cmd) {
      const prop = findProp(ctx, cmd.uid);
      if (!prop) return fail('Không có món này.');
      prop.stored = true;
      return ok();
    },
    'prop/place'(ctx, cmd) {
      const prop = findProp(ctx, cmd.uid);
      if (!prop) return fail('Không có món này.');
      if (!prop.stored) return ok();
      const def = ctx.content.props.get(prop.def);
      if (def.wall) {
        const slot = freeArtSlot(ctx, prop.uid);
        if (slot == null) return fail('Tường hết chỗ treo tranh — cất bớt tranh vào kho.');
        Object.assign(prop, { x: slot, y: 0, stored: false });
        return ok();
      }
      const spot = findFreeSpot(ctx, (x, y) => propRect(def, x, y, prop.rot), prop.uid);
      if (!spot) return fail('Khu ăn uống hết chỗ trống.');
      Object.assign(prop, spot, { stored: false });
      return ok();
    },
    'prop/sell'(ctx, cmd) {
      const { state, content } = ctx;
      const prop = findProp(ctx, cmd.uid);
      if (!prop) return fail('Không có món này.');
      const def = content.props.get(prop.def);
      if (def.giftOnly) return fail('Quà của khách quen, bán đi thì buồn lắm — cất kho nhé.');
      state.restaurant.props = state.restaurant.props.filter((p) => p !== prop);
      const refund = resale(ctx, def.cost);
      state.money += refund; // tiền bán lại không tính vào doanh thu
      return ok();
    },

    // ---------- Bàn ----------
    'table/buy'(ctx, cmd) {
      const { state, content } = ctx;
      if (!content.tableKinds.has(cmd.kind)) return fail('Không có loại bàn này.');
      const kind = content.tableKinds.get(cmd.kind);
      if (state.level < kind.level) return fail(`Cần cấp ${kind.level}.`);
      const probe = { id: '', name: kind.name, seats: kind.seats, w: kind.w, h: kind.h, x: 0, y: 0 };
      const spot = findFreeSpot(ctx, (x, y) => footprint(probe, { x, y }));
      if (!spot) return fail('Khu ăn uống hết chỗ đặt bàn — nâng hạng quán hoặc dời bớt đồ.');
      if (!spend(ctx, kind.cost)) return fail('Không đủ tiền.');
      const id = `t${state.nextId++}`;
      state.restaurant.extraTables.push({ id, kind: kind.id });
      state.restaurant.layout[id] = { x: spot.x, y: spot.y };
      return ok();
    },
    'table/sell'(ctx, cmd) {
      const { state, content } = ctx;
      const r = state.restaurant;
      const extra = r.extraTables.find((t) => t.id === cmd.tableId);
      if (!extra) return fail('Chỉ bán lại được bàn mua thêm.');
      if (occupiedSeats(ctx, extra.id).length) return fail('Bàn đang có khách.');
      r.extraTables = r.extraTables.filter((t) => t !== extra);
      delete r.layout[extra.id];
      state.money += resale(ctx, content.tableKinds.get(extra.kind).cost);
      return ok();
    },
    'layout/rotateTable'(ctx, cmd) {
      const table = tableById(ctx, cmd.tableId);
      if (!table) return fail('Không có bàn này.');
      const at = ctx.state.restaurant.layout[table.id] ?? { x: table.x, y: table.y };
      const rot = !table.rotated;
      const problem = canPlaceTable(ctx, table.id, at.x, at.y, rot);
      if (problem) return fail(problem.startsWith('Bàn') || problem.includes('khách') || problem.includes('cố định') ? problem : `Không xoay được: ${problem}`);
      ctx.state.restaurant.layout[table.id] = { x: at.x, y: at.y, rot };
      return ok();
    },

    // ---------- Hạng quán ----------
    'restaurant/upgrade'(ctx) {
      const { state, content } = ctx;
      const next = content.room.tiers[state.restaurant.tier];
      if (!next) return fail('Quán đã ở hạng cao nhất.');
      if (state.level < next.level) return fail(`Cần cấp ${next.level}.`);
      if (!spend(ctx, next.cost)) return fail('Không đủ tiền.');
      state.restaurant.tier = next.id;
      ctx.bus.emit('restaurant/upgraded', { tier: next.id });
      return ok();
    },
  },
};

const snap = (v: number) => Math.round(v / LAYOUT_GRID) * LAYOUT_GRID;

function findProp(ctx: SimContext, uid: string): PropState | undefined {
  return ctx.state.restaurant.props.find((p) => p.uid === uid);
}

/** Tiền nhận lại khi bán đồ / bàn đã mua. */
export function resale(ctx: SimContext, cost: number): number {
  return Math.floor(cost * ctx.content.balance.resellRate);
}

/** Khách quen tặng đồ trang trí: bày vào chỗ trống, hết chỗ thì cất kho. */
/** Quà khách quen: cất vào kho (mục Quà tặng ở bảng Kho), người chơi tự bày ra rồi kéo tới chỗ muốn đặt. */
export function givePropGift(ctx: SimContext, propId: string): void {
  const { state, content } = ctx;
  const def = content.props.get(propId);
  state.restaurant.props.push({ uid: `p${state.nextId++}`, def: def.id, x: 0, y: 0, rot: 0, stored: true });
}

/**
 * Sau khi đặt lại bàn gốc về mặc định: bàn mua thêm / đồ trang trí bị đè thì dời sang chỗ trống
 * (đồ trang trí không còn chỗ thì cất kho).
 */
export function resolveOverlaps(ctx: SimContext): void {
  const r = ctx.state.restaurant;
  for (const e of r.extraTables) {
    const t = activeTables(ctx).find((x) => x.id === e.id)!;
    const at = r.layout[e.id];
    if (!canPlaceTable(ctx, e.id, at.x, at.y)) continue;
    const base = withRotation(t, false);
    const spot = findFreeSpot(ctx, (x, y) => footprint(base, { x, y }), e.id);
    if (spot) r.layout[e.id] = { x: spot.x, y: spot.y };
  }
  for (const p of r.props) {
    const def = ctx.content.props.get(p.def);
    if (def.wall) {
      // Tranh: khung không còn (đổi mặt bằng) thì treo sang khung trống, hết khung thì cất kho
      if (!p.stored && p.x >= (roomOf(ctx).art?.length ?? 0)) {
        const slot = freeArtSlot(ctx, p.uid);
        if (slot == null) p.stored = true;
        else p.x = slot;
      }
      continue;
    }
    if (p.stored || !canPlaceProp(ctx, p.uid, p.x, p.y, p.rot)) continue;
    const spot = findFreeSpot(ctx, (x, y) => propRect(def, x, y, p.rot), p.uid);
    if (spot) Object.assign(p, spot);
    else p.stored = true;
  }
}

