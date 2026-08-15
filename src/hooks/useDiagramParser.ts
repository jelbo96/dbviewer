import { useEffect, useRef } from 'react';
import { useStore, selectCode, selectLang } from '../store/useStore';
import { parseDbml } from '../lib/dbml';
import { getFont } from '../lib/fonts';
import { setFontWidthFactor } from '../lib/measure';
import { parseMermaid, renderMermaidSvg } from '../lib/mermaid';
import { mermaidThemeVariables } from '../lib/mermaidTheme';

const DEBOUNCE_MS = 260;

/**
 * Parsea el editor con debounce y deja el resultado en el store.
 * Un token de generación descarta respuestas de parseos ya obsoletos
 * (mermaid es asíncrono y puede resolver fuera de orden).
 */
export function useDiagramParser() {
  const lang = useStore(selectLang);
  // Cambiar de pestaña debe reparsear aunque el texto coincida: al activarla se
  // limpia el SVG estático, y sin esto no se regeneraba nunca.
  const activeId = useStore((state) => state.activeId);
  const code = useStore(selectCode);
  const theme = useStore((state) => state.theme);
  // cambiar de tipografía cambia el ancho de las cajas: hay que remedir
  const fontKey = useStore((state) => state.fontKey);
  // la vista estática se repinta con la paleta, igual que el canvas
  const paletteKey = useStore((state) => state.paletteKey);
  const setParseResult = useStore((state) => state.setParseResult);
  const setParsing = useStore((state) => state.setParsing);
  const setStaticSvg = useStore((state) => state.setStaticSvg);

  const generation = useRef(0);

  useEffect(() => {
    const token = ++generation.current;
    setParsing(true);

    const timer = window.setTimeout(async () => {
      // `measure.ts` estima anchos: necesita el factor de la fuente activa
      // antes de parsear, no durante el render.
      setFontWidthFactor(getFont(fontKey).widthFactor);
      if (lang === 'dbml') {
        const result = await parseDbml(code);
        if (token !== generation.current) return;
        setStaticSvg(null);
        setParseResult(result.model, result.diagnostics);
        return;
      }

      const result = await parseMermaid(code);
      if (token !== generation.current) return;

      if (result.model?.fallbackToStatic) {
        try {
          const svg = await renderMermaidSvg(
            code,
            theme === 'dark',
            mermaidThemeVariables(getFont(fontKey).stack),
          );
          if (token !== generation.current) return;
          setStaticSvg(svg);
          setParseResult(result.model, result.diagnostics);
          return;
        } catch (error) {
          if (token !== generation.current) return;
          setStaticSvg(null);
          setParseResult(null, [{ message: String(error), severity: 'error' }]);
          return;
        }
      }

      setStaticSvg(null);
      setParseResult(result.model, result.diagnostics);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [code, lang, activeId, theme, fontKey, paletteKey, setParseResult, setParsing, setStaticSvg]);
}
