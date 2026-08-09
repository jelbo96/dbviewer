import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { GroupNodeType } from './nodeTypes';

function GroupNodeImpl({ data }: NodeProps<GroupNodeType>) {
  return (
    <div className="group-node">
      <span className="group-node__label">{data.label}</span>
    </div>
  );
}

export const GroupNode = memo(GroupNodeImpl);
