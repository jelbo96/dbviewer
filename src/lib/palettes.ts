/**
 * Paletas del diagrama. Cada una redefine los tokens de color y forma; el tema
 * claro/oscuro sigue siendo independiente, así que se combinan.
 *
 * Los valores de las paletas inspiradas en otros productos salen de leer sus
 * estilos computados, no de memoria. Son sólo color y forma: ni logos, ni
 * nombres dentro del diagrama, ni webfonts descargadas (la app funciona sin
 * red y el export no debe depender de una fuente remota).
 */
export interface Palette {
  key: string;
  label: string;
  /** tipografía que mejor acompaña; se aplica al elegir la paleta */
  suggestedFont?: string;
  note?: string;
}

export const PALETTES: Palette[] = [
  { key: 'default', label: 'Predeterminada' },
  {
    key: 'suave',
    label: 'Suave',
    suggestedFont: 'dm-sans',
    note: 'Tarjetas con relieve: degradado, luz interior y sombra amplia. DM Sans y azul #057AFF',
  },
  {
    key: 'blueprint',
    label: 'Blueprint',
    suggestedFont: 'mono',
    note: 'Plano técnico: cian sobre azul profundo',
  },
];

export const DEFAULT_PALETTE = PALETTES[0];

export function getPalette(key: string): Palette {
  return PALETTES.find((palette) => palette.key === key) ?? DEFAULT_PALETTE;
}
