# Core model

Status: v0 implemented: entities, relations; regions, levels, properties UI not yet.
The v0 data shape is `{version: 0, entities: [{id, name, x, y, properties: {}}], relations: [{id, from, to, name, dir}]}`
([task-0002](../../tasks/task-0002.md)). The open points are listed
at the end and tracked in [task-0001](../../tasks/task-0001.md).

## Entity

A term, drawn as a circle. Circles are the main way of
categorising. Entities have children (other circles).

## Relation

A connection between two circles. It symbolises a relation, and
its kind is shown by style: line, arrow, dashed, colour.
Direction is the field `dir`: `"none"` (default, also when missing), `"forward"` (from -> to), `"backward"` (to -> from) or `"both"`; drawn as filled arrowheads at the circle edge. Version stays 0, no migration.

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
