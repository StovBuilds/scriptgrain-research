#!/usr/bin/env python3
"""SGR-008 census step 6: H5 and the lower bounds (pre-registration section 5,
clarification 5).

  # 1. list the words to label (top 200 by selection-half gap d, 2024 and 2026)
  python3 scripts/experiments/sgr-008/census-bounds.py --results scripts/experiments/sgr-008/results/census --list-for-labelling
  # 2. after labels.json exists ({word: "STYLE"|"CONTENT"}), score on the even-month half
  python3 scripts/experiments/sgr-008/census-bounds.py --results scripts/experiments/sgr-008/results/census \
      --papers ~/research/sgr-008/census-papers.jsonl.gz

Lower bound for a word set W in year t (even months only, primary rule):
p = share of abstracts with any word of W, q = p_2022 + max(0, p_2022 - p_2021)(t - 2022),
s >= (p - q) / (1 - q). CIs: 95% cluster bootstrap over categories.
"""
import argparse, collections, gzip, json, os, random

ap = argparse.ArgumentParser()
ap.add_argument("--results", required=True); ap.add_argument("--papers")
ap.add_argument("--list-for-labelling", action="store_true")
ap.add_argument("--boot", type=int, default=2000); ap.add_argument("--seed", type=int, default=8)
a = ap.parse_args()
R = a.results
C = json.load(open(f"{R}/excess-candidates.json"))["candidates"]
QMAX = 0.05  # deviation 7: words already in 5%+ of abstracts saturate a union bound
def top(year, k):
    ws = [(v[year]["select"]["d"], w) for w, v in C.items() if year in v and v[year]["select"]["q"] < QMAX]
    return [w for d, w in sorted(ws, reverse=True)[:k]]
if a.list_for_labelling:
    ws = sorted(set(top("2024", 200)) | set(top("2026", 200)))
    open(f"{R}/label-words.txt", "w").write("\n".join(ws) + "\n")
    print(len(ws), "words written to label-words.txt"); raise SystemExit
labels = json.load(open(f"{R}/labels.json"))
def top_style(year, k=50):
    ws = sorted(((v[year]["select"]["d"], w) for w, v in C.items() if year in v and v[year]["select"]["q"] < QMAX and labels.get(w) == "STYLE"), reverse=True)
    return [w for d, w in ws[:k]]
S24, S26 = top_style("2024"), top_style("2026")
jac = len(set(S24) & set(S26)) / len(set(S24) | set(S26))
out = {"style_2024": S24, "style_2026": S26, "H5": {"jaccard": round(jac, 3), "supported": jac < 0.5,
       "overlap": sorted(set(S24) & set(S26))}}
if a.papers:
    SETS = {"set2024": set(S24), "set2026": set(S26), "union": set(S24) | set(S26)}
    cells = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0, 0, 0]))  # (year|G:grp:year)[cat] = n, h24, h26, hU
    for line in gzip.open(os.path.expanduser(a.papers), "rt"):
        p = json.loads(line)
        if p["pilot"] or p["parity"] != "even" or (p["ym"] <= "2022-11" and not p["base_ok"]): continue
        y = p["ym"][:4]
        if y < "2021": continue
        # Deviation 4: the 2022 counterfactual year is Jan to Nov (correction 2026-10-12)
        if p["ym"] == "2022-12": continue
        t = set(p["toks"].split())
        v = (1, int(bool(t & SETS["set2024"])), int(bool(t & SETS["set2026"])), int(bool(t & SETS["union"])))
        for key in (y, f"G:{p['group']}:{y}"):
            c = cells[key][p["cat"]]
            for i in range(4): c[i] += v[i]
    def share(cs, idx, cats=None):
        cats = cats if cats is not None else cs.keys()
        n = sum(cs[c][0] for c in cats if c in cs); h = sum(cs[c][idx] for c in cats if c in cs)
        return h / n if n else None
    def bound(prefix, year, idx, cats=None):
        p21, p22, pt = share(cells[prefix + "2021"], idx, cats), share(cells[prefix + "2022"], idx, cats), share(cells[prefix + year], idx, cats)
        if None in (p21, p22, pt): return None
        q = p22 + max(0.0, p22 - p21) * (int(year) - 2022)
        return (pt - q) / (1 - q) if q < 1 else None  # q >= 1: the trend alone saturates; no bound
    rng = random.Random(a.seed)
    def with_ci(prefix, year, idx):
        est = bound(prefix, year, idx)
        cats = sorted(set(cells[prefix + "2021"]) | set(cells[prefix + "2022"]) | set(cells[prefix + year]))
        bs = []
        for _ in range(a.boot):
            s = [rng.choice(cats) for _ in cats]
            # resample categories, keeping each category's counts in every year
            agg = {}
            for yy in ("2021", "2022", year):
                n = sum(cells[prefix + yy][c][0] for c in s if c in cells[prefix + yy]); h = sum(cells[prefix + yy][c][idx] for c in s if c in cells[prefix + yy])
                agg[yy] = h / n if n else None
            if None in agg.values(): continue
            q = agg["2022"] + max(0.0, agg["2022"] - agg["2021"]) * (int(year) - 2022)
            if q < 1: bs.append((agg[year] - q) / (1 - q))
        bs.sort()
        return {"lower_bound_pct": round(100 * est, 2) if est is not None else None,
                "ci95": [round(100 * bs[int(0.025 * len(bs))], 2), round(100 * bs[int(0.975 * len(bs)) - 1], 2)] if bs else None}
    out["bounds"] = {name: {y: with_ci("", y, idx) for y in ("2023", "2024", "2025", "2026")}
                     for name, idx in (("set2024", 1), ("set2026", 2), ("union", 3))}
    grps = sorted({k.split(":")[1] for k in cells if k.startswith("G:")})
    out["bounds_by_group_union"] = {g: {y: with_ci(f"G:{g}:", y, 3) for y in ("2024", "2026")} for g in grps}
json.dump(out, open(f"{R}/h5-bounds.json", "w"), indent=1)
print(json.dumps({k: v for k, v in out.items() if k not in ("bounds_by_group_union",)}, indent=1)[:3000])
