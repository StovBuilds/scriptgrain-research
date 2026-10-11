#!/usr/bin/env python3
"""SGR-024 data collection: a fixed-seed 10% sample of PubMed records, read from NCBI's annual
baseline and daily update files (https://ftp.ncbi.nlm.nih.gov/pubmed/). Pre-registration:
docs/research/sgr-024-preregistration.md (section 2). NOT part of the D-1 run: the data are
collected ahead of time and stored under ~/research/sgr-024.

Sample rule (frozen): a PMID is in the sample iff int(sha1("sgr-024:" + pmid)[:8], 16) % 1000000 < 100000.
The rule depends on the PMID alone, so it does not depend on file order, on re-runs, or on what any
abstract says. Records are streamed from the NCBI server and never stored whole: only the sampled
records whose entry date is 2015-01-01 or later are kept, with the cleaned abstract text.

  python3 -I collect.py probe                      find where 2015 starts in the baseline (read-only, 3 MB per file)
  python3 -I collect.py run --first-baseline N     download+parse baseline N..last and every update file (resumable)
  python3 -I collect.py build                      merge the parts: latest version of each PMID, deletions applied
  python3 -I collect.py verify                     re-fetch 300 sampled PMIDs through E-utilities and compare
  python3 -I collect.py selftest                   parse a tiny built-in record set (no network)

Politeness: User-Agent "ScriptGrain research (support@scriptgrain.com)"; at most 3 connections at a time;
E-utilities calls carry tool=scriptgrain-research&email=support@scriptgrain.com and stay under 3 requests a second.
Nothing here uses a language model or an API key.
"""
import argparse, collections, concurrent.futures as cf, gzip, hashlib, io, json, os, random, re, sys, time, urllib.request, zlib
import xml.etree.ElementTree as ET

UA = "ScriptGrain research (support@scriptgrain.com)"
FTP = "https://ftp.ncbi.nlm.nih.gov/pubmed/"
EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
HOME = os.path.expanduser("~/research/sgr-024")
SALT = "sgr-024:"
SAMPLE_BELOW = 100000          # of 1,000,000: a 10% sample
WINDOW = ("2015-01-01", "2026-09-30")   # entry date (PubMed "entrez" date), inclusive
PILOT_BELOW = 4000             # the pilot is the records with h < 4000: 4% of the sample


def h_of(pmid):
    return int(hashlib.sha1((SALT + str(pmid)).encode()).hexdigest()[:8], 16) % 1000000


# ---- abstract text ------------------------------------------------------------------------------
# Section labels are not part of the abstract's wording. They arrive three ways: a Label="" attribute on
# <AbstractText> (never read), a bold element such as <b>Methods:</b> inside one <AbstractText>, and plain
# text such as "METHODS:". The last two are removed here, by the closed list below; nothing else is removed.
_LW = ("background|objectives?|aims?|purposes?|introduction|context|design|setting|settings|participants|patients|subjects|"
       "methods?|methodology|materials?|results?|findings?|conclusions?|importance|interventions?|exposures?|measures?|"
       "outcomes?|main outcomes?|main results?|interpretation|funding|significance|discussion|limitations?|implications?|"
       "relevance|registration|trial registration|study design|data sources?|study selection|data extraction|data synthesis|"
       "approach|hypothesis|rationale|samples?|population|evidence|summary|statement|rationale and objectives?|"
       "case presentation|case report|case description|clinical relevance|clinical implications?|key points?|question|"
       "study objectives?|study aims?|research design|review methods?|review|search strategy|selection criteria|"
       "main outcome measures?|primary outcomes?|secondary outcomes?|and|of|for|with|in|to")
LABEL_RE = re.compile(r"(?:^|(?<=[.!?])\s+)((?:" + _LW + r")(?:[\s/&,-]+(?:" + _LW + r")){0,5})\s*:\s+", re.I)


def is_label_el(el):
    t = "".join(el.itertext()).strip()
    return t.endswith(":") and len(t.split()) <= 6


def flat(el, cnt=None):
    parts = [el.text or ""]
    for c in el:
        if c.tag in ("b", "strong") and is_label_el(c):
            parts.append(" ")
            if cnt is not None:
                cnt[0] += 1
        else:
            parts.append(flat(c, cnt))
        parts.append(c.tail or "")
    return "".join(parts)


