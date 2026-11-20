# Nhật ký làm việc

Mỗi phiên ghi một mục (mới nhất ở trên): đã làm gì, quyết định gì, còn dở gì, bắt đầu phiên sau từ đâu. Không ghi thông tin cá nhân (repo công khai).

---

## 21/11/2026 (laptop) — Giai đoạn 14: sửa lỗi sau khi chơi thử

**Nhánh:** `giai-doan-14`. Chủ dự án và người thân chơi thử 3 ngày đầu, gửi 22 mục — làm hết (xem `04-ROADMAP.md`).
AI tự chọn: thông báo nổi đặt góc phải dưới đồng hồ; nhóm khách đông tính theo loại bàn vừa nhóm; shipper nhận thưởng khi giao xong; quà khách quen để trong kho; quán rộng thêm 80 đơn vị và dời mọi toạ độ x 40 (migration v21); nhịp lên cấp ×(1 + 0.5 × (cấp − 3)) từ cấp 4, lên sao còn 35% / 15% từ 3 / 4 sao; nhà kính vốn đã trồng được trái mùa (không cần sửa).

---

## 20/11/2026 (laptop) — Giai đoạn 13: cân bằng nông trại + kinh tế, chủ quán tuỳ biến, HUD gọn

**Nhánh:** `giai-doan-13` (từ main sau khi merge giai đoạn 12).

1. Ao theo yêu cầu (người thử chơi thấy ao lâu, ít): nhanh hơn ~40%, 15 con một lứa. AI tự chọn phần còn lại: rau lâu lớn cho nhiều hơn (mỗi ô ~10–12 xu / ngày theo giá gốc), lúa mì 14 / lúa nước 15, heo 8, bò thịt 10; cây ăn quả, gà, bò sữa giữ nguyên.
2. Năng lượng theo yêu cầu: đầu bếp 30, còn lại 50 (`balance.crew.chefMaxEnergy` / `maxEnergy`, `maxEnergyOf` trong crew.ts); dọn bàn không tốn; bồi dưỡng 50 xu.
3. Chủ quán theo yêu cầu: tên + kiểu tóc + quần áo (`OwnerProfile.name / hair / outfit`, `OWNER_HAIRS`, `OWNER_OUTFITS`, `ownerName`, save v19); 4 kiểu tóc mới trong `addHair`; tên lơ lửng trên đầu (`OwnerWalker`). Dev: `?owner=f28-braid-aodai-Cô Ba`.
4. HUD theo yêu cầu: bỏ thông báo nâu "món nấu xong…"; bỏ thông báo đỏ sắp hết nguyên liệu, gộp vào dải `stock-warn` (Hết: … · Sắp hết: …) ở hàng riêng dưới cấp / tiền / sao (`.hud-top`); thẻ nhiệm vụ không bị đẩy nữa.
5. Mô phỏng mùa Xuân (script tạm, bản lưu ở `notes/`): 4 quán, seed 7 + 11, nông trại tự trồng / thu / bán dư, đơn hàng tự giao. Trước khi chỉnh giá: Nhật ~11.600, Hàn ~7.800, Việt ~5.900, Ốc ~11.500 xu cuối mùa. AI chọn: nâng giá 8 món Việt + 3 món Hàn cấp thấp (lãi 5–10 xu) → cả 4 quán ~8.900–11.600 xu.

---

## 22/11/2026 (laptop) — Giai đoạn 12: Sổ tay tự sinh

**Nhánh:** `giai-doan-12` (đã push 9d0b279; phần 8 chưa commit). Giai đoạn 11 đã merge vào `main`.

