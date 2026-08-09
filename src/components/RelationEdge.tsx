import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import type { EdgeVariant } from '../lib/types';
import { useHighlight } from './HighlightContext';

export interface RelationEdgeData extends Record<string, unknown> {
  variant: EdgeVariant;
  label?: string;
  /** trazo ortogonal (diagramas de datos) vs. curva (flowchart) */
  orthogonal: boolean;
}

function RelationEdgeImpl({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerStart,
  markerEnd,
  data,
}: EdgeProps) {
  const { variant = 'solid', label, orthogonal = true } = (data ?? {}) as RelationEdgeData;
  const highlight = useHighlight();

  if (variant === 'invisible') return null;

  const params = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
  const [path, labelX, labelY] = orthogonal
    ? getSmoothStepPath({ ...params, borderRadius: 10, offset: 22 })
    : getBezierPath(params);

  const active = highlight.edges.has(id);
  const dimmed = highlight.active && !active;
  const className = [
    'rel-edge',
    `rel-edge--${variant}`,
    active ? 'is-active' : '',
    dimmed ? 'is-dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <BaseEdge id={id} path={path} markerStart={markerStart} markerEnd={markerEnd} className={className} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className={`rel-edge__label${active ? ' is-active' : ''}${dimmed ? ' is-dimmed' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const RelationEdge = memo(RelationEdgeImpl);
