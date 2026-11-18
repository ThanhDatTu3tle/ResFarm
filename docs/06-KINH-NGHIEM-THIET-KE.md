# Kinh nghiệm thiết kế game nông trại / quản lý quán — áp vào Quán Nhà Vườn

Tổng hợp những bài học hay gặp ở thể loại "cozy sim" (nông trại, xây dựng, quản lý quán), lọc theo đúng hoàn cảnh dự án: **game cho một nhóm nhỏ người chơi thân quen, chơi thư giãn trên điện thoại/iPad ngang, đồ hoạ 3D toon dựng bằng code**. Viết 17/11/2026.

Đọc cùng `04-ROADMAP.md` — mục cuối file này xếp lại roadmap theo các bài học bên dưới.

---

## 1. Mười nguyên tắc cốt lõi của thể loại

### 1.1 Cozy = không phạt, chỉ thưởng ít hơn

Người chơi thể loại này mở game để **xả stress**, không để bị áp lực. Thất bại phải nhẹ và có lối ra.

- Khách bỏ về vì chờ lâu → hiện tại mất uy tín. Nên đổi thành "khách buồn, lần sau ít tip hơn" hoặc uy tín hồi lại nhanh. Không bao giờ để tiền âm, không bao giờ có "game over".
- Cây không chết vì quên tưới (đã đúng: đất khô vẫn lớn 35%). Giữ triết lý này cho mọi tính năng mới (bão chỉ làm *chậm*, không xoá cây; vật nuôi đói thì *ngừng cho sản phẩm*, không chết).
- Hết giờ thì luôn có màn tổng kết **tích cực**: nhấn vào cái đã đạt được ("Hôm nay phục vụ 42 khách, món được yêu thích: Phở bò 🍜"), không nhấn vào cái mất.

### 1.2 Ba vòng lặp lồng nhau — thiếu vòng nào game sẽ hụt

| Vòng | Thời lượng | Cảm giác | Hiện có |
| --- | --- | --- | --- |
| **Khoảnh khắc** | vài giây | bấm → có phản hồi đã tay | ✅ thu hoạch, mua — nhưng **thiếu "juice"** (xem 1.3) |
| **Phiên chơi** | 1 ngày game (~20 phút) | lên kế hoạch → thực hiện → tổng kết | ✅ ngày mở cửa + màn tổng kết |
| **Dài hạn** | nhiều ngày/tuần | "mai mình sẽ mở được X" | ⚠️ chỉ có cấp + mở món. **Cần thêm mục tiêu nhìn thấy trước** |

Vòng dài hạn là thứ khiến người chơi **quay lại ngày mai**. Luôn có 2–3 mục tiêu treo trước mắt, ở các tầm khác nhau: một cái xong trong hôm nay, một cái vài ngày, một cái "ước mơ" (nâng hạng nhà hàng).

### 1.3 "Juice" là chỗ rẻ nhất để game trông cute hơn gấp đôi

Cùng một model, thêm chuyển động là thấy sống ngay. Đây là việc ROI cao nhất về đồ hoạ — làm trước khi đụng tới model chi tiết hay glTF.

- **Squash & stretch**: cây bật lên khi chín, đồ vật nảy nhẹ khi đặt xuống, nút bấm lún khi chạm.
- **Pop khi thu hoạch**: sản phẩm bay vòng cung lên rồi bay về icon kho trên HUD; đồng xu bay về số tiền và số tiền "nhảy" lên.
- **Idle animation**: nhân vật/vật nuôi **chớp mắt**, thở (scale y ±2%), lắc lư; gà mổ đất; bò vẫy đuôi. Mắt chớp là chi tiết đơn lẻ làm tăng độ "đáng yêu" nhiều nhất.
- **Hạt**: tim ❤️ bay lên khi khách khen món, lấp lánh ✨ khi chín, giọt nước khi tưới, bụi khi cuốc, khói bếp.
- **Âm thanh**: tiếng "pop", "ting" tiền, nhạc nền nhẹ. Âm thanh chiếm một nửa cảm giác "đã tay".
- Dùng hàm easing có nảy (`easeOutBack`, `easeOutElastic`) thay cho tuyến tính — gần như miễn phí.

