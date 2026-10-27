# project-mindmap

**mindgram** (domain `mindgram.cc`; working repo name `project-mindmap`)
is a mindmap + diagram tool for quickly building ontology maps
(concept maps, knowledge graphs): entities and the relations
between them.

**Status: v0 canvas implemented** (`web/`: circles, relations, drag, pan, zoom, group selection, rename, delete, concept description, relation names, localStorage autosave, JSON export; regions, levels, properties UI not yet; description is stored as a top-level entity field). Hosting: Cloudflare Workers static assets
(`web/`, `wrangler.jsonc`), domain mindmap.isayenko.net, manual deploy
(`npm run deploy`). Stack and monetization are not decided.

## Concept

Terms are entities, drawn as circles. Circles connect to circles;
a connection is a relation (line, arrow, dashed, different
colours). Rectangular regions hold circles with their children.
Z levels let the map go deeper or up, so details are split into
layers and not all shown at once (semantic zoom / drill-down, like
C4 levels). Later, a 3D graph of all relations, since each circle
has a level coordinate.

## Core model

- **Entity** - a term, drawn as a circle; the main way of
  categorising.
- **Relation** - a connection between two entities; kind shown by
  line style, arrow and colour.
- **Region** - a rectangle that holds circles with their children.
- **Level** - a Z layer; entities can be opened into a deeper
  layer, and the user goes down or up.

