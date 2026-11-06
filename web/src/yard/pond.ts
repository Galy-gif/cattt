import * as THREE from 'three';
import { POND } from './layout.ts';

const outline = new THREE.CatmullRomCurve3(POND.map(p => new THREE.Vector3(p.x, 0, p.z)), true, 'centripetal').getPoints(72);
export function inPond(x: number, z: number) {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!, b = outline[j]!;
    if ((a.z > z) !== (b.z > z) && x < (b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x) inside = !inside;
  }
  return inside;
}

export const POND_APPROACH = {x:2.60,y:0,z:2.35};
export const POND_LOOK = {x:2.40,y:.012,z:2.06};
export const POND_TOUCH = {x:2.523,z:2.15};
