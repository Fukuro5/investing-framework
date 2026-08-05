---
name: resolve-pr-comments
description: >
  Checks a PR's review comments and threads, figures out which are already addressed by
  the current code, applies fixes for the ones that aren't (with confirmation), and
  resolves the corresponding GitHub review threads. USE THIS SKILL whenever the user asks
  to check PR comments, address review feedback, resolve comments, or says things like
  "check my PR comments", "handle the review feedback on #123", "resolve the comments on
  this PR", "did I address everything Copilot/reviewer X flagged". Defaults to the PR for
  the current branch if none is specified. Never marks a thread resolved without the
  underlying feedback actually being addressed, and never pushes code changes without
  explicit confirmation.
---

# Resolve PR Comments Skill

Walks every open review thread on a PR, decides what (if anything) still needs doing, applies confirmed fixes, and resolves the threads that are genuinely addressed.

---

## Step 0 — Check preconditions

Run:
```bash
gh --version
gh auth status
```
If either fails, tell the user to install/authenticate the GitHub CLI (`gh auth login`) and stop — this skill can't function without an authenticated `gh`.

---

## Step 1 — Resolve the target PR

Determine which PR, in priority order:
1. A PR number or URL explicitly given (`#123`, `.../pull/123`)
2. No target given, but the current branch has an open PR — resolve it:
   ```bash
   gh pr view --json number,url,title,headRefName,baseRefName
   ```
3. Neither — ask the user which PR.

Also resolve `owner/repo` for the GraphQL calls in Step 2:
```bash
gh repo view --json owner,name --jq '.owner.login + "/" + .name'
```

---

## Step 2 — Fetch review threads and comments

`gh pr view --json` doesn't expose thread resolution state, so query the GraphQL API directly:

```bash
gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            isOutdated
            path
            line
            comments(first: 50) {
              nodes { id databaseId author { login } body url createdAt }
            }
          }
        }
      }
    }
  }' -f owner=<owner> -f repo=<repo> -F number=<pr-number>
```

Also pull general (non-inline) conversation comments, which can carry actionable feedback too:
```bash
gh pr view <number> --json comments
```

Discard threads where `isResolved: true` — nothing to do there.

---

## Step 3 — Categorize each unresolved thread

For every unresolved thread, read the file at `path`/`line` (current HEAD, not the diff snapshot) to see what the code looks like now, then classify:

- **Already addressed** — the current code already reflects what the comment asked for (e.g. a later commit fixed it, or the reviewer's concern no longer applies).
- **Needs a code change** — still actionable; note the minimal fix.
- **Not actionable** — a question, nitpick the team doesn't enforce, or something the user disagrees with. Don't fix or resolve automatically; surface it for a human call.

If `isOutdated: true`, say so — the diff position may have shifted since the comment was made, so double-check the file manually rather than trusting `line` blindly.

---

## Step 4 — Present the plan for confirmation

Show every unresolved thread and its proposed handling before touching anything:

```
## PR #123 — unresolved comments (4)

1. 🔧 `app/settings/page.tsx:42` (@reviewer) — "missing null check on user.email"
   → Fix: add optional chaining, then resolve

2. ✅ `hooks/useAuth.ts:18` (@reviewer) — "should this use useMemo?"
   → Already addressed in a later commit — resolve as-is, no code change needed

3. 💬 `components/Button.tsx:10` (@reviewer) — "why not use a Tailwind spacing token here?"
   → Not actionable / needs your judgment call — leaving unresolved, flagging only

4. 🔧 `lib/date.ts:5` (@reviewer) — "extract magic number to a constant"
   → Fix: extract to MAX_RETRIES-style named constant, then resolve

Proceed with fixes for 1 and 4, and resolve 1, 2, and 4? (3 stays open for you)
```

Wait for explicit confirmation. Let the user override any classification (e.g. "actually don't fix #4, just resolve it" or "leave #1 unresolved too").

---

## Step 5 — Apply confirmed fixes

For each approved "needs a code change" item, make the minimal, targeted edit — same discipline as the `bugfix` skill: root cause only, no incidental refactoring, no unrelated cleanup. Follow the project's existing patterns in the touched file.

Once edits are made, hand off to the `git-commit` skill to commit and push — don't duplicate its staging/commit/push logic here.

---

## Step 6 — Reply and resolve on GitHub

For each thread confirmed in Step 4:

**Reply** (optional — only when a reply adds value, e.g. explaining a fix or why something wasn't changed):
```bash
gh api repos/<owner>/<repo>/pulls/<number>/comments/<comment-databaseId>/replies -f body="<reply text>"
```

**Resolve:**
```bash
gh api graphql -f query='
  mutation($threadId: ID!) {
    resolveReviewThread(input: { threadId: $threadId }) {
      thread { isResolved }
    }
  }' -f threadId=<thread-id>
```

Only resolve threads whose feedback is genuinely addressed or that the user explicitly told you to close — never resolve to silence a reviewer.

---

## Step 7 — Report

Summarize what happened:
```
✅ Fixed and resolved: #1, #4
✅ Resolved (already addressed, no change needed): #2
💬 Left open for you: #3 — "why not use theme.spacing here?"
```

---

## Notes

- Never resolve a review thread without the underlying feedback actually being addressed, or without the user explicitly overriding that.
- Never push code changes without going through the `git-commit` skill's own confirmation step.
- If the acting user (`gh api user --jq .login`) isn't the PR author, flag it — resolving someone else's PR comments is a valid but less common case, worth a heads-up.
- If a thread's comment author is a bot (e.g. Copilot's automated review), treat its feedback the same as a human reviewer's — categorize on merit, don't auto-dismiss or auto-fix without the Step 4 confirmation.
- If there are zero unresolved threads, say so plainly and stop — don't invent work.
