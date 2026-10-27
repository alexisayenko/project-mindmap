# AGENTS.md

Mirror of CLAUDE.md - keep identical.

Fast-path context for Claude Code. Full human-oriented docs:
[docs/](docs/). `AGENTS.md` mirrors this file; both are kept in step.

## Purpose

> Help build ontology maps. Terms are circles; circles connect to
> other circles, and the connections are the relations.

Source: Alex's mindgram entry in `project-meta/ideas.md`. Nothing
is decided beyond it; the first product decisions are open
([docs/tasks/task-0001.md](docs/tasks/task-0001.md)).

## Product

mindgram (repo `project-mindmap`, domain mindgram.cc) is a mindmap +
diagram tool for ontology maps (concept map / knowledge graph).
Entities are circles, relations are styled connections between
them, regions are rectangles that hold circles with their children,
and Z levels give drill-down into deeper layers. A 3D graph of all
relations is a later idea. Status: idea / pre-start, no code.
Monetization not decided. Core model:
[docs/product/concepts/core-model.md](docs/product/concepts/core-model.md).

## Tech stack

Not decided (stack, hosting). Technical base to reuse: the genres
map v2 of Electrophone in `/data/alex/project-audioplayer/web/js/`
(`genres-rework.js`, `genre-force-view.js`, `genre-sim.js`,
`genre-radial*.js`, `genre-layout-store.js`, `genre-drill.js`;
vanilla JS, canvas, own force simulation). No code in this repo yet.
CI and deploy are manual; nothing runs on push.

## Working in a shared checkout

Several sessions may work in this one checkout at once:

- Run `git status` first; files already modified or untracked belong
  to other work - never edit, stage or commit them.
- Stage explicit paths only (`git add <file>`), never `git add -A`
  or `git add .`.
- Never `git stash pop` / `apply` blindly - an old, unrelated stash
  may sit in the list.

## Docs change with code

A change that makes a doc wrong fixes that doc in the same commit.
Task-file updates ship with the work they describe
([docs/tasks/README.md](docs/tasks/README.md)).

## Repo

[alexisayenko/project-mindmap](https://github.com/alexisayenko/project-mindmap)
(SSH). Never commit or push unless asked.

## Where to look for more

- [README.md](README.md) - repo entry point + structure
- [docs/README.md](docs/README.md) - docs subtree map
- [docs/product/concepts/core-model.md](docs/product/concepts/core-model.md) - entities, relations, regions, levels
- [docs/product/philosophy.md](docs/product/philosophy.md) - philosophy notes (Alex's words, work in progress)
- [docs/tasks/task-0001.md](docs/tasks/task-0001.md) - concept and data model
- [docs/tech/ci-cd.md](docs/tech/ci-cd.md) - CI/CD playbook (template, unfilled)
