import type { FollowCamera } from './follow.ts';

type Touch = { x: number; y: number };
/** 与 DOM 分离以回归多指转换；第三指忽略，取消整组，不产生点击。 */
export class CameraGestures {
  private touches = new Map<number, Touch>();
  private lastTime = 0;
  private span = 0;
  private moved = false;
  private camera: FollowCamera;
  private width: () => number;
  constructor(camera: FollowCamera, width: () => number) { this.camera = camera; this.width = width; }
  down(id: number, x: number, y: number, time: number) {
    if (this.touches.size >= 2 || this.touches.has(id)) return;
    this.touches.set(id, { x, y }); this.lastTime = time;
    if (this.touches.size === 1) this.moved = false;
    else { this.camera.beginBrowse(); this.moved = true; }
    this.span = this.measure().span;
  }
  move(id: number, x: number, y: number, time: number) {
    const previous = this.touches.get(id);
    if (!previous) return false;
    if (!this.moved && Math.hypot(x - previous.x, y - previous.y) < 3) return false;
    this.camera.beginBrowse(); this.moved = true;
    this.touches.set(id, { x, y });
    if (this.touches.size === 2) {
      const next = this.measure();
      if (this.span > 1 && next.span > 1) this.camera.zoomBy(next.span / this.span, next.x, next.y);
      this.span = next.span;
    } else {
      this.camera.dragBy(-(x - previous.x) / this.width() * this.camera.visibleWidth, Math.max(0.001, (time - this.lastTime) / 1000));
    }
    this.lastTime = time;
    return true;
  }
  up(id: number, time: number) {
    if (!this.touches.delete(id)) return;
    this.span = this.measure().span; this.lastTime = time;
    // 留下的那根手指以最新坐标继续拖，速度清零，不能继承双指位移。
    this.camera.endBrowse(true);
    if (this.touches.size) this.camera.beginBrowse();
    else this.moved = false;
  }
  lost(id: number) { if (this.touches.has(id)) this.cancel(); }
  cancel() {
    this.touches.clear(); this.span = 0; this.moved = false; this.camera.endBrowse(true);
  }
  private measure() {
    const points = [...this.touches.values()];
    const a = points[0], b = points[1];
    if (!a || !b) return { span: 0, x: a?.x ?? 0, y: a?.y ?? 0 };
    return { span: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
}
