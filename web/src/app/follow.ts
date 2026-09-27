import * as THREE from 'three';
import { COMPOSITION, NO_INSETS, boxCorners, placeFocus, projectBox, rectanglesOverlap, type ScreenRect, type Insets } from './composition.ts';
import type { PlaceId } from '../yard/layout.ts';
import { groundHeight } from '../yard/terrain.ts';

const YARD_X_MIN = -3;
const YARD_X_MAX = 3;
const INERTIA_DAMPING = 10;
const MAX_INERTIA = 2.4;
export type FollowMode = 'following' | 'browsing' | 'overview';
export interface FollowSnapshot {
  mode: FollowMode;
  centerX: number;
  centerZ: number;
  velocity: number;
  offset: number;
  focus: number[];
  position: number[];
  distance?: number;
  shownDistance?: number;
  targetY?: number;
  place?: PlaceId | null;
}

/** 跟随、固定浏览、全院总览。构图模式只由独立预览启用，保留第 0 轮镜头基准。 */
export class FollowCamera {
  readonly camera = new THREE.PerspectiveCamera(COMPOSITION.fov, 0.5, 0.1, 200);
  mode: FollowMode = 'following';
  dragging = false;
  reduceMotion = false;
  private focus = new THREE.Vector3();
  private position = new THREE.Vector3();
  private aspect = 0.5;
  private width = 440;
  private height = 956;
  private insets = { ...NO_INSETS };
  private settled = false;
  private centerX = 0;
  private centerZ = 0;
  private targetY = COMPOSITION.focusHeight;
  private velocity = 0;
  private distance = COMPOSITION.dailyDistance;
  private shownDistance = COMPOSITION.dailyDistance;
  private selectedPlace: PlaceId | null = null;
  private bounds = new THREE.Box3(new THREE.Vector3(-3, 0, -1.6), new THREE.Vector3(3, 2.5, 2));
  private obstacles: THREE.Box3[] = [];
  private parts: THREE.Box3[] = [];
  private outline: THREE.Vector3[] = [];
  private controls: ScreenRect[] = [];
  private comparison = false;
  private maxDistance = 18;
  private minimumDistance = COMPOSITION.minimumDistance;
  private subjectSize = new THREE.Vector3(0.7, 0.8, 0.7);
  private readonly portrait: boolean;
  constructor(portrait = false) { this.portrait = portrait; }

  get offset() { return this.centerX - this.focus.x; }
  get limits() { return { min: this.minimumDistance, daily: COMPOSITION.dailyDistance, max: this.maxDistance }; }
  snapshot(): FollowSnapshot {
    return { mode: this.mode, centerX: this.centerX, centerZ: this.centerZ, velocity: this.velocity,
      offset: this.offset, focus: this.focus.toArray(), position: this.position.toArray(),
      ...(this.portrait ? { distance: this.distance, shownDistance: this.shownDistance, targetY: this.targetY, place: this.selectedPlace } : {}) };
  }

  restore(state: Partial<FollowSnapshot> & Pick<FollowSnapshot, 'focus' | 'position'>) {
    if (state.focus.length !== 3 || state.position.length !== 3 ||
        ![...state.focus, ...state.position, state.distance ?? COMPOSITION.dailyDistance,
          state.shownDistance ?? COMPOSITION.dailyDistance, state.targetY ?? COMPOSITION.focusHeight].every(Number.isFinite)) {
      throw new Error('镜头快照无效');
    }
    this.focus.fromArray(state.focus); this.position.fromArray(state.position);
    this.mode = state.mode === 'overview' && this.portrait ? 'overview' : state.mode === 'browsing' ? 'browsing' : 'following';
    this.centerX = Number.isFinite(state.centerX) ? state.centerX! : this.focus.x;
    this.centerZ = Number.isFinite(state.centerZ) ? state.centerZ! : this.focus.z;
    this.velocity = Number.isFinite(state.velocity) ? state.velocity! : 0;
    this.distance = this.clampDistance(state.distance ?? COMPOSITION.dailyDistance);
    this.shownDistance = this.clampDistance(state.shownDistance ?? this.distance);
    this.targetY = state.targetY ?? COMPOSITION.focusHeight;
    this.selectedPlace = state.place ?? null;
    this.centerX = this.clampCenter(this.centerX);
    this.settled = true; this.dragging = false;
    this.apply();
  }

