// Font Mali (OFL), tự lưu trong bản build — mỗi độ đậm tách theo bảng chữ, trình duyệt chỉ tải phần cần (Latin + tiếng Việt)
import '@fontsource/mali/500.css';
import '@fontsource/mali/600.css';
import '@fontsource/mali/700.css';
import './style.css';
import { createContent } from './data';
import { loadSave, startApp } from './ui/app';
import { showTitle } from './ui/title';

const root = document.getElementById('app')!;
const content = createContent();
const params = new URLSearchParams(location.search);

// Thử nhanh: ?fresh (ván tạm, chọn quán bằng ?cuisine=jp|kr|vn) hoặc ?play (vào thẳng ván đang lưu) bỏ qua màn hình mở đầu
if (params.has('fresh') || params.has('play')) startApp(root, { content });
else {
  showTitle(root, content, {
    hasSave: loadSave(content) != null,
    onStart: (cuisine, owner) => startApp(root, { content, cuisine: cuisine ?? undefined, owner }),
  });
}
