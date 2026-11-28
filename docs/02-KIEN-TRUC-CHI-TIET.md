# Kiến trúc chi tiết

`CLAUDE.md` là bản tóm tắt. File này giải thích **vì sao** kiến trúc như vậy và **làm từng bước thế nào** khi mở rộng, kèm các bẫy đã gặp.

## 1. Bốn tầng và lý do tách

```
src/core   EventBus, RNG có seed, Registry                       ~80 dòng, không biết gì về game
src/data   định nghĩa tĩnh (Def) + balance                       thuần dữ liệu, không có logic
src/sim    GameState + Command + System + save                   chạy được trong Node, không DOM, không Three.js
src/ui     app.ts (vòng lặp) + three/ (cảnh 3D) + panels/ (HTML) chỉ đọc state, gửi Command
```

Phụ thuộc: `ui → sim → data → core`.

**Vì sao sim tách khỏi UI:**

- Test chạy trong Node, 25 test xong dưới 1 giây, không cần trình duyệt. AI tự kiểm tra được việc mình làm.
- Đổi cách hiển thị (đã đổi một lần từ 2D emoji sang 3D) không đụng tới một dòng gameplay nào.
- Nếu sau này chuyển sang engine khác (Godot, Unity) hoặc thêm server, phần `data` + `sim` mang đi gần như nguyên vẹn.
- Tất định (cùng seed + cùng lệnh → cùng kết quả) là điều kiện để làm replay, kiểm tra gian lận, hay đồng bộ nhiều người chơi về sau.

**Vì sao nội dung là dữ liệu:** chủ dự án sẽ đưa danh sách món và thời gian dài; việc nhập phải là điền bảng, không phải viết code. `createContent()` kiểm tra tham chiếu chéo lúc khởi động nên điền sai là biết ngay.

## 2. Bản đồ file

```
src/core/events.ts        EventBus<E> có kiểu
src/core/rng.ts           rand, randRange, randInt, weightedIndex - trạng thái RNG nằm trong GameState
src/core/registry.ts      Registry<T>: get(id) ném lỗi nếu thiếu, has(id), all()

src/data/types.ts         MỌI kiểu Def: ItemDef, RecipeDef, ProducerDef, SlotTypeDef, StallDef, TableDef,
                          RoomDef, StaffDef, UpgradeDef, DecorDef, WeatherDef, Balance, ModifierKey
src/data/items.ts         nguyên liệu
src/data/recipes.ts       món ăn
src/data/farm.ts          slotTypes (ruộng/chuồng/ao) + producers (cây, con)
src/data/market.ts        sạp chợ
src/data/restaurant.ts    room (mặt bằng), tables, staff, upgrades (trang thiết bị)
src/data/decor.ts         nội thất (sàn, tường, bàn ghế)
src/data/weather.ts       thời tiết
src/data/balance.ts       hằng số cân bằng (kể cả balance.service: tốc độ bồi bàn, thời gian xem menu, tâm trạng)
src/data/calendar.ts      tên mùa, thứ trong tuần, số ngày mỗi mùa
src/data/index.ts         Content, createContent(), validateContent()

src/sim/state.ts          GameState + createInitialState + SAVE_VERSION
src/sim/types.ts          SimContext, Command, CommandResult, SimEvents, System
src/sim/game.ts           class Game: tick(), dispatch(), defaultSystems, lệnh 'day/next'
src/sim/helpers.ts        kho, tiền, XP, uy tín, modifier()
src/sim/layout.ts         hình học mặt bằng quán: tablePos, seatSpots, footprint, canPlaceTable, serviceSpot (chỗ bồi bàn đứng)
src/sim/calendar.ts       calendarOf(day) -> thứ, ngày trong mùa, mùa, năm
src/sim/save.ts           serialize, deserialize, migrations, reconcile
src/sim/systems/*.ts      clock, weather, customers, kitchen, service, farm, market, progression, decor

src/ui/app.ts             khởi tạo, vòng lặp, HUD, nút chuyển khu, ngăn kéo, xử lý click và pick
src/ui/dom.ts             esc, cmd, ui, bar, morph
src/ui/hud.ts             HUD (cấp, tiền, uy tín, đồng hồ ngày đêm, lịch), bảng Cài đặt, khay quầy ra món
src/ui/audio.ts           âm thanh Web Audio tổng hợp (Sound)
src/ui/juice.ts           flyIcon, bump, floatText, Counter
src/ui/ease.ts            easing + wobble
src/ui/format.ts          coins, clockText, duration, qty
src/ui/panels/*.ts        restaurant, menu, shop, market, farm, inventory
src/ui/three/toon.ts      vật liệu toon, hình học cache, mesh/group, emojiSprite, bubbleSprite, textSprite, Bar3D
src/ui/three/fx.ts        Particles (hạt emoji)
src/ui/three/models.ts    người, cây, hàng rào, rau củ, con vật, cột đèn, thùng hàng
src/ui/three/stage.ts     renderer, camera OrbitControls, ánh sáng, trời, mây, sao, mưa, pick, drag
src/ui/three/areas/*.ts   restaurant, farm, market

test/sim.test.ts          toàn bộ test (chỉ test sim + data)
```

