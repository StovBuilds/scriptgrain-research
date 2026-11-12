// SGR-028 pre-registered term lists. Frozen with the pre-registration (README.md).
// Spelling pairs: UK form(s) and US form(s) of the same word. Every entry below is a GENUINE
// variant pair: the two forms mean the same thing and differ only in spelling convention.
// Phrases: Americanisms that are lexical or idiomatic, not spelling.

const ex = (stems, sufs) => stems.flatMap((s) => sufs.map((x) => s + x));

// ---- -ise / -ize (Oxford spelling makes -ize legitimate British usage, so this group is
// ---- reported on its own and is NOT used in the Oxford-proof headline measure) ------------
const ISE_STEMS = [
  ["organis", "organiz"], ["recognis", "recogniz"], ["realis", "realiz"], ["specialis", "specializ"],
  ["optimis", "optimiz"], ["minimis", "minimiz"], ["maximis", "maximiz"], ["prioritis", "prioritiz"],
  ["customis", "customiz"], ["personalis", "personaliz"], ["standardis", "standardiz"], ["utilis", "utiliz"],
  ["finalis", "finaliz"], ["summaris", "summariz"], ["emphasis", "emphasiz"], ["civilis", "civiliz"],
  ["capitalis", "capitaliz"], ["categoris", "categoriz"], ["centralis", "centraliz"], ["characteris", "characteriz"],
  ["criticis", "criticiz"], ["digitis", "digitiz"], ["economis", "economiz"], ["authoris", "authoriz"],
  ["apologis", "apologiz"], ["harmonis", "harmoniz"], ["initialis", "initializ"], ["legalis", "legaliz"],
  ["localis", "localiz"], ["materialis", "materializ"], ["memoris", "memoriz"], ["mobilis", "mobiliz"],
  ["modernis", "moderniz"], ["monetis", "monetiz"], ["neutralis", "neutraliz"], ["normalis", "normaliz"],
  ["penalis", "penaliz"], ["popularis", "populariz"], ["privatis", "privatiz"], ["randomis", "randomiz"],
  ["rationalis", "rationaliz"], ["revolutionis", "revolutioniz"], ["scrutinis", "scrutiniz"], ["sensitis", "sensitiz"],
  ["socialis", "socializ"], ["stabilis", "stabiliz"], ["symbolis", "symboliz"], ["synchronis", "synchroniz"],
  ["synthesis", "synthesiz"], ["tokenis", "tokeniz"], ["visualis", "visualiz"], ["virtualis", "virtualiz"],
  ["familiaris", "familiariz"], ["fertilis", "fertiliz"], ["generalis", "generaliz"], ["globalis", "globaliz"],
  ["hospitalis", "hospitaliz"], ["idealis", "idealiz"], ["industrialis", "industrializ"], ["internalis", "internaliz"],
  ["jeopardis", "jeopardiz"], ["colonis", "coloniz"], ["commercialis", "commercializ"], ["computeris", "computeriz"],
  ["democratis", "democratiz"], ["equalis", "equaliz"], ["formalis", "formaliz"], ["immunis", "immuniz"],
  ["incentivis", "incentiviz"], ["individualis", "individualiz"], ["institutionalis", "institutionaliz"], ["itemis", "itemiz"],
  ["liberalis", "liberaliz"], ["marginalis", "marginaliz"], ["mechanis", "mechaniz"], ["nationalis", "nationaliz"],
  ["patronis", "patroniz"], ["pasteuris", "pasteuriz"], ["polaris", "polariz"], ["pressuris", "pressuriz"],
  ["professionalis", "professionaliz"], ["revitalis", "revitaliz"], ["sanitis", "sanitiz"], ["serialis", "serializ"],
  ["sterilis", "steriliz"], ["subsidis", "subsidiz"], ["sympathis", "sympathiz"], ["systematis", "systematiz"],
  ["terroris", "terroriz"], ["theoris", "theoriz"], ["trivialis", "trivializ"], ["unionis", "unioniz"],
  ["urbanis", "urbaniz"], ["vandalis", "vandaliz"], ["contextualis", "contextualiz"], ["operationalis", "operationaliz"],
  ["containeris", "containeriz"], ["decentralis", "decentraliz"],
];
const ISE_SUF = ["e", "es", "ed", "ing", "ation", "ations", "ational", "er", "ers", "able"];

// ---- -yse / -yze (Oxford spelling also uses -yse, so these ARE American-only) -----------------
// UK "analyses" is skipped: it is also the plural of "analysis" (both countries).
const YSE_STEMS = [["analys", "analyz"], ["paralys", "paralyz"], ["catalys", "catalyz"]];
const YSE_UK = ["e", "ed", "ing", "er", "ers"], YSE_US = ["e", "es", "ed", "ing", "er", "ers"];