### 1.4 Ngôn ngữ hình ảnh "cute"

Quy tắc đã được kiểm chứng ở rất nhiều game cozy:

- **Hình tròn, bo góc** — không cạnh sắc. Hộp nên có bevel/bo nhẹ (dùng `RoundedBoxGeometry` hoặc capsule).
- **Tỉ lệ chibi**: đầu to (~40–50% chiều cao), mắt to đặt thấp trên mặt, chân tay ngắn. Áp dụng cả cho vật nuôi.
- **Bảng màu**: bão hoà vừa, sáng, thiên ấm; bóng đổ tím/xanh nhạt thay vì đen/xám. Một màu nhấn duy nhất cho thứ bấm được.
- **Nét viền** (outline): đã thử bản hậu kỳ theo độ sâu (18/11/2026) — chủ dự án thấy viền mảnh nhìn "bể", đã gỡ. Nếu thử lại thì cần viền dày, mượt (inverted hull cho riêng nhân vật/con vật) chứ không viền toàn cảnh.
- **Mặt có biểu cảm**: má hồng (2 hình tròn hồng mờ), miệng thay đổi theo tâm trạng khách (vui / chờ lâu / hài lòng).
- **Đất, cỏ có biến thể nhỏ**: hoa dại, sỏi, cỏ lốm đốm phân bố bằng `seeded()` — chống cảm giác "trống".

### 1.5 Sưu tầm và hoàn thành

Não người thích lấp đầy ô trống. Mỗi hệ thống nên có một "cuốn sổ":

- **Sổ công thức** (món đã nấu, số lần nấu, sao thành thạo món).
- **Bộ sưu tập nông sản** (lần đầu thu hoạch mỗi loại; thỉnh thoảng ra bản "vàng" hiếm có giá gấp đôi).
- **Album khách quen** (xem 1.6).
- **Thành tựu nhẹ nhàng** có phần thưởng là đồ trang trí độc quyền — không phải tiền.

### 1.6 Nhân vật có tên tạo ra gắn bó cảm xúc

Khách vô danh là "tài nguyên"; khách có tên là "bạn". Đây là khác biệt lớn nhất giữa game quản lý khô khan và game cozy được yêu.

- Vài **khách quen** xuất hiện định kỳ: có tên, ngoại hình cố định, món ruột, câu thoại ngắn.
- **Thanh thân thiết** (tim): phục vụ đúng món ruột → tăng; đủ mốc thì kể chuyện nhỏ, tặng quà (hạt giống hiếm, công thức bí mật, món trang trí).
- Có thể làm theo kiểu dữ liệu: `RegularDef { id, name, look, favoriteRecipe, lines[], gifts[] }` — đúng triết lý "nội dung là dữ liệu" của dự án.
- **Mẹo cho game chơi trong nhóm thân quen**: đặt khách quen theo bạn bè thật (tên, món ruột thật), thú cưng thật làm thú cưng trong quán, cho người chơi tự đặt tên quán. Những chi tiết này có giá trị hơn mọi tính năng.

### 1.7 Tự thể hiện (customization) giữ chân người chơi lâu nhất

Với nhiều người chơi cozy, **trang trí chính là game**, kinh tế chỉ là phương tiện kiếm tiền để trang trí.

- Đặt đồ trang trí **tự do** (cây, tranh, đèn, thảm) chứ không chỉ đổi màu theo slot.
- Đặt tên quán, chọn bảng hiệu.
- Chụp ảnh quán (ẩn HUD, góc máy đẹp, lưu PNG) — người chơi thích khoe.
- Nông trại cũng trang trí được: lối đi, hàng rào màu, bù nhìn.

