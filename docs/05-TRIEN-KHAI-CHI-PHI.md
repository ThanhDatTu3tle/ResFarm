# Triển khai và chi phí

## Game hiện có tốn phí không?

**Không.** Với cách dùng "giải trí, vài người bạn vào chơi", chi phí là 0 đồng, vì:

- Game là **trang web tĩnh**: chỉ gồm file HTML, CSS, JavaScript. Không có server riêng, không có cơ sở dữ liệu, không gọi dịch vụ trả tiền nào.
- Toàn bộ game chạy trên máy người chơi. Bản lưu nằm trong `localStorage` của trình duyệt người đó.
- Thư viện dùng đều miễn phí, mã nguồn mở: Three.js, Vite, TypeScript, Vitest (giấy phép MIT / Apache-2.0).
- Hình ảnh dựng bằng code và emoji của hệ điều hành, không mua tài nguyên nào. Âm thanh tổng hợp bằng Web Audio, không có file.
- Font Mali (giấy phép SIL OFL, dùng tự do) đóng gói qua `@fontsource/mali` và nằm luôn trong bản build — không gọi Google Fonts lúc chạy.
- GitHub miễn phí cho repo. Các dịch vụ chứa web tĩnh (Netlify, GitHub Pages, Cloudflare Pages, Vercel) đều có gói miễn phí.

**Giới hạn của gói miễn phí** là lượng truy cập và số lần build mỗi tháng. Mỗi lượt vào game tải khoảng 200 KB (đã nén), nên vài người bạn chơi hằng ngày cách rất xa mọi giới hạn. Thứ dễ chạm hơn là số lần build nếu push liên tục — mỗi lần push là một lần build khoảng nửa phút.

Con số và chính sách gói miễn phí của từng dịch vụ thay đổi theo thời gian — xem trang giá của dịch vụ đang dùng. Nếu một dịch vụ đổi chính sách, chuyển sang dịch vụ khác chỉ mất vài phút vì game không phụ thuộc gì vào nơi chứa.

**Điều cần biết khi cho bạn bè chơi:**

- Mỗi người, mỗi trình duyệt có **bản lưu riêng**. Đổi máy, đổi trình duyệt, xoá dữ liệu duyệt web hoặc dùng chế độ ẩn danh là mất tiến trình. (Nhiệm vụ E2 trong roadmap — xuất/nhập save — giải quyết việc này mà không tốn phí.)
- Mọi người chơi **độc lập**, không thấy quán của nhau.
- Ai có đường link đều vào được.

## Deploy

Yêu cầu: Node 20.19+ hoặc 22.

| Mục | Giá trị |
| --- | --- |
| Lệnh build | `npm run build` |
| Thư mục phát hành | `dist` |
| Phiên bản Node | 22 |

- **Netlify:** `netlify.toml` trong repo đã khai sẵn ba giá trị trên. Nối repo GitHub là tự build mỗi lần push lên `main` — vì vậy **làm ở nhánh riêng, gộp vào `main` qua Pull Request** khi muốn đưa lên bản online. Đổi cấu trúc save thì người chơi được nâng cấp save tự động lúc tải (migration).
- **GitHub Pages / nơi khác:** `vite.config.ts` đặt `base: './'` nên bản build chạy được ở cả đường dẫn con.
- Bản deploy **không có** các tham số debug `?rich`, `?edit`, `?weather=`, `?do=` (chỉ chạy ở bản dev). `?fresh`, `?seed=`, `?ff=`, `?area=`, `?tab=`, `?speed=` vẫn dùng được.

Chạy thử bản build ở máy trước khi deploy:

```bash
npm run build
```

```bash
npm run preview -- --host
```

Thử trên điện thoại trong cùng Wi-Fi với bản dev:

```bash
npm run dev:lan
```

## Những thứ sẽ tốn phí (nếu sau này làm)

Không thứ nào bắt buộc. Liệt kê để biết trước khi quyết định.

| Muốn | Cần gì | Chi phí ước lượng |
| --- | --- | --- |
| Tên miền riêng (vd `quannhavuon.com`) | Mua tên miền | Khoảng 10–15 USD/năm |
| Lưu tiến trình trên mây, đăng nhập, chơi nhiều máy | Dịch vụ backend (Supabase, Firebase, Cloudflare D1/KV...) | Gói miễn phí đủ cho vài chục người; trả tiền khi đông |
| Ghé thăm quán bạn, trao đổi nông sản, bảng xếp hạng | Backend như trên + viết thêm phần đồng bộ | Như trên; công phát triển là chi phí chính |
| Chơi cùng lúc theo thời gian thực | Server realtime hoặc kết nối ngang hàng | Ngang hàng (WebRTC, như `co-thu-3d` dùng PeerJS) có thể miễn phí; server riêng thì trả theo tháng |
| Model, nhạc, âm thanh chất lượng cao | Mua gói tài nguyên hoặc thuê hoạ sĩ | Từ 0 (kho CC0) tới tuỳ ý |
| Đưa lên App Store / Google Play | Tài khoản nhà phát triển + đóng gói (Capacitor) | Apple 99 USD/năm, Google 25 USD một lần |
| Đưa lên Steam | Phí đăng ký sản phẩm + đóng gói (Tauri/Electron) | 100 USD một lần cho mỗi game |

**Về kỹ thuật**, kiến trúc hiện tại đã sẵn cho phần online ở mức sau:

- State là JSON thuần → gửi lên server hay lưu vào cơ sở dữ liệu không cần chuyển đổi.
- Mọi thay đổi đi qua Command → server có thể nhận lệnh và chạy lại để kiểm tra.
- Sim tất định và không phụ thuộc trình duyệt → chạy được trên server Node nguyên bản.

Phần chưa có: tài khoản, API, xử lý xung đột khi hai máy cùng sửa một bản lưu. Đây là việc lớn (nhiệm vụ E6), nên quyết định hình thức chơi chung trước khi làm.

## Dùng AI để phát triển tiếp có tốn phí không?

Có, nhưng tách biệt với chi phí vận hành game: đó là phí thuê bao hoặc phí theo lượng dùng của Claude. Cách tiết kiệm: giao việc theo công thức cho Sonnet, việc kiến trúc cho Opus (xem `04-ROADMAP.md`), và luôn bắt đầu phiên bằng việc cho AI đọc `CLAUDE.md` + file `docs/` liên quan thay vì để nó tự dò lại cả dự án.
