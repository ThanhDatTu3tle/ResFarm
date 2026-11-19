# Tầm nhìn game và các quyết định thiết kế

File này ghi lại **chủ dự án muốn gì** (để AI sau không phải đoán) và **mình đã quyết định gì thay cho những chỗ chưa nói rõ** (để biết chỗ nào đổi được).

## Ý tưởng gốc

Game quản lý hàng quán/nhà hàng kết hợp nông trại/sản xuất. Chơi kiểu thư giãn, vài người bạn cùng vào chơi cho vui. Chạy trên trình duyệt, ưu tiên chơi được trên điện thoại/iPad ở chế độ ngang.

Vòng lặp chính: **khách tới ăn → cần nguyên liệu → mua ngoài chợ (tốn tiền) hoặc tự trồng/nuôi (tốn thời gian) → tiền dư dùng nâng cấp quán**. Điểm hay nằm ở lựa chọn giữa mua và tự cung tự cấp.

## Yêu cầu chủ dự án đã nêu (theo thứ tự thời gian)

### Đợt 1 — ý tưởng

- Khởi đầu là quán ăn tối giản, về sau phát triển thành nhà hàng xịn.
- Quán có: 1 bàn lớn 6 người, 1 bàn vừa 4 người, 2 bàn đôi, 1 dãy bàn dài 4 ghế đơn đặt ngay trước gian bếp cho khách đi một mình. *(Sau đó đổi: bỏ bớt 1 bàn đôi, xem đợt 3.)*
- Bếp có 1 bếp trưởng và 1 bếp phó.
- Có thực đơn, mở khoá thêm món về sau.
- Nguyên liệu mặc định luôn có, không bao giờ hết: gạo, nước, dầu ăn...
- Nguyên liệu phải đi chợ mua hoặc trồng trọt/chăn nuôi mới có: rau, thịt, cá, trứng, sữa...
- Hệ thống thực đơn, nguyên liệu, quy trình trồng trọt chăn nuôi phải có nền đủ vững để phát triển tiếp.

### Đợt 2 — đồ hoạ và các khu

- Đồ hoạ 3D phong cách hoạt hình, giống dự án `co-thu-3d`.
- Mỗi khu một màn hình riêng: quán (chủ yếu nhìn bên trong, tông ấm), nông trại, chợ.
- Nông trại: các khu đất, mặc định 9 ô, mở rộng được; có chuồng nuôi gà...
- Chợ: trước mắt 3 sạp — thịt bò/heo/gà · rau, trứng, sữa · hải sản, cá, tôm, mực.
- Chuyển khu bằng nút ở hai bên màn hình.
- Có thời tiết (mưa, nắng, gió) và ngày/đêm.

### Đợt 3 — tinh chỉnh

- Một ngày trong game khoảng **20 phút thực**; thời gian nấu và thời gian cây/con lớn co giãn theo. Danh sách thời gian chi tiết và thực đơn chi tiết **chủ dự án sẽ đưa sau**, giao cho Opus/Sonnet nhập.
- Camera xoay và zoom được. Đồ hoạ, tông màu, model nhân vật hiện tại đã ổn.
- Trên điện thoại/iPad mặc định hiển thị ngang.
- Có "siêu thị" để mua vật phẩm nâng cấp quán: đổi sàn, sơn tường, nâng cấp bàn ghế...
- Cho phép di chuyển, đặt lại bàn ghế theo sở thích.
- Quán ban đầu nhỏ lại để còn cảm giác nâng cấp: bỏ 1 bàn đôi, dồn bàn gần nhau, thu gọn khu bếp.

### Đợt 4 — nông trại

- Tưới cây; trời mưa thì khỏi tưới. Đất đã tưới hoặc hứng mưa có màu sẫm hơn.
- Cuốc đất: đất có trạng thái chưa tơi xốp, phải cuốc mới gieo được.
- Thêm 1 ao cá; ao nâng cấp rộng ra để nuôi được nhiều cá hơn.
- Nền tảng phải đủ chuẩn để sau này đổi/nâng cấp model chi tiết hơn, đẹp hơn, nhiều hơn.

### Đợt 5 — Giai đoạn 1 (18/11/2026)

- Game phải "cute" và có cảm giác đã tay hơn: hiệu ứng nảy, hạt, nhân vật cử động, món ăn 3D, cây lớn theo giai đoạn, âm thanh.
- **Bỏ nét viền** hoạt hình: đã thử viền mảnh theo độ sâu, chủ dự án thấy "nhìn hơi bể" → gỡ.
- **HUD mới** tham khảo bố cục game nông trại kinh điển (không sao chép): đồng hồ ngày đêm, lịch trong năm, icon thời tiết, huy hiệu cấp; gom tốc độ / âm thanh / toàn màn hình vào nút bánh răng kèm hướng dẫn nhanh.
- **Bỏ thẻ chỉ dẫn** tên khu ở cả ba khu (hướng dẫn đã nằm trong bảng Cài đặt).
- **Font Mali** (chọn từ 6 font có hỗ trợ tiếng Việt).
- **Quán phải có việc cho người chơi làm:** người chơi đóng vai **bồi bàn** — mang menu (khách xem 3–7 giây), xác nhận món, lấy món ở **quầy ra món** giao đúng bàn; khách có 4 bậc tâm trạng Vui vẻ → Bình thường → Chán nản → Tức giận, mỗi bậc 10 giây.
- Nông trại và chợ **chưa cần** thêm việc ở giai đoạn này.

