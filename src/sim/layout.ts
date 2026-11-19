import type { PropDef, RoomDef, TableDef } from '../data';
import type { PropState } from './state';
import type { SimContext } from './types';

/**
 * Hình học mặt bằng quán (toạ độ 2D của RoomDef/TableDef): kích thước phòng theo hạng, các bàn đang có
 * (bàn gốc + bàn mua thêm, có thể xoay 90°), đồ trang trí đặt tự do, chỗ ngồi, luật đặt.
 * Dùng chung cho sim (kiểm tra lệnh) và UI (vẽ bàn ghế, khách, xem trước khi kéo).
 */

export interface Point {
  x: number;
  y: number;
}

/** Vị trí một ghế và chỗ đặt đĩa của ghế đó. */
export interface Spot extends Point {
  dishX: number;
  dishY: number;
}

export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Bước lưới khi dời bàn / đồ trang trí. */
export const LAYOUT_GRID = 5;
const SEAT_RADIUS = 15;

/** Mặt bằng quán theo hạng hiện tại: phòng sâu thêm về phía cửa, khu ăn uống giãn theo. */
export function roomOf(ctx: SimContext): RoomDef {
  const base = ctx.content.room;
  const tier = base.tiers[ctx.state.restaurant.tier - 1] ?? base.tiers[0];
  if (tier.height === base.height) return base;
  return { ...base, height: tier.height, dining: { ...base.dining, y2: base.dining.y2 + tier.height - base.height } };
}

/**
 * Các bàn đang có: bàn gốc (bàn cần nâng cấp chỉ khi đã mua) + bàn mua thêm.
 * Bàn đang xoay trả về với w/h đã đổi chỗ và `rotated: true`.
 */
export function activeTables(ctx: SimContext): TableDef[] {
  const { state, content } = ctx;
  const r = state.restaurant;
  const base = content.tables.all().filter((t) => !t.requiresUpgrade || state.upgrades.includes(t.requiresUpgrade));
  const extra = r.extraTables.map((e) => extraTableDef(ctx, e.id, e.kind));
  return [...base, ...extra].map((t) => withRotation(t, !!r.layout[t.id]?.rot));
}

/** Bàn theo id (gồm cả bàn mua thêm); null nếu không có. */
export function tableById(ctx: SimContext, id: string): TableDef | null {
  return activeTables(ctx).find((t) => t.id === id) ?? null;
}

function extraTableDef(ctx: SimContext, id: string, kind: string): TableDef {
  const k = ctx.content.tableKinds.get(kind);
  const at = ctx.state.restaurant.layout[id] ?? { x: 0, y: 0 };
  return { id, name: k.name, seats: k.seats, x: at.x, y: at.y, w: k.w, h: k.h, kind };
}

/** Bản xoay / bỏ xoay của một bàn (bàn quầy ghế đơn không xoay). */
export function withRotation(t: TableDef, rot: boolean): TableDef {
  if (t.shared || !!t.rotated === rot) return t;
  return { ...t, w: t.h, h: t.w, rotated: rot };
}

export function occupiedSeats(ctx: SimContext, tableId: string): number[] {
  return ctx.state.restaurant.parties.filter((p) => p.tableId === tableId).flatMap((p) => p.seats);
}

/** Vị trí hiện tại của tâm bàn: chỗ người chơi đã dời tới, hoặc mặc định trong TableDef. */
export function tablePos(ctx: SimContext, t: TableDef): Point {
  const at = ctx.state.restaurant.layout[t.id];
  return at ? { x: at.x, y: at.y } : { x: t.x, y: t.y };
}

/** Xoay điểm (dx, dy) quanh tâm 90°: khớp với group.rotation.y = -π/2 ở cảnh 3D. */
const turn = (at: Point, dx: number, dy: number): Point => ({ x: at.x - dy, y: at.y + dx });

