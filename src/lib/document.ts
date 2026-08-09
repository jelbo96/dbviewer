import type { FlowDirection, SourceLang } from './types';
import type { PositionMap } from './layout';
import { DEFAULT_CODE } from './samples';

/** Una pestaña: el texto y todo lo necesario para reproducir cómo se ve. */
export interface DiagramDocument {
  id: string;
  name: string;
  lang: SourceLang;
  code: string;
  /** posiciones arrastradas por el usuario, por id de nodo */
  positions: PositionMap;
  direction: FlowDirection | 'auto';
}

export const FILE_FORMAT = 'dbviewer-diagram';
export const FILE_VERSION = 1;
export const FILE_EXTENSION = '.dbv.json';

/**
 * Lo que se escribe al exportar. Incluye las posiciones a propósito: sin ellas
 * el diagrama se reabre con el auto-layout y no "tal cual quedó".
 */
export interface DiagramFile {
  format: typeof FILE_FORMAT;
  version: number;
  name: string;
  lang: SourceLang;
  code: string;
  positions: PositionMap;
  direction: FlowDirection | 'auto';
  exportedAt: string;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDocument(partial: Partial<DiagramDocument> = {}): DiagramDocument {
  const lang = partial.lang ?? 'dbml';
  return {
    id: partial.id ?? newId(),
    name: partial.name ?? (lang === 'dbml' ? 'Esquema' : 'Diagrama'),
    lang,
    code: partial.code ?? DEFAULT_CODE[lang],
    positions: partial.positions ?? {},
    direction: partial.direction ?? 'auto',
  };
}

/** Evita choques de nombre entre pestañas: "Esquema", "Esquema 2", ... */
export function uniqueName(name: string, taken: string[]): string {
  if (!taken.includes(name)) return name;
  for (let n = 2; ; n += 1) {
    const candidate = `${name} ${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
}

export function serializeDocument(document: DiagramDocument): string {
  const file: DiagramFile = {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    name: document.name,
    lang: document.lang,
    code: document.code,
    positions: document.positions,
    direction: document.direction,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(file, null, 2);
}

export class InvalidDiagramFile extends Error {}

const LANGS: SourceLang[] = ['dbml', 'mermaid'];
const DIRECTIONS = ['auto', 'LR', 'RL', 'TB', 'BT'];

/**
 * Valida antes de confiar: el archivo lo elige el usuario y un `positions` con
 * NaN o strings dejaría el canvas en un estado irrecuperable.
 */
export function parseDocumentFile(raw: string): DiagramDocument {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new InvalidDiagramFile('El archivo no es JSON válido.');
  }

  if (typeof data !== 'object' || data === null) {
    throw new InvalidDiagramFile('El archivo no contiene un diagrama.');
  }
  const file = data as Partial<DiagramFile>;

  if (file.format !== FILE_FORMAT) {
    throw new InvalidDiagramFile(`No es un archivo de dbviewer (falta format: "${FILE_FORMAT}").`);
  }
  if (typeof file.version !== 'number' || file.version > FILE_VERSION) {
    throw new InvalidDiagramFile(
      `El archivo usa la versión ${file.version}; esta app entiende hasta la ${FILE_VERSION}.`,
    );
  }
  if (typeof file.code !== 'string') {
    throw new InvalidDiagramFile('El archivo no trae el código del diagrama.');
  }
  if (!LANGS.includes(file.lang as SourceLang)) {
    throw new InvalidDiagramFile(`Lenguaje desconocido: ${String(file.lang)}.`);
  }

  // Descartamos en silencio las posiciones mal formadas en vez de rechazar el
  // archivo entero: el diagrama sigue siendo útil y esos nodos se autoacomodan.
  const positions: PositionMap = {};
  for (const [id, point] of Object.entries(file.positions ?? {})) {
    const { x, y } = (point ?? {}) as { x?: unknown; y?: unknown };
    if (Number.isFinite(x) && Number.isFinite(y)) {
      positions[id] = { x: x as number, y: y as number };
    }
  }

  return createDocument({
    name: typeof file.name === 'string' && file.name.trim() ? file.name.trim() : 'Importado',
    lang: file.lang as SourceLang,
    code: file.code,
    positions,
    direction: DIRECTIONS.includes(String(file.direction))
      ? (file.direction as DiagramDocument['direction'])
      : 'auto',
  });
}
