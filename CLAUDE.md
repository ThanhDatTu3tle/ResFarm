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
| `npm run build` | Typecheck + build production ra `dist` |

Sau mỗi thay đổi: chạy `npm run typecheck` và `npm test`. Ở bản dev, `window.game` là đối tượng `Game` (xem state, gọi `game.dispatch(...)`, `game.tick(phút)` từ console).

Tham số URL để thử nhanh (ghép được với nhau):

| Tham số | Tác dụng |
| --- | --- |
| (không có tham số) | Màn hình mở đầu: Chơi tiếp / Ván mới → chọn quán Nhật / Hàn / Việt |
| `?fresh` | Bỏ qua màn mở đầu và save, không ghi save (ván tạm) |
| `?cuisine=jp` | Kèm `?fresh`: phong cách quán của ván tạm (`jp` / `kr` / `vn`, mặc định `vn`) |
| `?play` | Bỏ qua màn mở đầu, vào thẳng ván đang lưu |
| `?pick=kr` | (chỉ bản dev) mở thẳng bước chọn quán ở màn mở đầu |
| `?focus=pen` | (chỉ bản dev) bảng Nông trại chỉ hiện một loại ô / cối (kèm `?tab=farm`) |
| `?seed=7` | Seed cho game mới |
| `?ff=300` | Tua 300 phút game lúc tải (720 ≈ 20:00, trời tối) |
| `?area=farm` | Mở sẵn khu `farm` / `restaurant` / `market` |
| `?tab=menu` | Mở sẵn một panel trong ngăn kéo |
| `?speed=4` | Tốc độ ban đầu |
| `?weather=rain` | (chỉ bản dev) ép thời tiết |
| `?rich` | (chỉ bản dev) nhiều tiền + cấp 9, để thử mua sắm |
| `?edit` | (chỉ bản dev) mở sẵn chế độ sắp xếp bàn |
| `?pass` | (chỉ bản dev) mở sẵn khay quầy ra món |
| `?do=[...]` | (chỉ bản dev) chạy sẵn một mảng Command dạng JSON đã mã hoá URL, trước khi tua |

Ví dụ: `http://localhost:5184/?fresh&cuisine=jp&seed=5&ff=720&weather=rain&area=market`.

Phím tắt: `Space` tạm dừng / chạy tiếp, `Esc` đóng bảng Cài đặt. Mở Cài đặt thì game tự tạm dừng.

Lưu ý: vòng lặp chạy bằng `requestAnimationFrame` nên khi tab bị ẩn game tạm dừng — muốn kiểm tra khi tab không hiển thị thì dùng `?ff=`.

## Thời gian trong game

Mọi thời lượng trong `src/data` (nấu món, cây lớn, kiên nhẫn của khách...) tính bằng **phút game**. Chỉ một hằng số nối với thời gian thực: `balance.minutesPerSecond` (hiện 1.5).

