import * as THREE from 'three';
import { Appearance, loadModel, type Model } from './model';
import { Blink, FootLock, Gaze, RestPose, TailSpring } from './procedural';

export interface WalkResult {
  interrupted: boolean;
}

export type TuanziState = 'idle' | 'turn' | 'walk' | 'sit_down' | 'sit_idle' | 'stand_up';

const WALK_SPEED = 0.25; // 米/秒，约每秒 0.65 个身长
const ACCELERATION = 0.7;
// 边走边转时整只猫绕中心转，着地的爪子离中心约 12cm，会被扫开（不锁脚时 45°/s 实测滑步 6.9% 身长）。
// 现在着地的爪子由 FootLock 按在原地，走着可以转弯；急弯（偏差大于 60°）仍先停下原地踏步转
const WALK_TURN_RATE = THREE.MathUtils.degToRad(80);
const STEP_TURN_RATE = THREE.MathUtils.degToRad(90);
const TURN_IN_PLACE_ENTER = THREE.MathUtils.degToRad(60);
const TURN_IN_PLACE_EXIT = THREE.MathUtils.degToRad(6);
/** 沿路走时瞄准前方这么远的路上一点 */
const LOOKAHEAD = 0.2;
const FADE = 0.25;

/**
 * 网页里的团子：Blender 导出的动作片段负责大动作，这里决定此刻播哪段、走到哪，
 * 再叠上看光标、眨眼、尾巴弹簧（方案 4.2、4.5）。
 */
export class Tuanzi {
  readonly root = new THREE.Group();
  readonly model: Model;
  readonly appearance: Appearance;
  readonly gaze: Gaze;
  readonly blink: Blink;
  readonly tail: TailSpring;
  readonly footLock: FootLock;
  readonly mixer: THREE.AnimationMixer;

  state: TuanziState = 'idle';
  speed = 0;
  /** 调试用：停掉看光标、眨眼、尾巴弹簧，动作片段照播 */
  proceduralEnabled = true;
  /** 最近一次开始切换动作的时间（秒，按 mixer 时间） */
  lastTransitionAt = -Infinity;

  private yaw = 0;
  private yawRate = 0;
  private acceleration = 0;
  private route: Route | null = null;
  private arrive: ((result: WalkResult) => void) | null = null;
  private wantSit = false;
  private actions = new Map<string, THREE.AnimationAction>();
  private base: THREE.AnimationAction | null = null;
  private rest: RestPose;
  private strideLength: number;
  private walkDuration: number;

  constructor(model: Model) {
    this.model = model;
    this.root.add(model.scene);
    this.appearance = new Appearance(model);
    // 用户 2026-09-17 后续反馈：轻巧体态、柔软短绒、QQ 弹性；延续不描边
    this.appearance.apply({ surface: 'felt', outline: false, fuzz: true });
    this.mixer = new THREE.AnimationMixer(model.scene);
    for (const source of model.clips) {
      // glb 里各段动作会共用相同的常量关键帧数组；makeClipAdditive 原地改值，
      // 不先复制就会把所有动作的位移和缩放一起改成 0，整副骨架缩成一点
      const clip = source.name === 'ear_flick' ? THREE.AnimationUtils.makeClipAdditive(source.clone()) : source;
      const action = this.mixer.clipAction(clip);
      if (clip.name === 'ear_flick') action.blendMode = THREE.AdditiveAnimationBlendMode;
      if (['sit_down', 'stand_up', 'ear_flick'].includes(clip.name)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = clip.name !== 'ear_flick';
      }
      this.actions.set(clip.name, action);
    }
    this.mixer.addEventListener('finished', (event) => this.onFinished(event.action));
    this.strideLength = model.strideLength || 0.15;
    this.walkDuration = this.actions.get('walk')?.getClip().duration ?? 0.6;

    this.gaze = new Gaze(model.bones);
    this.blink = new Blink(model.blinkers);
    this.gaze.onSaccade = () => this.blink.trigger();
    this.tail = new TailSpring(model.bones);
    this.footLock = new FootLock(model.bones, this.root);
    const legs = [...model.bones.values()].filter((bone) => /^(front|hind)_[LR]_(upper|lower|paw)$/.test(bone.name));
    this.rest = new RestPose([...this.gaze.bones, ...this.tail.chain, ...legs]);
    this.play('idle', 0);
  }

  /** 脚底中心的世界坐标（只读） */
  get position(): Readonly<THREE.Vector3> {
    return this.root.position;
  }

  /** 朝向：绕 Y 的弧度，0 = 朝 +Z，范围 −π 到 π */
  get facing() {
    return wrapAngle(this.yaw);
  }

  get clipNames() {
    return [...this.actions.keys()];
  }

  walkTo(point: THREE.Vector3Like): Promise<WalkResult> {
    return this.walkAlong([point]);
  }

