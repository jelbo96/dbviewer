/**
 * Forma del AST interno de Mermaid, acotada a lo que consumimos.
 *
 * Mermaid no exporta estos tipos: `mermaidAPI.getDiagramFromText` devuelve un
 * `db` cuya interfaz depende del tipo de diagrama. Declararla aquí documenta
 * el contrato del que dependemos y hace que un cambio en Mermaid rompa la
 * compilación en vez de fallar en silencio en tiempo de ejecución.
 *
 * Todo es opcional a propósito: si Mermaid deja de entregar un campo, el
 * parser cae a su valor por defecto en vez de lanzar.
 */

export interface FlowVertex {
  id: string;
  text?: string;
  type?: string;
  styles?: string[];
  link?: string;
}

export interface FlowEdge {
  id?: string;
  start: string;
  end: string;
  text?: string;
  type?: string;
  stroke?: string;
  animate?: boolean;
}

export interface FlowSubGraph {
  id: string;
  title?: string;
  nodes?: string[];
}

export interface FlowDb {
  getVertices(): Map<string, FlowVertex>;
  getEdges(): FlowEdge[];
  getSubGraphs?(): FlowSubGraph[];
  getDirection?(): string | undefined;
}

export interface ErAttribute {
  type?: string;
  name?: string;
  keys?: string[];
  comment?: string;
}

export interface ErEntity {
  /** id sintético (`entity-NOMBRE-n`); el Map va indexado por nombre */
  id?: string;
  label?: string;
  alias?: string;
  attributes?: ErAttribute[];
}

export interface ErRelationship {
  entityA: string;
  entityB: string;
  roleA?: string;
  relSpec?: { cardA?: string; cardB?: string; relType?: string };
}

export interface ErDb {
  getEntities(): Map<string, ErEntity>;
  getRelationships(): ErRelationship[];
  getDirection?(): string | undefined;
}

export interface ClassMember {
  text?: string;
  getDisplayDetails?(): { displayText?: string };
}

export interface ClassNode {
  id?: string;
  label?: string;
  members?: ClassMember[];
  methods?: ClassMember[];
  annotations?: string[];
  styles?: string[];
  parent?: string;
}

export interface ClassRelation {
  id?: string;
  id1: string;
  id2: string;
  title?: string;
  relation?: { type1?: number; type2?: number; lineType?: number };
}

export interface ClassDb {
  getClasses(): Map<string, ClassNode>;
  getRelations(): ClassRelation[];
  getNamespaces?(): Map<string, { label?: string }>;
  getDirection?(): string | undefined;
}

export interface StateNode {
  id: string;
  label?: string;
  shape?: string;
  isGroup?: boolean;
  parentId?: string | null;
}

export interface StateEdge {
  id?: string;
  start: string;
  end: string;
  label?: string;
}

export interface StateDb {
  getData(): { nodes?: StateNode[]; edges?: StateEdge[]; direction?: string };
}

export type AnyDiagramDb = FlowDb | ErDb | ClassDb | StateDb;

export interface MermaidDiagram {
  type: string;
  db: AnyDiagramDb;
}

/** `getDiagramFromText` es interno pero es la única vía para leer el AST. */
export interface MermaidInternalApi {
  mermaidAPI: {
    getDiagramFromText(text: string): Promise<MermaidDiagram>;
  };
}
