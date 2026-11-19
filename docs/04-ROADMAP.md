# Roadmap — việc tiếp theo

Mỗi nhiệm vụ có mã, phạm vi, tiêu chí hoàn thành và gợi ý model. Làm xong thì đổi `[ ]` thành `[x]` và ghi ngày.

**Gợi ý chọn model:**

- **Sonnet** — việc theo công thức có sẵn trong `CLAUDE.md`: nhập dữ liệu, thêm nội dung, sửa panel, chỉnh số, thêm lệnh nhỏ trong system đã có.
- **Opus** — việc đụng tới hình dạng `GameState` (cần migration), system mới, thay đổi trong `Stage`/kiến trúc 3D, thiết kế cân bằng.

Mọi nhiệm vụ đều kết thúc bằng: `npm run typecheck` sạch, `npm test` qua, cập nhật `CLAUDE.md` nếu thêm khái niệm mới, ghi một mục vào `07-NHAT-KY.md`.

**Thứ tự ưu tiên hiện tại** nằm ở `06-KINH-NGHIEM-THIET-KE.md` mục 3 (các giai đoạn, mã F*). Giai đoạn 1 đã xong; kế tiếp là Giai đoạn 2 "Có lý do quay lại" — nhưng chủ dự án muốn **tập trung vào Quán ăn**, nông trại và chợ để sau.

## Giai đoạn 2 — thứ tự đã chốt (18/11/2026)

- [x] **G1 · Sông + suối dẫn vào ao** *(xong 18/11/2026)* — chỉ cảnh 3D nông trại: sông chạy dọc mép bản đồ, suối uốn từ sông tới ao, cầu nhỏ chỗ suối cắt lối đi của bác nông dân. Nước động (UV trôi) dùng chung vật liệu với ao.
- [x] **G2 · Màn hình mở đầu + chọn phong cách quán** *(xong 18/11/2026: `state.cuisine`, save v7 chơi lại từ đầu theo chủ dự án — không migration)*; menu Play/New game; màn chọn 3 quán ngoại thất xoay chậm; `CuisineDef` trong data (tên, màu, mặt tiền, danh sách món).
- [x] **G3 · Nội thất theo nước** *(xong 18/11/2026, `src/ui/three/cuisine.ts`)* — Nhật: sàn gỗ + chiếu tatami, rèm noren, đèn lồng giấy, quầy sushi; Hàn: bàn nướng có ống hút, ghế đẩu inox, đèn neon, poster; Việt: bàn nhựa / gỗ, ghế đẩu đỏ, quạt trần, đèn lồng Hội An, tranh tre. Dùng hệ `DecorDef` sẵn có.
- [x] **G4 · Thực đơn 3 nước** *(xong 18/11/2026: 16 món Việt, 13 Nhật, 13 Hàn, đủ model 3D; chủ dự án vẫn có thể sửa danh sách)* — món + model 3D món mới; nguyên liệu dùng chung một nông trại/chợ.
- [x] **F2 · Khách quen (đợt 13)** *(xong 19/11/2026)* — 8 khách quen (`src/data/regulars.ts`), món ruột theo từng quán, tim theo số lần ghé, quà tặng là đồ trang trí riêng; nhận ra bằng phụ kiện riêng, vòng sáng hồng, bảng tên → ⭐, thông báo có chân dung, bong bóng 💖, bảng Khách quen. Thiết kế gốc bên dưới.
- [~] *(thiết kế gốc)* **F2 · Khách quen** *(Opus)* — làm sau G2 để món ruột khớp thực đơn từng nước (món ruột theo **nhóm**: đồ ngọt, mì nước, đồ chiên... nên dùng được cho cả 3 quán).
  - **Ngoại hình:** `Look` mở rộng thành dáng người (trẻ em / thiếu niên / người lớn / người già hơi khom), kiểu tóc (ngắn, dài, đuôi ngựa, hai bím, búi, hói), áo + quần/váy, màu da, phụ kiện (mũ, kính, khăn, ba lô, gậy, nơ, túi).
  - **Cách nhận ra:** (1) phụ kiện nổi bật **dành riêng cho khách quen** — khách vãng lai chỉ random từ bộ cơ bản nên thấy phụ kiện là biết; (2) lúc bước vào hiện bảng tên + bậc tim vài giây rồi thu thành ⭐ nhỏ trên đầu; (3) vòng sáng vàng dưới chân; (4) thông báo có chân dung "Bà Tư ghé quán"; (5) bong bóng gọi món có tim nếu đúng món ruột; (6) chân dung trong bảng Khách quen render từ chính model 3D.
  - **Dàn khách đề xuất (8):** bé gái 2 bím + nơ + ba lô; cậu bé mũ lưỡi trai ngược; chị văn phòng đuôi ngựa + kính + túi; anh shipper áo khoác + mũ bảo hiểm; cô giáo tóc búi + khăn choàng; chú thợ khăn vắt vai + râu; bà cụ tóc bạc búi + kính lão + gậy; ông cụ mũ phớt + râu bạc + gậy.
