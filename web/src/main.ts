// 标题用思源宋体（用户 09-17 定用 npm 字体包）。只引 700 这一档；包里按字频切成 101 片、各带 unicode-range，
// 浏览器只下页面上用到的字所在的那几片（现在的文案是 8 片、约 315 KB）。
// 101 条 @font-face 的样式表自己就有 55 KB（压缩后），所以在下面动态引入（fontStyles），不挡首屏样式。
import * as THREE from 'three';
import { Foreground } from './page/foreground';
import { Page } from './page/page';
import { Renderer } from './render/renderer';
import { loadTuanzi } from './tuanzi';
import { Atmosphere, type TimeSlot, type Weather } from './yard/atmosphere';
import { PlaceholderCat, Walker, applyCatGlow, type YardCat } from './yard/cat';
import { PLACE_ORDER } from './yard/layout';
import { Rig } from './yard/rig';
import { World } from './yard/world';

/**
 * 首页：院子 + 整页。网址参数（截图和调试用）：
 *   ?debug=1            调试面板
 *   ?shot=N             直接停在第 N 个机位（0 首屏，1–6 六处地点，7 结尾），团子直接放到那一处
 *   ?time=dawn|day|dusk|evening|night   ?weather=clear|rain
 *   ?cat=placeholder    不读真团子，用占位体
 *   ?blur=0             关掉控件的背景模糊（对比帧率）
 *   ?post=0             关掉后处理（泛光、暗角、颗粒），直接画
 *   ?driver=timer       用定时器驱动而不是 rAF：预览窗格在后台时 rAF 不触发，截图验收用
 *   ?reduce=1           当作开了「减少动态效果」；?nogl=1 当作 WebGL 起不来（两样都是为了能实测兜底）
 */
const fontStyles = import('@fontsource/noto-serif-sc/700.css');
const params = new URLSearchParams(location.search);
const SLOTS: TimeSlot[] = ['dawn', 'day', 'dusk', 'evening', 'night'];

