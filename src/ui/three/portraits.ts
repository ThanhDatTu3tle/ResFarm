import * as THREE from 'three';
import type { RegularDef } from '../../data';
import { makeRegular } from './people';

/**
 * Chân dung khách quen render từ chính model 3D (dùng trong bảng Khách quen và thông báo "… ghé quán").
 * Một renderer nhỏ dùng chung, vẽ một lần mỗi khách rồi cache thành ảnh data URL.
 */
const SIZE = 160;
const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);

function setup(): { renderer: THREE.WebGLRenderer; scene: THREE.Scene } {
  if (!renderer || !scene) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9c9a0, 2.2));
    const sun = new THREE.DirectionalLight(0xfff2d6, 2.2);
    sun.position.set(2, 4, 5);
    scene.add(sun);
  }
  return { renderer, scene };
}

/** Ảnh chân dung (data URL) của khách quen; rỗng nếu trình duyệt không có WebGL. */
export function portraitOf(def: RegularDef): string {
  const hit = cache.get(def.id);
  if (hit != null) return hit;
  let url = '';
  try {
    const { renderer, scene } = setup();
    const person = makeRegular(def.style);
    scene.add(person);
    // Khung hình nửa người trên, theo chiều cao thật của model (trẻ em thấp hơn)
    const box = new THREE.Box3().setFromObject(person);
    const top = box.max.y;
    const headY = top - 0.32 * person.scale.y;
    // Cận mặt: đầu chiếm gần hết khung, thấy được tóc + phụ kiện trên đầu và vai
    const d = 1.05 + 0.25 * person.scale.y;
    camera.position.set(0.3, headY + 0.08, d);
    camera.lookAt(0, headY - 0.06, 0);
    renderer.render(scene, camera);
    url = renderer.domElement.toDataURL('image/png');
    scene.remove(person);
  } catch {
    url = '';
  }
  cache.set(def.id, url);
  return url;
}

/** Thẻ <img> chân dung, hoặc emoji khi không render được. */
export function portraitHtml(def: RegularDef, cls = 'portrait'): string {
  const url = portraitOf(def);
  return url ? `<img class="${cls}" src="${url}" alt="">` : `<span class="${cls} emoji">${def.icon}</span>`;
}
