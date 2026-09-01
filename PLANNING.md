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

Decision: unify both into one rules table rather than keeping allocation limits on `FrameworkGroup` (as today) and metric rules in a separate table. A `type` discriminator (`'allocation' | 'metric'`) distinguishes them, so the signal engine has one query path instead of two.

**Finalized schema** (extends the existing `GroupRule` model rather than a new one):

```
GroupRule   id, groupId, type ('allocation'|'metric'), role ('classification'|'signal'),
            scope ('group'|'position' — only for type='allocation', null for type='metric'),
            minAllocation, maxAllocation (only for type='allocation', null for type='metric'),
            metricKey, operator, threshold (only for type='metric', null for type='allocation'),
            isActive
```

- `type='allocation', scope='group'` — one required rule per group, replacing `FrameworkGroup.targetAllocationMin`/`targetAllocationMax` entirely (migrated off those columns, not kept alongside them). The "a framework's groups' bands must sum to 100%" check (`validateGroupsTotal`, §9) moves from reading columns to querying each group's `scope='group'` allocation rule.
- `type='allocation', scope='position'` — optional: one uniform min/max band applied to every position currently in that group (e.g. "no position in Core may exceed 15%"). Not a per-instrument override — no `instrumentId` on the rule.
- `type='metric'` — same shape as today (`metricKey`/`operator`/`threshold`), but `role` can now genuinely be `'signal'` as well as `'classification'`: `createRule.ts` currently hardcodes every new rule to `role: "classification"` (signal-role rules were deliberately deferred in v1 — "not enough reliable metric data yet"). Un-deferring that is part of this phase, since Phase 5's metric-based sub-signal needs signal-role rules to evaluate against.
- For `type='allocation'`, `role` is always `'signal'` — allocation never decides group membership, only what happens once a position is already in the group.

### Phase 2 — Thesis

