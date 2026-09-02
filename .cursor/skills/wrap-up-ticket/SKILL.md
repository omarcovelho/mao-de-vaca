---
name: wrap-up-ticket
description: >-
  Verifies the workspace (lint, tests, builds) and commits local changes without
  pushing. Use when the user asks to wrap up a ticket, fechar o ticket, finish
  the ticket, or commit after checks pass.
---

# Wrap Up Ticket

## Hard rules

1. **Never push** — no `git push`, no PR, no remote updates unless the user explicitly asks in a separate message.
2. **Do not commit if checks fail** — fix only if the user asks; otherwise stop and report failures.
3. **Commit is authorized** by this skill when the user asks to wrap up a ticket (treat that as an explicit commit request).

## Workflow

Copy and track:

```
Wrap-up:
- [ ] 1. Inspect git state
- [ ] 2. Run quality checks
- [ ] 3. Commit (no push)
- [ ] 4. Confirm status
```

### 1. Inspect git state

In parallel:

- `git status`
- `git diff` and `git diff --staged`
- `git log -5 --oneline` (match commit message style)

If there is nothing to commit, stop and say so — do not create an empty commit.

Do not commit secrets (`.env`, credentials, etc.). Warn and exclude them if present.

### 2. Run quality checks

From the repo root, run **in order**. Stop on the first failure:

```bash
npm run lint
npm run test
npm run build
```

If server/schema work is in the diff, also run:

```bash
npx prisma validate
```

Report pass/fail briefly. On failure: show the relevant error summary and **do not commit**.

### 3. Commit (no push)

Follow the repo commit protocol:

1. Stage relevant files (`git add` — not secrets).
2. Commit with a concise message via HEREDOC (why over what; match recent style):

```bash
git commit -m "$(cat <<'EOF'
Commit message here.

EOF
)"
```

3. If a pre-commit hook fails: fix the issue and create a **new** commit (do not `--amend` unless the user rules’ amend conditions are all met).
4. **Never** `--no-verify` unless the user explicitly asks.

### 4. Confirm status

Run `git status` after the commit. Tell the user:

- Commit hash / subject
- That checks passed
- That changes are **local only** (not pushed)

## Anti-patterns

- Pushing “to finish” the wrap-up
- Committing with failing lint/test/build
- Skipping checks because the change “looks small”
- Opening a PR as part of wrap-up
