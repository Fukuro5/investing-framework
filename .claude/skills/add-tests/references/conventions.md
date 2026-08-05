# Test Conventions

## Imports

Always import from these sources — never deviate:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, renderHook, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
```

Only import what is actually used. `renderHook` and `cleanup` live in `@testing-library/react` directly — no separate `@testing-library/react-hooks` package.

---

## Mocking Fetch / Server Actions

For components/hooks that call a Route Handler via `fetch`, mock `global.fetch` per test rather than hitting the network:

```typescript
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ id: 1 }),
}));
```

For Server Actions (`"use server"` functions imported directly), mock the action module itself with `vi.mock(...)` rather than mocking `fetch` — Server Actions aren't invoked over HTTP in tests.

---

## Cleanup

Always clean up after each test, for both component and hook tests:

```typescript
afterEach(() => {
  cleanup();
});
```

---

## Component / Page Tests

```typescript
const user = userEvent.setup();
render(<SomeComponent />);
```

### Querying elements
Prefer accessible roles and labels. Use test IDs only when a role/label query isn't reliable or practical:

```typescript
// ✅ Preferred
screen.getByRole('button', { name: 'Submit' })
screen.getByLabelText('Email Address')
screen.queryByText("Can't be empty")

// ✅ Acceptable when role/label isn't reliable
screen.getByTestId('submit-button')

// ❌ Avoid
container.querySelector('.submit-btn')
```

### User interactions
Prefer `user.type()` and `user.click()` over `fireEvent`:

```typescript
await user.type(emailInput, 'test@example.com');
await user.click(submitButton);
```

### Async assertions
```typescript
await waitFor(() => {
  expect(screen.queryByText("Can't be empty")).toBeVisible();
});
```

### Test structure
```typescript
describe('<ComponentName>', () => {
  afterEach(() => { cleanup(); });

  it('renders correctly', () => { ... });
  it('is possible to <happy path>', async () => { ... });
  it('is NOT possible to <failure case>', async () => { ... });
  it('should <validation or edge case>', async () => { ... });
});
```

Note: a Server Component that `await`s data directly cannot be rendered synchronously with RTL's `render()`. Test the extracted pure logic (formatting, validation) instead, or mark the async-rendering case as an integration/E2E concern rather than forcing an RTL test onto it.

---

## Hook Tests

```typescript
const { result } = renderHook(() => useMyHook());

expect(result.current).toEqual(expected);
```

Always define the `expected` value as a typed constant before the assertion — don't inline complex objects:

```typescript
const expected: IMyType = { ... };
expect(result.current).toEqual(expected);
```

### Hook test structure
```typescript
afterEach(() => { cleanup(); });

describe('<hookName>', () => {
  it('should return correct value', () => { ... });
});
```

---

## Util Tests

Pure function tests — no async, no mocks, no wrappers needed.

Use `it.each` for testing multiple inputs of the same shape:

```typescript
describe('validateEmail', () => {
  describe('when the email is valid', () => {
    const VALID_EMAILS = ['test@example.com', 'user@sub.domain.com'];

    it.each(VALID_EMAILS)('should return true for: %s', (email) => {
      expect(validateEmail(email)).toBe(true);
    });
  });

  describe('when the email is NOT valid', () => {
    const INVALID_EMAILS = ['joe.doe.com', 'test@', undefined, null, 123];

    it.each(INVALID_EMAILS)('should return false for: %s', (email) => {
      expect(validateEmail(email)).toBe(false);
    });
  });
});
```

### Util test structure
```typescript
import { describe, it, expect } from 'vitest';
import { myUtil } from '../myUtil';

describe('myUtil', () => {
  describe('when <condition>', () => {
    it('should <expected behavior>', () => { ... });
  });
});
```

---

## General Rules

- One `describe` block per logical unit — don't mix unrelated tests in one file
- Test descriptions use plain language: `'should return false for null'`, not `'null case'`
- Never test implementation details — test behavior and output
- Don't assert on class names or Tailwind utility strings
- Keep each test independent — no shared mutable state between tests
- New components, hooks, utils, Server Actions, and Route Handlers all get tests by default in this project — not just utils (see CLAUDE.md's Testing section). Skip only for a trivial one-liner/config change, or when the user explicitly says to skip it.