- Một ngày = 06:00 → 24:00 = 1080 phút game = **12 phút thực** ở tốc độ x1. Quán mở 2 ca `balance.shifts` (07:00–12:00, ngưng nhận khách 11:30; 15:00–21:00, ngưng nhận khách 20:30 — `lastCall`); đóng cửa thì khách chưa gọi món về, cả đội ra chợ ăn. Hết mỗi ca sàn có thêm vết bẩn (`balance.stains`).
- Quy đổi: `phút game = giây thực × 1.5` — cây muốn lớn trong 5 phút thực thì `growTime: 450`.
- **Ngoại lệ:** `cookTime` trong `recipes.ts` vẫn ghi theo nhịp cũ (0.7) và được nhân `COOK_SCALE` trong hàm `dish()`; các mốc phục vụ trong `balance.ts` (kiên nhẫn, tốc độ bồi bàn, thời gian ăn...) đã nhân ~2.1 khi đổi 0.7 → 1.5 để giữ nhịp theo giây thực. Đổi `minutesPerSecond` lần nữa thì nhớ chỉnh hai chỗ này.
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
| `calendar.ts` (không phải system) | `calendarOf(day)`: thứ, ngày trong mùa, mùa, năm — ngày 1 = Thứ Hai mùng 1 Xuân năm 1, mùa 28 ngày. Tên mùa/thứ ở `src/data/calendar.ts` |
| `weather.ts` | Thời tiết đổi ngẫu nhiên; hiệu ứng gameplay lấy từ `WeatherDef.effects` |
| `customers.ts` | Khách tới, xếp hàng, xếp bàn, chờ menu → xem menu → chờ ghi món → chờ món (tâm trạng `moodOf`) → ăn → trả tiền (tip theo tâm trạng) / bỏ về |
| `service.ts` | Người chơi là bồi bàn: lệnh `service/menu`, `service/takeOrder`, `service/deliver { orderIds }` (bưng cả khay một lượt), `service/clean` (dọn chén dĩa dơ — `restaurant.dirty`, ghế dơ không xếp khách), `service/mop` (lau vết bẩn — `restaurant.stains`, làm khách kém kiên nhẫn); `addStains` gọi lúc hết ca. Bồi bàn đi thật trong sim (`state.restaurant.waiter`), làm việc theo hàng, rảnh thì đứng yên tại chỗ. `autoServeCommands` = người chơi mẫu cho test/cân bằng |
| `kitchen.ts` | Đầu bếp nhận đơn và nấu; xong thì đặt ra quầy ra món (`ready`) |
| `farm.ts` | Ô nông trại: cuốc đất, gieo/nuôi, tưới (mưa tự làm ẩm), lớn, thu hoạch, mua ô, nới rộng ô |
| `quests.ts` | Nhiệm vụ hệ thống: chuỗi `content.quests` làm lần lượt; mục tiêu đếm qua `bumpQuest(ctx, kind, n)`, mục tiêu trạng thái đọc state; lệnh `quest/claim` |
| `helpers.ts` | Nhân viên phục vụ thuê thêm (`restaurant.helpers`, mỗi bậc hạng quán +1, tối đa 4): `helper/hire`, `helper/fire`, `helper/setJob` (bưng món / menu + ghi món / dọn bàn / lau sàn); nhân viên rảnh tự nhận việc (`pickTask`); đi lại / làm việc dùng chung `stepWorker` trong service.ts |
| `crew.ts` | **Cả đội** (đầu bếp, bồi bàn, nhân viên thuê, bác nông dân — `crewMembers`): năng lượng tối đa `balance.crew.maxEnergy` (30), mỗi việc tốn (`tire`: nấu 1 món −2, phục vụ / đồng áng −1), cạn thì xỉu (`crew/revive` 100 xu). Giờ nghỉ: hết ca sáng + quán vắng khách thì đội quán ra chợ (`crew.restaurantAway`), 14:00 về; bác nông dân 12:00–13:00 (`crew.farmerAway`); tối sau ca cuối cả đội ra chợ ăn tối. Lúc ở chợ quán / nông trại tạm ngưng (`awayReason` → lời nhắc). Ra chợ thì mỗi người vào `crew.pending`: người chơi gọi món (`crew/order`, bảng `mealHtml` trong hud.ts — tự mở khi đội ra chợ, nút "Gọi món cho đội" dưới đồng hồ, bảng menu trong Tiệm 25caaaaa); quá hạn (giờ về − `crew.eatMinutes`) thì tự chọn ngẫu nhiên (`crew/autoOrder` làm ngay). Tổng không vượt tiền đang có (`mealBudget`). Ăn xong vào `crew.bill`; `billDue` = cả đợt ăn xong (tiền ăn của bác nông dân về sớm gộp chung) → người chơi trả một lần bằng `crew/pay` (quên thì sang ngày tự trả). `day/end`: kết thúc ngày sớm sau `crew.endDayAfter` (21:00). Ngủ qua đêm đầy sức |
| `home.ts` | Quán của riêng mình: `profile/rename`, `pet/*`, đồ trang trí `prop/*` (mua tự đặt chỗ thoáng, dời, xoay, cất kho, bán lại), bàn mua thêm `table/*`, `layout/rotateTable`, `restaurant/upgrade` (hạng quán) |
| `regulars.ts` (không phải system) | Khách quen: `pickRegular` (lúc tạo khách), món ruột, `regularTipBonus` / `regularPaid` (tim, quà tặng) — customers.ts gọi |
| `mills.ts` | Cối chế biến (cối xay gió, nhà xay lúa): nhận lúa bác chở tới (`mill.input`), làm thành phẩm đang chọn vào kho; lệnh `mill/buy`, `mill/setProduct` |
| `farmer.ts` | Bác nông dân: lệnh `farmer/do`, `farmer/doAll`, `farmer/cancel`; bác chạy thật trong sim (`state.farm.farmer`, toạ độ mét) theo lối đi, tới nơi mới áp dụng lệnh `farm/*` tương ứng. Hàng việc được chạy thử trên bản sao state lúc bấm để báo lỗi ngay |
| `market.ts` | Mua ở sạp chợ, giá dao động theo ngày |
| `progression.ts` | Mở khoá/bật tắt món, mua nâng cấp (trang thiết bị) |
| `decor.ts` | Mua/đổi nội thất (sàn, tường, bàn ghế), dời bàn, đặt lại bố cục |

