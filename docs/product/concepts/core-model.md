# Core model

Status: idea. Nothing here is built; the open points are listed
at the end and tracked in [task-0001](../../tasks/task-0001.md).

## Entity

A term, drawn as a circle. Circles are the main way of
categorising. Entities have children (other circles).

## Relation

A connection between two circles. It symbolises a relation, and
its kind is shown by style: line, arrow, dashed, colour.

## Region

A rectangle the user defines. It holds circles together with their
children.

## Level

A Z layer. The user goes deeper or up, so details are split into
layers and not all shown at once (semantic zoom / drill-down, like
C4 levels). Each circle therefore has a level coordinate, which
makes a later 3D graph of all relations possible.

## Open points

- Lock / unlock relations: locked, moving a parent moves its
  children; unlocked, it does not. Undecided.
- Visual nesting (circle inside a region) versus semantic nesting
  (circle expands into a layer): the same thing or not?
