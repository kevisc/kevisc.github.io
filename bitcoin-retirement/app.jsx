/* @jsx React.createElement */
/* @jsxFrag React.Fragment */
// The app is written in JSX and compiled in-browser by Babel Standalone.
// Libraries are available as UMD globals: React, ReactDOM, Recharts.

const { useState, useMemo, useEffect } = React;
const { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer, AreaChart, Area } = Recharts;

// ---------- Utilities ----------
const clamp = (v, min, max) => Math.min(Math.max(v ?? 0, min), max);
const pctToDecimal = (p) => (p ?? 0) / 100;
const toMonthly = (annualDecimal) => Math.pow(1 + (annualDecimal ?? 0), 1 / 12) - 1;
const fmtUSD = (n) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
const fmtBTC = (n) => `${(Number.isFinite(n) ? n : 0).toFixed(8)} BTC`;
const round = (n, d = 2) => { const m = Math.pow(10, d); return Math.round((n + Number.EPSILON) * m) / m; };

const defaultInputs = {
  initialUSD: 10000,
  monthlyUSD: 500,
  years: 20,
  btcAnnualReturnPct: 15,
  fiatAnnualReturnPct: 3,
  inflationAnnualPct: 2.0,
  btcPriceNow: 65000,
  feePct: 0.2,
  retirementYears: 25,
  retirementAnnualReturnPct: 6,
  retirementMonthlyWithdrawal: 3000,
  indexWithdrawalsToInflation: true,
};

function Section({ title, children, right }) {
  return (
    <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur rounded-2xl shadow p-5 border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <div className="flex items-center gap-2">{right}</div>
      </div>
      {children}
    </div>
  );
}

function NumberField({ label, value, onChange, step = 1, min = 0, max = Number.POSITIVE_INFINITY, suffix, icon, title }) {
  return (
    <label className="grid grid-cols-[1fr_auto] gap-3 items-center py-2">
      <div className="text-sm text-neutral-600 dark:text-neutral-300 flex items-center gap-2" title={title}>
        {icon}
        <span className="font-medium text-neutral-900 dark:text-neutral-100">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step={step} min={min} max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-36 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-right focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        {suffix && <span className="text-sm text-neutral-500">{suffix}</span>}
      </div>
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between py-2 select-none">
      <span className="font-medium text-neutral-900 dark:text-neutral-100">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`w-14 h-8 rounded-full p-1 transition-colors ${checked ? "bg-orange-600" : "bg-neutral-300 dark:bg-neutral-700"}`}
      >
        <span className={`w-6 h-6 bg-white dark:bg-black rounded-full block transition-transform ${checked ? "translate-x-6" : "translate-x-0"}`} />
      </button>
    </label>
  );
}

// ---------- Calculations ----------
function simulateAccumulation({
  initialUSD, monthlyUSD, years,
  btcAnnualReturnPct, fiatAnnualReturnPct, inflationAnnualPct,
  btcPriceNow, feePct,
}) {
  const months = Math.max(0, Math.round(years * 12));
  const rBTCm = toMonthly(pctToDecimal(btcAnnualReturnPct));
  const rFiatm = toMonthly(pctToDecimal(fiatAnnualReturnPct));
  const rInflm = toMonthly(pctToDecimal(inflationAnnualPct));
  const fee = pctToDecimal(feePct);

  const rows = [];
  let units = (initialUSD * (1 - fee)) / btcPriceNow; // buy BTC today
  let deposits = initialUSD;

  for (let t = 0; t <= months; t++) {
    const price = btcPriceNow * Math.pow(1 + rBTCm, t);

    const fiatFV =
      initialUSD * Math.pow(1 + rFiatm, t) +
      (rFiatm === 0 ? monthlyUSD * t : monthlyUSD * ((Math.pow(1 + rFiatm, t) - 1) / rFiatm));

    if (t > 0) {
      const btcBought = (monthlyUSD * (1 - fee)) / price;
      units += btcBought;
      deposits += monthlyUSD;
    }

    const usdValueBTC = units * price;
    const cpiIndex = Math.pow(1 + rInflm, t);

    rows.push({
      t,
      month: t,
      year: Math.floor(t / 12),
      price,
      btcUnits: units,
      usdValueBTC,
      usdValueBTC_real: usdValueBTC / cpiIndex,
      usdValueFiat: fiatFV,
      usdValueFiat_real: fiatFV / cpiIndex,
      depositsUSD: deposits,
      depositsUSD_real: deposits / cpiIndex,
    });
  }

  const last = rows[rows.length - 1];
  return { rows, last };
}

