"use strict";

const ESC = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pctClass = v => (v == null ? "" : v > 0 ? "up" : v < 0 ? "down" : "");
const fmtPct = v => (v == null ? "—" : (v > 0 ? "+" : "") + Number(v).toFixed(2) + "%");
const fmtNum = v => (v == null ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 10 ? 4 : 2 }));
const fmtTime = s => (s ? String(s).replace("T", " ").replace("Z", " UTC") : "");
const PALETTE = ["#34536b", "#b3681f", "#157a3f", "#7b3fa0", "#0f8a9b", "#b3261e", "#8a6d1f", "#4a7a8c", "#a86fc0", "#5a9e6a", "#888"];

let MARKET = { dates: [], rows: [] }, MACRO = { rows: [] }, INTL = { indicators: [], countries: [], data: {} }, CALLS = { rows: [] }, M1 = { slices: [], holdings: [] };
const chart = { selected: new Set(), range: "1Y" };
const sortState = { key: null, dir: "desc" };
const intlState = { ind: null, countries: new Set() };
let macroPick = 0;

async function getJSON(url, fb) { try { const r = await fetch(url); if (!r.ok) throw 0; return await r.json(); } catch (e) { return fb; } }

async function load() {
  [MARKET, MACRO, INTL, CALLS, M1] = await Promise.all([
    getJSON("data/market.json", { dates: [], rows: [] }),
    getJSON("data/macro.json", { rows: [] }),
    getJSON("data/intl.json", { indicators: [], countries: [], data: {} }),
    getJSON("data/calls.json", { rows: [] }),
    getJSON("data/lyn_m1.json", { slices: [], holdings: [] }),
  ]);
  renderAll();
}

function renderAll() {
  document.getElementById("as-of").textContent = MARKET.as_of ? "Prices as of " + fmtTime(MARKET.as_of) : "";
  document.getElementById("foot-updated").textContent = MARKET.as_of ? " · updated " + fmtTime(MARKET.as_of) : "";
  renderMovers();
  renderSortBar();
  renderTables();
  initMarketChart();
  renderIntl();
  renderUSMacro();
  renderCalls();
  renderM1();
}

