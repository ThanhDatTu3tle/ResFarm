# Nhật ký làm việc

Mỗi phiên ghi một mục (mới nhất ở trên): đã làm gì, quyết định gì, còn dở gì, bắt đầu phiên sau từ đâu. Không ghi thông tin cá nhân (repo công khai).

---

## 19/11/2026 (laptop) — Đợt 15: nhân viên phục vụ thuê thêm

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-3`. **Kết quả:** typecheck sạch, 63 test qua (5 test mới); đã xem trên localhost bảng Quán có 2 nhân viên (đang làm, xỉu, đang ăn), nhân viên trong quán, nhân viên ngồi ăn ở xe hủ tiếu. **Chưa thử bằng tay:** các nút trong bảng nhân viên, chọn món rồi bấm bàn.

1. waiterSpeed 700 → 430; hud.ts: bấm món ở quầy = `serve:id` (cầm món, bấm bàn để giao), khay vẫn kéo thả.
2. Save v12: `restaurant.helpers` (`HelperState` kế thừa `WaiterState`). service.ts tách `stepWorker` cho mọi người phục vụ (`workers()`, `taskTaken()`, `isReserved` xét cả nhân viên), `spendEnergy` / `faint`. `systems/helpers.ts`: lệnh thuê / cho nghỉ / giao việc / bồi dưỡng / đi ăn, `pickTask`, hồi qua đêm. `balance.helpers`, `StallDef.staffMeal`; hạng quán 5 bậc.
3. Hình: `RestaurantArea.updateHelpers` (áo màu, mũ vàng, thanh ⚡, xỉu nằm ra 😵), `MarketArea.updateEaters`; bảng Quán `helpersHtml`; thông báo xỉu / ăn xong.

---

## 19/11/2026 (laptop) — Đợt 14: chỉnh theo phản hồi (nông trại, quán, chợ, giao diện điện thoại)

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-3`. **Kết quả:** typecheck sạch, 58 test qua (6 test mới); đã xem trên localhost: quán nhỏ có tường đủ, khay quầy ra món, chén dĩa dơ + vết bẩn, nông trại có vườn cây + đường đá, chợ có 4 hàng mới, zoom sạp, bố cục màn ngang thấp. **Chưa thử bằng tay:** kéo thả món vào khay, bấm giữ lau vết bẩn, bấm bàn dơ, bảng nhiệm vụ; vùng an toàn tai thỏ chỉ thấy được trên iPhone thật.

1. **Giờ game** (balance): `minutesPerSecond` 1.5, 06:00–24:00, `shifts` 2 ca; mốc phục vụ nhân ~2.1, `COOK_SCALE` trong recipes.ts; clock.ts phát `shift/started|ended`; customers chỉ đón khách trong ca, nhóm khách không lớn hơn bàn lớn nhất.
2. **Phục vụ** (save v11): khay `service/deliver { orderIds }`, `waiter.carrying[]`; `service/clean` + `restaurant.dirty`; `service/mop` + `restaurant.stains` (`addStains` lúc hết ca, `modifier('patience')` giảm theo độ bẩn); bồi bàn rảnh đứng yên. UI: `trayParty`/`trayFor`/`questHtml` trong hud.ts, kéo thả bằng pointer trong app.ts; `stage.onPick(pick, held)` + `HOLD_MS` cho bấm giữ.
3. **Quán nhỏ lại:** room 540×480, bàn `counter` 3 ghế, `medium`, `pair`, `pair2`; bỏ bàn 6 + nâng cấp `patio`; reconcile (`fixLayout`) đưa bàn cũ nằm ngoài phòng về chỗ. Bỏ bàn thờ (cuisine.ts). Tường bên chạy suốt.
4. **Nông trại:** suối kết thúc ở ao; loại ô `orchard` (layout.spots, initialPlants), 4 producer cây ăn quả, 4 trái cây, 4 món; đá / cát trên đường đất.
5. **Chợ:** `StallDef.kind/spot`; tiệm `snack`, hàng rong `hutieu`, `banhtrang`, `cafe`; `stallCenter` + `focusOn(x, z, closer, y)`.
6. **CSS:** biến `--pad-*` theo safe-area, `--badge-w/h` chừa logo Netlify; style khay, bảng nhiệm vụ, kho cuối ngày.

---

