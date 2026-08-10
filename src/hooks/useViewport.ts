import { useEffect, useState } from 'react';

export interface Viewport {
  /** Alto que de verdad se ve, sin contar el teclado. */
  height: number;
  /** Cuánto tapa el teclado (u otro widget del navegador) por abajo. */
  keyboard: number;
}

/**
 * En móvil el teclado no siempre encoge el layout: en iOS `innerHeight` sigue
 * igual y sólo cambia el *visual viewport*, así que un panel `position: fixed`
 * anclado abajo se queda debajo del teclado. Medimos los dos para poder subir el
 * panel justo lo que el teclado ocupa.
 */
function readViewport(): Viewport {
  if (typeof window === 'undefined') return { height: 0, keyboard: 0 };
  const layout = window.innerHeight;
  const visual = window.visualViewport;
  if (!visual) return { height: layout, keyboard: 0 };
  // Al hacer pinch-zoom el visual viewport también encoge, pero ahí no hay
  // teclado que esquivar: lo distinguimos por la escala.
  const zoomed = visual.scale > 1.01;
  const hidden = Math.max(0, layout - visual.height - visual.offsetTop);
  return { height: visual.height, keyboard: zoomed ? 0 : hidden };
}

/** Alto visible y alto tapado por el teclado, actualizados al vuelo. */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState(readViewport);

  useEffect(() => {
    const update = () => setViewport(readViewport());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    // `scroll` del visual viewport: al desplazarse con el teclado abierto
    // cambia `offsetTop` y con él lo que queda tapado.
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);

  return viewport;
}
