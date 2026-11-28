# Roadmap - việc tiếp theo

Mỗi nhiệm vụ có mã, phạm vi, tiêu chí hoàn thành và gợi ý model. Làm xong thì đổi `[ ]` thành `[x]` và ghi ngày.

**Gợi ý chọn model:**

- **Sonnet** - việc theo công thức có sẵn trong `CLAUDE.md`: nhập dữ liệu, thêm nội dung, sửa panel, chỉnh số, thêm lệnh nhỏ trong system đã có.
- **Opus** - việc đụng tới hình dạng `GameState` (cần migration), system mới, thay đổi trong `Stage`/kiến trúc 3D, thiết kế cân bằng.

Mọi nhiệm vụ đều kết thúc bằng: `npm run typecheck` sạch, `npm test` qua, cập nhật `CLAUDE.md` nếu thêm khái niệm mới, ghi một mục vào `07-NHAT-KY.md`.

**Thứ tự ưu tiên hiện tại** nằm ở `06-KINH-NGHIEM-THIET-KE.md` mục 3 (các giai đoạn, mã F*). Giai đoạn 1 đã xong; kế tiếp là Giai đoạn 2 "Có lý do quay lại" - nhưng chủ dự án muốn **tập trung vào Quán ăn**, nông trại và chợ để sau.

## Giai đoạn 2 - thứ tự đã chốt (18/11/2026)

- [x] **G1 · Sông + suối dẫn vào ao** *(xong 18/11/2026)* - chỉ cảnh 3D nông trại: sông chạy dọc mép bản đồ, suối uốn từ sông tới ao, cầu nhỏ chỗ suối cắt lối đi của bác nông dân. Nước động (UV trôi) dùng chung vật liệu với ao.
- [x] **G2 · Màn hình mở đầu + chọn phong cách quán** *(xong 18/11/2026: `state.cuisine`, save v7 chơi lại từ đầu theo chủ dự án - không migration)*; menu Play/New game; màn chọn 3 quán ngoại thất xoay chậm; `CuisineDef` trong data (tên, màu, mặt tiền, danh sách món).
- [x] **G3 · Nội thất theo nước** *(xong 18/11/2026, `src/ui/three/cuisine.ts`)* - Nhật: sàn gỗ + chiếu tatami, rèm noren, đèn lồng giấy, quầy sushi; Hàn: bàn nướng có ống hút, ghế đẩu inox, đèn neon, poster; Việt: bàn nhựa / gỗ, ghế đẩu đỏ, quạt trần, đèn lồng Hội An, tranh tre. Dùng hệ `DecorDef` sẵn có.
- [x] **G4 · Thực đơn 3 nước** *(xong 18/11/2026: 16 món Việt, 13 Nhật, 13 Hàn, đủ model 3D; chủ dự án vẫn có thể sửa danh sách)* - món + model 3D món mới; nguyên liệu dùng chung một nông trại/chợ.
- [x] **F2 · Khách quen (đợt 13)** *(xong 19/11/2026)* - 8 khách quen (`src/data/regulars.ts`), món ruột theo từng quán, tim theo số lần ghé, quà tặng là đồ trang trí riêng; nhận ra bằng phụ kiện riêng, vòng sáng hồng, bảng tên → ⭐, thông báo có chân dung, bong bóng 💖, bảng Khách quen. Thiết kế gốc bên dưới.
- [~] *(thiết kế gốc)* **F2 · Khách quen** *(Opus)* - làm sau G2 để món ruột khớp thực đơn từng nước (món ruột theo **nhóm**: đồ ngọt, mì nước, đồ chiên... nên dùng được cho cả 3 quán).
  - **Ngoại hình:** `Look` mở rộng thành dáng người (trẻ em / thiếu niên / người lớn / người già hơi khom), kiểu tóc (ngắn, dài, đuôi ngựa, hai bím, búi, hói), áo + quần/váy, màu da, phụ kiện (mũ, kính, khăn, ba lô, gậy, nơ, túi).
  - **Cách nhận ra:** (1) phụ kiện nổi bật **dành riêng cho khách quen** - khách vãng lai chỉ random từ bộ cơ bản nên thấy phụ kiện là biết; (2) lúc bước vào hiện bảng tên + bậc tim vài giây rồi thu thành ⭐ nhỏ trên đầu; (3) vòng sáng vàng dưới chân; (4) thông báo có chân dung "Bà Tư ghé quán"; (5) bong bóng gọi món có tim nếu đúng món ruột; (6) chân dung trong bảng Khách quen render từ chính model 3D.
  - **Dàn khách đề xuất (8):** bé gái 2 bím + nơ + ba lô; cậu bé mũ lưỡi trai ngược; chị văn phòng đuôi ngựa + kính + túi; anh shipper áo khoác + mũ bảo hiểm; cô giáo tóc búi + khăn choàng; chú thợ khăn vắt vai + râu; bà cụ tóc bạc búi + kính lão + gậy; ông cụ mũ phớt + râu bạc + gậy.
- [ ] **G5 · Việc mở ra** - bếp và quầy ra món vẫn dùng chung một kiểu cho 3 quán; mặt tiền 3D chỉ có ở màn mở đầu (chưa thấy trong khu Quán); đầu bếp mặc đồng phục chung; thiếu sạp/nguồn tự làm cho đồ khô.
- [x] **G6 · Chỉnh theo phản hồi (đợt 8)** *(xong 18/11/2026)* - quán + bếp nhỏ lại, lối WC / kho; ao ×2 dọc suối hạ lưu; chuồng rộng có rơm; viền đứt khúc chỗ mở rộng; bấm ô → zoom + bảng chỉ loại ô đó; ruộng lúa mì + lúa nước tự động (máy cày, gieo lại, chở tới cối); cối xay gió + nhà xay lúa chọn thành phẩm; nắng theo giờ, vệt gió, đèn nông trại ban đêm.
- [x] **G6b · Chỉnh nông trại lần 2 (đợt 9)** *(xong 18/11/2026)* - vệt gió mảnh; cối xay gió về phía bắc; ao méo + nới rộng diện tích; lúa nước cạnh sông + lúa mì; nhà xay lúa bên sông.
- [x] **G8 · Nhà màng + khu bên trong (đợt 10)** *(xong 18/11/2026)* - nới dài về phía đông, 8 → 20 luống.
- [x] **F3a · Nhiệm vụ hệ thống (đợt 12)** *(xong 18/11/2026)* - 7 nhiệm vụ dễ → khó, thẻ trên HUD, nhận thưởng. Mở rộng sau: nhiệm vụ hằng ngày ngẫu nhiên, thưởng đồ trang trí (gộp F3 sổ sưu tầm).
- [ ] **G7 · Việc mở ra từ đợt 8** - mặt tiền 3 quán làm đẹp lại (chủ dự án chưa ưng); vệt gió khó thấy ở góc nhìn xa (thử dạng sợi cong / lá bay); máy cày có thể bị chậm khi nhiều ruộng (hàng việc chung với việc ruộng rau) - cân nhắc người làm thuê thứ hai (N4); cân bằng giá lúa / cối / thời gian (B1).
- Sau đó: C7 đơn hàng → F3 sổ sưu tầm → B5 dắt tay người mới → C9 offline → B1 cân bằng.

## Giai đoạn 3 - "Quán của riêng mình" (đợt 13, 19/11/2026)

