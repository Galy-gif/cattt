import * as THREE from 'three';
import { Renderer } from '../render/renderer';
import { loadTuanzi } from '../tuanzi';
import { Atmosphere, type TimeSlot, type Weather } from '../yard/atmosphere';
import { Walker, applyCatGlow } from '../yard/cat';
import { PLACE_ORDER, type PlaceId } from '../yard/layout';
import { World } from '../yard/world';
import { identity, inApp, post } from './bridge';
import { FramePacer, PerfRecorder } from './performance';
import { FollowCamera } from './follow';

// 参数由 Debug 实测页限定；与桌面共用资源，独立生命周期。
const params = new URLSearchParams(location.search);
const SLOTS: TimeSlot[] = ['dawn', 'day', 'dusk', 'evening', 'night'];
const slotValue = (value: unknown): TimeSlot | null => SLOTS.includes(value as TimeSlot) ? value as TimeSlot : null;
const placeValue = (value: unknown): PlaceId => {
  if (!PLACE_ORDER.includes(value as PlaceId)) throw new Error(`无效地点：${String(value)}`);
  return value as PlaceId;
};

async function boot() {
  const started = performance.now();
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const hud = document.getElementById('hud')!;
  hud.hidden = !params.has('debug');
  const atmosphere = new Atmosphere();
  atmosphere.choose(slotValue(params.get('time')), params.get('weather') === 'rain' ? 'rain' : 'clear', true);
  const renderer = new Renderer(canvas, params.get('post') !== '0', false, Number(params.get('msaa') ?? 2));
  renderer.maxRatio = Number(params.get('dpr') ?? 1.25);
  renderer.targetFps = params.get('fps') === '30' ? 30 : 60;
  renderer.bloomEnabled = params.get('bloom') !== '0';
  const world = new World(params.get('grass') === '0.5' ? 0.5 : 1);
  world.sunLight.shadow.mapSize.setScalar(Number(params.get('shadow') ?? 2048));
  if (!await world.loadProps('/models/yard.glb')) throw new Error('院子模型加载失败，本轮无效');
  const cat = await loadTuanzi(params.get('fault') === 'model-missing' ? '/models/missing.glb' : '/models/tuanzi.glb');
  if (!cat) throw new Error('团子模型加载失败，本轮无效');
  if (params.get('fuzz') === '0') cat.appearance.apply({ surface: 'felt', outline: false, fuzz: false });
  cat.appearance.setFuzzLayers(params.get('shells') === '2' ? 2 : 4);
  world.scene.add(cat.root);
  const walker = new Walker(cat);
  cat.lookAt(null);
  const follow = new FollowCamera();
  renderer.bind(world.scene, follow.camera, (width, height) => follow.resize(width, height));
  renderer.gl.info.autoReset = false;

  const recorder = new PerfRecorder();
  const pacer = new FramePacer(renderer.targetFps);
  const listeners = new AbortController();
  let walking = params.get('walk') === '1';
  let next = 1, restSeconds = 0;
  let initialized = false, appActive = !inApp(), contextOK = true, disposed = false;
  let raf = 0, running = false, previous: number | null = null;
  let firstFrame = false, frameIndex = 0, reportAt = 0;
  let contextTestTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingTouches: { at: number; frame: number }[] = [];
  let pointerId: number | null = null, lastX = 0;
  let restored = false;
  const snapshot = () => ({
    position: { x: cat.position.x, y: cat.position.y, z: cat.position.z }, facing: cat.facing,
    goal: walker.goal, arrived: walker.arrived, camera: follow.snapshot(),
    slot: atmosphere.slot, shownSlot: atmosphere.slotShown, weather: atmosphere.weather,
    walking, next, restSeconds,
  });
  type Snapshot = ReturnType<typeof snapshot>;
  function restore(s: Snapshot) {
    const goal = placeValue(s.goal);
    const numbers = [s.position.x, s.position.y, s.position.z, s.facing, s.camera.offset, ...s.camera.focus, ...s.camera.position];
    if (!numbers.every(Number.isFinite)) throw new Error('恢复快照坐标无效');
    cat!.restorePose(s.position, s.facing);
    walker.restore(goal, s.arrived);
    follow.restore(s.camera);
    // 先恢复离开时天色；自动时钟在后续更新继续跟随。
    atmosphere.choose(s.shownSlot, s.weather, true);
    atmosphere.slot = s.slot;
    walking = s.walking; next = s.next; restSeconds = s.restSeconds;
    restored = true;
  }
  const sendSnapshot = (type = 'snapshot') => post({ type, snapshot: snapshot() });

  function syncRunning(reason: string) {
    const shouldRun = initialized && appActive && !document.hidden && contextOK && !disposed;
    if (shouldRun === running) return;
    running = shouldRun;
    if (!running) {
      cancelAnimationFrame(raf); raf = 0;
      recorder.pause(performance.now(), reason);
      previous = null; pacer.reset(); pendingTouches = [];
      follow.dragging = false; pointerId = null;
      post({ type: 'paused', reason, snapshot: snapshot(), report: recorder.report() });
    } else {
      renderer.resetTiming(); previous = null; pacer.reset();
      post({ type: 'resumed', reason, snapshot: snapshot() });
      if (params.get('fault') !== 'no-first-frame') raf = requestAnimationFrame(frame);
    }
  }

  function frame(now: number) {
    raf = 0;
    if (!running || disposed) return;
    raf = requestAnimationFrame(frame);
    if (!pacer.due(now)) return;
    // 动画大步长仍限幅，性能统计保留完整前台间隔，两者不能混用。
    const dt = previous === null ? 0 : Math.min(0.05, (now - previous) / 1000);
    previous = now;
    atmosphere.update(dt);
    walker.update(follow.camera, dt);
    cat!.update(dt);
    follow.update(cat!.position, dt);
    frameIndex++;
    for (const touch of pendingTouches) recorder.touch(frameIndex - touch.frame, performance.now() - touch.at);
    pendingTouches = [];
    world.update(dt, atmosphere, follow.camera, false);
    renderer.gl.toneMappingExposure = atmosphere.current.exposure;
    applyCatGlow(cat!, atmosphere.current.catGlow);
    if (walking && walker.arrived) {
      restSeconds += dt;
      if (restSeconds >= 2) {
        restSeconds = 0;
        walker.goTo(PLACE_ORDER[next % PLACE_ORDER.length]!); next++;
      }
    }
    renderer.gl.info.reset();
    renderer.render(world.scene, follow.camera, now / 1000);
    const finished = performance.now();
    recorder.frame(finished, renderer.scale);
    if (!firstFrame) {
      firstFrame = true;
      post({ type: 'firstFrame', renderMs: finished - started, snapshot: snapshot() });
      if (restored) post({ type: 'restored', snapshot: snapshot() });
      // Debug 实测故障注入：真正丢失/重建 GL 上下文，走与系统丢失相同的事件链。
      if (params.get('fault') === 'context-loss') {
        const extension = renderer.gl.getContext().getExtension('WEBGL_lose_context');
        if (!extension) post({ type: 'error', message: '当前环境没有 WEBGL_lose_context，无法完成故障验证' });
        else contextTestTimer = setTimeout(() => {
          extension.loseContext();
          contextTestTimer = setTimeout(() => extension.restoreContext(), 500);
        }, 1500);
      }
    }
    if (finished - reportAt >= 1000) {
      reportAt = finished;
      const info = renderer.gl.info.render;
      post({ type: 'perf', report: recorder.report(), snapshot: snapshot(), fps: renderer.fps, scale: renderer.scale,
        calls: info.calls, triangles: info.triangles });
      if (!hud.hidden) hud.textContent = `${renderer.fps.toFixed(0)} fps · ×${renderer.scale.toFixed(2)} · ${walker.nearest}`;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearTimeout(contextTestTimer);
    syncRunning('dispose');
    listeners.abort();
    world.scene.traverse(object => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
        material.dispose();
      }
    });
    cat!.mixer.stopAllAction();
    renderer.dispose();
  }

  const eventOptions = { signal: listeners.signal };
  canvas.addEventListener('pointerdown', event => {
    if (!running) return;
    pointerId = event.pointerId; lastX = event.clientX; follow.dragging = true;
    canvas.setPointerCapture(event.pointerId);
  }, eventOptions);
  canvas.addEventListener('pointermove', event => {
    if (!running || event.pointerId !== pointerId) return;
    follow.offset -= ((event.clientX - lastX) / renderer.width) * follow.visibleWidth;
    lastX = event.clientX;
    pendingTouches.push({ at: performance.now(), frame: frameIndex });
  }, eventOptions);
  for (const name of ['pointerup', 'pointercancel'] as const) canvas.addEventListener(name, event => {
    if (event.pointerId === pointerId) { pointerId = null; follow.dragging = false; }
  }, eventOptions);
  document.addEventListener('visibilitychange', () => syncRunning('visibility'), eventOptions);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextOK = false;
    post({ type: 'contextLost', snapshot: snapshot() }); syncRunning('contextLost');
  }, eventOptions);
  canvas.addEventListener('webglcontextrestored', () => {
    contextOK = true; post({ type: 'contextRestored' }); syncRunning('contextRestored');
  }, eventOptions);
  addEventListener('pagehide', dispose, { once: true, signal: listeners.signal });

  window.__app = { command(json: string) {
    const message = JSON.parse(json) as Record<string, unknown>;
    if (message.runId !== identity.runId || message.pageId !== identity.pageId) return JSON.stringify({ error: 'stale' });
    switch (message.type) {
      case 'initialize':
        if (initialized) break;
        if (message.snapshot) restore(message.snapshot as Snapshot);
        appActive = message.active === true; initialized = true; syncRunning('initialize'); break;
      case 'active': appActive = message.on === true; syncRunning('native'); break;
      case 'snapshot': sendSnapshot(); return JSON.stringify(snapshot());
      case 'report': return JSON.stringify(recorder.report());
      case 'dispose': dispose(); break;
      case 'atmosphere': atmosphere.choose(slotValue(message.slot), message.weather === 'rain' ? 'rain' : 'clear', message.instant === true); break;
      case 'goTo': walking = false; walker.goTo(placeValue(message.place)); break;
      case 'teleport': walking = false; walker.teleport(placeValue(message.place)); break;
      case 'walk': walking = message.on === true; restSeconds = 0; break;
      case 'sit': cat!.sit(); break;
      case 'stand': cat!.stand(); break;
      default: return JSON.stringify({ error: `不认识的命令：${String(message.type)}` });
    }
    return '{}';
  } };
  post({ type: 'ready', loadMs: performance.now() - started, triangles: world.triangles });
  if (!inApp()) { initialized = true; syncRunning('browser'); }
}
void boot().catch(error => post({ type: 'error', message: String(error) }));
