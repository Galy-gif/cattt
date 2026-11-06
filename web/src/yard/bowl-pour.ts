import * as THREE from 'three';
import { ANCHORS } from './layout.ts';
const ease=(t:number)=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
/** 倒水是一次事实变更的装饰，不负责写入饮水/加水业务；恢复已有满盆时不重播。 */
export class BowlPour {
  readonly root=new THREE.Group();
  private can=new THREE.Group();
  private tip=new THREE.Object3D();
  private stream=new THREE.Mesh(new THREE.CylinderGeometry(.004,.005,1,8),new THREE.MeshStandardMaterial({color:'#94d4d8',roughness:.45,transparent:true,opacity:.8}));
  private rings=[0,1].map(()=>new THREE.Mesh(new THREE.RingGeometry(.88,1,32),new THREE.MeshBasicMaterial({color:'#d7eee5',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide})));
  private full:boolean|null=null;
  private elapsed=3;
  get active(){return this.elapsed<2.6;}
  get level(){return this.full!==false ? (this.active?ease((this.elapsed-.45)/1.25):1):0;}
  constructor(){
    this.root.name='bowl_pour_effect';
    const clay=new THREE.MeshStandardMaterial({color:'#c28d57',roughness:1});
    const body=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),clay);body.scale.set(.083,.085,.072);this.can.add(body);
    const lid=new THREE.Mesh(new THREE.CylinderGeometry(.046,.055,.02,24),clay);lid.position.y=.081;this.can.add(lid);
    const handle=new THREE.Mesh(new THREE.TorusGeometry(.057,.011,8,24),clay);handle.position.set(.085,.015,0);handle.scale.x=.8;this.can.add(handle);
    const a=new THREE.Vector3(-.06,.015,0),b=new THREE.Vector3(-.18,.075,0);
    const spout=new THREE.Mesh(new THREE.CylinderGeometry(.014,.022,a.distanceTo(b),12),clay);spout.position.copy(a).add(b).multiplyScalar(.5);spout.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());this.can.add(spout);
    this.tip.position.copy(b);this.can.add(this.tip);
    this.root.add(this.can,this.stream,...this.rings);
    this.rings.forEach(r=>{r.rotation.x=-Math.PI/2;r.position.set(ANCHORS.bowl.x,.048,ANCHORS.bowl.z);});
    this.root.visible=false;
  }
  setFull(full:boolean){
    if(this.full===false&&full)this.elapsed=0;
    if(!full)this.elapsed=3;
    this.full=full;
  }
  update(dt:number,still=false){
    if(still)this.elapsed=3;else this.elapsed=Math.min(3,this.elapsed+dt);
    const t=this.elapsed;this.root.visible=this.active;
    if(!this.active)return;
    const show=ease(t/.3)*(1-ease((t-2.2)/.4));
    this.can.scale.setScalar(Math.max(.001,show));
    this.can.position.set(ANCHORS.bowl.x+.21,.29+.08*(1-show),ANCHORS.bowl.z);
    this.can.rotation.z=.62*ease((t-.25)/.3)*(1-ease((t-1.8)/.35));this.can.updateMatrixWorld(true);
    const flow=ease((t-.45)/.15)*(1-ease((t-1.7)/.15));
    const start=this.tip.getWorldPosition(new THREE.Vector3()),end=new THREE.Vector3(ANCHORS.bowl.x,.025+.022*this.level,ANCHORS.bowl.z);
    this.stream.visible=flow>0;this.stream.position.copy(start).add(end).multiplyScalar(.5);
    this.stream.scale.set(flow,start.distanceTo(end),flow);this.stream.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());
    this.rings.forEach((r,i)=>{const age=(t*2+i*.5)%1;r.scale.setScalar(.01+.064*age);r.material.opacity=flow*(1-age)*.6;});
  }
}