- [x] **F4 · Đồ trang trí đặt tự do** - 14 món bán ở Siêu thị (có món riêng từng quán) + 8 quà của khách quen; mua tự bày chỗ thoáng, kéo / xoay / cất kho / bán lại ở chế độ sắp xếp; hiệu ứng mỗi loại tính 1 lần.
- [x] **F5 · Tên quán, biển hiệu, thú cưng, chụp ảnh** - biển tên trên tường sau, mèo / chó đi lang thang và được khách vuốt ve, chế độ chụp ảnh tải PNG.
- [x] **C3, B2, B7** - xem mục B / C.
- [ ] **G9 · Việc mở ra từ đợt 13** - bếp to hơn theo hạng quán; mặt tiền + biển tên ngoài cửa (gộp G7); đồ treo tường (tranh, đồng hồ); khách quen có hội thoại / yêu cầu riêng; đặt tên thú cưng; chụp ảnh có khung + chữ tên quán; kéo thả chưa thử bằng tay trên điện thoại (A3).

## Đợt 14 - Chỉnh theo phản hồi sau Giai đoạn 3 (19/11/2026)

- [x] **Nông trại:** suối chỉ dẫn nước từ sông vào ao; vườn cây ăn quả 8 gốc (cam, táo, xoài, chuối - 4 cạnh chuồng, 4 cạnh ao, có sẵn cam + táo); đường đất có vệt cát, đá cuội, cỏ dại.
- [x] **Quán:** bỏ bàn thờ; quán khởi đầu nhỏ lại (3 ghế quầy, 1 bàn bốn, 2 bàn đôi); khách thưa hơn; bồi bàn đứng yên sau khi làm xong; ngày 12 phút (06:00–24:00), 2 ca 07–12 / 15–20; khay bưng cả bàn; chén dĩa dơ phải dọn; vết bẩn sau mỗi ca (bấm giữ để lau); tường hai bên đầy đủ; tổng kết ngày có kho.
- [x] **Chợ:** sạp thịt "Thịt bò/lợn cô Bủm"; tiệm ăn vặt & trà sữa cạnh quầy đồ khô; xe hủ tiếu gõ, gánh bánh tráng trộn, xe đạp cà phê trên vỉa hè; bấm sạp thì camera lướt sát vào.
- [x] **Giao diện:** chừa tai thỏ / góc bo (env(safe-area-inset-*)), chừa góc logo Netlify; bảng nhiệm vụ bấm xem chi tiết.
- [x] **G10 · Việc mở ra từ đợt 14** (xong ở đợt 16) - cân bằng lại kinh tế theo ngày 12 phút + 2 ca (B1: doanh thu / ngày giảm vì ít khách hơn); trái cây mới có 4 món dùng - thêm món, bán ở chợ; hàng rong chợ mới bán nguyên liệu có sẵn (chưa có món riêng như ly cà phê, bánh tráng); kéo thả khay chưa thử bằng tay trên điện thoại.

## Để dành - ý tưởng đã chốt, chưa làm

- [ ] **Đơn mang về / giao tận nơi** *(chủ dự án: ý hay, để sau)* - thỉnh thoảng khách gọi điện đặt món ("2 phần Phở giao tới khu chợ trước 12:00"); bếp nấu xong đóng hộp ở quầy line, shipper xe máy đi giao; đúng hạn nhận tiền + tip. Tận dụng bếp lúc quán vắng, nối với hệ bếp + quầy line + màu bàn.
- [ ] **Lương nhân viên** *(để dành từ giai đoạn 7)*.

## Giai đoạn 16 - Tối ưu UX / UI (21/11/2026)

- [x] Màn chọn quán: nút "👀 Xem trước" → vào xem bên trong quán đang chọn (ván tạm, không lưu, quán tự chạy có khách), thanh trên cùng "← Chọn quán khác" / "✔ Chọn quán này".
- [x] Xem trước chỉ chiếu lại một đoạn ~1,5 giờ ca sáng rồi tua về đầu (không bao giờ tới giờ cả đội ra chợ / bảng gọi món).
- [x] Mặt bằng riêng theo quán (`room.variants`, `TableDef.byCuisine`):
  - Quán Nhật: quầy bếp chữ L ở góc trái-sau (cạnh ngắn 2 ghế đơn quay ra cửa, cạnh dài 2 quầy đôi tách nhau bằng vách gỗ), quầy line giữa tường sau trước cửa sổ cạnh kho, bàn bốn kê sát tường phải giữa 2 cửa sổ (2 ghế phía trong + 2 ghế đầu bàn); quán xoay mặt hẹp ra đường, sâu vào trong; WC + kho góc phải cuối quán; khung gỗ treo đèn lồng giấy + thẻ gỗ ghi món kiểu izakaya.
  - Quán Việt: bếp phở sát cửa bên trái dài nửa quán (tủ kính có biển tên quán người chơi đặt, nồi nước dùng), bỏ quầy ghế đơn, khởi đầu 2 bàn đơn + 2 bàn đôi + bàn bốn; WC + kho góc trái cuối quán.
- [x] Gợi ý phục vụ ("Quầy line có món…", "Bấm bàn cùng màu để giao") chỉ hiện lần đầu; thẻ nhiệm vụ rộng theo phần thưởng; thông báo khách quen sang góc trái, 1 dòng; khách đi vào ghế xong mới hiện bong bóng menu.
- [x] Khách và thú cưng đi vòng qua bàn ghế / quầy (pathing như nhân viên, lùi ra sau ghế trước khi đi); bấm tag nguyên liệu ở bảng Đơn hàng hiện nguyên liệu kiếm ở đâu (chợ / trồng / nuôi / chế biến).
  - Quán Hàn, quán ốc giữ nguyên. Save v25 (ván Nhật / Việt cũ: bàn gốc về chỗ mặc định mới).

## Giai đoạn 15 - Trước cửa quán, nhân viên giữ bàn, công an khu vực (21/11/2026)

- [x] Đường + xe cộ trước cả 4 quán; khách đi bộ / xe máy (gửi bên phải) / ô tô (đậu bên trái), xe nhiều màu; bác bảo vệ + chòi gác.
- [x] Sắp xếp bàn ghế và mở Siêu thị thì dừng giờ. Kéo bàn giữ đúng chỗ nắm, vướng chút thì tự hít vào chỗ trống gần nhất; ghế chiếm chỗ nhỏ lại (15 → 12).
- [x] Nhân viên thuê đi chậm hơn (×0.6). Từ 2 nhân viên: người đầu làm quản lý (vest), mỗi người giữ một bàn (menu → ghi món → bưng → dọn); có ngày 1 người bệnh nghỉ (20%).
- [x] Quán ốc: công an khu vực hỏi thăm vì lấn chiếm lề đường - bồi dưỡng 200–700 xu theo hạng quán hoặc mất 1 bàn đôi (save v23).
- [x] Icon Nhà nông đổi thành mũ 👒.
- [x] Sửa: nhân viên chạy tới mang menu khi khách chưa ngồi - khách đi bộ / gửi xe rồi mới vào hàng chờ, đi vào ghế rồi mới cần menu (`Party.walking`).
- [x] Nâng hạng quán nới cả về phía Đông (rộng 620 → 840): bếp dài ra, quầy trước bếp thêm ghế (3 → 6), quầy ra món dời theo.
- [x] Bãi xe xoay dọc theo tường bên (đầu xe hướng vào tường), dài theo quán; vỉa hè trước quán rộng 2.8 m cho xe shipper.
- [x] Xe du lịch: minibus đỗ trước cửa, đoàn khách ngồi kín 100% bàn còn trống, xe đợi cả đoàn về rồi mới đi.
- [x] Trang thiết bị mua ở Siêu thị hiện ngay trong quán (`equipment.ts`): chậu cây + tranh, thanh dao, loa + nốt nhạc, viền LED biển tên, chụp hút khói + lửa xanh, tủ chén sứ, tủ kem; Hệ thống tưới = vòi phun xoay ở ruộng. Thêm **Tủ kem** (+30% kiên nhẫn, 700 xu, cấp 4).
- [x] Chó và mèo ở quán cùng lúc (`profile.petsOut`, save v24).
- [x] Sửa: khách vẽ ở toạ độ NaN (biến mất) ở khung hình đầu sau khi tua `?ff=` (dt âm).
- [ ] Chưa thử bằng tay kéo bàn / bấm hộp công an trên máy thật (theo quy ước chỉ xem, không bấm).

