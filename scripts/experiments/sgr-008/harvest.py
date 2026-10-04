#!/usr/bin/env python3
"""SGR-008 step 1: pull abstracts from Firecrawl Research Index per panel cell.

  python3 scripts/experiments/sgr-008/harvest.py --cache ~/research/sgr-008/harvest [--workers 4]

One GET /v2/search/research/papers per (category, query, year window). Raw
responses are cached locally (abstract text stays on this machine and is never
committed); re-running skips cells already cached. A credit-balance reading is
logged before and after so the run's cost is on record.
"""
import json, os, sys, time, argparse, urllib.parse, subprocess, concurrent.futures as cf
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--cache", required=True)
ap.add_argument("--workers", type=int, default=4)
a = ap.parse_args()
cache = Path(os.path.expanduser(a.cache)); cache.mkdir(parents=True, exist_ok=True)
panel = json.load(open(Path(__file__).with_name("panel.json")))
key = next(l.split("=", 1)[1].strip().strip("'\"") for l in open(os.path.expanduser("~/.bot-infra.env")) if l.startswith("FIRECRAWL_API_KEY="))

def curl(url):
    # curl -4: the fleet's Firecrawl/CF calls are IPv4-only here
    out = subprocess.run(["curl", "-s", "-4", "--max-time", "60", url, "-H", f"Authorization: Bearer {key}"], capture_output=True, text=True)
    return json.loads(out.stdout)

def balance():
    try: return curl("https://api.firecrawl.dev/v2/team/credit-usage")["data"]["remainingCredits"]
    except Exception: return None

cells = [(p["cat"], q, y) for p in panel["panel"] for q in p["q"] for y in panel["years"]]
def fname(c, q, y): return cache / f"{c}__{q.replace(' ', '_').replace('/', '-')}__{y}.json"

def run(cell):
    c, q, y = cell
    f = fname(c, q, y)
    if f.exists(): return "cached"
    qs = urllib.parse.urlencode({"query": q, "k": panel["k"], "categories": c, "from": f"{y}-01-01", "to": f"{y}-12-31"})
    for attempt in range(5):
        try:
            d = curl(f"https://api.firecrawl.dev/v2/search/research/papers?{qs}")
            if d.get("success"):
                f.write_text(json.dumps({"cat": c, "query": q, "window": y, "results": d["results"]}))
                return len(d["results"])
            err = str(d)[:200]
        except Exception as e:
            err = str(e)
        time.sleep(2 ** attempt * 3)
    print("FAIL", cell, err, file=sys.stderr); return "fail"

b0 = balance(); t0 = time.time()
done = n = 0
with cf.ThreadPoolExecutor(a.workers) as ex:
    for r in ex.map(run, cells):
        done += 1
        if isinstance(r, int): n += r
        if done % 100 == 0: print(f"{done}/{len(cells)} cells, {n} results", file=sys.stderr)
b1 = balance()
with open(cache.parent / "credits-ledger.jsonl", "a") as L:
    L.write(json.dumps({"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "step": "harvest", "cells": len(cells), "results": n, "balance_before": b0, "balance_after": b1, "secs": round(time.time() - t0)}) + "\n")
print(f"done: {n} results; balance {b0} -> {b1}", file=sys.stderr)
