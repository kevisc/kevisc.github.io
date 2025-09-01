// scripts/fetch-fred.js
// Fetch selected FRED series and write JSON to static/us-macro/data/ID.json
// Requires: Node 18+ (global fetch), env FRED_API_KEY

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SERIES = [
  "FEDFUNDS","DGS10","MORTGAGE30US",
  "UNRATE","PAYEMS",
  "CPIAUCSL","CPILFESL","PCEPI","PCEPILFE",
  "M2SL",
  "GFDEBTN","GDP","GDPC1",
  "CSUSHPINSA","MSPUS","INDPRO","RSXFS","SP500",
  "GOLDAMGBD228NLBM","CBBTCUSD"
];

const START = "1980-01-01";
const END = new Date().toISOString().slice(0,10);
const API_KEY = process.env.FRED_API_KEY;
if (!API_KEY) {
  console.error("Missing FRED_API_KEY environment variable.");
  process.exit(1);
}

async function fetchSeries(id) {
  const u = new URL("https://api.stlouisfed.org/fred/series/observations");
  u.searchParams.set("series_id", id);
  u.searchParams.set("file_type", "json");
  u.searchParams.set("observation_start", START);
  u.searchParams.set("observation_end", END);
  u.searchParams.set("sort_order", "asc");
  u.searchParams.set("api_key", API_KEY);
  const res = await fetch(u, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${id}`);
  const j = await res.json();
  if (!j || !j.observations) throw new Error(`Malformed JSON for ${id}`);
  return j.observations.map(o => ({ date: o.date.slice(0,10), value: (o.value==="."? null : Number(o.value)) }));
}

async function main() {
  const outDir = "static/us-macro/data";
  mkdirSync(outDir, { recursive: true });
  for (const id of SERIES) {
    try {
      const arr = await fetchSeries(id);
      writeFileSync(`${outDir}/${id}.json`, JSON.stringify(arr, null, 2));
      console.log(`Wrote ${id}.json (${arr.length} points)`);
    } catch (e) {
      console.error(`Failed ${id}:`, e.message || e);
    }
  }
}
main().catch(err => { console.error(err); process.exit(1); });