### Đợt 6 — Bác nông dân (18/11/2026)

- Nhân vật nông dân ở nông trại không đứng yên nữa mà **di chuyển theo tương tác**: bấm ô ruộng để trồng/tưới thì bác chạy tới thửa ruộng đó; bấm ao cá thì chạy ra ao; bấm chuồng thì chạy sang chuồng.
- Ngoài chợ không cần nhân vật phục vụ. (AI hiểu câu này là: chưa làm bồi bàn tự động S1.)

**AI tự chọn (đổi được):** bác làm lần lượt theo hàng việc (tối đa 24 việc), tới nơi mới có tác dụng; chạy ~5.6 m/giây thực, mỗi việc ~0.7 giây (`balance.farmer`); đi theo lối (ngang theo khe ruộng, dọc trên đường đất hoặc mép trái ruộng); đứng mép trước ruộng/chuồng, bờ trái ao; rảnh thì đứng yên tại chỗ vừa làm và thỉnh thoảng vẫy tay.

### Đợt 7 — Giai đoạn 2, chọn phong cách quán, con sông (18/11/2026)

- **F2 Khách quen: đồng ý làm.** Chủ dự án lo nhất phần **ngoại hình**: phải đa dạng độ tuổi, giới tính, ngoại hình; và với model khách hiện tại thì **khó nhận ra ai là khách quen** → cần thiết kế kỹ cách nhận diện (xem phương án ở `04-ROADMAP.md`, mục "Giai đoạn 2").
- **Màn hình mở đầu:** có menu. Chưa có server nên trước mắt chỉ có **"New game"**. Bấm Play → chọn **phong cách quán**:
  - 🇯🇵 **Quán Nhật** — sushi, cơm cuộn, mì ramen...
  - 🇰🇷 **Quán Hàn** — tokbokki, gà rán...
  - 🇻🇳 **Quán Việt** — cơm gia đình, phở, bún bò, hủ tiếu, cơm tấm...
- Màn chọn hiện **3 model ngoại thất** tương ứng 3 nước. Chọn xong thì vào quán có **nội thất thiết kế theo đặc trưng văn hoá** nước đó.
- **Nông trại và chợ dùng chung** cho cả 3 nước.
- **Nông trại có một con sông**, từ sông có **một con suối nhỏ dẫn nước vào ao**.
- Chủ dự án sẽ bổ sung ý trong lúc làm Giai đoạn 2 → ghi thêm vào đây.
- Giữ nút **Chơi tiếp** (save lưu trong trình duyệt); bấm Ván mới khi đã có save thì hỏi lại trước khi xoá. **Bản có chọn quán chơi lại từ đầu**: save cũ (trước v7) bị bỏ qua sau lần deploy này.

**AI tự chọn (đổi được):** thực đơn 3 nước (bảng ở mục "Nội dung đang có", chủ dự án duyệt/sửa), đồ trang trí từng quán (xem `src/ui/three/cuisine.ts`), phong cách quán cố định trong một ván (muốn đổi thì Ván mới), nút "Chơi lại từ đầu" trong Cài đặt thay bằng "Màn hình chính".

### Đợt 8 — Chỉnh sau khi thử Giai đoạn 2 phần đầu (18/11/2026)

- Menu mở đầu ổn. **Model 3 mặt tiền quán chưa ưng** → để vậy, có thời gian sẽ đầu tư chỉnh sau.
- Trong quán vẫn hơi to, **gian bếp to quá** → thu nhỏ; **bên trái gian bếp có lối vào WC và kho hàng**.
- **Ao to gấp đôi**; dời ao ra xa về phía **hạ lưu** con suối; **khu chuồng rộng ra**, trong chuồng có **rơm rạ**.
- Chưa thấy rõ chỗ mở rộng ô trồng / chuồng / ao → **vẽ đường đứt khúc** đánh dấu chỗ mở rộng được.
- Bấm vào chuồng (hay ô bất kỳ): **camera zoom vào vừa phải** cho cảm giác đúng chỗ; **bảng chỉ hiện loại ô đó** (bấm chuồng thì chỉ chuồng), không hiện cả nông trại.
- **Ruộng lúa mì** bên kia con suối, đối diện ruộng rau, ô to hơn. Bấm thu hoạch là bác **tự lái máy cày thu, tự gieo lại, chở tới cối xay gió** làm **bột mì** (để làm mì sợi, bánh mì). Mua thêm được **1 cối xay gió** và **nhiều ruộng lúa mì**.
- **Ruộng lúa nước** (ngập nước) tương tự → thành phẩm làm **bánh phở, bánh gạo**...
- **Nắng theo giờ:** sáng sớm / chiều nắng nhẹ, trưa nắng gắt, cảnh sáng hơn. **Gió:** gió nhẹ có **sợi gió bay**, cây đung đưa; gió mạnh tăng cường độ; ngẫu nhiên theo thời gian trong ngày.
- **Nông trại có đèn phát sáng buổi tối.**

**AI tự chọn (đổi được):** quán 640×540 (cũ 720×600), bếp 3.4 m; cối chế biến cho người chơi **chọn thành phẩm** (cối xay gió: bột mì / mì sợi / bánh mì; nhà xay lúa: bánh phở / bún / bánh gạo), 1 lúa → 1 thành phẩm, 10 phút game mỗi phần; tối đa 4 ruộng lúa mì, 4 ruộng lúa nước, 2 cối mỗi loại; gieo lại tự động vẫn trừ tiền giống (thiếu tiền thì ô để trống, có thông báo); thêm 3 món dùng bánh mì (bánh mì thịt, sandwich heo chiên xù, bánh mì nướng đường phố); ao nằm dọc suối, bác đứng bờ sau ao; zoom = 55–62% khoảng cách mặc định, đóng bảng thì camera lướt về.

