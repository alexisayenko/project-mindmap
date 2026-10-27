# Interaction terms

Vocabulary for how the user points at things on the canvas.

- **Activated** - the circle or line the user has clicked (or otherwise picked).
  Activating several elements at once (Ctrl/Shift/Alt/Meta+drag marquee, Ctrl+A) is a
  group activation. Activation is cleared only by: a click on empty canvas (pointer
  moved less than 4px between down and up), a right click anywhere on the canvas
  (in relation mode it only cancels the relation), or Esc. Activating another
  circle or line by plain click replaces the activation with that one object;
  Shift/Ctrl/Alt/Meta+click toggles it in the set instead. Dragging never changes
  activation by itself: panning the empty canvas or dragging circles leaves it as is.
- **Infobox** - the side panel (right on wide screens, bottom sheet on narrow
  ones) that shows the activated element when exactly one is activated:
  an editable name, a type hint (Concept / Relation), the description for a
  circle, and "from [direction button] to" for a line. The button shows the current direction as a drawn line symbol (plain line, arrow towards the first, towards the second, or both) and opens a small popover with those four options; it closes on choose, Esc or an outside click. Hidden when nothing or several are
  activated, and during relation mode.
- **+** - the round button on the activated circle that starts a relation
  from it (the only way to start a relation). The next circle
  clicked becomes the other end.
- **Relation mode** - the state between pressing + and the next click; a live
  line follows the pointer. Click another circle relates to it. Click on empty canvas creates a new circle there (default name), relates the source to it, activates it and opens its name editor with the text selected (Enter/blur commits, Esc keeps the default name). Esc, right click or a click on the source circle cancels without creating anything.

In code the activated set is `activated` and the CSS class is `.activated`.

**Semantic zoom.** Default mode is geometric: distances and circle radius scale with zoom `k`, text stays a constant screen size, strokes, arrowheads and `+` constant. A `'constant'` mode (circle size and text near constant, `k^0.25` clamped 0.8x-1.4x) stays available via `ZOOM_MODE`. Below k=0.45 only circles and lines show; from 0.45 names and relation labels; from 1.8 also a short description snippet under the circle. See task-0007.
