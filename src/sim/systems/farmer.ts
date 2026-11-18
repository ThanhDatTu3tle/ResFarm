import { EventBus } from '../../core/events';
import type { FarmerTask, FarmerTaskKind, FarmSlot } from '../state';
import { fail, ok, type Command, type CommandResult, type SimContext, type SimEvents, type System } from '../types';
import { farmSystem, needsWatering, slotsOfType } from './farm';

/**
 * BÁC NÔNG DÂN — người chơi giao việc bằng cách bấm ô ruộng / chuồng / ao (hoặc nút trong bảng Nông trại).
 * Bác làm lần lượt theo hàng việc: chạy tới chỗ đứng trước ô (toạ độ mét, theo SlotTypeDef.layout),
 * làm việc trong balance.farmer.workTime phút rồi mới áp dụng lệnh farm/* tương ứng.
 * Vị trí nằm trong state nên cảnh 3D chỉ việc vẽ theo, và mọi thứ vẫn tất định (giống bồi bàn ở service.ts).
 */

/** Hàng việc dài tối đa — tránh người chơi bấm loạn xạ làm bác chạy cả ngày. */
export const MAX_FARMER_TASKS = 24;

/** Tâm ô trên bản đồ nông trại (mét). Ô thứ i trong loại xếp theo lưới `cols` cột. */
export function slotCenter(ctx: SimContext, slot: FarmSlot): { x: number; z: number } {
  const { layout } = ctx.content.slotTypes.get(slot.type);
  const i = Math.max(0, slotsOfType(ctx, slot.type).indexOf(slot));
  return { x: layout.x + (i % layout.cols) * layout.dx, z: layout.z + Math.floor(i / layout.cols) * layout.dz };
}

/** Hệ số phóng to của ô theo bậc nới rộng (ao bậc 2, 3 to hơn). */
export function slotScale(ctx: SimContext, slot: FarmSlot): number {
  return 1 + ctx.content.slotTypes.get(slot.type).layout.tierGrowth * (slot.tier - 1);
}

/** Chỗ bác đứng làm việc: mép trước ô (phía camera) hoặc mép trái, theo layout.work. */
export function workSpot(ctx: SimContext, slot: FarmSlot): { x: number; z: number } {
  const c = slotCenter(ctx, slot);
  const { layout } = ctx.content.slotTypes.get(slot.type);
  const half = (layout.size * slotScale(ctx, slot)) / 2;
  return layout.work === 'left' ? { x: c.x - half - 0.35, z: c.z } : { x: c.x, z: c.z + half + 0.35 };
}

const EPS = 1e-6;

/**
 * Đi theo lối thay vì đường chim bay (để không giẫm qua ruộng / chuồng khác):
 * chạy NGANG theo khe giữa các hàng ô, chỉ chạy DỌC trên các "lối dọc" (balance.farmer.lanes — con đường đất,
 * mép trái ruộng). Trả về điểm kế tiếp phải tới; trả đúng `spot` khi đã có thể đi thẳng tới nơi.
 * Không lưu đường đi: tính lại từ vị trí hiện tại mỗi bước nên đổi việc giữa chừng vẫn đúng.
 */
export function nextWaypoint(pos: { x: number; z: number }, spot: { x: number; z: number }, lanes: number[]): { x: number; z: number } {
  if (Math.abs(pos.z - spot.z) < EPS || !lanes.length) return spot; // cùng một hàng: đi ngang thẳng tới
  let lane = lanes[0];
  for (const l of lanes) if (Math.abs(pos.x - l) + Math.abs(l - spot.x) < Math.abs(pos.x - lane) + Math.abs(lane - spot.x)) lane = l;
  if (Math.abs(pos.x - lane) > EPS) return { x: lane, z: pos.z }; // ra lối dọc gần nhất
  return { x: lane, z: spot.z }; // chạy dọc tới đúng hàng của ô
}

/** Lệnh farm/* mà một việc sẽ áp dụng khi bác tới nơi (null = chỉ ghé xem). */
function commandOf(task: FarmerTask): Command | null {
  switch (task.kind) {
    case 'till':
      return { type: 'farm/till', slotId: task.slotId };
    case 'water':
      return { type: 'farm/water', slotId: task.slotId };
    case 'plant':
      return task.producerId ? { type: 'farm/plant', slotId: task.slotId, producerId: task.producerId } : null;
    case 'harvest':
      return { type: 'farm/harvest', slotId: task.slotId };
    case 'clear':
      return { type: 'farm/clear', slotId: task.slotId };
    case 'visit':
      return null;
  }
}

/** Áp dụng một việc ngay (dùng khi bác tới nơi, và khi chạy thử trên bản sao state). */
function perform(ctx: SimContext, task: FarmerTask): CommandResult {
  if (!ctx.state.farm.slots.some((s) => s.id === task.slotId)) return fail('Không tìm thấy ô.');
  const command = commandOf(task);
  if (!command) return task.kind === 'plant' ? fail('Chưa chọn giống.') : ok();
  const handler = farmSystem.commands?.[command.type] as ((c: SimContext, cmd: Command) => CommandResult) | undefined;
  return handler ? handler(ctx, command) : fail(`Lệnh "${command.type}" chưa có handler.`);
}

/**
 * Chạy thử: áp dụng hết các việc đang xếp hàng lên một BẢN SAO state, rồi thử việc mới.
 * Nhờ vậy người chơi được báo lỗi ngay lúc bấm (không đủ tiền, đất chưa cuốc...), kể cả khi việc mới
 * phụ thuộc việc trước trong hàng (bấm cuốc rồi bấm gieo liền ô đó vẫn hợp lệ).
 */