### Đợt 9 — Chỉnh nông trại lần 2 (18/11/2026)

- **Vệt gió** phải thật mỏng, ít, ngắn, hơi uốn lượn — chỉ để có cảm giác.
- **Cối xay gió** về chỗ cũ: phía bắc, sau hàng rào.
- **Ao** không tròn: cong, méo tự nhiên. **Mở rộng ao = nới rộng diện tích ao**, không xây thêm ao mới.
- Khu 4 ô bên kia suối: **2 ô cạnh sông là ruộng lúa nước** (mặc định 1, ô kia phải mở rộng), **bên cạnh là ruộng lúa mì**.
- **Nhà xay lúa** đặt sát bờ sông, ở vị trí cối xay gió cũ (phía nam).

**AI tự chọn (đổi được):** ao 4 bậc (6 → 7.8 → 9.6 → 11.4 m bề ngang), viền đứt khúc của ao là hình ao ở bậc kế tiếp; lúa mì tối đa 2 ô (khu đã chốt 4 ô); mương nhỏ dẫn nước sông vào ruộng lúa nước; bỏ lối dọc bên trái (x = -8.3) — mọi chỗ đều tới được qua đường đất giữa, lối trái làm bác chạy ngang xuyên ruộng; vệt gió là nét 1 px dài ~1.2 m, tối đa 6 sợi.

### Đợt 10 — Nhà lồng / nhà màng (18/11/2026)

- Thêm **một căn nhà lồng kính / nhà màng nông nghiệp** phía nam ao. Mở rộng giống ao: **nhà dài ra về phía đông**, không xây thêm căn mới.
- Có **giao diện bên trong** (tham khảo ảnh nhà màng thật, vẫn theo phong cách đồ hoạ của game): mặc định **8 ô đất nhỏ, 4 ô mỗi bên, lối đi ở giữa**.

**AI tự chọn (đổi được):** mỗi lần nới rộng +4 luống (+3.8 m), tối đa 20 luống; trồng được mọi rau củ của ruộng; không cần cuốc / tưới (có tưới nhỏ giọt), lớn nhanh hơn 30%; vào bên trong bằng cách bấm nhà kính ở nông trại hoặc nút chuyển khu (nhà kính nằm bên trái nông trại); trong sim bác nông dân đứng ở cửa nhà kính, khu bên trong vẽ bác cạnh luống đang làm.

### Đợt 11 — Chợ (18/11/2026)

- Chợ có thêm **đường và xe cộ chạy qua lại**; **vỉa hè rộng gấp đôi**.
- Gian hàng có **bảng tên**: thịt "Chuyên thịt heo/lợn", rau "Tạp hóa cậu Ba", hải sản "Hải sản Tuyết Nhung" (kèm **bảng chân đứng** "Chuyên các loại ốc" — chữ to, đã đổi từ "Chuyên các loại ốc, nghêu, sò"), đồ khô "Chuyên đồ khô, mì, bún, phở".

**AI tự chọn (đổi được):** tên sạp trong bảng Chợ cũng đổi theo bảng tên; "đồ kho" hiểu là "đồ khô"; xe gồm ô tô, xe tải nhỏ, xe máy (người lái đội mũ bảo hiểm), chạy 2 làn ngược chiều, đèn xe sáng khi tối; có vạch qua đường, đèn đường và cây trên vỉa hè.

### Đợt 12 — Nhiệm vụ hệ thống (18/11/2026)

- Thêm **nhiệm vụ hệ thống** để tăng tương tác, đỡ nhàm chán: 5–7 nhiệm vụ từ dễ đến khó, dựa trên luật hiện có của game.

**AI tự chọn (đổi được, sửa ở `src/data/quests.ts`):** chuỗi 7 nhiệm vụ làm lần lượt, mỗi lúc một nhiệm vụ, hiện trên HUD; xong phải bấm "Nhận thưởng" mới mở nhiệm vụ kế; thưởng không tính vào doanh thu ngày.

| # | Nhiệm vụ | Mục tiêu | Thưởng |
| --- | --- | --- | --- |
| 1 | 🍽️ Khai trương | Phục vụ xong 3 nhóm khách | 50 xu, 10 XP |
| 2 | 🌱 Tay nhà nông | Thu hoạch 4 lần ở nông trại | 60 xu, 15 XP |
| 3 | 📖 Thực đơn phong phú | Mở khoá thêm 1 món | 100 xu, 20 XP |
| 4 | 💖 Khách vui lòng | 8 nhóm khách để lại tiền tip | 150 xu, 30 XP |
| 5 | 🌬️ Cối quay đều | Cối xay làm ra 16 thành phẩm | 200 xu, 40 XP |
| 6 | 🔥 Ngày đắt hàng | Doanh thu một ngày đạt 600 xu | 300 xu, 60 XP |
| 7 | ⭐ Quán có tiếng | Uy tín đạt 4 sao | 500 xu, 100 XP |

### Đợt 13 — Khách quen + Giai đoạn 3 "Quán của riêng mình" (19/11/2026)

