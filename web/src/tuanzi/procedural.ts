import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const LEFT = new THREE.Vector3(1, 0, 0); // 猫脸朝 +Z，它的左边是 +X
const deg = THREE.MathUtils.degToRad;

const _parent = new THREE.Quaternion();
const _delta = new THREE.Quaternion();
const _axisUp = new THREE.Vector3();
const _axisLeft = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * 按世界坐标轴给骨骼叠一层旋转：先绕猫的竖轴转 yaw，再绕猫的左右轴抬头 pitch。
 * 与 Blender 里骨骼自身的轴向无关。
 */
export function addWorldTurn(bone: THREE.Bone, root: THREE.Object3D, yaw: number, pitch: number) {
  root.getWorldQuaternion(_q);
  _axisUp.copy(UP).applyQuaternion(_q);
  _axisLeft.copy(LEFT).applyQuaternion(_q);
  _delta.setFromAxisAngle(_axisUp, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(_axisLeft, -pitch));
  bone.parent!.getWorldQuaternion(_parent);
  // local' = parent⁻¹ · delta · parent · local
  bone.quaternion.premultiply(_parent.clone().invert().multiply(_delta).multiply(_parent));
}

/**
 * 每帧先恢复上帧播放器给出的姿势，再采集这一帧的动画结果。
 * 不能恢复绑定姿势：AnimationMixer 会跳过没有变化的常量轨道，坐姿尾巴会因此被抹掉。
 */
export class RestPose {
  private rest = new Map<THREE.Bone, THREE.Quaternion>();
  constructor(bones: THREE.Bone[]) {
    for (const bone of bones) this.rest.set(bone, bone.quaternion.clone());
  }
  reset() {
    for (const [bone, quaternion] of this.rest) bone.quaternion.copy(quaternion);
  }
  capture() {
    for (const [bone, quaternion] of this.rest) quaternion.copy(bone.quaternion);
  }
}

/**
 * 看光标（3dviz expression-attention-rig）：视线先由头分担，超出再带脖子；
 * 目标在身后就放弃；目标消失后慢慢回正。
 */
export class Gaze {
  target: THREE.Vector3 | null = null;
  /** 视线大幅跳转时通知眨眼 */
  onSaccade: (() => void) | null = null;

  private yaw = 0;
  private pitch = 0;
  private weight = 0;
  private lastYawTarget = 0;
  private readonly chain: { bone: THREE.Bone; share: number }[];
  private readonly head: THREE.Bone;

  constructor(bones: Map<string, THREE.Bone>) {
    this.head = bones.get('head')!;
    this.chain = [
      { bone: bones.get('neck_01')!, share: 0.2 },
      { bone: bones.get('neck_02')!, share: 0.25 },
      { bone: this.head, share: 0.55 },
    ];
  }

  get bones() {
    return this.chain.map((c) => c.bone);
  }

  update(root: THREE.Object3D, dt: number) {
    let yawTarget = 0;
    let pitchTarget = 0;
    let weightTarget = 0;
    if (this.target) {
      const eye = root.worldToLocal(this.head.getWorldPosition(new THREE.Vector3()));
      const aim = root.worldToLocal(this.target.clone()).sub(eye);
      const yaw = Math.atan2(aim.x, aim.z);
      if (Math.abs(yaw) < deg(110)) {
        yawTarget = THREE.MathUtils.clamp(yaw, -deg(45), deg(45));
        pitchTarget = THREE.MathUtils.clamp(Math.atan2(aim.y, Math.hypot(aim.x, aim.z)), -deg(25), deg(30));
        weightTarget = 1;
      }
    }
    if (Math.abs(yawTarget - this.lastYawTarget) > deg(30)) this.onSaccade?.();
    this.lastYawTarget = yawTarget;

    const follow = 1 - Math.exp(-dt * 7);
    this.yaw += (yawTarget - this.yaw) * follow;
    this.pitch += (pitchTarget - this.pitch) * follow;
    this.weight += (weightTarget - this.weight) * (1 - Math.exp(-dt * 2.5));

    for (const { bone, share } of this.chain) {
      addWorldTurn(bone, root, this.yaw * share * this.weight, this.pitch * share * this.weight);
    }
  }
}

/** 眨眼：间隔 2–6 秒随机，偶尔连眨两下；视线大跳时顺带眨一下。 */
export class Blink {
  closure = 0;
  private wait = 1.5 + Math.random() * 3;
  private t = -1;
  private repeats = 0;
  enabled = true;

  constructor(private targets: { mesh: THREE.Mesh; index: number }[]) {}

  trigger() {
    if (this.t < 0) {
      this.t = 0;
      this.repeats = 0;
    }
  }

