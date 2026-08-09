/**
 * Estimación de tamaños. No medimos en el DOM porque el layout se calcula
 * antes de montar los nodos; las constantes están calibradas contra el CSS
 * real de cada nodo (ver `styles/nodes.css`).
 */

/**
 * Corrección de ancho según la tipografía elegida. Es estado de módulo porque
 * los parsers son puros y no conocen el store; quien cambia la fuente lo ajusta
 * y vuelve a parsear para que se recalculen los tamaños.
 */
let fontWidthFactor = 1;

export function setFontWidthFactor(factor: number) {
  fontWidthFactor = factor;
}

/** Ancho aproximado de un texto, en px, para un tamaño de fuente dado. */
export function textWidth(text: string, fontSize = 13, bold = false): number {
  // 0.58em es un promedio razonable para la stack de fuentes UI que usamos.
  const factor = bold ? 0.63 : 0.58;
  return Math.ceil(text.length * fontSize * factor * fontWidthFactor);
}

/** El tipo de dato se dibuja en monoespaciada, que es más ancha por carácter. */
export function monoWidth(text: string, fontSize = 11): number {
  return Math.ceil(text.length * fontSize * 0.62);
}

/** Ancho de un badge (PK/FK/UQ/NN) más el gap que lo separa del anterior. */
export const BADGE_WIDTH = 30;

export const TABLE = {
  headerHeight: 36,
  rowHeight: 26,
  paddingX: 12,
  gap: 8,
  minWidth: 210,
  maxWidth: 460,
  noteHeight: 24,
};

export const ENUMS = {
  /* mismo header que las tablas: comparten la regla .node__header */
  headerHeight: 36,
  rowHeight: 22,
  minWidth: 150,
  maxWidth: 300,
};

export const SHAPE = {
  paddingX: 22,
  paddingY: 14,
  minWidth: 90,
  minHeight: 44,
  lineHeight: 20,
  maxWidth: 260,
};

/** Parte un label en líneas para que no exceda `maxWidth`. */
export function wrapLabel(label: string, maxWidth: number, fontSize = 13): string[] {
  const explicit = label.split(/<br\s*\/?>|\n/);
  const lines: string[] = [];
  for (const chunk of explicit) {
    const words = chunk.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    let current = words[0];
    for (const word of words.slice(1)) {
      const candidate = `${current} ${word}`;
      if (textWidth(candidate, fontSize) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }
  return lines.length ? lines : [''];
}

/** Algunas formas necesitan más caja que su contenido para no recortar el texto. */
const SHAPE_PADDING: Record<string, { x: number; y: number }> = {
  diamond: { x: 60, y: 40 },
  circle: { x: 40, y: 40 },
  doublecircle: { x: 48, y: 48 },
  hexagon: { x: 34, y: 8 },
  stadium: { x: 16, y: 0 },
  cylinder: { x: 8, y: 20 },
  subroutine: { x: 20, y: 0 },
  trapezoid: { x: 44, y: 0 },
  inv_trapezoid: { x: 44, y: 0 },
  lean_right: { x: 34, y: 0 },
  lean_left: { x: 34, y: 0 },
  odd: { x: 24, y: 0 },
};

export function shapeSize(label: string, shape: string) {
  const lines = wrapLabel(label || ' ', SHAPE.maxWidth);
  const textW = Math.max(...lines.map((l) => textWidth(l, 13)));
  const extra = SHAPE_PADDING[shape] ?? { x: 0, y: 0 };
  const width = Math.max(SHAPE.minWidth, textW + SHAPE.paddingX * 2 + extra.x);
  const height = Math.max(SHAPE.minHeight, lines.length * SHAPE.lineHeight + SHAPE.paddingY * 2 + extra.y);
  const isRound = shape === 'circle' || shape === 'doublecircle';
  if (isRound) {
    const side = Math.max(width, height);
    return { width: side, height: side, lines };
  }
  return { width, height, lines };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
