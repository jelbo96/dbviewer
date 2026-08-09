import { describe, expect, it } from 'vitest';
import { parseMermaid } from './mermaid';
import type { DiagramNode, NodeData } from './types';

/** Estrecha por el discriminante `kind` en vez de castear a ciegas. */
function dataOf<K extends NodeData['kind']>(node: DiagramNode, kind: K) {
  if (node.data.kind !== kind) throw new Error(`se esperaba un nodo ${kind}, no ${node.data.kind}`);
  return node.data as Extract<NodeData, { kind: K }>;
}

/**
 * Estas pruebas cubren la parte más frágil del proyecto: leemos el AST interno
 * de Mermaid, que no es API pública y puede cambiar entre versiones menores.
 * Si alguna falla tras actualizar mermaid, el mapeo en `lib/mermaid.ts` es lo
 * que hay que revisar.
 */
describe('parseMermaid · flowchart', () => {
  const SOURCE = `flowchart LR
  A([Inicio]) --> B{Decide}
  B -- no --> C[(Base)]
  B ==> D[/Reporte/]
  C -. reintento .-> A

  subgraph Backend
    C
  end`;

  it('mapea cada nodo a su forma', async () => {
    const { model } = await parseMermaid(SOURCE);
    const shapeOf = (id: string) =>
      dataOf(model!.nodes.find((node) => node.id === id)!, 'shape').shape;

    expect(shapeOf('A')).toBe('stadium');
    expect(shapeOf('B')).toBe('diamond');
    expect(shapeOf('C')).toBe('cylinder');
    expect(shapeOf('D')).toBe('lean_right');
  });

  it('respeta la dirección declarada', async () => {
    const { model } = await parseMermaid(SOURCE);
    expect(model!.direction).toBe('LR');
  });

  it('distingue el trazo de cada arista', async () => {
    const { model } = await parseMermaid(SOURCE);
    const variantOf = (source: string, target: string) =>
      model!.edges.find((edge) => edge.source === source && edge.target === target)!.variant;

    expect(variantOf('A', 'B')).toBe('solid');
    expect(variantOf('B', 'D')).toBe('thick');
    expect(variantOf('C', 'A')).toBe('dashed');
  });

  it('conserva las etiquetas de las aristas', async () => {
    const { model } = await parseMermaid(SOURCE);
    const labels = model!.edges.map((edge) => edge.label).filter(Boolean);
    expect(labels).toContain('no');
    expect(labels).toContain('reintento');
  });

  it('documenta que Mermaid se come la "o" final si la punteada no lleva espacios', async () => {
    // `-.texto.->` sin espacios hace que `o.` colisione con el token de la
    // flecha `--o`. Es comportamiento de Mermaid, no nuestro: la sintaxis a
    // usar en los ejemplos es `-. texto .->`.
    const pegado = await parseMermaid('flowchart LR\n  C -.reintento.-> A');
    const espaciado = await parseMermaid('flowchart LR\n  C -. reintento .-> A');

    expect(pegado.model!.edges[0].label).toBe('reintent');
    expect(espaciado.model!.edges[0].label).toBe('reintento');
  });

  it('cuelga del subgraph los nodos que contiene', async () => {
    const { model } = await parseMermaid(SOURCE);
    const group = model!.nodes.find((node) => node.kind === 'group')!;
    expect(model!.nodes.find((node) => node.id === 'C')!.parentId).toBe(group.id);
  });
});

describe('parseMermaid · erDiagram', () => {
  const SOURCE = `erDiagram
  CLIENTE ||--o{ LINEA_PEDIDO : realiza
  CLIENTE {
    int id PK
    string email UK
  }
  LINEA_PEDIDO {
    int cliente_id FK
  }`;

  it('no se come los guiones bajos del nombre', async () => {
    const { model } = await parseMermaid(SOURCE);
    const names = model!.nodes.map((node) => dataOf(node, 'entity').name);
    expect(names).toContain('LINEA_PEDIDO');
  });

  it('enlaza la relación con nodos que existen', async () => {
    const { model } = await parseMermaid(SOURCE);
    const ids = new Set(model!.nodes.map((node) => node.id));

    expect(model!.edges).toHaveLength(1);
    // erDb indexa las entidades por nombre pero las relaciones apuntan a un id
    // sintético: si el mapeo se rompe, la arista queda huérfana y no se dibuja
    expect(ids.has(model!.edges[0].source)).toBe(true);
    expect(ids.has(model!.edges[0].target)).toBe(true);
  });

  it('traduce las cardinalidades a marcadores', async () => {
    const { model } = await parseMermaid(SOURCE);
    const edge = model!.edges[0];
    expect([edge.startMarker, edge.endMarker].sort()).toEqual(['one', 'zero-many']);
  });

  it('conserva los atributos con sus llaves', async () => {
    const { model } = await parseMermaid(SOURCE);
    const cliente = model!.nodes.find((node) => dataOf(node, 'entity').name === 'CLIENTE')!;
    const attributes = dataOf(cliente, 'entity').attributes;

    expect(attributes.map((attr) => attr.name)).toEqual(['id', 'email']);
    expect(attributes[0].keys).toContain('PK');
  });
});

describe('parseMermaid · classDiagram', () => {
  const SOURCE = `classDiagram
  class Repositorio {
    <<interface>>
    +buscar(id) T
  }
  class RepoUsuarios {
    -conexion: Pool
  }
  Repositorio <|.. RepoUsuarios`;

  it('separa anotaciones, atributos y métodos', async () => {
    const { model } = await parseMermaid(SOURCE);
    const repo = model!.nodes.find((node) => node.id === 'Repositorio')!;
    const data = dataOf(repo, 'class');

    expect(data.annotations).toEqual(['«interface»']);
    expect(data.methods.join(' ')).toMatch(/buscar/);
  });

  it('usa el marcador de herencia y trazo punteado en la realización', async () => {
    const { model } = await parseMermaid(SOURCE);
    const edge = model!.edges[0];

    expect(edge.startMarker).toBe('extension');
    expect(edge.variant).toBe('dashed');
  });
});

describe('parseMermaid · otros', () => {
  it('marca para render estático los tipos que no sabemos convertir', async () => {
    const { model } = await parseMermaid('pie title Ventas\n  "A" : 40\n  "B" : 60');
    expect(model!.fallbackToStatic).toBe(true);
  });

  it('reporta el error de sintaxis sin lanzar', async () => {
    const { model, diagnostics } = await parseMermaid('flowchart LR\n  A --> ');
    expect(model).toBeNull();
    expect(diagnostics[0].severity).toBe('error');
  });
});
