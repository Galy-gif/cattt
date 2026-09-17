import * as THREE from 'three';
import { PLACE_ORDER, place } from './layout';

interface Waypoint {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

/**
 * 镜头：每章一个机位，两条样条（位置、注视点）穿过去，滚动进度是"第几章的小数"。
 * 机位顺序：0 首屏全景 → 1–6 六处地点 → 7 结尾全景。结构借 Kage，数值是自己按院子摆的。
 */
export class Rig {
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  progress = 0;
  smooth = 0;
  reduced = false;
  /** 指针，-1…1 */
  pointer = new THREE.Vector2();

  private waypoints: Waypoint[];
  private positions: THREE.CatmullRomCurve3;
  private targets: THREE.CatmullRomCurve3;
  private drift = new THREE.Vector2();
  private aspect = 1.6;

  constructor() {
    const at = (id: (typeof PLACE_ORDER)[number]) => {
      const p = place(id).point;
      return new THREE.Vector3(p.x, 0, p.z);
    };
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const house = at('house'), bed = at('bed'), tree = at('tree'), grass = at('grass'), pond = at('pond'), fence = at('fence');
    this.waypoints = [
      // 首屏：全景，机位放低、平视，院子落在画面下半，上半是天，文字压在天上（用户 09-17 定）
      // 文字块在左的章节，主体放画面右半（注视点往主体左边偏）；文字在右的反过来。
      { position: v(-1.7, 0.95, 8.2), target: v(-1.6, 1.55, -0.6), fov: 36 },
      // 蘑菇屋（文字在左）：推近到门口
      { position: house.clone().add(v(-0.3, 0.5, 3.0)), target: house.clone().add(v(-0.75, 0.42, 0)), fov: 34 },
      // 猫窝（文字在右）：平移过来，略低
      { position: bed.clone().add(v(0.9, 0.42, 2.0)), target: bed.clone().add(v(0.55, 0.16, 0)), fov: 34 },
      // 树屋（文字在左）：退后，吊窝、树冠和树下的团子都在画面里
      { position: tree.clone().add(v(-1.2, 0.7, 4.6)), target: tree.clone().add(v(-1.35, 0.95, 0)), fov: 40 },
      // 草丛（文字在右）：压低，前排草在近景
      { position: grass.clone().add(v(0.7, 0.2, 1.7)), target: grass.clone().add(v(0.42, 0.17, 0)), fov: 32 },
      // 池塘（文字在左）：拉开，看水面和天
      { position: pond.clone().add(v(-1.6, 1.0, 3.8)), target: pond.clone().add(v(-1.5, 0.5, -1.2)), fov: 40 },
      // 栅栏边（文字在右）：越过栅栏看远山
      { position: fence.clone().add(v(-0.6, 0.5, 2.8)), target: fence.clone().add(v(0.55, 0.55, -3)), fov: 36 },
      // 结尾：回到全景，院子压在画面下半，上半留给天和那一句话
      { position: v(0.3, 2.3, 8.6), target: v(-0.2, 1.55, -0.8), fov: 36 },
    ];
    this.positions = new THREE.CatmullRomCurve3(this.waypoints.map((w) => w.position), false, 'catmullrom', 0.42);
    this.targets = new THREE.CatmullRomCurve3(this.waypoints.map((w) => w.target), false, 'catmullrom', 0.42);
  }

  get count() {
    return this.waypoints.length;
  }

  resize(width: number, height: number) {
    this.aspect = width / height;
    this.camera.aspect = this.aspect;
  }

  /** 直接跳到位，不做平滑（截图、减少动态效果） */
  snap(progress = this.progress) {
    this.progress = progress;
    this.smooth = progress;
  }

  update(dt: number) {
    this.smooth = this.reduced ? Math.round(this.progress) : THREE.MathUtils.damp(this.smooth, this.progress, 5, dt);
    const last = this.waypoints.length - 1;
    const s = THREE.MathUtils.clamp(this.smooth, 0, last);
    const u = s / last;
    const position = this.positions.getPoint(u);
    const target = this.targets.getPoint(u);
    const i = Math.min(last - 1, Math.floor(s));
    let fov = THREE.MathUtils.lerp(this.waypoints[i]!.fov, this.waypoints[i + 1]!.fov, s - i);

    // 窗口偏竖时往后退、放宽视角，免得左右被裁
    const narrow = THREE.MathUtils.clamp((1.62 - this.aspect) / 1.05, 0, 1);
    if (narrow > 0) {
      const back = position.clone().sub(target).normalize();
      position.addScaledVector(back, narrow * 3.2);
      position.y += narrow * 0.4;
      fov *= 1 + narrow * 0.35;
    }

    // 指针视差：几厘米
    if (!this.reduced) {
      this.drift.x = THREE.MathUtils.damp(this.drift.x, this.pointer.x, 2.6, dt);
      this.drift.y = THREE.MathUtils.damp(this.drift.y, this.pointer.y, 2.6, dt);
      const right = new THREE.Vector3().subVectors(target, position).cross(this.camera.up).normalize();
      position.addScaledVector(right, this.drift.x * 0.09);
      position.y += this.drift.y * 0.05;
      target.addScaledVector(right, -this.drift.x * 0.03);
    }

    this.camera.position.copy(position);
    this.camera.fov = fov;
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
  }
}