- Làm **F2 Khách quen** trước rồi vào **Giai đoạn 3** (F4 đồ trang trí tự do, F5 tên quán / thú cưng / chụp ảnh, C3 nâng hạng quán, B2 xoay bàn, B7 mua thêm bàn).

**AI tự chọn (đổi được):**
- 8 khách quen (sửa ở `src/data/regulars.ts`): Bé Na, Cu Tí mở từ đầu; Chị Thảo, Anh Tâm, Cô Lan, Chú Hùng, Bà Tư, Ông Sáu mở dần theo uy tín + cấp. Món ruột theo từng quán (vd Bà Tư: phở / udon / sundubu).
- Tim: lần ghé thứ 1 / 3 / 6 / 10 / 15 lên 1 tim; mỗi tim +12% tip, đúng món ruột +50% tip và thêm uy tín; đủ 3 tim tặng một món đồ trang trí riêng. Mỗi khách quen ghé tối đa 1 lần / ngày, đi tối đa 2 người.
- Vòng sáng dưới chân khách quen màu **hồng** (không phải vàng như thiết kế gốc) để không trùng vòng vàng của bồi bàn.
- 3 hạng quán: Quán nhỏ → Tiệm ăn (cấp 4, 1.500 xu) → Nhà hàng (cấp 6, 4.000 xu); mỗi hạng phòng ăn sâu thêm 2 mét về phía cửa.
- Thú cưng: Mèo mướp (khách kiên nhẫn +6%), Cún vàng (khách tới +6%). Bán lại đồ / bàn được 50% giá.
- Trước cửa có "lối ra vào" không đặt bàn / đồ được (chỗ khách xếp hàng).

### Đợt 14 — Chỉnh theo phản hồi (19/11/2026)

- Khách quen: chủ dự án thấy hơi lạ với người chơi nhưng **cứ để chạy thử**.
- Nông trại: bỏ nhánh suối phía đông ao; vườn cây ăn quả (cam, táo, xoài, chuối) 8 gốc, có sẵn 1 cam + 1 táo; đường đất thêm đá, cát.
- Quán: bỏ bàn thờ (cả 3 quán); quán khởi đầu nhỏ lại — 1 bàn bốn, 2 bàn đôi, 3 ghế quầy; khách thưa hơn chút; bồi bàn đưa menu xong đứng yên tại bàn; 1 ngày 12 phút, giờ chạy 06:00–24:00; 2 ca 07:00–12:00 và 15:00–20:00; khay bưng cả bàn ở quầy ra món (kéo thả món vào khay 2 / 4 ô); chén dĩa dơ phải dọn; vết bẩn sau mỗi ca, bấm giữ để lau; tường hai bên đầy đủ; tổng kết ngày kèm kho.
- Chợ: thêm xe hủ tiếu, gánh bánh tráng trộn, xe cà phê dạo (trên vỉa hè), tiệm ăn vặt / trà sữa cạnh quầy đồ khô; sạp thịt đổi tên "Thịt bò/lợn cô Bủm"; bấm sạp thì zoom sát vào.
- Giao diện: nút không bị tai thỏ / góc màn hình che, tránh góc logo Netlify; bảng nhiệm vụ bấm xem chi tiết.

**AI tự chọn (đổi được):** món dùng trái cây (Đĩa trái cây, Chè chuối, Sandwich trái cây, Trà trái cây hwachae); hàng rong mới bán nguyên liệu có sẵn với giá cao hơn 10%; nhóm 5–6 người chỉ tới khi có bàn đủ chỗ; khay 2 ô dành cho bàn đôi / quầy, 4 ô cho bàn từ 3 ghế; mỗi ca để lại 3 vết bẩn, vết cũ bẩn thêm, mỗi bậc bẩn làm khách kém kiên nhẫn 1.5% (tối đa −20%).

### Giai đoạn 6 — Mùa vụ và lễ hội (19/11/2026)

- Chủ dự án chọn hướng "mùa vụ + lễ hội" cho giai đoạn 6. Bỏ Tết Đoan Ngọ, giữ 5 lễ.

**AI tự chọn (đổi được):** mùa của từng giống (rau cải Xuân/Thu, cà chua Xuân/Hạ, hành tây Xuân/Hạ/Thu, cà rốt Xuân/Thu, khoai tây Hạ/Thu, dưa leo Xuân/Hạ, ớt Hạ/Thu, lúa mì Xuân/Thu, lúa nước Hạ/Thu); cây ăn quả, vật nuôi, cá quanh năm (chỉ nghỉ Đông); cây trái mùa héo kiểu Stardew (cây chín thì giữ); giá chợ ×0.85 / ×1.3, món hợp mùa +20% (Xuân tươi mát, Hạ món lạnh / trái cây, Thu nướng / om, Đông món nước nóng); 5 lễ hội và hiệu ứng (bảng trong Sổ tay); năm đầu không ăn Tết ngày khai trương; bão dập 35% ô ngoài trời mất nửa tiến độ.

### Đợt 18 — HUD gọn lại, bốn mùa (19/11/2026)

