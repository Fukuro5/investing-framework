---
name: add-component
description: >
  Creates a new React component (including modals) following project conventions — body
  order, named exports, existing-component reuse, modal state naming, typing, file
  placement, and Tailwind styling. USE THIS SKILL whenever the user asks to add, create,
  or build a single component or modal, e.g. "add a ProfileCard component", "build a
  modal for X", "create a component that shows Y". For a full new route or multi-piece
  feature, use `feature` instead — it calls this skill as part of a larger build.
---

# Add Component Skill

Creates a single component (or modal) following this project's React and styling conventions.

---

## Step 1 — Clarify scope (if not already obvious)

- What does the component render and do? Props it needs?
- Does it hold local state? Any loading/error states to handle?
- Is it a modal? (naming convention applies — see Step 3)
- Server or Client Component? Only add `"use client"` if it genuinely needs state, effects, event handlers, or browser APIs.

Skip this for trivial, fully-specified requests — don't ask when the answer is obvious from context.

---

## Step 2 — Check for existing components first

Scan `components/` (generic) and the current route's local `components/` folder for anything that already covers this need (or part of it) before writing anything new. List what you found and confirm with the user whether to reuse it, e.g.:

> "Found an existing `Card` component that looks close to what you want — reuse and extend it, or build a new one?"

---

## Step 3 — Read the conventions

Read `.claude/skills/shared/references/components.md` for:
- Component body order (library hooks → custom hooks → local hooks → variables → handlers → JSX)
- Named export pattern (default export only applies to Next.js special files — `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` — not this skill's output)
- Navigation rules (`next/link`, `useRouter`/`redirect` from `next/navigation`)
- Modal state naming (`isSomeModalOpen` / `setIsSomeModalOpen`) if this is a modal

Read `.claude/skills/shared/references/styling.md` for Tailwind conventions if the component needs styling.

Read `.claude/skills/shared/references/typescript.md` for props typing (`IComponentNameProps` interface, no `any`, no assertions) and `.claude/skills/shared/references/structure.md` to decide where the file belongs (co-located with the single consumer vs route-level vs fully generic `components/`).

---

## Step 4 — Write the component

Output the component file with its full recommended path as a header. Keep the file under 200 lines — extract sub-components if it grows beyond that.

---

## Step 5 — Write tests

This project requires a test for every new component (see CLAUDE.md's Testing section) — delegate to the `add-tests` skill rather than skipping it or writing tests inline here. Skip only if the component is trivial presentational markup with no logic/conditionals worth testing, or the user explicitly says to skip it.

---

## Notes

- One component per file.
- Default to a Server Component; add `"use client"` only when the component actually needs it, and place that directive as low in the tree as possible.
- If this component turns out to need a new route (`page.tsx`, `layout.tsx`), that's `feature`'s job, not this skill's — flag it to the user rather than scaffolding a route here.
