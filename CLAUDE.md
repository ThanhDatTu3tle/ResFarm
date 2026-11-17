# Quán Nhà Vườn — hướng dẫn cho người/AI phát triển tiếp

Game quản lý quán ăn kết hợp nông trại, đồ hoạ 3D phong cách hoạt hình, chạy trên trình duyệt. File này là bản đồ kiến trúc: đọc xong là biết sửa ở đâu.

Tài liệu nội bộ chi tiết hơn (tầm nhìn, kiến trúc sâu, lộ trình đồ hoạ, roadmap, chi phí) nằm ở `notes/` nếu thư mục đó có trên máy — bắt đầu từ `notes/00-DOC-TRUOC.md`. Thư mục này không có trong repo.

## Chạy dự án

Cần Node 20.19+ hoặc 22+.

| Lệnh | Tác dụng |
| --- | --- |
| `npm install` | Cài thư viện |
| `npm run dev` | Dev server ở `http://localhost:5184` |
| `npm run dev:lan` | Như trên nhưng mở cho máy khác cùng mạng (thử trên điện thoại) |
| `npm test` | Test lõi mô phỏng (Vitest, chạy trong Node, không cần trình duyệt) |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run build` | Typecheck + build production ra `dist` |

Sau mỗi thay đổi: chạy `npm run typecheck` và `npm test`. Ở bản dev, `window.game` là đối tượng `Game` (xem state, gọi `game.dispatch(...)`, `game.tick(phút)` từ console).

Tham số URL để thử nhanh (ghép được với nhau):

| Tham số | Tác dụng |
| --- | --- |
| `?fresh` | Bỏ qua save và không ghi save |
| `?seed=7` | Seed cho game mới |
| `?ff=300` | Tua 300 phút game lúc tải (720 ≈ 20:00, trời tối) |
| `?area=farm` | Mở sẵn khu `farm` / `restaurant` / `market` |
| `?tab=menu` | Mở sẵn một panel trong ngăn kéo |
| `?speed=4` | Tốc độ ban đầu |
| `?weather=rain` | (chỉ bản dev) ép thời tiết |
| `?rich` | (chỉ bản dev) nhiều tiền + cấp 9, để thử mua sắm |
| `?edit` | (chỉ bản dev) mở sẵn chế độ sắp xếp bàn |
| `?do=[...]` | (chỉ bản dev) chạy sẵn một mảng Command dạng JSON đã mã hoá URL, trước khi tua |

Ví dụ: `http://localhost:5184/?fresh&seed=5&ff=720&weather=rain&area=market`.

Lưu ý: vòng lặp chạy bằng `requestAnimationFrame` nên khi tab bị ẩn game tạm dừng — muốn kiểm tra khi tab không hiển thị thì dùng `?ff=`.

## Thời gian trong game

Mọi thời lượng trong `src/data` (nấu món, cây lớn, kiên nhẫn của khách...) tính bằng **phút game**. Chỉ một hằng số nối với thời gian thực: `balance.minutesPerSecond` (hiện 0.7).

- Một ngày mở cửa = 08:00 → 22:00 = 840 phút game = **20 phút thực** ở tốc độ x1.
- Quy đổi: `phút game = giây thực × 0.7` — món muốn nấu mất 30 giây thực thì `cookTime: 21`; cây muốn lớn trong 5 phút thực thì `growTime: 210`.
- Đổi độ dài ngày: chỉ sửa `minutesPerSecond`; mọi thứ khác tự co giãn theo.
- Danh sách thời gian chi tiết và thực đơn: sửa `cookTime`/`price`/`ingredients` trong `recipes.ts`, `growTime`/`regrowTime`/`yields` trong `farm.ts`, các mốc của khách trong `balance.ts`.

## Công nghệ

Vite + TypeScript (strict), không framework. Thư viện runtime duy nhất là **Three.js**. Mọi model 3D ghép từ khối cơ bản bằng code (không có file model/texture), vật liệu toon — cùng phong cách với dự án `co-thu-3d`. Bảng điều khiển là HTML thường phủ lên canvas.

