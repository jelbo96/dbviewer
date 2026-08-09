/**
 * Identificadores de los puntos de anclaje. Van aparte de `Handles.tsx` porque
 * mezclar constantes con componentes rompe el Fast Refresh de Vite.
 */
export type Side = 'l' | 'r' | 't' | 'b';

export const LR: Side[] = ['l', 'r'];
export const ALL_SIDES: Side[] = ['l', 'r', 't', 'b'];

/** Ancla que representa el nodo entero, para aristas sin columna asociada. */
export const NODE_ANCHOR = 'node';