11. Khách tới đông và đều hơn theo yêu cầu (trước đó 15–17 h có lúc không ai vì lượt chờ cũ quá dài): `spawnInterval` 72 → 52, thêm giờ đông chiều 15–17 h ×1.2, `spawnMaxGap` 40 phút, mở ca có khách sau 6 phút (`firstGuest`); test ngày vắng nhất giờ nào cũng có khách.
10. Đổi tên quán không được: `window.prompt` bị chặn trên một số môi trường (bấm không thấy gì) → thay bằng hộp đổi tên trong game (`renameHtml` trong hud.ts, `ui.rename`; Enter để đổi, Esc huỷ; lỗi thì giữ hộp mở).
9. Ông / bà chủ quán theo yêu cầu: màn mở đầu thêm bước chọn chủ quán sau khi chọn quán (giới tính + thanh tuổi 25–50, xem trước 3D trước mặt tiền quán); `GameState.owner` (save v18); `makeOwner` (people.ts) — AI chọn: ông áo gi-lê sẫm, bà áo kiểu + váy, huy hiệu vàng trên ngực; 25 tóc tạo kiểu, 35 chững chạc, ≥ 40 tóc muối tiêu dần, ≥ 44 kính lão, ông ≥ 40 để ria, người đậm dần theo tuổi. `OwnerWalker` (owner.ts) đi dạo ở quán (né bàn), chợ (ghé ngó sạp, ngôi sao trên đầu), nông trại (theo lối của bác, ngôi sao), trong sạp (bước vào, đứng chọn hàng). Cuốn lịch 📅 trên đồng hồ (calendar.ts): lịch mùa 2 tuần, dải 4 mùa, lật mùa, sắp tới (sự kiện hôm nay, lễ, sang mùa, tổng kết); mở lịch thì game dừng.
8. Sau commit 9d0b279, theo yêu cầu: quán ốc đêm rực hơn (6 đèn ấm `PointLight` cường độ `night * 5`, thử `* 9` thì sáng như ban ngày nên hạ), bỏ ô che bàn, mưa thì mái sạp dù kéo dài ra che cả sân (`awning` trong street.ts, bạt trong 26% để vẫn thấy khách; bung theo `env.t` vì khung hình thưa khi tab ẩn); có mái thì mưa chỉ rơi hai bên trái / phải ngoài quán (`Area.rainShelter`). Năng lượng cả đội 30 → 40 (`balance.crew.maxEnergy`). Sạp nguyên liệu ở chợ có 2–3 khách mua hàng (`StallArea.addShoppers`: 2 người đứng chọn, ngày lẻ / chẵn thêm 1 người đi dạo; chỗ đứng riêng từng kiểu sạp để không che biển giá).
1. `scripts/so-tay.mjs` + khuôn `scripts/so-tay.html`, lệnh `npm run sotay`. Sổ tay cũ viết tay (dừng ở giai đoạn 6) thay bằng bản sinh từ data nên không còn lệch số. Đã xem trên localhost: không lỗi console, các mục hiện đủ.
2. Chủ dự án chọn: Sổ tay tự sinh từ data; đồ hoạ cần tinh chỉnh là **nhân vật và HUD**. Đã cập nhật artifact Sổ tay trên claude.ai (cùng link).
3. Nhân vật gọt lại bằng code theo yêu cầu (không cần ngón tay / chân; cao thấp, mập gầy, trẻ em thấp; thêm tóc; giữ mắt mũi miệng; bóng đổ, viền mềm, cử động tự nhiên): `src/ui/three/person.ts` (tách khỏi models.ts), `toonRim` trong toon.ts, `HairStyle` thêm `bob` / `curly` / `side`. Không đổi sim / save. Sửa luôn tay phải trước đây nghiêng vào trong thân. Xem ở `lineup.html` và trong quán / chợ.
7. Quán Ốc (`CuisineId 'oc'`): data (cuisines, 9 món, `cheese`, `scallion`, nội thất `floor_street` / `floor_gach_do` / `floor_gach_hoa` / `wall_oc_*` / `furn_oc`, món ruột khách quen), `src/ui/three/street.ts`, nhánh `oc` trong cuisine.ts, màn mở đầu 4 quán. AI tự chọn: công thức + giá 9 món (lãi ~14–24 xu/phần), 3 món khởi đầu (tôm nướng, nghêu hấp thái, hàu nướng mỡ hành), "Sơn tường" của quán ốc = màu sạp dù, ô che bàn chỉ bung khi mưa (trời khô cụp lại cho dễ nhìn khách).
6. Chợ: trái cây bán ở Tạp hóa cậu Ba (mùa Đông vườn nghỉ vẫn có); sạp hải sản thêm 6 loại ốc / sò (`StallDef.baskets`), sạp thịt `interior: 'butcher'`.
5. Nông trại theo yêu cầu: bỏ lưới ô ở bảng, thời gian tính bằng ngày (`FARM_DAY`), `diesInWinter`, ao thu nhiều lứa, 6 loại ốc / sò, máy cày đậu. AI tự chọn: rau 1 cải · 2 dưa leo · 3 cà chua, cà rốt · 4 ớt, khoai tây · 5 hành tây; gà mái đẻ / bò sữa ra trứng / sữa mỗi ngày; cây ăn quả hái xong 1 ngày ra lứa sau; tưới giữ ẩm 1 ngày; sản lượng rau / thịt giữ như cũ.
4. Bảng gọi món 2 cột theo yêu cầu (`crew/unorder`, `crew/confirm`, `missingEnergy`). Badge "Powered by Netlify" che nút: tắt trong cấu hình project trên Netlify (chủ dự án tự làm).

