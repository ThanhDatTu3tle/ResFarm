import '@fontsource/mali/500.css';
import '@fontsource/mali/700.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createContent, defaultDecor, type CuisineId } from '../data';
import { regulars } from '../data/regulars';
import type { HairStyle, PersonBuild } from '../data';
import { cleanOwner, OWNER_OUTFITS, type OwnerProfile } from '../sim/state';
import { adultShape, animateCreature, animatePerson, FARMER_SHAPE, LOOKS, makeAnimals, makeBush, makeCrate, makeCrop, makeDish, hasCropModel, makeLampPost, makePerson, makeTree, type Pose } from '../ui/three/models';
import { makeHelperPerson, makeOwner, makePet, makePolice, makeRegular, makeShipper, makeShipperBike, makeWaiter } from '../ui/three/people';
import { buildSeat, counterExtras, makeShopfront, seatStyle, shopkeeper, tableExtras } from '../ui/three/cuisine';
import { makeProp } from '../ui/three/props';
import { grainField, hayBale, CAR_COLORS, CAR_KINDS, makeCar, makeFruitTree, makeGreenhouse, makeRiceMill, makeScooter, makeTractor, makeWindmill } from '../ui/three/farmkit';
import { makeMai, makeStarLantern, makeSnowman, makeXmasTree } from '../ui/three/festive';
import { makeGuard, makeMinibus } from '../ui/three/curbside';
import { buildEquipment } from '../ui/three/equipment';
import { makeIngredient } from '../ui/three/ingredients';
import { makePlasticSet, makeTeaKiosk } from '../ui/three/kiosk';
import { makeCharcoalGrill, makeSnailTable } from '../ui/three/snailstall';
import { makeBusShelter, makeCityBus } from '../ui/three/busstop';
import { makeBillboard } from '../ui/three/billboard';
import { logoBoard } from '../ui/three/areas/stall';
import { animateCartVendor, equipCartVendor, makeStreetCart, type StreetKind } from '../ui/three/streetcarts';
import { buildBarCounter, buildBarStool, buildCaddy, buildChopstickSet, buildGrillTable, buildJpSet, buildKrSet, buildLeatherChair, buildOakChair, buildOakTable, buildPlasticChair, buildPlasticTable, buildWoodStool, buildWoodTable, woodMats } from '../ui/three/furniture';
import { G, group, mesh, toon } from '../ui/three/toon';

/**
 * TRANG XEM MODEL 3D — 3 trang, có trong bản build (Netlify phát cùng game, cạnh Sổ tay so-tay.html):
 *   models-nhan-vat.html · models-do-vat.html · models-mon-an.html
 * Mỗi model chụp thành ảnh nhỏ bằng một renderer dùng chung; bấm thẻ để xem to, xoay 360°, nhân vật có cử động.
 * Danh sách dựng thẳng từ các hàm dựng model của game (ui/three/*) + data, nên thêm model mới là tự hiện ở đây.
 */

type Page = 'nhan-vat' | 'do-vat' | 'mon-an';
interface Entry {
  name: string;
  note?: string;
  /** Dựng model; không có thì thẻ chỉ hiện emoji (chưa có model 3D). */
  make?: () => THREE.Object3D;
  emoji?: string;
}
interface Section {
  title: string;
  desc?: string;
  entries: Entry[];
}

const content = createContent();
const CUISINES: CuisineId[] = ['jp', 'kr', 'vn', 'oc'];
const cuName = (c: CuisineId) => content.cuisines.get(c).name;
const page = (document.body.dataset.page ?? 'nhan-vat') as Page;

// ---------- Danh mục ----------

