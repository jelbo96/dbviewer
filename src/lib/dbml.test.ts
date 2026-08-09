import { describe, expect, it } from 'vitest';
import { parseDbml } from './dbml';
import type { DiagramNode, NodeData } from './types';

/** Estrecha por el discriminante `kind` en vez de castear a ciegas. */
function dataOf<K extends NodeData['kind']>(node: DiagramNode, kind: K) {
  if (node.data.kind !== kind) throw new Error(`se esperaba un nodo ${kind}, no ${node.data.kind}`);
  return node.data as Extract<NodeData, { kind: K }>;
}

const SCHEMA = `Table users {
  id integer [pk, increment]
  email varchar(120) [not null, unique]
  role user_role [not null, default: 'member']

  Note: 'Usuarios registrados'
}

Table posts {
  id integer [pk]
  author_id integer [not null, ref: > users.id]
}

Enum user_role {
  admin
  member
}

TableGroup contenido {
  posts
}
`;

const tableNamed = (nodes: DiagramNode[], name: string) =>
  nodes.find((node) => node.data.kind === 'table' && node.data.name === name)!;

describe('parseDbml', () => {
  it('no reporta diagnósticos para un esquema válido', async () => {
    const { diagnostics } = await parseDbml(SCHEMA);
    expect(diagnostics).toEqual([]);
  });

  it('traduce columnas con sus restricciones', async () => {
    const { model } = await parseDbml(SCHEMA);
    const users = tableNamed(model!.nodes, 'users');
    const columns = dataOf(users, 'table').columns;

    expect(columns.map((column) => column.name)).toEqual(['id', 'email', 'role']);
    expect(columns[0]).toMatchObject({ pk: true, increment: true, type: 'integer' });
    expect(columns[1]).toMatchObject({ notNull: true, unique: true, pk: false });
    expect(columns[2]).toMatchObject({ isEnum: true, defaultValue: "'member'" });
  });

  it('marca como FK la columna que participa en una relación', async () => {
    const { model } = await parseDbml(SCHEMA);
    const posts = tableNamed(model!.nodes, 'posts');
    const columns = dataOf(posts, 'table').columns;

    expect(columns.find((column) => column.name === 'author_id')?.fk).toBe(true);
    // la PK no se marca como FK aunque tenga endpoints
    expect(columns.find((column) => column.name === 'id')?.fk).toBe(false);
  });

  it('ancla la relación a la columna, no a la tabla', async () => {
    const { model } = await parseDbml(SCHEMA);
    const relation = model!.edges.find((edge) => edge.variant === 'solid')!;

    expect(relation.sourceAnchor).toBeDefined();
    expect(relation.targetAnchor).toBeDefined();
    // un extremo es "uno" y el otro "muchos"
    expect([relation.startMarker, relation.endMarker].sort()).toEqual(['many', 'one']);
  });

  it('conecta con línea punteada la columna tipada con enum', async () => {
    const { model } = await parseDbml(SCHEMA);
    const enumNode = model!.nodes.find((node) => node.kind === 'enum')!;
    const dashed = model!.edges.filter((edge) => edge.variant === 'dashed');

    expect(dataOf(enumNode, 'enum').values.map((value) => value.name)).toEqual(['admin', 'member']);
    expect(dashed).toHaveLength(1);
    expect(dashed[0].target).toBe(enumNode.id);
  });

  it('cuelga las tablas del TableGroup como hijas del grupo', async () => {
    const { model } = await parseDbml(SCHEMA);
    const group = model!.nodes.find((node) => node.kind === 'group')!;

    expect(tableNamed(model!.nodes, 'posts').parentId).toBe(group.id);
    expect(tableNamed(model!.nodes, 'users').parentId).toBeUndefined();
  });

  it('devuelve el error con su línea y no un modelo a medias', async () => {
    const { model, diagnostics } = await parseDbml('Table users {\n  id integer\n}\n\nRef: users.id > noexiste.id');

    expect(model).toBeNull();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ severity: 'error', line: 5 });
    expect(diagnostics[0].message).toMatch(/noexiste/);
  });

  it('trata el documento vacío como diagrama vacío, no como error', async () => {
    const { model, diagnostics } = await parseDbml('   ');

    expect(diagnostics).toEqual([]);
    expect(model!.nodes).toEqual([]);
  });
});