/** Vị trí các ghế quanh bàn đặt tại `at`, theo chỉ số ghế (khớp với Party.seats). */
export function seatSpots(t: TableDef, at: Point = t): Spot[] {
  if (t.rotated) {
    const base = withRotation(t, false);
    return seatSpots(base, { x: 0, y: 0 }).map((s) => {
      const p = turn(at, s.x, s.y);
      const d = turn(at, s.dishX, s.dishY);
      return { x: p.x, y: p.y, dishX: d.x, dishY: d.y };
    });
  }
  const along = (i: number, n: number) => at.x - t.w / 2 + (t.w * (i + 0.5)) / n;
  if (t.shared) {
    return Array.from({ length: t.seats }, (_, i) => ({ x: along(i, t.seats), y: at.y + t.h / 2 + 28, dishX: along(i, t.seats), dishY: at.y }));
  }
  if (t.seats === 2) {
    return [-1, 1].map((side) => ({ x: at.x + side * (t.w / 2 + 26), y: at.y, dishX: at.x + (side * t.w) / 4, dishY: at.y }));
  }
  const top = Math.ceil(t.seats / 2);
  const bottom = t.seats - top;
  return Array.from({ length: t.seats }, (_, i) =>
    i < top
      ? { x: along(i, top), y: at.y - t.h / 2 - 24, dishX: along(i, top), dishY: at.y - t.h / 4 }
      : { x: along(i - top, bottom), y: at.y + t.h / 2 + 24, dishX: along(i - top, bottom), dishY: at.y + t.h / 4 },
  );
}

/** Khoảng chiếm chỗ của bàn kèm ghế. */
export function footprint(t: TableDef, at: Point): Rect {
  const rect = { x1: at.x - t.w / 2, y1: at.y - t.h / 2, x2: at.x + t.w / 2, y2: at.y + t.h / 2 };
  for (const s of seatSpots(t, at)) {
    rect.x1 = Math.min(rect.x1, s.x - SEAT_RADIUS);
    rect.y1 = Math.min(rect.y1, s.y - SEAT_RADIUS);
    rect.x2 = Math.max(rect.x2, s.x + SEAT_RADIUS);
    rect.y2 = Math.max(rect.y2, s.y + SEAT_RADIUS);
  }
  return rect;
}

/** Khoảng chiếm chỗ của đồ trang trí đặt tại (x, y), rot = 1 thì xoay 90°. */
export function propRect(def: PropDef, x: number, y: number, rot: number): Rect {
  const [w, h] = rot % 2 ? [def.h, def.w] : [def.w, def.h];
  return { x1: x - w / 2, y1: y - h / 2, x2: x + w / 2, y2: y + h / 2 };
}

const overlaps = (a: Rect, b: Rect) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

/** Lối ra vào trước cửa (khách xếp hàng ở đây): không đặt bàn / đồ trang trí đè lên. */
export function entranceOf(ctx: SimContext): Rect {
  const room = roomOf(ctx);
  return { x1: room.width / 2 - 50, y1: room.dining.y2 - 48, x2: room.width / 2 + 240, y2: room.height + 100 };
}

/** Đồ trang trí đang bày (không tính đồ cất kho). */
export function placedProps(ctx: SimContext): PropState[] {
  return ctx.state.restaurant.props.filter((p) => !p.stored);
}

/**
 * Tìm vật cản cho một khoảng chiếm chỗ: ra ngoài khu ăn uống, vướng bàn khác, vướng đồ trang trí khác.
 * `skip` = id bàn hoặc uid đồ trang trí đang được dời (không tính chính nó). Trả lý do hoặc null.
 */
export function blockerOf(ctx: SimContext, rect: Rect, skip: string): string | null {
  const area = roomOf(ctx).dining;
  if (rect.x1 < area.x1 || rect.y1 < area.y1 || rect.x2 > area.x2 || rect.y2 > area.y2) return 'Nằm ngoài khu vực ăn uống.';
  if (overlaps(rect, entranceOf(ctx))) return 'Vướng lối ra vào (chỗ khách xếp hàng).';
  for (const t of activeTables(ctx)) {
    if (t.id === skip) continue;
    if (overlaps(rect, footprint(t, tablePos(ctx, t)))) return `Vướng ${t.name}.`;
  }
  for (const p of placedProps(ctx)) {
    if (p.uid === skip) continue;
    const def = ctx.content.props.get(p.def);
    if (overlaps(rect, propRect(def, p.x, p.y, p.rot))) return `Vướng ${def.name}.`;
  }
  return null;
}