function peopleSections(): Section[] {
  const crew: Entry[] = [
    { name: 'Bồi bàn (người chơi)', make: makeWaiter },
    { name: 'Bếp trưởng', make: () => makePerson({ shirt: 0xffffff, hair: 0x3a2a1e, skin: 0xf2c49b }, 'chef', { width: 1.2 }) },
    { name: 'Bếp phụ (thuê thêm)', make: () => makePerson({ shirt: 0xf6f0e4, hair: 0x6b4a2f, skin: 0xffd9b8 }, 'chef', { width: 0.95 }) },
    { name: 'Nhân viên phục vụ', make: () => makeHelperPerson(1, false, adultShape) },
    { name: 'Quản lý (mặc vest)', make: () => makeHelperPerson(2, true, adultShape) },
    { name: 'Bác nông dân', make: () => makePerson(LOOKS[2], 'straw', FARMER_SHAPE) },
    { name: 'Người làm vườn', make: () => makePerson(LOOKS[5], 'straw', adultShape(7)) },
    { name: 'Anh shipper', make: makeShipper },
    { name: 'Bác bảo vệ bãi xe', make: makeGuard },
    { name: 'Công an khu vực', note: 'Quán Ốc', make: makePolice },
  ];
  const owners: Entry[] = [];
  for (const gender of ['male', 'female'] as const) {
    const who = gender === 'male' ? 'Ông chủ' : 'Bà chủ';
    for (const age of [25, 35, 50]) owners.push({ name: `${who} ${age} tuổi`, make: () => makeOwner(cleanOwner({ gender, age })) });
    for (const o of OWNER_OUTFITS.filter((x) => x.for.includes(gender))) owners.push({ name: `${who} · ${o.name}`, make: () => makeOwner(cleanOwner({ gender, age: 30, outfit: o.id } as Partial<OwnerProfile>)) });
  }
  const walkIns: Entry[] = [];
  const builds: [PersonBuild, string, HairStyle[]][] = [
    ['kid', 'Trẻ em', ['short', 'twin', 'curly', 'bob']],
    ['teen', 'Thiếu niên', ['spiky', 'pony', 'side']],
    ['adult', 'Người lớn', ['short', 'long', 'bun', 'bob', 'curly']],
    ['elder', 'Người già', ['bald', 'bun', 'side']],
  ];
  let n = 0;
  for (const [build, label, hairs] of builds) {
    for (const hair of hairs) {
      const k = n++;
      const look = { ...LOOKS[k % LOOKS.length], ...(build === 'elder' ? { hair: 0xdddddd } : {}) };
      walkIns.push({ name: `${label} · tóc ${hair}`, make: () => makePerson(look, 'none', { build, hair, width: [0.88, 1.0, 1.28, 1.1, 0.92][k % 5] }) });
    }
  }
  return [
    { title: 'Đội quán & người quanh quán', entries: crew },
    { title: 'Ông / bà chủ', desc: 'Chọn ở màn mở đầu: giới tính, tuổi (25–50), kiểu tóc, quần áo.', entries: owners },
    { title: 'Khách quen', desc: 'Mỗi người một dáng, kiểu tóc, phụ kiện riêng.', entries: regulars.map((r) => ({ name: r.name, make: () => makeRegular(r.style) })) },
    { title: 'Khách vãng lai', desc: 'Dáng người × kiểu tóc; trong game màu áo / tóc / dáng đổi theo nhóm khách.', entries: walkIns },
    { title: 'Chủ quán ở màn chọn quán', entries: CUISINES.map((c) => ({ name: cuName(c), make: () => shopkeeper(c) })) },
    { title: 'Thú cưng', entries: content.pets.all().map((p) => ({ name: p.name, make: () => makePet(p.id) })) },
  ];
}

function furnitureMats(c: CuisineId) {
  const col = defaultDecor(content, c).find((d) => d.slot === 'furniture')?.colors ?? {};
  return { top: toon(col.top ?? 0xe0a868), base: toon(col.base ?? 0x8a5a35), seat: toon(col.seat ?? 0xe2703a), back: toon(col.back ?? 0xb9733f) };
}

