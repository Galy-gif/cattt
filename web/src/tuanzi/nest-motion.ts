import * as THREE from 'three';
import { ANCHORS } from '../yard/layout.ts';

export type NestStage = 'nest_jump' | 'nest_grab' | 'nest_climb' | 'nest_turn' | 'nest_watch' | 'nest_down' | 'nest_sleep' | 'nest_wake' | 'nest_turn_out' | 'nest_out' | 'nest_drop' | 'nest_land';
export type NestSnapshot = { stage: NestStage; time: number; elapsed: number; sleep: boolean; exit: boolean; entry: number[] };
const duration: Record<NestStage, number> = { nest_jump: 1, nest_grab: .35, nest_climb: 1.4, nest_turn: 1.2, nest_watch: Infinity, nest_down: 1, nest_sleep: Infinity, nest_wake: 1, nest_turn_out: 1.2, nest_out: 1.4, nest_drop: 1, nest_land: .5 };
const ease = (t: number) => THREE.MathUtils.smootherstep(t, 0, 1);
export const NEST_ENTRY = { x: ANCHORS.nest.x, y: 0, z: ANCHORS.nest.z + .70 };
const grip = new THREE.Vector3(ANCHORS.nest.x, .554, ANCHORS.nest.z + .48);
const seat = new THREE.Vector3(ANCHORS.nest.x, .715, ANCHORS.nest.z);

/** 起落不可中途改路线；退出请求在抓稳、爬入后接完整离窝。 */
export class NestMotion {
  data: NestSnapshot;
  done = false;
  constructor(entry: THREE.Vector3Like, sleep: boolean, saved?: NestSnapshot) {
    this.data = saved ? { ...saved, entry: [...saved.entry] } : { stage: 'nest_jump', time: 0, elapsed: 0, sleep, exit: false, entry: [entry.x, entry.y, entry.z] };
  }
  private next(stage: NestStage) { this.data.stage = stage; this.data.time = 0; }
  update(dt: number) {
    const s = this.data; s.elapsed += dt; s.time += dt;
    if (s.stage === 'nest_watch') {
      if (s.exit) this.next('nest_turn_out'); else if (s.sleep) this.next('nest_down');
    } else if (s.stage === 'nest_sleep') {
      if (s.exit || !s.sleep) this.next('nest_wake');
    } else if (s.time >= duration[s.stage]) {
      switch (s.stage) {
        case 'nest_jump': this.next('nest_grab'); break;
        case 'nest_grab': this.next('nest_climb'); break;
        case 'nest_climb': this.next('nest_turn'); break;
        case 'nest_turn': this.next('nest_watch'); break;
        case 'nest_down': this.next('nest_sleep'); break;
        case 'nest_wake': this.next('nest_watch'); break;
        case 'nest_turn_out': this.next('nest_out'); break;
        case 'nest_out': this.next('nest_drop'); break;
        case 'nest_drop': this.next('nest_land'); break;
        case 'nest_land': this.done = true; break;
      }
    }
  }
  get pose() {
    const { stage, time, entry } = this.data;
    const u = ease(time / duration[stage]);
    const point = seat.clone(); let yaw = 0, weight = 1;
    if (stage === 'nest_jump' || stage === 'nest_drop') {
      const falling = stage === 'nest_drop';
      point.lerpVectors(falling ? grip : new THREE.Vector3().fromArray(entry), falling ? new THREE.Vector3().fromArray(entry) : grip, u);
      point.y += .23 * Math.sin(Math.PI * u); yaw = Math.PI; weight = falling ? 1-u : u;
    } else if (stage === 'nest_grab') { point.copy(grip); yaw = Math.PI; }
    else if (stage === 'nest_climb' || stage === 'nest_out') { point.lerpVectors(grip, seat, stage === 'nest_out' ? 1-u : u); point.y += .065 * Math.sin(Math.PI * u) ** 2; yaw = Math.PI; }
    else if (stage === 'nest_turn' || stage === 'nest_turn_out') yaw = Math.PI * (stage === 'nest_turn' ? 1-u : u);
    else if (stage === 'nest_down') yaw = 1.05 * u;
    else if (stage === 'nest_sleep') yaw = 1.05;
    else if (stage === 'nest_wake') yaw = 1.05 * (1-u);
    else if (stage === 'nest_land') { point.fromArray(entry); yaw = Math.PI; weight = 0; }
    return { point, yaw, weight };
  }
  get settled() { return !this.data.exit && (this.data.sleep ? this.data.stage === 'nest_sleep' : this.data.stage === 'nest_watch'); }
}
