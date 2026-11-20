import { EventBus } from '../core/events';
import type { Content, CuisineId } from '../data';
import { createInitialState, emptyStats, type GameState, type OwnerProfile } from './state';
import { clockSystem } from './systems/clock';
import { festivalSystem } from './systems/festival';
import { eventSystem } from './systems/events';
import { contractSystem } from './systems/contracts';
import { calendarOf } from './calendar';
import { customerSystem } from './systems/customers';
import { decorSystem } from './systems/decor';
import { farmSystem } from './systems/farm';
import { serviceSystem } from './systems/service';
import { farmerSystem } from './systems/farmer';
import { millSystem } from './systems/mills';
import { questSystem } from './systems/quests';
import { homeSystem } from './systems/home';
import { helperSystem } from './systems/helpers';
import { crewSystem } from './systems/crew';
import { kitchenSystem } from './systems/kitchen';
import { marketSystem } from './systems/market';
import { progressionSystem } from './systems/progression';
import { weatherSystem } from './systems/weather';
import { tutorialFrozen, tutorialSystem } from './systems/tutorial';
import { gardenerSystem } from './systems/gardeners';
import { achievementSystem } from './systems/achievements';
import { fail, ok, type Command, type CommandHandlers, type CommandResult, type SimContext, type SimEvents, type System } from './types';

/** Thứ tự ở đây là thứ tự update mỗi bước. System mới thêm vào mảng này. */
export const defaultSystems: System[] = [clockSystem, crewSystem, weatherSystem, festivalSystem, eventSystem, contractSystem, customerSystem, kitchenSystem, serviceSystem, farmSystem, farmerSystem, millSystem, marketSystem, progressionSystem, decorSystem, questSystem, homeSystem, helperSystem, gardenerSystem, achievementSystem, tutorialSystem];

/** System vẫn chạy khi ngày hướng dẫn dừng giờ (để bác nông dân đi gieo trồng theo hướng dẫn). */
const FROZEN_OK = new Set(['farmer', 'gardeners', 'tutorial']);

/** Bước mô phỏng tối đa (phút game) — giữ kết quả ổn định khi tua nhanh. */
const MAX_STEP = 1;

/**
 * Lõi mô phỏng, không phụ thuộc DOM/trình duyệt: chạy được trong Node (test), Web Worker, hay port sang engine khác.
 *  - Đọc: game.state (UI chỉ đọc, không sửa).
 *  - Ghi: game.dispatch(command).
 *  - Thời gian: game.tick(số phút game).
 *  - Hiệu ứng: game.bus.on(sự kiện, ...).
 */
export class Game {
  readonly bus = new EventBus<SimEvents>();
  readonly state: GameState;
  readonly ctx: SimContext;
  private handlers: Partial<CommandHandlers> = {};

  constructor(
    readonly content: Content,
    options: { state?: GameState; seed?: number; cuisine?: CuisineId; owner?: OwnerProfile; tutorial?: boolean } = {},
    private systems: System[] = defaultSystems,
  ) {
    this.state = options.state ?? createInitialState(content, options.seed ?? Date.now(), options.cuisine, options.owner);
    this.ctx = { state: this.state, content, bus: this.bus };
    if (!options.state && options.tutorial) this.state.tutorial = { step: 'intro', recipe: null, item: null, served: 0 };
    for (const sys of systems) Object.assign(this.handlers, sys.commands);
    this.handlers['day/next'] = () => this.nextDay();
    if (!options.state) for (const sys of systems) sys.init?.(this.ctx);
  }

  /** Tiến mô phỏng `minutes` phút game. Không làm gì khi đang ở màn tổng kết ngày. */
  tick(minutes: number): void {
    let remaining = minutes;
    while (remaining > 0 && this.state.clock.phase !== 'summary') {
      const dt = Math.min(MAX_STEP, remaining);
      remaining -= dt;
      // Ngày hướng dẫn đang dừng giờ: chỉ cho người đi lại ở nông trại (bác, người làm vườn) chạy tiếp
      const frozen = tutorialFrozen(this.ctx);
      for (const sys of this.systems) if (!frozen || FROZEN_OK.has(sys.id)) sys.update?.(this.ctx, dt);
    }
  }

  dispatch(cmd: Command): CommandResult {
    const handler = this.handlers[cmd.type] as ((ctx: SimContext, cmd: Command) => CommandResult) | undefined;
    if (!handler) return fail(`Lệnh "${cmd.type}" chưa có handler.`);
    return handler(this.ctx, cmd);
  }

  private nextDay(): CommandResult {
    const { state, content } = this;
    if (state.clock.phase !== 'summary') return fail('Ngày chưa kết thúc.');
    state.clock = { day: state.clock.day + 1, minute: content.balance.openMinute, phase: 'open' };
    state.stats.today = emptyStats();
    // Sang mùa mới / năm mới: bắt đầu đếm lại (tổng kết đã hiện ở màn hết ngày cuối mùa)
    const cal = calendarOf(state.clock.day);
    if (cal.dayOfSeason === 1) state.stats.season = emptyStats();
    if (cal.dayOfSeason === 1 && cal.season === 0) state.stats.year = emptyStats();
    state.restaurant.spawnTimer = 10;
    for (const sys of this.systems) sys.onDayStart?.(this.ctx);
    this.bus.emit('day/started', { day: state.clock.day });
    return ok();
  }
}
