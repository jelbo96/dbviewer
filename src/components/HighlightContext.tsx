import { createContext, useContext } from 'react';

export interface Highlight {
  /** ids de columnas/atributos conectados al nodo seleccionado */
  anchors: Set<string>;
  /** ids de nodos relacionados (incluye el seleccionado); vacío = sin foco */
  nodes: Set<string>;
  /** aristas que tocan el nodo seleccionado */
  edges: Set<string>;
  active: boolean;
}

const EMPTY: Highlight = { anchors: new Set(), nodes: new Set(), edges: new Set(), active: false };

export const HighlightContext = createContext<Highlight>(EMPTY);

export const useHighlight = () => useContext(HighlightContext);