## Kiến trúc: 4 tầng, phụ thuộc một chiều

```
src/core   hạ tầng dùng chung (event bus, RNG có seed, registry)   — không biết gì về game
src/data   NỘI DUNG tĩnh: nguyên liệu, món, cây/con, sạp chợ, mặt bằng + bàn, nội thất, nâng cấp, thời tiết, cân bằng
src/sim    LÕI MÔ PHỎNG: state + command + system                  — không đụng DOM, không đụng Three.js
src/ui     cảnh 3D + panel HTML + vòng lặp                          — chỉ đọc state, gửi command
```

`ui → sim → data → core`. Tầng dưới KHÔNG BAO GIỜ import tầng trên. `src/sim` không được dùng `document`, `window`, `three`, `Math.random()`, `Date.now()`.

### Luồng dữ liệu

```
người chơi bấm nút / bấm vật thể 3D ──► Command ──► game.dispatch() ──► handler của system sửa GameState
                                                                              │
vòng lặp: game.tick(dt) ──► từng system.update() sửa GameState                │
                                                                              ▼
              cảnh 3D + panel đọc game.state để vẽ lại   ◄── game.bus phát sự kiện cho hiệu ứng/thông báo
```

- **GameState** (`src/sim/state.ts`): JSON thuần, là nguồn sự thật duy nhất. Lưu game = `JSON.stringify`.
- **Command** (`src/sim/types.ts`): cách duy nhất để thay đổi state từ bên ngoài. Handler trả `{ok:true}` hoặc `{ok:false, reason}` (reason hiện thành thông báo).
- **System** (`src/sim/systems/*.ts`): mỗi file một mảng gameplay, gồm `update(ctx, dt)`, `onDayStart`, `init`, `commands`. Đăng ký trong `defaultSystems` ở `src/sim/game.ts`.
- **Sự kiện** (`SimEvents`): sim báo cho UI biết chuyện vừa xảy ra. UI không sửa state khi nghe sự kiện.
- **Đơn vị thời gian**: mọi thời lượng là **phút game**. `balance.minutesPerSecond` quy đổi sang giây thực. `tick()` tự chia nhỏ thành bước ≤ 1 phút.
- **Tất định**: cùng seed + cùng chuỗi lệnh ⇒ cùng kết quả (có test). Ngẫu nhiên chỉ lấy từ `state.rng` qua `src/core/rng.ts`.

### Các system hiện có

| File | Việc |
| --- | --- |
| `clock.ts` | Giờ trong ngày, pha `open → closing → summary` |
| `weather.ts` | Thời tiết đổi ngẫu nhiên; hiệu ứng gameplay lấy từ `WeatherDef.effects` |
| `customers.ts` | Khách tới, xếp hàng, xếp bàn, gọi món (trừ nguyên liệu ngay), chờ, ăn, trả tiền/bỏ về |
| `kitchen.ts` | Đầu bếp nhận đơn và nấu |
| `farm.ts` | Ô nông trại: cuốc đất, gieo/nuôi, tưới (mưa tự làm ẩm), lớn, thu hoạch, mua ô, nới rộng ô |
| `market.ts` | Mua ở sạp chợ, giá dao động theo ngày |
| `progression.ts` | Mở khoá/bật tắt món, mua nâng cấp (trang thiết bị) |
| `decor.ts` | Mua/đổi nội thất (sàn, tường, bàn ghế), dời bàn, đặt lại bố cục |

`helpers.ts` chứa hàm dùng chung: kho (`stockOf`, `hasAll`, `addItem`...), tiền (`earn`, `spend`), `addXp`, `addReputation`, `modifier` (gộp hệ số từ thời tiết, nâng cấp và nội thất đang dùng).

`src/sim/layout.ts` chứa hình học mặt bằng quán: `tablePos` (vị trí bàn hiện tại = chỗ đã dời trong `state.restaurant.layout`, hoặc mặc định trong `TableDef`), `seatSpots`, `footprint`, `canPlaceTable` (luật đặt bàn, dùng chung cho lệnh và cho phần xem trước khi kéo).

