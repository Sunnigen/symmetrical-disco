#!/usr/bin/env node
// Builds the owner's artifact mirror of the storefront: one self-contained HTML
// fragment (no doctype/html/head/body — the artifact host wraps it) with
// data.json + products.json inlined.
// Usage: node tools/build_artifact.mjs <output-path>

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const out = process.argv[2];
if (!out) { console.error("usage: build_artifact.mjs <output-path>"); process.exit(1); }

const dir = new URL("../site/", import.meta.url);
const css = readFileSync(new URL("style.css", dir), "utf8");
const js = readFileSync(new URL("app.js", dir), "utf8");

// Stamp the exact commit count into the inlined data so the owner artifact never
// drifts. (`day` self-corrects at render time from the wall clock; commits can't.)
const parsed = JSON.parse(readFileSync(new URL("data.json", dir), "utf8"));
try {
  parsed.usage = parsed.usage || {};
  parsed.usage.commits = Number(execSync("git rev-list --count HEAD", { cwd: new URL(".", dir) }).toString().trim());
} catch {}
const data = JSON.stringify(parsed);
let products = "null";
try { products = readFileSync(new URL("products.json", dir), "utf8"); } catch {}

const html = `<title>The Six-Cent Show — Live Dashboard</title>
<style>
${css}
</style>
<div id="root"></div>
<script>
window.SHOW_DATA = ${data.trim()};
window.SHOW_PRODUCTS = ${products.trim()};
</script>
<script>
${js}
</script>
`;

writeFileSync(out, html);
console.log(`wrote ${out} (${html.length} bytes)`);
