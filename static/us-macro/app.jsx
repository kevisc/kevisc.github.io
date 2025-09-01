/* @jsx React.createElement */
/* @jsxFrag React.Fragment */
// US Macro Visualizer — JSX compiled in-browser with Babel Standalone.
// Libraries are UMD globals: React, ReactDOM, Recharts.

const { useState, useMemo, useEffect } = React;
const {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer, Brush
} = Recharts;

// -------------------- Config --------------------
const ORANGE = "#f97316";
const NEUTRAL = "#6b7280";
const GRAY = "#a3a3a3";

// Predefined FRED series (id, label, metadata)
const SERIES = [
  { id: "FEDFUNDS", label: "Fed Funds Rate (EFFR)", units: "%", freq: "D|M", category: "Rates", isPriceUSD: false },
  { id: "UNRATE", label: "Unemployment rate (U-3)", units: "%", freq: "M", category: "Labor", isPriceUSD: false },
  { id: "CPIAUCSL", label: "CPI-U (All items, SA, Index 1982-84=100)", units: "index", freq: "M", category: "Prices", isPriceUSD: false },
  { id: "M2SL", label: "M2 money stock (SA, $ billions)", units: "USDbn", freq: "M", category: "Money & Credit", isPriceUSD: true },
  { id: "GFDEBTN", label: "Federal debt: total public ($ millions, NSA, quarterly)", units: "USDmn", freq: "Q", category: "Fiscal", isPriceUSD: true },
  { id: "CSUSHPINSA", label: "Case-Shiller US National HPI (NSA, Jan2000=100)", units: "index", freq: "M", category: "Housing", isPriceUSD: false },
  { id: "POPTOTUSA647NWDB", label: "Population, total (World Bank)", units: "people", freq: "A", category: "Population", isPriceUSD: false },
  // Denominators for unit conversions:
  { id: "GOLDAMGBD228NLBM", label: "Gold price (London AM USD/oz, daily)", units: "USD/oz", freq: "D", category: "Denominators", isPriceUSD: false, isDenominator: "gold" },
  { id: "CBBTCUSD", label: "Bitcoin price (USD, Coinbase, daily)", units: "USD/BTC", freq: "D", category: "Denominators", isPriceUSD: false, isDenominator: "btc" },
];

// Sensible defaults (you can change in UI)
const DEFAULTS = {
  fredApiKey: "",
  start: "1990-01-01",
  end: new Date().toISOString().slice(0,10),
  series1: "FEDFUNDS",
  series2: "UNRATE",
  transform1: "level",  // level | yoy | index
  transform2: "level",
  deflateByCPI: false,  // applies to price-like series in USD (where meaningful)
  unitMode: "usd",      // usd | gold | btc
  smoothMonths: 0,      // 0 (none), 3, 6, 12
};

// -------------------- Utilities --------------------
const parseNumber = (x) => (x === "." || x === "" || x == null ? null : Number(x));
function dstr(date) { return date instanceof Date ? date.toISOString().slice(0,10) : String(date).slice(0,10); }

function endOfMonthStr(iso) {
  const d = new Date(iso + "T00:00:00Z");
  const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return dstr(nd);
}

function toMonthly(series) {
  // series: [{date:"YYYY-MM-DD", value:Number|null}] daily|monthly|quarterly|annual -> monthly by avg for period
  // We'll aggregate by YYYY-MM.
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
  // Aggregate monthly into quarterly average
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
    const endMonth = q*3 + 2; // quarter end month index
    const endDate = new Date(Date.UTC(Number(yqY), endMonth+1, 0));
    if (arr.length) out.push({ date: dstr(endDate), value: arr.reduce((a,b)=>a+b,0)/arr.length });
    else out.push({ date: dstr(endDate), value: null });
  }
  out.sort((a,b)=>a.date.localeCompare(b.date));
  return out;
}

