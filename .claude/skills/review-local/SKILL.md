---
name: review-local
description: >
  Reviews code changes in your current local branch compared to the default branch, producing
  a concise summary of findings. USE THIS SKILL whenever the user asks to review their own
  changes, check their branch, do a pre-PR review, or says anything like "review my changes",
  "check my branch", "what did I change", or "is my code ready". Diffs against the default
  branch and outputs a short focused summary — not a line-by-line breakdown. For reviewing
  someone else's PR or an arbitrary remote branch, use `review-remote` instead.
---

# Review Local Skill

Produces a concise pre-PR review of your current branch vs the repo's default branch (typically `main`).

---

## Step 1 — Get the diff

Determine the default branch (`gh repo view --json defaultBranchRef`, fall back to `main` if `gh` isn't available), then run:
```bash
git fetch origin <default-branch>
git diff origin/<default-branch>...HEAD
git diff origin/<default-branch>...HEAD --name-status
```

If the diff is empty, tell the user there are no changes compared to the default branch and stop.

If the diff is very large (500+ lines), note this to the user and focus on the most impactful changes — don't try to cover everything exhaustively.

---

## Step 2 — Review the changes

Read `.claude/skills/shared/references/review-checklist.md` and check the diff against every category in it.

---

## Step 3 — Output the review

Keep it short and actionable. Structure:

```
### 🔍 Review: `<branch-name>`

**Changed:** N files — <one-line description of what the change is about>

**Findings:**
<list only real issues, one sentence each — or "No issues found.">
🔴 bug  🟡 concern  🔵 suggestion

**Overall:**
<one sentence verdict>
```

Group findings loosely by area (bugs first, then conventions) but keep it as a flat list — no subheadings inside findings.

---

## Reference Files

| File | Contents |
|---|---|
| `.claude/skills/shared/references/review-checklist.md` | The bugs/conventions checklist to review the diff against — shared with `review-remote` |

## Notes

- Aim for the whole review to be readable in under a minute.
- If there are zero findings, say "No issues found — looks good to go." Don't pad it.
- Never repeat what the diff already shows — only add insight the user couldn't see themselves.
