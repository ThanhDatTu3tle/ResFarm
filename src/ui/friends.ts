import type { Content } from '../data';
import { esc, ui as uiAttr } from './dom';
import { ago, inviteLink, onlineEnabled, type Friend, type Me } from './online';

/** Trạng thái bảng Bạn bè (thuần giao diện, không lưu vào save). */
export interface FriendsView {
  open: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  me: Me | null;
  friends: Friend[];
  error: string;
  /** Mã QR (SVG) của link mời. */
  qr: string;
  /** Đang chờ máy chủ trả lời một thao tác (khoá nút). */
  busy: boolean;
  /** Bạn đang chờ xác nhận xoá (bấm ✕ lần hai). */
  removeId: string | null;
  /** Đang hỏi xác nhận gỡ hết dữ liệu online. */
  confirmDelete: boolean;
  /** Đang hiện mã QR to. */
  showQr: boolean;
}

export const newFriendsView = (): FriendsView => ({ open: false, status: 'idle', me: null, friends: [], error: '', qr: '', busy: false, removeId: null, confirmDelete: false, showQr: false });

/** Biểu tượng phong cách quán (emoji cờ không hiện trên Windows nên dùng món đặc trưng). */
const FLAGS: Record<string, string> = { jp: '🍣', kr: '🍗', vn: '🍜', oc: '🐌' };

/** Bảng 🤝 Bạn bè: mã của mình + link mời / QR, công tắc cho ghé thăm, nhập mã bạn, danh sách bạn để sang thăm. */
export function friendsHtml(v: FriendsView, content: Content, enabled = onlineEnabled): string {
  if (!v.open) return '';
  const head = `<div class="dialog-head"><h2>🤝 Bạn bè</h2><button class="x-close"${uiAttr('friends:close')} aria-label="Đóng">✕</button></div>`;
  const wrap = (body: string) => `<div class="backdrop" data-key="friends"${uiAttr('friends:close')}>
    <div class="dialog friends" role="dialog" aria-label="Bạn bè"${uiAttr('noop')}>${head}${body}</div></div>`;
  if (!enabled) return wrap(`<p>Bản game này chưa nối máy chủ bạn bè.</p>`);
  if (v.status === 'loading' || (v.status === 'idle' && !v.me)) return wrap(`<p class="muted friends-wait">⏳ Đang kết nối…</p>`);
  if (v.status === 'error' && !v.me) return wrap(`<p class="friends-err">${esc(v.error)}</p><div class="dialog-foot"><button class="primary"${uiAttr('friends:retry')}>Thử lại</button></div>`);
  const me = v.me!;
  const dis = v.busy ? ' disabled' : '';
  const link = inviteLink(me.friend_code);
  const friends = v.friends.length
    ? v.friends
        .map((f) => {
          const cuisine = content.cuisines.has(f.cuisine) ? content.cuisines.get(f.cuisine).name : '';
          const confirming = v.removeId === f.id;
          return `<div class="row friend" data-key="fr-${f.id}">
            <span class="big">${FLAGS[f.cuisine] ?? '🏠'}</span>
            <div class="grow"><b>${esc(f.owner_name || 'Chủ quán')}</b><div class="muted">${esc(f.shop_name || cuisine)}${f.game_day ? ` · ngày ${f.game_day}` : ''}${f.sharing ? ` · cập nhật ${ago(f.snapshot_at)}` : ''}</div></div>
            ${f.sharing ? `<button class="mini primary"${uiAttr(`friends:visit:${f.id}`)}${dis}>🏡 Thăm</button>` : `<span class="muted closed">🔒 Chưa mở cửa</span>`}
            <button class="mini${confirming ? ' danger' : ''}"${uiAttr(`friends:remove:${f.id}`)}${dis} title="Huỷ kết bạn">${confirming ? 'Huỷ kết bạn?' : '✕'}</button>
          </div>`;
        })
        .join('')
    : `<p class="muted">Chưa có bạn nào. Gửi link mời hoặc cho bạn quét mã QR — bạn mở là hai người thành bạn của nhau.</p>`;
  return wrap(`
    ${v.error ? `<p class="friends-err">${esc(v.error)}</p>` : ''}
    <section class="friend-me">
      <div class="fm-code"><small>Mã của bạn</small><b>${esc(me.friend_code)}</b></div>
      <div class="fm-actions">
        <button${uiAttr('friends:share')}>📤 Gửi link mời</button>
        <button${uiAttr('friends:copy')}>📋 Chép link</button>
        <button${uiAttr('friends:qr')}>${v.showQr ? 'Ẩn QR' : '🔳 Mã QR'}</button>
      </div>
      ${v.showQr && v.qr ? `<div class="fm-qr">${v.qr}<small>${esc(link)}</small></div>` : ''}
    </section>
    <button class="toggle-row${me.sharing ? ' is-on' : ''}"${uiAttr('friends:sharing')} role="switch" aria-checked="${me.sharing}"${dis}>
      <span>🏡 Cho bạn bè ghé thăm quán<small>${me.sharing ? `Quán tự cập nhật mỗi khi hết ngày · lần cuối ${ago(me.snapshot_at)}` : 'Đang tắt — bạn bè thấy quán "chưa mở cửa"'}</small></span><i class="switch"><i></i></i>
    </button>
    <div class="friend-add"><input type="text" maxlength="8" placeholder="Nhập mã của bạn bè" data-friend-code autocomplete="off" autocapitalize="characters" enterkeyhint="go"><button class="primary"${uiAttr('friends:add')}${dis}>Kết bạn</button></div>
    <h3>Bạn bè (${v.friends.length})</h3>
    <div class="friend-list">${friends}</div>
    <div class="dialog-foot friends-foot">
      ${
        v.confirmDelete
          ? `<span class="muted">Xoá mã, quán đã chia sẻ và danh sách bạn trên máy chủ?</span><button${uiAttr('friends:deleteNo')}>Thôi</button><button class="danger"${uiAttr('friends:deleteYes')}${dis}>Xoá hết</button>`
          : `<button class="mini"${uiAttr('friends:refresh')}${dis}>↻ Tải lại</button><button class="mini"${uiAttr('friends:delete')}>🗑 Gỡ dữ liệu online</button>`
      }
    </div>`);
}
