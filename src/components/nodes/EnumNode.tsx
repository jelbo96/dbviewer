import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { EnumNodeType } from './nodeTypes';
import { AnchorHandles } from './Handles';
import { NODE_ANCHOR } from './anchors';
import { useHighlight } from '../HighlightContext';

function EnumNodeImpl({ id, data, selected }: NodeProps<EnumNodeType>) {
  const highlight = useHighlight();
  const dimmed = highlight.active && !highlight.nodes.has(id);

  return (
    <div className={`node node--enum${selected ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`}>
      <AnchorHandles base={NODE_ANCHOR} />
      <div className="node__header">
        <span className="node__header-accent" />
        {data.schema && <span className="node__schema">{data.schema}.</span>}
        <span>{data.name}</span>
        <span className="node__badge">enum</span>
      </div>
      <div className="node__rows">
        {data.values.map((value) => (
          <div className="node__row" key={value.name} title={value.note}>
            <span className="node__col-name">{value.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const EnumNode = memo(EnumNodeImpl);
