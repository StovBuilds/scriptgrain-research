#!/usr/bin/env python3
"""SGR-008 census step 2: apply the pre-registered inclusion rules
(docs/research/sgr-008-preregistration.md, section 2) to the harvested arXiv
records and write one compact row per included paper.

  python3 scripts/experiments/sgr-008/census-build.py --census ~/research/sgr-008/census \
      --pilot ~/research/sgr-008/harvest --out ~/research/sgr-008/census-papers.jsonl.gz

Each output row: id, ym (YYYY-MM from the id), cat (primary), group, parity
(odd/even submission month), base_ok (no version dated after 2022-11-30),
lag_days (latest version minus first version), n_versions, licence, pilot
(in the Research Index pilot sample), words (cleaned word count) and toks
(sorted unique lowercase tokens of 3+ letters, space-joined). Exclusion counts
go to census-build-exclusions.json next to --out. No abstract text is written.
"""
import argparse, collections, glob, gzip, json, os, re
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone

ap = argparse.ArgumentParser()
ap.add_argument("--census", required=True); ap.add_argument("--pilot", required=True); ap.add_argument("--out", required=True)
a = ap.parse_args()
X = os.path.expanduser

CUTOFF = datetime(2022, 11, 30, 23, 59, 59, tzinfo=timezone.utc)
NEWID = re.compile(r"^(\d{2})(\d{2})\.\d{4,5}$")
WITHDRAWN = re.compile(r"^\W*(this|the) (paper|article|manuscript|submission|preprint|work|version)\b.{0,40}\b(withdrawn|removed)|^\W*withdrawn\b|has been withdrawn", re.I)
STOP = set("the of and to in a is that for on with as by we this are be an at from it which can or our these has have was were their its not but also than been such into more two one between both where when how all they there".split())
PHYS = {"astro-ph", "cond-mat", "gr-qc", "hep-ex", "hep-lat", "hep-ph", "hep-th", "math-ph", "nlin", "nucl-ex", "nucl-th", "physics", "quant-ph"}
def group(cat):
    arch = cat.split(".")[0]
    if arch in PHYS: return "physics"
    return arch if arch in {"cs", "math", "stat", "eess", "q-bio", "q-fin", "econ"} else "other"

def clean(s):  # mirrors measure.mjs clean()
    s = re.sub(r"\$\$[\s\S]*?\$\$|\$[^$]*\$", " X ", s)
    s = re.sub(r"\\(?:cite|ref|label)\{[^}]*\}", " ", s)
    s = re.sub(r"\\[a-zA-Z]+\*?(\{[^}]*\})?", lambda m: m.group(1)[1:-1] if m.group(1) else " ", s)
    s = s.replace("---", "\u2014").replace("--", "\u2013")
    s = re.sub(r"[{}~]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

pilot = set()
for f in glob.glob(X(a.pilot) + "/*.json"):
    for p in json.load(open(f))["results"]:
        if p["primaryId"].startswith("arxiv:"): pilot.add(p["primaryId"][6:])

ex = collections.Counter(); seen = set(); kept = 0
with gzip.open(X(a.out), "wt") as out:
    for f in sorted(glob.glob(X(a.census) + "/part-*.jsonl.gz")):
        for line in gzip.open(f, "rt"):
            r = json.loads(line)
            m = NEWID.match(r["id"] or "")
            if not m: ex["old_style_id"] += 1; continue
            yy, mm = int(m.group(1)), int(m.group(2))
            if not (15 <= yy <= 26) or (yy == 26 and mm > 9): ex["outside_2015_01_to_2026_09"] += 1; continue
            if r["id"] in seen: ex["duplicate_record"] += 1; continue
            seen.add(r["id"])
            ab = r.get("abstract") or ""
            if WITHDRAWN.search(ab[:200]): ex["withdrawn"] += 1; continue
            t = clean(ab)
            words = t.split()
            if len(words) < 50: ex["under_50_words"] += 1; continue
            lw = [w.lower().strip(".,;:()[]\"'") for w in words]
            if sum(w in STOP for w in lw) / len(lw) < 0.05: ex["non_english"] += 1; continue
            vd = []
            for d in r.get("versions") or []:
                try: vd.append(parsedate_to_datetime(d))
                except Exception: pass
            base_ok = bool(vd) and max(vd) <= CUTOFF
            lag = (max(vd) - min(vd)).days if vd else None
            cat = (r.get("categories") or "").split()[0] if r.get("categories") else "unknown"
            toks = sorted(set(re.findall(r"[a-z][a-z\-]{2,}", t.lower())))
            out.write(json.dumps({"id": r["id"], "ym": f"20{yy:02d}-{mm:02d}", "cat": cat, "group": group(cat),
                                  "parity": "odd" if mm % 2 else "even", "base_ok": base_ok, "lag_days": lag,
                                  "n_versions": len(vd), "licence": r.get("license"), "pilot": r["id"] in pilot,
                                  "words": len(words), "toks": " ".join(toks)}) + "\n")
            kept += 1
summary = {"kept": kept, "excluded": dict(ex), "pilot_ids_known": len(pilot), "pilot_ids_in_census": sum(1 for i in pilot if i in seen)}
json.dump(summary, open(X(a.out).replace(".jsonl.gz", "") + "-exclusions.json", "w"), indent=1)
print(json.dumps(summary))
