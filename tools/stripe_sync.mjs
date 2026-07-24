#!/usr/bin/env node
// Pulls completed Stripe Checkout Sessions (from our payment links) into
// site/data.json: revenue, estimated fees (expenses), transactions, supporter
// wall, and Q&A queue.
// Usage: STRIPE_KEY=rk_live_... node tools/stripe_sync.mjs
// Needs read access to Checkout Sessions. Deduplicates by session id.
//
// Honesty notes:
//  - revenue_usd is gross (what buyers paid); refunds entered as negative
//    transactions DO reduce it.
//  - expenses_usd is Stripe's standard fee ESTIMATED at 2.9% + $0.30 per paid
//    charge (the restricted key can't read balance_transaction for the exact
//    fee). Profit = revenue - estimated fees, so the headline number is net,
//    not gross. This is stated on the page and in BUSINESS.md.

import { readFileSync, writeFileSync } from "node:fs";

const KEY = process.env.STRIPE_KEY;
if (!KEY) { console.error("STRIPE_KEY is not set."); process.exit(1); }
const API = "https://api.stripe.com/v1";

// Stripe US standard pricing. An estimate — see header note.
const estFee = amount => (amount > 0 ? Math.round((amount * 0.029 + 0.30) * 100) / 100 : 0);

async function stripe(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
  const json = await res.json();
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}: ${json.error?.message || ""}`);
  return json;
}

function fieldValue(session, key) {
  const f = (session.custom_fields || []).find(x => x.key === key);
  return f?.text?.value ?? null;
}

async function main() {
  const dataPath = new URL("../site/data.json", import.meta.url).pathname;
  const productsPath = new URL("../site/products.json", import.meta.url).pathname;
  const data = JSON.parse(readFileSync(dataPath, "utf8"));

  // Map payment-link id -> sku. Checkout Sessions carry `payment_link` (plink_…),
  // so this resolves the sku even when session.metadata is absent (payment-link
  // metadata does not always propagate to the session).
  let skuByPlink = {};
  try {
    const prods = JSON.parse(readFileSync(productsPath, "utf8"));
    skuByPlink = Object.fromEntries(
      (prods.products || []).filter(p => p.payment_link_id).map(p => [p.payment_link_id, p.sku])
    );
  } catch {}

  data.transactions ||= [];
  data.supporters ||= [];
  data.qa ||= [];
  const seen = new Set(data.transactions.map(t => t.order_id).filter(Boolean));

  let startingAfter = null, added = 0, skippedCurrency = 0, unresolved = 0;
  for (;;) {
    const qs = `/checkout/sessions?limit=100&status=complete${startingAfter ? `&starting_after=${startingAfter}` : ""}`;
    const res = await stripe(qs);
    const items = res.data || [];
    if (!items.length) break; // guards has_more:true with an empty page

    for (const s of items) {
      if (s.payment_status !== "paid") continue;
      if (seen.has(s.id)) continue;
      if (s.currency && s.currency !== "usd") { skippedCurrency++; continue; }
      seen.add(s.id);
      added++;

      const gross = (s.amount_total ?? 0) / 100;
      const date = new Date(s.created * 1000).toISOString().slice(0, 10);
      const sku = s.metadata?.sku || skuByPlink[s.payment_link] || null;
      if (!sku) unresolved++;

      const label = {
        support: "Support the Show (PWYW)",
        ledger_line: "Ledger Line",
        ask: "Ask the Agent",
        audit: "Deep Repo Audit",
      }[sku] || "Sale (unresolved SKU)";

      data.transactions.push({ order_id: s.id, date, sku, description: label, amount_usd: gross });

      if (sku === "ledger_line") {
        data.supporters.push({
          date,
          name: String(fieldValue(s, "display_name") || "Anonymous").slice(0, 60),
          message: String(fieldValue(s, "message") || "").slice(0, 140),
          moderated: false,
        });
      }
      if (sku === "ask") {
        data.qa.push({
          date,
          name: String(fieldValue(s, "display_name") || "Anonymous").slice(0, 60),
          question: String(fieldValue(s, "question") || ""),
          answer: null,
          moderated: false,
        });
      }
      if (sku === "support") {
        const name = fieldValue(s, "display_name");
        if (name) data.supporters.push({ date, name: String(name).slice(0, 60), message: "supported the show", moderated: false });
      }
    }
    if (!res.has_more) break;
    startingAfter = items[items.length - 1].id;
  }

  // Revenue is gross and includes any negative (refund) rows. Expenses are the
  // estimated Stripe fees on positive charges. Profit = revenue - expenses.
  const revenue = data.transactions.reduce((s, t) => s + t.amount_usd, 0);
  const fees = data.transactions.reduce((s, t) => s + estFee(t.amount_usd), 0);
  data.revenue_usd = Number(revenue.toFixed(2));
  data.expenses_usd = Number(fees.toFixed(2));
  data.updated = new Date().toISOString();

  // Cumulative NET profit per day (gross minus estimated fee), so the chart
  // agrees with the profit meter.
  const netByDay = {};
  for (const t of data.transactions) {
    netByDay[t.date] = (netByDay[t.date] || 0) + t.amount_usd - estFee(t.amount_usd);
  }
  let cum = 0;
  const series = [];
  const d = new Date(data.start + "T12:00:00Z");
  const today = new Date();
  const end = new Date(data.end + "T12:00:00Z");
  while (d <= end && d <= today) {
    const iso = d.toISOString().slice(0, 10);
    cum += netByDay[iso] || 0;
    series.push({ date: iso, cumulative_usd: Number(cum.toFixed(2)) });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  if (series.length) data.daily_profit = series;

  writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n");
  console.log(`synced: ${added} new paid session(s); revenue $${data.revenue_usd.toFixed(2)}, est. fees $${data.expenses_usd.toFixed(2)}, profit $${(data.revenue_usd - data.expenses_usd).toFixed(2)}`);
  if (skippedCurrency) console.warn(`skipped ${skippedCurrency} non-USD session(s)`);
  if (unresolved) console.warn(`WARNING: ${unresolved} paid session(s) had no resolvable SKU — check products.json payment_link_id mapping`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