- Thẻ nhiệm vụ nằm cạnh tiền và sao. Đồng xu luôn màu vàng.
- 5 nút Nông trại, Quán, Chợ, Nhân viên, Siêu thị thành nút tròn chỉ có icon, xếp dọc dưới nút Cài đặt. Thanh dưới còn Khách quen, Thực đơn, Kho và 2 nút chuyển khu (đổi màu cho dễ phân biệt). Nút ✕ của các bảng to hơn.
- Đồng hồ viết chữ rõ ràng: Thứ 2 Ngày 1, Mùa Xuân, Mở cửa / Nghỉ trưa / Đóng cửa.
- Lịch như Stardew Valley: 4 mùa, mỗi mùa 28 ngày. Cuối mùa, cuối năm có tổng kết doanh thu.
- Thời tiết bốn mùa: Xuân đẹp như cũ, Hạ tông vàng cam, Thu gió mạnh và cam nhiều hơn vàng, Đông tuyết rơi, mọi người quàng khăn. Mùa Đông không trồng trọt và chăn nuôi ngoài trời, sông hồ đóng băng; nhà kính vẫn trồng được.

**AI tự chọn (đổi được):** mùa Đông cây ngoài trời đang trồng dở chỉ ngừng lớn (không chết), sang Xuân lớn tiếp; ruộng tự động không gieo lại giữa mùa Đông; thời tiết mùa Đông có "Tuyết rơi" thay cho mưa; tổng kết hiện ngay trên màn hết ngày 28 (không thêm màn riêng); save cũ bắt đầu đếm doanh thu mùa / năm từ lúc nâng cấp.

### Đợt 17 — Gọi món cho cả đội, vào bên trong quầy chợ (19/11/2026)

- Trưa: quán đóng 12:00, 11:30 ngưng nhận khách. Tối: quán đóng 21:00, 20:30 ngưng nhận khách. Đóng cửa xong cả đội (nhân viên, đầu bếp, bác nông dân) ra chợ ăn.
- Người chơi được chọn món cho từng người; sắp tới giờ vào ca mà chưa chọn thì hệ thống tự chọn và gửi hoá đơn.
- Bác nông dân về nông trại sớm hơn nhưng tiền ăn của bác gộp chung một hoá đơn (không hiện 2 lần).
- Tiệm 25caaaaa: Matcha thay trà sữa trân châu, thêm Mì Ý. Gắn biển logo cho tiệm.
- Bấm 4 sạp chợ và Tiệm 25caaaaa thì zoom hẳn vào bên trong (như nhà kính): sạp có khay hàng + giá, bấm mua; tiệm có người ngồi ăn và bảng menu để chọn món.

**AI tự chọn (đổi được):** gọi món xong ăn 30 phút; hạn chọn = giờ về trừ 30 phút (bác 12:30, đội quán 13:30, tối 21:30); bảng gọi món tự mở khi đội ra chợ; khay hàng phía sau đặt trên bậc cao; logo đã cắt bỏ dòng số điện thoại (repo công khai); hàng rong ngoài vỉa hè vẫn chỉ lướt camera tới (chưa có cảnh bên trong).

### Đợt 16 — Cả đội có giờ nghỉ (19/11/2026)

- Cây ăn quả đứng yên; cây nào ra trái nấy; cây chuối không phải thân gỗ.
- Quầy ra món hiện dọc bên phải như các bảng khác; xếp món vào khay rồi người chơi bấm khay, bấm bàn để bưng (không tự bưng). Lau sàn bấm 1 cái. Đèn lồng, quạt, máy hút khói treo cao hơn. Phục vụ chậm hơn nữa; bếp nấu nhanh hơn, bếp phó nhanh bằng bếp trưởng.
- Xe trên đường cùng tốc độ. Hàng rong và Tiệm 25caaaaa không phải chỗ mua nguyên liệu, chỉ bán đồ ăn cho nhân viên.
- Bảng quản lý nhân viên: đầu bếp, phục vụ, bác nông dân; mỗi người 30 năng lượng (đầu bếp nấu 1 món −2, phục vụ / bác nông dân mỗi việc −1).
- Hết ca sáng đội quán ra chợ ăn, 14:00 về chuẩn bị ca chiều; bác nông dân 13:00 về. Sau 20:00 cả đội ra chợ ăn tối. Lúc đó quán / nông trại tạm ngưng, bấm thì có lời nhắc. Mỗi người tự chọn món, xong hiện hoá đơn cho người chơi trả, tổng không vượt số tiền đang có.
- Nút "Kết thúc ngày" sau 21:00; nút chuyển khu nằm sát trên thanh công cụ.

**AI tự chọn (đổi được):** đội quán chỉ ra chợ khi quán đã vắng khách (khách còn xếp hàng lúc hết ca thì về, không trừ uy tín); xỉu vẫn giữ bồi dưỡng 100 xu (hồi 15); nghỉ trưa hồi thêm 10 ngoài món ăn; ngủ qua đêm đầy 30; hoá đơn quên trả thì sang ngày tự trả; giá món hàng rong: cà phê 8–10 (+5–7), bánh tráng 14–18 (+9–11), hủ tiếu 22–27 (+13–15), Tiệm 25caaaaa 30–42 (+16–22); trái cây giờ chỉ có từ vườn; uy tín lên chậm lại (~0.4⭐/ngày); lau nhà, dọn bàn của nhân viên thuê cũng −1.

### Đợt 15 — Nhân viên phục vụ (19/11/2026)

- Bồi bàn đi chậm lại. Bấm món ở quầy thì phải chọn bàn để giao, hoặc kéo vào khay 2 / 4 ô — không tự thêm vào khay.
- Thuê nhân viên phục vụ, giao được các việc: bưng món, đưa menu, dọn bàn, dọn dẹp quán. Phải nâng hạng quán: mỗi bậc thêm 1 nhân viên, tối đa 4.
- Nhân viên có thanh năng lượng, tốn mỗi lần làm việc; cạn thì xỉu, bồi dưỡng nhanh 100 xu. Giờ nghỉ cho đi ăn hàng rong ở chợ, năng lượng từ ít đến nhiều: cà phê → bánh tráng → hủ tiếu → tiệm ăn vặt (đổi tên "Tiệm 25caaaaa").

