import * as THREE from 'three';

/** 院子可拖到的范围（米，主路两端再放一点） */
const X_MIN = -2.7;
const X_MAX = 2.7;

/**
 * 竖屏跟随镜头（第 0 轮先能用；六处机位的构图是第 1 轮的事）。
 * 从院子正前方偏上看团子，团子落在画面下半；手指横向拖动把镜头拖开，松手后慢慢回到团子身上。
 */
export class FollowCamera {
  readonly camera = new THREE.PerspectiveCamera(48, 0.5, 0.1, 200);
  /** 手指拖开的偏移（米） */
  offset = 0;
  dragging = false;

  private focus = new THREE.Vector3();
  private position = new THREE.Vector3();
  private aspect = 0.5;
  private settled = false;

  private static readonly HEIGHT = 1.35;
  private static readonly DISTANCE = 3.4;
  private static readonly LOOK_UP = 0.62;

  snapshot() {
    return { offset: this.offset, focus: this.focus.toArray(), position: this.position.toArray() };
  }

  restore(state: ReturnType<FollowCamera['snapshot']>) {
    this.offset = state.offset;
    this.focus.fromArray(state.focus);
    this.position.fromArray(state.position);
    this.settled = true;
    this.dragging = false;
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.focus);
  }

  resize(width: number, height: number) {
    this.aspect = width / height;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  /** 画面在团子那一层的实际宽度（米），把手指的像素换算成米用 */
  get visibleWidth() {
    return 2 * FollowCamera.DISTANCE * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.aspect;
  }

  update(cat: THREE.Vector3Like, dt: number) {
    if (!this.dragging) this.offset = THREE.MathUtils.damp(this.offset, 0, 1.6, dt);
    const x = THREE.MathUtils.clamp(cat.x + this.offset, X_MIN, X_MAX);
    const focus = new THREE.Vector3(x, FollowCamera.LOOK_UP, cat.z);
    const position = new THREE.Vector3(x, FollowCamera.HEIGHT, cat.z + FollowCamera.DISTANCE);
    if (!this.settled) {
      this.focus.copy(focus);
      this.position.copy(position);
      this.settled = true;
    } else {
      const k = this.dragging ? 14 : 4;
      this.focus.x = THREE.MathUtils.damp(this.focus.x, focus.x, k, dt);
      this.focus.z = THREE.MathUtils.damp(this.focus.z, focus.z, 4, dt);
      this.position.x = THREE.MathUtils.damp(this.position.x, position.x, k, dt);
      this.position.z = THREE.MathUtils.damp(this.position.z, position.z, 4, dt);
    }
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.focus);
  }
}
