import mermaid from 'mermaid';
import type {
  DiagramEdge,
  DiagramModel,
  DiagramNode,
  Diagnostic,
  EdgeVariant,
  EndpointMarker,
  FlowDirection,
  ParseResult,
  ShapeName,
} from './types';
import { TABLE, clamp, shapeSize, textWidth } from './measure';

let initialized = false;

function ensureInit() {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    flowchart: { htmlLabels: true },
    suppressErrorRendering: true,
  });
  initialized = true;
}

/**
 * Usamos el parser propio de mermaid (`getDiagramFromText`) en vez de leer el
 * SVG renderizado: así obtenemos el grafo semántico exacto (nodos, aristas,
 * subgrafos) y podemos hacer nuestro propio layout con cajas arrastrables.
 * Los tipos de diagrama que no sabemos convertir caen a render estático.
 */
async function getDiagram(source: string): Promise<any> {
  ensureInit();
  // `getDiagramFromText` está marcado como interno pero es la única vía
  // soportada para leer el AST; si desaparece, el catch nos deja en estático.
  return (mermaid as any).mermaidAPI.getDiagramFromText(source);
}

const DIRECTIONS = new Set(['LR', 'RL', 'TB', 'BT']);

function toDirection(raw: unknown, fallback: FlowDirection = 'TB'): FlowDirection {
  const value = String(raw ?? '').toUpperCase().replace('TD', 'TB');
  return DIRECTIONS.has(value) ? (value as FlowDirection) : fallback;
}

/** Mermaid tiene nombres clásicos y los nuevos `ShapeID` de v11; unificamos. */
const SHAPE_ALIASES: Record<string, ShapeName> = {
  square: 'rect',
  rect: 'rect',
  rectangle: 'rect',
  process: 'rect',
  round: 'round',
  rounded: 'round',
  'rounded-rect': 'round',
  event: 'round',
  stadium: 'stadium',
  pill: 'stadium',
  terminal: 'stadium',
  circle: 'circle',
  circ: 'circle',
  doublecircle: 'doublecircle',
  'double-circle': 'doublecircle',
  dbl_circ: 'doublecircle',
  diamond: 'diamond',
  diam: 'diamond',
  decision: 'diamond',
  question: 'diamond',
  hexagon: 'hexagon',
  hex: 'hexagon',
  prepare: 'hexagon',
  cylinder: 'cylinder',
  cyl: 'cylinder',
  database: 'cylinder',
  db: 'cylinder',
  subroutine: 'subroutine',
  'subproc': 'subroutine',
  framed_rectangle: 'subroutine',
  trapezoid: 'trapezoid',
  trap_b: 'trapezoid',
  manual: 'trapezoid',
  inv_trapezoid: 'inv_trapezoid',
  trap_t: 'inv_trapezoid',
  priority: 'inv_trapezoid',
  lean_right: 'lean_right',
  lean_r: 'lean_right',
  'in-out': 'lean_right',
  lean_left: 'lean_left',
  lean_l: 'lean_left',
  'out-in': 'lean_left',
  odd: 'odd',
  rect_left_inv_arrow: 'odd',
};

function toShape(raw: unknown): ShapeName {
  const key = String(raw ?? 'rect').toLowerCase();
  return SHAPE_ALIASES[key] ?? 'rect';
}

const STROKE_TO_VARIANT: Record<string, EdgeVariant> = {
  normal: 'solid',
  thick: 'thick',
  dotted: 'dashed',
  invisible: 'invisible',
};

/** `arrow_point`, `double_arrow_cross`, ... -> marcadores de inicio/fin. */
function flowEdgeMarkers(type: unknown): { start: EndpointMarker; end: EndpointMarker } {
  const value = String(type ?? 'arrow_point');
  const head: EndpointMarker = value.includes('cross')
    ? 'arrow-cross'
    : value.includes('circle')
      ? 'arrow-circle'
      : value.includes('point')
        ? 'arrow'
        : 'none';
  const double = value.startsWith('double_');
  return { start: double ? head : 'none', end: head };
}

