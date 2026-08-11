# PLANNING.md — Investing Framework (v2)

Personal, local-only portfolio tracker: import broker reports, see all positions with allocation/price/P&L, and evaluate your portfolio against one or more **frameworks** — named strategies (e.g. "Quality", "Momentum") each made of groups (e.g. Core @ 70%, Convexity @ some other %) with their own metrics and rules — to flag when a position should be trimmed, sold, or bought more. You can switch which framework is active to see how the same portfolio reads under a different strategy. Single user, no auth, runs on your machine.

This doc is the living plan. Update it as decisions change — don't let it drift out of sync with what's actually built.

> **v1 status**: Phases 0–5 shipped (foundation, import, dashboard, market data, frameworks, framework rules). The v1 plan is archived in full at [docs/PLANNING_V1.md](./docs/PLANNING_V1.md) — this file carries forward everything from it that's still relevant, plus v1's unfinished Phase 6 work, as the starting point for v2. New v2 scope/decisions get added below as they're defined.

## 1. v2 feature roadmap: Signals

The headline goal of v2 is a **Signals** feature: a per-position suggestion (buy more / trim / sell / hold, roughly) that combines framework rules, a qualitative investment thesis, and the company's latest financial report. It's built in five phases since each later phase depends on data/infrastructure the earlier ones create.

### Phase 1 — Framework rule types (allocation vs. metric)

