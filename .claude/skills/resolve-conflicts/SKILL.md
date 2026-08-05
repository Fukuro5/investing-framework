---
name: resolve-conflicts
description: >
  Merges the target branch (usually `main`) into your current branch and resolves any merge
  conflicts that come up, file by file, with confirmation before finalizing. USE THIS SKILL
  whenever the user asks to fix merge conflicts, update their branch with main, sync with the
  target branch, or says things like "resolve conflicts with main", "my PR has conflicts",
  "update my branch", "fix the merge conflicts". Uses `git merge` (never rebase) so it never
  needs a force-push, and never resolves a conflict by blindly preferring one side — each
  one is read for intent before a resolution is proposed.
---

# Resolve Conflicts Skill

Brings your branch up to date with its target branch and walks through any conflicts that surface, one file at a time.

---

## Step 0 — Check the working tree is clean

Run:
```bash
git status
```
If there are uncommitted changes, stop and ask the user whether to commit them first (point to `git-commit`) or stash them (`git stash -u`) before proceeding. Never start a merge on top of unstashed, uncommitted work without asking.

---

## Step 1 — Determine the target branch

Default to the repo's actual default branch (check with `gh repo view --json defaultBranchRef`, typically `main`). Only deviate on a real signal — same approach as `git-pr` Step 2:
- Current branch is `release/*`/`hotfix/*`, or was branched off one
- The user names a specific target branch

If genuinely ambiguous, ask. Otherwise use the default branch silently.

Fetch it fresh:
```bash
git fetch origin <target-branch>
```

---

## Step 2 — Check what's actually incoming

```bash
git log HEAD..origin/<target-branch> --oneline
git diff HEAD...origin/<target-branch> --name-status
```
If there's nothing new on the target branch, tell the user the branch is already up to date and stop.

---

## Step 3 — Run the merge

```bash
git merge origin/<target-branch> --no-edit
```

Deliberately `git merge`, not `git rebase` — a merge is additive and never requires a force-push afterward, whereas a rebase rewrites the branch's existing commits and would need one. Don't switch to rebase unless the user explicitly asks for it, and if they do, flag that it'll require a force-push and get separate confirmation for that per the force-push safety rule.

**No conflicts:** the merge completes on its own. Skip to Step 6.

**Conflicts:** git stops mid-merge. Continue to Step 4.

---

## Step 4 — Resolve each conflicted file

```bash
git diff --name-only --diff-filter=U
```

For each conflicted file, in order:
1. Read the file to see the conflict markers (`<<<<<<< HEAD`, `=======`, `>>>>>>> origin/<target>`) in context.
2. Understand what each side was actually trying to do — check `git log -1 --format=%s origin/<target-branch> -- <file>` and the surrounding code, not just the raw text diff.
3. Propose a resolution that preserves the *intent* of both sides where they don't genuinely conflict (e.g. two unrelated additions to the same function shouldn't become an either/or). Only pick one side outright when the changes are truly mutually exclusive (e.g. both sides renamed the same thing differently).
4. If the conflict involves generated/lock files (`pnpm-lock.yaml`, etc.), regenerate rather than hand-merge: re-run the install command after resolving `package.json`, if any.
5. If intent genuinely can't be determined from the code alone (e.g. two different business-logic decisions on the same branch condition), stop and ask the user rather than guessing — flag it clearly and move on to the next file so one hard case doesn't block the rest.
6. Remove all conflict markers, then stage the file:
   ```bash
   git add <file>
   ```

Show a short summary of each resolution as you go (file, what conflicted, how it was resolved) rather than presenting one wall of text at the end.

---

## Step 5 — Confirm and complete the merge

Once every conflicted file is resolved and staged, show `git status` and a brief recap of all resolutions, then ask for confirmation before finalizing:

```bash
git commit --no-edit
```

If the user wants to back out entirely at any point instead, run `git merge --abort` — never do this unprompted, only on request.

---

## Step 6 — Push

Ask before pushing (same as `git-commit`):
```bash
git push origin <branch-name>
```
Never force-push — a `git merge` resolution never requires it. If push is rejected for a reason other than conflicts (e.g. someone else pushed to the branch meanwhile), stop and report rather than forcing.

---

## Notes

- Never resolve a conflict by reflexively taking "ours" or "theirs" for the whole file — read both sides' intent first.
- Never skip hooks (`--no-verify`) to force a commit through.
- Never rebase or force-push unless the user explicitly asks, and treat that as a separate confirmation from the merge itself.
- If a conflict touches business logic you can't confidently reconcile, stop and ask rather than guessing — a wrong silent resolution is worse than a paused merge.
- If `gh pr view` shows an open PR for this branch, mention afterward that pushing will update it automatically — no separate action needed on GitHub.
