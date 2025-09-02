/* @jsx React.createElement */
/* @jsxFrag React.Fragment */
const { useState, useEffect, useMemo } = React;
const { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Brush } = Recharts;

const ACCENT = "#60a5fa";
const TEXT_MUTED = "#9ca3af";

function CapIcon({ size=18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 9l10-5 10 5-10 5L2 9z" fill={ACCENT}/>
      <path d="M6 12v4c0 1.1 2.686 2 6 2s6-.9 6-2v-4" stroke="#94a3b8" strokeWidth="1.5" fill="none"/>
    </svg>
  );
}

function Card({ title, right, children }) {
  return (
    <div className="bg-neutral-900/70 backdrop-blur rounded-2xl shadow p-5 border border-neutral-800 text-neutral-100">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs" style={{color:TEXT_MUTED}}>{label}</span>
      {children}
      {hint && <span className="text-xs" style={{color:TEXT_MUTED}}>{hint}</span>}
    </label>
  );
}

function Select({ value, onChange, children, className="" }) {
  return (
    <select value={value} onChange={(e)=>onChange(e.target.value)}
      className={"w-full px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-950 text-neutral-100 "+className}>
      {children}
    </select>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-950 text-neutral-100 placeholder-neutral-500"/>
  );
}

function CountryPicker({ options, value, onChange }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(function(){ 
    return options.filter(function(o){ 
      return (o.name.toLowerCase().includes(q.toLowerCase()) || o.code.toLowerCase().includes(q.toLowerCase()));
    }); 
  }, [q, options]);
  function toggle(code){ onChange(value.includes(code) ? value.filter(c=>c!==code) : [...value, code]); }
  return (
    <div className="border border-neutral-700 rounded-xl p-2 max-h-64 overflow-auto bg-neutral-950">
      <div className="mb-2">
        <input className="w-full px-3 py-2 rounded-lg border border-neutral-700 bg-neutral-950 text-neutral-100 placeholder-neutral-500" placeholder="Search countries…" value={q} onChange={e=>setQ(e.target.value)}/>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {filtered.map(opt => (
          <label key={opt.code} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-neutral-900 cursor-pointer">
            <input type="checkbox" checked={value.includes(opt.code)} onChange={()=>toggle(opt.code)}/>
            <span className="text-sm text-neutral-100">{opt.name}</span>
            <span className="text-xs" style={{color:TEXT_MUTED}}>({opt.code})</span>
          </label>
        ))}
      </div>
    </div>
  );
}

const WB_INDICATORS = [
  { code: "SE.PRM.ENRR", label: "Enrollment rate, primary (% gross)" },
  { code: "SE.SEC.ENRR", label: "Enrollment rate, secondary (% gross)" },
  { code: "SE.TER.ENRR", label: "Enrollment rate, tertiary (% gross)" },
  { code: "SE.ADT.LITR.ZS", label: "Literacy rate, adult total (% age 15+)" },
  { code: "SE.XPD.TOTL.GD.ZS", label: "Government education expenditure (% of GDP)" },
  { code: "NY.GDP.PCAP.KD", label: "GDP per capita (constant 2015 US$)" },
];

const COUNTRIES = [
  { code:"USA", name:"United States" },
  { code:"CAN", name:"Canada" },
  { code:"MEX", name:"Mexico" },
  { code:"BRA", name:"Brazil" },
  { code:"GBR", name:"United Kingdom" },
  { code:"FRA", name:"France" },
  { code:"DEU", name:"Germany" },
  { code:"NLD", name:"Netherlands" },
  { code:"CHE", name:"Switzerland" },
  { code:"ESP", name:"Spain" },
  { code:"ITA", name:"Italy" },
  { code:"SWE", name:"Sweden" },
  { code:"NOR", name:"Norway" },
  { code:"DNK", name:"Denmark" },
  { code:"FIN", name:"Finland" },
  { code:"AUS", name:"Australia" },
  { code:"NZL", name:"New Zealand" },
  { code:"JPN", name:"Japan" },
  { code:"KOR", name:"Korea, Rep." },
  { code:"CHN", name:"China" },
  { code:"IND", name:"India" },
  { code:"ZAF", name:"South Africa" },
];

