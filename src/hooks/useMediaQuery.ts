import { useEffect, useState } from 'react';

/** Suscripción a una media query, con el valor correcto ya en el primer render. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const list = window.matchMedia(query);
    const update = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}

/** Umbral único para toda la app: por debajo, el layout de dos columnas no cabe. */
export const MOBILE_QUERY = '(max-width: 860px)';