## 19/11/2026 (laptop) — Đợt 13: Khách quen (F2) + Giai đoạn 3 "Quán của riêng mình"

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-3` (tách từ `main` sau PR #2). **Kết quả:** typecheck sạch, 52 test qua (7 test mới); đã xem trên localhost: khách quen có bảng tên + vòng hồng + thông báo chân dung, bảng Khách quen, đồ trang trí 3 quán, quán hạng 3, lên hạng giữa ván, chế độ chụp ảnh. **Chưa thử bằng tay:** kéo thả đồ trang trí, nút xoay / cất / bán, đổi tên (hộp prompt), bấm Chụp ảnh tải file.

1. **Save v10** (migration 9→10): `regulars`, `profile`, `restaurant.extraTables/props/tier`, `party.regular`, `order.fav`.
2. **Khách quen:** `RegularDef` + `src/data/regulars.ts`, `systems/regulars.ts` (không phải system: customers.ts gọi `pickRegular` lúc tạo khách, ưu tiên món ruột lúc gọi món, `regularTipBonus` + `regularPaid` lúc trả tiền). Hình: `ui/three/people.ts` (`makeRegular`: dáng trẻ em / người lớn / người già khom, 7 kiểu tóc, 14 phụ kiện); `ui/three/portraits.ts` render chân dung từ model; bảng `panels/regulars.ts`.
3. **Mặt bằng:** `sim/layout.ts` giờ chứa `activeTables` (bàn gốc + bàn mua thêm, có xoay), `roomOf` (phòng theo hạng), `propRect`, `blockerOf`, `findFreeSpot` (chọn chỗ thoáng nhất), `entranceOf` (lối ra vào). Mọi chỗ trước đây gọi `content.tables.get` đổi sang `tableById`.
4. **Quán của riêng mình:** `systems/home.ts` (đổi tên, thú cưng, đồ trang trí, bàn mua thêm, xoay bàn, nâng hạng); `modifier()` cộng thêm hạng quán, thú cưng, đồ trang trí (mỗi loại 1 lần). Data: `src/data/props.ts` (props, pets, tableKinds), `room.tiers`. Hình: `ui/three/props.ts`, `makePet`; khu quán dựng lại khi lên hạng (`stage.replaceArea`). Chế độ sắp xếp: bấm / kéo bàn hoặc đồ → thanh trên hiện ⟳ Xoay, 📦 Cất kho, 💰 Bán.

**Phiên sau:** chủ dự án thử tay các thao tác kéo / xoay / chụp; xem G9 trong roadmap.

---

## 18/11/2026 (laptop) — Đợt 12: nhiệm vụ hệ thống (+ sửa chợ)

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-2`. **Kết quả:** typecheck sạch, 45 test qua, build qua; đã xem thẻ nhiệm vụ đang làm / chờ nhận thưởng trên HUD.

1. **Sửa chợ:** bảng chân đứng sạp hải sản thành "Chuyên các loại ốc", chữ to, 2 dòng; vạch qua đường xoay đúng (vạch dài theo chiều xe chạy, xếp nối từ mép này sang mép kia).
2. **Nhiệm vụ hệ thống** (save v9): `QuestDef` + `src/data/quests.ts` (7 nhiệm vụ), `systems/quests.ts` — mục tiêu dạng đếm qua `bumpQuest()` (gọi ở customers.ts lúc khách trả tiền, farm.ts lúc thu hoạch, mills.ts lúc ra thành phẩm), dạng trạng thái đọc state (món đã mở, doanh thu hôm nay, uy tín); lệnh `quest/claim`; sự kiện `quest/completed`, `quest/claimed`. HUD: `questCard` trong hud.ts. 3 test mới.

---

## 18/11/2026 (laptop) — Đợt 11: chợ có đường, xe cộ, bảng tên sạp

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-2`. **Kết quả:** typecheck sạch, 42 test qua, build qua; đã xem trong trình duyệt.

1. **Khu chợ:** vỉa hè 8.8 m (gấp đôi) lát gạch, bó vỉa; đường nhựa 2 làn có vạch giữa và vạch qua đường; 8 xe (`farmkit.makeCar / makeTruck / makeScooter`) chạy vòng hai chiều, bánh xe quay, đèn xe sáng khi tối (`setVehicleLights`); 7 người đi bộ; đèn đường + cây trong bồn; camera lùi ra sau đường.
2. **Bảng tên sạp** = `StallDef.name` (đổi tên theo chủ dự án), dựng bằng `signText` (export từ `cuisine.ts`); `StallDef.standee` = bảng chân đứng (sạp hải sản).

---

## 18/11/2026 (laptop) — Đợt 10: nhà màng + khu bên trong

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-2`. **Kết quả:** typecheck sạch, 42 test qua, build qua; đã xem nhà màng ở nông trại và khu bên trong (8 luống có cây đang lớn).