---

## 21/11/2026 (laptop) — Giai đoạn 11b: nhịp quán + ngày hướng dẫn

**Nhánh:** `giai-doan-11` (chung nhánh, chưa commit). **Kết quả:** typecheck sạch, 111 test qua (thêm test chạy trọn ngày hướng dẫn). Đã xem trên localhost: lời chào, thẻ bưng món, thẻ ra chợ, thẻ nông trại (`?fresh&seed=4&tut=market&area=market`...). Chưa thử được trên điện thoại thật (âm thanh iOS) và chưa nhìn tận mắt động tác lau nhà.

1. `recipes.ts`: số thứ 6 = độ khó, `cookMinutes` → 4–10 s với bếp trưởng.
2. `balance`: `shifts[].kickOut`, `lastCall` sáng 11:00, `eatTime` theo số khách, `traffic`, `spawnInterval` 100 → 72, `service.mopTime`. customers.ts: `inSeating`, `eatMinutes`, `rollTraffic`; `state.traffic`.
3. `src/sim/pathing.ts` + `stepWorker` dùng điểm rẽ; lau sàn có thời gian (`WaiterState.work`); cây lau nhà + tư thế `mop`.
4. `audio.ts`: phát mẫu im lặng lúc mở khoá (iOS), nghe touchend / click / keydown, bộ nén, âm lượng MASTER 1 / SFX 0.6 / MUSIC 0.5.
5. `systems/tutorial.ts` + `ui/coach.ts`, `state.tutorial`, `Party.want`, `Game` option `tutorial`; `?tutorial`, `?tut=`.

---

