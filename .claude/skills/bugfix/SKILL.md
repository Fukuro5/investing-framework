---
name: bugfix
description: >
  Fixes a specific bug with a minimal, targeted change — root cause first, no incidental
  refactoring or unrelated cleanup, and a regression test where practical. USE THIS SKILL
  whenever the user reports something broken, asks to fix a bug, or says "this doesn't
  work", "fix this issue", "X is broken when Y". Distinct from `refactor` (no behavior
  change intended) — this skill changes behavior on purpose, as narrowly as possible.
---

# Bugfix Skill

Fixes one specific bug with the smallest change that correctly addresses the root cause — not a refactor wearing a bugfix's name.

---

## Step 1 — Get the bug report

Ask the user to describe the bug directly: expected vs. actual behavior, and how to reproduce it — unless they've already given enough detail to proceed.

---

## Step 2 — Understand and reproduce

Before touching any code:
- What's the exact expected vs. actual behavior?
- What are the reproduction steps / conditions that trigger it?
- Read the relevant code and trace the actual data/control flow that produces the wrong result — don't guess at the cause from the symptom alone.

If reproduction steps are unclear or the bug can't be located from the description + code, ask the user for more detail (a specific input, a screenshot, a console error) rather than guessing.

---

## Step 3 — Identify root cause vs. symptom

Distinguish the actual defect from where its effects show up. A wrong value rendered in a component might originate in a Server Action/Route Handler's response shape, a Server Component's data fetch, or a prop passed down incorrectly — fix where it's actually wrong, not just where it's visible.

If fixing the root cause is significantly larger than patching the symptom (e.g. the real fix is a wider API contract change), surface that tradeoff to the user before proceeding — don't silently pick the narrow patch if the root cause matters.

---

## Step 4 — Propose the fix

Before writing anything, state:
- What the root cause is
- What the fix changes (one or two lines)
- What it deliberately does **not** touch

Skip this confirmation only for a truly trivial, obvious one-line fix.

---

## Step 5 — Apply the fix

Make the smallest change that correctly fixes the root cause. Stay in the files the bug actually touches.

If the fix genuinely requires a new piece (e.g. the correct fix is a new Route Handler/Server Action rather than reusing a broken one, or extracting duplicated broken logic into a shared hook), delegate to the matching action skill (`add-component`, `extract-hook`) rather than hand-rolling it here.

While in the affected code, you may fix other convention violations only if they're on the exact line(s) you're already touching for the bug — anything beyond that is out of scope. Flag it to the user as a follow-up instead of fixing it inline:
> "Noticed `UserCard.tsx` also has an unrelated `any` type a few lines down — want me to fix that too, or leave it for a separate refactor pass?"

---

## Step 6 — Add a regression test

Run the `add-tests` skill to cover the specific scenario that was broken, unless:
- The fix is a trivial typo/config change with no meaningful behavior to test, or
- The user explicitly says to skip it

The regression test should fail against the old code and pass against the fix — that's what makes it a regression test rather than just "a test."

---

## Notes

- **Never let a bugfix become a refactor.** If the surrounding code is genuinely messy, that's `refactor`'s job — note it and move on.
- **Never change behavior "while you're in there"** beyond what the bug report calls for.
- If the same bug pattern appears in multiple places, fix all instances of *this specific bug*, but don't use it as license to refactor everything nearby.
- If root-cause analysis reveals this isn't really a bug (works as designed, or a data issue rather than a code issue), say so rather than forcing a code change.
