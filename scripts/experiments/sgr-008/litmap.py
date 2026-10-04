#!/usr/bin/env python3
"""SGR-008 literature map: how much has been published on LLMs and scientific
writing, by month and by kind of study, found with Firecrawl Research Index.

  python3 scripts/experiments/sgr-008/litmap.py --dir ~/research/sgr-008/litmap --out public/research/sgr-008-litmap.json

Inputs (all in --dir): queries.txt (the 20 fixed searches), candidates.json
(every hit), prefiltered.json (hits naming both an AI term and a scholarly-text
term), screen-out.tsv (one label per prefiltered paper, assigned by a model from
title and abstract snippet), meta/ (paper metadata for non-arXiv ids, for dates).
Date: arXiv id month (YYMM) where there is one, else the record's createdDate.
"""
import json, argparse, collections, re, glob, os
from email.utils import parsedate_to_datetime
ap = argparse.ArgumentParser(); ap.add_argument("--dir", required=True); ap.add_argument("--out", required=True)
a = ap.parse_args(); D = os.path.expanduser(a.dir)
pre = json.load(open(f"{D}/prefiltered.json"))
cand = json.load(open(f"{D}/candidates.json"))
lab = dict(l.rstrip("\n").split("\t") for l in open(f"{D}/screen-out.tsv"))
meta = {}
for f in glob.glob(f"{D}/meta/*.json"):
    d = json.load(open(f))
    if d.get("success"): meta[d["paper"]["paperId"]] = d["paper"]
byid = {p["paperId"]: p for p in meta.values()}
def ym(pid, rec):
    m = re.match(r"arxiv:(\d{2})(\d{2})\.", pid)
    if m: return f"20{m.group(1)}-{m.group(2)}"
    for p in meta.values():
        if pid.split(":", 1)[1] in sum(p["ids"].values(), []):
            c = p.get("createdDate") or ""
            try: return parsedate_to_datetime(c).strftime("%Y-%m")
            except Exception: return c[:7] if re.match(r"\d{4}-\d{2}", c) else None
    return None
rows = []
for pid, label in lab.items():
    if label == "off_topic": continue
    rows.append({"id": pid, "label": label, "month": ym(pid, pre[pid]), "source": pid.split(":")[0], "title": pre[pid]["title"]})
dated = [r for r in rows if r["month"]]
def q(m): y, mo = m.split("-"); return f"{y}Q{(int(mo) - 1) // 3 + 1}"
byq = collections.defaultdict(collections.Counter)
for r in dated: byq[q(r["month"])][r["label"]] += 1
out = {
  "queries": open(f"{D}/queries.txt").read().split("\n")[:-1] if open(f"{D}/queries.txt").read().endswith("\n") else open(f"{D}/queries.txt").read().split("\n"),
  "n_candidates": len(cand), "n_prefiltered": len(pre), "n_on_topic": len(rows), "n_dated": len(dated),
  "by_label": dict(collections.Counter(r["label"] for r in rows)),
  "by_source": dict(collections.Counter(r["source"] for r in rows)),
  "by_quarter": {k: dict(v) for k, v in sorted(byq.items())},
}
json.dump(out, open(a.out, "w"), indent=1)
print(json.dumps({k: v for k, v in out.items() if k != "queries"}, indent=1))