## 3. GameState (phiên bản 13)

```ts
GameState {
  version                       // SAVE_VERSION lúc lưu
  cuisine: 'jp' | 'kr' | 'vn'     // phong cách quán chọn lúc tạo ván: lọc thực đơn + nội thất; không đổi trong ván
  rng: { s }                    // trạng thái RNG
  nextId                        // sinh id cho party/order
  clock: { day, minute, phase } // phase: 'open' | 'closing' | 'summary'
  money, xp, level, reputation  // reputation 0..5
  inventory: Record<itemId, số lượng>      // nguyên liệu vô hạn không nằm ở đây
  menu: { unlocked[], active[] }           // id món
  upgrades: string[]                       // id trang thiết bị đã mua
  decor: { owned[], equipped: { floor, wall, furniture } }
  restaurant: {
    parties: Party[]            // phase 'queue'|'seated'|'browsing'|'readyToOrder'|'waitingFood'|'eating'
                                //   called: bồi bàn đã nhận việc cho nhóm · wait: phút món nằm ở quầy (tâm trạng)
    orders: Order[]             // status 'queued'|'cooking'|'ready'(ở quầy ra món)|'carrying'|'served'
    staff: { id, orderId, energy, fainted }[]   // đầu bếp (energy / fainted: Vitals, dùng chung cả đội)
    spawnTimer
    layout: Record<tableId, {x, y, rot?}>  // bàn gốc đã dời / xoay (rot = xoay 90°); bàn mua thêm luôn có
    extraTables: { id, kind }[]            // bàn lẻ mua thêm (kind = TableKindDef)
    props: { uid, def, x, y, rot, stored }[]   // đồ trang trí đặt tự do; stored = đang cất kho
    tier                                   // hạng quán 1..3 (content.room.tiers) - phòng sâu thêm theo hạng
    dirty: Record<tableId, ghế[]>          // chén dĩa dơ khách để lại; ghế dơ không xếp khách
    stains: { id, x, y, level }[]          // vết bẩn sàn (thêm lúc hết ca), làm khách kém kiên nhẫn
    helpers: HelperState[]                 // nhân viên thuê: như waiter + id, name, look, jobs
    // waiter.carrying: id đơn[] (khay); WaiterTask thêm 'clean' { tableId }, 'mop' { stainId }; 'deliver' có orderIds[]
    waiter: { x, y, tasks: WaiterTask[], carrying, energy, fainted }   // bồi bàn (người chơi); toạ độ mặt bằng
  }
  farm: {
    slots: FarmSlot[]           // FarmSlot: id, type, producerId, stage, progress, cyclesDone,
                                //           lastProducerId, tilled, wet, tier
    farmer: { x, z, tasks: FarmerTask[], work, carry, energy, fainted }   // bác nông dân; toạ độ mét; work = phút còn lại của việc đang làm (null = đang đi/rảnh); carry = lúa đang chở trên máy cày
    mills: { id, type: 'windmill'|'ricemill', product, input, progress }[]   // cối chế biến: input = số lúa chờ xay
  }
  quests: { index, progress, done }   // nhiệm vụ hệ thống: đang làm content.quests[index]; done = đạt mục tiêu, chờ nhận thưởng
  regulars: Record<regularId, { visits, lastDay, gifted }>   // khách quen đã từng ghé
  profile: { name, pet, pets }        // tên quán, thú cưng đang ở quán, các con đã nhận nuôi
  // Party có thêm regular: id khách quen dẫn đầu nhóm (ghế đầu) hoặc null; Order có thêm fav (món ruột)
  market: { priceFactor: Record<itemId, hệ số> }
  weather: { id, minutesLeft }
  crew: { restaurantAway, farmerAway, pending: PendingMeal[], meals: MealLine[], bill: MealLine[] }   // giờ nghỉ ra chợ ('lunch' | 'dinner' | null), bữa đang ăn, hoá đơn chờ trả
  stats: { today, total }       // DayStats: revenue, tips, spent, dishes, guestsServed, guestsLost
}
```

