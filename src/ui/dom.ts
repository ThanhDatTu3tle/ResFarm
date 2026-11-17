import type { Command } from '../sim/types';

/**
 * Tiện ích DOM cho UI.
 * Cách UI hoạt động: mỗi panel là một hàm thuần `state -> chuỗi HTML`, được gọi lại vài lần mỗi giây;
 * morph() vá DOM tại chỗ (không thay nút đang được bấm) nên panel không cần tự quản lý cập nhật.
 */

export function esc(value: string | number): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Thuộc tính gắn lệnh sim vào phần tử: bấm vào là game.dispatch(command). Có kiểm tra kiểu. */
export function cmd(command: Command): string {
  return ` data-cmd="${esc(JSON.stringify(command))}"`;
}

/** Thuộc tính gắn hành động thuần UI (đổi tab, tốc độ...), xử lý trong app.ts. Dạng "tên:tham số". */
export function ui(action: string): string {
  return ` data-ui="${esc(action)}"`;
}

/** Thanh tiến độ, frac trong 0..1. */
export function bar(frac: number, cls = ''): string {
  const pct = Math.round(Math.max(0, Math.min(1, frac)) * 100);
  return `<span class="bar ${cls}"><i style="width:${pct}%"></i></span>`;
}

/** Cập nhật nội dung `el` thành `html`, giữ lại các node không đổi. */
export function morph(el: Element, html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html;
  morphChildren(el, template.content);
}

function morphChildren(parent: Node, next: Node): void {
  let a = parent.firstChild;
  let b = next.firstChild;
  while (b) {
    const bNext = b.nextSibling;
    if (!a) {
      parent.appendChild(b);
    } else if (sameKind(a, b)) {
      patch(a, b);
      a = a.nextSibling;
    } else {
      const aNext = a.nextSibling;
      parent.replaceChild(b, a);
      a = aNext;
    }
    b = bNext;
  }
  while (a) {
    const aNext = a.nextSibling;
    parent.removeChild(a);
    a = aNext;
  }
}

function sameKind(a: Node, b: Node): boolean {
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) return false;
  if (a instanceof Element && b instanceof Element) return a.getAttribute('data-key') === b.getAttribute('data-key');
  return true;
}

function patch(a: Node, b: Node): void {
  if (a instanceof Element && b instanceof Element) {
    for (const attr of [...a.attributes]) if (!b.hasAttribute(attr.name)) a.removeAttribute(attr.name);
    for (const attr of [...b.attributes]) if (a.getAttribute(attr.name) !== attr.value) a.setAttribute(attr.name, attr.value);
    morphChildren(a, b);
  } else if (a.nodeValue !== b.nodeValue) {
    a.nodeValue = b.nodeValue;
  }
}
