import * as THREE from 'three';
import { addWorldTurn, placePaw } from './procedural.ts';
import { RUN_STEP as STEP, RUN_STEPS as COUNT } from './run-path.ts';

export type RunStage='run_ready'|'run_stride'|'run_settle';
export type RunSnapshot={stage:RunStage;time:number;exit:boolean;entry:number[];yaw:number;step:number;travel:number};
const duration=(step:number)=>step<2||step>=COUNT-2?.28:.18;
const ease=(t:number)=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
const legs=['front_L','hind_R','front_R','hind_L'];
/** 小跑以对角爪交替承重；落点在世界里保持，不把走路片段直接加速。 */
export class RunMotion{
  data:RunSnapshot;done=false;
  constructor(entry:THREE.Vector3Like,yaw:number,saved?:RunSnapshot){this.data=saved?{...saved,entry:[...saved.entry]}:{stage:'run_ready',time:0,exit:false,entry:[entry.x,entry.y,entry.z],yaw,step:0,travel:0};}
  update(dt:number){
    const s=this.data;s.time+=dt;
    if(s.stage==='run_ready'&&s.time>=.45){s.stage=s.exit?'run_settle':'run_stride';s.time=0;}
    else if(s.stage==='run_stride'){
      while(s.time>=duration(s.step)&&s.stage==='run_stride'){
        s.time-=duration(s.step);s.step++;s.travel=s.step*STEP;
        if(s.step>=COUNT||s.exit){s.stage='run_settle';s.time=0;}
      }
      if(s.stage==='run_stride')s.travel=(s.step+s.time/duration(s.step))*STEP;
    }else if(s.stage==='run_settle'&&s.time>=.6)this.done=true;
  }
  get point(){const s=this.data;return new THREE.Vector3().fromArray(s.entry).add(new THREE.Vector3(Math.sin(s.yaw)*s.travel,0,Math.cos(s.yaw)*s.travel));}
  apply(root:THREE.Object3D,bones:Map<string,THREE.Bone>){
    const s=this.data,u=s.stage==='run_stride'?s.time/duration(s.step):0;
    const weight=s.stage==='run_ready'?ease(s.time/.45):s.stage==='run_settle'?1-ease(s.time/.6):1;
    const stride=s.stage==='run_stride'?Math.PI*(s.step+u):Math.PI*s.step;
    const flex=.5-.5*Math.cos(stride), bounce=flex;
    root.position.copy(this.point);root.position.y+=(-.042+.012*bounce)*weight;root.updateMatrixWorld(true);
    const rotations=legs.map(n=>bones.get(n+'_paw')!.getWorldQuaternion(new THREE.Quaternion()));
    // 两次换脚完成一次舒展起落；背部只做小幅弯曲，避免逐步反向拧动。
    for(const [name,pitch] of [['spine_02',-.04+.04*flex],['spine_03',.04-.06*flex],['spine_04',.02*flex],['neck_01',.02],['neck_02',.02]] as const){
      addWorldTurn(bones.get(name)!,root,0,pitch*weight);root.updateMatrixWorld(true);
    }
    // 尾巴整体跟随，去掉多节骨骼互相叠加的抖动。
    addWorldTurn(bones.get('tail_01')!,root,0,(.18+.035*flex)*weight);root.updateMatrixWorld(true);
    for(let i=0;i<legs.length;i++){
      const name=legs[i]!,front=name.startsWith('front'),parity=i<2?0:1;
      let advance=0,lift=0;
      if(s.stage==='run_stride'){
        const active=s.step%2===parity,last=active?Math.max(0,s.step-1):s.step;
        advance=(active?THREE.MathUtils.lerp(last,s.step+1,ease(u)):last)*STEP;
        lift=active?.038*Math.sin(Math.PI*u)**2:0;
      }else if(s.stage==='run_settle'){
        const last=s.step===0?0:(s.step-1)%2===parity?s.step:s.step-1;
        const t=THREE.MathUtils.clamp((s.time-(parity===0?0:.28))/.28,0,1);
        advance=THREE.MathUtils.lerp(last*STEP,s.travel,ease(t));lift=.015*Math.sin(Math.PI*t)**2;
      }
      const goal=new THREE.Vector3((name.endsWith('L')?1:-1)*(front?.052:.060),.03+lift,(front?.098:-.127)+advance);
      goal.applyAxisAngle(new THREE.Vector3(0,1,0),s.yaw).add(new THREE.Vector3().fromArray(s.entry));
      for(let j=0;j<3;j++)placePaw(bones,root,name,goal);
      const paw=bones.get(name+'_paw')!;paw.quaternion.copy(paw.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotations[i]!));paw.updateMatrixWorld(true);
    }
  }
}
