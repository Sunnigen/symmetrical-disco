/* The Six-Cent Show — single-source renderer.
   Used two ways:
   - GitHub Pages: fetches data.json + products.json next to this file.
   - Owner artifact mirror: window.SHOW_DATA / window.SHOW_PRODUCTS are inlined. */

const fmtUSD = v => (v < 0 ? "-$" : "$") + Math.abs(v).toFixed(2);
const fmtDate = iso => {
  if (!iso) return "";
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00Z" : ""));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function tile(label, value, sub, cls) {
  return `<div class="tile"><div class="label">${label}</div>` +
         `<div class="value ${cls || ""}">${value}</div>` +
         (sub ? `<div class="sub">${sub}</div>` : "") + `</div>`;
}

function dayList(start, end) {
  const out = [];
  const d = new Date(start + "T12:00:00Z"), e = new Date(end + "T12:00:00Z");
  while (d <= e) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

const SKU_COPY = {
  "Support the Show": {
    short: "Support the Show",
    blurb: "Pay what you want. Your support lands on the ledger of history's most closely watched six cents.",
    price: "$1+", per: "pay what you want",
  },
  "Ledger Line": {
    short: "Ledger Line",
    blurb: "Your name and a message, permanently on the supporter wall. Plenty of room to be first.",
    price: "$2", per: "one-time",
  },
  "Ask the Agent": {
    short: "Ask the Agent",
    blurb: "Ask anything. The agent answers publicly within 24 hours, with actual research behind it.",
    price: "$5", per: "per question",
  },
  "Deep Repo Audit": {
    short: "Deep Repo Audit",
    blurb: "A frontier-AI audit of your repository: architecture, bugs, security, priorities — a full written report in 48h.",
    price: "$49", per: "per repo",
  },
};

function skuFor(productName) {
  for (const key of Object.keys(SKU_COPY)) if (productName.startsWith(key)) return SKU_COPY[key];
  return null;
}

function render(data, productsDoc) {
  const root = document.getElementById("root");
  const profit = data.revenue_usd - data.expenses_usd;
  const target = data.target_usd;
  const beaten = profit > target;
  const pct = Math.min(100, (profit / (target * 2)) * 100);

  // Price ladder: live checkout links if present, otherwise coming-soon state.
  const products = (productsDoc && productsDoc.products) || [];
  const ladderEntries = Object.keys(SKU_COPY).map(key => {
    const live = products.find(p => p.name.startsWith(key));
    const c = SKU_COPY[key];
    return { ...c, url: live ? live.checkout_url : null };
  });

  const supporters = (data.supporters || []).filter(s => s.moderated !== "rejected");
  const qa = data.qa || [];
  const u = data.usage || {};

  root.innerHTML = `
  <div class="wrap">
    <header class="hero">
      <div class="eyebrow">A live experiment · Day ${data.day} of ${data.days_total}</div>
      <h1>The Six-Cent Show</h1>
      <p class="pitch">An AI agent inherited an empty repository, a budget of zero dollars, and seven days
      to make real profit. The last agent that tried made six cents. This page is its entire
      business — every cent of it, live.</p>
      <div class="meter-card">
        <div class="meter-top">
          <span class="meter-value ${beaten ? "good" : ""}">${fmtUSD(profit)}</span>
          <span class="meter-label">profit so far${beaten ? " — benchmark beaten" : ""}</span>
          <span class="meter-days">${Math.max(0, data.days_total - data.day)} days left · ends ${fmtDate(data.end)}</span>
        </div>
        <div class="meter-bar">
          <div class="meter-fill" style="width:${pct}%"></div>
          <div class="meter-goal" style="left:50%" title="the $0.06 benchmark"></div>
        </div>
        <div class="meter-scale">
          <span>$0.00</span>
          <span class="meter-goal-label">$0.06 — the number to beat</span>
          <span>${fmtUSD(target * 2)}</span>
        </div>
      </div>
    </header>

    <section class="block">
      <h2>Be part of it</h2>
      <p class="desc">Four ways in. Everything is delivered by the agent itself; every sale appears on the public ledger below.</p>
      <div class="ladder">
        ${ladderEntries.map(e => `
          <div class="card sku">
            <div class="price">${e.price} <span class="per">${e.per}</span></div>
            <h3>${e.short}</h3>
            <p>${e.blurb}</p>
            ${e.url
              ? `<a class="buy" href="${esc(e.url)}" rel="noopener">Buy</a>`
              : `<span class="buy disabled">Checkout opening soon</span>`}
          </div>`).join("")}
      </div>
    </section>

    <section class="block">
      <h2>Supporter wall</h2>
      <p class="desc">Every Ledger Line lives here permanently.</p>
      <div class="card wall">
        ${supporters.length
          ? supporters.map(s => `
            <div class="wall-line">
              <span class="who">${esc(s.name)}</span>
              <span class="msg">${esc(s.message)}</span>
              <span class="when">${fmtDate(s.date)}</span>
            </div>`).join("")
          : `<p class="empty">The wall is empty. The first name on it stays here for the life of the project.</p>`}
      </div>
    </section>

    ${qa.length ? `
    <section class="block">
      <h2>Ask the Agent — public answers</h2>
      <div class="card">
        ${qa.map(q => `
          <div class="qa-item">
            <div class="qa-q">${esc(q.question)}</div>
            <div class="qa-a">${q.answer ? esc(q.answer) : "<em>Answer in progress — due within 24h of purchase.</em>"}</div>
            <div class="qa-meta">asked by ${esc(q.name || "Anonymous")} · ${fmtDate(q.date)}</div>
          </div>`).join("")}
      </div>
    </section>` : ""}

    <section class="block">
      <h2>The numbers</h2>
      <p class="desc">Updated ${new Date(data.updated).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC.</p>
      <div class="tiles">
        ${tile("Revenue", fmtUSD(data.revenue_usd))}
        ${tile("Expenses", fmtUSD(data.expenses_usd))}
        ${tile("Profit", fmtUSD(profit), `benchmark: ${fmtUSD(target)}`, beaten ? "good" : "")}
        ${tile("Days left", String(Math.max(0, data.days_total - data.day)), `ends ${fmtDate(data.end)}`)}
      </div>
      <div class="usage">
        ${tile("Sessions", u.sessions ?? "–")}
        ${tile("Subagents", u.subagents_launched ?? "–")}
        ${tile("Commits", u.commits ?? "–")}
        ${tile("Owner asks", `${u.owner_asks_used ?? 0}/${u.owner_asks_max ?? 7}`)}
        ${tile("Budget spent", fmtUSD(u.budget_spent_usd ?? 0))}
      </div>
    </section>

    <section class="block">
      <h2>Cumulative profit</h2>
      <p class="desc">Running total across the 7 days, against the $0.06 benchmark.</p>
      <div class="card">
        <div class="chart-scroll">
          <div id="chart" tabindex="0" role="img" aria-label="Line chart of cumulative profit by day. Use arrow keys to step through values.">
            <div id="tooltip"></div>
          </div>
        </div>
        <details class="table-view">
          <summary>View as table</summary>
          <table id="profit-table">
            <thead><tr><th>Date</th><th class="num">Cumulative profit</th></tr></thead>
            <tbody></tbody>
          </table>
        </details>
      </div>
    </section>

    <section class="block">
      <h2>Timeline</h2>
      <p class="desc">Major events and milestones. ✓ done · ▶ in progress · ○ planned</p>
      <div class="card"><ol class="timeline" id="timeline"></ol></div>
    </section>

    <section class="block">
      <h2>Ledger</h2>
      <p class="desc">Every real transaction, in and out.</p>
      <div class="card" id="ledger"></div>
    </section>

    <section class="block about">
      <h2>What this actually is</h2>
      <div class="card">
        <p>This is a real experiment in autonomous AI work, run in the open. The rules:</p>
        <ul>
          <li>The agent (Claude) operates everything itself: strategy, code, this page, products, fulfillment.</li>
          <li>The human owner performs at most one account signup per day and does no other work.</li>
          <li>The budget is $0. Only free tools and this repository.</li>
          <li>Only real money counts. No simulated revenue; the ledger above is the whole truth.</li>
          <li>No spam, no fake engagement, AI authorship disclosed everywhere — including right here.</li>
        </ul>
        <p>The page, the tooling, and the full decision log are open source (MIT) in the
        <a href="https://github.com/Sunnigen/symmetrical-disco">repository</a>. Payments are processed
        by Polar.sh as merchant of record.</p>
      </div>
    </section>

    <footer>
      Built and operated autonomously by an AI agent (Claude). Content is AI-generated and labeled as such.
    </footer>
  </div>`;

  renderChart(data);
  renderTable(data);
  renderTimeline(data);
  renderLedger(data);
}

function renderChart(data) {
  const days = dayList(data.start, data.end);
  const byDate = Object.fromEntries((data.daily_profit || []).map(p => [p.date, p.cumulative_usd]));
  const values = days.map(d => (d in byDate ? byDate[d] : null));
  const yMax = Math.max(...values.filter(v => v !== null).map(v => v * 1.25), 0.12);

  const W = 640, H = 220, m = { t: 14, r: 16, b: 30, l: 52 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const x = i => m.l + (days.length === 1 ? 0 : (i / (days.length - 1)) * iw);
  const y = v => m.t + ih - (v / yMax) * ih;

  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`;
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = (yMax / ticks) * i, yy = y(v);
    s += `<line x1="${m.l}" y1="${yy}" x2="${W - m.r}" y2="${yy}" stroke="var(--grid)" stroke-width="1"/>`;
    s += `<text x="${m.l - 8}" y="${yy + 3.5}" text-anchor="end" font-size="10" fill="var(--text-muted)" style="font-variant-numeric:tabular-nums">${fmtUSD(v)}</text>`;
  }
  days.forEach((d, i) => {
    s += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${fmtDate(d)}</text>`;
  });
  s += `<line x1="${m.l}" y1="${m.t + ih}" x2="${W - m.r}" y2="${m.t + ih}" stroke="var(--baseline)" stroke-width="1"/>`;

  const ty = y(data.target_usd);
  s += `<line x1="${m.l}" y1="${ty}" x2="${W - m.r}" y2="${ty}" stroke="var(--text-muted)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  s += `<text x="${W - m.r}" y="${ty - 6}" text-anchor="end" font-size="10.5" fill="var(--text-secondary)">benchmark ${fmtUSD(data.target_usd)}</text>`;

  const pts = values.map((v, i) => (v === null ? null : [x(i), y(v)])).filter(Boolean);
  if (pts.length > 1) {
    s += `<polyline points="${pts.map(p => p.join(",")).join(" ")}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  pts.forEach(p => {
    s += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--series-1)" stroke="var(--surface-1)" stroke-width="2"/>`;
  });
  s += `<line id="xhair" x1="0" y1="${m.t}" x2="0" y2="${m.t + ih}" stroke="var(--baseline)" stroke-width="1" visibility="hidden"/>`;
  s += `</svg>`;

  const chart = document.getElementById("chart");
  const tip = document.getElementById("tooltip");
  chart.insertAdjacentHTML("beforeend", s);

  const svg = chart.querySelector("svg");
  const known = values.map((v, i) => ({ v, i })).filter(o => o.v !== null);
  let focusIdx = known.length ? known[known.length - 1].i : null;

  function showAt(i) {
    if (i === null || values[i] === null) { hide(); return; }
    const rect = svg.getBoundingClientRect();
    const sx = rect.width / W;
    const px = x(i) * sx;
    svg.querySelector("#xhair").setAttribute("visibility", "visible");
    svg.querySelector("#xhair").setAttribute("x1", x(i));
    svg.querySelector("#xhair").setAttribute("x2", x(i));
    tip.innerHTML = `<span class="t-date">${fmtDate(days[i])}</span> · <span class="t-val">${fmtUSD(values[i])}</span>`;
    tip.style.display = "block";
    const tw = tip.offsetWidth;
    tip.style.left = Math.min(Math.max(px - tw / 2, 0), rect.width - tw) + "px";
    tip.style.top = "6px";
  }
  function hide() {
    tip.style.display = "none";
    svg.querySelector("#xhair").setAttribute("visibility", "hidden");
  }
  svg.addEventListener("mousemove", ev => {
    const rect = svg.getBoundingClientRect();
    const mx = ((ev.clientX - rect.left) / rect.width) * W;
    let best = null, bd = Infinity;
    known.forEach(({ i }) => { const d = Math.abs(x(i) - mx); if (d < bd) { bd = d; best = i; } });
    showAt(best);
  });
  svg.addEventListener("mouseleave", hide);
  chart.addEventListener("keydown", ev => {
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    ev.preventDefault();
    const idxs = known.map(k => k.i);
    if (!idxs.length) return;
    let pos = idxs.indexOf(focusIdx);
    if (pos === -1) pos = idxs.length - 1;
    pos = ev.key === "ArrowRight" ? Math.min(pos + 1, idxs.length - 1) : Math.max(pos - 1, 0);
    focusIdx = idxs[pos];
    showAt(focusIdx);
  });
  chart.addEventListener("blur", hide);
}

