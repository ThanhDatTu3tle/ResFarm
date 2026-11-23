# Quán Nhà Vườn — hướng dẫn cho người/AI phát triển tiếp

Game quản lý quán ăn kết hợp nông trại, đồ hoạ 3D phong cách hoạt hình, chạy trên trình duyệt. File này là bản đồ kiến trúc: đọc xong là biết sửa ở đâu.

Tài liệu chi tiết hơn (tầm nhìn, kiến trúc sâu, đồ hoạ, roadmap, chi phí, kinh nghiệm thiết kế, nhật ký từng phiên) nằm ở `docs/` — bắt đầu từ `docs/00-DOC-TRUOC.md`, rồi đọc mục mới nhất của `docs/07-NHAT-KY.md` để nối tiếp phiên trước. **Repo công khai: không đưa thông tin cá nhân vào repo**; ghi chú riêng tư để ở `notes/` (không lên GitHub). Không commit thẳng vào `main` (Netlify deploy từ `main`) — làm ở nhánh riêng rồi gộp qua Pull Request.

Skill Three.js cài trong `.claude/skills/` (điểm vào: `threejs-game-director`; không nằm trong repo — cách cài lại ở `docs/00-DOC-TRUOC.md`). Khi dùng, giữ nguyên kiến trúc và quy ước trong file này — các skill đó mặc định dựng game mới từ scaffold riêng. Cách chọn skill và nguyên tắc thiết kế cozy game: `docs/06-KINH-NGHIEM-THIET-KE.md`.

## Chạy dự án

Cần Node 20.19+ hoặc 22+.

| Lệnh | Tác dụng |
| --- | --- |
| `npm install` | Cài thư viện |
| `npm run dev` | Dev server ở `http://localhost:5184` |
| `npm run dev:lan` | Như trên nhưng mở cho máy khác cùng mạng (thử trên điện thoại) |
| `npm test` | Test lõi mô phỏng (Vitest, chạy trong Node, không cần trình duyệt) |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run build` | Typecheck + build production ra `dist`: game + 3 trang model + Sổ tay `dist/so-tay.html` (bản online ở `<trang game>/so-tay.html`) |
| `http://localhost:5184/lineup.html` | (chỉ bản dev, không build) dàn nhân vật: mọi dáng người × kiểu tóc, cử động, đội quán, khách quen — `src/dev/lineup.ts` |
| `http://localhost:5184/models-nhan-vat.html` · `models-do-vat.html` · `models-mon-an.html` | 3 trang xem toàn bộ model 3D (có trong bản build — bản online ở `<trang game>/models-nhan-vat.html`…): nhân vật / đồ vật, bàn ghế, xe cộ, trang trí / món ăn, cây trồng, vật nuôi, nguyên liệu — ảnh nhỏ chụp từ đúng hàm dựng trong `src/ui/three`, bấm để xem to, xoay, thử cử động; `src/dev/models.ts` (thêm model mới thì thêm 1 dòng vào danh mục ở đó) |
| `npm run sotay` | Sinh **Sổ tay** (bảng tra cứu toàn bộ nội dung game, tự tính giây thực / giá vốn / lãi) từ `src/data` ra `notes/so-tay-quan-nha-vuon.html` — xem ở `http://localhost:5184/notes/so-tay-quan-nha-vuon.html` khi đang chạy dev |

Sau mỗi thay đổi: chạy `npm run typecheck` và `npm test`. Ở bản dev, `window.game` là đối tượng `Game` (xem state, gọi `game.dispatch(...)`, `game.tick(phút)` từ console).

Tham số URL để thử nhanh (ghép được với nhau):

| Tham số | Tác dụng |
| --- | --- |
| (không có tham số) | Màn hình mở đầu: Chơi tiếp / Ván mới → chọn quán Nhật / Hàn / Việt / Ốc → chọn ông / bà chủ (giới tính + tuổi 25–50) |
| `?owner=f35` | Kèm `?fresh`: ông chủ (`m`) / bà chủ (`f`) + tuổi của ván tạm; thêm `-tóc-quần áo-tên`, vd `?owner=f28-braid-aodai-Cô Ba`. Ở màn mở đầu (chỉ bản dev, kèm `?pick=oc`): mở thẳng bước chọn chủ quán |
| `?cal` | (chỉ bản dev) mở sẵn cuốn lịch |
| `?rename` | (chỉ bản dev) mở sẵn hộp đổi tên quán (ô nhập trong game — không dùng `window.prompt` vì điện thoại / app cài lên màn hình chính / trình duyệt trong Zalo, Messenger hay chặn) |
| `?fresh` | Bỏ qua màn mở đầu và save, không ghi save (ván tạm) |
| `?cuisine=jp` | Kèm `?fresh`: phong cách quán của ván tạm (`jp` / `kr` / `vn` / `oc`, mặc định `vn`) |
| `?play` | Bỏ qua màn mở đầu, vào thẳng ván đang lưu |
| `?pick=kr` | Mở thẳng bước chọn quán ở màn mở đầu (nút "← Chọn quán khác" của màn xem trước dùng) |
| `?preview=oc` | Xem trước quán (nút "👀 Xem trước" ở bước chọn quán): ván tạm không lưu, tua tới giữa ca sáng, quán tự chạy (`previewAuto` trong app.ts: tự phục vụ, đội tự gọi món / trả tiền), ẩn HUD; thanh trên cùng "← Chọn quán khác" / "✔ Chọn quán này" |
| `?choose=oc` | Mở thẳng bước chọn ông / bà chủ với quán đó (nút "✔ Chọn quán này" của màn xem trước dùng) |
| `?guide=0` | (chỉ bản dev) mở sẵn trang hướng dẫn chơi ở màn mở đầu (số trang đếm từ 0) |
| `?focus=pen` | (chỉ bản dev) bảng Nông trại chỉ hiện một loại ô / cối (kèm `?tab=farm`) |
| `?seed=7` | Seed cho game mới |
| `?ff=300` | Tua 300 phút game lúc tải (720 ≈ 20:00, trời tối) |
| `?area=farm` | Mở sẵn khu `farm` / `restaurant` / `market` |
| `?tab=menu` | Mở sẵn một panel trong ngăn kéo |
| `?speed=4` | Tốc độ ban đầu |
| `?weather=rain` | (chỉ bản dev) ép thời tiết (`snow` = tuyết rơi) |
| `?day=43` | (chỉ bản dev) nhảy tới ngày đó trong lịch để xem mùa: 1 Xuân, 15 Hạ, 29 Thu, 43 Đông; 14 / 56 = ngày cuối mùa / cuối năm (kèm `?ff=1100` để thấy tổng kết) |
| `?stall=seafood` | (chỉ bản dev) mở thẳng bên trong một quầy chợ (`meat` / `produce` / `seafood` / `dry` / `snack`) |
| `?event=critic` | (chỉ bản dev) ép sự kiện ngẫu nhiên xảy ra ngay khi quán mở (`critic` / `inspector` / `tour_bus` / `outage` / `big_tippers`) |
| `?rich` | (chỉ bản dev) nhiều tiền + cấp 9, để thử mua sắm |
| `?edit` | (chỉ bản dev) mở sẵn chế độ sắp xếp bàn |
| `?event=tour_bus` | (chỉ bản dev) minibus du lịch tới ngay khi mở cửa, đoàn khách ngồi kín bàn |
| `?fullpark` | (chỉ bản dev) lấp kín bãi xe máy + bãi ô tô bằng xe đậu sẵn (xem bãi đầy) |
| `?ffserve` | (chỉ bản dev) kèm `?ff=150`: lúc tua tự mang menu + ghi món (không bưng) để xem bong bóng màu bàn và món trên quầy line; thêm `&pickup` thì bồi bàn ra quầy lấy món luôn |
| `?autopay` | (chỉ bản dev) kèm `?ff=`: lúc tua đội tự gọi món, tự trả hoá đơn (xem cảnh buổi tối không bị bảng che) |
| `?meal` | (chỉ bản dev) mở sẵn bảng gọi món cho đội (kèm `?ff=400` để đội đang ở chợ nghỉ trưa) |
| `?tutorial` | Kèm `?fresh`: ván tạm có ngày hướng dẫn (ván mới từ màn mở đầu luôn có) |
| `?tut=market` | (chỉ bản dev) nhảy tới một bước của ngày hướng dẫn: `intro` / `serve` / `hard` / `market` / `cook` / `farm` / `morning` / `lunch` / `done` |
| `?do=[...]` | (chỉ bản dev) chạy sẵn một mảng Command dạng JSON đã mã hoá URL, trước khi tua |

Ví dụ: `http://localhost:5184/?fresh&cuisine=jp&seed=5&ff=720&weather=rain&area=market`.