### 1.8 "Làm tay trước, tự động hoá sau" là trục tiến trình

Việc lặp lại vui ở ngày 1, thành việc vặt ở ngày 10. Quy tắc: **mỗi việc tay chân đều có một phần thưởng tự động hoá ở cuối**.

| Việc tay | Tự động hoá mở về sau |
| --- | --- |
| Tưới từng ô | Bình tưới to (tưới 3×3) → vòi phun tự động |
| Cuốc đất | Cuốc tốt (cuốc theo hàng) |
| Thu hoạch | Giỏ lớn (thu cả khu) |
| Đi chợ | Đặt hàng giao tận nơi mỗi sáng |
| Phục vụ | Bồi bàn (C1) |

Cảm giác "ngày xưa mình phải làm tay hết" chính là cảm giác tiến bộ.

### 1.9 Kinh tế: vòi và cống

- **Vòi** (nguồn tiền): bán món, tip, đơn hàng. **Cống** (chỗ tiêu): nguyên liệu, mở món, nội thất, nâng cấp, mở rộng.
- Tiền phải **luôn có chỗ tiêu hấp dẫn kế tiếp**. Khi người chơi có tiền mà không biết mua gì, game đã chết.
- Quy tắc ngón tay cái: món mở khoá kế tiếp ≈ 1–1.5 ngày thu nhập; cột mốc lớn ≈ 5–7 ngày.
- Biên lợi nhuận phải dễ thấy: hiện "lãi/món" trong panel Thực đơn giúp người chơi tự tối ưu — đó là cái vui của thể loại quản lý.
- Tự trồng nên lợi hơn đi chợ khoảng 30–60% nhưng tốn thời gian/ô đất — để lựa chọn có ý nghĩa (đúng như `04-ROADMAP.md` B1).
- **Viết script mô phỏng trước khi chỉnh số** (B1). Cảm tính sẽ sai.

### 1.10 Mở dần tính năng (onboarding bằng nội dung)

Ngày 1 chỉ cần: trồng 1 loại cây, nấu 3 món, bán. Panel nào chưa dùng được thì **ẩn hoặc khoá kèm lời hứa** ("Mở khi đạt cấp 3"). Mỗi lần lên cấp mở **một** thứ mới kèm một câu giới thiệu ngắn. Người chơi không đọc hướng dẫn dài — họ học qua việc được dắt tay 3–5 bước đầu (B5).

---

## 2. Bài học riêng cho bối cảnh dự án

**Người chơi là những người cụ thể, quen biết.** Lợi thế cực lớn so với studio: hỏi trực tiếp được.

- **Quan sát chơi thử** quan trọng hơn hỏi ý kiến: ngồi cạnh xem 15 phút, không chỉ dẫn, ghi lại chỗ ngập ngừng, chỗ bấm nhầm, chỗ cười. Mỗi lần ngập ngừng là một lỗi UX.
- Hỏi "phần nào vui nhất?" và **làm sâu phần đó** thay vì dàn trải đều.
- Phát hành nhỏ và thường xuyên (mỗi tuần một thứ mới) tạo cảm giác "game đang lớn lên" — chính nó là một phần niềm vui.
- Có thể giấu "trứng phục sinh" mang ý nghĩa riêng (ngày kỷ niệm trong game có sự kiện đặc biệt...).

**Mobile, cầm ngang, chơi rảnh tay:**

- Vùng bấm ≥ 44px; thao tác chính nằm ở hai mép dưới (ngón cái với tới).
- Chơi được trong phiên 3–5 phút: tính năng **tiến trình khi offline** (C9) nên lên ưu tiên cao hơn, vì người chơi điện thoại mở/tắt liên tục.
- Bấm vào vật thể 3D tốt hơn mở panel. Panel là để xem thông tin, không phải để thao tác chính.

