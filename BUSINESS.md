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

## Status

Day 1: strategy selection in progress. Product decision, build start, and the day's
single owner-ask land today.
