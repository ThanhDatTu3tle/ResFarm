# Quán Nhà Vườn — tài liệu nội bộ (đọc file này trước)

Bộ ghi chú này dành cho người hoặc AI (Opus, Sonnet) tiếp tục phát triển game. Nằm trong repo ở thư mục `docs/` để làm việc được trên nhiều máy (chỉ cần `git pull`).

> **Repo đang công khai.** Không ghi vào `docs/` (hay bất kỳ file nào trong repo) thông tin cá nhân: tên thật, email, đường dẫn máy riêng, chuyện gia đình, khoá API. Ghi chú riêng tư để trong `notes/` (đã nằm trong `.gitignore`).

Viết 17/11/2026, cập nhật 18/11/2026 sau phiên làm Giai đoạn 1 (xem `07-NHAT-KY.md`).

## Các file

| File | Nội dung | Đọc khi |
| --- | --- | --- |
| `../CLAUDE.md` | Bản đồ kiến trúc ngắn + công thức cho việc thường gặp. Claude Code tự nạp. | Mọi phiên làm việc |
| `00-DOC-TRUOC.md` | File này: tình trạng hiện tại, cài đặt trên máy mới, luật làm việc, mẫu lời nhắc | Bắt đầu |
| `01-TAM-NHIN-GAME.md` | Yêu cầu gốc của chủ dự án, các quyết định thiết kế, nội dung đang có | Trước khi thêm/sửa gameplay |
| `02-KIEN-TRUC-CHI-TIET.md` | Kiến trúc sâu: state, lệnh, sự kiện, modifier, save/migration, test, các bẫy đã gặp | Trước khi thêm system hoặc đổi state |
| `03-DO-HOA-3D.md` | Quy ước dựng hình, ngân sách hiệu năng, lộ trình nâng cấp model | Trước khi đụng vào `src/ui/three` |
| `04-ROADMAP.md` | Việc tiếp theo, chia sẵn thành nhiệm vụ có tiêu chí hoàn thành | Khi chọn việc để làm |
| `05-TRIEN-KHAI-CHI-PHI.md` | Deploy, chi phí, những thứ sẽ phát sinh phí về sau | Khi deploy hoặc cân nhắc tính năng online |
| `06-KINH-NGHIEM-THIET-KE.md` | Nguyên tắc thiết kế cozy game, roadmap xếp theo giai đoạn (mã F*), cách dùng các skill Three.js | Khi chọn tính năng hoặc làm đồ hoạ |
| `07-NHAT-KY.md` | Nhật ký từng phiên làm việc: đã làm gì, quyết định gì, còn dở gì | Đầu mỗi phiên, để nối tiếp |

## Tình trạng hiện tại (18/11/2026)

- **Repo:** https://github.com/ThanhDatTu3tle/ResFarm (công khai). Nhánh `main` = bản đang chạy online (Netlify tự deploy khi `main` đổi). Giai đoạn 1 nằm ở nhánh `giai-doan-1`, gộp vào `main` qua Pull Request.
- **Kiểm tra tự động:** `npm run typecheck` sạch, `npm test` 25 test qua, `npm run build` qua.
- **Phiên bản save:** `SAVE_VERSION = 8` (v7 phong cách quán — chơi lại từ đầu, save v1–v6 bị bỏ qua; v8 thêm cối chế biến, có migration v7→v8). Xem `src/sim/save.ts`.
- **Chưa kiểm chứng trên thiết bị thật:** âm thanh (chỉ kiểm được code chạy không lỗi), thao tác chạm trên điện thoại, tốc độ khung hình trên máy yếu.

## Game hiện có gì