/** Bộ bàn + ghế như trong quán (bàn 2 / 4 người hoặc quầy ghế đơn), theo nội thất mặc định của quán. */
function tableSet(c: CuisineId, kind: 'pair' | 'four' | 'counter'): THREE.Group {
  const g = group(null);
  const mats = furnitureMats(c);
  if (kind === 'counter') {
    const [w, d, top] = [2.2, 0.62, 1.1];
    const style = c === 'jp' || c === 'kr' ? c : null;
    const wood = woodMats(defaultDecor(content, c).find((x) => x.slot === 'furniture')!.colors as { top: number; base: number; seat: number });
    if (style) buildBarCounter(g, style, w, d, top, wood, mats.base);
    else {
      mesh(g, G.box(w, top - 0.08, d), mats.base, { p: [0, (top - 0.08) / 2, 0] });
      mesh(g, G.box(w + 0.2, 0.08, d + 0.25), mats.top, { p: [0, top - 0.04, 0] });
    }
    counterExtras(c, g, top, w, d);
    [-0.7, 0, 0.7].forEach((x, i) => {
      const chair = group(g, { p: [x, 0, d / 2 + 0.5], r: [0, Math.PI, 0] });
      if (style) buildBarStool(chair, style, wood, mats.seat, i + 1);
      else {
        mesh(chair, G.cyl(0.05, 0.07, 0.72, 8), 0x5f6b77, { p: [0, 0.36, 0] });
        mesh(chair, G.cyl(0.26, 0.26, 0.08, 14), mats.seat, { p: [0, 0.74, 0] });
      }
    });
    return g;
  }
  const [w, d] = kind === 'pair' ? [1.27, 1.27] : [2.18, 1.38];
  const top = 0.8;
  const wood = c === 'vn' || c === 'jp' || c === 'kr' ? woodMats(defaultDecor(content, c).find((x) => x.slot === 'furniture')!.colors as { top: number; base: number; seat: number }) : null;
  if (wood && c === 'kr') buildGrillTable(g, w, d, top, wood, mats.base, kind === 'pair' ? 3 : 5);
  else if (wood && c === 'jp') buildOakTable(g, w, d, top, wood, kind === 'pair' ? 3 : 5);
  else if (wood) buildWoodTable(g, w, d, top, wood, kind === 'pair' ? 3 : 5);
  else if (c === 'oc') buildPlasticTable(g, w, d, top, mats, kind === 'pair' ? 3 : 5);
  else {
    mesh(g, G.box(w, 0.1, d), mats.top, { p: [0, top - 0.05, 0] });
    mesh(g, G.box(w - 0.15, 0.06, d - 0.15), mats.base, { p: [0, top - 0.13, 0] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(g, G.cyl(0.06, 0.06, top - 0.1, 8), mats.base, { p: [sx * (w / 2 - 0.15), (top - 0.1) / 2, sz * (d / 2 - 0.15)] });
  }
  const seats: [number, number, number][] = kind === 'pair' ? [[-(w / 2 + 0.47), 0, Math.PI / 2], [w / 2 + 0.47, 0, -Math.PI / 2]] : [[-w / 4, -(d / 2 + 0.44), 0], [w / 4, -(d / 2 + 0.44), 0], [-w / 4, d / 2 + 0.44, Math.PI], [w / 4, d / 2 + 0.44, Math.PI]];
  tableExtras(c, g, top, w, d, kind === 'pair' ? 3 : 5, seats.map(([x, z]) => ({ x, z })));
  seats.forEach(([x, z, r], i) => {
    const chair = group(g, { p: [x, 0, z], r: [0, r, 0] });
    if (c === 'kr') buildLeatherChair(chair, mats.seat, i + 1);
    else if (wood && c === 'jp') buildOakChair(chair, wood, mats.seat, i + 1);
    else if (wood) buildWoodStool(chair, wood, i + 1);
    else if (c === 'oc') buildPlasticChair(chair, mats.seat, i + 1);
    else buildSeat(seatStyle(c), chair, mats);
  });
  return g;
}

/** Một món trang thiết bị (Siêu thị) dựng trong một phòng giả nhỏ. */
function equipment(id: string): THREE.Group {
  const parent = group(null);
  buildEquipment(parent, { street: false, halfW: 3, backZ: -2, frontZ: 2, kitchenZ: -0.8, kitchenX1: -1.6, kitchenCenter: 0, kitchenHalf: 1.4, door: [0, 2.6] }, new Set([id]));
  if (id === 'porcelain') parent.rotation.y = Math.PI; // tủ chén quay mặt kính ra phía camera
  return parent;
}

function thingSections(): Section[] {
  const tables: Entry[] = [];
  for (const c of CUISINES) {
    tables.push({ name: `${cuName(c)} · bàn đôi`, make: () => tableSet(c, 'pair') });
    tables.push({ name: `${cuName(c)} · bàn bốn`, make: () => tableSet(c, 'four') });
    if (c === 'jp' || c === 'kr') tables.push({ name: `${cuName(c)} · quầy ghế đơn`, make: () => tableSet(c, 'counter') });
    if (c === 'oc') tables.push({ name: `${cuName(c)} · ống đũa, chai lọ`, note: 'Đặt trên mỗi bàn', make: () => { const g = group(null); buildChopstickSet(g, 0); return g; } });
    if (c === 'kr') tables.push({ name: `${cuName(c)} · kệ menu, đũa muỗng, soju`, note: 'Đặt sát mép mỗi bàn nướng', make: () => { const g = group(null); buildKrSet(g, 0); return g; } });
    if (c === 'jp') tables.push({ name: `${cuName(c)} · hộp giấy, lọ nước tương`, note: 'Đặt trên mỗi bàn', make: () => { const g = group(null); buildJpSet(g, 0); return g; } });
    if (c === 'vn') tables.push({ name: `${cuName(c)} · khay đa năng`, note: 'Đặt giữa mỗi bàn', make: () => { const g = group(null); buildCaddy(g, 0); return g; } });
  }
  const CAR_NAMES = { sedan: 'sedan', suv: 'SUV', pickup: 'bán tải', mini: 'tải mini' } as const;
  const COLOR_NAMES = ['đỏ', 'xanh dương', 'trắng', 'bạc', 'đen', 'vàng', 'xanh lá', 'cam', 'xanh ngọc', 'đỏ đô', 'be', 'xanh navy'];
  // Mỗi loại xe 3 màu khác nhau (xoay vòng bảng màu CAR_COLORS)
  const PICKS: Record<string, number[]> = { sedan: [0, 3, 9], suv: [1, 4, 10], pickup: [6, 2, 11], mini: [2, 5, 8] };
  const vehicles: Entry[] = [
    ...CAR_KINDS.flatMap((k) => PICKS[k].map((c, j) => ({ name: j ? `Ô tô ${CAR_NAMES[k]} (${COLOR_NAMES[c]})` : `Ô tô ${CAR_NAMES[k]}`, make: () => makeCar(CAR_COLORS[c], k) }))),
    { name: 'Xe máy + người lái', make: () => makeScooter(0xe2574c, makePerson(LOOKS[3], 'none', adultShape(4))) },
    { name: 'Xe máy giao hàng (shipper)', make: makeShipperBike },
    { name: 'Minibus du lịch', make: () => makeMinibus().g },
    { name: 'Máy cày', make: () => makeTractor().g },
    {
      name: 'Máy cày + bác nông dân',
      make: () => {
        const { g } = makeTractor();
        const farmer = makePerson(LOOKS[2], 'straw', FARMER_SHAPE);
        farmer.position.y = 0.5;
        g.add(farmer);
        return g;
      },
    },
  ];
  const street: Entry[] = [
    { name: 'Xe hủ tiếu gõ chú Tư', make: () => streetVendor('cart', 9) },
    { name: 'Gánh bánh tráng trộn', make: () => streetVendor('pole', 12) },
    { name: 'Xe đạp cà phê dạo', make: () => streetVendor('bike', 15) },
    { name: 'Tiệm 25caaaaa', make: teaKiosk },
    { name: 'Bàn nhựa + 4 ghế đẩu (trước Tiệm 25caaaaa)', make: () => makePlasticSet(0xe2574c, 0x3f7fd9).g },
    { name: 'Trạm xe buýt', make: () => makeBusShelter().g },
    { name: 'Xe buýt 25 (mở cửa)', make: () => { const b = makeCityBus(); b.setDoors(1); return b.g; } },
    { name: 'Biển LED quảng cáo', note: 'Quảng cáo ở src/data/ads.ts', make: () => { const b = makeBillboard(); b.g.userData.tick = (t: number) => b.update(t, 0.3); return b.g; } },
  ];
  // Quán Ốc: bàn ốc của bếp trưởng (dài ra theo hạng bếp) + bếp nướng than của bếp phó — lửa động qua userData.tick
  const ticking = <T extends { g: THREE.Group }>(o: T, tick: (t: number) => void): THREE.Group => ((o.g.userData.tick = tick), o.g);
  const snail: Entry[] = [
    { name: 'Bàn ốc + bếp ga (Bếp nhỏ)', make: () => { const t = makeSnailTable(1); return ticking(t, (s) => t.update(s)); } },
    { name: 'Bàn ốc nối dài (Bếp đôi trở lên)', make: () => { const t = makeSnailTable(2); return ticking(t, (s) => t.update(s)); } },
    { name: 'Bếp nướng than (bếp phó)', make: () => { const k = makeCharcoalGrill(); return ticking(k, (s) => k.update(s, 0.5, 0)); } },
  ];
  const farm: Entry[] = [
    { name: 'Cối xay gió', make: () => makeWindmill().g },
    { name: 'Nhà xay lúa (guồng nước)', make: () => makeRiceMill(toon(0x7fd3f0)).g },
    { name: 'Nhà kính', make: () => makeGreenhouse(6, 4, 1.5).g },
    { name: 'Kiện rơm', make: () => (((g) => (hayBale(g, 0, 0), g))(group(null))) },
    { name: 'Cây xanh', make: () => makeTree(group(null), {}) },
    { name: 'Bụi cây', make: () => makeBush(group(null), {}) },
    { name: 'Cột đèn', make: () => (((g) => (makeLampPost(g, {}), g))(group(null))) },
    { name: 'Thùng hàng', make: () => makeCrate(group(null), {}) },
  ];
  const festive: Entry[] = [
    { name: 'Cành mai (Tết)', make: () => makeMai(group(null), [0, 0, 0]) },
    { name: 'Cây thông Noel', make: () => makeXmasTree(group(null), [0, 0, 0]) },
    { name: 'Người tuyết (Giáng sinh)', make: () => makeSnowman(group(null), [0, 0, 0]) },
    { name: 'Lồng đèn ông sao (Trung thu)', make: () => makeStarLantern(group(null), [0, 0, 0], 0xe2574c) },
  ];
  const equip = content.upgrades
    .all()
    .filter((u) => !['sign', 'irrigation'].includes(u.id))
    .map((u) => ({ name: `${u.icon} ${u.name}`, note: 'Trang thiết bị', make: () => equipment(u.id) }));
  return [
    { title: 'Mặt tiền quán (màn chọn quán)', entries: CUISINES.map((c) => ({ name: cuName(c), make: () => makeShopfront(c).g })) },
    { title: 'Bàn & ghế theo quán', desc: 'Màu theo bộ bàn ghế mặc định của từng quán; mua nội thất khác thì đổi màu.', entries: tables },
    { title: 'Đồ trang trí (Siêu thị)', entries: content.props.all().map((p) => ({ name: p.name, note: p.cuisine ? cuName(p.cuisine) : undefined, emoji: p.icon, make: () => makeProp(p.model ?? '', p.icon) })) },
    { title: 'Trang thiết bị trong quán', desc: 'Biển hiệu đèn LED (viền đèn quanh biển tên) và Hệ thống tưới (ở nông trại) không có model riêng.', entries: equip },
    { title: 'Xe cộ', entries: vehicles },
    { title: 'Bếp Quán Ốc', desc: 'Bàn ốc dài thêm khi nâng hạng bếp (chỗ cho đầu bếp thứ 3); bếp nướng có lưỡi lửa và tàn lửa bay.', entries: snail },
    { title: 'Hàng rong, Tiệm 25caaaaa, trạm xe buýt, biển LED (chợ)', desc: 'Trong chợ có thêm bảng tên và món bày (emoji) theo thực đơn của từng hàng.', entries: street },
    { title: 'Nông trại & cảnh vật', entries: farm },
    { title: 'Trang trí ngày lễ', entries: festive },
  ];
}

/** Món trên đĩa trắng như lúc bày ra bàn. */
function plated(recipeId: string): THREE.Group | null {
  const food = makeDish(recipeId);
  if (!food) return null;
  const g = group(null);
  mesh(g, G.cyl(0.2, 0.14, 0.04, 14), 0xffffff, { p: [0, 0.02, 0] });
  food.position.y = 0.04;
  g.add(food);
  return g;
}

/** Ba giai đoạn lớn (mầm → đang lớn → chín) xếp cạnh nhau. */
function stages(make: (s: 0 | 1 | 2) => THREE.Object3D, gap: number): THREE.Group {
  const g = group(null);
  ([0, 1, 2] as const).forEach((s) => {
    const o = make(s);
    o.position.x = (s - 1) * gap;
    g.add(o);
  });
  return g;
}

function foodSections(): Section[] {
  const dishes: Section[] = CUISINES.map((c) => ({
    title: `Món ăn · ${cuName(c)}`,
    entries: content.recipes
      .all()
      .filter((r) => r.cuisine === c)
      .map((r) => ({ name: r.name, emoji: r.icon, make: makeDish(r.id) ? () => plated(r.id)! : undefined })),
  }));
  const crops: Entry[] = [];
  const animals: Entry[] = [];
  for (const p of content.producers.all()) {
    const yields = p.yields.map((y) => content.items.get(y.item).name).join(', ');
    if (makeAnimals(p.id)) {
      animals.push({
        name: p.name,
        note: `ra ${yields}`,
        make: () => {
          const g = group(null);
          makeAnimals(p.id)!.forEach((a, i, all) => {
            a.position.x = (i - (all.length - 1) / 2) * 0.7;
            g.add(a);
          });
          return g;
        },
      });
    } else if (p.slot === 'orchard') crops.push({ name: p.name, note: `mầm → lớn → ra quả · ${yields}`, make: () => stages((s) => makeFruitTree(p.id, s), 2.4) });
    else if (p.slot === 'wheat' || p.slot === 'paddy') crops.push({ name: p.name, note: `ruộng: mạ → xanh → chín · ${yields}`, make: () => stages((s) => grainField(null as unknown as THREE.Object3D, 2, p.slot === 'wheat' ? 'wheat' : 'rice', s), 2.3) });
    else if (hasCropModel(p.id)) crops.push({ name: p.name, note: `mầm → lớn → chín · ${yields}`, make: () => stages((s) => makeCrop(p.id, s), 0.55) });
    else (p.slot === 'pond' || p.slot === 'pen' ? animals : crops).push({ name: p.name, note: `ra ${yields} · trong game hiện bằng icon`, emoji: p.icon });
  }
  return [
    ...dishes,
    { title: 'Cây trồng (nguồn nguyên liệu)', desc: 'Mỗi thẻ là 3 giai đoạn lớn trên ô đất.', entries: crops },
    { title: 'Vật nuôi (nguồn nguyên liệu)', entries: animals },
    {
      title: 'Nguyên liệu trong kho',
      desc: 'Model nguyên liệu (src/ui/three/ingredients.ts): bày trên khay / rổ hàng trong quầy chợ. Kho và quầy line vẫn hiện biểu tượng.',
      entries: content.items.all().map((i) => ({ name: i.name, emoji: i.icon, make: makeIngredient(i.id) ? () => makeIngredient(i.id)! : undefined })),
    },
  ];
}

const PAGES: Record<Page, { title: string; sections: () => Section[] }> = {
  'nhan-vat': { title: 'Nhân vật', sections: peopleSections },
  'do-vat': { title: 'Đồ vật, bàn ghế, xe cộ, trang trí', sections: thingSections },
  'mon-an': { title: 'Món ăn & nguyên liệu', sections: foodSections },
};

// ---------- Ánh sáng dùng chung ----------

function lightUp(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x9a8a70, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 9, 6);
  scene.add(sun);
}

/** Đặt camera nhìn chéo 3/4 từ trên xuống, vừa khít khung vật thể. */
function frame(camera: THREE.PerspectiveCamera, obj: THREE.Object3D, pad = 1.15): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(0.2, size.length() / 2);
  const dist = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * pad;
  const dir = new THREE.Vector3(0.55, 0.42, 1).normalize();
  camera.position.copy(center).addScaledVector(dir, dist);
  camera.near = dist / 50;
  camera.far = dist * 10;
  camera.updateProjectionMatrix();
  camera.lookAt(center);
  return center;
}