1. **Sim:** loại ô `gplot` (luống nhà kính) với `SlotTypeDef.building` (vị trí nhà trên bản đồ, cửa), `batch: 4` (mua theo lô — `farm/buySlot` thêm 4 luống, nhà dài thêm), `growMul: 1.3`; `ProducerDef.alsoIn` + `fitsSlot()` cho rau củ trồng được cả trong nhà kính; `buildingRect()` tính hình nhà theo số luống; `workSpot` của luống = cửa nhà. Không đổi cấu trúc state (reconcile tự bù 8 luống khởi đầu cho save cũ). Test mới: lô 4 luống, tối đa 20, không cần cuốc, lớn nhanh hơn ruộng, bác vào cửa.
2. **Nông trại:** `farmkit.makeGreenhouse` (khung vòm thép trắng, màng trong mờ, cửa, quạt), dựng lại khi nhà dài thêm; viền đứt khúc phần nhà nới thêm ở đầu đông; bấm nhà → `Pick { type: 'building' }` → vào khu nhà kính.
3. **Khu nhà kính** `areas/greenhouse.ts`: lối đi bê tông, 2 dãy luống viền trắng, ống tưới nhỏ giọt + dây treo, bàn dụng cụ, quạt quay; cây theo giai đoạn, thanh tiến độ, hiệu ứng gieo / chín / thu (bay về Kho); góc nhìn tự giãn theo chiều dài nhà.

---

## 18/11/2026 (laptop) — Đợt 9: chỉnh nông trại lần 2

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-2`. **Kết quả:** typecheck sạch, 41 test qua, build qua; đã xem trong trình duyệt.

1. **Vệt gió:** `THREE.Line` mảnh 1 px, dài ~1.2 m, sóng chạy dọc sợi (uốn lượn), mờ (opacity ≤ 0.45), tối đa 6 sợi, sinh thưa (`Stage.updateStreaks`).
2. **Cối xay gió** phía bắc sau hàng rào (`MillTypeDef.layout` z = -7.6, bác đổ lúa ở mặt trước); lối mòn phía bắc z = -5.65. **Nhà xay lúa** sát bờ sông phía nam (x = -9.4, z = 25.4), model lật gương để bánh xe nước nhúng xuống sông.
3. **Ao:** chỉ 1 ao (`max: 1`), 4 bậc nới rộng (+30% mỗi bậc); hình méo tự nhiên (`farmkit.pondOutline` + `outlineSlab`); viền đứt khúc theo hình ao bậc kế tiếp (`dashedOutline`), bấm vào → chọn ao, bảng hiện nút "Nới rộng". Ao nằm trên suối ở x = 9.5, z = 15.
4. **Khu ruộng lúa:** cột sát sông là lúa nước (tối đa 2, có mương dẫn nước từ sông), cột bên cạnh là lúa mì (tối đa 2).
5. **Lối đi:** `balance.farmer.lanes = [1.25]` (bỏ lối trái). Sửa `nextWaypoint` khi hai lối hoà điểm thì chọn lối gần chỗ đứng.

---

## 18/11/2026 (laptop) — Đợt 8: chỉnh theo phản hồi, ruộng lúa tự động + cối chế biến

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-2`. **Kết quả:** typecheck sạch, 41 test qua, build qua; đã xem trong trình duyệt: quán nhỏ + lối WC/kho (cả 3 quán), nông trại bố cục mới, máy cày chở lúa qua cầu tới cối, bảng lọc theo chuồng, sáng sớm / trưa / tối có đèn.

### Đã làm