function yoy(series) {
  const idx = new Map(series.map((r,i)=>[r.date,i]));
  const out = series.map((r)=>({date:r.date, value:null}));
  for (let i=0;i<series.length;i++) {
    const d = new Date(series[i].date + "T00:00:00Z");
    const prev = new Date(Date.UTC(d.getUTCFullYear()-1, d.getUTCMonth(), 1));
    const prevKey = dstr(prev);
    const j = idx.get(prevKey);
    if (j!=null && series[i].value!=null && series[j].value!=null && series[j].value!==0) {
      out[i] = { date: series[i].date, value: (series[i].value/series[j].value - 1)*100 };
    }
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
  // Align by date (monthly), apply deflation/units
  const {
    cpiSeries, deflateByCPI, unitMode, metaA, metaB
  } = options;

  // Index by date
  const mapA = new Map(a.map(r=>[r.date, r.value]));
  const mapB = new Map(b.map(r=>[r.date, r.value]));
  const mapCPI = new Map((cpiSeries||[]).map(r=>[r.date, r.value]));
  const mapGold = new Map((denomGold||[]).map(r=>[r.date, r.value]));
  const mapBTC = new Map((denomBTC||[]).map(r=>[r.date, r.value]));

  const allDates = Array.from(new Set([...a.map(r=>r.date), ...b.map(r=>r.date)])).sort();

  function convert(val, date, meta){
    if (val==null) return null;
    let x = val;

    // Deflate by CPI if requested and series is a price-like thing (USD)
    if (deflateByCPI && meta && (meta.isPriceUSD || meta.id==="CSUSHPINSA")) {
      const cpi = mapCPI.get(date);
      if (cpi!=null && cpi!==0) {
        // real terms as ratio to CPI, normalized to 100 at 1990-01 if desired later
        x = x / cpi;
      }
    }

    // Unit mode conversion: usd -> gold oz or btc
    if (unitMode==="gold") {
      const g = mapGold.get(date);
      if (g!=null && g!==0) x = x / g;
      else x = null;
    } else if (unitMode==="btc") {
      const b = mapBTC.get(date);
      if (b!=null && b!==0) x = x / b;
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

// -------------------- Data access --------------------
async function fetchFredSeries({ apiKey, id, start, end }) {
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", id);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("observation_start", start);
  url.searchParams.set("observation_end", end);
  url.searchParams.set("sort_order", "asc");
  // Let FRED aggregate when possible:
  // (We'll still align to monthly client-side.)
  if (apiKey) url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), { mode: "cors" });
  if (!res.ok) throw new Error("FRED fetch failed: " + res.status);
  const j = await res.json();
  if (!j || !j.observations) throw new Error("FRED malformed response");
  return j.observations.map(o => ({ date: o.date.slice(0,10), value: parseNumber(o.value) }));
}

function loadCache(id) {
  try { return JSON.parse(localStorage.getItem("usm:cache:" + id) || "null"); } catch { return null; }
}
function saveCache(id, data) {
  try { localStorage.setItem("usm:cache:" + id, JSON.stringify({ t: Date.now(), data })); } catch {}
}

// Fallback tiny sample to avoid blank UI without a key (few monthly points)
const SAMPLE = {
  FEDFUNDS: [
    {date:"2023-01-01", value: 4.33},
    {date:"2023-07-01", value: 5.12},
    {date:"2024-01-01", value: 5.33},
    {date:"2024-07-01", value: 5.33},
    {date:"2025-01-01", value: 5.38},
  ],
  UNRATE: [
    {date:"2023-01-01", value: 3.4},
    {date:"2023-07-01", value: 3.5},
    {date:"2024-01-01", value: 3.7},
    {date:"2024-07-01", value: 4.1},
    {date:"2025-01-01", value: 4.3},
  ],
  CPIAUCSL: [
    {date:"2023-01-01", value: 300},
    {date:"2023-07-01", value: 307},
    {date:"2024-01-01", value: 309},
    {date:"2024-07-01", value: 315},
    {date:"2025-01-01", value: 318},
  ],
  GOLDAMGBD228NLBM: [
    {date:"2023-01-01", value: 1900},
    {date:"2023-07-01", value: 1960},
    {date:"2024-01-01", value: 2050},
    {date:"2024-07-01", value: 2350},
    {date:"2025-01-01", value: 2600},
  ],
  CBBTCUSD: [
    {date:"2023-01-01", value: 20000},
    {date:"2023-07-01", value: 30000},
    {date:"2024-01-01", value: 42000},
    {date:"2024-07-01", value: 65000},
    {date:"2025-01-01", value: 95000},
  ],
};

async function getSeries(id, start, end, apiKey) {
  const cached = loadCache(id);
  if (cached && cached.data && cached.data.length) {
    // Use cache but attempt background refresh (non-blocking)
    refreshSeries(id, start, end, apiKey);
    return cached.data;
  }
  try {
    const data = await fetchFredSeries({ apiKey, id, start, end });
    saveCache(id, data);
    return data;
  } catch (e) {
    console.warn("FRED fetch failed for", id, e);
    // Fallback to SAMPLE glance so UI isn't blank
    if (SAMPLE[id]) return SAMPLE[id];
    return [];
  }
}

async function refreshSeries(id, start, end, apiKey) {
  try {
    const data = await fetchFredSeries({ apiKey, id, start, end });
    saveCache(id, data);
  } catch (e) {
    // ignore refresh errors
  }
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

function NumberInput({ value, onChange, min, max, step=1 }) {
  return (
    <input type="number" value={value} onChange={e=>onChange(Number(e.target.value))}
      min={min} max={max} step={step}
      className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"/>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"/>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button onClick={()=>onChange(!checked)}
      className={"w-full text-left px-3 py-2 rounded-xl border " + (checked ? "border-orange-600 bg-orange-50 dark:bg-orange-950" : "border-neutral-300 dark:border-neutral-700")}>
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

function BtcLogo({ size=18 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none">
      <circle cx="12" cy="12" r="11" fill="#f97316" />
      <path d="M10 7h3.2a2.3 2.3 0 1 1 0 4.6H10m2.7 0A2.3 2.3 0 1 1 12.7 16H10" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 5.5v13M13.5 5.5v13" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// -------------------- Main App --------------------
function App() {
  const [fredApiKey, setFredApiKey] = useState(localStorage.getItem("usm:fredKey") || DEFAULTS.fredApiKey);
  const [start, setStart] = useState(localStorage.getItem("usm:start") || DEFAULTS.start);
  const [end, setEnd] = useState(localStorage.getItem("usm:end") || DEFAULTS.end);

  const [series1, setSeries1] = useState(localStorage.getItem("usm:s1") || DEFAULTS.series1);
  const [series2, setSeries2] = useState(localStorage.getItem("usm:s2") || DEFAULTS.series2);
  const [transform1, setTransform1] = useState(localStorage.getItem("usm:t1") || DEFAULTS.transform1);
  const [transform2, setTransform2] = useState(localStorage.getItem("usm:t2") || DEFAULTS.transform2);
  const [deflateByCPI, setDeflateByCPI] = useState(localStorage.getItem("usm:deflate")==="1" || DEFAULTS.deflateByCPI);
  const [unitMode, setUnitMode] = useState(localStorage.getItem("usm:unit") || DEFAULTS.unitMode);
  const [smoothMonths, setSmoothMonths] = useState(Number(localStorage.getItem("usm:smooth") || DEFAULTS.smoothMonths));

  useEffect(()=>localStorage.setItem("usm:fredKey", fredApiKey), [fredApiKey]);
  useEffect(()=>localStorage.setItem("usm:start", start), [start]);
  useEffect(()=>localStorage.setItem("usm:end", end), [end]);
  useEffect(()=>localStorage.setItem("usm:s1", series1), [series1]);
  useEffect(()=>localStorage.setItem("usm:s2", series2), [series2]);
  useEffect(()=>localStorage.setItem("usm:t1", transform1), [transform1]);
  useEffect(()=>localStorage.setItem("usm:t2", transform2), [transform2]);
  useEffect(()=>localStorage.setItem("usm:deflate", deflateByCPI ? "1":"0"), [deflateByCPI]);
  useEffect(()=>localStorage.setItem("usm:unit", unitMode), [unitMode]);
  useEffect(()=>localStorage.setItem("usm:smooth", String(smoothMonths)), [smoothMonths]);

  // Fetch needed series
  const meta1 = SERIES.find(s=>s.id===series1);
  const meta2 = SERIES.find(s=>s.id===series2);
  const cpiMeta = SERIES.find(s=>s.id==="CPIAUCSL");

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
        getSeries(meta1.id, start, end, fredApiKey),
        getSeries(meta2.id, start, end, fredApiKey),
        getSeries("CPIAUCSL", start, end, fredApiKey),
        getSeries("GOLDAMGBD228NLBM", start, end, fredApiKey),
        getSeries("CBBTCUSD", start, end, fredApiKey),
      ]);

      // Harmonize to monthly
      const m1 = toMonthly(s1);
      const m2 = toMonthly(s2);
      const mc = toMonthly(cpi);
      const mg = toMonthly(gold);
      const mb = toMonthly(btc);

      // Some quarterly/annual need special handling
      if (meta1.freq==="Q") setData1(toQuarterly(m1));
      else setData1(m1);
      if (meta2.freq==="Q") setData2(toQuarterly(m2));
      else setData2(m2);

      setCpiData(mc);
      setGoldData(mg);
      setBtcData(mb);
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ loadAll(); }, [series1, series2, start, end, fredApiKey]);

  // Transforms
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

  function exportCSV() {
    const lines = [];
    lines.push(["date", meta1.label, meta2.label].join(","));
    for (const r of merged) lines.push([r.date, r.A ?? "", r.B ?? ""].join(","));
    const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="us_macro.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const unitLabel = unitMode==="usd" ? "USD" : unitMode==="gold" ? "oz of gold" : "BTC";
  const leftY = (transform1==="yoy" || transform2==="yoy") ? "%" : (unitMode==="usd" ? "" : unitLabel);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-black dark:to-neutral-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <header className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white"><BtcLogo size={18}/></span>
              US Macro Visualizer
            </h1>
            <div className="flex gap-2">
              <button onClick={loadAll} className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">Refresh</button>
              <button onClick={exportCSV} className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">Export CSV</button>
            </div>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">Compare two U.S. macro time series. Fetches data from FRED (enter your API key below). You can deflate by CPI and denominate in gold or bitcoin.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card title="A. Series selection">
            <div className="grid gap-3">
              <Field label="FRED API key" hint="Get a free key at fred.stlouisfed.org; stored locally.">
                <TextInput value={fredApiKey} onChange={setFredApiKey} placeholder="FRED API key (optional for live data)"/>
              </Field>
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
              </div>

              {loading && <div className="text-sm text-neutral-500">Loading…</div>}
              {error && <div className="text-sm text-rose-600">Error: {error}</div>}

              <div className="text-xs text-neutral-500">
                Notes: Gold series is London AM fix (GOLDAMGBD228NLBM). Bitcoin price is CBBTCUSD (Coinbase). CPI is CPIAUCSL. House index is CSUSHPINSA. Debt is GFDEBTN (quarterly). Population is POPTOTUSA647NWDB (annual). The app averages to monthly and aligns by month.
              </div>
            </div>
          </Card>

          <div className="lg:col-span-2">
            <Card title="Chart" right={<span className="text-xs text-neutral-500">{unitMode !== "usd" ? "Unit: "+unitLabel : (transform1==="yoy" || transform2==="yoy" ? "% change" : "Level")}</span>}>
              <div className="w-full h-[460px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={merged} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(v)=>v.slice(0,7)} minTickGap={24}/>
                    <YAxis yAxisId="left" tickFormatter={(v)=>{
                      if (transform1==="yoy" || transform2==="yoy") return v.toFixed(1)+"%";
                      if (unitMode==="usd") return v>=1e12?("$"+(v/1e12).toFixed(1)+"T"): v>=1e9?("$"+(v/1e9).toFixed(1)+"B") : v>=1e6?("$"+(v/1e6).toFixed(1)+"M") : v>=1e3?("$"+(v/1e3).toFixed(0)+"k") : "$"+v.toFixed(0);
                      if (unitMode==="gold") return v.toFixed(4)+" oz";
                      if (unitMode==="btc") return v.toFixed(6)+" ₿";
                      return v.toFixed(2);
                    }}/>
                    <Tooltip formatter={(val, name)=>{
                      if (val==null) return ["", name];
                      if (transform1==="yoy" || transform2==="yoy") return [val.toFixed(2)+"%", name];
                      if (unitMode==="usd") return ["$"+Number(val).toLocaleString(undefined,{maximumFractionDigits:2}), name];
                      if (unitMode==="gold") return [Number(val).toFixed(6)+" oz", name];
                      if (unitMode==="btc") return [Number(val).toFixed(8)+" BTC", name];
                      return [String(val), name];
                    }} labelFormatter={(l)=>"Month "+l.slice(0,7)} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="A" name={meta1.label} stroke={ORANGE} dot={false} strokeWidth={2} />
                    <Line yAxisId="left" type="monotone" dataKey="B" name={meta2.label} stroke={NEUTRAL} dot={false} strokeWidth={2} />
                    <Brush dataKey="date" height={24} stroke={ORANGE}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
              <Card title="Quick combos">
                <div className="grid gap-2 text-sm">
                  <button onClick={()=>{setSeries1("CSUSHPINSA"); setSeries2("CPIAUCSL"); setDeflateByCPI(true); setTransform1("index"); setTransform2("index"); setUnitMode("usd");}} className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    Real house prices (Case-Shiller deflated by CPI)
                  </button>
                  <button onClick={()=>{setSeries1("GFDEBTN"); setSeries2("M2SL"); setTransform1("index"); setTransform2("index"); setUnitMode("usd");}} className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    Federal debt vs M2 (indexed)
                  </button>
                  <button onClick={()=>{setSeries1("FEDFUNDS"); setSeries2("UNRATE"); setTransform1("level"); setTransform2("level"); setUnitMode("usd");}} className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    Policy rate vs unemployment
                  </button>
                </div>
              </Card>

              <Card title="Series library">
                <div className="text-sm grid grid-cols-1 gap-1 max-h-64 overflow-auto pr-2">
                  {SERIES.filter(s=>!s.isDenominator).map(s=>(
                    <div key={s.id} className="flex items-center justify-between">
                      <span className="truncate">{s.category}: {s.label}</span>
                      <span className="text-xs text-neutral-500">{s.id}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="About & attribution">
                <div className="text-sm space-y-2">
                  <p>Data source: FRED® (Federal Reserve Bank of St. Louis). Use your own FRED API key for live data; small offline samples are included to demonstrate the UI if no key is provided.</p>
                  <p>Created by <b>Kevin Schoenholzer</b> with the help of <b>ChatGPT</b>, 2025.</p>
                </div>
              </Card>
            </div>
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
