"use strict";

const ESC = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pctClass = v => (v == null ? "" : v > 0 ? "up" : v < 0 ? "down" : "");
const fmtPct = v => (v == null ? "—" : (v > 0 ? "+" : "") + Number(v).toFixed(2) + "%");
const fmtNum = v => (v == null ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 10 ? 4 : 2 }));
const fmtTime = s => (s ? String(s).replace("T", " ").replace("Z", " UTC") : "");

let MARKET = { dates: [], rows: [] }, MACRO = { rows: [] }, CALLS = { rows: [] }, M1 = { slices: [], holdings: [] };
const chart = { selected: new Set(), range: "1Y" };
const PALETTE = ["#34536b", "#b3681f", "#157a3f", "#7b3fa0", "#0f8a9b", "#b3261e", "#8a6d1f", "#4a7a8c", "#a86fc0", "#5a9e6a", "#888"];

async function getJSON(url, fallback) {
  try { const r = await fetch(url); if (!r.ok) throw 0; return await r.json(); }
  catch (e) { return fallback; }
}

async function load() {
  [MARKET, MACRO, CALLS, M1] = await Promise.all([
    getJSON("data/market.json", { dates: [], rows: [] }),
    getJSON("data/macro.json", { rows: [] }),
    getJSON("data/calls.json", { rows: [] }),
    getJSON("data/lyn_m1.json", { slices: [], holdings: [] }),
  ]);
  renderAll();
}

function renderAll() {
  document.getElementById("as-of").textContent = MARKET.as_of ? "Prices as of " + fmtTime(MARKET.as_of) : "";
  document.getElementById("foot-updated").textContent = MARKET.as_of ? " · updated " + fmtTime(MARKET.as_of) : "";
  renderMovers();
  renderTables();
  initChart();
  renderMacro();
  renderCalls();
  renderM1();
}

function renderMovers() {
  const moved = MARKET.rows.filter(r => r.d1 != null);
  const up = [...moved].sort((a, b) => b.d1 - a.d1).slice(0, 3);
  const dn = [...moved].sort((a, b) => a.d1 - b.d1).slice(0, 3);
  const card = r => `<div class="card"><div class="cname">${ESC(r.name)}</div>` +
    `<div class="cprice">${fmtNum(r.price)}</div><div class="cpct ${pctClass(r.d1)}">${fmtPct(r.d1)}</div></div>`;
  document.getElementById("movers").innerHTML = moved.length ? up.map(card).join("") + dn.map(card).join("") : `<div class="muted small">Updating…</div>`;
}

function renderTables() {
  const order = [], by = {};
  for (const r of MARKET.rows) { if (!by[r.category]) { by[r.category] = []; order.push(r.category); } by[r.category].push(r); }
  let html = "";
  for (const c of order) {
    html += `<h3>${ESC(c)}</h3><table class="mkt"><thead><tr><th>Name</th><th>Ticker</th>` +
      `<th class="r">Price</th><th class="r">1D</th><th class="r">1W</th><th class="r">1M</th><th class="r">YTD</th></tr></thead><tbody>`;
    for (const r of by[c]) {
      html += `<tr><td>${ESC(r.name)}</td><td class="tk">${ESC(r.ticker)}</td><td class="r">${fmtNum(r.price)}</td>` +
        ["d1", "w1", "m1", "ytd"].map(k => `<td class="r ${pctClass(r[k])}">${fmtPct(r[k])}</td>`).join("") + `</tr>`;
    }
    html += `</tbody></table>`;
  }
  document.getElementById("tables").innerHTML = html;
}

function renderMacro() {
  const rows = MACRO.rows || [];
  const any = rows.some(m => m.val != null);
  const note = any ? "" : `<div class="muted small">Macro updates on a schedule via GitHub Action.</div>`;
  document.getElementById("macro").innerHTML = note + rows.map(m => {
    const val = m.val == null ? "—" : Number(m.val).toLocaleString(undefined, { maximumFractionDigits: 2 }) + (m.unit || "");
    const d = m.delta == null ? "" : `<div class="cpct ${pctClass(m.delta)}">${(m.delta > 0 ? "+" : "") + Number(m.delta).toFixed(2)}</div>`;
    return `<div class="card"><div class="cname">${ESC(m.name)}</div><div class="cprice">${val}</div>${d}</div>`;
  }).join("");
}

