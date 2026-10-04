#!/usr/bin/env python3
"""SGR-008 census step 5: H4 (sentence length equivalence) and the secondary
instrument series (pre-registration sections 4 and 6).

  python3 scripts/experiments/sgr-008/census-instruments-analyse.py --rows ~/research/sgr-008/census-instruments.jsonl.gz \
      --out scripts/experiments/sgr-008/results/census/instruments.json

Primary rule as census-analyse.py: pilot papers out; papers submitted up to
2022-11 kept only with base_ok. H4: mean words per sentence, Y2026 minus BASE,
90% cluster-bootstrap CI over categories (2,000 resamples) must sit inside [-1, +1].
"""
import argparse, collections, gzip, json, random

ap = argparse.ArgumentParser(); ap.add_argument("--rows", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--boot", type=int, default=2000); ap.add_argument("--seed", type=int, default=8)
a = ap.parse_args()
M = ["avg_sentence_length", "sentence_length_variance", "comma_density", "semicolon_frequency", "pronoun_we",
     "word_long", "ai_tell_per1000", "em_dash_per1000", "burstiness_variation", "words"]
def period(ym):
    if "2020-01" <= ym <= "2022-11": return "BASE"
    if ym[:4] == "2024": return "Y2024"
    if ym[:4] == "2026": return "Y2026"
# sums[key][cat][metric] = [sum, count]
sums = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0])))
group_of = {}
for line in gzip.open(a.rows, "rt"):
    r = json.loads(line)
    if r["pilot"] or (r["ym"] <= "2022-11" and not r["base_ok"]): continue
    group_of[r["cat"]] = r["group"]
    for key in (r["ym"][:4], period(r["ym"]), "G:" + r["group"] + ":" + r["ym"][:4]):
        if key is None: continue
        for m in M:
            v = r.get(m)
            if v is not None:
                s = sums[key][r["cat"]][m]; s[0] += v; s[1] += 1
def mean(cells, m, cats=None):
    cats = cats if cats is not None else cells.keys()
    t = sum(cells[c][m][0] for c in cats if c in cells); n = sum(cells[c][m][1] for c in cats if c in cells)
    return t / n if n else None
rng = random.Random(a.seed)
def boot(c1, c2, m, lo=0.05, hi=0.95):
    cats = sorted(set(c1) | set(c2)); out = []
    for _ in range(a.boot):
        s = [rng.choice(cats) for _ in cats]
        m1, m2 = mean(c1, m, s), mean(c2, m, s)
        if m1 is not None and m2 is not None: out.append(m2 - m1)
    out.sort(); return [round(out[int(lo * len(out))], 3), round(out[int(hi * len(out)) - 1], 3)]
res = {"periods": {p: {m: round(mean(sums[p], m), 3) for m in M} for p in ("BASE", "Y2024", "Y2026")}}
d = res["periods"]["Y2026"]["avg_sentence_length"] - res["periods"]["BASE"]["avg_sentence_length"]
ci = boot(sums["BASE"], sums["Y2026"], "avg_sentence_length")
res["H4"] = {"diff_2026_minus_base": round(d, 3), "ci90": ci, "supported": ci[0] > -1 and ci[1] < 1}
res["diffs_2026_minus_base_ci95"] = {m: {"diff": round(res["periods"]["Y2026"][m] - res["periods"]["BASE"][m], 3),
                                         "ci95": boot(sums["BASE"], sums["Y2026"], m, 0.025, 0.975)} for m in M}
res["by_year"] = {k: {m: round(mean(sums[k], m), 3) for m in M} for k in sorted(sums) if len(k) == 4}
res["by_group_year"] = {k[2:]: {m: round(mean(sums[k], m), 3) for m in ("avg_sentence_length", "ai_tell_per1000", "em_dash_per1000", "words")} for k in sorted(sums) if k.startswith("G:")}
json.dump(res, open(a.out, "w"), indent=1)
print(json.dumps({"H4": res["H4"], "periods": res["periods"]}, indent=1))
