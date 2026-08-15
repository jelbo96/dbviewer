import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ViewportPortal,
  applyNodeChanges,
  useReactFlow,
  useUpdateNodeInternals,
  type Edge,
  type Node,
  type NodeChange,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useStore, selectActive } from '../store/useStore';
import type { DiagramModel, DiagramNode, NodeKind } from '../lib/types';
import type { Point } from '../lib/layout';
import { autoLayout, mergePositions, snapPositions } from '../lib/layout';
import { TableNode } from './nodes/TableNode';
import { EnumNode } from './nodes/EnumNode';
import { EntityNode } from './nodes/EntityNode';
import { ClassNode } from './nodes/ClassNode';
import { ShapeNode } from './nodes/ShapeNode';
import { GroupNode } from './nodes/GroupNode';
import { RelationEdge } from './RelationEdge';
import { EdgeMarkers } from './EdgeMarkers';
import { markerUrl } from './edgeMarkerIds';
import { HighlightContext, type Highlight } from './HighlightContext';
import { StaticDiagram } from './StaticDiagram';
import type { Side } from './nodes/anchors';

const nodeTypes = {
  table: TableNode,
  enum: EnumNode,
  entity: EntityNode,
  class: ClassNode,
  shape: ShapeNode,
  group: GroupNode,
};

const edgeTypes = { relation: RelationEdge };

/** Los nodos "de datos" sólo tienen anclas a izquierda/derecha. */
const VERTICAL_CAPABLE: Record<NodeKind, boolean> = {
  table: false,
  enum: false,
  entity: false,
  class: true,
  shape: true,
  group: false,
};

const ORTHOGONAL_TYPES = new Set(['dbml', 'erDiagram', 'classDiagram']);

const GROUP_PADDING = 26;
const GROUP_LABEL_SPACE = 14;

/**
 * Un solo valor para el fondo y para el snap: si no coinciden, la grilla miente.
 * 10px da un paso fino al arrastrar; con 20 las cajas saltaban demasiado.
 */
const GRID_SIZE = 10;
const GRID_MAJOR_EVERY = 5;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const centerX = (box: Box) => box.x + box.width / 2;
const centerY = (box: Box) => box.y + box.height / 2;

function pickSides(source: Box, target: Box, allowVertical: boolean): [Side, Side] {
  const dx = centerX(target) - centerX(source);
  const dy = centerY(target) - centerY(source);

  if (allowVertical && Math.abs(dy) > Math.abs(dx)) {
    return dy >= 0 ? ['b', 't'] : ['t', 'b'];
  }
  // Empate exacto (mismo centro, p.ej. self-loop): salimos y entramos por la derecha.
  if (dx === 0 && dy === 0) return ['r', 'r'];
  return dx >= 0 ? ['r', 'l'] : ['l', 'r'];
}

/**
 * Los grupos (TableGroup / subgraph) no son nodos padre de React Flow: su caja
 * se deriva del bounding box de los hijos en cada render. Así arrastrar un hijo
 * reajusta el recuadro solo, y no hay que lidiar con coordenadas relativas.
 */
function computeGroupBoxes(model: DiagramModel, boxes: Map<string, Box>): Node[] {
  const groups = model.nodes.filter((node) => node.kind === 'group');
  if (!groups.length) return [];

  const childrenOf = new Map<string, string[]>();
  for (const node of model.nodes) {
    if (!node.parentId) continue;
    const list = childrenOf.get(node.parentId) ?? [];
    list.push(node.id);
    childrenOf.set(node.parentId, list);
  }

  const resolved = new Map<string, Box>();
  const visiting = new Set<string>();

  const boxOf = (id: string): Box | null => {
    const direct = boxes.get(id);
    if (direct) return direct;
    if (resolved.has(id)) return resolved.get(id)!;
    if (visiting.has(id)) return null; // ciclo de subgraphs mal formado
    visiting.add(id);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const childId of childrenOf.get(id) ?? []) {
      const child = boxOf(childId);
      if (!child) continue;
      minX = Math.min(minX, child.x);
      minY = Math.min(minY, child.y);
      maxX = Math.max(maxX, child.x + child.width);
      maxY = Math.max(maxY, child.y + child.height);
    }
    visiting.delete(id);
    if (!Number.isFinite(minX)) return null;

    const box: Box = {
      x: minX - GROUP_PADDING,
      y: minY - GROUP_PADDING - GROUP_LABEL_SPACE,
      width: maxX - minX + GROUP_PADDING * 2,
      height: maxY - minY + GROUP_PADDING * 2 + GROUP_LABEL_SPACE,
    };
    resolved.set(id, box);
    return box;
  };

  const result: Node[] = [];
  for (const group of groups) {
    const box = boxOf(group.id);
    if (!box) continue;
    result.push({
      id: group.id,
      type: 'group',
      position: { x: box.x, y: box.y },
      width: box.width,
      height: box.height,
      data: group.data as unknown as Record<string, unknown>,
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1,
    });
  }
  return result;
}

