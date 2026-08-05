---
name: add-translations
description: >
  Adds or updates translation keys in `messages/en.json` and `messages/uk.json` (next-intl)
  following the project's key-naming hierarchy. USE THIS SKILL whenever the user asks to add
  translation/i18n keys, internationalize some text, or says "add translations for this",
  "i18n this", "add a key for X". Always adds the key to both locales in the same pass —
  never leaves one locale behind. Often invoked as part of a larger `feature`/`refactor`/
  `bugfix` build rather than standalone.
---

# Add Translations Skill

Adds new translation keys (or reuses existing ones) following the project's next-intl structure. This project supports **English (`en`, default)** and **Ukrainian (`uk`)** — every new key goes into both `messages/en.json` and `messages/uk.json` in the same pass.

---

## Step 1 — Identify the text and its context

What text needs a key, and which route/widget/modal does it belong to? This determines the top-level namespace.

---

## Step 2 — Read the conventions

Read `references/i18n.md` for the key structure, top-level namespace patterns (`[pageName]Page`, `[widgetName]Widget`, `[modalName]Modal`, `common`, `fields`, `errors`), nesting rules (match component hierarchy, keep it shallow), context-based naming (`title`, not `thisIsThePageTitle`), and `useTranslations`/`t.rich` usage.

---

## Step 3 — Check for existing keys first

Look in `messages/en.json` under `common` and `fields` for anything reusable before creating near-duplicate keys (e.g. don't add a new `saveButton` under a route namespace if `common.saveButton` already covers it).

---

## Step 4 — Propose and confirm

For anything beyond a single obvious key, show the proposed key path and both language values before writing:

```
userProfilePage.profileCard.emailLabel:
  en: "Email Address"
  uk: "Електронна адреса"
```

If you can't produce a confident Ukrainian translation (e.g. ambiguous product terminology), propose the English value and flag it for the user to confirm/correct the Ukrainian wording rather than guessing silently.

---

## Step 5 — Insert and wire up

Insert the new key(s) into **both** `messages/en.json` and `messages/uk.json`, preserving existing formatting and nesting — the two files must stay structurally identical (same keys, same nesting, only values differ). Update the component to call `useTranslations('namespace')` (or `getTranslations` outside the component tree) and reference the key by its path. For text with embedded elements (links, emphasis), use `t.rich(...)` rather than interpolating JSX around the translated string.

---

## Notes

- One flat-nested JSON file per locale — never create separate namespace files.
- Never hardcode user-facing strings once a key exists for them.
- Never add a key to one locale file without adding it to the other in the same change — a missing key falls back silently in next-intl and is easy to miss later.
- Adding a third locale is a bigger step (new `messages/<locale>.json` + updating `i18n/routing.ts`'s `locales` array) — that's a deliberate decision, not something to do as a side effect of adding one key.