**AI tự chọn (đổi được):** hạng quán thêm 2 bậc (Quán đông khách, Nhà hàng nổi tiếng) để đủ 4 bậc lên hạng; phí thuê 300 xu/người, chưa có lương; mỗi việc tốn 3 năng lượng (100 = ~33 việc); bồi dưỡng hồi về 60; qua đêm hồi thêm 40 (người đang xỉu cũng tỉnh); suất ăn: cà phê 15 xu +25, bánh tráng 25 xu +40, hủ tiếu 35 xu +60, Tiệm 25caaaaa 45 xu +80, đi ăn mất 40–70 phút game; bồi bàn của người chơi không có năng lượng; "Menu" gồm cả ghi món.

## Quyết định mình đã tự đưa ra (đổi được)

Những chỗ chủ dự án chưa nói rõ, mình chọn phương án đơn giản nhất chơi được. Tất cả đều là con số hoặc dữ liệu, sửa không đụng kiến trúc.

| Chủ đề | Đã chọn | Sửa ở đâu |
| --- | --- | --- |
| Giờ mở cửa | 08:00–22:00; hết giờ chờ khách cuối về rồi hiện bảng tổng kết; bấm nút mới sang ngày | `balance.ts` (`openMinute`, `closeMinute`) |
| Ban đêm | Game không chạy qua đêm; nông trại được cộng 600 phút game khi sang ngày | `balance.nightMinutes` |
| Trời tối | Hoàng hôn 17:30–19:30, sau đó tối tới lúc đóng cửa | `updateEnv()` trong `stage.ts` |
| Gọi món | Mỗi khách 1 món, chọn ngẫu nhiên theo `popularity` trong các món đang bán **và còn đủ nguyên liệu**; nguyên liệu trừ lúc bồi bàn ghi món | `customers.ts` (`placeOrders`) |
| Hết nguyên liệu | Không còn món nào nấu được → cả nhóm bỏ về, mất uy tín | `balance.reputation.noFood` |
| Phục vụ | Người chơi là bồi bàn; bồi bàn đi thật (≈3 giây thực băng qua quán), làm việc theo thứ tự được giao; bưng 1 món mỗi lượt | `service.ts`, `balance.service` |
| Tâm trạng | Chỉ tụt khi món **đã nấu xong nằm ở quầy** mà chưa bưng (thời gian bếp nấu không tính, vì món nấu 20–50 giây). 4 bậc × 10 giây, quá bậc cuối thì bỏ về. Tip ×1 / ×0.6 / ×0.25 / ×0 | `balance.service.moodStep`, `moodTip` |
| Chờ phục vụ | Chờ menu hoặc chờ ghi món ~64 giây thực thì bỏ về; bồi bàn đang tới thì khách không mất kiên nhẫn | `balance.service.menuPatience`, `orderPatience` |
| Giao món | Hai bàn gọi cùng món thì món ra trước giao bàn nào cũng được (hai đơn đổi chủ); giao bàn không gọi món đó thì báo lỗi | `service.ts` (`service/deliver`) |
| Bếp quá tải | Chờ món quá `foodPatience` (120 phút game, tăng từ 80 vì giờ có thêm thời gian bưng) thì bỏ về | `balance.foodPatience` |
| Lịch | Ngày 1 = Thứ Hai mùng 1 Xuân năm 1; mùa 28 ngày; mới dùng để hiển thị | `data/calendar.ts`, `sim/calendar.ts` |
| Uy tín | 0–5 sao, ảnh hưởng lượng khách | `customers.ts`, `balance.reputation` |
| Cấp độ | XP = nửa doanh thu món; cấp mở khoá món, giống, nội thất | `helpers.ts` (`xpForLevel`), `balance.xpPerCoin` |
| Giá chợ | Dao động ±20–25% mỗi ngày theo từng mặt hàng | `balance.marketSwing` |
| Thời tiết | 4 kiểu, đổi ngẫu nhiên mỗi 2–7 giờ game. Mưa: cây lớn +30%, khách −20%, đất tự ẩm | `weather.ts` |
| Tưới | Một lần tưới giữ ẩm 300 phút game (~7 phút thực). Đất khô cây vẫn lớn nhưng chỉ bằng 35% | `balance.farm` |
| Cuốc đất | Ruộng mới và ruộng vừa thu hoạch đều phải cuốc lại. Chuồng và ao không cần | `SlotTypeDef.needsTilling` |
| Ao cá | Có sẵn 1 ao; nới rộng 2 lần (sản lượng ×1.6, ×2.4); mua thêm ao từ cấp 3, tối đa 3 ao | `farm.ts` (data) |
| Nội thất | Vài món đắt có thêm hiệu ứng nhỏ (kiên nhẫn, tip, giá món) | `decor.ts` |
| Dời bàn | Chỉ dời được bàn trống; quầy trước bếp cố định; chưa xoay được bàn | `layout.ts` |
| Bàn thứ 5 | "Bàn góc vườn" 4 chỗ, mở bằng trang thiết bị ở Siêu thị | `restaurant.ts` (data) |

## Nội dung đang có

