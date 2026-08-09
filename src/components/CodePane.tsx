import { useCallback, useEffect, useMemo, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { forceLinting, linter, lintGutter, type Diagnostic as CmDiagnostic } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';

import { useStore, selectCode, selectLang } from '../store/useStore';
import type { Diagnostic } from '../lib/types';
import { dbmlLanguage, mermaidLanguage } from '../editor/languages';

/** Convierte línea/columna (1-indexadas) a offsets absolutos del documento. */
function toCmDiagnostics(view: EditorView, diagnostics: Diagnostic[]): CmDiagnostic[] {
  const doc = view.state.doc;
  return diagnostics.map((diagnostic) => {
    const lineNumber = Math.min(Math.max(diagnostic.line ?? 1, 1), doc.lines);
    const line = doc.line(lineNumber);
    const from = Math.min(line.from + Math.max((diagnostic.column ?? 1) - 1, 0), line.to);

    let to = line.to;
    if (diagnostic.endLine != null) {
      const endLineNumber = Math.min(Math.max(diagnostic.endLine, 1), doc.lines);
      const endLine = doc.line(endLineNumber);
      to = Math.min(endLine.from + Math.max((diagnostic.endColumn ?? 1) - 1, 0), endLine.to);
    }

    return {
      from,
      to: to > from ? to : Math.min(from + 1, doc.length),
      severity: diagnostic.severity,
      message: diagnostic.message,
    };
  });
}

const baseTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '.cm-gutters': { border: 'none', background: 'transparent' },
  '.cm-content': { padding: '10px 0' },
  '&.cm-focused': { outline: 'none' },
});

export function CodePane() {
  const lang = useStore(selectLang);
  const activeId = useStore((state) => state.activeId);
  const code = useStore(selectCode);
  const setCode = useStore((state) => state.setCode);
  const theme = useStore((state) => state.theme);
  const diagnostics = useStore((state) => state.diagnostics);

  const editorRef = useRef<ReactCodeMirrorRef>(null);
  // El linter lee de un ref para no reconstruir la extensión en cada parseo.
  const diagnosticsRef = useRef(diagnostics);
  diagnosticsRef.current = diagnostics;

  useEffect(() => {
    const view = editorRef.current?.view;
    if (view) forceLinting(view);
  }, [diagnostics]);

  // El editor se remonta al cambiar de pestaña o de idioma (`key` abajo). Aun
  // así descartamos cambios que lleguen tarde, para no escribir el texto de un
  // documento dentro de otro.
  const handleChange = useCallback(
    (next: string) => {
      if (selectLang(useStore.getState()) !== lang) return;
      setCode(next);
    },
    [lang, setCode],
  );

  const extensions = useMemo(
    () => [
      lang === 'dbml' ? dbmlLanguage : mermaidLanguage,
      lintGutter(),
      linter((view) => toCmDiagnostics(view, diagnosticsRef.current), { delay: 120 }),
      EditorView.lineWrapping,
      baseTheme,
    ],
    [lang],
  );

  return (
    <div className="code-pane">
      <CodeMirror
        key={`${activeId}:${lang}`}
        ref={editorRef}
        value={code}
        onChange={handleChange}
        extensions={extensions}
        theme={theme === 'dark' ? oneDark : 'light'}
        height="100%"
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          searchKeymap: true,
        }}
      />
    </div>
  );
}