const OUR_STEMS = [["colo", "colo"], ["favo", "favo"], ["hono", "hono"], ["neighbo", "neighbo"], ["behavio", "behavio"],
  ["flavo", "flavo"], ["harbo", "harbo"], ["humo", "humo"], ["rumo", "rumo"], ["vapo", "vapo"], ["savo", "savo"],
  ["endeavo", "endeavo"], ["armo", "armo"], ["odo", "odo"], ["tumo", "tumo"], ["parlo", "parlo"], ["rigo", "rigo"],
  ["vigo", "vigo"], ["clamo", "clamo"]];
const OUR_SUF = ["", "s", "ed", "ing", "ful", "less", "ite", "ites", "able", "ably", "ist", "ists", "ation", "al", "ally", "ural"];

const pair = (id, group, uk, us) => ({ id, group, uk, us });
export const SPELLING_PAIRS = [
  // group "ize": Oxford-legitimate on the British side
  ...ISE_STEMS.map(([u, a]) => pair(`${u}e/${a}e`, "ize", ex([u], ISE_SUF), ex([a], ISE_SUF))),
  // group "other": American-only spelling conventions
  ...YSE_STEMS.map(([u, a]) => pair(`${u}e/${a}e`, "other", ex([u], YSE_UK), ex([a], YSE_US))),
  ...OUR_STEMS.map(([u, a]) => pair(`${u}ur/${a}r`, "other", ex([u], OUR_SUF.map((s) => "ur" + s)), ex([a], OUR_SUF.map((s) => "r" + s)))),
  ...[["centre", "center"], ["theatre", "theater"], ["fibre", "fiber"], ["litre", "liter"], ["calibre", "caliber"],
      ["sombre", "somber"], ["lustre", "luster"], ["spectre", "specter"], ["sabre", "saber"], ["meagre", "meager"],
      ["ochre", "ocher"], ["manoeuvre", "maneuver"]].map(([u, a]) => pair(`${u}/${a}`, "other",
        [u, u + "s", u.slice(0, -2) + "red", u.slice(0, -2) + "ring", u + "piece", u + "pieces"],
        [a, a + "s", a + "ed", a + "ing", a + "piece", a + "pieces"])),
  pair("defence/defense", "other", ["defence", "defences", "defenceless"], ["defense", "defenses", "defenseless"]),
  pair("offence/offense", "other", ["offence", "offences"], ["offense", "offenses"]),
  pair("pretence/pretense", "other", ["pretence", "pretences"], ["pretense", "pretenses"]),
  // doubled l
  ...[["travel", "travel"], ["cancel", "cancel"], ["label", "label"], ["model", "model"], ["fuel", "fuel"], ["signal", "signal"],
      ["level", "level"], ["channel", "channel"], ["total", "total"], ["dial", "dial"], ["tunnel", "tunnel"], ["equal", "equal"]]
    .map(([s]) => pair(`${s}(l)led/${s}ed`, "other", ex([s], ["led", "ling", "ler", "lers"]), ex([s], ["ed", "ing", "er", "ers"]))
      ),
  pair("counsellor/counselor", "other", ["counsellor", "counsellors", "counselling", "counselled"], ["counselor", "counselors", "counseling", "counseled"]),
  pair("jewellery/jewelry", "other", ["jewellery"], ["jewelry"]),
  pair("skilful/skillful", "other", ["skilful", "skilfully"], ["skillful", "skillfully"]),
  pair("wilful/willful", "other", ["wilful", "wilfully"], ["willful", "willfully"]),
  pair("fulfil/fulfill", "other", ["fulfil", "fulfils", "fulfilment"], ["fulfill", "fulfills", "fulfillment"]),
  pair("instil/instill", "other", ["instil", "instils"], ["instill", "instills"]),
  pair("enrolment/enrollment", "other", ["enrolment", "enrolments"], ["enrollment", "enrollments"]),
  pair("instalment/installment", "other", ["instalment", "instalments"], ["installment", "installments"]),
  pair("ageing/aging", "other", ["ageing"], ["aging"]),
  pair("grey/gray", "other", ["grey", "greys", "greyish"], ["gray", "grays", "grayish"]),
  pair("plough/plow", "other", ["plough", "ploughs", "ploughed", "ploughing"], ["plow", "plows", "plowed", "plowing"]),
  pair("pyjamas/pajamas", "other", ["pyjamas", "pyjama"], ["pajamas", "pajama"]),
  pair("aluminium/aluminum", "other", ["aluminium"], ["aluminum"]),
  pair("mum/mom", "other", ["mum", "mums"], ["mom", "moms"]),
  pair("sceptic/skeptic", "other", ["sceptic", "sceptics", "sceptical", "scepticism"], ["skeptic", "skeptics", "skeptical", "skepticism"]),
  pair("cosy/cozy", "other", ["cosy", "cosier", "cosiest"], ["cozy", "cozier", "coziest"]),
  pair("mould/mold", "other", ["mould", "moulds", "mouldy", "moulded"], ["mold", "molds", "moldy", "molded"]),
  pair("sulphur/sulfur", "other", ["sulphur"], ["sulfur"]),
  pair("aeroplane/airplane", "other", ["aeroplane", "aeroplanes"], ["airplane", "airplanes"]),
  pair("maths/math", "other", ["maths"], ["math"]),
  pair("ae-oe/e", "other",
    ["paediatric", "paediatrics", "anaemia", "anaemic", "anaesthetic", "anaesthesia", "oestrogen", "haemoglobin", "foetus",
     "diarrhoea", "orthopaedic", "gynaecology", "leukaemia", "encyclopaedia", "haemorrhage", "oesophagus"],
    ["pediatric", "pediatrics", "anemia", "anemic", "anesthetic", "anesthesia", "estrogen", "hemoglobin", "fetus",
     "diarrhea", "orthopedic", "gynecology", "leukemia", "encyclopedia", "hemorrhage", "esophagus"]),
];