## Giai đoạn 14 - Sửa lỗi sau khi chơi thử 3 ngày (21/11/2026)

- [x] Phục vụ: mang menu + dọn bàn không tốn sức; đi vòng qua cả ghế và khách đang ngồi (`footprint` trong pathing).
- [x] Thông báo nổi dời sang góc phải dưới đồng hồ. Tên người chơi trên đầu nhân vật (chưa đặt thì không hiện) + đổi tên chủ quán trong game.
- [x] Sản lượng mọi giống ×2; nguyên liệu khởi đầu ×1.5; Tiệm ăn 1.000 xu; nâng bếp cần hạng Tiệm ăn; ngày đầu không mưa.
- [x] Nhóm 3–4 người: cùng lúc tối đa số bàn vừa + 1. Bác nông dân dạo chợ chờ đội quán rồi ăn chung, ăn 30 phút rồi về; còn trên 75% sức thì trưa không ăn. "Để mọi người tự chọn" chia đều, không âm tiền.
- [x] Anh shipper + xe máy trước quán: giao đơn 15–40 phút, tốn 5–10 sức (tối đa 40), về mới nhận thưởng; ăn cùng đội. Badge Đơn hàng = số đơn còn mở.
- [x] Quà khách quen vào kho (mục Quà tặng ở bảng Kho → Bày ra quán). Quán rộng thêm 80 (540 → 620). Sạp hải sản có viền LED nhấp nháy; Tiệm 25caaaaa có cửa sổ, bàn hồng; quán ốc đêm sáng hơn.
- [x] Lên cấp chậm từ cấp 4, lên sao chậm từ 3 sao. Được nợ tới 500 xu, quá thì phá sản (màn chơi lại). Hướng dẫn xong thưởng 500 xu. Save v22 (ván cũ chơi tiếp được).
- [ ] Chưa thử bằng tay trên điện thoại; chưa chạy lại mô phỏng mùa Xuân sau khi đổi nhịp lên cấp / sao và sản lượng ×2.

## Giai đoạn 13 - Cân bằng nông trại + kinh tế, chủ quán tuỳ biến, HUD gọn (20/11/2026)

- [x] Ao nhanh hơn ~40% (cá 3 ngày, cá hồi 4, tôm / ốc / sò 3.5; lứa sau 3 ngày), 15 con mỗi lứa. Rau lâu lớn thì nhiều trái hơn (mỗi ô lời ~10–12 xu / ngày), lúa mì 14 / lúa nước 15, heo 8, bò thịt 10.
- [x] Năng lượng: đầu bếp 30, bồi bàn / nhân viên / bác nông dân 50 (`maxEnergyOf`); dọn bàn không tốn sức; bồi dưỡng khi xỉu 50 xu.
- [x] Chủ quán: đặt tên (hiện trên đầu nhân vật), 4 kiểu tóc mới (đầu đinh, undercut, tết lệch, dài uốn) + chọn tóc, 6 bộ quần áo (gi-lê, áo kiểu + váy, thun + jean, polo + kaki, tạp dề, áo dài). Save v19.
- [x] HUD: bỏ thông báo "món nấu xong ra quầy line"; cảnh báo hết / sắp hết nguyên liệu gộp một dải dưới hàng cấp / tiền / sao (không bật thông báo nổi nữa); thẻ nhiệm vụ luôn sát bên phải tiền / sao.
- [x] Mô phỏng mùa Xuân (14 ngày, người chơi mẫu phục vụ hoàn hảo, đi chợ sát nhu cầu, làm nông trại): cả 4 quán cuối mùa ~8.900–11.600 xu (bắt đầu 200), cấp 10–11. Quán Việt / Hàn lời thấp vì món rẻ lãi 5–10 xu → nâng giá 11 món cấp thấp.
- [ ] Việc mở ra: nông trại thu ~4.000 xu nông sản / mùa nhưng phần lớn không khớp món đang bán → bán lại nửa giá; có thể thêm cách dùng nông sản (đơn hàng nhiều hơn, chế biến). Người chơi thật phục vụ chậm hơn mẫu nên lời thấp hơn.

## Giai đoạn 12 - Sổ tay tự sinh, tinh chỉnh đồ hoạ nhân vật + HUD (22/11/2026)

