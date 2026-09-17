import { LAYOUT } from './layout.generated';

export type NodeId = keyof typeof LAYOUT.nodes;
export type PlaceId = (typeof LAYOUT.destinations)[number]['id'];

export interface Ground {
  x: number;
  z: number;
}

/** 章节顺序 = 主路从左到右（决策 09-17 第 8 条） */
export const PLACE_ORDER: PlaceId[] = ['house', 'bed', 'tree', 'grass', 'pond', 'fence'];

export const NODES = LAYOUT.nodes as Record<string, Ground>;
export const ANCHORS = LAYOUT.anchors;
export const POND = LAYOUT.pond as readonly Ground[];
export const EDGES = LAYOUT.edges;

export function place(id: PlaceId) {
  const found = LAYOUT.destinations.find((d) => d.id === id);
  if (!found) throw new Error(`没有这个地点：${id}`);
  return { ...found, point: NODES[found.node]! };
}

const neighbours = new Map<string, string[]>();
for (const { a, b } of EDGES) {
  neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
  neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
}

export function distance(a: Ground, b: Ground) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function nearestNode(point: Ground): string {
  let best = 'm0';
  let bestDistance = Infinity;
  for (const [id, node] of Object.entries(NODES)) {
    const d = distance(point, node);
    if (d < bestDistance) [best, bestDistance] = [id, d];
  }
  return best;
}

/** 路网上两点之间的最短路（节点少，直接 Dijkstra）。返回不含起点的节点序列。 */
export function route(from: string, to: string): string[] {
  const cost = new Map<string, number>([[from, 0]]);
  const previous = new Map<string, string>();
  const open = new Set<string>([from]);
  while (open.size) {
    let current = '';
    let currentCost = Infinity;
    for (const id of open) {
      const c = cost.get(id)!;
      if (c < currentCost) [current, currentCost] = [id, c];
    }
    if (current === to) break;
    open.delete(current);
    for (const next of neighbours.get(current) ?? []) {
      const c = currentCost + distance(NODES[current]!, NODES[next]!);
      if (c < (cost.get(next) ?? Infinity)) {
        cost.set(next, c);
        previous.set(next, current);
        open.add(next);
      }
    }
  }
  const path: string[] = [];
  for (let id = to; id !== from; id = previous.get(id)!) {
    if (!previous.has(id)) return [];
    path.unshift(id);
  }
  return path;
}
