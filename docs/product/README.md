# Product

mindgram is a mindmap + diagram tool for quickly building ontology
maps: entities as circles, relations as styled connections, regions
and Z levels for structure. The tension: a free canvas is fast to
draw on, but a large ontology needs layers, so levels must not cost
the speed.

Purpose: build a concept map / knowledge graph quickly, then go
deeper layer by layer. Core model:
[concepts/core-model.md](concepts/core-model.md).
Philosophy (Alex's notes): [philosophy.md](philosophy.md).

For the wider docs/ map and what-lives-where, see
[`../README.md`](../README.md).

## Folder map

The product subtree (full docs tree in
[`../README.md#subtree-map`](../README.md#subtree-map)):

```text
product/
├── README.md      # this file — core idea + product-section glossary
├── philosophy.md  # Alex's philosophy notes, in his words
├── concepts/      # one file per domain noun — entry: concepts/README.md
└── features/      # one file per product capability — entry: features/README.md
```

## Glossary

Vocabulary for the product section. Domain words ("painting",
"garment", "palette") are *concept names* — they belong in
[`concepts/`](concepts/), not here.

The product taxonomy is a four-level chain — each level composes
the next. See [`../README.md#glossary`](../README.md#glossary)
for the cross-tree index.

- **Concept** — a *noun* in the product vocabulary — a stable
  thing the product reasons about, independent of any UI. One file
  per concept in [`concepts/`](concepts/). Covers data model,
  invariants, edge cases.
- **Feature** — a *verb* — the smallest unit that delivers value
  to the user. One file per feature in [`features/`](features/).
  A feature acts on one or more concepts.
- **Screen** — a *place* — a UI page where features get exposed.
  One file per screen in
  [`../ui-ux/screens/`](../ui-ux/screens/). A single feature can
  appear on multiple screens; a single screen hosts multiple
  features.
- **Journey** — a *sequence* — a path the user takes across
  multiple screens (onboarding, first-add → save, recovery flow).
  Journeys live in
  [`../ui-ux/journeys.md`](../ui-ux/journeys.md) (one section per
  journey, extracts to `journeys/` when they grow). A journey threads
  screens; defined and detailed in
  [`../ui-ux/README.md`](../ui-ux/README.md).
- **Constraint** — a self-imposed product limit ("we won't do X,
  even though we technically could"). Distinct from *compliance*
  (externally imposed; lives in
  [`../business/compliance.md`](../business/compliance.md)).

The chain in one line: **concept = noun, feature = verb,
screen = place, journey = sequence**. If you can phrase the spec
as "the user can [verb]", it's a feature. If it's "the thing
called [noun]", it's a concept. If it's "the page where the user
is when they do it", it's a screen. If it's "the path from one
page to the next", it's a journey.

For **Concerns** — the cross-cutting work-area axis used in task
frontmatter (orthogonal to product sections) — see
[`../concerns.md`](../concerns.md).

## Constraints

Self-imposed product limits — things we won't do even though we
technically could. Externally-imposed obligations (licensing,
compliance, attribution) live in
[`../business/compliance.md`](../business/compliance.md), not here.

- None decided yet (pre-start).
