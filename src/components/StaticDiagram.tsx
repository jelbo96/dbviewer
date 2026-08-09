/**
 * Render nativo de mermaid para los tipos que no convertimos a nodos
 * (sequence, gantt, pie, mindmap...). Se ve, pero no se arrastra.
 */
export function StaticDiagram({ svg, type }: { svg: string; type: string }) {
  return (
    <div className="static-view">
      <span className="static-view__badge">
        {type} · vista estática (este tipo aún no soporta arrastrar cajas)
      </span>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
