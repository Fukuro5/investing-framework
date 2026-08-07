# PLANNING.md — Investing Framework

Personal, local-only portfolio tracker: import broker reports, see all positions with allocation/price/P&L, and evaluate your portfolio against one or more **frameworks** — named strategies (e.g. "Quality", "Momentum") each made of groups (e.g. Core @ 70%, Convexity @ some other %) with their own metrics and rules — to flag when a position should be trimmed, sold, or bought more. You can switch which framework is active to see how the same portfolio reads under a different strategy. Single user, no auth, runs on your machine.

This doc is the living plan. Update it as decisions change — don't let it drift out of sync with what's actually built.

## 1. Scope for v1

- Import transaction/position data from **Freedom Finance** (JSON statements).
- Normalize everything into one data model designed to take other brokers/formats later without core changes (see §4) — Interactive Brokers is the known next candidate, just not v1.
- Dashboard: positions, allocation %, current price, unrealized P&L, cost basis.
- **Frameworks** (see §5): multiple named strategies, each with its own groups (target allocation bands) and per-group metric rules (FCF, ROIC, convexity, etc.), producing buy-more/trim/sell/hold signals per position. Switchable — same portfolio, different lens.
- Live price (and later, fundamentals) via a free-tier third-party market data API, cached locally to respect rate limits.
- Runs locally via `pnpm dev` — SQLite, no auth, no deployment concerns for now.

Out of scope for v1 (revisit later, see Phase 6): Interactive Brokers import (no sample file yet, and not needed right now), PDF/Excel/XML parsing for Freedom Finance (fallback only if JSON proves insufficient), IBKR Flex Query automation, remote deployment, multi-user/auth.

## 2. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 App Router, already scaffolded | Server Actions for imports/mutations, Server Components for the dashboard |
| Database | SQLite (single file, zero setup) | Fits local single-user use perfectly |
| ORM | **Prisma** | Confirmed |
| i18n | next-intl, English + Ukrainian (per existing CLAUDE.md convention) | `[locale]` routing, `messages/en.json` + `messages/uk.json` |
| File parsing | `JSON.parse` for now; `xlsx`, `fast-xml-parser`, `csv-parse` added per-format as new broker formats come in | Every format parser sits behind one adapter interface — see §4 |
| Market data | **Finnhub** free tier, behind a `MarketDataProvider` interface | See §6 for why the interface matters and alternatives |
| Base currency | **USD** | All allocation %/totals reported in USD; non-USD positions/cash converted at import/refresh time |
| Testing | Vitest + React Testing Library + jsdom | Parsers are the highest-risk code here — prioritize test coverage on them specifically |
| Styling | Tailwind v4, already scaffolded | No changes needed |

Nothing in this table is installed yet — each gets proposed for install (and confirmed with you) at the point in the roadmap where it's actually needed, per the project's "ask before installing" rule.

## 3. Data model (draft)

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
MetricValue       instrumentId, metricKey, value, asOfDate, source ('api'|'manual'), fetchedAt
                  (fcf, roic, peRatio, dividendYield, convexity, ... — one catalog of metrics,
                  shared across frameworks; manual doesn't automatically win — when both a manual
                  and an api row exist for the same instrument+metricKey, whichever has the more
                  recent asOfDate/fetchedAt wins, regardless of source — see §5)

Framework         id, name, description, isActive
FrameworkGroup    id, frameworkId, name, targetAllocationMin, targetAllocationMax, priority
                  ("Core" @ 65–75%, "Convexity" @ ..., priority breaks ties when auto-classifying;
                  a framework's groups' allocation bands must sum to 100%, enforced in the
                  Phase 4 CRUD UI)
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

A single, format-agnostic ingestion function takes a `ParsedStatement` and handles validation, de-duplication against existing `ImportBatch`/`Transaction`/`PositionSnapshot` rows, and storage. **Adding a new format later (Freedom Excel/XML, IBKR Flex Query, a third broker) means writing one more function matching `StatementParser` — the ingestion, dedup, and storage logic never changes.** The UI's broker/format selector just picks which parser function to call.

### Freedom Finance (Freedom24) — JSON, confirmed from a real sample export

