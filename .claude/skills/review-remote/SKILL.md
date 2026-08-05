---
name: review-remote
description: >
  Reviews a remote PR or an arbitrary remote branch against the default branch, producing the
  same concise findings summary as `review-local` but for code that isn't your own current
  branch. USE THIS SKILL whenever the user asks to review a teammate's PR, review a specific
  branch or PR number/URL, or says things like "review PR #123", "review origin/some-branch",
  "check this branch before I approve it". Fetches the target, diffs it against the default
  branch, and outputs the same structured findings block. For reviewing your own current
  branch, use `review-local` instead.
---

# Review Remote Skill

Produces the same concise review as `review-local`, but for a PR or branch that isn't the one you're currently on.

---

## Step 1 — Resolve the target

Determine what to review, in priority order:
1. A PR number or URL explicitly given (`#123`, `.../pull/123`)
2. A branch name explicitly given (`some-branch`, `origin/some-branch`)
3. Neither given — ask the user which PR or branch to review.

For a PR: run `gh pr view <number> --json headRefName,baseRefName,title,author` to get its head branch, base branch, title, and author. If `gh` isn't installed/authenticated, tell the user to run `gh auth login` first.

For a bare branch name (no PR): strip a leading `origin/` if the user included one, so `<head-branch>` below is always the short name — Step 2 already prefixes it with `origin/`. Assume the base is the repo's default branch (`origin/main` unless the user says otherwise).

---

## Step 2 — Get the diff

Run:
```bash
git fetch origin main <head-branch>
git diff origin/main...origin/<head-branch>
git diff origin/main...origin/<head-branch> --name-status
```

If reviewing a PR and `gh` is available, `gh pr diff <number>` is a reasonable alternative/cross-check — it also works for PRs from forks where the head branch isn't under `origin/*`.

If the diff is empty, tell the user there are no changes and stop.

If the diff is very large (500+ lines), note this to the user and focus on the most impactful changes — don't try to cover everything exhaustively.

---

## Step 3 — Review the changes

Read `.claude/skills/shared/references/review-checklist.md` and check the diff against every category in it.

---

## Step 4 — Output the review

Keep it short and actionable. Structure:

```
### 🔍 Review: PR #123 — `feat/redesign-settings` (by @author)

**Changed:** N files — <one-line description of what the change is about>

**Findings:**
<list only real issues, one sentence each — or "No issues found.">
🔴 bug  🟡 concern  🔵 suggestion

**Overall:**
<one sentence verdict>
```

If reviewing a bare branch (no PR), use `` `<branch-name>` `` in the header instead of the PR reference.

Group findings loosely by area (bugs first, then conventions) but keep it as a flat list — no subheadings inside findings.

---

## Reference Files

| File | Contents |
|---|---|
| `.claude/skills/shared/references/review-checklist.md` | The bugs/conventions checklist to review the diff against — shared with `review-local` |

## Notes

- This is a read-only review — never push, comment on the PR, or approve/request changes on GitHub unless the user explicitly asks.
- If asked to post the findings as a PR comment, show the exact text and get confirmation first, then use `gh pr comment <number> --body "..."`.
- Aim for the whole review to be readable in under a minute.
- If there are zero findings, say "No issues found — looks good to go." Don't pad it.
- Never repeat what the diff already shows — only add insight the reader couldn't see themselves.
- If `gh api user --jq .login` shows the acting user *is* the PR author, mention it — reviewing your own PR through this skill is fine, but worth flagging since it's a different use case than the norm.