function preview(ctx: SimContext, task: FarmerTask): CommandResult {
  const sandbox: SimContext = { state: structuredClone(ctx.state), content: ctx.content, bus: new EventBus<SimEvents>() };
  for (const queued of sandbox.state.farm.farmer.tasks) perform(sandbox, queued);
  return perform(sandbox, task);
}

function enqueue(ctx: SimContext, task: FarmerTask): CommandResult {
  const f = ctx.state.farm.farmer;
  // Đang chờ ghé xem ô này (chưa tới nơi) mà người chơi giao việc thật cho ô đó thì bỏ lượt ghé xem
  if (task.kind !== 'visit') {
    f.tasks = f.tasks.filter((t, i) => !(t.kind === 'visit' && t.slotId === task.slotId && !(i === 0 && f.work != null)));
  }
  if (f.tasks.some((t) => t.slotId === task.slotId && t.kind === task.kind)) return fail('Bác nông dân đang tới ô này rồi.');
  if (f.tasks.length >= MAX_FARMER_TASKS) return fail('Bác đang nhiều việc quá, đợi chút nhé.');
  const result = preview(ctx, task);
  if (!result.ok) return result;
  f.tasks.push(task);
  return ok();
}

/** Ô nào đang có việc chờ bác (để bảng Nông trại hiện dấu "sắp tới"). */
export function queuedKinds(ctx: SimContext, slotId: string): FarmerTaskKind[] {
  return ctx.state.farm.farmer.tasks.filter((t) => t.slotId === slotId).map((t) => t.kind);
}

/** Việc bác đang làm dở (đã tới nơi), null nếu đang đi hoặc rảnh. */
export function currentWork(ctx: SimContext): FarmerTask | null {
  const f = ctx.state.farm.farmer;
  return f.work != null ? (f.tasks[0] ?? null) : null;
}

export const farmerSystem: System = {
  id: 'farmer',
  update(ctx, dt) {
    const { state, content } = ctx;
    const f = state.farm.farmer;
    const { speed, workTime } = content.balance.farmer;
    let time = dt;
    // Một bước có thể qua vài khúc đường, tới nơi, làm xong rồi chuyển luôn sang việc kế nếu còn thời gian
    for (let guard = 0; guard < 16 && time > 1e-9; guard++) {
      const task = f.tasks[0];
      if (!task) {
        f.work = null;
        return; // rảnh thì đứng yên tại chỗ
      }
      const slot = state.farm.slots.find((s) => s.id === task.slotId);
      if (!slot) {
        f.tasks.shift();
        f.work = null;
        continue;
      }
      const spot = workSpot(ctx, slot);
      const target = nextWaypoint(f, spot, content.balance.farmer.lanes);
      const dx = target.x - f.x;
      const dz = target.z - f.z;
      const dist = Math.hypot(dx, dz);
      const walk = dist / speed;
      if (walk > time) {
        f.x += (dx / dist) * speed * time;
        f.z += (dz / dist) * speed * time;
        return;
      }
      f.x = target.x;
      f.z = target.z;
      time -= walk;
      if (target !== spot) continue; // mới tới khúc rẽ, đi tiếp khúc sau
      if (f.work == null) f.work = task.kind === 'visit' ? 0 : workTime;
      if (f.work > time) {
        f.work -= time;
        return;
      }
      time -= f.work;
      f.work = null;
      f.tasks.shift();
      const result = perform(ctx, task);
      ctx.bus.emit('farmer/done', { kind: task.kind, slotId: task.slotId, ok: result.ok, reason: result.ok ? undefined : result.reason });
    }
  },
  commands: {
    'farmer/do'(ctx, cmd) {
      return enqueue(ctx, { kind: cmd.kind, slotId: cmd.slotId, producerId: cmd.producerId });
    },
    'farmer/doAll'(ctx, cmd) {
      const f = ctx.state.farm.farmer;
      const wanted = ctx.state.farm.slots.filter((s) => {
        if (!s.producerId || f.tasks.some((t) => t.slotId === s.id && t.kind === cmd.kind)) return false;
        return cmd.kind === 'harvest' ? s.stage === 'ready' : s.stage === 'growing' && needsWatering(ctx, s);
      });
      if (!wanted.length) return fail(cmd.kind === 'harvest' ? 'Chưa có gì để thu hoạch.' : 'Không có cây nào cần tưới.');
      // Đi lần lượt ô gần nhất kế tiếp, bắt đầu từ chỗ bác sẽ đứng sau khi xong hàng việc hiện có
      const lastTask = f.tasks[f.tasks.length - 1];
      const lastSlot = lastTask && ctx.state.farm.slots.find((s) => s.id === lastTask.slotId);
      let at = lastSlot ? workSpot(ctx, lastSlot) : { x: f.x, z: f.z };
      const left = [...wanted];
      let added = 0;
      while (left.length && f.tasks.length < MAX_FARMER_TASKS) {
        let best = 0;
        let bestDist = Infinity;
        left.forEach((s, i) => {
          const p = workSpot(ctx, s);
          const d = Math.hypot(p.x - at.x, p.z - at.z);
          if (d < bestDist) [best, bestDist] = [i, d];
        });
        const [slot] = left.splice(best, 1);
        f.tasks.push({ kind: cmd.kind, slotId: slot.id });
        at = workSpot(ctx, slot);
        added++;
      }
      return added ? ok() : fail('Bác đang nhiều việc quá, đợi chút nhé.');
    },
    'farmer/cancel'(ctx) {
      const f = ctx.state.farm.farmer;
      if (!f.tasks.length) return fail('Bác đang rảnh.');
      // Việc đang làm dở (đã tới nơi) vẫn làm cho xong, chỉ bỏ những việc chưa tới lượt
      f.tasks = f.work != null ? f.tasks.slice(0, 1) : [];
      return ok();
    },
  },
};
