---
name: explain
description: >
  Explains any part of the codebase — a file, folder, component, page, hook, service,
  or any logic the user is curious about. USE THIS SKILL whenever the user wants to
  understand code, asks "how does X work", "what does this file do", "explain this
  component", "walk me through this", "what is this hook doing", or points at any
  file or folder and asks what it is. Accepts both file references and natural language
  descriptions. Brief by default, deep on request.
---

# Explain Skill

Explains a piece of the codebase in clear, developer-friendly terms.

---

## Step 1 — Identify what to explain

The user may provide:
- **A file or folder path** — e.g. `src/components/SettingsNavbar.tsx`, `src/hooks/`
- **A natural description** — e.g. "the auth flow", "how routing works", "the investment widget"
- **A mix** — e.g. "explain how this hook works" while referencing a file

### If a path is given:
Read the file(s) directly. For a folder, list its contents first, then read the most relevant files (entry points, index files, main components).

### If a natural description is given:
Use the description to locate the relevant code. Common project locations:

| What | Where |
|---|---|
| Routes (pages, layouts) | `app/[locale]/**/page.tsx`, `app/[locale]/**/layout.tsx` |
| Route Handlers (API endpoints, not locale-prefixed) | `app/api/*/route.ts` |
| Server Actions | `app/[locale]/**/actions.ts` |
| Generic UI components | `components/` |
| Generic hooks | `hooks/` |
| Generic non-component logic | `lib/` |
| Global types | `types/` |
| Theme tokens | `app/globals.css` (`@theme` block) |
| i18n routing/navigation config | `i18n/routing.ts`, `i18n/navigation.ts`, `i18n/request.ts` |
| Translation catalogs | `messages/en.json`, `messages/uk.json` |
| Locale-detection proxy | `proxy.ts` (repo root) |
| Static assets | `public/` |

If the location isn't obvious, search by filename or keyword:
```bash
find . -type f \( -name "*.ts" -o -name "*.tsx" \) | xargs grep -l "<keyword>" 2>/dev/null | head -20
```

If still ambiguous, ask the user to narrow it down or point to a file.

---

## Step 2 — Gather supporting context (as needed)

For a meaningful explanation, you may need to read beyond the target file:
- **Imports** — what dependencies does it rely on?
- **Parent/consumer** — where is this component/function used?
- **Data fetching** — if it's a Server Component that awaits data, or calls a Server Action/Route Handler, read that action/handler to understand what it does and what shape it returns
- **Types** — read referenced interfaces or types if they clarify behavior

Don't over-read. Load only what's needed to explain the target accurately. For large files (300+ lines), focus on the most important sections rather than reading everything.

### If Context7 MCP is connected:
Use it to look up any third-party libraries used in the code (e.g. a Next.js API, a hook's behavior). This helps give accurate explanations of library-specific patterns rather than guessing.

---

## Step 3 — Produce the explanation

### Default (brief):
- **What it is** — one sentence on the role of this code in the project
- **What it does** — the main logic in plain language, 3–6 bullet points
- **Key dependencies** — what it relies on (store, APIs, other components)
- **Where it's used** — briefly, if relevant

### Deep mode (if user asked for detail or follows up with "explain more", "go deeper", "in detail"):
Expand to cover:
- **Data flow** — how data enters, transforms, and exits
- **State & side effects** — what state it manages, what side effects it triggers (API calls, subscriptions, timers)
- **Edge cases & conditionals** — what the branching logic handles
- **Notable patterns** — call out project-specific patterns where relevant:
  - Server vs. Client Component boundary — where `"use client"` starts and why
  - Server Actions vs. Route Handlers for a given mutation/fetch
  - Tailwind utility usage and any `@theme` tokens involved
  - Modal open-state naming (`isSomeModalOpen`)
- **Potential gotchas** — anything non-obvious that could trip someone up

---

## Output format

Use plain prose with light structure. Avoid walls of text — break things up naturally. Code snippets are welcome when they illustrate a point, but keep them short (key lines only, not full file reprints).

Don't start with "This file is..." — lead with what it *does*, not what it *is*.

---

## Notes

- Tailor language to context: if it's a simple utility, keep it brief; if it's a complex orchestration layer, be thorough even in default mode.
- If the user asks about something that spans multiple files (e.g. "the whole auth flow"), give a high-level map first, then offer to go deeper on any specific part.
- Never make up behavior — if something is unclear from the code, say so rather than guessing.
