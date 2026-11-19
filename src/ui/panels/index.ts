import { farmPanel } from './farm';
import { inventoryPanel } from './inventory';
import { marketPanel } from './market';
import { menuPanel } from './menu';
import { restaurantPanel } from './restaurant';
import { regularsPanel } from './regulars';
import { shopPanel } from './shop';
import type { Panel } from './types';

export type { Panel, UiState } from './types';

/** Thứ tự nút mở panel. Panel mới thêm vào đây. */
export const panels: Panel[] = [restaurantPanel, regularsPanel, menuPanel, shopPanel, marketPanel, farmPanel, inventoryPanel];
