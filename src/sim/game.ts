import { EventBus } from '../core/events';
import type { Content } from '../data';
import { createInitialState, emptyStats, type GameState } from './state';
import { clockSystem } from './systems/clock';
import { customerSystem } from './systems/customers';
import { decorSystem } from './systems/decor';
import { farmSystem } from './systems/farm';
import { serviceSystem } from './systems/service';
import { farmerSystem } from './systems/farmer';
import { kitchenSystem } from './systems/kitchen';
import { marketSystem } from './systems/market';
import { progressionSystem } from './systems/progression';
import { weatherSystem } from './systems/weather';
import { fail, ok, type Command, type CommandHandlers, type CommandResult, type SimContext, type SimEvents, type System } from './types';

/** Thứ tự ở đây là thứ tự update mỗi bước. System mới thêm vào mảng này. */
export const defaultSystems: System[] = [clockSystem, weatherSystem, customerSystem, kitchenSystem, serviceSystem, farmSystem, farmerSystem, marketSystem, progressionSystem, decorSystem];

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
    options: { state?: GameState; seed?: number } = {},
    private systems: System[] = defaultSystems,
  ) {
    this.state = options.state ?? createInitialState(content, options.seed ?? Date.now());
    this.ctx = { state: this.state, content, bus: this.bus };
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
      for (const sys of this.systems) sys.update?.(this.ctx, dt);
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
    state.restaurant.spawnTimer = 10;
    for (const sys of this.systems) sys.onDayStart?.(this.ctx);
    this.bus.emit('day/started', { day: state.clock.day });
    return ok();
  }
}
