import * as THREE from 'three';
import { place, type PlaceId } from '../yard/layout.ts';

/** 第 1 轮候选参数；用户确认静帧后才锁定。米，固定 48° 视场角。 */
export const COMPOSITION = {
  fov: 48,
  dailyDistance: Math.hypot(3.4, 1.8),
  dailyPitch: THREE.MathUtils.degToRad(16),
  overviewPitch: THREE.MathUtils.degToRad(39),
  overviewYaw: THREE.MathUtils.degToRad(-24),
  focusHeight: 0.38,
  minimumDistance: 2.8,
  edgePadding: 0.08,
};
export type Insets = { top: number; bottom: number; left: number; right: number };
export const NO_INSETS: Insets = { top: 0, bottom: 0, left: 0, right: 0 };

export function placeFocus(id: PlaceId) {
  const p = place(id).point;
  return new THREE.Vector3(p.x, COMPOSITION.focusHeight, p.z);
}

export function boxCorners(box: THREE.Box3) {
  return [box.min.x, box.max.x].flatMap(x => [box.min.y, box.max.y].flatMap(y =>
    [box.min.z, box.max.z].map(z => new THREE.Vector3(x, y, z))));
}

export function projectBox(box: THREE.Box3, camera: THREE.Camera, width: number, height: number) {
  camera.updateMatrixWorld();
  const points = boxCorners(box).map(point => point.project(camera));
  return {
    x: (Math.min(...points.map(p => p.x)) + 1) * width / 2,
    y: (1 - Math.max(...points.map(p => p.y))) * height / 2,
    width: (Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))) * width / 2,
    height: (Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))) * height / 2,
    inFront: points.every(p => p.z >= -1 && p.z <= 1),
  };
}

export type ScreenRect = { x: number; y: number; width: number; height: number };
export function rectanglesOverlap(a: ScreenRect, b: ScreenRect, padding = 0) {
  return a.x < b.x + b.width + padding && a.x + a.width > b.x - padding &&
    a.y < b.y + b.height + padding && a.y + a.height > b.y - padding;
}
