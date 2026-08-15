import { useStore } from '../store/useStore';

/** Iconos en SVG y no en caracteres: ☀/☾ salen como emoji en algunos sistemas. */
function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden focusable="false">
      <circle cx="8" cy="8" r="3.2" />
      <g strokeLinecap="round">
        <path d="M8 1v1.8M8 13.2V15M15 8h-1.8M2.8 8H1M12.95 3.05l-1.27 1.27M4.32 11.68l-1.27 1.27M12.95 12.95l-1.27-1.27M4.32 4.32L3.05 3.05" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden focusable="false">
      <path d="M13.5 9.7A6 6 0 0 1 6.3 2.5a6 6 0 1 0 7.2 7.2Z" />
    </svg>
  );
}

/**
 * Interruptor claro/oscuro. `role="switch"` y no un botón normal: para un
 * lector de pantalla es un control de dos estados, no una acción suelta.
 */
export function ThemeToggle() {
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      title={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      className={`theme-toggle${isDark ? ' is-dark' : ''}`}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {/* la perilla va primero: sin z-index manda el orden del DOM, y si va
          después tapa el icono que debería quedar encima de ella */}
      <span className="theme-toggle__thumb" aria-hidden />
      <span className="theme-toggle__icon theme-toggle__icon--sun">
        <SunIcon />
      </span>
      <span className="theme-toggle__icon theme-toggle__icon--moon">
        <MoonIcon />
      </span>
    </button>
  );
}
