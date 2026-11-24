// Font Mali (OFL), tự lưu trong bản build — mỗi độ đậm tách theo bảng chữ, trình duyệt chỉ tải phần cần (Latin + tiếng Việt)
import '@fontsource/mali/500.css';
import '@fontsource/mali/600.css';
import '@fontsource/mali/700.css';
import './style.css';
import { createContent, type CuisineId } from './data';
import { loadSave, startApp } from './ui/app';
import { showTitle } from './ui/title';
import { stashInvite } from './ui/online';

const root = document.getElementById('app')!;
const content = createContent();
const params = new URLSearchParams(location.search);
// Link mời kết bạn (?invite=MÃ): cất mã lại, vào game xong mới kết bạn (cần đăng nhập ẩn danh)
stashInvite(params);

// Thử nhanh: ?fresh (ván tạm, chọn quán bằng ?cuisine=jp|kr|vn) hoặc ?play (vào thẳng ván đang lưu) bỏ qua màn hình mở đầu
// Xem trước một quán ở màn chọn quán (?preview=oc): ván tạm không lưu, quán tự chạy — xem xong quay lại màn chọn
const preview = params.get('preview');
if (preview && content.cuisines.has(preview)) startApp(root, { content, preview: preview as CuisineId });
else if (params.has('fresh') || params.has('play') || params.has('visit')) startApp(root, { content }); // ?visit: thăm quán bạn bè (F1)
else {
  showTitle(root, content, {
    hasSave: loadSave(content) != null,
    onStart: (cuisine, owner, shopName) => startApp(root, { content, cuisine: cuisine ?? undefined, owner, shopName }),
  });
}
