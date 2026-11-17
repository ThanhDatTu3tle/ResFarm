import { spend } from '../helpers';
import { canPlaceTable, LAYOUT_GRID } from '../layout';
import { fail, ok, type System } from '../types';

/**
 * Trang trí quán: mua/đổi nội thất (sàn, tường, bàn ghế) và sắp xếp lại vị trí bàn.
 * Hiệu ứng gameplay của nội thất đang dùng được gộp trong modifier() ở helpers.ts.
 */
export const decorSystem: System = {
  id: 'decor',
  commands: {
    'decor/buy'(ctx, cmd) {
      const { state, content } = ctx;
      if (!content.decor.has(cmd.decorId)) return fail('Không có món nội thất này.');
      if (state.decor.owned.includes(cmd.decorId)) return fail('Đã mua rồi.');
      const def = content.decor.get(cmd.decorId);
      if (state.level < def.level) return fail(`Cần cấp ${def.level}.`);
      if (!spend(ctx, def.cost)) return fail('Không đủ tiền.');
      state.decor.owned.push(def.id);
      state.decor.equipped[def.slot] = def.id;
      return ok();
    },
    'decor/equip'(ctx, cmd) {
      const { state, content } = ctx;
      if (!state.decor.owned.includes(cmd.decorId) || !content.decor.has(cmd.decorId)) return fail('Chưa mua món này.');
      state.decor.equipped[content.decor.get(cmd.decorId).slot] = cmd.decorId;
      return ok();
    },
    'layout/moveTable'(ctx, cmd) {
      const x = Math.round(cmd.x / LAYOUT_GRID) * LAYOUT_GRID;
      const y = Math.round(cmd.y / LAYOUT_GRID) * LAYOUT_GRID;
      const problem = canPlaceTable(ctx, cmd.tableId, x, y);
      if (problem) return fail(problem);
      ctx.state.restaurant.layout[cmd.tableId] = { x, y };
      return ok();
    },
    'layout/reset'(ctx) {
      if (ctx.state.restaurant.parties.some((p) => p.tableId)) return fail('Chờ khách về hết rồi mới xếp lại mặc định được.');
      ctx.state.restaurant.layout = {};
      return ok();
    },
  },
};
