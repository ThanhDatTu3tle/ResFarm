# Roadmap — việc tiếp theo

Mỗi nhiệm vụ có mã, phạm vi, tiêu chí hoàn thành và gợi ý model. Làm xong thì đổi `[ ]` thành `[x]` và ghi ngày.

**Gợi ý chọn model:**

- **Sonnet** — việc theo công thức có sẵn trong `CLAUDE.md`: nhập dữ liệu, thêm nội dung, sửa panel, chỉnh số, thêm lệnh nhỏ trong system đã có.
- **Opus** — việc đụng tới hình dạng `GameState` (cần migration), system mới, thay đổi trong `Stage`/kiến trúc 3D, thiết kế cân bằng.

Mọi nhiệm vụ đều kết thúc bằng: `npm run typecheck` sạch, `npm test` qua, cập nhật `CLAUDE.md` nếu thêm khái niệm mới, ghi một mục vào `07-NHAT-KY.md`.

**Thứ tự ưu tiên hiện tại** nằm ở `06-KINH-NGHIEM-THIET-KE.md` mục 3 (các giai đoạn, mã F*). Giai đoạn 1 đã xong; kế tiếp là Giai đoạn 2 "Có lý do quay lại" — nhưng chủ dự án muốn **tập trung vào Quán ăn**, nông trại và chợ để sau.

## Việc mở ra sau Giai đoạn 1 (đề xuất, chưa ai quyết)

- [ ] **S1 · Bồi bàn tự động khi người chơi vắng mặt** *(Opus)* — người chơi ở Nông trại/Chợ thì quán không ai phục vụ. Có thể là trang thiết bị/nhân viên thuê ở Siêu thị; dùng lại `autoServeCommands` trong `service.ts`, chạy chậm hơn người chơi. Hỏi chủ dự án trước.
- [ ] **S2 · Bưng 2 món một lượt** *(Opus)* — `waiter.carrying` thành mảng, mở bằng nâng cấp (khay).
- [ ] **S3 · Bồi bàn đi vòng qua bàn ghế** *(Opus)* — vài điểm hành lang trong `layout.ts`, tìm đường đơn giản.
- [ ] **S4 · Dọn bàn / thu tiền tay** *(Sonnet/Opus)* — thêm việc nhỏ cho người chơi nếu muốn quán bận rộn hơn (khách ăn xong để lại đĩa bẩn, bấm để dọn).
- [ ] **S5 · Cân bằng lại theo khâu phục vụ** *(Opus)* — tốc độ khách tới, `foodPatience`, giá món khi người chơi phải tự phục vụ; dùng `autoServeCommands` làm người chơi mẫu (gộp vào B1).

---

## A. Việc đang chờ chủ dự án

- [ ] **A1 · Nhập danh sách thời gian** *(Sonnet)* — khi chủ dự án đưa bảng. Mẫu bảng ở `01-TAM-NHIN-GAME.md`. Sửa `cookTime`, `growTime`, `regrowTime`, các mốc trong `balance.ts`. Không đổi `minutesPerSecond`. Xong khi: mọi con số khớp bảng (× 0.7), test qua (sửa test nào phụ thuộc con số cũ).
- [ ] **A2 · Nhập thực đơn** *(Sonnet)* — khi chủ dự án đưa danh sách món. Thêm nguyên liệu mới vào `items.ts` và cho nó nguồn. Giữ nguyên `id` của 12 món đang có nếu vẫn còn dùng. Xong khi: game khởi động không báo lỗi dữ liệu, mọi món nấu được.
- [ ] **A3 · Test tay trên thiết bị thật** *(chủ dự án)* — xoay/zoom camera, kéo bàn, bấm ô đất, bấm sạp, toàn màn hình, lớp phủ xoay ngang, tốc độ khung hình ở chợ và nông trại lúc mưa. Ghi lại máy + trình duyệt + chỗ giật.

## B. Hoàn thiện những gì đã có

