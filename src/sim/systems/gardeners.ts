import { farmTools, gardenerJobs, type GardenerJob } from '../../data/farmhands';
import { canPlantNow, isFrozen } from '../calendar';
import { spend } from '../helpers';
import type { FarmerTask, FarmSlot, GardenerState } from '../state';
import { fail, ok, type SimContext, type System } from '../types';
import { needsWatering } from './farm';
import { isAutoSlot, nextWaypoint, perform, taskSpot, walkSpeed, workSpot, workTimeOf } from './farmer';

/**
 * NGƯỜI LÀM VƯỜN — thuê thêm ở bảng Nhà nông (chỗ thứ i mở ở cấp `balance.gardeners.levels[i]`).
 *  - Người chơi bật / tắt việc cho từng người (`gardenerJobs`: thu hoạch, chuồng + ao, tưới, cuốc + gieo lại).
 *  - Rảnh thì tự nhận MỘT việc: ô gần nhất cần làm, theo thứ tự ưu tiên thu hoạch → chuồng/ao → tưới → gieo lại;
 *    bỏ qua ô bác nông dân hoặc người khác đang lo. Đi theo lối như bác (`nextWaypoint`), tới nơi làm rồi gọi `perform`.
 *  - Ruộng lúa (máy cày + cối) vẫn là việc của bác. Không có năng lượng; nghỉ trưa / tối cùng giờ với bác (`crew.farmerAway`).
 * Dụng cụ (`tool/buy`) cũng ở đây vì mua trên cùng bảng; hiệu ứng nằm trong farmer.ts.
 */
export const gardenerSystem: System = {
  id: 'gardeners',
  update(ctx, dt) {
    if (ctx.state.crew.farmerAway) return;
    for (const g of ctx.state.farm.gardeners) step(ctx, g, dt);
  },
  commands: {
    'gardener/hire'(ctx) {
      const { state, content } = ctx;
      const b = content.balance.gardeners;
      const list = state.farm.gardeners;
      if (list.length >= b.levels.length) return fail('Đã đủ người làm vườn.');
      if (list.length >= maxGardeners(ctx)) return fail(`Cần cấp ${b.levels[list.length]} để thuê thêm người làm vườn.`);
      if (!spend(ctx, b.hireCost)) return fail('Không đủ tiền.');
      const used = new Set(list.map((g) => g.name));
      const name = b.names.find((n) => !used.has(n)) ?? `Người làm vườn ${list.length + 1}`;
      const looks = new Set(list.map((g) => g.look));
      const look = [0, 1, 2].find((i) => !looks.has(i)) ?? list.length;
      const home = b.homes[look % b.homes.length];
      const jobs = Object.fromEntries(gardenerJobs.map((j) => [j.id, true])) as Record<GardenerJob, boolean>;
      list.push({ id: `g${state.nextId++}`, name, look, x: home.x, z: home.z, task: null, work: null, jobs });
      return ok();
    },
    'gardener/fire'(ctx, cmd) {
      const farm = ctx.state.farm;
      if (!farm.gardeners.some((g) => g.id === cmd.gardenerId)) return fail('Không có người này.');
      farm.gardeners = farm.gardeners.filter((g) => g.id !== cmd.gardenerId);
      return ok();
    },
    'gardener/setJob'(ctx, cmd) {
      const g = ctx.state.farm.gardeners.find((x) => x.id === cmd.gardenerId);
      if (!g) return fail('Không có người này.');
      g.jobs[cmd.job] = cmd.on;
      return ok();
    },
    'tool/buy'(ctx, cmd) {
      const def = farmTools.find((t) => t.id === cmd.toolId);
      if (!def) return fail('Không có dụng cụ này.');
      const tools = ctx.state.farm.tools;
      if (tools.includes(def.id)) return fail('Đã có dụng cụ này rồi.');
      if (ctx.state.level < def.level) return fail(`Cần cấp ${def.level}.`);
      if (!spend(ctx, def.cost)) return fail('Không đủ tiền.');
      tools.push(def.id);
      ctx.bus.emit('tool/bought', { toolId: def.id });
      return ok();
    },
  },
};

/** Số người làm vườn thuê được ở cấp hiện tại. */
export function maxGardeners(ctx: SimContext): number {
  return ctx.content.balance.gardeners.levels.filter((l) => ctx.state.level >= l).length;
}

