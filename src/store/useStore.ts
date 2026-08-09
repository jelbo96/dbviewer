import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Diagnostic, DiagramModel, FlowDirection, SourceLang } from '../lib/types';
import { EMPTY_MODEL } from '../lib/types';
import type { Point, PositionMap } from '../lib/layout';
import { DEFAULT_CODE } from '../lib/samples';
import { DEFAULT_FONT } from '../lib/fonts';

export type Theme = 'dark' | 'light';

/**
 * Primera visita: seguimos la preferencia del sistema. Preguntamos por `light`
 * para que oscuro quede como fallback si el navegador no informa nada.
 */
function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

interface PersistedState {
  lang: SourceLang;
  code: Record<SourceLang, string>;
  /** posiciones por lenguaje: cambiar de pestaña no pierde el acomodo */
  positions: Record<SourceLang, PositionMap>;
  theme: Theme;
  /** clave de `FONTS` para la tipografía del diagrama */
  fontKey: string;
  direction: FlowDirection | 'auto';
  snapToGrid: boolean;
  showMinimap: boolean;
  editorRatio: number;
}

interface TransientState {
  model: DiagramModel;
  diagnostics: Diagnostic[];
  parsing: boolean;
  selectedId: string | null;
  /** SVG del render nativo de mermaid, cuando el tipo no es interactivo */
  staticSvg: string | null;
  /**
   * Contadores que la barra de herramientas incrementa para pedirle algo al
   * canvas (que vive dentro del ReactFlowProvider y tiene el estado de nodos).
   */
  layoutNonce: number;
  fitNonce: number;
}

interface Actions {
  setLang: (lang: SourceLang) => void;
  setCode: (code: string) => void;
  setTheme: (theme: Theme) => void;
  setFontKey: (fontKey: string) => void;
  setDirection: (direction: FlowDirection | 'auto') => void;
  toggleSnap: () => void;
  toggleMinimap: () => void;
  setEditorRatio: (ratio: number) => void;
  setSelected: (id: string | null) => void;
  setParseResult: (model: DiagramModel | null, diagnostics: Diagnostic[]) => void;
  setParsing: (parsing: boolean) => void;
  setStaticSvg: (svg: string | null) => void;
  setPositions: (positions: PositionMap) => void;
  updatePositions: (updates: Record<string, Point>) => void;
  requestLayout: () => void;
  requestFit: () => void;
}

export type AppState = PersistedState & TransientState & Actions;

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      lang: 'dbml',
      code: { ...DEFAULT_CODE },
      positions: { dbml: {}, mermaid: {} },
      theme: systemTheme(),
      fontKey: DEFAULT_FONT.key,
      direction: 'auto',
      snapToGrid: false,
      showMinimap: true,
      editorRatio: 0.36,

      model: EMPTY_MODEL,
      diagnostics: [],
      parsing: false,
      selectedId: null,
      staticSvg: null,
      layoutNonce: 0,
      fitNonce: 0,

      setLang: (lang) => set({ lang, selectedId: null, staticSvg: null }),
      setCode: (code) => set((state) => ({ code: { ...state.code, [state.lang]: code } })),
      setTheme: (theme) => set({ theme }),
      setFontKey: (fontKey) => set({ fontKey }),
      setDirection: (direction) => set({ direction }),
      toggleSnap: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
      toggleMinimap: () => set((state) => ({ showMinimap: !state.showMinimap })),
      setEditorRatio: (editorRatio) => set({ editorRatio }),
      setSelected: (selectedId) => set({ selectedId }),
      setParsing: (parsing) => set({ parsing }),
      setStaticSvg: (staticSvg) => set({ staticSvg }),

      setParseResult: (model, diagnostics) =>
        // ante un error de sintaxis conservamos el último diagrama válido:
        // el usuario sigue viendo su trabajo mientras escribe.
        set((state) => ({ diagnostics, model: model ?? state.model, parsing: false })),

      setPositions: (positions) =>
        set((state) => ({ positions: { ...state.positions, [state.lang]: positions } })),

      updatePositions: (updates) =>
        set((state) => ({
          positions: {
            ...state.positions,
            [state.lang]: { ...state.positions[state.lang], ...updates },
          },
        })),

      requestLayout: () => set((state) => ({ layoutNonce: state.layoutNonce + 1 })),
      requestFit: () => set((state) => ({ fitNonce: state.fitNonce + 1 })),
    }),
    {
      name: 'dbviewer',
      version: 1,
      partialize: (state): PersistedState => ({
        lang: state.lang,
        code: state.code,
        positions: state.positions,
        theme: state.theme,
        fontKey: state.fontKey,
        direction: state.direction,
        snapToGrid: state.snapToGrid,
        showMinimap: state.showMinimap,
        editorRatio: state.editorRatio,
      }),
    },
  ),
);

export const selectCode = (state: AppState) => state.code[state.lang];