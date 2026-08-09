import dagre from 'dagre';
import type { DiagramModel, FlowDirection } from './types';

export interface Point {
  x: number;
  y: number;
}

export type PositionMap = Record<string, Point>;

const GAP: Record<FlowDirection, { rank: number; node: number }> = {
  LR: { rank: 110, node: 40 },
  RL: { rank: 110, node: 40 },
  TB: { rank: 70, node: 50 },
  BT: { rank: 70, node: 50 },
};

/**
 * Layout con dagre. Devuelve posiciones de esquina superior izquierda
 * (React Flow trabaja así; dagre devuelve centros).
 *
 * Los nodos `group` no entran al grafo: su caja se deriva de los hijos en el
 * canvas, así arrastrar un hijo actualiza el recuadro solo.
 */
export function autoLayout(model: DiagramModel, direction?: FlowDirection): PositionMap {
  const dir = direction ?? model.direction;
  // compound: los grupos son clusters reales de dagre, así ningún nodo ajeno
  // queda dentro del recuadro (que dibujamos alrededor de sus hijos).
  const graph = new dagre.graphlib.Graph({ compound: true });
  const gap = GAP[dir];
  graph.setGraph({ rankdir: dir, ranksep: gap.rank, nodesep: gap.node, marginx: 40, marginy: 40 });
  graph.setDefaultEdgeLabel(() => ({}));

  const laidOut = model.nodes.filter((node) => node.kind !== 'group');
  const known = new Set(laidOut.map((node) => node.id));
  const groupIds = new Set(model.nodes.filter((node) => node.kind === 'group').map((node) => node.id));

  for (const groupId of groupIds) {
    // el cluster necesita existir antes de colgarle hijos
    graph.setNode(groupId, {});
  }
  for (const node of laidOut) {
    graph.setNode(node.id, { width: node.width, height: node.height });
  }
  for (const node of model.nodes) {
    if (node.parentId && groupIds.has(node.parentId)) graph.setParent(node.id, node.parentId);
  }
  for (const edge of model.edges) {
    if (edge.variant === 'invisible') continue;
    if (!known.has(edge.source) || !known.has(edge.target)) continue;
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  const positions: PositionMap = {};
  for (const node of laidOut) {
    const laid = graph.node(node.id);
    if (!laid) continue;
    positions[node.id] = {
      x: Math.round(laid.x - node.width / 2),
      y: Math.round(laid.y - node.height / 2),
    };
  }
  return positions;
}

/**
 * Posiciones finales = las guardadas por el usuario cuando el nodo sigue
 * existiendo; auto-layout para los nodos nuevos. Así editar el texto no tira
 * abajo el acomodo manual.
 */
export function mergePositions(model: DiagramModel, saved: PositionMap, direction?: FlowDirection): PositionMap {
  const missing = model.nodes.filter((node) => node.kind !== 'group' && !saved[node.id]);
  if (!missing.length) {
    const result: PositionMap = {};
    for (const node of model.nodes) {
      if (saved[node.id]) result[node.id] = saved[node.id];
    }
    return result;
  }

  const fresh = autoLayout(model, direction);
  const result: PositionMap = {};
  for (const node of model.nodes) {
    if (node.kind === 'group') continue;
    result[node.id] = saved[node.id] ?? fresh[node.id] ?? { x: 0, y: 0 };
  }

  // Si había layout previo, empujamos los nodos nuevos fuera del bloque
  // existente en vez de superponerlos.
  const existing = model.nodes.filter((node) => node.kind !== 'group' && saved[node.id]);
  if (existing.length && missing.length) {
    let maxX = -Infinity;
    let minY = Infinity;
    for (const node of existing) {
      maxX = Math.max(maxX, saved[node.id].x + node.width);
      minY = Math.min(minY, saved[node.id].y);
    }
    let minFreshX = Infinity;
    let minFreshY = Infinity;
    for (const node of missing) {
      const point = fresh[node.id];
      if (!point) continue;
      minFreshX = Math.min(minFreshX, point.x);
      minFreshY = Math.min(minFreshY, point.y);
    }
    if (Number.isFinite(minFreshX)) {
      const dx = maxX + 120 - minFreshX;
      const dy = minY - minFreshY;
      for (const node of missing) {
        const point = result[node.id];
        if (point) result[node.id] = { x: point.x + dx, y: point.y + dy };
      }
    }
  }

  return result;
}

/**
 * Redondea posiciones al paso de la grilla.
 *
 * Sin esto, con la grilla activa las cajas quedaban entre líneas: el snap sólo
 * actúa al arrastrar, pero dagre no conoce la grilla y deja el acomodo inicial
 * en coordenadas arbitrarias.
 */
export function snapPositions(positions: PositionMap, grid: number): PositionMap {
  if (grid <= 0) return positions;
  const snapped: PositionMap = {};
  for (const [id, point] of Object.entries(positions)) {
    snapped[id] = {
      x: Math.round(point.x / grid) * grid,
      y: Math.round(point.y / grid) * grid,
    };
  }
  return snapped;
}