A **thesis** is free text explaining why you believe a company will go up — one thesis per `Instrument`, shared across all frameworks (a company's bull case doesn't change depending on which strategy lens you're viewing it through). Simple editable text field, stored in a new lightweight model tied to `Instrument`. No versioning/history for now — just a single current thesis per instrument, editable in place.

### Phase 3 — SEC EDGAR integration — two separate data paths

Investigated and more feasible than originally feared. [SEC EDGAR](https://www.sec.gov/edgar)'s `data.sec.gov` REST APIs are free, JSON, and need **no API key or auth** — just a descriptive `User-Agent` header (app name + contact email) and staying under 10 requests/sec per IP.

**Trigger model (applies to both sub-parts below): manual, per-company, and new-filing-gated.** Neither check runs automatically or on a schedule — you click a "check for updates" action on a specific position. That action first asks EDGAR whether a filing newer than the last one you checked exists at all (comparing against a small stored pointer — the last-seen filing's date/accession number per instrument, not the filing content itself) — and only does the real fetch/compute work if there's actually something new. A no-new-filing result is cheap and shows "already up to date since your last check."

**3a. Financials trend check (structured/XBRL data)** — a lightweight screening signal, not a deep analysis:
- EDGAR's XBRL APIs (`companyconcept`/`frames`) return clean, standardized GAAP-tagged financial line items per company — no custom parser needed for this part.
- Once a new filing is confirmed (per the trigger model above), pull the current + prior-year-same-period value (YoY, to control for seasonality) for a small fixed set of core line items, and compute **one composite verdict** — e.g. improving / flat / deteriorating — rather than a breakdown of individual metrics. This is deliberately a glance-able flag: if it comes back bad, you go check the filing/EDGAR yourself rather than the app trying to explain why.
  - **Required**: revenue, net income — the check fails (no verdict) if either can't be resolved for the filing.
  - **Best-effort** (included in the vote when a company tags them, silently skipped otherwise): operating income, gross profit, diluted EPS, free cash flow (operating cash flow − capex), and debt-to-equity (a total-liabilities-to-equity proxy — XBRL has no single universal "interest-bearing debt" tag). Debt-to-equity inverts before voting: a *falling* ratio counts as "improving".
  - **Combination**: majority vote across whichever line items resolved (more improving than deteriorating → improving; more deteriorating → deteriorating; tie → flat). This generalizes the original 2-item rule — with exactly 2 items, a majority still requires both to agree.
  - **20-F support**: foreign private issuers filing an annual 20-F (instead of a 10-K, with no 10-Q equivalent — interim reports go out as unstructured 6-Ks) are tracked too. Their XBRL data is commonly IFRS-tagged (`ifrs-full` taxonomy) rather than US-GAAP, and a 20-F's own accession number often doesn't carry a restated prior-year comparative fact the way a 10-K/10-Q does — the YoY pairing logic searches the company's full fact history for the closest matching prior period instead of requiring it to share the current filing's accession number.
- **No raw financials get stored.** The underlying dollar figures are fetched fresh from EDGAR each time and never persisted — only the computed composite verdict is saved, and it slots into the *existing* `MetricValue` table from Phase 1 (a new `metricKey`, e.g. `edgarFinancialsTrend`, with `source: 'api'`) rather than needing a new table. This also means it's usable as an input to Phase 1's metric rules / Phase 5's metric-based sub-signal for free.
- Verdict threshold: ±5% YoY move counts as "moved" at all (below that, a line item is flat).

**3b. Raw filing text for thesis comparison (feeds Phase 4)** — no structured API for this; once a new filing is confirmed, fetch the actual filing document (via the submissions API to find the accession number/document URL), strip HTML to plain text, and hand it to an AI model alongside the thesis. No bespoke section-extraction parser needed — the AI model does that work in Phase 4 rather than a hand-written parser doing it first.

### Phase 4 — AI thesis-vs-report analysis

Goal: send Phase 2's thesis + Phase 3b's raw filing text to an AI model with a prompt, and get back a verdict on whether the thesis still holds, is partially weakening, or is broken — feeding Phase 5's thesis-based sub-signal. Runs as part of the same manual, per-company, new-filing-gated trigger as Phase 3.

**Resolved and implemented**: OpenAI, model `gpt-5.6-luna`, via the official `openai` npm package — `lib/ai/openai-provider.ts` behind a swappable `AiProvider` interface (`lib/ai/types.ts`), mirroring `MarketDataProvider`'s pattern so the provider choice can change later without touching callers. Structured output (`response_format: json_schema`) returns `{ verdict, explanation }` directly — `verdict` is one of `"holding" | "partiallyWeakening" | "broken"`. The check hooks into `checkInstrumentForUpdates` (`lib/edgar/check-instrument-for-updates.ts`) right alongside Phase 3a's financials trend, via `lib/edgar/assess-thesis-against-filing.ts`. It never throws — no thesis yet, a missing `OPENAI_API_KEY`, a failed request, or a malformed response all resolve to a `ThesisCheckResult` value (`skippedNoThesis` / `failed` / `assessed`) rather than an exception, so a failed AI check never blocks the financials trend check or the checked-pointer update that run alongside it. The verdict + explanation are stored in a new `ThesisVerdict` model (upserted per `(instrumentId, accessionNumber)`, one row per checked filing — a free history, unlike `MetricValue` which has no text column for the explanation), read back via `lib/thesis/get-latest-thesis-verdict.ts`.

### Phase 5 — Signal engine

Combines the outputs of the previous phases into one per-position signal, reusing v1's existing `trim`/`buy more`/`sell`/`hold` badge vocabulary rather than inventing new signal types — plus a visible breakdown of why it fired.

**The three inputs sit on two different axes, not one**, which is why they don't combine as a flat worst-of-three vote:

1. **Thesis severity** (Phase 4 output): broken (bad) → partially holding (moderate) → holding strong (good).
2. **Metric severity** (Phase 1 metric rules): underperforming on 3+ metrics (bad), 1–2 (moderate), none (good).
3. **Allocation sizing action** (Phase 1 allocation rules, position-scope): over max, under min, or in-band. This is a *sizing* signal, not a *health* signal — being over-allocated because a position grew is often good news that just needs rebalancing, not a sign something's wrong. The **group-level** allocation case ("the group itself is outside its band") is about the whole group, not one stock — it surfaces as its own flag on the group view and does not feed into any individual position's badge.

**Combination logic (two-layer):**

- **Health** = worst of (thesis severity, metric severity). Either one being bad makes Health bad; both need to be good for Health to be good. (A simple worst-of-two default — could move to a weighted rule later if worst-of-two proves too blunt in practice, but that's a tuning detail, not a blocker.)
- **Final badge** = Health dominates when bad (a broken thesis/metrics means "get out" regardless of current position size); otherwise the badge follows the allocation sizing action:

  | Health \ Allocation | over-allocated | in-band | under-allocated |
  |---|---|---|---|
  | **bad** | Sell | Sell | Sell |
  | **moderate** | Trim | Hold | Hold |
  | **good** | Trim | Hold | Buy more |

**"See why"**: for any badge, show the three raw inputs that fed it — thesis verdict + AI explanation, which metrics are underperforming (if any), and current allocation % vs. the position's band — regardless of which layer (Health or Allocation) actually decided the badge.

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

Any new v2 tables/fields get added here as they're designed, rather than bolted onto the v1 shape without review. These are already planned but not yet implemented — full detail in §1:
- `GroupRule` gains `type` (`'allocation'|'metric'`) and `scope` (`'group'|'position'`, allocation-only) columns; `FrameworkGroup.targetAllocationMin`/`targetAllocationMax` are removed, migrated into `type='allocation', scope='group'` rows.
- A new `Thesis` model keyed to `Instrument` (§1 Phase 2).
- A new `edgarFinancialsTrend`-style `metricKey` flows through the existing `MetricValue` table (§1 Phase 3a) — no new table; only the computed composite verdict is stored, never the underlying financial figures.
- **Resolved and implemented** (§1 Phase 4): a new `ThesisVerdict` model — `id, instrumentId, verdict ('holding'|'partiallyWeakening'|'broken'), explanation, accessionNumber, asOfDate, fetchedAt`, unique on `(instrumentId, accessionNumber)` — rather than reusing `MetricValue`, since the AI verdict needs a free-text explanation column that `MetricValue` (a bare `Float`) has no room for. Upserted per checked filing, so history accumulates naturally instead of being insert-only or single-row.
- A small new pointer per `Instrument` tracking the last-checked EDGAR filing (date/accession number only) so the manual "check for updates" action (§1 Phase 3) can cheaply tell whether there's anything new before doing real work. **Resolved and implemented**: `edgarCik`, `lastCheckedFilingDate`, `lastCheckedAccessionNumber` — nullable columns directly on `Instrument`, not a separate table. `edgarCik` is resolved once via SEC's public ticker→CIK file and cached there permanently.

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

**Planned for v2 (§1 Phase 1, finalized schema, not yet implemented)**: `GroupRule` gains a `type` discriminator (`'allocation' | 'metric'`) plus a `scope` field (`'group' | 'position'`, allocation-only) — the type/scope values themselves are hardcoded, but every rule instance stays fully user-managed via CRUD, same as today. `FrameworkGroup.targetAllocationMin`/`Max` are removed and become each group's required `type='allocation', scope='group'` rule; a new optional `type='allocation', scope='position'` rule adds a uniform min/max band applied to every position in the group (not a per-instrument override). Metric rules keep their current shape, but signal-role metric rules (currently hardcoded off in `createRule.ts`) get un-deferred as part of this phase, since Phase 5 needs them.

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
- **Phase 3** — SEC EDGAR integration: a manual, per-position, new-filing-gated check with two parts — a structured-data financials trend verdict (3a), and raw filing text for Phase 4 (3b). Feasible; see §1 for the researched details.
- **Phase 4** — AI thesis-vs-report analysis: assess whether a thesis still holds against Phase 3b's filing text. Implemented with OpenAI (`gpt-5.6-luna`) behind a swappable `AiProvider` interface; see §1 for details.
- **Phase 5** — Signal engine: Health (worst of thesis/metric severity) × allocation sizing action → final trim/buy-more/sell/hold badge via a decision matrix, plus a per-input "why" breakdown. Group-level allocation anomalies surface separately, not folded into position badges.

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

- **SEC EDGAR access**: `data.sec.gov` REST APIs, no API key — just a descriptive `User-Agent` header and staying under 10 req/sec (§1 Phase 3).
- **EDGAR checks are manual and new-filing-gated**: no scheduled/automatic polling. Triggered per-company by the user; the action first checks whether a newer filing exists than the last one checked (via a small stored pointer — date/accession number only) before doing any real fetch/compute work (§1 Phase 3).
- **Financials trend verdict is a single composite, not per-metric**: one improving/flat/deteriorating flag from a small fixed set of core line items (revenue and net income required; operating income, gross profit, diluted EPS, free cash flow, and debt-to-equity as best-effort additions to a majority vote) — not a breakdown of individual growth metrics. If it's bad, the follow-up is manual (you check the filing yourself), not a deeper automated diagnosis (§1 Phase 3a).
- **No raw financials storage**: EDGAR's underlying dollar figures are never persisted — only the computed composite verdict is stored, reusing the existing `MetricValue` table/mechanism from Phase 1 rather than a new table (§1 Phase 3a).
- **AI provider/model for Phase 4 resolved**: OpenAI, model `gpt-5.6-luna`, via the official `openai` npm package — chosen once Phase 4 actually started, per the plan to revisit then (§1 Phase 4).
- **AI thesis check never throws**: every failure mode (no thesis yet, missing `OPENAI_API_KEY`, request failure, malformed response) resolves to a `ThesisCheckResult` value rather than an exception, so it can run alongside Phase 3a's financials trend inside `checkInstrumentForUpdates` without one blocking the other — a failed/skipped AI check is not a reason to withhold the financials trend or avoid advancing the checked-filing pointer (§1 Phase 4).
- **Thesis verdict storage**: a new `ThesisVerdict` model, upserted per `(instrumentId, accessionNumber)` rather than reusing `MetricValue` — the AI verdict needs a free-text explanation column that `MetricValue`'s bare `Float` has no room for; upserting per filing (not per date) gives a natural history for Phase 5's "see why" breakdown (§1 Phase 4, §3).
- **Thesis scope**: one thesis per `Instrument`, shared across every framework — not per (Instrument, Framework) pair (§1 Phase 2).
- **Rule type model**: allocation and metric rules unify into one rules table with a `type` discriminator, rather than keeping allocation bounds on `FrameworkGroup` separate from a metric-only rules table (§1 Phase 1).
- **Rule types are hardcoded, rule instances aren't**: `'allocation' | 'metric'` is a fixed enum; individual rules of either type remain fully user-managed via CRUD, consistent with v1's existing "nothing hardcoded" principle for rule content.
- **Position-scoped allocation rule = uniform band, not a per-instrument override**: `type='allocation', scope='position'` applies the same min/max to every position in a group (e.g. "no position in Core may exceed 15%") — no `instrumentId` on the rule. A per-stock exception isn't in scope for Phase 1.
- **Group-level allocation bands fully migrate off `FrameworkGroup`**: `targetAllocationMin`/`targetAllocationMax` columns are removed, not kept alongside the new rules table — one query path for allocation info, at the cost of updating `get-group-allocations.ts`/`validate-groups-total.ts`/group CRUD to read from `GroupRule` instead of columns.
- **Signal combination is two-layer, not flat worst-of-three**: thesis and metric severity combine into one Health score (worst of the two); Health then dominates the final badge when bad, otherwise the badge follows the allocation sizing action via a decision matrix — because allocation is a sizing signal, not a health signal, and treating "over-allocated because it grew" the same as a fundamental problem would be wrong (§1 Phase 5).
- **Group-level allocation anomalies are a separate flag, not folded into position badges**: "the group itself is outside its band" is shown once per group (on the group view), independent of any individual position's signal (§1 Phase 5).
- **Signal-role metric rules un-deferred in Phase 1**: v1 shipped only `role='classification'` (hardcoded in `createRule.ts`, signal role deliberately deferred). Phase 1 lifts that restriction since Phase 5's metric-based sub-signal needs signal-role rules to evaluate against — done alongside the `type` column rather than punted to Phase 5.
- **v2 Phase 6 backlog demoted**: v1's Phase 6 items (IBKR, PDF/Excel/XML parsing, deployment+auth) are *not* v2's Phase 1 — they sit in an unscheduled backlog behind the Signals roadmap (§1, §8).
- **EDGAR CIK resolution**: auto-looked-up via SEC's public ticker→CIK file (`sec.gov/files/company_tickers.json`) on first check, then cached permanently on `Instrument.edgarCik` — never re-fetched (§1 Phase 3, §3).
- **Financials trend default thresholds implemented**: ±5% YoY per line item, using the same fiscal-period pair reported by the filing itself (current vs. prior-year comparative — matched by duration+end date, searched across the company's full fact history rather than only within the current filing's accession number, since 20-F annual filings often don't restate a prior-year comparative alongside the current one). Majority vote across whichever line items resolve decides the composite verdict. Tunable later if it proves too coarse (§1 Phase 3a).
- **20-F (foreign private issuer annual reports) tracked alongside 10-K/10-Q**, including an `ifrs-full` taxonomy fallback for revenue/net income/etc. — needed since many 20-F filers report under IFRS rather than US-GAAP (§1 Phase 3a).
- **Financials-trend line items expanded beyond revenue/net income**: operating income, gross profit, diluted EPS, and free cash flow (computed, not a single XBRL tag) are best-effort additions; debt-to-equity (a total-liabilities-to-equity proxy, inverted so a falling ratio counts as "improving") is also included. All five are skipped silently when a company doesn't tag the underlying concept — only revenue/net income are required (§1 Phase 3a).
- **Filing text is stripped to plain text (3b)**, using the `html-to-text` dependency — not a hard requirement for an AI model to read the filing, but avoids the multiple-times-larger token count of raw SEC filing HTML (inline styles/tables/XBRL tagging) for no comprehension benefit ahead of Phase 4 (§1 Phase 3b).
- **3a and 3b shipped together in Phase 3**, even though 3b (`lib/edgar/get-filing-text.ts`) has no caller yet — exposed as a tested utility for Phase 4 to import directly once it starts, rather than being rebuilt then.

## 10. Still open

- **Unified rules table schema — exact column semantics** (§1 Phase 1): finalized shape is in §1/§3; fine-grained validation rules (e.g. exact DB-level enforcement of which columns are required per `type`) are an implementation detail for when Phase 1 starts.
- **EDGAR financials-trend specifics** (§1 Phase 3a): implemented with revenue/net income required plus operating income, gross profit, diluted EPS, free cash flow, and debt-to-equity as best-effort majority-vote inputs, ±5% YoY threshold (§9) — may need retuning (different/more line items, different threshold, weighted vote instead of a flat majority) once real signals are running.
- **AI thesis-vs-report analysis prompt/model quality** (§1 Phase 4): the provider/model choice is resolved (OpenAI `gpt-5.6-luna` — see decisions log), but prompt wording and verdict granularity haven't been tuned against real theses/filings yet — revisit once real signals are running.
- **Health combination rule may need tuning** (§1 Phase 5): worst-of-two (thesis, metric) is the decided default; if that proves too blunt in practice (one weak input always dragging Health down even when the other is strongly positive), a weighted rule is the fallback — revisit once real signals are running, not a blocker now.
- *(v1's one open item — Freedom Finance `market_value` vs `posval`/`mval` field mapping — was resolved during the Phase 1 build; see §4.)*