async function fetchWorldBank(indicator, countries, startYear, endYear) {
  if (!countries.length) return [];
  const clist = countries.join(";");
  const url = new URL("https://api.worldbank.org/v2/country/" + clist + "/indicator/" + indicator);
  url.searchParams.set("format", "json");
  url.searchParams.set("per_page", "20000");
  if (startYear && endYear) url.searchParams.set("date", startYear + ":" + endYear);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("World Bank HTTP " + res.status);
  const j = await res.json();
  if (!Array.isArray(j) || !Array.isArray(j[1])) throw new Error("Unexpected WB JSON shape");
  const rows = j[1].filter(r => r.date && r.country && r.country.id).map(r => ({
    date: r.date,
    country: r.country.id,
    value: (r.value==null ? null : Number(r.value))
  }));
  const byYear = {};
  for (const r of rows) {
    if (!byYear[r.date]) byYear[r.date] = { date: r.date };
    byYear[r.date][r.country] = r.value;
  }
  const out = Object.values(byYear).sort((a,b)=>a.date.localeCompare(b.date));
  return out;
}

async function fetchOECD_SDMX(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("OECD HTTP " + res.status);
  const j = await res.json();
  if (!j || !j.dataSets || !j.dataSets[0] || !j.structure) throw new Error("Unexpected OECD SDMX JSON");
  const ds = j.dataSets[0];
  const dims = j.structure.dimensions.series;
  const timeDim = j.structure.dimensions.observation.find(d=>d.id==="TIME_PERIOD");
  const geoDim = dims.find(d => ["LOCATION","GEO","COUNTRY"].includes(d.id)) || dims[0];
  const geoCodes = geoDim.values.map(function(v,i){ return {index:i, code:v.id, name:v.name}; });
  const timeIndexToYear = function(idx){ return (timeDim.values[idx] && timeDim.values[idx].id) ? timeDim.values[idx].id : String(idx); };
  const outByYear = new Map();
  for (const key in ds.series) {
    const s = ds.series[key];
    const idxs = key.split(":").map(function(n){ return parseInt(n,10); });
    const geo = geoCodes[idxs[geoDim.keyPosition]].code;
    if (!s || !s.observations) continue;
    for (const tIdxStr in s.observations) {
      const tIdx = parseInt(tIdxStr,10);
      const year = timeIndexToYear(tIdx);
      const val = s.observations[tIdxStr] ? s.observations[tIdxStr][0] : null;
      if (val==null) continue;
      const obj = outByYear.get(year) || { date: year };
      obj[geo] = val;
      outByYear.set(year, obj);
    }
  }
  return Array.from(outByYear.values()).sort(function(a,b){ return a.date.localeCompare(b.date); });
}

function indexAtStart(data, countries){
  if (!data.length) return data;
  const first = data.find(r => countries.some(c=>r[c]!=null));
  if (!first) return data;
  const base = {};
  countries.forEach(c => { const v = first[c]; if (v!=null && v!==0) base[c]=v; });
  return data.map(row => {
    const out = { date: row.date };
    countries.forEach(c => {
      const v = row[c];
      out[c] = (v!=null && base[c]) ? (v/base[c]*100) : null;
    });
    return out;
  });
}

function yoy(data, countries){
  const byYear = new Map(data.map(r=>[r.date,r]));
  return data.map(row => {
    const out = { date: row.date };
    const prev = String(Number(row.date)-1);
    const rowPrev = byYear.get(prev);
    countries.forEach(c => {
      const v = row[c]; const p = rowPrev ? rowPrev[c] : null;
      out[c] = (v!=null && p!=null && p!==0) ? ((v/p - 1)*100) : null;
    });
    return out;
  });
}

