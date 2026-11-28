import * as THREE from 'three';
import { guideHtml } from './tutorial';
import type { Content, CuisineId } from '../data';
import { esc } from './dom';
import { animatePerson, makeBush, makeTree } from './three/models';
import { makeShopfront, shopkeeper } from './three/cuisine';
import { G, group, mesh, seeded } from './three/toon';
import { CrayonPass } from './three/crayon';
import { makeOwner } from './three/people';
import { cleanOwner, DEFAULT_OWNER, DEFAULT_SHOP_NAME, OWNER_AGE, OWNER_HAIRS, OWNER_NAME_MAX, OWNER_OUTFITS, type OwnerProfile } from '../sim/state';

/**
 * MÀN HÌNH MỞ ĐẦU - logo + "Chơi tiếp" (khi có save hợp lệ) + "Ván mới".
 * Ván mới → chọn phong cách quán: 4 mặt tiền quán Nhật / Hàn / Việt / Ốc dựng 3D trên một con phố nhỏ,
 * mỗi quán một thẻ giới thiệu. Bấm thẻ (hoặc bấm vào quán) để xem gần, bấm "Chọn quán này" → chọn ông / bà chủ
 * (giới tính + tuổi 25..50, xem trước 3D đứng trước quán) → "Mở quán" để bắt đầu.
 * Có save mà chọn Ván mới thì hỏi lại trước khi xoá.
 * Cảnh 3D ở đây dùng renderer riêng và được huỷ hết trước khi game chạy (onStart).
 */

const SHOP_X: Record<CuisineId, number> = { jp: -12, kr: -4, vn: 4, oc: 12 };
const ORDER: CuisineId[] = ['jp', 'kr', 'vn', 'oc'];

type Step = 'menu' | 'pick' | 'owner' | 'confirm';

/** Mô tả theo tuổi cho thẻ chọn chủ quán. */
function ageLabel(age: number): string {
  return age < 30 ? 'Trẻ trung, năng nổ' : age < 40 ? 'Chững chạc, từng trải' : age < 46 ? 'Vững vàng, chín chắn' : 'Có tuổi, hiền hậu';
}

/** Cờ vẽ bằng SVG (Windows không hiển thị emoji cờ). */
const FLAGS: Record<CuisineId, string> = {
  jp: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/></svg>',
  kr: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><path d="M10 10a5 5 0 0 1 10 0z" fill="#cd2e3a"/><path d="M10 10a5 5 0 0 0 10 0z" fill="#0047a0"/><g stroke="#000" stroke-width="1.2"><path d="M3 4l3-2M4 5.5l3-2M5 7l3-2M22 2l3 2M21 3.5l3 2M20 5l3 2M3 16l3 2M4 14.5l3 2M5 13l3 2M22 18l3-2M21 16.5l3-2M20 15l3-2"/></g></svg>',
  vn: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#da251d"/><path d="M15 4l1.76 5.4h5.68l-4.6 3.34 1.76 5.4L15 14.8l-4.6 3.34 1.76-5.4-4.6-3.34h5.68z" fill="#ff0"/></svg>',
  // Quán ốc: không phải cờ nước - huy hiệu vỏ ốc trên nền dù sọc
  oc: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#faf3e6"/><path d="M0 0h5v20H0zM10 0h5v20h-5zM20 0h5v20h-5z" fill="#e2473c"/><circle cx="15" cy="10" r="7" fill="#fff6e0" stroke="#c9762c" stroke-width="1.4"/><path d="M15 4.5a5.5 5.5 0 0 1 0 11a3.6 3.6 0 0 1 0-7.2a2 2 0 0 1 0 4" fill="none" stroke="#c9762c" stroke-width="1.3"/></svg>',
};

