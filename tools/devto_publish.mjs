#!/usr/bin/env node
// Publishes articles from content/dev-to/*.md to dev.to via the Forem API.
// Usage: DEVTO_API_KEY=... node tools/devto_publish.mjs [--publish] [file ...]
// Without --publish, articles are created/updated as drafts (published: false).
// State: each markdown file gets a matching .devto.json sidecar with the article id,
// committed to the repo so republishing updates instead of duplicating.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KEY = process.env.DEVTO_API_KEY;
if (!KEY) { console.error("DEVTO_API_KEY is not set."); process.exit(1); }

const args = process.argv.slice(2);
const publish = args.includes("--publish");
const files = args.filter(a => !a.startsWith("--"));

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "dev-to");
const targets = files.length ? files : readdirSync(dir).filter(f => f.endsWith(".md")).map(f => join(dir, f));

function parseFrontMatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    meta[kv[1]] = v;
  }
  return { meta, body: m[2] };
}

async function api(method, path, body) {
  const res = await fetch(`https://dev.to/api${path}`, {
    method,
    headers: { "api-key": KEY, "Content-Type": "application/json", Accept: "application/vnd.forem.api-v1+json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

for (const file of targets) {
  const src = readFileSync(file, "utf8");
  const { meta, body } = parseFrontMatter(src);
  const sidecarPath = file.replace(/\.md$/, ".devto.json");
  const sidecar = existsSync(sidecarPath) ? JSON.parse(readFileSync(sidecarPath, "utf8")) : {};

  const payload = {
    article: {
      title: meta.title || "Untitled",
      body_markdown: body.trim(),
      published: publish ? true : String(meta.published) === "true",
      tags: (meta.tags || "").split(",").map(t => t.trim()).filter(Boolean).slice(0, 4),
    },
  };

  let result;
  if (sidecar.id) {
    result = await api("PUT", `/articles/${sidecar.id}`, payload);
    console.log(`updated: ${result.title} (${result.id}) published=${result.published} ${result.url || ""}`);
  } else {
    result = await api("POST", "/articles", payload);
    console.log(`created: ${result.title} (${result.id}) published=${result.published} ${result.url || ""}`);
  }
  writeFileSync(sidecarPath, JSON.stringify({ id: result.id, url: result.url || null, published: result.published }, null, 2) + "\n");

  // dev.to rate-limits article creation; be polite between posts.
  await new Promise(r => setTimeout(r, 3000));
}
console.log("done");
