@AGENTS.md
# CLAUDE.md

## Architecture Overview

Next.js 16 (App Router) + React 19 + TypeScript ~5 marketing app.

### Core Technologies

- **Next.js 16** — App Router, React Server Components by default
- **React 19**
- **TypeScript 5** — `strict: true`
- **Tailwind CSS v4** — CSS-based config (`@theme` in `app/globals.css`), no `tailwind.config.js`
- **next-intl** — i18n routing, messages, and translation hooks (English + Ukrainian — see Internationalization below)
- **Vitest** + **React Testing Library** + **jsdom** — testing (see Testing below)
- **ESLint 9** (flat config, `eslint-config-next`)
- **pnpm** — package manager (`pnpm-workspace.yaml` present)

Not yet in the project — don't assume these exist until they're actually added (ask before installing, per the "Absolute Rules" below):
- No state management library (no Redux/Zustand) — start with local/server state
- No forms library — plain forms / Server Actions until a real form-heavy page needs one

### Project Structure

This project has no `src/` directory — `@/*` resolves to the repo root (see `tsconfig.json`). Every route lives under `app/[locale]/` because of next-intl's locale-prefixed routing (see Internationalization below).

```
app/
├── [locale]/
│   ├── layout.tsx       # Root layout (fonts, html/body shell, NextIntlClientProvider)
│   ├── page.tsx         # Route: /[locale]
│   ├── (group)/         # Route groups for layout-only organization
│   └── some-route/
│       ├── page.tsx     # Route component (default export, Server Component by default)
│       ├── layout.tsx   # Nested layout (default export)
│       ├── loading.tsx  # Suspense fallback (default export)
│       ├── error.tsx    # Error boundary — must be a Client Component (default export)
│       ├── actions.ts   # Server Actions ("use server")
│       └── components/  # Components used only by this route
├── globals.css          # Tailwind import + @theme tokens
└── api/
    └── some-resource/
        └── route.ts     # Route handler (named exports: GET, POST, ...) — not locale-prefixed

i18n/
├── routing.ts           # defineRouting: locales, default locale
├── navigation.ts        # Locale-aware Link/useRouter/redirect wrappers
└── request.ts           # getRequestConfig: loads messages per request

messages/
├── en.json              # English translation catalog
└── uk.json              # Ukrainian translation catalog

proxy.ts                 # next-intl locale-detection proxy (Next.js 16 renamed "middleware" -> "proxy")
components/              # Reusable UI components across routes
hooks/                   # Reusable custom hooks
lib/                     # Non-component logic: helpers, API clients, constants
types/                   # Shared TypeScript types
public/                  # Static assets
```

Place a file at the lowest level that uses it: single-route pieces live in that route's folder; only promote to `components/`, `hooks/`, `lib/` once genuinely reused across routes.

### Key Patterns

- **Rendering**: Server Components by default. Add `"use client"` only at the component that actually needs interactivity/state/browser APIs/hooks — keep the client boundary as small and as low in the tree as possible.
- **Routing**: File-based via the App Router (`app/**/page.tsx`). No manual route registration or lazy-loading wrapper needed — Next.js code-splits per route automatically.
- **Data fetching**: `fetch`/async data access directly in Server Components, or Route Handlers (`app/api/*/route.ts`) for endpoints consumed client-side. Mutations go through Server Actions (`"use server"`) where possible instead of client-side POST calls.
- **Navigation**: `Link`, `useRouter`, `redirect` from `@/i18n/navigation` (not `next/link`/`next/navigation` directly, and not `react-router`) — the locale-aware wrappers keep the current locale prefix on internal links automatically.
- **Styling**: Tailwind utility classes directly in JSX. Design tokens live as CSS variables in `app/globals.css` under `@theme` — extend that block rather than hardcoding colors/spacing inline.
- **Path aliases**: `@/*` maps to the repo root — use it for imports beyond 2 directory levels (`@/components/*`, `@/hooks/*`, `@/lib/*`, `@/types/*`).

### Development Notes