1. **Quán:** `room` 640×540 (cũ 720×600), bàn dời lại cho vừa; bếp 3.4 m dồn phải (`kitchenX1`, `kitchenCenter()`), bên trái là lối đi có vách ngăn, cửa **WC** và cửa **KHO** (`buildCorridor`). Đồ trang trí 3 quán bám theo vị trí bếp mới.
2. **Nông trại — bố cục:** chuồng 4.2 m (cũ 3.3) có rơm rải, kiện rơm, đống rơm; ao 6 m (gấp đôi), 3 ao xếp dọc con suối về phía hạ lưu (bên phải), bác đứng bờ sau ao (`layout.work = 'back'`); suối chảy qua lần lượt các ao rồi ra khỏi bản đồ; thêm cầu ở lối dọc x = -8.3; hàng ruộng rau giãn 2.75 m (cũ 2.6 — chỗ đứng lấn 5 cm vào ô dưới, test mới bắt được).
3. **Viền đứt khúc + ➕** ở mọi chỗ còn mua thêm ô / cối (`FarmArea.updateExpand`, `farmkit.dashedRect/dashedCircle`); bấm vào → camera lướt tới + mở bảng có nút mua (`Pick { type: 'expand' }`).
4. **Bấm ô / cối:** `Stage.focusOn(x, z, closer)` lướt camera lại gần (55–62%); `ui.farmFocus` lọc bảng Nông trại chỉ còn loại đó (ruộng lúa đi kèm cối của nó), có nút "Xem cả nông trại"; đóng bảng thì `Stage.unfocus()`.
5. **Ruộng lúa mì / lúa nước + cối** (save v8): `SlotTypeDef.mill`, `MillTypeDef` (`data/farm.ts`), `systems/mills.ts` (chế biến, `mill/buy`, `mill/setProduct`), việc `haul` + `farmer.carry` trong `farmer.ts` (`autoChain`: thu → gieo lại → chở tới cối ít hàng nhất; huỷ bớt vẫn giữ việc chở). 3D: `farmkit.ts` (cối xay gió, nhà xay lúa có bánh xe nước, máy cày, bao lúa, khóm lúa 3 giai đoạn đung đưa theo gió). Nguyên liệu mới: lúa mì, lúa (thóc), bánh mì; 3 món mới dùng bánh mì (đủ model).
6. **Trời:** `env.noon` (nắng gắt buổi trưa, dịu sáng/chiều, ánh vàng hơn lúc sớm/chiều); gió = thời tiết + gió nhẹ theo giờ (chiều lộng) + cơn gió ngẫu nhiên tất định theo ngày/giờ; vệt gió trắng bay ngang ở khu ngoài trời (`Area.outdoor`). Nông trại có 10 cột đèn + 3 nguồn sáng thật bật khi tối.
7. **Test mới:** chuỗi lúa mì → bột mì, cối (đổi thành phẩm, mua tối đa, không giao tay việc chở), huỷ bớt giữ việc chở, và **mua tối đa mọi ô + cối: không ô nào chồng nhau và đường đi của bác không xuyên qua ô / cối nào**.
8. Dev: `?focus=pen` (mở bảng Nông trại lọc sẵn).

### Còn dở

- Vệt gió có trong cảnh nhưng khó thấy ở góc nhìn xa (trắng trên cỏ nhạt) — cần chủ dự án xem khi chơi thật.
- Chưa bấm tay luồng zoom / bảng lọc / mua chỗ đứt khúc (AI không bấm trong trình duyệt). Chưa commit.

---