Quy tắc: chỉ JSON thuần. Không `Map`, `Set`, `Date`, class, hàm, `undefined` có nghĩa. Tham chiếu tới nội dung bằng id chuỗi.

## 4. Lệnh (Command) hiện có

```
market/buy          { stallId, itemId, qty }
farm/till           { slotId }             cuốc đất
farm/water          { slotId }             tưới 1 ô
farm/waterAll                              tưới mọi ô đang có cây và đất khô
farm/plant          { slotId, producerId }
farm/harvest        { slotId }
farm/harvestAll
farm/clear          { slotId }             dọn ô (mất cây, không hoàn tiền)
farm/buySlot        { slotType }
farm/upgradeSlot    { slotId }             nới rộng ô (ao cá)
menu/unlock         { recipeId }
menu/setActive      { recipeId, active }
upgrade/buy         { upgradeId }
decor/buy           { decorId }            mua và dùng luôn
decor/equip         { decorId }
layout/moveTable    { tableId, x, y }      tự làm tròn theo lưới 5 đơn vị
layout/reset
day/next                                   chỉ khi đang ở màn tổng kết
service/menu        { partyId }            giao bồi bàn mang menu (khách đang 'seated')
service/takeOrder   { partyId }            giao bồi bàn tới ghi món (khách 'readyToOrder')
service/deliver     { orderId, partyId }   bưng món đang ở quầy tới nhóm; nhóm khác cùng gọi món đó thì hai đơn đổi chủ
farmer/do           { slotId, kind, producerId? }   giao việc cho bác nông dân; kind: till|water|plant|harvest|clear|visit
farmer/doAll        { kind: 'harvest'|'water' }     xếp mọi ô cần làm theo đường ngắn (ô gần nhất kế tiếp)
farmer/cancel                              bỏ các việc chưa tới lượt (việc đang làm dở và việc chở lúa vẫn giữ)
mill/buy            { millType }           mua thêm cối (cối xay gió / nhà xay lúa)
mill/setProduct     { millId, item }       chọn thành phẩm cối làm ra
quest/claim                                nhận thưởng nhiệm vụ đã hoàn thành, mở nhiệm vụ kế
profile/rename      { name }               đặt tên quán (1–24 ký tự)
pet/adopt           { petId }              nhận nuôi (trả tiền lần đầu) và đưa ra quán
pet/set             { petId | null }       đổi con đang ở quán / cho nghỉ
prop/buy            { propId }             mua đồ trang trí, tự bày vào chỗ thoáng nhất
prop/move | prop/rotate | prop/store | prop/place | prop/sell   { uid, (x, y) }   dời / xoay / cất kho / bày lại / bán lại 50%
table/buy           { kind }               mua bàn lẻ, tự đặt chỗ trống; table/sell { tableId } bán lại bàn mua thêm
layout/rotateTable  { tableId }            xoay bàn 90°
restaurant/upgrade                         nâng hạng quán (phòng sâu thêm)
service/deliver     { orderIds, partyId }  bưng cả khay (một hoặc nhiều món) tới bàn
service/clean       { tableId }            dọn chén dĩa dơ
service/mop         { stainId }            lau vết bẩn trên sàn
helper/hire | helper/fire { helperId } | helper/setJob { helperId, job, on }
crew/order { who, stallId, dish } | crew/autoOrder   gọi món cho một người đang ở chợ / để mọi người tự chọn
crew/revive { who } | crew/pay | day/end      bồi dưỡng người xỉu (who: id đầu bếp / 'waiter' / id nhân viên / 'farmer') · trả hoá đơn ăn ở chợ · kết thúc ngày sớm (sau 21:00)
```

UI dùng `farmer/*` cho mọi thao tác trên ô; `farm/till|water|plant|harvest|clear|harvestAll|waterAll` là lệnh "làm ngay", hiện chỉ test, `?do=` và bác nông dân (khi tới nơi) gọi.

