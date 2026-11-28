import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seasonBaseOf } from './toon';

/**
 * GỘP MESH TĨNH (tối ưu số lần vẽ): các mesh đứng yên trong một nhóm cảnh được gộp thành ít mesh - mỗi vật liệu
 * (cùng cờ đổ bóng / nhận bóng / màu gốc theo mùa) một mesh. Hình giữ nguyên, số lần vẽ giảm mạnh.
 *
 * Chỉ gọi trên nhóm CẢNH TĨNH mà không chỗ nào khác giữ tham chiếu tới từng mesh bên trong để cử động / ẩn hiện
 * (giữ tham chiếu tới VẬT LIỆU thì không sao: khối gộp dùng chung vật liệu, đổi màu / phát sáng vẫn ăn).
 * Nút "ranh giới" không gộp ra ngoài: nút có userData.sway (tán cây đung đưa - gộp bên trong tán), userData.pick
 * (vùng bấm - gộp bên trong nhóm đó, mesh tự là vùng bấm thì giữ nguyên), userData.keep (đánh dấu tay), sprite, đèn.
 * Người (nút có userData.rig - tay chân cử động) và nút userData.noMerge thì bỏ qua hẳn, không gộp gì bên trong.
 * Mesh đổi màu theo mùa (lá, cỏ) gộp riêng theo màu gốc và ghi userData.seasonBase để paintSeason vẫn tô được.
 * Trả về số mesh đã bỏ đi (để đo).
 */
export function mergeStatic(root: THREE.Object3D, foliage = true): number {
  root.updateMatrixWorld(true);
  return mergeUnder(root, foliage);
}

function isBoundary(o: THREE.Object3D): boolean {
  return o.userData.sway !== undefined || o.userData.pick !== undefined || o.userData.keep !== undefined;
}

/** Gộp các mesh tĩnh thuộc về nút `host` (không vượt qua nút ranh giới con - nút đó tự gộp phần của nó). */
function mergeUnder(host: THREE.Object3D, foliage: boolean): number {
  const meshes: THREE.Mesh[] = [];
  let removed = 0;
  const walk = (o: THREE.Object3D) => {
    for (const c of [...o.children]) {
      if (!c.visible) continue; // đang ẩn (bật lên lúc khác) thì để nguyên
      if (c.userData.rig || c.userData.noMerge) continue; // người: tay chân cử động
      if (isBoundary(c)) {
        removed += mergeUnder(c, foliage);
        continue;
      }
      if (c instanceof THREE.Mesh && !(c instanceof THREE.InstancedMesh) && !(c as THREE.SkinnedMesh).isSkinnedMesh && !Array.isArray(c.material) && c.geometry.attributes.position) meshes.push(c);
      if (!(c instanceof THREE.Light) && !(c instanceof THREE.Sprite)) walk(c);
    }
  };
  walk(host);
  // Mesh có con (vd bánh xe gắn vành) vẫn gộp được hình của chính nó; con được xét riêng ở trên
  const groups = new Map<string, THREE.Mesh[]>();
  for (const m of meshes) {
    const mat = m.material as THREE.Material;
    const season = seasonBaseOf(m, foliage);
    const key = `${mat.uuid}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}|${season ?? ''}|${m.renderOrder}`;
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }
  const inv = new THREE.Matrix4().copy(host.matrixWorld).invert();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos: THREE.BufferGeometry[] = [];
    // Chỉ giữ thuộc tính chung (vị trí, pháp tuyến, uv nếu tất cả đều có); không chỉ mục để gộp được mọi loại hình
    const withUv = list.every((m) => !!m.geometry.attributes.uv);
    for (const m of list) {
      const g = new THREE.BufferGeometry();
      const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
      g.setAttribute('position', src.attributes.position.clone());
      if (src.attributes.normal) g.setAttribute('normal', src.attributes.normal.clone());
      else {
        g.computeVertexNormals();
      }
      if (withUv) g.setAttribute('uv', src.attributes.uv.clone());
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      geos.push(g);
    }
    if (!geos.every((g) => !!g.attributes.normal)) continue;
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const first = list[0];
    const out = new THREE.Mesh(merged, first.material);
    out.castShadow = first.castShadow;
    out.receiveShadow = first.receiveShadow;
    out.renderOrder = first.renderOrder;
    const season = seasonBaseOf(first, foliage);
    if (season != null) out.userData.seasonBase = season;
    out.userData.merged = list.length;
    host.add(out);
    for (const m of list) {
      // Mesh còn con (không gộp cùng): giữ nút làm khung rỗng, chỉ bỏ hình của nó
      if (m.children.length) {
        const holder = new THREE.Object3D();
        holder.position.copy(m.position);
        holder.quaternion.copy(m.quaternion);
        holder.scale.copy(m.scale);
        for (const c of [...m.children]) holder.add(c);
        m.parent?.add(holder);
      }
      m.parent?.remove(m);
    }
    removed += list.length - 1;
  }
  return removed;
}

