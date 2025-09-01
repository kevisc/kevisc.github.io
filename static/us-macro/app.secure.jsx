/* @jsx React.createElement */
/* @jsxFrag React.Fragment */
// US Macro Visualizer — JSX compiled in-browser with Babel Standalone.
// Libraries are UMD globals: React, ReactDOM, Recharts.

const { useState, useMemo, useEffect } = React;
const {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer, Brush, AreaChart, Area
} = Recharts;

// -------------------- Config --------------------
const ORANGE = "#f97316";
const NEUTRAL = "#6b7280";
const GRAY = "#a3a3a3";

// Predefined series (FRED IDs). The app can fetch live from FRED with API key,
// or read local JSON caches at ./data/{ID}.json.
const SERIES = [
  { id: "FEDFUNDS", label: "Fed Funds Rate (EFFR)", units: "%", freq: "D|M", category: "Rates" },
  { id: "DGS10", label: "10Y Treasury Yield", units: "%", freq: "D|M", category: "Rates" },
  { id: "MORTGAGE30US", label: "30Y Mortgage Rate (avg)", units: "%", freq: "W|M", category: "Rates" },

  { id: "UNRATE", label: "Unemployment rate (U-3)", units: "%", freq: "M", category: "Labor" },
  { id: "PAYEMS", label: "Nonfarm payrolls (thousands)", units: "k", freq: "M", category: "Labor" },

  { id: "CPIAUCSL", label: "CPI-U (SA, 1982-84=100)", units: "index", freq: "M", category: "Prices" },
  { id: "CPILFESL", label: "Core CPI (SA, 1982-84=100)", units: "index", freq: "M", category: "Prices" },
  { id: "PCEPI", label: "PCE price index (2012=100)", units: "index", freq: "M", category: "Prices" },
  { id: "PCEPILFE", label: "Core PCE price index (2012=100)", units: "index", freq: "M", category: "Prices" },

  { id: "M2SL", label: "M2 money stock (SA, $ billions)", units: "USDbn", freq: "M", category: "Money & Credit", isPriceUSD: true },

  { id: "GFDEBTN", label: "Federal debt: total public ($ millions, NSA, Q)", units: "USDmn", freq: "Q", category: "Fiscal", isPriceUSD: true },
  { id: "GDP", label: "Nominal GDP (SAAR, $ billions, Q)", units: "USDbn", freq: "Q", category: "Output", isPriceUSD: true },
  { id: "GDPC1", label: "Real GDP (chained 2017 $, SAAR, Q)", units: "USDbn 2017$", freq: "Q", category: "Output" },

  { id: "CSUSHPINSA", label: "Case-Shiller US National HPI (NSA, Jan2000=100)", units: "index", freq: "M", category: "Housing" },
  { id: "MSPUS", label: "Median Sales Price of Houses (USD, Q)", units: "USD", freq: "Q", category: "Housing", isPriceUSD: true },
  { id: "INDPRO", label: "Industrial Production Index (2017=100)", units: "index", freq: "M", category: "Production" },
  { id: "RSXFS", label: "Retail and Food Services Sales (SA, Mil. USD)", units: "USDmn", freq: "M", category: "Spending", isPriceUSD: true },
  { id: "SP500", label: "S&P 500 index (daily)", units: "index", freq: "D|M", category: "Markets" },

  // Denominators
  { id: "GOLDAMGBD228NLBM", label: "Gold price (London AM USD/oz, daily)", units: "USD/oz", freq: "D", category: "Denominators", isDenominator: "gold" },
  { id: "CBBTCUSD", label: "Bitcoin price (USD, Coinbase, daily)", units: "USD/BTC", freq: "D", category: "Denominators", isDenominator: "btc" },
];

// Sensible defaults
const DEFAULTS = {
  start: "1990-01-01",
  end: new Date().toISOString().slice(0,10),
  series1: "FEDFUNDS",
  series2: "UNRATE",
  transform1: "level",  // level | yoy | index
  transform2: "level",
  deflateByCPI: false,
  unitMode: "usd",      // usd | gold | btc
  smoothMonths: 0,      // 0 (none), 3, 6, 12
  dualAxis: true,
  logScale: false,
  corrWindow: 0,        // months; 0 disables
  showRatioAB: false,
};

