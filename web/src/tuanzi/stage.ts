import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type ViewName = 'front' | 'side' | 'three-quarter' | 'free';

// 固定机位：方位角（绕 Y，0 = 正对猫脸，正值往猫的左侧转）与俯角，单位度。
// 与 assets/tuanzi-3d/build_tuanzi.py 的 VIEWS 一致；侧面让头朝右，和 R3 同向。
export const VIEWS: Record<Exclude<ViewName, 'free'>, { azimuth: number; elevation: number }> = {
  front: { azimuth: 0, elevation: 8 },
  side: { azimuth: -90, elevation: 0 },
  'three-quarter': { azimuth: 40, elevation: 14 },
};

// 帧率不够时降渲染分辨率，下限 0.75（方案第 6 节）
const MIN_SCALE = 0.75;
const TARGET_FPS = 55;
const FOCUS_HEIGHT = 0.18;
const VIEW_DISTANCE = 1.35;

/** 团子调试页自己的舞台：毛毡地面、天光、跟随团子的主光阴影。页面与院子的舞台在 web/src/stage.ts，归院子那边。 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  readonly controls: OrbitControls;
  readonly ground: THREE.Mesh;

  fps = 60;
  scale = 1;

  private readonly key: THREE.DirectionalLight;
  private readonly keyOffset = new THREE.Vector3(1.4, 2.4, 1.8);
  private frames = 0;
  private windowStart = performance.now();
  private fastWindows = 0;

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    // Neutral 保色相：同一盏主光下额头实测 (244,148,66)，R1 身体取样 (248,150,42)；
    // ACES 同条件发黄发灰 (226,161,77)，AgX 更淡 (213,164,120)
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(this.renderer.domElement);

    const cream = new THREE.Color('#efe5d3');
    this.scene.background = cream;
    this.scene.fog = new THREE.Fog(cream, 5, 14);

    // 天光补光 : 主光约 1 : 1.6，外加一盏冷色背光勾出轮廓
    this.scene.add(new THREE.HemisphereLight('#fff3df', '#a3ad8c', 1.5));
    this.key = new THREE.DirectionalLight('#fff0d8', 2.4);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    const camera = this.key.shadow.camera;
    camera.left = camera.bottom = -0.8;
    camera.right = camera.top = 0.8;
    camera.near = 0.5;
    camera.far = 6;
    this.key.shadow.radius = 6;
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.004;
    this.scene.add(this.key, this.key.target);
    const rim = new THREE.DirectionalLight('#e3ecff', 1.1);
    rim.position.set(-1.8, 1.4, -2.0);
    this.scene.add(rim);
    this.followShadow(new THREE.Vector3());

    this.ground = makeGround();
    this.scene.add(this.ground);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 0.4;
    this.controls.maxDistance = 6;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.set(0, FOCUS_HEIGHT, 0);

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  setView(view: ViewName, around = new THREE.Vector3(), facing = 0) {
    if (view === 'free') return;
    const { azimuth, elevation } = VIEWS[view];
    const az = THREE.MathUtils.degToRad(azimuth) + facing;
    const el = THREE.MathUtils.degToRad(elevation);
    const focus = new THREE.Vector3(around.x, FOCUS_HEIGHT, around.z);
    this.camera.position.set(
      focus.x + VIEW_DISTANCE * Math.cos(el) * Math.sin(az),
      focus.y + VIEW_DISTANCE * Math.sin(el),
      focus.z + VIEW_DISTANCE * Math.cos(el) * Math.cos(az),
    );
    this.controls.target.copy(focus);
    this.controls.update();
  }

  /** 镜头平移跟随，保持当前角度和距离 */
  follow(point: THREE.Vector3) {
    const delta = new THREE.Vector3(point.x - this.controls.target.x, 0, point.z - this.controls.target.z);
    this.controls.target.add(delta);
    this.camera.position.add(delta);
  }

  followShadow(point: THREE.Vector3) {
    this.key.target.position.set(point.x, 0, point.z);
    this.key.position.copy(this.key.target.position).add(this.keyOffset);
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.govern();
  }

  private resize() {
    const { innerWidth: w, innerHeight: h } = window;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * this.scale);
    this.renderer.setSize(w, h);
  }

  private govern() {
    this.frames++;
    const now = performance.now();
    const elapsed = now - this.windowStart;
    if (elapsed < 1000) return;
    this.fps = (this.frames * 1000) / elapsed;
    this.frames = 0;
    this.windowStart = now;
    if (document.hidden) return;
    if (this.fps < TARGET_FPS && this.scale > MIN_SCALE) {
      this.scale = Math.max(MIN_SCALE, this.scale - 0.05);
      this.fastWindows = 0;
      this.resize();
    } else if (this.fps > 58.5 && this.scale < 1) {
      if (++this.fastWindows >= 3) {
        this.scale = Math.min(1, this.scale + 0.05);
        this.fastWindows = 0;
        this.resize();
      }
    } else {
      this.fastWindows = 0;
    }
  }
}

/** 毛毡地面：暖草绿底，程序生成的短纤维纹理，完全哑光。 */
function makeGround() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b9c29a';
  ctx.fillRect(0, 0, size, size);
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const angle = rand() * Math.PI;
    const length = 3 + rand() * 9;
    ctx.strokeStyle = rand() > 0.5 ? `rgba(236,236,200,${0.08 + rand() * 0.12})` : `rgba(96,112,72,${0.06 + rand() * 0.1})`;
    ctx.lineWidth = 0.6 + rand() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  texture.anisotropy = 8;

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(12, 64),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}
