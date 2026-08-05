---
name: refactor
description: >
  Refactor React application code following a strict set of project-specific principles.
  Use this skill whenever the user asks to refactor, clean up, improve, or review React code —
  including components, hooks, utility functions, file structure, state management, or styling.
  Trigger even for partial requests like "clean this up", "this feels messy", "can you improve this",
  or "review this component". Always apply the full checklist and output a review before producing refactored code.
---

# React Refactor Skill

## Workflow

### Step 1 — Clarify scope

Before doing anything, ask:
- Should I refactor the **entire file**, or only a **specific part** you're pointing to?

Do not skip this. Even if the intent seems obvious, always confirm scope explicitly.

### Step 2 — Clarify intent (only if code is unclear)

If the purpose or expected behavior of a component/hook/util is not evident from the code, ask the user to briefly describe what it's supposed to do. Do not ask this for self-explanatory code.

### Step 3 — Pre-refactor review

Review the code against all principles below and output a **review section** before writing any refactored code.

The review must include:

**Principle violations** — every issue found, grouped by category. Each item states: what the issue is, where it is, and what the fix will be.

**Questions** — any ambiguous situations where you should not decide on your own.

Categories to check, and where their rules live:
- TypeScript (`.claude/skills/shared/references/typescript.md`)
- React / Next.js patterns, component body order, Server/Client boundary, navigation (`.claude/skills/shared/references/components.md`)
- Styling & Tailwind (`.claude/skills/shared/references/styling.md`)
- File structure & splitting (`.claude/skills/shared/references/structure.md`)

Format example:
```
## Review

### TypeScript
- [ ] Line 12: `as User` type assertion — will remove and add proper type guard
- [ ] Line 34: implicit `any` in event handler — will type as `React.ChangeEvent<HTMLInputElement>`

### React / Next.js
- [ ] Component body order wrong — hooks declared after variables, will reorder
- [ ] Line 5: `"use client"` at the top of a component that has no interactivity — will remove and push the boundary down to the one child that needs it
- [ ] Line 67: `export default` on a non-page component — will change to named export

### Styling
- [ ] Lines 5–20: inline `style={{ ... }}` — will convert to Tailwind utility classes
- [ ] Line 33: hardcoded `color: #fff` — will replace with a Tailwind utility or `@theme` token

### Questions
- Line 45: storing user preference in localStorage — does this belong there, or should it be a cookie/server-side preference?
```

Wait for user confirmation (and answers to questions) before proceeding to Step 4.

### Step 4 — Propose file split (if needed)

If the refactor results in multiple files (e.g. extracting a hook, splitting a large component), propose the new file tree first and wait for confirmation before writing any code:

```
## Proposed file split

app/[locale]/dashboard/
├── page.tsx
├── hooks/
│   └── useDashboardFilters.ts
└── components/
    └── SummaryCard/
        └── SummaryCard.tsx

Does this structure look right before I start?
```

Skip this step if the refactor stays within the existing file.

### Step 5 — Apply the refactor

For substantial new pieces created as part of this refactor, delegate to the matching action skill instead of writing them inline — pass along the review findings already confirmed so the action skill doesn't re-derive them:
- A component being extracted/split out → `add-component`
- A hook being extracted → `extract-hook`

For in-place fixes that stay within the existing file(s) — type-assertion removal, naming fixes, export-pattern fixes, Server/Client boundary fixes, reordering component body — apply them directly using the relevant reference file for guidance rather than invoking a full action skill for a small edit.

Output each changed/new file separately with its full recommended path as a header. Apply only what was confirmed in Steps 3 and 4.

---

## Reference Files

| File | Contents |
|---|---|
| `.claude/skills/shared/references/structure.md` | Folder layout, file placement rules, naming conventions |
| `.claude/skills/shared/references/components.md` | React/Next.js patterns, component body order, named/default exports, Server/Client boundary, modal naming |
| `.claude/skills/shared/references/styling.md` | Tailwind rules, theme tokens |
| `.claude/skills/shared/references/typescript.md` | TypeScript strict rules, type patterns, props typing, destructuring |
