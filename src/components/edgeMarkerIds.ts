import type { EndpointMarker } from '../lib/types';

/**
 * Ids de los marcadores SVG. Van aparte de `EdgeMarkers.tsx` porque mezclar
 * helpers con componentes rompe el Fast Refresh de Vite.
 */
export const MARKER_PREFIX = 'dbv-marker-';

/**
 * React Flow envuelve el valor en `url('#...')` por su cuenta, así que aquí
 * devolvemos el id pelado.
 */
export function markerUrl(marker: EndpointMarker): string | undefined {
  return marker === 'none' ? undefined : `${MARKER_PREFIX}${marker}`;
}
