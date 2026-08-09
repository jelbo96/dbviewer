import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { EntityNodeType } from './nodeTypes';
import { AnchorHandles } from './Handles';
import { NODE_ANCHOR } from './anchors';
import { useHighlight } from '../HighlightContext';

const KEY_CLASS: Record<string, string> = {
  PK: 'node__key--pk',
  FK: 'node__key--fk',
  UK: 'node__key--uk',
};

function EntityNodeImpl({ id, data, selected }: NodeProps<EntityNodeType>) {
  const highlight = useHighlight();
  const dimmed = highlight.active && !highlight.nodes.has(id);

  return (
    <div className={`node node--entity${selected ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`}>
      <AnchorHandles base={NODE_ANCHOR} />
      <div className="node__header">
        <span className="node__header-accent" />
        <span>{data.name}</span>
      </div>
      <div className="node__rows">
        {data.attributes.map((attr, index) => (
          <div className="node__row" key={`${attr.name}-${index}`} title={attr.comment}>
            <span className="node__col-type">{attr.type}</span>
            <span className="node__col-name">{attr.name}</span>
            {attr.keys.map((key) => (
              <span key={key} className={`node__key ${KEY_CLASS[key] ?? 'node__key--uk'}`}>
                {key}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const EntityNode = memo(EntityNodeImpl);
