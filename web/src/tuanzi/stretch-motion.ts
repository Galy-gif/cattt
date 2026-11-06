import * as THREE from 'three';
import { addWorldTurn, placePaw } from './procedural.ts';

export type StretchStage = 'stretch_reach' | 'stretch_down' | 'stretch_hold' | 'stretch_up' | 'stretch_settle';
export type StretchSnapshot = { stage: StretchStage; time: number; exit: boolean; entry: number[]; yaw: number; release: number };
const duration = { stretch_reach: .8, stretch_down: 1.1, stretch_hold: 1.5, stretch_up: 1, stretch_settle: .8 };
const smooth = (t: number) => { t = THREE.MathUtils.clamp(t, 0, 1); return t*t*(3-2*t); };

/** 前爪先伸出落地，再压胸拉背；起身后才收爪，换地点也完成收势。 */
export class StretchMotion {
  data: StretchSnapshot;
  done = false;
  constructor(entry: THREE.Vector3Like, yaw: number, saved?: StretchSnapshot) {
    this.data = saved ? { ...saved, entry: [...saved.entry] } : { stage: 'stretch_reach', time: 0, exit: false, entry: [entry.x, entry.y, entry.z], yaw, release: 1 };
  }
  get weight() {
    const s=this.data, u=smooth(s.time/duration[s.stage]);
    return s.stage==='stretch_reach' ? .2*u : s.stage==='stretch_down' ? .2+.8*u : s.stage==='stretch_hold' ? 1 : s.stage==='stretch_up' ? THREE.MathUtils.lerp(s.release,.2,u) : .2*(1-u);
  }
  update(dt: number) {
    const s=this.data; s.time+=dt;
    if(s.exit && (s.stage==='stretch_down'||s.stage==='stretch_hold')) { s.release=this.weight; s.stage='stretch_up';s.time=0;return; }
    if(s.time<duration[s.stage])return;
    const next: Partial<Record<StretchStage,StretchStage>>={stretch_reach:s.exit?'stretch_up':'stretch_down',stretch_down:'stretch_hold',stretch_hold:'stretch_up',stretch_up:'stretch_settle'};
    if(s.stage==='stretch_reach'&&s.exit)s.release=.2;
    if(s.stage==='stretch_hold')s.release=1;
    const stage=next[s.stage];if(stage){s.stage=stage;s.time=0;}else this.done=true;
  }
  apply(root: THREE.Object3D, bones: Map<string,THREE.Bone>) {
    const s=this.data, weight=this.weight, u=THREE.MathUtils.clamp(s.time/duration[s.stage],0,1);
    // 后脚抬起脚跟、由趾端撑住，臀部抬高，胸口继续向下伸。
    root.position.y=s.entry[1]!+.018*weight;root.updateMatrixWorld(true);
    const pawRotations=new Map(['front_L','front_R','hind_L','hind_R'].map(name=>[name,bones.get(name+'_paw')!.getWorldQuaternion(new THREE.Quaternion())]));
    for(const [name,pitch] of [['spine_02',-.32],['spine_03',-.20],['spine_04',-.10],['neck_01',.08],['neck_02',.08],['head',.1]] as const){
      addWorldTurn(bones.get(name)!,root,0,pitch*weight);root.updateMatrixWorld(true);
    }
    // 尾根轻轻抬起，不把尾尖折向脸。
    addWorldTurn(bones.get('tail_01')!,root,0,-.12*weight);root.updateMatrixWorld(true);
    const reach=s.stage==='stretch_reach'?smooth(u):s.stage==='stretch_settle'?1-smooth(u):1;
    const lift=(s.stage==='stretch_reach'||s.stage==='stretch_settle')?.018*Math.sin(Math.PI*u)**2:0;
    for(const name of ['front_L','front_R','hind_L','hind_R']){
      const front=name.startsWith('front'), side=name.endsWith('L')?1:-1;
      const goal=new THREE.Vector3(side*(front?.052:.060),.03+(front?lift:.015*weight),front?.098+.06*reach:-.127);
      goal.applyAxisAngle(new THREE.Vector3(0,1,0),s.yaw).add(new THREE.Vector3().fromArray(s.entry));
      for(let i=0;i<3;i++)placePaw(bones,root,name,goal);
      const paw=bones.get(name+'_paw')!;
      paw.quaternion.copy(paw.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(pawRotations.get(name)!));paw.updateMatrixWorld(true);
      if(!front){addWorldTurn(paw,root,0,-.5*weight);paw.updateMatrixWorld(true);}
    }
  }
}