### UI

```
src/ui/app.ts              tạo Game + Stage, vòng lặp, lưu tự động, xử lý click, HUD, nút chuyển khu, ngăn kéo
src/ui/three/toon.ts       vật liệu toon, hình học có cache, mesh()/group(), emojiSprite(), Bar3D
src/ui/three/models.ts     model dùng chung: người, cây, hàng rào, rau củ, con vật, cột đèn, thùng hàng
src/ui/three/stage.ts      renderer, camera, ánh sáng, bầu trời ngày/đêm, mây, sao, mưa, bấm chọn (raycast)
src/ui/three/areas/*.ts    mỗi file một KHU (màn hình 3D): restaurant, farm, market
src/ui/panels/*.ts         các bảng HTML trong ngăn kéo: Quán, Thực đơn, Siêu thị, Chợ, Nông trại, Kho
src/ui/dom.ts              esc(), cmd(), ui(), bar(), morph()
```

- **Camera**: `OrbitControls` — kéo để xoay, lăn chuột / chụm hai ngón để zoom, bấm đúp để về góc mặc định. Giới hạn xoay ngang của từng khu là `view.orbit`; giới hạn zoom tính từ khoảng cách mặc định (`resetView()` trong `stage.ts`).
- **Khu (Area)**: interface trong `stage.ts`. Mỗi khu có `root` (Group), `view` (vị trí camera + `orbit`), `rainBox`, và `update(env, dt, speed)` đọc `game.state` mỗi khung hình để đồng bộ hình ảnh. Mọi khu đều được update dù đang ẩn. Thứ tự mảng `areas` trong `app.ts` là thứ tự trái → phải của các nút chuyển khu hai bên màn hình.
- **Env**: `stage.ts` tính mỗi khung hình từ giờ game và `WeatherDef.visual`: `day`, `night`, `rain`, `clouds`, `wind`, `dim` (0..1) và `t` (giây thực). Khu dùng nó cho đèn, cây đung đưa, cối xay gió...
- **Bấm vật thể 3D**: gắn `obj.userData.pick = { type, id }` (kiểu `Pick`); `Stage` raycast rồi gọi `stage.onPick`, xử lý trong `app.ts`. Hiện có `slot` (ô nông trại: chín thì thu hoạch, chưa thì mở panel Nông trại), `stall` (mở panel Chợ lọc theo sạp) và `table` (bàn trong quán, chỉ dùng để kéo).
- **Kéo vật thể 3D**: `stage.dragFilter(pick)` trả true thì vật đó kéo được (camera tạm khoá); `stage.onDrag(pick, x, z, end)` nhận toạ độ mặt sàn. Chế độ sắp xếp bàn (`ui.editLayout`) dùng cơ chế này: `RestaurantArea.dragTable()` vẽ xem trước, thả ra thì `app.ts` gửi lệnh `layout/moveTable`.
- **Màu quán theo nội thất**: `RestaurantArea` giữ bộ vật liệu riêng (`mats`) và mỗi khung hình tô lại theo `state.decor.equipped`.
- **Hình cho nội dung mới**: thứ gì chưa có model riêng đều hiện bằng `emojiSprite(icon)` — món ăn trên đĩa, hàng trên sạp, sản phẩm chín, producer lạ. Nên thêm data là thấy ngay trong cảnh 3D; dựng model riêng là việc làm đẹp sau.
- **Panel**: mỗi panel là hàm thuần `(game, ui) → chuỗi HTML`. `morph()` vá DOM tại chỗ nên không cần quản lý cập nhật thủ công. Nút bấm gắn `cmd({...})` cho lệnh sim (có kiểm tra kiểu), `ui('tên:tham số')` cho hành động thuần giao diện (xử lý trong `app.ts`). Phần tử trong danh sách nên có `data-key`.
- **Toạ độ quán**: `RoomDef`/`TableDef` dùng toạ độ 2D (hiện 720×600, 55 đơn vị = 1 mét); `areas/restaurant.ts` quy đổi sang mét bằng `wx()`/`wz()` và tự dựng phòng theo `content.room`.
- **Mobile**: màn hình ngang thấp có CSS thu gọn (`@media (max-height: 540px)`); thiết bị cảm ứng cầm dọc hiện lớp phủ `#rotate` mời xoay ngang. Trình duyệt không cho web tự ép xoay ngang (trừ khi toàn màn hình trên Android, hoặc cài lên màn hình chính qua `public/manifest.webmanifest`).