`helpers.ts` chứa hàm dùng chung: kho (`stockOf`, `hasAll`, `addItem`...), tiền (`earn`, `spend`), `addXp`, `addReputation`, `modifier` (gộp hệ số từ thời tiết, nâng cấp, nội thất đang dùng, hạng quán, thú cưng và đồ trang trí đang bày — mỗi loại đồ tính 1 lần).

**Phong cách quán** — `GameState.cuisine` (`jp` / `kr` / `vn`) chọn ở màn mở đầu, cố định trong ván. `CuisineDef` ở `src/data/cuisines.ts` (tên, mô tả, món giới thiệu, nguyên liệu khởi đầu). Món thuộc một quán (`RecipeDef.cuisine`), nội thất có thể riêng một quán (`DecorDef.cuisine`, bỏ trống = dùng chung); mỗi quán có đúng 1 nội thất mặc định mỗi slot. Lọc bằng `recipesFor` / `decorFor` / `defaultDecor` (`src/data/index.ts`). Nông trại và chợ dùng chung. Hình riêng từng quán (đồ trang trí, kiểu ghế, đồ trên bàn, mặt tiền) ở `src/ui/three/cuisine.ts`.

`src/sim/layout.ts` chứa hình học mặt bằng quán: `roomOf` (phòng theo hạng quán), `activeTables` / `tableById` (bàn gốc + bàn mua thêm, bàn xoay trả về w/h đã đổi + `rotated`; **đừng dùng `content.tables.get` cho bàn**), `tablePos`, `seatSpots`, `footprint`, `propRect`, `blockerOf` / `canPlaceTable` / `canPlaceProp` (luật đặt, dùng chung cho lệnh và phần xem trước khi kéo), `findFreeSpot` (chỗ thoáng nhất), `entranceOf` (lối ra vào không đặt đồ).

### UI

```
src/main.ts                hiện màn mở đầu (ui/title.ts) hoặc vào thẳng game (?fresh / ?play)
src/ui/title.ts            màn mở đầu: Chơi tiếp / Ván mới, chọn phong cách quán trên cảnh 3D 3 mặt tiền (renderer riêng)
src/ui/three/cuisine.ts    hình theo phong cách quán: decorateInterior, tableExtras, counterExtras, buildSeat, makeShopfront
src/ui/three/people.ts     khách quen (makeRegular: dáng, tóc, phụ kiện theo PersonStyle) + thú cưng (makePet)
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
src/ui/hud.ts              HUD (huy hiệu cấp, tiền, uy tín, đồng hồ ngày đêm + lịch + thời tiết) và bảng Cài đặt (nút bánh răng)
src/ui/audio.ts            âm thanh tổng hợp bằng Web Audio (không file): Sound.play(tên), nhạc nền tự sinh, tiếng mưa; bật/tắt lưu localStorage
src/ui/juice.ts            hiệu ứng DOM: flyIcon (bay về HUD), bump, floatText, Counter (số tiền chạy dần)
src/ui/three/fx.ts         Particles: hạt emoji bung ra trong cảnh 3D
```

