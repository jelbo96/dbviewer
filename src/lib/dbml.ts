import type {
  Column,
  DiagramEdge,
  DiagramNode,
  Diagnostic,
  EndpointMarker,
  ParseResult,
} from './types';
import { BADGE_WIDTH, ENUMS, TABLE, clamp, monoWidth, textWidth } from './measure';

/**
 * `Parser.parse(...).normalize()` devuelve un store plano indexado por id
 * (tables, fields, refs, endpoints, enums, tableGroups...). Estos tipos
 * describen sólo lo que consumimos.
 */
interface RawField {
  id: number;
  name: string;
  type: { type_name: string; args: string | null; schemaName: string | null };
  unique: boolean;
  pk: boolean;
  not_null?: boolean;
  increment?: boolean;
  note: string | null;
  dbdefault?: { value: string; type: string };
  endpointIds: number[];
  tableId: number;
  enumId: number | null;
}

interface RawTable {
  id: number;
  name: string;
  alias: string | null;
  note: string | null;
  fieldIds: number[];
  schemaId: number;
  groupId: number | null;
  headerColor?: string;
}

interface RawEndpoint {
  id: number;
  tableName: string;
  fieldNames: string[];
  relation: '1' | '*';
  refId: number;
  fieldIds: number[];
}

interface RawRef {
  id: number;
  endpointIds: number[];
  name?: string | null;
}

interface RawEnum {
  id: number;
  name: string;
  valueIds: number[];
  schemaId: number;
}

interface RawEnumValue {
  id: number;
  name: string;
  note: string | null;
}

interface RawSchema {
  id: number;
  name: string;
}

interface RawTableGroup {
  id: number;
  name: string;
  tableIds: number[];
}

interface Normalized {
  schemas: Record<string, RawSchema>;
  tables: Record<string, RawTable>;
  fields: Record<string, RawField>;
  refs: Record<string, RawRef>;
  endpoints: Record<string, RawEndpoint>;
  enums: Record<string, RawEnum>;
  enumValues: Record<string, RawEnumValue>;
  tableGroups: Record<string, RawTableGroup>;
}

export const tableNodeId = (id: number) => `t${id}`;
export const enumNodeId = (id: number) => `e${id}`;
export const groupNodeId = (id: number) => `g${id}`;
export const columnAnchorId = (id: number) => `f${id}`;

function tableSize(table: RawTable, columns: Column[], headerText: string) {
  // header: acento (7) + nombre + alias
  let widest = textWidth(headerText, 13.5, true) + 24 + (table.alias ? 40 : 0);

  for (const col of columns) {
    const badges =
      Number(col.pk) + Number(col.fk) + Number(col.unique && !col.pk) + Number(col.notNull && !col.pk);
    const row = textWidth(col.name, 12.5) + TABLE.gap + badges * BADGE_WIDTH + monoWidth(col.type) + TABLE.gap;
    widest = Math.max(widest, row);
  }

  const width = clamp(widest + TABLE.paddingX * 2, TABLE.minWidth, TABLE.maxWidth);
  const height = TABLE.headerHeight + columns.length * TABLE.rowHeight + 6 + (table.note ? TABLE.noteHeight : 0);
  return { width, height };
}

function enumSize(name: string, values: { name: string }[]) {
  // el header lleva además el badge "enum"
  let widest = textWidth(name, 13.5, true) + 24 + 42;
  for (const value of values) widest = Math.max(widest, monoWidth(value.name, 11.5) + 24);
  const width = clamp(widest, ENUMS.minWidth, ENUMS.maxWidth);
  const height = ENUMS.headerHeight + values.length * ENUMS.rowHeight + 6;
  return { width, height };
}

/** `1` -> exactamente uno, `*` -> muchos (pata de gallo). */
function markerFor(relation: '1' | '*'): EndpointMarker {
  return relation === '*' ? 'many' : 'one';
}

function formatDefault(field: RawField): string | undefined {
  if (!field.dbdefault) return undefined;
  const { value, type } = field.dbdefault;
  if (type === 'string') return `'${value}'`;
  if (type === 'expression') return `\`${value}\``;
  return String(value);
}

/**
 * Los errores del compilador DBML vienen como `{ diags: [...] }` con
 * posiciones 1-indexadas; a veces llegan como Error normal.
 */
interface CompilerPosition {
  line?: number;
  column?: number;
}

interface CompilerDiagnostic {
  message?: string;
  location?: { start?: CompilerPosition; end?: CompilerPosition };
}

function toDiagnostics(error: unknown): Diagnostic[] {
  const raw = error as { diags?: unknown; message?: string };
  const diags = raw?.diags;
  if (Array.isArray(diags)) {
    return (diags as CompilerDiagnostic[]).map((diagnostic) => ({
      message: String(diagnostic.message ?? 'Error de sintaxis'),
      severity: 'error' as const,
      line: diagnostic.location?.start?.line,
      column: diagnostic.location?.start?.column,
      endLine: diagnostic.location?.end?.line,
      endColumn: diagnostic.location?.end?.column,
    }));
  }
  return [{ message: raw?.message ?? String(error), severity: 'error' }];
}

