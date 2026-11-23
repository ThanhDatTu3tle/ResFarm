import type { Content } from '../data';
import { seasons } from '../data/calendar';
import { calendarOf } from '../sim/calendar';
import { exportSave, readSaveFile, type SaveFileResult } from '../sim/save';
import { ownerName, type GameState } from '../sim/state';
import { esc } from './dom';

/**
 * E2 · XUẤT / NHẬP FILE SAVE — dùng chung cho bảng Cài đặt trong game và màn mở đầu.
 * File save = JSON (exportSave): chuyển ván sang máy khác, giữ phòng trình duyệt xoá dữ liệu,
 * sau này gửi bạn bè để thăm quán (F1).
 */

/** Khoá save trong localStorage (dùng chung cho game và màn mở đầu). */
export const SAVE_KEY = 'quan-nha-vuon/save';

/** Ghi chuỗi save thô vào bộ nhớ trình duyệt. Trả false nếu trình duyệt chặn lưu trữ. */
export function storeSave(raw: string): boolean {
  try {
    localStorage.setItem(SAVE_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

/** Tên file: quan-nha-vuon_<tên quán không dấu>_nam1-ngay3.json */
export function saveFileName(state: GameState): string {
  const cal = calendarOf(state.clock.day);
  const slug =
    state.profile.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'quan';
  return `quan-nha-vuon_${slug}_nam${cal.year}-ngay${state.clock.day}.json`;
}

/**
 * Tải file save về máy. Điện thoại (màn cảm ứng) có hộp chia sẻ file thì mở hộp chia sẻ (lưu vào Tệp / gửi Zalo…),
 * còn lại tải file như bình thường. Trả về false nếu người chơi huỷ hộp chia sẻ.
 */
export async function downloadSave(state: GameState): Promise<boolean> {
  const name = saveFileName(state);
  const text = exportSave(state);
  const blob = new Blob([text], { type: 'application/json' });
  const touch = matchMedia('(pointer: coarse)').matches;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (touch && nav.share && nav.canShare) {
    const file = new File([blob], name, { type: 'application/json' });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: name });
        return true;
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return false; // người chơi đóng hộp chia sẻ
        // trình duyệt không cho chia sẻ: tải file như thường
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** Mở hộp chọn file rồi đọc file save. Trả null nếu người chơi không chọn file nào. */
export function pickSaveFile(content: Content): Promise<SaveFileResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    // Không lọc chặt theo đuôi: điện thoại hay đổi tên file tải về (.json.txt, không đuôi…)
    input.accept = '.json,application/json,text/plain,*/*';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve(null);
      if (file.size > 5_000_000) return resolve({ ok: false, reason: 'File quá lớn, không phải file save của game.' });
      file.text().then(
        (text) => resolve(readSaveFile(text, content)),
        () => resolve({ ok: false, reason: 'Không đọc được file này.' }),
      );
    });
    input.addEventListener('cancel', () => {
      input.remove();
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
  });
}

/** Dòng tóm tắt một ván: tên quán, phong cách, chủ quán, ngày / mùa / năm, cấp, tiền. */
export function saveSummaryHtml(state: GameState, content: Content): string {
  const cal = calendarOf(state.clock.day);
  const cuisine = content.cuisines.has(state.cuisine) ? content.cuisines.get(state.cuisine).name : state.cuisine;
  return `<div class="save-sum">
    <b>${esc(state.profile.name)}</b>
    <span class="muted">${esc(cuisine)} · ${esc(ownerName(state.owner))}</span>
    <span>📅 Ngày ${state.clock.day} · ${esc(seasons[cal.season]?.name ?? '')} năm ${cal.year} · ⭐ Cấp ${state.level} · 💰 ${Math.floor(state.money).toLocaleString('vi-VN')}</span>
  </div>`;
}
