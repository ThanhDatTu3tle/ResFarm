# Bạn bè online (Supabase) — cài đặt máy chủ

Tính năng **🤝 Bạn bè** (giai đoạn 19, lớp A của mục F trong `04-ROADMAP.md`):

- Mỗi máy tự có một **tài khoản ẩn danh** (không email, không mật khẩu, không mạng xã hội) và một **mã kết bạn** 6 ký tự.
- Kết bạn **một lần** bằng mã, link mời (`?invite=MÃ`) hoặc mã QR. Sau đó hai người thấy nhau trong danh sách bạn bè.
- Bật **"Cho bạn bè ghé thăm quán"** thì game tự đẩy bản chụp quán lên mỗi khi hết ngày (và khi bật công tắc, khi sang thăm quán bạn). Bạn bè bấm **🏡 Thăm** là vào chế độ thăm quán (F1/F2).
- Chưa cấu hình máy chủ thì game vẫn chạy bình thường: nút 🤝 ở cột phải không hiện, bảng Bạn bè chỉ hướng dẫn thăm quán bằng file.

## 1. Tạo project (chủ dự án tự làm)

1. Đăng ký <https://supabase.com> → **New project** (gói Free là đủ cho nhóm bạn chơi thử). Chọn vùng gần Việt Nam (Singapore).
2. **Authentication → Sign In / Providers** → bật **Allow anonymous sign-ins**.
3. **SQL Editor** → dán toàn bộ `supabase/schema.sql` → **Run**. Chạy lại nhiều lần vẫn được (khi file SQL đổi thì chạy lại).
4. **Project Settings → API** (hoặc **API Keys**): lấy **Project URL** và khoá **anon / publishable**.
   - Khoá anon được thiết kế để nằm công khai trong app; an toàn nhờ RLS + hàm trong `schema.sql`.
   - **Không bao giờ** dùng / gửi khoá `service_role` (secret) — khoá đó bỏ qua mọi quyền.

## 2. Nối vào game

**Máy dev:** chép `.env.example` thành `.env` (đã nằm trong `.gitignore`, không lên GitHub) rồi điền:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Khởi động lại `npm run dev`.

**Netlify:** Site configuration → **Environment variables** → thêm 2 biến trên (cùng tên) → **Deploys → Trigger deploy**. Vite nhúng giá trị lúc build nên phải build lại.

## 3. Cơ chế (để sửa / mở rộng)

| Phần | Ở đâu |
| --- | --- |
| Bảng, quyền, hàm RPC | `supabase/schema.sql` — `players` (mã, tên quán, tên chủ quán, phong cách, ngày, `sharing`, `snapshot` jsonb ≤ ~1,5 MB), `friendships (a < b)`; RLS chỉ cho đọc / sửa dòng của mình; `ensure_player`, `add_friend`, `remove_friend`, `my_friends`, `friend_snapshot` (chỉ khi là bạn + đang bật cho ghé thăm), `delete_me`. Trigger chặn đẩy bản chụp dưới 20 giây một lần |
| Gọi máy chủ | `src/ui/online.ts` — supabase-js tải động (chunk riêng, game chơi một mình không tải), `signIn` (ẩn danh), `setSharing`, `pushSnapshot`, `addFriend`, `listFriends`, `friendSnapshot`, `deleteMe`, link mời `stashInvite` / `takeInvite`, `qrSvg` (qrcode-generator, tải động) |
| Bảng Bạn bè | `src/ui/friends.ts` (`friendsHtml`, trạng thái `FriendsView`), xử lý thao tác `friendsAction` trong `src/ui/app.ts` (lệnh UI `friends:open / add / visit:<id> / sharing / …`) |
| Tự đẩy quán | `syncSnapshot` trong app.ts: sự kiện `day/started`, bật công tắc, trước khi sang thăm bạn. Máy đã từng dùng bạn bè (`localStorage quan-nha-vuon/online`) thì mở game tự đăng nhập lại ngầm |
| Thử giao diện không cần máy chủ | Bản dev: `?friends=demo` (dữ liệu mẫu), `?friends` (mở sẵn bảng) |

## 4. Quyền riêng tư (ghi chú cho trang chính sách sau này)

- Dữ liệu trên máy chủ: mã kết bạn, tên quán + tên chủ quán (người chơi tự đặt trong game), phong cách quán, số ngày, bản chụp ván chơi (khi bật cho ghé thăm), danh sách bạn trong game. Không có email, số điện thoại, vị trí, danh bạ, mạng xã hội.
- Người chơi tự xoá được: **🗑 Gỡ dữ liệu online** trong bảng Bạn bè (`delete_me`: xoá dòng người chơi, bạn bè, bản chụp; đăng xuất tài khoản ẩn danh trên máy).
- Xoá dữ liệu trình duyệt = mất tài khoản ẩn danh trên máy đó (mã kết bạn mới, phải kết bạn lại). Gắn tài khoản thật (Facebook…) là lớp B, để sau.
- Không có chat; tên quán / chủ quán hiện cho bạn bè đã kết bạn. Khi mở cho người lạ (ghé ngẫu nhiên…) cần thêm lọc từ cấm + báo cáo / chặn (xem pháp lý ở mục F của roadmap).
