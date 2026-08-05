---
name: git-branch
description: >
  Creates a new git branch from the latest origin/main (or main) based on a short
  description of the work. USE THIS SKILL whenever the user wants to start work on
  something, create a branch, or says anything like "create a branch for X", "start
  a new feature", "new branch", "checkout a branch for this".
---

# Git Branch Skill

Creates a new branch from the up-to-date main branch for a piece of work.

---

## Step 1 — Get the branch topic

The user provides a short description of what they're about to work on ("add pricing page", "fix header layout bug"). If none was given, ask for one.

---

## Step 2 — Determine branch naming format

**Default:**
```
<type>/<short-kebab-slug>
```
where `<type>` is `feat`, `fix`, `chore`, `refactor`, or similar, picked from the nature of the work, and the slug is a 3–5 word summary of the description, lowercased with hyphens.

Example: `feat/pricing-page`, `fix/header-overlap`.

If the user has a different convention in mind, use that instead.

---

## Step 3 — Determine the base branch

Default to `main`. Check the actual default branch rather than assuming, if a remote exists:
```bash
git remote -v
```
If there's a remote, fetch and base off `origin/<default-branch>`. If there's no remote (a solo/local-only repo), base off the local default branch directly.

---

## Step 4 — Fetch and create the branch

If a remote exists:
```bash
git fetch origin <base-branch>
git checkout -b <branch-name> --no-track origin/<base-branch>
```

If there's no remote:
```bash
git checkout -b <branch-name> <base-branch>
```

Show the commands to the user before running them.

If `git fetch` fails (e.g. no network, wrong remote name), report the error clearly and stop.

If the branch already exists locally, warn the user:
> ⚠️ Branch `<branch-name>` already exists locally. Switch to it instead? (yes/no)

If yes, run `git checkout <branch-name>` instead.

---

## Step 5 — Confirm to the user

Show a short summary, e.g.:

> ✅ Created and checked out branch `feat/pricing-page` from `main`.

---

## Notes

- Always base off the latest fetched state of the base branch when a remote exists, to ensure it's up to date.
- Do not push the branch to remote — just create it locally.
- If the user is already on the target branch, just confirm that and do nothing.