async function boot() {
  const atmosphere = new Atmosphere();
  const time = params.get('time') as TimeSlot | null;
  const weather = (params.get('weather') === 'rain' ? 'rain' : 'clear') as Weather;
  atmosphere.choose(time && SLOTS.includes(time) ? time : null, weather, true);

  let rig: Rig | null = null;
  let walker: Walker | null = null;
  const page = new Page({
    atmosphere,
    onProgress: (progress) => rig && (rig.progress = progress),
    onPlace: (id) => walker?.goTo(id),
    onPointer: (x, y) => rig?.pointer.set(x, y),
  });
  // 超过 4 秒强制揭开
  const forced = setTimeout(() => page.reveal(), 4000);
  const foreground = new Foreground(page.reduced);

  let renderer: Renderer;
  try {
    if (params.has('nogl')) throw new Error('nogl');
    renderer = new Renderer(document.getElementById('gl') as HTMLCanvasElement, params.get('post') !== '0', params.has('debug'));
  } catch {
    clearTimeout(forced);
    page.fallback();
    return;
  }

  // 建场景拆成几步，每步之间让出一帧，进度线按步数走
  const world = new World();
  rig = new Rig();
  rig.reduced = page.reduced;
  let cat: YardCat | null = null;
  const steps: (() => Promise<unknown> | void)[] = [
    // 标题字体等一下，最多 1.5 秒，免得预载幕一揭开标题先用系统宋体闪一下再换
    () => Promise.race([
      fontStyles.then(() => document.fonts.load('700 40px "Noto Serif SC"', '团子住在这个院子里')).catch(() => null),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]),
    () => world.loadProps('/models/yard.glb'),
    async () => {
      cat = params.get('cat') === 'placeholder' ? null : await loadTuanzi('/models/tuanzi.glb').catch(() => null);
      cat ??= new PlaceholderCat();
    },
    () => {
      world.scene.add(cat!.root);
      walker = new Walker(cat!);
    },
    () => renderer.bind(world.scene, rig!.camera, (width, height) => rig!.resize(width, height)),
    () => renderer.gl.compile(world.scene, rig!.camera),
  ];
  for (let i = 0; i < steps.length; i++) {
    await steps[i]!();
    page.setLoading((i + 1) / steps.length);
    // 用定时器而不是 rAF 让出：标签页在后台时 rAF 不触发，预载会卡住
    await new Promise((resolve) => setTimeout(resolve, 16));
  }

  const shot = params.get('shot');
  if (shot !== null) {
    // 截图模式：文字和预载幕不做过渡，直接到位
    document.documentElement.classList.add('shot');
    const index = THREE.MathUtils.clamp(Number(shot) || 0, 0, rig.count - 1);
    page.reveal();
    setTimeout(() => {
      page.jump(index);
      rig!.snap(index);
      if (index >= 1 && index <= PLACE_ORDER.length) walker!.teleport(PLACE_ORDER[index - 1]!);
    }, 400);
  }

  const debug = params.get('debug') ? makeDebug(page, atmosphere, rig, world, renderer) : null;
  // 调试时把几个对象和验收工具挂到 window 上（动态加载，不进首页的包）
  if (params.get('debug')) {
    const { makeTools } = await import('./debug/tools');
    const handles = { rig, walker: walker!, cat: cat!, atmosphere, world, renderer };
    Object.assign(window, { __yard: { ...handles, ...makeTools(handles) } });
  }
  const pointerRay = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.12);
  const lookPoint = new THREE.Vector3();

  let previous = performance.now();
  let running = true;
  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - previous) / 1000);
    previous = now;

    atmosphere.update(dt);
    rig!.update(dt);
    walker!.update(rig!.camera, dt);
    cat!.update(dt);
    world.update(dt, atmosphere, rig!.camera, page.reduced);
    renderer.gl.toneMappingExposure = atmosphere.current.exposure;
    applyCatGlow(cat!, atmosphere.current.catGlow);

    // 团子看光标：指针射到离地 12 厘米的平面上
    if (!page.reduced) {
      pointerRay.setFromCamera(rig!.pointer, rig!.camera);
      cat!.lookAt(pointerRay.ray.intersectPlane(groundPlane, lookPoint) ? lookPoint : null);
    }

    page.setStatus(walker!.nearest, atmosphere.slotShown, atmosphere.weather);
    page.setTone(atmosphere.dark);
    foreground.activate(Math.round(rig!.progress));
    foreground.tint(atmosphere.current);
    page.update(dt);
    renderer.render(world.scene, rig!.camera, now / 1000);
    debug?.(renderer, world);
    schedule();
  };
  const timerDriven = params.get('driver') === 'timer';
  const schedule = () => (timerDriven ? setTimeout(() => frame(performance.now()), 16) : requestAnimationFrame(frame));
  // 标签页不可见时停渲染
  document.addEventListener('visibilitychange', () => {
    if (timerDriven) return;
    running = !document.hidden;
    if (running) {
      previous = performance.now();
      schedule();
    }
  });
  schedule();

  clearTimeout(forced);
  // 首屏可交互的时刻（判据：本地构建产物 ≤ 3 秒）。用 performance.getEntriesByName('yard-ready') 读
  performance.mark('yard-ready');
  page.reveal();
}

function makeDebug(page: Page, atmosphere: Atmosphere, rig: Rig, world: World, renderer: Renderer) {
  const panel = document.getElementById('debug')!;
  panel.hidden = false;
  panel.innerHTML = `
    <div id="debug-stats"></div>
    <label>小时 <span id="debug-hour-value">现在</span><input id="debug-hour" type="range" min="0" max="24" step="0.1" value="12" /></label>
    <div class="row" id="debug-shots"></div>`;
  const stats = panel.querySelector<HTMLElement>('#debug-stats')!;
  const hour = panel.querySelector<HTMLInputElement>('#debug-hour')!;
  const hourValue = panel.querySelector<HTMLElement>('#debug-hour-value')!;
  hour.addEventListener('input', () => {
    atmosphere.hourOverride = Number(hour.value);
    atmosphere.choose(null, atmosphere.weather, true);
    page.refreshDock();
    hourValue.textContent = Number(hour.value).toFixed(1);
  });
  const shots = panel.querySelector<HTMLElement>('#debug-shots')!;
  for (let i = 0; i < rig.count; i++) {
    const button = document.createElement('button');
    button.textContent = String(i);
    button.addEventListener('click', () => page.jump(i));
    shots.append(button);
  }
  let last = 0;
  return (r: Renderer, w: World) => {
    const now = performance.now();
    if (now - last < 500) return;
    last = now;
    const info = r.gl.info.render;
    stats.textContent = `${r.fps.toFixed(0)} fps · 分辨率 ${r.scale.toFixed(2)} · ${info.calls} 次绘制 · ${(info.triangles / 1000).toFixed(0)}k 面 · 机位 ${rig.smooth.toFixed(2)}`;
    void w;
    void world;
  };
}

void boot();