  /**
   * 沿一串点走：缓弯边走边转，急弯（偏差大于 60°）先停下原地踏步转。点只看 x、z。
   * 走到最后一点 resolve；被新的 walkTo／walkAlong／sit 打断时也 resolve，interrupted 为 true。
   */
  walkAlong(points: THREE.Vector3Like[]): Promise<WalkResult> {
    this.settle(true);
    this.wantSit = false;
    const start = new THREE.Vector3(this.root.position.x, 0, this.root.position.z);
    const route = new Route([start, ...points.map((p) => new THREE.Vector3(p.x, 0, p.z))]);
    this.route = route.length > 1e-4 ? route : null;
    if (this.state === 'sit_down' || this.state === 'sit_idle') this.stand();
    if (!this.route) return Promise.resolve({ interrupted: false });
    return new Promise((resolve) => (this.arrive = resolve));
  }

  sit() {
    this.settle(true);
    this.route = null;
    this.wantSit = true;
  }

  stand() {
    this.wantSit = false;
    if (this.state === 'sit_down' || this.state === 'sit_idle') {
      this.state = 'stand_up';
      this.play('stand_up', 0.15);
    }
  }

  lookAt(point: THREE.Vector3Like | null) {
    this.gaze.target = point ? new THREE.Vector3(point.x, point.y, point.z) : null;
  }

  earFlick() {
    const action = this.actions.get('ear_flick');
    if (!action) return;
    action.reset().setEffectiveWeight(1).play();
  }

  /** 直接定格在某段动作的某一秒（截图验收用） */
  freeze(clip: string, time: number) {
    const action = this.actions.get(clip);
    if (!action) return;
    this.mixer.stopAllAction();
    action.reset().play();
    action.paused = true;
    action.time = Math.min(time, action.getClip().duration);
    this.base = action;
    this.mixer.update(0);
    this.rest.capture();
  }

  update(dt: number) {
    const previousYaw = this.yaw;
    const previousSpeed = this.speed;
    this.move(dt);
    this.yawRate = dt > 0 ? THREE.MathUtils.euclideanModulo(this.yaw - previousYaw + Math.PI, Math.PI * 2) / dt - Math.PI / dt : 0;
    this.acceleration = dt > 0 ? (this.speed - previousSpeed) / dt : 0;

    const walk = this.actions.get('walk');
    if (walk) walk.timeScale = (this.speed * this.walkDuration) / this.strideLength;

    this.rest.reset();
    this.mixer.update(dt);
    this.rest.capture();
    this.root.updateMatrixWorld(true);
    this.footLock.update(this.root, dt, this.state === 'walk' || this.state === 'turn' || this.state === 'idle');
    if (this.proceduralEnabled) {
      this.gaze.update(this.root, dt);
      this.tail.update(this.root, dt, this.yawRate, this.acceleration);
    }
    this.blink.enabled = this.proceduralEnabled;
    this.blink.update(dt);
  }

  private move(dt: number) {
    if (this.state === 'sit_down' || this.state === 'sit_idle' || this.state === 'stand_up') return;

    if (this.route) {
      const route = this.route;
      const position = this.root.position;
      const progress = route.advance(position);
      const end = route.end;
      const remaining = Math.max(route.length - progress, Math.hypot(end.x - position.x, end.z - position.z));
      // 急弯：先对准拐点走过去、在拐点停稳，到了再原地转；不抄近路切弯
      const corner = route.sharpCornerAhead(progress, 0.6, TURN_IN_PLACE_ENTER);
      const cornerAhead = corner !== null && corner > 0.01;
      const aim = cornerAhead && corner < LOOKAHEAD + 0.1 ? route.pointAt(progress + corner) : remaining < LOOKAHEAD ? end : route.pointAt(progress + LOOKAHEAD);
      const turn = wrapAngle(Math.atan2(aim.x - position.x, aim.z - position.z) - this.yaw);

      if (remaining < 0.006 && this.speed < 0.03) {
        this.speed = 0;
        this.route = null;
        this.settle(false);
      } else if (
        this.speed < 0.04 &&
        Math.abs(turn) > (this.state === 'turn' ? TURN_IN_PLACE_EXIT : TURN_IN_PLACE_ENTER)
      ) {
        this.setState('turn', 'turn_step');
        this.speed = 0;
        this.yaw += THREE.MathUtils.clamp(turn, -STEP_TURN_RATE * dt, STEP_TURN_RATE * dt);
      } else {
        this.setState('walk', 'walk');
        this.yaw += THREE.MathUtils.clamp(turn, -WALK_TURN_RATE * dt, WALK_TURN_RATE * dt);
        // 偏差越大越慢；前方有急弯时提前减速，好在弯前停稳再原地转
        const alignment = THREE.MathUtils.clamp((Math.cos(turn) - Math.cos(TURN_IN_PLACE_ENTER + 0.3)) / (1 - Math.cos(TURN_IN_PLACE_ENTER + 0.3)), 0, 1);
        const braking = Math.min(remaining, cornerAhead ? corner : Infinity);
        const wanted = Math.min(WALK_SPEED, Math.sqrt(2 * ACCELERATION * braking) + (cornerAhead ? 0.02 : 0)) * alignment;
        this.speed = approach(this.speed, wanted, ACCELERATION * dt);
        const step = Math.min(this.speed * dt, remaining);
        position.x += Math.sin(this.yaw) * step;
        position.z += Math.cos(this.yaw) * step;
      }
    } else {
      this.speed = approach(this.speed, 0, ACCELERATION * 2 * dt);
      if (this.speed === 0) {
        if (this.wantSit) {
          this.wantSit = false;
          this.state = 'sit_down';
          this.play('sit_down', 0.2);
        } else {
          this.setState('idle', 'idle');
        }
      }
    }
    this.root.rotation.y = this.yaw;
  }

