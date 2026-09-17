import * as THREE from 'three';
import type { WalkResult } from '../tuanzi';
import { NODES, distance, nearestNode, place, route, type Ground, type PlaceId } from './layout';

/** 院子用到的团子接口（和团子那边约定的那一份，见方案第 7 节）。真团子和占位体都满足它。 */
export interface YardCat {
  readonly root: THREE.Object3D;
  readonly position: Readonly<THREE.Vector3>;
  readonly facing: number;
  update(dt: number): void;
  walkTo(point: THREE.Vector3Like): Promise<WalkResult>;
  /** 沿折线走：缓弯边走边转，急弯在拐点停稳再踏步转（团子那边保证脚不滑） */
  walkAlong(points: THREE.Vector3Like[]): Promise<WalkResult>;
  sit(): void;
  stand(): void;
  lookAt(point: THREE.Vector3Like | null): void;
  /** 团子那边留的口子：按贴图自发光提亮（0 关）。占位体没有 */
  readonly appearance?: { setGlow(amount: number): void };
}

const glowApplied = new WeakMap<YardCat, number>();

/**
 * 入夜把团子托亮一点（数值来自天色预设的 catGlow）。
 * setGlow 每次都会让材质重新编译，所以按 0.02 一档取整，变了才调。
 */
export function applyCatGlow(cat: YardCat, amount: number) {
  const step = Math.round(amount / 0.02) * 0.02;
  if (glowApplied.get(cat) === step) return;
  glowApplied.set(cat, step);
  cat.appearance?.setGlow(step);
}

const LENGTH = 0.38;
const HEIGHT = 0.35;
const SPEED = 0.25;

/** 占位团子：团子尺寸的圆角胶囊加一个头，脸朝 +Z。真团子读不到时用它。 */
export class PlaceholderCat implements YardCat {
  readonly root = new THREE.Group();
  private yaw = 0;
  private target: THREE.Vector3 | null = null;
  private arrive: ((result: WalkResult) => void) | null = null;
  private sitting = false;
  private body: THREE.Mesh;

  constructor() {
    const material = new THREE.MeshStandardMaterial({ color: '#e3a05c', roughness: 1 });
    const radius = HEIGHT * 0.36;
    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(radius, LENGTH - radius * 2, 8, 20), material);
    this.body.rotation.x = Math.PI / 2;
    this.body.position.y = radius + 0.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(HEIGHT * 0.34, 20, 14), material);
    head.position.set(0, HEIGHT * 0.66, LENGTH * 0.36);
    for (const mesh of [this.body, head]) {
      mesh.castShadow = true;
      this.root.add(mesh);
    }
  }

  get position() {
    return this.root.position;
  }

  get facing() {
    return this.yaw;
  }

  walkTo(point: THREE.Vector3Like) {
    this.settle(true);
    this.sitting = false;
    this.target = new THREE.Vector3(point.x, 0, point.z);
    return new Promise<WalkResult>((resolve) => (this.arrive = resolve));
  }

  async walkAlong(points: THREE.Vector3Like[]) {
    for (const point of points) {
      const result = await this.walkTo(point);
      if (result.interrupted) return result;
    }
    return { interrupted: false };
  }

  sit() {
    this.settle(true);
    this.target = null;
    this.sitting = true;
  }

  stand() {
    this.sitting = false;
  }

  lookAt() {}

  update(dt: number) {
    if (this.target) {
      const to = this.target.clone().sub(this.root.position).setY(0);
      const d = to.length();
      if (d < 0.004) {
        this.target = null;
        this.settle(false);
      } else {
        const turn = THREE.MathUtils.euclideanModulo(Math.atan2(to.x, to.z) - this.yaw + Math.PI, Math.PI * 2) - Math.PI;
        this.yaw += THREE.MathUtils.clamp(turn, -2.6 * dt, 2.6 * dt);
        const step = Math.min(SPEED * dt * Math.max(0, Math.cos(turn)), d);
        this.root.position.x += Math.sin(this.yaw) * step;
        this.root.position.z += Math.cos(this.yaw) * step;
      }
    }
    this.root.rotation.y = this.yaw;
    this.body.rotation.x = THREE.MathUtils.damp(this.body.rotation.x, Math.PI / 2 - (this.sitting ? 0.5 : 0), 6, dt);
  }

  private settle(interrupted: boolean) {
    const resolve = this.arrive;
    this.arrive = null;
    resolve?.({ interrupted });
  }
}

/**
 * 让团子沿路网去某一处：算出最短路，把节点整串交给团子的 walkAlong。
 * （第一轮早些时候团子走着几乎不拐弯，这里曾经先把路线化简成几段直线；
 *  团子那边加了 walkAlong 以后不需要了。）
 */