Phím tắt: `Space` tạm dừng / chạy tiếp, `Esc` đóng bảng Cài đặt. Mở Cài đặt, bảng gọi món cho đội, hoá đơn ăn uống, chế độ sắp xếp bàn ghế, bảng Siêu thị hoặc lúc công an khu vực đang chờ thì game tự tạm dừng.

Lưu ý: vòng lặp chạy bằng `requestAnimationFrame` nên khi tab bị ẩn game tạm dừng — muốn kiểm tra khi tab không hiển thị thì dùng `?ff=`.

## Thời gian trong game

Mọi thời lượng trong `src/data` (nấu món, cây lớn, kiên nhẫn của khách...) tính bằng **phút game**. Chỉ một hằng số nối với thời gian thực: `balance.minutesPerSecond` (hiện 1.5).

- Một ngày = 06:00 → 24:00 = 1080 phút game = **12 phút thực** ở tốc độ x1. Quán mở 2 ca `balance.shifts` (07:00–12:00, ngưng nhận khách 11:00; 15:00–21:00, ngưng nhận khách 20:30 — `lastCall`); đóng cửa (`to`) thì khách chưa gọi món về; tới `kickOut` (12:30 / 21:30) khách đang ăn trả tiền luôn, khách chờ món được mời về (`inSeating` trong customers.ts), rồi cả đội ra chợ ăn. Thời gian ngồi ăn theo số khách `balance.eatTime` (1 người 10–15 s … 5–6 người 45–60 s). Lưu lượng khách mỗi ngày `state.traffic` (`balance.traffic`, tung mỗi sáng — `rollTraffic`; ngày lễ đông hơn). Trung bình một nhóm mỗi `balance.spawnInterval` (52) phút game chia uy tín, giờ cao điểm (`rushHours`: 11–12 h, chiều 15–17 h, tối 18–20 h), lưu lượng, thời tiết; không bao giờ quá `spawnMaxGap` (40) phút không có nhóm nào, mở ca thì nhóm đầu tới sau `firstGuest` (6) phút — giờ nào trong ca cũng có khách. Hết mỗi ca sàn có thêm vết bẩn (`balance.stains`).
- Quy đổi: `phút game = giây thực × 1.5`.
- **Nông trại tính theo NGÀY** (giai đoạn 12): `FARM_DAY` (`src/data/farm.ts`) = 1080 + `nightMinutes` (600) = 1680 phút game; `growTime: days(3)` = 3 ngày (gieo giờ nào thì đúng giờ đó 3 ngày sau chín). Kết thúc ngày sớm thì phần ngày bị bỏ qua được bù qua đêm (`lastMinute` trong farm.ts). Tưới một lần ẩm 1 ngày (`balance.farm.waterDuration`). Rau 1–5 ngày, gà 2, heo 5, bò 7, cây ăn quả 8 rồi 1 ngày một lứa, lúa 3, cá / tôm / ốc 5–7 rồi 5 ngày một lứa. `ProducerDef.diesInWinter` (gà mái đẻ, bò sữa): sang mùa Đông hết lứa (`farm/culled`). UI hiện bằng `farmTime()` (format.ts).
- **Ngoại lệ:** số thứ 6 trong `dish()` (`recipes.ts`) là **độ khó** 8..40 của món; `cookMinutes()` đổi ra phút game sao cho bếp trưởng (tốc độ 1.6) nấu trong **4–10 giây thực**; các mốc phục vụ trong `balance.ts` (kiên nhẫn, tốc độ bồi bàn, thời gian ăn...) đã nhân ~2.1 khi đổi 0.7 → 1.5 để giữ nhịp theo giây thực. Đổi `minutesPerSecond` lần nữa thì nhớ chỉnh hai chỗ này.
- Danh sách thời gian chi tiết và thực đơn: sửa `cookTime`/`price`/`ingredients` trong `recipes.ts`, `growTime`/`regrowTime`/`yields` trong `farm.ts`, các mốc của khách trong `balance.ts`.

## Công nghệ