function initChart() {
  const have = MARKET.rows.filter(r => r.closes && r.closes.length);
  chart.selected = new Set();
  ["^GSPC", "GLD", "BTC-USD"].forEach(t => { if (have.find(r => r.ticker === t)) chart.selected.add(t); });
  if (!chart.selected.size && have[0]) chart.selected.add(have[0].ticker);
  const ranges = ["1M", "3M", "6M", "YTD", "1Y"];
  const rb = ranges.map(r => `<button class="rng ${r === chart.range ? "active" : ""}" data-rng="${r}">${r}</button>`).join("");
  const cbs = have.map(r => `<label class="cb"><input type="checkbox" data-tk="${ESC(r.ticker)}" ${chart.selected.has(r.ticker) ? "checked" : ""}>${ESC(r.ticker)}</label>`).join("");
  document.getElementById("chart-controls").innerHTML = `<div class="rngs">${rb}</div><div class="cbs">${cbs}</div>`;
  document.querySelectorAll(".rng").forEach(b => b.addEventListener("click", () => {
    chart.range = b.dataset.rng;
    document.querySelectorAll(".rng").forEach(x => x.classList.toggle("active", x === b));
    drawChart();
  }));
  document.querySelectorAll(".cbs input").forEach(c => c.addEventListener("change", () => {
    c.checked ? chart.selected.add(c.dataset.tk) : chart.selected.delete(c.dataset.tk);
    drawChart();
  }));
  drawChart();
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

function drawChart() {
  const el = document.getElementById("chart");
  const dates = MARKET.dates || [];
  const start = rangeStart(dates, chart.range);
  const series = [];
  let pi = 0;
  for (const tk of chart.selected) {
    const r = MARKET.rows.find(x => x.ticker === tk);
    if (!r || !r.closes) continue;
    const slice = r.closes.slice(start);
    const base = slice.find(v => v != null);
    if (base == null) continue;
    series.push({ tk, color: PALETTE[pi++ % PALETTE.length], reb: slice.map(v => (v == null ? null : (v / base) * 100)) });
  }
  if (!series.length) { el.innerHTML = `<div class="muted small">Select one or more instruments.</div>`; return; }
  const len = Math.max(...series.map(s => s.reb.length));
  let lo = Infinity, hi = -Infinity;
  series.forEach(s => s.reb.forEach(v => { if (v != null) { if (v < lo) lo = v; if (v > hi) hi = v; } }));
  if (!isFinite(lo)) { el.innerHTML = `<div class="muted small">No data for this range.</div>`; return; }
  const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
  const W = 900, H = 320, L = 42, R = 12, T = 12, B = 20;
  const px = i => L + (len <= 1 ? 0 : (i / (len - 1)) * (W - L - R));
  const py = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  let grid = "";
  for (let g = 0; g <= 4; g++) { const v = lo + ((hi - lo) * g) / 4; const y = py(v); grid += `<line x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}" class="grid"/><text x="4" y="${(y + 3).toFixed(1)}" class="axis">${v.toFixed(0)}</text>`; }
  let base100 = "";
  if (100 >= lo && 100 <= hi) { const y = py(100); base100 = `<line x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}" class="base100"/>`; }
  const paths = series.map(s => {
    let d = "", started = false;
    s.reb.forEach((v, i) => { if (v == null) return; d += (started ? "L" : "M") + px(i).toFixed(1) + " " + py(v).toFixed(1) + " "; started = true; });
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="1.6"/>`;
  }).join("");
  const legend = series.map(s => `<span class="lg"><span class="sw" style="background:${s.color}"></span>${ESC(s.tk)}</span>`).join("");
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="lc">${grid}${base100}${paths}</svg><div class="legend">${legend}</div>`;
}

function stanceTag(s) {
  s = s || "";
  const cls = ["bullish", "accumulate"].includes(s) ? "up" : ["bearish", "avoid", "trim"].includes(s) ? "down" : "";
  return `<span class="${cls}">${ESC(s)}</span>`;
}

function renderCalls() {
  const rows = CALLS.rows || [];
  if (!rows.length) { document.getElementById("calls").innerHTML = `<div class="muted small">No saved positioning.</div>`; return; }
  const order = [], by = {};
  for (const r of rows) {
    const k = r.issue_date + "|" + r.title;
    if (!by[k]) { by[k] = { date: r.issue_date, title: r.title, regime: r.regime_signal, items: [] }; order.push(k); }
    by[k].items.push(r);
  }
  order.sort((a, b) => String(by[b].date).localeCompare(String(by[a].date)));
  let html = "";
  for (const k of order) {
    const g = by[k];
    html += `<details open><summary>${ESC(g.date)} — ${ESC(g.title)} · ${g.items.length} calls · regime: ${ESC(g.regime)}</summary>` +
      `<table class="calls"><thead><tr><th>Asset</th><th>Instrument</th><th>Stance</th><th>Conv.</th><th>Horizon</th><th>Ticker</th><th>Rationale</th><th>Evidence</th></tr></thead><tbody>`;
    for (const it of g.items) {
      html += `<tr><td>${ESC(it.asset_class)}</td><td>${ESC(it.instrument)}</td><td>${stanceTag(it.stance)}</td>` +
        `<td>${ESC(it.conviction)}</td><td>${ESC(it.time_horizon)}</td><td class="tk">${ESC(it.ticker)}</td>` +
        `<td class="rat">${ESC(it.rationale)}</td><td class="ev">${ESC(it.evidence_quote)}</td></tr>`;
    }
    html += `</tbody></table></details>`;
  }
  document.getElementById("calls").innerHTML = html;
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
    holds.map(h => `<tr><td>${ESC(h.slice)}</td><td class="tk">${ESC(h.ticker)}</td><td>${ESC(h.name)}</td><td class="r">${Number(h.in_slice_pct).toFixed(0)}%</td><td class="r">${Number(h.portfolio_pct).toFixed(2)}%</td></tr>`).join("") +
    `</tbody></table></details>`;
  document.getElementById("m1").innerHTML =
    `<div class="muted small">Her real-money newsletter portfolio, transcribed from the June 4, 2026 issue (~$159.9k, +203% since 2018 inception).</div>` +
    `<div class="m1grid"><div>${table}</div><div class="donutwrap">${donut}<div class="legend2">${legend}</div></div></div>${hold}`;
}

document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === b));
  document.getElementById("tab-markets").classList.toggle("hidden", b.dataset.tab !== "markets");
  document.getElementById("tab-lyn").classList.toggle("hidden", b.dataset.tab !== "lyn");
}));

load();