/** 团子连续多久不在画面里才考虑挪它（秒）、挪到离终点多远的地方（米） */
const UNSEEN_FOR = 0.8;
const LEAD = 1.1;

export class Walker {
  /** 已经到了、或正要去的地点 */
  goal: PlaceId = 'house';
  arrived = true;

  private trip = 0;
  /** 这一趟的路线：出发点 + 后面的节点 */
  private path: Ground[] = [];
  private unseen = 0;
  private caughtUp = false;
  private frustum = new THREE.Frustum();
  private matrix = new THREE.Matrix4();
  private sphere = new THREE.Sphere();
  private point = new THREE.Vector3();

  constructor(readonly cat: YardCat) {
    const start = place('house').point;
    cat.root.position.set(start.x, 0, start.z);
  }

  /** 此刻离哪一处最近（状态条用） */
  get nearest(): PlaceId {
    let best: PlaceId = this.goal;
    let bestDistance = Infinity;
    for (const id of ['house', 'bed', 'tree', 'grass', 'pond', 'fence'] as PlaceId[]) {
      const d = distance(place(id).point, this.cat.position);
      if (d < bestDistance) [best, bestDistance] = [id, d];
    }
    return best;
  }

  /** 直接放到某一处（截图、减少动态效果时用） */
  teleport(id: PlaceId) {
    const target = place(id);
    this.trip++;
    this.cat.stand();
    this.cat.root.position.set(target.point.x, 0, target.point.z);
    void this.cat.walkTo({ x: target.point.x, y: 0, z: target.point.z });
    this.goal = id;
    this.arrived = true;
    this.path = [];
    this.settleIdle();
  }

  goTo(id: PlaceId) {
    if (id === this.goal) return;
    this.goal = id;
    this.arrived = false;
    const from = nearestNode(this.cat.position);
    const nodes = route(from, place(id).node).map((node) => NODES[node]!);
    // 从当前位置直接接到路线的下一个节点；走到一半改主意时也不用先折回最近的节点
    // 已经站在目的地的节点上：没有路可走，直接算到了
    if (!nodes.length) nodes.push(place(id).point);
    this.cat.stand();
    this.caughtUp = false;
    this.walk(nodes);
  }

  /**
   * 追上镜头：一口气滚过好几章时，团子每秒只走 0.25 m，要半分钟才到。
   * 团子不在画面里、剩下的路又还长的时候，直接把它挪到路线上离终点约一米、此刻也不在画面里的地方，
   * 让它从画外走进这一章。在画面里的时候从不挪——不能当着人的面瞬移。
   */
  update(camera: THREE.Camera, dt: number) {
    // 一趟只挪一次：挪完以后它多半还在画外，不拦着的话每 0.8 秒又被挪回入口，永远走不到
    if (this.arrived || this.caughtUp || this.path.length < 2) {
      this.unseen = 0;
      return;
    }
    this.frustum.setFromProjectionMatrix(this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const visible = (p: Ground) => this.frustum.intersectsSphere(this.sphere.set(this.point.set(p.x, 0.18, p.z), 0.4));
    if (visible(this.cat.position)) {
      this.unseen = 0;
      return;
    }
    this.unseen += dt;
    if (this.unseen < UNSEEN_FOR) return;

    // 团子大致走到路线的哪一段：取离它最近的路线点
    let nearest = 0;
    for (let i = 1; i < this.path.length; i++) {
      if (distance(this.path[i]!, this.cat.position) < distance(this.path[nearest]!, this.cat.position)) nearest = i;
    }
    let remaining = 0;
    for (let i = nearest; i < this.path.length - 1; i++) remaining += distance(this.path[i]!, this.path[i + 1]!);
    if (remaining < LEAD + 0.6) return;

    // 从终点往回数 LEAD 米；那一点要是在画面里，就继续往回找一个不在画面里的
    let back = 0;
    for (let i = this.path.length - 1; i > nearest; i--) {
      back += distance(this.path[i]!, this.path[i - 1]!);
      if (back < LEAD || visible(this.path[i - 1]!)) continue;
      const entry = this.path[i - 1]!;
      this.cat.root.position.set(entry.x, 0, entry.z);
      this.unseen = 0;
      this.caughtUp = true;
      this.walk(this.path.slice(i));
      return;
    }
  }

  private walk(nodes: Ground[]) {
    const trip = ++this.trip;
    this.path = [{ x: this.cat.position.x, z: this.cat.position.z }, ...nodes];
    void this.cat.walkAlong(nodes.map((node) => ({ x: node.x, y: 0, z: node.z }))).then(({ interrupted }) => {
      if (interrupted || trip !== this.trip) return;
      this.arrived = true;
      this.path = [];
      this.settleIdle();
    });
  }

  private settleIdle() {
    const idle = place(this.goal).idle;
    if (idle === 'sleepBreathe' || idle === 'sleepyNod') this.cat.sit();
  }
}
