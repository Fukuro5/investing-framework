---
name: git-commit
description: >
  Generates a commit message for all current changes, stages them, commits, and pushes.
  USE THIS SKILL whenever the user wants to commit their work, save changes, or says
  anything like "commit this", "commit my changes", "create a commit", "stage and commit",
  "push my changes", or "commit and push". Reads all changes including unstaged, generates
  a message following the project format, waits for approval, then stages, commits, and pushes.
---

# Git Commit Skill

Generates a commit message, gets approval, then stages all changes, commits, and pushes.

---

## Step 1 — Get all current changes

Run:
```bash
git status
git diff HEAD
git rev-parse --abbrev-ref HEAD
```

This captures all changes — both staged and unstaged — relative to the current HEAD.

If there are no changes at all, tell the user and stop.

---

## Step 2 — Generate the commit message

### Format

```
<type>: <what changed>
```

Rules:
- Type is one of: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`, `perf` — pick the most accurate.
- Keep the message concise — one line, imperative mood, no period at the end.
- Describe *what* changed, not *how* — avoid implementation details.
- If the diff spans multiple concerns, pick the most significant one as the type and briefly mention the rest in the description.

### Examples
```
feat: add pricing page and CTA section
fix: correct header overlap on mobile breakpoints
refactor: extract SummaryCard from dashboard page
chore: bump next to 16.2.13
```

---

## Step 3 — Present for approval

Show the generated message and ask for confirmation:

```
Proposed commit message:

  feat: add pricing page and CTA section

Approve, or let me know what to change.
```

Wait for the user to confirm or request changes. If they request changes, regenerate and show again before proceeding.

---

## Step 4 — Stage, commit, and push

Once approved, run in order:

```bash
git add <specific files>
git commit -m "feat: add pricing page and CTA section"
git push -u origin <branch-name>
```

Prefer staging specific files over `git add -A`/`git add .` — check `git status` first and only stage what's actually part of this change. Show each command before running it. Report success or any errors clearly.

If there's no remote configured, skip the push and tell the user the commit was created locally only.

---

## Notes

- Never commit or push without explicit user approval of the message.
- Do not amend previous commits — always create a new commit.
- Do not include `--force` or `--force-with-lease` unless the user explicitly asks.
- If the branch has diverged from remote, report the conflict clearly and stop — do not attempt to resolve it automatically.