Handler trả `{ ok: true }` hoặc `{ ok: false, reason }`. `reason` là câu tiếng Việt hiện thẳng cho người chơi.

**Thêm lệnh - từng bước:**

1. Thêm vào union `Command` trong `src/sim/types.ts`. TypeScript sẽ đòi mọi chỗ khớp kiểu.
2. Viết handler trong `commands` của system liên quan. Kiểm tra điều kiện trước, sửa state sau; không sửa nửa chừng rồi `fail`.
3. Viết test: một trường hợp thành công, mỗi điều kiện từ chối một trường hợp.
4. Gắn vào UI bằng `cmd({ type: '...', ... })` trong panel, hoặc trong `stage.onPick` ở `app.ts`.

## 5. Sự kiện (SimEvents)

```
party/arrived  party/seated  party/left { reason: 'paid'|'queueTimeout'|'serviceTimeout'|'foodTimeout'|'noFood', total, tip }
party/needs { need: 'menu'|'order' }       khách cần bồi bàn (âm thanh chuông)
order/placed   order/ready (ra quầy)   order/served (lên bàn)
waiter/done { kind: 'menu'|'takeOrder'|'pickup'|'deliver' }
farmer/done { kind, slotId, ok, reason? }  bác nông dân làm xong một việc (ok: false = tới nơi mà không làm được)
mill/produced { millId, item, qty }        cối vừa làm xong thành phẩm (đã vào kho)
quest/completed { questId }               nhiệm vụ đạt mục tiêu
quest/claimed { questId, money }          đã nhận thưởng
regular/arrived { regularId, partyId }    khách quen tới quán
regular/visited { regularId, hearts, heartUp, fav, gift }   khách quen trả tiền xong (lên tim / món ruột / quà tặng)
restaurant/upgraded { tier }              quán lên hạng (app.ts dựng lại khu quán)
shift/started { index } · shift/ended { index }   bắt đầu / hết ca mở cửa (hết ca: sàn thêm vết bẩn)
shift/lastCall { index }   tới giờ ngưng nhận khách
crew/fainted { who } · crew/left { group, kind } · crew/back { group } · crew/bill { total }   xỉu / ra chợ / về chỗ làm / ăn xong có hoá đơn
farm/ready     level/up      weather/changed
day/ended      day/started
```

Sự kiện dùng cho hiệu ứng, thông báo, âm thanh. **Không** dùng để truyền dữ liệu cần lưu - thứ gì cần nhớ phải nằm trong state. UI nghe sự kiện không được sửa state.

## 6. Vòng lặp và thời gian

```
mỗi khung hình (app.ts):
  dt = min(0.1, giây thực trôi qua)
  game.tick(dt × tốc độ × balance.minutesPerSecond)   // ra phút game
  stage.render(dt, tốc độ)                             // vẽ 3D
  mỗi 1/8 giây: renderDom()                            // HUD + panel
  mỗi 10 giây: lưu
```

- `Game.tick(minutes)` tự chia thành bước ≤ 1 phút game và gọi `update(ctx, dt)` của từng system theo thứ tự trong `defaultSystems`: clock → weather → customers → kitchen → service → farm → market → progression → decor.
- Khi `clock.phase === 'summary'` thì `tick()` không làm gì. **Bẫy khi viết test:** tua quá cuối ngày là sim đứng; phải `dispatch({ type: 'day/next' })` để chạy tiếp (xem test ao cá làm mẫu).
- Sang ngày mới: `Game.nextDay()` gọi `onDayStart` của mọi system (chợ đổi giá, nông trại cộng `nightMinutes`).

## 7. Modifier - cách mọi "buff" hoạt động

`modifier(ctx, key)` trong `helpers.ts` trả về tích của mọi hệ số đang có hiệu lực cho `key`, lấy từ ba nguồn:

1. Thời tiết hiện tại: `WeatherDef.effects`
2. Trang thiết bị đã mua: `UpgradeDef.modifiers`
3. Nội thất đang dùng: `DecorDef.modifiers`

Các key hiện có: `cookSpeed`, `patience`, `tip`, `spawnRate`, `growSpeed`, `dishPrice`.

**Thêm chỉ số mới:** thêm key vào `ModifierKey` (`data/types.ts`), thêm tên hiển thị vào `MODIFIER_NAMES` (`ui/panels/shop.ts`), gọi `modifier(ctx, 'key')` ở nơi tính toán. **Thêm nguồn buff mới** (vd nhân viên, sự kiện): thêm một dòng vào `modifier()`.