## Công thức cho các việc thường gặp

**Thêm nguyên liệu** — 1 dòng trong `src/data/items.ts`, rồi cho nó nguồn: thêm id vào `items` của một sạp (`market.ts`) và/hoặc làm `yields` của một producer (`farm.ts`). `infinite: true` = luôn có sẵn. Sạp chợ 3D tự bày thêm thùng hàng.

**Thêm món** — 1 mục trong `src/data/recipes.ts`. Không cần sửa code.

**Thêm cây trồng / vật nuôi** — 1 mục `ProducerDef` trong `src/data/farm.ts`. `cycles: 1` thu một lần; `cycles: 'infinite'` + `regrowTime` thu định kỳ. Muốn có model riêng: thêm vào bảng `CROPS` hoặc `ANIMALS` trong `src/ui/three/models.ts` (không thêm thì hiện emoji).

**Trạng thái ô nông trại** — `FarmSlot` có `tilled` (đã cuốc), `wet` (số phút đất còn ẩm), `tier` (bậc nới rộng). Loại ô nào cần cuốc/tưới/nới rộng được khai trong `SlotTypeDef`: `needsTilling`, `needsWater`, `tiers`. Thời tiết nào làm ẩm đất: `WeatherDef.wetsSoil`. Thời gian giữ ẩm và tốc độ lớn khi đất khô: `balance.farm`. Bấm ô trong cảnh 3D làm luôn việc hợp trạng thái (thu → cuốc → tưới → mở bảng chọn giống), xem `stage.onPick` trong `app.ts`.

**Thêm loại ô nông trại** — thêm vào union `SlotType` (`src/data/types.ts`), `slotTypes` (`farm.ts`), và `SLOT_LAYOUT` + nhánh dựng hình trong `src/ui/three/areas/farm.ts`.

**Thêm sạp chợ** — 1 mục trong `src/data/market.ts`; khu chợ tự dựng thêm sạp.

**Thêm bàn** — 1 mục `TableDef` trong `src/data/restaurant.ts` (x, y là vị trí mặc định; test kiểm tra bố cục mặc định không chồng nhau); đặt `requiresUpgrade` nếu bàn chỉ có sau khi nâng cấp, `fixed` nếu không cho dời. Cảnh quán tự dựng bàn ghế.

**Nới rộng quán** — tăng `width`/`height`/`dining` của `room` trong `src/data/restaurant.ts`; phòng 3D tự to theo. (Muốn nới theo nâng cấp thì cần chuyển kích thước phòng vào state — chưa làm.)

**Thêm nội thất (sàn, sơn tường, bộ bàn ghế)** — 1 mục `DecorDef` trong `src/data/decor.ts`: `colors` cho hình ảnh, `modifiers` cho gameplay. Tự xuất hiện trong panel Siêu thị. Thêm loại nội thất mới (vd đèn, rèm): thêm vào union `DecorSlot`, `decorSlotNames`, một món `isDefault`, và chỗ dùng màu trong `areas/restaurant.ts`.

**Thêm trang thiết bị (nâng cấp)** — 1 mục `UpgradeDef` trong `src/data/restaurant.ts`; hiện ở cuối panel Siêu thị. Hiệu ứng dạng hệ số: `modifiers: { cookSpeed: 1.2 }`. Chỉ số mới: thêm key vào `ModifierKey` rồi gọi `modifier(ctx, 'key')` ở nơi cần.

**Thêm kiểu thời tiết** — 1 mục trong `src/data/weather.ts`: `effects` cho gameplay, `visual` cho hình ảnh.

