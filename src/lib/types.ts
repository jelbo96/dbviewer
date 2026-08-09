/**
 * Modelo intermedio común. Tanto DBML como Mermaid se traducen a este modelo,
 * y el canvas (React Flow) sólo conoce este modelo. Así agregar una fuente
 * nueva es escribir un parser, no tocar el render.
 */

export type SourceLang = 'dbml' | 'mermaid';

export type NodeKind = 'table' | 'enum' | 'shape' | 'entity' | 'class' | 'group';

export type FlowDirection = 'LR' | 'RL' | 'TB' | 'BT';

export interface Column {
  id: string;
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  unique: boolean;
  notNull: boolean;
  increment: boolean;
  defaultValue?: string;
  note?: string;
  isEnum: boolean;
}

export interface TableData {
  name: string;
  schema?: string;
  alias?: string;
  note?: string;
  columns: Column[];
  headerColor?: string;
}

export interface EnumData {
  name: string;
  schema?: string;
  values: { name: string; note?: string }[];
}

/** Formas de flowchart de Mermaid que sabemos dibujar. */
export type ShapeName =
  | 'rect'
  | 'round'
  | 'stadium'
  | 'circle'
  | 'doublecircle'
  | 'diamond'
  | 'hexagon'
  | 'cylinder'
  | 'subroutine'
  | 'trapezoid'
  | 'inv_trapezoid'
  | 'lean_right'
  | 'lean_left'
  | 'odd';

export interface ShapeData {
  label: string;
  shape: ShapeName;
  cssStyles?: string;
  link?: string;
}

export interface EntityAttr {
  type: string;
  name: string;
  keys: string[];
  comment?: string;
}

export interface EntityData {
  name: string;
  alias?: string;
  attributes: EntityAttr[];
}

export interface ClassData {
  name: string;
  annotations: string[];
  members: string[];
  methods: string[];
  cssStyles?: string;
}

export interface GroupData {
  label: string;
}

export type NodeData =
  | ({ kind: 'table' } & TableData)
  | ({ kind: 'enum' } & EnumData)
  | ({ kind: 'shape' } & ShapeData)
  | ({ kind: 'entity' } & EntityData)
  | ({ kind: 'class' } & ClassData)
  | ({ kind: 'group' } & GroupData);

export interface DiagramNode {
  id: string;
  kind: NodeKind;
  data: NodeData;
  /** tamaño estimado, usado por el auto-layout y como tamaño inicial */
  width: number;
  height: number;
  /** id del nodo group contenedor (subgraph de mermaid / TableGroup de dbml) */
  parentId?: string;
}

export type EdgeVariant = 'solid' | 'dashed' | 'thick' | 'invisible';

/** Extremo de una relación: cómo se dibuja la punta. */
export type EndpointMarker =
  | 'none'
  // flowchart
  | 'arrow'
  | 'arrow-cross'
  | 'arrow-circle'
  // pata de gallo (DBML / erDiagram)
  | 'one'
  | 'many'
  | 'zero-one'
  | 'zero-many'
  | 'one-many'
  | 'md-parent'
  // classDiagram
  | 'aggregation'
  | 'composition'
  | 'extension'
  | 'dependency'
  | 'lollipop';

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  /** id de columna/atributo al que se ancla (DBML/ER); si falta, se ancla al nodo */
  sourceAnchor?: string;
  targetAnchor?: string;
  label?: string;
  variant: EdgeVariant;
  startMarker: EndpointMarker;
  endMarker: EndpointMarker;
  animated?: boolean;
}

export interface DiagramModel {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  direction: FlowDirection;
  /** tipo detectado: 'dbml', 'flowchart', 'erDiagram', 'classDiagram', ... */
  diagramType: string;
  /** true cuando no podemos hacer nodos arrastrables y hay que caer al SVG de mermaid */
  fallbackToStatic?: boolean;
}

export interface Diagnostic {
  message: string;
  severity: 'error' | 'warning';
  /** 1-indexado */
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface ParseResult {
  model: DiagramModel | null;
  diagnostics: Diagnostic[];
}

export const EMPTY_MODEL: DiagramModel = {
  nodes: [],
  edges: [],
  direction: 'LR',
  diagramType: 'empty',
};
