"""Build market.json + macro.json + intl.json for the static Pillars dashboard.

Runs in CI (GitHub Actions). Sources:
  - Yahoo Finance (yfinance) -> market prices + history
  - FRED official API (needs FRED_API_KEY) -> US macro series (10y history) + BIS house prices
  - IMF DataMapper (keyless) -> cross-country government data (GDP, inflation, unemployment,
    debt, fiscal balance, current account) for the largest economies
Failures degrade gracefully (missing items skipped) so a transient outage never breaks the page.
"""
from __future__ import annotations

import concurrent.futures as cf
import datetime as dt
import io
import json
import os

import pandas as pd
import requests
import yfinance as yf

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
UA = {"User-Agent": "pillars-static-dashboard"}


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _round(x, n=4):
    try:
        if pd.isna(x):
            return None
        return round(float(x), n)
    except Exception:
        return None


# ---------------------------------------------------------------- markets (yfinance)

def _pct(s: pd.Series, lookback: int):
    s = s.dropna()
    if len(s) < 2:
        return None
    prev = s.iloc[-1 - lookback] if len(s) > lookback else s.iloc[0]
    if prev == 0 or pd.isna(prev):
        return None
    return round((s.iloc[-1] / prev - 1.0) * 100.0, 2)


def _ytd(s: pd.Series):
    s = s.dropna()
    if s.empty:
        return None
    yr = s[s.index.year == s.index[-1].year]
    if yr.empty or yr.iloc[0] == 0:
        return None
    return round((s.iloc[-1] / yr.iloc[0] - 1.0) * 100.0, 2)


def build_market():
    watch = pd.read_csv(os.path.join(HERE, "watchlist.csv"))
    tickers = list(watch["ticker"])
    data = yf.download(tickers, period="1y", interval="1d", auto_adjust=True, progress=False, threads=True)
    raw = data["Close"] if isinstance(data.columns, pd.MultiIndex) else data[["Close"]].rename(columns={"Close": tickers[0]})
    aligned = raw.dropna(how="all").ffill()
    dates = [d.strftime("%Y-%m-%d") for d in aligned.index]
    rows = []
    for _, r in watch.iterrows():
        t = r["ticker"]
        own = raw[t].dropna() if t in raw.columns else pd.Series(dtype="float64")
        line = aligned[t] if t in aligned.columns else pd.Series(dtype="float64")
        rows.append({
            "ticker": t, "name": r["name"], "category": r["category"],
            "price": _round(own.iloc[-1]) if not own.empty else None,
            "d1": _pct(own, 1), "w1": _pct(own, 5), "m1": _pct(own, 21), "ytd": _ytd(own),
            "closes": [_round(v) for v in line.tolist()] if t in aligned.columns else [],
        })
    return {"as_of": _now(), "dates": dates, "rows": rows}


# ------------------------------------------------------------------- FRED (US macro)

def _fred(series_id, timeout=15):
    key = os.environ.get("FRED_API_KEY")
    if key:
        url = ("https://api.stlouisfed.org/fred/series/observations"
               f"?series_id={series_id}&api_key={key}&file_type=json&observation_start=2010-01-01")
        r = requests.get(url, timeout=timeout, headers=UA)
        r.raise_for_status()
        df = pd.DataFrame(r.json().get("observations", []))
        if df.empty:
            return pd.Series(dtype="float64")
        s = pd.to_numeric(df["value"], errors="coerce")
        s.index = pd.to_datetime(df["date"], errors="coerce")
        return s.dropna()
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    resp = requests.get(url, timeout=timeout, headers=UA)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text))
    dc = df.columns[0]
    df[dc] = pd.to_datetime(df[dc], errors="coerce")
    df = df.dropna(subset=[dc]).set_index(dc)
    return pd.to_numeric(df[df.columns[0]], errors="coerce").dropna()


def _transform(s, kind):
    if kind == "yoy":
        return ((s / s.shift(12) - 1.0) * 100.0).dropna()
    if kind == "yoyq":
        return ((s / s.shift(4) - 1.0) * 100.0).dropna()
    return s


