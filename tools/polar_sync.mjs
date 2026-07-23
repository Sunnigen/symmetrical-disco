#!/usr/bin/env node
// Pulls paid orders from Polar and folds them into site/data.json:
// revenue, transactions, supporter wall (Ledger Lines), and Q&A queue.
// Usage: POLAR_ACCESS_TOKEN=polar_oat_... node tools/polar_sync.mjs
// Safe to run repeatedly; orders are deduplicated by id.

import { readFileSync, writeFileSync } from "node:fs";

const API = process.env.POLAR_API_BASE || "https://api.polar.sh/v1";
const TOKEN = process.env.POLAR_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("POLAR_ACCESS_TOKEN is not set.");
  process.exit(1);
}

async function polar(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

function fieldValue(order, slug) {
  const data = order.custom_field_data || {};
  return data[slug] ?? null;
}

async function main() {
  const dataPath = new URL("../site/data.json", import.meta.url).pathname;
  const data = JSON.parse(readFileSync(dataPath, "utf8"));
  data.transactions ||= [];
  data.supporters ||= [];
  data.qa ||= [];

  const seen = new Set(data.transactions.map(t => t.order_id).filter(Boolean));

  let page = 1, added = 0;
  for (;;) {
    const res = await polar(`/orders?limit=100&page=${page}`);
    const items = res.items || [];
    for (const o of items) {
      if (o.status && o.status !== "paid") continue;
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      added++;

      const gross = (o.net_amount ?? o.total_amount ?? o.amount ?? 0) / 100;
      const productName = o.product?.name || "Unknown product";
      const date = (o.created_at || "").slice(0, 10);

      data.transactions.push({
        order_id: o.id,
        date,
        description: productName,
        amount_usd: gross,
      });

      if (productName.startsWith("Ledger Line")) {
        data.supporters.push({
          date,
          name: String(fieldValue(o, "display_name") || "Anonymous").slice(0, 60),
          message: String(fieldValue(o, "message") || "").slice(0, 140),
          moderated: false,
        });
      }
      if (productName.startsWith("Ask the Agent")) {
        data.qa.push({
          date,
          name: String(fieldValue(o, "display_name") || "Anonymous").slice(0, 60),
          question: String(fieldValue(o, "question") || ""),
          answer: null,
        });
      }
      if (productName.startsWith("Support the Show")) {
        const name = fieldValue(o, "display_name");
        if (name) {
          data.supporters.push({ date, name: String(name).slice(0, 60), message: "supported the show", moderated: false });
        }
      }
    }
    if (!res.pagination || items.length < 100) break;
    page++;
  }

  data.revenue_usd = Number(data.transactions.reduce((s, t) => s + (t.amount_usd > 0 ? t.amount_usd : 0), 0).toFixed(2));
  data.updated = new Date().toISOString();

  // Rebuild the daily cumulative profit series from transactions.
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
  console.log(`synced: ${added} new orders, revenue $${data.revenue_usd.toFixed(2)}`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