- [x] Sổ tay (cơ sở dữ liệu tra cứu) tự sinh từ `src/data`: `npm run sotay` → `notes/so-tay-quan-nha-vuon.html`. Đủ mọi nội dung: nguyên liệu, món (giá vốn, lãi, lãi/giây), giống + vật nuôi (lời vụ đầu, hoà vốn), loại ô, cối, sạp + hàng rong, hạng quán / bếp, đầu bếp, nâng cấp, bàn, nội thất, đồ trang trí, thú cưng, người làm vườn, dụng cụ, khách quen, nhiệm vụ, thành tựu, mùa, lễ hội, thời tiết, sự kiện. Bản viết tay cũ giữ ở `notes/so-tay-cu-giai-doan-6.html`.
- [x] Nhân vật gọt lại bằng code (`src/ui/three/person.ts`): trẻ em / thiếu niên / người lớn / người già, mập gầy, cao thấp; 10 kiểu tóc (thêm tóc mai, gáy, bob, xoăn, rẽ ngôi); khách vãng lai và người đi chợ mỗi người một dáng + tóc (nhóm 3–4 người hay có trẻ em, người già tóc bạc); bác nông dân đậm người, đầu bếp mập gầy khác nhau; bóng mờ dưới chân; viền sáng mềm; cử động mượt (chuyển tư thế từ từ, nhún bước, lắc hông, ngoái nhìn, dồn trọng tâm). Trang xem thử `lineup.html` (chỉ bản dev).
- [x] Bảng gọi món cho đội chia 2 cột (người + thanh năng lượng 4/12, thực đơn 8/12): bấm món là thanh đầy dần, đầy thì tự sang người kế; bỏ món đã gọi; "Xong" chốt ai đã có món; "Để mọi người tự chọn" như cũ (chỉ gọi thêm phần còn thiếu).
- [x] Nông trại: bảng bên phải bỏ lưới ô (bấm thẳng ô trên cảnh là ra giống / chi tiết ô); thời gian lớn tính bằng ngày (rau 1–5 ngày theo tỉ lệ ngoài đời, gà 2, heo 5, bò 7, cây ăn quả 8 + 1 ngày một lứa, lúa 3, cá 5 / cá hồi 7 / tôm 6 rồi 5 ngày một lứa); gà mái đẻ + bò sữa hết lứa khi sang Đông; cá, tôm thả một lần thu nhiều lứa (×15 / ×10); thêm 6 loại ốc, sò nuôi ở ao; máy cày đậu cạnh ruộng lúa; tưới một lần ẩm cả ngày.
- [x] Chợ bán đủ mọi thứ quanh năm (trái mùa chỉ đắt hơn): thêm trái cây vào Tạp hóa cậu Ba; sạp Hải sản Tuyết Nhung bán thêm 6 loại ốc / sò (ốc hương trong bể, còn lại trong rổ quanh người bán); sạp thịt cô Bủm làm lại: bàn inox, giá treo thịt, thớt + cân.
- [x] Quán thứ 4 - **Quán Ốc** vỉa hè: xe đẩy (bếp trưởng) + bếp nướng than (bếp phó) + quầy line dưới sạp dù lớn, bàn ghế nhựa mini xanh đỏ có ô (mưa thì bung), không có quầy ghế đơn trước bếp (thay bằng 1 bàn đôi nữa), nền bê tông → gạch lề đường, bảng tên chân đứng, dây đèn vàng; không WC / kho. 9 món: tôm nướng, nghêu hấp thái, hàu nướng mỡ hành / phô mai, mì xào ốc móng tay, ốc bươu nhồi thịt, sò điệp nướng mỡ hành / phô mai, ốc hương sốt phô mai. Phô mai mua ở sạp đồ khô.
- [ ] Việc mở ra: cân bằng lại sản lượng nông trại (giờ một ngày thu ít hơn trước nhiều); nhiệm vụ / thành tựu thu hoạch có thể cần hạ mốc.
- [ ] HUD (chờ chủ dự án chỉ chỗ cần sửa). Nếu muốn đẹp hơn nữa: thử 1 nhân vật glTF (D6).

## Giai đoạn 11 - Mùa 2 tuần, người làm vườn, dụng cụ, nhiệm vụ dài + thành tựu (21/11/2026)

- [x] Mỗi mùa 14 ngày (`DAYS_PER_SEASON`), lễ hội dời ngày cho khớp.
- [x] Người làm vườn: thuê ở bảng 🧰 Nhà nông (3 chỗ, mở ở cấp 2 / 4 / 6), bật / tắt việc cho từng người (thu hoạch, chuồng + ao, tưới, cuốc + gieo lại); tự làm, đi lối như bác, không giành ô với bác; vẽ trong cảnh nông trại (nón lá, icon việc trên đầu).
- [x] 4 dụng cụ nông trại: liềm bén, bình tưới lớn (tưới cả hàng), giày vải nhẹ, máy cày đời mới.
- [x] Chuỗi 22 nhiệm vụ chia 4 chương; loại mục tiêu mới (giao đơn, cấp, hạng quán, hạng bếp, người làm vườn, dụng cụ, ngày).
- [x] Sổ thành tựu 23 huy hiệu (bảng 🏆), nhận thưởng một lần.
- [ ] Việc mở ra: lương người làm vườn (cùng đợt lương nhân viên); thành tựu thưởng đồ trang trí; nhiệm vụ hằng ngày.

### Giai đoạn 11b - Nhịp quán + ngày hướng dẫn (21/11/2026)

- [x] Bếp trưởng nấu 4–10 giây thực theo độ khó món.
- [x] Âm thanh: mở tiếng trên điện thoại (iOS cần chạm), nhạc nền + hiệu ứng to hơn.
- [x] Người phục vụ đi vòng qua bàn / đồ trang trí (A* trên lưới, cache theo bố cục).
- [x] Ca sáng ngưng nhận khách 11:00; khách về hết trước 12:30 (sáng) / 21:30 (tối).
- [x] Thời gian ăn theo số khách; khách đông hơn; lưu lượng khách đổi theo ngày, ngày lễ đông hẳn.
- [x] Lau sàn có động tác cầm cây lau nhà.
- [x] Ngày 1 là ngày hướng dẫn có kịch bản (bưng món → ra chợ mua → nông trại → ăn trưa → tự do).
- [x] Sạp Hải sản Tuyết Nhung: bỏ quầy khay, thay bằng bể nước có hải sản bơi xếp quanh sạp; giữa sạp người bán, cân, rổ, xô nước.
- [x] Chỉnh sau khi thử: khách chờ ghi món hiện bong bóng 📝 (ghi xong mới hiện mặt cười); thẻ nông trại gọn, nằm bên trái, ô ruộng / ruộng lúa mì / chuồng nhấp nháy + mũi tên; bảng gọi món rộng hơn; dừng giờ khi mở bảng gọi món / hoá đơn; tự chọn món thì ăn tới đầy năng lượng.

## Giai đoạn 10 - Sửa bên trong Tiệm 25caaaaa (20/11/2026)

- [x] Đèn thả trần trong tiệm (và 2 bóng dưới mái sạp nguyên liệu) sáng lên khi trời tối.
- [x] Người trong đội ăn ở tiệm: đĩa món đặt trên mặt bàn (không lơ lửng trên đầu), ngồi hai bên bàn cho khỏi che nhau, bàn dễ thấy được ngồi trước.
- [x] Tường hai bên tiệm chạy tới mép ngoài của sàn.

## Giai đoạn 9 - Bưng món theo màu bàn (20/11/2026)

- [x] Bỏ khay kéo thả và ngăn quầy bên phải. Bấm quầy line: bồi bàn lấy món nấu xong sớm nhất, tối đa 2 món. Bấm bàn: giao đúng món của bàn đó.
- [x] Mỗi bàn một màu sau khi gọi món: bong bóng cảm xúc + bong bóng món của khách, vòng dưới đĩa trên quầy line, bong bóng món trên đầu bồi bàn, thanh "Đang cầm" phía dưới.
- [x] Sửa lỗi tải save cắt mất chỗ nhân viên cộng thêm của hạng bếp.
- [ ] **G18 · Việc mở ra** - chưa thử bằng tay trên điện thoại; nhân viên thuê vẫn bưng theo cách cũ (lấy đúng món một bàn).

## Giai đoạn 8 - Đơn đặt hàng, bán hàng dư, sự kiện ngẫu nhiên (19/11/2026)

- [x] Bán lại nguyên liệu trong kho bằng nửa giá gốc (theo mùa), nút Bán 1 / 5 / hết ở bảng Kho.
- [x] Bảng **Đơn hàng** (thanh dưới): mỗi sáng 2 đơn (3 từ cấp 4) từ khách ngoài, giao đủ hàng trước 21:00 → thưởng cao hơn giá chợ ×1.6–2.2 + XP + uy tín; quá hạn không phạt.
- [x] Sự kiện ngẫu nhiên (55% mỗi ngày, trừ ngày đầu và ngày lễ): Nhà phê bình ẩm thực, Thanh tra vệ sinh (báo trước giờ tới), Xe du lịch ghé, Mất điện, Khách sộp; dải sự kiện dưới đồng hồ + thông báo kết quả.
- [ ] **G17 · Việc mở ra** - đơn đặt món mang về (bếp nấu rồi đóng hộp); chưa thử bằng tay nút giao đơn / bán hàng trên điện thoại.

