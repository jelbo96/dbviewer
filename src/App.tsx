import { useCallback, useEffect, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

import { useStore } from './store/useStore';
import { useDiagramParser } from './hooks/useDiagramParser';
import { getFont } from './lib/fonts';
import { Toolbar } from './components/Toolbar';
import { Tabs } from './components/Tabs';
import { CodePane } from './components/CodePane';
import { DiagnosticsBar } from './components/DiagnosticsBar';
import { DiagramCanvas } from './components/DiagramCanvas';
import { DiagramSheet } from './components/DiagramSheet';
import { useMediaQuery, MOBILE_QUERY } from './hooks/useMediaQuery';

import './styles/theme.css';
import './styles/palettes.css';
import './styles/app.css';
import './styles/nodes.css';
import './styles/canvas.css';

const MIN_RATIO = 0.18;
const MAX_RATIO = 0.7;

function Splitter({ onDrag }: { onDrag: (clientX: number) => void }) {
  const dragging = useRef(false);

  const stop = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (dragging.current) onDrag(event.clientX);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
    };
  }, [onDrag, stop]);

  return (
    <div
      className="splitter"
      role="separator"
      aria-orientation="vertical"
      onMouseDown={() => {
        dragging.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }}
    >
      <span className="splitter__grip" />
    </div>
  );
}

export default function App() {
  const theme = useStore((state) => state.theme);
  const fontKey = useStore((state) => state.fontKey);
  const paletteKey = useStore((state) => state.paletteKey);
  const editorRatio = useStore((state) => state.editorRatio);
  const setEditorRatio = useStore((state) => state.setEditorRatio);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  useDiagramParser();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-diagram', getFont(fontKey).stack);
  }, [fontKey]);

  useEffect(() => {
    document.documentElement.dataset.palette = paletteKey;
  }, [paletteKey]);

  const handleDrag = useCallback(
    (clientX: number) => {
      const ratio = clientX / window.innerWidth;
      setEditorRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio)));
    },
    [setEditorRatio],
  );

  // En móvil no caben dos columnas: el editor ocupa la pantalla y el diagrama
  // vive en un panel que sube desde abajo.
  if (isMobile) {
    return (
      <ReactFlowProvider>
        <div className="app app--mobile">
          <Toolbar />
          <Tabs />
          <div className="app__body">
            <aside className="app__editor">
              <CodePane />
              <DiagnosticsBar />
            </aside>
          </div>
          <DiagramSheet>
            <DiagramCanvas />
          </DiagramSheet>
        </div>
      </ReactFlowProvider>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="app">
        <Toolbar />
        <Tabs />
        <div className="app__body">
          <aside className="app__editor" style={{ width: `${editorRatio * 100}%` }}>
            <CodePane />
            <DiagnosticsBar />
          </aside>
          <Splitter onDrag={handleDrag} />
          <DiagramCanvas />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
