import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredPanel } from '../hooks/useAnchoredPanel';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  hint?: string;
}

export function Menu({ label, items, icon }: { label: string; items: MenuItem[]; icon?: ReactNode }) {
  const { open, position, toggle, close, buttonRef, panelRef } = useAnchoredPanel('left');

  return (
    <>
      <button ref={buttonRef} type="button" className={`tb-btn${open ? ' is-active' : ''}`} onClick={toggle}>
        {icon}
        {label}
        <span className="menu__caret" aria-hidden>
          ▾
        </span>
      </button>

      {open &&
        position &&
        createPortal(
          <div className="menu__list" role="menu" ref={panelRef} style={position}>
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="menu__item"
                disabled={item.disabled}
                onClick={() => {
                  close();
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
