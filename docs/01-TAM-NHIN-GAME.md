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

### Thực đơn (12 món)

| Món | Nguyên liệu | Nấu | Giá | Mở khoá |
| --- | --- | --- | --- | --- |
| Cơm trứng chiên | gạo, dầu, trứng ×2 | 15 | 18 | có sẵn |
| Rau cải xào | rau cải ×2, dầu, muối | 12 | 16 | có sẵn |
| Canh cà chua trứng | cà chua ×2, trứng, nước | 18 | 22 | có sẵn |
| Cơm gà | gạo, thịt gà, hành tây | 25 | 38 | cấp 2 · 150 |
| Thịt kho trứng | thịt heo, trứng ×2, nước mắm | 30 | 44 | cấp 2 · 200 |
| Bánh flan | trứng ×2, sữa ×2 | 20 | 34 | cấp 3 · 300 |
| Cá chiên sốt cà | cá, cà chua ×2, dầu | 28 | 50 | cấp 3 · 350 |
| Phở bò | bánh phở, thịt bò, hành tây, nước | 30 | 58 | cấp 3 · 400 |
| Tôm rang ớt | tôm ×3, ớt, hành tây | 25 | 66 | cấp 4 · 600 |
| Mực xào sa tế | mực ×2, hành tây, ớt | 25 | 68 | cấp 4 · 600 |
| Cà ri gà | thịt gà, khoai tây ×2, cà rốt, sữa | 35 | 72 | cấp 4 · 650 |
| Bò lúc lắc | thịt bò ×2, khoai tây, hành tây | 35 | 96 | cấp 5 · 1000 |

### Nông trại

| Thứ trồng/nuôi | Ô | Giá giống | Lớn | Cho | Lặp lại | Cấp |
| --- | --- | --- | --- | --- | --- | --- |
| Rau cải | ruộng | 2 | 180 | 3 rau cải | không | 1 |
| Cà chua | ruộng | 3 | 240 | 4 cà chua | không | 1 |
| Hành tây | ruộng | 2 | 200 | 4 hành tây | không | 1 |
| Cà rốt | ruộng | 3 | 260 | 4 cà rốt | không | 2 |
| Khoai tây | ruộng | 3 | 300 | 5 khoai tây | không | 3 |
| Ớt | ruộng | 2 | 220 | 4 ớt | không | 3 |
| Gà mái đẻ | chuồng | 60 | 240 | 3 trứng | mỗi 150 | 1 |
| Bò sữa | chuồng | 250 | 480 | 3 sữa | mỗi 240 | 3 |
| Gà thịt | chuồng | 15 | 480 | 4 thịt gà | không | 2 |
| Heo | chuồng | 30 | 720 | 6 thịt heo | không | 2 |
| Bò thịt | chuồng | 60 | 1200 | 7 thịt bò | không | 3 |
| Cá giống | ao | 20 | 600 | 5 cá | không | 1 |
| Tôm giống | ao | 25 | 600 | 9 tôm | không | 4 |

Chỉ mua được ngoài chợ (chưa có nguồn tự làm): **mực, bánh phở**.

### Chợ

| Sạp | Bán |
| --- | --- |
| Quầy thịt chú Tư | thịt bò, thịt heo, thịt gà |
| Sạp rau - trứng - sữa cô Ba | rau cải, cà chua, hành tây, cà rốt, khoai tây, ớt, trứng, sữa, bánh phở |
| Hàng hải sản dì Năm | cá, tôm, mực |

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