// ---------- Ảnh nhỏ ----------

const THUMB = 220;
const thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
thumbRenderer.setPixelRatio(1);
thumbRenderer.setSize(THUMB * 2, THUMB * 2, false);
const thumbScene = new THREE.Scene();
lightUp(thumbScene);
const thumbCam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);

/** Người ngồi trên xe (xe máy, máy cày): ngồi + hai tay nắm tay lái. Người bán hàng rong làm động tác riêng (gõ, trộn). */
function animateRiders(obj: THREE.Object3D, t: number): void {
  (obj.userData.tick as ((t: number) => void) | undefined)?.(t);
  obj.traverse((o) => {
    if (o === obj || !o.userData.rig) return;
    if (o.userData.cartKind) animateCartVendor(o as THREE.Group, t, 0);
    else animatePerson(o as THREE.Group, t, { sit: true, ride: true });
  });
}

/** Tiệm 25caaaaa như ngoài chợ: tiệm + biển logo + cô bán sau quầy (không có bảng tên / emoji món). */
function teaKiosk(): THREE.Group {
  const k = makeTeaKiosk();
  logoBoard(k.g, k.logo.p, k.logo.w);
  const v = makePerson(LOOKS[4], 'none', adultShape(4));
  v.position.set(...k.vendorAt);
  v.scale.setScalar(1.2);
  k.g.add(v);
  for (const b of k.bulbs) b.emissiveIntensity = 1.2;
  return k.g;
}