def strip_labels(t):
    n = 0
    def sub(m):
        nonlocal n
        words = [w for w in re.split(r"[\s/&,-]+", m.group(1).lower()) if w]
        if all(w in ("and", "of", "for", "with", "in", "to") for w in words):
            return m.group(0)  # a label made only of function words is not a label
        n += 1
        return " "
    return LABEL_RE.sub(sub, t), n


def abstract_text(art):
    ab = art.find("Abstract")
    if ab is None:
        return None, 0
    secs, ns = [], 0
    for at in ab.findall("AbstractText"):
        cnt = [0]
        t = flat(at, cnt)
        ns += cnt[0]
        t = re.sub(r"\s+", " ", t).strip()
        if at.get("Label"):
            ns += 1
        t, k = strip_labels(" " + t) if t else (t, 0)
        ns += k
        t = re.sub(r"^\s*:\s*", "", t.strip())
        if t:
            secs.append(t if re.search(r"[.!?:;)\"'\]]$", t) else t + ".")
    text = re.sub(r"\s+", " ", " ".join(secs)).strip()
    return text, ns


# ---- one record ----------------------------------------------------------------------------------
def ymd(el):
    if el is None:
        return ""
    y, m, d = el.findtext("Year"), el.findtext("Month"), el.findtext("Day")
    if not y:
        return ""
    mm = m or "1"
    if not mm.isdigit():  # "Jan"
        mm = str(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].index(mm[:3].lower()) + 1) if mm[:3].lower() in ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec") else "1"
    return f"{int(y):04d}-{int(mm):02d}-{int(d or 1):02d}"


def parse_record(raw, fno):
    """Return a dict for a sampled, in-window record, or None (outside the entry-date window)."""
    root = ET.fromstring(raw)
    mc = root.find("MedlineCitation")
    art = mc.find("Article")
    pmid = mc.findtext("PMID")
    ed = ""
    for d in root.findall("PubmedData/History/PubMedPubDate"):
        if d.get("PubStatus") == "entrez":
            ed = ymd(d)
    if not ed:  # no entrez date: fall back to the electronic or journal date, flagged by ed_src
        ed = ymd(art.find("ArticleDate")) or ""
    if not ed or ed < WINDOW[0] or ed > WINDOW[1]:
        return None
    text, ns = abstract_text(art)
    jy = art.find("Journal/JournalIssue/PubDate")
    py = 0
    if jy is not None:
        s = jy.findtext("Year") or jy.findtext("MedlineDate") or ""
        m = re.search(r"(19|20)\d\d", s)
        py = int(m.group(0)) if m else 0
    rec = {
        "p": int(pmid), "f": fno, "ed": ed,
        "ad": ymd(art.find("ArticleDate")), "py": py, "rv": ymd(mc.find("DateRevised")),
        "j": mc.findtext("MedlineJournalInfo/NlmUniqueID") or "",
        "l": ",".join(x.text or "" for x in art.findall("Language")),
        "t": ";".join(x.text or "" for x in art.findall("PublicationTypeList/PublicationType")),
        "s": {"MEDLINE": "M", "PubMed-not-MEDLINE": "N", "In-Process": "I", "Publisher": "P", "OLDMEDLINE": "O"}.get(mc.get("Status"), "?"),
        "im": "A" if mc.get("IndexingMethod") == "Automated" else "",
        "m": ";".join(d.text or "" for d in mc.findall("MeshHeadingList/MeshHeading/DescriptorName") if d.get("MajorTopicYN") == "Y"),
        "h": h_of(pmid),
    }
    if text is not None:
        rec["ns"] = ns
        rec["x"] = text
    return rec


# ---- streaming a file ----------------------------------------------------------------------------
PMID_RE = re.compile(rb'<PMID Version="1">(\d+)</PMID>')
DEL_RE = re.compile(rb"<PMID Version=\"\d+\">(\d+)</PMID>")