/** Ô đã có người lo (bác nông dân xếp việc, hoặc người làm vườn khác đang tới). */
function claimed(ctx: SimContext, slotId: string, self: GardenerState): boolean {
  const { farmer, gardeners } = ctx.state.farm;
  return farmer.tasks.some((t) => t.slotId === slotId && t.kind !== 'visit') || gardeners.some((g) => g !== self && g.task?.slotId === slotId);
}

/** Đủ điều kiện gieo / thả lại giống cũ ở ô trống này (đúng mùa, đủ cấp, đủ tiền). */
function canReplant(ctx: SimContext, slot: FarmSlot): boolean {
  if (slot.producerId || !slot.lastProducerId || !ctx.content.producers.has(slot.lastProducerId)) return false;
  const def = ctx.content.producers.get(slot.lastProducerId);
  return canPlantNow(ctx, def, slot.type) && ctx.state.level >= def.level && ctx.state.money >= def.cost;
}

/** Việc cần làm ở ô này theo một loại việc (null = không có). */
function jobTask(ctx: SimContext, slot: FarmSlot, job: GardenerJob): FarmerTask | null {
  const type = ctx.content.slotTypes.get(slot.type);
  if (isAutoSlot(ctx, slot)) return null; // ruộng lúa: việc của bác (máy cày + cối)
  switch (job) {
    case 'harvest':
      return !type.animals && slot.producerId && slot.stage === 'ready' ? { kind: 'harvest', slotId: slot.id } : null;
    case 'animals':
      if (!type.animals) return null;
      if (slot.producerId && slot.stage === 'ready') return { kind: 'harvest', slotId: slot.id };
      return canReplant(ctx, slot) ? { kind: 'plant', slotId: slot.id, producerId: slot.lastProducerId! } : null;
    case 'water':
      return slot.producerId && slot.stage === 'growing' && needsWatering(ctx, slot) && !isFrozen(ctx, slot.type) ? { kind: 'water', slotId: slot.id } : null;
    case 'replant':
      if (type.animals || !type.needsTilling || !canReplant(ctx, slot)) return null;
      return slot.tilled ? { kind: 'plant', slotId: slot.id, producerId: slot.lastProducerId! } : { kind: 'till', slotId: slot.id };
  }
}

/** Nhận việc: loại việc ưu tiên cao nhất đang có, ô gần nhất. */
export function pickGardenerTask(ctx: SimContext, g: GardenerState): FarmerTask | null {
  for (const { id } of gardenerJobs) {
    if (!g.jobs[id]) continue;
    let best: FarmerTask | null = null;
    let bestDist = Infinity;
    for (const slot of ctx.state.farm.slots) {
      if (claimed(ctx, slot.id, g)) continue;
      const task = jobTask(ctx, slot, id);
      if (!task) continue;
      const p = workSpot(ctx, slot);
      const d = Math.abs(p.x - g.x) + Math.abs(p.z - g.z);
      if (d < bestDist) [best, bestDist] = [task, d];
    }
    if (best) return best;
  }
  return null;
}

function step(ctx: SimContext, g: GardenerState, dt: number): void {
  const { content } = ctx;
  const b = content.balance.gardeners;
  let time = dt;
  for (let guard = 0; guard < 16 && time > 1e-9; guard++) {
    if (!g.task) {
      g.task = pickGardenerTask(ctx, g);
      g.work = null;
      if (!g.task) return; // rảnh: đứng yên tại chỗ
    }
    const task = g.task;
    const spot = taskSpot(ctx, task);
    if (!spot) {
      g.task = null;
      continue;
    }
    const target = nextWaypoint(g, spot, content.balance.farmer.lanes, content.balance.farmer.side);
    const dx = target.x - g.x;
    const dz = target.z - g.z;
    const dist = Math.hypot(dx, dz);
    const speed = walkSpeed(ctx, task, b.speed);
    const walk = dist / speed;
    if (walk > time) {
      g.x += (dx / dist) * speed * time;
      g.z += (dz / dist) * speed * time;
      return;
    }
    g.x = target.x;
    g.z = target.z;
    time -= walk;
    if (target !== spot) continue;
    if (g.work == null) g.work = workTimeOf(ctx, task, b.workTime);
    if (g.work > time) {
      g.work -= time;
      return;
    }
    time -= g.work;
    g.task = null;
    g.work = null;
    // Ô có thể đã đổi trong lúc đi (trời mưa tưới hộ, hết tiền mua giống...): lỗi thì bỏ qua, không báo người chơi
    const result = perform(ctx, task);
    if (result.ok) ctx.bus.emit('gardener/done', { gardenerId: g.id, kind: task.kind, slotId: task.slotId });
  }
}
