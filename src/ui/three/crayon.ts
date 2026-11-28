import * as THREE from 'three';

/**
 * PHONG CÁCH MÀU SÁP (nét vẽ tay) cho toàn bộ cảnh 3D: giống tranh tô bằng bút sáp trên giấy.
 * - Vân sáp: mọi vật liệu toon (tạo qua `toon()` / `toonRim()` hoặc gọi `crayonize`) phủ thêm những nét tô ngắn chéo
 *   và hạt giấy lộ ra. Vân lấy theo toạ độ thế giới (chiếu 3 mặt) nên mesh gộp / dời / xoay vẫn liền vân.
 * - Viền lem: một lượt hậu kỳ (`CrayonPass`) dò mép vật từ bộ đệm độ sâu rồi tô nét nâu sẫm; độ dày nét lượn to nhỏ
 *   và lệch nhẹ theo vị trí trên màn hình nên trông như tô tay hơi lem. Vẽ được cả mép ngoài lẫn nếp gấp (mép bàn, cạnh hộp).
 * Bật / tắt trong Cài đặt (lưu theo máy, mặc định bật) - tắt thì vân về 0 và bỏ lượt hậu kỳ, không cần tải lại trang.
 * Không dùng file ảnh ngoài: vân sáp vẽ bằng canvas lúc chạy.
 */

const PREF_KEY = 'quan-nha-vuon/crayon';
/** Độ đậm vân sáp khi bật; cỡ ô vân (m trên mỗi ô lặp). */
const GRAIN = { strength: 0.42, tile: 0.7 };

let enabled = true;
try {
  enabled = localStorage.getItem(PREF_KEY) !== '0';
} catch {
  /* không có localStorage: giữ mặc định */
}

/** Uniform dùng chung cho mọi vật liệu (cùng một object nên đổi một chỗ là cả cảnh đổi theo). */
const grainUniform: { value: THREE.Texture | null } = { value: null };
const strengthUniform = { value: enabled ? GRAIN.strength : 0 };

export function crayonEnabled(): boolean {
  return enabled;
}

export function setCrayon(on: boolean): void {
  enabled = on;
  strengthUniform.value = on ? GRAIN.strength : 0;
  try {
    localStorage.setItem(PREF_KEY, on ? '1' : '0');
  } catch {
    /* bỏ qua */
  }
}

