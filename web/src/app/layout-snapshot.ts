import { LAYOUT_VERSION, place, type PlaceId } from '../yard/layout.ts';

/** 布局迁移只能按语义地点重定位；旧坐标可能已变成池塘或实体。 */
export function layoutRestorePoint(version: string | undefined, goal: PlaceId) {
  if (version === LAYOUT_VERSION) return null;
  const p = place(goal).point;
  return { x: p.x, y: 0, z: p.z };
}
