#!/usr/bin/env python3
"""SGR-008 census step 3: confirmatory counts for H1-H3 and the excess-
vocabulary candidates (pre-registration sections 4 and 5).

  python3 scripts/experiments/sgr-008/census-analyse.py --papers ~/research/sgr-008/census-papers.jsonl.gz \
      --out scripts/experiments/sgr-008/results/census

Writes, under --out:
  set-counts.json     n and per-set / per-word presence counts by (rule, period, category)
  h1-h3.json          H1, H2, H3 with 95% cluster-bootstrap CIs (2,000 resamples over categories)
  excess-candidates.json  every candidate word with p, q, d, r per year, on the
                      selection half (odd months) and the scoring half (even months)
  word-freq.json      yearly document frequency 2015-2026 for every candidate and frozen-set word
Rules: "primary" = pilot papers out, and papers submitted up to 2022-11 kept only
when no version is dated after 2022-11-30; "all" = pilot out, no revision rule.
"""
import argparse, collections, gzip, json, os, random

ap = argparse.ArgumentParser(); ap.add_argument("--papers", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--boot", type=int, default=2000); ap.add_argument("--seed", type=int, default=8)
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
OLD = ["innovative", "utilized", "advancements", "pivotal", "facilitates", "firstly", "tackle", "showcasing", "underscores", "delve", "delves", "intricate"]
NEW = ["underexplored", "grounded", "aligns", "synthesizes", "replaces", "leaving", "recovers", "expose", "structurally", "reproducible", "treats", "vanishes"]
CONTROL = ["however", "results", "using", "show", "method"]
SETS = {"old": set(OLD), "new": set(NEW), "control": set(CONTROL)}
WORDS = OLD + NEW + CONTROL

def half(ym): return f"{ym[:4]}H{1 if int(ym[5:]) <= 6 else 2}"
def period(ym):
    if "2020-01" <= ym <= "2022-11": return "BASE"
    if ym[:4] == "2024": return "Y2024"
    if ym[:4] == "2026": return "Y2026"
    return None

# counts[rule][timekey][cat] = [n, old, new, control, w0..wk]
counts = {r: collections.defaultdict(lambda: collections.defaultdict(lambda: [0] * (4 + len(WORDS)))) for r in ("primary", "all")}
df = collections.defaultdict(collections.Counter)   # (year, parity) -> word -> docs  (primary rule)
N = collections.Counter()
groups = {}
lag = collections.defaultdict(list)
rows = 0
for line in gzip.open(os.path.expanduser(a.papers), "rt"):
    p = json.loads(line); rows += 1
    if p["pilot"]: continue
    ym = p["ym"]; cat = p["cat"]; groups[cat] = p["group"]
    toks = set(p["toks"].split())
    vec = [1, int(bool(toks & SETS["old"])), int(bool(toks & SETS["new"])), int(bool(toks & SETS["control"]))] + [int(w in toks) for w in WORDS]
    primary_ok = p["base_ok"] or ym > "2022-11"
    for rule in ("primary", "all"):
        if rule == "primary" and not primary_ok: continue
        for key in (ym[:4], half(ym), ym, period(ym)):
            if key is None: continue
            c = counts[rule][key][cat]
            for i, v in enumerate(vec): c[i] += v
    if primary_ok:
        k = (ym[:4], p["parity"]); N[k] += 1; df[k].update(toks)
        # Deviation 4: the 2022 counterfactual year is Jan to Nov, matching BASE.
        # Correction 2026-10-12: until then Dec 2022 was counted in it too.
        if "2022-01" <= ym <= "2022-11":
            k = ("2022cf", p["parity"]); N[k] += 1; df[k].update(toks)
    if p["lag_days"] is not None and ym[:4] in ("2024", "2025", "2026"): lag[ym[:4]].append(p["lag_days"])

json.dump({r: {k: dict(v) for k, v in counts[r].items()} for r in counts}, open(f"{a.out}/set-counts.json", "w"))

# ---- H1-H3 with cluster bootstrap over categories ----
rng = random.Random(a.seed)
def share(cells, idx, cats=None):
    cats = cats if cats is not None else list(cells)
    n = sum(cells[c][0] for c in cats if c in cells); h = sum(cells[c][idx] for c in cats if c in cells)
    return 100 * h / n if n else float("nan")
def boot_diff(c1, c2, idx, B=a.boot):
    cats = sorted(set(c1) | set(c2)); out = []
    for _ in range(B):
        s = [rng.choice(cats) for _ in cats]
        n1 = sum(c1[c][0] for c in s if c in c1); h1 = sum(c1[c][idx] for c in s if c in c1)
        n2 = sum(c2[c][0] for c in s if c in c2); h2 = sum(c2[c][idx] for c in s if c in c2)
        if n1 and n2: out.append(100 * h2 / n2 - 100 * h1 / n1)
    out.sort(); return [round(out[int(0.025 * len(out))], 3), round(out[int(0.975 * len(out)) - 1], 3)]
def test(rule):
    C = counts[rule]; R = {}
    for name, idx in (("old", 1), ("new", 2), ("control", 3)):
        R[name] = {p: round(share(C[p], idx), 3) for p in ("BASE", "Y2024", "Y2026")}
        R[name]["diff_2024_minus_base"] = round(R[name]["Y2024"] - R[name]["BASE"], 3); R[name]["ci_2024_minus_base"] = boot_diff(C["BASE"], C["Y2024"], idx)
        R[name]["diff_2026_minus_2024"] = round(R[name]["Y2026"] - R[name]["Y2024"], 3); R[name]["ci_2026_minus_2024"] = boot_diff(C["Y2024"], C["Y2026"], idx)
        R[name]["diff_2026_minus_base"] = round(R[name]["Y2026"] - R[name]["BASE"], 3); R[name]["ci_2026_minus_base"] = boot_diff(C["BASE"], C["Y2026"], idx)
    R["n"] = {p: sum(v[0] for v in C[p].values()) for p in ("BASE", "Y2024", "Y2026")}
    o = R["old"]; nw = R["new"]
    R["H1"] = o["ci_2024_minus_base"][0] > 0 and o["ci_2026_minus_2024"][1] < 0
    by_group = {}
    for g in sorted(set(groups.values())):
        cs = [c for c in groups if groups[c] == g]
        b = share(C["BASE"], 2, cs); y = share(C["Y2026"], 2, cs)
        by_group[g] = {"base": round(b, 3), "y2026": round(y, 3), "ratio": round(y / b, 2) if b else None,
                       "n_base": sum(C["BASE"][c][0] for c in cs if c in C["BASE"]), "n_2026": sum(C["Y2026"][c][0] for c in cs if c in C["Y2026"])}
    R["new_by_group"] = by_group
    main8 = [g for g in by_group if g != "other"]
    R["H2_groups_ratio_ge_2"] = sum(1 for g in main8 if (by_group[g]["ratio"] or 0) >= 2)
    R["H2"] = nw["ci_2026_minus_2024"][0] > 0 and nw["ci_2026_minus_base"][0] > 0 and R["H2_groups_ratio_ge_2"] >= 6
    halves = sorted(k for k in C if len(k) == 6 and k[4] == "H" and k >= "2025H1")
    seq = [(h, share(C[h], 2) > share(C[h], 1)) for h in halves]
    cross = None
    for i, (h, _) in enumerate(seq):
        if all(v for _, v in seq[i:]): cross = h; break
    R["H3"] = cross is not None; R["H3_crossover_half"] = cross
    R["half_series"] = {h: {"n": sum(v[0] for v in C[h].values()), "old": round(share(C[h], 1), 3), "new": round(share(C[h], 2), 3), "control": round(share(C[h], 3), 3)}
                        for h in sorted(k for k in C if len(k) == 6 and k[4] == "H")}
    R["word_share_by_year"] = {y: {w: round(share(C[y], 4 + i), 3) for i, w in enumerate(WORDS)} for y in sorted(k for k in C if len(k) == 4)}
    return R
res = {"rows_read": rows, "primary": test("primary"), "all_papers_sensitivity": test("all"),
       "latest_version_lag_days_median": {y: sorted(v)[len(v) // 2] for y, v in lag.items()},
       "share_revised_after_90_days": {y: round(100 * sum(1 for x in v if x > 90) / len(v), 2) for y, v in lag.items()}}
json.dump(res, open(f"{a.out}/h1-h3.json", "w"), indent=1)

# ---- excess vocabulary (selection = odd months, scoring = even months) ----
def p(year, par, w): return df[(year, par)][w] / N[(year, par)] if N[(year, par)] else 0.0
def stats(year, par, w):
    p21, p22, pt = p("2021", par, w), p("2022cf", par, w), p(year, par, w)
    q = p22 + max(0.0, p22 - p21) * (int(year) - 2022)
    return {"p": round(pt, 6), "q": round(q, 6), "d": round(pt - q, 6), "r": round(pt / q, 2) if q > 0 else None}
cands = {}
for year in ("2023", "2024", "2025", "2026"):
    for w, c in df[(year, "odd")].items():
        s = stats(year, "odd", w)
        if s["p"] < 0.0005: continue
        ok = s["d"] >= 0.001 or ((s["r"] is None or s["r"] >= 2) and s["p"] >= 0.001)
        if ok: cands.setdefault(w, {})[year] = {"select": s, "score": stats(year, "even", w)}
json.dump({"n": {f"{k[0]}-{k[1]}": v for k, v in N.items()}, "candidates": cands}, open(f"{a.out}/excess-candidates.json", "w"))
keep = set(cands) | set(WORDS)
wf = {y: {"n": N[(y, "odd")] + N[(y, "even")], "df": {w: df[(y, "odd")][w] + df[(y, "even")][w] for w in keep if df[(y, "odd")][w] + df[(y, "even")][w]}}
      for y in sorted({k[0] for k in N} - {"2022cf"})}
json.dump(wf, open(f"{a.out}/word-freq.json", "w"))
pr = res["primary"]
print(json.dumps({"rows": rows, "n": pr["n"], "H1": pr["H1"], "H2": pr["H2"], "H3": pr["H3"], "cross": pr["H3_crossover_half"],
                  "old": {k: pr["old"][k] for k in ("BASE", "Y2024", "Y2026")}, "new": {k: pr["new"][k] for k in ("BASE", "Y2024", "Y2026")},
                  "candidates": len(cands)}, indent=1))