Vite + TypeScript (strict), không framework. Thư viện runtime duy nhất là **Three.js**. Font chữ là **Mali** (OFL, gói `@fontsource/mali`, nhập trong `src/main.ts`, tự lưu trong bản build — có đủ dấu tiếng Việt). Đổi font thì chọn font có subset `vietnamese`. Mọi model 3D ghép từ khối cơ bản bằng code (không có file model/texture), vật liệu toon — cùng phong cách với dự án `co-thu-3d`. Bảng điều khiển là HTML thường phủ lên canvas.

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
| `calendar.ts` (không phải system) | `calendarOf(day)`: thứ, ngày trong mùa, mùa, năm — ngày 1 = Thứ Hai mùng 1 Xuân năm 1, mùa 14 ngày (2 tuần, `DAYS_PER_SEASON`), 4 mùa / năm. Tên mùa/thứ ở `src/data/calendar.ts`. `seasonOf(ctx)`, `isFrozen(ctx, slotType)` (mùa Đông `frozen`: ô ngoài trời không cuốc / gieo / tưới, cây và con vật ngừng lớn, bác không tự gieo lại; nhà kính vẫn trồng), `isSeasonEnd` / `isYearEnd`. Thống kê cộng dồn `stats.season` / `stats.year` (cộng lúc hết ngày ở clock.ts, đếm lại ở `nextDay` khi sang mùa / năm) → tổng kết ở màn hết ngày cuối mùa (`periodSummaryHtml`). **Mùa vụ:** `ProducerDef.seasons` (mùa gieo ngoài trời; bỏ trống = quanh năm) → `canPlantNow`; đầu mùa cây trái mùa đang lớn ngoài trời héo (`witherOffSeason` trong farm.ts, sự kiện `farm/withered`); `seasonPriceFactor` (rau đúng mùa rẻ / trái mùa đắt ở chợ, `balance.seasons`); `RecipeDef.seasons` + `seasonalPrice` (món hợp mùa bán đắt hơn). **Lễ hội:** `festivals` trong `src/data/calendar.ts` (mùa + ngày, `effects` nhân vào `modifier()`, `gift`, `decor`), `festivalOf(day)` (ngày 1 của ván không tính), `nextFestival` |
| `contracts.ts` | **Anh shipper** (`restaurant.shipper`, xe máy trước cửa quán): `contract/deliver` lấy hàng khỏi kho, shipper đi 15–40 phút (`shipper.trip`, đơn `shipping`), về mới nhận thưởng (`finishTrip`); đang đi / ở chợ / xỉu thì không giao được (`shipperBlocked`). **Đơn đặt hàng** (`state.contracts`): mỗi sáng `balance.contracts.perDay` đơn từ khách ngoài, cần vài nguyên liệu (chỉ loại mua ở chợ / nông trại làm được ở cấp hiện tại), giao trước `due` bằng `contract/deliver` → thưởng (giá gốc × `rewardMul`) + XP + uy tín; quá hạn thì `expired` (không phạt). **Bán hàng dư** `market/sell` với `sellPrice` (giá gốc × `sellRatio` × giá theo mùa) |
| `events.ts` | **Sự kiện ngẫu nhiên** (`src/data/events.ts`, `state.event`): mỗi sáng xác suất `balance.events.chance` (trừ ngày 1 và ngày lễ) hẹn 1 sự kiện vào giờ ngẫu nhiên trong ca. `critic`: khách đặc biệt (`Party.vip`), trả tiền vui vẻ → thưởng, bực / bỏ về → mất uy tín (`criticDone`, customers.ts gọi); `inspector`: đếm vết bẩn + bàn dơ → thưởng / phạt; `modifier`: hiệu ứng trong `duration` phút (`eventEffect` trong `modifier()`); `police` (chỉ quán ốc — `EventDef.cuisines`): công an khu vực đứng trước quán, game dừng, hộp chọn (`policeHtml` trong app.ts): "bồi dưỡng" `bribeOf` (200 xu hạng 1 … 700 xu hạng cao nhất) hoặc để thu một bàn đôi đang trống (`seizableTable`: bàn mua thêm trước; bàn gốc vào `restaurant.confiscated`, `activeTables` bỏ qua — save v23); không đủ tiền mà cũng không còn bàn đôi trống thì xin khất (mất uy tín). Lệnh `event/police` |
| `festival.ts` | Sáng ngày lễ: cộng tiền mừng (`FestivalDef.gift`, không tính vào doanh thu) + sự kiện `festival/started` |
| `weather.ts` | Thời tiết đổi ngẫu nhiên theo trọng số của mùa (thêm `storm` Bão: `damage` = xác suất dập mỗi ô rau / lúa ngoài trời, mất nửa tiến độ, sự kiện `farm/storm`; `heat` Nắng nóng: `dryRate` đất khô nhanh gấp đôi) (`WeatherDef.seasonWeights`: Hạ nắng nhiều, Thu gió nhiều, Đông không mưa mà có tuyết `snow`); sang mùa mà thời tiết không hợp thì đổi ngay; hiệu ứng gameplay lấy từ `WeatherDef.effects` |
| `customers.ts` | Khách tới, xếp hàng, xếp bàn, chờ menu → xem menu → chờ ghi món → chờ món (tâm trạng `moodOf`) → ăn → trả tiền (tip theo tâm trạng) / bỏ về |
| `service.ts` | Người chơi là bồi bàn: lệnh `service/menu`, `service/takeOrder`, `service/pickup` (bấm quầy line: ra lấy món ra quầy sớm nhất — `passQueue`, theo `Order.readyAt` — tối đa `balance.service.carryMax` = 2 món), `service/serve { partyId }` (bấm bàn: giao đúng những món đang cầm của bàn đó, không đổi chủ món cùng loại), `service/deliver { orderIds }` (nhân viên thuê / test: lấy món của một bàn ở quầy rồi giao một lượt), `service/clean` (dọn chén dĩa dơ — `restaurant.dirty`, ghế dơ không xếp khách), `service/mop` (lau vết bẩn — `restaurant.stains`, làm khách kém kiên nhẫn); `addStains` gọi lúc hết ca. Bồi bàn đi thật trong sim (`state.restaurant.waiter`), làm việc theo hàng, rảnh thì đứng yên tại chỗ. `autoServeCommands` = người chơi mẫu cho test/cân bằng |
| `kitchen.ts` | Đầu bếp nhận đơn và nấu; xong thì đặt ra quầy line (`ready`). **Hạng bếp** `restaurant.kitchenTier` (`balance.kitchen.tiers`: số đầu bếp tối đa, sức chứa quầy line `passSlots` — đầy đĩa thì bếp chờ, chỗ nhân viên phục vụ cộng thêm): `kitchen/upgrade`. Đầu bếp thuê thêm = `StaffDef.hire` (`chef/hire`, `chef/fire`). **Giao món**: `StaffState.dishes` (null = mọi món), `chef/setDish`; `cooks()`, `uncookedDishes()` (món không ai nấu). Đổi bếp phát `kitchen/changed` → app.ts dựng lại khu quán |
| `farm.ts` | Ô nông trại: cuốc đất, gieo/nuôi, tưới (mưa tự làm ẩm), lớn, thu hoạch, mua ô, nới rộng ô |
| `quests.ts` | Nhiệm vụ hệ thống: chuỗi `content.quests` làm lần lượt; mục tiêu đếm qua `bumpQuest(ctx, kind, n)`, mục tiêu trạng thái đọc state; lệnh `quest/claim` |
| `gardeners.ts` | **Người làm vườn** (`farm.gardeners`, chỗ thứ i mở ở cấp `balance.gardeners.levels[i]`): `gardener/hire`, `gardener/fire`, `gardener/setJob` (`gardenerJobs` trong `src/data/farmhands.ts`: thu hoạch / chuồng + ao / tưới / cuốc + gieo lại). Rảnh thì tự nhận MỘT việc (`pickGardenerTask`: loại việc ưu tiên trước, ô gần nhất; bỏ ô bác hoặc người khác đang lo, bỏ ruộng lúa), đi lối như bác, tới nơi gọi `perform` của farmer.ts; lỗi thì bỏ qua im lặng. Không có năng lượng, nghỉ cùng giờ với bác (`crew.farmerAway`). Bác không nhận việc ở ô người làm vườn đang lo (`gardenerOn`). **Dụng cụ** `tool/buy` (`farmTools`, `farm.tools`): hiệu ứng trong farmer.ts — `hasTool`, `walkSpeed` (giày ×1.3, máy cày mới chở lúa ×1.5), `workTimeOf` (liềm thu ×0.5, máy cày mới ruộng lúa ×0.5), bình tưới lớn tưới cả hàng ô cùng loại (`waterRow` trong `perform`) |
| `achievements.ts` | **Sổ thành tựu** (`src/data/achievements.ts`, `state.achievements`): bộ đếm trọn ván `counts` cộng qua `tally()` (gọi trong `bumpQuest`, nên mọi mục tiêu đếm của nhiệm vụ đều được đếm), chỉ số khác đọc state (`achievementValue`); đạt mốc → `done` + `achievement/reached`; `achievement/claim` nhận thưởng (không tính doanh thu). Bảng 🏆 Thành tựu |
| `tutorial.ts` | **Ngày hướng dẫn** (ngày 1 của ván mới từ màn mở đầu, `state.tutorial`, `Game` option `tutorial`): intro (dừng giờ) → serve (2 nhóm khách dễ) → hard (khách `Party.want` gọi món thiếu nguyên liệu — `pickHardDish` bớt nguyên liệu ít món dùng nhất) → market (dừng giờ tới khi mua đủ) → cook → farm (dừng giờ, `farmChecklist`: gieo rau, lúa mì, thả gà; bác vẫn đi làm) → morning (khách tự do) → lunch (12:00 khách về hết, gọi món cho đội) → done. Dừng giờ = `tutorialFrozen`: `Game.tick` chỉ chạy farmer / gardeners / tutorial; khách lạ không tới trong các bước có kịch bản (`tutorialHoldsGuests`); giờ đứng ở 10:30 tới khi xong (`tutorialClockCap`). Lệnh `tutorial/next`, `tutorial/skip`. UI: `src/ui/coach.ts` (thẻ chỉ dẫn thay chỗ thẻ nhiệm vụ, nút đưa tới khu / sạp cần tới) |
| `helpers.ts` | Nhân viên phục vụ thuê thêm (`restaurant.helpers`, mỗi bậc hạng quán +1, tối đa 4): `helper/hire`, `helper/fire`, `helper/setJob` (bưng món / menu + ghi món / dọn bàn / lau sàn); nhân viên rảnh tự nhận việc (`pickTask`); đi lại / làm việc dùng chung `stepWorker` trong service.ts, chậm hơn bồi bàn (`balance.helpers.speedMul` 0.6). **Từ 2 nhân viên** (`teamMode`): người thuê đầu là quản lý (`isManager`, mặc vest — `makeHelperPerson` trong people.ts); mỗi người giữ một bàn (`HelperState.focus`, `pickFocused`): mang menu bàn nào thì chỉ ghi món, bưng món bàn đó, khách về thì dọn luôn rồi mới nhận bàn mới; rảnh tay thì bưng / dọn giúp bàn không ai giữ, lau sàn. Mỗi sáng `sickChance` (20%) một người bệnh nghỉ (`sick`, sự kiện `helper/sick`): không làm, không ra chợ ăn, không có mặt ở quán |
| `crew.ts` | **Cả đội** (đầu bếp, bồi bàn, nhân viên thuê, bác nông dân — `crewMembers`): năng lượng tối đa `maxEnergyOf` (đầu bếp `balance.crew.chefMaxEnergy` 30, anh shipper `shipperMaxEnergy` 40, bồi bàn / nhân viên / bác nông dân `maxEnergy` 50), mỗi việc tốn (`tire`: nấu 1 món −2, ghi món / bưng / lau / đồng áng −1; mang menu, dọn bàn không tốn; mỗi chuyến giao hàng 5–10). Bác nông dân trưa ra chợ dạo (`crew.farmerWaiting`), đội quán tan ca thì cả đội gọi món chung (`farmerJoins`), bác ăn `eatMinutes` rồi về (`farmerBack`); còn trên `farmerSkipLunchAbove` (75%) thì trưa ở lại làm. "Để mọi người tự chọn" = `autoPickFair` (chia đều, không âm tiền), cạn thì xỉu (`crew/revive` 50 xu). Giờ nghỉ: hết ca sáng + quán vắng khách thì đội quán ra chợ (`crew.restaurantAway`), 14:00 về; bác nông dân 12:00–13:00 (`crew.farmerAway`); tối sau ca cuối cả đội ra chợ ăn tối. Lúc ở chợ quán / nông trại tạm ngưng (`awayReason` → lời nhắc). Ra chợ thì mỗi người vào `crew.pending`: người chơi gọi món (`crew/order` — gọi được nhiều món, tính cả món đã gọi mà đầy năng lượng (`missingEnergy`) thì người đó xong; `crew/unorder` bỏ món, `crew/confirm` chốt ai đã có món; bảng `mealHtml` trong hud.ts chia 2 cột: người + thanh năng lượng (phần sọc = món đã gọi) | thực đơn — tự mở khi đội ra chợ, nút "Gọi món cho đội" dưới đồng hồ, bảng menu trong Tiệm 25caaaaa); quá hạn (giờ về − `crew.eatMinutes`) thì tự chọn (`crew/autoOrder` làm ngay): `autoPick` gọi một hoặc vài món cho tới khi người đó **đầy năng lượng** (còn tiền). Bảng gọi món và hoá đơn đang mở thì game dừng giờ (vòng lặp app.ts). Tổng không vượt tiền đang có (`mealBudget`). Ăn xong vào `crew.bill`; `billDue` = cả đợt ăn xong (tiền ăn của bác nông dân về sớm gộp chung) → người chơi trả một lần bằng `crew/pay` (quên thì sang ngày tự trả). `day/end`: kết thúc ngày sớm sau `crew.endDayAfter` (21:00). Ngủ qua đêm đầy sức |
| `home.ts` | Quán của riêng mình: `profile/rename`, `pet/*` (`profile.pets` đã nuôi, `profile.petsOut` đang ở quán — nhiều bé cùng lúc, `pet/set { petId, out }`), đồ trang trí `prop/*` (mua tự đặt chỗ thoáng, dời, xoay, cất kho, bán lại), bàn mua thêm `table/*`, `layout/rotateTable`, `restaurant/upgrade` (hạng quán) |
| `regulars.ts` (không phải system) | Khách quen: `pickRegular` (lúc tạo khách), món ruột, `regularTipBonus` / `regularPaid` (tim, quà tặng) — customers.ts gọi |
| `mills.ts` | Cối chế biến (cối xay gió, nhà xay lúa): nhận lúa bác chở tới (`mill.input`), làm thành phẩm đang chọn vào kho; lệnh `mill/buy`, `mill/setProduct` |
| `farmer.ts` | Bác nông dân: lệnh `farmer/do`, `farmer/doAll`, `farmer/cancel`; bác chạy thật trong sim (`state.farm.farmer`, toạ độ mét) theo lối đi, tới nơi mới áp dụng lệnh `farm/*` tương ứng. Hàng việc được chạy thử trên bản sao state lúc bấm để báo lỗi ngay |
| `market.ts` | Mua ở sạp chợ, giá dao động theo ngày |
| `progression.ts` | Mở khoá/bật tắt món, mua nâng cấp (trang thiết bị) |
| `decor.ts` | Mua/đổi nội thất (sàn, tường, bàn ghế), dời bàn, đặt lại bố cục |