Details and open points: [docs/product/concepts/core-model.md](docs/product/concepts/core-model.md).
Philosophy (Alex's notes, in his words): [docs/product/philosophy.md](docs/product/philosophy.md).

## Planned features

- Fast creation of circles and relations (the "quickly" in the goal)
- Relation styles: line, arrow, dashed, colours
- Regions around circles and their children
- Level navigation (drill down / up)
- Lock / unlock of relations (see open questions)
- Later: 3D graph of all relations

## Open questions

- Lock / unlock: locked means moving a parent moves its children;
  unlocked means it does not. Undecided.
- Is visual nesting (circle inside a region) the same thing as
  semantic nesting (circle expands into a layer)?
- Not decided: stack, hosting, monetization.

## Relation to Electrophone's genres diagram

The technical base is the genres map v2 of Electrophone (repo
`project-audioplayer`), screen `#/genres2`, spec
`docs/specs/genres.md` (GEN-097 .. GEN-111). Its code lives in
`/data/alex/project-audioplayer/web/js/`, vanilla JS, no external
graph library:

- `genres-rework.js` - the screen that mounts the views
- `genre-force-view.js` + `genre-sim.js` - force-directed graph on a
  canvas (own simulation: springs, Barnes-Hut repulsion, collision)
- `genre-radial.js` + `genre-radial-view.js` - radial node-link layout
- `genre-layout-store.js`, `genre-layout-io.js` - per-user saved
  circle positions, layout import / export
- `genre-drill.js`, `genre-levels.js` - drill-down and level
  hierarchy
- `genres-v2-adapter.js` - maps the v2 data to what the map reads

What carries over and what is rewritten is for
[task-0001](docs/tasks/task-0001.md) and later tasks to settle.

Source of the idea: `ideas.md` (entry `mindgram`, 2026-10-25) in
`project-meta`.

## Structure

### Top-level layout

Folders sort first (alphabetically), then files — VS Code
default.

```text
project-root/
├── archive/                              # obsolete code + docs (single graveyard)
├── docs/                                 # project-level strategy + documentation
├── scripts/                              # cross-cutting build tooling
├── mobile/                               # mobile app (example name)
├── web/                                  # web app or static site (example name)
├── <shared-infra>/                       # e.g. supabase/, prisma/, infra/
├── AGENTS.md                             # mirror of CLAUDE.md for other agents (kept in step)
├── CLAUDE.md                             # agent-specific guidance (kept in step with AGENTS.md)
├── README.md                             # this file — entry point + structure
└── LICENSE                               # license
```

**Don't pre-create empty folders.** Add a folder on the day a
second code folder, archived artifact, or per-folder doc
actually lands — not before. See
[`docs/README.md#section-file-folder`](docs/README.md#section-file-folder)
for the same rule applied inside `docs/`.

### Naming

| Convention | Example | Why |
| --- | --- | --- |
| `kebab-case.md` for documents | `branding.md`, `task-0001.md` | Reads as prose; case-safe across OSes |
| Lowercase folders | `docs/`, `scripts/`, `archive/` | Matches URL paths; case-safe |
| `UPPERCASE.md` only for conventionally recognized files | `README.md`, `CLAUDE.md`, `AGENTS.md`, `LICENSE`, `CHANGELOG.md` | Don't invent new uppercase files |

Code folders use their natural name (`mobile/`, `web/`,
`workers/`); see [Overview](#overview).

### Infra at root

Folders sit unprefixed at the root when they apply across the
project:

- **`docs/`** — strategy, product, business, brand
- **`scripts/`** — cross-cutting build tooling (e.g. release-note
  fan-out from `docs/` to multiple code folders)
- **`<shared-infra>/`** — shared backend / infrastructure used
  by multiple code folders (e.g. `supabase/`, `prisma/`,
  `infra/`)

If a script or config touches one code folder only, it lives
with that folder, not at root.

### Ad-hoc root files

Some root files are created on demand, not scaffolded:

- `HANDOVER.md` — open work deferred between sessions. Create
  when you have items to defer; delete when they're all resolved.
  Not a living doc.

### Archive

Single root `archive/` folder for obsolete code and docs. A
`docs/` subfolder inside holds obsolete documentation.

```text
archive/
├── docs/                       # obsolete project-level docs
│   └── <old-doc>.md
└── <old-folder>/               # obsolete code (e.g. v1 prototype)
```

A folder belongs in `archive/` when it **no longer ships**.
Before archiving code, extract any worthwhile lessons or
decisions into `archive/docs/` — code in archive rots; docs
survive.

`archive/` doesn't exist by default. Create on first retirement.

## Documentation

See [`docs/README.md`](docs/README.md) for:

- Why this folder is called `docs/` and not `specs/`
- Product overview
- Guiding principle: strategy at root vs per-folder
- Top-level glossary + the four-level chain (concept → feature →
  screen → journey)
- Concerns (`C1, C2, …`) — cross-cutting work axes that span
  sections; catalogued in [`docs/concerns.md`](docs/concerns.md)
- Entry-doc convention (`<section>/README.md` pattern)
- The `docs/` subtree map and what lives where
- The `Section, file, folder` rule (start small, extract on growth)
- Docs change with code (same commit)
- Per-folder `<folder>/docs/` policy
- CI/CD playbook in [`docs/tech/ci-cd.md`](docs/tech/ci-cd.md)
- Multi-product split (rare)

## Design rationale

Why this template is shaped the way it is. It's *more
structured* than industry default for solo-founder projects, but
every choice is a defensible divergence rather than an
anti-pattern.

**Aligned with established best practices:** README.md as folder
entry doc (GitHub auto-renders), kebab-case.md filenames
(case-safe), conventional commits, YAML frontmatter on docs
(Jekyll / Hugo / MkDocs convention), ADRs (Michael Nygard's
spec), glossary-driven vocabulary discipline (Eric Evans' DDD
ubiquitous language), separating product specs from
implementation (clean architecture), atomic commits referencing
tasks.

**Defensible divergences from common defaults:** tasks as
markdown files (instead of Jira / Linear / GitHub Issues —
portable, greppable, git-tracked, AI-readable; cost: harder to
query at scale); the verb / noun split between concepts and
features (this is DDD, rigorously applied); heavy doc
scaffolding upfront (closer to the "docs as first-class
artifact" school — Stripe, Diataxis — than to agile's "defer
docs" tradition).

**Original framings:** `concept = noun`, `feature = verb`,
`screen = place` as a strict three-way taxonomy (DDD-flavored
but specific); concerns axis (`C1, C2, …` — industry
equivalents are epics, OKRs, work-streams); each top-level code
folder named for what it is rather than fitting under a
unifying noun.

Bottom line: nothing here is anti-pattern. Heavyweight for
throwaway experiments; benefit is that a project stays
organized as it grows without needing a mid-life restructure.
