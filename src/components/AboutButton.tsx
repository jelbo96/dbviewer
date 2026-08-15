import { createPortal } from 'react-dom';
import { useAnchoredPanel } from '../hooks/useAnchoredPanel';

const AUTHOR = 'Ignacio Jelvez';
const GITHUB_USER = 'jelbo96';
const GITHUB_URL = `https://github.com/${GITHUB_USER}`;
const REPO_URL = `${GITHUB_URL}/dbviewer`;

export function AboutButton() {
  const { open, position, toggle, close, buttonRef, panelRef } = useAnchoredPanel('right');

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`tb-btn tb-btn--icon${open ? ' is-active' : ''}`}
        onClick={toggle}
        title="Acerca de dbviewer"
        aria-label="Acerca de dbviewer"
        aria-expanded={open}
      >
        i
      </button>

      {open &&
        position &&
        createPortal(
          <div className="about__panel" role="dialog" aria-label="Acerca de dbviewer" ref={panelRef} style={position}>
            <strong className="about__title">dbviewer</strong>
            <p className="about__text">Visor y editor de diagramas DBML y Mermaid con cajas arrastrables.</p>
            <p className="about__text">
              Hecho por <strong>{AUTHOR}</strong>
            </p>
            {/* noopener/noreferrer: sin ellos la pestaña abierta puede manipular ésta */}
            <a className="about__link" href={GITHUB_URL} target="_blank" rel="noopener noreferrer" onClick={close}>
              github.com/{GITHUB_USER} ↗
            </a>
            <a className="about__link" href={REPO_URL} target="_blank" rel="noopener noreferrer" onClick={close}>
              Código de este proyecto ↗
            </a>
          </div>,
          document.body,
        )}
    </>
  );
}