## Giai đoạn 7 - Mở rộng bếp, giao món cho đầu bếp, hướng dẫn, cảnh báo nguyên liệu (19/11/2026)

- [x] Hạng bếp (Bếp nhỏ → Bếp đôi → Bếp chuyên nghiệp): thêm đầu bếp tối đa (2/3/4), quầy line dài ra (6/8/10 đĩa - đầy thì bếp chờ), thêm chỗ nhân viên phục vụ (+0/+1/+2); cảnh bếp có bàn sơ chế, lò nướng.
- [x] Thuê thêm đầu bếp (Bếp phụ An, Bếp phụ Bình) ở bảng Nhân viên; từ 2 đầu bếp trở lên thì giao cho mỗi người nấu món nào (bếp tự chạy), cảnh báo món không ai nấu.
- [x] Hướng dẫn chơi 8 trang: nút ở màn mở đầu (người chơi tuỳ chọn học hay vào game luôn) và trong Cài đặt.
- [x] Cảnh báo món đang bán sắp hết nguyên liệu (< 3 phần): thẻ dưới số tiền, số trên nút Thực đơn, thẻ món ghi thiếu gì, thông báo một lần khi món tụt ngưỡng.
- [ ] **G16 · Việc mở ra** - lương nhân viên (để dành); chưa thử bằng tay nút giao món và hướng dẫn trên điện thoại.

## Giai đoạn 6 - Mùa vụ và lễ hội (19/11/2026)

- [x] Rau củ, lúa chỉ gieo ngoài trời đúng mùa (mỗi giống 2–3 mùa); sang mùa cây trái mùa đang lớn thì héo, cây chín vẫn thu; nhà kính quanh năm; ruộng tự động không gieo lại giống trái mùa.
- [x] Chợ: rau đúng mùa rẻ hơn (×0.85), trái mùa đắt hơn (×1.3); món hợp mùa bán đắt hơn 20% (mỗi quán 3 món mỗi mùa).
- [x] Thời tiết: Bão (Hạ, Thu - dập cây ngoài trời), Nắng nóng (Hạ - đất khô gấp đôi).
- [x] 5 lễ hội: Tết, Lễ hội pháo hoa, Trung thu, Giáng sinh, Tất niên - khách đông / tip nhiều, Tết có lì xì; trang trí trong quán và ngoài chợ; HUD báo lễ hôm nay và sắp tới.
- [x] Sổ tay vật phẩm (artifact riêng tư, bản local ở `notes/`) có mục Mùa & lễ hội.
- [ ] **G15 · Việc mở ra** - chủ dự án đang xem Sổ tay để chỉnh số liệu cân bằng; món đặc biệt chỉ có ngày lễ; pháo hoa thật trên trời đêm Lễ hội pháo hoa; chưa thử bằng tay bảng chọn giống (mùa) trên điện thoại.

## Đợt 18 - HUD gọn lại, bốn mùa (19/11/2026)

- [x] Thẻ nhiệm vụ lên cạnh tiền / sao; đồng xu vàng vẽ bằng CSS cho mọi chỗ (emoji 🪙 có máy ra màu bạc).
- [x] Nông trại, Quán, Chợ, Nhân viên, Siêu thị thành nút tròn chỉ có icon, xếp dọc dưới nút Cài đặt; thanh dưới còn Khách quen, Thực đơn, Kho + 2 nút chuyển khu (màu xanh ngọc).
- [x] Nút ✕ của ngăn kéo / bảng to hơn.
- [x] Đồng hồ: "Thứ 2 Ngày 1", "Mùa Xuân · Năm 1", trạng thái bằng chữ (Mở cửa, Đông khách, Ngưng nhận khách, Nghỉ trưa, Đóng cửa).
- [x] Lịch 4 mùa × 28 ngày; tổng kết doanh thu cuối mùa và cuối năm.
- [x] Thời tiết theo mùa (tuyết mùa Đông); cảnh theo mùa: Hạ vàng cam, Thu cam + gió + lá bay, Đông tuyết rơi, cây cỏ phủ tuyết, nước đóng băng, mọi người quàng khăn.
- [x] Mùa Đông: ngoài trời không trồng trọt / chăn nuôi (cây, con vật ngừng lớn), nhà kính vẫn trồng.
- [x] Trời mưa người ngoài chợ cầm dù; bên trong sạp mái cao hơn thấy bảng hiệu; Tiệm 25caaaaa: bảng menu chân đứng gần cửa, chữ to, sàn trắng ngà.
- [ ] **G14 · Việc mở ra** - món / giống cây theo mùa; chưa thử bằng tay trên điện thoại cột nút tròn khi màn thấp.

## Đợt 17 - Gọi món cho cả đội, vào bên trong quầy chợ (19/11/2026)

- [x] Ca sáng 07–12 (11:30 ngưng nhận khách), ca tối 15–21 (20:30 ngưng nhận khách); đóng cửa thì khách chưa gọi món về, cả đội ra chợ.
- [x] Người chơi gọi món cho từng người (bảng tự mở khi đội ra chợ); quá hạn thì tự chọn; một hoá đơn chung (gộp tiền ăn của bác nông dân).
- [x] Tiệm 25caaaaa: Matcha thay trà sữa, thêm Mì Ý; biển logo trên nóc tiệm và trong tiệm.
- [x] Bấm 4 sạp nguyên liệu / Tiệm 25caaaaa thì vào hẳn bên trong (khu `stall`): khay hàng + biển giá, bấm mua; tiệm có bảng menu + người trong đội ngồi ăn.
- [ ] **G13 · Việc mở ra** - hàng rong (cà phê, bánh tráng, hủ tiếu) chưa có cảnh bên trong; bảng gọi món chưa thử bằng tay trên điện thoại.

## Đợt 16 - Cả đội có giờ nghỉ, cân bằng kinh tế (19/11/2026)

- [x] **Nông trại:** cây ăn quả đứng yên (trước đây dùng chung chuyển động của cá nên chạy vòng); trái đúng loại, to và nằm trên tán (cam, táo có cuống lá, xoài thuôn); cây chuối dựng riêng: thân giả bẹ lá, tàu lá rủ, buồng chuối + bắp chuối tím, cây con bên gốc.
- [x] **Quán:** bảng quầy ra món nằm dọc bên phải (ngăn kéo); không tự bưng - bấm "Cầm khay" rồi bấm bàn; lau vết bẩn bấm 1 cái; đèn lồng, quạt trần, ống hút khói treo cao hơn; bồi bàn chậm hơn (300); bếp phó nấu nhanh bằng bếp trưởng (1.6).
- [x] **Chợ:** xe cùng tốc độ, cách đều; hàng rong + Tiệm 25caaaaa chỉ bán đồ ăn cho cả đội (không vào kho).
- [x] **Cả đội:** bảng Nhân viên (đầu bếp, phục vụ, bác nông dân), năng lượng 30 (nấu −2, việc khác −1), xỉu + bồi dưỡng; nghỉ trưa ra chợ (đội quán 12:00 khi vắng khách → 14:00, bác 12:00–13:00), tối sau 20:00 ra chợ ăn tối; lúc vắng mặt quán / nông trại tạm ngưng kèm lời nhắc; mỗi người tự chọn món, hoá đơn cho người chơi trả (không vượt số tiền).
- [x] Nút "Kết thúc ngày" sau 21:00; nút chuyển khu nằm sát trên thanh công cụ.
- [x] **G10:** mô phỏng 6 ngày cả 3 quán (người chơi mẫu chăm chỉ): thu 500–1200/ngày, lãi ~100–300/ngày, tiền ăn của đội ~70–130/ngày; uy tín lên chậm lại (+0.01/+0.03 mỗi bàn → ~0.4⭐/ngày); nghỉ ngơi hồi thêm 10.
- [ ] **G12 · Việc mở ra** - khay kéo thả vẫn chưa thử bằng tay trên điện thoại; bồi bàn làm một mình thì khoảng 2 ngày xỉu 1 lần (cố ý: khuyến khích thuê nhân viên); khách còn xếp hàng lúc hết ca thì về (không trừ uy tín).