## 8. Save và migration - quy trình bắt buộc

Người chơi đang có save thật trong trình duyệt. Mỗi lần đổi hình dạng `GameState`:

1. Sửa interface trong `state.ts` và giá trị khởi tạo trong `createInitialState()`.
2. Tăng `SAVE_VERSION`.
3. Thêm `migrations[phiên bản cũ]` trong `save.ts`: nhận state cũ, trả state mới có `version` tăng 1. Migration chạy nối tiếp nhau nên save v1 vẫn lên được bản mới nhất.
4. Nếu cần "sửa cho hợp lệ" (id bị xoá, số ô khởi đầu tăng...), thêm vào `reconcile()` - hàm này chạy sau migration ở mọi lần tải.
5. Thêm test: lấy state mới, xoá trường mới, hạ `version`, `deserialize` lại, kiểm tra kết quả và chạy thử `tick`.

v7 (phong cách quán) được chủ dự án chốt là **chơi lại từ đầu**: migration v1→v6 đã xoá, save cũ bị bỏ qua. Muốn xem mẫu migration cũ: lịch sử git trước nhánh `giai-doan-2`. Từ v7 trở đi viết migration bình thường: v7→v8 thêm cối + `farmer.carry` (`reconcile()` tạo đủ cối khởi đầu), v8→v9 thêm `quests`, v9→v10 thêm `regulars`, `profile`, `restaurant.extraTables/props/tier`, `party.regular`; v10→v11 đổi `waiter.carrying` thành mảng, `deliver.orderIds`, thêm `restaurant.dirty/stains` (reconcile dời bàn / đồ nằm ngoài phòng khi quán nhỏ lại); v11→v12 thêm `restaurant.helpers`; v12→v13 thêm `crew`, năng lượng cho đầu bếp / bồi bàn / bác nông dân (đầy 30), bỏ `helper.away`.

`deserialize` trả `null` (tạo game mới) nếu save hỏng hoặc thiếu migration. Khoá lưu: `quan-nha-vuon/save`.

## 9. UI: ba mảnh

**`app.ts`** - nơi duy nhất biết cả sim, 3D và panel. Giữ `UiState` (khu đang xem, panel đang mở, tốc độ, ô đang chọn, sạp đang chọn, chế độ sắp xếp). `UiState` không được lưu.

**Panel** - hàm thuần `(game, ui) → chuỗi HTML`, gọi lại 8 lần/giây. `morph()` vá DOM tại chỗ nên nút đang bấm không bị thay giữa chừng. Quy tắc:

- Phần tử trong danh sách có `data-key` ổn định.
- Nút gửi lệnh: `cmd({...})`. Nút thuần giao diện: `ui('tên:tham số')`, xử lý trong `app.ts`.
- Chuỗi từ dữ liệu qua `esc()`.
- Không tự tính luật - gọi hàm export từ system (`priceOf`, `slotPrice`, `cycleTime`, `yieldsOf`, `needsWatering`, `nextTier`, `craftableCount`, `activeTables`, `canPlaceTable`...).

**Cảnh 3D** - xem `03-DO-HOA-3D.md`.

## 10. Test

Toàn bộ trong `test/sim.test.ts`, chạy bằng Vitest trong Node. Mẫu:

```ts
const game = new Game(content, { seed: 42 });
game.state.weather = { id: 'cloudy', minutesLeft: 99999 }; // cố định thời tiết cho test nông trại
game.state.menu.active = [];                                // tắt bán hàng nếu không muốn kho bị trừ
expect(game.dispatch({ type: '...' }).ok).toBe(true);
game.tick(100);
```

Được phép gán thẳng vào `game.state` trong test để dựng tình huống. Test tất định: cùng seed cho cùng chuỗi JSON.

**Quán cần người phục vụ.** Từ save v5, không ai bấm thì khách ngồi chờ menu rồi bỏ về. Test chạy cả ngày phải "phục vụ hộ": `serve(game)` trong test gọi `autoServeCommands(ctx)` (trong `service.ts`) rồi `dispatch` từng lệnh trước mỗi `tick`. Helper `seatParty()` / `quietGame()` dựng nhanh một nhóm khách đã ngồi, không có khách tự tới.

UI chưa có test tự động. Kiểm tra bằng URL `?fresh&...` và ảnh chụp.

