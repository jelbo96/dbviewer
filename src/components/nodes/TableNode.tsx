import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { Column, TableData } from '../../lib/types';
import { AnchorHandles } from './Handles';
import { NODE_ANCHOR } from './anchors';
import { useHighlight } from '../HighlightContext';

function ColumnRow({ column, linked }: { column: Column; linked: boolean }) {
  const title = [
    column.note,
    column.defaultValue ? `default: ${column.defaultValue}` : null,
    column.increment ? 'auto increment' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`node__row${linked ? ' is-linked' : ''}`} title={title || undefined}>
      <AnchorHandles base={column.id} />
      <span className={`node__col-name${column.pk ? ' is-pk' : ''}`}>{column.name}</span>
      {column.pk && <span className="node__key node__key--pk">PK</span>}
      {column.fk && <span className="node__key node__key--fk">FK</span>}
      {column.unique && !column.pk && <span className="node__key node__key--uk">UQ</span>}
      {column.notNull && !column.pk && <span className="node__key node__key--nn">NN</span>}
      <span className={`node__col-type${column.isEnum ? ' is-enum' : ''}`}>{column.type}</span>
    </div>
  );
}

function TableNodeImpl({ id, data, selected }: NodeProps) {
  const table = data as unknown as TableData;
  const highlight = useHighlight();
  const dimmed = highlight.active && !highlight.nodes.has(id);

  return (
    <div className={`node node--table${selected ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`}>
      <AnchorHandles base={NODE_ANCHOR} />
      <div className="node__header">
        <span className="node__header-accent" style={table.headerColor ? { background: table.headerColor } : undefined} />
        {table.schema && <span className="node__schema">{table.schema}.</span>}
        <span>{table.name}</span>
        {table.alias && <span className="node__badge">{table.alias}</span>}
      </div>
      <div className="node__rows">
        {table.columns.map((column) => (
          <ColumnRow key={column.id} column={column} linked={highlight.anchors.has(column.id)} />
        ))}
      </div>
      {table.note && <div className="node__note">{table.note}</div>}
    </div>
  );
}

export const TableNode = memo(TableNodeImpl);