## Đợt 15 - Nhân viên phục vụ (19/11/2026)

- [x] Bồi bàn đi chậm lại (waiterSpeed 430); bấm món ở quầy = cầm món rồi chọn bàn, hoặc kéo vào khay (không tự thêm vào khay).
- [x] Nhân viên thuê: mỗi bậc hạng quán +1 người (hạng quán lên 5 bậc, tối đa 4 nhân viên), giao việc bưng món / menu / dọn bàn / lau sàn, năng lượng, xỉu (bồi dưỡng 100 xu), giờ nghỉ đi ăn hàng rong (cà phê < bánh tráng < hủ tiếu < Tiệm 25caaaaa).
- [ ] **G11 · Việc mở ra** - lương nhân viên theo ngày (hiện chỉ phí thuê); bồi bàn của người chơi chưa có năng lượng (cố ý, tránh người chơi bị kẹt); nhân viên chưa có kỹ năng / tốc độ riêng; cân bằng năng lượng mỗi việc (3) theo số việc thật trong một ca.

## Bác nông dân (18/11/2026)

- [x] **N1 · Bác nông dân chạy theo tương tác** - `systems/farmer.ts`, save v6, 8 test. Bấm ô ruộng / chuồng / ao là bác chạy tới làm.
- [ ] **N2 · Hiệu ứng theo bác** *(Sonnet)* - hạt bụi khi bác bổ cuốc, tia nước từ bình tưới, dụng cụ cầm trên tay (cuốc, bình tưới, giỏ) thay cho biểu tượng trên đầu.
- [ ] **N3 · Đi vòng quanh ao / chuồng thông minh hơn** *(Opus)* - hiện chỉ có 2 lối dọc; ao nới rộng tối đa có thể che lối, mua thêm ô ở xa có thể cần lối mới (thêm vào `balance.farmer.lanes`).
- [ ] **N4 · Công cụ nâng cấp** *(Opus, gộp F6)* - bình tưới to tưới cả hàng, giày chạy nhanh (modifier `farmerSpeed`), thuê thêm người làm vườn.

## Việc mở ra sau Giai đoạn 1 (đề xuất, chưa ai quyết)

- [ ] **S1 · Bồi bàn tự động khi người chơi vắng mặt** *(Opus)* - *18/11/2026: chủ dự án nói "ngoài chợ không cần bồi bàn" → tạm chưa làm.* người chơi ở Nông trại/Chợ thì quán không ai phục vụ. Có thể là trang thiết bị/nhân viên thuê ở Siêu thị; dùng lại `autoServeCommands` trong `service.ts`, chạy chậm hơn người chơi. Hỏi chủ dự án trước.
- [ ] **S2 · Bưng 2 món một lượt** *(Opus)* - `waiter.carrying` thành mảng, mở bằng nâng cấp (khay).
- [ ] **S3 · Bồi bàn đi vòng qua bàn ghế** *(Opus)* - vài điểm hành lang trong `layout.ts`, tìm đường đơn giản.
- [ ] **S4 · Dọn bàn / thu tiền tay** *(Sonnet/Opus)* - thêm việc nhỏ cho người chơi nếu muốn quán bận rộn hơn (khách ăn xong để lại đĩa bẩn, bấm để dọn).
- [ ] **S5 · Cân bằng lại theo khâu phục vụ** *(Opus)* - tốc độ khách tới, `foodPatience`, giá món khi người chơi phải tự phục vụ; dùng `autoServeCommands` làm người chơi mẫu (gộp vào B1).

---

## A. Việc đang chờ chủ dự án

- [ ] **A1 · Nhập danh sách thời gian** *(Sonnet)* - khi chủ dự án đưa bảng. Mẫu bảng ở `01-TAM-NHIN-GAME.md`. Sửa `cookTime`, `growTime`, `regrowTime`, các mốc trong `balance.ts`. Không đổi `minutesPerSecond`. Xong khi: mọi con số khớp bảng (× 0.7), test qua (sửa test nào phụ thuộc con số cũ).
- [ ] **A2 · Nhập thực đơn** *(Sonnet)* - khi chủ dự án đưa danh sách món. Thêm nguyên liệu mới vào `items.ts` và cho nó nguồn. Giữ nguyên `id` của 12 món đang có nếu vẫn còn dùng. Xong khi: game khởi động không báo lỗi dữ liệu, mọi món nấu được.
- [ ] **A3 · Test tay trên thiết bị thật** *(chủ dự án)* - xoay/zoom camera, kéo bàn, bấm ô đất, bấm sạp, toàn màn hình, lớp phủ xoay ngang, tốc độ khung hình ở chợ và nông trại lúc mưa. Ghi lại máy + trình duyệt + chỗ giật.

## B. Hoàn thiện những gì đã có

- [ ] **B1 · Cân bằng kinh tế** *(Opus)* - viết một script mô phỏng (chạy trong Node, dùng `Game` trực tiếp) cho "người chơi mẫu" chơi 10 ngày theo vài chiến lược (chỉ mua chợ / chỉ tự trồng / kết hợp), in ra tiền, cấp, uy tín mỗi ngày. Dùng nó để chỉnh giá và thời gian sao cho: ngày 1 không lỗ nếu chơi hợp lý, tự trồng lợi hơn mua nhưng không bỏ được chợ, mở món mới mỗi 1–2 ngày. Xong khi: có script `npm run balance` và một bảng kết quả trong `docs/`.
- [x] **B2 · Xoay bàn 90°** *(xong 19/11/2026, đợt 13 - nút ⟳ khi chọn bàn ở chế độ sắp xếp)* *(Opus)* - thêm góc xoay vào `state.restaurant.layout` (cần migration), `seatSpots`/`footprint` tính theo góc, nút xoay khi đang kéo. Xong khi: test đặt bàn xoay không chồng nhau.
- [ ] **B3 · Hoa văn sàn theo loại** *(Sonnet)* - `DecorDef` thêm trường `pattern: 'planks' | 'checker' | 'plain'`; `buildRoom` dựng theo pattern. Sàn gạch hiện vẫn là sọc.
- [x] **B4 · Tưới và cuốc có hiệu ứng** *(18/11/2026: hạt 💧 💨 🌱 ✨ trong `FarmArea.react()`, khói bếp, tim khi khách trả tiền)* *(Sonnet)* - nghe lệnh thành công ở `app.ts`, phát hiệu ứng ngắn tại ô (giọt nước rơi, bụi đất). Cần `FarmArea` có hàm `playEffect(slotId, kind)`.
- [ ] **B5 · Gợi ý cho người mới** *(Sonnet)* - vài bước hướng dẫn đầu game (cuốc → gieo → tưới → ra chợ → bật món). Lưu bước đã qua trong state (cần migration nhỏ) hoặc `localStorage` riêng.
- [ ] **B6 · Thông báo khi sắp hết nguyên liệu** *(Sonnet)* - cảnh báo trên HUD khi một món đang bán chỉ còn nấu được < 3 phần.
- [x] **B7 · Mua thêm bàn ở Siêu thị** *(xong 19/11/2026, đợt 13 - `tableKinds` trong `data/props.ts`, bán lại 50%)* *(Opus)* - hiện bàn thứ 5 gắn với một nâng cấp. Tổng quát hoá: danh mục bàn mua được, bàn mua về xuất hiện ở chỗ trống hợp lệ đầu tiên.