// -------------------- Utilities --------------------
const parseNumber = (x) => (x === "." || x === "" || x == null ? null : Number(x));
function dstr(date) { return date instanceof Date ? date.toISOString().slice(0,10) : String(date).slice(0,10); }

function toMonthly(series) {
  const buckets = new Map();
  for (const row of series) {
    const [y,m] = row.date.split("-");
    const key = y + "-" + m + "-01";
    if (!buckets.has(key)) buckets.set(key, []);
    if (row.value != null && isFinite(row.value)) buckets.get(key).push(row.value);
  }
  const out = [];
  for (const [key, arr] of buckets) {
    if (arr.length) out.push({ date: key, value: arr.reduce((a,b)=>a+b,0)/arr.length });
    else out.push({ date: key, value: null });
  }
  out.sort((a,b)=>a.date.localeCompare(b.date));
  return out;
}

function toQuarterly(series) {
  const buckets = new Map();
  for (const row of series) {
    const d = new Date(row.date + "T00:00:00Z");
    const q = Math.floor(d.getUTCMonth()/3)+1;
    const key = d.getUTCFullYear() + "-Q" + q;
    if (!buckets.has(key)) buckets.set(key, []);
    if (row.value != null && isFinite(row.value)) buckets.get(key).push(row.value);
  }
  const out = [];
  for (const [key, arr] of buckets) {
    const [yqY, qstr] = key.split("-Q");
    const q = Number(qstr)-1;
    const endMonth = q*3 + 2;
    const endDate = new Date(Date.UTC(Number(yqY), endMonth+1, 0));
    if (arr.length) out.push({ date: dstr(endDate), value: arr.reduce((a,b)=>a+b,0)/arr.length });
    else out.push({ date: dstr(endDate), value: null });
  }
  out.sort((a,b)=>a.date.localeCompare(b.date));
  return out;
}

function yoy(series) {
  const m = new Map(series.map(r=>[r.date,r.value]));
  const out = series.map(r=>({date:r.date,value:null}));
  for (let i=0;i<series.length;i++) {
    const d = new Date(series[i].date + "T00:00:00Z");
    const prev = new Date(Date.UTC(d.getUTCFullYear()-1, d.getUTCMonth(), 1));
    const prevKey = dstr(prev);
    const vPrev = m.get(prevKey);
    const vNow = series[i].value;
    if (vPrev!=null && vPrev!==0 && vNow!=null) out[i].value = (vNow/vPrev - 1)*100;
  }
  return out;
}

function index100(series, baseDate) {
  let base = null;
  for (const r of series) if (r.date >= baseDate && r.value!=null) { base = r.value; break; }
  if (base == null || base === 0) return series.map(r=>({date:r.date, value:null}));
  return series.map(r => ({ date: r.date, value: (r.value/base)*100 }));
}

function movingAverage(series, windowMonths) {
  if (!windowMonths) return series;
  const vals = series.map(r=>r.value==null?null:r.value);
  const out = series.map(r=>({date:r.date, value:null}));
  let sum=0, cnt=0;
  const q = [];
  for (let i=0;i<vals.length;i++) {
    q.push(vals[i]);
    if (vals[i]!=null){ sum+=vals[i]; cnt++; }
    if (q.length>windowMonths){
      const first=q.shift();
      if (first!=null){ sum-=first; cnt--; }
    }
    out[i].value = cnt? (sum/cnt): null;
  }
  return out;
}

