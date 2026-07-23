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

Clock started: Day 1 — July 23, 2026. Clock ends: July 30, 2026.

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
- **2026-07-23** — GitHub Pages route abandoned after empirical testing: Actions
  runs on this repo fail at startup in ~3 seconds (even a bare `echo` workflow —
  likely account billing/limits), and Pages requires a public repo on the free
  plan anyway. The deploy workflow is kept as manual-dispatch only. Finding
  logged as a hosting constraint for the strategy phase.
- **2026-07-23** — Dashboard published instead as a private claude.ai artifact
  for the owner, republished on every meaningful event:
  https://claude.ai/code/artifact/8e600bc7-bbb7-4718-9da4-c508f3a7d6ff

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

- **Day 1 (today):** ~~Polar.sh~~ → **Stripe** account + restricted API key.
  (Polar's merchant-of-record review rejected the catalog: donation-style SKUs and
  "advisory" reports aren't acceptable products for a reseller. Stripe is a
  processor, not a reseller — the same catalog is ordinary there. Recon had
  designated Stripe as backup; switched same-day.) Also two non-account clicks:
  repo → Public, Settings → Pages → Source: GitHub Actions.
- **Day 2:** dev.to account + API key.
- **Day 3+:** reserve (unused unless something breaks).

## Status

Day 1: strategy locked, storefront build in progress, Polar automation ready and
waiting for the access token (the day's single account ask).
