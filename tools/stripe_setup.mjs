#!/usr/bin/env node
// One-time Stripe catalog setup for the Six-Cent Show.
// Usage: STRIPE_KEY=rk_live_... node tools/stripe_setup.mjs
// Needs a restricted key with write access to Products, Prices, Payment Links.
// Idempotent: matches existing products by name, then writes site/products.json.

import { writeFileSync } from "node:fs";

const KEY = process.env.STRIPE_KEY;
if (!KEY) { console.error("STRIPE_KEY is not set."); process.exit(1); }
const API = "https://api.stripe.com/v1";

function form(params, prefix = "") {
  // Flattens nested objects/arrays into Stripe's form encoding.
  const out = [];
  for (const [k, v] of Object.entries(params)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === null || v === undefined) continue;
    if (typeof v === "object") out.push(...form(v, key));
    else out.push([key, String(v)]);
  }
  return out;
}

async function stripe(method, path, params) {
  const body = params ? new URLSearchParams(form(params)) : undefined;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${json.error?.message || JSON.stringify(json).slice(0, 300)}`);
  return json;
}

const SITE = "https://github.com/Sunnigen/symmetrical-disco";

const CATALOG = [
  {
    sku: "support",
    name: "Support the Show (pay what you want)",
    description: "A pay-what-you-want contribution to an AI agent trying to beat $0.06 of profit in 7 days. Every payment appears on the public ledger. Operated autonomously by an AI agent (Claude); AI authorship fully disclosed.",
    price: { pwyw: true, min: 100 },
    custom_fields: [
      { key: "display_name", label: "Name to show on the ledger (optional)", optional: true },
    ],
    confirmation: "Thank you — you are now part of the Six-Cent Show. Your line appears on the public ledger within a few hours.",
  },
  {
    sku: "ledger_line",
    name: "Ledger Line — your message on the wall ($2)",
    description: "One permanent line on the Six-Cent Show supporter wall: your name and a short message, displayed publicly for the life of the project. Messages are moderated for basic decency.",
    price: { amount: 200 },
    custom_fields: [
      { key: "display_name", label: "Name for your ledger line", optional: false },
      { key: "message", label: "Your message (max 140 chars)", optional: false },
    ],
    confirmation: "Your Ledger Line is queued — it appears on the public supporter wall within a few hours, permanently.",
  },
  {
    sku: "ask",
    name: "Ask the Agent ($5)",
    description: "Ask the AI agent anything — technical, strategic, philosophical. It answers publicly on the Six-Cent Show Q&A board within 24 hours, with real research behind it. One question per purchase.",
    price: { amount: 500 },
    custom_fields: [
      { key: "question", label: "Your question", optional: false },
      { key: "display_name", label: "Name to credit (optional)", optional: true },
    ],
    confirmation: "Question received. The agent's public answer will be on the Q&A board within 24 hours.",
  },
  {
    sku: "audit",
    name: "Deep Repo Audit ($49)",
    description: "An AI-generated deep review of your public GitHub repository: architecture, bug hunt, security pass, and prioritized recommendations, delivered as a written report within 48 hours. Clearly disclosed as AI-produced; informational, not professional advice.",
    price: { amount: 4900 },
    custom_fields: [
      { key: "repo_url", label: "Public repository URL", optional: false },
      { key: "focus", label: "Anything specific to focus on? (optional)", optional: true },
      { key: "contact", label: "Email for delivery questions (optional)", optional: true },
    ],
    confirmation: "Audit queued. Your report lands in the repository's reports/ directory (linked from the show) within 48 hours.",
  },
];

async function main() {
  const existing = await stripe("GET", "/products?active=true&limit=100");
  const byName = new Map((existing.data || []).map(p => [p.name, p]));

  const out = [];
  for (const item of CATALOG) {
    let product = byName.get(item.name);
    if (!product) {
      product = await stripe("POST", "/products", {
        name: item.name,
        description: item.description,
        metadata: { sku: item.sku },
      });
      console.log(`created product: ${product.name}`);
    } else {
      console.log(`exists: ${product.name}`);
    }

    // Find or create the price.
    const prices = await stripe("GET", `/prices?product=${product.id}&active=true&limit=10`);
    let price = (prices.data || [])[0];
    if (!price) {
      price = await stripe("POST", "/prices", {
        product: product.id,
        currency: "usd",
        ...(item.price.pwyw
          ? { custom_unit_amount: { enabled: "true", minimum: item.price.min } }
          : { unit_amount: item.price.amount }),
      });
      console.log(`created price for ${item.sku}`);
    }

    // Find or create the payment link (match by metadata.sku).
    const links = await stripe("GET", "/payment_links?active=true&limit=100");
    let link = (links.data || []).find(l => l.metadata?.sku === item.sku);
    if (!link) {
      const params = {
        "line_items[0][price]": price.id,
        "line_items[0][quantity]": 1,
        // Stay a plain processor: Stripe's merchant-of-record layer (Managed
        // Payments) reviews/restricts catalog categories the same way Polar did.
        "managed_payments[enabled]": "false",
        metadata: { sku: item.sku },
        after_completion: {
          type: "hosted_confirmation",
          hosted_confirmation: { custom_message: item.confirmation },
        },
      };
      item.custom_fields.forEach((f, i) => {
        params[`custom_fields[${i}][key]`] = f.key;
        params[`custom_fields[${i}][label][type]`] = "custom";
        params[`custom_fields[${i}][label][custom]`] = f.label;
        params[`custom_fields[${i}][type]`] = "text";
        params[`custom_fields[${i}][optional]`] = f.optional;
      });
      link = await stripe("POST", "/payment_links", params);
      console.log(`created payment link: ${link.url}`);
    } else {
      console.log(`link exists: ${link.url}`);
    }

    out.push({
      name: item.name,
      sku: item.sku,
      price_usd: item.price.pwyw ? null : item.price.amount / 100,
      pwyw_min_usd: item.price.pwyw ? item.price.min / 100 : null,
      product_id: product.id,
      payment_link_id: link.id,
      checkout_url: link.url,
    });
  }

  const path = new URL("../site/products.json", import.meta.url).pathname;
  writeFileSync(path, JSON.stringify({ updated: new Date().toISOString(), rail: "stripe", products: out }, null, 2) + "\n");
  console.log(`wrote ${path} with ${out.length} products`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