function alignAndMerge(a, b, denomGold, denomBTC, options) {
  const { cpiSeries, deflateByCPI, unitMode, metaA, metaB } = options;
  const mapA = new Map(a.map(r=>[r.date, r.value]));
  const mapB = new Map(b.map(r=>[r.date, r.value]));
  const mapCPI = new Map((cpiSeries||[]).map(r=>[r.date, r.value]));
  const mapGold = new Map((denomGold||[]).map(r=>[r.date, r.value]));
  const mapBTC  = new Map((denomBTC||[]).map(r=>[r.date, r.value]));
  const allDates = Array.from(new Set([...a.map(r=>r.date), ...b.map(r=>r.date)])).sort();

  function convert(val, date, meta){
    if (val==null) return null;
    let x = val;
    if (deflateByCPI && meta && (meta.isPriceUSD || meta.id==="CSUSHPINSA" || meta.id==="SP500" || meta.id==="GDP" || meta.id==="RSXFS" || meta.id==="MSPUS")) {
      const c = mapCPI.get(date);
      if (c!=null && c!==0) x = x / c;
    }
    if (unitMode==="gold") {
      const g = mapGold.get(date);
      if (g!=null && g!==0) x = x / g;
      else x = null;
    } else if (unitMode==="btc") {
      const p = mapBTC.get(date);
      if (p!=null && p!==0) x = x / p;
      else x = null;
    }
    return x;
  }

  const merged = allDates.map(d => ({
    date: d,
    A: convert(mapA.get(d), d, metaA),
    B: convert(mapB.get(d), d, metaB)
  }));
  return merged;
}

function rollingCorrelation(merged, windowMonths) {
  if (!windowMonths) return [];
  const valsA = merged.map(r=>r.A);
  const valsB = merged.map(r=>r.B);
  const out = merged.map((r)=>({date:r.date, value:null}));
  for (let i=0;i<merged.length;i++) {
    const j = i - windowMonths + 1;
    if (j<0) continue;
    const a = valsA.slice(j, i+1).filter(v=>v!=null);
    const b = valsB.slice(j, i+1).filter(v=>v!=null);
    const n = Math.min(a.length, b.length);
    if (n < windowMonths*0.7) continue;
    const aa = a.slice(0, n), bb = b.slice(0, n);
    const meanA = aa.reduce((x,y)=>x+y,0)/n;
    const meanB = bb.reduce((x,y)=>x+y,0)/n;
    const cov = aa.reduce((s, v, k)=>s + (v-meanA)*(bb[k]-meanB), 0) / n;
    const sdA = Math.sqrt(aa.reduce((s, v)=>s + (v-meanA)**2, 0)/n);
    const sdB = Math.sqrt(bb.reduce((s, v)=>s + (v-meanB)**2, 0)/n);
    out[i].value = (sdA>0 && sdB>0) ? (cov/(sdA*sdB)) : null;
  }
  return out;
}

// -------------------- Data access --------------------
async function fetchLocalSeries(id) {
  try {
    const res = await fetch("./data/" + id + ".json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const arr = await res.json();
    if (!Array.isArray(arr)) throw new Error("Malformed JSON for " + id);
    return arr;
  } catch (e) {
    return null; // explicit null means "not available locally"
  }
}

async function fetchFredSeries({ apiKey, id, start, end }) {
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", id);
  url.searchParams.set("file_type", "json");
  if (start) url.searchParams.set("observation_start", start);
  if (end) url.searchParams.set("observation_end", end);
  url.searchParams.set("sort_order", "asc");
  if (apiKey) url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), { mode: "cors" });
  if (!res.ok) throw new Error("FRED fetch failed: " + res.status);
  const j = await res.json();
  if (!j || !j.observations) throw new Error("FRED malformed response");
  return j.observations.map(o => ({ date: o.date.slice(0,10), value: (o.value==="."? null : Number(o.value)) }));
}