/** Hàng rong vỉa hè chợ + người bán (như trong cảnh chợ, không có bảng tên / emoji món). */
function streetVendor(kind: StreetKind, look: number): THREE.Group {
  const cart = makeStreetCart(kind);
  const v = makePerson(LOOKS[look % LOOKS.length], cart.hat, adultShape(look));
  v.position.set(...cart.vendorAt);
  v.scale.setScalar(1.15);
  equipCartVendor(kind, v);
  cart.g.add(v);
  return cart.g;
}

function snapshot(make: () => THREE.Object3D): string {
  const obj = make();
  thumbScene.add(obj);
  if (obj.userData.rig) animatePerson(obj as THREE.Group, 0.4, {});
  else animateRiders(obj, 0.4);
  obj.updateMatrixWorld(true);
  frame(thumbCam, obj);
  thumbRenderer.render(thumbScene, thumbCam);
  const url = thumbRenderer.domElement.toDataURL('image/png');
  thumbScene.remove(obj);
  return url;
}

// ---------- Trang ----------

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const sections = PAGES[page].sections();
const all: Entry[] = sections.flatMap((s) => s.entries);
const modelCount = all.filter((e) => e.make).length;
document.title = `Model 3D · ${PAGES[page].title}`;

const app = document.getElementById('app')!;
app.innerHTML = `
  <header>
    <div class="title"><h1>🧊 Model 3D — ${esc(PAGES[page].title)}</h1>
      <p>${modelCount} model · bấm thẻ để xem to, kéo để xoay, lăn chuột để phóng to. Dựng trực tiếp từ code game.</p></div>
    <nav>${(Object.keys(PAGES) as Page[]).map((p) => `<a href="./models-${p}.html"${p === page ? ' class="on"' : ''}>${esc(PAGES[p].title)}</a>`).join('')}<a href="${import.meta.env.DEV ? '/notes/so-tay-quan-nha-vuon.html' : './so-tay.html'}">📖 Sổ tay</a></nav>
    <input id="q" type="search" placeholder="Tìm tên…" autocomplete="off">
  </header>
  <main>${sections
    .map(
      (s, si) => `<section><h2>${esc(s.title)} <small>${s.entries.length}</small></h2>${s.desc ? `<p class="desc">${esc(s.desc)}</p>` : ''}
      <div class="grid">${s.entries
        .map(
          (e, ei) => `<button class="card${e.make ? '' : ' flat'}" data-i="${si}:${ei}" data-name="${esc(e.name.toLowerCase())}"${e.make ? '' : ' disabled'}>
            <div class="pic">${e.make ? '<i class="spin"></i>' : `<span class="emoji">${e.emoji ?? '❔'}</span><em>chưa có model</em>`}</div>
            <b>${esc(e.name)}</b>${e.note ? `<span class="note">${esc(e.note)}</span>` : ''}</button>`,
        )
        .join('')}</div></section>`,
    )
    .join('')}</main>
  <div id="viewer" hidden><div class="box"><div class="bar"><b id="vname"></b><span id="vpose"></span><button id="vclose">✕</button></div><canvas id="vc"></canvas></div></div>`;

