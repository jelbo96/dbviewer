import { useStore } from '../store/useStore';

/**
 * Render nativo de mermaid para los tipos que no convertimos a nodos
 * (sequence, gantt, pie, mindmap...). Se ve y se exporta, pero no se arrastra.
 */
export function StaticDiagram({ svg, type }: { svg: string; type: string }) {
  const snapToGrid = useStore((state) => state.snapToGrid);

  return (
    <div className={`static-view${snapToGrid ? ' is-grid' : ''}`}>
      <span className="static-view__badge">{type} · vista estática (no se arrastran las cajas)</span>
      <div className="static-view__svg" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