- [ ] **G5 · Việc mở ra** — bếp và quầy ra món vẫn dùng chung một kiểu cho 3 quán; mặt tiền 3D chỉ có ở màn mở đầu (chưa thấy trong khu Quán); đầu bếp mặc đồng phục chung; thiếu sạp/nguồn tự làm cho đồ khô.
- [x] **G6 · Chỉnh theo phản hồi (đợt 8)** *(xong 18/11/2026)* — quán + bếp nhỏ lại, lối WC / kho; ao ×2 dọc suối hạ lưu; chuồng rộng có rơm; viền đứt khúc chỗ mở rộng; bấm ô → zoom + bảng chỉ loại ô đó; ruộng lúa mì + lúa nước tự động (máy cày, gieo lại, chở tới cối); cối xay gió + nhà xay lúa chọn thành phẩm; nắng theo giờ, vệt gió, đèn nông trại ban đêm.
- [x] **G6b · Chỉnh nông trại lần 2 (đợt 9)** *(xong 18/11/2026)* — vệt gió mảnh; cối xay gió về phía bắc; ao méo + nới rộng diện tích; lúa nước cạnh sông + lúa mì; nhà xay lúa bên sông.
- [x] **G8 · Nhà màng + khu bên trong (đợt 10)** *(xong 18/11/2026)* — nới dài về phía đông, 8 → 20 luống.
- [x] **F3a · Nhiệm vụ hệ thống (đợt 12)** *(xong 18/11/2026)* — 7 nhiệm vụ dễ → khó, thẻ trên HUD, nhận thưởng. Mở rộng sau: nhiệm vụ hằng ngày ngẫu nhiên, thưởng đồ trang trí (gộp F3 sổ sưu tầm).
- [ ] **G7 · Việc mở ra từ đợt 8** — mặt tiền 3 quán làm đẹp lại (chủ dự án chưa ưng); vệt gió khó thấy ở góc nhìn xa (thử dạng sợi cong / lá bay); máy cày có thể bị chậm khi nhiều ruộng (hàng việc chung với việc ruộng rau) — cân nhắc người làm thuê thứ hai (N4); cân bằng giá lúa / cối / thời gian (B1).
- Sau đó: C7 đơn hàng → F3 sổ sưu tầm → B5 dắt tay người mới → C9 offline → B1 cân bằng.

## Giai đoạn 3 — "Quán của riêng mình" (đợt 13, 19/11/2026)

- [x] **F4 · Đồ trang trí đặt tự do** — 14 món bán ở Siêu thị (có món riêng từng quán) + 8 quà của khách quen; mua tự bày chỗ thoáng, kéo / xoay / cất kho / bán lại ở chế độ sắp xếp; hiệu ứng mỗi loại tính 1 lần.
- [x] **F5 · Tên quán, biển hiệu, thú cưng, chụp ảnh** — biển tên trên tường sau, mèo / chó đi lang thang và được khách vuốt ve, chế độ chụp ảnh tải PNG.
- [x] **C3, B2, B7** — xem mục B / C.
- [ ] **G9 · Việc mở ra từ đợt 13** — bếp to hơn theo hạng quán; mặt tiền + biển tên ngoài cửa (gộp G7); đồ treo tường (tranh, đồng hồ); khách quen có hội thoại / yêu cầu riêng; đặt tên thú cưng; chụp ảnh có khung + chữ tên quán; kéo thả chưa thử bằng tay trên điện thoại (A3).

