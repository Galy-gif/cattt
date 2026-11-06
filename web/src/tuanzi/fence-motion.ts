import * as THREE from 'three';

export type FenceStage = 'fence_reach' | 'fence_jump' | 'fence_grip' | 'fence_climb' | 'fence_turn' | 'fence_down' | 'fence_rest' | 'fence_wake' | 'fence_turn_out' | 'fence_out' | 'fence_drop' | 'fence_land';
export type FenceSnapshot = { stage: FenceStage; time: number; exit: boolean; entry: number[] };
export const FENCE_ENTRY = { x: 3.15, y: 0, z: -2.60 };
const grip = new THREE.Vector3(3.15, .32, -2.73);
const seat = new THREE.Vector3(3.15, .501, -3.10);
const duration: Record<FenceStage,number> = {fence_reach:.75,fence_jump:.44,fence_grip:.30,fence_climb:1.15,fence_turn:2,fence_down:1,fence_rest:Infinity,fence_wake:1,fence_turn_out:2,fence_out:1.15,fence_drop:.38,fence_land:.5};
export function fenceTurnProgress(t:number) {
  const q=THREE.MathUtils.clamp((t-.1)/.8,0,1)*4,step=Math.min(3,Math.floor(q)),phase=Math.min(1,q-step);
  return (step+THREE.MathUtils.smootherstep((phase-.12)/.76,0,1))/4;
}
function fenceClimbPoint(t:number) {
  const a=new THREE.Vector3(3.15,.575,-2.87),b=new THREE.Vector3(3.15,.53,-3.10);
  if(t<.44)return grip.clone().lerp(a,THREE.MathUtils.smootherstep(t/.44,0,1));
  if(t<.54)return a;
  if(t<.84)return a.lerp(b,THREE.MathUtils.smootherstep((t-.54)/.30,0,1));
  return b.lerp(seat,THREE.MathUtils.smootherstep((t-.84)/.16,0,1));
}
/** 攀爬期间接到离开请求，先爬稳再沿原入口下来；不在半空换路线。 */
export class FenceMotion {
  data: FenceSnapshot;
  done = false;
  constructor(entry: THREE.Vector3Like, saved?: FenceSnapshot) {
    this.data = saved ? {...saved,entry:[...saved.entry]} : {stage:'fence_reach',time:0,exit:false,entry:[entry.x,entry.y,entry.z]};
  }
  update(dt:number) {
    const s=this.data;s.time+=dt;
    if(s.stage==='fence_rest') {if(s.exit){s.stage='fence_wake';s.time=0;}return;}
    if(s.time<duration[s.stage])return;
    const sequence: FenceStage[]=['fence_reach','fence_jump','fence_grip','fence_climb','fence_turn','fence_down','fence_rest','fence_wake','fence_turn_out','fence_out','fence_drop','fence_land'];
    const next=sequence[sequence.indexOf(s.stage)+1];
    if(next){s.stage=next;s.time=0;}else this.done=true;
  }
  get pose() {
    const {stage,time,entry}=this.data,t=THREE.MathUtils.clamp(time/duration[stage],0,1);
    const point=seat.clone();let yaw=Math.PI/2;
    if(stage==='fence_reach'||stage==='fence_land'){point.fromArray(entry);yaw=Math.PI;}
    else if(stage==='fence_jump'||stage==='fence_drop'){
      const down=stage==='fence_drop';point.lerpVectors(down?grip:new THREE.Vector3().fromArray(entry),down?new THREE.Vector3().fromArray(entry):grip,t);
      point.y=down ? grip.y*(1-t*t) : grip.y*t+.40*t*(1-t);yaw=Math.PI;
    }else if(stage==='fence_grip'){point.copy(grip);yaw=Math.PI;}
    else if(stage==='fence_climb'||stage==='fence_out'){
      point.copy(fenceClimbPoint(stage==='fence_out'?1-t:t));yaw=Math.PI;
    }else if(stage==='fence_turn'||stage==='fence_turn_out')yaw=Math.PI-Math.PI/2*(stage==='fence_turn'?fenceTurnProgress(t):1-fenceTurnProgress(t));
    return {point,yaw};
  }
  get settled(){return this.data.stage==='fence_rest'&&!this.data.exit;}
}
