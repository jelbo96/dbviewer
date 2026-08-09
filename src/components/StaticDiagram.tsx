import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const FIT_PADDING = 0.9;
/** El encuadre puede ampliar: es SVG, no pixela. */
const FIT_MAX_ZOOM = 2;
const ZOOM_STEP = 1.2;

interface View {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Render nativo de mermaid para los tipos que no convertimos a nodos
 * (sequence, gantt, pie...). No se arrastran las cajas, pero sí se hace zoom y
 * pan: React Flow no está aquí, así que el transform lo llevamos nosotros.
 */
export function StaticDiagram({ svg, type }: { svg: string; type: string }) {
  const snapToGrid = useStore((state) => state.snapToGrid);
  const fitNonce = useStore((state) => state.fitNonce);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; origin: View } | null>(null);

  const fit = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    // offsetWidth/Height ignoran el transform, así que dan el tamaño natural
    const naturalWidth = content.offsetWidth;
    const naturalHeight = content.offsetHeight;
    // el contenedor puede medir 0 mientras el panel se abre: encuadrar ahí
    // dejaría el zoom en 0 y el diagrama invisible
    if (!naturalWidth || !naturalHeight || !container.clientWidth || !container.clientHeight) return;

    const zoom = Math.min(
      (container.clientWidth / naturalWidth) * FIT_PADDING,
      (container.clientHeight / naturalHeight) * FIT_PADDING,
      FIT_MAX_ZOOM,
    );
    setView({
      zoom,
      x: (container.clientWidth - naturalWidth * zoom) / 2,
      y: (container.clientHeight - naturalHeight * zoom) / 2,
    });
  }, []);

  // Encuadra al montar y cada vez que cambia el diagrama. useLayoutEffect para
  // que no se vea un fotograma sin encuadrar.
  useLayoutEffect(fit, [svg, fit]);

  useEffect(() => {
    if (!fitNonce) return;
    fit();
  }, [fitNonce, fit]);

  useEffect(() => {
    const observer = new ResizeObserver(fit);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fit]);

  /** Zoom hacia el puntero: el punto bajo el cursor no debe moverse. */
  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;

    setView((current) => {
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom * factor));
      if (zoom === current.zoom) return current;
      return {
        zoom,
        x: pointerX - ((pointerX - current.x) / current.zoom) * zoom,
        y: pointerY - ((pointerY - current.y) / current.zoom) * zoom,
      };
    });
  }, []);

  // Listener nativo y no onWheel: React registra los de rueda como pasivos y
  // preventDefault() no surtiría efecto, así que la página haría scroll.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const zoomCentered = (factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  };

  return (
    <div
      ref={containerRef}
      className={`static-view${snapToGrid ? ' is-grid' : ''}${panRef.current ? ' is-panning' : ''}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: view };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const pan = panRef.current;
        if (!pan || pan.pointerId !== event.pointerId) return;
        setView({
          zoom: pan.origin.zoom,
          x: pan.origin.x + (event.clientX - pan.startX),
          y: pan.origin.y + (event.clientY - pan.startY),
        });
      }}
      onPointerUp={(event) => {
        if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
      }}
      onPointerCancel={() => {
        panRef.current = null;
      }}
      onDoubleClick={fit}
    >
      <span className="static-view__badge">{type} · vista estática (no se arrastran las cajas)</span>

      <div
        ref={contentRef}
        className="static-view__svg"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <div className="static-view__controls">
        <button type="button" onClick={() => zoomCentered(ZOOM_STEP)} title="Acercar" aria-label="Acercar">
          +
        </button>
        <button type="button" onClick={() => zoomCentered(1 / ZOOM_STEP)} title="Alejar" aria-label="Alejar">
          −
        </button>
        <button type="button" onClick={fit} title="Encuadrar (o doble clic)" aria-label="Encuadrar">
          ⤢
        </button>
      </div>

      <span className="static-view__zoom">{Math.round(view.zoom * 100)}%</span>
    </div>
  );
}
