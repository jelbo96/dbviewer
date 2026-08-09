import { memo } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { ShapeNodeType } from './nodeTypes';
import type { ShapeName } from '../../lib/types';
import { AnchorHandles } from './Handles';
import { ALL_SIDES, NODE_ANCHOR } from './anchors';
import { useHighlight } from '../HighlightContext';

type ShapeProps = { w: number; h: number };

/** El inset lateral de las formas "anguladas" (hexágono, trapecios...). */
const slant = (w: number) => Math.min(22, w / 4);

function polygon(points: [number, number][]) {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

const RENDERERS: Record<ShapeName, (p: ShapeProps) => ReactElement> = {
  rect: ({ w, h }) => <rect className="shape-node__shape" x={1} y={1} width={w - 2} height={h - 2} rx={3} />,
  round: ({ w, h }) => <rect className="shape-node__shape" x={1} y={1} width={w - 2} height={h - 2} rx={10} />,
  stadium: ({ w, h }) => <rect className="shape-node__shape" x={1} y={1} width={w - 2} height={h - 2} rx={(h - 2) / 2} />,
  circle: ({ w, h }) => <ellipse className="shape-node__shape" cx={w / 2} cy={h / 2} rx={w / 2 - 1} ry={h / 2 - 1} />,
  doublecircle: ({ w, h }) => (
    <>
      <ellipse className="shape-node__shape" cx={w / 2} cy={h / 2} rx={w / 2 - 1} ry={h / 2 - 1} />
      <ellipse className="shape-node__shape" cx={w / 2} cy={h / 2} rx={w / 2 - 6} ry={h / 2 - 6} fill="none" />
    </>
  ),
  diamond: ({ w, h }) => (
    <polygon
      className="shape-node__shape"
      points={polygon([
        [w / 2, 1],
        [w - 1, h / 2],
        [w / 2, h - 1],
        [1, h / 2],
      ])}
    />
  ),
  hexagon: ({ w, h }) => {
    const s = slant(w);
    return (
      <polygon
        className="shape-node__shape"
        points={polygon([
          [s, 1],
          [w - s, 1],
          [w - 1, h / 2],
          [w - s, h - 1],
          [s, h - 1],
          [1, h / 2],
        ])}
      />
    );
  },
  cylinder: ({ w, h }) => {
    const ry = Math.min(12, h / 5);
    return (
      <>
        <path
          className="shape-node__shape"
          d={`M1,${ry + 1} a ${w / 2 - 1},${ry} 0 0 1 ${w - 2},0 v ${h - 2 * ry - 2} a ${w / 2 - 1},${ry} 0 0 1 ${-(w - 2)},0 Z`}
        />
        <path className="shape-node__shape" fill="none" d={`M1,${ry + 1} a ${w / 2 - 1},${ry} 0 0 0 ${w - 2},0`} />
      </>
    );
  },
  subroutine: ({ w, h }) => (
    <>
      <rect className="shape-node__shape" x={1} y={1} width={w - 2} height={h - 2} rx={2} />
      <path className="shape-node__shape" fill="none" d={`M9,1 V${h - 1} M${w - 9},1 V${h - 1}`} />
    </>
  ),
  trapezoid: ({ w, h }) => {
    const s = slant(w);
    return (
      <polygon
        className="shape-node__shape"
        points={polygon([
          [s, 1],
          [w - s, 1],
          [w - 1, h - 1],
          [1, h - 1],
        ])}
      />
    );
  },
  inv_trapezoid: ({ w, h }) => {
    const s = slant(w);
    return (
      <polygon
        className="shape-node__shape"
        points={polygon([
          [1, 1],
          [w - 1, 1],
          [w - s, h - 1],
          [s, h - 1],
        ])}
      />
    );
  },
  lean_right: ({ w, h }) => {
    const s = slant(w);
    return (
      <polygon
        className="shape-node__shape"
        points={polygon([
          [s, 1],
          [w - 1, 1],
          [w - s, h - 1],
          [1, h - 1],
        ])}
      />
    );
  },
  lean_left: ({ w, h }) => {
    const s = slant(w);
    return (
      <polygon
        className="shape-node__shape"
        points={polygon([
          [1, 1],
          [w - s, 1],
          [w - 1, h - 1],
          [s, h - 1],
        ])}
      />
    );
  },
  odd: ({ w, h }) => (
    <polygon
      className="shape-node__shape"
      points={polygon([
        [1, 1],
        [w - 1, 1],
        [w - 1, h - 1],
        [1, h - 1],
        [15, h / 2],
      ])}
    />
  ),
};

function ShapeNodeImpl({ id, data, selected, width, height }: NodeProps<ShapeNodeType>) {
  const highlight = useHighlight();
  const dimmed = highlight.active && !highlight.nodes.has(id);

  const w = width ?? data._w;
  const h = height ?? data._h;
  const Render = RENDERERS[data.shape] ?? RENDERERS.rect;

  return (
    <div
      className={`shape-node${selected ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`}
      style={data.cssStyles ? parseStyles(data.cssStyles) : undefined}
    >
      <AnchorHandles base={NODE_ANCHOR} sides={ALL_SIDES} />
      <svg className="shape-node__svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <Render w={w} h={h} />
      </svg>
      <div className="shape-node__label">{data.label}</div>
    </div>
  );
}

/**
 * mermaid entrega `style A fill:#f00,stroke:#000` como CSS crudo. Lo pasamos a
 * custom properties porque las reglas de `.shape-node__shape` ganarían por
 * especificidad sobre un `style` heredado del contenedor.
 */
const STYLE_VARS: Record<string, string> = {
  fill: '--shape-fill',
  stroke: '--shape-stroke',
  'stroke-width': '--shape-stroke-width',
  'stroke-dasharray': '--shape-dash',
  color: '--shape-text',
};

function parseStyles(raw: string): CSSProperties {
  const result: Record<string, string> = {};
  for (const rule of raw.split(/[;,](?![^(]*\))/)) {
    const separator = rule.indexOf(':');
    if (separator < 0) continue;
    const prop = rule.slice(0, separator).trim().toLowerCase();
    const value = rule.slice(separator + 1).trim();
    const variable = STYLE_VARS[prop];
    if (variable && value) result[variable] = value;
  }
  return result as CSSProperties;
}

export const ShapeNode = memo(ShapeNodeImpl);
