import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameState } from '../sim/state';
import { ownerName } from '../sim/state';

/**
 * F3 · BẠN BÈ ONLINE (lớp A) - Supabase: đăng nhập ẩn danh (không email / mật khẩu), kết bạn bằng mã / link mời / QR,
 * tự đẩy bản chụp quán khi bật "Cho bạn bè ghé thăm", xem danh sách bạn, lấy bản chụp quán bạn để sang thăm (F1).
 * Máy chủ: supabase/schema.sql (bảng players / friendships + hàm RPC). Cấu hình: .env (VITE_SUPABASE_URL / _ANON_KEY).
 * Thư viện supabase-js chỉ tải khi người chơi dùng tới (import động) - game chơi một mình không tốn thêm gì.
 */

const URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
/** Bản này có cấu hình máy chủ chưa (chưa có thì ẩn tính năng Bạn bè). */
export const onlineEnabled = !!(URL && KEY);

/** Đã từng dùng tính năng bạn bè trên máy này: lần sau mở game tự đăng nhập lại để đẩy quán. */
const USED_KEY = 'quan-nha-vuon/online';
/** Mã mời đang chờ xử lý (mở game bằng link ?invite=). */
const INVITE_KEY = 'quan-nha-vuon/invite';

export interface Me {
  id: string;
  friend_code: string;
  sharing: boolean;
  snapshot_at: string | null;
}
export interface Friend {
  id: string;
  owner_name: string;
  shop_name: string;
  cuisine: string;
  game_day: number;
  /** Đang bật "cho ghé thăm" và đã có bản chụp. */
  sharing: boolean;
  snapshot_at: string | null;
}

let clientP: Promise<SupabaseClient> | null = null;
function client(): Promise<SupabaseClient> {
  clientP ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'quan-nha-vuon/auth' } }),
  );
  return clientP;
}

/** Lỗi đưa ra người chơi: lỗi do máy chủ tự báo (tiếng Việt) giữ nguyên, lỗi mạng đổi thành câu dễ hiểu. */
function friendly(e: unknown): Error {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/fetch|network|Failed to|timeout|load failed/i.test(msg)) return new Error('Không kết nối được máy chủ - kiểm tra mạng rồi thử lại.');
  if (/anonymous/i.test(msg) && /disabled/i.test(msg)) return new Error('Máy chủ chưa bật đăng nhập ẩn danh (xem docs/08-ONLINE-SUPABASE.md).');
  return new Error(msg);
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const c = await client();
  const { data, error } = await c.rpc(fn, args);
  if (error) throw friendly(error);
  return data as T;
}

export function usedBefore(): boolean {
  try {
    return localStorage.getItem(USED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Đăng nhập ẩn danh (lần đầu tạo tài khoản ẩn danh trên máy này) rồi lấy / tạo dòng người chơi. */
export async function signIn(): Promise<Me> {
  if (!onlineEnabled) throw new Error('Bản game này chưa bật tính năng bạn bè.');
  try {
    const c = await client();
    const { data } = await c.auth.getSession();
    if (!data.session) {
      const { error } = await c.auth.signInAnonymously();
      if (error) throw error;
    }
    const rows = await rpc<Me[]>('ensure_player');
    try {
      localStorage.setItem(USED_KEY, '1');
    } catch {
      /* bỏ qua */
    }
    return rows[0];
  } catch (e) {
    throw friendly(e);
  }
}

/** Bật / tắt "Cho bạn bè ghé thăm"; bật thì đẩy bản chụp ngay. */
export async function setSharing(me: Me, on: boolean, state: GameState): Promise<Me> {
  const c = await client();
  const patch: Record<string, unknown> = { sharing: on, ...cardOf(state) };
  if (on) patch.snapshot = state;
  const { data, error } = await c.from('players').update(patch).eq('id', me.id).select('id, friend_code, sharing, snapshot_at').single();
  if (error) throw friendly(error);
  return data as Me;
}

/** Thông tin hiện trong danh sách bạn bè của người khác. */
function cardOf(state: GameState): Record<string, unknown> {
  return { shop_name: state.profile.name.slice(0, 24), owner_name: ownerName(state.owner).slice(0, 16), cuisine: state.cuisine, game_day: state.clock.day };
}

/** Đẩy bản chụp quán mới (khi đang bật cho ghé thăm). Trả snapshot_at mới. */
export async function pushSnapshot(me: Me, state: GameState): Promise<string | null> {
  const c = await client();
  const { data, error } = await c.from('players').update({ ...cardOf(state), snapshot: state }).eq('id', me.id).select('snapshot_at').single();
  if (error) throw friendly(error);
  return (data as { snapshot_at: string | null }).snapshot_at;
}

export const addFriend = async (code: string) => (await rpc<{ id: string; owner_name: string; shop_name: string }[]>('add_friend', { code }))[0];
export const removeFriend = (id: string) => rpc<void>('remove_friend', { friend: id });
export const listFriends = () => rpc<Friend[]>('my_friends');
/** Bản chụp quán của bạn (JSON thô để nạp vào chế độ thăm quán). */
export const friendSnapshot = async (id: string) => JSON.stringify(await rpc<unknown>('friend_snapshot', { friend: id }));
/** Xoá hết dữ liệu online của mình trên máy chủ + quên tài khoản ẩn danh trên máy này. */
export async function deleteMe(): Promise<void> {
  await rpc<void>('delete_me');
  const c = await client();
  await c.auth.signOut();
  try {
    localStorage.removeItem(USED_KEY);
  } catch {
    /* bỏ qua */
  }
}

/** Link mời kết bạn: mở link là vào game và tự kết bạn với người gửi. */
export function inviteLink(code: string): string {
  return `${location.origin}${location.pathname}?invite=${encodeURIComponent(code)}`;
}

/** Mở game bằng link mời: cất mã lại (xử lý sau khi vào game) và bỏ tham số khỏi thanh địa chỉ. */
export function stashInvite(params: URLSearchParams): void {
  const code = params.get('invite');
  if (!code) return;
  try {
    sessionStorage.setItem(INVITE_KEY, code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12));
  } catch {
    /* bỏ qua */
  }
  params.delete('invite');
  const rest = params.toString();
  history.replaceState(null, '', `${location.pathname}${rest ? `?${rest}` : ''}`);
}

/** Lấy (và xoá) mã mời đang chờ. */
export function takeInvite(): string | null {
  try {
    const code = sessionStorage.getItem(INVITE_KEY);
    sessionStorage.removeItem(INVITE_KEY);
    return code || null;
  } catch {
    return null;
  }
}

/** Mã QR (SVG) cho link mời - thư viện tải khi cần. */
export async function qrSvg(text: string): Promise<string> {
  const { default: qrcode } = await import('qrcode-generator');
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

/** "vừa xong" / "5 phút trước" / "3 giờ trước" / "2 ngày trước" */
export function ago(iso: string | null): string {
  if (!iso) return 'chưa có';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'vừa xong';
  if (s < 3600) return `${Math.round(s / 60)} phút trước`;
  if (s < 86400 * 2) return `${Math.round(s / 3600)} giờ trước`;
  return `${Math.round(s / 86400)} ngày trước`;
}
