import * as THREE from 'three';
import './style.css';
import { MotionMetrics } from './metrics';
import type { Surface } from './model';
import { Panel } from './panel';
import { Stage, type ViewName } from './stage';
import { loadTuanzi } from './tuanzi';

const params = new URLSearchParams(location.search);
const stage = new Stage(document.getElementById('stage')!);
const panel = new Panel(document.getElementById('panel')!);

const look = {
  surface: (params.get('surface') === 'soft' ? 'soft' : 'felt') as Surface,
  outline: params.get('outline') === '1',
  fuzz: params.get('fuzz') !== '0',
};
let view = (params.get('view') ?? 'three-quarter') as ViewName;
let follow = params.get('follow') !== '0';
const still = params.get('still') === '1';

const cat = await loadTuanzi('/models/tuanzi.glb');
if (!cat) {
  panel.heading('团子小样', '还没有模型。先在仓库根目录跑 assets/tuanzi-3d/build_tuanzi.py 导出 web/public/models/tuanzi.glb。');
  stage.setView('three-quarter');
  stage.renderer.setAnimationLoop(() => stage.render());
} else {
  stage.scene.add(cat.root);
  performance.mark('tuanzi-ready');
  cat.appearance.apply(look);
  const metrics = new MotionMetrics(cat);
  Object.assign(window, { __tuanzi: { cat, stage, metrics } });

  const pose = params.get('pose');
  if (pose) cat.freeze(pose, Number(params.get('t') ?? 0));
  if (still || pose) cat.proceduralEnabled = false;
  stage.setView(view, cat.position, cat.facing);

  const setView = (next: ViewName) => {
    view = next;
    stage.setView(view, cat.position, cat.facing);
  };
  const applyLook = (change: Partial<typeof look>) => {
    Object.assign(look, change);
    cat.appearance.apply(look);
  };
  const ahead = (distance: number, sideways = 0) =>
    new THREE.Vector3(
      cat.position.x + Math.sin(cat.facing) * distance + Math.cos(cat.facing) * sideways,
      0,
      cat.position.z + Math.cos(cat.facing) * distance - Math.sin(cat.facing) * sideways,
    );

  panel.heading('团子小样', '点地面让它走过去；光标移到画面里它会看你，3 秒不动就回正。');
  panel.group('动作', [
    { label: '走一段', onClick: () => void cat.walkTo(ahead(0.9, (Math.random() - 0.5) * 0.4)) },
    { label: '转身', onClick: () => void cat.walkTo(ahead(-0.25)) },
    { label: '坐下', onClick: () => cat.sit() },
    { label: '起身', onClick: () => cat.stand() },
    { label: '抖耳朵', onClick: () => cat.earFlick() },
  ]);
  panel.group('视角', [
    { label: '正面', onClick: () => setView('front'), selected: () => view === 'front' },
    { label: '侧面', onClick: () => setView('side'), selected: () => view === 'side' },
    { label: '四分之三', onClick: () => setView('three-quarter'), selected: () => view === 'three-quarter' },
    { label: '自由', onClick: () => (view = 'free'), selected: () => view === 'free' },
    { label: '跟随', onClick: () => (follow = !follow), selected: () => follow },
  ]);
  panel.group('表面', [
    { label: '柔软短绒', onClick: () => applyLook({ surface: 'felt' }), selected: () => look.surface === 'felt' },
    { label: '柔和光泽', onClick: () => applyLook({ surface: 'soft' }), selected: () => look.surface === 'soft' },
  ]);
  panel.group('描边与绒毛', [
    { label: '暖棕描边', onClick: () => applyLook({ outline: !look.outline }), selected: () => look.outline },
    { label: '细密绒毛', onClick: () => applyLook({ fuzz: !look.fuzz }), selected: () => look.fuzz && look.surface === 'felt' },
  ]);
  panel.group('实时层', [
    { label: '看光标 · 眨眼 · 尾巴', onClick: () => (cat.proceduralEnabled = !cat.proceduralEnabled), selected: () => cat.proceduralEnabled },
  ]);
  panel.readout('读数', ['帧率', '渲染比例', '三角面', '模型大小', '状态', '走路滑步（最大）', '切换跳变（最大）']);
  panel.group('量测', [{ label: '清零', onClick: () => metrics.reset() }]);

  // 光标：在团子头部高度、正对镜头的平面上取一点当视线目标
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let pointerSeenAt = -Infinity;
  let pointerInside = false;
  const canvas = stage.renderer.domElement;
  const toNdc = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  };
  canvas.addEventListener('pointermove', (event) => {
    toNdc(event);
    pointerInside = true;
    pointerSeenAt = performance.now();
  });
  canvas.addEventListener('pointerleave', () => (pointerInside = false));
  let downAt: { x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (event) => (downAt = { x: event.clientX, y: event.clientY }));
  canvas.addEventListener('pointerup', (event) => {
    if (!downAt || Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 4) return;
    toNdc(event);
    raycaster.setFromCamera(pointer, stage.camera);
    const hit = raycaster.intersectObject(stage.ground)[0];
    if (hit) void cat.walkTo(hit.point);
  });

  const gazePoint = new THREE.Vector3();
  const updateGaze = () => {
    if (!pointerInside || performance.now() - pointerSeenAt > 3000) {
      cat.lookAt(null);
      return;
    }
    raycaster.setFromCamera(pointer, stage.camera);
    const normal = stage.camera.getWorldDirection(new THREE.Vector3()).negate();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(cat.position.x, 0.25, cat.position.z));
    if (raycaster.ray.intersectPlane(plane, gazePoint)) cat.lookAt(gazePoint);
  };

  const timer = new THREE.Timer();
  let readoutAt = 0;
  let firstFrame = true;
  stage.renderer.setAnimationLoop((time) => {
    timer.update(time);
    if (firstFrame) {
      firstFrame = false;
      performance.mark('tuanzi-first-frame');
    }
    const dt = Math.min(timer.getDelta(), 0.05);
    if (!pose) {
      updateGaze();
      cat.update(dt);
      metrics.update(dt);
    }
    if (follow && view !== 'free') stage.follow(cat.position);
    stage.followShadow(cat.position);
    stage.render();

    const now = performance.now();
    if (now - readoutAt > 250) {
      readoutAt = now;
      panel.set('帧率', stage.fps.toFixed(0), stage.fps >= 55);
      panel.set('渲染比例', stage.scale.toFixed(2), stage.scale >= 0.75);
      panel.set('三角面', cat.model.triangles.toLocaleString(), cat.model.triangles <= 20000);
      panel.set('模型大小', `${(cat.model.bytes / 1024 / 1024).toFixed(2)} MB`, cat.model.bytes <= 3 * 1024 * 1024);
      panel.set('状态', cat.state);
      panel.set('走路滑步（最大）', `${(metrics.maxSlip * 100).toFixed(2)}% 身长`, metrics.maxSlip <= 0.02);
      panel.set('切换跳变（最大）', `${metrics.maxTransition.toFixed(2)} 倍走速`, metrics.maxTransition <= 1.5);
      panel.refresh();
    }
  });
}
