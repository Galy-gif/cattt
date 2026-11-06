import * as THREE from 'three';
import { place } from '../yard/layout.ts';
import { addWorldTurn, placePaw } from './procedural.ts';
export const CHASE_ENTRY = { ...place('grass').point, y: 0 };
export type ChaseStage = 'chase_look' | 'chase_turn' | 'chase_settle';
export type ChaseSnapshot = { stage: ChaseStage; time: number; exit: boolean; entry: number[]; yaw: number; turnTime: number };
const stepDurations = Array.from({length:24},(_,i)=> i<2 || i>21 ? .2 : .1);
const ease = (t:number)=> t*t*(3-2*t);
function progress(time:number) {
  let remaining=time;
  for(let i=0;i<24;i++) { const d=stepDurations[i]!; if(remaining<d)return {step:i,u:Math.max(0,remaining/d)}; remaining-=d; }
  return {step:23,u:1};
}
const curled=[new THREE.Vector3(.136,.03,-.080),new THREE.Vector3(-.060,.03,-.127),new THREE.Vector3(.154,.03,.022),new THREE.Vector3(.060,.03,-.127)];
const legs=['front_L','hind_R','front_R','hind_L'] as const;
const rests=legs.map(n=>new THREE.Vector3((n.endsWith('L')?1:-1)*(n.startsWith('front')?.052:.060),.03,n.startsWith('front')?.098:-.127));
/** 每一小步交替抬起对角两爪，支撑爪的世界位置保持；仅新增行为，不改旧GLB。 */
export class ChaseMotion {
  data: ChaseSnapshot;
  done=false;
  constructor(entry:THREE.Vector3Like,yaw:number,saved?:ChaseSnapshot){
    this.data=saved?{...saved,entry:[...saved.entry]}:{stage:'chase_look',time:0,exit:false,entry:[entry.x,entry.y,entry.z],yaw,turnTime:0};
  }
  update(dt:number){
    const s=this.data;s.time+=dt;
    if(s.stage==='chase_look'&&s.time>=.65){s.stage=s.exit?'chase_settle':'chase_turn';s.time=0;}
    else if(s.stage==='chase_turn'){
      const before=progress(s.turnTime);s.turnTime=s.time;const after=progress(s.turnTime);
      if(s.time>=2.8 || s.exit&&(after.step!==before.step||after.u===1)){
        // 提前退出也在完整落脚点停；两组爪子在收势时依次归位。
        if(s.exit&&after.step!==before.step)s.turnTime=stepDurations.slice(0,after.step).reduce((a,b)=>a+b,0);
        s.stage='chase_settle';s.time=0;
      }
    }else if(s.stage==='chase_settle'&&s.time>=.65)this.done=true;
  }
  get yaw(){const p=progress(this.data.turnTime);return this.data.yaw+(p.step+ease(p.u))*Math.PI/12;}
  apply(root:THREE.Object3D,bones:Map<string,THREE.Bone>){
    const s=this.data,p=progress(s.turnTime);
    const weight=s.stage==='chase_look'?ease(Math.min(1,s.time/.65)):s.stage==='chase_settle'?1-ease(Math.min(1,s.time/.65)):1;
    root.position.y=s.entry[1]!-.016*weight;root.updateMatrixWorld(true);
    const head=bones.get('head')!;
    const rootRotation=root.getWorldQuaternion(new THREE.Quaternion());
    const headRotation=head.getWorldQuaternion(new THREE.Quaternion());
    const forward=new THREE.Vector3(0,0,1).applyQuaternion(rootRotation).applyQuaternion(headRotation.clone().invert());
    const eyeOffset=new THREE.Vector3(0,-.019,.085).applyQuaternion(rootRotation).applyQuaternion(headRotation.clone().invert());
    // 胸腹保持C形，尾巴留在身体外侧，给追逐留出距离。
    for(const [name,angle] of [['spine_02',.65],['spine_03',.65],['spine_04',.45]] as const)addWorldTurn(bones.get(name)!,root,angle*weight,0);
    for(let i=1;i<=10;i++)addWorldTurn(bones.get(`tail_${String(i).padStart(2,'0')}`)!,root,(i===1?-.35:-.10)*weight,i===1?.25*weight:0);
    root.updateMatrixWorld(true);
    const headWorld=head.getWorldQuaternion(new THREE.Quaternion());
    const eye=head.getWorldPosition(new THREE.Vector3()).add(eyeOffset.clone().applyQuaternion(headWorld));
    const inverseRoot=rootRotation.clone().invert();
    const aim=bones.get('tail_10')!.getWorldPosition(new THREE.Vector3()).sub(eye).applyQuaternion(inverseRoot);
    const facing=forward.clone().applyQuaternion(headWorld).applyQuaternion(inverseRoot);
    const yaw=THREE.MathUtils.clamp(Math.atan2(Math.sin(Math.atan2(aim.x,aim.z)-Math.atan2(facing.x,facing.z)),Math.cos(Math.atan2(aim.x,aim.z)-Math.atan2(facing.x,facing.z))),-.8,.8)*weight;
    const pitch=THREE.MathUtils.clamp(Math.atan2(aim.y,Math.hypot(aim.x,aim.z)),-.12,.12)*weight;
    // 视线只在自然转头范围内追随；两节脖子和头分担，避免头根独自拧折。
    for(const [name,share] of [['neck_01',.3],['neck_02',.35],['head',.35]] as const){
      addWorldTurn(bones.get(name)!,root,yaw*share,pitch*share);
      root.updateMatrixWorld(true);
    }
    for(let i=0;i<legs.length;i++){
      const parity=i<2?0:1,active=p.step%2===parity;
      const last=p.step===0?0:active?Math.max(0,p.step-1):p.step;
      let angle=active?THREE.MathUtils.lerp(last,p.step+1,ease(p.u)):last;
      let lift=active?.025*Math.sin(Math.PI*p.u)**2:0;
      if(s.stage==='chase_look'){angle=0;const u=THREE.MathUtils.clamp((s.time-(parity===0?0:.3))/.3,0,1);lift=.02*Math.sin(Math.PI*u)**2;}
      if(s.stage==='chase_settle'){
        const u=THREE.MathUtils.clamp((s.time-(parity===0?0:.3))/.3,0,1);
        angle=THREE.MathUtils.lerp(angle,p.step+ease(p.u),ease(u));lift=.015*Math.sin(Math.PI*u)**2;
      }
      const base=rests[i]!.clone().lerp(curled[i]!,weight);
      const goal=base.applyAxisAngle(new THREE.Vector3(0,1,0),s.yaw+angle*Math.PI/12).add(new THREE.Vector3().fromArray(s.entry));goal.y+=lift;
      for(let solve=0;solve<3;solve++)placePaw(bones,root,legs[i]!,goal);
    }
  }
}
