"""Build market.json + macro.json for the static Pillars dashboard.

Runs in CI (GitHub Actions) where Yahoo Finance and FRED are reachable. Reads watchlist.csv
and macro.csv (next to this file) and writes data/market.json + data/macro.json. Failures
degrade gracefully (missing tickers/series are skipped) so a transient outage never breaks the page.
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


def _pct(s: pd.Series, lookback: int):
    """Percent change over `lookback` trading days, computed on a ticker's real closes."""
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
    aligned = raw.dropna(how="all").ffill()  # continuous union index, for chart lines
    dates = [d.strftime("%Y-%m-%d") for d in aligned.index]

    rows = []
    for _, r in watch.iterrows():
        t = r["ticker"]
        own = raw[t].dropna() if t in raw.columns else pd.Series(dtype="float64")  # real trading closes
        line = aligned[t] if t in aligned.columns else pd.Series(dtype="float64")  # continuous, for chart
        rows.append({
            "ticker": t,
            "name": r["name"],
            "category": r["category"],
            "price": _round(own.iloc[-1]) if not own.empty else None,
            "d1": _pct(own, 1),
            "w1": _pct(own, 5),
            "m1": _pct(own, 21),
            "ytd": _ytd(own),
            "closes": [_round(v) for v in line.tolist()] if t in aligned.columns else [],
        })
    return {"as_of": _now(), "dates": dates, "rows": rows}


def _fred(series_id, timeout=12):
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


def build_macro():
    macro = pd.read_csv(os.path.join(HERE, "macro.csv"))

    def one(rec):
        try:
            s = _transform(_fred(rec["series_id"]), rec.get("transform", "level")).dropna()
            val = round(float(s.iloc[-1]), 2)
            delta = round(float(s.iloc[-1] - s.iloc[-2]), 2) if len(s) > 1 else None
        except Exception:
            val, delta = None, None
        unit = rec.get("unit")
        return {
            "name": rec["name"], "category": rec.get("category", ""),
            "val": val, "delta": delta, "unit": "" if pd.isna(unit) else str(unit),
        }

    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        out = list(ex.map(one, macro.to_dict("records")))
    return {"as_of": _now(), "rows": out}


def main():
    os.makedirs(DATA, exist_ok=True)
    market = build_market()
    with open(os.path.join(DATA, "market.json"), "w") as f:
        json.dump(market, f, separators=(",", ":"))
    print(f"market.json: {len(market['rows'])} rows, {len(market['dates'])} dates")
    macro = build_macro()
    with open(os.path.join(DATA, "macro.json"), "w") as f:
        json.dump(macro, f, separators=(",", ":"))
    got = sum(1 for r in macro["rows"] if r["val"] is not None)
    print(f"macro.json: {got}/{len(macro['rows'])} series populated")


if __name__ == "__main__":
    main()
