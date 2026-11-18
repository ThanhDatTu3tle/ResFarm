import type { MillType } from '../../data';
import { addItem, spend } from '../helpers';
import { createMill, type MillState } from '../state';
import { fail, ok, type SimContext, type System } from '../types';

/**
 * CỐI CHẾ BIẾN ở nông trại (cối xay gió cho lúa mì, nhà xay lúa cho lúa nước).
 * Bác nông dân chở lúa tới (việc 'haul' trong farmer.ts) → mill.input tăng; cối chế biến từng đơn vị theo
 * MillTypeDef.time rồi cho thành phẩm đang chọn thẳng vào kho. Qua đêm cối vẫn chạy như nông trại.
 */
export const millSystem: System = {
  id: 'mills',
  update(ctx, dt) {
    run(ctx, dt);
  },
  onDayStart(ctx) {
    run(ctx, ctx.content.balance.nightMinutes);
  },
  commands: {
    'mill/buy'(ctx, cmd) {
      const def = ctx.content.mills.get(cmd.millType);
      const owned = millsOfType(ctx, cmd.millType).length;
      if (ctx.state.level < def.level) return fail(`Cần cấp ${def.level}.`);
      if (owned >= def.max) return fail(`Đã đủ ${def.max} ${def.name.toLowerCase()}.`);
      if (!spend(ctx, millPrice(ctx, cmd.millType))) return fail('Không đủ tiền.');
      ctx.state.farm.mills.push(createMill(def.id, owned, def.products[0]));
      return ok();
    },
    'mill/setProduct'(ctx, cmd) {
      const mill = ctx.state.farm.mills.find((m) => m.id === cmd.millId);
      if (!mill) return fail('Không tìm thấy cối.');
      if (!ctx.content.mills.get(mill.type).products.includes(cmd.item)) return fail('Cối này không làm được thứ đó.');
      if (mill.product !== cmd.item) mill.progress = 0;
      mill.product = cmd.item;
      return ok();
    },
  },
};

function run(ctx: SimContext, minutes: number): void {
  for (const mill of ctx.state.farm.mills) {
    const def = ctx.content.mills.get(mill.type);
    let time = minutes;
    let made = 0;
    while (mill.input > 0 && time > 0) {
      const need = def.time - mill.progress;
      if (time < need) {
        mill.progress += time;
        break;
      }
      time -= need;
      mill.progress = 0;
      mill.input--;
      made++;
    }
    if (!mill.input) mill.progress = 0;
    if (made) {
      addItem(ctx, mill.product, made);
      ctx.bus.emit('mill/produced', { millId: mill.id, item: mill.product, qty: made });
    }
  }
}

export function millsOfType(ctx: SimContext, type: MillType): MillState[] {
  return ctx.state.farm.mills.filter((m) => m.type === type);
}

/** Giá mua cối kế tiếp của loại này. */
export function millPrice(ctx: SimContext, type: MillType): number {
  const def = ctx.content.mills.get(type);
  const bought = Math.max(0, millsOfType(ctx, type).length - def.initial);
  return Math.round(def.basePrice * Math.pow(def.priceGrowth, bought));
}

/** Tâm cối trên bản đồ nông trại (mét), theo thứ tự cối trong loại. */
export function millCenter(ctx: SimContext, mill: MillState): { x: number; z: number } {
  return millCenterAt(ctx, mill.type, Math.max(0, millsOfType(ctx, mill.type).indexOf(mill)));
}

/** Tâm vị trí cối thứ `index` của loại (dùng cả cho chỗ trống chưa mua). */
export function millCenterAt(ctx: SimContext, type: MillType, index: number): { x: number; z: number } {
  const { layout } = ctx.content.mills.get(type);
  return { x: layout.x + (index % layout.cols) * layout.dx, z: layout.z + Math.floor(index / layout.cols) * layout.dz };
}

/** Chỗ bác nông dân đứng đổ hàng vào cối. */
export function millSpot(ctx: SimContext, mill: MillState): { x: number; z: number } {
  const c = millCenter(ctx, mill);
  const { spot } = ctx.content.mills.get(mill.type).layout;
  return { x: c.x + spot.x, z: c.z + spot.z };
}

/** Cối nhận hàng kế tiếp: cối cùng loại đang tồn ít nhất (chia đều khi có nhiều cối). */
export function pickMill(ctx: SimContext, type: MillType): MillState | null {
  const list = millsOfType(ctx, type);
  if (!list.length) return null;
  const pending = (m: MillState) => m.input + ctx.state.farm.farmer.tasks.filter((t) => t.kind === 'haul' && t.millId === m.id).length * 100;
  return list.reduce((a, b) => (pending(b) < pending(a) ? b : a));
}
