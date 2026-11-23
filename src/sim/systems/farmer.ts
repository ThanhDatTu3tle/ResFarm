import { EventBus } from '../../core/events';
import { canPlantNow, isFrozen } from '../calendar';
import type { FarmerTask, FarmerTaskKind, FarmSlot, GardenerState } from '../state';
import { fail, ok, type Command, type CommandResult, type SimContext, type SimEvents, type System } from '../types';
import { awayReason, tire } from './crew';
import { farmSystem, needsWatering, slotsOfType, yieldsOf } from './farm';
import { millSpot, pickMill } from './mills';

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
  return slotCenterAt(ctx, slot.type, Math.max(0, slotsOfType(ctx, slot.type).indexOf(slot)));
}

/** Tâm ô thứ `i` của loại (dùng cả cho chỗ trống chưa mua — viền đứt khúc). */
export function slotCenterAt(ctx: SimContext, type: FarmSlot['type'], i: number): { x: number; z: number } {
  const { layout } = ctx.content.slotTypes.get(type);
  const spot = layout.spots?.[i];
  if (spot) return { x: spot.x, z: spot.z };
  return { x: layout.x + (i % layout.cols) * layout.dx, z: layout.z + Math.floor(i / layout.cols) * layout.dz };
}

/** Hệ số phóng to của ô theo bậc nới rộng (ao bậc 2, 3 to hơn). */
export function slotScale(ctx: SimContext, slot: FarmSlot): number {
  return 1 + ctx.content.slotTypes.get(slot.type).layout.tierGrowth * (slot.tier - 1);
}

/** Chỗ bác đứng làm việc: mép trước ô (phía camera) hoặc mép trái, theo layout.work. */
export function workSpot(ctx: SimContext, slot: FarmSlot): { x: number; z: number } {
  const c = slotCenter(ctx, slot);
  const { layout, building } = ctx.content.slotTypes.get(slot.type);
  if (building) return { ...building.door }; // ô trong nhà kính: bác vào cửa nhà
  const half = (layout.size * slotScale(ctx, slot)) / 2;
  const work = layout.spots?.[Math.max(0, slotsOfType(ctx, slot.type).indexOf(slot))]?.work ?? layout.work;
  if (work === 'left') return { x: c.x - half - 0.35, z: c.z };
  if (work === 'back') return { x: c.x, z: c.z - half - 0.35 };
  return { x: c.x, z: c.z + half + 0.35 };
}

/**
 * Toà nhà chứa ô loại này trên bản đồ nông trại (nhà kính): hình chữ nhật từ mép tây x1 tới mép đông x2.
 * Nhà dài theo số cột luống (mỗi cột 2 luống hai bên lối đi). null nếu loại ô không nằm trong nhà.
 */
export function buildingRect(ctx: SimContext, type: FarmSlot['type'], count = slotsOfType(ctx, type).length): { x1: number; x2: number; z1: number; z2: number } | null {
  const b = ctx.content.slotTypes.get(type).building;
  if (!b) return null;
  const length = Math.ceil(count / 2) * b.colLength + 2 * b.endLength;
  return { x1: b.x, x2: b.x + length, z1: b.z - b.width / 2, z2: b.z + b.width / 2 };
}

/** Ô thuộc loại ruộng tự động (lúa mì, lúa nước): thu bằng máy cày, gieo lại và chở tới cối. */
export function isAutoSlot(ctx: SimContext, slot: FarmSlot): boolean {
  return !!ctx.content.slotTypes.get(slot.type).mill;
}

/** Chỗ bác phải tới để làm việc này (ô ruộng, hoặc cối khi chở hàng); null = mục tiêu không còn. */
export function taskSpot(ctx: SimContext, task: FarmerTask): { x: number; z: number } | null {
  if (task.kind === 'haul') {
    const mill = ctx.state.farm.mills.find((m) => m.id === task.millId);
    return mill ? millSpot(ctx, mill) : null;
  }
  const slot = ctx.state.farm.slots.find((s) => s.id === task.slotId);
  return slot ? workSpot(ctx, slot) : null;
}

const EPS = 1e-6;

/**
 * Đi theo lối thay vì đường chim bay (để không giẫm qua ruộng / chuồng khác):
 * chạy NGANG theo khe giữa các hàng ô, chỉ chạy DỌC trên các "lối dọc" (balance.farmer.lanes — con đường đất,
 * mép trái ruộng). Trả về điểm kế tiếp phải tới; trả đúng `spot` khi đã có thể đi thẳng tới nơi.
 * Không lưu đường đi: tính lại từ vị trí hiện tại mỗi bước nên đổi việc giữa chừng vẫn đúng.
 */
