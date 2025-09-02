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

const BASE_COUNTRIES = [
  { code:"USA", name:"United States" },
  { code:"DEU", name:"Germany" },
  { code:"FRA", name:"France" },
  { code:"CHE", name:"Switzerland" },
  { code:"GBR", name:"United Kingdom" },
  { code:"IRL", name:"Ireland" },
  { code:"NLD", name:"Netherlands" },
  { code:"BEL", name:"Belgium" },
  { code:"AUT", name:"Austria" },
  { code:"ITA", name:"Italy" },
  { code:"ESP", name:"Spain" },
  { code:"PRT", name:"Portugal" },
  { code:"FIN", name:"Finland" },
  { code:"SWE", name:"Sweden" },
  { code:"NOR", name:"Norway" },
  { code:"DNK", name:"Denmark" },
  { code:"EST", name:"Estonia" },
  { code:"POL", name:"Poland" },
  { code:"CZE", name:"Czechia" },
  { code:"HUN", name:"Hungary" },
  { code:"SVK", name:"Slovakia" },
  { code:"SVN", name:"Slovenia" },
  { code:"LVA", name:"Latvia" },
  { code:"LTU", name:"Lithuania" },
  { code:"ISL", name:"Iceland" },
  { code:"CAN", name:"Canada" },
  { code:"AUS", name:"Australia" },
  { code:"NZL", name:"New Zealand" },
  { code:"JPN", name:"Japan" },
  { code:"KOR", name:"Korea, Rep." },
  { code:"SGP", name:"Singapore" },
  { code:"CHN", name:"China" },
  { code:"HKG", name:"Hong Kong SAR, China" },
  { code:"TWN", name:"Taiwan, China" },
  { code:"TUR", name:"Türkiye" },
  { code:"BRA", name:"Brazil" },
  { code:"ARG", name:"Argentina" },
  { code:"CHL", name:"Chile" },
  { code:"MEX", name:"Mexico" },
  { code:"COL", name:"Colombia" },
  { code:"ZAF", name:"South Africa" },
  { code:"IND", name:"India" },
  { code:"IDN", name:"Indonesia" },
  { code:"MYS", name:"Malaysia" },
  { code:"THA", name:"Thailand" },
  { code:"VNM", name:"Vietnam" },
  { code:"PHL", name:"Philippines" },
  { code:"ARE", name:"United Arab Emirates" },
  { code:"SAU", name:"Saudi Arabia" },
  { code:"ISR", name:"Israel" }
];

const GROUPS = [
  { key:"PISA", name:"PISA (OECD)", manifest:"./data/worldbank_learning_outcomes_pisa.json" },
  { key:"TIMSS", name:"TIMSS (IEA)", manifest:"./data/worldbank_learning_outcomes_timss.json" },
  { key:"PIRLS", name:"PIRLS (IEA)", manifest:"./data/worldbank_learning_outcomes_pirls.json" },
  { key:"WB", name:"Other World Bank indicator (manual code/url)" },
  { key:"OECD", name:"OECD SDMX (URL)" },
];

async function fetchJSON(url){
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
  return await res.json();
}

function sanitizeYear(y){
  const s = String(y||"").trim();
  const m = s.match(/^(\d{4})$/);
  return m ? m[1] : "";
}

async function fetchWorldBankSmart(indicatorOrURL, countries){
  let url;
  if (/^https?:/i.test(indicatorOrURL)){
    url = indicatorOrURL;
  } else {
    const clist = countries.join(";");
    url = "https://api.worldbank.org/v2/country/" + clist + "/indicator/" + indicatorOrURL + "?format=json&per_page=20000";
  }
  const j = await fetchJSON(url);
  if (Array.isArray(j) && Array.isArray(j[1])) {
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
    return Object.values(byYear).sort(function(a,b){ return a.date.localeCompare(b.date); });
  } else if (Array.isArray(j) && j[0] && j[0].message) {
    const msg = (j[0].message && j[0].message[0] && j[0].message[0].value) ? j[0].message[0].value : "World Bank API message";
    throw new Error(msg);
  } else {
    throw new Error("Unexpected WB JSON shape");
  }
}