// Tiny samples as last resort
const SAMPLE = {
  FEDFUNDS: [{date:"2023-01-01",value:4.33},{date:"2024-01-01",value:5.33},{date:"2025-01-01",value:5.38}],
  DGS10:    [{date:"2023-01-01",value:3.6},{date:"2024-01-01",value:4.1},{date:"2025-01-01",value:3.9}],
  MORTGAGE30US:[{date:"2023-01-01",value:6.3},{date:"2024-01-01",value:6.6},{date:"2025-01-01",value:6.0}],

  UNRATE:   [{date:"2023-01-01",value:3.4},{date:"2024-01-01",value:3.7},{date:"2025-01-01",value:4.2}],
  PAYEMS:   [{date:"2023-01-01",value:155000},{date:"2024-01-01",value:157000},{date:"2025-01-01",value:158000}],

  CPIAUCSL: [{date:"2023-01-01",value:300},{date:"2024-01-01",value:309},{date:"2025-01-01",value:318}],
  CPILFESL: [{date:"2023-01-01",value:300},{date:"2024-01-01",value:307},{date:"2025-01-01",value:314}],
  PCEPI:    [{date:"2023-01-01",value:116},{date:"2024-01-01",value:118},{date:"2025-01-01",value:121}],
  PCEPILFE: [{date:"2023-01-01",value:115},{date:"2024-01-01",value:117},{date:"2025-01-01",value:120}],

  M2SL:     [{date:"2023-01-01",value:21000},{date:"2024-01-01",value:20650},{date:"2025-01-01",value:20500}],

  GFDEBTN:  [{date:"2023-03-31",value:31800000},{date:"2024-03-31",value:34000000},{date:"2025-03-31",value:35500000}],
  GDP:      [{date:"2023-03-31",value:26500},{date:"2024-03-31",value:28100},{date:"2025-03-31",value:29000}],
  GDPC1:    [{date:"2023-03-31",value:19800},{date:"2024-03-31",value:20400},{date:"2025-03-31",value:20800}],

  CSUSHPINSA:[{date:"2023-01-01",value:300},{date:"2024-01-01",value:325},{date:"2025-01-01",value:340}],
  MSPUS:    [{date:"2023-03-31",value:420000},{date:"2024-03-31",value:450000},{date:"2025-03-31",value:470000}],
  INDPRO:    [{date:"2023-01-01",value:105},{date:"2024-01-01",value:103},{date:"2025-01-01",value:104}],
  RSXFS:     [{date:"2023-01-01",value:700000},{date:"2024-01-01",value:735000},{date:"2025-01-01",value:760000}],
  SP500:     [{date:"2023-01-01",value:3900},{date:"2024-01-01",value:4800},{date:"2025-01-01",value:5600}],

  GOLDAMGBD228NLBM:[{date:"2023-01-01",value:1900},{date:"2024-01-01",value:2050},{date:"2025-01-01",value:2600}],
  CBBTCUSD:        [{date:"2023-01-01",value:20000},{date:"2024-01-01",value:42000},{date:"2025-01-01",value:95000}],
};

// Smart loader: opt-in live FRED (with toggle) -> local JSON -> SAMPLE fallback.
async function getSeriesSmart(id, start, end, apiKey, useLiveFred) {
  if (apiKey && useLiveFred) {
    try { return await fetchFredSeries({ apiKey, id, start, end }); }
    catch (e) { console.warn("FRED fetch failed for", id, e); }
  }
  const local = await fetchLocalSeries(id);
  if (local) return local;
  return SAMPLE[id] || [];
}

// -------------------- Components --------------------
function Field({ label, children, hint }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-neutral-500">{label}</span>
      {children}
      {hint && <span className="text-xs text-neutral-400">{hint}</span>}
    </label>
  );
}

function Select({ value, onChange, children }) {
  return (
    <select value={value} onChange={(e)=>onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900">
      {children}
    </select>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"/>
  );
}

function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button onClick={()=>!disabled && onChange(!checked)}
      className={"w-full text-left px-3 py-2 rounded-xl border " + (checked ? "border-orange-600 bg-orange-50 dark:bg-orange-950" : "border-neutral-300 dark:border-neutral-700") + (disabled ? " opacity-50 cursor-not-allowed" : "")}>
      {label}: <b>{checked ? "On" : "Off"}</b>
    </button>
  );
}