## 18/11/2026 (laptop) — Giai đoạn 2 phần đầu: sông + suối, màn mở đầu, 3 phong cách quán

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-2` (tách từ `nong-dan` sau khi commit bác nông dân). **Kết quả:** typecheck sạch, 37 test qua, build qua; đã xem trong trình duyệt màn mở đầu, bước chọn quán (cả cỡ điện thoại ngang), nội thất 3 quán, 42 món, nông trại có sông.

### Đã làm

1. **G1 — sông + suối:** `FarmArea.buildWater()`: sông chạy dọc mép trái, suối uốn trước hàng ruộng cuối (ruộng tối đa 5 hàng), chui dưới cầu gỗ trên đường đất rồi đổ vào tâm ao đầu tiên. Dải nước dựng bằng `ribbon()` theo `CatmullRomCurve3`, vệt sóng trắng trôi theo dòng (nhanh hơn khi mưa). Camera nông trại hạ xuống 1 m cho thấy suối.
2. **G2 — màn mở đầu:** `src/ui/title.ts` (renderer riêng, huỷ khi vào game): logo, Chơi tiếp (khi có save hợp lệ), Ván mới → 3 mặt tiền quán trên một con phố + 3 thẻ giới thiệu; bấm thẻ hoặc bấm vào quán để chọn; có save thì hỏi lại trước khi xoá. Cờ vẽ bằng SVG (Windows không có emoji cờ). `main.ts` quyết định hiện màn mở đầu hay vào thẳng game (`?fresh` / `?play`).
3. **Sim:** `GameState.cuisine`, `CuisineDef` (`src/data/cuisines.ts`, kèm `startInventory` riêng từng quán — bỏ `balance.startInventory`), `RecipeDef.cuisine`, `DecorDef.cuisine`; `recipesFor` / `decorFor` / `defaultDecor`; mở món / mua nội thất của quán khác bị từ chối. **Save v7, không migration** (chủ dự án chốt chơi lại từ đầu); xoá migration v1→v6.
4. **G3 — nội thất:** `src/ui/three/cuisine.ts`: Nhật (tatami, vách shoji, noren, đèn lồng giấy, mèo thần tài vẫy tay, thẻ gỗ ghi món, bonsai, tủ kính sushi trên quầy), Hàn (sàn xi măng, biển neon, bàn nướng + ống hút khói theo bàn, ghế đẩu inox, poster, két soju), Việt (đèn lồng Hội An, quạt trần quay, chữ Phúc, bàn thờ ông Địa, ghế nhựa đỏ, ống đũa + tương ớt). Mặt tiền 3 quán (`makeShopfront`) cho màn mở đầu.
5. **G4 — thực đơn:** 16 món Việt (thêm cơm tấm, hủ tiếu, bún bò, cơm gia đình), 13 Nhật, 13 Hàn; 12 nguyên liệu mới (nước tương, miso, tương ớt Hàn vô hạn; dưa leo, nấm, cá hồi, bún, mì sợi, bánh gạo, đậu phụ, rong biển, bột mì); sạp mới "Tiệm đồ khô chị Sáu"; dưa leo và cá hồi nuôi được. Đủ model 3D cho cả 42 món.
6. **Sửa lỗi có sẵn (Giai đoạn 1):** bồi bàn ghi món cho bàn hết nguyên liệu → khách bỏ về, `leave()` lọc lại hàng việc rồi `shift()` xoá nhầm việc kế tiếp của bàn khác → bàn đó chờ mãi, ngày không kết thúc. Giờ xoá đúng việc vừa làm (`service.ts`). Có test hồi quy.
7. **Cài đặt:** nút "Chơi lại từ đầu" thay bằng "🏠 Màn hình chính" (lưu rồi về màn mở đầu).

### Còn dở

- Chưa bấm thử luồng Chơi tiếp / Ván mới / xác nhận xoá bằng tay (quy tắc: AI không bấm nút trong trình duyệt) — chủ dự án thử giúp. `?pick=jp|kr|vn` (bản dev) mở thẳng bước chọn quán để xem.
- Chưa commit. Tiếp theo theo thứ tự đã chốt: **F2 Khách quen** (phương án ngoại hình + cách nhận ra ở `04-ROADMAP.md`).

---

## 18/11/2026 (laptop) — Bác nông dân chạy theo tương tác

**Model:** Claude Opus 5.5 (Claude Code, desktop). **Nhánh:** `nong-dan` (tách từ `main` sau khi gộp Giai đoạn 1). **Kết quả:** typecheck sạch, 33 test qua, build qua; đã xem trong trình duyệt (bác ra ruộng theo lối, cuốc + gieo, ra bờ ao thả cá, sang chuồng thả gà).

### Đã làm

1. **Sim:** `src/sim/systems/farmer.ts` — hàng việc của bác (`farmer/do`, `farmer/doAll`, `farmer/cancel`), chạy theo toạ độ mét, tới nơi làm `workTime` rồi gọi handler `farm/*`. `preview()` chạy thử hàng việc trên `structuredClone` của state để báo lỗi ngay lúc bấm. `nextWaypoint` cho đi theo lối (ngang theo khe, dọc trên `balance.farmer.lanes`). Việc 'visit' (chỉ chạy tới xem) tới nơi là xong và bị thay bằng việc thật nếu người chơi giao việc cho ô đó. **Save v6** + migration + test.
2. **Data:** vị trí ô nông trại chuyển từ `SLOT_LAYOUT` trong UI vào `SlotTypeDef.layout` (sim cần biết để tính chỗ đứng); `balance.farmer` (home, lanes, speed, workTime).
3. **3D:** `FarmArea.updateFarmer()` vẽ bác theo state: chạy (vung tay chân), tới nơi quay mặt vào ô và làm động tác theo việc — tư thế mới trong `animatePerson`: `dig` (bổ cuốc), `pour` (tưới), `reach` (cúi gieo / thu / thả giống); biểu tượng việc trên đầu (⛏️ 💧 🌱 🧺 🧹 👀).
4. **UI:** bấm ô trong cảnh 3D và mọi nút trong bảng Nông trại đi qua `farmer/*`; ô đã có việc hiện 🧑‍🌾 "Bác đang tới"; dòng trạng thái "Bác còn N việc" + nút "Huỷ bớt"; việc hỏng lúc tới nơi hiện thông báo.

### Còn dở

- Chưa thử trên điện thoại thật. Chưa commit / chưa gộp vào `main` (chờ chủ dự án).
- Hiệu ứng hạt (bụi, nước) vẫn phát ở ô lúc việc có tác dụng — khớp thời điểm bác làm xong, nhưng chưa gắn vào tay bác (N2).

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