/** Ô vân sáp lặp được (xám: 0.5 = giữ màu, sáng hơn = lộ giấy, tối hơn = sáp đè dày). */
function crayonGrain(): THREE.Texture {
  const N = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const c = canvas.getContext('2d')!;
  c.fillStyle = 'rgb(128,128,128)';
  c.fillRect(0, 0, N, N);
  let s = 1234567;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // Vẽ lặp 3x3 để nét tràn mép nối liền khi lát gạch
  const tiled = (draw: (ox: number, oy: number) => void) => {
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) draw(ox, oy);
  };
  // Nét tô sáp: vệt ngắn chéo cùng hướng, đậm nhạt xen kẽ
  for (let i = 0; i < 520; i++) {
    const x = rnd() * N;
    const y = rnd() * N;
    const len = 10 + rnd() * 26;
    const a = -0.85 + (rnd() - 0.5) * 0.35;
    const dark = rnd() < 0.5;
    const alpha = 0.05 + rnd() * 0.09;
    const w = 1 + rnd() * 2.2;
    tiled((ox, oy) => {
      c.strokeStyle = dark ? `rgba(40,30,20,${alpha})` : `rgba(255,250,240,${alpha * 1.2})`;
      c.lineWidth = w;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x + ox, y + oy);
      c.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
      c.stroke();
    });
  }
  // Hạt giấy: chấm sáng nhỏ chỗ sáp không bám
  for (let i = 0; i < 1400; i++) {
    const r = 0.5 + rnd() * 1.1;
    c.fillStyle = `rgba(255,252,244,${0.18 + rnd() * 0.3})`;
    c.fillRect(rnd() * N, rnd() * N, r, r);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/**
 * Thêm vân sáp vào một vật liệu toon. `extra`: chỉnh shader thêm (vd viền sáng của toonRim), `key`: phân biệt chương
 * trình shader của các biến thể. Vật liệu trong suốt (kính, màng nhà kính) thì bỏ qua.
 */
export function crayonize<M extends THREE.Material>(mat: M, key = '', extra?: (shader: THREE.WebGLProgramParametersWithUniforms) => void): M {
  if (mat.transparent) {
    if (extra) {
      mat.onBeforeCompile = extra;
      mat.customProgramCacheKey = () => key;
    }
    return mat;
  }
  mat.onBeforeCompile = (shader) => {
    grainUniform.value ??= crayonGrain();
    shader.uniforms.crayonGrain = grainUniform;
    shader.uniforms.crayonK = strengthUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCrWorld;\nvarying vec3 vCrNormal;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        {
          vec4 crP = vec4(transformed, 1.0);
          vec3 crN = objectNormal;
          #ifdef USE_INSTANCING
            crP = instanceMatrix * crP;
            crN = mat3(instanceMatrix) * crN;
          #endif
          vCrWorld = (modelMatrix * crP).xyz;
          vCrNormal = mat3(modelMatrix) * crN;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D crayonGrain;\nuniform float crayonK;\nvarying vec3 vCrWorld;\nvarying vec3 vCrNormal;')
      .replace(
        '#include <opaque_fragment>',
        `if (crayonK > 0.0) {
          // Chiếu 3 mặt theo toạ độ thế giới: mặt nào quay về trục nào thì lấy vân theo mặt phẳng đó
          vec3 bw = pow(abs(normalize(vCrNormal)), vec3(4.0));
          bw /= (bw.x + bw.y + bw.z);
          vec3 p = vCrWorld / ${GRAIN.tile.toFixed(3)};
          float g = texture2D(crayonGrain, p.zy).r * bw.x + texture2D(crayonGrain, p.xz).r * bw.y + texture2D(crayonGrain, p.xy).r * bw.z;
          float k = (g - 0.5) * crayonK * 2.0;
          // Sáng hơn: pha về màu giấy kem; tối hơn: sáp đè dày, đậm màu
          outgoingLight = k > 0.0 ? mix(outgoingLight, vec3(1.0, 0.97, 0.9), k) : outgoingLight * (1.0 + k * 0.45);
        }
        #include <opaque_fragment>`,
      );
    extra?.(shader);
  };
  mat.customProgramCacheKey = () => `crayon${key}`;
  return mat;
}

/**
 * Lớp vẽ riêng cho đồ "luôn nổi trên cùng" (vật liệu tắt depthTest: bong bóng gọi món, bong bóng thoại, thanh kiên nhẫn,
 * chữ nổi). Chúng không ghi độ sâu nên lượt viền sẽ vẽ nét của đồ phía sau đè lên - vì vậy tách ra vẽ sau lượt viền.
 * Raycaster của stage bật mọi lớp nên bấm chọn vẫn như cũ.
 */
export const OVERLAY_LAYER = 1;
function markOverlays(scene: THREE.Scene): void {
  scene.traverseVisible((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m || Array.isArray(m) || m.depthTest) return;
    if (!o.layers.isEnabled(OVERLAY_LAYER) || o.layers.isEnabled(0)) o.layers.set(OVERLAY_LAYER);
  });
}

/** Độ dày nét viền trung bình (điểm ảnh CSS). */
const LINE_PX = 0.72;

/**
 * Lượt hậu kỳ vẽ viền lem: vẽ cảnh vào khung tạm (kèm độ sâu), rồi vẽ ra màn hình với nét viền ở chỗ độ sâu gãy.
 * Dò mép bằng toán tử Laplace trên 1/độ sâu: mặt phẳng nào cũng cho 0 (kể cả sàn nhìn nghiêng), chỉ mép ngoài và nếp
 * gấp mới ra nét - không bị vệt nét giả trên nền nhà.
 */
export class CrayonPass {
  private target: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;
  private size = new THREE.Vector2();

  constructor(private renderer: THREE.WebGLRenderer) {
    this.target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1) });
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        texel: { value: new THREE.Vector2() },
        px: { value: LINE_PX },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 100 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        #include <packing>
        uniform sampler2D tColor;
        uniform sampler2D tDepth;
        uniform vec2 texel;
        uniform float px;
        uniform float cameraNear;
        uniform float cameraFar;
        varying vec2 vUv;
        float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float invZ(vec2 uv) {
          float d = texture2D(tDepth, uv).x;
          return 1.0 / max(1e-4, -perspectiveDepthToViewZ(d, cameraNear, cameraFar));
        }
        void main() {
          vec4 col = texture2D(tColor, vUv);
          // Toạ độ điểm ảnh (CSS) để nhiễu không đổi theo độ phân giải màn hình
          vec2 sp = vUv / texel / (px / ${LINE_PX.toFixed(2)});
          float wob = 0.45 + 1.0 * noise(sp / 46.0) + 0.45 * noise(sp / 9.0);
          vec2 jit = (vec2(noise(sp / 31.0 + 7.3), noise(sp / 31.0 - 4.1)) - 0.5) * px * 1.1 * texel;
          vec2 c = vUv + jit;
          vec2 r = px * wob * texel;
          float w0 = invZ(c);
          float lap = abs(invZ(c + vec2(r.x, 0.0)) + invZ(c - vec2(r.x, 0.0)) + invZ(c + vec2(0.0, r.y)) + invZ(c - vec2(0.0, r.y)) - 4.0 * w0) / w0;
          float e = smoothstep(0.006, 0.02, lap);
          // Mực nâu sẫm pha chút màu của chính vật (giống bút sáp màu đậm hơn tô viền)
          vec3 ink = mix(vec3(0.035, 0.018, 0.009), col.rgb * 0.22, 0.3);
          col.rgb = mix(col.rgb, ink, e * 0.66);
          gl_FragColor = vec4(col.rgb, 1.0);
          #include <colorspace_fragment>
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  /** Vẽ cảnh (bật nét vẽ tay thì qua lượt viền, tắt thì vẽ thẳng như cũ). */
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    const r = this.renderer;
    markOverlays(scene);
    if (!enabled) {
      camera.layers.enable(OVERLAY_LAYER);
      r.render(scene, camera);
      camera.layers.disable(OVERLAY_LAYER);
      return;
    }
    r.getDrawingBufferSize(this.size);
    if (this.target.width !== this.size.x || this.target.height !== this.size.y) this.target.setSize(this.size.x, this.size.y);
    const u = this.mat.uniforms;
    u.texel.value.set(1 / this.size.x, 1 / this.size.y);
    u.px.value = LINE_PX * r.getPixelRatio();
    u.cameraNear.value = camera.near;
    u.cameraFar.value = camera.far;
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCam);
    // Lớp phủ (bong bóng, thanh kiên nhẫn, chữ nổi) vẽ sau cùng, đè lên cả nét viền
    const { autoClear } = r;
    const shadows = r.shadowMap.autoUpdate;
    const bg = scene.background;
    r.autoClear = false;
    r.shadowMap.autoUpdate = false;
    scene.background = null;
    camera.layers.set(OVERLAY_LAYER);
    r.render(scene, camera);
    camera.layers.set(0);
    scene.background = bg;
    r.shadowMap.autoUpdate = shadows;
    r.autoClear = autoClear;
  }

  dispose(): void {
    this.target.dispose();
    this.mat.dispose();
    this.quad.geometry.dispose();
  }
}
