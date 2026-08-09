import type { EndpointMarker } from '../lib/types';
import { MARKER_PREFIX } from './edgeMarkerIds';

/**
 * Marcadores SVG compartidos. `orient="auto-start-reverse"` permite usar el
 * mismo marker en ambos extremos, y `context-stroke` los tiñe con el color de
 * la arista (incluido el estado resaltado) sin duplicar defs por color.
 */

const STROKE = { fill: 'none', stroke: 'context-stroke', strokeWidth: 1.6, strokeLinecap: 'round' } as const;
const HOLLOW = { fill: 'var(--canvas-bg)', stroke: 'context-stroke', strokeWidth: 1.6 } as const;
const SOLID = { fill: 'context-stroke', stroke: 'none' } as const;

interface Def {
  id: EndpointMarker;
  width: number;
  height: number;
  refX: number;
  children: React.ReactNode;
}

const DEFS: Def[] = [
  { id: 'arrow', width: 12, height: 12, refX: 11, children: <path d="M1,1 L11,6 L1,11 Z" {...SOLID} /> },
  {
    id: 'arrow-cross',
    width: 12,
    height: 12,
    refX: 11,
    children: <path d="M2,2 L10,10 M10,2 L2,10" {...STROKE} />,
  },
  {
    id: 'arrow-circle',
    width: 12,
    height: 12,
    refX: 11,
    children: <circle cx={6} cy={6} r={4} {...HOLLOW} />,
  },

  // --- pata de gallo (crow's foot) ---
  { id: 'one', width: 14, height: 12, refX: 14, children: <path d="M9,1 L9,11" {...STROKE} /> },
  {
    id: 'many',
    width: 14,
    height: 12,
    refX: 14,
    children: <path d="M0,6 L14,0 M0,6 L14,6 M0,6 L14,12" {...STROKE} />,
  },
  {
    id: 'zero-one',
    width: 18,
    height: 12,
    refX: 18,
    children: (
      <>
        <circle cx={5} cy={6} r={3.2} {...HOLLOW} />
        <path d="M13,1 L13,11 M0,6 L1.8,6" {...STROKE} />
      </>
    ),
  },
  {
    id: 'zero-many',
    width: 18,
    height: 12,
    refX: 18,
    children: (
      <>
        <circle cx={4} cy={6} r={3.2} {...HOLLOW} />
        <path d="M7.2,6 L18,0 M7.2,6 L18,6 M7.2,6 L18,12 M0,6 L0.8,6" {...STROKE} />
      </>
    ),
  },
  {
    id: 'one-many',
    width: 16,
    height: 12,
    refX: 16,
    children: <path d="M3,1 L3,11 M3,6 L16,0 M3,6 L16,6 M3,6 L16,12 M0,6 L3,6" {...STROKE} />,
  },
  { id: 'md-parent', width: 14, height: 12, refX: 14, children: <path d="M9,1 L9,11" {...STROKE} /> },

  // --- UML (classDiagram) ---
  { id: 'extension', width: 15, height: 12, refX: 14, children: <path d="M1,1 L14,6 L1,11 Z" {...HOLLOW} /> },
  { id: 'composition', width: 16, height: 12, refX: 15, children: <path d="M1,6 L8,1.5 L15,6 L8,10.5 Z" {...SOLID} /> },
  { id: 'aggregation', width: 16, height: 12, refX: 15, children: <path d="M1,6 L8,1.5 L15,6 L8,10.5 Z" {...HOLLOW} /> },
  { id: 'dependency', width: 14, height: 12, refX: 13, children: <path d="M2,1 L13,6 L2,11" {...STROKE} /> },
  { id: 'lollipop', width: 14, height: 12, refX: 13, children: <circle cx={7} cy={6} r={4.5} {...HOLLOW} /> },
];

export function EdgeMarkers() {
  return (
    <svg aria-hidden width={0} height={0} style={{ position: 'absolute' }}>
      <defs>
        {DEFS.map((def) => (
          <marker
            key={def.id}
            id={`${MARKER_PREFIX}${def.id}`}
            viewBox={`0 0 ${def.width} ${def.height}`}
            markerWidth={def.width}
            markerHeight={def.height}
            refX={def.refX}
            refY={def.height / 2}
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            {def.children}
          </marker>
        ))}
      </defs>
    </svg>
  );
}