1. Ba khu 3D: **Nông trại ‹ Quán ăn › Chợ**, chuyển bằng nút hai bên mép (nút sang Quán hiện số việc đang chờ).
2. **Quán — người chơi là bồi bàn:** khách ngồi thì hiện bong bóng 📖 → bấm để mang menu → khách xem 3–7 giây → hiện 😊 → bấm để ghi món → bếp nấu xong đặt ở **quầy ra món** → bấm quầy, chọn món, bấm bàn đã gọi → bồi bàn bưng tới. Khách có 4 bậc tâm trạng 😄 🙂 😒 😠 (tụt mỗi 10 giây khi món nằm ở quầy chưa bưng), quyết định tip.
3. **Thực đơn:** 12 món (có model 3D), 3 món có sẵn, còn lại mở theo cấp + tiền.
4. **Nguyên liệu:** 5 loại vô hạn + 15 loại phải mua hoặc tự làm ra.
5. **Chợ:** 3 sạp, giá đổi mỗi ngày.
6. **Nông trại:** 9 ô ruộng (cuốc → gieo → tưới → thu; cây lớn 3 giai đoạn), 2 chuồng, 1 ao cá nới rộng 3 bậc.
7. **Siêu thị:** đổi sàn, tường, bàn ghế; mua trang thiết bị; sắp xếp bàn.
8. **Thời gian:** một ngày mở cửa = 20 phút thực; ngày/đêm; thời tiết; **lịch** (thứ, ngày, mùa, năm — mỗi mùa 28 ngày).
9. **Cảm giác:** hiệu ứng nảy, hạt, xu/nông sản bay về HUD, nhân vật chibi cử động (đi, ngồi, ăn, nấu, vẫy), âm thanh + nhạc nền tổng hợp bằng code.
10. **HUD:** huy hiệu cấp, tiền, uy tín, đồng hồ ngày đêm + lịch + thời tiết; nút ⚙️ mở Cài đặt (tốc độ, âm thanh, toàn màn hình, hướng dẫn nhanh). Font Mali.
11. **Lưu:** tự lưu vào `localStorage` (mỗi máy một bản lưu riêng).

## Cài đặt trên máy mới (vd laptop)

```bash
git clone https://github.com/ThanhDatTu3tle/ResFarm.git
```

```bash
cd ResFarm && npm install
```

```bash
npm run dev
```

Mở `http://localhost:5184`. Nếu đang làm ở nhánh chưa gộp thì `git switch giai-doan-1` trước.

**Skill cho Claude Code** không nằm trong repo (nặng ~82 MB, là gói của bên thứ ba). Cài lại trên máy mới:

```bash
npx threejs-awesome-graphics-agent-skills@latest install --agent claude-code --scope project
```

```bash
git clone --depth 1 https://github.com/majidmanzarpour/threejs-game-skills.git ../threejs-game-skills && cp -r ../threejs-game-skills/skills/* .claude/skills/
```

```bash
npx impeccable@latest install --providers=claude --scope=global
```

Lệnh thứ ba cài skill `impeccable` cho mọi dự án và **thêm hook vào `~/.claude/settings.json`** (tự soát giao diện sau khi sửa file UI). Ba skill tạo asset (`threejs-3d-generator`, `threejs-image-generator`, `threejs-audio-generator`) cần API key trả phí; không có key thì bỏ qua.

**Lỗi "dubious ownership" của git** (thư mục thuộc nhóm Administrators trên Windows): chạy lệnh git kèm `-c safe.directory=<đường dẫn>` cho từng lệnh, hoặc tự thêm ngoại lệ vào cấu hình git của máy.

## Luật làm việc cho AI phát triển tiếp

Những luật này giữ cho nền tảng không bị vỡ. Vi phạm một trong số chúng thường không gây lỗi ngay nhưng làm dự án khó sửa dần.

1. **Phụ thuộc một chiều `ui → sim → data → core`.** Không bao giờ import ngược. `src/sim` không được dùng `document`, `window`, `three`, `Math.random()`, `Date.now()`.
2. **Nội dung là dữ liệu.** Thêm món, nguyên liệu, cây, con, sạp, bàn, nội thất, thời tiết = thêm một mục trong `src/data/`. Nếu thấy mình viết `if (id === 'tomato')` trong `sim` hay `ui` thì đang sai hướng — thêm một trường vào định nghĩa (Def) rồi đọc trường đó.
3. **State là JSON thuần và chỉ đổi qua Command hoặc system.** UI không sửa `game.state` trực tiếp (ngoại lệ duy nhất: các tham số debug trong `app.ts`, chỉ chạy ở bản dev).
4. **Đổi cấu trúc `GameState` thì phải:** tăng `SAVE_VERSION`, viết migration, cập nhật `reconcile()` nếu cần, thêm test tải save cũ. Người chơi đang có save thật.
5. **Không đổi `id` đã phát hành** (id món, nguyên liệu, ô, bàn...). Save cũ tham chiếu bằng id.
6. **Logic gameplay phải có test** trong `test/sim.test.ts`. Chạy `npm run typecheck` và `npm test` sau mỗi thay đổi.
7. **Mọi thời lượng là phút game.** Không nhân chia với giây thực ở đâu khác ngoài `balance.minutesPerSecond`.
8. **Hình ảnh đi sau dữ liệu.** Thứ gì chưa có model riêng phải vẫn hiện được bằng emoji (`emojiSprite`).
9. **Chữ hiển thị và chú thích bằng tiếng Việt, định danh bằng tiếng Anh.**
10. **Cập nhật `CLAUDE.md`** khi thêm khái niệm mới (system, loại nội dung, tham số URL). Cập nhật `docs/` khi đổi quyết định thiết kế; ghi một mục vào `07-NHAT-KY.md` cuối mỗi phiên.
11. **Không commit thẳng vào `main`** (đó là bản online). Làm ở nhánh riêng, gộp qua Pull Request.
12. **Repo công khai:** không đưa thông tin cá nhân vào repo (xem khung cảnh báo đầu file).

