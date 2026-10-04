#!/usr/bin/env python3
"""SGR-008 step 4 (EXPLORATORY, chosen after looking at the data): did the
LLM tells change between 2024 and 2026?

  python3 scripts/experiments/sgr-008/wordsets.py --cache ~/research/sgr-008/harvest --out scripts/experiments/sgr-008/results/wordsets-series.json

OLD = twelve words that rose in 2023-24 (the published ChatGPT tells).
NEW = twelve non-topical words that rose most in 2026 against 2020-22, picked
by hand from the excess-vocabulary ranking with AI-topic words removed. Because
NEW was picked after seeing the data, the held-out check below re-selects a
list on half the categories and tests it on the other half.
Shares are category-balanced (mean of per-category shares, categories with 5+ papers).
"""
import json, glob, re, collections, argparse, os
ap = argparse.ArgumentParser(); ap.add_argument("--cache", required=True); ap.add_argument("--out", required=True)
a = ap.parse_args()
here = os.path.dirname(os.path.abspath(__file__))
panel = json.load(open(f"{here}/panel.json"))
cats = [p["cat"] for p in panel["panel"]]
NEW = ["underexplored", "grounded", "aligns", "synthesizes", "replaces", "leaving", "recovers", "expose", "structurally", "reproducible", "treats", "vanishes"]
OLD = ["innovative", "utilized", "advancements", "pivotal", "facilitates", "firstly", "tackle", "showcasing", "underscores", "delve", "delves", "intricate"]
STOP = re.compile(r"^(llm|gpt|agent|multi-agent|prompt|chatgpt|transformer|language|vision|multimodal|foundation|diffusion|splatting|nerf|desi|token|reasoning|ai|model|benchmark|fine-tun|pretrain|zero-shot|few-shot|in-context|retrieval|rag|chain|instruction|alignment|align|copilot|chatbot|generative|neural|deep|reinforcement|robot|dexterous|sim-to-real|quantum|lder|erd|parity|circuit|low-density|compilation|code|software|repair|commits|workflow)", re.I)

seen = set(); H = collections.defaultdict(lambda: collections.defaultdict(list))
for f in sorted(glob.glob(os.path.expanduser(a.cache) + "/*.json")):
    d = json.load(open(f))
    for p in d["results"]:
        m = re.match(r"arxiv:(\d\d)(\d\d)\.", p["primaryId"])
        if not m or p["primaryId"] in seen: continue
        seen.add(p["primaryId"]); y = 2000 + int(m.group(1)); mo = int(m.group(2))
        if 2015 <= y <= 2026:
            H[f"{y}H{1 if mo <= 6 else 2}"][d["cat"]].append(set(re.findall(r"[a-z][a-z\-]{2,}", p["abstract"].lower())))

def bal(cells, ws):
    v = [100 * sum(1 for d in docs if d & set(ws)) / len(docs) for docs in cells.values() if len(docs) >= 5]
    return round(sum(v) / len(v), 2)
series = {h: {"n": sum(len(x) for x in H[h].values()), "old": bal(H[h], OLD), "new": bal(H[h], NEW), "however": bal(H[h], ["however"])} for h in sorted(H)}

def period(h): y = int(h[:4]); return "base" if y in (2020, 2021, 2022) else str(y) if y in (2024, 2026) else None
def heldout(A):
    docs = {s: collections.defaultdict(list) for s in "AB"}
    for h, cells in H.items():
        per = period(h)
        if not per: continue
        for c, ds in cells.items():
            docs["A" if c in A else "B"][per] += [{w for w in d if not STOP.match(w)} for d in ds]
    b = collections.Counter(w for d in docs["A"]["base"] for w in d); t = collections.Counter(w for d in docs["A"]["2026"] for w in d)
    nb, nt = len(docs["A"]["base"]), len(docs["A"]["2026"])
    ws = [w for r, w in sorted((((c / nt) / ((b[w] + 0.5) / nb)), w) for w, c in t.items() if c >= 12)[::-1][:25]]
    sh = lambda dd: round(100 * sum(1 for d in dd if d & set(ws)) / len(dd), 1)
    return {"list": ws, **{s: {k: sh(docs[s][k]) for k in ("base", "2024", "2026")} for s in "AB"}}
out = {"NEW": NEW, "OLD": OLD, "series": series,
       "heldout_even_odd": heldout(set(cats[0::2])),
       "heldout_cs_to_rest": heldout({c for c in cats if c.startswith("cs.")})}
json.dump(out, open(a.out, "w"), indent=1)
for k in ("heldout_even_odd", "heldout_cs_to_rest"): print(k, {s: out[k][s] for s in "AB"})