## C. Tính năng mới (theo thứ tự đề xuất)

- [x] **C1 · Bồi bàn / khâu phục vụ** *(18/11/2026: người chơi đóng vai bồi bàn - mang menu, ghi món, lấy món ở quầy ra món giao đúng bàn; tâm trạng 4 bậc quyết định tip; save v5)* *(Opus)* - `Order` thêm trạng thái `ready` giữa `cooking` và `served`; system `service` cho bồi bàn mang món (tốn thời gian theo khoảng cách hoặc cố định). Tuỳ câu trả lời của chủ dự án: tự động hay người chơi bấm. Hình: nhân vật bồi bàn đi giữa bếp và bàn.
- [ ] **C2 · Thuê và nâng cấp nhân viên** *(Opus)* - `state.restaurant.staff` thành danh sách động; lệnh thuê/sa thải/đào tạo; lương trừ cuối ngày; nhân viên là một nguồn `modifier`. Bếp to hơn theo số đầu bếp.
- [x] **C3 · Nâng hạng quán** *(xong 19/11/2026, đợt 13 - 3 hạng `room.tiers`, phòng ăn sâu thêm; bếp chưa to theo)* *(Opus)* - đưa kích thước phòng vào state; các mốc quán → tiệm → nhà hàng mở rộng phòng, bếp, số bàn tối đa. `RestaurantArea` dựng lại tường khi phòng đổi cỡ.
- [ ] **C4 · Thức ăn chăn nuôi và chế biến** *(Opus)* - `ProducerDef.inputs` (vật nuôi cần cám/cỏ mỗi chu kỳ); loại ô mới "xưởng" biến nguyên liệu thành nguyên liệu (lúa → bột, sữa → phô mai). Mô hình giống producer nên tái dùng `farm.ts`.
- [ ] **C5 · Mở rộng ao cá** *(Sonnet)* - thêm loài (cá chép, cá hồi, mực nuôi...), thêm bậc ao, cho ăn. Hiện ao có 3 bậc và 2 loài.
- [ ] **C6 · Thời tiết sâu hơn** *(Opus)* - bão làm hỏng cây chưa thu, nắng gắt làm đất khô nhanh, mùa trong năm, món theo mùa. Thêm trường vào `WeatherDef` thay vì viết `if` theo id.
- [x] **C7 · Bán nông sản dư và đơn hàng** *(Opus - xong ở giai đoạn 8)* - bán lại cho chợ giá thấp; bảng đơn đặt hàng mỗi ngày (giao đủ N món nhận thưởng).
- [x] **C8 · Sự kiện ngẫu nhiên** *(Opus - xong ở giai đoạn 8)* - khách VIP, thanh tra vệ sinh, ngày lễ đông khách. Dạng `EventDef` trong data + system `events`.
- [ ] **C9 · Tiến trình khi offline** *(Opus)* - lưu mốc thời gian thực lúc thoát; lúc vào tua bù có giới hạn (vd tối đa 1 ngày game, chỉ nông trại). Cần quyết định thiết kế trước (xem câu hỏi mở).
- [x] **C10 · Âm thanh** *(18/11/2026: tổng hợp bằng Web Audio trong `src/ui/audio.ts`, không cần file; bật/tắt trong Cài đặt)* - nhạc nền + hiệu ứng theo `game.bus`.

## D. Đồ hoạ (chi tiết ở `03-DO-HOA-3D.md`)

- [ ] **D1 · Tách bàn ghế, sạp, ô đất thành hàm nhà máy trong `models.ts`** *(Sonnet)* - không đổi hình, chỉ chuyển chỗ. Bước chuẩn bị cho mọi việc nâng cấp model.
- [x] **D2 · Nhân vật cử động** *(18/11/2026)* *(Opus)* - tay chân tách rời, dáng đi, dáng ngồi, đầu bếp nấu.
- [x] **D3 · Model món ăn** *(18/11/2026, đủ 12 món)* *(Sonnet)* - `makeDish(recipeId)` với dự phòng emoji.
- [x] **D4 · Cây nhiều giai đoạn lớn** *(18/11/2026)* *(Sonnet)*.
- [x] **D5 · Gộp mesh tĩnh** *(23/11/2026, giai đoạn 18 - `src/ui/three/merge.ts`; số đo trước/sau ở `03-DO-HOA-3D.md`)* *(Opus)* - chép `mergeStatic` từ `co-thu-3d`, đo draw call trước/sau.
- [ ] **D6 · Đường ống glTF** *(Opus)* - `assets.ts` (tải trước, nhân bản, chuyển sang vật liệu toon), màn hình chờ tải, thứ tự dự phòng file → code → emoji. Thử với 1 model.
- [~] **D7 · Nét viền + hiệu ứng hạt** *(Opus)* - hạt đã có; nét viền đã thử và **gỡ theo ý chủ dự án** (xem `03-DO-HOA-3D.md`).

## E. Kỹ thuật và phát hành

- [ ] **E1 · CI** *(Sonnet)* - GitHub Actions chạy typecheck + test mỗi lần push.
- [x] ~~**E2 · Xuất/nhập save**~~ *(đã bỏ 24/11/2026, giai đoạn 20 - chủ dự án thấy gửi file không tiện, có bạn bè online rồi; ván chỉ tự lưu trong trình duyệt)* *(24/11/2026, giai đoạn 19 - `src/ui/savefile.ts`, `exportSave` / `readSaveFile` trong `save.ts`)* - Cài đặt → 💾 Lưu game: "Tải ván này về" (điện thoại mở hộp chia sẻ), "Mở file save" (hộp so sánh hai ván rồi mới thay); màn mở đầu có nút "📂 Mở file save". Không cần server.
- [ ] **E3 · Chia nhỏ gói JS** *(Sonnet)* - tách Three.js thành chunk riêng để cache tốt hơn.
- [ ] **E4 · Biểu tượng app + ảnh chờ** *(Sonnet)* - thêm icon vào `manifest.webmanifest` để "Thêm vào màn hình chính" có hình.
- [ ] **E5 · Đa ngôn ngữ** *(Opus, chỉ khi cần)* - tách chữ khỏi data và panel.
- [ ] **E6 · Chơi cùng bạn bè** *(Opus, quyết định lớn)* - đã chốt hướng: xem mục **F** bên dưới (bắt đầu từ F1). Chi phí máy chủ ở `05-TRIEN-KHAI-CHI-PHI.md` mục "Những thứ sẽ tốn phí".