- [ ] **B1 · Cân bằng kinh tế** *(Opus)* — viết một script mô phỏng (chạy trong Node, dùng `Game` trực tiếp) cho "người chơi mẫu" chơi 10 ngày theo vài chiến lược (chỉ mua chợ / chỉ tự trồng / kết hợp), in ra tiền, cấp, uy tín mỗi ngày. Dùng nó để chỉnh giá và thời gian sao cho: ngày 1 không lỗ nếu chơi hợp lý, tự trồng lợi hơn mua nhưng không bỏ được chợ, mở món mới mỗi 1–2 ngày. Xong khi: có script `npm run balance` và một bảng kết quả trong `docs/`.
- [ ] **B2 · Xoay bàn 90°** *(Opus)* — thêm góc xoay vào `state.restaurant.layout` (cần migration), `seatSpots`/`footprint` tính theo góc, nút xoay khi đang kéo. Xong khi: test đặt bàn xoay không chồng nhau.
- [ ] **B3 · Hoa văn sàn theo loại** *(Sonnet)* — `DecorDef` thêm trường `pattern: 'planks' | 'checker' | 'plain'`; `buildRoom` dựng theo pattern. Sàn gạch hiện vẫn là sọc.
- [x] **B4 · Tưới và cuốc có hiệu ứng** *(18/11/2026: hạt 💧 💨 🌱 ✨ trong `FarmArea.react()`, khói bếp, tim khi khách trả tiền)* *(Sonnet)* — nghe lệnh thành công ở `app.ts`, phát hiệu ứng ngắn tại ô (giọt nước rơi, bụi đất). Cần `FarmArea` có hàm `playEffect(slotId, kind)`.
- [ ] **B5 · Gợi ý cho người mới** *(Sonnet)* — vài bước hướng dẫn đầu game (cuốc → gieo → tưới → ra chợ → bật món). Lưu bước đã qua trong state (cần migration nhỏ) hoặc `localStorage` riêng.
- [ ] **B6 · Thông báo khi sắp hết nguyên liệu** *(Sonnet)* — cảnh báo trên HUD khi một món đang bán chỉ còn nấu được < 3 phần.
- [ ] **B7 · Mua thêm bàn ở Siêu thị** *(Opus)* — hiện bàn thứ 5 gắn với một nâng cấp. Tổng quát hoá: danh mục bàn mua được, bàn mua về xuất hiện ở chỗ trống hợp lệ đầu tiên.

## C. Tính năng mới (theo thứ tự đề xuất)

- [x] **C1 · Bồi bàn / khâu phục vụ** *(18/11/2026: người chơi đóng vai bồi bàn — mang menu, ghi món, lấy món ở quầy ra món giao đúng bàn; tâm trạng 4 bậc quyết định tip; save v5)* *(Opus)* — `Order` thêm trạng thái `ready` giữa `cooking` và `served`; system `service` cho bồi bàn mang món (tốn thời gian theo khoảng cách hoặc cố định). Tuỳ câu trả lời của chủ dự án: tự động hay người chơi bấm. Hình: nhân vật bồi bàn đi giữa bếp và bàn.
- [ ] **C2 · Thuê và nâng cấp nhân viên** *(Opus)* — `state.restaurant.staff` thành danh sách động; lệnh thuê/sa thải/đào tạo; lương trừ cuối ngày; nhân viên là một nguồn `modifier`. Bếp to hơn theo số đầu bếp.
- [ ] **C3 · Nâng hạng quán** *(Opus)* — đưa kích thước phòng vào state; các mốc quán → tiệm → nhà hàng mở rộng phòng, bếp, số bàn tối đa. `RestaurantArea` dựng lại tường khi phòng đổi cỡ.
- [ ] **C4 · Thức ăn chăn nuôi và chế biến** *(Opus)* — `ProducerDef.inputs` (vật nuôi cần cám/cỏ mỗi chu kỳ); loại ô mới "xưởng" biến nguyên liệu thành nguyên liệu (lúa → bột, sữa → phô mai). Mô hình giống producer nên tái dùng `farm.ts`.
- [ ] **C5 · Mở rộng ao cá** *(Sonnet)* — thêm loài (cá chép, cá hồi, mực nuôi...), thêm bậc ao, cho ăn. Hiện ao có 3 bậc và 2 loài.
- [ ] **C6 · Thời tiết sâu hơn** *(Opus)* — bão làm hỏng cây chưa thu, nắng gắt làm đất khô nhanh, mùa trong năm, món theo mùa. Thêm trường vào `WeatherDef` thay vì viết `if` theo id.
- [ ] **C7 · Bán nông sản dư và đơn hàng** *(Opus)* — bán lại cho chợ giá thấp; bảng đơn đặt hàng mỗi ngày (giao đủ N món nhận thưởng).
- [ ] **C8 · Sự kiện ngẫu nhiên** *(Opus)* — khách VIP, thanh tra vệ sinh, ngày lễ đông khách. Dạng `EventDef` trong data + system `events`.
- [ ] **C9 · Tiến trình khi offline** *(Opus)* — lưu mốc thời gian thực lúc thoát; lúc vào tua bù có giới hạn (vd tối đa 1 ngày game, chỉ nông trại). Cần quyết định thiết kế trước (xem câu hỏi mở).
- [x] **C10 · Âm thanh** *(18/11/2026: tổng hợp bằng Web Audio trong `src/ui/audio.ts`, không cần file; bật/tắt trong Cài đặt)* — nhạc nền + hiệu ứng theo `game.bus`.

