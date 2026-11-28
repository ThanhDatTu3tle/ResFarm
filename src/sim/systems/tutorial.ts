import { hasAll, stockOf } from '../helpers';
import type { Party, TutorialState, TutorialStep } from '../state';
import { fail, ok, type SimContext, type System } from '../types';
import { spawnParty } from './customers';

/**
 * NGÀY HƯỚNG DẪN - ngày 1 của ván mới (bắt đầu từ màn mở đầu) có kịch bản, `state.tutorial`:
 *  intro   dừng giờ, lời chào.
 *  serve   khách dễ (1 người rồi 2 người) gọi món có sẵn nguyên liệu → làm quen mang menu, ghi món, bưng món, dọn bàn.
 *  hard    khách gọi một món đang thiếu nguyên liệu (`recipe`, thiếu `item`).
 *  market  khách chọn xong thì DỪNG GIỜ: chỉ đường ra chợ, đúng sạp, mua đủ → tự sang bước cook.
 *  cook    về quán ghi món, bếp nấu, bưng cho khách; khách trả tiền xong →
 *  farm    DỪNG GIỜ (bác nông dân vẫn đi làm): gieo một ô rau, gieo lúa mì, nuôi gà → xong thì
 *  morning tự do (khách tới bình thường); giờ không vượt quá 10:30 trước khi xong bước farm.
 *  lunch   12:00 khách về hết (customers.ts `inSeating`), cả đội ra chợ: hướng dẫn gọi món cho đầy năng lượng.
 *  done    trả hoá đơn xong: lời chào buổi chiều tự do; bấm "Bắt đầu" (tutorial/next) là hết hướng dẫn.
 * Khách ngẫu nhiên không tới trong các bước intro → farm. `tutorial/skip` bỏ hướng dẫn bất cứ lúc nào.
 */
export const tutorialSystem: System = {
  id: 'tutorial',
  update(ctx) {
    const t = ctx.state.tutorial;
    if (!t) return;
    const { state } = ctx;
    const r = state.restaurant;
    const served = state.stats.today.guestsServed;
    switch (t.step) {
      case 'serve':
        // Nhóm 1 người, xong thì nhóm 2 người; khách bỏ về thì mời nhóm khác
        if (served >= 3) {
          go(ctx, t, 'hard');
          break;
        }
        if (!r.parties.length) spawnParty(ctx, { size: served === 0 ? 1 : 2, tutorial: true });
        break;
      case 'hard': {
        const p = wantParty(ctx);
        if (!p) {
          if (served > t.served) go(ctx, t, 'farm'); // đã có nguyên liệu sẵn mà khách vẫn ăn xong
          else if (!r.parties.length) spawnParty(ctx, { size: 1, want: t.recipe!, tutorial: true });
        } else if (p.phase === 'readyToOrder' && !missing(ctx, t)) go(ctx, t, 'cook');
        else if (p.phase === 'readyToOrder') go(ctx, t, 'market');
        break;
      }
      case 'market':
        if (!missing(ctx, t)) go(ctx, t, 'cook');
        break;
      case 'cook':
        if (served > t.served) go(ctx, t, 'farm');
        else if (!wantParty(ctx) && !r.parties.length) go(ctx, t, 'hard'); // khách bỏ về: mời lại
        break;
      case 'farm':
        if (farmChecklist(ctx).every((c) => c.done)) go(ctx, t, 'morning');
        break;
      case 'morning':
        if (state.clock.minute >= ctx.content.balance.shifts[0].to) go(ctx, t, 'lunch');
        break;
      case 'lunch': {
        const c = state.crew;
        if (c.restaurantAway && !c.pending.length && !c.meals.length && !c.bill.length) go(ctx, t, 'done');
        break;
      }
    }
  },
  onDayStart(ctx) {
    ctx.state.tutorial = null; // hướng dẫn chỉ trong ngày 1
  },
  commands: {
    'tutorial/next'(ctx) {
      const t = ctx.state.tutorial;
      if (!t) return fail('Không có hướng dẫn.');
      if (t.step === 'intro') {
        // Vào thẳng đầu ca sáng để khách tới ngay
        ctx.state.clock.minute = Math.max(ctx.state.clock.minute, ctx.content.balance.shifts[0].from);
        go(ctx, t, 'serve');
        return ok();
      }
      if (t.step === 'done') {
        ctx.state.tutorial = null;
        ctx.bus.emit('tutorial/step', { step: null });
        return ok();
      }
      return fail('Làm xong bước này trước đã.');
    },
    'tutorial/skip'(ctx) {
      if (!ctx.state.tutorial) return fail('Không có hướng dẫn.');
      ctx.state.tutorial = null;
      ctx.bus.emit('tutorial/step', { step: null });
      return ok();
    },
  },
};

function go(ctx: SimContext, t: TutorialState, step: TutorialStep): void {
  // Làm hết các bước hướng dẫn: thưởng (không tính vào doanh thu)
  if (step === 'done' && t.step !== 'done') ctx.state.money += ctx.content.balance.tutorialReward;
  t.step = step;
  t.served = ctx.state.stats.today.guestsServed;
  if (step === 'hard' && !t.recipe) pickHardDish(ctx, t);
  ctx.bus.emit('tutorial/step', { step });
}