function Card({ title, right, children }) {
  return (
    <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur rounded-2xl shadow p-5 border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function MacroLogo({ size=18 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <rect x="3" y="10" width="3" height="10" rx="1" fill={NEUTRAL} />
      <rect x="9" y="6" width="3" height="14" rx="1" fill={NEUTRAL} />
      <rect x="15" y="3" width="3" height="17" rx="1" fill={ORANGE} />
      <path d="M3 4l6 4 6-3 6 5" stroke={ORANGE} strokeWidth="1.8" fill="none" />
    </svg>
  );
}

// -------------------- Main App --------------------
function App() {
  const [fredApiKey, setFredApiKey] = useState(localStorage.getItem("usm:fredKey") || "");
  const [useLiveFred, setUseLiveFred] = useState(localStorage.getItem("usm:useLiveFred")==="1" ? true : false);

  const [start, setStart] = useState(localStorage.getItem("usm:start") || DEFAULTS.start);
  const [end, setEnd] = useState(localStorage.getItem("usm:end") || DEFAULTS.end);

  const [series1, setSeries1] = useState(localStorage.getItem("usm:s1") || DEFAULTS.series1);
  const [series2, setSeries2] = useState(localStorage.getItem("usm:s2") || DEFAULTS.series2);
  const [transform1, setTransform1] = useState(localStorage.getItem("usm:t1") || DEFAULTS.transform1);
  const [transform2, setTransform2] = useState(localStorage.getItem("usm:t2") || DEFAULTS.transform2);
  const [deflateByCPI, setDeflateByCPI] = useState(localStorage.getItem("usm:deflate")==="1" || DEFAULTS.deflateByCPI);
  const [unitMode, setUnitMode] = useState(localStorage.getItem("usm:unit") || DEFAULTS.unitMode);
  const [smoothMonths, setSmoothMonths] = useState(Number(localStorage.getItem("usm:smooth") || DEFAULTS.smoothMonths));
  const [dualAxis, setDualAxis] = useState((localStorage.getItem("usm:dual") ?? "1") === "1");
  const [logScale, setLogScale] = useState(localStorage.getItem("usm:log")==="1" || DEFAULTS.logScale);
  const [corrWindow, setCorrWindow] = useState(Number(localStorage.getItem("usm:corr") || DEFAULTS.corrWindow));
  const [showRatioAB, setShowRatioAB] = useState(localStorage.getItem("usm:ratio")==="1" || DEFAULTS.showRatioAB);

  useEffect(()=>localStorage.setItem("usm:fredKey", fredApiKey), [fredApiKey]);
  useEffect(()=>localStorage.setItem("usm:useLiveFred", useLiveFred? "1":"0"), [useLiveFred]);
  useEffect(()=>localStorage.setItem("usm:start", start), [start]);
  useEffect(()=>localStorage.setItem("usm:end", end), [end]);
  useEffect(()=>localStorage.setItem("usm:s1", series1), [series1]);
  useEffect(()=>localStorage.setItem("usm:s2", series2), [series2]);
  useEffect(()=>localStorage.setItem("usm:t1", transform1), [transform1]);
  useEffect(()=>localStorage.setItem("usm:t2", transform2), [transform2]);
  useEffect(()=>localStorage.setItem("usm:deflate", deflateByCPI ? "1":"0"), [deflateByCPI]);
  useEffect(()=>localStorage.setItem("usm:unit", unitMode), [unitMode]);
  useEffect(()=>localStorage.setItem("usm:smooth", String(smoothMonths)), [smoothMonths]);
  useEffect(()=>localStorage.setItem("usm:dual", dualAxis ? "1":"0"), [dualAxis]);
  useEffect(()=>localStorage.setItem("usm:log", logScale ? "1":"0"), [logScale]);
  useEffect(()=>localStorage.setItem("usm:corr", String(corrWindow)), [corrWindow]);
  useEffect(()=>localStorage.setItem("usm:ratio", showRatioAB ? "1":"0"), [showRatioAB]);

  const meta1 = SERIES.find(s=>s.id===series1);
  const meta2 = SERIES.find(s=>s.id===series2);

  const [data1, setData1] = useState([]);
  const [data2, setData2] = useState([]);
  const [cpiData, setCpiData] = useState([]);
  const [goldData, setGoldData] = useState([]);
  const [btcData, setBtcData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAll() {
    setLoading(true); setError("");
    try {
      const [s1, s2, cpi, gold, btc] = await Promise.all([
        getSeriesSmart(meta1.id, start, end, fredApiKey, useLiveFred),
        getSeriesSmart(meta2.id, start, end, fredApiKey, useLiveFred),
        getSeriesSmart("CPIAUCSL", start, end, fredApiKey, useLiveFred),
        getSeriesSmart("GOLDAMGBD228NLBM", start, end, fredApiKey, useLiveFred),
        getSeriesSmart("CBBTCUSD", start, end, fredApiKey, useLiveFred),
      ]);

      const inRange = (d) => (!start || d.date>=start) && (!end || d.date<=end);

      const m1 = toMonthly(s1.filter(inRange));
      const m2 = toMonthly(s2.filter(inRange));
      const mc = toMonthly(cpi.filter(inRange));
      const mg = toMonthly(gold.filter(inRange));
      const mb = toMonthly(btc.filter(inRange));

      setData1(meta1.freq==="Q" ? toQuarterly(m1) : m1);
      setData2(meta2.freq==="Q" ? toQuarterly(m2) : m2);
      setCpiData(mc); setGoldData(mg); setBtcData(mb);
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(()=>{ loadAll(); }, [series1, series2, start, end, fredApiKey, useLiveFred]);

  const tData1 = useMemo(()=>{
    let s = data1;
    if (transform1==="yoy") s = yoy(s);
    if (transform1==="index") s = index100(s, start);
    if (smoothMonths) s = movingAverage(s, smoothMonths);
    return s;
  }, [data1, transform1, start, smoothMonths]);

  const tData2 = useMemo(()=>{
    let s = data2;
    if (transform2==="yoy") s = yoy(s);
    if (transform2==="index") s = index100(s, start);
    if (smoothMonths) s = movingAverage(s, smoothMonths);
    return s;
  }, [data2, transform2, start, smoothMonths]);

  const merged = useMemo(()=> alignAndMerge(
    tData1, tData2, goldData, btcData,
    { cpiSeries: cpiData, deflateByCPI, unitMode, metaA: meta1, metaB: meta2 }
  ), [tData1, tData2, goldData, btcData, cpiData, deflateByCPI, unitMode, meta1, meta2]);

  const ratioAB = useMemo(()=> merged.map(r => ({ date: r.date, value: (r.A!=null && r.B!=null && r.B!==0) ? (r.A / r.B) : null })), [merged]);
  const corr = useMemo(()=> rollingCorrelation(merged, corrWindow), [merged, corrWindow]);

  function exportCSV() {
    const lines = [];
    lines.push(["date", meta1.label, meta2.label, showRatioAB ? "A/B" : undefined].filter(Boolean).join(","));
    for (let i=0;i<merged.length;i++) {
      const r = merged[i];
      const row = [r.date, r.A ?? "", r.B ?? ""];
      if (showRatioAB) row.push(ratioAB[i].value ?? "");
      lines.push(row.join(","));
    }
    const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="us_macro.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const unitLabel = unitMode==="usd" ? "USD" : unitMode==="gold" ? "oz of gold" : "BTC";
  const anyYoY = (transform1==="yoy" || transform2==="yoy");
  const canLog = !anyYoY && merged.every(r => (r.A==null || r.A>0) && (r.B==null || r.B>0));

  async function testFred() {
    try {
      const ping = await fetchFredSeries({ apiKey: fredApiKey, id: "UNRATE", start, end });
      alert(ping && ping.length ? "FRED API OK. Points: " + ping.length : "FRED OK, but empty data.");
    } catch (e) {
      alert("FRED error: " + (e.message || e));
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-black dark:to-neutral-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <header className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white"><MacroLogo size={18}/></span>
              US Macro Visualizer
            </h1>
            <div className="flex gap-2">
              <button onClick={loadAll} className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">Reload</button>
              <button onClick={exportCSV} className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">Export CSV</button>
            </div>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
            Compare two U.S. macro time series. Prefer static JSON caches for reliability; optionally enable live FRED fetch (may be blocked by CORS on some networks).
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card title="A. Data & series settings">
            <div className="grid gap-3">
              <div className="grid grid-cols-1 gap-3">
                <Field label="FRED API key (optional)" hint="Stored in your browser. Exposed client-side.">
                  <div className="flex gap-2">
                    <TextInput value={fredApiKey} onChange={setFredApiKey} placeholder="Paste your FRED API key"/>
                    <button onClick={testFred} className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">Test</button>
                  </div>
                </Field>
                <Field label="Use live FRED fetch">
                  <Toggle checked={useLiveFred} onChange={setUseLiveFred} label="Fetch from FRED (experimental; may be blocked by CORS)" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Series 1">
                  <Select value={series1} onChange={setSeries1}>
                    {SERIES.filter(s=>!s.isDenominator).map(s => <option key={s.id} value={s.id}>{s.category}: {s.label}</option>)}
                  </Select>
                </Field>
                <Field label="Transform">
                  <Select value={transform1} onChange={setTransform1}>
                    <option value="level">Level</option>
                    <option value="yoy">YoY %</option>
                    <option value="index">Index: 100 at start</option>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Series 2">
                  <Select value={series2} onChange={setSeries2}>
                    {SERIES.filter(s=>!s.isDenominator).map(s => <option key={s.id} value={s.id}>{s.category}: {s.label}</option>)}
                  </Select>
                </Field>
                <Field label="Transform">
                  <Select value={transform2} onChange={setTransform2}>
                    <option value="level">Level</option>
                    <option value="yoy">YoY %</option>
                    <option value="index">Index: 100 at start</option>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Start">
                  <TextInput value={start} onChange={setStart} />
                </Field>
                <Field label="End">
                  <TextInput value={end} onChange={setEnd} />
                </Field>
                <Field label="Smoothing">
                  <Select value={String(smoothMonths)} onChange={(v)=>setSmoothMonths(Number(v))}>
                    <option value="0">None</option>
                    <option value="3">3-month MA</option>
                    <option value="6">6-month MA</option>
                    <option value="12">12-month MA</option>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Units">
                  <Select value={unitMode} onChange={setUnitMode}>
                    <option value="usd">USD</option>
                    <option value="gold">Gold ounces</option>
                    <option value="btc">Bitcoin</option>
                  </Select>
                </Field>
                <Field label="Deflation">
                  <Toggle checked={deflateByCPI} onChange={setDeflateByCPI} label="Deflate by CPI (real)" />
                </Field>
                <Field label="Dual axis">
                  <Toggle checked={dualAxis} onChange={setDualAxis} label="Separate Y scales" />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Log scale (Y)">
                  <Toggle checked={logScale} onChange={setLogScale} label="Logarithmic Y" disabled={!(! (transform1==='yoy' || transform2==='yoy') && merged.every(r => (r.A==null || r.A>0) && (r.B==null || r.B>0)))} />
                </Field>
                <Field label="A/B ratio panel">
                  <Toggle checked={showRatioAB} onChange={setShowRatioAB} label="Show A ÷ B" />
                </Field>
                <Field label="Rolling correlation">
                  <Select value={String(corrWindow)} onChange={(v)=>setCorrWindow(Number(v))}>
                    <option value="0">Off</option>
                    <option value="6">6 months</option>
                    <option value="12">12 months</option>
                    <option value="24">24 months</option>
                    <option value="60">60 months</option>
                  </Select>
                </Field>
              </div>

              {loading && <div className="text-sm text-neutral-500">Loading…</div>}
              {error && <div className="text-sm text-rose-600">Error: {error}</div>}
            </div>
          </Card>

          <div className="lg:col-span-2">
            <Card title="Chart" right={<span className="text-xs text-neutral-500">{(transform1==="yoy" || transform2==="yoy") ? "% change" : (unitMode==="usd" ? "Level (USD or native units)" : ("Unit: " + (unitMode==="gold"?"oz of gold":"BTC")))}</span>}>
              <div className="w-full h-[460px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={merged} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(v)=>v.slice(0,7)} minTickGap={24}/>
                    <YAxis yAxisId="left" scale={(! (transform1==='yoy' || transform2==='yoy') && merged.every(r => (r.A==null || r.A>0) && (r.B==null || r.B>0)) && logScale) ? "log" : "auto"} domain={["auto","auto"]} tickFormatter={(v)=>{
                      if (transform1==="yoy" || transform2==="yoy") return (v==null?"":v.toFixed(1)+"%");
                      if (unitMode==="usd") return v>=1e12?("$"+(v/1e12).toFixed(1)+"T"): v>=1e9?("$"+(v/1e9).toFixed(1)+"B") : v>=1e6?("$"+(v/1e6).toFixed(1)+"M") : v>=1e3?("$"+(v/1e3).toFixed(0)+"k") : "$"+(Math.round(v));
                      if (unitMode==="gold") return v.toFixed(4)+" oz";
                      if (unitMode==="btc") return v.toFixed(6)+" ₿";
                      return v?.toFixed ? v.toFixed(2) : v;
                    }}/>
                    {true && <YAxis yAxisId="right" orientation="right" scale={(! (transform1==='yoy' || transform2==='yoy') && merged.every(r => (r.A==null || r.A>0) && (r.B==null || r.B>0)) && logScale) ? "log" : "auto"} domain={["auto","auto"]} tickFormatter={(v)=>{
                      if (transform1==="yoy" || transform2==="yoy") return (v==null?"":v.toFixed(1)+"%");
                      if (unitMode==="usd") return v>=1e12?("$"+(v/1e12).toFixed(1)+"T"): v>=1e9?("$"+(v/1e9).toFixed(1)+"B") : v>=1e6?("$"+(v/1e6).toFixed(1)+"M") : v>=1e3?("$"+(v/1e3).toFixed(0)+"k") : "$"+(Math.round(v));
                      if (unitMode==="gold") return v.toFixed(4)+" oz";
                      if (unitMode==="btc") return v.toFixed(6)+" ₿";
                      return v?.toFixed ? v.toFixed(2) : v;
                    }}/>
                    }
                    <Tooltip formatter={(val, name)=>{
                      if (val==null) return ["", name];
                      if (transform1==="yoy" || transform2==="yoy") return [Number(val).toFixed(2)+"%", name];
                      if (unitMode==="usd") return ["$"+Number(val).toLocaleString(undefined,{maximumFractionDigits:2}), name];
                      if (unitMode==="gold") return [Number(val).toFixed(6)+" oz", name];
                      if (unitMode==="btc") return [Number(val).toFixed(8)+" BTC", name];
                      return [String(val), name];
                    }} labelFormatter={(l)=>"Month "+l.slice(0,7)} />
                    <Legend />
                    <Line yAxisId="left"  type="monotone" dataKey="A" name={meta1.label} stroke={ORANGE} dot={false} strokeWidth={2} />
                    <Line yAxisId={"right"} type="monotone" dataKey="B" name={meta2.label} stroke={NEUTRAL} dot={false} strokeWidth={2} />
                    <Brush dataKey="date" height={24} stroke={ORANGE}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="About & attribution">
              <div className="text-sm space-y-2">
                <p><b>Created by Kevin Schoenholzer</b> with the help of <b>ChatGPT</b>, 2025. <i>Educational purposes only.</i></p>
                <p>Data sources: local JSON caches (<code>static/us-macro/data/*.json</code>) or the FRED API when enabled.</p>
              </div>
            </Card>
          </div>
        </div>

        <footer className="mt-8 text-xs text-neutral-500">
          Built for educational illustration. The tool aggregates frequencies to monthly averages, ignores revisions, and is not investment advice.
        </footer>
      </div>
    </div>
  );
}

// Mount the app
ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