- Env vars: `.env.local` for local secrets; only variables prefixed `NEXT_PUBLIC_` are exposed to the browser — everything else stays server-only.
- Dev server: `pnpm dev`, default port 3000 (no sudo required).
- Linting: ESLint 9 flat config (`eslint.config.mjs`) with `eslint-config-next`. No Stylelint/Husky configured yet.
- `AGENTS.md` at the repo root flags that this Next.js version may differ from training data — confirmed true once already: Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts` (same API, same default export + `config.matcher`). Don't assume a remembered Next.js API/convention still applies without checking — `node_modules/next/dist/docs/` may or may not exist depending on the install; when it's absent, verify behavior by actually running `pnpm build`/`pnpm dev` rather than guessing.

---

## Coding Standards

### Naming

- **Booleans**: question form — `isActiveUser`, `isFetching`, `areFailedTransactionsVisible`
- **Constants**: `CONSTANT_CASE`
- **Handlers**: `handleLogin`, `handleCloseModal`
- **Modals state**: `isSomeModalOpen` / `setIsSomeModalOpen`; component suffix: `LoginModal`
- **Files**: PascalCase components, `types.ts`, `consts.ts`, `actions.ts` (Server Actions), `route.ts` (Route Handlers), `*.test.tsx`
- **One component per file** — extract helper components to their own files

### React

- Component body order: library hooks → custom hooks → local hooks → variables → handlers → JSX
- Named arrow function exports only: `export const Foo = () => { ... }`. Exception: Next.js special files (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`) require `export default`; Route Handlers (`route.ts`) use named exports (`GET`, `POST`, ...) instead
- Pass props explicitly — no spread syntax for known props
- Early return for loading states: `if (isLoading) return <Loader />` (Server Components can instead rely on `loading.tsx` + Suspense)
- Prefer component specialization over complex conditionals
- `useMemo` for expensive calculations; `useCallback` for functions passed as props
- Always provide full dependency arrays
- Define callbacks in component body before `useEffect`; include in deps
- Prefer Server Components + Server Actions over `useEffect`-driven data fetching

### JavaScript / TypeScript

- Arrow functions always; unused args prefixed `_`
- 3+ function args → object parameter
- Early return pattern — no `let` mutation
- Test for true, not false
- Extract magic numbers/strings to named constants in `consts.ts`
- `interface` over `type` for object shapes; props: `IComponentNameProps`
- Optional params go last; `as const` for constant objects/arrays
- No type assertions (`as`) — type at source or use type guards: `(key: string): key is keyof typeof MAP => key in MAP`
- Dictionaries: `as const` + derive union via `(typeof OBJ)[keyof typeof OBJ]`

### Styling (Tailwind)

- Utility classes directly in JSX — no Emotion/styled-components/SCSS.
- Never hardcode colors, spacing, or font sizes — use Tailwind's default scale or a token added to the `@theme` block in `app/globals.css`.
- For conditional classes, keep it to simple template strings/ternaries until the project actually needs a merge helper (`clsx`/`tailwind-merge`) — ask before adding either as a dependency.
- Extract a repeated utility combination into a small wrapper component rather than duplicating a long class string across files.

### Security

- Always wrap `dangerouslySetInnerHTML` with `DOMPurify.sanitize()` (not currently a dependency — ask before adding it if the need comes up).
- Never expose secrets via `NEXT_PUBLIC_`-prefixed env vars.

### Testing

- Stack: **Vitest** + **React Testing Library** + **jsdom**, configured in `vitest.config.ts`/`vitest.setup.ts`. Run with `pnpm test` (single run) or `pnpm test:watch`.
- Arrange–Act–Assert pattern; files: `*.test.ts(x)` or `__tests__/`, co-located with the target.
- **Every new component, hook, util, Server Action, and Route Handler must come with a test file in the same change** — not just on request. A change isn't done until its new/changed piece has coverage; only skip it for a trivial one-line/config change with no meaningful behavior to test, or when the user explicitly says to skip it.

### Internationalization (next-intl)

- Locales: **English (`en`, default)** and **Ukrainian (`uk`)**. Adding a third locale means adding it to `i18n/routing.ts`'s `locales` array and a matching `messages/<locale>.json`.
- Routing is locale-prefixed (`/en/...`, `/uk/...`); `proxy.ts` detects/redirects the bare path to the right locale. Every route lives under `app/[locale]/`.
- Message catalogs: `messages/en.json`, `messages/uk.json` — flat-nested JSON, one file per locale (not split by feature).
- Key structure mirrors the naming convention below: `[pageName]Page`, `[widgetName]Widget`, `[modalName]Modal`, `common`, `fields`, `errors`. Keys are context-based (`title`, `confirmButton`), not content-based (`thisIsTheTitle`).
- Usage: `useTranslations('namespace')` works in both Server and Client Components (no need for the async `getTranslations` unless outside the component tree, e.g. `generateMetadata`). For rich text with embedded elements (links, bold, etc.), use `t.rich(...)` instead of hardcoding JSX around a translated string.
- Never hardcode a new user-facing string — add a key to **both** `en.json` and `uk.json` at the same time.

### API (Route Handlers & Server Actions)

New server-side endpoints go in `app/api/<resource>/route.ts` using named HTTP-method exports:

```ts
// app/api/example-resource/route.ts
export async function GET() {
  const data = await getExampleResource();
  return Response.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const created = await createExampleResource(body);
  return Response.json(created, { status: 201 });
}
```

Prefer a Server Action over a Route Handler when the caller is a form/mutation inside this app itself:

```ts
// app/[locale]/some-route/actions.ts
'use server';

export const createExampleResource = async (data: ICreateExampleRequest) => {
  // ...
};
```

Reach for a Route Handler instead when the endpoint needs to be called from the client, polled, or consumed by something outside this Next.js app.