`helpers.ts` chứa hàm dùng chung: kho (`stockOf`, `hasAll`, `addItem`...), tiền (`earn`, `spend`), `addXp`, `addReputation`, `modifier` (gộp hệ số từ thời tiết, nâng cấp, nội thất đang dùng, hạng quán, thú cưng và đồ trang trí đang bày — mỗi loại đồ tính 1 lần).

**Ông / bà chủ quán** — `GameState.owner` (`OwnerProfile`: `gender` male / female, `age` 25..50, `name` ≤ 16 ký tự (`ownerName`: trống thì "Ông chủ" / "Bà chủ", hiện trên đầu nhân vật), `hair` (`OWNER_HAIRS`, 'auto' = theo tuổi), `outfit` (`OWNER_OUTFITS`) — lọc theo giới tính (`for`: tóc nam ngắn / rẽ ngôi / undercut / đầu đinh / dựng, còn lại của nữ; quần áo nam gi-lê / thun + jean / polo, nữ áo kiểu + váy, tạp dề và áo dài cả hai) — `cleanOwner` kẹp / lọc lại) chọn ở màn mở đầu sau bước chọn quán (`Game` option `owner`, save v19; ván cũ = ông chủ 30 tuổi). Chỉ là hình: nhân vật đi dạo ở quán / chợ / nông trại / trong sạp (owner.ts), không có trong sim.

**Phong cách quán** — `GameState.cuisine` (`jp` / `kr` / `vn` / `oc`) chọn ở màn mở đầu, cố định trong ván. **Quán Ốc (`oc`) là quán vỉa hè**: cùng mặt bằng sim (bàn, quầy ra món, chỗ bồi bàn) nhưng hình khác hẳn — `src/ui/three/street.ts` thay `buildRoom` / gian bếp: nền bê tông lát ô ("Sàn nhà" = bê tông → gạch lề đường), dãy nhà phố phía sau, đường phía trước, sạp dù sọc che bếp (màu theo "Sơn tường"), xe đẩy ốc (bếp trưởng), bếp nướng than lập loè (bếp phó), bàn sơ chế cho đầu bếp thuê, bảng tên chân đứng (`standingSign`); không WC / kho. Dây đèn vàng ở `decorateInterior`; không có ô che bàn — mưa thì mái sạp dù kéo dài ra che cả sân (bạt hơi trong, `awning` trong street.ts). Mưa rơi quanh quán (`rainBox`), không rơi dưới sạp dù + mái đang kéo ra, mái kéo hết thì cả phía trước quán cũng tạnh, chỉ mưa hai bên (`Area.rainShelter`, Stage bỏ giọt mưa trong khung đó). Ban đêm tối hơn quán thường (`Area.nightDark` = 0.78, Stage giảm ánh trời khi đang xem khu này), dây đèn vàng sáng theo đêm + 6 đèn ấm hắt xuống sân (rực như đèn nông trại). Món: 9 món ốc / sò / tôm; phô mai (`cheese`) chỉ mua ở sạp đồ khô, hành lá (`scallion`) ở Tạp hóa. `CuisineDef` ở `src/data/cuisines.ts` (tên, mô tả, món giới thiệu, nguyên liệu khởi đầu). Món thuộc một quán (`RecipeDef.cuisine`), nội thất có thể riêng một quán (`DecorDef.cuisine`, bỏ trống = dùng chung); mỗi quán có đúng 1 nội thất mặc định mỗi slot. Lọc bằng `recipesFor` / `decorFor` / `defaultDecor` (`src/data/index.ts`). Nông trại và chợ dùng chung. Hình riêng từng quán (đồ trang trí, kiểu ghế, đồ trên bàn, mặt tiền) ở `src/ui/three/cuisine.ts`.

`src/sim/layout.ts` chứa hình học mặt bằng quán: `roomOf` (phòng theo hạng quán), `activeTables` / `tableById` (bàn gốc + bàn mua thêm, bàn xoay trả về w/h đã đổi + `rotated`; **đừng dùng `content.tables.get` cho bàn**), `tablePos`, `seatSpots`, `footprint`, `propRect`, `blockerOf` / `canPlaceTable` / `canPlaceProp` (luật đặt, dùng chung cho lệnh và phần xem trước khi kéo), `findFreeSpot` (chỗ thoáng nhất), `entranceOf` (lối ra vào không đặt đồ).

### UI

