import { Handle, Position } from '@xyflow/react';
import { LR, type Side } from './anchors';

const POSITION: Record<Side, Position> = {
  l: Position.Left,
  r: Position.Right,
  t: Position.Top,
  b: Position.Bottom,
};

/**
 * Cada punto de anclaje expone un handle `source` y otro `target` con el mismo
 * id: el canvas decide en tiempo real por qué lado sale/entra la arista según
 * la posición relativa de los nodos, así arrastrar re-rutea solo.
 */
export function AnchorHandles({ base, sides = LR }: { base: string; sides?: Side[] }) {
  return (
    <>
      {sides.map((side) => (
        <Handle
          key={`s-${side}`}
          type="source"
          id={`${base}:${side}`}
          position={POSITION[side]}
          className="rf-handle"
          isConnectable={false}
        />
      ))}
      {sides.map((side) => (
        <Handle
          key={`t-${side}`}
          type="target"
          id={`${base}:${side}`}
          position={POSITION[side]}
          className="rf-handle"
          isConnectable={false}
        />
      ))}
    </>
  );
}