/**
 * Chọn món khó: món đang bán có nguyên liệu bán ở chợ (không phải loại vô hạn); bớt nguyên liệu đó trong kho
 * xuống còn thiếu 1 phần ("vừa hết hàng") để người chơi phải ra chợ mua.
 */
function pickHardDish(ctx: SimContext, t: TutorialState): void {
  const { state, content } = ctx;
  const sold = new Set(content.stalls.all().flatMap((s) => s.items));
  const active = state.menu.active.map((id) => content.recipes.get(id));
  // Ưu tiên nguyên liệu ít món dùng nhất (bớt nó đi không làm hỏng các món khác)
  const users = (item: string) => active.filter((r) => r.ingredients.some((x) => x.item === item)).length;
  let best: { recipe: string; item: string; qty: number; score: number } | null = null;
  for (const r of active) {
    for (const x of r.ingredients) {
      if (!sold.has(x.item) || content.items.get(x.item).infinite) continue;
      const score = users(x.item);
      if (!best || score < best.score) best = { recipe: r.id, item: x.item, qty: x.qty, score };
    }
  }
  if (!best) return;
  t.recipe = best.recipe;
  t.item = best.item;
  state.inventory[best.item] = Math.min(stockOf(ctx, best.item), best.qty - 1);
}

/** Nhóm khách của bước món khó (còn trong quán). */
function wantParty(ctx: SimContext): Party | undefined {
  return ctx.state.restaurant.parties.find((p) => p.want);
}

/** Còn thiếu nguyên liệu cho món khó không. */
function missing(ctx: SimContext, t: TutorialState): boolean {
  return !!t.recipe && !hasAll(ctx, ctx.content.recipes.get(t.recipe).ingredients);
}

/** Số lượng cần mua thêm của nguyên liệu thiếu (để chỉ dẫn). */
export function tutorialNeed(ctx: SimContext): { item: string; qty: number; stallId: string | null } | null {
  const t = ctx.state.tutorial;
  if (!t?.recipe || !t.item) return null;
  const need = ctx.content.recipes.get(t.recipe).ingredients.find((x) => x.item === t.item)?.qty ?? 1;
  const stall = ctx.content.stalls.all().find((s) => s.items.includes(t.item!));
  return { item: t.item, qty: Math.max(0, need - stockOf(ctx, t.item)), stallId: stall?.id ?? null };
}

/** Việc ở bước nông trại: gieo một ô rau, gieo lúa mì, nuôi gà (tính khi đã gieo / thả xong thật). */
export function farmChecklist(ctx: SimContext): { id: string; icon: string; text: string; done: boolean }[] {
  const slots = ctx.state.farm.slots;
  const planted = (type: string, producer?: string) => slots.some((s) => s.type === type && s.producerId && (!producer || s.producerId === producer));
  return [
    { id: 'veg', icon: '🥬', text: 'Ô ruộng: cuốc đất rồi gieo rau', done: planted('field') },
    { id: 'wheat', icon: '🌾', text: 'Ruộng lúa mì: gieo lúa mì', done: planted('wheat') },
    { id: 'hen', icon: '🐔', text: 'Chuồng: thả gà mái đẻ (có trứng)', done: planted('pen', 'hen') },
  ];
}

/** Chỉ để thử (tham số ?tut= ở bản dev): nhảy thẳng tới một bước (chọn sẵn món khó nếu cần). */
export function tutorialJump(ctx: SimContext, step: TutorialStep): void {
  const t = (ctx.state.tutorial ??= { step: 'intro', recipe: null, item: null, served: 0 });
  ctx.state.clock.minute = Math.max(ctx.state.clock.minute, ctx.content.balance.shifts[0].from);
  if (step !== 'intro' && step !== 'serve') go(ctx, t, 'hard');
  go(ctx, t, step);
}

/** Đang dừng giờ (lời chào, ra chợ, ra nông trại): khách / bếp / đồng hồ đứng im. */
export function tutorialFrozen(ctx: SimContext): boolean {
  const s = ctx.state.tutorial?.step;
  return s === 'intro' || s === 'market' || s === 'farm';
}

/** Khách ngẫu nhiên chưa được tới (đang trong các bước có kịch bản). */
export function tutorialHoldsGuests(ctx: SimContext): boolean {
  const s = ctx.state.tutorial?.step;
  return !!s && s !== 'morning' && s !== 'lunch' && s !== 'done';
}

/** Ngày hướng dẫn: ca sáng khách về hết lúc 12:00 (thay vì 12:30) để cả đội đi ăn trưa đúng giờ. */
export function tutorialLunch(ctx: SimContext): boolean {
  return !!ctx.state.tutorial;
}

/** Giờ không vượt quá 10:30 khi chưa xong các bước có kịch bản (để còn thời gian làm quen trước giờ trưa). */
export function tutorialClockCap(ctx: SimContext): number | null {
  return tutorialHoldsGuests(ctx) ? 10 * 60 + 30 : null;
}