  update(dt: number) {
    let value = 0;
    if (this.t < 0) {
      if (this.enabled) this.wait -= dt;
      if (this.wait <= 0) {
        this.t = 0;
        this.repeats = Math.random() < 0.15 ? 1 : 0;
      }
    } else {
      this.t += dt;
      const t = this.t;
      value = t < 0.06 ? THREE.MathUtils.smootherstep(t, 0, 0.06) : t < 0.08 ? 1 : 1 - THREE.MathUtils.smootherstep(t, 0.08, 0.17);
      if (t >= 0.17) {
        if (this.repeats-- > 0) this.t = 0;
        else {
          this.t = -1;
          this.wait = 2 + Math.random() * 4;
        }
      }
    }
    for (const { mesh, index } of this.targets) mesh.morphTargetInfluences![index] = Math.max(value, this.closure);
  }
}

/** 尾巴二阶弹簧：身体转向和加减速时尾巴滞后，停下后回摆。 */
export class TailSpring {
  private readonly bones: THREE.Bone[];
  private sway: { angle: number; velocity: number }[];
  private lift: { angle: number; velocity: number }[];

  constructor(bones: Map<string, THREE.Bone>) {
    this.bones = [];
    for (let i = 1; bones.has(`tail_${String(i).padStart(2, '0')}`); i++) {
      this.bones.push(bones.get(`tail_${String(i).padStart(2, '0')}`)!);
    }
    this.sway = this.bones.map(() => ({ angle: 0, velocity: 0 }));
    this.lift = this.bones.map(() => ({ angle: 0, velocity: 0 }));
  }

  get chain() {
    return this.bones;
  }

  update(root: THREE.Object3D, dt: number, yawRate: number, acceleration: number) {
    const step = Math.min(dt, 1 / 30);
    const n = this.bones.length;
    for (let i = 0; i < n; i++) {
      const along = i / (n - 1);
      const stiffness = THREE.MathUtils.lerp(80, 22, along);
      const damping = 2 * 0.3 * Math.sqrt(stiffness);
      const swayTarget = THREE.MathUtils.clamp(-yawRate * 0.05 * (0.3 + along), -deg(9), deg(9));
      const liftTarget = THREE.MathUtils.clamp(-acceleration * 0.04 * (0.3 + along), -deg(6), deg(6));
      for (const [state, target] of [[this.sway[i]!, swayTarget], [this.lift[i]!, liftTarget]] as const) {
        state.velocity += (stiffness * (target - state.angle) - damping * state.velocity) * step;
        state.angle += state.velocity * step;
      }
      addWorldTurn(this.bones[i]!, root, this.sway[i]!.angle, this.lift[i]!.angle);
    }
  }
}

const LEGS = ['front_L', 'front_R', 'hind_L', 'hind_R'] as const;

interface LockedLeg {
  upper: THREE.Bone;
  lower: THREE.Bone;
  paw: THREE.Bone;
  /** 绑定姿势下腕关节离地的高度，低于它一点就算着地 */
  restHeight: number;
  lock: THREE.Vector3;
  planted: boolean;
  weight: number;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _goal = new THREE.Vector3();
const _ac = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _ba = new THREE.Vector3();
const _bc = new THREE.Vector3();
const _at = new THREE.Vector3();
const _axis0 = new THREE.Vector3();
const _axis1 = new THREE.Vector3();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qPaw = new THREE.Quaternion();
const _r0 = new THREE.Quaternion();
const _r1 = new THREE.Quaternion();
const _r2 = new THREE.Quaternion();

/**
 * 着地锁脚：动作片段里爪子着地时，记下它在世界里的位置，之后用两节腿的 IK 把腕关节按回那里，
 * 直到片段把爪子抬起来。这样边走边转弯时，身子绕中心转，着地的爪子也不会被扫开。
 * 只锁水平位置，高度仍听片段的；偏离超过 maxOffset 就放开，让这一步自然迈出去。
 */
export class FootLock {
  enabled = true;
  maxOffset = 0.05;
  private readonly legs: LockedLeg[];

  constructor(bones: Map<string, THREE.Bone>, root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    this.legs = LEGS.map((name) => {
      const paw = bones.get(`${name}_paw`)!;
      const wrist = root.worldToLocal(paw.getWorldPosition(new THREE.Vector3()));
      return {
        upper: bones.get(`${name}_upper`)!,
        lower: bones.get(`${name}_lower`)!,
        paw,
        restHeight: wrist.y,
        lock: new THREE.Vector3(),
        planted: false,
        weight: 0,
      };
    });
  }

