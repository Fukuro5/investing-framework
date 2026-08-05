---
name: add-tests
description: >
  Writes Vitest unit and integration tests for utils, hooks, and page/component targets.
  USE THIS SKILL whenever the user asks to write tests, add test coverage, create a
  test file, or says anything like "write tests for X", "add tests to this", "test
  this hook", "test this page", or "cover this with tests". Always reads the target
  file first, proposes test cases, and waits for confirmation before writing.
---

# Tests Skill

Writes Vitest tests following project conventions, based on the type of target being tested.

This project requires a test for every new component, hook, util, Server Action, and Route Handler by default (see CLAUDE.md's Testing section) — this skill is invoked automatically by `add-component`, `extract-hook`, and `feature` as part of building new code, not only when the user explicitly asks for tests.

Run tests with `pnpm test` (single run) or `pnpm test:watch`. Config lives in `vitest.config.ts`/`vitest.setup.ts`.

---

## Step 1 — Identify the target

Read the file to be tested. Determine which category it falls into:

- **Util** — a pure function in `lib/` or a route-level `utils/` folder
- **Hook** — a custom hook (`use*.ts`) anywhere in the project
- **Component / page** — a Server or Client Component under `app/[locale]/**` or `components/`

Also check if a `__tests__/` folder already exists next to the target. If a test file already exists, read it before proposing anything — don't duplicate existing coverage.

---

## Step 2 — Gather context

Read what's needed to understand the target's behavior:

- For **utils** — the function signature, inputs, outputs, and edge cases visible in the code
- For **hooks** — what state it manages, what effects/handlers it exposes, what it returns
- For **components/pages** — the rendered elements (form fields, buttons, labels), any data fetching (note: Server Components that `await` data directly are hard to unit test with RTL — flag this to the user and suggest testing the extracted pure logic instead, or an integration/E2E approach), what user interactions are possible

---

## Step 3 — Propose test cases

Before writing any code, output a proposed test plan. Group by `describe` block. For each test, write one sentence describing what it verifies.

Format example:
```
## Proposed tests for `validateEmail`

### validateEmail
- ✅ returns true for a valid email address
- ✅ returns true for emails with subdomains
- ❌ returns false for missing @ symbol
- ❌ returns false for missing domain
- ❌ returns false for null, undefined, and non-string inputs

Does this look right? Any cases to add or remove?
```

Use ✅ for happy path, ❌ for failure/edge cases, 🔄 for async/loading/state change cases.

Wait for user confirmation before proceeding to Step 4.

---

## Step 4 — Determine test file location

Place the test file in a `__tests__/` folder co-located with the target file:

```
app/[locale]/some-route/
├── page.tsx
└── __tests__/
    └── page.test.tsx

lib/validateEmail/
├── validateEmail.ts
└── __tests__/
    └── validateEmail.test.ts
```

If a `__tests__/` folder already exists at the appropriate level, add the new file there. If the existing structure differs, follow the existing pattern rather than forcing this convention — ask the user if unclear.

---

## Step 5 — Write the tests

Follow the conventions in `references/conventions.md` for the relevant test type.

Output the test file with its full recommended path as a header.

---

## Reference Files

| File | Contents |
|---|---|
| `references/conventions.md` | Test structure, imports, helpers, patterns per test type |