// Chụp ảnh nhỏ dần dần để trang không đứng hình
const queue = [...app.querySelectorAll<HTMLButtonElement>('.card:not(.flat)')];
const pick = (key: string) => {
  const [si, ei] = key.split(':').map(Number);
  return sections[si].entries[ei];
};
(function pump() {
  const t0 = performance.now();
  while (queue.length && performance.now() - t0 < 30) {
    const card = queue.shift()!;
    try {
      const img = new Image();
      img.src = snapshot(pick(card.dataset.i!).make!);
      card.querySelector('.pic')!.replaceChildren(img);
    } catch (err) {
      card.querySelector('.pic')!.innerHTML = '<em>lỗi dựng model</em>';
      console.error(card.dataset.name, err);
    }
  }
  if (queue.length) setTimeout(pump, 0);
})();

// Tìm kiếm
const q = document.getElementById('q') as HTMLInputElement;
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
q.addEventListener('input', () => {
  const term = fold(q.value.trim().toLowerCase());
  for (const c of app.querySelectorAll<HTMLElement>('.card')) c.hidden = !!term && !fold(c.dataset.name!).includes(term);
  for (const s of app.querySelectorAll<HTMLElement>('section')) s.hidden = ![...s.querySelectorAll<HTMLElement>('.card')].some((c) => !c.hidden);
});