/* ---------------------------------------------------------------- generic line chart */
function seriesChart(el, series, opts = {}) {
  series = series.filter(s => s.pts && s.pts.length);
  if (!series.length) { el.innerHTML = `<div class="muted small">No data.</div>`; return; }
  const xs = [...new Set(series.flatMap(s => s.pts.map(p => String(p[0]))))].sort();
  const aligned = series.map(s => { const m = new Map(s.pts.map(p => [String(p[0]), p[1]])); return { label: s.label, color: s.color, v: xs.map(x => (m.has(x) ? m.get(x) : null)) }; });
  let lo = Infinity, hi = -Infinity;
  aligned.forEach(s => s.v.forEach(v => { if (v != null) { if (v < lo) lo = v; if (v > hi) hi = v; } }));
  if (opts.baseline != null) { lo = Math.min(lo, opts.baseline); hi = Math.max(hi, opts.baseline); }
  if (!isFinite(lo)) { el.innerHTML = `<div class="muted small">No data.</div>`; return; }
  const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
  const W = 900, H = 300, L = 46, R = 12, T = 12, Bm = 22, n = xs.length;
  const px = i => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R));
  const py = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - Bm);
  let grid = "";
  for (let g = 0; g <= 4; g++) { const v = lo + ((hi - lo) * g) / 4, y = py(v); grid += `<line x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}" class="grid"/><text x="4" y="${(y + 3).toFixed(1)}" class="axis">${v.toFixed(1)}</text>`; }
  let xlab = "";
  [0, Math.floor(n / 2), n - 1].forEach(i => { if (i >= 0 && i < n) xlab += `<text x="${px(i).toFixed(1)}" y="${H - 6}" class="axis" text-anchor="middle">${ESC(xs[i].slice(0, 7))}</text>`; });
  let base = "";
  if (opts.baseline != null && opts.baseline >= lo && opts.baseline <= hi) { const y = py(opts.baseline); base = `<line x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}" class="base100"/>`; }
  const paths = aligned.map(s => { let d = "", st = false; s.v.forEach((v, i) => { if (v == null) return; d += (st ? "L" : "M") + px(i).toFixed(1) + " " + py(v).toFixed(1) + " "; st = true; }); return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="1.6"/>`; }).join("");
  const legend = aligned.map(s => `<span class="lg"><span class="sw" style="background:${s.color}"></span>${ESC(s.label)}</span>`).join("");
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="lc">${grid}${base}${xlab}${paths}</svg><div class="legend">${legend}</div>`;
}

/* ----------------------------------------------------------------------------- markets */
function renderMovers() {
  const moved = MARKET.rows.filter(r => r.d1 != null);
  const up = [...moved].sort((a, b) => b.d1 - a.d1).slice(0, 3);
  const dn = [...moved].sort((a, b) => a.d1 - b.d1).slice(0, 3);
  const card = r => `<div class="card"><div class="cname">${ESC(r.name)}</div><div class="cprice">${fmtNum(r.price)}</div><div class="cpct ${pctClass(r.d1)}">${fmtPct(r.d1)}</div></div>`;
  document.getElementById("movers").innerHTML = moved.length ? up.map(card).join("") + dn.map(card).join("") : `<div class="muted small">Updating…</div>`;
}

const SORTKEYS = [["category", "By category"], ["d1", "1D"], ["w1", "1W"], ["m1", "1M"], ["ytd", "YTD"], ["price", "Price"]];
function renderSortBar() {
  document.getElementById("sort-controls").innerHTML = SORTKEYS.map(([k, lab]) => {
    const active = (k === "category" && sortState.key === null) || k === sortState.key;
    const arrow = k === sortState.key ? (sortState.dir === "desc" ? " ↓" : " ↑") : "";
    return `<button class="rng ${active ? "active" : ""}" data-sort="${k}">${lab}${arrow}</button>`;
  }).join("");
  document.querySelectorAll("#sort-controls .rng").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.sort;
    if (k === "category") { sortState.key = null; }
    else if (sortState.key === k) { sortState.dir = sortState.dir === "desc" ? "asc" : "desc"; }
    else { sortState.key = k; sortState.dir = "desc"; }
    renderSortBar(); renderTables();
  }));
}

function rowCells(r) {
  return `<td>${ESC(r.name)}</td><td class="tk">${ESC(r.ticker)}</td><td class="r">${fmtNum(r.price)}</td>` +
    ["d1", "w1", "m1", "ytd"].map(k => `<td class="r ${pctClass(r[k])}">${fmtPct(r[k])}</td>`).join("");
}
function renderTables() {
  const head = `<thead><tr><th>Name</th><th>Ticker</th><th class="r">Price</th><th class="r">1D</th><th class="r">1W</th><th class="r">1M</th><th class="r">YTD</th></tr></thead>`;
  let html;
  if (sortState.key) {
    const k = sortState.key, dir = sortState.dir === "desc" ? -1 : 1;
    const rows = MARKET.rows.filter(r => r[k] != null).sort((a, b) => (a[k] - b[k]) * dir)
      .concat(MARKET.rows.filter(r => r[k] == null));
    html = `<table class="mkt"><thead><tr><th>Category</th><th>Name</th><th>Ticker</th><th class="r">Price</th><th class="r">1D</th><th class="r">1W</th><th class="r">1M</th><th class="r">YTD</th></tr></thead><tbody>` +
      rows.map(r => `<tr><td class="cat">${ESC(r.category)}</td>${rowCells(r)}</tr>`).join("") + `</tbody></table>`;
  } else {
    const order = [], by = {};
    for (const r of MARKET.rows) { if (!by[r.category]) { by[r.category] = []; order.push(r.category); } by[r.category].push(r); }
    html = order.map(c => `<h3>${ESC(c)}</h3><table class="mkt">${head}<tbody>` +
      by[c].map(r => `<tr>${rowCells(r)}</tr>`).join("") + `</tbody></table>`).join("");
  }
  document.getElementById("tables").innerHTML = html;
}