/** Kiểm tra có đặt được bàn `tableId` tại (x, y) không (rot: thử với góc xoay khác). Trả null nếu được, ngược lại trả lý do. */
export function canPlaceTable(ctx: SimContext, tableId: string, x: number, y: number, rot?: boolean): string | null {
  let table = tableById(ctx, tableId);
  if (!table) return 'Không có bàn này.';
  if (table.fixed) return `${table.name} gắn cố định, không dời được.`;
  if (occupiedSeats(ctx, tableId).length) return 'Bàn đang có khách, chờ khách về rồi dời nhé.';
  if (rot != null) table = withRotation(table, rot);
  const problem = blockerOf(ctx, footprint(table, { x, y }), tableId);
  return problem && problem.replace('Nằm', 'Bàn nằm');
}

/** Kiểm tra có đặt được đồ trang trí `uid` tại (x, y) với góc xoay `rot` không. */
export function canPlaceProp(ctx: SimContext, uid: string, x: number, y: number, rot: number): string | null {
  const prop = ctx.state.restaurant.props.find((p) => p.uid === uid);
  if (!prop) return 'Không có món này.';
  return blockerOf(ctx, propRect(ctx.content.props.get(prop.def), x, y, rot), uid);
}

/**
 * Chỗ trống cho một vật có khoảng chiếm chỗ rectAt(x, y): trong các chỗ đặt được, chọn chỗ thoáng nhất
 * (xa bàn / đồ trang trí khác nhất, tính tối đa 80 đơn vị); bằng nhau thì lấy chỗ dò thấy trước (từ trong ra cửa).
 * Trả null nếu khu ăn uống đã kín.
 */
export function findFreeSpot(ctx: SimContext, rectAt: (x: number, y: number) => Rect, skip = ''): Point | null {
  const area = roomOf(ctx).dining;
  const others = [
    ...activeTables(ctx).filter((t) => t.id !== skip).map((t) => footprint(t, tablePos(ctx, t))),
    ...placedProps(ctx).filter((p) => p.uid !== skip).map((p) => propRect(ctx.content.props.get(p.def), p.x, p.y, p.rot)),
  ];
  const gap = (a: Rect, b: Rect) => Math.hypot(Math.max(0, b.x1 - a.x2, a.x1 - b.x2), Math.max(0, b.y1 - a.y2, a.y1 - b.y2));
  const step = LAYOUT_GRID * 4;
  let best: Point | null = null;
  let bestScore = -1;
  for (let y = area.y1; y <= area.y2; y += step) {
    for (let x = area.x1; x <= area.x2; x += step) {
      const rect = rectAt(x, y);
      if (blockerOf(ctx, rect, skip)) continue;
      const score = Math.min(80, ...others.map((o) => gap(rect, o)));
      if (score > bestScore) [best, bestScore] = [{ x, y }, score];
    }
  }
  return best;
}

/**
 * Chỗ bồi bàn đứng khi phục vụ một nhóm khách: quầy đơn thì đứng sau lưng khách,
 * bàn đôi (ghế hai bên) thì đứng phía trước bàn, bàn khác thì đứng ở đầu bàn bên phải.
 */
export function serviceSpot(t: TableDef, at: Point, seats: number[]): Point {
  if (t.rotated) {
    const s = serviceSpot(withRotation(t, false), { x: 0, y: 0 }, seats);
    return turn(at, s.x, s.y);
  }
  if (t.shared) {
    const spots = seatSpots(t, at);
    const xs = seats.map((i) => spots[i]?.x ?? at.x);
    return { x: xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length), y: at.y + t.h / 2 + 60 };
  }
  if (t.seats === 2) return { x: at.x, y: at.y + t.h / 2 + 24 };
  return { x: at.x + t.w / 2 + 24, y: at.y };
}
