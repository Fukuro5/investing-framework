# PLANNING.md — Investing Framework (v3)

Personal, local-only portfolio tracker: import broker reports, see all positions with allocation/price/P&L, and evaluate your portfolio against one or more **frameworks** — named strategies (e.g. "Quality", "Momentum") each made of groups (e.g. Core @ 70%, Convexity @ some other %) with their own metrics and rules — to flag when a position should be trimmed, sold, or bought more. You can switch which framework is active to see how the same portfolio reads under a different strategy. Single user, no auth, runs on your machine.

This doc is the living plan. Update it as decisions change — don't let it drift out of sync with what's actually built.

> **v2 status**: all five Signals phases shipped (framework rule types, thesis, SEC EDGAR checks, AI thesis analysis, signal engine). The v2 plan is archived in full at [docs/PLANNING_V2.md](./docs/PLANNING_V2.md) (v1's plan is further back at [docs/PLANNING_V1.md](./docs/PLANNING_V1.md)) — this file carries forward everything from v2 that's still relevant, plus v2's backlog, as the starting point for v3.

## 1. v3 feature roadmap: Data & Rules Overhaul

The headline goal of v3 is fixing the foundation the Signals feature (v2) sits on: Finnhub's free tier only ever mapped 3 metric keys (`peRatio`, `dividendYield`, `roic`), so most framework rules had to fall back to manual entry — data that's also not always current. v3 replaces the provider, makes the metric catalog explicit and authoritative instead of a freeform hint, drops manual metric maintenance now that the provider can actually cover it, collapses a rule-duplication gap in the framework engine, and closes two real coverage gaps (EUR positions, ADR/20-F filings) that turned out to be partially — not fully — handled already. It's six phases, ordered so each builds on data/infrastructure the previous one creates.

### Phase 1 — Market data provider swap (Finnhub → FMP + Twelve Data)

Two providers, one per concern, rather than one provider trying to do both:

- **Twelve Data** — quotes + FX (`getQuote`/`getFxRate`). Free tier: 800 requests/day, 8/min, real-time + historical for US stocks/ETFs/forex.
- **Financial Modeling Prep (FMP)** — fundamentals (`getMetric`). Free tier: 250 requests/day, end-of-day only, 150+ endpoints covering key metrics/ratios/financial scores — real-time is paid, but end-of-day is fine since Twelve Data already covers live-enough prices.

Both free tiers are comfortably sized for a personal, manual-refresh-only portfolio (no continuous polling either way, same trigger model as today — one click, cached into `PriceSnapshot`/`FxRateSnapshot`/`MetricValue`).

**Composed behind the existing interface, not a new one.** `MarketDataProvider` (`lib/market-data/types.ts`) was already designed for exactly this kind of swap — a new implementation (e.g. `createCompositeProvider`) delegates `getQuote`/`getFxRate` to a Twelve Data client and `getMetric` to an FMP client internally. No interface change, no change to any caller (`refreshMarketData`, `classifyInstruments`, etc.) — only `get-configured-provider.ts` changes which concrete client(s) get wired in.

New env vars: `FMP_API_KEY`, `TWELVE_DATA_API_KEY` (replacing `FINNHUB_API_KEY`). Symbol/ticker-suffix mapping (the equivalent of `finnhub-provider.ts`'s `toFinnhubSymbol` for Freedom Finance's `.US`-suffixed tickers) needs re-confirming per new provider against real data, same "verify empirically" pattern used for both v1's `market_value` field and v2's `.US` suffix handling.

### Phase 2 — Explicit metric catalog

Today, "valid" metric keys are just a hint — `SUGGESTED_METRIC_KEYS` (`lib/metrics/consts.ts`) is UI-suggestion-only, and the rule-creation form accepts any freeform string. A rule can silently reference a `metricKey` the provider will never fill, and there's no way to know what's actually fetchable without reading provider docs.

**Decision**: a curated, code-level catalog of FMP-backed metric keys — the same shape as today's `FLAT_METRIC_FIELDS`/`ANNUAL_SERIES_FIELDS` mapping in `finnhub-provider.ts`, just far bigger since FMP's fundamentals go well beyond Finnhub's 3 fields — becomes the **authoritative** list. It's surfaced as a dropdown/select in rule creation (`app/[locale]/frameworks`) and the metrics page, replacing the freeform text field.

**No new DB table.** FMP has no single "list everything available" discovery endpoint to sync from — the mapping has to be curated by hand regardless (same as Finnhub's was), and a personal single-user app doesn't need catalog history or independent persistence. The catalog is a static export (e.g. `lib/metrics/catalog.ts`). `GroupRule.metricKey` (for `type='metric'`) gets validated against it at creation time, closing the "rule for a metric that will never resolve" gap.

### Phase 3 — Metrics population rework (auto-only)

Manual `MetricValue` entry goes away — every metric value going forward comes from the provider.

- Removes the metrics page's manual-entry form, `upsertManualMetric` (`lib/metrics/upsert-manual-metric.ts`), and its Server Action caller.
- Simplifies `resolveMetricValue` (`lib/metrics/resolve-metric-value.ts`) — the manual-vs-api recency race becomes moot once no new manual rows are ever written. Existing historical manual rows stay in the DB (harmless, not deleted) but are superseded the moment a same-key `api` row exists, same precedence rule as before.
- `refreshMetrics`' existing scoping (`lib/market-data/refresh-market-data.ts` — only fetch metric keys referenced by an active `GroupRule`) already matches what "auto-only, framework-scoped" means; it needs no logic change, only a different provider underneath (Phase 1).
- **Confirmed no carve-out needed**: the one candidate for a provider-less "custom" metric — `convexity`, sitting in `SUGGESTED_METRIC_KEYS` today — turned out to be a leftover copy of a framework *group* name from the docs' own example, not an actual metric anyone rules against. Full auto-only is safe with no exception.

### Phase 4 — Unified group/signal rule type

Today, `role='classification'` and `role='signal'` are separate `GroupRule` rows even when they share a `metricKey` — you have to define group-membership and health-signal thresholds twice for the same metric.

**Decision**: for `type='metric'` rules, the classification/signal role distinction is dropped — every active metric rule in a group's rule set is used for **both** group membership (`classifyInstruments`) and signal severity (`compute-position-signal`'s metric sub-signal) at once, off a single threshold. `type='allocation'` rules are unaffected — they were always signal-only (allocation never decided group membership).

- **Schema**: `GroupRule.role` becomes redundant and is dropped.
- **Migration note**: any group that currently pairs a classification-role rule and a *differently-thresholded* signal-role rule on the same `metricKey` collapses into one threshold on migration — that needs a manual per-rule decision (which threshold to keep, or a middle ground) since the code has no basis to infer which one you'd want.
- **Manual group override, made visible.** No new columns needed — `InstrumentGroupAssignment` already has `source` (`'manual'|'auto'`) and `assignedAt`. Two things get built on top of what exists:
  - A badge + the `assignedAt` date shown wherever group membership appears, for `source='manual'` assignments (functional UI only — the visual design pass is v4's UI revamp, item 8 below).
  - A **"revert to auto"** action per manually-assigned instrument: deletes the manual `InstrumentGroupAssignment` row and immediately re-runs classification for that one instrument (reusing `classifyInstruments`' per-instrument matching logic), landing it in whatever group its current metrics qualify for — or unclassified. This directly answers "let me try auto again," rather than only offering a passive preview.

### Phase 5 — EUR position support (closing a coverage gap, not greenfield)

Investigated and found further along than expected: FX conversion (`getPositions`' `toUsd`, `allocation.ts`) is already currency-generic, not hardcoded to USD-only, despite a stale comment in `lib/dashboard/consts.ts` claiming otherwise. The actual gap is **test coverage, not missing logic** — no EUR *security* position has ever been pushed through the Freedom Finance parser end-to-end (only GBP is verified today); EUR only shows up in fixtures as a cash-balance line, which the import validator currently filters out entirely regardless of currency.

Work:
- Delete the stale "Phase 3" comment in `lib/dashboard/consts.ts`.
- Add a real EUR fixture/test through `map-positions.ts` → `get-positions.ts` proving end-to-end conversion, mirroring the existing GBP case.
- Confirm whether cash balances (any currency, not EUR-specific) being filtered out entirely is intentional-as-is or worth revisiting — pre-existing behavior, not something this phase changes unless you want it to.

### Phase 6 — ADR / foreign-issuer filing verification (closing a coverage gap, not greenfield)

Also further along than expected: v2 Phase 3a's financials-trend check already fully supports 20-F filers end-to-end, proven against real TSMC XBRL data (`compute-financials-trend.test.ts` — IFRS-taxonomy fallback, cross-accession YoY matching, CIK `0001046179`). What's never been exercised against a real 20-F document is v2 Phase 3b (raw filing text) and Phase 4 (AI thesis-vs-filing) — the "check for updates" flow's second half.

Work:
- Add a real 20-F fixture test through `get-filing-text.ts` and `assess-thesis-against-filing.ts` (TSMC or similar) confirming the full flow, not just the XBRL half.
- **Explicitly out of scope**: 40-F (Canadian foreign private issuers) — `TRACKED_FORM_TYPES` (`lib/edgar/consts.ts`) only lists `10-K`/`10-Q`/`20-F`. Adding 40-F is real new work against a filer type/disclosure regime you don't currently hold — revisit only if a Canadian ADR actually enters the portfolio.

### Backlog — deferred to v4 and beyond

- **Auto company suggestion per group (AI-assisted).** Manually invoked, per-group: search for candidate companies matching a group's (now-unified, Phase 4) rules plus qualitative criteria via AI, against whichever provider supports screener-style search. Deferred because that capability needs confirming against the specific provider tier v3 actually ends up running (FMP's screener endpoints may be paid-tier-only), and because it wants Phase 4's unified rule shape to already be live and stable.
- **Full UI revamp.** Deliberately *not* bundled into v3's phases — each v3 phase only adds the minimum functional UI it needs (a metric-catalog dropdown, a manual-override badge + date, a revert-to-auto button), not a redesign. Doing the aesthetic/UX pass after v3's data and logic changes land avoids redesigning the same screens twice as their underlying shapes shift underneath.
- **40-F support** — only if a Canadian ADR is actually held (§1 Phase 6).
- Carried from v2, still unstarted and unrelated to v3's scope: PDF/Excel/XML parsing for Freedom Finance, Interactive Brokers import, remote deployment + auth.
- Carried from v2's "Still open" (all "revisit once real signals are running," untouched by v3): EDGAR financials-trend line-item/threshold tuning, AI thesis-check prompt/model quality tuning, the Health-combination-rule (worst-of-two vs. weighted) tuning.
- **Automated news monitoring for portfolio companies** — flag/surface relevant news per held instrument. Not scoped yet, just captured here — revisit later.

## 2. Tech stack (updates for v3)

| Concern | v2 | v3 | Notes |
|---|---|---|---|
| Market data — prices/FX | Finnhub | **Twelve Data** | Free tier: 800 req/day, 8/min |
| Market data — fundamentals | Finnhub | **FMP** | Free tier: 250 req/day, end-of-day only |

Both sit behind the same `MarketDataProvider` interface as one composite implementation (§1 Phase 1) — everything else in the v2 tech-stack table (§2 of [docs/PLANNING_V2.md](./docs/PLANNING_V2.md)) is unchanged: Next.js 16, React 19, Prisma/SQLite, next-intl, Vitest, Tailwind v4.

## 3. Data model (updates for v3)

- `GroupRule.role` is **removed** — classification and signal are no longer distinguished for `type='metric'` rules; one active rule now drives both (§1 Phase 4).
- No other schema changes this version: the metric catalog is code-level, not a table (§1 Phase 2); the manual-override flag reuses `InstrumentGroupAssignment.source`/`assignedAt`, which already existed (§1 Phase 4); EUR and 20-F work are coverage/test fixes with no schema impact (§1 Phase 5/6).

Everything else in v2's data model (§3 of [docs/PLANNING_V2.md](./docs/PLANNING_V2.md)) — `Broker`/`Account`/`Instrument`/`Transaction`/`PositionSnapshot`/`MetricValue`/`Framework`/`FrameworkGroup`/`InstrumentGroupAssignment`/`Thesis`/`ThesisVerdict` — carries forward unchanged.

## 4. Decisions log (v3 additions)

- **Provider split, not a single richer provider**: Twelve Data (prices/FX) + FMP (metrics), both free tier, composed behind the existing `MarketDataProvider` interface — chosen to keep the app free to run rather than moving to a paid single-vendor plan. Revisit if free-tier limits are actually hit in practice (§1 Phase 1).
- **Metric catalog is a static, curated code mapping**, not a DB table or a live-synced discovery job — FMP has no "list everything" endpoint to sync from, and a personal single-user app doesn't need catalog history (§1 Phase 2).
- **Manual `MetricValue` entry is removed outright**, no carve-out for provider-less metrics — confirmed there isn't actually a real one in use (`convexity` was a framework group name, not a metric) (§1 Phase 3).
- **Classification/signal role distinction dropped for metric rules**: one rule, one threshold, drives both group membership and signal severity. Allocation rules stay implicitly signal-only, unaffected (§1 Phase 4).
- **Manual group override gets an active "revert to auto" action**, not just a passive preview — `InstrumentGroupAssignment` already carried the data (`source`, `assignedAt`) needed to display it; the missing piece was a way to act on it (§1 Phase 4).
- **UI revamp (v2 backlog item) deferred to v4 in full**: v3 adds only the minimal functional UI each phase needs, to avoid redesigning the same screens twice once their data shapes finish changing (§1 backlog).
- **40-F explicitly out of scope** unless a Canadian ADR is actually held — not worth building against a hypothetical (§1 Phase 6).

## 5. Still open

- **Exact FMP field → `metricKey` mapping** for Phase 2's catalog (`roic`, `fcf`, `peRatio`, `dividendYield`, and whatever else current frameworks rule against) — needs picking concrete FMP endpoints/fields once Phase 1's provider is wired up and its free-tier field access is confirmed.
- **Twelve Data / FMP ticker-symbol mapping** (the equivalent of `toFinnhubSymbol`) — needs confirming against real Freedom Finance tickers once Phase 1 starts; unconfirmed until then.
- **Per-rule threshold reconciliation** for any group that currently has both a classification-role and a differently-thresholded signal-role rule on the same metric (§1 Phase 4) — a manual review pass during migration, not something to automate.
- **Whether non-USD cash balances should be surfaced at all** — currently filtered out entirely regardless of currency; not EUR-specific, and out of Phase 5's stated scope unless you want it pulled in (§1 Phase 5).
