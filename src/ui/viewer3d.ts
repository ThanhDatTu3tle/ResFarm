import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CrayonPass } from './three/crayon';
import { frame, lightUp } from './three/showcase';
import { G, mesh } from './three/toon';
import { esc } from './dom';

/**
 * HỘP XEM 3D ("Xem chi tiết" ở Siêu thị): popup có canvas riêng, model tự xoay, kéo chuột / vuốt để xoay, lăn để phóng to.
 * Renderer dựng một lần lúc mở lần đầu; đóng thì ngừng vẽ và gỡ model khỏi cảnh.
 */

interface Viewer {
  root: HTMLDivElement;
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  pass: CrayonPass;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  stand: THREE.Mesh;
  current: THREE.Object3D | null;
}

let v: Viewer | null = null;

const CSS = `
.v3d{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(40,28,16,.45)}
.v3d[hidden]{display:none}
.v3d .box{width:min(640px,94vw);height:min(560px,82vh);display:flex;flex-direction:column;background:#fff8ec;border:3px solid #e07a3f;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.v3d .v3d-head{display:flex;align-items:center;gap:14px;padding:12px 12px 12px 18px;border-bottom:2px solid #f0dcc0;flex:none}
.v3d .v3d-head b{flex:1;min-width:0;font-size:18px;line-height:1.25;overflow:hidden;text-overflow:ellipsis}
.v3d .v3d-head small{display:block;font-weight:500;color:#8a7258;font-size:12px;margin-top:2px}
.v3d .v3d-head .v3d-x{flex:none;width:36px;height:36px;padding:0;margin:0;border-radius:50%;border:2px solid #e0b98a;background:#fff;color:#7a4a24;font-size:16px;font-weight:700;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:none}
.v3d .v3d-head .v3d-x:hover{background:#e07a3f;border-color:#e07a3f;color:#fff}
.v3d canvas{flex:1;width:100%;min-height:0;display:block;touch-action:none;cursor:grab}
.v3d .hint{padding:6px 14px 10px;font-size:12px;color:#8a7258;text-align:center}
`;

function ensure(): Viewer {
  if (v) return v;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = 'v3d';
  root.hidden = true;
  root.innerHTML = `<div class="box"><div class="v3d-head"><b></b><button class="v3d-x" data-v3d-close aria-label="Đóng">✕</button></div><canvas></canvas><div class="hint">Kéo để xoay · lăn chuột / chụm 2 ngón để phóng to</div></div>`;
  document.body.appendChild(root);
  const canvas = root.querySelector('canvas')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  const pass = new CrayonPass(renderer);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf6ecd9);
  lightUp(scene);
  const sun = scene.children.find((o) => o instanceof THREE.DirectionalLight) as THREE.DirectionalLight;
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const stand = mesh(scene, G.cyl(1, 1, 0.04, 48), 0xe8c99a, { p: [0, -0.02, 0], cast: false, receive: true });
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.4;
  controls.enablePan = false;
  v = { root, canvas, renderer, pass, scene, camera, controls, stand, current: null };
  const close = () => closeViewer();
  root.querySelector('[data-v3d-close]')!.addEventListener('click', close);
  root.addEventListener('click', (ev) => ev.target === root && close());
  addEventListener('keydown', (ev) => ev.key === 'Escape' && !root.hidden && close());
  addEventListener('resize', () => !root.hidden && fit());
  return v;
}

function fit(): void {
  if (!v) return;
  const w = v.canvas.clientWidth;
  const h = v.canvas.clientHeight;
  if (!w || !h) return;
  v.renderer.setSize(w, h, false);
  v.camera.aspect = w / h;
  v.camera.updateProjectionMatrix();
}

/** Mở popup xem 3D: `title` (in đậm), `sub` (dòng phụ), `make` dựng model. */
export function openViewer(title: string, sub: string, make: () => THREE.Object3D): void {
  const x = ensure();
  if (x.current) x.scene.remove(x.current);
  const obj = make();
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  x.scene.add(obj);
  x.current = obj;
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.75 + 0.3;
  x.stand.scale.set(r, 1, r);
  x.stand.position.y = box.min.y - 0.02;
  x.root.querySelector('.v3d-head b')!.innerHTML = `${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
  x.root.hidden = false;
  fit();
  x.controls.target.copy(frame(x.camera, obj, 1.2));
  x.controls.update();
  x.renderer.setAnimationLoop(() => {
    x.controls.update();
    x.pass.render(x.scene, x.camera);
  });
}

export function closeViewer(): void {
  if (!v) return;
  v.root.hidden = true;
  v.renderer.setAnimationLoop(null);
  if (v.current) v.scene.remove(v.current);
  v.current = null;
}