A real (unredacted) sample lives at `fixtures/broker-samples/freedom-finance-2026-07.json` — gitignored, local-only, since it contains your account/email data. Use it directly when building the Phase 1 parser instead of re-deriving the shape from this doc.

The export is a **period statement** (`date_start`/`date_end`, e.g. one calendar month), not a full historical transaction dump. It contains, per period:

- `account_at_start` / `account_at_end.account.positions_from_ts.ps.acc[]` — a **position snapshot** per instrument at each end of the period (quantity, avg cost, current price, market value, unrealized P&L). This is the primary source for `PositionSnapshot` rows — see §3 for why that matters (accurate current holdings without needing full trade history).
- `trades.detailed[]` — individual buy/sell executions within the period. Confirmed from a real example (a sell of `O.US`): `operation` (`"buy"`/`"sell"`), `p` (execution price), `q` (quantity), `summ` (total consideration), `commission` + `commission_currency`, `curr_c` (trade currency), `date` (execution datetime) + `pay_d` (settlement date), `transaction_id` (stable, use for dedup), `issue_nb`/`isin` (ISIN, duplicated under both keys), `instr_nm` (ticker + market suffix, e.g. `"O.US"`), `profit` (realized gain/loss — populated on sells), `fifo_profit` (nullable — presumably an alternate realized-P&L figure for partial-lot sells, TBD). This maps directly onto `Transaction` (type = `operation`, price = `p`, quantity = `q`, fees = `commission`, brokerRef = `transaction_id`).
- `cash_in_outs[]` — the richest transaction-level source for dividends, fees, deposits/withdrawals: has a stable `transaction_id` (good for dedup), `type_id` (e.g. `"dividend"` — stable, machine-readable), `ticker`, `amount`, `commission`. This is what `Transaction` rows for non-trade activity should be built from.
- `corporate_actions.detailed[]` — dividend/corporate-action detail with clean tax fields (`external_tax`, `external_tax_currency`) — worth cross-referencing by `corporate_action_id` to enrich dividend transactions with tax withheld, rather than parsing it out of `cash_in_outs`' nested JSON-string `details` field.
- `cash_flows_json[]` / `securities_flows_json[]` — per-currency/per-instrument period aggregates (start/end balances). Useful only as a reconciliation check (does our computed total match the broker's?), not as a transaction source.
- Everything else in the file (`off_balance_*`, `ffbo_trades_offsetting`, `in_outs_securities`, etc.) was empty in the sample and/or looks broker-internal — ignored unless a future sample shows it populated with something relevant.

Two implementation notes for whoever builds the Phase 1 parser (me, later) — not decisions that need your input, just flagging so they don't get missed:
- **Inconsistent text encoding**: some localized fields are corrupted (e.g. `cash_flows.detailed[].type` comes through as `"ÐÐ¸Ð²ÑÐ´ÐµÐ½Ð´Ð¸"` — mangled double-encoded Ukrainian for "Дивіденди"/"Dividends"), while others in a different section of the very same file are fine (`trades.detailed[].instr_kind` came through as clean Russian text, `"акция обыкновенная"`). So it's not "the whole file is broken," it's section-by-section. Either way, the parser should never rely on these free-text fields for logic — always use the stable machine keys instead (`type_id`, `operation`, `corporate_action_id`, `ticker`/`isin`). The free-text fields are only useful if you personally want to see the broker's own description in a UI later, and only after fixing the encoding on the ones that need it.
- **Example of a field-mapping question I'll need to resolve while coding, not now**: the position snapshot has more than one field that looks like it could be "the market value" — e.g. in the sample, `market_value` reported `2083.55` for TSM and never changed between the start-of-period and end-of-period snapshots, while `posval`/`mval` reported `2387.85` at the start and `2021.25` at the end — which does move in the direction you'd expect as TSM's price fell from `477.57` to `404.25`. That strongly suggests `posval`/`mval` are the real live market value and `market_value` is something else (maybe a reference/opening value). I'll confirm this against your actual account totals when I build the parser and pick the field that reconciles — you don't need to figure this out, I'm just noting it so a future me doesn't assume it was already double-checked.

### Interactive Brokers — deferred, not in v1

Not building this now. CSV export exists and IBKR also offers **Flex Query** (a server-side report you configure once and pull by URL — no manual download needed) for whenever this comes back into scope. The `StatementParser` interface above exists specifically so this slots in later as one more parser function without touching ingestion/storage logic — nothing about v1's design blocks it.

**Pipeline shape (Freedom Finance only, for now):**
1. Upload file via a form → Server Action.
2. Route to the Freedom Finance JSON `StatementParser` → get back a `ParsedStatement`. (A broker/format selector in the UI is only needed once a second source exists.)
3. Generic ingestion: validate, then store `Transaction` rows keyed by `brokerRef` (skip if that broker id is already recorded for the account — see §3) and `PositionSnapshot` rows for the batch's period.
4. Keep the raw uploaded file referenced (local file storage, not committed to git) for re-parsing if a parser bug is found later.

## 5. Frameworks

A **framework** is a named strategy (e.g. "Quality", "Momentum") made of one or more **groups** (e.g. Core, Convexity), each with a target allocation band and its own metric rules. Only one framework is "active" at a time for the dashboard view, but nothing about switching is destructive — frameworks, groups, and rules are all just data; the underlying transactions/positions never change. Switching frameworks re-runs classification + signal evaluation and re-renders the same positions through the newly active framework's lens.

**Group membership** (which framework-group a position belongs to) supports both mechanisms, per your call in planning:
- **Manual** — you assign a position to a group yourself, per framework.
- **Auto (rule-based)** — a group's `classification` rules (e.g. "ROIC > 15% AND FCF > 0") are evaluated against a position's current metric values; if they pass, the position is auto-assigned to that group.
- A manual assignment always wins — the auto-classifier only fills in positions that don't already have a manual assignment for that framework.
- If a position matches more than one group's classification rules, `FrameworkGroup.priority` breaks the tie (lower number = higher priority; exact ordering rule TBD once real rules exist — flagged in §9).
- A position that matches no group's classification rules and has no manual assignment stays unclassified for that framework (shown as such, not silently dropped).

**Group rules** come in two roles, sharing the same metric catalog (`MetricValue.metricKey` — fcf, roic, peRatio, dividendYield, convexity, ...) but potentially different thresholds:
- `classification` rules — decide auto-membership (above).
- `signal` rules — evaluated only for positions already in the group, decide the badge:
  - `trim` — over the group's max allocation, or a signal rule has degraded past threshold.
  - `buy more` — under the group's min allocation and signal rules still pass.
  - `sell` — hard breach on a signal rule (e.g. stop-loss-style).
  - `hold` — no signal rule triggered.

Evaluation runs on demand (after an import, a price/metric refresh, or a framework switch) rather than continuously.

You'll supply the actual group/metric/rule definitions later (e.g. what "Core" requires, what "Convexity" means numerically) — this section is the mechanism, not the specific rule set. The metric catalog and classification/signal logic above are built to hold whatever rules you give it, not hardcoded to a particular framework.

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

Start with a `FinnhubProvider` implementing this. Switching later (rate limits outgrown, better fundamentals needed, going paid) means writing one new class against the same interface and changing which one gets instantiated — nothing that calls `MarketDataProvider` needs to change.

Free-tier candidates:

| API | Free tier | Fit |
|---|---|---|
| **Finnhub** | ~60 req/min | Best free rate limit for live quotes; decent basic fundamentals |
| Twelve Data | 800 req/day | Good for price, thinner fundamentals |
| Alpha Vantage | Very limited (25 req/day as of recent changes) | Broad data but too rate-limited for regular refresh |
| Financial Modeling Prep | Limited free tier | Better fundamentals depth, worth a look once framework metrics need it |

Given free-tier limits, prices/metrics get fetched on-demand (a "refresh" button) or on a daily cadence, never polled live — `PriceSnapshot`/`MetricValue` act as a cache so the dashboard reads from the DB, not the API, on every page load. Metrics that the free API doesn't cover (ROIC especially) fall back entirely to your manual `MetricValue` entries; for a metric the API does cover, whichever row — manual or api — has the more recent `asOfDate`/`fetchedAt` is the one used, so a fresher manual correction still overrides a stale api value and vice versa — see §3.

Multi-currency: both brokers may report in different currencies (e.g. USD, EUR, possibly UAH/KZT). Aggregate allocation % needs FX conversion to one base currency — likely reuse the same market-data provider for FX rates if it offers them, otherwise a small dedicated FX endpoint.

## 7. Internationalization

Per the project's CLAUDE.md, next-intl with English + Ukrainian locales is the intended setup (you use both). Recommend wiring this up in Phase 0 alongside the DB, since retrofitting `[locale]` routing onto existing pages later is more churn than starting with it.

## 8. Roadmap

- **Phase 0 — Foundation**: next-intl setup (`[locale]` routing, `en`/`uk` message catalogs), Prisma + SQLite schema from §3, the `StatementParser`/`ParsedStatement` and `MarketDataProvider` interfaces from §4/§6 (structure only, no real implementation yet), base layout/nav shell.
- **Phase 1 — Import**: Freedom Finance JSON parser only — `positionSnapshots` from `account_at_end`, `transactions` from `trades.detailed` (buys/sells) + `cash_in_outs`/`corporate_actions` (dividends, with tax detail) → generic ingestion → DB. PDF/Excel/XML for Freedom Finance and IBKR entirely deferred (§10).
- **Phase 2 — Dashboard**: positions table — prefers latest `PositionSnapshot`, falls back to transaction-derived — quantity, avg cost, current price, allocation %, unrealized P&L, all in USD.
- **Phase 3 — Market data**: `FinnhubProvider` implementation, price refresh flow, `PriceSnapshot` caching, FX conversion to USD.
- **Phase 4 — Frameworks v1**: Framework/Group CRUD UI (fully user-managed — no hardcoded frameworks anywhere), manual group assignment per framework, framework switcher on the dashboard recomputing allocation-vs-target per group.
- **Phase 5 — Framework rules**: metric catalog + `MetricValue` ingestion (API + manual override), `GroupRule` CRUD (classification + signal roles, also fully user-managed), auto-classification engine (manual assignment always wins, `priority` breaks ties), signal badges (trim/buy-more/sell/hold) computed per active framework.
- **Phase 6 — Optional/later**: PDF/Excel/XML parsing for Freedom Finance (if JSON turns out insufficient), IBKR Flex Query automation, remote deployment + auth (only if you ever want access off your own machine).

## 9. Decisions log

- **ORM**: Prisma.
- **Base currency**: USD.
- **Market data**: Finnhub free tier, behind a `MarketDataProvider` interface for easy swapping later.
- **i18n**: next-intl, English + Ukrainian, kept from the start (not deferred).
- **Frameworks/groups/rules**: fully manageable via the UI (CRUD) — the DB schema in §3/§5 is only the foundation, nothing is hardcoded. Actual group definitions, allocation bands, and rules are yours to define later through that UI, not something to decide now.
- **Group classification tie-breaking**: `FrameworkGroup.priority` (lower wins) when a position matches multiple groups' classification rules.
- **Freedom Finance format**: start with JSON only (real samples in hand, including one with an actual trade — see §4); other formats stay possible later behind the same `StatementParser` interface without changing ingestion logic.
- **Interactive Brokers**: out of v1 entirely. The import design (§4) doesn't block adding it later, it's just not being built now.
- **Freedom Finance `trades.detailed` schema**: confirmed from a real sell example (§4) — no longer a guess.
- **Transaction dedup**: per-transaction via `brokerRef` (§3/§4), not per-batch — a re-uploaded statement with a partially-overlapping period ingests cleanly, inserting only the transactions not already present.
- **Signal history**: `Signal` rows are insert-only (§3) — each evaluation run appends rather than overwrites, so signal history over time is preserved.
- **FrameworkGroup allocation bands**: a framework's groups' target allocation bands must sum to 100% (§3/§5), enforced by the Phase 4 CRUD UI.
- **MetricValue source precedence**: not "manual always wins" — whichever of the manual/api rows for a given instrument+metricKey has the more recent `asOfDate`/`fetchedAt` wins (§3/§5); manual only wins by default when the API doesn't supply that metric at all.

## 10. Still open — not blocking Phase 0/1, revisit when relevant

- **Position-snapshot field mapping** (§4): a couple of Freedom Finance fields (`market_value` vs `posval`/`mval`) look redundant/contradictory — I'll settle which one is the real current market value empirically while writing the Phase 1 parser, checked against your actual account totals. This is on me to resolve during implementation, not something you need to decide.