def open_url(url, rng=None, tries=6):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, **({"Range": rng} if rng else {})})
            return urllib.request.urlopen(req, timeout=120)
        except Exception as e:
            if k == tries - 1:
                raise
            time.sleep(5 * (k + 1))


def stream_records(fobj):
    """Yield ('rec', bytes) for each <PubmedArticle> and ('del', pmid_bytes) for DeleteCitation PMIDs."""
    d = zlib.decompressobj(16 + zlib.MAX_WBITS)
    buf = b""
    END = b"</PubmedArticle>"
    while True:
        raw = fobj.read(1 << 20)
        if not raw:
            break
        try:
            buf += d.decompress(raw)
        except zlib.error:
            break  # truncated range read (probe)
        pos = 0
        while True:
            i = buf.find(END, pos)
            if i < 0:
                break
            j = i + len(END)
            s = buf.rfind(b"<PubmedArticle>", pos, j)
            yield "rec", buf[s:j]
            pos = j
        buf = buf[pos:]
    tail = buf
    k = tail.find(b"<DeleteCitation>")
    if k >= 0:
        for m in DEL_RE.finditer(tail[k:]):
            yield "del", m.group(1)


def process_file(name, parts_dir):
    kind = "b" if "baseline" in name or name.startswith("b") else "u"
    url_name = name
    fno = int(re.search(r"n(\d+)\.xml", url_name).group(1))
    tag = f"{'b' if url_name in BASELINE_SET else 'u'}{fno:04d}"
    out_path = f"{parts_dir}/{tag}.jsonl.gz"
    if os.path.exists(out_path):
        return tag, "skipped"
    url = FTP + ("baseline/" if url_name in BASELINE_SET else "updatefiles/") + url_name
    seen = samp = kept = errs = 0
    dels = []
    t0 = time.time()
    tmp = out_path + ".tmp"
    with open_url(url) as resp, gzip.open(tmp, "wt", encoding="utf-8") as out:
        for kind_, payload in stream_records(resp):
            if kind_ == "del":
                if h_of(payload.decode()) < SAMPLE_BELOW:
                    dels.append(int(payload))
                continue
            seen += 1
            m = PMID_RE.search(payload)
            if not m or h_of(m.group(1).decode()) >= SAMPLE_BELOW:
                continue
            samp += 1
            try:
                rec = parse_record(payload, fno)
            except Exception:
                errs += 1
                continue
            if rec is None:
                continue
            kept += 1
            out.write(json.dumps(rec, ensure_ascii=False, separators=(",", ":")) + "\n")
    json.dump({"file": url_name, "seen": seen, "sampled": samp, "kept": kept, "parse_errors": errs, "deletions": dels,
               "seconds": round(time.time() - t0)}, open(f"{parts_dir}/{tag}.meta.json", "w"))
    os.replace(tmp, out_path)
    return tag, f"seen {seen} sampled {samp} kept {kept} errs {errs} dels {len(dels)} {round(time.time() - t0)}s"


BASELINE_SET = set()


def listing(path):
    t = urllib.request.urlopen(urllib.request.Request(FTP + path, headers={"User-Agent": UA}), timeout=60).read().decode()
    return sorted(set(re.findall(r'href="(pubmed\d+n\d+\.xml\.gz)"', t)))


def cmd_run(a):
    global BASELINE_SET
    base, upd = listing("baseline/"), listing("updatefiles/")
    BASELINE_SET = set(base)
    nums = lambda f: int(re.search(r"n(\d+)\.xml", f).group(1))
    todo = [f for f in base if nums(f) >= a.first_baseline] + upd
    parts = f"{HOME}/parts"
    os.makedirs(parts, exist_ok=True)
    json.dump({"started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "first_baseline": a.first_baseline,
               "last_baseline": base[-1], "last_update": upd[-1], "n_files": len(todo)}, open(f"{HOME}/run-info.json", "w"))
    print(f"{len(todo)} files; first {todo[0]}, last {todo[-1]}", flush=True)
    def work(f):
        for k in range(4):
            try:
                return process_file(f, parts)
            except Exception as e:
                print(f"retry {f}: {e!r}", flush=True)
                time.sleep(20 * (k + 1))
        return f, "FAILED"
    # BASELINE_SET must be visible to worker threads, so threads (not processes); the parse is mostly regex+IO.
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        for tag, msg in ex.map(work, todo):
            print(tag, msg, flush=True)