  setBounds(bounds: THREE.Box3, obstacles: THREE.Box3[] = [], parts: THREE.Box3[] = [], outline: THREE.Vector3[] = []) {
    this.bounds.copy(bounds).expandByScalar(COMPOSITION.edgePadding);
    this.outline = outline.map(p => p.clone());
    this.parts = parts.map(box => box.clone());
    this.obstacles = obstacles.map(box => box.clone().expandByScalar(0.14));
    this.fitOverview();
  }

  setControls(controls: ScreenRect[]) {
    this.controls = controls.map(rect => ({ ...rect }));
    this.fitOverview();
    if (this.mode === 'overview') this.overview(true);
  }
  /** 仅用于扩院前后同机位截图；任何手势或取景操作都退出固定对照。 */
  compareAt(focus: number[], position: number[]) {
    this.comparison = true; this.mode = 'browsing'; this.selectedPlace = null;
    this.focus.fromArray(focus); this.position.fromArray(position);
    this.distance = this.shownDistance = this.focus.distanceTo(this.position);
    this.apply();
  }
  setSubjectSize(size: THREE.Vector3) {
    this.subjectSize.copy(size);
    this.resize(this.width, this.height);
  }
  resize(width: number, height: number, insets?: Insets) {
    if (width <= 0 || height <= 0) return;
    this.width = width; this.height = height; this.aspect = width / height;
    if (insets) this.insets = { ...insets };
    this.camera.aspect = this.aspect;
    if (this.portrait) {
      // 光轴落在实际可用区域中心，给地点轨、顶部状态及底部话题卡让位。
      this.camera.setViewOffset(width, height, (this.insets.right - this.insets.left) / 2,
        (this.insets.bottom - this.insets.top) / 2, width, height);
      const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const usableX = Math.max(.1, (width - this.insets.left - this.insets.right) / width);
      const usableY = Math.max(.1, (height - this.insets.top - this.insets.bottom) / height);
      // 包围盒横向对角覆盖任意朝向；竖向投影计入俯角，留 20% 余量。
      const horizontal = Math.hypot(this.subjectSize.x, this.subjectSize.z) * .6;
      const vertical = (this.subjectSize.y * Math.cos(COMPOSITION.dailyPitch) + Math.hypot(this.subjectSize.x, this.subjectSize.z) * Math.sin(COMPOSITION.dailyPitch)) * .6;
      this.minimumDistance = Math.max(COMPOSITION.minimumDistance, horizontal / (tan * this.aspect * usableX), vertical / (tan * usableY));
      this.fitOverview();
      if (this.mode === 'overview') this.overview(false);
    }
    this.camera.updateProjectionMatrix();
    this.centerX = this.clampCenter(this.centerX);
  }

  get visibleWidth() {
    const distance = this.portrait ? this.shownDistance : 3.4;
    return 2 * distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.aspect;
  }

  beginBrowse() {
    this.comparison = false;
    if (this.mode !== 'browsing') {
      this.centerX = this.clampCenter(this.focus.x); this.centerZ = this.focus.z; this.targetY = this.focus.y;
    }
    this.mode = 'browsing'; this.selectedPlace = null; this.dragging = true; this.velocity = 0;
    if (this.portrait) this.distance = this.shownDistance;
  }
  dragBy(delta: number, seconds: number) {
    if (!this.dragging) return;
    const previous = this.centerX;
    this.centerX = this.clampCenter(this.centerX + delta);
    this.velocity = seconds > 0 ? THREE.MathUtils.clamp((this.centerX - previous) / seconds, -MAX_INERTIA, MAX_INERTIA) : 0;
  }
  endBrowse(reduceMotion = false) {
    this.dragging = false;
    if (reduceMotion || this.reduceMotion) this.velocity = 0;
  }
  findCat() {
    this.comparison = false;
    this.mode = 'following'; this.dragging = false; this.velocity = 0; this.selectedPlace = null;
    this.distance = COMPOSITION.dailyDistance; this.targetY = COMPOSITION.focusHeight;
  }
  lookAtPlace(id: PlaceId, instant = false) {
    this.comparison = false;
    const p = placeFocus(id);
    this.mode = 'browsing'; this.dragging = false; this.velocity = 0;
    this.centerX = this.clampCenter(p.x); this.centerZ = p.z; this.targetY = p.y;
    this.selectedPlace = id; this.distance = COMPOSITION.dailyDistance;
    if (instant) this.settled = false;
  }
  overview(instant = false) {
    this.comparison = false;
    const center = this.bounds.getCenter(new THREE.Vector3());
    this.mode = 'overview'; this.dragging = false; this.velocity = 0; this.selectedPlace = null;
    this.centerX = center.x; this.centerZ = center.z; this.targetY = this.parts.length ? .35 : center.y;
    this.distance = this.maxDistance;
    if (instant) this.settled = false;
  }

