import type { Content } from '../data';
import type { Game } from '../sim/game';
import { esc } from './dom';

/** Khung tooltip "kiếm ở đâu" dưới hàng tag nguyên liệu (bảng Đơn hàng, Thực đơn). */
export function itemTipHtml(game: Game, itemId: string): string {
  const item = game.content.items.get(itemId);
  const { lines, summary } = itemSources(game.content, itemId);
  return `<div class="item-tip"><b>${item.icon} ${esc(item.name)}</b> - ${esc(summary)}${lines.length ? `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}</div>`;
}

/**
 * Nguyên liệu kiếm ở đâu (tooltip khi bấm tag nguyên liệu): mua ở sạp nào ngoài chợ, trồng / nuôi ở ô nào,
 * xay / chế biến ở cối nào từ nguyên liệu gì. Tính từ data (StallDef.items, ProducerDef.yields, MillTypeDef.products).
 */
export function itemSources(content: Content, itemId: string): { lines: string[]; summary: string } {
  const item = content.items.get(itemId);
  const lines: string[] = [];
  const stalls = content.stalls.all().filter((s) => !s.menu?.length && s.items.includes(itemId));
  for (const s of stalls) lines.push(`${s.icon} Mua ở chợ - ${s.name}`);
  for (const p of content.producers.all()) {
    if (!p.yields.some((y) => y.item === itemId)) continue;
    const slots = [p.slot, ...(p.alsoIn ?? [])].map((id) => content.slotTypes.get(id));
    const verb = slots[0].animals || slots[0].id === 'pond' ? 'Nuôi' : 'Trồng';
    const lv = p.level > 1 ? ` (từ cấp ${p.level})` : '';
    lines.push(`${p.icon} ${verb} ${p.name} ở ${slots.map((s) => s.name).join(' / ')}${lv}`);
  }
  for (const m of content.mills.all()) {
    if (!m.products.includes(itemId)) continue;
    const input = content.items.get(m.input);
    lines.push(`${m.icon} Chế biến ở ${m.name} từ ${input.icon} ${input.name}`);
  }
  let summary: string;
  if (item.infinite) summary = 'Có sẵn trong kho, không bao giờ hết.';
  else if (!lines.length) summary = 'Chưa có cách nào kiếm được.';
  else if (!stalls.length) summary = 'Chợ không bán - chỉ tự làm ra được.';
  else if (lines.length === stalls.length) summary = 'Chỉ mua được ở chợ.';
  else summary = 'Mua ở chợ hoặc tự làm ra.';
  return { lines, summary };
}
