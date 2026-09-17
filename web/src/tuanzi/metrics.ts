import * as THREE from 'three';
import type { Tuanzi } from './tuanzi';

const PAWS = ['front_L_paw', 'front_R_paw', 'hind_L_paw', 'hind_R_paw'];
const BODY_LENGTH = 0.38; // 屁股后沿到头前沿，米
const WALK_SPEED = 0.25;

/**
 * 方案第 6 节两条动作判据的实时量测：
 * - 走路不滑：着地期间爪子（腕关节）的水平漂移，÷ 身长
 * - 切换连贯：动作切换后 0.5 秒内，骨盆相对猫本体的移动速度 ÷ 走路速度
 */
export class MotionMetrics {
  maxSlip = 0;
  maxTransition = 0;

  private paws: { bone: THREE.Bone; restY: number; start: THREE.Vector3 | null }[];
  private pelvis: THREE.Bone;
  private lastPelvis: THREE.Vector3 | null = null;
  private readonly world = new THREE.Vector3();

  constructor(private cat: Tuanzi) {
    cat.root.updateMatrixWorld(true);
    this.paws = PAWS.map((name) => {
      const bone = cat.model.bones.get(name)!;
      return { bone, restY: bone.getWorldPosition(new THREE.Vector3()).y, start: null };
    });
    this.pelvis = cat.model.bones.get('spine_01')!;
  }

  reset() {
    this.maxSlip = 0;
    this.maxTransition = 0;
  }

  update(dt: number) {
    const walking = this.cat.state === 'walk' && this.cat.speed > 0.15;
    for (const paw of this.paws) {
      paw.bone.getWorldPosition(this.world);
      const planted = walking && this.world.y < paw.restY + 0.002;
      if (!planted) {
        paw.start = null;
        continue;
      }
      if (!paw.start) paw.start = this.world.clone();
      const slip = Math.hypot(this.world.x - paw.start.x, this.world.z - paw.start.z);
      this.maxSlip = Math.max(this.maxSlip, slip / BODY_LENGTH);
    }

    const local = this.cat.root.worldToLocal(this.pelvis.getWorldPosition(this.world).clone());
    if (this.lastPelvis && dt > 0 && this.cat.mixer.time - this.cat.lastTransitionAt < 0.5) {
      const speed = local.distanceTo(this.lastPelvis) / dt;
      this.maxTransition = Math.max(this.maxTransition, speed / WALK_SPEED);
    }
    this.lastPelvis = local;
  }
}