## 21/11/2026 (laptop) — Giai đoạn 11: mùa 2 tuần, người làm vườn, dụng cụ, nhiệm vụ dài + thành tựu

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-11` (tách từ `main` đã gộp giai đoạn 10). **Kết quả:** typecheck sạch, 102 test qua (thêm 11); save v17. Đã xem trên localhost: bảng Nhà nông, 3 người làm vườn đi tưới hàng ruộng hành (`?fresh&rich&seed=2&ff=262&weather=sunny&area=farm&do=[gardener/hire ×3, till + plant field-0..8]`), bảng Thành tựu, thẻ nhiệm vụ có dòng chương.

1. `DAYS_PER_SEASON` 28 → 14; ngày lễ dời; test lịch dùng hằng số thay cho 28.
2. `src/data/farmhands.ts` (việc người làm vườn, dụng cụ), `balance.gardeners`, `SlotTypeDef.animals` (chuồng, ao).
3. `systems/gardeners.ts` (thuê, giao việc, tự nhận việc, mua dụng cụ); `farmer.ts`: `perform` export, `hasTool` / `walkSpeed` / `workTimeOf` / `waterRow`, `gardenerOn` chặn bác nhận ô người làm vườn đang lo.
4. `src/data/achievements.ts` + `systems/achievements.ts` (`tally` gọi trong `bumpQuest`); quests: `chapter`, `questChapters`, 15 nhiệm vụ mới, 7 loại mục tiêu mới; đơn hàng gọi `bumpQuest('contract')`.
5. UI: panel `farmhands` (🧰 Nhà nông) + `achievements` (🏆), thêm vào cột nút tròn; nút Nhà nông trong bảng Nông trại; ô người làm vườn đang lo có dấu 👩‍🌾; toast thành tựu / dụng cụ; người làm vườn trong `areas/farm.ts` (`updateGardeners`).
6. Ghi chú để dành: đơn mang về / giao tận nơi (roadmap mục "Để dành").

---

## 20/11/2026 (laptop) — Giai đoạn 10: sửa bên trong Tiệm 25caaaaa

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-10` (tách từ `giai-doan-9` vì `main` chưa gộp giai đoạn 9). **Kết quả:** typecheck sạch, 91 test qua; đã xem trên localhost lúc 21:35 (`?seed=1&ff=935&stall=snack`): tiệm sáng đèn, hai người trong đội ngồi hai bên bàn, ly matcha trên mặt bàn.

1. `areas/stall.ts`: `addLamps` (đèn thả trần + PointLight theo `env.night`), ghế lưu kèm tâm bàn (`seats[].table`) để đặt đĩa món trên bàn, ghế hai bên bàn, thứ tự bàn, tường bên dài 9.05 m.

---

## 20/11/2026 (laptop) — Giai đoạn 9: bưng món theo màu bàn

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-9`. **Kết quả:** typecheck sạch, 91 test qua (thêm 3 test); đã xem trên localhost (`?ff=150&ffserve&pickup`): bàn chờ món có bong bóng nền màu, bồi bàn cầm 2 món cùng màu, thanh "Đang cầm" phía dưới. **Chưa thử bằng tay:** bấm quầy / bấm bàn.

1. Sim: `Order.readyAt`, `Party.color`, task `pickup`, lệnh `service/pickup` + `service/serve` (không đổi chủ món cùng loại), `passQueue`, `balance.service.carryMax` / `partyColors`; save.ts lọc task `pickup` + sửa số chỗ nhân viên theo hạng bếp. Không đổi SAVE_VERSION (trường mới đều tuỳ chọn).
2. UI: bỏ `passOpen`, `serving`, `tray2/tray4/trayPick`, kéo thả; `serviceHtml(game)` mới; `src/ui/colors.ts`; `bubbleSprite(..., bg)`; `updateCarryBadges`; trang hướng dẫn "Quầy line và màu bàn"; `?ffserve` (dev).

---

## 19/11/2026 (laptop) — Giai đoạn 8: đơn đặt hàng, bán hàng dư, sự kiện ngẫu nhiên

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-8`. **Kết quả:** typecheck sạch, 88 test qua (thêm 6 test); đã xem trên localhost: bảng Đơn hàng, nút bán ở Kho, dải sự kiện (xe du lịch, nhà phê bình), nhà phê bình ngồi trong quán. **Chưa thử bằng tay:** bấm giao đơn, bán hàng, phục vụ nhà phê bình tới cuối.

1. Sim: `SAVE_VERSION` 16 (`contracts`, `event`), `Party.vip`, systems `contracts.ts` và `events.ts`, `spawnParty` export (có `opts`), `balance.events` / `balance.contracts`; lệnh `contract/deliver`, `market/sell`.
2. UI: bảng `contracts` (Đơn hàng), Kho có nút bán, `eventTag` (hud.ts), thông báo sự kiện / đơn hàng (app.ts), `decorateVip` (areas/restaurant.ts), `?event=` (dev).