function computeSustainableRealWithdrawal({ startUSD, years, annualReturnPct, inflationAnnualPct }) {
  const rNom_m = toMonthly(pctToDecimal(annualReturnPct));
  const rInfl_m = toMonthly(pctToDecimal(inflationAnnualPct));
  const rReal = (1 + rNom_m) / (1 + rInfl_m) - 1;
  const n = Math.max(1, Math.round(years * 12));
  if (Math.abs(rReal) < 1e-8) return startUSD / n;
  return startUSD * (rReal / (1 - Math.pow(1 + rReal, -n)));
}

function simulateDrawdown({
  startUnits, startPrice, startTimeIndex,
  retirementYears, retirementAnnualReturnPct, inflationAnnualPct,
  monthlyWithdrawal, indexWithdrawalsToInflation, feePct,
}) {
  const months = Math.max(0, Math.round(retirementYears * 12));
  const rBTCm = toMonthly(pctToDecimal(retirementAnnualReturnPct));
  const rInflm = toMonthly(pctToDecimal(inflationAnnualPct));
  const fee = pctToDecimal(feePct);

  const rows = [];
  let units = startUnits;
  let depletedAt = null;

  for (let k = 0; k <= months; k++) {
    const t = startTimeIndex + k;
    const price = startPrice * Math.pow(1 + rBTCm, k);
    const cpiIndex = Math.pow(1 + rInflm, k);

    if (k > 0 && units > 0) {
      const nominalWithdrawal = indexWithdrawalsToInflation ? monthlyWithdrawal * cpiIndex : monthlyWithdrawal;
      const unitsToSell = nominalWithdrawal / (price * (1 - fee)); // net cashflow equals withdrawal
      units -= unitsToSell;
      if (units <= 0 && depletedAt == null) { depletedAt = k; units = 0; }
    }

    const usdValue = units * price;
    rows.push({ k, t, price, btcUnits: units, usdValue, usdValue_real: usdValue / cpiIndex });
  }

  const last = rows[rows.length - 1];
  return { rows, last, depletedAtMonths: depletedAt };
}

// ---------- Tests (console) ----------
function approx(a, b, tol = 1e-6) { return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)); }
function runInternalTests() {
  try {
    const t1 = simulateAccumulation({ initialUSD: 12000, monthlyUSD: 1000, years: 1, btcAnnualReturnPct: 0, fiatAnnualReturnPct: 0, inflationAnnualPct: 0, btcPriceNow: 60000, feePct: 0 });
    const unitsExpect = 12000/60000 + 12*(1000/60000);
    console.assert(approx(t1.last.btcUnits, unitsExpect, 1e-9), "Test 1a: BTC units incorrect");
    console.assert(approx(t1.last.usdValueBTC, 24000, 1e-9), "Test 1b: BTC USD value should equal deposits");
    console.assert(approx(t1.last.depositsUSD, 24000, 1e-9), "Test 1c: Deposits mismatch");
    console.assert(approx(t1.last.usdValueFiat, 24000, 1e-9), "Test 1d: Fiat comparator should equal deposits");

    const t2 = simulateDrawdown({ startUnits: 1, startPrice: 10000, startTimeIndex: 0, retirementYears: 1, retirementAnnualReturnPct: 0, inflationAnnualPct: 0, monthlyWithdrawal: 1000, indexWithdrawalsToInflation: false, feePct: 0 });
    console.assert(t2.depletedAtMonths === 10, `Test 2: Expected depletion at 10 months, got ${t2.depletedAtMonths}`);

    const w = computeSustainableRealWithdrawal({ startUSD: 24000, years: 2, annualReturnPct: 0, inflationAnnualPct: 0 });
    console.assert(approx(w, 1000, 1e-9), `Test 3: Expected 1000, got ${w}`);

    const t4 = simulateDrawdown({ startUnits: 2, startPrice: 50000, startTimeIndex: 0, retirementYears: 1, retirementAnnualReturnPct: 6, inflationAnnualPct: 6, monthlyWithdrawal: 4000, indexWithdrawalsToInflation: true, feePct: 0 });
    console.assert(t4.rows[0].usdValue_real >= t4.rows[t4.rows.length - 1].usdValue_real - 1e-6, "Test 4: Real value check");
  } catch (e) {
    console.error("Internal tests error:", e);
  }
}