  update(root: THREE.Object3D, dt: number, active: boolean) {
    for (const leg of this.legs) {
      const wrist = leg.paw.getWorldPosition(_a);
      const planted = this.enabled && active && wrist.y - root.position.y < leg.restHeight + 0.003;
      if (planted && !leg.planted) leg.lock.copy(wrist);
      leg.planted = planted;
      leg.weight += ((planted ? 1 : 0) - leg.weight) * (1 - Math.exp(-dt * (planted ? 40 : 25)));
      if (leg.weight < 0.001) continue;
      if (Math.hypot(leg.lock.x - wrist.x, leg.lock.z - wrist.z) > this.maxOffset) {
        leg.lock.copy(wrist);
        continue;
      }
      _goal.set(leg.lock.x, wrist.y, leg.lock.z);
      _goal.lerpVectors(wrist, _goal, leg.weight);
      solveTwoBone(leg, _goal, root);
    }
  }
}

/** 两节骨骼的解析 IK（Holden, "Simple Two Joint IK"），爪子保持原来的世界朝向。 */
function solveTwoBone(leg: Pick<LockedLeg, 'upper' | 'lower' | 'paw'>, target: THREE.Vector3, root: THREE.Object3D) {
  const a = leg.upper.getWorldPosition(_a);
  const b = leg.lower.getWorldPosition(_b);
  const c = leg.paw.getWorldPosition(_c);
  leg.paw.getWorldQuaternion(_qPaw);
  const lab = b.distanceTo(a);
  const lcb = c.distanceTo(b);
  const lat = THREE.MathUtils.clamp(target.distanceTo(a), 0.001, lab + lcb - 0.0005);
  const clampCos = (v: number) => Math.acos(THREE.MathUtils.clamp(v, -1, 1));

  _ac.subVectors(c, a).normalize();
  _ab.subVectors(b, a).normalize();
  _ba.subVectors(a, b).normalize();
  _bc.subVectors(c, b).normalize();
  _at.subVectors(target, a).normalize();
  const acab0 = clampCos(_ac.dot(_ab));
  const babc0 = clampCos(_ba.dot(_bc));
  const acat0 = clampCos(_ac.dot(_at));
  const acab1 = clampCos((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat));
  const babc1 = clampCos((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb));

  _axis0.crossVectors(_ac, _ab);
  if (_axis0.lengthSq() < 1e-12) _axis0.copy(LEFT).applyQuaternion(root.getWorldQuaternion(_qa));
  _axis0.normalize();
  _axis1.crossVectors(_ac, _at);
  const swing = _axis1.lengthSq() > 1e-12;
  _axis1.normalize();

  leg.upper.getWorldQuaternion(_qa).invert();
  leg.lower.getWorldQuaternion(_qb).invert();
  _r0.setFromAxisAngle(_axis0.clone().applyQuaternion(_qa), acab1 - acab0);
  _r1.setFromAxisAngle(_axis0.applyQuaternion(_qb), babc1 - babc0);
  if (swing) _r2.setFromAxisAngle(_axis1.applyQuaternion(_qa), acat0);
  else _r2.identity();

  leg.upper.quaternion.multiply(_r0.multiply(_r2));
  leg.lower.quaternion.multiply(_r1);
  leg.upper.updateMatrixWorld(true);
  leg.lower.getWorldQuaternion(_qb).invert();
  leg.paw.quaternion.copy(_qb.multiply(_qPaw));
  leg.paw.updateMatrixWorld(true);
}

/** 按尾巴实际骨长跨过猫窝软沿；只改姿势，不缩尾巴、不抬整只猫。 */
export function keepTailAboveBed(chain: THREE.Bone[], center: { x: number; z: number }) {
  const head = new THREE.Vector3(), end = new THREE.Vector3(), sample = new THREE.Vector3();
  const worldTurn = new THREE.Quaternion(), parent = new THREE.Quaternion();
  for (let i = 0; i < chain.length - 1; i++) {
    const bone = chain[i]!, child = chain[i + 1]!;
    bone.getWorldPosition(head); child.getWorldPosition(end);
    const length = head.distanceTo(end), radius = .035 - .01 * i / chain.length + .009;
    let clearance = -Infinity;
    for (let j = 0; j <= 8; j++) {
      sample.lerpVectors(head, end, j / 8);
      const rho = Math.hypot(sample.x - center.x, (sample.z - center.z) / .86);
      // 扩大到毛毡尾巴表面半径，再对整段留顶沿余量。
      if (Math.abs(rho - .26) < .068 + radius) clearance = .123 + radius;
    }
    if (end.y >= clearance || !Number.isFinite(clearance)) continue;
    const direction = end.clone().sub(head).normalize();
    const y = THREE.MathUtils.clamp((clearance - head.y) / length, -.98, .98);
    const wanted = new THREE.Vector3(direction.x, 0, direction.z).normalize().multiplyScalar(Math.sqrt(1 - y * y)); wanted.y = y;
    worldTurn.setFromUnitVectors(direction, wanted);
    bone.parent!.getWorldQuaternion(parent);
    bone.quaternion.premultiply(parent.clone().invert().multiply(worldTurn).multiply(parent));
    bone.updateMatrixWorld(true);
  }
}

/** 专用动作的确定性落脚目标，复用两节腿IK。 */
export function placePaw(bones: Map<string,THREE.Bone>, root: THREE.Object3D, name: string, target: THREE.Vector3) {
  solveTwoBone({upper:bones.get(name+'_upper')!,lower:bones.get(name+'_lower')!,paw:bones.get(name+'_paw')!},target,root);
}