Con số bên dưới là **giá trị tạm để chơi thử**, chưa cân bằng. Thời gian tính bằng phút game (÷ 0.7 ra giây thực).

### Thực đơn theo phong cách quán (42 món)

Mỗi ván chọn một quán; chỉ thấy món của quán mình. Nguồn: `src/data/recipes.ts` (bảng dưới sinh từ file đó ngày 18/11/2026).

#### 🇻🇳 Quán Việt (16 món)

| Món | Nguyên liệu | Nấu | Giá | Mở khoá |
| --- | --- | --- | --- | --- |
| Cơm trứng chiên | gạo, dầu ăn, trứng ×2 | 15 | 18 | có sẵn |
| Rau cải xào | rau cải ×2, dầu ăn, muối | 12 | 16 | có sẵn |
| Canh cà chua trứng | cà chua ×2, trứng, nước | 18 | 22 | có sẵn |
| Cơm gà | gạo, thịt gà, hành tây | 25 | 38 | cấp 2 · 150 |
| Cơm tấm sườn | gạo, thịt heo, trứng, nước mắm | 28 | 42 | cấp 2 · 180 |
| Thịt kho trứng | thịt heo, trứng ×2, nước mắm | 30 | 44 | cấp 2 · 200 |
| Hủ tiếu Nam Vang | bún, thịt heo, tôm, nước | 26 | 46 | cấp 2 · 250 |
| Bánh flan | trứng ×2, sữa ×2 | 20 | 34 | cấp 3 · 300 |
| Cá chiên sốt cà | cá, cà chua ×2, dầu ăn | 28 | 50 | cấp 3 · 350 |
| Phở bò | bánh phở, thịt bò, hành tây, nước | 30 | 58 | cấp 3 · 400 |
| Bún bò Huế | bún, thịt bò, ớt, nước | 32 | 60 | cấp 3 · 450 |
| Cơm gia đình | gạo, thịt heo, rau cải, cà chua, trứng | 40 | 78 | cấp 4 · 500 |
| Tôm rang ớt | tôm ×3, ớt, hành tây | 25 | 66 | cấp 4 · 600 |
| Mực xào sa tế | mực ×2, hành tây, ớt | 25 | 68 | cấp 4 · 600 |
| Cà ri gà | thịt gà, khoai tây ×2, cà rốt, sữa | 35 | 72 | cấp 4 · 650 |
| Bò lúc lắc | thịt bò ×2, khoai tây, hành tây | 35 | 96 | cấp 5 · 1000 |

#### 🇯🇵 Quán Nhật (13 món)

| Món | Nguyên liệu | Nấu | Giá | Mở khoá |
| --- | --- | --- | --- | --- |
| Cơm nắm onigiri | gạo, rong biển, muối | 12 | 16 | có sẵn |
| Trứng cuộn tamagoyaki | trứng ×2, nước tương, dầu ăn | 15 | 20 | có sẵn |
| Súp miso | đậu phụ, rong biển, tương miso, nước | 15 | 20 | có sẵn |
| Cơm cuộn maki | gạo, rong biển, dưa leo, cá | 22 | 36 | cấp 2 · 150 |
| Gà teriyaki | thịt gà, nước tương, gạo | 25 | 40 | cấp 2 · 200 |
| Sushi cá hồi | gạo, cá hồi | 20 | 48 | cấp 3 · 300 |
| Tôm tempura | tôm ×2, bột mì, dầu ăn | 24 | 50 | cấp 3 · 350 |
| Mì ramen | mì sợi, thịt heo, trứng, tương miso, nước | 32 | 58 | cấp 3 · 400 |
| Mì udon nấm | mì sợi, nấm, nước tương, nước | 26 | 46 | cấp 3 · 350 |
| Bánh takoyaki | bột mì, mực, trứng | 24 | 54 | cấp 4 · 500 |
| Cơm heo chiên xù | gạo, thịt heo, trứng, bột mì | 32 | 66 | cấp 4 · 600 |
| Sashimi thập cẩm | cá hồi ×2, cá | 22 | 84 | cấp 4 · 700 |
| Cơm bò gyudon | gạo, thịt bò ×2, hành tây, nước tương | 32 | 92 | cấp 5 · 1000 |

#### 🇰🇷 Quán Hàn (13 món)

| Món | Nguyên liệu | Nấu | Giá | Mở khoá |
| --- | --- | --- | --- | --- |
| Cơm cuộn kimbap | gạo, rong biển, cà rốt, trứng | 18 | 22 | có sẵn |
| Kimchi cải thảo | rau cải ×2, ớt, tương ớt hàn | 12 | 16 | có sẵn |
| Trứng hấp gyeran-jjim | trứng ×2, nước, muối | 15 | 20 | có sẵn |
| Tokbokki | bánh gạo ×2, tương ớt hàn, hành tây | 20 | 34 | cấp 2 · 150 |
| Gà rán Hàn Quốc | thịt gà, bột mì, dầu ăn, tương ớt hàn | 28 | 46 | cấp 2 · 250 |
| Mì cay ramyeon | mì sợi, trứng, ớt, nước | 22 | 38 | cấp 2 · 200 |
| Canh kimchi jjigae | rau cải, thịt heo, đậu phụ, tương ớt hàn | 30 | 50 | cấp 3 · 350 |
| Cơm trộn bibimbap | gạo, trứng, cà rốt, nấm, thịt bò | 30 | 58 | cấp 3 · 400 |
| Canh đậu phụ non cay | đậu phụ ×2, tôm, trứng, tương ớt hàn | 28 | 54 | cấp 3 · 400 |
| Bò nướng bulgogi | thịt bò, hành tây, nước tương | 32 | 72 | cấp 4 · 600 |
| Ba chỉ nướng | thịt heo ×2, rau cải | 30 | 66 | cấp 4 · 550 |
| Bánh xèo hải sản pajeon | bột mì, mực, tôm, trứng | 30 | 80 | cấp 5 · 900 |
| Sườn bò om galbi-jjim | thịt bò ×2, cà rốt, khoai tây, nước tương | 40 | 98 | cấp 5 · 1100 |

