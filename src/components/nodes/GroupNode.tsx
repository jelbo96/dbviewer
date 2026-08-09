import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { GroupData } from '../../lib/types';

function GroupNodeImpl({ data }: NodeProps) {
  const group = data as unknown as GroupData;
  return (
    <div className="group-node">
      <span className="group-node__label">{group.label}</span>
    </div>
  );
}

export const GroupNode = memo(GroupNodeImpl);
