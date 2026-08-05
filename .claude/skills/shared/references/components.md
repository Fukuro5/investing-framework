# React Component Principles

## Component Body Order

Always structure component internals in this order:

```tsx
const MyComponent = ({ prop1, prop2 }: IMyComponentProps) => {
  // 1. Library hooks (useRouter, useSearchParams, useState, etc.)
  // 2. Custom app hooks (useDebounce, useMediaQuery, etc.)
  // 3. Local hooks (useState, useRef, useMemo, useCallback, etc.)
  // 4. Derived variables / computed values
  // 5. Event handlers (handleSubmit, handleClose, etc.)
  // 6. JSX return
};
```

## Export Pattern

- **All components, hooks, and utils use named exports:**
  ```tsx
  export const MyComponent = () => { ... }
  export const useMyHook = () => { ... }
  export const formatDate = () => { ... }
  ```
- **Exception — Next.js special files require default export:** `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`. This is a framework requirement, not a style choice:
  ```tsx
  // app/[locale]/some-route/page.tsx
  const SomeRoutePage = () => { ... };
  export default SomeRoutePage;
  ```
  Every other file in the route folder (components, hooks, utils) still uses named exports. Route Handlers (`route.ts`) use named exports too (`GET`, `POST`, ...), never a default export.

## React Patterns

- React 19 functional components and hooks only. No class components.
- Server Components by default — only add `"use client"` where interactivity, state, effects, or browser APIs are actually needed, and keep that boundary as low in the tree as possible.
- Extract reusable logic into custom hooks.
- Extract logic representable as a single feature into its own custom hook.
- One component / util / hook per file.
- Avoid `useEffect` as much as possible. Prefer derived state, event handlers, Server Components, or Server Actions instead.
- Do not use `div` with `role="button"` unless it's a wrapper containing actual `<button>` elements inside.
- Before creating a new component, check `components/` (generic) and the current route's `components/` folder for something that already covers the need — ask the user if it's unclear whether to reuse or extend.
- Keep files under 200 lines. Extract when approaching this limit.

## Navigation

- Use `Link`, `useRouter`, `redirect` from `@/i18n/navigation` — never `next/link`/`next/navigation` directly, and never `react-router-dom` (this project doesn't use it). The `@/i18n/navigation` wrappers keep the current locale prefix on internal links automatically; the plain Next.js versions don't.
- Raw `<a>` is fine only for genuinely external URLs; add `target="_blank" rel="noopener noreferrer"`.

## Modal State Naming

Modal open state must follow this convention:

```tsx
const [isSomeModalOpen, setIsSomeModalOpen] = useState(false);
```

Examples:
- `isConfirmModalOpen` / `setIsConfirmModalOpen`
- `isDeleteUserModalOpen` / `setIsDeleteUserModalOpen`

Never use `showModal`, `modalVisible`, `openModal` or similar — always `is[Name]ModalOpen`.
