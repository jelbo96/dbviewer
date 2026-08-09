import { describe, expect, it } from 'vitest';
import { autoLayout, mergePositions } from './layout';
import type { DiagramModel } from './types';

const model: DiagramModel = {
  direction: 'LR',
  diagramType: 'dbml',
  nodes: [
    { id: 'a', kind: 'shape', width: 100, height: 50, data: { kind: 'shape', label: 'a', shape: 'rect' } },
    { id: 'b', kind: 'shape', width: 100, height: 50, data: { kind: 'shape', label: 'b', shape: 'rect' } },
  ],
  edges: [{ id: 'e', source: 'a', target: 'b', variant: 'solid', startMarker: 'none', endMarker: 'arrow' }],
};

describe('autoLayout', () => {
  it('posiciona todos los nodos sin solaparlos', () => {
    const positions = autoLayout(model);

    expect(Object.keys(positions).sort()).toEqual(['a', 'b']);
    // en LR el destino queda a la derecha del origen
    expect(positions.b.x).toBeGreaterThan(positions.a.x);
  });

  it('respeta la dirección forzada', () => {
    const vertical = autoLayout(model, 'TB');
    expect(vertical.b.y).toBeGreaterThan(vertical.a.y);
  });
});

describe('mergePositions', () => {
  it('conserva lo que el usuario arrastró', () => {
    const saved = { a: { x: 999, y: 888 }, b: { x: 5, y: 5 } };
    const merged = mergePositions(model, saved);

    expect(merged.a).toEqual({ x: 999, y: 888 });
    expect(merged.b).toEqual({ x: 5, y: 5 });
  });

  it('autoposiciona sólo los nodos nuevos', () => {
    const merged = mergePositions(model, { a: { x: 999, y: 888 } });

    expect(merged.a).toEqual({ x: 999, y: 888 });
    // el nodo nuevo se coloca fuera del bloque existente, no encima
    expect(merged.b).toBeDefined();
    expect(merged.b.x).toBeGreaterThanOrEqual(999 + 100);
  });

  it('descarta posiciones de nodos que ya no existen', () => {
    const merged = mergePositions(model, {
      a: { x: 1, y: 1 },
      b: { x: 2, y: 2 },
      fantasma: { x: 3, y: 3 },
    });

    expect(merged).not.toHaveProperty('fantasma');
  });
});
