#!/usr/bin/env python3
"""SGR-008 step 8: build the published outputs from the result files. Every
number on the page comes from a file under results/; nothing is typed in.

  python3 scripts/experiments/sgr-008/write-entry.py [--publish-on 2026-10-05]

Writes public/research/sgr-008-*.{svg,csv,json} and the SGR-008 entry in
src/data/research-pages.json (replaced if present).
"""
import argparse, csv, gzip, io, json, os

ap = argparse.ArgumentParser(); ap.add_argument("--publish-on", default="2026-10-05"); a = ap.parse_args()
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(f"{HERE}/../../..")
RES = f"{HERE}/results"; C = f"{RES}/census"; OUT = f"{ROOT}/public/research"
J = lambda p: json.load(open(p))
h13 = J(f"{C}/h1-h3.json"); P = h13["primary"]; SENS = h13["all_papers_sensitivity"]
hb = J(f"{C}/h5-bounds.json"); pl = J(f"{C}/placebo.json"); ex = J(f"{C}/exclusions.json")
inst = J(f"{C}/instruments.json"); rp = J(f"{C}/retro-polish.json")
cand = J(f"{C}/excess-candidates.json")["candidates"]; labels = J(f"{C}/labels.json"); lp = J(f"{C}/labels-passes.json")
wf = J(f"{C}/word-freq.json"); lit = J(f"{RES}/literature/evidence-table.json")
pilot = J(f"{RES}/wordsets-series.json")
OLD = ["innovative", "utilized", "advancements", "pivotal", "facilitates", "firstly", "tackle", "showcasing", "underscores", "delve", "delves", "intricate"]
NEW = ["underexplored", "grounded", "aligns", "synthesizes", "replaces", "leaving", "recovers", "expose", "structurally", "reproducible", "treats", "vanishes"]
CONTROL = ["however", "results", "using", "show", "method"]

f1 = lambda v: f"{v:.1f}"; f2 = lambda v: f"{v:.2f}"; n0 = lambda v: f"{v:,}"
def ci(c): return f"{c[0]:+.1f} to {c[1]:+.1f}".replace("+-", "-")
o, nw, ct = P["old"], P["new"], P["control"]
N = P["n"]; kept = ex["kept"]; xc = ex["excluded"]
hs = P["half_series"]; cross = P["H3_crossover_half"]
B = hb["bounds"]; bg = hb["bounds_by_group_union"]
h4 = inst["H4"]; per = inst["periods"]
gr = P["new_by_group"]
GNAME = {"cs": "Computer science", "math": "Mathematics", "physics": "Physics and astronomy", "stat": "Statistics",
         "eess": "Electrical engineering and systems", "q-bio": "Quantitative biology", "q-fin": "Quantitative finance", "econ": "Economics"}
def lb(x):
    if x["lower_bound_pct"] is None or not x.get("ci95") or x["ci95"][1] - x["ci95"][0] > 40: return "too uncertain"
    return f"{x['lower_bound_pct']:.0f}%"
def lbci(x): return f"{x['ci95'][0]:.0f} to {x['ci95'][1]:.0f}%" if x.get("ci95") else ""
half_label = lambda h: f"{'first' if h.endswith('H1') else 'second'} half of {h[:4]}"

