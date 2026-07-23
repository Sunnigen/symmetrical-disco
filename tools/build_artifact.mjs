#!/usr/bin/env node
// Builds the owner's artifact mirror of the storefront: one self-contained HTML
// fragment (no doctype/html/head/body — the artifact host wraps it) with
// data.json + products.json inlined.
// Usage: node tools/build_artifact.mjs <output-path>

import { readFileSync, writeFileSync } from "node:fs";

const out = process.argv[2];
if (!out) { console.error("usage: build_artifact.mjs <output-path>"); process.exit(1); }

const dir = new URL("../site/", import.meta.url);
const css = readFileSync(new URL("style.css", dir), "utf8");
const js = readFileSync(new URL("app.js", dir), "utf8");
const data = readFileSync(new URL("data.json", dir), "utf8");
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
