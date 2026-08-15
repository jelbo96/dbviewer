import { beforeEach, describe, expect, it } from 'vitest';
import { useStore, selectActive, selectDirection, selectLang } from './useStore';

/**
 * El estado vive en un módulo, así que cada test parte de una pestaña limpia.
 * Cerrar la única pestaña abierta es la vía pública para volver al inicio.
 */
beforeEach(() => {
  const { documents, closeDocument } = useStore.getState();
  for (const document of documents) closeDocument(document.id);
});

describe('dirección del auto-layout', () => {
  it('cambiarla pide un reacomodo', () => {
    // Regresión: el selector no hacía nada. `mergePositions` sólo consulta la
    // dirección para colocar nodos sin posición, y tras el primer render todos
    // tienen una, así que sin este nonce el layout jamás se rehacía.
    const before = useStore.getState().layoutNonce;
    useStore.getState().setDirection('TB');

    expect(useStore.getState().layoutNonce).toBe(before + 1);
    expect(selectDirection(useStore.getState())).toBe('TB');
  });

  it('se guarda en la pestaña activa y no en las demás', () => {
    const first = useStore.getState().activeId;
    const second = useStore.getState().addDocument({ lang: 'mermaid' });

    useStore.getState().setDirection('RL');

    expect(useStore.getState().documents.find((d) => d.id === second)?.direction).toBe('RL');
    expect(useStore.getState().documents.find((d) => d.id === first)?.direction).toBe('auto');
  });
});

describe('pestañas', () => {
  it('el lenguaje se fija al crear y no hay forma de cambiarlo', () => {
    // Regresión: existía un `setLang` que reemplazaba el código de la pestaña
    // por el de ejemplo, perdiendo lo escrito.
    const id = useStore.getState().addDocument({ lang: 'mermaid', code: 'flowchart LR\n  A --> B' });
    expect(selectLang(useStore.getState())).toBe('mermaid');
    expect('setLang' in useStore.getState()).toBe(false);

    useStore.getState().setCode('flowchart TB\n  A --> B');
    expect(useStore.getState().documents.find((d) => d.id === id)?.lang).toBe('mermaid');
  });

  it('cerrar la última pestaña deja una nueva, nunca cero', () => {
    const { activeId, closeDocument } = useStore.getState();
    closeDocument(activeId);

    expect(useStore.getState().documents).toHaveLength(1);
    expect(selectActive(useStore.getState()).id).not.toBe(activeId);
  });
});