## Cách kiểm tra nhanh mà không cần bấm tay

Bản dev có tham số URL dựng sẵn trạng thái (chi tiết trong `CLAUDE.md`):

```
http://localhost:5184/?fresh&seed=5&ff=250                       quán đang đông khách (nhớ: phải tự phục vụ)
http://localhost:5184/?fresh&seed=5&ff=720&weather=rain&area=market   chợ đêm mưa
http://localhost:5184/?fresh&rich&tab=shop&edit                  siêu thị + chế độ sắp xếp bàn
http://localhost:5184/?fresh&rich&area=farm&tab=farm&do=[...]    chạy sẵn chuỗi lệnh (JSON mã hoá URL)
```

`?do=` nhận một mảng Command. Tạo URL bằng Node cho khỏi mã hoá tay:

```bash
node -e "const c=[{type:'farm/till',slotId:'field-0'},{type:'farm/plant',slotId:'field-0',producerId:'cabbage'}];console.log('http://localhost:5184/?fresh&rich&area=farm&do='+encodeURIComponent(JSON.stringify(c)))"
```

Ở bản dev có `window.game` (sim) và `window.stage` (cảnh 3D). Khi preview bị ẩn/bóp khung hình, gọi `game.tick(phút)` rồi `stage.render(1/30, 1)` để tự chạy; lấy ảnh canvas bằng `document.getElementById('scene').toDataURL()` ngay sau `render` (xem mục bẫy trong `02-KIEN-TRUC-CHI-TIET.md`).

## Mẫu lời nhắc để giao việc

Dán nguyên văn, thay phần trong ngoặc vuông.

**Bắt đầu phiên mới:**

> Đọc `CLAUDE.md`, `docs/00-DOC-TRUOC.md` và mục cuối của `docs/07-NHAT-KY.md` để nắm tình trạng. Hôm nay làm [việc].

**Thêm nội dung (hợp với Sonnet):**

> Đọc `CLAUDE.md` và `docs/01-TAM-NHIN-GAME.md`. Thêm [các món / cây trồng / nguyên liệu] theo danh sách dưới đây vào `src/data/`. Chỉ sửa file data, không sửa code. Sau đó chạy `npm run typecheck` và `npm test`, báo lại kết quả. Danh sách: [...]

**Thêm tính năng mới (hợp với Opus):**

> Đọc `CLAUDE.md`, `docs/00-DOC-TRUOC.md` và `docs/02-KIEN-TRUC-CHI-TIET.md`. Làm nhiệm vụ [mã nhiệm vụ] trong `docs/04-ROADMAP.md` hoặc `docs/06-KINH-NGHIEM-THIET-KE.md`. Tuân thủ các luật trong `00-DOC-TRUOC.md`. Trước khi viết code, nói ngắn gọn sẽ thêm gì vào `GameState`, lệnh nào, system nào. Viết test cho phần sim. Xong thì cập nhật `CLAUDE.md`, roadmap và `07-NHAT-KY.md`.

**Sửa lỗi:**

> Lỗi: [mô tả + cách tái hiện]. Trước khi sửa, viết một test trong `test/sim.test.ts` tái hiện lỗi (nếu lỗi nằm ở sim) hoặc đưa URL `?fresh&...` tái hiện (nếu lỗi nằm ở UI). Sửa tận gốc, không vá triệu chứng.
