# File & Folder Structure Convention

## Core Rule

Place every file at the **lowest possible level** — directly next to the route/component that uses it. No `src/` directory — everything lives under the repo root, and `@/*` resolves there (see `tsconfig.json`).

## Standard Route Structure (App Router)

Every route lives under `app/[locale]/` because of next-intl's locale-prefixed routing — there is no route directly under `app/` except `api/` (Route Handlers aren't locale-prefixed).

```
app/[locale]/
└── some-route/
    ├── page.tsx             # Route component — default export, Server Component unless it needs "use client"
    ├── layout.tsx           # Nested layout for this route and its children — default export
    ├── loading.tsx          # Suspense fallback shown while page.tsx's data resolves — default export
    ├── error.tsx            # Error boundary — must be a Client Component, default export
    ├── actions.ts           # Server Actions ("use server") for mutations from this route
    ├── consts.ts            # Route-level constants
    ├── types.ts             # Route-level types/interfaces
    ├── hooks/               # Hooks used only by this route
    └── components/          # Components used only by this route
```

## Route Groups & Parallel Routes

Use a `(groupName)` folder to organize routes under a shared layout without affecting the URL path:

```
app/[locale]/
└── (marketing)/
    ├── layout.tsx
    ├── page.tsx             # /[locale]
    └── pricing/
        └── page.tsx         # /[locale]/pricing
```

## Internationalization (next-intl)

```
i18n/
├── routing.ts               # defineRouting: locales (en, uk), default locale
├── navigation.ts            # Locale-aware Link/useRouter/redirect — import from here, not next/link or next/navigation
└── request.ts                # getRequestConfig: loads messages/<locale>.json per request

messages/
├── en.json                  # English message catalog
└── uk.json                  # Ukrainian message catalog

proxy.ts                      # Locale-detection proxy (repo root) — Next.js 16 renamed "middleware" to "proxy"
```

New translation keys go through the `add-translations` skill, which always updates both `en.json` and `uk.json` together.

## API Routes

```
app/
└── api/
    └── some-resource/
        └── route.ts         # Named exports: GET, POST, PUT, DELETE, ...
```

## Reusable / Generic Code

Anything reused across multiple routes lives at the **top-level** shared directories:

```
components/     # Generic UI components: Button, Card, Modal, etc.
hooks/          # Generic hooks reusable across routes
lib/            # Generic non-component logic: helpers, API clients, formatters
types/          # Global/shared TypeScript types
```

## Deciding Where a File Belongs

Ask these questions in order:

1. Is it used by only one component/route? → Place it next to that component/route.
2. Is it used by multiple components within the same route? → Place it at the route level (`./hooks`, `./components`, etc.).
3. Is it truly generic and reusable across the whole app? → Place it in `components/`, `hooks/`, `lib/`, or `types/`.

## Avoid Props Drilling

If logic or data needs to be passed through multiple layers, extract it into a custom hook rather than drilling props. For state shared across many routes, prefer lifting to the nearest common Server Component / layout over introducing a global client store.

## Naming Conventions for Files

- Component files: `PascalCase.tsx` (e.g. `UserCard.tsx`)
- Hook files: `camelCase.ts` starting with `use` (e.g. `useDebounce.ts`)
- Util files: `camelCase.ts` (e.g. `formatDate.ts`)
- Constant files: `consts.ts`
- Server Action files: `actions.ts`
- Route Handler files: `route.ts` (fixed name, required by Next.js)