**Hiệu năng là một phần của "cute"**: giật lag phá cảm giác thư giãn. Giữ ngân sách trong `03-DO-HOA-3D.md` mục 6; đo trước khi thêm hậu kỳ nặng.

---

## 3. Roadmap đề xuất (xếp lại theo bài học)

Đánh số theo mã có sẵn trong `04-ROADMAP.md`; mã mới đánh `F*`.

### Giai đoạn 1 — "Sống động và đáng yêu" (ưu tiên cao nhất)

Không đổi gameplay, chỉ làm thứ đang có trở nên dễ thương. Người chơi thấy khác biệt ngay.

- [x] **F1 · Juice cơ bản** — easing có nảy, pop khi thu hoạch, xu bay về HUD, số tiền nhảy, nút lún khi bấm. *(Xong 18/11/2026: cũng đã có hạt khi cuốc/tưới/gieo/chín — một phần B4 — và đĩa nảy khi món ra bàn.)*
- [x] **D2 (rút gọn) · Nhân vật sống** — chớp mắt, thở, má hồng, đầu bếp đảo chảo; vật nuôi idle. *(Xong 18/11/2026: người chibi có khớp tay/chân/đầu trong `userData.rig`; đi vung tay, ngồi gập chân, ăn, nấu, vẫy chào; gà/heo/bò/cá chớp mắt, heo/bò vẫy đuôi.)*
- [x] **B4 · Hạt hiệu ứng** — giọt nước, bụi đất, khói bếp ☁️, tim 💖 khi khách trả tiền, lấp lánh. *(Xong 18/11/2026. D7 nét viền đã thử và gỡ — xem mục 1.4.)*
- [x] **C10 · Âm thanh** — vài hiệu ứng + nhạc nền nhẹ, nút tắt tiếng. *(Xong 18/11/2026: tổng hợp bằng Web Audio, không cần file hay API key; bật/tắt trong bảng Cài đặt ⚙️.)*
- [x] **D3, D4 · Món ăn và cây nhiều giai đoạn**. *(Xong 18/11/2026: 12 món có model 3D; cây mầm → non → trưởng thành.)*
- [x] **F7 · HUD kiểu game** *(làm thêm theo yêu cầu, 18/11/2026)* — huy hiệu cấp, đồng hồ ngày đêm, lịch 4 mùa, icon thời tiết; nút ⚙️ gom tốc độ/âm thanh/toàn màn hình + hướng dẫn nhanh; bỏ thẻ chỉ dẫn từng khu; font Mali.
- [x] **C1 · Người chơi làm bồi bàn** *(làm thêm theo yêu cầu, 18/11/2026)* — mang menu, ghi món, quầy ra món, giao đúng bàn, 4 bậc tâm trạng. Đây là vòng lặp "khoảnh khắc" chính của Quán. Việc mở ra tiếp: S1–S5 trong `04-ROADMAP.md`.

### Giai đoạn 2 — "Có lý do quay lại"

- **F2 · Khách quen + thân thiết** (system mới, `RegularDef` trong data, cần migration).
- **C7 · Bảng đơn hàng mỗi ngày** — mục tiêu ngắn hạn rõ ràng.
- **F3 · Sổ sưu tầm + thành tựu** — thưởng bằng đồ trang trí.
- **B5 · Dắt tay người mới** — và ẩn panel chưa dùng tới.
- **C9 · Tiến trình offline** (chỉ nông trại, có giới hạn).
- **B1 · Cân bằng kinh tế** bằng script mô phỏng.

### Giai đoạn 3 — "Quán của riêng mình"

- **F4 · Đặt đồ trang trí tự do** (mở rộng cơ chế kéo bàn đang có).
- **F5 · Tên quán, bảng hiệu, thú cưng**, chế độ chụp ảnh.
- **C3 · Nâng hạng quán**, **B2 · xoay bàn**, **B7 · mua thêm bàn**.

### Giai đoạn 4 — "Chiều sâu"