## Đợt 14 — Chỉnh theo phản hồi sau Giai đoạn 3 (19/11/2026)

- [x] **Nông trại:** suối chỉ dẫn nước từ sông vào ao; vườn cây ăn quả 8 gốc (cam, táo, xoài, chuối — 4 cạnh chuồng, 4 cạnh ao, có sẵn cam + táo); đường đất có vệt cát, đá cuội, cỏ dại.
- [x] **Quán:** bỏ bàn thờ; quán khởi đầu nhỏ lại (3 ghế quầy, 1 bàn bốn, 2 bàn đôi); khách thưa hơn; bồi bàn đứng yên sau khi làm xong; ngày 12 phút (06:00–24:00), 2 ca 07–12 / 15–20; khay bưng cả bàn; chén dĩa dơ phải dọn; vết bẩn sau mỗi ca (bấm giữ để lau); tường hai bên đầy đủ; tổng kết ngày có kho.
- [x] **Chợ:** sạp thịt "Thịt bò/lợn cô Bủm"; tiệm ăn vặt & trà sữa cạnh quầy đồ khô; xe hủ tiếu gõ, gánh bánh tráng trộn, xe đạp cà phê trên vỉa hè; bấm sạp thì camera lướt sát vào.
- [x] **Giao diện:** chừa tai thỏ / góc bo (env(safe-area-inset-*)), chừa góc logo Netlify; bảng nhiệm vụ bấm xem chi tiết.
- [ ] **G10 · Việc mở ra từ đợt 14** — cân bằng lại kinh tế theo ngày 12 phút + 2 ca (B1: doanh thu / ngày giảm vì ít khách hơn); trái cây mới có 4 món dùng — thêm món, bán ở chợ; hàng rong chợ mới bán nguyên liệu có sẵn (chưa có món riêng như ly cà phê, bánh tráng); kéo thả khay chưa thử bằng tay trên điện thoại.

## Đợt 15 — Nhân viên phục vụ (19/11/2026)

- [x] Bồi bàn đi chậm lại (waiterSpeed 430); bấm món ở quầy = cầm món rồi chọn bàn, hoặc kéo vào khay (không tự thêm vào khay).
- [x] Nhân viên thuê: mỗi bậc hạng quán +1 người (hạng quán lên 5 bậc, tối đa 4 nhân viên), giao việc bưng món / menu / dọn bàn / lau sàn, năng lượng, xỉu (bồi dưỡng 100 xu), giờ nghỉ đi ăn hàng rong (cà phê < bánh tráng < hủ tiếu < Tiệm 25caaaaa).
- [ ] **G11 · Việc mở ra** — lương nhân viên theo ngày (hiện chỉ phí thuê); bồi bàn của người chơi chưa có năng lượng (cố ý, tránh người chơi bị kẹt); nhân viên chưa có kỹ năng / tốc độ riêng; cân bằng năng lượng mỗi việc (3) theo số việc thật trong một ca.

## Bác nông dân (18/11/2026)

- [x] **N1 · Bác nông dân chạy theo tương tác** — `systems/farmer.ts`, save v6, 8 test. Bấm ô ruộng / chuồng / ao là bác chạy tới làm.
- [ ] **N2 · Hiệu ứng theo bác** *(Sonnet)* — hạt bụi khi bác bổ cuốc, tia nước từ bình tưới, dụng cụ cầm trên tay (cuốc, bình tưới, giỏ) thay cho biểu tượng trên đầu.
- [ ] **N3 · Đi vòng quanh ao / chuồng thông minh hơn** *(Opus)* — hiện chỉ có 2 lối dọc; ao nới rộng tối đa có thể che lối, mua thêm ô ở xa có thể cần lối mới (thêm vào `balance.farmer.lanes`).
- [ ] **N4 · Công cụ nâng cấp** *(Opus, gộp F6)* — bình tưới to tưới cả hàng, giày chạy nhanh (modifier `farmerSpeed`), thuê thêm người làm vườn.