function rangeStart(dates, range) {
  const n = dates.length;
  if (!n || range === "1Y") return 0;
  const last = new Date(dates[n - 1]);
  if (range === "YTD") { const y = last.getFullYear(); const i = dates.findIndex(d => new Date(d).getFullYear() === y); return i < 0 ? 0 : i; }
  const days = { "1M": 30, "3M": 91, "6M": 182 }[range];
  const cutoff = new Date(last); cutoff.setDate(cutoff.getDate() - days);
  const i = dates.findIndex(d => new Date(d) >= cutoff);
  return i < 0 ? 0 : i;
}
function initMarketChart() {
  const have = MARKET.rows.filter(r => r.closes && r.closes.length);
  chart.selected = new Set();
  ["^GSPC", "GLD", "BTC-USD"].forEach(t => { if (have.find(r => r.ticker === t)) chart.selected.add(t); });
  if (!chart.selected.size && have[0]) chart.selected.add(have[0].ticker);
  const ranges = ["1M", "3M", "6M", "YTD", "1Y"];
  const rb = ranges.map(r => `<button class="rng ${r === chart.range ? "active" : ""}" data-rng="${r}">${r}</button>`).join("");
  const cbs = have.map(r => `<label class="cb"><input type="checkbox" data-tk="${ESC(r.ticker)}" ${chart.selected.has(r.ticker) ? "checked" : ""}>${ESC(r.ticker)}</label>`).join("");
  document.getElementById("chart-controls").innerHTML = `<div class="rngs">${rb}</div><div class="cbs">${cbs}</div>`;
  document.querySelectorAll("#chart-controls .rng").forEach(b => b.addEventListener("click", () => { chart.range = b.dataset.rng; document.querySelectorAll("#chart-controls .rng").forEach(x => x.classList.toggle("active", x === b)); drawMarketChart(); }));
  document.querySelectorAll("#chart-controls input").forEach(c => c.addEventListener("change", () => { c.checked ? chart.selected.add(c.dataset.tk) : chart.selected.delete(c.dataset.tk); drawMarketChart(); }));
  drawMarketChart();
}
function drawMarketChart() {
  const dates = MARKET.dates || [], start = rangeStart(dates, chart.range);
  const xslice = dates.slice(start);
  let pi = 0; const series = [];
  for (const tk of chart.selected) {
    const r = MARKET.rows.find(x => x.ticker === tk); if (!r || !r.closes) continue;
    const sl = r.closes.slice(start); const base = sl.find(v => v != null); if (base == null) continue;
    const pts = sl.map((v, i) => (v == null ? null : [xslice[i], (v / base) * 100])).filter(Boolean);
    series.push({ label: tk, color: PALETTE[pi++ % PALETTE.length], pts });
  }
  seriesChart(document.getElementById("chart"), series, { baseline: 100 });
}