- **Camera**: `OrbitControls` — kéo để xoay, lăn chuột / chụm hai ngón để zoom, bấm đúp để về góc mặc định. Giới hạn xoay ngang của từng khu là `view.orbit`; giới hạn zoom tính từ khoảng cách mặc định (`resetView()` trong `stage.ts`).
- **Khu (Area)**: interface trong `stage.ts`. Mỗi khu có `root` (Group), `view` (vị trí camera + `orbit`), `rainBox`, và `update(env, dt, speed)` đọc `game.state` mỗi khung hình để đồng bộ hình ảnh. Mọi khu đều được update dù đang ẩn. Thứ tự mảng `areas` trong `app.ts` là thứ tự trái → phải của các nút chuyển khu hai bên màn hình.
- **Env**: `stage.ts` tính mỗi khung hình từ giờ game và `WeatherDef.visual`: `day`, `night`, `rain`, `clouds`, `wind`, `dim` (0..1) và `t` (giây thực). Khu dùng nó cho đèn, cây đung đưa, cối xay gió...
- **Bấm vật thể 3D**: gắn `obj.userData.pick = { type, id }` (kiểu `Pick`); `Stage` raycast (bỏ qua vật đang ẩn) rồi gọi `stage.onPick(pick, held)`, xử lý trong `app.ts` (vết bẩn `stain` chỉ cần bấm một cái — bấm giữ trên trình duyệt hay bật menu của trình duyệt). Hiện có `slot` (ô nông trại), `stall` (sạp chợ), `table` (kéo bàn; ngoài chế độ sắp xếp = bấm khách ở bàn đó), `party` (khách / bong bóng chat: mang menu, ghi món, hoặc giao món đang chọn), `pass` (quầy ra món: mở khay chọn món, `ui.serving`) `prop` (đồ trang trí: kéo / chọn ở chế độ sắp xếp, `ui.editSelected`), `goods` (khay hàng trong quầy chợ → bảng mua `buyHtml`, `ui.buyItem`) và `menuboard` (bảng menu Tiệm 25caaaaa → bảng gọi món cho cả đội).
- **Kéo vật thể 3D**: `stage.dragFilter(pick)` trả true thì vật đó kéo được (camera tạm khoá); `stage.onDrag(pick, x, z, end)` nhận toạ độ mặt sàn. Chế độ sắp xếp (`ui.editLayout`) dùng cơ chế này cho bàn và đồ trang trí: `RestaurantArea.dragItem()` vẽ xem trước, thả ra thì `app.ts` gửi `layout/moveTable` / `prop/move` và chọn món đó (`ui.editSelected`, thanh trên cùng hiện nút xoay / cất / bán).
- **Màu quán theo nội thất**: `RestaurantArea` giữ bộ vật liệu riêng (`mats`) và mỗi khung hình tô lại theo `state.decor.equipped`.
- **Juice (hiệu ứng phản hồi)**: khu tự phát hiệu ứng bằng cách so state với khung hình trước (vd `FarmArea.react()`: gieo → cây bật lên, chín → nảy lò xo, thu → sản phẩm bung ra), không cần sự kiện sim mới. Muốn hiệu ứng DOM (bay về HUD) thì khu gọi callback (`farm.onHarvest`, `restaurant.onPaid`), `app.ts` chiếu toạ độ bằng `stage.toScreen()` rồi gọi `flyIcon`. Nút bấm lún bằng CSS `scale` (không đè `transform`).
- **Hình cho nội dung mới**: thứ gì chưa có model riêng đều hiện bằng `emojiSprite(icon)` — món ăn trên đĩa, hàng trên sạp, sản phẩm chín, producer lạ. Nên thêm data là thấy ngay trong cảnh 3D; dựng model riêng là việc làm đẹp sau.
- **Panel**: mỗi panel là hàm thuần `(game, ui) → chuỗi HTML`. `morph()` vá DOM tại chỗ nên không cần quản lý cập nhật thủ công. Nút bấm gắn `cmd({...})` cho lệnh sim (có kiểm tra kiểu), `ui('tên:tham số')` cho hành động thuần giao diện (xử lý trong `app.ts`). Phần tử trong danh sách nên có `data-key`.
- **Toạ độ quán**: `RoomDef`/`TableDef` dùng toạ độ 2D (hiện 720×600, 55 đơn vị = 1 mét); `areas/restaurant.ts` quy đổi sang mét bằng `wx()`/`wz()` và tự dựng phòng theo `content.room`.
- **Mobile**: màn hình ngang thấp có CSS thu gọn (`@media (max-height: 540px)`); thiết bị cảm ứng cầm dọc hiện lớp phủ `#rotate` mời xoay ngang. Trình duyệt không cho web tự ép xoay ngang (trừ khi toàn màn hình trên Android, hoặc cài lên màn hình chính qua `public/manifest.webmanifest`).

