import { categoryNames } from '../../data/items';
import type { ItemCategory } from '../../data';
import { stockOf } from '../../sim/helpers';
import { esc } from '../dom';
import { qty } from '../format';
import type { Panel } from './types';

export const inventoryPanel: Panel = {
  id: 'inventory',
  label: 'Kho',
  icon: '📦',
  render(game) {
    const { content, ctx } = game;
    return (Object.keys(categoryNames) as ItemCategory[])
      .map((category) => {
        const chips = content.items
          .all()
          .filter((i) => i.category === category)
          .map((i) => {
            const have = stockOf(ctx, i.id);
            return `<div class="chip stock ${have ? '' : 'bad'}"><span class="big">${i.icon}</span>${esc(i.name)} <b>${qty(have)}</b></div>`;
          })
          .join('');
        return chips ? `<h3>${categoryNames[category]}</h3><div class="chips">${chips}</div>` : '';
      })
      .join('');
  },
};