// ---------- Small inline icons ----------
function BtcLogo({ size = 20 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none">
      <circle cx="12" cy="12" r="11" fill="#f97316" />
      <path d="M10 7h3.2a2.3 2.3 0 1 1 0 4.6H10m2.7 0A2.3 2.3 0 1 1 12.7 16H10" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 5.5v13M13.5 5.5v13" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ---------- UI blocks ----------
function SummaryCard({ title, value, subtitle }) {
  return (
    <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur rounded-2xl shadow p-5 border border-neutral-200 dark:border-neutral-800">
      <div className="text-sm text-neutral-500 mb-1">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {subtitle && <div className="text-xs text-neutral-500 mt-1">{subtitle}</div>}
    </div>
  );
}

function SavedScenarios({ onLoad, onDelete }) {
  const [list, setList] = useState(() => Object.entries(JSON.parse(localStorage.getItem("brp:scenarios") || "{}")));
  useEffect(() => {
    const id = setInterval(() => setList(Object.entries(JSON.parse(localStorage.getItem("brp:scenarios") || "{}"))), 500);
    return () => clearInterval(id);
  }, []);
  if (!list.length) return <div className="text-sm text-neutral-500">No saved scenarios yet.</div>;
  return (
    <div className="space-y-2">
      {list.map(([key]) => (
        <div key={key} className="flex items-center justify-between py-1">
          <button onClick={() => onLoad(key)} className="px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm font-medium">{key}</button>
          <button onClick={() => onDelete(key)} className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600" title="Delete scenario">×</button>
        </div>
      ))}
    </div>
  );
}

// ---------- Main App ----------
function App() {
  const [inputs, setInputs] = useState(() => {
    const saved = localStorage.getItem("brp:lastInputs");
    return saved ? JSON.parse(saved) : defaultInputs;
  });
  const [showReal, setShowReal] = useState(false);
  const [activeTab, setActiveTab] = useState("growth");
  const [scenarioName, setScenarioName] = useState("");

  useEffect(() => { localStorage.setItem("brp:lastInputs", JSON.stringify(inputs)); }, [inputs]);
  useEffect(() => { runInternalTests(); }, []);

  const acc = useMemo(() => simulateAccumulation(inputs), [inputs]);

  const draw = useMemo(() => {
    const { last, rows } = acc;
    return simulateDrawdown({
      startUnits: last.btcUnits,
      startPrice: last.price,
      startTimeIndex: rows.length - 1,
      retirementYears: inputs.retirementYears,
      retirementAnnualReturnPct: inputs.retirementAnnualReturnPct,
      inflationAnnualPct: inputs.inflationAnnualPct,
      monthlyWithdrawal: inputs.retirementMonthlyWithdrawal,
      indexWithdrawalsToInflation: inputs.indexWithdrawalsToInflation,
      feePct: inputs.feePct,
    });
  }, [acc, inputs]);

  const sustainableRealWithdrawal = useMemo(() =>
    computeSustainableRealWithdrawal({
      startUSD: acc.last.usdValueBTC,
      years: inputs.retirementYears,
      annualReturnPct: inputs.retirementAnnualReturnPct,
      inflationAnnualPct: inputs.inflationAnnualPct,
    }), [acc.last.usdValueBTC, inputs.retirementYears, inputs.retirementAnnualReturnPct, inputs.inflationAnnualPct]
  );

  const chartDataGrowth = useMemo(() =>
    acc.rows.map((r) => ({
      t: r.t,
      label: `Year ${r.year}`,
      BTC: showReal ? r.usdValueBTC_real : r.usdValueBTC,
      Fiat: showReal ? r.usdValueFiat_real : r.usdValueFiat,
      Deposits: showReal ? r.depositsUSD_real : r.depositsUSD,
    })), [acc.rows, showReal]);

  const chartDataUnits = useMemo(() => acc.rows.map((r) => ({ t: r.t, Units: r.btcUnits })), [acc.rows]);

  const chartDataDrawdown = useMemo(() =>
    draw.rows.map((r) => ({ t: r.t, label: `t${r.t}`, Balance: showReal ? r.usdValue_real : r.usdValue })), [draw.rows, showReal]);

  function exportCSV() {
    const headers = ["month","year","btc_price_usd","btc_units","btc_value_usd","btc_value_usd_real","fiat_value_usd","fiat_value_usd_real","deposits_usd","deposits_usd_real"];
    const lines = [headers.join(",")];
    acc.rows.forEach((r) => {
      lines.push([r.month, r.year, round(r.price, 2), r.btcUnits.toFixed(8), round(r.usdValueBTC, 2), round(r.usdValueBTC_real, 2), round(r.usdValueFiat, 2), round(r.usdValueFiat_real, 2), round(r.depositsUSD, 2), round(r.depositsUSD_real, 2)].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "bitcoin_retirement_growth.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function exportDrawdownCSV() {
    const headers = ["month_since_retirement_start","abs_month_index","btc_price_usd","btc_units","balance_usd","balance_usd_real"];
    const lines = [headers.join(",")];
    draw.rows.forEach((r) => { lines.push([r.k, r.t, round(r.price, 2), r.btcUnits.toFixed(8), round(r.usdValue, 2), round(r.usdValue_real, 2)].join(",")); });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "bitcoin_retirement_drawdown.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function saveScenario() {
    const key = scenarioName.trim() || new Date().toISOString();
    const existing = JSON.parse(localStorage.getItem("brp:scenarios") || "{}");
    existing[key] = inputs;
    localStorage.setItem("brp:scenarios", JSON.stringify(existing));
    setScenarioName("");
  }
  function loadScenario(key) {
    const existing = JSON.parse(localStorage.getItem("brp:scenarios") || "{}");
    if (existing[key]) setInputs(existing[key]);
  }
  function deleteScenario(key) {
    const existing = JSON.parse(localStorage.getItem("brp:scenarios") || "{}");
    delete existing[key];
    localStorage.setItem("brp:scenarios", JSON.stringify(existing));
    setTick((x) => x + 1);
  }

  const [, setTick] = useState(0);
  function resetToDefaults() { setInputs(defaultInputs); }

  const DollarIcon = <span title="USD">$</span>;
  const WalletIcon = <span title="Wallet">💼</span>;
  const CalendarIcon = <span title="Calendar">📅</span>;
  const TrendIcon = <span title="Return">📈</span>;
  const ArrowsIcon = <span title="Fee">↔</span>;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-black dark:to-neutral-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <header className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white"><BtcLogo size={18}/></span>
              Bitcoin Retirement Planner
            </h1>
            <div className="flex gap-2">
              <button onClick={resetToDefaults} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800" title="Reset to sensible defaults">↺ Reset</button>
              <button onClick={exportCSV} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800" title="Export accumulation CSV">⬇ Growth CSV</button>
              <button onClick={exportDrawdownCSV} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800" title="Export drawdown CSV">⬇ Drawdown CSV</button>
            </div>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
            Deterministic DCA model with monthly compounding. All figures are purely illustrative and not financial advice.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          <Section title="Accumulation inputs" right={<span className="text-xs text-neutral-500">All amounts in USD</span>}>
            <div className="grid">
              <NumberField label="Initial lump sum" value={inputs.initialUSD} onChange={(v) => setInputs({ ...inputs, initialUSD: clamp(v, 0, 1e9) })} step={100} suffix={DollarIcon} icon={WalletIcon} />
              <NumberField label="Monthly contribution" value={inputs.monthlyUSD} onChange={(v) => setInputs({ ...inputs, monthlyUSD: clamp(v, 0, 1e8) })} step={50} suffix={DollarIcon} icon={DollarIcon} />
              <NumberField label="Investment horizon" value={inputs.years} onChange={(v) => setInputs({ ...inputs, years: clamp(v, 0, 100) })} step={1} min={0} max={100} suffix={<span>years</span>} icon={CalendarIcon} />
              <NumberField label="BTC expected return" value={inputs.btcAnnualReturnPct} onChange={(v) => setInputs({ ...inputs, btcAnnualReturnPct: clamp(v, -100, 500) })} step={0.25} suffix={<span>% / year</span>} icon={TrendIcon} />
              <NumberField label="Fiat comparator return" value={inputs.fiatAnnualReturnPct} onChange={(v) => setInputs({ ...inputs, fiatAnnualReturnPct: clamp(v, -50, 100) })} step={0.25} suffix={<span>% / year</span>} icon={TrendIcon} />
              <NumberField label="Inflation (CPI)" value={inputs.inflationAnnualPct} onChange={(v) => setInputs({ ...inputs, inflationAnnualPct: clamp(v, -10, 50) })} step={0.1} suffix={<span>% / year</span>} icon={TrendIcon} />
              <NumberField label="Current BTC price" value={inputs.btcPriceNow} onChange={(v) => setInputs({ ...inputs, btcPriceNow: clamp(v, 1, 1e9) })} step={100} suffix={<span>USD/BTC</span>} icon={<BtcLogo size={16}/>} />
              <NumberField label="Trade fee" value={inputs.feePct} onChange={(v) => setInputs({ ...inputs, feePct: clamp(v, 0, 5) })} step={0.05} suffix={<span>% per trade</span>} icon={ArrowsIcon} />
              <Toggle label={`Show ${showReal ? "real (CPI-adjusted)" : "nominal"} values`} checked={showReal} onChange={setShowReal} />
            </div>
          </Section>

          <Section title="Retirement (drawdown)">
            <div className="grid">
              <NumberField label="Retirement length" value={inputs.retirementYears} onChange={(v) => setInputs({ ...inputs, retirementYears: clamp(v, 0, 60) })} step={1} min={0} max={60} suffix={<span>years</span>} icon={CalendarIcon} />
              <NumberField label="Return during retirement" value={inputs.retirementAnnualReturnPct} onChange={(v) => setInputs({ ...inputs, retirementAnnualReturnPct: clamp(v, -100, 100) })} step={0.25} suffix={<span>% / year</span>} icon={TrendIcon} />
              <NumberField label="Monthly withdrawal (start)" value={inputs.retirementMonthlyWithdrawal} onChange={(v) => setInputs({ ...inputs, retirementMonthlyWithdrawal: clamp(v, 0, 1e7) })} step={100} suffix={DollarIcon} icon={DollarIcon} />
              <Toggle label="Index withdrawals to inflation" checked={inputs.indexWithdrawalsToInflation} onChange={(v) => setInputs({ ...inputs, indexWithdrawalsToInflation: v })} />
              <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                Sustainable real withdrawal (rule-of-thumb): <span className="font-semibold">{fmtUSD(sustainableRealWithdrawal)}</span> / month
              </div>
              {draw.depletedAtMonths != null && (
                <div className="text-xs text-rose-600 dark:text-rose-400 mt-1">Portfolio depletes after ~ {Math.floor(draw.depletedAtMonths / 12)}y {draw.depletedAtMonths % 12}m under current withdrawal.</div>
              )}
            </div>
          </Section>

          <Section title="Save & scenarios" right={null}>
            <div className="grid gap-3">
              <div className="flex gap-2">
                <input
                  placeholder="Scenario name (e.g., Base Case)"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                />
                <button onClick={saveScenario} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  💾 Save
                </button>
              </div>
              <SavedScenarios onLoad={loadScenario} onDelete={deleteScenario} />
            </div>
          </Section>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          <SummaryCard title="Final BTC balance" value={fmtUSD(acc.last.usdValueBTC)} subtitle={`${fmtBTC(acc.last.btcUnits)} @ ${fmtUSD(acc.last.price)} / BTC`} />
          <SummaryCard title="Fiat comparator balance" value={fmtUSD(showReal ? acc.last.usdValueFiat_real : acc.last.usdValueFiat)} subtitle={`${showReal ? "real" : "nominal"} terms`} />
          <SummaryCard title="Total deposits" value={fmtUSD(showReal ? acc.last.depositsUSD_real : acc.last.depositsUSD)} subtitle={`${acc.rows.length - 1} months; difference vs BTC: ${fmtUSD((showReal ? acc.last.usdValueBTC_real : acc.last.usdValueBTC) - (showReal ? acc.last.depositsUSD_real : acc.last.depositsUSD))}`} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setActiveTab("growth")} className={`px-4 py-2 rounded-xl border ${activeTab === "growth" ? "border-orange-600 bg-orange-50 dark:bg-orange-950" : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}>Growth</button>
          <button onClick={() => setActiveTab("drawdown")} className={`px-4 py-2 rounded-xl border ${activeTab === "drawdown" ? "border-orange-600 bg-orange-50 dark:bg-orange-950" : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}>Drawdown</button>
        </div>

        {activeTab === "growth" ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <Section title={`Portfolio growth (${showReal ? "real" : "nominal"})`} right={<span className="text-xs text-neutral-500">BTC vs Fiat vs Deposits</span>}>
              <div className="w-full h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartDataGrowth} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={(v) => `y${Math.floor(v / 12)}`} />
                    <YAxis tickFormatter={(v) => (v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}k` : `$${v}`)} />
                    <Tooltip formatter={(v, n) => [fmtUSD(v), n]} labelFormatter={(l) => `Month ${l} (${Math.floor(l / 12)}y)`} />
                    <Legend />
                    <Line type="monotone" dataKey="BTC" dot={false} strokeWidth={2} stroke="#f97316" />
                    <Line type="monotone" dataKey="Fiat" dot={false} strokeWidth={2} stroke="#6b7280" />
                    <Line type="monotone" dataKey="Deposits" dot={false} strokeWidth={2} stroke="#a3a3a3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <Section title="BTC units accumulated" right={<span className="text-xs text-neutral-500">through DCA</span>}>
              <div className="w-full h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartDataUnits} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={(v) => `y${Math.floor(v / 12)}`} />
                    <YAxis tickFormatter={(v) => `${v.toFixed(4)} BTC`} />
                    <Tooltip formatter={(v) => [fmtBTC(v), "BTC units"]} labelFormatter={(l) => `Month ${l}`} />
                    <Area type="monotone" dataKey="Units" strokeWidth={2} stroke="#f97316" fill="rgba(249,115,22,0.2)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <Section title="Key metrics">
              <ul className="text-sm space-y-2">
                <li><span className="font-medium">Total months:</span> {acc.rows.length - 1}</li>
                <li><span className="font-medium">BTC units accumulated:</span> {acc.last.btcUnits.toFixed(8)}</li>
                <li><span className="font-medium">Final BTC price (model):</span> {fmtUSD(acc.last.price)}</li>
                <li><span className="font-medium">Final BTC value:</span> {fmtUSD(showReal ? acc.last.usdValueBTC_real : acc.last.usdValueBTC)} {showReal ? "(real)" : "(nominal)"}</li>
                <li><span className="font-medium">Deposits total:</span> {fmtUSD(showReal ? acc.last.depositsUSD_real : acc.last.depositsUSD)}</li>
                <li><span className="font-medium">Gain over deposits (BTC path):</span> {fmtUSD((showReal ? acc.last.usdValueBTC_real : acc.last.usdValueBTC) - (showReal ? acc.last.depositsUSD_real : acc.last.depositsUSD))}</li>
              </ul>
            </Section>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <Section title={`Drawdown path (${showReal ? "real" : "nominal"})`} right={<span className="text-xs text-neutral-500">Indexed withdrawals: {inputs.indexWithdrawalsToInflation ? "Yes" : "No"}</span>}>
              <div className="w-full h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartDataDrawdown} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={(v) => `y${Math.floor(v / 12)}`} />
                    <YAxis tickFormatter={(v) => (v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}k` : `$${v}`)} />
                    <Tooltip formatter={(v) => [fmtUSD(v), "Balance"]} labelFormatter={(l) => `Month ${l - (acc.rows.length - 1)} since retirement`} />
                    <Legend />
                    <Line type="monotone" dataKey="Balance" dot={false} strokeWidth={2} stroke="#f97316" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Section>
            <Section title="Drawdown diagnostics">
              <ul className="text-sm space-y-2">
                <li><span className="font-medium">Start balance:</span> {fmtUSD(acc.last.usdValueBTC)} ({acc.last.btcUnits.toFixed(8)})</li>
                <li><span className="font-medium">Sustainable real withdrawal (annuity):</span> {fmtUSD(sustainableRealWithdrawal)} / month</li>
                <li><span className="font-medium">Chosen starting withdrawal:</span> {fmtUSD(inputs.retirementMonthlyWithdrawal)} {inputs.indexWithdrawalsToInflation ? "(inflation-indexed)" : "(flat nominal)"}</li>
                <li><span className="font-medium">Portfolio depletion:</span> {draw.depletedAtMonths == null ? "Not within horizon" : `${Math.floor(draw.depletedAtMonths / 12)}y ${draw.depletedAtMonths % 12}m`}</li>
              </ul>
            </Section>
            <Section title="What you can do">
              <ul className="text-sm space-y-2 list-disc pl-5">
                <li>Adjust return, inflation, and fees to test sensitivity.</li>
                <li>Compare against a fiat alternative (e.g., savings or index fund).</li>
                <li>Toggle nominal vs real to account for inflation.</li>
                <li>Export CSV data for your own analysis.</li>
                <li>Save multiple scenarios and switch between them.</li>
              </ul>
            </Section>
          </div>
        )}

        <footer className="mt-10 text-xs text-neutral-500">
          <div>Built for educational illustration. Model assumes smooth deterministic returns and ignores taxes, slippage beyond the fee, and behavioral factors.</div>
          <div className="mt-2">Created by <span className="font-medium">Kevin Schoenholzer</span> with the help of <span className="font-medium">ChatGPT</span>, 2025.</div>
        </footer>
      </div>
    </div>
  );
}

// Mount
ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