---

## 19/11/2026 (laptop) — Giai đoạn 7: mở rộng bếp, giao món, hướng dẫn, cảnh báo nguyên liệu

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-7`. **Kết quả:** typecheck sạch, 82 test qua (thêm 3 test bếp); đã xem trên localhost: bếp hạng 3 có 4 đầu bếp, bảng Quán có thẻ mở rộng bếp, bảng Nhân viên có nút giao món, cảnh báo "Hết: Phở bò", trang hướng dẫn ở màn mở đầu. **Chưa thử bằng tay:** bấm các nút (chỉ xem), hướng dẫn trong Cài đặt.

1. Sim: `SAVE_VERSION` 15 (`restaurant.kitchenTier`), `StaffState.dishes`, `StaffDef.hire`, `balance.kitchen`, `balance.lowStockPortions`; lệnh `kitchen/upgrade`, `chef/hire`, `chef/fire`, `chef/setDish`; sự kiện `kitchen/changed`; `maxHelpers` cộng theo hạng bếp.
2. UI: `ui/tutorial.ts`, `lowStock` / `lowStockChip` (hud.ts), `kitchenCard` (bảng Quán), `chefControls` / `chefHire` (bảng Nhân viên), quầy line + bếp theo hạng trong `areas/restaurant.ts` (`passSlotsXY`).

---

## 19/11/2026 (laptop) — Giai đoạn 6: mùa vụ và lễ hội

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-6`. **Kết quả:** typecheck sạch, 79 test qua (thêm 5 test mùa vụ / lễ hội); đã xem trên localhost: trang trí Tết trong quán, Trung thu và Giáng sinh ngoài chợ, dải lễ trên HUD, nhãn món hợp mùa, màn hết ngày báo lễ ngày mai. **Chưa thử bằng tay:** bảng chọn giống theo mùa (cần bấm ô), lì xì trong ván thật.

1. Data: `ProducerDef.seasons`, `RecipeDef.seasons` (bảng `SEASONAL`), `WeatherDef.damage` / `dryRate` (+ `storm`, `heat`), `balance.seasons`, `festivals` (calendar.ts). Không đổi save (chỉ thêm data).
2. Sim: `canPlantNow`, `witherOffSeason`, `seasonPriceFactor`, `seasonalPrice`, `festivalOf` trong `modifier()`, system `festival.ts`, `stormDamage`.
3. UI: `ui/three/festive.ts` (FestiveSet), `festivalTag` / `tomorrowFestivalHtml` (hud.ts), bảng Nông trại / Thực đơn có nhãn mùa, toast đầu mùa / héo / bão / lễ.

---

## 19/11/2026 (laptop) — Đợt 18: HUD gọn lại, bốn mùa

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-5`. **Kết quả:** typecheck sạch, 74 test qua; đã xem trên localhost (1000×470): HUD mới, cột nút tròn, thanh dưới có nút chuyển khu, ngăn kéo với nút ✕ to, nông trại / chợ mùa Đông (tuyết, nước đóng băng), Hạ, Thu, màn tổng kết ngày 112 (mùa Đông + năm 1). **Chưa thử bằng tay:** bấm các nút mới (chỉ xem), khăn quàng nhìn gần.

1. Sim: `SAVE_VERSION` 14 (`stats.season` / `stats.year`); `WeatherDef.seasonWeights` + thời tiết `snow`; `SeasonDef.frozen` → `isFrozen` chặn cuốc / gieo / tưới ngoài trời, cây ngừng lớn, `autoChain` không gieo lại.
2. UI: `SIDE_PANELS` (hud.ts), `coins()` trả HTML đồng xu CSS, `periodSummaryHtml`, `button.x-close`, `?day=` (dev).
3. Cảnh: `Env.season` / `snow`, `updateFlakes`, `paintSeason`, `wardrobe.winter` + khăn quàng trong `makePerson`.
4. Bổ sung: `addUmbrella` + `wardrobe.rain` (người ngoài chợ cầm dù khi mưa); `areas/stall.ts` mái sạp 5 m, menu Tiệm 25caaaaa thành bảng chân đứng gần cửa, sàn trắng ngà; `?stall=` (dev).

---

## 19/11/2026 (laptop) — Đợt 17: gọi món cho cả đội, vào bên trong quầy chợ

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-4`. **Kết quả:** typecheck sạch, 70 test qua; đã xem trên localhost: bên trong sạp Tạp hoá (khay + biển giá + bảng mua), bên trong Tiệm 25caaaaa (logo, menu, cả đội ngồi ăn), bảng gọi món (kiểm tra DOM). **Chưa thử bằng tay:** bấm chọn người / món trong bảng gọi món, nút mua trong quầy, nút "‹ Chợ".

