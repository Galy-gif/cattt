import type * as THREE from 'three';
import { minimumClearance } from '../yard/collision.ts';
import { YARD_BOUNDARY } from '../yard/layout.ts';
export const RUN_STEP=.065, RUN_STEPS=12;
function inside(x:number,z:number){let yes=false;for(let i=0,j=YARD_BOUNDARY.length-1;i<YARD_BOUNDARY.length;j=i++){const a=YARD_BOUNDARY[i]!,b=YARD_BOUNDARY[j]!;if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)yes=!yes;}return yes;}
/** 按整条直线及身体包络挑安全跑向，跑前仍用既有换爪转身对准。 */
export function runHeading(entry:THREE.Vector3Like):number|null{
  for(const yaw of [Math.PI/2,0,-Math.PI/2,Math.PI,Math.PI/4,-Math.PI/4]){
    let safe=true;
    for(let i=0;i<=64;i++){const d=RUN_STEP*RUN_STEPS*i/64,x=entry.x+Math.sin(yaw)*d,z=entry.z+Math.cos(yaw)*d;if(!inside(x,z)||minimumClearance({x,z}).clearance<.12){safe=false;break;}}
    if(safe)return yaw;
  }
  return null;
}
