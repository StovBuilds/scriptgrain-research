#!/usr/bin/env python3
"""SGR-008 census step 7 (EXPLORATORY, added after the confirmatory run, not
pre-registered): placebo tests for the lower bounds.

  python3 scripts/experiments/sgr-008/census-placebo.py --results scripts/experiments/sgr-008/results/census \
      --papers ~/research/sgr-008/census-papers.jsonl.gz

The real analysis extrapolates 2021-22 to 2023-26. The placebo shifts the whole
calendar back five years, to a period with no LLMs: counterfactual from 2016-17,
"targets" 2018-21. The true answer there is zero, so any positive "bound" is
what ordinary vocabulary and topic drift produce on their own.
  A. The ACTUAL style sets (2024 and 2026 lists): do these particular words drift
     upward by themselves before any LLM existed?
  B. The whole selection procedure re-run on pre-LLM data: top 50 words by gap d
     on odd months of the pseudo year, q < 5%, minus words labelled CONTENT,
     scored on even months. This is what selection alone manufactures. Unlabelled
     topic words are NOT removed here, which can only make B larger.
Same primary rule, pilot exclusion and bound formula as census-bounds.py.
"""
import argparse, collections, gzip, json, os, random

ap = argparse.ArgumentParser(); ap.add_argument("--results", required=True); ap.add_argument("--papers", required=True)
ap.add_argument("--boot", type=int, default=1000); ap.add_argument("--seed", type=int, default=8)
a = ap.parse_args(); R = a.results
hb = json.load(open(f"{R}/h5-bounds.json")); labels = json.load(open(f"{R}/labels.json"))
REAL = {"set2024": set(hb["style_2024"]), "set2026": set(hb["style_2026"])}
SHIFT = {"2016": "2021", "2017": "2022", "2018": "2023", "2019": "2024", "2020": "2025", "2021": "2026"}
df = collections.defaultdict(collections.Counter); N = collections.Counter()
cells = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0, 0]))  # year -> cat -> n, has2024set, has2026set (even months)
for line in gzip.open(os.path.expanduser(a.papers), "rt"):
    p = json.loads(line)
    y = p["ym"][:4]
    if p["pilot"] or y not in SHIFT or not p["base_ok"]: continue
    t = set(p["toks"].split())
    if p["parity"] == "odd":
        N[y] += 1; df[y].update(t)
    else:
        c = cells[y][p["cat"]]; c[0] += 1; c[1] += int(bool(t & REAL["set2024"])); c[2] += int(bool(t & REAL["set2026"]))
rng = random.Random(a.seed)
def bound_from(cs, idx, target, cats=None):
    def sh(y):
        cc = cs[y]; ks = cats if cats is not None else cc.keys()
        n = sum(cc[k][0] for k in ks if k in cc); h = sum(cc[k][idx] for k in ks if k in cc)
        return h / n if n else None
    p16, p17, pt = sh("2016"), sh("2017"), sh(target)
    if None in (p16, p17, pt): return None
    q = p17 + max(0.0, p17 - p16) * (int(target) - 2017)
    return (pt - q) / (1 - q) if q < 1 else None
def with_ci(cs, idx, target):
    est = bound_from(cs, idx, target); cats = sorted(set().union(*(cs[y].keys() for y in ("2016", "2017", target))))
    bs = []
    for _ in range(a.boot):
        s = [rng.choice(cats) for _ in cats]; b = bound_from(cs, idx, target, s)
        if b is not None: bs.append(b)
    bs.sort()
    return {"placebo_bound_pct": round(100 * est, 2) if est is not None else None,
            "ci95": [round(100 * bs[int(0.025 * len(bs))], 2), round(100 * bs[int(0.975 * len(bs)) - 1], 2)] if bs else None,
            "real_year_equivalent": SHIFT[target]}
out = {"A_actual_sets": {name: {t: with_ci(cells, idx, t) for t in ("2018", "2019", "2020", "2021")} for name, idx in (("set2024", 1), ("set2026", 2))}}
# B: re-run selection in the pseudo period
def pf(y, w): return df[y][w] / N[y]
B = {}; WS = {}
for target in ("2019", "2021"):
    cand = []
    for w, c in df[target].items():
        pt = c / N[target]
        if pt < 0.0005: continue
        q = pf("2017", w) + max(0.0, pf("2017", w) - pf("2016", w)) * (int(target) - 2017)
        d = pt - q; r = pt / q if q > 0 else None
        if q < 0.05 and (d >= 0.001 or ((r is None or r >= 2) and pt >= 0.001)) and labels.get(w) != "CONTENT":
            cand.append((d, w))
    WS[target] = set(w for d, w in sorted(cand, reverse=True)[:50])
# second streaming pass: score the re-selected sets on even months (holding every
# paper's tokens in memory for one pass would need ~3 GB)
CS = {t: collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0])) for t in WS}
for line in gzip.open(os.path.expanduser(a.papers), "rt"):
    p = json.loads(line)
    y = p["ym"][:4]
    if p["pilot"] or p["parity"] != "even" or not p["base_ok"] or y not in ("2016", "2017", "2019", "2021"): continue
    t = set(p["toks"].split())
    for target, W in WS.items():
        if y in ("2016", "2017", target):
            c = CS[target][y][p["cat"]]; c[0] += 1; c[1] += int(bool(t & W))
for target, W in WS.items():
    B[target] = {"words": sorted(W), **with_ci(CS[target], 1, target)}
out["B_reselected_on_pre_llm_data"] = B
json.dump(out, open(f"{R}/placebo.json", "w"), indent=1)
print(json.dumps({"A": out["A_actual_sets"], "B": {k: {kk: vv for kk, vv in v.items() if kk != "words"} for k, v in B.items()}}, indent=1))
