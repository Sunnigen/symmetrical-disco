#!/usr/bin/env node
// One-time Polar.sh catalog setup for the Six-Cent Show.
// Usage: POLAR_ACCESS_TOKEN=polar_oat_... node tools/polar_setup.mjs
// Idempotent: skips products that already exist (matched by name), then writes
// site/products.json with live checkout URLs.

import { readFileSync, writeFileSync } from "node:fs";

const API = process.env.POLAR_API_BASE || "https://api.polar.sh/v1";
const TOKEN = process.env.POLAR_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("POLAR_ACCESS_TOKEN is not set.");
  process.exit(1);
}

const CATALOG = [
  {
    name: "Support the Show (pay what you want)",
    description:
      "A pay-what-you-want tip to an AI agent trying to beat $0.06 of profit in 7 days. " +
      "Every payment appears on the public ledger at the Six-Cent Show. Operated autonomously " +
      "by an AI agent (Claude); a human owner handles only account signups.",
    price: { amount_type: "custom", minimum_amount: 100 },
    custom_fields: [
      { slug: "display_name", name: "Name to show on the ledger (optional)", type: "text", required: false },
    ],
  },
  {
    name: "Ledger Line — your message on the wall ($2)",
    description:
      "Buy one permanent line on the Six-Cent Show supporter wall: your name and a short message, " +
      "displayed publicly for the life of the project. Messages are moderated for basic decency by the agent.",
    price: { amount_type: "fixed", price_amount: 200 },
    custom_fields: [
      { slug: "display_name", name: "Name for your ledger line", type: "text", required: true },
      { slug: "message", name: "Your message (max 140 chars)", type: "text", required: true },
    ],
  },
  {
    name: "Ask the Agent ($5)",
    description:
      "Ask the AI agent anything — technical, strategic, philosophical. It answers publicly on the " +
      "Six-Cent Show Q&A board within 24 hours, with real effort (research included). One question per purchase.",
    price: { amount_type: "fixed", price_amount: 500 },
    custom_fields: [
      { slug: "question", name: "Your question", type: "text", required: true },
      { slug: "display_name", name: "Name to credit (optional)", type: "text", required: false },
    ],
  },
  {
    name: "Deep Repo Audit ($49)",
    description:
      "A frontier-AI deep audit of your public GitHub repository: architecture review, bug hunt, security pass, " +
      "and prioritized recommendations, delivered as a thorough written report within 48 hours. " +
      "Sample audits are published on the Six-Cent Show. AI-produced, clearly disclosed as such.",
    price: { amount_type: "fixed", price_amount: 4900 },
    custom_fields: [
      { slug: "repo_url", name: "Public repository URL", type: "text", required: true },
      { slug: "focus", name: "Anything specific to focus on? (optional)", type: "text", required: false },
      { slug: "contact", name: "Email for delivery questions (optional)", type: "text", required: false },
    ],
  },
];

async function polar(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  }
  return json;
}

async function main() {
  const existing = await polar("GET", "/products?is_archived=false&limit=100");
  const byName = new Map((existing.items || []).map(p => [p.name, p]));

  const out = [];
  for (const item of CATALOG) {
    let product = byName.get(item.name);

    if (!product) {
      // Create attached custom fields first (Polar requires field ids on the product).
      const fieldIds = [];
      for (const f of item.custom_fields || []) {
        let field;
        try {
          field = await polar("POST", "/custom-fields", {
            type: f.type,
            slug: `${f.slug}`,
            name: f.name,
            properties: {},
          });
        } catch (e) {
          // Slug may already exist from a previous run — look it up.
          const all = await polar("GET", "/custom-fields?limit=100");
          field = (all.items || []).find(x => x.slug === f.slug);
          if (!field) throw e;
        }
        fieldIds.push({ custom_field_id: field.id, required: !!f.required });
      }

      product = await polar("POST", "/products", {
        name: item.name,
        description: item.description,
        recurring_interval: null,
        prices: [
          item.price.amount_type === "custom"
            ? { amount_type: "custom", price_currency: "usd", minimum_amount: item.price.minimum_amount }
            : { amount_type: "fixed", price_currency: "usd", price_amount: item.price.price_amount },
        ],
        attached_custom_fields: fieldIds,
      });
      console.log(`created product: ${product.name} (${product.id})`);
    } else {
      console.log(`exists: ${product.name} (${product.id})`);
    }

    const links = await polar("GET", `/checkout-links?product_id=${product.id}&limit=10`);
    let link = (links.items || [])[0];
    if (!link) {
      link = await polar("POST", "/checkout-links", {
        payment_processor: "stripe",
        product_id: product.id,
        label: product.name,
      });
      console.log(`created checkout link: ${link.url}`);
    } else {
      console.log(`link exists: ${link.url}`);
    }

    out.push({
      name: item.name,
      price_usd: item.price.amount_type === "custom" ? null : item.price.price_amount / 100,
      pwyw_min_usd: item.price.amount_type === "custom" ? item.price.minimum_amount / 100 : null,
      product_id: product.id,
      checkout_url: link.url,
    });
  }

  const path = new URL("../site/products.json", import.meta.url).pathname;
  writeFileSync(path, JSON.stringify({ updated: new Date().toISOString(), products: out }, null, 2) + "\n");
  console.log(`wrote ${path} with ${out.length} products`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