## F. Định hướng online (chốt 23/11/2026)

Online chia 3 mức, khó dần và pháp lý nặng dần. **Làm theo thứ tự, chỉ mức 1 là việc gần**; mức 2–3 để dành.

| Mức | Nội dung | Độ khó | Ghi chú |
| --- | --- | --- | --- |
| 1 · Thăm nhau (bất đồng bộ) | Chia sẻ bản chụp quán + nông trại; người khác vào xem (chỉ đọc), thả tim, để sticker, tặng quà nhỏ | Dễ – vừa | Không cần hai người online cùng lúc. Backend kiểu Supabase / Firebase (đăng nhập + database + lưu file), đầu miễn phí |
| 2 · Chợ chung kiểu rao vặt | Đăng bán nông sản, người khác mua; hàng + tiền chuyển qua máy chủ | Vừa – khó | Save đang nằm trên máy người chơi (sửa được) → hàng và ví **dùng để giao dịch** phải do máy chủ giữ và kiểm tra từng lệnh (có thể chạy lại code `src/sim` trên server), giới hạn số lượng / ngày, giá sàn – trần |
| 3 · Chợ thời gian thực | Thấy nhau đi lại, mặc cả trực tiếp | Khó | Máy chủ chạy liên tục, đồng bộ vị trí, lag / rớt mạng. Để ngỏ |

### Thiết kế đã chốt cho mức 1

- **Giờ của mình dừng lại khi đi thăm** - sim không tick (như tạm dừng), về lại thì chạy tiếp.
- **Giờ trong ngày lấy theo người đi thăm** (ánh sáng / bầu trời liền mạch); khi thăm thì bỏ qua giờ mở cửa - quán luôn sáng đèn.
- **Mùa + năm lấy theo bản chụp của chủ quán** (cây trồng, món theo mùa, đồ trang trí là nội dung của họ - dựng theo mùa người thăm sẽ ra lúa xanh giữa tuyết). Góc màn hình hiện dòng kiểu "🏡 Quán của … · Mùa Thu, năm 2". *(Nếu sau này muốn theo mùa người thăm 100% thì cây lệch mùa vẽ ở dạng trung tính.)*
- **Bản chụp nạp vào một `GameState` riêng**, tách hẳn state của mình: không ghi save, không dispatch lệnh kinh tế. Quán có khách ảo / nhân viên đi lại cho sinh động nhưng chỉ là hoạt cảnh (không tính tiền).
- **Tương tác của khách thăm** (tim, sticker, quà) đi vào hàng chờ trên máy chủ; chủ quán mở game lần sau mới nhận ("Lan ghé quán lúc 9h tối, tặng 3 bó rau muống 🌿"). Quà có giới hạn (vd mỗi người / mỗi ngày một lần, quà nhỏ) để chống lập tài khoản phụ chuyển đồ.
- **Không chat tự do** - chỉ câu / sticker soạn sẵn; tên quán qua bộ lọc từ cấm. Nhẹ pháp lý, an toàn cho trẻ em.
- **Tiền trong game không bao giờ quy đổi ra tiền thật** (không rút, không bán vật phẩm / tài khoản lấy tiền).

### Việc cụ thể

- [x] **F1 · Chế độ xem quán chỉ đọc từ một file save** *(24/11/2026, giai đoạn 19 - `?visit`; lối vào bằng file đã bỏ ở giai đoạn 20, giờ vào từ 🤝 Bạn bè → 🏡 Thăm; bản chụp cất trong sessionStorage, sim đứng yên, mọi lệnh bị chặn; dev: `?visit=jp&at=1200`)* *(Opus - làm trước, chưa cần máy chủ)* - nạp một file save (vd từ E2 xuất / nhập save) vào state riêng, dựng quán + nông trại của "người khác", dừng sim của mình, giờ trong ngày theo mình / mùa theo bản chụp, dải tên chủ quán ở góc, nút "← Về quán mình". Kiểm tra: mở save quán khác phong cách (Nhật / Hàn / Việt / Ốc), khác mùa, khác hạng.
- [x] **F2 · Hoạt cảnh cho quán đang thăm** *(24/11/2026, giai đoạn 19 - dùng chung vòng chiếu lại của "Xem trước": `prepareVisit` đưa bản chụp về 07:00, quán tự phục vụ rồi tua lại mỗi 90 phút game; trời / đèn theo `stage.clockMinute` = giờ người thăm)* *(Opus)* - khách ảo vào ngồi, nhân viên đi lại, không đụng kinh tế.
- [~] **F3 · Máy chủ + tài khoản** *(24/11/2026, giai đoạn 19 - chốt Supabase, lớp A: đăng nhập ẩn danh, kết bạn bằng mã / link mời / QR, công tắc "Cho bạn bè ghé thăm" tự đẩy quán mỗi khi hết ngày, danh sách bạn → 🏡 Thăm, nút "Gỡ dữ liệu online". Code + `supabase/schema.sql` xong; **chờ chủ dự án tạo project Supabase** rồi thử thật - hướng dẫn `08-ONLINE-SUPABASE.md`. Còn thiếu: trang chính sách quyền riêng tư. Lớp B để sau: gắn Facebook để tự có danh sách bạn)* *(Opus)* - đăng nhập, tải bản chụp lên / xuống, danh sách bạn bè (mã mời). Kèm **nút xoá tài khoản trong game** (CH Play / App Store bắt buộc) và cập nhật chính sách quyền riêng tư.
- [ ] **F4 · Tim, sticker, quà** *(Opus)* - hàng chờ trên máy chủ, nhận khi mở game, giới hạn quà.
- [ ] **F5 · Chợ chung (mức 2)** - để dành. Điều kiện trước khi làm: đã có người chơi thật, đã hỏi luật sư, đã có doanh nghiệp / hộ kinh doanh.

### Pháp lý cần hỏi luật sư trước khi mở online cho người chơi (chưa phải kết luận)

- Nghị định 147/2024/NĐ-CP về trò chơi điện tử: game có tương tác nhiều người qua máy chủ (G1) cần giấy phép + duyệt nội dung và phải là doanh nghiệp; G2–G4 nhẹ hơn. Mức 1 rơi vào loại nào - cần xác nhận.
- Dữ liệu cá nhân: Nghị định 13/2023 + Luật Bảo vệ dữ liệu cá nhân (hiệu lực 2026); GDPR nếu có người chơi châu Âu; chỉ thu đúng dữ liệu cần.
- Nội dung người chơi tạo ra: store đòi nút báo cáo / chặn người chơi.
- Trẻ em: COPPA (Mỹ), chính sách "Gia đình" của Google Play.

## Nhật ký

- **17/11/2026** - Dựng base (Fable 5.2): lõi sim, 3 khu 3D, thời tiết, ngày/đêm, siêu thị nội thất, dời bàn, camera xoay/zoom, giao diện ngang, cuốc đất + tưới + ao cá nâng cấp. 18 test.
- **18/11/2026** - Giai đoạn 1 (Opus 5.5): juice, nhân vật cử động, món 3D, cây 3 giai đoạn, âm thanh, HUD + lịch + Cài đặt, font Mali, người chơi làm bồi bàn (save v5). 25 test. Chi tiết: `07-NHAT-KY.md`.
