import { useEffect, useRef, useState } from 'react';

const AUTHOR = 'Ignacio Jelvez';
const GITHUB_USER = 'jelbo96';
const GITHUB_URL = `https://github.com/${GITHUB_USER}`;
const REPO_URL = `${GITHUB_URL}/dbviewer`;

export function AboutButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="about" ref={ref}>
      <button
        type="button"
        className={`tb-btn tb-btn--icon${open ? ' is-active' : ''}`}
        onClick={() => setOpen((value) => !value)}
        title="Acerca de dbviewer"
        aria-label="Acerca de dbviewer"
        aria-expanded={open}
      >
        i
      </button>

      {open && (
        <div className="about__panel" role="dialog" aria-label="Acerca de dbviewer">
          <strong className="about__title">dbviewer</strong>
          <p className="about__text">Visor y editor de diagramas DBML y Mermaid con cajas arrastrables.</p>
          <p className="about__text">
            Hecho por <strong>{AUTHOR}</strong>
          </p>
          {/* noopener/noreferrer: sin ellos la pestaña abierta puede manipular ésta */}
          <a className="about__link" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            github.com/{GITHUB_USER} ↗
          </a>
          <a className="about__link" href={REPO_URL} target="_blank" rel="noopener noreferrer">
            Código de este proyecto ↗
          </a>
        </div>
      )}
    </div>
  );
}
