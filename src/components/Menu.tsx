import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  hint?: string;
}

interface Anchor {
  top: number;
  left: number;
}

/**
 * La lista va en un portal con posición fija: la toolbar tiene scroll
 * horizontal y recortaría cualquier desplegable posicionado dentro de ella.
 */
export function Menu({ label, items, icon }: { label: string; items: MenuItem[]; icon?: ReactNode }) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ top: rect.bottom + 4, left: rect.left });
  }, []);

  useLayoutEffect(() => {
    if (!anchor) return;
    // Si el menú se sale por la derecha, lo alineamos al borde de la ventana.
    const list = listRef.current;
    if (!list) return;
    const rect = list.getBoundingClientRect();
    const overflow = rect.right - (window.innerWidth - 8);
    if (overflow > 0) setAnchor((current) => (current ? { ...current, left: current.left - overflow } : current));
  }, [anchor, items.length]);

  useEffect(() => {
    if (!anchor) return;
    const close = (event: MouseEvent) => {
      if (listRef.current?.contains(event.target as Node)) return;
      if (buttonRef.current?.contains(event.target as Node)) return;
      setAnchor(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAnchor(null);
    };
    const dismiss = () => setAnchor(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', dismiss);
    };
  }, [anchor]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`tb-btn${anchor ? ' is-active' : ''}`}
        onClick={() => (anchor ? setAnchor(null) : place())}
      >
        {icon}
        {label}
        <span className="menu__caret" aria-hidden>
          ▾
        </span>
      </button>
      {anchor &&
        createPortal(
          <div className="menu__list" role="menu" ref={listRef} style={{ top: anchor.top, left: anchor.left }}>
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="menu__item"
                disabled={item.disabled}
                onClick={() => {
                  setAnchor(null);
                  item.onSelect();
                }}
              >
                <span>{item.label}</span>
                {item.hint && <span className="menu__hint">{item.hint}</span>}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