  private setState(state: TuanziState, clip: string) {
    if (this.state === state) return;
    this.state = state;
    this.play(clip, FADE);
  }

  private play(name: string, fade: number) {
    const next = this.actions.get(name);
    if (!next || next === this.base) return;
    next.reset().setEffectiveWeight(1).play();
    if (fade > 0) next.fadeIn(fade);
    if (this.base) this.base.fadeOut(fade);
    this.base = next;
    this.lastTransitionAt = this.mixer.time;
  }

  private onFinished(action: THREE.AnimationAction) {
    const name = action.getClip().name;
    if (name === 'sit_down' && this.state === 'sit_down') {
      this.state = 'sit_idle';
      this.play('sit_idle', 0.2);
    } else if (name === 'stand_up' && this.state === 'stand_up') {
      this.state = 'idle';
      this.play('idle', 0.2);
    }
  }

  private settle(interrupted: boolean) {
    const resolve = this.arrive;
    this.arrive = null;
    resolve?.({ interrupted });
  }
}

export async function loadTuanzi(url: string): Promise<Tuanzi | null> {
  const model = await loadModel(url);
  return model ? new Tuanzi(model) : null;
}

/** 折线路径：按弧长取点，记住走到了哪一段，不往回跳。 */
class Route {
  readonly length: number;
  private readonly cumulative: number[];
  private segment = 0;

  constructor(private readonly points: THREE.Vector3[]) {
    this.points = points.filter((p, i) => i === 0 || p.distanceTo(points[i - 1]!) > 1e-4);
    this.cumulative = [0];
    for (let i = 1; i < this.points.length; i++) {
      this.cumulative.push(this.cumulative[i - 1]! + this.points[i]!.distanceTo(this.points[i - 1]!));
    }
    this.length = this.cumulative[this.cumulative.length - 1]!;
  }

  get end() {
    return this.points[this.points.length - 1]!;
  }

  /** 把当前位置投影到路上（只看当前段和后面两段），返回走过的弧长 */
  advance(position: THREE.Vector3Like) {
    let best = Infinity;
    let progress = this.cumulative[this.segment]!;
    const last = Math.min(this.segment + 2, this.points.length - 2);
    for (let i = this.segment; i <= last; i++) {
      const a = this.points[i]!;
      const b = this.points[i + 1]!;
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const t = THREE.MathUtils.clamp(((position.x - a.x) * abx + (position.z - a.z) * abz) / (abx * abx + abz * abz), 0, 1);
      const d = Math.hypot(a.x + abx * t - position.x, a.z + abz * t - position.z);
      if (d < best) {
        best = d;
        progress = this.cumulative[i]! + t * (this.cumulative[i + 1]! - this.cumulative[i]!);
        if (i > this.segment && t > 0) this.segment = i;
      }
    }
    return progress;
  }

  pointAt(distance: number) {
    const d = THREE.MathUtils.clamp(distance, 0, this.length);
    let i = 0;
    while (i < this.points.length - 2 && this.cumulative[i + 1]! < d) i++;
    const span = this.cumulative[i + 1]! - this.cumulative[i]!;
    const t = span > 0 ? (d - this.cumulative[i]!) / span : 0;
    return new THREE.Vector3().lerpVectors(this.points[i]!, this.points[i + 1]!, t);
  }

  /** 前方 within 米内第一个转角大于 angle 的拐点，返回离它还有多远；没有就返回 null */
  sharpCornerAhead(progress: number, within: number, angle: number) {
    for (let i = 1; i < this.points.length - 1; i++) {
      const ahead = this.cumulative[i]! - progress;
      if (ahead < 0) continue;
      if (ahead > within) break;
      const inX = this.points[i]!.x - this.points[i - 1]!.x;
      const inZ = this.points[i]!.z - this.points[i - 1]!.z;
      const outX = this.points[i + 1]!.x - this.points[i]!.x;
      const outZ = this.points[i + 1]!.z - this.points[i]!.z;
      if (Math.abs(wrapAngle(Math.atan2(outX, outZ) - Math.atan2(inX, inZ))) > angle) return ahead;
    }
    return null;
  }
}

function wrapAngle(angle: number) {
  return THREE.MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;
}

function approach(value: number, target: number, step: number) {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}