**Thêm khu mới (màn hình 3D)** — viết class `implements Area` trong `src/ui/three/areas/`, thêm vào mảng `areas` trong `app.ts`.

**Thêm lệnh** — thêm vào union `Command`, viết handler trong `commands` của system liên quan, thêm test.

**Thêm tính năng lớn (system mới)** — thêm trường vào `GameState` + giá trị khởi tạo trong `createInitialState`, tăng `SAVE_VERSION` và viết migration trong `save.ts` (xem các migration v1→v2, v2→v3 làm mẫu), tạo `src/sim/systems/<tên>.ts`, đăng ký vào `defaultSystems`, thêm panel/hình ảnh nếu cần, thêm test.

**Chỉnh cân bằng** — `src/data/balance.ts` và các con số trong file data.

`createContent()` tự kiểm tra tham chiếu chéo khi khởi động (món dùng nguyên liệu không tồn tại, nguyên liệu không có nguồn...) và ném lỗi rõ ràng.

## Quy ước

- Định danh bằng tiếng Anh, chú thích và chữ hiển thị bằng tiếng Việt.
- State chỉ chứa JSON thuần: không class, hàm, `Map`, `Set`, `Date`.
- Nội dung tham chiếu nhau bằng `id` chuỗi. Không đổi `id` đã phát hành (save cũ đang dùng); `reconcile()` trong `save.ts` chỉ xử lý được id bị xoá.
- Logic gameplay nằm trong `sim`, có test. Panel và cảnh 3D không tự tính luật — gọi hàm export từ system (vd `priceOf`, `slotPrice`, `cycleTime`, `activeTables`).
- Model 3D: nhìn về +z, chân ở y = 0, dựng bằng `mesh()`/`group()` trong `toon.ts`; vật liệu lấy từ `toon(màu)` (dùng chung — muốn đổi thuộc tính riêng thì truyền opts để tạo vật liệu mới).

## Những gì CHƯA có (gợi ý phát triển tiếp)

Theo thứ tự đề xuất:

1. **Cân bằng kinh tế** — các con số hiện chỉ đủ để chơi thử, chưa tinh chỉnh.
2. **Bồi bàn / khâu phục vụ** — thêm trạng thái `ready` cho `Order` giữa `cooking` và `served` (ghi chú trong `kitchen.ts`).
3. **Thuê và nâng cấp nhân viên** — `StaffDef` đã tách riêng; cần lệnh thuê và lương theo ngày.
4. **Thức ăn chăn nuôi, chế biến** (xay bột, làm phô mai...) — mở rộng `ProducerDef` với `inputs: ItemStack[]`, hoặc thêm system "xưởng" theo cùng mô hình.
5. **Nâng hạng quán** (quán → nhà hàng): nới phòng theo cấp (đưa kích thước phòng vào state), bếp to hơn, thêm bàn; xoay bàn 90° khi sắp xếp; mua thêm bàn lẻ ở Siêu thị; đồ trang trí đặt tự do (cây, tranh, đèn).
6. **Thời tiết sâu hơn** — bão làm hỏng cây, nắng hạn cần tưới, món theo mùa; mùa trong năm.
7. **Bán nông sản dư, hợp đồng giao hàng, sự kiện ngẫu nhiên** (khách VIP, thanh tra).
8. **Mở rộng nông trại** — thêm loài cá và bậc ao, cho vật nuôi ăn, hiệu ứng khi tưới/cuốc, công cụ nâng cấp (bình tưới to tưới nhiều ô).
8. **Tiến trình khi offline** — `tick()` nhận số phút bất kỳ nên chỉ cần lưu mốc thời gian thực và tua bù có giới hạn.
9. **Âm thanh** (nghe theo `game.bus`), **model/animation chi tiết hơn** (tay chân cử động, khách cầm đũa...).
10. **Tối ưu draw call** nếu cảnh phình to: gộp mesh tĩnh theo vật liệu (xem `mergeStatic` trong `co-thu-3d/src/scene/helpers.js`).
