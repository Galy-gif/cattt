import * as THREE from 'three';
import { ANCHORS } from '../yard/layout.ts';
export const FLOWER_ENTRY = {x:ANCHORS.flower.x,y:0,z:ANCHORS.flower.z+.45};
const landing=new THREE.Vector3(ANCHORS.flower.x+.05,0,ANCHORS.flower.z+.265);
export type FlowerStage='flower_watch'|'flower_crouch'|'flower_pounce'|'flower_touch'|'flower_recoil'|'flower_recover';
export type FlowerSnapshot={stage:FlowerStage;time:number;exit:boolean;entry:number[]};
const duration:Record<FlowerStage,number>={flower_watch:.9,flower_crouch:.65,flower_pounce:.36,flower_touch:1.2,flower_recoil:.36,flower_recover:.6};
/** 扑向花头前的空地；半空收到切换请求也先落稳，再退回安全入口。 */
export class FlowerMotion {
  data:FlowerSnapshot;
  done=false;
  constructor(entry:THREE.Vector3Like,saved?:FlowerSnapshot){this.data=saved?{...saved,entry:[...saved.entry]}:{stage:'flower_watch',time:0,exit:false,entry:[entry.x,entry.y,entry.z]};}
  update(dt:number){
    const s=this.data;s.time+=dt;
    if(s.exit&&['flower_watch','flower_crouch'].includes(s.stage)){s.stage='flower_recover';s.time=0;}
    if(s.exit&&s.stage==='flower_touch'){s.stage='flower_recoil';s.time=0;}
    if(s.time<duration[s.stage])return;
    const sequence:FlowerStage[]=['flower_watch','flower_crouch','flower_pounce','flower_touch','flower_recoil','flower_recover'];
    const next=sequence[sequence.indexOf(s.stage)+1];if(next){s.stage=next;s.time=0;}else this.done=true;
  }
  get pose(){
    const {stage,time,entry}=this.data,t=THREE.MathUtils.clamp(time/duration[stage],0,1),point=new THREE.Vector3().fromArray(entry);
    if(stage==='flower_pounce'||stage==='flower_recoil'){
      const back=stage==='flower_recoil';point.lerpVectors(back?landing:new THREE.Vector3().fromArray(entry),back?new THREE.Vector3().fromArray(entry):landing,t);
      point.y=(back?.055:.085)*4*t*(1-t);
    }else if(stage==='flower_touch')point.copy(landing);
    return {point,yaw:Math.PI};
  }
}