1. `balance.shifts[].lastCall`, `acceptingGuests`; đóng cửa thì khách seated / readyToOrder về (`closed`). Sự kiện `shift/lastCall`.
2. crew.ts: `crew.pending` (PendingMeal), `crew/order`, `crew/autoOrder`, `mealBudget`, `billDue` (một hoá đơn cho cả đợt). Không tăng SAVE_VERSION (v13 chưa phát hành; reconcile thêm `pending` nếu thiếu).
3. UI: `mealHtml`, `buyHtml` (hud.ts); khu mới `areas/stall.ts` (StallArea, `logoBoard`, `crewLook` dùng chung với chợ); Pick `goods`, `menuboard`; ảnh `public/shop/tiem-25caaaaa.jpg`.

---

## 19/11/2026 (laptop) — Đợt 16: cả đội có năng lượng + giờ nghỉ ra chợ, G10 cân bằng kinh tế

**Model:** Claude Opus 5.5. **Nhánh:** `giai-doan-4`. **Kết quả:** typecheck sạch, 69 test qua (7 test mới cho cả đội); đã xem trên localhost: quầy ra món bên phải, bảng Nhân viên (bồi bàn xỉu nằm ra sàn), cả đội ngồi ăn ở hàng rong, hoá đơn bữa trưa, cây cam / táo / xoài / chuối. **Chưa thử bằng tay:** kéo món vào khay rồi "Cầm khay" + bấm bàn, nút Kết thúc ngày, bồi dưỡng, trả hoá đơn.

1. Save v13: `Vitals` (energy, fainted) cho đầu bếp, bồi bàn, nhân viên thuê, bác nông dân; `GameState.crew`. System mới `systems/crew.ts` (giờ nghỉ, gọi món ngẫu nhiên có giới hạn tiền, hoá đơn, `crew/revive`, `crew/pay`, `day/end`). kitchen / service / helpers / farmer dừng khi vắng mặt hoặc xỉu và trừ sức mỗi việc. `StallDef.staffMeal` → `menu`; bỏ `helper/eat`, `helper/revive`.
2. customers.ts: khách còn xếp hàng lúc hết ca thì về (`LeaveReason 'closed'`, không tính khách mất, không trừ uy tín) để đội ra chợ đúng giờ.
3. UI: `panels/crew.ts`; `billHtml` + nút Kết thúc ngày (hud.ts); quầy ra món render vào ngăn kéo; `ui.trayPick`; vết bẩn bấm 1 cái (bỏ `holdTick` ở stage.ts); `--tools-h` cho nút chuyển khu; `MarketArea.updateEaters` theo `crew.meals`; xe cùng tốc độ; farmkit: trái cây + cây chuối mới; farm.ts: vườn cây không chạy vòng.
4. G10: script mô phỏng tạm (đã xoá) — xem số liệu ở roadmap Đợt 16.

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
