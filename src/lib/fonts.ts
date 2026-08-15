/**
 * Tipografías para el diagrama. Todas son stacks del sistema a propósito: la
 * app funciona sin red y el export a imagen no depende de webfonts remotas.
 *
 * `widthFactor` corrige la estimación de ancho de `measure.ts`, calibrada
 * contra la stack `system`. Sin él, una mono desbordaría las cajas.
 */
export interface FontOption {
  key: string;
  label: string;
  stack: string;
  widthFactor: number;
}

export const FONTS: FontOption[] = [
  {
    // única webfont del proyecto, empaquetada en public/fonts
    key: 'dm-sans',
    label: 'DM Sans',
    stack: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
    widthFactor: 0.95,
  },
  {
    key: 'system',
    label: 'Sistema',
    stack: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Inter, sans-serif",
    widthFactor: 1,
  },
  {
    key: 'grotesk',
    label: 'Helvetica',
    stack: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    widthFactor: 0.98,
  },
  {
    key: 'rounded',
    label: 'Redondeada',
    stack: "ui-rounded, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Avenir, system-ui, sans-serif",
    widthFactor: 1.02,
  },
  {
    key: 'serif',
    label: 'Serif',
    stack: "ui-serif, Georgia, Cambria, 'Times New Roman', serif",
    widthFactor: 0.97,
  },
  {
    key: 'mono',
    label: 'Monoespaciada',
    stack: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    widthFactor: 1.16,
  },
];

export const DEFAULT_FONT = FONTS[0];

export function getFont(key: string): FontOption {
  return FONTS.find((font) => font.key === key) ?? DEFAULT_FONT;
}
