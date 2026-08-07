# Investing Framework

A personal, local-only portfolio tracker: import broker reports, see all positions with allocation/price/P&L in one place, and apply your own configurable rules (allocation bounds, metric thresholds) to flag when a position should be trimmed, sold, or bought more.

See [PLANNING.md](./PLANNING.md) for the full architecture, data model, and roadmap.

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4. See [CLAUDE.md](./CLAUDE.md) for coding conventions.