// ---------- Xem to ----------

const viewer = document.getElementById('viewer')!;
const vc = document.getElementById('vc') as HTMLCanvasElement;
const vRenderer = new THREE.WebGLRenderer({ canvas: vc, antialias: true });
vRenderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
vRenderer.shadowMap.enabled = true;
const vScene = new THREE.Scene();
vScene.background = new THREE.Color(0xf6ecd9);
lightUp(vScene);
const vSun = vScene.children.find((o) => o instanceof THREE.DirectionalLight) as THREE.DirectionalLight;
vSun.castShadow = true;
vSun.shadow.mapSize.set(1024, 1024);
const floor = mesh(vScene, G.cyl(1, 1, 0.04, 48), 0xe8c99a, { p: [0, -0.02, 0], cast: false, receive: true });
const vCam = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
const controls = new OrbitControls(vCam, vc);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.4;
let current: THREE.Object3D | null = null;
let pose: Pose = {};
const POSES: [string, Pose][] = [
  ['Đứng', {}],
  ['Đi', { walk: 1 }],
  ['Ngồi', { sit: true }],
  ['Vẫy tay', { wave: 1 }],
  ['Nấu', { cook: 1 }],
];

function open(e: Entry): void {
  if (current) vScene.remove(current);
  current = e.make!();
  // ?goc=90: xoay vật đi 90° quanh trục đứng (xem góc ngang / sau qua link, khỏi kéo chuột)
  const goc = Number(new URLSearchParams(location.search).get('goc'));
  if (goc) current.rotation.y = THREE.MathUtils.degToRad(goc);
  current.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  vScene.add(current);
  current.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(current);
  const r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.75 + 0.3;
  floor.scale.set(r, 1, r);
  floor.position.y = box.min.y - 0.02;
  const center = frame(vCam, current, 1.35);
  controls.target.copy(center);
  controls.update();
  document.getElementById('vname')!.textContent = e.name;
  pose = {};
  const person = !!current.userData.rig;
  document.getElementById('vpose')!.innerHTML = person ? POSES.map(([label], i) => `<button data-pose="${i}"${i ? '' : ' class="on"'}>${label}</button>`).join('') : '';
  viewer.hidden = false;
  resize();
}

