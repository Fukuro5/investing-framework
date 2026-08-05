# Styling Principles (Tailwind CSS v4)

## Core Rules

- Use Tailwind utility classes directly in JSX. No Emotion, styled-components, or SCSS in this project.
- Never hardcode colors, spacing, or font sizes as raw CSS/inline styles — use Tailwind's utility scale, or a token defined in the `@theme` block of `app/globals.css` if the design needs a custom value.
- Tailwind v4 config is CSS-based — there is no `tailwind.config.js`. New design tokens (colors, fonts, etc.) are added as CSS variables inside `@theme` in `app/globals.css`:
  ```css
  @theme inline {
    --color-brand: #4f46e5;
  }
  ```
  Then used as a utility class: `bg-brand`, `text-brand`.

## Conditional Classes

For a small number of conditional classes, a plain template string or ternary is enough:

```tsx
<div className={`rounded-md p-4 ${isActive ? 'bg-brand text-white' : 'bg-gray-100'}`} />
```

Only reach for a merge helper (`clsx`, `tailwind-merge`) once conditions get genuinely complex — that's a new dependency, so ask before adding it.

## Reusable Styles

If the same utility combination is repeated across multiple components, extract a small wrapper component rather than duplicating the class string:

```tsx
interface ICardProps {
  children: React.ReactNode;
}

export const Card = ({ children }: ICardProps) => (
  <div className="rounded-lg border border-gray-200 p-6 shadow-sm">{children}</div>
);
```

## Dark Mode

`app/globals.css` already defines light/dark values via `prefers-color-scheme` and CSS variables (`--background`, `--foreground`). Extend that pattern for new tokens rather than introducing a separate dark-mode utility system.

## Remove Redundant Classes

Don't add a utility class that has no visible effect — e.g. `rounded-none` on an element with no border, or `bg-transparent` when transparent is already the default.