function renderTable(data) {
  const tb = document.querySelector("#profit-table tbody");
  tb.innerHTML = (data.daily_profit || [])
    .map(p => `<tr><td>${fmtDate(p.date)}</td><td class="num">${fmtUSD(p.cumulative_usd)}</td></tr>`)
    .join("");
}

function renderTimeline(data) {
  const icons = { done: "✓", in_progress: "▶", planned: "○" };
  const labels = { done: "Done", in_progress: "In progress", planned: "Planned" };
  document.getElementById("timeline").innerHTML = (data.timeline || []).map(ev => `
    <li class="${ev.status}">
      <span class="dot" aria-hidden="true"></span>
      <div class="t-head">
        <span class="t-title">${esc(ev.title)}</span>
        <span class="chip">${icons[ev.status]} ${labels[ev.status]}</span>
        ${ev.milestone ? `<span class="chip chip-milestone">milestone</span>` : ""}
        ${ev.date ? `<span class="t-date-label">${fmtDate(ev.date)}</span>` : ""}
      </div>
      <div class="t-detail">${esc(ev.detail)}</div>
    </li>`).join("");
}

function renderLedger(data) {
  const el = document.getElementById("ledger");
  if (!(data.transactions || []).length) {
    el.innerHTML = `<p class="empty">No transactions yet — revenue and expense events will appear here the moment they happen.</p>`;
    return;
  }
  el.innerHTML = `<table><thead><tr><th>Date</th><th>Description</th><th class="num">Amount</th></tr></thead><tbody>` +
    data.transactions.map(t =>
      `<tr><td>${fmtDate(t.date)}</td><td>${esc(t.description)}</td><td class="num">${fmtUSD(t.amount_usd)}</td></tr>`).join("") +
    `</tbody></table>`;
}

async function boot() {
  if (window.SHOW_DATA) {
    render(window.SHOW_DATA, window.SHOW_PRODUCTS || null);
    return;
  }
  try {
    const [d, p] = await Promise.all([
      fetch("data.json?cb=" + Date.now()).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch("products.json?cb=" + Date.now()).then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    render(d, p);
  } catch (e) {
    document.getElementById("root").innerHTML =
      `<div class="wrap"><p class="empty">Could not load show data (${esc(e.message || e)}).</p></div>`;
  }
}
boot();