export function showTitle(root: HTMLElement, content: Content, opts: { hasSave: boolean; onStart: (cuisine: CuisineId | null, owner?: OwnerProfile, shopName?: string) => void }): void {
  root.innerHTML = `<div id="title">
    <canvas id="title-scene"></canvas>
    <div class="title-ui"></div>
  </div>`;
  const canvas = root.querySelector<HTMLCanvasElement>('#title-scene')!;
  const uiEl = root.querySelector<HTMLElement>('.title-ui')!;

  // ---------- Cảnh 3D ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const pass = new CrayonPass(renderer);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe6ff);
  scene.fog = new THREE.Fog(0xbfe6ff, 30, 60);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9c9a0, 1.9));
  const sun = new THREE.DirectionalLight(0xfff2d6, 2.5);
  sun.position.set(-8, 16, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -8 });
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

  const rnd = seeded(5);
  mesh(scene, G.box(80, 0.4, 60), 0x8fd16a, { p: [0, -0.2, 0], cast: false });
  mesh(scene, G.box(60, 0.05, 3.2), 0x9aa0a8, { p: [0, 0.02, 4.4], cast: false }); // đường phố
  for (let x = -28; x <= 28; x += 2.4) mesh(scene, G.box(1.1, 0.06, 0.12), 0xf6f1e4, { p: [x, 0.04, 4.4], cast: false }); // vạch kẻ
  mesh(scene, G.box(60, 0.12, 1.4), 0xd8d2c6, { p: [0, 0.06, 2.3], cast: false }); // vỉa hè
  for (const x of [-12, -4, 4, 12]) makeTree(scene, { p: [x, 0, -2.6 + rnd()], s: 1.2 + rnd() * 0.4 }, rnd() > 0.5 ? 0x5fae57 : 0x4f9e4a);
  for (let x = -26; x <= 26; x += 3.4) makeTree(scene, { p: [x + rnd(), 0, -9 - rnd() * 3], s: 1.2 + rnd() * 0.6 });
  for (let i = 0; i < 8; i++) makeBush(scene, { p: [-16 + rnd() * 32, 0, 6.8 + rnd() * 1.5], s: 0.8 + rnd() * 0.5 });
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 6; i++) {
    const c = group(scene, { p: [-30 + i * 11, 12 + rnd() * 3, -20 - rnd() * 6] });
    for (let k = 0; k < 3; k++) mesh(c, G.sphere(1.4 + rnd(), 10, 8), 0xffffff, { p: [k * 1.6 - 1.6, rnd() * 0.5, 0], cast: false });
    clouds.push(c);
  }

  const shops = ORDER.map((id) => {
    const { g, glows } = makeShopfront(id);
    const holder = group(scene, { p: [SHOP_X[id], 0, 0] });
    holder.add(g);
    g.traverse((o) => (o.userData.pickCuisine = id));
    const keeper = shopkeeper(id);
    // Quán Việt có bàn inox bên trái cửa: chủ quán đứng bên phải cho khỏi xuyên qua bàn
    const right = id === 'vn';
    keeper.position.set(right ? 1.3 : -1.2, 0.2, 1.4);
    keeper.rotation.y = right ? -0.2 : 0.2;
    holder.add(keeper);
    return { id, holder, g, glows, keeper, focusAt: -99 };
  });

  // Ông / bà chủ xem trước: đứng trước quán đang chọn (chỉ hiện ở bước chọn chủ quán)
  let owner: OwnerProfile = { ...DEFAULT_OWNER };
  let ownerModel: THREE.Group | null = null;
  const ownerHolder = group(scene);
  const rebuildOwner = () => {
    if (ownerModel) ownerHolder.remove(ownerModel);
    ownerModel = makeOwner(owner);
    ownerModel.scale.setScalar(1.5);
    ownerHolder.add(ownerModel);
  };
  rebuildOwner();
  /** Đã qua bước chọn chủ quán (hộp hỏi xoá ván cũ hiện trên bước đó). */
  let pickedOwner = false;
  /** Tên quán đặt ở bước chọn quán (trống = tên mặc định). */
  let shopName = '';

  // ---------- Trạng thái + giao diện ----------
  let step: Step = 'menu';
  let focus: CuisineId = 'vn';
  /** Trang hướng dẫn đang mở (null = đóng). */
  let guide: number | null = null;
  // ?pick=oc: mở thẳng bước chọn quán (quay về từ màn xem trước - "Chọn quán khác"; bản dev dùng để chụp giao diện)
  // ?choose=oc: quay về từ xem trước - "Chọn quán này": sang luôn bước chọn chủ quán
  const query = new URLSearchParams(location.search);
  const pick = query.get('pick');
  if (pick && content.cuisines.has(pick)) [step, focus] = ['pick', pick as CuisineId];
  const choose = query.get('choose');
  if (choose && content.cuisines.has(choose)) [step, focus, pickedOwner] = ['owner', choose as CuisineId, true];
  // Bỏ tham số khỏi thanh địa chỉ (tải lại trang thì về màn đầu như thường)
  if (!import.meta.env.DEV && (pick || choose)) history.replaceState(null, '', location.pathname);
  // Chỉ bản dev: ?owner=f35 mở thẳng bước chọn chủ quán (m / f + tuổi; kèm ?pick=oc để chọn quán)
  const devOwner = import.meta.env.DEV ? new URLSearchParams(location.search).get('owner') : null;
  if (devOwner) {
    const [ga, hair, outfit, name] = devOwner.split('-');
    owner = cleanOwner({ gender: ga.startsWith('f') ? 'female' : 'male', age: Number(ga.slice(1)) || 30, hair, outfit, name });
    rebuildOwner();
    step = 'owner';
    pickedOwner = true;
  }
  // Chỉ bản dev: ?guide=2 mở sẵn trang hướng dẫn số 2 (đếm từ 0)
  const devGuide = import.meta.env.DEV ? new URLSearchParams(location.search).get('guide') : null;
  if (devGuide != null) guide = Number(devGuide) || 0;
  const camPos = new THREE.Vector3(0, 7, 21);
  const camLook = new THREE.Vector3(0, 2, 0);

  const card = (id: CuisineId) => {
    const c = content.cuisines.get(id);
    const dishes = c.showcase.map((r) => content.recipes.get(r));
    return `<button class="cuisine-card${focus === id ? ' on' : ''}" data-title="focus:${id}" style="--accent:${c.accent}">
      <div class="cc-head"><span class="flag">${FLAGS[id]}</span><b>${esc(c.name)}</b></div>
      <p>${esc(c.blurb)}</p>
      <div class="cc-dishes">${dishes.map((d) => `<span title="${esc(d.name)}">${d.icon}</span>`).join('')}</div>
    </button>`;
  };

  const render = () => {
    const c = content.cuisines.get(focus);
    uiEl.className = `title-ui step-${step}`;
    if (step === 'menu') {
      uiEl.innerHTML = `<div class="title-logo"><span class="logo-icon">🍲</span><h1>Quán Nhà Vườn</h1><p>Nấu ăn · làm vườn · đón khách</p></div>
        <div class="title-menu">
          ${opts.hasSave ? `<button class="primary big" data-title="continue">▶ Chơi tiếp</button>` : ''}
          <button class="${opts.hasSave ? '' : 'primary '}big" data-title="new">✨ Ván mới</button>
          <button class="big guide-btn" data-title="guide:0">📘 Hướng dẫn chơi</button>
          ${opts.hasSave ? '' : `<p class="muted">Tiến trình tự lưu trong trình duyệt này.</p>`}
        </div>
        ${guide != null ? guideHtml(guide, (a) => ` data-title="${a}"`, opts.hasSave ? 'Xong' : 'Mở quán thôi!') : ''}`;
    } else if (step === 'owner' || (step === 'confirm' && pickedOwner)) {
      const female = owner.gender === 'female';
      uiEl.innerHTML = `<div class="pick-head"><button class="mini" data-title="back" aria-label="Quay lại">←</button><h2>Chọn ${female ? 'bà' : 'ông'} chủ quán</h2></div>
        <div class="owner-card">
          <p class="muted">Bạn vào vai chủ ${esc(c.name)}: đi quanh quán, ra chợ, ra vườn trông coi mọi việc.</p>
          <div class="owner-gender">
            <button class="${female ? '' : 'on'}" data-title="gender:male">👨 Ông chủ</button>
            <button class="${female ? 'on' : ''}" data-title="gender:female">👩 Bà chủ</button>
          </div>
          <label class="owner-name"><span>Tên</span>
            <input type="text" maxlength="${OWNER_NAME_MAX}" value="${esc(owner.name)}" placeholder="${female ? 'Bà chủ' : 'Ông chủ'}" data-name-input autocomplete="off" enterkeyhint="done">
          </label>
          <label class="owner-age"><span>Tuổi <b data-age>${owner.age}</b> · <em data-age-label>${ageLabel(owner.age)}</em></span>
            <input type="range" min="${OWNER_AGE.min}" max="${OWNER_AGE.max}" step="1" value="${owner.age}" data-age-input>
            <span class="owner-age-marks"><i>25</i><i>35</i><i>50</i></span>
          </label>
          <div class="owner-pick"><span>Kiểu tóc</span><div class="owner-chips">${OWNER_HAIRS.filter((h) => h.for.includes(owner.gender)).map((h) => `<button class="chip${owner.hair === h.id ? ' on' : ''}" data-title="hair:${h.id}">${esc(h.name)}</button>`).join('')}</div></div>
          <div class="owner-pick"><span>Quần áo</span><div class="owner-chips">${OWNER_OUTFITS.filter((o) => o.for.includes(owner.gender)).map((o) => `<button class="chip${owner.outfit === o.id ? ' on' : ''}" data-title="outfit:${o.id}">${esc(o.name)}</button>`).join('')}</div></div>
        </div>
        <div class="pick-foot"><span class="muted">Mỗi ván mới chọn lại được.</span>
          <button class="primary big" data-title="start" style="--accent:${c.accent}"><span class="flag">${FLAGS[focus]}</span> Mở ${esc(c.name)}</button></div>
        ${step === 'confirm' ? confirmHtml(c.name) : ''}`;
    } else {
      uiEl.innerHTML = `<div class="pick-head"><button class="mini" data-title="back" aria-label="Quay lại">←</button><h2>Chọn phong cách quán</h2></div>
        <div class="cuisine-cards">${ORDER.map(card).join('')}</div>
        <div class="pick-foot"><label class="owner-name shop-name-field"><span>🏠 Tên quán</span>
            <input type="text" maxlength="24" value="${esc(shopName)}" placeholder="${esc(DEFAULT_SHOP_NAME)}" data-shop-input autocomplete="off" enterkeyhint="done"></label>
          <button class="big preview-btn" data-title="preview" title="Vào xem thử bên trong quán đang có khách">👀 Xem trước</button>
          <button class="primary big" data-title="owner" style="--accent:${c.accent}"><span class="flag">${FLAGS[focus]}</span> Chọn ${esc(c.name)} →</button></div>`;
    }
  };
  const confirmHtml = (name: string) => `<div class="backdrop"><div class="dialog"><h2>Bắt đầu ván mới?</h2>
          <p>Ván đang chơi trên trình duyệt này sẽ bị <b>xoá</b> và không lấy lại được.</p>
          <div class="dialog-foot"><button data-title="cancel">Giữ ván cũ</button><button class="danger" data-title="confirm">Xoá và mở ${esc(name)}</button></div></div></div>`;

  // Kéo thanh tuổi: đổi model + nhãn ngay, không vẽ lại cả bảng (để kéo mượt)
  uiEl.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    // Gõ tên: giữ nguyên chữ đang gõ (cắt khoảng trắng lúc mở quán)
    if (el.matches('[data-shop-input]')) {
      shopName = el.value.slice(0, 24);
      return;
    }
    if (el.matches('[data-name-input]')) {
      owner = { ...owner, name: el.value.slice(0, OWNER_NAME_MAX) };
      return;
    }
    if (!el.matches('[data-age-input]')) return;
    owner = cleanOwner({ ...owner, age: Number(el.value) });
    uiEl.querySelector('[data-age]')!.textContent = String(owner.age);
    uiEl.querySelector('[data-age-label]')!.textContent = ageLabel(owner.age);
    rebuildOwner();
  });

  const setFocus = (id: CuisineId) => {
    if (focus === id && step !== 'menu') return;
    focus = id;
    shops.find((s) => s.id === id)!.focusAt = clock.elapsedTime;
    render();
  };

  uiEl.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-title]');
    if (!el) return;
    const [action, arg] = el.dataset.title!.split(':');
    if (action === 'continue') return finish(null);
    // Xem trước quán đang chọn: mở ván tạm của quán đó (không đụng tới save)
    if (action === 'preview') {
      location.href = `${location.pathname}?preview=${focus}`;
      return;
    }
    if (action === 'gender' || action === 'hair' || action === 'outfit') {
      // Đổi giới tính: kiểu tóc / quần áo của giới kia về "Theo tuổi" / "Mặc định" (giữ nguyên tên đang gõ)
      owner = action === 'gender' ? { ...cleanOwner({ ...owner, gender: arg as OwnerProfile['gender'] }), name: owner.name } : { ...owner, [action]: arg };
      rebuildOwner();
      ownerHop = clock.elapsedTime;
      // Vẽ lại bảng nhưng giữ chỗ đang cuộn trong thẻ (thẻ dài trên màn hình thấp)
      const scroll = uiEl.querySelector('.owner-card')?.scrollTop ?? 0;
      render();
      const card = uiEl.querySelector('.owner-card');
      if (card) card.scrollTop = scroll;
      return;
    }
    if (action === 'owner') {
      step = 'owner';
      pickedOwner = true;
      ownerHop = clock.elapsedTime;
      return render();
    }
    if (action === 'guide') {
      // Trang cuối bấm "Mở quán thôi!" (chưa có ván) thì sang bước chọn quán luôn
      const done = arg === 'close';
      guide = done ? null : Number(arg) || 0;
      if (done && !opts.hasSave && el.classList.contains('primary')) step = 'pick';
      return render();
    }
    if (action === 'new') {
      step = 'pick';
      shops.find((s) => s.id === focus)!.focusAt = clock.elapsedTime;
    } else if (action === 'back') {
      step = step === 'owner' ? 'pick' : 'menu';
      pickedOwner = false;
    }
    else if (action === 'focus') return setFocus(arg as CuisineId);
    else if (action === 'start') {
      if (opts.hasSave) step = 'confirm';
      else return finish(focus);
    } else if (action === 'cancel') step = 'owner';
    else if (action === 'confirm') return finish(focus);
    render();
  });

  // Bấm thẳng vào quán trong cảnh 3D cũng chọn quán đó
  const ray = new THREE.Raycaster();
  canvas.addEventListener('pointerup', (e) => {
    if (step === 'confirm' || step === 'owner') return;
    const rect = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(shops.map((s) => s.g), true)[0];
    const id = hit?.object.userData.pickCuisine as CuisineId | undefined;
    if (!id) return;
    if (step === 'menu') step = 'pick';
    focus = id;
    shops.find((s) => s.id === id)!.focusAt = clock.elapsedTime;
    render();
  });

  // ---------- Vòng lặp ----------
  const clock = new THREE.Clock();
  let ownerHop = -99;
  let raf = 0;
  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Màn hình hẹp (điện thoại dọc / ngang thấp): lùi camera cho vừa 3 quán
    camera.fov = w / h < 1.2 ? 52 : 38;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const frame = () => {
    const dt = Math.min(0.1, clock.getDelta());
    const t = clock.elapsedTime;
    // Menu: nhìn cả phố, đung đưa nhẹ. Chọn quán: lại gần quán đang chọn, hơi lệch lên để chừa chỗ cho thẻ phía dưới
    const narrow = camera.aspect < 1.2;
    // Chọn chủ quán: lại sát người đứng trước quán, người lệch sang phải để chừa chỗ cho thẻ bên trái
    const owning = step === 'owner' || (step === 'confirm' && pickedOwner);
    const ox = SHOP_X[focus] + 1.4;
    const target = step === 'menu'
      ? new THREE.Vector3(Math.sin(t * 0.15) * 1.5, 8.5, narrow ? 44 : 34)
      : owning
        ? new THREE.Vector3(ox - 1.1, 2.1, narrow ? 8.2 : 6.6)
        : new THREE.Vector3(SHOP_X[focus], 4.6, narrow ? 17 : 13.5);
    const look = step === 'menu' ? new THREE.Vector3(0, 2.4, 0) : owning ? new THREE.Vector3(ox - 1.1, 1.25, 2.6) : new THREE.Vector3(SHOP_X[focus], 1.2, 0);
    camPos.lerp(target, Math.min(1, dt * 2.5));
    camLook.lerp(look, Math.min(1, dt * 3));
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    for (const s of shops) {
      const since = t - s.focusAt;
      const hop = since < 0.6 ? Math.sin((since / 0.6) * Math.PI) * 0.35 : 0;
      const chosen = step !== 'menu' && s.id === focus;
      s.holder.position.y = hop;
      s.holder.scale.setScalar(THREE.MathUtils.lerp(s.holder.scale.x, chosen ? 1.06 : 1, Math.min(1, dt * 6)));
      for (const m of s.glows) m.emissiveIntensity = (m.userData.glowBase ?? 0.3) + 0.25 + Math.sin(t * 3 + SHOP_X[s.id]) * 0.15;
      animatePerson(s.keeper, t, { wave: chosen || step === 'menu' ? Math.max(0, Math.sin(t * 0.9 + SHOP_X[s.id])) : 0 });
    }
    for (const c of clouds) c.position.x = ((c.position.x + dt * 0.6 + 35) % 70) - 35;
    ownerHolder.visible = owning;
    if (owning && ownerModel) {
      const since = t - ownerHop;
      ownerHolder.position.set(ox, since < 0.5 ? Math.sin((since / 0.5) * Math.PI) * 0.25 : 0, 2.9);
      ownerHolder.rotation.y = -0.25 + Math.sin(t * 0.6) * 0.08;
      animatePerson(ownerModel, t, { wave: Math.max(0, Math.sin(t * 0.8)) * 0.8 });
    }
    pass.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  render();
  raf = requestAnimationFrame(frame);

  function finish(cuisine: CuisineId | null): void {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    pass.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    opts.onStart(cuisine, cuisine ? cleanOwner(owner) : undefined, cuisine ? shopName.replace(/s+/g, ' ').trim() || undefined : undefined);
  }
}
