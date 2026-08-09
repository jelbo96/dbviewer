import type { Node } from '@xyflow/react';
import type { ClassData, EntityData, EnumData, GroupData, ShapeData, TableData } from '../../lib/types';

/**
 * React Flow exige que el `data` de un nodo sea indexable por string. En vez de
 * castear en cada componente (`data as unknown as TableData`, que anula la
 * verificación), declaramos aquí el tipo de cada nodo y los componentes reciben
 * su `data` ya tipado.
 */
type Indexable<T> = T & Record<string, unknown>;

/** El canvas guarda el tamaño calculado en `data` para las formas SVG. */
interface Measured {
  _w: number;
  _h: number;
}

export type TableNodeType = Node<Indexable<TableData>, 'table'>;
export type EnumNodeType = Node<Indexable<EnumData>, 'enum'>;
export type EntityNodeType = Node<Indexable<EntityData>, 'entity'>;
export type ClassNodeType = Node<Indexable<ClassData>, 'class'>;
export type ShapeNodeType = Node<Indexable<ShapeData & Measured>, 'shape'>;
export type GroupNodeType = Node<Indexable<GroupData>, 'group'>;

export type DiagramFlowNode =
  | TableNodeType
  | EnumNodeType
  | EntityNodeType
  | ClassNodeType
  | ShapeNodeType
  | GroupNodeType;