## Công thức cho các việc thường gặp

**Thêm nguyên liệu** — 1 dòng trong `src/data/items.ts`, rồi cho nó nguồn: thêm id vào `items` của một sạp (`market.ts`) và/hoặc làm `yields` của một producer (`farm.ts`). `infinite: true` = luôn có sẵn. Sạp chợ 3D tự bày thêm thùng hàng.

**Thêm món** — 1 dòng `dish(quán, id, ...)` trong `src/data/recipes.ts` (món thuộc đúng 1 quán). Không cần sửa code. Model 3D: thêm vào `DISHES` trong `models.ts` (không có thì hiện emoji).

**Thêm cây trồng / vật nuôi** — 1 mục `ProducerDef` trong `src/data/farm.ts`. `cycles: 1` thu một lần; `cycles: 'infinite'` + `regrowTime` thu định kỳ. Muốn có model riêng: thêm vào bảng `CROPS` hoặc `ANIMALS` trong `src/ui/three/models.ts` (không thêm thì hiện emoji).

**Trạng thái ô nông trại** — `FarmSlot` có `tilled` (đã cuốc), `wet` (số phút đất còn ẩm), `tier` (bậc nới rộng). Loại ô nào cần cuốc/tưới/nới rộng được khai trong `SlotTypeDef`: `needsTilling`, `needsWater`, `tiers`. Thời tiết nào làm ẩm đất: `WeatherDef.wetsSoil`. Thời gian giữ ẩm và tốc độ lớn khi đất khô: `balance.farm`. Bấm ô trong cảnh 3D là giao việc hợp trạng thái cho bác nông dân (thu → cuốc → tưới; không có gì để làm thì bác chạy tới xem và mở bảng chọn giống), xem `stage.onPick` trong `app.ts`.

**Bác nông dân** (`src/sim/systems/farmer.ts`) — UI và bảng Nông trại **không gửi thẳng `farm/till|water|plant|harvest|clear`** nữa mà gửi `farmer/do { slotId, kind, producerId? }` (hoặc `farmer/doAll { kind: 'harvest'|'water' }`). Bác chạy tới chỗ đứng của ô (`workSpot`), làm `balance.farmer.workTime` phút rồi mới gọi handler `farm/*`; việc thất bại lúc tới nơi phát sự kiện `farmer/done { ok: false, reason }`. Lúc bấm, `preview()` chạy thử cả hàng việc trên bản sao state nên lỗi (thiếu tiền, đất chưa cuốc) báo ngay, và "cuốc rồi gieo liền" một ô vẫn hợp lệ. Bác đi theo lối: ngang theo khe giữa các hàng ô, dọc chỉ trên `balance.farmer.lanes` (`nextWaypoint`). Vị trí ô trên bản đồ lấy từ `SlotTypeDef.layout` (dùng chung cho sim và cảnh 3D). Lệnh `farm/*` cũ vẫn còn cho test và `?do=`.