function movingAverage(data, countries, windowYears){
  if (!windowYears) return data;
  const out = data.map(r => ({ date:r.date }));
  countries.forEach(c => {
    const vals = data.map(r => r[c]);
    const ma = new Array(vals.length).fill(null);
    let sum=0, cnt=0; const q=[];
    for (let i=0;i<vals.length;i++){
      q.push(vals[i]);
      if (vals[i]!=null){ sum+=vals[i]; cnt++; }
      if (q.length>windowYears){
        const first=q.shift();
        if (first!=null){ sum-=first; cnt--; }
      }
      ma[i] = cnt ? sum/cnt : null;
    }
    for (let i=0;i<out.length;i++) out[i][c] = ma[i];
  });
  return out;
}

const COLORS = ["#60a5fa","#a78bfa","#34d399","#f472b6","#f59e0b","#ef4444","#22c55e","#93c5fd","#fde047","#14b8a6","#38bdf8","#d946ef","#84cc16","#fb7185","#06b6d4"];

function exportCSV(data, countries, filename="education.csv"){
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    const needsQuote = /[",\r\n]/.test(s);
    return needsQuote ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const header = ["date", ...countries];
  const rows = [header.map(esc).join(",")];
  for (const r of data) {
    rows.push([esc(r.date), ...countries.map(c => esc(r[c]))].join(","));
  }
  const csv = rows.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function App(){
  const [source, setSource] = useState("WB");
  const [indicator, setIndicator] = useState("SE.PRM.ENRR");
  const [countries, setCountries] = useState(["USA","DEU","FRA","CHE"]);
  const [startYear, setStartYear] = useState("1990");
  const [endYear, setEndYear] = useState(new Date().getFullYear().toString());
  const [oecdUrl, setOecdUrl] = useState("");

  const [transform, setTransform] = useState("level");
  const [smooth, setSmooth] = useState(0);
  const [data, setData] = useState([]);
  const [error, setError] = useState("");

  async function load(){
    setError(""); setData([]);
    try {
      let raw = [];
      if (source==="WB"){
        raw = await fetchWorldBank(indicator, countries, startYear, endYear);
      } else {
        if (!oecdUrl || !oecdUrl.trim()) {
          setError("Paste an OECD SDMX-JSON URL to load OECD data (or switch Source back to World Bank).");
          setData([]);
          return;
        }
        raw = await fetchOECD_SDMX(oecdUrl.trim());
      }
      let d = raw;
      if (transform==="index100") d = indexAtStart(d, countries);
      if (transform==="yoy") d = yoy(d, countries);
      if (smooth) d = movingAverage(d, countries, smooth);
      setData(d);
    } catch (e) {
      console.error(e);
      setError(e.message || String(e));
      try {
        const res = await fetch("./data/sample_wb_SE.PRM.ENRR_USA_DEU_FRA_CHE.json");
        if (res.ok){
          const demo = await res.json();
          setData(demo);
          setSource("WB");
          setIndicator("SE.PRM.ENRR");
          setCountries(["USA","DEU","FRA","CHE"]);
        }
      } catch {}
    }
  }

  useEffect(()=>{ load(); }, [source, indicator, countries.join(","), startYear, endYear, oecdUrl, transform, smooth]);

  const anyYoY = transform==="yoy";
  const canLog = !anyYoY && data.every(r => countries.every(c => r[c]==null || r[c]>0));
  const yTickFmt = (v)=> anyYoY ? (v==null?"":v.toFixed(1)+"%") : (Math.round(v*100)/100);

  return (
    <div className="min-h-screen w-full" style={{backgroundImage:"linear-gradient(to bottom, #0b0f1a, #0a0a0a)"}}>
      <div className="max-w-7xl mx-auto px-6 py-8 text-neutral-100">
        <header className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full" style={{background:ACCENT, color:"#0b1020"}}><CapIcon/></span>
              Educational Comparison
            </h1>
            <div className="flex gap-2">
              <button onClick={load} className="px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-950 hover:bg-neutral-900">Reload</button>
              <button onClick={()=>exportCSV(data, countries)} className="px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-950 hover:bg-neutral-900">Export CSV</button>
            </div>
          </div>
          <p className="text-sm" style={{color:TEXT_MUTED}}>
            Visualize major education indicators across countries using World Bank or OECD (SDMX-JSON) data.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card title="Data settings">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Source">
                  <Select value={source} onChange={setSource}>
                    <option value="WB">World Bank</option>
                    <option value="OECD">OECD (SDMX URL)</option>
                  </Select>
                </Field>
                {source==="WB" ? (
                  <Field label="Indicator">
                    <Select value={indicator} onChange={setIndicator}>
                      {WB_INDICATORS.map(i => <option key={i.code} value={i.code}>{i.label} — {i.code}</option>)}
                    </Select>
                  </Field>
                ) : (
                  <Field label="OECD SDMX URL" hint="Paste full SDMX-JSON URL (e.g., stats.oecd.org sdmx-json endpoint).">
                    <TextInput value={oecdUrl} onChange={setOecdUrl} placeholder="https://stats.oecd.org/sdmx-json/data/..." />
                  </Field>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Start year">
                  <TextInput value={startYear} onChange={setStartYear} />
                </Field>
                <Field label="End year">
                  <TextInput value={endYear} onChange={setEndYear} />
                </Field>
                <Field label="Transform">
                  <Select value={transform} onChange={setTransform}>
                    <option value="level">Level</option>
                    <option value="index100">Index: 100 at start</option>
                    <option value="yoy">YoY %</option>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Smoothing">
                  <Select value={String(smooth)} onChange={(v)=>setSmooth(Number(v))}>
                    <option value="0">None</option>
                    <option value="3">3-year MA</option>
                    <option value="5">5-year MA</option>
                  </Select>
                </Field>
                <div className="col-span-2">
                  <Field label="Countries">
                    <CountryPicker options={COUNTRIES} value={countries} onChange={setCountries} />
                  </Field>
                </div>
              </div>

              {error && <div className="text-sm text-rose-400">Error: {error}</div>}
            </div>
          </Card>

          <div className="lg:col-span-2">
            <Card title="Chart" right={<span className="text-xs" style={{color:TEXT_MUTED}}>{transform==="yoy"?"% change":"Level / Index"}</span>}>
              <div className="w-full h-[480px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" minTickGap={16} stroke="#9ca3af" />
                    <YAxis scale={canLog?"log":"auto"} domain={["auto","auto"]} tickFormatter={yTickFmt} stroke="#9ca3af" />
                    <Tooltip contentStyle={{background:"#0b0f1a", border:"1px solid #1f2937", color:"#e5e7eb"}}
                      formatter={(val, name)=>{
                        if (val==null) return ["",""];
                        if (transform==="yoy") return [Number(val).toFixed(2)+"%", name];
                        return [Number(val).toLocaleString(undefined,{maximumFractionDigits:2}), name];
                      }}/>
                    <Legend />
                    {countries.map((c, idx) => (
                      <Line key={c} type="monotone" dataKey={c} name={(COUNTRIES.find(x=>x.code===c)?.name) || c}
                        stroke={COLORS[idx % COLORS.length]} dot={false} strokeWidth={2} />
                    ))}
                    <Brush dataKey="date" height={24} stroke={ACCENT}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="About & attribution">
              <div className="text-sm space-y-2">
                <p><b>Created by Kevin Schoenholzer</b> with the help of <b>ChatGPT</b>, 2025. <i>Educational purposes only.</i></p>
                <p><b>Sources:</b> World Bank Open Data API (live) and OECD SDMX-JSON (URL input). Some indicators may be sparse or revised.</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
