import { useCallback, useEffect, useRef, useState } from 'react';

export type PanelAlign = 'left' | 'right';

interface Position {
  top: number;
  left?: number;
  right?: number;
}

/**
 * Desplegable anclado a un botón, pensado para renderizarse en un portal.
 *
 * El portal no es un capricho: la barra de herramientas tiene `overflow-x` para
 * hacer scroll, y eso recorta también en vertical, así que cualquier panel
 * posicionado dentro de ella queda cortado por más z-index que se le ponga.
 *
 * Con `align: 'right'` fijamos `right` en vez de `left` para no tener que medir
 * el ancho del panel antes de colocarlo.
 */
export function useAnchoredPanel<T extends HTMLElement = HTMLButtonElement>(align: PanelAlign = 'left') {
  const [position, setPosition] = useState<Position | null>(null);
  const buttonRef = useRef<T>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const open = position !== null;

  const close = useCallback(() => setPosition(null), []);

  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition(
      align === 'right'
        ? { top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) }
        : { top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 8) },
    );
  }, [align]);

  const toggle = useCallback(() => {
    if (position) close();
    else place();
  }, [position, close, place]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  return { open, position, toggle, close, buttonRef, panelRef };
}