```
src/main.ts                hiện màn mở đầu (ui/title.ts) hoặc vào thẳng game (?fresh / ?play)
src/ui/title.ts            màn mở đầu: Chơi tiếp / Ván mới / Hướng dẫn chơi, chọn phong cách quán trên cảnh 3D 4 mặt tiền (renderer riêng),
                           nút "👀 Xem trước" mở quán đang chọn dạng ván tạm (?preview=, xem bảng tham số URL)
src/ui/tutorial.ts         hướng dẫn chơi: các trang `GUIDE` + `guideHtml` (dùng chung cho màn mở đầu và Cài đặt → Hướng dẫn, `ui.guide`)
src/ui/three/cuisine.ts    hình theo phong cách quán: decorateInterior, tableExtras, counterExtras, buildSeat, makeShopfront
src/ui/three/person.ts     NGƯỜI: makePerson(look, mũ, Shape) — dáng kid/teen/adult/elder, mập gầy (width), cao thấp (height), 10 kiểu tóc (addHair);
                           randomShape / adultShape (dáng ngẫu nhiên tất định theo seed), bóng mờ dưới chân, viền sáng mềm (rimify → toonRim trong toon.ts),
                           animatePerson (tư thế được làm mượt, nhún bước, lắc hông, dồn trọng tâm, ngồi nâng hông theo dáng). models.ts re-export tất cả
src/ui/three/people.ts     khách quen (makeRegular: dáng + tóc qua makePerson, quần/váy, phụ kiện theo PersonStyle) + thú cưng (makePet)
                           + ông / bà chủ (makeOwner: theo giới tính + tuổi — 25 trẻ, 35 chững chạc, 50 tóc muối tiêu, kính lão, ông có ria)
src/ui/three/owner.ts      OwnerWalker: ông / bà chủ đi dạo trong một khu (chọn chỗ → đi chậm → đứng ngó → chỗ khác; `via` để đi vòng vật cản,
                           `stay` đứng yên, `withMarker` ngôi sao trên đầu ở khu nhìn xa). Quán: khu ăn, né bàn bằng nextWaypoint của sim;
                           chợ: dọc vỉa hè, ghé ngó từng sạp; nông trại: theo lối của bác (farmer.nextWaypoint), dừng trước một ô;
                           trong sạp: bước vào rồi đứng chọn hàng ở chỗ đầu tiên của `addShoppers`
src/ui/calendar.ts         cuốn lịch (nút 📅 trên đồng hồ, `ui.calendar` = mùa đang xem lệch so với mùa hiện tại): lịch 2 tuần của một mùa
                           (hôm nay, ngày lễ, ngày tổng kết), dải 4 mùa, lật mùa, "Sắp tới" (`upcoming`: sự kiện hôm nay, lễ hội, sang mùa,
                           tổng kết). Mở lịch thì game tạm dừng
src/ui/three/props.ts      đồ trang trí đặt tự do (makeProp theo PropDef.model)
src/ui/three/portraits.ts  chân dung khách quen render từ model 3D (cache data URL)
src/ui/three/farmkit.ts    model nông trại: cối xay gió, nhà xay lúa, máy cày, bao lúa, kiện rơm, khóm lúa, viền đứt khúc
src/ui/app.ts              tạo Game + Stage, vòng lặp, lưu tự động, xử lý click, HUD, nút chuyển khu, ngăn kéo
src/ui/three/toon.ts       vật liệu toon, hình học có cache, mesh()/group(), emojiSprite(), Bar3D
src/ui/three/models.ts     model dùng chung: người, cây, hàng rào, rau củ, con vật, cột đèn, thùng hàng;
                           animatePerson(g, t, pose) (thở, chớp mắt, đi, ngồi, ăn, nấu, vẫy) và animateCreature (chớp mắt, vẫy đuôi);
                           makeCrop(id, giai đoạn 0..2), makeDish(recipeId) — món chưa có trong DISHES thì quán hiện emoji
src/ui/three/stage.ts      renderer, camera, ánh sáng, bầu trời ngày/đêm, mây, sao, mưa, bấm chọn (raycast)
src/ui/three/areas/*.ts    mỗi file một KHU (màn hình 3D): restaurant, farm, greenhouse (bên trong nhà kính), market, stall (bên trong quầy chợ / Tiệm 25caaaaa)
src/ui/panels/*.ts         các bảng HTML trong ngăn kéo: Quán, Thực đơn, Siêu thị, Chợ, Nông trại, Kho
src/ui/dom.ts              esc(), cmd(), ui(), bar(), morph()
src/ui/ease.ts             easing dùng chung (easeOutBack, easeOutElastic, wobble cho squash & stretch)
src/ui/hud.ts              HUD: trái = hàng trên (huy hiệu cấp, tiền (đồng xu vàng CSS `i.coin` — `coins()` trả HTML), uy tín, thẻ nhiệm vụ sát bên phải) + dải cảnh báo nguyên liệu `lowStockChip` (Hết: … · Sắp hết: …) thẳng lề trái bên dưới; phải = đồng hồ ("Thứ 2 Ngày 1", "Mùa Xuân · Năm 1", trạng thái Mở cửa / Đông khách / Nghỉ trưa / Đóng cửa) + cột nút tròn dưới bánh răng (`SIDE_PANELS`: Nông trại, Quán, Chợ, Nhân viên, Siêu thị); bảng Cài đặt. Thanh dưới (`#tools`, app.ts) = nút sang khu trái (xanh ngọc) + Khách quen, Thực đơn, Kho + nút sang khu phải
src/ui/audio.ts            âm thanh tổng hợp bằng Web Audio (không file): Sound.play(tên), nhạc nền tự sinh, tiếng mưa; bật/tắt lưu localStorage
src/ui/juice.ts            hiệu ứng DOM: flyIcon (bay về HUD), bump, floatText, Counter (số tiền chạy dần)
src/ui/three/fx.ts         Particles: hạt emoji bung ra trong cảnh 3D
```

- **Camera**: `OrbitControls` — kéo để xoay, lăn chuột / chụm hai ngón để zoom (`zoomToCursor`: zoom vào đúng chỗ con trỏ / tâm hai ngón; `Stage.clampTarget` cho tâm nhìn trôi tối đa `TARGET_ROAM` m khi zoom sát, lùi ra hết cỡ thì về giữa khu), bấm đúp để về góc mặc định. Giới hạn xoay ngang của từng khu là `view.orbit`; giới hạn zoom tính từ khoảng cách mặc định (`resetView()` trong `stage.ts`).
- **Khu (Area)**: interface trong `stage.ts`. Mỗi khu có `root` (Group), `view` (vị trí camera + `orbit`), `rainBox`, và `update(env, dt, speed)` đọc `game.state` mỗi khung hình để đồng bộ hình ảnh. Mọi khu đều được update dù đang ẩn. Thứ tự mảng `areas` trong `app.ts` là thứ tự trái → phải của các nút chuyển khu hai bên màn hình.
- **Env**: `stage.ts` tính mỗi khung hình từ giờ game và `WeatherDef.visual`: `day`, `night`, `rain`, `clouds`, `wind`, `dim`, `snow` (0..1), `season` (0..3) và `t` (giây thực). Khu dùng nó cho đèn, cây đung đưa, cối xay gió...
- **Mùa trong cảnh**: `stage.ts` pha tông trời / nắng theo mùa (`SEASON_SKY`, `SEASON_SUN`: Hạ vàng cam, Thu cam, Đông trắng lạnh), Thu gió lộng hơn + lá cam bay, Đông tuyết rơi (`updateFlakes`, hạt `Points`), đặt `wardrobe.winter` (models.ts) để mọi người quàng khăn (`userData.scarf`) và `wardrobe.rain` (trời mưa) để người ngoài chợ đã gắn `addUmbrella` (người đi chợ, hàng rong vỉa hè) giơ dù lên. Khu ngoài trời gọi `paintSeason(root, season)` (toon.ts) khi sang mùa: tán lá (khối ico xanh) và nền cỏ (`GROUND`) đổi màu; quán / nhà kính / quầy chợ chỉ đổi nền cỏ. Nông trại mùa Đông: nước đóng băng (`waterMat`), dòng nước ngừng chảy.
- **Bấm vật thể 3D**: gắn `obj.userData.pick = { type, id }` (kiểu `Pick`); `Stage` raycast (bỏ qua vật đang ẩn) rồi gọi `stage.onPick(pick, held)`, xử lý trong `app.ts` (vết bẩn `stain` chỉ cần bấm một cái — bấm giữ trên trình duyệt hay bật menu của trình duyệt). Hiện có `slot` (ô nông trại), `stall` (sạp chợ), `table` (kéo bàn; ngoài chế độ sắp xếp = bấm khách ở bàn đó), `party` (khách / bong bóng chat: mang menu, ghi món, hoặc giao món đang chọn), `pass` (quầy ra món: mở khay chọn món, `ui.serving`) `prop` (đồ trang trí: kéo / chọn ở chế độ sắp xếp, `ui.editSelected`), `goods` (khay hàng trong quầy chợ → bảng mua `buyHtml`, `ui.buyItem`) và `menuboard` (bảng menu Tiệm 25caaaaa → bảng gọi món cho cả đội).
- **Kéo vật thể 3D**: `stage.dragFilter(pick)` trả true thì vật đó kéo được (camera tạm khoá); `stage.onDrag(pick, x, z, end)` nhận toạ độ mặt sàn. Chế độ sắp xếp (`ui.editLayout`) dùng cơ chế này cho bàn và đồ trang trí: `RestaurantArea.dragItem()` vẽ xem trước (giữ nguyên chỗ nắm so với tâm vật — `grab`; vướng một chút thì tự hít vào chỗ đặt được gần nhất trong 45 đơn vị — `nearestPlaceable` trong layout.ts), thả ra thì `app.ts` gửi `layout/moveTable` / `prop/move` và chọn món đó (`ui.editSelected`, thanh trên cùng hiện nút xoay / cất / bán).
- **Màu quán theo nội thất**: `RestaurantArea` giữ bộ vật liệu riêng (`mats`) và mỗi khung hình tô lại theo `state.decor.equipped`.
- **Juice (hiệu ứng phản hồi)**: khu tự phát hiệu ứng bằng cách so state với khung hình trước (vd `FarmArea.react()`: gieo → cây bật lên, chín → nảy lò xo, thu → sản phẩm bung ra), không cần sự kiện sim mới. Muốn hiệu ứng DOM (bay về HUD) thì khu gọi callback (`farm.onHarvest`, `restaurant.onPaid`), `app.ts` chiếu toạ độ bằng `stage.toScreen()` rồi gọi `flyIcon`. Nút bấm lún bằng CSS `scale` (không đè `transform`).
- **Hình cho nội dung mới**: thứ gì chưa có model riêng đều hiện bằng `emojiSprite(icon)` — món ăn trên đĩa, hàng trên sạp, sản phẩm chín, producer lạ. Nên thêm data là thấy ngay trong cảnh 3D; dựng model riêng là việc làm đẹp sau.
- **Panel**: mỗi panel là hàm thuần `(game, ui) → chuỗi HTML`. `morph()` vá DOM tại chỗ nên không cần quản lý cập nhật thủ công. Nút bấm gắn `cmd({...})` cho lệnh sim (có kiểm tra kiểu), `ui('tên:tham số')` cho hành động thuần giao diện (xử lý trong `app.ts`). Phần tử trong danh sách nên có `data-key`.
- **Toạ độ quán**: `RoomDef`/`TableDef` dùng toạ độ 2D (hiện 720×600, 55 đơn vị = 1 mét); `areas/restaurant.ts` quy đổi sang mét bằng `wx()`/`wz()` và tự dựng phòng theo `content.room`.
- **Mobile**: màn hình ngang thấp có CSS thu gọn (`@media (max-height: 540px)`); thiết bị cảm ứng cầm dọc hiện lớp phủ `#rotate` mời xoay ngang. Trình duyệt không cho web tự ép xoay ngang (trừ khi toàn màn hình trên Android, hoặc cài lên màn hình chính qua `public/manifest.webmanifest`).

