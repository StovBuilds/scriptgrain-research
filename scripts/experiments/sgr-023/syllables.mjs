// SGR-023: deterministic English syllable counter (rules only, no dictionary at run time).
// Frozen by docs/research/sgr-023-preregistration.md section 3. Tuned on the DEV half of the
// CMU Pronouncing Dictionary (words with hash01(word) < 0.5) and scored once on the TEST half.

/** FNV-1a hash of a string to [0,1): the fixed dev/test split. */
export function hash01(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

// Whole words whose spelling defeats the rules; every entry was chosen from the DEV half only.
const EXCEPT = {
  the: 1, area: 3, idea: 3, real: 1, really: 2, being: 2, doing: 2, going: 2, seeing: 2, saying: 2, bias: 2, via: 2, quiet: 2, science: 2, society: 4,
  every: 2, evening: 2, different: 3, interest: 3, business: 2, family: 3, camera: 3, average: 3, favourite: 3, favorite: 3, comfortable: 3, vegetable: 3, temperature: 4,
  people: 2, someone: 2, anyone: 3, everyone: 3, create: 2, created: 3, does: 1, goes: 1, eyes: 1, once: 1, one: 1, two: 1, our: 1, hour: 1, hours: 1,
  fire: 1, wire: 1, tire: 1, hire: 1, hired: 1, entire: 2, require: 2, quite: 1, queue: 1, aisle: 1, isle: 1, island: 2, choir: 1,
  poem: 2, poet: 2, poetry: 3, ion: 2, ions: 2, lion: 2, giant: 2, client: 2, clients: 2, diet: 2, riot: 2, trial: 2, dial: 2, viable: 3, via: 2,
};

export function syllables(raw) {
  let w = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (Object.hasOwn(EXCEPT, w)) return EXCEPT[w];
  if (w.length <= 2) return 1;
  // trailing silent endings: -es / -ed after a consonant (not -ted, -ded, -ses etc.), silent final e (not -le after a consonant)
  let t = w;
  if (/(?:[^aeiouy]|^)ed$/.test(t) && !/[td]ed$/.test(t)) t = t.slice(0, -2);
  else if (/[^aeiouylsxzch]es$/.test(t) && !/(?:ch|sh|ge|ce|se|ze)s$/.test(t)) t = t.slice(0, -2);
  else if (/[^aeiouyl]e$/.test(t) || /^[^aeiouy]*e$/.test(t) && t.length > 2) t = t.slice(0, -1);
  else if (/[aeiouy]le$/.test(t)) t = t.slice(0, -1);
  t = t.replace(/^y/, "");
  let n = (t.match(/[aeiouy]+/g) ?? []).length;
  // vowel pairs that are usually two syllables
  const adds = [/[^aeiou]ia(?!n)/g, /[^aeiouqg]ua/g, /[^aeiou]uo/g, /eo(?!u)(?=[^aeiou]|$)/g, /[aeiou]ing$/g, /[^aeiouy]iu/g, /ie(?=t)/g, /[^aeiouyc]io(?!u|n)/g, /ea(?=[lt]$)/g];
  for (const re of adds) n += (t.match(re) ?? []).length;
  // syllabic l / -ism / -ious style endings
  if (/[^aeiouy]ism$/.test(t)) n += 1;
  if (/[^aeiouy](?:le|les)$/.test(w)) n += 0; // -le counted by the e-strip rule above
  if (/[^aeiouy]le$/.test(w) && !/[aeiouy]le$/.test(w)) { /* consonant+le keeps its syllable: e-strip skipped */ }
  return Math.max(1, n);
}
