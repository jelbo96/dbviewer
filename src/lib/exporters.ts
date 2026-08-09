import { getNodesBounds, type Node } from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';

export type SqlDialect = 'postgres' | 'mysql' | 'mssql' | 'oracle';

export function download(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

/** DBML -> SQL del dialecto elegido. Lanza si el DBML no compila. */
export async function dbmlToSql(source: string, dialect: SqlDialect): Promise<string> {
  const { exporter } = await import('@dbml/core');
  return exporter.export(source, dialect);
}

/**
 * Holgado a propósito: el bounding box es el de los nodos, pero las aristas
 * ortogonales se separan hasta ~22px del nodo y además llevan marcadores y
 * etiquetas. Con poco margen, todo eso se recorta.
 */
const PADDING = 72;

/**
 * Exporta el canvas a imagen encuadrando el viewport sobre el contenido, para
 * que la imagen no dependa del zoom que haya en pantalla.
 */
/** Overlays que no deben salir en la imagen. */
const EXCLUDED = ['react-flow__minimap', 'react-flow__controls', 'react-flow__background', 'react-flow__panel'];

const SVG_NS = 'http://www.w3.org/2000/svg';
const COPIED_PROPS = ['stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'opacity'];

/**
 * html-to-image no logra serializar las aristas: React Flow las monta como
 * <svg> sin dimensiones que sólo se ven por `overflow: visible`, y al clonarlas
 * quedan recortadas a cero. Rehacemos las líneas en un SVG propio, con tamaño
 * explícito y estilos ya resueltos, que sí sobrevive a la serialización.
 */
function buildEdgeOverlay(viewport: HTMLElement, width: number, height: number): SVGSVGElement {
  const overlay = document.createElementNS(SVG_NS, 'svg');
  overlay.setAttribute('width', String(width));
  overlay.setAttribute('height', String(height));
  overlay.setAttribute('data-export-overlay', 'true');
  overlay.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none';

  // Los marcadores (pata de gallo, flechas) viven en el viewport; sin sus defs
  // los `marker-end` del clon no resolverían.
  const defsSource = viewport.querySelector('defs');
  if (defsSource) overlay.appendChild(defsSource.cloneNode(true));

  for (const path of viewport.querySelectorAll<SVGPathElement>('path.rel-edge')) {
    const clone = path.cloneNode(false) as SVGPathElement;
    const computed = getComputedStyle(path);
    for (const prop of COPIED_PROPS) clone.setAttribute(prop, computed.getPropertyValue(prop));
    clone.setAttribute('fill', 'none');
    for (const marker of ['marker-start', 'marker-end'] as const) {
      const value = path.getAttribute(marker);
      if (value) clone.setAttribute(marker, value);
    }
    clone.removeAttribute('class');
    overlay.appendChild(clone);
  }
  return overlay;
}

async function captureCanvas(nodes: Node[], scale: number, format: 'png' | 'svg'): Promise<string> {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  const wrapper = document.querySelector<HTMLElement>('.react-flow');
  if (!viewport || !wrapper) throw new Error('No hay canvas que exportar');
  if (!nodes.length) throw new Error('No hay nodos que exportar');

  const bounds = getNodesBounds(nodes);
  const width = Math.ceil(bounds.width + PADDING * 2);
  const height = Math.ceil(bounds.height + PADDING * 2);

  // A escala 1 basta con desplazar el origen del contenido al margen: así el
  // encuadre es exacto. `getViewportForBounds` aplicaba su propio padding sobre
  // el que ya habíamos sumado y el resultado quedaba descuadrado.
  const transform = { x: -bounds.x + PADDING, y: -bounds.y + PADDING, zoom: 1 };

  const background = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim();
  const options = {
    backgroundColor: background || '#ffffff',
    // `width`/`height` son dimensiones CSS; la resolución la sube `pixelRatio`.
    // Multiplicar ambos por la escala hacía que la imagen saliera recortada.
    width,
    height,
    pixelRatio: scale,
    // usamos stacks de fuentes del sistema: intentar embeber webfonts sólo
    // provoca errores CORS con hojas de estilo de terceros inyectadas en la página
    skipFonts: true,
    filter: (node: HTMLElement) =>
      !(node.classList && EXCLUDED.some((className) => node.classList.contains(className))),
  };

  // Capturamos el wrapper, no el viewport: el viewport mide 0x0 y sus aristas
  // son <svg> con el tamaño por defecto que sólo se ven gracias a
  // `overflow: visible`. html-to-image serializa cada caja, así que por ahí la
  // imagen salía sin líneas. El wrapper sí tiene caja real y recorta igual que
  // en pantalla, así que basta con estirarlo al tamaño del contenido.
  const previousWrapper = wrapper.getAttribute('style') ?? '';
  const previousViewport = viewport.getAttribute('style') ?? '';
  const edgeLayer = viewport.querySelector<HTMLElement>('.react-flow__edges');
  const spanX = Math.ceil(Math.max(bounds.x + bounds.width, width) + PADDING);
  const spanY = Math.ceil(Math.max(bounds.y + bounds.height, height) + PADDING);

  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  viewport.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`;

  // como primer hijo: las aristas van detrás de los nodos, igual que en pantalla
  const overlay = buildEdgeOverlay(viewport, spanX, spanY);
  viewport.insertBefore(overlay, viewport.firstChild);
  if (edgeLayer) edgeLayer.style.display = 'none';

  try {
    // dos frames: uno para aplicar el layout nuevo y otro para que repinte
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return format === 'png' ? await toPng(wrapper, options) : await toSvg(wrapper, options);
  } finally {
    overlay.remove();
    if (edgeLayer) edgeLayer.style.removeProperty('display');
    if (previousWrapper) wrapper.setAttribute('style', previousWrapper);
    else wrapper.removeAttribute('style');
    if (previousViewport) viewport.setAttribute('style', previousViewport);
    else viewport.removeAttribute('style');
  }
}

export async function exportPng(nodes: Node[], filename: string, scale = 2) {
  downloadDataUrl(filename, await captureCanvas(nodes, scale, 'png'));
}

export async function exportSvg(nodes: Node[], filename: string) {
  downloadDataUrl(filename, await captureCanvas(nodes, 1, 'svg'));
}

// ---------------------------------------------------------------- estáticos

/** Lee el tamaño del SVG de mermaid: puede venir en width/height o en viewBox. */
function svgSize(svg: string): { width: number; height: number } {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  const viewBox = root.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
  if (viewBox?.length === 4 && viewBox.every(Number.isFinite)) {
    return { width: viewBox[2], height: viewBox[3] };
  }
  const width = Number.parseFloat(root.getAttribute('width') ?? '');
  const height = Number.parseFloat(root.getAttribute('height') ?? '');
  return {
    width: Number.isFinite(width) ? width : 1200,
    height: Number.isFinite(height) ? height : 800,
  };
}

/**
 * Los diagramas sin soporte interactivo (sequence, gantt, pie...) ya son un
 * SVG: no pasan por React Flow ni por html-to-image.
 */
export function exportStaticSvg(svg: string, filename: string) {
  download(filename, svg, 'image/svg+xml');
}

export async function exportStaticPng(svg: string, filename: string, scale = 2) {
  const { width, height } = svgSize(svg);
  const background = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim();

  // data URL en base64 y no un blob: un blob: URL marca el canvas como
  // contaminado en algunos navegadores y toDataURL falla.
  const encoded = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  const image = new Image();
  image.src = encoded;
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo crear el lienzo de exportación');

  context.fillStyle = background || '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  downloadDataUrl(filename, canvas.toDataURL('image/png'));
}