export function nextWaypoint(pos: { x: number; z: number }, spot: { x: number; z: number }, lanes: number[], side: { x: number; joinZ: number }[] = []): { x: number; z: number } {
  // Lối phụ (balance.farmer.side): khu phía đông lối phụ chỉ vào / ra qua hàng trống joinZ
  for (const s of side) {
    const inPos = pos.x >= s.x - EPS;
    const inSpot = spot.x >= s.x - EPS;
    if (!inPos && !inSpot) continue;
    const onJoin = Math.abs(pos.z - s.joinZ) < EPS;
    if (inPos && inSpot) {
      // Trong khu: cùng hàng thì đi thẳng, không thì ra lối phụ rồi chạy dọc
      if (Math.abs(pos.z - spot.z) < EPS) return spot;
      if (Math.abs(pos.x - s.x) > EPS) return { x: s.x, z: pos.z };
      return { x: s.x, z: spot.z };
    }
    if (inSpot) {
      // Vào khu: tới hàng joinZ theo lối chính, rồi chạy ngang tới lối phụ
      if (onJoin) return { x: s.x, z: s.joinZ };
      return nextWaypoint(pos, { x: lanes[0] ?? pos.x, z: s.joinZ }, lanes);
    }
    // Ra khỏi khu: theo lối phụ tới hàng joinZ, từ đó đi tiếp như thường (chạy ngang về lối chính)
    if (!onJoin) return Math.abs(pos.x - s.x) > EPS ? { x: s.x, z: pos.z } : { x: s.x, z: s.joinZ };
    return Math.abs(spot.z - s.joinZ) < EPS ? spot : { x: lanes[0] ?? spot.x, z: s.joinZ };
  }
  if (Math.abs(pos.z - spot.z) < EPS || !lanes.length) return spot; // cùng một hàng: đi ngang thẳng tới
  // Chọn lối dọc cho tổng quãng ngang ngắn nhất; bằng nhau thì chọn lối gần chỗ đang đứng (đỡ chạy ngang qua ruộng)
  const cost = (l: number) => Math.abs(pos.x - l) + Math.abs(l - spot.x);
  let lane = lanes[0];
  for (const l of lanes) {
    const d = cost(l) - cost(lane);
    if (d < -EPS || (Math.abs(d) <= EPS && Math.abs(pos.x - l) < Math.abs(pos.x - lane))) lane = l;
  }
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
    case 'haul':
      return null;
  }
}

/** Đã sắm dụng cụ này chưa (src/data/farmhands.ts). */
export function hasTool(ctx: SimContext, id: string): boolean {
  return ctx.state.farm.tools.includes(id);
}

/** Việc trên ruộng lúa (máy cày): thu / gieo ô tự động, chở lúa tới cối. */
function tractorTask(ctx: SimContext, task: FarmerTask): boolean {
  if (task.kind === 'haul') return true;
  const slot = ctx.state.farm.slots.find((s) => s.id === task.slotId);
  return !!slot && isAutoSlot(ctx, slot) && (task.kind === 'harvest' || task.kind === 'plant');
}

/** Tốc độ đi (m / phút game) khi làm việc này, đã tính dụng cụ: giày nhẹ ×1.3, máy cày mới chở lúa ×1.5. */
export function walkSpeed(ctx: SimContext, task: FarmerTask, base: number): number {
  let v = base;
  if (hasTool(ctx, 'boots')) v *= 1.3;
  if (task.kind === 'haul' && hasTool(ctx, 'tractor2')) v *= 1.5;
  return v;
}

/** Phút làm một việc khi đã tới nơi, đã tính dụng cụ: liềm bén thu ×0.5, máy cày mới (ruộng lúa) ×0.5. */
export function workTimeOf(ctx: SimContext, task: FarmerTask, base: number): number {
  if (task.kind === 'visit') return 0;
  if (tractorTask(ctx, task)) return hasTool(ctx, 'tractor2') ? base * 0.5 : base;
  if (task.kind === 'harvest' && hasTool(ctx, 'sickle')) return base * 0.5;
  return base;
}

/** Bình tưới lớn: tưới xong một ô thì tưới luôn các ô cùng loại, cùng hàng đang khô. */
function waterRow(ctx: SimContext, slot: FarmSlot): void {
  const z = slotCenter(ctx, slot).z;
  for (const s of slotsOfType(ctx, slot.type)) {
    if (s === slot || !s.producerId || !needsWatering(ctx, s) || isFrozen(ctx, s.type)) continue;
    if (Math.abs(slotCenter(ctx, s).z - z) < 0.05) s.wet = ctx.content.balance.farm.waterDuration;
  }
}