// Pairs considered and EXCLUDED, with the reason (README lists these; counts are reported in the pilot).
export const EXCLUDED_PAIRS = {
  "programme/program": "UK computing writes 'program'; 'program' also names loyalty/partner schemes. Not a clean variant pair in this corpus (16 software brands).",
  "licence/license": "UK uses 'license' for the verb; noun/verb split makes 'license' valid British.",
  "practise/practice": "UK noun 'practice' is the same form as the US verb/noun.",
  "labour/labor": "Proper nouns (Labour Party, Department of Labor) swamp the count.",
  "metre/meter": "UK uses 'meter' for devices (gas meter, smart meter); energy sector.",
  "catalogue/catalog, dialogue/dialog, analogue/analog": "UK computing and electronics use the short forms.",
  "cheque/check, tyre/tire, kerb/curb, draught/draft": "The US form is also a common word with another meaning.",
  "judgement/judgment, acknowledgement/acknowledgment": "Both forms are British (legal usage).",
  "enrol/enroll": "'enroll' is also used in British software.",
  "artefact/artifact": "UK software uses 'artifact'.",
  "movie (phrase)": "Pilot misfire: 293 hits in one telecom brand, a product name (its film channel). Dropped from the phrase list.",
  "learnt/learned, speciality/specialty, enquire/inquire": "Both forms are in current British use.",
};

// ---- Americanism phrases (per 1,000 words). Matched on lower-cased plain text; spaces and
// ---- hyphens interchangeable. Each is a regex source with word boundaries added at build. ------
export const PHRASES = [
  ["reach out", "reach(?:es|ed|ing)?[\\s-]+out(?:\\s+to)?"],
  ["going forward", "going[\\s-]+forward"],
  ["moving forward", "moving[\\s-]+forward"],
  ["touch base", "touch(?:es|ed|ing)?[\\s-]+base"],
  ["circle back", "circl(?:e|es|ed|ing)[\\s-]+back"],
  ["deep dive", "deep[\\s-]+dives?"],
  ["low-hanging fruit", "low[\\s-]+hanging[\\s-]+fruit"],
  ["game changer", "game[\\s-]+changers?"],
  ["move the needle", "mov(?:e|es|ed|ing)[\\s-]+the[\\s-]+needle"],
  ["double down", "doubl(?:e|es|ed|ing)[\\s-]+down"],
  ["heads up", "heads[\\s-]+up"],
  ["on the same page", "on[\\s-]+the[\\s-]+same[\\s-]+page"],
  ["in the loop", "in[\\s-]+the[\\s-]+loop"],
  ["pain point", "pain[\\s-]+points?"],
  ["next level", "next[\\s-]+level"],
  ["best in class", "best[\\s-]+in[\\s-]+class"],
  ["learnings", "learnings"],
  ["gotten", "gotten"],
  ["awesome", "awesome"],
  ["ballpark", "ball[\\s-]?park"],
  ["vacation", "vacations?"],
  ["cell phone", "cell[\\s-]?phones?"],
  ["sidewalk", "sidewalks?"],
  ["zip code", "zip[\\s-]+codes?"],
  ["parking lot", "parking[\\s-]+lots?"],
  ["diaper", "diapers?"],
  ["faucet", "faucets?"],
  ["gas station", "gas[\\s-]+stations?"],
  ["trash can", "trash[\\s-]+cans?"],
  // 'leverage' verb only: verb inflections always; bare 'leverage' only after a verb-context word
  // (noun 'leverage' in bank and insurance copy is legitimate and is not counted).
  ["leverage (verb)", "leverag(?:es|ed|ing)|(?:(?:to|will|can|could|would|should|and|we|you|they|help|helps|that|which)\\s+leverage)"],
];

// Descriptive British markers (reported, never part of a hypothesis).
export const UK_MARKERS = [["whilst", "whilst"], ["amongst", "amongst"], ["learnt", "learnt"], ["towards", "towards"]];

export function buildLookup() {
  const m = new Map();
  for (const p of SPELLING_PAIRS) {
    for (const w of p.uk) if (!m.has(w)) m.set(w, { id: p.id, group: p.group, side: "uk" });
    for (const w of p.us) if (!m.has(w)) m.set(w, { id: p.id, group: p.group, side: "us" });
  }
  return m;
}
export function buildPhraseRes() {
  return PHRASES.map(([id, src]) => [id, new RegExp(`(?<![a-z])(?:${src})(?![a-z])`, "g")]);
}
