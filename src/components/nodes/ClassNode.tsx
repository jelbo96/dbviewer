import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { ClassData } from '../../lib/types';
import { AnchorHandles } from './Handles';
import { ALL_SIDES, NODE_ANCHOR } from './anchors';
import { useHighlight } from '../HighlightContext';

function ClassNodeImpl({ id, data, selected }: NodeProps) {
  const cls = data as unknown as ClassData;
  const highlight = useHighlight();
  const dimmed = highlight.active && !highlight.nodes.has(id);

  return (
    <div className={`node node--class${selected ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`}>
      <AnchorHandles base={NODE_ANCHOR} sides={ALL_SIDES} />
      <div className="node__header" style={{ justifyContent: 'center' }}>
        <span>{cls.name}</span>
      </div>
      {cls.annotations.length > 0 && (
        <div className="node__section">
          {cls.annotations.map((annotation) => (
            <div className="node__annotation" key={annotation}>
              {annotation}
            </div>
          ))}
        </div>
      )}
      {cls.members.length > 0 && (
        <div className="node__section">
          {cls.members.map((member, index) => (
            <div className="node__member" key={`${member}-${index}`}>
              {member}
            </div>
          ))}
        </div>
      )}
      {cls.methods.length > 0 && (
        <div className="node__section">
          {cls.methods.map((method, index) => (
            <div className="node__member" key={`${method}-${index}`}>
              {method}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const ClassNode = memo(ClassNodeImpl);
