# Interaction terms

Vocabulary for how the user points at things on the canvas.

- **Activated** - the circle or line the user has clicked (or otherwise picked).
  Activating several elements at once (marquee, the Activate toolbar toggle, Ctrl+A) is a
  group activation. Clicking empty canvas or pressing Esc deactivates.
- **Infobox** - the side panel (right on wide screens, bottom sheet on narrow
  ones) that shows the activated element when exactly one is activated:
  an editable name, a type hint (Concept / Relation), the description for a
  circle, and "from -> to" for a line. Hidden when nothing or several are
  activated, and during relation mode.
- **+** - the round button on the activated circle that starts a relation
  from it (the toolbar Connect button does the same). The next circle
  clicked becomes the other end.
- **Relation mode** - the state between pressing + and the next click; a live
  line follows the pointer. Esc, right click or a click elsewhere leaves it.

In code the activated set is `activated` and the CSS class is `.activated`.