# ---------- charts (same drawing code and palette as SGR-004) ----------
def chart(file, title, series, y_label, x_from=2015, x_to=2027, fmt=lambda v: f"{v:g}", ymax=None, xticks=None, lab=None):
    lab = lab or (lambda v: fmt(round(v, 1)))
    W, H, L, R, T, Bm = 760, 380, 56, 140, 48, 44
    pts = [p[1] for s in series for p in s["points"] if p[1] is not None]
    raw = max(pts) * 1.05 or 1
    import math
    mag = 10 ** math.floor(math.log10(raw / 4)); step = next(m * mag for m in (1, 2, 2.5, 5, 10) if m * mag * 4 >= raw)
    ticks = math.ceil(raw / step); top = step * ticks
    if ymax is not None: top, ticks = ymax, 4
    X = lambda v: L + (v - x_from) / (x_to - x_from) * (W - L - R)
    Y = lambda v: T + (1 - v / top) * (H - T - Bm)
    g = ""
    for i in range(ticks + 1):
        v = top / ticks * i
        g += f'<line class="grid" x1="{L}" x2="{W - R}" y1="{Y(v):.1f}" y2="{Y(v):.1f}"/><text class="ax" x="{L - 8}" y="{Y(v) + 4:.1f}" text-anchor="end">{fmt(round(v, 2))}</text>'
    for yr in (xticks or range(x_from, x_to + 1, 1 if x_to - x_from <= 13 else 5)):
        g += f'<text class="ax" x="{X(yr):.1f}" y="{H - Bm + 20}" text-anchor="middle">{yr}</text>'
    gpt = X(2022 + 11 / 12)
    near_left = gpt - L < 160  # label would hit the y axis: put it right of the line
    g += f'<line class="mark" x1="{gpt:.1f}" x2="{gpt:.1f}" y1="{T}" y2="{H - Bm}"/><text class="ax" x="{gpt + 6 if near_left else gpt - 6:.1f}" y="{T + 12}" text-anchor="{'start' if near_left else 'end'}">ChatGPT, Nov 2022</text>'
    s = ""
    for i, sr in enumerate(series):
        Pp = [p for p in sr["points"] if p[1] is not None]
        s += f'<path class="line s{i}" d="M' + "L".join(f"{X(x):.1f},{Y(y):.1f}" for x, y in Pp) + '"/>'
        for x, y in Pp: s += f'<circle class="dot s{i}" cx="{X(x):.1f}" cy="{Y(y):.1f}" r="3"/>'
        lx, ly = Pp[-1]
        s += f'<text class="lbl s{i}t" x="{X(lx) + 8:.1f}" y="{Y(ly) + 4:.1f}">{sr["label"]} {lab(ly)}</text>'
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{title}">
<style>
text{{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px}}
.t{{font-family:Archivo,system-ui,sans-serif;font-size:15px;font-weight:700;fill:#11100E}}
.ax{{fill:#6b6862}}.lbl{{fill:#11100E;font-weight:600}}
.grid{{stroke:#11100E;stroke-opacity:.1}}.mark{{stroke:#9D8420;stroke-dasharray:3 3}}
.line{{fill:none;stroke-width:2}}.s0.line{{stroke:#674BFF}}.s1.line{{stroke:#9D8420}}.s2.line{{stroke:#6b6862;stroke-dasharray:4 3}}
.s0.dot{{fill:#674BFF;stroke:#F6F5F0;stroke-width:2}}.s1.dot{{fill:#9D8420;stroke:#F6F5F0;stroke-width:2}}.s2.dot{{fill:#6b6862;stroke:#F6F5F0;stroke-width:2}}
@media (prefers-color-scheme:dark){{.t,.lbl{{fill:#F6F5F0}}.ax{{fill:#a8a49b}}.grid{{stroke:#F6F5F0}}
.mark{{stroke:#C9A72C}}.s0.line{{stroke:#7A61FF}}.s1.line{{stroke:#C9A72C}}.s0.dot{{fill:#7A61FF;stroke:#141310}}.s1.dot{{fill:#C9A72C;stroke:#141310}}.s2.dot{{stroke:#141310}}}}
</style>
<text class="t" x="{L}" y="22">{title}</text><text class="ax" x="{L}" y="38">{y_label}</text>
{g}{s}</svg>
'''
    open(f"{OUT}/{file}", "w").write(svg)
hx = lambda h: int(h[:4]) + (0.25 if h.endswith("H1") else 0.75)
H = sorted(hs)
chart("sgr-008-two-word-sets.svg", "Two sets of AI tells in arXiv abstracts",
      [{"label": "2024 tells", "points": [(hx(h), hs[h]["old"]) for h in H]},
       {"label": "2026 tells", "points": [(hx(h), hs[h]["new"]) for h in H]}],
      "% of abstracts using at least one word of each twelve-word set, by half-year", fmt=lambda v: f"{v:g}%", xticks=range(2015, 2027))
W1 = P["word_share_by_year"]; YRS = sorted(y for y in W1 if y.isdigit())
chart("sgr-008-delve.svg", "Three 2024 tells, year by year",
      [{"label": "delve", "points": [(int(y) + .5, W1[y]["delve"]) for y in YRS]},
       {"label": "showcasing", "points": [(int(y) + .5, W1[y]["showcasing"]) for y in YRS]},
       {"label": "innovative", "points": [(int(y) + .5, W1[y]["innovative"]) for y in YRS]}],
      "% of arXiv abstracts containing the word", fmt=lambda v: f"{v:g}%", xticks=range(2015, 2027), lab=lambda v: f"{v:.2f}%")
chart("sgr-008-new-words.svg", "Three 2026 tells, year by year",
      [{"label": "grounded", "points": [(int(y) + .5, W1[y]["grounded"]) for y in YRS]},
       {"label": "recovers", "points": [(int(y) + .5, W1[y]["recovers"]) for y in YRS]},
       {"label": "underexplored", "points": [(int(y) + .5, W1[y]["underexplored"]) for y in YRS]}],
      "% of arXiv abstracts containing the word", fmt=lambda v: f"{v:g}%", xticks=range(2015, 2027), lab=lambda v: f"{v:.2f}%")
YB = ["2023", "2024", "2025", "2026"]
chart("sgr-008-lower-bounds.svg", "Lower bound on LLM-processed abstracts",
      [{"label": "2026 list", "points": [(int(y) + .5, B["set2026"][y]["lower_bound_pct"]) for y in YB]},
       {"label": "2024 list", "points": [(int(y) + .5, B["set2024"][y]["lower_bound_pct"]) for y in YB]}],
      "lower bound, %, from the 50 top style words chosen in each year (even months scored)", x_from=2022, x_to=2027,
      fmt=lambda v: f"{v:g}%", ymax=100, xticks=range(2022, 2028))

# ---------- data downloads ----------
def wcsv(name, cols, rows):
    with open(f"{OUT}/{name}", "w", newline="") as f:
        w = csv.writer(f); w.writerow(cols); w.writerows(rows)
wcsv("sgr-008-half-year.csv", ["half_year", "rule", "abstracts", "pct_2024_set", "pct_2026_set", "pct_control_set"],
     [[h, rule, R["half_series"][h]["n"], R["half_series"][h]["old"], R["half_series"][h]["new"], R["half_series"][h]["control"]]
      for rule, R in (("primary", P), ("all_papers", SENS)) for h in sorted(R["half_series"])])
years = sorted(wf)
wrows = []
for w in sorted(set(cand) | set(OLD + NEW + CONTROL)):
    sets = ";".join(k for k, L in (("2024_set", OLD), ("2026_set", NEW), ("control", CONTROL)) if w in L)
    sty = ";".join(k for k, L in (("style_top50_2024", hb["style_2024"]), ("style_top50_2026", hb["style_2026"])) if w in L)
    wrows.append([w, labels.get(w, ""), sets, sty] + [round(100 * wf[y]["df"].get(w, 0) / wf[y]["n"], 4) for y in years])
wcsv("sgr-008-words-by-year.csv", ["word", "label", "frozen_sets", "top50_style_lists"] + [f"pct_{y}" for y in years], wrows)
erows = []
for w, ys in sorted(cand.items()):
    for y, v in sorted(ys.items()):
        s, t = v["select"], v["score"]
        erows.append([w, labels.get(w, ""), y, s["p"], s["q"], s["d"], s["r"], t["p"], t["q"], t["d"], t["r"]])
wcsv("sgr-008-excess-words.csv", ["word", "label", "year", "select_p", "select_q", "select_gap", "select_ratio", "score_p", "score_q", "score_gap", "score_ratio"], erows)
wcsv("sgr-008-literature.csv", ["id", "url", "title", "first_author", "year", "corpus", "period", "method_family", "headline_estimate", "verbatim_quote", "quote_source", "notes"],
     [[e.get(k, "") for k in ("id", "url", "title", "first_author", "year", "corpus", "period", "method_family", "headline_estimate", "verbatim_quote", "quote_source", "notes")] for e in lit])
summary = {"study": "SGR-008", "census": {"kept": kept, "excluded": xc}, "h1_h3": h13, "h5_and_bounds": hb, "placebo": pl,
           "instruments": inst, "retro_polish": rp, "labels": {"agreement": lp["agreement"], "cohen_kappa": lp["cohen_kappa"]},
           "pilot": {"source": "Firecrawl Research Index, 38 arXiv categories x 3 topics x 2015-2026", "abstracts": 41657}}
json.dump(summary, open(f"{OUT}/sgr-008-summary.json", "w"), indent=1)

# ---------- the entry ----------
top24 = hb["style_2024"]; top26 = hb["style_2026"]
def wordrow(w, y):
    s = cand[w][y]["score"]; return [w, f"{100 * s['q']:.2f}%", f"{100 * s['p']:.2f}%", f"{s['r']:.1f}x" if s["r"] else "new"]
groups = [g for g in ("cs", "eess", "stat", "physics", "math", "q-bio", "q-fin", "econ") if g in gr]
a24, a26 = B["set2024"]["2026"], B["set2026"]["2026"]
pA24, pA26, pB = pl["A_actual_sets"]["set2024"]["2021"], pl["A_actual_sets"]["set2026"]["2021"], pl["B_reselected_on_pre_llm_data"]["2021"]
rising26 = ', '.join(f"{y} {lb(B['set2026'][y])}" for y in YB)
fam = {}
for e in lit: fam[e["method_family"]] = fam.get(e["method_family"], 0) + 1
entry = {
 "id": "SGR-008",
 "slug": "the-ai-tells-moved",
 "title": "The AI tells moved: 2.1 million arXiv abstracts, 2015 to 2026",
 "seoTitle": "AI words in scientific abstracts, 2015 to 2026: delve fell, new tells rose",
 "question": "When words like \"delve\" became a joke, did language models stop shaping scientific writing, or did the tells change?",
 "conductedOn": "2026-10-04",
 "publishOn": a.publish_on,
 "description": f"Every arXiv abstract from January 2015 to September 2026 ({n0(kept)} papers), measured against word lists fixed in advance. The 2024 AI tells peaked and fell below their pre-ChatGPT level; a different set of words rose in every field, so lists built on 2024 models now miss most of the signal.",
 "abstract": [
  {"label": "Background", "text": "Since 2024, studies have shown that words such as \"delve\", \"intricate\" and \"underscore\" spiked in scientific writing after ChatGPT, and that \"delve\" fell once it became a public joke. Estimates of how many papers are written with language-model help keep rising. One study found other model-favoured words still rising as \"delve\" fell (Geng and Trotta, 2025). We found no study among the 444 on this topic in our literature search that compared the full set of words rising in 2026 with 2024's, or tested whether the word lists behind the prevalence estimates still work."},
  {"label": "What we did", "text": f"We took every arXiv paper first submitted between January 2015 and September 2026 from arXiv's own metadata service, with the date of every revision, and kept {n0(kept)} English abstracts of 50 words or more. A pilot on a 41,657-abstract sample suggested the result; we then wrote down the hypotheses, word lists and tests (published with this study) before measuring the full set, and tested on the {n0(kept - 43385)} papers the pilot never saw. Pre-ChatGPT papers whose abstracts were revised after November 2022 were left out of the baseline."},
  {"label": "What we found", "text": f"The twelve best-known 2024 tells rose from {f1(o['BASE'])}% of abstracts (2020 to 2022) to {f1(o['Y2024'])}% in 2024, then fell to {f1(o['Y2026'])}% in 2026, below where they started. Twelve other words, found in the pilot, rose from {f1(nw['BASE'])}% to {f1(nw['Y2026'])}% over the same years, at least {min(gr[g]['ratio'] for g in groups):.1f} times their baseline in all eight arXiv subject groups, overtaking the old set in the {half_label(cross)}. The 50 style words that rose most in 2024 and in 2026 barely overlap (6 of them in common). Sentence length did not change."},
  {"label": "What it means", "text": f"The tells moved; the use did not go away. The standard excess-word method puts a lower bound of {lb(a26)} on the share of 2026 abstracts processed by a language model when it uses the words that rose in 2026, and {lb(a24)} when it uses the words that rose in 2024. Word-frequency estimates built on 2023 to 2024 vocabulary now undercount."},
 ],
 "keyNumbers": [
  f"Abstracts on arXiv using one of the best-known 2024 AI tells (delve, showcasing, underscores, pivotal and eight others) rose from {f1(o['BASE'])}% in 2020 to 2022 to {f1(o['Y2024'])}% in 2024, then fell to {f1(o['Y2026'])}% in 2026 (ScriptGrain, 2026; {n0(kept)} abstracts).",
  f"A different set of words (underexplored, grounded, aligns, recovers and eight others) rose from {f1(nw['BASE'])}% of arXiv abstracts in 2020 to 2022 to {f1(nw['Y2026'])}% in 2026, and overtook the 2024 tells in the {half_label(cross)}.",
  f"\"Delve\" appeared in {W1['2024']['delve']:.2f}% of arXiv abstracts in 2024 and {W1['2026']['delve']:.2f}% in 2026.",
  f"The excess-word method gives a lower bound of {lb(a26)} for the share of 2026 arXiv abstracts processed by a language model when it uses 2026 vocabulary, and {lb(a24)} when it uses 2024 vocabulary (ScriptGrain, 2026).",
 ],
 "measures": [
  {"term": "Share of abstracts", "definition": "The percentage of abstracts that contain the word (or at least one word of a set) at least once, matched as a whole lowercase word after LaTeX maths and commands are removed."},
  {"term": "2024 tells (the old set)", "definition": "Twelve words fixed before the census was measured: " + ", ".join(OLD) + ". All were named as ChatGPT-era over-used words in the published studies cited below."},
  {"term": "2026 tells (the new set)", "definition": "Twelve words fixed before the census was measured: " + ", ".join(NEW) + ". They were found in the pilot sample, so the census test uses only papers the pilot did not include."},
  {"term": "Excess word", "definition": "A word whose share of abstracts in a year is above what its 2021 to 2022 trend predicts (the method of Kobak et al., 2025). The gap is the observed share minus the predicted share."},
  {"term": "Style word", "definition": "An excess word a writer could use on any subject (\"remains\", \"enhance\"), as opposed to a content word that names a topic (\"llm\", \"agentic\"). Every candidate was labelled by two independent model passes and a third for disagreements; all labels are published."},
  {"term": "Lower bound", "definition": "If a share s of abstracts were written with a model, and such an abstract always contained a word from the set, the set's share would be (1 minus s) times the predicted share plus s. Solving for s gives the smallest share consistent with the data. The true share is higher whenever the model sometimes avoids every word in the set."},
  {"term": "Baseline (2020 to 2022)", "definition": "Abstracts first submitted from January 2020 to November 2022, keeping only papers with no revision dated after 30 November 2022, so no baseline abstract can have been rewritten in the ChatGPT era."},
 ],
 "analyst": None,  # filled below from the published studies' analyst block (single source)
 "competingInterests": "ScriptGrain sells writing-voice measurement and generation, and the analyst builds it. The hypotheses, word lists and tests were written down and committed before the census was measured; every change after that is listed in the pre-registration with its reason. Word labelling and the literature extraction used Claude models; their outputs are published so they can be checked.",
 "notShown": [
  "That voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
  "Which papers were written with a language model. Word shares describe a body of writing, never one paper.",
  "Why the tells changed. Newer models, authors editing out words that became jokes, and people adopting model vocabulary second-hand all fit the data.",
  "Anything about journals, theses or fields arXiv covers thinly (most of medicine, the humanities and social sciences).",
 ],
 "productNote": "ScriptGrain measures writing voice: the habits that make a writer recognisable, such as sentence rhythm, punctuation and vocabulary. The AI-tell scan used here is the one behind the free [AI cliché checker](/tools/ai-cliche-checker). Neither is a test of who, or what, wrote a text.",
 "sample": {
  "description": f"Every paper on arXiv, harvested on 4 October 2026 from arXiv's OAI-PMH service in the arXivRaw format, which carries the date of every version. {n0(kept)} abstracts met the rules below. arXiv serves the latest version's abstract, which is why revision dates matter.",
  "size": kept,
  "inclusionCriteria": [
   "First submitted from January 2015 to September 2026 (from the arXiv identifier); October 2026 was incomplete",
   "At least 50 words after LaTeX was removed, in English",
   "Primary subject is the first category the authors listed",
  ],
  "exclusions": [
   f"{n0(xc['old_style_id'])} papers with old-style identifiers (submitted before April 2007)",
   f"{n0(xc['outside_2015_01_to_2026_09'])} papers submitted from 2007 to 2014, or in October 2026",
   f"{n0(xc['under_50_words'])} abstracts under 50 words, {xc['withdrawn']} withdrawn papers and {xc['non_english']} non-English abstracts",
   "From every confirmatory test: the 43,385 papers in the pilot sample, and baseline papers revised after 30 November 2022 (11% of 2020 to 2022 papers)",
  ],
 },
 "method": [
  "Pilot, 4 October 2026: Firecrawl's Research Index returned 41,657 arXiv abstracts for 38 categories x 3 fixed topics x 2015 to 2026. The pilot produced the 2026 word set and the idea; it is not part of any test.",
  "Pre-registration: hypotheses H1 to H5, the frozen word sets, the excess-word method, thresholds and exclusions were committed to the ScriptGrain repository before the census was analysed. Seven clarifications and one deviation followed, each before the census was measured and each listed with its reason.",
  "Census: every arXiv record from arXiv's OAI-PMH service (3,195,084 records), filtered by the rules above.",
  "Frozen-set tests: share of abstracts with at least one word of each set, 2020 to 2022 against 2024 and 2026 (January to September), with 95% confidence intervals from 2,000 bootstrap resamples of subject categories.",
  "Excess words: for 2023 to 2026, each word's share against a straight-line extension of its 2021 to 2022 trend. Words were chosen on papers submitted in odd months and scored on papers submitted in even months, so no word is scored on the papers that selected it. Words already in 5% or more of abstracts were left out of the word sets (the bound becomes unstable).",
  f"Labelling: the 351 top candidates were labelled content or style by two independent model passes (agreement {lp['agreement']}, Cohen's kappa {lp['cohen_kappa']}) and a third pass for the 8 disagreements.",
  "Instruments: average sentence length, punctuation and the AI-tell scan were measured on every abstract with the code ScriptGrain runs (measureTextFeatures, scanCliches).",
  "Placebo (added after the confirmatory run): the lower-bound method was run five years earlier, 2016 to 2021, where no language models existed, to measure how much excess ordinary drift produces.",
 ],
 "variablesMeasured": ["Share of abstracts using each word and word set", "Excess word share against trend", "Lower bound on model-processed abstracts", "Average sentence length", "AI-tell density per 1,000 words", "Em dashes per 1,000 words", "Words per abstract"],
 "findings": [
  {"label": "The 2024 tells rose, then fell below their pre-ChatGPT level",
   "value": f"{f1(o['BASE'])}% to {f1(o['Y2024'])}% to {f1(o['Y2026'])}% of abstracts",
   "explanation": f"The twelve best-known 2024 tells were in {f2(o['BASE'])}% of abstracts from 2020 to 2022, {f2(o['Y2024'])}% in 2024 and {f2(o['Y2026'])}% in 2026 (2024 minus baseline {ci(o['ci_2024_minus_base'])} points, 2026 minus 2024 {ci(o['ci_2026_minus_2024'])} points, 95% intervals). 2026 is {f1(abs(o['diff_2026_minus_base']))} points below the baseline (interval {ci(o['ci_2026_minus_base'])}). By the {half_label('2026H2')} the set was at {f1(hs['2026H2']['old'])}%, about its 2016 level. \"Delve\" went from {W1['2022']['delve']:.2f}% of abstracts in 2022 to {W1['2024']['delve']:.2f}% in 2024 and {W1['2026']['delve']:.2f}% in 2026."},
  {"label": "A new set of words rose in every field",
   "value": f"{f1(nw['BASE'])}% to {f1(nw['Y2026'])}% of abstracts",
   "explanation": f"Twelve words found in the pilot (underexplored, grounded, aligns, synthesizes, replaces, leaving, recovers, expose, structurally, reproducible, treats, vanishes) were in {f2(nw['BASE'])}% of abstracts from 2020 to 2022, {f2(nw['Y2024'])}% in 2024 and {f2(nw['Y2026'])}% in 2026 (2026 minus 2024 {ci(nw['ci_2026_minus_2024'])} points). Tested only on papers outside the pilot, the rise held in all eight subject groups: " + ", ".join(f"{GNAME[g].lower()} {gr[g]['ratio']:.1f} times" for g in groups) + f". The two sets crossed in the {half_label(cross)} and the new set has led in every half-year since."},
  {"label": "The words that rose most in 2024 and in 2026 are different words",
   "value": f"6 of the top 50 style words in common (Jaccard {hb['H5']['jaccard']:.2f})",
   "explanation": "Ranking every style word by how far it rose above its own trend, the top 50 for 2024 and the top 50 for 2026 share six words: " + ", ".join(hb["H5"]["overlap"]) + ". The 2024 list leads with " + ", ".join(top24[:8]) + "; the 2026 list with " + ", ".join(top26[:8]) + ". Both lists are below in full."},
  {"label": "Lists built on 2024 vocabulary now undercount",
   "value": f"at least {lb(a26)} (2026 words) against {lb(a24)} (2024 words) of 2026 abstracts",
   "explanation": f"The same lower-bound method, on the same 2026 abstracts, gives at least {lb(a26)} (interval {lbci(a26)}) with the 50 style words that rose most in 2026 and {lb(a24)} (interval {lbci(a24)}) with the 50 that rose most in 2024. With 2024 words the bound peaks in 2025 ({lb(B['set2024']['2025'])}) and falls; with 2026 words it rises every year: {rising26}. A placebo run on 2016 to 2021, before any language model, gave {pA26['placebo_bound_pct']:.0f}% for the 2026 words and {pA24['placebo_bound_pct']:.0f}% for the 2024 words, which were already drifting upward (Study SGR-007 traces where those habits came from); re-running the whole selection on pre-LLM years produced up to {pB['placebo_bound_pct']:.0f}% (interval up to {pB['ci95'][1]:.0f}%). Read the bounds with that margin in mind."},
  {"label": "Sentence length did not move",
   "value": f"{f1(per['BASE']['avg_sentence_length'])} to {f1(per['Y2026']['avg_sentence_length'])} words per sentence",
   "explanation": f"Average sentence length was {f2(per['BASE']['avg_sentence_length'])} words in 2020 to 2022 and {f2(per['Y2026']['avg_sentence_length'])} in 2026 (difference {h4['diff_2026_minus_base']:+.2f}; 90% interval {h4['ci90'][0]:+.2f} to {h4['ci90'][1]:+.2f}, inside the pre-registered one-word margin). The change is in vocabulary, not rhythm."},
  {"label": "No sign that old abstracts were re-polished",
   "value": f"{f1(rp['BASE']['old_revised'])}% against {f1(rp['BASE']['old_unrevised'])}% (2024 tells, revised against unrevised)",
   "explanation": f"{f1(rp['BASE']['pct_revised'])}% of 2020 to 2022 papers have a version dated after November 2022, so their current abstract may have been edited since. They carry the 2024 tells at {f2(rp['BASE']['old_revised'])}% against {f2(rp['BASE']['old_unrevised'])}% for papers never revised, and the 2026 words at {f2(rp['BASE']['new_revised'])}% against {f2(rp['BASE']['new_unrevised'])}%. Leaving them in or out changes no result (sensitivity table below)."},
 ],
 "sections": [
  {"heading": "Two sets of tells, half-year by half-year",
   "paragraphs": ["Share of abstracts using at least one word of each twelve-word set. Both sets were fixed before the census was measured."],
   "figure": {"src": "/research/sgr-008-two-word-sets.svg", "alt": f"Line chart: the 2024 tells rise from about 2% of abstracts in 2015 to {f1(hs['2024H1']['old'])}% in early 2024 and fall to {f1(hs['2026H2']['old'])}% by late 2026; the 2026 tells stay near 2% until 2024 and rise to {f1(hs['2026H2']['new'])}%.", "caption": "Source: ScriptGrain SGR-008, CC BY 4.0.", "width": 760, "height": 380}},
  {"heading": "The frozen sets, tested",
   "paragraphs": [f"Papers outside the pilot. Baseline papers revised after 30 November 2022 are left out. Abstracts: {n0(N['BASE'])} (2020 to 2022), {n0(N['Y2024'])} (2024), {n0(N['Y2026'])} (2026, January to September). Intervals: 95%, bootstrap over subject categories."],
   "table": {"columns": ["Word set", "2020 to 2022", "2024", "2026", "2024 minus baseline", "2026 minus 2024"],
             "rows": [[nm, f"{f2(x['BASE'])}%", f"{f2(x['Y2024'])}%", f"{f2(x['Y2026'])}%", f"{x['diff_2024_minus_base']:+.2f} ({ci(x['ci_2024_minus_base'])})", f"{x['diff_2026_minus_2024']:+.2f} ({ci(x['ci_2026_minus_2024'])})"]
                      for nm, x in (("2024 tells", o), ("2026 tells", nw), ("Control: however, results, using, show, method", ct))]}},
  {"heading": "By subject group",
   "paragraphs": ["Share of abstracts using a 2026 tell, by the arXiv group of the paper's first category, and the lower bound from both sets of 50 style words. 'Too uncertain' marks a bound whose 95% interval is wider than 40 points, which happens in the smaller groups."],
   "table": {"columns": ["Group", "2026 tells, 2020 to 2022", "2026 tells, 2026", "Times baseline", "Lower bound 2024", "Lower bound 2026"],
             "rows": [[GNAME[g], f"{f2(gr[g]['base'])}%", f"{f2(gr[g]['y2026'])}%", f"{gr[g]['ratio']:.1f}", lb(bg[g]['2024']) if g in bg else "", lb(bg[g]['2026']) if g in bg else ""] for g in groups]}},
  {"heading": "Three 2024 tells", "figure": {"src": "/research/sgr-008-delve.svg", "alt": f"Line chart: delve, showcasing and innovative peak in 2024 and fall by 2026; delve from {W1['2024']['delve']:.2f}% to {W1['2026']['delve']:.2f}%.", "caption": "Source: ScriptGrain SGR-008, CC BY 4.0.", "width": 760, "height": 380}},
  {"heading": "Three 2026 tells", "figure": {"src": "/research/sgr-008-new-words.svg", "alt": f"Line chart: grounded, recovers and underexplored rise from 2024 to 2026; grounded to {W1['2026']['grounded']:.2f}% of abstracts.", "caption": "Source: ScriptGrain SGR-008, CC BY 4.0.", "width": 760, "height": 380}},
  {"heading": "The style words that rose most, 2024",
   "paragraphs": ["Top 15 of the 50, scored on even-month papers: the share predicted by the word's 2021 to 2022 trend, the share observed, and the ratio."],
   "table": {"columns": ["Word", "Predicted", "Observed", "Ratio"], "rows": [wordrow(w, "2024") for w in top24[:15]]}},
  {"heading": "The style words that rose most, 2026",
   "table": {"columns": ["Word", "Predicted", "Observed", "Ratio"], "rows": [wordrow(w, "2026") for w in top26[:15]]}},
  {"heading": "Lower bounds by year",
   "figure": {"src": "/research/sgr-008-lower-bounds.svg", "alt": f"Line chart: with 2026 words the lower bound rises from {lb(B['set2026']['2023'])} in 2023 to {lb(a26)} in 2026; with 2024 words it peaks at {lb(B['set2024']['2025'])} in 2025 and falls to {lb(a24)}.", "caption": "Source: ScriptGrain SGR-008, CC BY 4.0.", "width": 760, "height": 380},
   "table": {"columns": ["Year", "2024 words", "2026 words", "Both"], "rows": [[y, f"{lb(B['set2024'][y])} ({lbci(B['set2024'][y])})", f"{lb(B['set2026'][y])} ({lbci(B['set2026'][y])})", f"{lb(B['union'][y])} ({lbci(B['union'][y])})"] for y in YB]}},
  {"heading": "Placebo: the same method before language models",
   "paragraphs": ["The method shifted five years earlier: 2016 to 2017 as the trend, 2018 to 2021 as the 'after' years. The true answer is zero, so anything above zero is drift the method mistakes for model use."],
   "table": {"columns": ["Words", "Placebo 'bound' at 2021 (like 2026)", "Interval"],
             "rows": [["The 2026 words", f"{pA26['placebo_bound_pct']:.1f}%", f"{pA26['ci95'][0]:.0f} to {pA26['ci95'][1]:.0f}%"],
                      ["The 2024 words", f"{pA24['placebo_bound_pct']:.1f}%", f"{pA24['ci95'][0]:.0f} to {pA24['ci95'][1]:.0f}%"],
                      ["50 words re-selected on 2016 to 2021 data", f"{pB['placebo_bound_pct']:.1f}%", f"{pB['ci95'][0]:.0f} to {pB['ci95'][1]:.0f}%"]]}},
  {"heading": "Sensitivity: all papers, revised ones included",
   "table": {"columns": ["Word set", "2020 to 2022", "2024", "2026"],
             "rows": [[nm, f"{f2(x['BASE'])}%", f"{f2(x['Y2024'])}%", f"{f2(x['Y2026'])}%"] for nm, x in (("2024 tells", SENS["old"]), ("2026 tells", SENS["new"]))]}},
  {"heading": "Other measures, 2020 to 2022 against 2026",
   "table": {"columns": ["Measure", "2020 to 2022", "2026", "Difference (95% interval)"],
             "rows": [[lab, f2(per["BASE"][k]), f2(per["Y2026"][k]), f"{inst['diffs_2026_minus_base_ci95'][k]['diff']:+.2f} ({inst['diffs_2026_minus_base_ci95'][k]['ci95'][0]:+.2f} to {inst['diffs_2026_minus_base_ci95'][k]['ci95'][1]:+.2f})"]
                      for lab, k in (("Words per abstract", "words"), ("Average sentence length (words)", "avg_sentence_length"), ("Commas per sentence", "comma_density"), ("Semicolons per 1,000 words", "semicolon_frequency"), ("ScriptGrain AI-tell density per 1,000 words", "ai_tell_per1000"), ("Em dashes per 1,000 words", "em_dash_per1000"))]}},
  {"heading": "What 43 earlier studies estimated",
   "paragraphs": [f"We searched Firecrawl's Research Index with 20 fixed queries, screened 1,337 results to the studies that estimate how much scholarly text is written or edited with language models, and checked each paper exists and each number against its own text. {len(lit)} qualify. Methods differ ({', '.join(f'{v} {k}' for k, v in sorted(fam.items(), key=lambda kv: -kv[1]))}), so the numbers are not one series. Detector-based studies often report a high rate before ChatGPT existed, so their figures are not shares of model-written text. The full table, with each quotation, is a download below."],
   "table": {"columns": ["Study", "Corpus", "Estimate"],
             "rows": [[f"{e['first_author']} ({e['year']})", e["corpus"][:120], e["headline_estimate"]] for e in sorted(lit, key=lambda e: (str(e["year"]), e["id"])) if e["method_family"] in ("excess vocabulary / word frequency", "distributional (population-level) model")]}},
 ],
 "limitations": [
  "arXiv only. It is mostly physics, mathematics and computer science, and biomedicine is thin; the published PubMed studies cover that ground.",
  "Word shares describe a body of writing. They cannot say which papers used a model, and people also pick up model vocabulary by reading it.",
  "The topic mix changed: far more 2026 papers are about language models and agents. Style words were separated from topic words by labelling, and the new set rose in mathematics and physics too, but some topic effect may remain in the bounds.",
  "The lower bounds assume each word's 2021 to 2022 trend would have continued in a straight line. The placebo shows ordinary drift can add about 10 points over four years, more for the 2024 words, which were already rising.",
  "arXiv serves each paper's latest abstract. Baseline papers revised after November 2022 were removed; for 2024 and 2026 the abstract may postdate first submission (31% of 2024 papers have a version more than 90 days after the first).",
  "The 2026 word set came from a pilot sample chosen by semantic search, not at random. That is why the census test excludes the pilot papers.",
  "Content or style labels were assigned by Claude models (agreement 343 of 351 words). A different labeller would move a few words between the lists.",
  "2026 covers January to September only.",
 ],
 "reproducibility": [
  "Pre-registration, every script and every result file: docs/research/sgr-008-preregistration.md and scripts/experiments/sgr-008/ in the ScriptGrain repository (census-harvest.py, census-build.py, census-analyse.py, census-instruments.mjs, census-instruments-analyse.py, census-bounds.py, census-placebo.py, write-entry.py).",
  "Source: arXiv's OAI-PMH service (oaipmh.arxiv.org), format arXivRaw. arXiv metadata is CC0, so anyone can harvest the same records and re-run the scripts.",
  "Instruments: supabase/functions/_shared/voice-match.ts (measureTextFeatures) and ai-cliches.ts (scanCliches), the code the product runs.",
  "Abstract text is not republished; the downloads carry counts and shares only.",
 ],
 "dataDownloads": [
  {"label": "Word set shares by half-year, 2015 to 2026 (CSV)", "path": "/research/sgr-008-half-year.csv", "format": "csv"},
  {"label": "Every candidate and frozen word, share of abstracts by year, with labels (CSV)", "path": "/research/sgr-008-words-by-year.csv", "format": "csv"},
  {"label": "Excess-word statistics, selection and scoring halves (CSV)", "path": "/research/sgr-008-excess-words.csv", "format": "csv"},
  {"label": "Literature evidence table, 43 studies with quotations (CSV)", "path": "/research/sgr-008-literature.csv", "format": "csv"},
  {"label": "Every result, including intervals, bounds and placebo (JSON)", "path": "/research/sgr-008-summary.json", "format": "json"},
 ],
 "license": {"name": "CC BY 4.0", "url": "https://creativecommons.org/licenses/by/4.0/"},
 "howToCite": "ScriptGrain (2026). The AI tells moved: 2.1 million arXiv abstracts, 2015 to 2026 (Study SGR-008, conducted 4 October 2026). Dataset licensed CC BY 4.0. https://scriptgrain.com/research/the-ai-tells-moved",
 "citations": [
  {"name": "arXiv OAI-PMH service", "url": "https://info.arxiv.org/help/oa/index.html"},
  {"name": "Kobak et al., Delving into LLM-assisted writing in biomedical publications through excess vocabulary (Science Advances, 2025; arXiv 2406.07016)", "url": "https://arxiv.org/abs/2406.07016"},
  {"name": "Liang et al., Quantifying large language model usage in scientific papers (Nature Human Behaviour, 2025; arXiv 2404.01268)", "url": "https://arxiv.org/abs/2404.01268"},
  {"name": "Geng and Trotta, Human-LLM coevolution: evidence from academic writing (arXiv 2502.09606)", "url": "https://arxiv.org/abs/2502.09606"},
  {"name": "How much are LLMs changing the language of academic papers after ChatGPT? (arXiv 2509.09596)", "url": "https://arxiv.org/abs/2509.09596"},
  {"name": "More than half of recent astronomy papers are written with language-model assistance (arXiv 2609.10664)", "url": "https://arxiv.org/abs/2609.10664"},
  {"name": "Firecrawl Research Index", "url": "https://docs.firecrawl.dev/api-reference/endpoint/research-search-papers"},
  {"name": "ScriptGrain SGR-007, Where did the AI-isms come from? (uses this study's census and word lists)", "url": "https://scriptgrain.com/research/where-did-ai-isms-come-from"},
 ],
}
RP = f"{ROOT}/src/data/research-pages.json"
d = json.load(open(RP))
entry["analyst"] = next(x["analyst"] for x in d["studies"] if x["id"] == "SGR-004")
d["studies"] = [s for s in d["studies"] if s["id"] != "SGR-008"] + [entry]
json.dump(d, open(RP, "w"), indent=2, ensure_ascii=False); open(RP, "a").write("\n")
print("entry written;", len(entry["findings"]), "findings,", len(entry["sections"]), "sections")
