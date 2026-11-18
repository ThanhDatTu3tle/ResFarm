# Đồ hoạ 3D: quy ước hiện tại và lộ trình nâng cấp model

Chủ dự án đã duyệt phong cách hiện tại (tông màu, kiểu nhân vật). Mục tiêu về sau: model **chi tiết hơn, đẹp hơn, nhiều hơn** mà không phải đập đi làm lại. File này mô tả nền hiện có và cách nâng cấp từng nấc.

## 1. Phong cách hiện tại

- **Three.js**, vật liệu `MeshToonMaterial` với bảng sáng 4 nấc (`toon.ts`) → nét tô bệt kiểu hoạt hình. Cùng kiểu với dự án `co-thu-3d`.
- **Mọi model ghép từ khối cơ bản bằng code** (hộp, cầu, trụ, nón, capsule, khối 20 mặt, lăng trụ). Không có file model, không có texture ảnh.
- **Bảng màu ấm, tươi.** Màu chủ đạo: cam `0xe2703a`, gỗ `0xc98b4f` / `0xd9a066` / `0x8a5a35`, kem `0xf8e3bd`, xanh lá `0x5fae57` / `0x8fd16a`, đỏ `0xe2574c` / `0xc94a3f`.
- **Emoji làm biểu tượng nổi** (`emojiSprite`): món trên đĩa, hàng trên sạp, sản phẩm chín, nhắc việc (💧 ⛏️ ✋). Nhờ vậy nội dung mới trong `src/data` có hình ngay.

## 2. Quy ước dựng hình (giữ nguyên khi nâng cấp)

| Quy ước | Chi tiết |
| --- | --- |
| Đơn vị | 1 đơn vị = 1 mét. Người cao khoảng 1.25, mặt bàn 0.8, tường 4.2 |
| Hướng | Model nhìn về **+z**, chân ở **y = 0**, gốc toạ độ ở giữa đáy |
| Trục | y hướng lên. Camera nhìn từ +z về −z |
| Toạ độ quán | Data dùng toạ độ 2D (55 đơn vị = 1 mét); đổi bằng `wx()`/`wz()` trong `areas/restaurant.ts` |
| Tạo mesh | `mesh(cha, hình, màu | vật liệu, { p, r, s, cast, receive })`, `group(cha, { p, r, s })` |
| Hình học | Lấy từ `G.box/sphere/cyl/cone/ico/torus/capsule/prism` — có cache, không `new` trực tiếp |
| Vật liệu | `toon(màu)` dùng chung (không sửa). Cần đổi màu động: `toon(màu, {})` tạo bản riêng |
| Bóng | Mặc định đổ và nhận bóng. Tắt `cast` cho mặt đất, chi tiết nhỏ, vật trong suốt |
| Bấm chọn | `obj.userData.pick = { type, id }` trên group gốc của vật |
| Đung đưa theo gió | `obj.userData.sway = pha` rồi `collectSway()` + `sway()` |
| Ngẫu nhiên trang trí | `seeded(seed)` trong `toon.ts`, để cảnh giống nhau mỗi lần tải. Không dùng RNG của sim |

## 3. Cấu trúc cảnh

```
Stage (stage.ts)
 ├─ renderer, PerspectiveCamera (fov 40), OrbitControls
 ├─ HemisphereLight + DirectionalLight (mặt trời/mặt trăng, đổ bóng 2048²)
 ├─ nền trời (màu đổi theo giờ + thời tiết), 9 đám mây, 240 sao, 1100 hạt mưa
 └─ mỗi Area.root — chỉ khu đang xem có visible = true
      ├─ RestaurantArea: phòng tĩnh + Map bàn + Map khách + Map đĩa + hiệu ứng nhóm khách
      ├─ FarmArea: cảnh tĩnh + Map ô (SlotView)
      └─ MarketArea: cảnh tĩnh + sạp dựng theo StallDef
```

`Env` (tính mỗi khung hình trong `Stage.updateEnv`): `t` giây thực, `day`/`night` 0..1, `rain`/`clouds`/`wind`/`dim` 0..1 (lấy từ `WeatherDef.visual`, có làm mượt), `selectedSlot`, `editLayout`. Mỗi khu nhận `Env` trong `update()`.

**Mẫu "view theo state"** — dùng cho mọi thứ thay đổi được:

```ts
for (const thing of state.things) {
  let view = this.views.get(thing.id);
  if (!view) this.views.set(thing.id, (view = this.build(thing)));   // dựng khi mới xuất hiện
  if (view.kind !== thing.kind) this.rebuild(view, thing);            // dựng lại khi đổi loại
  view.g.position.set(...);                                           // cập nhật mỗi khung hình
}
// rồi xoá view của những thứ không còn trong state
```

## 4. Điểm nối để thay model (đã có sẵn)

Mọi model được tạo qua **hàm nhà máy** trong `src/ui/three/models.ts`. Khu vực chỉ gọi hàm, không biết bên trong dựng bằng gì:

| Hàm | Dùng cho | Tra theo |
| --- | --- | --- |
| `makePerson(look, hat)` | khách, đầu bếp, người bán, nông dân | `LOOKS[]` |
| `makeCrop(producerId)` | cây trên ruộng | bảng `CROPS`, id lạ → bụi xanh mặc định |
| `makeAnimals(producerId)` | con vật trong chuồng/ao | bảng `ANIMALS`, id lạ → `null` → khu hiện emoji |
| `makeTree`, `makeBush`, `makeFence`, `makeLampPost`, `makeCrate` | trang trí | — |

**Nâng cấp một model = sửa thân hàm nhà máy tương ứng, giữ nguyên chữ ký và quy ước mục 2.** Không khu nào phải sửa.

Bàn ghế, tường, sạp, ô đất hiện dựng thẳng trong file khu (`buildTable`, `buildRoom`, `buildStall`, `buildSlot`). Khi muốn thay chúng bằng model chi tiết, bước đầu tiên là **tách ra thành hàm nhà máy trong `models.ts`** theo cùng mẫu.

## 5. Lộ trình nâng cấp model — 3 nấc

Đi từng nấc; nấc sau không bắt buộc.

### Nấc 1 — chi tiết hơn, vẫn dựng bằng code (không thêm công cụ)

Rẻ nhất, hợp với AI vì không cần phần mềm 3D.

- ✅ *(18/11/2026)* Nhân vật chibi có khớp: `makePerson` gắn `userData.rig = { body, head, armL, armR, legL, legR, eyes, seed }`; `animatePerson(g, t, pose)` lo thở, chớp mắt, nhìn quanh, đi, ngồi, ăn, nấu, vẫy, bưng (`pose.carry`). Con vật: `userData.eyes` / `userData.tail` + `animateCreature`.
- Thêm kiểu tóc, phụ kiện (kính, mũ, tạp dề), nhiều dáng người (trẻ em, người lớn tuổi) qua tham số của `Look`.
- ✅ *(18/11/2026)* Món ăn: bảng `DISHES` + `makeDish(recipeId)` trong `models.ts`, đủ 12 món; món mới chưa có model thì quán hiện emoji.
- ❌ Nét viền hoạt hình: đã thử bản hậu kỳ theo độ sâu (viền mảnh toàn cảnh, 0 draw call thêm) — chủ dự án thấy "nhìn hơi bể", đã gỡ. Nếu thử lại: viền dày, mượt, chỉ cho nhân vật/con vật (inverted hull), và hỏi chủ dự án trước.
- ✅ *(18/11/2026)* Cây trồng 3 giai đoạn: `makeCrop(producerId, stage)` + `cropStageOf(frac)`; lên giai đoạn thì dựng lại và nảy.

### Nấc 2 — nhiều vật thể hơn mà vẫn mượt

Khi cảnh có hàng trăm vật thể (quán to, nông trại nhiều ô):

- **Gộp mesh tĩnh theo vật liệu.** Dự án `co-thu-3d` có sẵn hàm `mergeStatic(root)` trong `src/scene/helpers.js` — chép sang `toon.ts` (đổi sang TypeScript), gọi ở cuối hàm dựng cảnh tĩnh. Đánh dấu node chuyển động bằng `userData.dyn = true` để không bị gộp. Lưu ý: vật có `userData.pick` hoặc vật liệu đổi màu động phải nằm trong node `dyn`.
- **`InstancedMesh`** cho thứ lặp lại nhiều (cây ngoài rìa, cọc rào, hạt mưa nếu đổi sang dạng khối).
- Giảm bóng đổ: tắt `castShadow` cho vật nhỏ; hạ `shadow.mapSize` xuống 1024 trên điện thoại.
- Chỉ `update()` khu đang xem cho phần thuần hình ảnh (hiện mọi khu đều update — đơn giản nhưng tốn).

### Nấc 3 — dùng file model thật (glTF)

Khi muốn model do hoạ sĩ làm hoặc lấy từ kho có sẵn.

**Định dạng:** glTF nhị phân (`.glb`), nén Draco hoặc Meshopt. Three.js có sẵn `GLTFLoader` trong `three/examples/jsm/loaders/GLTFLoader.js`.

**Đặt file:** `public/models/<loại>/<id>.glb` — vd `public/models/crops/tomato.glb`, `public/models/animals/hen.glb`. Tên file trùng `id` trong `src/data` để tra tự động.

**Cách ghép vào nền hiện có** (giữ hàm nhà máy đồng bộ):

