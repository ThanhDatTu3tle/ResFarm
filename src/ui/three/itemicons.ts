import * as THREE from 'three';
import { makeIngredient } from './ingredients';

/**
 * Icon nguyên liệu chụp từ chính model 3D bày trên sạp chợ, để bảng giá / kho / thực đơn hiện đúng hình
 * người chơi thấy ngoài chợ (emoji hay khác hình, dễ mua nhầm). Một renderer nhỏ dùng chung, vẽ mỗi món
 * một lần rồi cache thành data URL. Món chưa có model (hoặc máy không có WebGL) thì giữ emoji.
 */
const SIZE = 128;
const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 10);

function setup(): { renderer: THREE.WebGLRenderer; scene: THREE.Scene } {
  if (!renderer || !scene) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9c9a0, 2.3));
    const sun = new THREE.DirectionalLight(0xfff2d6, 2.2);
    sun.position.set(2, 5, 4);
    scene.add(sun);
  }
  return { renderer, scene };
}

/** Ảnh (data URL) của nguyên liệu; rỗng nếu không có model hoặc không render được. */
export function itemIconUrl(id: string): string {
  const hit = cache.get(id);
  if (hit != null) return hit;
  let url = '';
  try {
    const m = makeIngredient(id);
    if (m) {
      const { renderer, scene } = setup();
      scene.add(m);
      // Nhìn chéo từ trên xuống như góc máy ngoài chợ, khung vừa khít model
      const box = new THREE.Box3().setFromObject(m);
      const c = box.getCenter(new THREE.Vector3());
      const r = box.getBoundingSphere(new THREE.Sphere()).radius;
      const d = (r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.02;
      const dir = new THREE.Vector3(0.35, 0.75, 1).normalize();
      camera.position.copy(c).addScaledVector(dir, d);
      camera.lookAt(c);
      renderer.render(scene, camera);
      url = outlined(renderer.domElement);
      scene.remove(m);
    }
  } catch {
    url = '';
  }
  cache.set(id, url);
  return url;
}

/** Icon nguyên liệu dạng HTML: <img> từ model 3D, hoặc emoji khi không có model. */
export function itemIcon(item: { id: string; icon: string; category?: string }): string {
  const url = itemIconUrl(item.id);
  return url ? `<img class="item-ico" data-cat="${item.category ?? ""}" src="${url}" alt="">` : item.icon;
}

/** Viền nâu đậm quanh hình (kiểu sticker): món trắng như bột mì, trứng, sữa vẫn nổi trên nền sáng. */
function outlined(src: HTMLCanvasElement): string {
  const pad = 6;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE + pad * 2;
  const g = c.getContext('2d')!;
  // Bóng hình tô một màu, đóng dấu lệch quanh 16 hướng = nét viền
  const sil = document.createElement('canvas');
  sil.width = sil.height = SIZE;
  const sg = sil.getContext('2d')!;
  sg.drawImage(src, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = '#4a3222';
  sg.fillRect(0, 0, SIZE, SIZE);
  const r = 4;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.drawImage(sil, pad + Math.cos(a) * r, pad + Math.sin(a) * r);
  }
  g.drawImage(src, pad, pad);
  return c.toDataURL('image/png');
}
