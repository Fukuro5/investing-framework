---
name: feature
description: >
  Scaffold and implement new React features following project-specific principles and structure.
  Use this skill whenever the user asks to create, add, or build a new feature, route, component,
  hook, or any new piece of functionality — including requests like "add a new page for X",
  "create a feature for Y", "build a Z component", or "I need a new screen that does...".
  Always clarify requirements, propose a file structure, and confirm before writing any code.
  For a single, narrowly-scoped piece (just one component), the matching action skill
  (`add-component`, `extract-hook`) can be used directly instead — this skill is for a route
  or multi-piece feature that needs several of them coordinated together.
---

# React Feature Skill

## Workflow

### Step 1 — Clarify the feature

Before proposing anything, ask enough questions to fully understand what needs to be built. Cover:
- What is the purpose and expected behaviour of this feature?
- Does it fetch or mutate any data? If so, from where (external API, a new Route Handler, a Server Action)?
- Does it need a new route (`app/[locale]/**/page.tsx`) or is it a component within an existing route?
- Are there any edge cases, loading states, or error states to handle?
- Are there existing components, hooks, or lib utils that should be reused?

Do not skip this step for anything non-trivial. For very simple, self-explanatory requests a single confirmation is enough.

### Step 2 — Propose file structure

Read `.claude/skills/shared/references/structure.md` before proposing anything.

Based on the answers, propose the file tree for everything that will be created. Only include files that are actually needed — do not over-scaffold.

Always check and flag the following where relevant:
- **Data fetching** — if data is involved, note whether it's a Server Component doing a direct `fetch`/DB call, a new Route Handler (`app/api/*/route.ts`), or a Server Action (`actions.ts`)
- **`consts.ts`** — include if there are any constants (labels, config values, magic strings/numbers)
- **`types.ts`** — include a `types.ts` or note where interfaces should live
- **`loading.tsx` / `error.tsx`** — include if the route has a meaningful loading or error state beyond the default

Format example:
```
## Proposed structure

app/[locale]/dashboard/
├── page.tsx
├── loading.tsx
├── actions.ts
├── consts.ts
├── types.ts
├── hooks/
│   └── useDashboardFilters.ts
└── components/
    └── SummaryCard/
        └── SummaryCard.tsx

Does this structure look right? Any changes before I start?
```

Wait for confirmation before proceeding to Step 3.

### Step 3 — Existing-component check

Before writing any component, hook, or util, proactively scan `components/`, `hooks/`, and `lib/` for anything that already covers part of this feature. Then ask:

> "I found these existing pieces that may apply: `Card`, `useDebounce` — should I use them? Are there any others I should be aware of before I start?"

List all cases upfront in a single message rather than asking one by one.

### Step 4 — Build each piece via its action skill

For every item in the confirmed file structure, delegate to the matching action skill rather than writing it inline — pass along the confirmed structure and requirements already gathered so the action skill doesn't re-ask what's already known:

- New component (with styling) → `add-component`
- New custom hook → `extract-hook`
- New translation keys, if any user-facing text is involved → `add-translations`

`add-component` and `extract-hook` already write tests for what they create — don't duplicate that here. For the thin pieces this skill writes directly (below), also invoke `add-tests` for any that have real logic worth testing (e.g. an `actions.ts` Server Action) — skip only for pure boilerplate like a bare `page.tsx` that just renders other already-tested pieces.

This skill writes the thin/mechanical pieces directly rather than delegating:
- **`types.ts`** — per `.claude/skills/shared/references/typescript.md`
- **`consts.ts`** — extracted magic strings/numbers
- **`page.tsx` / `layout.tsx` / `loading.tsx` / `error.tsx`** — the route's own files (no lazy-loading wrapper or manual route registration needed — the App Router picks these up automatically from the file path)
- **`actions.ts`** — Server Actions for this route's mutations

Write/delegate in an order that resolves dependencies cleanly: types before the code that uses them, the action/handler before the hook or component that calls it, etc.

---

## Reference Files

| File | Contents |
|---|---|
| `.claude/skills/shared/references/structure.md` | Folder layout, file placement rules, naming conventions |
| `.claude/skills/shared/references/typescript.md` | TypeScript strict rules, type patterns, props typing |
