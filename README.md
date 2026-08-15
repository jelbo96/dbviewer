# dbviewer

Visor y editor de **DBML** y **Mermaid** con canvas interactivo: las cajas se
arrastran y las relaciones se re-rutean solas.

```bash
npm install
npm run dev
```

> Requiere Node ≥ 20 (Vite 7). Con nvm: `nvm use 22`.

## Qué hace

- **Editor** con resaltado propio para DBML y Mermaid, errores en el margen y
  panel de diagnósticos con número de línea.
- **Pestañas**: varios diagramas abiertos a la vez, cada uno con su lenguaje,
  su acomodo y su nombre (doble clic para renombrar).
- **Guardar / Importar** en `.dbv.json`: el archivo lleva el código *y* las
  posiciones, así que al reabrirlo el diagrama se ve tal cual quedó.
- **Canvas** (React Flow) con nodos arrastrables, zoom, pan, minimapa, grilla
  opcional y auto-layout con dagre en cualquier dirección.
- **Las posiciones que arrastras se conservan.** Editar el texto no rehace el
  acomodo: sólo se auto-posicionan los nodos nuevos. Todo se guarda en
  `localStorage`, por lenguaje.
- **Selección con foco**: al elegir una tabla se atenúa lo no relacionado y se
  resaltan las columnas exactas que participan en cada relación.
- **Exportar** a PNG, SVG, el código fuente, y —desde DBML— SQL para
  PostgreSQL / MySQL / SQL Server / Oracle. La imagen encuadra el diagrama
  completo, no lo que se ve en pantalla.
- **Grilla** opcional: al activarla se dibuja (con el mismo paso que usa el
  ajuste al arrastrar, 20px).
- **Selector de tipografía** para el diagrama: Sistema, Helvetica, Redondeada,
  Serif y Monoespaciada. Los anchos de caja se recalculan al cambiarla.
- **Paletas** del diagrama, combinables con el tema claro/oscuro:
  Predeterminada, Fintoc y Blueprint.
- Tema claro y oscuro; la primera vez sigue la preferencia del sistema.

## Soporte por tipo de diagrama

| Fuente | Cajas arrastrables | Notas |
|---|---|---|
| DBML | ✅ | tablas, columnas con PK/FK/UQ/NN, enums, notas, `TableGroup`, relaciones con pata de gallo ancladas a la columna |
| Mermaid `flowchart` / `graph` | ✅ | 14 formas, `subgraph`, aristas punteadas/gruesas, etiquetas, `style` |
| Mermaid `erDiagram` | ✅ | atributos, PK/FK/UK, cardinalidades |
| Mermaid `classDiagram` | ✅ | miembros, métodos, anotaciones, herencia/composición/agregación |
| Mermaid `stateDiagram` | ✅ | estados y estados compuestos |
| Resto (`sequenceDiagram`, `gantt`, `pie`, `mindmap`, …) | ❌ | render nativo de Mermaid. No se arrastran las cajas, pero sí respetan la tipografía, la grilla y el export a PNG/SVG |

## Cómo está armado

El punto clave es que **no leemos el SVG que dibuja Mermaid**. Usamos su propio
parser (`mermaidAPI.getDiagramFromText`) para obtener el grafo semántico —
nodos, aristas, subgrafos— y con eso construimos nuestros propios nodos de React
Flow. Por eso se pueden arrastrar de verdad y las aristas se recalculan.

```
código ──► parser ──► DiagramModel ──► React Flow
           (dbml.ts / mermaid.ts)      (DiagramCanvas)
```

`DiagramModel` (`src/lib/types.ts`) es el modelo intermedio común: agregar una
fuente nueva es escribir un parser, no tocar el render.