document.getElementById('vpose')!.addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-pose]');
  if (!b) return;
  pose = POSES[Number(b.dataset.pose)][1];
  for (const x of b.parentElement!.children) x.classList.toggle('on', x === b);
});
app.addEventListener('click', (ev) => {
  const card = (ev.target as HTMLElement).closest<HTMLButtonElement>('.card:not(.flat)');
  if (card) open(pick(card.dataset.i!));
});
const close = () => (viewer.hidden = true);
document.getElementById('vclose')!.addEventListener('click', close);
viewer.addEventListener('click', (ev) => ev.target === viewer && close());
addEventListener('keydown', (ev) => ev.key === 'Escape' && close());

// ?xem=<tên model> mở thẳng model đó (gửi link cho nhau, vd ?xem=Quán Việt · bàn đôi)
const want = new URLSearchParams(location.search).get('xem');
const wanted = want && app.querySelector<HTMLElement>(`.card:not(.flat)[data-name="${CSS.escape(want.trim().toLowerCase())}"]`);
if (wanted) open(pick(wanted.dataset.i!));

function resize(): void {
  const w = vc.clientWidth;
  const h = vc.clientHeight;
  if (!w || !h) return;
  vRenderer.setSize(w, h, false);
  vCam.aspect = w / h;
  vCam.updateProjectionMatrix();
}
addEventListener('resize', resize);

const clock = new THREE.Clock();
vRenderer.setAnimationLoop(() => {
  if (viewer.hidden || !current) return;
  const t = clock.getElapsedTime();
  controls.update();
  if (current.userData.rig) animatePerson(current as THREE.Group, t, pose);
  else {
    current.traverse((o) => o.userData.eyes && animateCreature(o, t, 0));
    animateRiders(current, t);
  }
  vRenderer.render(vScene, vCam);
});