/**
 * `@dbml/core` trae los parsers de todos los dialectos SQL y pesa varios MB;
 * lo cargamos bajo demanda para no meterlo en el bundle inicial.
 */
export async function parseDbml(source: string): Promise<ParseResult> {
  if (!source.trim()) {
    return { model: { nodes: [], edges: [], direction: 'LR', diagramType: 'dbml' }, diagnostics: [] };
  }

  let normalized: Normalized;
  try {
    const { Parser } = await import('@dbml/core');
    normalized = Parser.parse(source, 'dbmlv2').normalize() as unknown as Normalized;
  } catch (error) {
    return { model: null, diagnostics: toDiagnostics(error) };
  }

  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  const schemaName = (schemaId: number) => {
    const name = normalized.schemas[schemaId]?.name;
    return name && name !== 'public' ? name : undefined;
  };

  // --- Grupos de tablas (se dibujan como recuadros de fondo) ---
  const groupOfTable = new Map<number, string>();
  for (const group of Object.values(normalized.tableGroups ?? {})) {
    const id = groupNodeId(group.id);
    nodes.push({
      id,
      kind: 'group',
      data: { kind: 'group', label: group.name },
      width: 0,
      height: 0,
    });
    for (const tableId of group.tableIds) groupOfTable.set(tableId, id);
  }

  // --- Tablas ---
  for (const table of Object.values(normalized.tables ?? {})) {
    const columns: Column[] = table.fieldIds.map((fieldId) => {
      const field = normalized.fields[fieldId];
      return {
        id: columnAnchorId(field.id),
        name: field.name,
        type: field.type?.type_name ?? '',
        pk: Boolean(field.pk),
        fk: !field.pk && field.endpointIds.length > 0,
        unique: Boolean(field.unique),
        notNull: Boolean(field.not_null),
        increment: Boolean(field.increment),
        defaultValue: formatDefault(field),
        note: field.note ?? undefined,
        isEnum: field.enumId != null,
      };
    });

    const schema = schemaName(table.schemaId);
    const { width, height } = tableSize(table, columns, `${schema ? `${schema}.` : ''}${table.name}`);
    nodes.push({
      id: tableNodeId(table.id),
      kind: 'table',
      width,
      height,
      parentId: groupOfTable.get(table.id),
      data: {
        kind: 'table',
        name: table.name,
        schema,
        alias: table.alias ?? undefined,
        note: table.note ?? undefined,
        columns,
        headerColor: table.headerColor,
      },
    });
  }

  // --- Enums ---
  for (const enumDef of Object.values(normalized.enums ?? {})) {
    const values = enumDef.valueIds.map((valueId) => {
      const value = normalized.enumValues[valueId];
      return { name: value.name, note: value.note ?? undefined };
    });
    const { width, height } = enumSize(enumDef.name, values);
    nodes.push({
      id: enumNodeId(enumDef.id),
      kind: 'enum',
      width,
      height,
      data: { kind: 'enum', name: enumDef.name, schema: schemaName(enumDef.schemaId), values },
    });
  }

  // --- Relaciones ---
  for (const ref of Object.values(normalized.refs ?? {})) {
    const [aId, bId] = ref.endpointIds;
    const a = normalized.endpoints[aId];
    const b = normalized.endpoints[bId];
    if (!a || !b) continue;

    const aField = normalized.fields[a.fieldIds[0]];
    const bField = normalized.fields[b.fieldIds[0]];
    if (!aField || !bField) continue;

    edges.push({
      id: `r${ref.id}`,
      source: tableNodeId(aField.tableId),
      target: tableNodeId(bField.tableId),
      sourceAnchor: columnAnchorId(aField.id),
      targetAnchor: columnAnchorId(bField.id),
      variant: 'solid',
      startMarker: markerFor(a.relation),
      endMarker: markerFor(b.relation),
      label: ref.name ?? undefined,
    });
  }

  // --- Campos tipados con enum: línea punteada hacia el enum ---
  for (const field of Object.values(normalized.fields ?? {})) {
    if (field.enumId == null) continue;
    const enumDef = normalized.enums[field.enumId];
    if (!enumDef) continue;
    edges.push({
      id: `fe${field.id}`,
      source: tableNodeId(field.tableId),
      target: enumNodeId(enumDef.id),
      sourceAnchor: columnAnchorId(field.id),
      variant: 'dashed',
      startMarker: 'none',
      endMarker: 'none',
    });
  }

  return {
    model: { nodes, edges, direction: 'LR', diagramType: 'dbml' },
    diagnostics: [],
  };
}
