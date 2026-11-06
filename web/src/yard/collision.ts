import { CAT_FOOTPRINT_RADIUS, COLLIDERS, PATH_SAFETY_MARGIN, type Ground } from './layout.ts';

type Circle = { readonly id: string; readonly kind: 'circle'; readonly x: number; readonly z: number; readonly radius: number };
type Segment = { readonly id: string; readonly kind: 'segment'; readonly a: Ground; readonly b: Ground; readonly radius: number };
type Polygon = { readonly id: string; readonly kind: 'polygon'; readonly points: readonly Ground[]; readonly radius: number };
type Collider = Circle | Segment | Polygon;

export function clearanceTo(point: Ground, collider: Collider) {
  let distance: number;
  if (collider.kind === 'circle') {
    distance = Math.hypot(point.x - collider.x, point.z - collider.z);
  } else if (collider.kind === 'segment') {
    distance = segmentDistance(point, collider.a, collider.b);
  } else {
    distance = Math.min(...collider.points.map((a, index) => segmentDistance(point, a, collider.points[(index + 1) % collider.points.length]!)));
    if (insidePolygon(point, collider.points)) distance *= -1;
  }
  return distance - collider.radius - CAT_FOOTPRINT_RADIUS - PATH_SAFETY_MARGIN;
}

export function minimumClearance(point: Ground, supportCollider?: string) {
  let id = '';
  let clearance = Infinity;
  for (const collider of COLLIDERS as readonly Collider[]) {
    if (collider.id === supportCollider) continue;
    const next = clearanceTo(point, collider);
    if (next < clearance) {
      id = collider.id;
      clearance = next;
    }
  }
  return { id, clearance };
}

function segmentDistance(point: Ground, a: Ground, b: Ground) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length2 = dx * dx + dz * dz;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / length2));
  return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t));
}

function insidePolygon(point: Ground, polygon: readonly Ground[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if ((a.z > point.z) !== (b.z > point.z) && point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
