import type { TableDef } from '../data';
import { activeTables, occupiedSeats } from './systems/customers';
import type { SimContext } from './types';

/**
 * Hình học mặt bằng quán (toạ độ 2D của RoomDef/TableDef): vị trí bàn hiện tại, chỗ ngồi, luật đặt bàn.
 * Dùng chung cho sim (kiểm tra lệnh dời bàn) và UI (vẽ bàn ghế, khách).
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

interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Bước lưới khi dời bàn. */
export const LAYOUT_GRID = 5;
const SEAT_RADIUS = 15;

/** Vị trí hiện tại của tâm bàn: chỗ người chơi đã dời tới, hoặc mặc định trong TableDef. */
export function tablePos(ctx: SimContext, t: TableDef): Point {
  return ctx.state.restaurant.layout[t.id] ?? { x: t.x, y: t.y };
}

/** Vị trí các ghế quanh bàn đặt tại `at`, theo chỉ số ghế (khớp với Party.seats). */
export function seatSpots(t: TableDef, at: Point = t): Spot[] {
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

/** Kiểm tra có đặt được bàn `tableId` tại (x, y) không. Trả null nếu được, ngược lại trả lý do. */
export function canPlaceTable(ctx: SimContext, tableId: string, x: number, y: number): string | null {
  const tables = activeTables(ctx);
  const table = tables.find((t) => t.id === tableId);
  if (!table) return 'Không có bàn này.';
  if (table.fixed) return `${table.name} gắn cố định, không dời được.`;
  if (occupiedSeats(ctx, tableId).length) return 'Bàn đang có khách, chờ khách về rồi dời nhé.';

  const rect = footprint(table, { x, y });
  const area = ctx.content.room.dining;
  if (rect.x1 < area.x1 || rect.y1 < area.y1 || rect.x2 > area.x2 || rect.y2 > area.y2) return 'Bàn nằm ngoài khu vực ăn uống.';
  for (const other of tables) {
    if (other.id === tableId) continue;
    const o = footprint(other, tablePos(ctx, other));
    if (rect.x1 < o.x2 && rect.x2 > o.x1 && rect.y1 < o.y2 && rect.y2 > o.y1) return `Vướng ${other.name}.`;
  }
  return null;
}
