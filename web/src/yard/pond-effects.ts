import * as THREE from 'three';
import { inPond } from './pond.ts';
export { inPond } from './pond.ts';

/** 只有前爪真正进入水面才发水纹；固定池复用对象，不随拍水增加节点。 */
export class PondEffects {
  readonly root = new THREE.Group();
  private touching = false;
  private shaking = false;
  private ringIndex = 0;
  private dropIndex = 0;
  private rings = Array.from({length: 6}, () => {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(.90, 1, 40), new THREE.MeshBasicMaterial({color:'#c7e9e3',transparent:true,opacity:0,vertexColors:true,depthWrite:false,side:THREE.DoubleSide}));
    const colors = new Float32Array(mesh.geometry.attributes.position!.count*4).fill(1);
    mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors,4));
    mesh.rotation.x = -Math.PI/2; mesh.visible = false; this.root.add(mesh);
    return {mesh, age:2};
  });
  private drops = Array.from({length: 16}, () => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(.005, 6, 4),new THREE.MeshBasicMaterial({color:'#b3dcd9',transparent:true,opacity:.8,depthWrite:false}));
    mesh.visible = false; this.root.add(mesh);
    return {mesh, velocity:new THREE.Vector3(), age:2};
  });
  update(dt: number, paw: THREE.Vector3 | null, state: string) {
    const contact = !!paw && ['pond_probe','pond_pat'].includes(state) && paw.y-.029 < .016 && inPond(paw.x,paw.z);
    if (contact && !this.touching && paw) {
      const ring=this.rings[this.ringIndex++%this.rings.length]!;
      ring.age=0; ring.mesh.position.set(paw.x,.014,paw.z);
      if(state==='pond_pat')this.splash(paw,6);
    }
    this.touching=contact;
    if(state==='pond_shake' && !this.shaking && paw)this.splash(paw,8);
    this.shaking=state==='pond_shake';
    for(const ring of this.rings) {
      ring.age+=dt;const t=ring.age/1.4;ring.mesh.visible=t<1;
      ring.mesh.scale.setScalar(.025+.16*t);ring.mesh.material.opacity=.6*Math.max(0,1-t);
      if(ring.mesh.visible) {
        const points=ring.mesh.geometry.attributes.position!,colors=ring.mesh.geometry.attributes.color!;
        for(let i=0;i<points.count;i++) colors.setW(i,inPond(ring.mesh.position.x+points.getX(i)*ring.mesh.scale.x,ring.mesh.position.z-points.getY(i)*ring.mesh.scale.x)?1:0);
        colors.needsUpdate=true;
      }
    }
    for(const drop of this.drops) {
      drop.age+=dt;drop.velocity.y-=.75*dt;drop.mesh.position.addScaledVector(drop.velocity,dt);
      drop.mesh.visible=drop.age<.7 && drop.mesh.position.y>.014;drop.mesh.material.opacity=.85*Math.max(0,1-drop.age/.7);
    }
  }
  private splash(paw: THREE.Vector3, count: number) {
    for(let i=0;i<count;i++) {
      const drop=this.drops[this.dropIndex++%this.drops.length]!,a=i*Math.PI*2/count;
      drop.age=0;drop.mesh.position.copy(paw);drop.mesh.position.y=Math.max(.018,paw.y-.012);
      drop.velocity.set(Math.cos(a)*.11,.17+(i%3)*.025,Math.sin(a)*.11);
    }
  }
}
