// Font Mali (OFL), tự lưu trong bản build - mỗi độ đậm tách theo bảng chữ, trình duyệt chỉ tải phần cần (Latin + tiếng Việt)
import '@fontsource/mali/500.css';
import '@fontsource/mali/600.css';
import '@fontsource/mali/700.css';
import './style.css';
import { createContent, type CuisineId } from './data';
import { loadSave, startApp } from './ui/app';
import { showTitle } from './ui/title';
import { stashInvite } from './ui/online';

const root = document.getElementById('app')!;

/** Màn hình chờ (#boot trong index.html): hiện lại với dòng chữ `text`, hoặc ẩn đi (mờ dần) khi cảnh đã vẽ xong khung đầu. */
function boot(text: string | null): void {
  const el = document.getElementById('boot');
  if (!el) return;
  if (text != null) {
    el.querySelector('small')!.textContent = text;
    el.classList.remove('hide');
  } else el.classList.add('hide');
}
/** Đợi trình duyệt vẽ xong 2 khung hình (màn chờ đã hiện / cảnh đã vẽ) rồi mới chạy `fn`. */
const afterPaint = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn));
/** Vào game: hiện màn chờ trước rồi mới dựng (dựng mấy khu 3D mất một lúc, không để giao diện đứng hình). */
function enter(text: string, start: () => void): void {
  boot(text);
  afterPaint(() => {
    start();
    afterPaint(() => boot(null));
  });
}
const content = createContent();
const params = new URLSearchParams(location.search);
// Link mời kết bạn (?invite=MÃ): cất mã lại, vào game xong mới kết bạn (cần đăng nhập ẩn danh)
stashInvite(params);

// Thử nhanh: ?fresh (ván tạm, chọn quán bằng ?cuisine=jp|kr|vn) hoặc ?play (vào thẳng ván đang lưu) bỏ qua màn hình mở đầu
// Xem trước một quán ở màn chọn quán (?preview=oc): ván tạm không lưu, quán tự chạy - xem xong quay lại màn chọn
const preview = params.get('preview');
if (preview && content.cuisines.has(preview)) enter('Đang mở quán xem trước…', () => startApp(root, { content, preview: preview as CuisineId }));
else if (params.has('fresh') || params.has('play') || params.has('visit')) enter('Đang mở cửa quán…', () => startApp(root, { content })); // ?visit: thăm quán bạn bè (F1)
else {
  showTitle(root, content, {
    hasSave: loadSave(content) != null,
    onStart: (cuisine, owner, shopName) => enter('Đang mở cửa quán…', () => startApp(root, { content, cuisine: cuisine ?? undefined, owner, shopName })),
  });
  afterPaint(() => boot(null));
}
