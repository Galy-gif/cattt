import * as THREE from 'three';
import { ANCHORS } from './layout.ts';
/** 实际前爪靠近花头才触发；解析阻尼运动可暂停、快照和恢复。 */
export class FlowerResponse {
  readonly root=new THREE.Group();
  private age=10;
  private touching=false;
  hits=0;
  constructor(){this.root.position.set(ANCHORS.flower.x,0,ANCHORS.flower.z);}
  get head(){return this.root.localToWorld(new THREE.Vector3(0,.172,0));}
  update(dt:number,paw:THREE.Vector3|null,state:string){
    this.root.updateMatrixWorld(true);
    const contact=state==='flower_touch'&&!!paw&&paw.distanceTo(this.head)<.045;
    if(state!=='flower_touch')this.touching=false;
    if(contact&&!this.touching){this.age=0;this.hits++;this.touching=true;}this.age+=dt;
    this.root.rotation.x=-.25*Math.exp(-3*this.age)*Math.sin(13*this.age);
    this.root.updateMatrixWorld(true);
  }
  get snapshot(){return {age:this.age,touching:this.touching,hits:this.hits};}
  restore(v:{age:number;touching:boolean;hits:number}){this.age=v.age;this.touching=v.touching;this.hits=v.hits;this.root.rotation.x=-.25*Math.exp(-3*this.age)*Math.sin(13*this.age);}
}
