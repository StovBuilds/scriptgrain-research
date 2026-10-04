#!/usr/bin/env python3
"""SGR-008 step 3: aggregate per-paper rows into the published tables.

  python3 scripts/experiments/sgr-008/analyse.py --rows ~/research/sgr-008/rows.json --out public/research/sgr-008-summary.json

Every yearly figure is a category-balanced mean: average within each (category,
period), then average across categories present, so a year in which the index
happened to return more computer-science papers does not shift the result.
"""
import json, argparse, collections, statistics as st, re, math

ap = argparse.ArgumentParser(); ap.add_argument("--rows", required=True); ap.add_argument("--out", required=True)
a = ap.parse_args()
rows = [r for r in json.load(open(a.rows)) if 2015 <= r["year"] <= 2026]  # panel years only; older ids come from revised papers
lex = json.load(open(__file__.replace("analyse.py", "lexicons.json")))
fieldOf = {p["cat"]: p["field"] for p in json.load(open(__file__.replace("analyse.py", "panel.json")))["panel"]}

def word_hit(r, w):
    for g in ("called_out", "quiet", "control"):
        if w in r[f"{g}_hits"]: return r[f"{g}_hits"][w]
    return 0

METRICS = {
  "called_out_per1000": lambda r: r["called_out_per1000"],
  "quiet_per1000": lambda r: r["quiet_per1000"],
  "control_per1000": lambda r: r["control_per1000"],
  "share_any_called_out": lambda r: 100.0 if r["called_out_per1000"] > 0 else 0.0,
  "ai_tell_per1000": lambda r: r["ai_tell_per1000"],
  "em_dash_per1000": lambda r: r["em_only_per1000"],
  "avg_sentence_length": lambda r: r["avg_sentence_length"],
  "words": lambda r: r["words"],
  "word_long_pct": lambda r: r["word_long"],
  "pronoun_we": lambda r: r["pronoun_we"],
  "burstiness_variation": lambda r: r["burstiness_variation"],
}
WORDS = [w for g in ("called_out", "quiet", "control") for w in lex[g]]

def balanced(rs, fn, by="cat", min_n=5):
    cells = collections.defaultdict(list)
    for r in rs:
        v = fn(r)
        if v is not None: cells[r[by]].append(v)
    means = [st.mean(v) for v in cells.values() if len(v) >= min_n]
    return (round(st.mean(means), 3) if means else None), len(means)

def period(r, mode):
    if mode == "year": return r["year"]
    return f"{r['year']}H{1 if r['month'] <= 6 else 2}"

out = {"n_abstracts": len(rows), "n_categories": len({r['cat'] for r in rows}), "by_year": {}, "by_half": {}, "by_field_year": {}, "word_share_by_year": {}, "word_share_by_half": {}}
for mode, key in (("year", "by_year"), ("half", "by_half")):
    groups = collections.defaultdict(list)
    for r in rows: groups[period(r, mode)].append(r)
    for p in sorted(groups):
        rs = groups[p]
        out[key][str(p)] = {"n": len(rs), **{m: balanced(rs, f)[0] for m, f in METRICS.items()}}
        wk = "word_share_by_year" if mode == "year" else "word_share_by_half"
        out[wk][str(p)] = {w: balanced(rs, (lambda w: lambda r: 100.0 if word_hit(r, w) else 0.0)(w))[0] for w in WORDS}
fields = sorted(set(fieldOf.values()))
for fld in fields:
    groups = collections.defaultdict(list)
    for r in rows:
        if fieldOf[r["cat"]] == fld: groups[r["year"]].append(r)
    out["by_field_year"][fld] = {str(y): {"n": len(rs), **{m: balanced(rs, METRICS[m])[0] for m in ("called_out_per1000", "quiet_per1000", "share_any_called_out", "em_dash_per1000", "avg_sentence_length")}} for y, rs in sorted(groups.items())}
json.dump(out, open(a.out, "w"), indent=1)

# console summary
print("year      n  called/1k quiet/1k ctrl/1k anyCalled% emdash/1k sentLen tell/1k")
for y, d in out["by_year"].items():
    print(f"{y:6s} {d['n']:6d} {d['called_out_per1000']:8.2f} {d['quiet_per1000']:8.2f} {d['control_per1000']:7.2f} {d['share_any_called_out']:9.1f} {d['em_dash_per1000']:9.2f} {d['avg_sentence_length']:7.1f} {d['ai_tell_per1000']:7.2f}")
