---
name: git-pr
description: >
  Generates a pull request description AND creates the actual PR on GitHub via the `gh` CLI.
  USE THIS SKILL whenever the user asks to write a PR description, create a pull request, open
  a PR, or says anything like "write the PR for this", "create PR description", "help me with
  the PR", "open a pull request", "make a PR", "create the PR". Reads the diff and fills in a
  description, determines the base branch, and always pauses for explicit confirmation before
  pushing and running `gh pr create`.
---

# PR Description & Creation Skill

Generates a ready-to-use PR description, then — once explicitly confirmed — pushes the branch and creates the PR on GitHub with the right base branch.

---

## Step 0 — Check preconditions

Run:
```bash
gh --version
gh auth status
```

If either check fails, tell the user to install/authenticate the GitHub CLI (`gh auth login`). Description-only generation (Steps 1–3) can still proceed without it — PR creation (Step 5 onward) cannot.

---

## Step 1 — Get the diff

Determine the base branch first (Step 2), then:
```bash
git fetch origin <base-branch>
git diff origin/<base-branch>...HEAD
git diff origin/<base-branch>...HEAD --name-status
```

If the diff is empty, tell the user there's nothing to open a PR for.

---

## Step 2 — Determine the base branch

**Default: the repo's default branch (check with `gh repo view --json defaultBranchRef`, typically `main`).** Only deviate when the user says otherwise or there's a clear signal (e.g. current branch was forked off a `release/*` branch instead).

If genuinely ambiguous, ask the user which base branch to use rather than guessing.

---

## Step 3 — Assess complexity

Based on the diff, determine what sections need detail:

**Always include:**
- What changed and why

**Include if relevant:**
- **Testing procedure** — concrete steps if the change involves user-facing interactions, form behavior, API/data fetching, navigation, or anything non-trivial to verify. If purely internal (refactor, types, constants), keep it brief or note "No special testing required."
- **Visual changes** — if components, layout, or Tailwind classes were modified, add: `📸 _Please attach screenshots of the visual changes._`
- **Breaking change** — if the diff changes a route, API contract, or anything that could affect other consumers, add a brief heads-up note.

---

## Step 4 — Build the PR title and description

```markdown
#### What changed:
<what was actually done — key implementation decisions, components added/changed, patterns used>

#### Why:
<clear, concise reason — what problem or requirement this addresses>

#### Testing procedure:
<step-by-step instructions if needed, or "No special testing required" for internal changes>
```

If visual changes were detected, append after the template:
```
📸 _Please attach screenshots of the visual changes._
```

Title: a concise, factual summary of the change (e.g. `Add pricing page and CTA section`).

Language rules:
- Keep language direct and factual — not "I added...", just "Adds...", "Updates...", "Fixes...".
- Testing procedure should be written for a reviewer unfamiliar with the feature — specific enough to actually follow.
- If the diff is very large or spans many unrelated files, note this at the top: `> ⚠️ Large changeset — see individual commits for details.`
- Do not invent details not visible in the diff. If something is unclear, ask the user directly:
  > "What was the goal of this change? I'll use it for the description."

---

## Step 5 — Present the plan for confirmation

Show everything before touching GitHub — never push or create the PR without explicit go-ahead:

```
## Ready to create PR

**Base:** main ← **Head:** feat/pricing-page
**Title:** Add pricing page and CTA section

**Description:**
<full rendered description>

This will:
1. Push `feat/pricing-page` to origin (if not already pushed / if it has new commits)
2. Run `gh pr create` targeting `main` with the description above

Proceed? (yes / change something)
```

If the user has named specific reviewers, include them in the `gh pr create` call; otherwise don't request any — this doesn't assume a fixed reviewer roster.

Wait for explicit confirmation. If the user asks for changes, adjust and show the plan again before proceeding.

---

## Step 6 — Push and create the PR

Once confirmed:

```bash
git push -u origin <branch>   # or `git push` if upstream already set
gh pr create --base <base-branch> --head <branch> --title "<title>" --body "<description>"
```

Add `--reviewer <handles>` only if the user specified reviewers. Add `--draft` only if the user asked for a draft PR.

Report the PR URL that `gh pr create` returns.

---

## Step 7 — Handle an existing PR for this branch

If `gh pr create` errors because a PR already exists for this branch, don't create a duplicate. Offer to update the existing one instead:
```bash
gh pr edit <existing-pr> --title "<title>" --body "<description>"
```
Confirm with the user before editing an existing PR too.

---

## Notes

- Never push or run `gh pr create`/`gh pr edit` without the explicit confirmation from Step 5.
- Never force-push.
- Default to the repo's actual default branch as base — only deviate on a real signal or explicit user instruction.
- If `gh auth status` shows a session for the wrong GitHub account/org, stop and flag it rather than creating the PR under the wrong identity.