| Archivo | Rol |
|---|---|
| `src/lib/dbml.ts` | DBML → `DiagramModel` (vía `@dbml/core`, carga diferida) |
| `src/lib/mermaid.ts` | Mermaid → `DiagramModel`, más el render estático de respaldo |
| `src/lib/layout.ts` | auto-layout con dagre y fusión con las posiciones guardadas |
| `src/lib/measure.ts` | estimación de tamaños; **sus constantes deben coincidir con `styles/nodes.css`** |
| `src/components/DiagramCanvas.tsx` | canvas, elección dinámica del lado de cada arista, cajas de grupo |
| `src/components/EdgeMarkers.tsx` | marcadores SVG (pata de gallo, UML) |
| `src/lib/document.ts` | pestañas y formato `.dbv.json` (serializar y validar al importar) |
| `src/lib/palettes.ts` + `styles/palettes.css` | paletas; sólo redefinen tokens de `theme.css` |
| `src/store/useStore.ts` | estado + persistencia (con migración de versiones) |

### Detalles que no son obvios

- **Anclas por columna**: cada columna expone handles a izquierda y derecha
  (`source` y `target` con el mismo id). El canvas elige el lado en cada render
  según la posición relativa de los nodos, así arrastrar re-rutea.
- **Grupos**: `TableGroup` y `subgraph` no son nodos padre de React Flow. Su
  caja se deriva del bounding box de los hijos, así arrastrar un hijo reajusta
  el recuadro solo. Para mover un grupo entero, selecciona sus nodos con
  shift+arrastre y muévelos juntos.
- **Errores de sintaxis no borran el diagrama**: se conserva el último modelo
  válido mientras escribes.
- Los `defs` de los marcadores viven dentro del viewport de React Flow para que
  el export a imagen, que clona ese subárbol, se los lleve.
- **El export no puede clonar las aristas tal cual.** React Flow las monta como
  `<svg>` sin dimensiones que sólo se ven gracias a `overflow: visible`, y
  html-to-image serializa cada caja: la imagen salía sin líneas. `exporters.ts`
  reconstruye las líneas en un SVG propio con tamaño explícito y estilos ya
  resueltos, y oculta el original mientras dura la captura.
- Los tamaños de caja se estiman en `measure.ts`, no se miden en el DOM. Por eso
  cada tipografía lleva un `widthFactor` en `lib/fonts.ts` y cambiarla vuelve a
  parsear.
- **Los diagramas estáticos tienen su propia ruta de export**: ya son un SVG y
  no pasan por React Flow, así que `exportStaticPng` los dibuja en un canvas en
  vez de usar html-to-image.
- La tipografía del render estático va por `themeVariables` de Mermaid: escribe
  `font-family` inline en cada texto del SVG, así que desde CSS no se puede.
- El estado guardado lleva versión. `migrate` convirtió el formato v1 (dos slots
  fijos, `code.dbml` y `code.mermaid`) en pestañas sin perder nada.
- Las paletas sólo redefinen variables que ya existen en `theme.css`, así que
  una paleta nueva es un bloque CSS y una entrada en `palettes.ts`. Se cruzan
  con `[data-theme]`, por eso cada una declara su variante clara y su oscura.
- La paleta *Fintoc* toma color y forma de los estilos computados de su sitio
  (azul `#057AFF`, radios de 6px). Es inspiración visual: no incluye logos,
  marcas ni webfonts de terceros, y la app sigue funcionando sin red.

## Comandos

```bash
npm run dev      # servidor de desarrollo
npm test         # pruebas (vitest run)
npm run lint     # oxlint
npm run build    # typecheck + build de producción
npm run preview  # sirve el build
```

## Despliegue (Cloudflare Pages)

| Ajuste | Valor |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Variables de entorno | ninguna |

La versión de Node va fijada en `.nvmrc`. Es obligatorio: Cloudflare Pages usa
Node 18 por defecto y ahí el build falla con `'node:util' does not provide an
export named 'styleText'`. Si la plataforma ignorara el `.nvmrc`, el equivalente
es la variable `NODE_VERSION`.

El sitio es estático y sin backend. Una sola ruta, así que no hace falta
`_redirects` para SPA.

**Al cambiar de dominio** hay que actualizar la URL en tres sitios, porque van
absolutas y no hay build step que las inyecte:

1. `index.html` — `canonical`, `og:url` y `og:image`
2. `public/robots.txt` — la línea `Sitemap:`
3. `public/sitemap.xml` — el `<loc>`
