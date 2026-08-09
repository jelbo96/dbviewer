import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Diagnostic, DiagramModel, FlowDirection, SourceLang } from '../lib/types';
import { EMPTY_MODEL } from '../lib/types';
import type { Point, PositionMap } from '../lib/layout';
import { DEFAULT_CODE } from '../lib/samples';
import { DEFAULT_FONT } from '../lib/fonts';
import { createDocument, uniqueName, type DiagramDocument } from '../lib/document';

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
  /** una pestaña por documento */
  documents: DiagramDocument[];
  activeId: string;
  theme: Theme;
  /** clave de `FONTS` para la tipografía del diagrama */
  fontKey: string;
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

  // --- pestañas ---
  addDocument: (document?: Partial<DiagramDocument>) => string;
  closeDocument: (id: string) => void;
  selectDocument: (id: string) => void;
  renameDocument: (id: string, name: string) => void;
}

export type AppState = PersistedState & TransientState & Actions;

function initialDocuments(): DiagramDocument[] {
  return [createDocument({ lang: 'dbml', name: 'Esquema', code: DEFAULT_CODE.dbml })];
}

/** Aplica un cambio sólo al documento activo. */
function patchActive(state: AppState, patch: Partial<DiagramDocument>): Pick<AppState, 'documents'> {
  return {
    documents: state.documents.map((document) =>
      document.id === state.activeId ? { ...document, ...patch } : document,
    ),
  };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      const documents = initialDocuments();
      return {
        documents,
        activeId: documents[0].id,
        theme: systemTheme(),
        fontKey: DEFAULT_FONT.key,
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

        setTheme: (theme) => set({ theme }),
        setFontKey: (fontKey) => set({ fontKey }),
        toggleSnap: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
        toggleMinimap: () => set((state) => ({ showMinimap: !state.showMinimap })),
        setEditorRatio: (editorRatio) => set({ editorRatio }),
        setSelected: (selectedId) => set({ selectedId }),
        setParsing: (parsing) => set({ parsing }),
        setStaticSvg: (staticSvg) => set({ staticSvg }),

        // cambiar de lenguaje reemplaza el contenido de la pestaña: son
        // sintaxis distintas, no dos vistas de lo mismo
        setLang: (lang) =>
          set((state) => ({
            ...patchActive(state, { lang, code: DEFAULT_CODE[lang], positions: {} }),
            selectedId: null,
            staticSvg: null,
          })),

        setCode: (code) => set((state) => patchActive(state, { code })),
        setDirection: (direction) => set((state) => patchActive(state, { direction })),
        setPositions: (positions) => set((state) => patchActive(state, { positions })),

        updatePositions: (updates) =>
          set((state) => {
            const active = state.documents.find((document) => document.id === state.activeId);
            return patchActive(state, { positions: { ...active?.positions, ...updates } });
          }),

        setParseResult: (model, diagnostics) =>
          // ante un error de sintaxis conservamos el último diagrama válido:
          // el usuario sigue viendo su trabajo mientras escribe.
          set((state) => ({ diagnostics, model: model ?? state.model, parsing: false })),

        requestLayout: () => set((state) => ({ layoutNonce: state.layoutNonce + 1 })),
        requestFit: () => set((state) => ({ fitNonce: state.fitNonce + 1 })),

        addDocument: (partial) => {
          const taken = get().documents.map((document) => document.name);
          const document = createDocument(partial);
          document.name = uniqueName(document.name, taken);
          set((state) => ({
            documents: [...state.documents, document],
            activeId: document.id,
            selectedId: null,
            staticSvg: null,
          }));
          return document.id;
        },

        closeDocument: (id) =>
          set((state) => {
            // nunca dejamos la app sin pestañas: cerrar la última crea una vacía
            const remaining = state.documents.filter((document) => document.id !== id);
            if (!remaining.length) {
              const fresh = initialDocuments();
              return { documents: fresh, activeId: fresh[0].id, selectedId: null, staticSvg: null };
            }
            if (id !== state.activeId) return { documents: remaining };

            // al cerrar la activa pasamos a la vecina de la izquierda
            const index = state.documents.findIndex((document) => document.id === id);
            const next = remaining[Math.max(0, index - 1)];
            return { documents: remaining, activeId: next.id, selectedId: null, staticSvg: null };
          }),

        selectDocument: (id) =>
          set((state) =>
            state.documents.some((document) => document.id === id)
              ? { activeId: id, selectedId: null, staticSvg: null }
              : {},
          ),

        renameDocument: (id, name) =>
          set((state) => ({
            documents: state.documents.map((document) =>
              document.id === id ? { ...document, name: name.trim() || document.name } : document,
            ),
          })),
      };
    },
    {
      name: 'dbviewer',
      version: 2,
      partialize: (state): PersistedState => ({
        documents: state.documents,
        activeId: state.activeId,
        theme: state.theme,
        fontKey: state.fontKey,
        snapToGrid: state.snapToGrid,
        showMinimap: state.showMinimap,
        editorRatio: state.editorRatio,
      }),

      /**
       * v1 guardaba dos slots fijos (`code.dbml` y `code.mermaid`). Los pasamos
       * a dos pestañas para no perder lo que el usuario tuviera escrito.
       */
      migrate: (persisted, version) => {
        if (version >= 2) return persisted as PersistedState;
        const old = persisted as {
          lang?: SourceLang;
          code?: Record<SourceLang, string>;
          positions?: Record<SourceLang, PositionMap>;
          direction?: FlowDirection | 'auto';
          theme?: Theme;
          fontKey?: string;
          snapToGrid?: boolean;
          showMinimap?: boolean;
          editorRatio?: number;
        };

        const langs: SourceLang[] = ['dbml', 'mermaid'];
        const documents = langs.map((lang) =>
          createDocument({
            lang,
            name: lang === 'dbml' ? 'Esquema' : 'Diagrama',
            code: old.code?.[lang] ?? DEFAULT_CODE[lang],
            positions: old.positions?.[lang] ?? {},
            direction: old.direction ?? 'auto',
          }),
        );
        const activeIndex = langs.indexOf(old.lang ?? 'dbml');

        return {
          documents,
          activeId: documents[Math.max(0, activeIndex)].id,
          theme: old.theme ?? systemTheme(),
          fontKey: old.fontKey ?? DEFAULT_FONT.key,
          snapToGrid: old.snapToGrid ?? false,
          showMinimap: old.showMinimap ?? true,
          editorRatio: old.editorRatio ?? 0.36,
        } satisfies PersistedState;
      },
    },
  ),
);

/** El documento activo; nunca es undefined salvo estado corrupto. */
export const selectActive = (state: AppState): DiagramDocument =>
  state.documents.find((document) => document.id === state.activeId) ?? state.documents[0];

export const selectCode = (state: AppState) => selectActive(state).code;
export const selectLang = (state: AppState) => selectActive(state).lang;
export const selectDirection = (state: AppState) => selectActive(state).direction;
export const selectPositions = (state: AppState) => selectActive(state).positions;
