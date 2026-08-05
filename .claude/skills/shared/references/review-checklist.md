# Review Checklist

Shared checklist used by `review-local` and `review-remote` for their "review the changes" step. This is a **quick sanity check**, not a line-by-line breakdown — Copilot handles inline comments, so focus on things it won't catch.

## Bugs & logic
- Logic errors — off-by-one, wrong conditions, missing edge cases
- Null/undefined access, unhandled errors, incorrect async handling
- Regressions — changes that could break existing functionality outside the diff
- Missing pieces — if ticket/issue context is available, does the implementation cover what was asked?

## Project conventions
Flag any violations of project-specific rules found in the diff:

**TypeScript**
- `any` usage, type assertions (`as Type`, `!`), missing interface for props

**React / Next.js**
- Wrong component body order (library hooks → custom hooks → local hooks → variables → handlers → JSX)
- Default export on a non-page/layout/route-special file (should be named export)
- Class component instead of functional
- `"use client"` added higher in the tree than necessary, or on a component that doesn't actually need it
- `useEffect` used for data fetching where a Server Component or Server Action would do
- Raw `<a>` used for internal navigation instead of `next/link`'s `Link`
- Client-side `fetch`/`axios` call for something that could be a Server Component fetch or Server Action

**Styling**
- Inline styles or hardcoded color/spacing values instead of Tailwind utility classes / `@theme` tokens
- A new CSS-in-JS or SCSS file introduced (this project uses Tailwind only)

**i18n (next-intl)**
- Hardcoded user-facing strings instead of a translation key
- A key added to `messages/en.json` but not `messages/uk.json` (or vice versa)
- `next/link`/`next/navigation` used directly instead of the locale-aware wrappers in `@/i18n/navigation`
- Translation key not following the naming convention (`[pageName]Page`, content-based names like `title` rather than `thisIsTheTitle`)

**Test coverage**
- A new component, hook, util, Server Action, or Route Handler with no accompanying test file — this project requires tests for new code, so flag the gap rather than treating it as optional

## What NOT to flag
- Cosmetic or formatting issues — those are handled by linting and Copilot