## Công thức cho các việc thường gặp

**Thêm nguyên liệu** — 1 dòng trong `src/data/items.ts`, rồi cho nó nguồn: thêm id vào `items` của một sạp (`market.ts`) và/hoặc làm `yields` của một producer (`farm.ts`). `infinite: true` = luôn có sẵn. Sạp chợ 3D tự bày thêm thùng hàng. Model 3D: thêm vào `MAKERS` trong `src/ui/three/ingredients.ts` (khay / rổ hàng trong quầy chợ bày model, tự co cùng cỡ — `goodsPiece` trong areas/stall.ts; không có thì hiện emoji).

**Thêm món** — 1 dòng `dish(quán, id, ...)` trong `src/data/recipes.ts` (món thuộc đúng 1 quán). Không cần sửa code. Model 3D: thêm vào `DISHES` trong `models.ts` (không có thì hiện emoji).

**Thêm cây trồng / vật nuôi** — 1 mục `ProducerDef` trong `src/data/farm.ts`. `cycles: 1` thu một lần; `cycles: 'infinite'` + `regrowTime` thu định kỳ. Muốn có model riêng: thêm vào bảng `CROPS` hoặc `ANIMALS` trong `src/ui/three/models.ts` (không thêm thì hiện emoji).

**Trạng thái ô nông trại** — `FarmSlot` có `tilled` (đã cuốc), `wet` (số phút đất còn ẩm), `tier` (bậc nới rộng). Loại ô nào cần cuốc/tưới/nới rộng được khai trong `SlotTypeDef`: `needsTilling`, `needsWater`, `tiers`. Thời tiết nào làm ẩm đất: `WeatherDef.wetsSoil`. Thời gian giữ ẩm và tốc độ lớn khi đất khô: `balance.farm`. Bấm ô trong cảnh 3D là giao việc hợp trạng thái cho bác nông dân (thu → cuốc → tưới; không có gì để làm thì bác chạy tới xem và mở bảng chọn giống), xem `stage.onPick` trong `app.ts`.

**Bác nông dân** (`src/sim/systems/farmer.ts`) — UI và bảng Nông trại **không gửi thẳng `farm/till|water|plant|harvest|clear`** nữa mà gửi `farmer/do { slotId, kind, producerId? }` (hoặc `farmer/doAll { kind: 'harvest'|'water' }`). Bác chạy tới chỗ đứng của ô (`workSpot`), làm `balance.farmer.workTime` phút rồi mới gọi handler `farm/*`; việc thất bại lúc tới nơi phát sự kiện `farmer/done { ok: false, reason }`. Lúc bấm, `preview()` chạy thử cả hàng việc trên bản sao state nên lỗi (thiếu tiền, đất chưa cuốc) báo ngay, và "cuốc rồi gieo liền" một ô vẫn hợp lệ. Bác đi theo lối: ngang theo khe giữa các hàng ô, dọc chỉ trên `balance.farmer.lanes` (`nextWaypoint`). Vị trí ô trên bản đồ lấy từ `SlotTypeDef.layout` (dùng chung cho sim và cảnh 3D). Lệnh `farm/*` cũ vẫn còn cho test và `?do=`.

**Ruộng tự động + cối** — loại ô có `SlotTypeDef.mill` (lúa mì → `windmill`, lúa nước → `ricemill`): người chơi chỉ bấm thu hoạch; `farmer.ts` (`autoChain`) chuyển sản lượng từ kho lên máy cày (`farmer.carry`), xếp "gieo lại giống cũ" rồi việc `haul` tới cối ít hàng nhất (`pickMill`). Cối (`MillTypeDef` trong `data/farm.ts`, state `farm.mills`) xay 1 lúa → 1 thành phẩm người chơi chọn. Thêm thành phẩm: thêm id vào `products`. Hình: `src/ui/three/farmkit.ts`.

**Bố cục nông trại** — vị trí ô theo `SlotTypeDef.layout` (`work`: bác đứng mép `front` / `left` / `back`), cối theo `MillTypeDef.layout` (`spot` = chỗ đổ lúa); lối dọc `balance.farmer.lanes` (hiện chỉ đường đất giữa x = 1.25). Ao chỉ 1 cái, mở rộng bằng `tiers` (nới diện tích), hình méo từ `farmkit.pondOutline`. Test "mua đủ mọi ô và cối" kiểm tra không ô nào chồng nhau và đường đi của bác không xuyên ô / cối — đổi bố cục thì chạy test đó. Chỗ còn mua được tự hiện viền đứt khúc + ➕ (`FarmArea.updateExpand`, `Pick { type: 'expand' }`).

**Nhà kính** — loại ô `gplot` có `SlotTypeDef.building` (nhà trên bản đồ nông trại, cửa = chỗ bác đứng), `batch` (mua theo lô: nhà dài thêm về phía đông), `growMul`. Rau củ trồng được nhờ `ProducerDef.alsoIn` (`fitsSlot`). Hình nhà: `farmkit.makeGreenhouse`, kích thước theo `buildingRect()`; luống bên trong vẽ ở khu riêng `areas/greenhouse.ts` (bấm nhà ở nông trại → `Pick { type: 'building' }` → `setArea`).

**Bấm ô / cối trong cảnh** — `stage.focusOn(x, z)` lướt camera lại gần, `ui.farmFocus` lọc bảng Nông trại, `ui.selectedSlot` = ô vừa bấm; đóng bảng thì `stage.unfocus()`. Bảng Nông trại **không còn lưới ô**: mỗi loại ô chỉ có dòng tóm tắt (chín / đang lớn / cần tưới / trống) + nút mua thêm; bấm ô trên cảnh thì bảng hiện chi tiết đúng ô đó (đang lớn: tiến độ, còn mấy ngày, tưới, thu, dọn; trống: danh sách giống). Dev: `?tab=farm&focus=field&slot=field-0`. Máy cày đậu cạnh ruộng lúa lúc rảnh (`FarmArea.parked`).

**Trời** — `env.noon` (nắng gắt buổi trưa), `env.wind` = thời tiết + gió theo giờ + cơn gió; khu có `outdoor = true` thì có vệt gió bay (`Stage.updateStreaks`).

**Thêm loại ô nông trại** — thêm vào union `SlotType` (`src/data/types.ts`), `slotTypes` (`farm.ts`, kèm `layout`), và nhánh dựng hình trong `buildSlot` của `src/ui/three/areas/farm.ts`.

**Thêm nhiệm vụ** — 1 mục trong `src/data/quests.ts` (thêm vào cuối, giữ id cũ; `chapter` = số chương, tên chương ở `questChapters`, thẻ HUD hiện "Chương N: …", bảng nhiệm vụ chia theo chương). Loại mục tiêu mới: thêm vào `QuestGoalKind`, rồi hoặc gọi `bumpQuest` ở chỗ chuyện xảy ra (đếm), hoặc thêm nhánh trong `stateValue` của `systems/quests.ts` (đọc state).