def _hist(s, years=10, max_pts=140):
    s = s.dropna()
    if s.empty:
        return []
    s = s[s.index >= s.index[-1] - pd.DateOffset(years=years)]
    if len(s) > max_pts:
        s = s.resample("ME").last().dropna()
    return [[d.strftime("%Y-%m-%d"), round(float(v), 3)] for d, v in s.items()]


def build_macro():
    macro = pd.read_csv(os.path.join(HERE, "macro.csv"))

    def one(rec):
        try:
            s = _transform(_fred(rec["series_id"]), rec.get("transform", "level")).dropna()
            val = round(float(s.iloc[-1]), 2)
            delta = round(float(s.iloc[-1] - s.iloc[-2]), 2) if len(s) > 1 else None
            hist = _hist(s)
        except Exception:
            val, delta, hist = None, None, []
        unit = rec.get("unit")
        return {"name": rec["name"], "category": rec.get("category", ""), "val": val,
                "delta": delta, "unit": "" if pd.isna(unit) else str(unit), "hist": hist}

    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        out = list(ex.map(one, macro.to_dict("records")))
    return {"as_of": _now(), "rows": out}


# --------------------------------------------- cross-country govt data (IMF + BIS)

IMF_INDICATORS = [
    ("GGXWDG_NGDP", "Gov gross debt", "% GDP"),
    ("NGDP_RPCH", "Real GDP growth", "%"),
    ("PCPIPCH", "Inflation", "%"),
    ("LUR", "Unemployment", "%"),
    ("GGXCNL_NGDP", "Fiscal balance", "% GDP"),
    ("BCA_NGDPD", "Current account", "% GDP"),
]
INTL_COUNTRIES = [("USA", "United States"), ("CHN", "China"), ("JPN", "Japan"),
                  ("DEU", "Germany"), ("IND", "India"), ("GBR", "United Kingdom")]
BIS_HOUSING = {"USA": "QUSR628BIS", "CHN": "QCNR628BIS", "JPN": "QJPR628BIS",
               "DEU": "QDER628BIS", "IND": "QINR628BIS", "GBR": "QGBR628BIS"}


def build_intl():
    data = {}
    for code, name, unit in IMF_INDICATORS:
        try:
            url = "https://www.imf.org/external/datamapper/api/v1/" + code + "/" + "/".join(c for c, _ in INTL_COUNTRIES)
            vals = requests.get(url, timeout=20).json().get("values", {}).get(code, {})  # IMF rejects custom UA
        except Exception:
            vals = {}
        per = {}
        for c, _ in INTL_COUNTRIES:
            s = vals.get(c, {})
            pts = [[y, round(float(s[y]), 2)] for y in sorted(s) if s[y] is not None and 2014 <= int(y) <= 2027]
            if pts:
                per[c] = pts
        data[code] = per
    indicators = [{"key": k, "name": n, "unit": u} for k, n, u in IMF_INDICATORS]
    return {"as_of": _now(), "indicators": indicators,
            "countries": [{"code": c, "name": n} for c, n in INTL_COUNTRIES], "data": data}


def main():
    os.makedirs(DATA, exist_ok=True)
    for name, fn in [("market", build_market), ("macro", build_macro), ("intl", build_intl)]:
        obj = fn()
        with open(os.path.join(DATA, f"{name}.json"), "w") as f:
            json.dump(obj, f, separators=(",", ":"))
        if name == "market":
            print(f"market.json: {len(obj['rows'])} rows, {len(obj['dates'])} dates")
        elif name == "macro":
            print(f"macro.json: {sum(1 for r in obj['rows'] if r['val'] is not None)}/{len(obj['rows'])} series")
        else:
            cs = sum(len(v) for v in obj["data"].values())
            print(f"intl.json: {len(obj['indicators'])} indicators, {cs} country-series")


if __name__ == "__main__":
    main()
