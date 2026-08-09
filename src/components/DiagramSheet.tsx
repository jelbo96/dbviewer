import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../store/useStore';

/**
 * Alturas a las que se ancla el panel, como fracción de la ventana. En móvil no
 * caben dos columnas, así que el editor ocupa la pantalla y el diagrama sube
 * desde abajo.
 */
const SNAPS = { peek: 0.08, half: 0.55, full: 0.94 } as const;
type Snap = keyof typeof SNAPS;

const ORDER: Snap[] = ['peek', 'half', 'full'];
/** Arrastres cortos son un toque, no un gesto. */
const DRAG_THRESHOLD = 8;

export function DiagramSheet({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snap>('half');
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startHeight: number; moved: boolean } | null>(null);
  const requestFit = useStore((state) => state.requestFit);

  const heightFor = (value: Snap) => Math.round(window.innerHeight * SNAPS[value]);

  // Al cambiar de altura el canvas tiene otro tamaño: reencuadrar para que el
  // diagrama no quede fuera de vista.
  const goTo = useCallback(
    (next: Snap) => {
      setSnap(next);
      if (next !== 'peek') window.setTimeout(requestFit, 260);
    },
    [requestFit],
  );

  useEffect(() => {
    const onResize = () => setDragHeight(null);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /** Al soltar, va al ancla más cercano a la altura actual. */
  const settle = (height: number) => {
    const closest = ORDER.reduce((best, candidate) =>
      Math.abs(heightFor(candidate) - height) < Math.abs(heightFor(best) - height) ? candidate : best,
    );
    setDragHeight(null);
    goTo(closest);
  };

  const height = dragHeight ?? heightFor(snap);

  return (
    <section
      className="sheet"
      style={{ height, transition: dragHeight === null ? 'height 0.24s ease' : 'none' }}
      aria-label="Diagrama"
    >
      <div
        className="sheet__handle"
        role="button"
        tabIndex={0}
        aria-label="Arrastra o toca para cambiar el alto del diagrama"
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
          const next = Math.min(
            window.innerHeight * SNAPS.full,
            Math.max(window.innerHeight * SNAPS.peek, drag.startHeight + delta),
          );
          setDragHeight(next);
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          dragRef.current = null;
          // un toque sin arrastre cicla al siguiente ancla
          if (!drag.moved) {
            goTo(ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length]);
            return;
          }
          settle(dragHeight ?? height);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') goTo(ORDER[Math.min(ORDER.indexOf(snap) + 1, ORDER.length - 1)]);
          if (event.key === 'ArrowDown') goTo(ORDER[Math.max(ORDER.indexOf(snap) - 1, 0)]);
        }}
      >
        <span className="sheet__grip" aria-hidden />
        <span className="sheet__label">Diagrama</span>
      </div>

      <div className="sheet__body">{children}</div>
    </section>
  );
}
