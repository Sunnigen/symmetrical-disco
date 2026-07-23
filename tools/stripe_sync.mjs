#!/usr/bin/env node
// Pulls completed Stripe Checkout Sessions (from our payment links) into
// site/data.json: revenue, transactions, supporter wall, and Q&A queue.
// Usage: STRIPE_KEY=rk_live_... node tools/stripe_sync.mjs
// Needs read access to Checkout Sessions. Deduplicates by session id.

import { readFileSync, writeFileSync } from "node:fs";

const KEY = process.env.STRIPE_KEY;
if (!KEY) { console.error("STRIPE_KEY is not set."); process.exit(1); }
const API = "https://api.stripe.com/v1";

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
  let skuByLink = {};
  try {
    const prods = JSON.parse(readFileSync(productsPath, "utf8"));
    // metadata.sku also rides on the session's payment_link object id
    skuByLink = Object.fromEntries((prods.products || []).map(p => [p.checkout_url, p.sku]));
  } catch {}

  data.transactions ||= [];
  data.supporters ||= [];
  data.qa ||= [];
  const seen = new Set(data.transactions.map(t => t.order_id).filter(Boolean));

  let startingAfter = null, added = 0;
  for (;;) {
    const qs = `/checkout/sessions?limit=100&status=complete${startingAfter ? `&starting_after=${startingAfter}` : ""}`;
    const res = await stripe(qs);
    const items = res.data || [];
    for (const s of items) {
      if (s.payment_status !== "paid") continue;
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      added++;

      const gross = (s.amount_total ?? 0) / 100;
      const date = new Date(s.created * 1000).toISOString().slice(0, 10);
      const sku = s.metadata?.sku || null;

      const label = {
        support: "Support the Show (PWYW)",
        ledger_line: "Ledger Line",
        ask: "Ask the Agent",
        audit: "Deep Repo Audit",
      }[sku] || "Sale";

      data.transactions.push({ order_id: s.id, date, description: label, amount_usd: gross });

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

  data.revenue_usd = Number(data.transactions.reduce((sum, t) => sum + (t.amount_usd > 0 ? t.amount_usd : 0), 0).toFixed(2));
  data.updated = new Date().toISOString();

  const byDay = {};
  for (const t of data.transactions) byDay[t.date] = (byDay[t.date] || 0) + t.amount_usd;
  let cum = 0;
  const series = [];
  const d = new Date(data.start + "T12:00:00Z");
  const today = new Date();
  const end = new Date(data.end + "T12:00:00Z");
  while (d <= end && d <= today) {
    const iso = d.toISOString().slice(0, 10);
    cum += byDay[iso] || 0;
    series.push({ date: iso, cumulative_usd: Number(cum.toFixed(2)) });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  if (series.length) data.daily_profit = series;

  writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n");
  console.log(`synced: ${added} new paid sessions, revenue $${data.revenue_usd.toFixed(2)}`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