```ts
// src/ui/three/assets.ts  (file mới)
const cache = new Map<string, THREE.Object3D>();

/** Tải trước danh sách model; gọi trong app.ts TRƯỚC khi tạo Stage. Thiếu file thì bỏ qua, không lỗi. */
export async function preloadModels(paths: string[]): Promise<void> { /* GLTFLoader.loadAsync, lưu scene vào cache */ }

/** Bản sao của model đã tải, hoặc null nếu không có -> hàm nhà máy rơi về bản dựng bằng code. */
export function cloneModel(path: string): THREE.Object3D | null { /* cache.get(path)?.clone() */ }
```

```ts
// trong models.ts
export function makeCrop(producerId: string): THREE.Group {
  const model = cloneModel(`models/crops/${producerId}.glb`);
  if (model) return wrap(model);          // có file thì dùng file
  ...                                      // không thì dựng bằng code như cũ
}
```

Nhờ thứ tự "file → code → emoji", có thể thay dần từng model mà game luôn chạy được.

**Yêu cầu với model nhập vào** (đưa cho hoạ sĩ hoặc kiểm tra khi tải về):

- Đúng quy ước mục 2: mét, nhìn về +z, chân ở y = 0. (Blender xuất glTF với "+Y Up" là đúng.)
- Ít đa giác: nhân vật ≤ 1.500 tam giác, đồ vật ≤ 500, cây trồng ≤ 300.
- Màu phẳng theo vật liệu hoặc một ảnh bảng màu nhỏ dùng chung (256×256). Tránh texture lớn.
- Để giữ nét hoạt hình, sau khi tải thay vật liệu bằng `toon(màu)` lấy màu từ vật liệu gốc (viết một hàm `toToon(object)` duyệt mọi mesh).
- Animation (đi, ngồi, nấu) đóng trong file, tên clip thống nhất: `idle`, `walk`, `sit`, `work`. Chạy bằng `THREE.AnimationMixer`; model có xương phải nhân bản bằng `SkeletonUtils.clone`.

**Nguồn model miễn phí hợp phong cách:** Kenney (kenney.nl) và Quaternius (quaternius.com) phát hành theo CC0 (dùng thoải mái, không cần ghi nguồn); Poly Pizza (poly.pizza) có cả CC0 lẫn CC-BY (phải ghi tên tác giả). Luôn đọc giấy phép của từng gói trước khi dùng. Công cụ: Blender (miễn phí) để chỉnh và xuất; gltf-transform để nén.

**Chi phí của nấc 3:** dung lượng tải tăng (mỗi model vài chục đến vài trăm KB), cần màn hình chờ tải, và AI **không tự tạo được file model** — phải có người làm hoặc tải về. Vì thế nấc 1 nên đi trước.

## 6. Ngân sách hiệu năng (mục tiêu cho điện thoại tầm trung)

| Chỉ số | Mục tiêu | Xem ở đâu |
| --- | --- | --- |
| Khung hình | ≥ 30 fps, lý tưởng 60 | DevTools → Performance, hoặc `stats.js` |
| Draw call mỗi khung | < 300 | `renderer.info.render.calls` trong console |
| Tam giác | < 150.000 | `renderer.info.render.triangles` |
| Tỉ lệ điểm ảnh | tối đa 2 | đã giới hạn trong `Stage` |
| Bóng đổ | 1 nguồn, 2048² | `Stage` |
| Dung lượng JS | ~720 KB (~190 KB nén) + font Mali (~5 KB mỗi phần chữ) | `npm run build` |

Đo ngày 18/11/2026 (máy dev, chưa đo điện thoại): **560–650 draw call** mỗi khung tuỳ khu (đã tính pass đổ bóng), 25–55 nghìn tam giác — draw call đã vượt mục tiêu, nên việc gộp mesh tĩnh (D5) nên làm trước khi thêm nhiều vật thể. Đo bằng `window.stage.renderer.info.render` sau `stage.render()` ở bản dev. Chưa đo trên thiết bị thật. Khi đo, cảnh nặng nhất là chợ và nông trại lúc mưa. Thứ tự tối ưu nếu giật: gộp mesh tĩnh → hạ độ phân giải bóng → hạ tỉ lệ điểm ảnh xuống 1.5 → giảm hạt mưa.

Để xem nhanh số liệu, thêm tạm vào `app.ts` (bản dev): `(window as any).info = renderer.info` — hiện `renderer` là private trong `Stage`, cần mở một getter.

## 7. Việc hình ảnh còn thiếu

- ~~Nhân vật chưa có cử động tay chân~~ — đã có (18/11/2026). Bồi bàn đi đường thẳng, xuyên qua bàn ghế.
- Bàn chưa xoay được; sàn chỉ đổi màu, chưa đổi hoa văn.
- Quán khi mưa chỉ thấy mưa ngoài cửa sổ sau (do góc nhìn cắt mái).
- ~~Hiệu ứng hạt, âm thanh~~ — đã có (`fx.ts`, `audio.ts`).
- Không có nét viền (đã thử và gỡ), chưa có hậu kỳ (bloom cho đèn đêm).
- Chuyển khu là mờ dần đơn giản, chưa có chuyển cảnh.