### Nông trại

| Thứ trồng/nuôi | Ô | Giá giống | Lớn | Cho | Lặp lại | Cấp |
| --- | --- | --- | --- | --- | --- | --- |
| Rau cải | ruộng | 2 | 180 | 3 rau cải | không | 1 |
| Cà chua | ruộng | 3 | 240 | 4 cà chua | không | 1 |
| Hành tây | ruộng | 2 | 200 | 4 hành tây | không | 1 |
| Cà rốt | ruộng | 3 | 260 | 4 cà rốt | không | 2 |
| Khoai tây | ruộng | 3 | 300 | 5 khoai tây | không | 3 |
| Ớt | ruộng | 2 | 220 | 4 ớt | không | 3 |
| Dưa leo | ruộng | 2 | 210 | 4 dưa leo | không | 1 |
| Gà mái đẻ | chuồng | 60 | 240 | 3 trứng | mỗi 150 | 1 |
| Bò sữa | chuồng | 250 | 480 | 3 sữa | mỗi 240 | 3 |
| Gà thịt | chuồng | 15 | 480 | 4 thịt gà | không | 2 |
| Heo | chuồng | 30 | 720 | 6 thịt heo | không | 2 |
| Bò thịt | chuồng | 60 | 1200 | 7 thịt bò | không | 3 |
| Cá giống | ao | 20 | 600 | 5 cá | không | 1 |
| Cá hồi giống | ao | 40 | 720 | 4 cá hồi | không | 3 |
| Tôm giống | ao | 25 | 600 | 9 tôm | không | 4 |

Chỉ mua được ngoài chợ (chưa có nguồn tự làm): **mực, nấm và mọi đồ khô** (bánh phở, bún, mì sợi, bánh gạo, đậu phụ, rong biển, bột mì). Luôn có sẵn: gạo, nước, dầu, muối, nước mắm, nước tương, tương miso, tương ớt Hàn.

### Chợ

| Sạp | Bán |
| --- | --- |
| Quầy thịt chú Tư | thịt bò, thịt heo, thịt gà |
| Sạp rau - trứng - sữa cô Ba | rau cải, cà chua, hành tây, cà rốt, khoai tây, ớt, dưa leo, nấm, trứng, sữa |
| Hàng hải sản dì Năm | cá, tôm, mực, cá hồi |
| Tiệm đồ khô chị Sáu | bánh phở, bún, mì sợi, bánh gạo, đậu phụ, rong biển, bột mì |

## CHỜ CHỦ DỰ ÁN: danh sách thời gian và thực đơn

Chủ dự án nói sẽ đưa danh sách chi tiết. Khi có, điền theo mẫu dưới rồi giao cho Sonnet nhập (mẫu lời nhắc ở `00-DOC-TRUOC.md`).

**Mẫu bảng thời gian** (đơn vị: giây thực ở tốc độ x1 — AI sẽ tự nhân 0.7 ra phút game):

| Loại | Tên | Thời gian (giây thực) | Ghi chú |
| --- | --- | --- | --- |
| Nấu | Cơm trứng chiên | ? | |
| Lớn | Rau cải | ? | |
| Lớn lần đầu / chu kỳ sau | Gà mái đẻ | ? / ? | |
| Khách chờ xếp hàng | — | ? | hiện 86 giây |
| Khách chờ món | — | ? | hiện 114 giây + 17 giây mỗi người |
| Khách ăn | — | ? | hiện 43 giây |

**Mẫu bảng món:**

| Tên món | Biểu tượng | Nguyên liệu × số lượng | Giá bán | Cấp mở | Giá mở |
| --- | --- | --- | --- | --- | --- |

Nguyên liệu mới xuất hiện trong danh sách phải có nguồn (sạp chợ nào bán, hoặc cây/con nào cho) — game sẽ báo lỗi lúc khởi động nếu thiếu.

## Câu hỏi thiết kế còn mở

Chưa ai quyết; AI gặp thì hỏi chủ dự án thay vì tự chọn.

- ~~Có muốn người chơi tự tay phục vụ?~~ → Có (đợt 5). Còn mở: khi người chơi sang Nông trại/Chợ thì quán không ai phục vụ — có thuê **bồi bàn tự động** không (chủ dự án chưa trả lời)?
- Nâng hạng quán theo mốc (quán → tiệm → nhà hàng) hay nới dần từng chút?
- Bạn bè chơi **cùng nhau** (ghé thăm quán, trao đổi nông sản) hay mỗi người một quán riêng? Đây là quyết định lớn nhất về chi phí và kỹ thuật (xem `05-TRIEN-KHAI-CHI-PHI.md`).
- Thời gian có tiếp tục trôi khi tắt game không (cây lớn khi offline)?
- Có mùa trong năm (đã có lịch 4 mùa để hiển thị) — có làm **món theo mùa / thời tiết theo mùa** không?