/* -------------------------------------------------------------------------------- macro */
function renderIntl() {
  const inds = INTL.indicators || [];
  if (!inds.length) { document.getElementById("intl-controls").innerHTML = `<div class="muted small">Updating…</div>`; return; }
  if (!intlState.ind || !inds.find(i => i.key === intlState.ind)) intlState.ind = inds[0].key;
  if (!intlState.countries.size) (INTL.countries || []).forEach(c => intlState.countries.add(c.code));
  const ib = inds.map(i => `<button class="rng ${i.key === intlState.ind ? "active" : ""}" data-ind="${i.key}">${ESC(i.name)}</button>`).join("");
  const cb = (INTL.countries || []).map(c => `<label class="cb"><input type="checkbox" data-cc="${c.code}" ${intlState.countries.has(c.code) ? "checked" : ""}>${ESC(c.name)}</label>`).join("");
  document.getElementById("intl-controls").innerHTML = `<div class="rngs">${ib}</div><div class="cbs">${cb}</div>`;
  document.querySelectorAll("#intl-controls .rng").forEach(b => b.addEventListener("click", () => { intlState.ind = b.dataset.ind; renderIntl(); }));
  document.querySelectorAll("#intl-controls input").forEach(c => c.addEventListener("change", () => { c.checked ? intlState.countries.add(c.dataset.cc) : intlState.countries.delete(c.dataset.cc); drawIntl(); }));
  drawIntl();
}
function drawIntl() {
  const ind = intlState.ind, per = (INTL.data || {})[ind] || {};
  const meta = (INTL.indicators || []).find(i => i.key === ind) || {};
  const baseline = { NGDP_RPCH: 0, GGXCNL_NGDP: 0, BCA_NGDPD: 0, HOUSING: 100 }[ind];
  const cs = (INTL.countries || []).filter(c => intlState.countries.has(c.code));
  let pi = 0; const series = cs.map(c => ({ label: c.name, color: PALETTE[pi++ % PALETTE.length], pts: per[c.code] || [] }));
  seriesChart(document.getElementById("intl-chart"), series, baseline != null ? { baseline } : {});
  // latest-values table
  const rows = cs.map(c => { const p = per[c.code] || []; const last = p[p.length - 1]; return { name: c.name, year: last ? last[0] : "—", val: last ? last[1] : null }; })
    .sort((a, b) => (b.val ?? -1e9) - (a.val ?? -1e9));
  document.getElementById("intl-table").innerHTML = `<table class="mkt"><thead><tr><th>Country</th><th class="r">Latest (${ESC(meta.unit || "")})</th><th class="r">As of</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td>${ESC(r.name)}</td><td class="r">${r.val == null ? "—" : Number(r.val).toFixed(1)}</td><td class="r tk">${ESC(r.year)}</td></tr>`).join("") + `</tbody></table>`;
  document.getElementById("intl-note").textContent = ind === "HOUSING"
    ? "Source: BIS real residential property prices (via FRED), rebased to 100 at the series start."
    : "Source: IMF World Economic Outlook (DataMapper). Recent/forward years are IMF estimates and projections.";
}
function renderUSMacro() {
  const rows = MACRO.rows || [];
  const any = rows.some(m => m.val != null);
  document.getElementById("usmacro").innerHTML = (any ? "" : `<div class="muted small">Macro updates on a schedule via GitHub Action.</div>`) +
    rows.map((m, i) => {
      const val = m.val == null ? "—" : Number(m.val).toLocaleString(undefined, { maximumFractionDigits: 2 }) + (m.unit || "");
      const d = m.delta == null ? "" : `<div class="cpct ${pctClass(m.delta)}">${(m.delta > 0 ? "+" : "") + Number(m.delta).toFixed(2)}</div>`;
      return `<div class="card sel ${i === macroPick ? "on" : ""}" data-i="${i}"><div class="cname">${ESC(m.name)}</div><div class="cprice">${val}</div>${d}</div>`;
    }).join("");
  document.querySelectorAll("#usmacro .card").forEach(c => c.addEventListener("click", () => { macroPick = +c.dataset.i; renderUSMacro(); }));
  const m = rows[macroPick];
  if (m && m.hist && m.hist.length) seriesChart(document.getElementById("usmacro-chart"), [{ label: m.name + (m.unit ? " (" + m.unit + ")" : ""), color: PALETTE[0], pts: m.hist }], {});
  else document.getElementById("usmacro-chart").innerHTML = `<div class="muted small">10-year history appears after the next data refresh.</div>`;
}

