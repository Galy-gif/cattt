import { RunMotion, type RunStage } from './run-motion.ts';
import { StretchMotion, type StretchStage } from './stretch-motion.ts';
import { ChaseMotion, type ChaseStage } from './chase-motion.ts';
import { ScratchMotion, type ScratchStage } from './scratch-motion.ts';
import * as THREE from 'three';
import { FlowerMotion, type FlowerStage } from './flower-motion.ts';
import { FenceMotion, type FenceStage } from './fence-motion.ts';
import { NestMotion, type NestStage } from './nest-motion.ts';
import { Appearance, loadModel, type Model } from './model';
import { Blink, FootLock, Gaze, RestPose, TailSpring, keepTailAboveBed } from './procedural';

export interface WalkResult {
  interrupted: boolean;
}

export type Expression = 'tilt' | 'groom' | 'happy' | 'sulk' | 'sad';
type LifeTarget = 'sleep' | 'doze' | 'drink' | 'pond' | Expression;
const EXPRESSIONS: readonly Expression[] = ['tilt', 'groom', 'happy', 'sulk', 'sad'];
export type TuanziState = RunStage | StretchStage | ChaseStage | ScratchStage | FlowerStage | FenceStage | 'pond_down' | 'pond_probe' | 'pond_pat' | 'pond_shake' | 'pond_up' | NestStage | `${Expression}_${'down' | 'idle' | 'up'}` | 'bed_hop' | 'idle' | 'turn' | 'walk' | 'sit_down' | 'sit_idle' | 'stand_up' | 'sleep_down' | 'sleep_idle' | 'sleep_up' | 'doze_down' | 'doze_up' | 'doze_idle' | 'drink_down' | 'drink_lap' | 'drink_up';

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

  /** 只有连续舔饮和抬头站稳全部完成，才增加一次。 */
  drinkCompletions = 0;
  bedSupport: { x: number; z: number } | null = null;
  private nest: NestMotion | null = null;
  private fence: FenceMotion | null = null;
  private run: RunMotion | null = null;
  private stretch: StretchMotion | null = null;
  private chase: ChaseMotion | null = null;
  private scratch: ScratchMotion | null = null;
  private flower: FlowerMotion | null = null;
  private lifeTarget: LifeTarget | null = null;
  private lifeSeconds = 0;
  private drinkEligible = false;
  private drinkTongueMaterial = new THREE.MeshStandardMaterial({ color: '#e58b87', roughness: .8 });
  // 理毛时舌头紧贴脸和爪，使用无镜面高光的暖肉粉色，并接受头部遮光。
  private groomTongueMaterial = new THREE.MeshLambertMaterial({ color: '#cc7164' });
  private tongue = new THREE.Mesh<THREE.SphereGeometry, THREE.Material>(new THREE.SphereGeometry(1, 12, 8), this.drinkTongueMaterial);
  private groomTongueGeometry = new THREE.SphereGeometry(1, 24, 12);
  private drinkTongueGeometry = this.tongue.geometry;
  private tongueRoot = new THREE.Vector3();
  private tongueRestRotation = new THREE.Quaternion();
  private hop: { from: THREE.Vector3; to: THREE.Vector3; time: number; resolve: (value: WalkResult) => void } | null = null;
  private faceGoal: number | null = null;
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
      if ((clip.name.startsWith('scratch_') && clip.name !== 'scratch_rake') || clip.name.startsWith('flower_') || (clip.name.startsWith('fence_') && clip.name !== 'fence_rest') || clip.name.startsWith('pond_') || (clip.name.startsWith('nest_') && !['nest_watch', 'nest_sleep'].includes(clip.name)) || /^(tilt|groom|happy|sulk|sad)_(down|up)$/.test(clip.name) || ['bed_hop', 'sit_down', 'stand_up', 'ear_flick', 'sleep_down', 'sleep_up', 'doze_down', 'doze_up', 'drink_down', 'drink_up'].includes(clip.name)) {
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
    this.rest = new RestPose([...this.gaze.bones, ...this.tail.chain, ...legs, ...['spine_02','spine_03','spine_04'].map(n=>model.bones.get(n)!)]);
    this.play('idle', 0);
    this.root.updateMatrixWorld(true);
    const head = model.bones.get('head')!;
    this.tongue.position.copy(head.worldToLocal(this.root.localToWorld(new THREE.Vector3(0, .17455, .215))));
    this.tongue.quaternion.copy(head.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(this.root.getWorldQuaternion(new THREE.Quaternion())));
    this.tongueRoot.copy(this.tongue.position);
    this.tongueRestRotation.copy(this.tongue.quaternion);
    this.tongue.scale.set(.0038, .0014, .006);
    this.tongue.visible = false; head.add(this.tongue);
  }

  /** 脚底中心的世界坐标（只读） */
  get position(): Readonly<THREE.Vector3> {
    return this.root.position;
  }

  /** 朝向：绕 Y 的弧度，0 = 朝 +Z，范围 −π 到 π */
  get facing() {
    return wrapAngle(this.yaw);
  }

  snapshotActivity() {
    return { run: this.run?.data ?? null, stretch: this.stretch?.data ?? null, chase: this.chase?.data ?? null, scratch: this.scratch?.data ?? null, flower: this.flower?.data ?? null, fence: this.fence?.data ?? null, nest: this.nest?.data ?? null, state: this.state, clip: this.base?.getClip().name, time: this.base?.time ?? 0,
      target: this.lifeTarget, seconds: this.lifeSeconds, eligible: this.drinkEligible,
      completions: this.drinkCompletions, closure: this.blink.closure,
      hop: this.hop ? { from: this.hop.from.toArray(), to: this.hop.to.toArray(), time: this.hop.time } : null };
  }
  restoreActivity(value: ReturnType<Tuanzi['snapshotActivity']>) {
    if (!value.clip || !this.actions.has(value.clip)) return;
    this.settle(true); this.route = null; this.wantSit = false; this.speed = 0; this.faceGoal = null;
    this.run = value.run ? new RunMotion(this.position,this.facing,value.run) : null;
    this.stretch = value.stretch ? new StretchMotion(this.position,this.facing,value.stretch) : null;
    this.chase = value.chase ? new ChaseMotion(this.position,this.facing,value.chase) : null;
    this.scratch = value.scratch ? new ScratchMotion(this.position, value.scratch) : null;
    this.flower = value.flower ? new FlowerMotion(this.position,value.flower) : null;
    this.fence = value.fence ? new FenceMotion(this.position, value.fence) : null;
    this.nest = value.nest ? new NestMotion(this.position, value.nest.sleep, value.nest) : null;
    this.state = value.state; this.lifeTarget = value.target; this.lifeSeconds = value.seconds;
    this.drinkEligible = value.eligible; this.drinkCompletions = value.completions; this.blink.closure = value.closure;
    this.mixer.stopAllAction(); this.base = null; this.play(value.clip, 0); this.actions.get(value.clip)!.time = value.time;
    if (value.hop) this.hop = { from: new THREE.Vector3().fromArray(value.hop.from), to: new THREE.Vector3().fromArray(value.hop.to), time: value.hop.time, resolve: () => {} };
    this.mixer.update(0); this.rest.capture(); this.root.updateMatrixWorld(true); this.updateFace();
  }

  /** 内容进程重建时恢复世界姿态，移动路线由调用方重新接续。 */
  restorePose(position: THREE.Vector3Like, facing: number) {
    this.run = null; this.stretch = null; this.chase = null; this.scratch = null; this.flower = null; this.fence = null; this.nest = null; this.root.rotation.set(0, facing, 0);
    this.hop?.resolve({ interrupted: true }); this.hop = null; this.faceGoal = null;
    this.lifeTarget = null; this.drinkEligible = false;
    this.settle(true);
    this.route = null;
    this.speed = 0;
    this.wantSit = false;
    this.state = 'idle';
    this.yaw = facing;
    this.root.position.copy(position);
    this.root.rotation.y = facing;
    this.play('idle', 0);
  }

  /** 专用猫窝跨沿动作。新意图要等落脚后再接路线，不能半空换路。 */
  hopTo(point: THREE.Vector3Like): Promise<WalkResult> {
    if (this.hop) throw new Error('猫窝起落尚未结束');
    this.stand(); this.settle(true); this.route = null; this.speed = 0;
    return new Promise(resolve => { this.hop = { from: this.root.position.clone(), to: new THREE.Vector3().copy(point), time: 0, resolve }; });
  }
  faceToward(point: THREE.Vector3Like) { this.stand(); this.faceGoal = Math.atan2(point.x - this.position.x, point.z - this.position.z); }
  get facingReady() { return this.faceGoal === null; }
  get hopping() { return this.hop !== null; }

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
    this.faceGoal = null;
    this.stand();
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
    this.endLife();
    this.settle(true);
    this.route = null;
    this.wantSit = true;
  }

  stand() {
    if (this.run) this.run.data.exit=true;
    if (this.stretch) this.stretch.data.exit=true;
    if (this.chase) this.chase.data.exit=true;
    if (this.scratch) this.scratch.data.exit = true;
    if (this.flower) this.flower.data.exit = true;
    if (this.fence) this.fence.data.exit = true;
    if (this.nest) this.nest.data.exit = true;
    this.endLife();
    this.wantSit = false;
    if (this.state === 'sit_down' || this.state === 'sit_idle') {
      this.state = 'stand_up';
      this.play('stand_up', 0.15);
    }
  }

  playRun() {
    this.stand();this.settle(true);this.route=null;this.speed=0;this.bedSupport=null;this.faceGoal=null;
    this.run=new RunMotion(this.position,this.facing);this.state='run_ready';this.play('idle',.1);
  }
  get running(){return this.run!==null;}
  private updateRun(dt:number){
    if(!this.run)return;
    this.run.update(dt);this.root.position.copy(this.run.point);
    if(this.run.done){this.run=null;this.state='idle';return;}
    this.state=this.run.data.stage;
  }
  playStretch() {
    this.stand();this.settle(true);this.route=null;this.speed=0;this.bedSupport=null;this.faceGoal=null;
    this.stretch=new StretchMotion(this.position,this.facing);this.state='stretch_reach';this.play('idle',.1);
  }
  get playingStretch(){return this.stretch!==null;}
  private updateStretch(dt:number){
    if(!this.stretch)return;
    this.stretch.update(dt);
    if(this.stretch.done){this.root.position.y=this.stretch.data.entry[1]!;this.stretch=null;this.state='idle';return;}
    this.state=this.stretch.data.stage;
  }
  playChase() {
    this.stand();this.settle(true);this.route=null;this.speed=0;this.bedSupport=null;this.faceGoal=null;
    this.chase=new ChaseMotion(this.position,this.facing);this.state='chase_look';this.play('idle',.1);
  }
  get playingChase(){return this.chase!==null;}
  private updateChase(dt:number){
    if(!this.chase)return;
    this.chase.update(dt);this.yaw=this.chase.yaw;this.root.rotation.set(0,this.yaw,0);
    if(this.chase.done){this.root.position.y=this.chase.data.entry[1]!;this.chase=null;this.state='idle';return;}
    this.state=this.chase.data.stage;
  }
  playScratch() {
    this.stand(); this.settle(true); this.route=null; this.speed=0; this.bedSupport=null;
    this.scratch=new ScratchMotion(this.position);this.state='scratch_reach';this.play('scratch_reach',.1);
  }
  get playingScratch(){return this.scratch!==null;}
  private updateScratch(dt:number){
    if(!this.scratch)return;
    this.scratch.update(dt);const {point,yaw}=this.scratch.pose;
    this.root.position.copy(point);this.yaw=yaw;this.root.rotation.set(0,yaw,0);
    if(this.scratch.done){this.scratch=null;this.state='idle';this.play('idle',.1);return;}
    const state=this.scratch.data.stage;
    if(this.state!==state){this.state=state;this.play(state==='scratch_release'?'scratch_reach':state==='scratch_settle'?'fence_land':state,.035);}
    if(this.base){
      this.base.paused=false;
      const time=this.scratch.data.time;
      this.base.time=(state==='scratch_rake'?time%.8:state==='scratch_release'?1.25-time:time)-dt;
    }
  }
  playFlower() {
    this.stand(); this.settle(true); this.route=null; this.speed=0; this.bedSupport=null;
    this.flower=new FlowerMotion(this.position);this.state='flower_watch';this.play('flower_watch',.1);
  }
  get playingFlower(){return this.flower!==null;}
  get flowerPaw(){return this.flower ? this.model.bones.get('front_L_paw')!.localToWorld(new THREE.Vector3(0,.028,0)) : null;}
  private updateFlower(dt:number){
    if(!this.flower)return;
    this.flower.update(dt);const {point,yaw}=this.flower.pose;
    this.root.position.copy(point);this.yaw=yaw;this.root.rotation.set(0,yaw,0);
    if(this.flower.done){this.flower=null;this.state='idle';this.play('idle',.1);return;}
    const state=this.flower.data.stage;
    if(this.state!==state){this.state=state;this.play(state,.035);}
    if(this.base)this.base.time=this.flower.data.time-dt;
  }
  enterFence() {
    this.stand(); this.settle(true); this.route = null; this.speed = 0; this.bedSupport = null;
    this.fence = new FenceMotion(this.position); this.state = 'fence_reach'; this.play('fence_reach', .12);
  }
  get fencing() { return this.fence !== null; }
  get fenceSettled() { return this.fence?.settled ?? false; }
  private updateFence(dt: number) {
    if (!this.fence) return;
    this.fence.update(dt);
    const {point,yaw} = this.fence.pose;
    this.root.position.copy(point); this.yaw = yaw; this.root.rotation.set(0,yaw,0);
    if (this.fence.done) { this.fence = null; this.state = 'idle'; this.play('idle', .15); return; }
    const state = this.fence.data.stage;
    if (this.state !== state) { this.state = state; this.play(state, ['fence_jump','fence_grip','fence_drop','fence_land'].includes(state) ? .035 : .06); }
    // 接触点按同一时间采样，避免根节点先走一帧而爪子落后一帧。
    if (this.base) this.base.time = this.fence.data.time - dt;
  }
  enterNest(sleep: boolean) {
    this.stand(); this.settle(true); this.route = null; this.speed = 0; this.bedSupport = null;
    this.nest = new NestMotion(this.position, sleep);
    this.state = 'nest_jump'; this.play('nest_jump', .12);
  }
  setNestRest(sleep: boolean) { if (this.nest && !this.nest.data.exit) this.nest.data.sleep = sleep; }
  get nestCanRest() { return !!this.nest && !this.nest.data.exit; }
  get nesting() { return this.nest !== null; }
  get nestSettled() { return this.nest?.settled ?? false; }
  get nestLoad() { return this.nest?.pose.weight ?? 0; }
  applyNestSupport(transform: THREE.Matrix4) {
    if (!this.nest) return;
    const { point, yaw, weight } = this.nest.pose;
    this.root.position.copy(point).lerp(point.clone().applyMatrix4(transform), weight);
    const q = new THREE.Quaternion().setFromRotationMatrix(transform);
    this.root.quaternion.copy(new THREE.Quaternion().slerp(q, weight)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw));
    this.root.updateMatrixWorld(true);
  }
  private updateNest(dt: number) {
    if (!this.nest) return;
    this.nest.update(dt);
    const { point, yaw } = this.nest.pose;
    this.root.position.copy(point); this.yaw = yaw; this.root.rotation.set(0,yaw,0);
    if (this.nest.done) { this.nest = null; this.state = 'idle'; this.play('idle', .15); return; }
    const state = this.nest.data.stage;
    if (this.state !== state) { this.state = state; this.play(state === 'nest_turn_out' ? 'nest_turn' : state, .1); }
  }
  sleep() { this.requestLife('sleep'); }
  doze() { this.requestLife('doze'); }
  drink() { this.requestLife('drink'); }
  playPond() { this.requestLife('pond'); }
  get pondBusy() { return this.lifeTarget === 'pond' || this.state.startsWith('pond_'); }
  get pondPaw() { return this.state.startsWith('pond_') ? this.model.bones.get('front_R_paw')!.getWorldPosition(new THREE.Vector3()) : null; }
  express(kind: Expression) { this.requestLife(kind); }
  private requestLife(target: LifeTarget) {
    if (this.lifeTarget === target) return;
    this.stand(); this.settle(true); this.route = null; this.speed = 0;
    this.lifeTarget = target; this.lookAt(null);
  }
  private endLife() {
    this.lifeTarget = null; this.drinkEligible = false;
    if (this.state.startsWith('pond_') && this.state !== 'pond_up') { this.state = 'pond_up'; this.play('pond_up', .3); }
    for (const kind of EXPRESSIONS) if (this.state === `${kind}_down` || this.state === `${kind}_idle`) this.rise(kind);
    if (this.state === 'sleep_down' || this.state === 'sleep_idle') this.rise('sleep');
    if (this.state === 'drink_down' || this.state === 'drink_lap') this.rise('drink');
    if (this.state === 'doze_down' || this.state === 'doze_idle') this.rise('doze');
  }
  private rise(kind: LifeTarget) {
    const fraction = this.state === `${kind}_down` && this.base ? this.base.time / this.base.getClip().duration : 1;
    this.state = `${kind}_up`; this.play(this.state, .12);
    const action = this.actions.get(this.state)!;
    action.time = (1 - fraction) * action.getClip().duration;
  }
  get drinkingPhase(): number | null { return this.state === 'drink_lap' ? this.lifeSeconds % 2.4 : null; }
  private updateLife(dt: number) {
    if (this.lifeTarget === 'pond' && this.state === 'idle') { this.state = 'pond_down'; this.play('pond_down', .2); }
    if (this.lifeTarget && EXPRESSIONS.includes(this.lifeTarget as Expression) && this.state === 'idle') {
      this.state = `${this.lifeTarget}_down`; this.play(this.state, .2);
    }
    if (this.lifeTarget === 'doze' && this.state === 'idle') { this.state = 'doze_down'; this.play('doze_down', .2); }
    if (this.state === 'idle' && (this.lifeTarget === 'sleep' || this.lifeTarget === 'drink')) {
      this.state = this.lifeTarget === 'sleep' ? 'sleep_down' : 'drink_down';
      this.lifeSeconds = 0; this.drinkEligible = this.lifeTarget === 'drink'; this.play(this.state, .2);
    }
    if (this.state === 'drink_lap') {
      this.lifeSeconds += dt;
      if (this.lifeSeconds >= 7.2) { this.state = 'drink_up'; this.lifeTarget = null; this.play('drink_up', .12); }
    }
    const asleep = this.state === 'nest_sleep' || this.state === 'nest_down' || this.state === 'sleep_idle' || this.state === 'sleep_down' || this.state === 'doze_idle';
    this.blink.closure = THREE.MathUtils.damp(this.blink.closure, asleep ? 1 : 0, 4, dt);
    const cycle = this.lifeSeconds % 2.4;
    const lap = cycle < 2 ? Math.sin(Math.PI * ((cycle * 4) % 1)) ** 2 : 0;
    this.tongue.visible = this.state === 'drink_lap' && lap > .1;
    this.tongue.scale.z = .002 + .005 * lap;
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
    this.updateFace();
  }

  update(dt: number) {
    this.updateRun(dt);
    this.updateStretch(dt);
    this.updateChase(dt);
    this.updateScratch(dt);
    this.updateFlower(dt);
    this.updateFence(dt);
    this.updateNest(dt);
    this.updateLife(dt);
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
    if (this.proceduralEnabled && !this.nest && !this.fence && !this.flower && !this.scratch && !this.chase && !this.stretch && !this.run && !EXPRESSIONS.some(kind => this.state.startsWith(kind + '_')) && !this.state.startsWith('pond_') && !this.state.startsWith('sleep') && !this.state.startsWith('drink') && !this.state.startsWith('doze') && this.state !== 'bed_hop') {
      this.gaze.update(this.root, dt);
      this.tail.update(this.root, dt, this.yawRate, this.acceleration);
    }
    this.run?.apply(this.root,this.model.bones);
    this.stretch?.apply(this.root,this.model.bones);
    this.chase?.apply(this.root,this.model.bones);
    if (this.bedSupport) keepTailAboveBed(this.tail.chain, this.bedSupport);
    this.tongue.position.copy(this.tongueRoot);
    this.tongue.geometry = this.state === 'groom_idle' ? this.groomTongueGeometry : this.drinkTongueGeometry;
    this.tongue.scale.x = .0038; this.tongue.scale.y = .0014;
    this.tongue.material = this.state === 'groom_idle' ? this.groomTongueMaterial : this.drinkTongueMaterial;
    this.tongue.receiveShadow = this.state === 'groom_idle';
    if (this.state === 'groom_idle') {
      const pulse = Math.sin(Math.PI * 3 * (this.base?.time ?? 0) / 4.8) ** 2;
      // 扁平圆舌尖从唇线向外展开，根部藏在嘴内；不能只露出针尖。
      this.tongue.position.add(new THREE.Vector3(0, 0, .004 * pulse).applyQuaternion(this.tongueRestRotation));
      const head = this.model.bones.get('head')!;
      const paw = head.worldToLocal(this.model.bones.get('front_R_paw')!.getWorldPosition(new THREE.Vector3()));
      this.tongue.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), paw.sub(this.tongue.position).normalize());
      this.tongue.visible = pulse > .08;
      this.tongue.scale.set(.006 + .003 * pulse, .0018, .004 + .018 * pulse);
    } else this.tongue.quaternion.copy(this.tongueRestRotation);
    this.blink.enabled = this.proceduralEnabled;
    this.blink.update(dt);
    this.updateFace();
  }

  private updateFace() {
    this.appearance.face.update(this.base?.getClip().name ?? this.state, this.base?.time ?? 0, this.base?.getClip().duration ?? 1);
  }

  private move(dt: number) {
    if (this.nest || this.fence || this.flower || this.scratch || this.chase || this.stretch || this.run) return;
    if (this.hop && (this.state === 'idle' || this.state === 'bed_hop')) {
      const h = this.hop;
      if (this.state !== 'bed_hop') { this.state = 'bed_hop'; this.play('bed_hop', .12); }
      h.time = Math.min(1.4, h.time + dt);
      const t = h.time / 1.4, u = THREE.MathUtils.smoothstep(t, .12, .88);
      this.root.position.lerpVectors(h.from, h.to, u);
      this.root.position.y += .32 * Math.sin(Math.PI * u);
      if (h.time >= 1.4) { this.hop = null; this.root.position.copy(h.to); this.state = 'idle'; this.play('idle', .12); h.resolve({ interrupted: false }); }
      return;
    }
    if (!['idle', 'turn', 'walk'].includes(this.state)) return;

    if (this.faceGoal !== null) {
      const turn = wrapAngle(this.faceGoal - this.yaw);
      if (Math.abs(turn) < .005) { this.yaw = this.faceGoal; this.faceGoal = null; this.setState('idle', 'idle'); }
      else { this.setState('turn', 'turn_step'); this.yaw += THREE.MathUtils.clamp(turn, -STEP_TURN_RATE * dt, STEP_TURN_RATE * dt); }
      this.root.rotation.y = this.yaw; return;
    }
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
    const pondSequence = ['pond_down','pond_probe','pond_pat','pond_shake','pond_up'] as const;
    const pondIndex = pondSequence.indexOf(name as typeof pondSequence[number]);
    if (pondIndex >= 0 && this.state === name) {
      const next = pondSequence[pondIndex + 1];
      if (!next) this.lifeTarget = null;
      this.state = next ?? 'idle'; this.play(this.state, .16); return;
    }
    for (const kind of EXPRESSIONS) {
      if (name === `${kind}_down` && this.state === name) { this.state = `${kind}_idle`; this.play(this.state, .15); return; }
      if (name === `${kind}_up` && this.state === name) { this.state = 'idle'; this.play('idle', .15); return; }
    }
    if (name === 'doze_down' && this.state === 'doze_down') { this.state = 'doze_idle'; this.play('doze_idle', .2); }
    else if (name === 'doze_up' && this.state === 'doze_up') { this.state = 'idle'; this.play('idle', .15); }
    else if (name === 'sleep_down' && this.state === 'sleep_down') { this.state = 'sleep_idle'; this.play('sleep_idle', .15); }
    else if (name === 'sleep_up' && this.state === 'sleep_up') { this.state = 'idle'; this.play('idle', .15); }
    else if (name === 'drink_down' && this.state === 'drink_down') { this.state = 'drink_lap'; this.lifeSeconds = 0; this.play('drink_lap', .12); }
    else if (name === 'drink_up' && this.state === 'drink_up') {
      if (this.drinkEligible) this.drinkCompletions++;
      this.drinkEligible = false; this.state = 'idle'; this.play('idle', .15);
    }
    else if (name === 'sit_down' && this.state === 'sit_down') {
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
