import { useStore } from '../store/useStore';

export function DiagnosticsBar() {
  const diagnostics = useStore((state) => state.diagnostics);
  if (!diagnostics.length) return null;

  return (
    <div className="diagnostics">
      {diagnostics.slice(0, 6).map((diagnostic, index) => (
        <div key={`${diagnostic.message}-${index}`} className={`diagnostics__row is-${diagnostic.severity}`}>
          {diagnostic.line != null && <span className="diagnostics__loc">L{diagnostic.line}</span>}
          <span>{diagnostic.message}</span>
        </div>
      ))}
      {diagnostics.length > 6 && <div className="diagnostics__row">…y {diagnostics.length - 6} más</div>}
    </div>
  );
}