  /** 地面锚点固定在手势中心；夹到院子边界时只允许必要的锚点滑移。 */
  zoomBy(ratio: number, x: number, y: number) {
    if (!this.portrait || !Number.isFinite(ratio) || ratio <= 0) return;
    const before = this.groundAt(x, y);
    this.beginBrowse();
    this.distance = this.clampDistance(this.shownDistance / ratio);
    this.shownDistance = this.distance;
    this.focus.set(this.centerX, this.targetY, this.centerZ);
    this.position.copy(this.focus).add(this.direction(this.distance).multiplyScalar(this.distance));
    this.avoidObstacles(); this.apply();
    const after = this.groundAt(x, y);
    if (before && after) {
      this.centerX = this.clampCenter(this.centerX + before.x - after.x);
      this.centerZ = THREE.MathUtils.clamp(this.centerZ + before.z - after.z, this.bounds.min.z, this.bounds.max.z);
    }
    this.focus.set(this.centerX, this.targetY, this.centerZ);
    this.position.copy(this.focus).add(this.direction(this.distance).multiplyScalar(this.distance));
    this.avoidObstacles(); this.apply();
  }

  groundAt(x: number, y: number) {
    this.camera.updateMatrixWorld();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(x / this.width * 2 - 1, 1 - y / this.height * 2), this.camera);
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  }

  update(cat: THREE.Vector3Like, dt: number) {
    if (this.comparison) { this.apply(); return; }
    if (this.mode === 'browsing' && !this.dragging && this.velocity !== 0) {
      const previous = this.centerX;
      this.centerX = this.clampCenter(this.centerX + this.velocity * dt);
      this.velocity *= Math.exp(-INERTIA_DAMPING * dt);
      if (Math.abs(this.velocity) < 0.01 || this.centerX === previous || this.reduceMotion) this.velocity = 0;
    }
    const x = this.mode === 'following' ? this.clampCenter(cat.x) : this.centerX;
    const z = this.mode === 'following' ? cat.z : this.centerZ;
    const focus = new THREE.Vector3(x, this.portrait ? this.targetY : 0.62, z);
    const snap = !this.settled || this.reduceMotion || (this.portrait && this.dragging);
    const k = this.dragging ? 14 : this.mode === 'following' ? 4 : 10;
    if (snap) {
      this.focus.copy(focus); this.shownDistance = this.distance;
      this.centerX = x; this.centerZ = z; this.settled = true;
    } else {
      this.focus.x = THREE.MathUtils.damp(this.focus.x, focus.x, k, dt);
      this.focus.y = THREE.MathUtils.damp(this.focus.y, focus.y, 4, dt);
      this.focus.z = THREE.MathUtils.damp(this.focus.z, focus.z, 4, dt);
      this.shownDistance = THREE.MathUtils.damp(this.shownDistance, this.distance, 4, dt);
    }
    const position = this.portrait
      ? this.focus.clone().add(this.direction(this.shownDistance).multiplyScalar(this.shownDistance))
      : new THREE.Vector3(x, 1.35, z + 3.4);
    if (snap || this.portrait) this.position.copy(position);
    else {
      this.position.x = THREE.MathUtils.damp(this.position.x, position.x, k, dt);
      this.position.z = THREE.MathUtils.damp(this.position.z, position.z, 4, dt);
    }
    if (this.portrait) this.avoidObstacles();
    this.apply();
  }

  private direction(distance: number) {
    const t = THREE.MathUtils.clamp((distance - COMPOSITION.dailyDistance) / Math.max(0.01, this.maxDistance - COMPOSITION.dailyDistance), 0, 1);
    const pitch = THREE.MathUtils.lerp(COMPOSITION.dailyPitch, COMPOSITION.overviewPitch, t);
    return new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));
  }
  private apply() {
    if (this.portrait) {
      const t = !this.comparison && this.controls.length ? THREE.MathUtils.clamp((this.shownDistance - COMPOSITION.dailyDistance) / Math.max(.01, this.maxDistance - COMPOSITION.dailyDistance), 0, 1) : 0;
      this.camera.setViewOffset(this.width, this.height, (this.insets.right - this.insets.left) / 2 * (1 - t),
        (this.insets.bottom - this.insets.top) / 2, this.width, this.height);
    }
    this.camera.position.copy(this.position); this.camera.lookAt(this.focus); this.camera.updateMatrixWorld();
  }
  private clampDistance(value: number) { return THREE.MathUtils.clamp(value, this.minimumDistance, this.maxDistance); }
  private clampCenter(x: number) {
    if (this.portrait) return THREE.MathUtils.clamp(x, this.bounds.min.x, this.bounds.max.x);
    const half = Math.min((YARD_X_MAX - YARD_X_MIN) / 2, this.visibleWidth / 2);
    return THREE.MathUtils.clamp(x, YARD_X_MIN + half, YARD_X_MAX - half);
  }
  private avoidObstacles() {
    const outward = this.position.clone().sub(this.focus).normalize();
    // 保守实体包围盒加 14cm 近裁面余量，沿光轴退出实体，不改猫或场景。
    for (let i = 0; i < 300 && (this.obstacles.some(box => box.containsPoint(this.position)) || this.position.y < groundHeight(this.position.x, this.position.z) + .18); i++) this.position.addScaledVector(outward, 0.05);
  }
  private fitOverview() {
    if (!this.portrait) return;
    const camera = this.camera.clone();
    if (this.controls.length) camera.setViewOffset(this.width, this.height, 0, (this.insets.bottom - this.insets.top) / 2, this.width, this.height);
    const center = this.bounds.getCenter(new THREE.Vector3());
    if (this.parts.length) center.y = .35;
    const dir = new THREE.Vector3(0, Math.sin(COMPOSITION.overviewPitch), Math.cos(COMPOSITION.overviewPitch));
    // 院界地面与各物件分别投影，合并立方体不存在的上方空角不再撑大画面。
    const ground = this.bounds.clone(); ground.min.y = ground.max.y = 0;
    const shapes = this.parts.length ? [ground, ...this.parts] : [this.bounds];
    const fits = (distance: number) => {
      camera.position.copy(center).addScaledVector(dir, distance); camera.lookAt(center); camera.updateMatrixWorld();
      return shapes.every((shape, index) => {
        let r = projectBox(shape, camera, this.width, this.height);
        if (index === 0 && this.outline.length) {
          const points = this.outline.map(p => p.clone().project(camera));
          const xs = points.map(p => (p.x + 1) * this.width / 2), ys = points.map(p => (1 - p.y) * this.height / 2);
          r = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), inFront: points.every(p => p.z >= -1 && p.z <= 1) };
        }
        const left = this.controls.length ? 12 : this.insets.left + 12;
        if (!r.inFront || r.x < left || r.x + r.width > this.width - this.insets.right - 8 ||
            r.y < this.insets.top + 8 || r.y + r.height > this.height - this.insets.bottom - 8) return false;
        // 草地可在地点轨后延续，但屋、树、池塘等识别部位不能被遮挡。
        return (this.parts.length && index === 0) || this.controls.every(control => !rectanglesOverlap(r, control, 7));
      });
    };
    let low = Math.max(COMPOSITION.dailyDistance, this.minimumDistance), high = low;
    while (high < 90 && !fits(high)) { low = high; high += .10; }
    for (let i = 0; i < 24; i++) { const mid = (low + high) / 2; if (fits(mid)) high = mid; else low = mid; }
    this.maxDistance = high;
    this.distance = this.clampDistance(this.distance);
  }
}
