---
name: extract-hook
description: >
  Creates a custom hook — either by extracting existing logic out of a component, or by
  writing one from scratch as part of a new feature — following the project's hook
  conventions (naming, placement, one hook per file, named export). USE THIS SKILL whenever
  the user asks to extract logic into a hook, pull state/effects out of a component, or
  needs a new custom hook, e.g. "extract this into a hook", "make this a custom hook", "pull
  this logic out". Invoked by `refactor`/`bugfix` (extraction case) and `feature`
  (fresh-creation case) as part of larger builds, or directly for a standalone ask.
---

# Extract Hook Skill

Produces a single custom hook, following project conventions, whether it's pulled out of existing code or written fresh.

---

## Step 1 — Identify the hook's job

**Extracting from existing code:** read the target component and identify the state, effects, and handlers that form one cohesive unit — the part actually being pulled out, not everything in the file.

**Writing fresh (e.g. as part of a new feature):** clarify what state/logic it needs to encapsulate and what it should return, if not already clear from context.

---

## Step 2 — Read the conventions

Read `.claude/skills/shared/references/components.md` for the React-patterns rules that apply to hooks specifically: extract reusable logic into custom hooks, extract anything representable as a single feature into its own hook, avoid `useEffect` where derived state or an event handler would do, one hook per file.

Read `.claude/skills/shared/references/structure.md` for where the hook file belongs (co-located `hooks/` folder next to its single consumer, feature-level `hooks/`, or fully generic `src/hooks/`).

Read `.claude/skills/shared/references/typescript.md` for typing the hook's return shape — an `interface` if it returns an object.

---

## Step 3 — Propose before writing (if non-trivial)

For anything beyond a trivial one-line extraction, confirm before writing:
- Hook name (`useXxx`, camelCase, A/HC/LC pattern)
- What it returns
- Where the file will live

Skip this for simple, obvious extractions.

---

## Step 4 — Write the hook

Output the hook file with its full path as a header. If extracting from an existing component, also output the updated component with the extracted logic replaced by the hook call.

---

## Step 5 — Write tests

This project requires a test for every new hook (see CLAUDE.md's Testing section) — delegate to the `add-tests` skill rather than skipping it. Skip only if the user explicitly says to skip it.

---

## Notes

- Named export only (`export const useXxx = () => { ... }`) — hooks are never default exports.
- If the "hook" is really just a thin wrapper around a single `useState`/`fetch` call with no extra logic, consider whether it's needed at all versus inlining it — ask the user if unsure.