**Ruộng tự động + cối** — loại ô có `SlotTypeDef.mill` (lúa mì → `windmill`, lúa nước → `ricemill`): người chơi chỉ bấm thu hoạch; `farmer.ts` (`autoChain`) chuyển sản lượng từ kho lên máy cày (`farmer.carry`), xếp "gieo lại giống cũ" rồi việc `haul` tới cối ít hàng nhất (`pickMill`). Cối (`MillTypeDef` trong `data/farm.ts`, state `farm.mills`) xay 1 lúa → 1 thành phẩm người chơi chọn. Thêm thành phẩm: thêm id vào `products`. Hình: `src/ui/three/farmkit.ts`.

**Bố cục nông trại** — vị trí ô theo `SlotTypeDef.layout` (`work`: bác đứng mép `front` / `left` / `back`), cối theo `MillTypeDef.layout` (`spot` = chỗ đổ lúa); lối dọc `balance.farmer.lanes` (hiện chỉ đường đất giữa x = 1.25). Ao chỉ 1 cái, mở rộng bằng `tiers` (nới diện tích), hình méo từ `farmkit.pondOutline`. Test "mua đủ mọi ô và cối" kiểm tra không ô nào chồng nhau và đường đi của bác không xuyên ô / cối — đổi bố cục thì chạy test đó. Chỗ còn mua được tự hiện viền đứt khúc + ➕ (`FarmArea.updateExpand`, `Pick { type: 'expand' }`).

**Nhà kính** — loại ô `gplot` có `SlotTypeDef.building` (nhà trên bản đồ nông trại, cửa = chỗ bác đứng), `batch` (mua theo lô: nhà dài thêm về phía đông), `growMul`. Rau củ trồng được nhờ `ProducerDef.alsoIn` (`fitsSlot`). Hình nhà: `farmkit.makeGreenhouse`, kích thước theo `buildingRect()`; luống bên trong vẽ ở khu riêng `areas/greenhouse.ts` (bấm nhà ở nông trại → `Pick { type: 'building' }` → `setArea`).

**Bấm ô / cối trong cảnh** — `stage.focusOn(x, z)` lướt camera lại gần, `ui.farmFocus` lọc bảng Nông trại; đóng bảng thì `stage.unfocus()`.

**Trời** — `env.noon` (nắng gắt buổi trưa), `env.wind` = thời tiết + gió theo giờ + cơn gió; khu có `outdoor = true` thì có vệt gió bay (`Stage.updateStreaks`).

**Thêm loại ô nông trại** — thêm vào union `SlotType` (`src/data/types.ts`), `slotTypes` (`farm.ts`, kèm `layout`), và nhánh dựng hình trong `buildSlot` của `src/ui/three/areas/farm.ts`.

**Thêm nhiệm vụ** — 1 mục trong `src/data/quests.ts` (thêm vào cuối, giữ id cũ). Loại mục tiêu mới: thêm vào `QuestGoalKind`, rồi hoặc gọi `bumpQuest` ở chỗ chuyện xảy ra (đếm), hoặc thêm nhánh trong `stateValue` của `systems/quests.ts` (đọc state).

