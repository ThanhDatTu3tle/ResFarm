import { activeTables, placedProps, propRect, roomOf, tablePos, type Point, type Rect } from './layout';
import type { SimContext } from './types';

/**
 * ĐI VÒNG QUA BÀN — người phục vụ đi thẳng nếu đường thẳng không cắt bàn / đồ trang trí; vướng thì tìm đường trên lưới
 * (A*, ô 15 đơn vị) rồi đi tới điểm xa nhất trên đường còn nhìn thấy thẳng. Hàm thuần theo state (vẫn tất định).
 * Vật cản = mặt bàn (không tính ghế — người phục vụ lách giữa các ghế được) và đồ trang trí đang bày, nới thêm `CLEAR`.
 * Bàn có thể dời tuỳ ý nên lưới được tính lại theo "chữ ký" bố cục và lưu cache (ít khi đổi).
 */
const CELL = 15;
const CLEAR = 14;

interface Grid {
  key: string;
  /** Vật cản đã nới `CLEAR` và mặt thật (chưa nới) cùng thứ tự. */
  rects: Rect[];
  bodies: Rect[];
  cols: number;
  rows: number;
  blocked: Uint8Array;
}

let cached: Grid | null = null;

function bodiesOf(ctx: SimContext): Rect[] {
  const rects = activeTables(ctx).map((t) => {
    const at = tablePos(ctx, t);
    return { x1: at.x - t.w / 2, y1: at.y - t.h / 2, x2: at.x + t.w / 2, y2: at.y + t.h / 2 };
  });
  for (const p of placedProps(ctx)) {
    const def = ctx.content.props.get(p.def);
    rects.push(propRect(def, p.x, p.y, p.rot));
  }
  return rects;
}

function gridOf(ctx: SimContext): Grid {
  const bodies = bodiesOf(ctx);
  const rects = bodies.map((r) => ({ x1: r.x1 - CLEAR, y1: r.y1 - CLEAR, x2: r.x2 + CLEAR, y2: r.y2 + CLEAR }));
  const room = roomOf(ctx);
  const key = `${room.width}x${room.height}|${rects.map((r) => `${r.x1},${r.y1},${r.x2},${r.y2}`).join(';')}`;
  if (cached?.key === key) return cached;
  const cols = Math.ceil(room.width / CELL);
  const rows = Math.ceil((room.height + 120) / CELL); // thêm khoảng trước cửa (khách xếp hàng)
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * CELL;
      const y = (r + 0.5) * CELL;
      if (rects.some((o) => x > o.x1 && x < o.x2 && y > o.y1 && y < o.y2)) blocked[r * cols + c] = 1;
    }
  }
  cached = { key, rects, bodies, cols, rows, blocked };
  return cached;
}

/** Đoạn thẳng a → b có cắt hình chữ nhật không (Liang–Barsky). */
function segmentHits(a: Point, b: Point, r: Rect): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return clip(-dx, a.x - r.x1) && clip(dx, r.x2 - a.x) && clip(-dy, a.y - r.y1) && clip(dy, r.y2 - a.y) && t1 - t0 > 1e-6;
}

const inside = (p: Point, r: Rect) => p.x > r.x1 && p.x < r.x2 && p.y > r.y1 && p.y < r.y2;

/**
 * Đi thẳng được không. Điểm đầu / cuối nằm trong vùng nới (vd chỗ đứng phục vụ sát bàn, hay vừa lách qua góc)
 * thì chỉ xét mặt bàn thật; nằm hẳn trong mặt bàn thì bỏ qua vật đó.
 */
function clear(g: Grid, a: Point, b: Point): boolean {
  return g.rects.every((r, i) => {
    const body = g.bodies[i];
    if (inside(a, r) || inside(b, r)) return inside(a, body) || inside(b, body) || !segmentHits(a, b, body);
    return !segmentHits(a, b, r);
  });
}

/** Điểm kế tiếp phải đi tới trên đường từ `from` tới `to`; trả đúng `to` khi đi thẳng được. */
export function nextWaypoint(ctx: SimContext, from: Point, to: Point): Point {
  const grid = gridOf(ctx);
  if (clear(grid, from, to)) return to;
  const path = findPath(grid, from, to);
  if (!path) return to; // bị bao kín: đi thẳng như cũ
  // Đi tới điểm xa nhất trên đường mà vẫn nhìn thấy thẳng
  for (let i = path.length - 1; i >= 0; i--) if (clear(grid, from, path[i])) return path[i];
  return path[0];
}

function cellOf(g: Grid, p: Point): number {
  const c = Math.max(0, Math.min(g.cols - 1, Math.floor(p.x / CELL)));
  const r = Math.max(0, Math.min(g.rows - 1, Math.floor(p.y / CELL)));
  return r * g.cols + c;
}

const center = (g: Grid, i: number): Point => ({ x: ((i % g.cols) + 0.5) * CELL, y: (Math.floor(i / g.cols) + 0.5) * CELL });

/** A* 8 hướng trên lưới; điểm đầu / cuối luôn coi là đi được. Trả các tâm ô (bỏ ô đầu), ô cuối thay bằng `to`. */
function findPath(g: Grid, from: Point, to: Point): Point[] | null {
  const start = cellOf(g, from);
  const goal = cellOf(g, to);
  if (start === goal) return [to];
  const n = g.cols * g.rows;
  const cost = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const gx = goal % g.cols;
  const gy = Math.floor(goal / g.cols);
  const h = (i: number) => Math.hypot((i % g.cols) - gx, Math.floor(i / g.cols) - gy);
  // Hàng đợi ưu tiên đơn giản (mảng nhị phân nhỏ)
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  const free = (i: number) => i === start || i === goal || !g.blocked[i];
  cost[start] = 0;
  push(h(start), start);
  while (heap.length) {
    const [, i] = pop();
    if (done[i]) continue;
    done[i] = 1;
    if (i === goal) break;
    const cx = i % g.cols;
    const cy = Math.floor(i / g.cols);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) continue;
        const j = y * g.cols + x;
        if (!free(j) || done[j]) continue;
        // Đi chéo không được lách qua góc vật cản
        if (dx && dy && (!free(cy * g.cols + x) || !free(y * g.cols + cx))) continue;
        const c = cost[i] + (dx && dy ? Math.SQRT2 : 1);
        if (c < cost[j]) {
          cost[j] = c;
          prev[j] = i;
          push(c + h(j), j);
        }
      }
    }
  }
  if (prev[goal] < 0) return null;
  const cells: number[] = [];
  for (let i = goal; i !== start && i >= 0; i = prev[i]) cells.push(i);
  cells.reverse();
  const pts = cells.map((i) => center(g, i));
  pts[pts.length - 1] = to;
  return pts;
}
