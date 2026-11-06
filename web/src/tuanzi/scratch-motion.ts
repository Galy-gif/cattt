import * as THREE from 'three';
import { ANCHORS } from '../yard/layout.ts';
export const SCRATCH_ENTRY = { x: ANCHORS.tree.x, y: 0, z: ANCHORS.tree.z + .56 };
export type ScratchStage = 'scratch_reach' | 'scratch_grip' | 'scratch_rake' | 'scratch_release' | 'scratch_settle';
export type ScratchSnapshot = { stage: ScratchStage; time: number; exit: boolean; entry: number[] };
const sequence: ScratchStage[] = ['scratch_reach', 'scratch_grip', 'scratch_rake', 'scratch_release', 'scratch_settle'];
const duration: Record<ScratchStage, number> = { scratch_reach: 1.25, scratch_grip: .3, scratch_rake: 3.2, scratch_release: 1.25, scratch_settle: .5 };
const ease = (t: number) => t * t * t * (t * (6 * t - 15) + 10);
/** 抓挠结束后收爪退回路网入口；切换意图不会把靠树姿态直接切成走路。 */
export class ScratchMotion {
  data: ScratchSnapshot;
  done = false;
  constructor(entry: THREE.Vector3Like, saved?: ScratchSnapshot) {
    this.data = saved ? { ...saved, entry: [...saved.entry] } : { stage: 'scratch_reach', time: 0, exit: false, entry: [entry.x, entry.y, entry.z] };
  }
  update(dt: number) {
    const s = this.data;
    s.time += dt;
    if (s.time < duration[s.stage]) return;
    const next = s.exit && (s.stage === 'scratch_reach' || s.stage === 'scratch_grip') ? 'scratch_release' : sequence[sequence.indexOf(s.stage) + 1];
    if (next) { s.stage = next; s.time = 0; } else this.done = true;
  }
  get pose() {
    const { stage, time, entry } = this.data;
    const t = THREE.MathUtils.clamp(time / duration[stage], 0, 1);
    const amount = stage === 'scratch_reach' ? ease(t) : stage === 'scratch_release' ? ease(1 - t) : stage === 'scratch_settle' ? 0 : 1;
    const point = new THREE.Vector3().fromArray(entry); point.z -= .268 * amount;
    return { point, yaw: Math.PI };
  }
}
