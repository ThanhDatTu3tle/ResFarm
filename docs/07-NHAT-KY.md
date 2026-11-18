# Nhật ký làm việc

Mỗi phiên ghi một mục (mới nhất ở trên): đã làm gì, quyết định gì, còn dở gì, bắt đầu phiên sau từ đâu. Không ghi thông tin cá nhân (repo công khai).

---

## 18/11/2026 — Giai đoạn 1: game sống động + người chơi làm bồi bàn

**Model:** Claude Opus 5.5 (Claude Code, desktop). **Nhánh:** `giai-doan-1` (gộp vào `main` qua Pull Request). **Kết quả:** typecheck sạch, 25 test qua, build qua.

### Đã làm (theo thứ tự)

1. **Đọc toàn bộ tài liệu**, tổng hợp kinh nghiệm thiết kế cozy game → `06-KINH-NGHIEM-THIET-KE.md` (10 nguyên tắc, roadmap 4 giai đoạn mã F*, cách dùng skill).
2. **Cài skill cho Claude Code:** 2 bộ skill Three.js vào `.claude/skills/` của dự án (không đưa lên repo — cách cài lại ở `00-DOC-TRUOC.md`), skill `impeccable` cài global (có thêm hook vào `~/.claude/settings.json`).
3. **F1 · Juice:** `src/ui/ease.ts` (easing, wobble), `src/ui/juice.ts` (icon bay về HUD, bump, chữ nổi +/−, số tiền chạy dần), `src/ui/three/fx.ts` (hạt emoji). Nông trại tự phát hiệu ứng bằng cách so state với khung trước (`FarmArea.react()`): cuốc 💨, tưới 💧, gieo 🌱, chín ✨ + nảy lò xo, thu hoạch bung sản phẩm rồi bay về nút Kho. Quán: xu bay từ bàn về số tiền, đĩa nảy khi ra món. Nút lún khi bấm (CSS `scale`).
4. **D2 · Nhân vật sống:** `makePerson` dựng lại kiểu chibi có khớp (`userData.rig`), `animatePerson` (thở, chớp mắt, nhìn quanh, đi, ngồi, ăn, nấu, vẫy, bưng). Con vật chớp mắt, heo/bò vẫy đuôi.
5. **B4 · Hạt:** khói bếp ☁️ khi nấu, tim 💖 khi khách trả tiền.
6. **D7 · Nét viền:** làm bằng hậu kỳ theo độ sâu → **chủ dự án thấy "hơi bể" → đã gỡ hoàn toàn**.
7. **C10 · Âm thanh:** `src/ui/audio.ts` tổng hợp bằng Web Audio — hiệu ứng (cuốc, tưới, gieo, chín, thu hoạch, xu, mua, chuông, ding, buồn, lỗi, lên cấp, hết ngày), nhạc nền ngũ cung tự sinh, tiếng mưa theo thời tiết. Không cần file, không cần API key.
8. **D3 · Món ăn 3D:** 12 món trong `DISHES` (`makeDish`). **D4 · Cây 3 giai đoạn:** mầm → cây non → trưởng thành.
9. **HUD mới** (`src/ui/hud.ts`): huy hiệu cấp có vòng kinh nghiệm, tiền, uy tín; đồng hồ: vòng ngày đêm (đĩa trời xoay theo giờ), lịch (`T2 1 · 🌸 Xuân · Năm 1`), icon thời tiết, giờ làm tròn 10 phút, nhãn 🔥 Đông / 🌙 Nghỉ / ⏸ / x2. **Lịch** mới: `src/data/calendar.ts` + `src/sim/calendar.ts` (không đổi save, có test).
10. **Bảng Cài đặt ⚙️:** tốc độ, nhạc/hiệu ứng, toàn màn hình, hướng dẫn nhanh, chơi lại; mở thì game tạm dừng; phím `Space` / `Esc`.
11. **Bỏ thẻ chỉ dẫn** tên khu ở cả 3 khu (trừ thanh "đang sắp xếp bàn").
12. **Font Mali** (chọn từ trang so sánh 6 font có hỗ trợ tiếng Việt), gói `@fontsource/mali`.
13. **C1 · Người chơi làm bồi bàn** (thay đổi lớn nhất):
    - Sim: `src/sim/systems/service.ts` (lệnh `service/menu`, `service/takeOrder`, `service/deliver`; bồi bàn đi thật theo toạ độ mặt bằng; `autoServeCommands` = người chơi mẫu). Pha khách mới `seated → browsing → readyToOrder → waitingFood`. Bếp nấu xong → `ready` (ở quầy ra món). Tâm trạng `moodOf` quyết định tip. **Save v5** + migration + test.
    - 3D: quầy ra món (đèn giữ nóng, đĩa món, chuông), bồi bàn (áo xanh, mũ đỏ, tạp dề, vòng vàng dưới chân, bưng món bằng hai tay), bong bóng chat (`bubbleSprite`) trên đầu khách.
    - Tương tác: bấm khách/bàn/bong bóng (`Pick 'party'`), bấm quầy (`Pick 'pass'`) → khay chọn món → bấm bàn để giao. Nút sang Quán hiện số việc đang chờ khi người chơi ở khu khác.
14. **Sửa phụ:** Vitest chỉ chạy `test/` (trước đó quét nhầm file mẫu trong `.claude/skills`); raycast bỏ qua vật đang ẩn; `window.stage` ở bản dev.
15. **Tài liệu:** chuyển ghi chú nội bộ vào `docs/` (repo công khai → đã bỏ chi tiết cá nhân), cập nhật 00–06, thêm file này.

### Quyết định của chủ dự án trong phiên

- Bỏ nét viền nâu mảnh. Bỏ thẻ chỉ dẫn tên khu. Font Mali.
- HUD tham khảo bố cục game nông trại kinh điển nhưng dùng design system riêng của game.
- Quán phải có việc cho người chơi: người chơi là bồi bàn; khách xem menu 3–7 giây; 4 bậc tâm trạng, mỗi bậc 10 giây.
- **Nông trại và chợ chưa cần thêm việc** ở giai đoạn này.
- Tài liệu đưa lên repo (thư mục `docs/`) nhưng bỏ chi tiết riêng tư.

### Quyết định AI tự chọn (đổi được, xem `01-TAM-NHIN-GAME.md`)

- Tâm trạng chỉ tụt khi món **đã nấu xong nằm ở quầy** mà chưa bưng (thời gian bếp nấu không tính).
- Chờ menu / chờ ghi món ~64 giây thực thì bỏ về; bồi bàn đang tới thì không mất kiên nhẫn.
- Hai bàn cùng gọi một món: món ra trước giao bàn nào cũng được (hai đơn đổi chủ).
- `foodPatience` 80 → 120 phút game.

### Còn dở / việc tiếp theo

- **Chưa gộp vào `main`** tới khi Pull Request được merge → bản online (Netlify) vẫn là bản cũ.
- **Chưa thử trên điện thoại thật** (chạm, âm thanh, tốc độ khung hình). Draw call 560–650/khung — nên gộp mesh tĩnh (D5) trước khi thêm nhiều vật thể.
- Câu hỏi còn treo: có làm **bồi bàn tự động** khi người chơi sang nông trại/chợ không (S1)?
- Gợi ý phiên sau: chơi thử khâu phục vụ rồi chỉnh nhịp (S5), hoặc S1–S4 trong `04-ROADMAP.md`, hoặc Giai đoạn 2 trong `06-KINH-NGHIEM-THIET-KE.md` (khách quen, đơn hàng mỗi ngày) — ưu tiên phần Quán.