**Bên trong quầy chợ** (`areas/stall.ts`, khu `stall`) — bấm sạp nguyên liệu hoặc Tiệm 25caaaaa ở chợ thì `StallArea.show(id)` + `setArea('stall')` (như nhà kính): sạp nguyên liệu có khay hàng xếp bậc + biển giá hôm nay (bấm khay mua 1/5/10), tiệm có biển logo, bảng menu, bàn ghế cho cả đội ngồi ăn. Khu này không nằm trên thanh chuyển khu (chỉ có nút "‹ Chợ" để ra). Logo tiệm là ảnh `public/shop/tiem-25caaaaa.jpg` (đã cắt bỏ số điện thoại), dùng chung cho biển trên nóc tiệm ngoài chợ (`logoBoard`).

**Hàng rong / tiệm ăn vặt** (`StallDef.menu`, `items: []`) — không bán nguyên liệu: là chỗ cả đội ra ăn giờ nghỉ (món, giá, năng lượng hồi). Bảng Chợ chỉ hiện thực đơn; cảnh chợ vẽ người trong đội ngồi ăn theo `crew.meals` (`MarketArea.updateEaters`).

**Thêm sạp chợ** — 1 mục trong `src/data/market.ts`; khu chợ tự dựng thêm sạp, bảng tên (= `name`) và bảng chân đứng nếu có `standee`. `kind`: `stall` (sạp mái bạt, mặc định) / `kiosk` (tiệm nhỏ) xếp trong dãy chợ; `cart` / `pole` / `bike` (xe đẩy, gánh, xe đạp bán dạo) đứng trên vỉa hè ở `spot`. Bấm sạp thì camera lướt vào sát sạp (`MarketArea.stallCenter`). Xe cộ trên đường trước chợ: `farmkit.makeCar/makeTruck/makeScooter`, danh sách xe trong `MarketArea.buildScenery`.

**Khay ở quầy ra món** — bấm quầy mở bảng quầy **trong ngăn kéo bên phải** (`serviceHtml` trong hud.ts, cảnh 3D thu hẹp lại nên vẫn thấy bàn): bấm một món = cầm món đó rồi bấm bàn để giao (`ui.serving`); kéo món vào khay 2 ô hoặc 4 ô (`ui.tray2/tray4`), bấm "Cầm khay" (`ui.trayPick`) rồi bấm bàn → `service/deliver` cả khay. Không tự bưng: `trayParty()` chỉ để gợi ý bàn khớp món.

**Vườn cây ăn quả / ô đặt tay** — `SlotTypeDef.layout.spots` (vị trí từng ô + `work` riêng) thay cho lưới khi ô nằm nhiều cụm; `initialPlants` = cây trồng sẵn ở ô khởi đầu. Hình cây: `farmkit.makeFruitTree`.

**Thêm bàn** — 1 mục `TableDef` trong `src/data/restaurant.ts` (x, y là vị trí mặc định; test kiểm tra bố cục mặc định không chồng nhau); đặt `requiresUpgrade` nếu bàn chỉ có sau khi nâng cấp, `fixed` nếu không cho dời. Cảnh quán tự dựng bàn ghế.

**Nới rộng quán / hạng quán** — hạng quán ở `room.tiers` (`src/data/restaurant.ts`): mỗi hạng một `height` (phòng sâu thêm về phía cửa, khu ăn uống giãn theo — `roomOf`). Lên hạng thì `app.ts` dựng lại `RestaurantArea` (`stage.replaceArea`). Hạng 1 phải bằng `room.height`.

**Thêm khách quen** — 1 mục `RegularDef` trong `src/data/regulars.ts`: `style` (dáng, tóc, màu, phụ kiện — phụ kiện mới thêm vào `Accessory` và nhánh trong `people.ts`), `favorites` (món ruột của cả 3 quán), `unlock`, `gift` (một PropDef `giftOnly`). Con số tim / tip ở `balance.regulars`.

**Thêm đồ trang trí / thú cưng / loại bàn** — `src/data/props.ts` (`props`, `pets`, `tableKinds`). Đồ trang trí có `model` (thêm hàm dựng vào `MAKERS` trong `ui/three/props.ts`; chưa có thì hiện emoji), `w`/`h` chiếm chỗ, `cuisine` nếu riêng một quán.