/** Los labels de mermaid pueden traer markdown/HTML ligero. */
function cleanLabel(text: unknown, fallback = ''): string {
  const raw = String(text ?? '').trim();
  if (!raw) return fallback;
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    // ojo: no tocamos `_` ni `*` sueltos, son legítimos en identificadores
    // (LINEA_PEDIDO se mostraba como LINEAPEDIDO).
    .replace(/`/g, '');
}

// ---------------------------------------------------------------- flowchart

function buildFlowchart(db: any): DiagramModel {
  const vertices: Map<string, any> = db.getVertices();
  const rawEdges: any[] = db.getEdges();
  const subGraphs: any[] = db.getSubGraphs?.() ?? [];

  const nodes: DiagramNode[] = [];
  const parentOf = new Map<string, string>();

  for (const sub of subGraphs) {
    for (const child of sub.nodes ?? []) parentOf.set(child, `sg:${sub.id}`);
  }

  for (const sub of subGraphs) {
    nodes.push({
      id: `sg:${sub.id}`,
      kind: 'group',
      width: 0,
      height: 0,
      parentId: parentOf.get(sub.id),
      data: { kind: 'group', label: cleanLabel(sub.title, sub.id) },
    });
  }

  for (const [id, vertex] of vertices) {
    const shape = toShape(vertex.type);
    const label = cleanLabel(vertex.text, id);
    const { width, height } = shapeSize(label, shape);
    nodes.push({
      id,
      kind: 'shape',
      width,
      height,
      parentId: parentOf.get(id),
      data: {
        kind: 'shape',
        label,
        shape,
        cssStyles: (vertex.styles ?? []).join(';') || undefined,
        link: vertex.link,
      },
    });
  }

  const edges: DiagramEdge[] = rawEdges.map((edge, index) => {
    const markers = flowEdgeMarkers(edge.type);
    return {
      id: edge.id ?? `e${index}:${edge.start}->${edge.end}`,
      source: edge.start,
      target: edge.end,
      label: cleanLabel(edge.text) || undefined,
      variant: STROKE_TO_VARIANT[String(edge.stroke)] ?? 'solid',
      startMarker: markers.start,
      endMarker: markers.end,
      animated: Boolean(edge.animate),
    };
  });

  return { nodes, edges, direction: toDirection(db.getDirection?.()), diagramType: 'flowchart' };
}

// ------------------------------------------------------------------- er

const ER_MARKERS: Record<string, EndpointMarker> = {
  ZERO_OR_ONE: 'zero-one',
  ZERO_OR_MORE: 'zero-many',
  ONE_OR_MORE: 'one-many',
  ONLY_ONE: 'one',
  MD_PARENT: 'md-parent',
};

function buildEr(db: any): DiagramModel {
  const entities: Map<string, any> = db.getEntities();
  const relationships: any[] = db.getRelationships();

  const nodes: DiagramNode[] = [];
  for (const [name, entity] of entities) {
    const attributes = (entity.attributes ?? []).map((attr: any) => ({
      type: String(attr.type ?? ''),
      name: String(attr.name ?? ''),
      keys: (attr.keys ?? []) as string[],
      comment: attr.comment || undefined,
    }));
    const label = cleanLabel(entity.label ?? entity.alias, name);

    let widest = textWidth(label, 14, true) + 40;
    for (const attr of attributes) {
      widest = Math.max(widest, textWidth(attr.type, 12) + textWidth(attr.name, 13) + 90);
    }
    nodes.push({
      // el Map va indexado por nombre, pero las relaciones apuntan al `id`
      // sintético que genera erDb (`entity-NOMBRE-n`).
      id: String(entity.id ?? name),
      kind: 'entity',
      width: clamp(widest, 200, 460),
      height: TABLE.headerHeight + attributes.length * TABLE.rowHeight + 6,
      data: { kind: 'entity', name: label, alias: entity.alias, attributes },
    });
  }

  const edges: DiagramEdge[] = relationships.map((rel, index) => ({
    id: `er${index}:${rel.entityA}->${rel.entityB}`,
    source: rel.entityA,
    target: rel.entityB,
    label: cleanLabel(rel.roleA) || undefined,
    // mermaid dibuja cardB al inicio y cardA al final (ver erRenderer)
    startMarker: ER_MARKERS[rel.relSpec?.cardB] ?? 'none',
    endMarker: ER_MARKERS[rel.relSpec?.cardA] ?? 'none',
    variant: rel.relSpec?.relType === 'IDENTIFYING' ? 'solid' : 'dashed',
  }));

  return { nodes, edges, direction: toDirection(db.getDirection?.(), 'TB'), diagramType: 'erDiagram' };
}

// ---------------------------------------------------------------- class

const CLASS_RELATION_MARKERS: Record<number, EndpointMarker> = {
  0: 'aggregation',
  1: 'extension',
  2: 'composition',
  3: 'dependency',
  4: 'lollipop',
};

function memberText(member: any): string {
  if (typeof member === 'string') return member;
  if (typeof member?.getDisplayDetails === 'function') {
    return String(member.getDisplayDetails().displayText ?? '');
  }
  return String(member?.text ?? '');
}

function buildClass(db: any): DiagramModel {
  const classes: Map<string, any> = db.getClasses();
  const relations: any[] = db.getRelations();

  const nodes: DiagramNode[] = [];
  for (const [key, node] of classes) {
    const id = String(node.id ?? key);
    const members = (node.members ?? []).map(memberText).filter(Boolean);
    const methods = (node.methods ?? []).map(memberText).filter(Boolean);
    const annotations = (node.annotations ?? []).map((a: any) => `«${a}»`);
    const label = cleanLabel(node.label, id);

    let widest = textWidth(label, 14, true) + 32;
    for (const line of [...annotations, ...members, ...methods]) {
      widest = Math.max(widest, textWidth(line, 12) + 32);
    }
    const rows = annotations.length + members.length + methods.length;
    const dividers = (members.length ? 1 : 0) + (methods.length ? 1 : 0);
    nodes.push({
      id,
      kind: 'class',
      width: clamp(widest, 170, 400),
      height: TABLE.headerHeight + rows * 22 + dividers * 9 + 10,
      parentId: node.parent ? `ns:${node.parent}` : undefined,
      data: {
        kind: 'class',
        name: label,
        annotations,
        members,
        methods,
        cssStyles: (node.styles ?? []).join(';') || undefined,
      },
    });
  }

  const namespaces: Map<string, any> = db.getNamespaces?.() ?? new Map();
  for (const [id, ns] of namespaces) {
    nodes.push({
      id: `ns:${id}`,
      kind: 'group',
      width: 0,
      height: 0,
      data: { kind: 'group', label: cleanLabel(ns.label, id) },
    });
  }

  const edges: DiagramEdge[] = relations.map((rel, index) => ({
    id: rel.id ?? `cr${index}:${rel.id1}->${rel.id2}`,
    source: rel.id1,
    target: rel.id2,
    label: cleanLabel(rel.title) || undefined,
    variant: rel.relation?.lineType === 1 ? 'dashed' : 'solid',
    startMarker: CLASS_RELATION_MARKERS[rel.relation?.type1] ?? 'none',
    endMarker: CLASS_RELATION_MARKERS[rel.relation?.type2] ?? 'none',
  }));

  return { nodes, edges, direction: toDirection(db.getDirection?.(), 'TB'), diagramType: 'classDiagram' };
}

// ------------------------------------------------------------- state

function buildState(db: any): DiagramModel {
  // `getData()` devuelve el grafo ya aplanado que usa el renderer unificado.
  const data = db.getData();
  const nodes: DiagramNode[] = [];
  const parents = new Set<string>();
  for (const node of data.nodes ?? []) {
    if (node.parentId) parents.add(node.parentId);
  }

  for (const node of data.nodes ?? []) {
    const label = cleanLabel(node.label, node.id);
    if (node.isGroup || parents.has(node.id)) {
      nodes.push({
        id: node.id,
        kind: 'group',
        width: 0,
        height: 0,
        parentId: node.parentId ?? undefined,
        data: { kind: 'group', label },
      });
      continue;
    }
    const shape = node.shape === 'stateStart' || node.shape === 'stateEnd' ? 'circle' : 'round';
    const isMarker = node.shape === 'stateStart' || node.shape === 'stateEnd';
    const size = isMarker ? { width: 24, height: 24 } : shapeSize(label, shape);
    nodes.push({
      id: node.id,
      kind: 'shape',
      width: size.width,
      height: size.height,
      parentId: node.parentId ?? undefined,
      data: { kind: 'shape', label: isMarker ? '' : label, shape },
    });
  }

  const edges: DiagramEdge[] = (data.edges ?? []).map((edge: any, index: number) => ({
    id: edge.id ?? `st${index}`,
    source: edge.start,
    target: edge.end,
    label: cleanLabel(edge.label) || undefined,
    variant: 'solid',
    startMarker: 'none',
    endMarker: 'arrow',
  }));

  return { nodes, edges, direction: toDirection(data.direction, 'TB'), diagramType: 'stateDiagram' };
}

// ------------------------------------------------------------------ api

const BUILDERS: Record<string, (db: any) => DiagramModel> = {
  flowchart: buildFlowchart,
  'flowchart-v2': buildFlowchart,
  graph: buildFlowchart,
  er: buildEr,
  erDiagram: buildEr,
  classDiagram: buildClass,
  'class': buildClass,
  'classDiagram-v2': buildClass,
  stateDiagram: buildState,
  state: buildState,
  'stateDiagram-v2': buildState,
};

function toDiagnostics(error: unknown): Diagnostic[] {
  const anyErr = error as { hash?: { loc?: { first_line?: number; first_column?: number } }; message?: string; str?: string };
  const message = anyErr?.str ?? anyErr?.message ?? String(error);
  return [
    {
      message: message.split('\n')[0] || 'Error de sintaxis Mermaid',
      severity: 'error',
      line: anyErr?.hash?.loc?.first_line,
      column: anyErr?.hash?.loc?.first_column != null ? anyErr.hash.loc.first_column + 1 : undefined,
    },
  ];
}

export async function parseMermaid(source: string): Promise<ParseResult> {
  if (!source.trim()) {
    return { model: { nodes: [], edges: [], direction: 'TB', diagramType: 'mermaid' }, diagnostics: [] };
  }

  let diagram: any;
  try {
    diagram = await getDiagram(source);
  } catch (error) {
    return { model: null, diagnostics: toDiagnostics(error) };
  }

  const type = String(diagram.type ?? '');
  const builder = BUILDERS[type];
  if (!builder) {
    // pie, gantt, journey, sequence, mindmap... se muestran con el render nativo
    return {
      model: { nodes: [], edges: [], direction: 'TB', diagramType: type, fallbackToStatic: true },
      diagnostics: [],
    };
  }

  try {
    const model = builder(diagram.db);
    if (!model.nodes.length) {
      return { model: { ...model, fallbackToStatic: true }, diagnostics: [] };
    }
    return { model, diagnostics: [] };
  } catch (error) {
    // el diagrama parseó bien pero cambió la forma interna del db: mostrar estático
    console.warn('[mermaid] no se pudo convertir a nodos interactivos:', error);
    return {
      model: { nodes: [], edges: [], direction: 'TB', diagramType: type, fallbackToStatic: true },
      diagnostics: [],
    };
  }
}

let renderCounter = 0;

/** Render nativo de mermaid a SVG, para los tipos sin soporte interactivo. */
export async function renderMermaidSvg(source: string, dark: boolean): Promise<string> {
  ensureInit();
  // 'strict' y no 'loose': este SVG termina en dangerouslySetInnerHTML, así que
  // dejamos que mermaid sanitice el HTML incrustado en las etiquetas.
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: dark ? 'dark' : 'default',
    suppressErrorRendering: true,
  });
  const { svg } = await mermaid.render(`mmd-static-${renderCounter++}`, source);
  return svg;
}
