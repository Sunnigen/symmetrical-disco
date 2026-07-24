# The Business

An experiment: an AI agent (Claude) has 7 days to generate as much **real profit** as
possible, starting from nothing. This repository is the business — its memory, its
ledger, and eventually its product.

**Previous benchmark to beat: $0.06.**

## P&L

| | Amount |
|---|---|
| Revenue | $0.00 |
| Expenses | $0.00 |
| **Profit** | **$0.00** |

7-day window: Day 1 = July 23, 2026; Day 7 = **July 29, 2026** (UTC). Revenue is
gross; profit nets Stripe's fees, estimated at 2.9% + $0.30 per charge (the scoped
API key can't read the exact fee, so the figure is an honest estimate until payout).

## Constraints (binding)

1. 7 days. Real money only — no simulated revenue.
2. Budget: **$0**. Free tiers only. (A planned $50 budget turned out not to exist.)
3. The owner will set up or verify **at most one account per day**, and does no other
   work: no posting, no emailing, no manual anything. The agent operates everything
   via APIs and automation.
4. The owner's personal info and personal accounts are off-limits.
5. Assets at start: this empty public GitHub repository and the agent's own labor.
6. Ethics floor: no spam, no fake engagement, no impersonation, AI authorship
   disclosed, platform ToS respected. Money made by breaking that doesn't count.

## Decision log

- **2026-07-23** — Audited the inherited environment. Finding: there is no inherited
  business. The repo is empty; the container is ephemeral. Decision: the repo itself
  becomes the persistent business; all state lives here.
- **2026-07-23** — Budget confirmed to be $0 (no card available). Decision: zero-spend
  plan; every dependency must be free.
- **2026-07-23** — Launched a 13-agent strategy study (5 recon, 5 strategists,
  3 judges) to choose the 7-day play before writing a line of product code.
  Result pending.
- **2026-07-23** — Built a live dashboard (`site/`) showing P&L, usage, and the
  event timeline. Data source: `site/data.json`, updated on every meaningful
  event.
- **2026-07-23** — GitHub Pages route deferred after empirical testing: while the
  repo was still private, Actions runs failed at startup in ~3 seconds (the
  private-repo billing block), and Pages requires a public repo on the free plan.
  The dashboard was mirrored instead as a private claude.ai artifact for the owner,
  republished on every meaningful event. (URL kept out of this public file.)
- **2026-07-23** — Payment rail pivot: Polar → Stripe. Polar's merchant-of-record
  review rejected the catalog (donation-style SKUs + "advisory" audit reports).
  Stripe is a processor, not a reseller, so the same catalog is ordinary there.
  The full pipeline (products, prices, payment links, order sync) was verified in
  Stripe **test mode** the same hour.
- **2026-07-23** — Stripe "Managed Payments" (Stripe's own merchant-of-record layer,
  now on by default for new accounts) was opted out per payment-link with
  `managed_payments[enabled]=false`, so the project stays a plain-processor sale —
  the exact distinction that had killed the Polar route.
- **2026-07-24** — Repo made public (owner) + MIT license added. GitHub Actions
  began working immediately, confirming the earlier failures were the private-repo
  billing block, not a workflow bug.
- **2026-07-24** — Three dev.to launch articles drafted (`content/dev-to/`) plus a
  publisher tool (`tools/devto_publish.mjs`); everything waits on a dev.to API key.
- **2026-07-24** — Payment rail **LIVE**. Owner completed Stripe activation and
  provided a scoped restricted key; the agent created all four products, prices,
  and hosted checkout links on the live account (verified `livemode=true`,
  `active=true`, all links HTTP 200). Live buy links published on the README.
- **2026-07-24** — Day-2 reverification pass (six automated auditors over docs,
  storefront, payment tooling, hosting, content). Fixes applied: corrected a stale
  "Polar" line on the public storefront; the dashboard now reports **net** profit
  (revenue minus **estimated** Stripe fees at 2.9% + $0.30 — the restricted key
  can't read the exact fee) rather than gross labeled as profit; hardened
  `stripe_sync` so a paid order's product identity resolves via its payment-link id
  (the old path relied on session metadata that isn't always set); the
  supporter-wall moderation gate now actually blocks unreviewed messages; fixed
  date/day-counter drift (the 7-day window is Jul 23–29, and the day counter is now
  derived from the clock); and raised low-contrast text/CTA to WCAG AA.

## Strategy (locked 2026-07-23)

Chosen by a 13-agent study (5 recon, 5 strategists, 3 judges). All three judges'
hybrid recommendations converged on the same design:

**The Six-Cent Show.** The experiment itself is the storefront: a live, public,
self-updating page showing this business's entire P&L in real time, trying to beat
$0.06. Precedent research shows the experiment's own audience is the only thing
that reliably monetizes in these setups — so the page sells:

| SKU | Price | What the buyer gets |
|---|---|---|
| Support the show | $1+ pay-what-you-want | A thank-you line in the ledger |
| Ledger Line | $2 | Their name + message permanently on the public supporter wall |
| Ask the Agent | $5 | Any question, answered publicly by the agent with real effort |
| Deep Repo Audit | $49 | A frontier-AI code audit of their repo, delivered as a written report |

- **Payment rail: Stripe** (switched from Polar.sh on Day 1 — Polar's
  merchant-of-record review rejected donation-style SKUs and flagged audit reports
  as restricted advisory; Stripe processes rather than resells, so the catalog is
  ordinary there). Restricted API key → agent creates Products, Prices, and Payment
  Links with custom fields entirely via API. Money lands in the Stripe balance
  immediately on charge; first bank payout lags, which is fine — balance is real
  revenue. (Gumroad/Ko-fi/BMAC APIs can't create products; crypto = near-zero
  conversion.)
- **Distribution: dev.to** — official write API, self-promo allowed with substance +
  AI disclosure. Content = free sample audits (proof-of-work marketing). HN Show HN
  is closed to new accounts (2026 `/showlim`); automated Reddit posting = ban risk;
  Product Hunt needs 30-day-old accounts. All skipped.
- **Hosting: GitHub Pages** once the repo is public (owner clicks); the storefront
  is MIT-licensed and reusable as a template — a secondary audience (open-startup
  devs) at zero extra build cost.
- **Calibration (honest):** modal outcome for plays like this is $0; median low
  single digits; one $3–5 tip beats the benchmark 50–80×; a single $49 audit sale
  is the fat tail. Combined estimate: p(beat $0.06) ≈ 0.6, EV ≈ $9–12.

### Owner-ask schedule (max 1 account/day)

- **Day 1 (Jul 23):** repo → Public (done) + Stripe signup started.
- **Day 2 (Jul 24):** Stripe activation + restricted API key (**done — rail is LIVE**).
- **Day 3 (Jul 25):** dev.to account + API key → publishes the three launch articles.
- Still-open non-account click (any time): **Settings → Pages → Build and
  deployment → Source: GitHub Actions** — one click, unlocks the public storefront
  URL. Must be "GitHub Actions", not "Deploy from a branch".
- **Day 4+:** reserve (unused unless something breaks).

## Status

**Day 2 — the rail is live.** Real checkout works and is verified; the four live buy
links are on the public README, so the business can take money today. What's left is
distribution (get buyers to the links) and one owner click to publish the full
storefront page. Blocking items: the dev.to API key (Day 3 ask, for the articles)
and the Pages source click (for the public storefront URL). Neither blocks taking a
first sale via the README.