function toFlowNode(node: DiagramNode, position: Point): Node {
  return {
    id: node.id,
    type: node.kind,
    position,
    width: node.width,
    height: node.height,
    data: { ...(node.data as unknown as Record<string, unknown>), _w: node.width, _h: node.height },
  };
}

function InnerCanvas() {
  const model = useStore((state) => state.model);
  const activeId = useStore((state) => state.activeId);
  const direction = useStore((state) => selectActive(state).direction);
  const snapToGrid = useStore((state) => state.snapToGrid);
  const showMinimap = useStore((state) => state.showMinimap);
  const theme = useStore((state) => state.theme);
  const staticSvg = useStore((state) => state.staticSvg);
  const parsing = useStore((state) => state.parsing);
  const setPositions = useStore((state) => state.setPositions);
  const updatePositions = useStore((state) => state.updatePositions);
  const setSelected = useStore((state) => state.setSelected);
  const selectedId = useStore((state) => state.selectedId);
  const layoutNonce = useStore((state) => state.layoutNonce);
  const fitNonce = useStore((state) => state.fitNonce);

  const [nodes, setNodes] = useState<Node[]>([]);
  const updateNodeInternals = useUpdateNodeInternals();
  const { fitView } = useReactFlow();
  const fitKeyRef = useRef<string>('');

  // Reconstruye los nodos cuando cambia el modelo, conservando las posiciones
  // que el usuario ya movió (mergePositions sólo autoacomoda los nodos nuevos).
  useEffect(() => {
    const dir = direction === 'auto' ? undefined : direction;
    const raw = mergePositions(model, selectActive(useStore.getState()).positions ?? {}, dir);
    // con la grilla activa alineamos también lo que acomodó dagre, si no las
    // cajas quedan entre líneas hasta que el usuario las arrastre una por una
    const merged = snapToGrid ? snapPositions(raw, GRID_SIZE) : raw;
    setNodes(model.nodes.filter((node) => node.kind !== 'group').map((node) => toFlowNode(node, merged[node.id])));
    setPositions(merged);
  }, [model, activeId, direction, snapToGrid, setPositions]);

  // Las anclas por columna cambian de sitio al editar una tabla; sin esto
  // React Flow seguiría usando las coordenadas de handle anteriores.
  //
  // Los ids salen de `nodes` (lo que está montado), NUNCA de `model`:
  // `updateNodeInternals` mide con `force`, así que pedirle un nodo que todavía
  // no está en el DOM le deja `handleBounds` en null y entonces descarta todas
  // las aristas que lo tocan. `nodeIdsKey` evita re-medir en cada arrastre.
  const nodeIds = useMemo(() => nodes.map((node) => node.id), [nodes]);
  // clave sólo para disparar el efecto; los ids se leen del array, no de ella
  const nodeIdsKey = nodeIds.join('\u0000');
  useEffect(() => {
    if (!nodeIds.length) return;
    const raf = requestAnimationFrame(() => updateNodeInternals(nodeIds));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nodeIds cambia en cada arrastre; nodeIdsKey no
  }, [nodeIdsKey, model, updateNodeInternals]);

  // Las dimensiones salen del modelo (las calculamos nosotros); de los nodos de
  // React Flow sólo tomamos la posición, que sí cambia al arrastrar.
  const boxes = useMemo(() => {
    const dims = new Map(model.nodes.map((node) => [node.id, node]));
    const map = new Map<string, Box>();
    for (const node of nodes) {
      const source = dims.get(node.id);
      map.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        width: source?.width ?? node.measured?.width ?? 200,
        height: source?.height ?? node.measured?.height ?? 80,
      });
    }
    return map;
  }, [nodes, model]);

  const kindOf = useMemo(() => {
    const map = new Map<string, NodeKind>();
    for (const node of model.nodes) map.set(node.id, node.kind);
    return map;
  }, [model]);

  const groupNodes = useMemo(() => computeGroupBoxes(model, boxes), [model, boxes]);

  const displayNodes = useMemo(() => [...groupNodes, ...nodes], [groupNodes, nodes]);

  const edges: Edge[] = useMemo(() => {
    const orthogonal = ORTHOGONAL_TYPES.has(model.diagramType);
    const result: Edge[] = [];
    for (const edge of model.edges) {
      if (edge.variant === 'invisible') continue;
      const sourceBox = boxes.get(edge.source);
      const targetBox = boxes.get(edge.target);
      if (!sourceBox || !targetBox) continue;

      const allowVertical =
        (VERTICAL_CAPABLE[kindOf.get(edge.source) ?? 'shape'] ?? true) &&
        (VERTICAL_CAPABLE[kindOf.get(edge.target) ?? 'shape'] ?? true) &&
        !edge.sourceAnchor &&
        !edge.targetAnchor;

      const [sourceSide, targetSide] = pickSides(sourceBox, targetBox, allowVertical);
      result.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: `${edge.sourceAnchor ?? 'node'}:${sourceSide}`,
        targetHandle: `${edge.targetAnchor ?? 'node'}:${targetSide}`,
        type: 'relation',
        markerStart: markerUrl(edge.startMarker),
        markerEnd: markerUrl(edge.endMarker),
        animated: edge.animated,
        data: { variant: edge.variant, label: edge.label, orthogonal },
      });
    }
    return result;
  }, [model, boxes, kindOf]);

  const highlight: Highlight = useMemo(() => {
    const anchors = new Set<string>();
    const relatedNodes = new Set<string>();
    const relatedEdges = new Set<string>();
    if (!selectedId) return { anchors, nodes: relatedNodes, edges: relatedEdges, active: false };

    relatedNodes.add(selectedId);
    for (const edge of model.edges) {
      if (edge.source !== selectedId && edge.target !== selectedId) continue;
      relatedEdges.add(edge.id);
      relatedNodes.add(edge.source);
      relatedNodes.add(edge.target);
      if (edge.sourceAnchor) anchors.add(edge.sourceAnchor);
      if (edge.targetAnchor) anchors.add(edge.targetAnchor);
    }
    return { anchors, nodes: relatedNodes, edges: relatedEdges, active: true };
  }, [selectedId, model]);

  // Los nodos de grupo son derivados y no viven en `nodes`; `applyNodeChanges`
  // ignora por sí solo los cambios cuyo id no encuentra.
  const onNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const commitPositions = useCallback(() => {
    const updates: Record<string, Point> = {};
    for (const node of nodes) updates[node.id] = node.position;
    updatePositions(updates);
  }, [nodes, updatePositions]);

  // Auto-encuadre sólo cuando cambia el conjunto de nodos de forma relevante
  // (otro lenguaje, otro tipo de diagrama), no en cada tecla.
  const fitKey = `${activeId}:${model.diagramType}:${model.nodes.length > 0}`;
  useEffect(() => {
    if (fitKeyRef.current === fitKey) return;
    fitKeyRef.current = fitKey;
    const timer = window.setTimeout(() => fitView({ padding: 0.18, maxZoom: 1 }), 60);
    return () => window.clearTimeout(timer);
  }, [fitKey, fitView]);

  useEffect(() => {
    if (!fitNonce) return;
    fitView({ padding: 0.18, maxZoom: 1, duration: 300 });
  }, [fitNonce, fitView]);

  // Reacomodo: recalcula todo con dagre y descarta lo arrastrado.
  //
  // Depende SÓLO del nonce. La dirección y la grilla se leen en el momento: si
  // van en las dependencias, cambiar cualquiera de las dos rehace el layout por
  // su cuenta y se lleva por delante las posiciones que el usuario movió a mano
  // (togglear "Grilla" bastaba para perderlas).
  useEffect(() => {
    if (!layoutNonce) return;
    const state = useStore.getState();
    const stored = selectActive(state).direction;
    const dir = stored === 'auto' ? undefined : stored;
    const computed = autoLayout(state.model, dir);
    const fresh = state.snapToGrid ? snapPositions(computed, GRID_SIZE) : computed;
    setNodes((current) =>
      current.map((node) => (fresh[node.id] ? { ...node, position: fresh[node.id] } : node)),
    );
    setPositions(fresh);
    window.setTimeout(() => fitView({ padding: 0.18, maxZoom: 1, duration: 300 }), 60);
  }, [layoutNonce, setPositions, fitView]);

  if (staticSvg) {
    return <StaticDiagram svg={staticSvg} type={model.diagramType} />;
  }

  return (
    <HighlightContext.Provider value={highlight}>
      <ReactFlow
        nodes={displayNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={commitPositions}
        onSelectionDragStop={commitPositions}
        onNodeClick={(_, node) => setSelected(node.id)}
        onPaneClick={() => setSelected(null)}
        colorMode={theme}
        // Misma convención que la vista estática y que Figma: la rueda
        // desplaza y el pinch hace zoom. Por defecto React Flow hace zoom con
        // la rueda, lo que en diagramas altos se siente antinatural.
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        connectionMode={ConnectionMode.Loose}
        nodesConnectable={false}
        elementsSelectable
        snapToGrid={snapToGrid}
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        minZoom={0.05}
        maxZoom={2.5}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'relation' }}
      >
        {/* Los defs viven dentro del viewport para que el export a imagen,
            que clona ese subárbol, se lleve los marcadores con él. */}
        <ViewportPortal>
          <EdgeMarkers />
        </ViewportPortal>
        {/* Con la grilla activa se dibuja de verdad (y con el mismo paso que
            usa el snap); si no, sólo los puntos de referencia. */}
        {snapToGrid ? (
          <>
            <Background
              id="grid-minor"
              variant={BackgroundVariant.Lines}
              gap={GRID_SIZE}
              lineWidth={1}
              color="var(--grid-line)"
            />
            <Background
              id="grid-major"
              variant={BackgroundVariant.Lines}
              gap={GRID_SIZE * GRID_MAJOR_EVERY}
              lineWidth={1}
              color="var(--grid-line-strong)"
            />
          </>
        ) : (
          <Background variant={BackgroundVariant.Dots} gap={GRID_SIZE} size={1} color="var(--grid-dot)" />
        )}
        {/* mismos márgenes que el auto-encuadre: el control de React Flow usa
            padding 0.1 por defecto y encuadraba distinto según de dónde
            vinieras */}
        <Controls showInteractive={false} fitViewOptions={{ padding: 0.18, maxZoom: 1 }} />
        {showMinimap && (
          <MiniMap pannable zoomable nodeColor="var(--border-strong)" maskColor="transparent" nodeStrokeWidth={0} />
        )}
      </ReactFlow>
      {/* durante el primer parseo se está bajando el chunk del parser: no
          anunciamos "sin diagrama" hasta que sepamos que de verdad está vacío */}
      {!model.nodes.length && !parsing && (
        <div className="canvas__empty">
          <strong>Sin diagrama</strong>
          <span>Escribe en el editor o carga un ejemplo</span>
        </div>
      )}
    </HighlightContext.Provider>
  );
}

/** El `ReactFlowProvider` lo monta App, para que la toolbar comparta la instancia. */
export function DiagramCanvas() {
  return (
    <div className="canvas" id="diagram-canvas">
      <InnerCanvas />
    </div>
  );
}