## 11. Các bẫy đã gặp trong phiên đầu

- **Tab ẩn thì game đứng.** `requestAnimationFrame` không chạy khi tab/pane bị ẩn. Không phải lỗi. Dùng `?ff=`.
- **CSS trống sau khi sửa file bằng script.** Dev server từng giữ một bản `style.css` rỗng do đọc đúng lúc file đang ghi dở. Dấu hiệu: giao diện mất hết định dạng, `document.querySelector('style').sheet.cssRules.length === 0`. Cách chữa: lưu lại file CSS (hoặc `touch`).
- **Lỗi console cũ.** Console của preview giữ lỗi từ lúc đang sửa dở. Kiểm tra dấu thời gian trước khi tin.
- **Test tua quá cuối ngày** → sim đứng ở màn tổng kết (mục 6).
- **Thứ tự đăng ký sự kiện con trỏ.** Trong `Stage`, listener của mình phải đăng ký **trước** khi tạo `OrbitControls`, để kịp tắt camera khi bắt đầu kéo vật.
- **Vật liệu dùng chung.** `toon(màu)` trả vật liệu cache dùng chung toàn game. Sửa `.color` của nó là đổi màu mọi thứ cùng màu. Cần đổi màu động thì `toon(màu, {})` để tạo vật liệu riêng (xem `mats` trong `areas/restaurant.ts`, `soil` trong `areas/farm.ts`).
- **Máy này không có Python**, có Node. Script hỗ trợ viết bằng `.mjs`.
- **Heredoc trong Git Bash** hỏng với nội dung nhiều dấu nháy. Ghi file bằng công cụ ghi file, không bằng `cat <<EOF`; sửa nhiều chỗ thì viết script `.mjs` ra thư mục tạm rồi chạy bằng `node`.
- **Xuống dòng CRLF.** Phần lớn file nguồn dùng CRLF. Script sửa file nên đổi về LF, thay chuỗi, rồi ghi lại CRLF.
- **Preview bị bóp khung hình.** Khi pane trình duyệt bị ẩn/không hiển thị, `requestAnimationFrame` gần như đứng (vài khung/giây) và ảnh chụp màn hình bị cũ. Cách làm: `game.tick(phút)` + `stage.render(1/30, 1)` bằng tay qua `window.stage` (bản dev), lấy ảnh bằng `canvas.toDataURL()` ngay sau `render`.
- **Raycaster không bỏ qua vật đang ẩn.** `pickAt()` trong `stage.ts` đã tự lọc; thêm cách bấm mới thì giữ nguyên chỗ lọc đó.
- **Depth texture kiểu Float + MSAA** (three r187) làm mất sprite trong suốt khi vẽ vào render target. Nếu làm hậu kỳ lại thì dùng depth `UnsignedIntType`.
- **Vitest quét cả `.claude/skills`** (có file test mẫu cần Playwright) → đã giới hạn `test.include` trong `vite.config.ts`.

## 12. Giới hạn kiến trúc đã biết

Chưa cần sửa, nhưng nên biết trước khi dự án lớn hơn.

- `customers.ts` tìm đơn bằng `orders.find` trong vòng lặp: ổn với vài chục khách, cần chỉ mục nếu lên hàng trăm.
- Kích thước phòng nằm trong `content.room` (tĩnh). Nới phòng theo nâng cấp cần đưa vào state và dựng lại tường trong `RestaurantArea`.
- Mỗi khu 3D dựng hình một lần lúc khởi động; thứ nào đổi được (bàn, ô nông trại) có `Map` view riêng đồng bộ theo state. Thêm thứ đổi được mới thì theo đúng mẫu đó.
- Bồi bàn đi đường thẳng, xuyên qua bàn ghế (chưa tìm đường). Chấp nhận được với phong cách hoạt hình; muốn đẹp hơn thì thêm vài điểm hành lang trong `layout.ts`.
- Khi người chơi ở khu khác, quán không ai phục vụ (khách bỏ về). `autoServeCommands` sẵn sàng làm "bồi bàn tự động" nếu chủ dự án muốn.
- `app.ts` vẽ lại toàn bộ HTML của panel 8 lần/giây. Đủ nhanh hiện tại; panel dài hàng trăm dòng thì cần chia nhỏ hoặc giảm tần suất.
- Chưa có i18n: chữ tiếng Việt nằm thẳng trong data và panel.
