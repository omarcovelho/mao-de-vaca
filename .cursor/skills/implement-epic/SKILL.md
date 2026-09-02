---
name: implement-epic
description: >-
  Starts MVP epic implementation by creating a dedicated git feature branch
  before any code changes. Use when the user asks to implement, start, build,
  or work on an epic (V0–V9, V2.5), slice, or feature from docs/MVP_EPIC_ROADMAP.md.
---

# Implement Epic

## Hard rule

When the user asks to **implement an epic** (or equivalent: “implementar o épico”, “começar o V3”, “fazer o slice V2.5”, etc.):

1. **Create and check out a new branch first**
2. **Do not write application code or start TDD until the branch exists and you are on it**

## Workflow

1. Ensure the working tree is clean enough (or ask the user about unrelated changes).
2. Create and check out a **new branch** for the epic (from `main`, or `master` if `main` does not exist). Prefer the **Branch sugerida** in [docs/MVP_EPIC_ROADMAP.md](../../../docs/MVP_EPIC_ROADMAP.md) when present; otherwise use a clear `feature/...` name.
3. Confirm with `git branch --show-current`.
4. Then implement the epic following the roadmap, architecture, project definition, and quality-gate / architecture rules.

Do **not** push or open a PR unless the user asks.

## Anti-patterns

- Starting implementation on `main` / `master`
- Skipping branch creation because “it’s a small epic”
- Destructive git commands unless the user explicitly asks