## Việc mở ra sau Giai đoạn 1 (đề xuất, chưa ai quyết)

- [ ] **S1 · Bồi bàn tự động khi người chơi vắng mặt** *(Opus)* — *18/11/2026: chủ dự án nói "ngoài chợ không cần bồi bàn" → tạm chưa làm.* người chơi ở Nông trại/Chợ thì quán không ai phục vụ. Có thể là trang thiết bị/nhân viên thuê ở Siêu thị; dùng lại `autoServeCommands` trong `service.ts`, chạy chậm hơn người chơi. Hỏi chủ dự án trước.
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
- [x] **B2 · Xoay bàn 90°** *(xong 19/11/2026, đợt 13 — nút ⟳ khi chọn bàn ở chế độ sắp xếp)* *(Opus)* — thêm góc xoay vào `state.restaurant.layout` (cần migration), `seatSpots`/`footprint` tính theo góc, nút xoay khi đang kéo. Xong khi: test đặt bàn xoay không chồng nhau.
- [ ] **B3 · Hoa văn sàn theo loại** *(Sonnet)* — `DecorDef` thêm trường `pattern: 'planks' | 'checker' | 'plain'`; `buildRoom` dựng theo pattern. Sàn gạch hiện vẫn là sọc.
- [x] **B4 · Tưới và cuốc có hiệu ứng** *(18/11/2026: hạt 💧 💨 🌱 ✨ trong `FarmArea.react()`, khói bếp, tim khi khách trả tiền)* *(Sonnet)* — nghe lệnh thành công ở `app.ts`, phát hiệu ứng ngắn tại ô (giọt nước rơi, bụi đất). Cần `FarmArea` có hàm `playEffect(slotId, kind)`.
- [ ] **B5 · Gợi ý cho người mới** *(Sonnet)* — vài bước hướng dẫn đầu game (cuốc → gieo → tưới → ra chợ → bật món). Lưu bước đã qua trong state (cần migration nhỏ) hoặc `localStorage` riêng.
- [ ] **B6 · Thông báo khi sắp hết nguyên liệu** *(Sonnet)* — cảnh báo trên HUD khi một món đang bán chỉ còn nấu được < 3 phần.
- [x] **B7 · Mua thêm bàn ở Siêu thị** *(xong 19/11/2026, đợt 13 — `tableKinds` trong `data/props.ts`, bán lại 50%)* *(Opus)* — hiện bàn thứ 5 gắn với một nâng cấp. Tổng quát hoá: danh mục bàn mua được, bàn mua về xuất hiện ở chỗ trống hợp lệ đầu tiên.

## C. Tính năng mới (theo thứ tự đề xuất)

- [x] **C1 · Bồi bàn / khâu phục vụ** *(18/11/2026: người chơi đóng vai bồi bàn — mang menu, ghi món, lấy món ở quầy ra món giao đúng bàn; tâm trạng 4 bậc quyết định tip; save v5)* *(Opus)* — `Order` thêm trạng thái `ready` giữa `cooking` và `served`; system `service` cho bồi bàn mang món (tốn thời gian theo khoảng cách hoặc cố định). Tuỳ câu trả lời của chủ dự án: tự động hay người chơi bấm. Hình: nhân vật bồi bàn đi giữa bếp và bàn.
- [ ] **C2 · Thuê và nâng cấp nhân viên** *(Opus)* — `state.restaurant.staff` thành danh sách động; lệnh thuê/sa thải/đào tạo; lương trừ cuối ngày; nhân viên là một nguồn `modifier`. Bếp to hơn theo số đầu bếp.
- [x] **C3 · Nâng hạng quán** *(xong 19/11/2026, đợt 13 — 3 hạng `room.tiers`, phòng ăn sâu thêm; bếp chưa to theo)* *(Opus)* — đưa kích thước phòng vào state; các mốc quán → tiệm → nhà hàng mở rộng phòng, bếp, số bàn tối đa. `RestaurantArea` dựng lại tường khi phòng đổi cỡ.
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