- **F6 · Công cụ tự động hoá nông trại** (bình tưới to, vòi phun, cuốc tốt).
- **C1, C2 · Bồi bàn, thuê nhân viên**.
- **C4 · Chế biến**, **C6 · Mùa và món theo mùa**, **C8 · Sự kiện ngẫu nhiên** (luôn là sự kiện vui, không phải phạt).

---

## 4. Dùng các skill đã cài thế nào

Đã cài vào `.claude/skills/` của dự án (33 skill Three.js) và `~/.claude/skills/impeccable` (global).

| Skill | Hợp với việc | Lưu ý |
| --- | --- | --- |
| `threejs-game-director` | Điểm vào chung, tự điều phối các skill con | Skill này mặc định dựng game mới từ scaffold. **Luôn nhắc nó tuân thủ `CLAUDE.md`**: giữ 4 tầng, không thay kiến trúc, không thêm thư viện runtime |
| `threejs-gameplay-systems` | Game feel, juice, vòng lặp, mục tiêu (F1, F2, C7) | Logic gameplay vẫn phải nằm trong `src/sim` và có test |
| `threejs-game-ui-designer` | HUD, panel, touch UI, safe area | Kết hợp `impeccable` để soát chất lượng UI HTML |
| `threejs-aaa-graphics-builder` | Phê bình hình ảnh, procedural model, ngân sách render | Giữ phong cách toon đã duyệt; "AAA" ở đây nên hiểu là *trau chuốt*, không phải *tả thực* |
| `threejs-procedural-geometry` | Model bo góc, lathe/extrude cho bàn ghế, đồ bếp, chậu cây | Hợp nấc 1 trong `03-DO-HOA-3D.md` |
| `threejs-procedural-vegetation` | Cỏ, hoa, cây cách điệu có gió | Chọn biến thể WebGL/stylized, tránh bản WebGPU nặng |
| `threejs-procedural-animation` | Spring, nảy, chuyển động mượt không phụ thuộc fps | Dùng cho F1, D2 |
| `threejs-precipitation-surfaces` | Mưa có vũng nước, mặt đất ướt | Kiểm tra hiệu năng trên điện thoại |
| `threejs-bloom` | Đèn đêm ấm | Hậu kỳ tốn — chỉ bật ở chất lượng cao |
| `threejs-debug-profiler` | Đo draw call, fps, bundle | Dùng trước/sau mỗi việc đồ hoạ |
| `threejs-qa-release` | Kiểm tra mobile, ảnh chụp, build | Trước mỗi lần deploy |
| `impeccable` | Soát/chỉnh giao diện HTML (HUD, panel) | Có hook tự soát sau mỗi lần sửa file UI |
| `threejs-3d-generator` / `image-generator` / `audio-generator` | Tạo model glTF (Tripo), ảnh (Gemini), âm thanh (ElevenLabs) | **Cần API key trả phí** (`TRIPO_API_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`). Không có key thì skill không chạy |

Những skill **ít liên quan** (giữ lại nhưng không cần dùng): `spectral-ocean`, `raymarched-space-effects`, `procedural-planets`, `parallax-occlusion-mapping`, `volumetric-clouds`, `atmosphere-aerial-perspective`, `temporal-surfaces`, `screen-space-ambient-occlusion`, `exposure-color-grading`, `image-pipeline` — thiên về tả thực, nặng, nhiều cái cần WebGPU; không hợp phong cách toon trên điện thoại.

Mẫu lời nhắc:

> Dùng `threejs-game-director`. Đọc `CLAUDE.md` và `06-KINH-NGHIEM-THIET-KE.md`. Làm nhiệm vụ F1 (juice cơ bản). Giữ nguyên kiến trúc 4 tầng và phong cách toon hiện có, không thêm thư viện runtime ngoài Three.js. Chạy `npm run typecheck` và `npm test`, rồi chụp ảnh trước/sau.