/** Áp dụng một việc ngay (dùng khi bác / người làm vườn tới nơi, và khi chạy thử trên bản sao state). */
export function perform(ctx: SimContext, task: FarmerTask): CommandResult {
  if (task.kind === 'haul') {
    // Đổ hàng trên máy cày vào cối (lúc chạy thử trên bản sao state thì tay không, coi như xong)
    const f = ctx.state.farm.farmer;
    const mill = ctx.state.farm.mills.find((m) => m.id === task.millId);
    if (!mill) return fail('Không tìm thấy cối.');
    if (f.carry) mill.input += f.carry.qty;
    f.carry = null;
    return ok();
  }
  if (!ctx.state.farm.slots.some((s) => s.id === task.slotId)) return fail('Không tìm thấy ô.');
  const command = commandOf(task);
  if (!command) return task.kind === 'plant' ? fail('Chưa chọn giống.') : ok();
  const handler = farmSystem.commands?.[command.type] as ((c: SimContext, cmd: Command) => CommandResult) | undefined;
  const result = handler ? handler(ctx, command) : fail(`Lệnh "${command.type}" chưa có handler.`);
  if (result.ok && task.kind === 'water' && hasTool(ctx, 'big_can')) {
    const slot = ctx.state.farm.slots.find((s) => s.id === task.slotId);
    if (slot) waterRow(ctx, slot);
  }
  return result;
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

/** Bác chưa nhận việc được: đang ăn ở chợ, hoặc kiệt sức. */
export function farmerBlocked(ctx: SimContext): string | null {
  const away = awayReason(ctx, 'farm');
  if (away) return away;
  if (ctx.state.farm.farmer.fainted) return '😵 Bác nông dân kiệt sức rồi — bồi dưỡng ở bảng Nhân viên.';
  return null;
}

/** Việc đồng áng tốn sức (cuốc, tưới, gieo / thả, thu hoạch); ghé xem, dọn, chở hàng thì không. */
const TIRING: FarmerTaskKind[] = ['till', 'water', 'plant', 'harvest'];

function enqueue(ctx: SimContext, task: FarmerTask): CommandResult {
  const f = ctx.state.farm.farmer;
  const blocked = farmerBlocked(ctx);
  if (blocked) return fail(blocked);
  if (task.kind === 'haul') return fail('Bác tự chở hàng sau khi thu hoạch, không cần giao.');
  // Đang chờ ghé xem ô này (chưa tới nơi) mà người chơi giao việc thật cho ô đó thì bỏ lượt ghé xem
  if (task.kind !== 'visit') {
    f.tasks = f.tasks.filter((t, i) => !(t.kind === 'visit' && t.slotId === task.slotId && !(i === 0 && f.work != null)));
  }
  if (f.tasks.some((t) => t.slotId === task.slotId && t.kind === task.kind)) return fail('Bác nông dân đang tới ô này rồi.');
  if (task.kind !== 'visit' && gardenerOn(ctx, task.slotId)) return fail(`${gardenerOn(ctx, task.slotId)!.name} đang lo ô này rồi.`);
  if (f.tasks.length >= MAX_FARMER_TASKS) return fail('Bác đang nhiều việc quá, đợi chút nhé.');
  const result = preview(ctx, task);
  if (!result.ok) return result;
  f.tasks.push(task);
  return ok();
}

/** Người làm vườn đang đi tới / làm ở ô này (nếu có). */
export function gardenerOn(ctx: SimContext, slotId: string): GardenerState | undefined {
  return ctx.state.farm.gardeners.find((g) => g.task?.slotId === slotId);
}

/** Ô nào đang có việc chờ bác (để bảng Nông trại hiện dấu "sắp tới"). */
export function queuedKinds(ctx: SimContext, slotId: string): FarmerTaskKind[] {
  return ctx.state.farm.farmer.tasks.filter((t) => t.slotId === slotId && t.kind !== 'haul').map((t) => t.kind);
}

/** Việc bác đang làm dở (đã tới nơi), null nếu đang đi hoặc rảnh. */
export function currentWork(ctx: SimContext): FarmerTask | null {
  const f = ctx.state.farm.farmer;
  return f.work != null ? (f.tasks[0] ?? null) : null;
}

/**
 * Ruộng tự động vừa thu xong: chuyển sản lượng từ kho lên máy cày, rồi xếp ngay lên đầu hàng việc
 * "gieo lại giống cũ" (tại chỗ) và "chở tới cối" (cối cùng loại đang ít hàng nhất).
 */
function autoChain(ctx: SimContext, slot: FarmSlot, harvested: { item: string; qty: number }[]): void {
  const f = ctx.state.farm.farmer;
  const type = ctx.content.slotTypes.get(slot.type);
  const mill = type.mill ? pickMill(ctx, type.mill) : null;
  const next: FarmerTask[] = [];
  if (slot.lastProducerId && !slot.producerId && canPlantNow(ctx, ctx.content.producers.get(slot.lastProducerId), slot.type)) next.push({ kind: 'plant', slotId: slot.id, producerId: slot.lastProducerId });
  const grain = harvested.find((y) => mill && y.item === ctx.content.mills.get(mill.type).input);
  if (mill && grain && grain.qty > 0) {
    // Lấy lại từ kho (farm/harvest đã cộng vào) để chở đi; đang chở dở mẻ trước thì gộp chung
    ctx.state.inventory[grain.item] = Math.max(0, (ctx.state.inventory[grain.item] ?? 0) - grain.qty);
    f.carry = { item: grain.item, qty: (f.carry?.qty ?? 0) + grain.qty };
    if (!f.tasks.some((t) => t.kind === 'haul')) next.push({ kind: 'haul', slotId: slot.id, millId: mill.id });
  }
  f.tasks.unshift(...next);
}

export const farmerSystem: System = {
  id: 'farmer',
  update(ctx, dt) {
    const { state, content } = ctx;
    const f = state.farm.farmer;
    // Đang ở chợ hoặc kiệt sức: đứng im, hàng việc giữ nguyên để làm tiếp sau
    if (state.crew.farmerAway || f.fainted) return;
    const { workTime } = content.balance.farmer;
    let time = dt;
    // Một bước có thể qua vài khúc đường, tới nơi, làm xong rồi chuyển luôn sang việc kế nếu còn thời gian
    for (let guard = 0; guard < 16 && time > 1e-9; guard++) {
      const task = f.tasks[0];
      if (!task) {
        f.work = null;
        return; // rảnh thì đứng yên tại chỗ
      }
      const spot = taskSpot(ctx, task);
      if (!spot) {
        f.tasks.shift();
        f.work = null;
        continue;
      }
      const target = nextWaypoint(f, spot, content.balance.farmer.lanes, content.balance.farmer.side);
      const speed = walkSpeed(ctx, task, content.balance.farmer.speed);
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
      if (f.work == null) f.work = workTimeOf(ctx, task, workTime);
      if (f.work > time) {
        f.work -= time;
        return;
      }
      time -= f.work;
      f.work = null;
      f.tasks.shift();
      const slot = state.farm.slots.find((s) => s.id === task.slotId);
      const auto = task.kind === 'harvest' && slot && isAutoSlot(ctx, slot) && slot.stage === 'ready' && slot.producerId ? content.producers.get(slot.producerId) : null;
      const harvested = auto && slot ? yieldsOf(ctx, slot, auto) : [];
      const result = perform(ctx, task);
      if (result.ok && auto && slot) autoChain(ctx, slot, harvested);
      ctx.bus.emit('farmer/done', { kind: task.kind, slotId: task.slotId, ok: result.ok, reason: result.ok ? undefined : result.reason });
      if (result.ok && TIRING.includes(task.kind) && tire(ctx, 'farmer', f, content.balance.crew.farmerPerTask)) return;
    }
  },
  commands: {
    'farmer/do'(ctx, cmd) {
      return enqueue(ctx, { kind: cmd.kind, slotId: cmd.slotId, producerId: cmd.producerId });
    },
    'farmer/doAll'(ctx, cmd) {
      const f = ctx.state.farm.farmer;
      const blocked = farmerBlocked(ctx);
      if (blocked) return fail(blocked);
      const wanted = ctx.state.farm.slots.filter((s) => {
        if (!s.producerId || f.tasks.some((t) => t.slotId === s.id && t.kind === cmd.kind) || gardenerOn(ctx, s.id)) return false;
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
      // Việc đang làm dở (đã tới nơi) vẫn làm cho xong, chỉ bỏ những việc chưa tới lượt.
      // Việc chở hàng tới cối luôn giữ lại (không thì lúa trên máy cày bị mất).
      f.tasks = f.tasks.filter((t, i) => (i === 0 && f.work != null) || t.kind === 'haul');
      return ok();
    },
  },
};