## D. Đồ hoạ (chi tiết ở `03-DO-HOA-3D.md`)

- [ ] **D1 · Tách bàn ghế, sạp, ô đất thành hàm nhà máy trong `models.ts`** *(Sonnet)* — không đổi hình, chỉ chuyển chỗ. Bước chuẩn bị cho mọi việc nâng cấp model.
- [x] **D2 · Nhân vật cử động** *(18/11/2026)* *(Opus)* — tay chân tách rời, dáng đi, dáng ngồi, đầu bếp nấu.
- [x] **D3 · Model món ăn** *(18/11/2026, đủ 12 món)* *(Sonnet)* — `makeDish(recipeId)` với dự phòng emoji.
- [x] **D4 · Cây nhiều giai đoạn lớn** *(18/11/2026)* *(Sonnet)*.
- [ ] **D5 · Gộp mesh tĩnh** *(Opus)* — chép `mergeStatic` từ `co-thu-3d`, đo draw call trước/sau.
- [ ] **D6 · Đường ống glTF** *(Opus)* — `assets.ts` (tải trước, nhân bản, chuyển sang vật liệu toon), màn hình chờ tải, thứ tự dự phòng file → code → emoji. Thử với 1 model.
- [~] **D7 · Nét viền + hiệu ứng hạt** *(Opus)* — hạt đã có; nét viền đã thử và **gỡ theo ý chủ dự án** (xem `03-DO-HOA-3D.md`).

## E. Kỹ thuật và phát hành

- [ ] **E1 · CI** *(Sonnet)* — GitHub Actions chạy typecheck + test mỗi lần push.
- [ ] **E2 · Xuất/nhập save** *(Sonnet)* — nút tải file save về và nạp lại, để chuyển máy hoặc gửi cho bạn. Không cần server.
- [ ] **E3 · Chia nhỏ gói JS** *(Sonnet)* — tách Three.js thành chunk riêng để cache tốt hơn.
- [ ] **E4 · Biểu tượng app + ảnh chờ** *(Sonnet)* — thêm icon vào `manifest.webmanifest` để "Thêm vào màn hình chính" có hình.
- [ ] **E5 · Đa ngôn ngữ** *(Opus, chỉ khi cần)* — tách chữ khỏi data và panel.
- [ ] **E6 · Chơi cùng bạn bè** *(Opus, quyết định lớn)* — xem `05-TRIEN-KHAI-CHI-PHI.md` mục "Những thứ sẽ tốn phí". Cần chủ dự án quyết định hình thức trước.

## Nhật ký

- **17/11/2026** — Dựng base (Fable 5.2): lõi sim, 3 khu 3D, thời tiết, ngày/đêm, siêu thị nội thất, dời bàn, camera xoay/zoom, giao diện ngang, cuốc đất + tưới + ao cá nâng cấp. 18 test.
- **18/11/2026** — Giai đoạn 1 (Opus 5.5): juice, nhân vật cử động, món 3D, cây 3 giai đoạn, âm thanh, HUD + lịch + Cài đặt, font Mali, người chơi làm bồi bàn (save v5). 25 test. Chi tiết: `07-NHAT-KY.md`.