function filterByYear(data, startYear, endYear){
  if (!data.length) return data;
  const s = Number(startYear||data[0].date);
  const e = Number(endYear||data[data.length-1].date);
  return data.filter(r => Number(r.date)>=s && Number(r.date)<=e);
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

function exportCSV(data, countries, filename="learning_outcomes.csv"){
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    const needsQuote = /[",\r\n]/.test(s);
    return needsQuote ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const header = ["date", ...countries];
  const rows = [header.map(esc).join(",")];
  for (const r of data) rows.push([esc(r.date), ...countries.map(c => esc(r[c]))].join(","));
  const csv = rows.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function useManifest(groupKey){
  const [man, setMan] = useState(null);
  useEffect(()=>{
    const g = GROUPS.find(x=>x.key===groupKey);
    if (!g || !g.manifest) { setMan(null); return; }
    fetch(g.manifest).then(r=> r.ok ? r.json() : null).then(setMan).catch(()=>setMan(null));
  }, [groupKey]);
  return man;
}

function App(){
  const [group, setGroup] = useState("PISA");
  const manifest = useManifest(group);

  const manifestCountries = useMemo(()=>{
    if (manifest && Array.isArray(manifest.country_list_default)) return manifest.country_list_default;
    return BASE_COUNTRIES.map(x=>x.code);
  }, [manifest]);

  const manifestIndicators = useMemo(()=>{
    if (manifest && Array.isArray(manifest.indicators) && manifest.indicators.length) return manifest.indicators;
    if (group==="PISA") return [{code:"LO.PISA.MAT", name:"PISA: Math (mean)"},{code:"LO.PISA.REA", name:"PISA: Reading (mean)"},{code:"LO.PISA.SCI", name:"PISA: Science (mean)"}];
    if (group==="TIMSS") return [{code:"LO.TIMSS.MAT4", name:"TIMSS: G4 Math (mean)"},{code:"LO.TIMSS.SCI4", name:"TIMSS: G4 Science (mean)"},{code:"LO.TIMSS.MAT8", name:"TIMSS: G8 Math (mean)"}];
    if (group==="PIRLS") return [{code:"LO.PIRLS.REA", name:"PIRLS: G4 Reading (mean)"}];
    return [];
  }, [manifest, group]);

  const [indicator, setIndicator] = useState("LO.PISA.MAT");
  useEffect(()=>{
    if (manifestIndicators.length) setIndicator(manifestIndicators[0].code);
  }, [group, manifestIndicators.length]);

  const [countries, setCountries] = useState(["USA","DEU","FRA","CHE","GBR","FIN","JPN","KOR","SGP"]);
  useEffect(()=>{
    if (manifestCountries && manifestCountries.length) {
      setCountries(manifestCountries.slice(0, 12));
    }
  }, [group, manifestCountries.join(",")]);

  const [data, setData] = useState([]);
  const [error, setError] = useState("");

  const [autoRange, setAutoRange] = useState(true);
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");

  const [transform, setTransform] = useState("level");
  const [smooth, setSmooth] = useState(0);

  const [customWB, setCustomWB] = useState("");
  const [oecdUrl, setOecdUrl] = useState("");

  async function load(){
    setError("");
    try {
      let raw = [];
      if (group==="OECD") {
        if (!oecdUrl.trim()) throw new Error("Provide an OECD SDMX-JSON URL.");
        const j = await fetchJSON(oecdUrl.trim());
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
        raw = Array.from(outByYear.values()).sort(function(a,b){ return a.date.localeCompare(b.date); });
      } else if (group==="WB") {
        const code = customWB.trim();
        if (!code) throw new Error("Enter a World Bank indicator code or paste a full Indicators API URL.");
        raw = await fetchWorldBankSmart(code, countries);
      } else {
        const code = indicator;
        raw = await fetchWorldBankSmart(code, countries);
      }

      const years = raw.map(r=>Number(r.date)).filter(function(n){ return Number.isFinite(n); });
      const minY = Math.min.apply(null, years);
      const maxY = Math.max.apply(null, years);
      if (!Number.isFinite(minY) || !Number.isFinite(maxY)) throw new Error("No observations for selection.");

      if (autoRange) { setStartYear(String(minY)); setEndYear(String(maxY)); }

      let d = raw;
      if (transform==="index100") d = indexAtStart(d, countries);
      if (transform==="yoy") d = yoy(d, countries);
      if (smooth) d = movingAverage(d, countries, smooth);

      setData(d);
    } catch (e) {
      console.error(e);
      setError(e.message || String(e));
      setData([]);
    }
  }

  useEffect(()=>{ load(); }, [group, indicator, countries.join(","), customWB, oecdUrl, transform, smooth]);

  const dataMin = useMemo(()=> data.length? Math.min.apply(null, data.map(r=>Number(r.date))):null, [data]);
  const dataMax = useMemo(()=> data.length? Math.max.apply(null, data.map(r=>Number(r.date))):null, [data]);

  const sYear = sanitizeYear(autoRange? startYear : startYear);
  const eYear = sanitizeYear(autoRange? endYear : endYear);
  const showData = useMemo(()=>{
    if (!data.length) return [];
    const s = sYear || String(dataMin||"");
    const e = eYear || String(dataMax||"");
    return filterByYear(data, s, e);
  }, [data, sYear, eYear, dataMin, dataMax]);

  const anyYoY = transform==="yoy";
  const canLog = !anyYoY && showData.every(r => countries.every(c => r[c]==null || r[c]>0));
  const yTickFmt = function(v){ return anyYoY ? (v==null?"":v.toFixed(1)+"%") : (Math.round(v*100)/100); };

  function setFullRange(){
    if (dataMin!=null) setStartYear(String(dataMin));
    if (dataMax!=null) setEndYear(String(dataMax));
  }

  return (
    <div className="min-h-screen w-full" style={{backgroundImage:"linear-gradient(to bottom, #0b0f1a, #0a0a0a)"}}>
      <div className="max-w-7xl mx-auto px-6 py-8 text-neutral-100">
        <header className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full" style={{background:ACCENT, color:"#0b1020"}}><CapIcon/></span>
              International Learning Outcomes (PISA/TIMSS/PIRLS)
            </h1>
            <div className="flex gap-2">
              <button onClick={load} className="px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-950 hover:bg-neutral-900">Reload</button>
              <button onClick={()=>exportCSV(showData, countries)} className="px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-950 hover:bg-neutral-900">Export CSV</button>
            </div>
          </div>
          <p className="text-sm" style={{color:TEXT_MUTED}}>
            Visualize cross-national trends in PISA, TIMSS, and PIRLS. Data via World Bank EdStats (means, sex splits, proficiency tails). OECD SDMX optional.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card title="Focus & indicators">
            <div className="grid gap-3">
              <Field label="Dataset group">
                <Select value={group} onChange={setGroup}>
                  {GROUPS.map(function(g){ return <option key={g.key} value={g.key}>{g.name}</option>; })}
                </Select>
              </Field>

              {group==="WB" && (
                <Field label="WB indicator code or full URL" hint="Example code: LO.PISA.MAT  •  Or paste full API URL">
                  <TextInput value={customWB} onChange={setCustomWB} placeholder="e.g., LO.PISA.MAT or https://api.worldbank.org/v2/country/USA;DEU/indicator/LO.PISA.MAT?format=json&per_page=20000"/>
                </Field>
              )}

              {group!=="WB" && group!=="OECD" && (
                <Field label="Indicator">
                  <Select value={indicator} onChange={setIndicator}>
                    {manifestIndicators.map(function(i){ return <option key={i.code} value={i.code}>{i.name} — {i.code}</option>; })}
                  </Select>
                </Field>
              )}

              {group==="OECD" && (
                <Field label="OECD SDMX URL" hint="Paste SDMX-JSON endpoint (stats.oecd.org)">
                  <TextInput value={oecdUrl} onChange={setOecdUrl} placeholder="https://stats.oecd.org/sdmx-json/data/..." />
                </Field>
              )}

              <div className="grid grid-cols-3 gap-3">
                <Field label="Transform">
                  <Select value={transform} onChange={setTransform}>
                    <option value="level">Level</option>
                    <option value="index100">Index: 100 at first observed</option>
                    <option value="yoy">YoY %</option>
                  </Select>
                </Field>
                <Field label="Smoothing">
                  <Select value={String(smooth)} onChange={(v)=>setSmooth(Number(v))}>
                    <option value="0">None</option>
                    <option value="3">3-year MA</option>
                  </Select>
                </Field>
                <div className="col-span-1">
                  <Field label="Countries">
                    <CountryPicker options={BASE_COUNTRIES} value={countries} onChange={setCountries} />
                  </Field>
                </div>
              </div>
            </div>
          </Card>

          <div className="lg:col-span-2">
            <Card title="Years & range" right={<span className="text-xs" style={{color:TEXT_MUTED}}>{autoRange?"Auto (full)":"Manual"}</span>}>
              <div className="grid gap-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={autoRange} onChange={e=>setAutoRange(e.target.checked)} />
                    Auto-range to full available years
                  </label>
                  <button onClick={setFullRange} className="px-3 py-1 rounded-lg border border-neutral-700 bg-neutral-950 hover:bg-neutral-900 text-sm">Full range</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={"Start year" + (dataMin!=null? " (min "+dataMin+")": "")}>
                    <input type="number" value={startYear} onChange={e=>setStartYear(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-950 text-neutral-100"/>
                    {dataMin!=null && <input type="range" min={dataMin} max={dataMax||dataMin} value={Number(startYear||dataMin)} onChange={e=>setStartYear(e.target.value)} />}
                  </Field>
                  <Field label={"End year" + (dataMax!=null? " (max "+dataMax+")": "")}>
                    <input type="number" value={endYear} onChange={e=>setEndYear(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-950 text-neutral-100"/>
                    {dataMax!=null && <input type="range" min={dataMin||dataMax} max={dataMax} value={Number(endYear||dataMax)} onChange={e=>setEndYear(e.target.value)} />}
                  </Field>
                </div>
                {error && <div className="text-sm text-rose-400">Error: {error}</div>}
              </div>
            </Card>

            <Card title="Trend chart" right={<span className="text-xs" style={{color:TEXT_MUTED}}>{transform==="yoy"?"% change":"Level / Index"}</span>}>
              <div className="w-full h-[520px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={showData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
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
                      <Line key={c} type="monotone" dataKey={c} name={BASE_COUNTRIES.find(x=>x.code===c)?.name || c}
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
                <p><b>Sources:</b> World Bank EdStats learning outcomes series (PISA/TIMSS/PIRLS) via Indicators API; OECD SDMX-JSON for optional series.</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
