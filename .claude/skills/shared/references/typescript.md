# TypeScript Principles

## Strict Rules

- `strict: true` — never use `any`. Prefer actual typing; in rare cases use `unknown` with type guards.
- No type assertions (`as Type`, `!`) unless working with a specific third-party lib that makes it unavoidable.
- Do not add return types — TypeScript infers them. Avoid the extra noise.
- Prefer `interface` over `type` for all new definitions.
- If TypeScript errors are present in the code being written, fix them. Do not leave type errors in output.

## Component Props

Props must be typed with an interface and destructured inline:

```tsx
const Component = ({
  prop1,
  prop2,
}: IComponentNameProps) => { ... }
```

Interface naming: `I` prefix + component name + `Props` suffix — e.g. `IUserCardProps`.

## General Patterns

- Reuse existing types from shared locations (e.g. store types) rather than redefining them.
- Destructure objects when their properties are used frequently:
  ```tsx
  // Instead of repeating user.firstName, user.lastName throughout:
  const { firstName, lastName } = user;
  ```
- No magic strings or numbers — use named constants:
  ```typescript
  const MAX_RETRIES = 3;
  ```

## Code Style

- Always use `const`. Only use `let` when `const` is genuinely impossible.
- Arrow functions for everything: utils, hooks, and components.
- Use early return for conditional logic.
- Do not create unnecessary intermediate variables — use fetched/computed data directly rather than re-assigning it.
- Follow **A/HC/LC naming pattern**: `prefix? + action (A) + high context (HC) + low context? (LC)`
  - Examples: `getUserData`, `isModalOpen`, `handleSubmitForm`, `useAuthUser`