**Thêm nội thất (sàn, sơn tường, bộ bàn ghế)** — 1 mục `DecorDef` trong `src/data/decor.ts` (thêm `cuisine` nếu chỉ hợp một quán): `colors` cho hình ảnh, `modifiers` cho gameplay. Tự xuất hiện trong panel Siêu thị. Thêm loại nội thất mới (vd đèn, rèm): thêm vào union `DecorSlot`, `decorSlotNames`, một món `isDefault`, và chỗ dùng màu trong `areas/restaurant.ts`.

**Thêm trang thiết bị (nâng cấp)** — 1 mục `UpgradeDef` trong `src/data/restaurant.ts`; hiện ở cuối panel Siêu thị. Hiệu ứng dạng hệ số: `modifiers: { cookSpeed: 1.2 }`. Chỉ số mới: thêm key vào `ModifierKey` rồi gọi `modifier(ctx, 'key')` ở nơi cần.

**Thêm kiểu thời tiết** — 1 mục trong `src/data/weather.ts`: `effects` cho gameplay, `visual` cho hình ảnh.

**Thêm khu mới (màn hình 3D)** — viết class `implements Area` trong `src/ui/three/areas/`, thêm vào mảng `areas` trong `app.ts`.

**Thêm lệnh** — thêm vào union `Command`, viết handler trong `commands` của system liên quan, thêm test.

**Thêm tính năng lớn (system mới)** — thêm trường vào `GameState` + giá trị khởi tạo trong `createInitialState`, tăng `SAVE_VERSION` và viết migration trong `save.ts` (v7 thêm phong cách quán và được chốt là chơi lại từ đầu nên đã xoá migration cũ; v7→v8 thêm cối là mẫu mới nhất), tạo `src/sim/systems/<tên>.ts`, đăng ký vào `defaultSystems`, thêm panel/hình ảnh nếu cần, thêm test.

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

1. **Cân bằng kinh tế** — đã chỉnh lần 1 ở đợt 16 (mô phỏng 6 ngày: lãi ~100–300 xu/ngày); còn lương nhân viên (G11).
2. ~~Bồi bàn / khâu phục vụ~~ — đã có (người chơi đóng vai). Tiếp theo: thuê bồi bàn tự động khi người chơi ở khu khác (dùng `autoServeCommands`), bưng 2 món một lượt.
3. **Thuê và nâng cấp nhân viên** — `StaffDef` đã tách riêng; cần lệnh thuê và lương theo ngày.
4. **Thức ăn chăn nuôi, chế biến** (xay bột, làm phô mai...) — mở rộng `ProducerDef` với `inputs: ItemStack[]`, hoặc thêm system "xưởng" theo cùng mô hình.
5. ~~Nâng hạng quán, xoay bàn, mua thêm bàn, đồ trang trí tự do~~ — đã có (đợt 13). Tiếp theo: bếp to hơn theo hạng, đồ treo tường, mặt tiền có biển tên.
6. **Thời tiết sâu hơn** — bão làm hỏng cây, nắng hạn cần tưới, món theo mùa; mùa trong năm.
7. **Bán nông sản dư, hợp đồng giao hàng, sự kiện ngẫu nhiên** (khách VIP, thanh tra).
8. **Mở rộng nông trại** — thêm loài cá và bậc ao, cho vật nuôi ăn, hiệu ứng khi tưới/cuốc, công cụ nâng cấp (bình tưới to tưới nhiều ô).
8. **Tiến trình khi offline** — `tick()` nhận số phút bất kỳ nên chỉ cần lưu mốc thời gian thực và tua bù có giới hạn.
9. **Âm thanh** (nghe theo `game.bus`), **model/animation chi tiết hơn** (tay chân cử động, khách cầm đũa...).
10. **Tối ưu draw call** nếu cảnh phình to: gộp mesh tĩnh theo vật liệu (xem `mergeStatic` trong `co-thu-3d/src/scene/helpers.js`).