/* ----------------------------------------------------------------------------- lyn views */
function stanceTag(s) { s = s || ""; const cls = ["bullish", "accumulate"].includes(s) ? "up" : ["bearish", "avoid", "trim"].includes(s) ? "down" : ""; return `<span class="${cls}">${ESC(s)}</span>`; }
function renderCalls() {
  const rows = CALLS.rows || [];
  if (!rows.length) { document.getElementById("calls").innerHTML = `<div class="muted small">No saved positioning.</div>`; return; }
  const order = [], by = {};
  for (const r of rows) { const k = r.issue_date + "|" + r.title; if (!by[k]) { by[k] = { date: r.issue_date, title: r.title, regime: r.regime_signal, items: [] }; order.push(k); } by[k].items.push(r); }
  order.sort((a, b) => String(by[b].date).localeCompare(String(by[a].date)));
  document.getElementById("calls").innerHTML = order.map(k => {
    const g = by[k];
    return `<details open><summary>${ESC(g.date)} — ${ESC(g.title)} · ${g.items.length} calls · regime: ${ESC(g.regime)}</summary>` +
      `<table class="calls"><thead><tr><th>Asset</th><th>Instrument</th><th>Stance</th><th>Conv.</th><th>Horizon</th><th>Ticker</th><th>Rationale</th><th>Evidence</th></tr></thead><tbody>` +
      g.items.map(it => `<tr><td>${ESC(it.asset_class)}</td><td>${ESC(it.instrument)}</td><td>${stanceTag(it.stance)}</td><td>${ESC(it.conviction)}</td><td>${ESC(it.time_horizon)}</td><td class="tk">${ESC(it.ticker)}</td><td class="rat">${ESC(it.rationale)}</td><td class="ev">${ESC(it.evidence_quote)}</td></tr>`).join("") +
      `</tbody></table></details>`;
  }).join("");
}
function renderM1() {
  const slices = M1.slices || [], holds = M1.holdings || [];
  if (!slices.length) { document.getElementById("m1").innerHTML = `<div class="muted small">Unavailable.</div>`; return; }
  let acc = 0;
  const stops = slices.map((s, i) => { const a = acc; acc += Number(s.portfolio_pct); return `${PALETTE[i % PALETTE.length]} ${a}% ${acc}%`; }).join(",");
  const donut = `<div class="donut" style="background:conic-gradient(${stops})"></div>`;
  const legend = slices.map((s, i) => `<div class="lg2"><span class="sw" style="background:${PALETTE[i % PALETTE.length]}"></span>${ESC(s.slice)}&nbsp;<span class="muted">${Number(s.portfolio_pct).toFixed(1)}%</span></div>`).join("");
  const table = `<table class="m1"><thead><tr><th>Slice</th><th class="r">Weight</th></tr></thead><tbody>` +
    slices.map(s => `<tr><td>${ESC(s.slice)}</td><td class="r">${Number(s.portfolio_pct).toFixed(1)}%</td></tr>`).join("") + `</tbody></table>`;
  const hold = `<details><summary>All holdings (${holds.length} positions)</summary><table class="m1h"><thead><tr><th>Slice</th><th>Ticker</th><th>Name</th><th class="r">% of slice</th><th class="r">% of portfolio</th></tr></thead><tbody>` +
    holds.map(h => `<tr><td>${ESC(h.slice)}</td><td class="tk">${ESC(h.ticker)}</td><td>${ESC(h.name)}</td><td class="r">${Number(h.in_slice_pct).toFixed(0)}%</td><td class="r">${Number(h.portfolio_pct).toFixed(2)}%</td></tr>`).join("") + `</tbody></table></details>`;
  document.getElementById("m1").innerHTML = `<div class="muted small">Her real-money newsletter portfolio, transcribed from the June 4, 2026 issue (~$159.9k, +203% since 2018 inception).</div><div class="m1grid"><div>${table}</div><div class="donutwrap">${donut}<div class="legend2">${legend}</div></div></div>${hold}`;
}

document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === b));
  ["markets", "macro", "lyn"].forEach(t => document.getElementById("tab-" + t).classList.toggle("hidden", b.dataset.tab !== t));
}));

load();