def cmd_probe(a):
    base = listing("baseline/")
    nums = lambda f: int(re.search(r"n(\d+)\.xml", f).group(1))
    print("baseline files:", len(base))
    for f in base:
        n = nums(f)
        if n % a.step != 0:
            continue
        with open_url(FTP + "baseline/" + f, rng="bytes=0-3000000") as r:
            eds = []
            for kind_, payload in stream_records(r):
                if kind_ != "rec":
                    continue
                m = re.search(rb'PubStatus="entrez">\s*<Year>(\d+)</Year>\s*<Month>(\d+)</Month>', payload)
                if m:
                    eds.append(f"{int(m.group(1))}-{int(m.group(2)):02d}")
        eds.sort()
        print(n, eds[0] if eds else None, eds[len(eds) // 2] if eds else None, eds[-1] if eds else None, len(eds), flush=True)


# ---- build ---------------------------------------------------------------------------------------
def cmd_build(a):
    parts = f"{HOME}/parts"
    files = sorted(f for f in os.listdir(parts) if f.endswith(".jsonl.gz"))
    order = lambda f: (0 if f[0] == "b" else 1, int(f[1:5]))
    files.sort(key=lambda f: int(f[1:5]))  # file numbers run on from the baseline into the updates
    latest, deleted = {}, {}
    nrec = 0
    for f in files:
        fno = int(f[1:5])
        with gzip.open(f"{parts}/{f}", "rt", encoding="utf-8") as fh:
            for i, line in enumerate(fh):
                p = json.loads(line)["p"]
                latest[p] = (fno, i); nrec += 1
        meta = json.load(open(f"{parts}/{f[:-9]}.meta.json"))
        for p in meta["deletions"]:
            deleted[p] = fno
    gone = {p for p, (fno, _) in latest.items() if p in deleted and deleted[p] > fno}
    out_path = f"{HOME}/sample.jsonl.gz"
    kept = 0
    stats = collections.Counter()
    with gzip.open(out_path + ".tmp", "wt", encoding="utf-8") as out:
        for f in files:
            fno = int(f[1:5])
            with gzip.open(f"{parts}/{f}", "rt", encoding="utf-8") as fh:
                for i, line in enumerate(fh):
                    p = json.loads(line)["p"]
                    if latest[p] != (fno, i) or p in gone:
                        continue
                    out.write(line); kept += 1
    os.replace(out_path + ".tmp", out_path)
    metas = [json.load(open(f"{parts}/{f[:-9]}.meta.json")) for f in files]
    info = json.load(open(f"{HOME}/run-info.json"))
    man = {"built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "sample_rule": f'sha1("{SALT}"+pmid)[:8] % 1e6 < {SAMPLE_BELOW}',
           "window_entry_date": WINDOW, "files": len(files), "first_part": files[0], "last_part": files[-1],
           "last_baseline": info["last_baseline"], "last_update": info["last_update"],
           "records_seen_in_files": sum(m["seen"] for m in metas), "sampled_by_hash": sum(m["sampled"] for m in metas),
           "kept_in_window_all_versions": nrec, "distinct_pmids": len(latest), "deleted_later": len(gone), "in_sample_file": kept,
           "parse_errors": sum(m["parse_errors"] for m in metas)}
    # records seen in the lowest files that fall in the window: where the 2015 boundary sits
    low = [(int(f[1:5]), m["kept"]) for f, m in zip(files, metas) if f[0] == "b"][:12]
    man["lowest_baseline_files_kept"] = low
    json.dump(man, open(f"{HOME}/manifest.json", "w"), indent=1)
    print(json.dumps(man, indent=1))


# ---- verify against E-utilities -------------------------------------------------------------------
def cmd_verify(a):
    rows = []
    with gzip.open(f"{HOME}/sample.jsonl.gz", "rt", encoding="utf-8") as fh:
        for line in fh:
            r = json.loads(line)
            if "x" in r:
                rows.append(r)
    rng = random.Random(2410)
    pick = rng.sample(rows, min(a.n, len(rows)))
    byp = {r["p"]: r for r in pick}
    ids = sorted(byp)
    agree = collections.Counter()
    for i in range(0, len(ids), 100):
        batch = ids[i:i + 100]
        url = EUTILS + "efetch.fcgi?db=pubmed&retmode=xml&tool=scriptgrain-research&email=support@scriptgrain.com&id=" + ",".join(map(str, batch))
        data = open_url(url).read()
        time.sleep(0.5)
        root = ET.fromstring(data)
        for pa in root.findall("PubmedArticle"):
            raw = ET.tostring(pa)
            rec = parse_record(raw, 0)
            r = byp.get(int(pa.findtext("MedlineCitation/PMID")))
            if rec is None or r is None:
                agree["not_parsed"] += 1
                continue
            agree["checked"] += 1
            for k in ("ed", "j", "l", "t", "ns"):
                if rec.get(k) == r.get(k):
                    agree["same_" + k] += 1
            agree["same_text"] += int(rec.get("x") == r.get("x"))
    res = {"requested": len(ids), **agree, "note": "differences are records revised at NCBI since the snapshot; see the pre-registration, section 2"}
    json.dump(res, open(f"{HOME}/verify.json", "w"), indent=1)
    print(json.dumps(res, indent=1))


def cmd_selftest(a):
    xml = b"""<PubmedArticle><MedlineCitation Status="MEDLINE" IndexingMethod="Automated"><PMID Version="1">111</PMID>
<DateRevised><Year>2024</Year><Month>01</Month><Day>02</Day></DateRevised>
<Article><Journal><JournalIssue><PubDate><Year>2023</Year></PubDate></JournalIssue></Journal>
<Abstract><AbstractText Label="BACKGROUND" NlmCategory="BACKGROUND">We <i>delve</i> into CO<sub>2</sub> levels</AbstractText>
<AbstractText Label="RESULTS">Levels rose by 5.2% (p &lt; 0.05). Conclusion: it works</AbstractText><CopyrightInformation>(c) X</CopyrightInformation></Abstract>
<Language>eng</Language><PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList>
<ArticleDate DateType="Electronic"><Year>2023</Year><Month>07</Month><Day>14</Day></ArticleDate></Article>
<MedlineJournalInfo><NlmUniqueID>101549006</NlmUniqueID></MedlineJournalInfo>
<MeshHeadingList><MeshHeading><DescriptorName MajorTopicYN="Y">Neoplasms</DescriptorName></MeshHeading><MeshHeading><DescriptorName MajorTopicYN="N">Humans</DescriptorName></MeshHeading></MeshHeadingList>
</MedlineCitation><PubmedData><History><PubMedPubDate PubStatus="entrez"><Year>2023</Year><Month>7</Month><Day>31</Day></PubMedPubDate></History></PubmedData></PubmedArticle>"""
    r = parse_record(xml, 1)
    print(json.dumps(r, indent=1))
    assert r["x"] == "We delve into CO2 levels. Levels rose by 5.2% (p < 0.05). it works.", r["x"]
    assert r["ed"] == "2023-07-31" and r["m"] == "Neoplasms" and r["ns"] == 3
    b = ET.fromstring(b"<Article><Abstract><AbstractText><b>Purpose:</b> Postural control. <b>Methods:</b> We enrolled <b>COVID-19</b> patients. RESULTS: Speed fell. METHODS AND RESULTS: both.</AbstractText></Abstract></Article>")
    t, ns = abstract_text(b)
    print(t, ns)
    assert t == "Postural control. We enrolled COVID-19 patients. Speed fell. both.", t
    print("selftest ok")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    p = sp.add_parser("probe"); p.add_argument("--step", type=int, default=25)
    p = sp.add_parser("run"); p.add_argument("--first-baseline", type=int, required=True); p.add_argument("--workers", type=int, default=3)
    sp.add_parser("build")
    p = sp.add_parser("verify"); p.add_argument("--n", type=int, default=300)
    sp.add_parser("selftest")
    a = ap.parse_args()
    {"probe": cmd_probe, "run": cmd_run, "build": cmd_build, "verify": cmd_verify, "selftest": cmd_selftest}[a.cmd](a)