Rules need to be distinguishable by type so the Phase 5 signal engine can reason about *why* a rule fired. Two rule types, hardcoded as an enum (the types themselves are fixed; individual rule instances stay fully user-managed via the CRUD UI, consistent with v1's "nothing hardcoded" principle for rule content):

- **Allocation rules** — min/max allocation % for a group as a whole, and min/max allocation % for an individual position within that group.
- **Metric rules** — the existing shape (`metricKey`/`operator`/`threshold`, e.g. `roic > 10`).

Decision: unify both into one rules table rather than keeping allocation limits on `FrameworkGroup` (as today) and metric rules in a separate table. A `type` discriminator (`'allocation' | 'metric'`) distinguishes them, so the signal engine has one query path instead of two. This means:
- `FrameworkGroup.targetAllocationMin`/`targetAllocationMax` (existing group-level allocation band) migrates into the unified table as a group-scoped allocation rule, rather than staying a column on `FrameworkGroup`.
- A new position-scoped allocation rule (min/max % for one instrument within a group) is added to the same table.
- Exact column shape (nullable fields for allocation's min/max vs. metric's operator/threshold, how scope — group vs. position — is represented) is a schema-design detail to finalize when this phase starts, not decided yet.

### Phase 2 — Thesis

A **thesis** is free text explaining why you believe a company will go up — one thesis per `Instrument`, shared across all frameworks (a company's bull case doesn't change depending on which strategy lens you're viewing it through). Simple editable text field, stored in a new lightweight model tied to `Instrument`. No versioning/history for now — just a single current thesis per instrument, editable in place.

### Phase 3 — Latest company report parsing (SEC EDGAR) — ambitious, feasibility TBD

Goal: pull each portfolio company's most recent filing from [SEC EDGAR](https://www.sec.gov/edgar), and since filing structure is standardized, parse out the most relevant data and produce a per-company summary. Flagged by you as possibly not realistic — worth a real feasibility discussion (EDGAR's API shape, how consistent filing structure actually is across companies/sectors, what's mechanically extractable vs. what needs a human/AI reading) before this phase gets scoped in detail. Deferred until Phases 1–2 are done.

### Phase 4 — AI thesis-vs-report analysis — most challenging, feasibility TBD

Goal: use AI to compare the Phase 2 thesis against the Phase 3 report summary (or full report) and assess whether the thesis still holds, has partially broken down, or is fully invalidated. Depends entirely on Phase 3 existing first. Also deferred for a real feasibility discussion — likely the highest-uncertainty phase in this whole roadmap.

### Phase 5 — Signal engine

Combines the outputs of the previous phases into one per-position signal, with a visible breakdown of why it fired. Your working draft for the three inputs (not finalized — the combination logic into a single overall signal is still open):

1. **Thesis-based** (Phase 4 output): thesis broken (bad) → partially holding (moderate) → holding strong (good).
2. **Allocation-based** (Phase 1 allocation rules): position over max (trim), position under min (check thesis/metrics), group itself outside its min/max band (check the group's positions for the anomaly).
3. **Metric-based** (Phase 1 metric rules): underperforming on 1–2 metrics (moderate), underperforming on 3+ (bad), performing well (good).

Open question for when this phase is scoped: how the three sub-signals combine into one overall signal (e.g. worst-case wins, weighted, explicit rule matrix), and what "see why" looks like in the UI (most likely a breakdown per input).

### Backlog — carried from v1, not currently scheduled

These were v1's "Phase 6 — Optional/later" and remain unstarted, but sit behind the Signals roadmap above rather than being v2's first phase:

- **PDF/Excel/XML parsing for Freedom Finance** — only if the JSON export proves insufficient.
- **Interactive Brokers import** — CSV export exists; Flex Query automation is the likely path — the `StatementParser` interface (§4) already supports this without redesign.
- **Remote deployment + auth** — only relevant if you want access off your own machine.

## 2. Tech stack (as built)

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 App Router | Server Actions for imports/mutations, Server Components for the dashboard |
| Database | SQLite (single file, zero setup) | Fits local single-user use perfectly |
| ORM | **Prisma** | `prisma/schema.prisma` |
| i18n | next-intl, English + Ukrainian | `[locale]` routing, `messages/en.json` + `messages/uk.json` |
| File parsing | `JSON.parse` for Freedom Finance | `lib/import/parsers` — other formats added per-format behind the same adapter interface, see §4 |
| Market data | **Finnhub** free tier, behind a `MarketDataProvider` interface | `lib/market-data` — see §6 |
| Base currency | **USD** | All allocation %/totals reported in USD; non-USD positions/cash converted at import/refresh time |
| Testing | Vitest + React Testing Library + jsdom | Parsers remain the highest-risk code — keep prioritizing coverage there |
| Styling | Tailwind v4 | No changes needed |

Any new tech for v2 gets proposed for install (and confirmed with you) at the point in the roadmap where it's actually needed, per the project's "ask before installing" rule.

## 3. Data model (as built)

```
Broker            id, name                                         ("Freedom Finance", "Interactive Brokers")
Account           id, brokerId, label, baseCurrency
Instrument        id, ticker, isin, name, assetType, currency, exchange
ImportBatch       id, accountId, fileName, fileType, importedAt, status, rawFileRef
Transaction       id, accountId, instrumentId, importBatchId, type
                  (buy/sell/dividend/fee/tax/deposit/withdrawal),
                  date, quantity, price, fees, currency, brokerRef

PositionSnapshot  id, accountId, instrumentId, importBatchId, asOfDate,
                  quantity, avgCostPrice, marketPrice, marketValue, unrealizedPnl, currency
                  (broker-reported point-in-time holdings — see §4 for why this exists
                  alongside, not instead of, Transaction)

PriceSnapshot     instrumentId, date, price, fetchedAt              (market-data cache)
FxRateSnapshot    baseCurrency, quoteCurrency, date, rate, fetchedAt (FX cache, see §6)
MetricValue       instrumentId, metricKey, value, asOfDate, source ('api'|'manual'), fetchedAt
                  (fcf, roic, peRatio, dividendYield, convexity, ... — one catalog of metrics,
                  shared across frameworks; manual doesn't automatically win — when both a manual
                  and an api row exist for the same instrument+metricKey, whichever has the more
                  recent asOfDate/fetchedAt wins, regardless of source — see §5)

Framework         id, name, description, isActive
FrameworkGroup    id, frameworkId, name, targetAllocationMin, targetAllocationMax, priority
                  ("Core" @ 65–75%, "Convexity" @ ..., priority breaks ties when auto-classifying;
                  a framework's groups' allocation bands must sum to 100%, enforced in the
                  CRUD UI)
GroupRule         id, groupId, metricKey, operator, threshold,
                  role ('classification'|'signal'), isActive
                  (classification rules decide auto-membership; signal rules — same metric
                  catalog, can differ in threshold — decide trim/buy-more/sell/hold once a
                  position is already in the group)

InstrumentGroupAssignment  id, frameworkId, groupId, instrumentId, source ('manual'|'auto'), assignedAt
                  (membership is per-framework: the same instrument can sit in different
                  groups depending on which framework is active; a manual assignment is never
                  overwritten by the auto-classifier)

Signal            id, frameworkId, instrumentId, groupRuleId, evaluatedAt,
                  status (ok/warn/breach), message
                  (insert-only — each evaluation run appends new rows rather than upserting, so
                  you keep a history of how a position's signal changed over time; the dashboard
                  reads the latest row per (frameworkId, instrumentId, groupRuleId))
```

The dashboard's "current positions" prefer the latest `PositionSnapshot` per `(accountId, instrumentId)` when one exists — brokers report this directly and it's authoritative as of that statement's date, so you don't need a complete historical trade log to see accurate current holdings on day one. Where no snapshot has been imported yet (or for periods a broker only gives as a transaction log), positions fall back to being **derived**: aggregating `Transaction` rows per `(accountId, instrumentId)` joined against the latest `PriceSnapshot`. Either way nothing is a mutable "positions" table you write to directly — recompute/prefer-snapshot, don't reconcile.

`ImportBatch` exists so a re-uploaded file is tracked, but dedup itself happens at the transaction level, not the batch level: each `Transaction` carries the broker's stable id (`brokerRef` — `transaction_id` for trades and cash in/outs) and a new row is only inserted if no existing `Transaction` for that account already has that `brokerRef`. This means a statement whose period partially overlaps a previous import still ingests cleanly — only the genuinely-new transactions get inserted, not the whole batch rejected or the whole batch re-inserted.

Any new v2 tables/fields get added here as they're designed, rather than bolted onto the v1 shape without review. Two are already planned but not yet implemented — see §1: a `type` discriminator unifying `GroupRule` (metric rules) with allocation rules (currently split across `FrameworkGroup.targetAllocationMin`/`Max`), and a new `Thesis` model keyed to `Instrument`.

## 4. Broker import pipeline

### Extensibility: one adapter interface, format-agnostic ingestion

Every parser — regardless of broker or file format — implements the same shape:

```ts
interface ParsedStatement {
  broker: 'freedom-finance' | 'interactive-brokers';
  account: { label: string; baseCurrency: string };
  period: { start: Date; end: Date };
  transactions: NormalizedTransaction[];
  positionSnapshots: NormalizedPositionSnapshot[];
}

type StatementParser = (file: Buffer | string) => ParsedStatement;
```

A single, format-agnostic ingestion function takes a `ParsedStatement` and handles validation, de-duplication against existing `ImportBatch`/`Transaction`/`PositionSnapshot` rows, and storage. **Adding a new format (Freedom Excel/XML, IBKR Flex Query, a third broker) means writing one more function matching `StatementParser` — the ingestion, dedup, and storage logic never changes.** The UI's broker/format selector just picks which parser function to call. This is what makes the carried-over IBKR/PDF/Excel/XML work (§1) additive rather than a redesign.

### Freedom Finance (Freedom24) — JSON, shipped in v1

A real (unredacted) sample lives at `fixtures/broker-samples/freedom-finance-2026-07.json` — gitignored, local-only, since it contains your account/email data.

The export is a **period statement** (`date_start`/`date_end`, e.g. one calendar month), not a full historical transaction dump. It contains, per period:

- `account_at_start` / `account_at_end.account.positions_from_ts.ps.acc[]` — a **position snapshot** per instrument at each end of the period (quantity, avg cost, current price, market value, unrealized P&L). This is the primary source for `PositionSnapshot` rows.
- `trades.detailed[]` — individual buy/sell executions within the period: `operation` (`"buy"`/`"sell"`), `p` (execution price), `q` (quantity), `summ` (total consideration), `commission` + `commission_currency`, `curr_c` (trade currency), `date` + `pay_d`, `transaction_id` (stable, used for dedup), `issue_nb`/`isin`, `instr_nm`, `profit`, `fifo_profit`. Maps onto `Transaction` (type = `operation`, price = `p`, quantity = `q`, fees = `commission`, brokerRef = `transaction_id`).
- `cash_in_outs[]` — dividends, fees, deposits/withdrawals: `transaction_id` (dedup), `type_id` (e.g. `"dividend"`), `ticker`, `amount`, `commission`.
- `corporate_actions.detailed[]` — dividend/corporate-action detail with tax fields (`external_tax`, `external_tax_currency`), cross-referenced by `corporate_action_id` to enrich dividend transactions.
- `cash_flows_json[]` / `securities_flows_json[]` — per-currency/per-instrument period aggregates, used only as a reconciliation check.
- Everything else (`off_balance_*`, `ffbo_trades_offsetting`, `in_outs_securities`, etc.) was empty in the sample and/or broker-internal — ignored unless a future sample shows it populated.

Known data quirks (confirmed during v1 build, kept here in case they resurface for new sample files):
- **Inconsistent text encoding** in some localized free-text fields (e.g. mangled double-encoded Ukrainian in `cash_flows.detailed[].type`) while others in the same file are clean. The parser never relies on free-text fields for logic — always the stable machine keys (`type_id`, `operation`, `corporate_action_id`, `ticker`/`isin`).
- **Market-value field ambiguity**: `posval`/`mval` (which move with price) were confirmed as the real live market value vs. `market_value` (a static reference figure) — resolved empirically against real account totals during the Phase 1 build.

### Interactive Brokers — still deferred (§1)

CSV export exists; IBKR also offers Flex Query (a server-side report configured once and pulled by URL). The `StatementParser` interface above means this slots in later as one more parser function without touching ingestion/storage logic.

**Pipeline shape (Freedom Finance JSON only, currently):**
1. Upload file via a form → Server Action.
2. Route to the Freedom Finance JSON `StatementParser` → get back a `ParsedStatement`. (A broker/format selector in the UI is only needed once a second source exists.)
3. Generic ingestion: validate, then store `Transaction` rows keyed by `brokerRef` and `PositionSnapshot` rows for the batch's period.
4. Keep the raw uploaded file referenced (local file storage, not committed to git) for re-parsing if a parser bug is found later.

## 5. Frameworks

A **framework** is a named strategy (e.g. "Quality", "Momentum") made of one or more **groups** (e.g. Core, Convexity), each with a target allocation band and its own metric rules. Only one framework is "active" at a time for the dashboard view, but nothing about switching is destructive — frameworks, groups, and rules are all just data; the underlying transactions/positions never change. Switching frameworks re-runs classification + signal evaluation and re-renders the same positions through the newly active framework's lens.

**Group membership** (which framework-group a position belongs to) supports both mechanisms:
- **Manual** — you assign a position to a group yourself, per framework.
- **Auto (rule-based)** — a group's `classification` rules (e.g. "ROIC > 15% AND FCF > 0") are evaluated against a position's current metric values; if they pass, the position is auto-assigned to that group.
- A manual assignment always wins — the auto-classifier only fills in positions that don't already have a manual assignment for that framework.
- If a position matches more than one group's classification rules, `FrameworkGroup.priority` breaks the tie (lower number = higher priority).
- A position that matches no group's classification rules and has no manual assignment stays unclassified for that framework (shown as such, not silently dropped).

**Group rules** come in two roles, sharing the same metric catalog (`MetricValue.metricKey` — fcf, roic, peRatio, dividendYield, convexity, ...) but potentially different thresholds:
- `classification` rules — decide auto-membership (above).
- `signal` rules — evaluated only for positions already in the group, decide the badge:
  - `trim` — over the group's max allocation, or a signal rule has degraded past threshold.
  - `buy more` — under the group's min allocation and signal rules still pass.
  - `sell` — hard breach on a signal rule (e.g. stop-loss-style).
  - `hold` — no signal rule triggered.

Evaluation runs on demand (after an import, a price/metric refresh, or a framework switch) rather than continuously.

Framework/group/rule definitions are fully user-managed via the CRUD UI (`app/[locale]/frameworks`) — nothing hardcoded. This mechanism is v1-complete.

**Planned for v2 (§1 Phase 1, not yet implemented)**: rules will also carry a `type` discriminator (`'allocation' | 'metric'`) — the two types are hardcoded, but every rule instance within a type stays fully user-managed, same as today. Allocation rules subsume what `FrameworkGroup.targetAllocationMin`/`Max` does today (group-scoped) and add a new position-scoped variant (min/max % for one instrument within a group); metric rules keep their current shape. This is purely about categorizing rules so the Phase 5 signal engine can tell them apart — it doesn't change classification/signal role semantics above.

## 6. Market data integration

### Swappable by design

All price/metric fetching goes through one interface, never a direct Finnhub SDK call from application code:

```ts
interface MarketDataProvider {
  getQuote(ticker: string): Promise<{ price: number; asOf: Date }>;
  getFxRate(base: string, quote: string): Promise<number>;
  getMetric?(ticker: string, metricKey: string): Promise<{ value: number; asOfDate: Date } | null>;
}
```

`lib/market-data` implements this against Finnhub (`FinnhubProvider`). Switching later (rate limits outgrown, better fundamentals needed, going paid) means writing one new class against the same interface and changing which one gets instantiated — nothing that calls `MarketDataProvider` needs to change.

Free-tier reference (as evaluated in v1):

| API | Free tier | Fit |
|---|---|---|
| **Finnhub** (chosen) | ~60 req/min | Best free rate limit for live quotes; decent basic fundamentals |
| Twelve Data | 800 req/day | Good for price, thinner fundamentals |
| Alpha Vantage | Very limited (25 req/day as of recent changes) | Broad data but too rate-limited for regular refresh |
| Financial Modeling Prep | Limited free tier | Better fundamentals depth, worth a look once framework metrics need it |

Given free-tier limits, prices/metrics get fetched on-demand (a "refresh" button) or on a daily cadence, never polled live — `PriceSnapshot`/`MetricValue` act as a cache so the dashboard reads from the DB, not the API, on every page load. Metrics the free API doesn't cover (ROIC especially) fall back entirely to manual `MetricValue` entries; for a metric the API does cover, whichever row — manual or api — has the more recent `asOfDate`/`fetchedAt` is the one used, so a fresher manual correction still overrides a stale api value and vice versa.

Multi-currency: FX conversion to the USD base currency is cached via `FxRateSnapshot`, reusing the same market-data provider.

## 7. Internationalization

next-intl with English + Ukrainian locales, wired up from the start in Phase 0 — `[locale]` routing, `messages/en.json` + `messages/uk.json`. Any new v2 user-facing string gets a key added to both locales in the same change.

## 8. Roadmap

### Completed in v1 (see [docs/PLANNING_V1.md](./docs/PLANNING_V1.md) for full detail)

- **Phase 0 — Foundation**: next-intl setup, Prisma + SQLite schema, `StatementParser`/`ParsedStatement` and `MarketDataProvider` interfaces, base layout/nav shell.
- **Phase 1 — Import**: Freedom Finance JSON parser, generic ingestion → DB.
- **Phase 2 — Dashboard**: positions table with allocation %, current price, unrealized P&L, all in USD.
- **Phase 3 — Market data**: `FinnhubProvider`, price refresh flow, `PriceSnapshot` caching, FX conversion to USD.
- **Phase 4 — Frameworks v1**: Framework/Group CRUD UI, manual group assignment, framework switcher with allocation-vs-target per group.
- **Phase 5 — Framework rules**: metric catalog + `MetricValue` ingestion, `GroupRule` CRUD, auto-classification engine, signal badges (trim/buy-more/sell/hold).

### v2 — Signals (full detail in §1)

- **Phase 1** — Framework rule types: unify allocation rules (group- and position-scoped min/max) and metric rules into one rules table with a `type` discriminator.
- **Phase 2** — Thesis: free-text investment thesis per `Instrument`, shared across frameworks.
- **Phase 3** — SEC EDGAR report parsing: pull + parse each portfolio company's latest filing into a summary. Feasibility TBD.
- **Phase 4** — AI thesis-vs-report analysis: assess whether a thesis still holds against Phase 3's summary. Feasibility TBD, depends on Phase 3.
- **Phase 5** — Signal engine: combine thesis/allocation/metric sub-signals into one per-position signal with a visible breakdown.

Backlog, not currently scheduled (carried from v1's Phase 6, see §1): PDF/Excel/XML parsing for Freedom Finance, Interactive Brokers import, remote deployment + auth.

## 9. Decisions log

Carried over from v1 (still in effect):

- **ORM**: Prisma.
- **Base currency**: USD.
- **Market data**: Finnhub free tier, behind a `MarketDataProvider` interface for easy swapping later.
- **i18n**: next-intl, English + Ukrainian, kept from the start.
- **Frameworks/groups/rules**: fully manageable via the UI (CRUD) — the DB schema is only the foundation, nothing is hardcoded.
- **Group classification tie-breaking**: `FrameworkGroup.priority` (lower wins) when a position matches multiple groups' classification rules.
- **Freedom Finance format**: JSON only; other formats stay possible later behind the same `StatementParser` interface without changing ingestion logic.
- **Interactive Brokers**: still out of scope as of v1 close. The import design doesn't block adding it later — carried to v2 §1.
- **Transaction dedup**: per-transaction via `brokerRef`, not per-batch — a re-uploaded statement with a partially-overlapping period ingests cleanly.
- **Signal history**: `Signal` rows are insert-only — each evaluation run appends rather than overwrites.
- **FrameworkGroup allocation bands**: a framework's groups' target allocation bands must sum to 100%, enforced by the CRUD UI.
- **MetricValue source precedence**: whichever of the manual/api rows for a given instrument+metricKey has the more recent `asOfDate`/`fetchedAt` wins; manual only wins by default when the API doesn't supply that metric at all.

New v2 decisions:

- **Thesis scope**: one thesis per `Instrument`, shared across every framework — not per (Instrument, Framework) pair (§1 Phase 2).
- **Rule type model**: allocation and metric rules unify into one rules table with a `type` discriminator, rather than keeping allocation bounds on `FrameworkGroup` separate from a metric-only rules table (§1 Phase 1).
- **Rule types are hardcoded, rule instances aren't**: `'allocation' | 'metric'` is a fixed enum; individual rules of either type remain fully user-managed via CRUD, consistent with v1's existing "nothing hardcoded" principle for rule content.
- **v2 Phase 6 backlog demoted**: v1's Phase 6 items (IBKR, PDF/Excel/XML parsing, deployment+auth) are *not* v2's Phase 1 — they sit in an unscheduled backlog behind the Signals roadmap (§1, §8).

## 10. Still open

- **Unified rules table schema** (§1 Phase 1): exact column shape — nullable fields for allocation's min/max vs. metric's operator/threshold, how scope (group vs. position) is represented — not decided yet, to finalize when this phase starts.
- **SEC EDGAR feasibility** (§1 Phase 3): API shape, how consistent filing structure actually is across companies/sectors, what's mechanically extractable vs. needs AI/human reading. Needs a dedicated feasibility discussion before this phase is scoped in detail.
- **AI thesis-vs-report analysis feasibility** (§1 Phase 4): depends on Phase 3 landing first; likely the highest-uncertainty phase in the v2 roadmap. Needs its own feasibility discussion.
- **Signal combination logic** (§1 Phase 5): how the three sub-signals (thesis/allocation/metric) combine into one overall signal — draft example levels exist, but no combination rule yet.
- *(v1's one open item — Freedom Finance `market_value` vs `posval`/`mval` field mapping — was resolved during the Phase 1 build; see §4.)*
