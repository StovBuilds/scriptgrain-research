#!/usr/bin/env python3
"""SGR-008 census step 1: harvest arXiv metadata (id, categories, title,
abstract, licence, version dates; arXivRaw format) for EVERY arXiv paper, from arXiv's own OAI-PMH endpoint.

  python3 scripts/experiments/sgr-008/census-harvest.py --out ~/research/sgr-008/census

Writes census/part-NNNNN.jsonl.gz (one per OAI page) and census/state.json
(resumption token), so a killed run resumes where it stopped. Sequential, one
request at a time, honours 503 Retry-After. Abstract text stays on the VPS.
"""
import argparse, gzip, json, os, re, subprocess, sys, time, html, xml.etree.ElementTree as ET
ap = argparse.ArgumentParser(); ap.add_argument("--out", required=True); a = ap.parse_args()
out = os.path.expanduser(a.out); os.makedirs(out, exist_ok=True)
state_f = f"{out}/state.json"
st = json.load(open(state_f)) if os.path.exists(state_f) else {"token": None, "page": 0, "records": 0, "done": False}
NS = {"o": "http://www.openarchives.org/OAI/2.0/", "a": "http://arxiv.org/OAI/arXivRaw/"}
BASE = "https://oaipmh.arxiv.org/oai"
def fetch(url):
    for attempt in range(12):
        r = subprocess.run(["curl", "-s", "-4", "-m", "180", "-D", "-", url, "-A", "ScriptGrain-research/1.0 (support@scriptgrain.com)"], capture_output=True)
        raw = r.stdout
        head, _, body = raw.partition(b"\r\n\r\n")
        while body.startswith(b"HTTP/"):  # skip 100-continue / redirects
            head, _, body = body.partition(b"\r\n\r\n")
        code = int(head.split()[1]) if head[:4] == b"HTTP" else 0
        if code == 200 and b"</OAI-PMH>" in body: return body
        m = re.search(rb"Retry-After:\s*(\d+)", head, re.I)
        wait = int(m.group(1)) if m else min(600, 10 * 2 ** attempt)
        print(f"page {st['page']} http {code}, waiting {wait}s", file=sys.stderr, flush=True)
        time.sleep(wait)
    raise SystemExit("gave up")
txt = lambda e: re.sub(r"\s+", " ", (e.text or "")).strip() if e is not None else None
while not st["done"]:
    url = f"{BASE}?verb=ListRecords&resumptionToken={st['token']}" if st["token"] else f"{BASE}?verb=ListRecords&metadataPrefix=arXivRaw"
    root = ET.fromstring(fetch(url))
    recs = []
    for rec in root.iter(f"{{{NS['o']}}}record"):
        md = rec.find("o:metadata/a:arXivRaw", NS)
        if md is None: continue
        recs.append({"id": txt(md.find("a:id", NS)), "categories": txt(md.find("a:categories", NS)),
                     "title": txt(md.find("a:title", NS)), "abstract": txt(md.find("a:abstract", NS)),
                     "license": txt(md.find("a:license", NS)),
                     # every version's date: the abstract served is the LATEST version's,
                     # so a pre-2023 paper revised later can carry a later abstract
                     "versions": [txt(v.find("a:date", NS)) for v in md.findall("a:version", NS)]})
    with gzip.open(f"{out}/part-{st['page']:05d}.jsonl.gz", "wt") as f:
        for r in recs: f.write(json.dumps(r) + "\n")
    tok = root.find(".//o:resumptionToken", NS)
    st["page"] += 1; st["records"] += len(recs)
    st["token"] = tok.text.strip() if tok is not None and tok.text and tok.text.strip() else None
    if tok is not None and tok.get("completeListSize"): st["total"] = int(tok.get("completeListSize"))
    st["done"] = st["token"] is None
    json.dump(st, open(state_f, "w"))
    if st["page"] % 25 == 0: print(f"page {st['page']} records {st['records']} total {st.get('total')}", file=sys.stderr, flush=True)
    time.sleep(1)
print(f"done: {st['records']} records in {st['page']} pages", file=sys.stderr)