/**
 * Gộp các mesh gắn TRỰC TIẾP vào từng bộ phận cử động (thân, đầu, tay, chân của một người): cùng vật liệu thì gộp
 * (tóc nhiều mảnh, má hồng, phụ kiện…). Không đụng nhóm con (mắt chớp, khăn quàng, dù, chảo, đồ trên tay - những thứ
 * này được bật / tắt / thay giữa chừng) và không đụng mesh có con. Mesh trực tiếp của bộ phận nằm yên so với bộ phận đó
 * nên gộp vào chính bộ phận là đúng hình. Trả về số mesh đã bỏ đi.
 */
export function mergeParts(parts: THREE.Object3D[]): number {
  let removed = 0;
  for (const part of parts) {
    const groups = new Map<string, THREE.Mesh[]>();
    for (const c of part.children) {
      if (!(c instanceof THREE.Mesh) || c.children.length || !c.visible || Array.isArray(c.material) || c.userData.pick || c.userData.keep) continue;
      const key = `${(c.material as THREE.Material).uuid}|${c.castShadow ? 1 : 0}${c.receiveShadow ? 1 : 0}|${c.renderOrder}`;
      const list = groups.get(key) ?? [];
      list.push(c);
      groups.set(key, list);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const withUv = list.every((m) => !!m.geometry.attributes.uv);
      const geos: THREE.BufferGeometry[] = [];
      for (const m of list) {
        m.updateMatrix();
        const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
        if (!src.attributes.normal) break;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', src.attributes.position.clone());
        g.setAttribute('normal', src.attributes.normal.clone());
        if (withUv) g.setAttribute('uv', src.attributes.uv.clone());
        g.applyMatrix4(m.matrix);
        geos.push(g);
      }
      if (geos.length !== list.length) continue;
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      const first = list[0];
      const out = new THREE.Mesh(merged, first.material);
      out.castShadow = first.castShadow;
      out.receiveShadow = first.receiveShadow;
      out.renderOrder = first.renderOrder;
      part.add(out);
      for (const m of list) part.remove(m);
      removed += list.length - 1;
    }
  }
  return removed;
}

/**
 * Chạy hàm dựng `build` rồi gom mọi thứ nó vừa gắn vào `root` vào một nhóm mới (trong root) và gộp mesh nhóm đó.
 * Chỉ dùng cho phần dựng cảnh tĩnh - không chỗ nào giữ tham chiếu tới từng mesh để cử động / ẩn hiện.
 */
export function mergeAdded(root: THREE.Object3D, build: () => void, foliage = true): THREE.Group {
  const before = new Set(root.children);
  build();
  const g = new THREE.Group();
  for (const c of [...root.children]) if (!before.has(c)) g.add(c);
  root.add(g);
  mergeStatic(g, foliage);
  return g;
}