**Bên trong quầy chợ** (`areas/stall.ts`, khu `stall`) — bấm sạp nguyên liệu hoặc Tiệm 25caaaaa ở chợ thì `StallArea.show(id)` + `setArea('stall')` (như nhà kính): sạp nguyên liệu có khay hàng xếp bậc + biển giá hôm nay (bấm khay mua 1/5/10; quầy trước tối đa 2 hàng × 5 khay — `FRONT_MAX`, dư thì bày trên tầng trên kệ sau để không che người bán) — sạp có `StallDef.interior: 'tanks'` (hải sản) thay bằng bể nước (≤ 4 bể: chữ U; 5 bể: 3 bể vách sau + 2 bể chéo), hải sản bơi trong bể (bấm bể để mua); mặt hàng trong `StallDef.baskets` (ốc, sò) bày trong rổ quanh người bán và cái cân (`buildBasket`, bấm rổ để mua) (`StallArea.buildTanks`); sạp `interior: 'butcher'` (thịt) là bàn inox dài, nửa trái có giá treo inox với các tảng thịt (bấm tảng thịt / khay dưới giá để mua), nửa phải thớt gỗ to + dao phay + cân thịt (`buildButcher`), mái bạt cao 5 m để thấy bảng hiệu; tiệm có sàn trắng ngà, tường hai bên chạy tới mép trước, biển logo, bảng menu chân đứng gần cửa (tên món + giá hai cột), đèn thả trần sáng lên khi trời tối (`StallArea.addLamps`, sạp nguyên liệu cũng có 2 bóng dưới mái), bàn ghế cho cả đội ngồi ăn (ghế hai bên bàn, đĩa món đặt trên mặt bàn). Khu này không nằm trên thanh chuyển khu (chỉ có nút "‹ Chợ" để ra). Logo tiệm là ảnh `public/shop/tiem-25caaaaa.jpg` (đã cắt bỏ số điện thoại), dùng chung cho biển trên nóc tiệm ngoài chợ (`logoBoard`).

**Hàng rong / tiệm ăn vặt** (`StallDef.menu`, `items: []`) — không bán nguyên liệu: là chỗ cả đội ra ăn giờ nghỉ (món, giá, năng lượng hồi). Bảng Chợ chỉ hiện thực đơn; cảnh chợ vẽ người trong đội ngồi ăn theo `crew.meals` (`MarketArea.updateEaters`).

**Lời thoại nhân vật** — `src/ui/three/chatter.ts` (`Chatter`: lâu lâu bật một câu thành bong bóng chữ `speechSprite` trên đầu, ~3.5 s, im 5–11 s). Lời rao người bán = `StallDef.calls` (ngoài chợ + trong quầy); đầu bếp nói lúc đang nấu (`CHEF_LINES` trong areas/restaurant.ts, kèm chảo xóc đồ `chefKit` / `tossWok`); bác bảo vệ nói lúc xe máy vào bãi; khách vào trước mà bàn vào sau được mang menu / ghi món / có món trước thì than một câu (`RestaurantArea.checkFairness`, câu ở `COMPLAIN` — chỉ là hình, không đổi kiên nhẫn). Thao tác người bán trong quầy: sạp thịt chặt thịt (tư thế `chop` + dao phay trên tay), sạp hải sản lựa ở rổ → đặt lên cân (`StallArea.updateVendor`).

**Thêm sạp chợ** — 1 mục trong `src/data/market.ts`; khu chợ tự dựng thêm sạp, bảng tên (= `name`) và bảng chân đứng nếu có `standee`. `kind`: `stall` (sạp mái bạt, mặc định) / `kiosk` (tiệm nhỏ) xếp trong dãy chợ; `cart` / `pole` / `bike` (xe đẩy, gánh, xe đạp bán dạo) đứng trên vỉa hè ở `spot`. Bấm sạp thì camera lướt vào sát sạp (`MarketArea.stallCenter`). Xe cộ trên đường trước chợ: `farmkit.makeCar(màu, loại)` (4 loại `CAR_KINDS`: sedan / SUV / bán tải / tải mini, bảng màu `CAR_COLORS`) và `makeScooter` (người lái gọi `animatePerson(rider, t, { sit: true, ride: true })` để hai tay nắm tay lái), danh sách xe trong `MarketArea.buildScenery`.

**Trước cửa quán** (`src/ui/three/curbside.ts`, `Curbside`, cả 4 quán): vỉa hè rộng `SIDEWALK` (2.8 m, street.ts) + đường 2 làn, xe chạy qua lại; bãi giữ xe máy bên phải (2 dãy dọc tường bên), bãi ô tô bên trái (1 dãy), đầu xe hướng vào tường, bãi dài theo chiều sâu quán; biển P, chòi + bác bảo vệ (vẫy tay khi xe máy vào bãi). Khách tới bằng 3 cách theo id nhóm (`arrivalMode` trong customers.ts — sim tính luôn thời gian gửi xe `balance.arrival` vào `Party.walking`: chưa vào hàng chờ; xếp bàn xong `walking` = thời gian đi vào ghế, chưa cần menu, không mất kiên nhẫn): đi bộ dọc vỉa hè / xe máy / ô tô (bãi đầy thì đi bộ); xe du lịch (`Party.tour`): minibus đỗ trước cửa, đoàn xuống xe ở cửa xe; xe chạy vào bãi xong khách mới xuống (`holding`), đi ra vỉa hè rồi vào cửa (`entryVia`, `Actor.via`); về thì ra cửa → tới xe (`exitOf`), cả nhóm lên xe thì xe chạy đi. Camera mặc định quán lùi ra để thấy vỉa hè.

**Người phục vụ đi vòng qua bàn** — `src/sim/pathing.ts` `nextWaypoint(ctx, from, to)`: đi thẳng nếu không cắt mặt bàn / đồ trang trí (nới `CLEAR`), vướng thì A* trên lưới 15 đơn vị rồi đi tới điểm xa nhất còn thấy thẳng; lưới cache theo chữ ký bố cục. `stepWorker` (service.ts) dùng cho bồi bàn + nhân viên. Lau sàn có thời gian đứng lau (`balance.service.mopTime`, `WaiterState.work`), cảnh quán vẽ cây lau nhà + tư thế `mop` (`animatePerson`).

**Bưng món theo màu bàn** — lúc ghi món (`placeOrders`) nhóm khách được gán `Party.color` (màu đầu tiên chưa bàn nào dùng, `balance.service.partyColors` = 8; bảng màu ở `src/ui/colors.ts`). Bong bóng cảm xúc + bong bóng món của nhóm tô nền màu đó (`bubbleSprite(icons, size, bg)`), đĩa trên quầy line có vòng màu, món đang cầm hiện thành bong bóng màu trên đầu người phục vụ (`RestaurantArea.updateCarryBadges`) và ở thanh dưới (`serviceHtml` trong hud.ts). Bấm quầy → `service/pickup`, bấm bàn → `service/serve`. Đã bỏ khay kéo thả.

**Vườn cây ăn quả / ô đặt tay** — `SlotTypeDef.layout.spots` (vị trí từng ô + `work` riêng) thay cho lưới khi ô nằm nhiều cụm; `initialPlants` = cây trồng sẵn ở ô khởi đầu. Hình cây: `farmkit.makeFruitTree`.

**Thêm bàn** — 1 mục `TableDef` trong `src/data/restaurant.ts` (x, y là vị trí mặc định; test kiểm tra bố cục mặc định không chồng nhau); đặt `requiresUpgrade` nếu bàn chỉ có sau khi nâng cấp, `fixed` nếu không cho dời, `cuisines` nếu bàn chỉ có ở vài phong cách quán (quầy ghế đơn `counter` không có ở quán ốc; quán ốc có thêm bàn đôi `pair_oc`) — `activeTables` lọc theo đó. Cảnh quán tự dựng bàn ghế.

**Mặt bằng riêng theo quán** — `room.variants[cuisine]` ghi đè kích thước / `dining` / `pass` / `waiterHome` (lấy bằng `roomFor(content, cuisine)` hoặc `roomOf(ctx)`); `plan` chọn kiểu dựng gian bếp ở `areas/restaurant.ts` ('back' bếp tường sau, 'L' quầy chữ L quán Nhật — `buildKitchenL`, 'front' bếp sát cửa quán Việt — `buildKitchenFront`); `walls` = khối bếp (không đặt bàn, pathing đi vòng); `passStand` = chỗ bồi bàn đứng lấy món. Bàn khác nhau theo quán: `TableDef.byCuisine` (giữ id để save cũ không vỡ), `bar: 'east'` = khúc quầy dọc ghế quay sang phía Đông.

**Nới rộng quán / hạng quán** — hạng quán ở `room.tiers` (`src/data/restaurant.ts`): mỗi hạng một `height` (phòng sâu thêm về phía cửa, khu ăn uống giãn theo — `roomOf`) và `width` (nới về phía Đông: mép phải khu ăn, quầy ra món `pass`, `waiterHome` dời theo — luôn lấy từ `roomOf(ctx)`, đừng dùng `content.room.pass`; quầy ghế đơn `counter` thêm 1 ghế mỗi 60 đơn vị — `withCounterSeats`; cảnh quán kéo dài dãy bếp `kitchenExtra`). Lên hạng thì `app.ts` dựng lại `RestaurantArea` (`stage.replaceArea`). Hạng 1 phải bằng `room.height`.

