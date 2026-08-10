import { useCallback, useRef, useState } from 'react';

import { useStore, selectLang } from '../store/useStore';
import { useViewport } from '../hooks/useViewport';
import { CodePane } from './CodePane';
import { DiagnosticsBar } from './DiagnosticsBar';

/**
 * Lo que se ve del drawer cuando está cerrado: sólo el asa. El cuerpo de la app
 * reserva este alto (`--sheet-peek` en `app.css`) para que el diagrama no quede
 * tapado.
 */
export const SHEET_PEEK = 46;

const ORDER = ['peek', 'half', 'full'] as const;
type Snap = (typeof ORDER)[number];

/** Fracción del alto visible que ocupa cada ancla; `peek` sólo deja el asa. */
const RATIO: Record<Snap, number> = { peek: 0, half: 0.5, full: 1 };

/** Arrastres cortos son un toque, no un gesto. */
const DRAG_THRESHOLD = 8;

const LANG_LABEL: Record<string, string> = { dbml: 'DBML', mermaid: 'Mermaid' };

function heightFor(snap: Snap, available: number): number {
  return Math.max(SHEET_PEEK, Math.round(available * RATIO[snap]));
}

/**
 * Editor en un panel que sube desde abajo. En móvil el diagrama ocupa la
 * pantalla y el código vive aquí: cerrado deja ver sólo el asa, y se levanta
 * hasta pantalla completa arrastrando, tocando o con el botón de ampliar.
 */
export function CodeSheet() {
  const [snap, setSnap] = useState<Snap>('peek');
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startHeight: number; moved: boolean } | null>(null);
  const sheetRef = useRef<HTMLElement>(null);

  const { height: available, keyboard } = useViewport();
  const lang = useStore(selectLang);
  const diagnostics = useStore((state) => state.diagnostics);
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;

  const goTo = useCallback((next: Snap) => {
    setDragHeight(null);
    setSnap(next);
    // Al cerrar, el editor puede seguir con el foco y el teclado abierto tapando
    // media pantalla sobre un panel que ya no se ve.
    if (next === 'peek') {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && sheetRef.current?.contains(focused)) focused.blur();
    }
  }, []);

  const cycle = () => goTo(ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length]);

  /** Al soltar, va al ancla más cercano a la altura actual. */
  const settle = (current: number) => {
    const closest = ORDER.reduce((best, candidate) =>
      Math.abs(heightFor(candidate, available) - current) < Math.abs(heightFor(best, available) - current)
        ? candidate
        : best,
    );
    goTo(closest);
  };

  // Con el teclado abierto el espacio se reparte entre editor y teclado: usamos
  // todo lo que queda visible, si no el área de escritura es una rendija.
  const resting = keyboard > 0 && snap !== 'peek' ? available : heightFor(snap, available);
  const height = dragHeight ?? resting;
  const open = snap !== 'peek';

  return (
    <section
      ref={sheetRef}
      className={`sheet${snap === 'full' ? ' sheet--full' : ''}`}
      style={{
        height,
        bottom: keyboard,
        transition: dragHeight === null ? 'height 0.24s ease, bottom 0.24s ease' : 'none',
      }}
      aria-label="Código"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) goTo('peek');
      }}
    >
      <div
        className="sheet__handle"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={open ? 'Bajar el editor de código' : 'Levantar el editor de código'}
        onPointerDown={(event) => {
          dragRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startHeight: height,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const delta = drag.startY - event.clientY;
          if (Math.abs(delta) > DRAG_THRESHOLD) drag.moved = true;
          if (!drag.moved) return;
          setDragHeight(Math.min(available, Math.max(SHEET_PEEK, drag.startHeight + delta)));
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          dragRef.current = null;
          // un toque sin arrastre cicla al siguiente ancla
          if (drag.moved) settle(dragHeight ?? height);
          else cycle();
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          setDragHeight(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') goTo(ORDER[Math.min(ORDER.indexOf(snap) + 1, ORDER.length - 1)]);
          if (event.key === 'ArrowDown') goTo(ORDER[Math.max(ORDER.indexOf(snap) - 1, 0)]);
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            cycle();
          }
        }}
      >
        <span className="sheet__grip" aria-hidden />
        <span className="sheet__title">
          <span className="sheet__label">Código</span>
          <span className="sheet__lang">{LANG_LABEL[lang] ?? lang}</span>
          {errors > 0 && (
            <span className="sheet__errors">
              {errors} error{errors > 1 ? 'es' : ''}
            </span>
          )}
        </span>
        <button
          type="button"
          className="sheet__toggle"
          aria-label={snap === 'full' ? 'Cerrar el código' : 'Ver el código en pantalla completa'}
          title={snap === 'full' ? 'Cerrar' : 'Pantalla completa'}
          // el asa captura el puntero para arrastrar: sin esto el botón nunca
          // recibiría el clic
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={() => goTo(snap === 'full' ? 'peek' : 'full')}
        >
          <span aria-hidden>{snap === 'full' ? '✕' : '⤢'}</span>
        </button>
      </div>

      {/* cerrado el cuerpo queda recortado: `inert` evita que el editor
          invisible se quede con el foco o lo lea un lector de pantalla */}
      <div className="sheet__body" inert={!open}>
        <CodePane />
        <DiagnosticsBar />
      </div>
    </section>
  );
}
