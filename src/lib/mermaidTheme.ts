/**
 * Traduce la paleta activa a `themeVariables` de Mermaid.
 *
 * Los diagramas estáticos (sequence, gantt, pie...) los pinta Mermaid, que
 * escribe los colores dentro del SVG: desde nuestro CSS no hay forma de
 * cambiarlos. La única vía es pasarle la paleta antes de renderizar.
 */

/** Leemos sólo variables con valor literal: `getPropertyValue` no resuelve `var()` anidados. */
function readTokens(): Record<string, string> {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;

  return {
    canvas: read('--canvas-bg', '#ffffff'),
    node: read('--node-bg', '#ffffff'),
    header: read('--node-header', '#eeeeee'),
    border: read('--border', '#dddddd'),
    borderStrong: read('--border-strong', '#bbbbbb'),
    text: read('--text', '#111111'),
    textDim: read('--text-dim', '#555555'),
    edge: read('--edge', '#888888'),
    accent: read('--accent', '#6366f1'),
    accentSoft: read('--accent-soft', 'rgba(99,102,241,0.15)'),
  };
}

export function mermaidThemeVariables(fontFamily?: string): Record<string, string> {
  const token = readTokens();

  return {
    // transparente para que se vea la grilla que dibujamos debajo
    background: 'transparent',
    ...(fontFamily ? { fontFamily } : {}),

    primaryColor: token.node,
    primaryBorderColor: token.borderStrong,
    primaryTextColor: token.text,
    secondaryColor: token.header,
    tertiaryColor: token.header,
    lineColor: token.edge,
    textColor: token.text,
    mainBkg: token.node,
    nodeBorder: token.borderStrong,

    // --- diagrama de secuencia ---
    actorBkg: token.node,
    actorBorder: token.borderStrong,
    actorTextColor: token.text,
    actorLineColor: token.edge,
    signalColor: token.edge,
    signalTextColor: token.text,
    labelBoxBkgColor: token.header,
    labelBoxBorderColor: token.borderStrong,
    labelTextColor: token.text,
    loopTextColor: token.textDim,
    activationBkgColor: token.accentSoft,
    activationBorderColor: token.accent,
    noteBkgColor: token.accentSoft,
    noteBorderColor: token.accent,
    noteTextColor: token.text,
    sequenceNumberColor: token.canvas,

    // --- otros tipos estáticos ---
    altBackground: token.header,
    edgeLabelBackground: token.canvas,
    clusterBkg: token.header,
    clusterBorder: token.border,
    titleColor: token.text,
    pie1: token.accent,
    pieTitleTextColor: token.text,
    pieSectionTextColor: token.text,
    pieStrokeColor: token.canvas,
  };
}