**Thêm khách quen** — 1 mục `RegularDef` trong `src/data/regulars.ts`: `style` (dáng, tóc, màu, phụ kiện — phụ kiện mới thêm vào `Accessory` và nhánh trong `people.ts`), `favorites` (món ruột của cả 3 quán), `unlock`, `gift` (một PropDef `giftOnly`). Con số tim / tip ở `balance.regulars`.

**Thêm đồ trang trí / thú cưng / loại bàn** — `src/data/props.ts` (`props`, `pets`, `tableKinds`). Đồ trang trí có `model` (thêm hàm dựng vào `MAKERS` trong `ui/three/props.ts`; chưa có thì hiện emoji), `w`/`h` chiếm chỗ, `cuisine` nếu riêng một quán.

**Thêm nội thất (sàn, sơn tường, bộ bàn ghế)** — 1 mục `DecorDef` trong `src/data/decor.ts` (thêm `cuisine` nếu chỉ hợp một quán): `colors` cho hình ảnh, `modifiers` cho gameplay. Tự xuất hiện trong panel Siêu thị. Thêm loại nội thất mới (vd đèn, rèm): thêm vào union `DecorSlot`, `decorSlotNames`, một món `isDefault`, và chỗ dùng màu trong `areas/restaurant.ts`.

**Thêm trang thiết bị (nâng cấp)** — 1 mục `UpgradeDef` trong `src/data/restaurant.ts`; hiện ở cuối panel Siêu thị. Hiệu ứng dạng hệ số: `modifiers: { cookSpeed: 1.2 }`. Hình trong quán: thêm nhánh `has('id')` trong `buildEquipment` (`src/ui/three/equipment.ts`, quán trong nhà + quán ốc; `RestaurantArea.updateEquipment` dựng lại khi mua thêm); đồ nông trại (Hệ thống tưới) vẽ ở `FarmArea.updateSprinklers`. Chỉ số mới: thêm key vào `ModifierKey` rồi gọi `modifier(ctx, 'key')` ở nơi cần.

**Thêm kiểu thời tiết** — 1 mục trong `src/data/weather.ts` (thêm vào CUỐI mảng để không đổi kết quả ngẫu nhiên của mùa khác): `effects` cho gameplay, `visual` cho hình ảnh, `seasonWeights` cho từng mùa.

**Thêm lễ hội** — 1 mục `FestivalDef` trong `src/data/calendar.ts` (`season`, `day`, `effects`, `gift`, `decor`: `tet` / `lantern` / `xmas` / `bunting`). Trang trí dựng sẵn trong `ui/three/festive.ts` (`FestiveSet`: dây treo + đồ đứng, quán và chợ mỗi khu một bộ, chỉ hiện ngày lễ). HUD hiện dải lễ dưới đồng hồ, màn hết ngày báo lễ ngày mai.

**Mùa vụ cho giống / món** — `seasons: [0, 2]` trong mục `ProducerDef` (`farm.ts`) hoặc bảng `SEASONAL` cuối `recipes.ts`.

**Thêm khu mới (màn hình 3D)** — viết class `implements Area` trong `src/ui/three/areas/`, thêm vào mảng `areas` trong `app.ts`.

**Thêm lệnh** — thêm vào union `Command`, viết handler trong `commands` của system liên quan, thêm test.

**Thêm tính năng lớn (system mới)** — thêm trường vào `GameState` + giá trị khởi tạo trong `createInitialState`, tăng `SAVE_VERSION` và viết migration trong `save.ts` (v7 thêm phong cách quán và được chốt là chơi lại từ đầu nên đã xoá migration cũ; v7→v8 thêm cối là mẫu mới nhất), tạo `src/sim/systems/<tên>.ts`, đăng ký vào `defaultSystems`, thêm panel/hình ảnh nếu cần, thêm test.

**Chỉnh cân bằng** — `src/data/balance.ts` và các con số trong file data. Chạy `npm run sotay` để xem lại toàn bộ con số (đã đổi sang giây thực, có giá vốn, lãi mỗi món, lời mỗi vụ, hoà vốn vật nuôi).

**Sổ tay** — `scripts/so-tay.mjs` nạp `src/data` bằng Vite (`ssrLoadModule`), chạy `createContent` (data sai thì dừng), tính số dẫn xuất rồi nhúng JSON vào khuôn `scripts/so-tay.html` (tìm kiếm không dấu, sắp xếp theo cột, lọc món theo quán, liên kết chéo nguyên liệu ↔ món ↔ giống ↔ sạp, sáng / tối). Thêm loại nội dung mới: thêm vào `build()` trong script và một `sec(...)` trong khuôn.

`createContent()` tự kiểm tra tham chiếu chéo khi khởi động (món dùng nguyên liệu không tồn tại, nguyên liệu không có nguồn...) và ném lỗi rõ ràng.

## Quy ước

- Định danh bằng tiếng Anh, chú thích và chữ hiển thị bằng tiếng Việt.
- State chỉ chứa JSON thuần: không class, hàm, `Map`, `Set`, `Date`.
- Nội dung tham chiếu nhau bằng `id` chuỗi. Không đổi `id` đã phát hành (save cũ đang dùng); `reconcile()` trong `save.ts` chỉ xử lý được id bị xoá.
- Logic gameplay nằm trong `sim`, có test. Panel và cảnh 3D không tự tính luật — gọi hàm export từ system (vd `priceOf`, `slotPrice`, `cycleTime`, `activeTables`).
- Model 3D: nhìn về +z, chân ở y = 0, dựng bằng `mesh()`/`group()` trong `toon.ts`; vật liệu lấy từ `toon(màu)` (dùng chung — muốn đổi thuộc tính riêng thì truyền opts để tạo vật liệu mới).

## Những gì CHƯA có (gợi ý phát triển tiếp)

Theo thứ tự đề xuất:

1. **Cân bằng kinh tế** — đã chỉnh lần 1 ở đợt 16 (mô phỏng 6 ngày: lãi ~100–300 xu/ngày); còn lương nhân viên (G11).
2. ~~Bồi bàn / khâu phục vụ~~ — đã có (người chơi đóng vai). Tiếp theo: thuê bồi bàn tự động khi người chơi ở khu khác (dùng `autoServeCommands`), bưng 2 món một lượt.
3. **Lương nhân viên** — đã có thuê đầu bếp theo hạng bếp + giao món (giai đoạn 7); lương theo ngày tạm để dành (chủ dự án chưa cần).
4. **Thức ăn chăn nuôi, chế biến** (xay bột, làm phô mai...) — mở rộng `ProducerDef` với `inputs: ItemStack[]`, hoặc thêm system "xưởng" theo cùng mô hình.
5. ~~Nâng hạng quán, xoay bàn, mua thêm bàn, đồ trang trí tự do~~ — đã có (đợt 13). Tiếp theo: bếp to hơn theo hạng, đồ treo tường, mặt tiền có biển tên.
6. **Thời tiết sâu hơn** — đã có mùa trong năm, thời tiết theo mùa, giống / món theo mùa, bão, nắng nóng, lễ hội (giai đoạn 6). Tiếp theo: món đặc biệt chỉ bán ngày lễ, sự kiện ngẫu nhiên (khách VIP, thanh tra).
7. ~~Bán nông sản dư, hợp đồng giao hàng, sự kiện ngẫu nhiên~~ — đã có (giai đoạn 8). Tiếp theo: đơn đặt món mang về (cần bếp nấu), sự kiện nhiều bước.
8. **Mở rộng nông trại** — đã có người làm vườn + 4 dụng cụ (giai đoạn 11). Tiếp theo: thêm loài cá và bậc ao, cho vật nuôi ăn, hiệu ứng khi tưới/cuốc, thêm dụng cụ.
8. **Đơn mang về / giao tận nơi** — để dành (chủ dự án chốt ý tưởng, chưa làm): khách gọi điện đặt món, bếp nấu xong đóng hộp ở quầy line, shipper xe máy đi giao, đúng hạn thì nhận tiền + tip.
8. **Tiến trình khi offline** — `tick()` nhận số phút bất kỳ nên chỉ cần lưu mốc thời gian thực và tua bù có giới hạn.
9. **Âm thanh** (nghe theo `game.bus`), **model/animation chi tiết hơn** (tay chân cử động, khách cầm đũa...).
10. **Tối ưu draw call** nếu cảnh phình to: gộp mesh tĩnh theo vật liệu (xem `mergeStatic` trong `co-thu-3d/src/scene/helpers.js`).
