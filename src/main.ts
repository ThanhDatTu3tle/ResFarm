// Font Mali (OFL), tự lưu trong bản build — mỗi độ đậm tách theo bảng chữ, trình duyệt chỉ tải phần cần (Latin + tiếng Việt)
import '@fontsource/mali/500.css';
import '@fontsource/mali/600.css';
import '@fontsource/mali/700.css';
import './style.css';
import { startApp } from './ui/app';

startApp(document.getElementById('app')!);
