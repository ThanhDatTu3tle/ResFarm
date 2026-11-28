import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { regulars } from '../data/regulars';
import type { HairStyle, PersonBuild } from '../data';
import { animatePerson, FARMER_SHAPE, LOOKS, makePerson, type Pose } from '../ui/three/models';
import { makeRegular } from '../ui/three/people';
import { G, mesh } from '../ui/three/toon';

/**
 * Trang xem thử dàn nhân vật (chỉ bản dev): http://localhost:5184/lineup.html
 * Mọi dáng người × kiểu tóc, khách quen, đội quán; vài người đi tại chỗ, ngồi, vẫy tay để xem cử động.
 * Không nằm trong bản build (Vite chỉ build index.html).
 */

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3ead8);
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 6.5, 17);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.8, 0);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xfff4e0, 0x9a8a70, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(4, 9, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
sun.shadow.normalBias = 0.03;
scene.add(sun);
mesh(scene, G.box(24, 0.1, 14), 0xe8c99a, { p: [0, -0.05, 0], cast: false, receive: true });

interface Actor { g: THREE.Group; pose: (t: number) => Pose }
const actors: Actor[] = [];
const place = (g: THREE.Group, x: number, z: number, pose: (t: number) => Pose = () => ({})) => {
  g.position.set(x, 0, z);
  scene.add(g);
  actors.push({ g, pose });
};

// Hàng 1: mỗi dáng người vài kiểu tóc
const builds: [PersonBuild, HairStyle[]][] = [
  ['kid', ['short', 'twin', 'curly', 'bob']],
  ['teen', ['spiky', 'pony', 'side']],
  ['adult', ['short', 'long', 'bun', 'bob', 'curly']],
  ['elder', ['bald', 'bun', 'side']],
];
let x = -8.4;
let n = 0;
for (const [build, hairs] of builds) {
  for (const hair of hairs) {
    const look = { ...LOOKS[n % LOOKS.length], ...(build === 'elder' ? { hair: 0xdddddd } : {}) };
    const width = [0.88, 1.0, 1.28, 1.1, 0.92][n % 5];
    place(makePerson(look, 'none', { build, hair, width }), x, 2);
    x += build === 'kid' ? 0.75 : 1.0;
    n++;
  }
  x += 0.4;
}

// Hàng 2: cử động - đi tại chỗ, ngồi, vẫy, bưng, ăn, lau nhà, nấu
const moves: [string, (t: number) => Pose][] = [
  ['đi', () => ({ walk: 1 })],
  ['đi rồi dừng', (t) => ({ walk: Math.sin(t * 0.8) > 0 ? 1 : 0 })],
  ['ngồi / đứng', (t) => ({ sit: Math.sin(t * 0.6) > 0 })],
  ['vẫy', () => ({ wave: 1 })],
  ['bưng', () => ({ carry: true, walk: 1 })],
  ['ăn', () => ({ sit: true, eat: true })],
  ['lau nhà', () => ({ mop: 1 })],
  ['cuốc', () => ({ dig: 1 })],
];
moves.forEach(([, pose], i) => {
  const r = i % 3 === 2;
  const g = makePerson(LOOKS[(i * 3 + 2) % LOOKS.length], 'none', { build: r ? 'kid' : 'adult', hair: (['short', 'long', 'curly', 'pony'] as HairStyle[])[i % 4], width: 0.9 + (i % 3) * 0.17 });
  place(g, -6 + i * 1.6, 0, pose);
  if (i === 2 || i === 5) mesh(scene, G.box(0.5, 0.44, 0.5), 0xd9473f, { p: [g.position.x, 0.22, -0.25] }); // ghế
});

// Hàng 3: đội quán + khách quen
place(makePerson({ shirt: 0xffffff, hair: 0x3a2a1e, skin: 0xffd9b8 }, 'chef', { width: 1.2 }), -7, -2.2, () => ({ cook: 1 }));
place(makePerson({ shirt: 0xffffff, hair: 0x6b4a2f, skin: 0xf2c49b }, 'chef', { width: 0.95 }), -6, -2.2);
place(makePerson({ shirt: 0x3f8fd2, hair: 0x2a1f1a, skin: 0xffd9b8 }), -5, -2.2, () => ({ carry: true }));
place(makePerson(LOOKS[2], 'straw', FARMER_SHAPE), -4, -2.2, () => ({ dig: 1 }));
regulars.forEach((r, i) => place(makeRegular(r.style), -2.6 + i * 1.05, -2.2));

function resize(): void {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  for (const a of actors) animatePerson(a.g, t, a.pose(t));
  controls.update();
  renderer.render(scene, camera);
});
