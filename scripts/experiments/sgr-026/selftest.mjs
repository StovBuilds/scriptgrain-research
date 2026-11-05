#!/usr/bin/env bun
// SGR-026 cleaner self-test: fixed wikitext fixtures -> exact plain prose. Run before the full run.
//   bun scripts/experiments/sgr-026/selftest.mjs        (exit code 0 = all pass)
import { wikitextToPlain, countWords, shortLineWordShare, movedIn, era } from "./lib.mjs";
let fails = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { fails++; console.error(`FAIL ${name}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`); } else console.log(`ok   ${name}`); };

eq("templates, infobox, nested", wikitextToPlain("{{Infobox person|name=A|birth={{birth date|1950|1|2}}}}\n'''Ann''' is a writer."), "Ann is a writer.");
eq("refs both forms", wikitextToPlain("A fact.<ref name=a>{{cite web|url=http://x}}</ref> Another.<ref name=a /> End."), "A fact. Another. End.");
eq("links keep label", wikitextToPlain("An [[United States|American]] [[actor]] in [[Foo (film)|Foo]] and [[Bar#Baz|Bar]]."), "An American actor in Foo and Bar.");
eq("file with linked caption removed", wikitextToPlain("Text.\n[[File:A.jpg|thumb|A [[b]] c]]\nMore."), "Text.\nMore.");
eq("category and interlanguage removed", wikitextToPlain("Text.\n[[Category:Living people]]\n[[fr:Texte]]"), "Text.");
eq("colon-prefixed category link is shown as written", wikitextToPlain("See [[:Category:Cats]] now."), "See Category:Cats now.");
eq("external links", wikitextToPlain("See [http://example.com the site], [http://x.org] and http://bare.url/x now."), "See the site, and now.");
eq("bold and italics", wikitextToPlain("'''Bold''' and ''italic'' and '''''both'''''."), "Bold and italic and both.");
eq("table removed", wikitextToPlain("Before.\n{| class=\"wikitable\"\n|-\n! A !! B\n|-\n| 1 || 2\n|}\nAfter."), "Before.\nAfter.");
eq("headings dropped, sections dropped", wikitextToPlain("Lead.\n== Early life ==\nBorn.\n== References ==\n{{reflist}}\n* ref\n== Legacy ==\nLived."), "Lead.\nBorn.\nLived.");
eq("nested subsection of a dropped section is dropped", wikitextToPlain("Lead.\n== Notes ==\n=== Sub ===\nNote text.\n== Next ==\nBody."), "Lead.\nBody.");
eq("list items keep text", wikitextToPlain("Intro.\n* one two three\n# four five six"), "Intro.\none two three\nfour five six");
eq("html comments and tags", wikitextToPlain("A<!-- hidden --> b <small>small</small> c<br/>d <div class=x>e</div>."), "A b small c\nd e.");
eq("entities", wikitextToPlain("Fish &amp; chips &nbsp;cost &pound;5&mdash;ish."), "Fish & chips cost £5—ish.");
eq("empty brackets from removed templates", wikitextToPlain("Ann ({{birth date|1950|1|2}}) is here; Bob ({{lang|fr|x}}, born 1960) too."), "Ann is here; Bob (born 1960) too.");
eq("redirect is empty", wikitextToPlain("#REDIRECT [[Foo]]"), "");
eq("gallery and math removed", wikitextToPlain("A.<gallery>\nFile:a.jpg|x\n</gallery>B <math>x^2</math> C."), "A.\nB C.");
eq("magic words", wikitextToPlain("__NOTOC__\nBody text."), "Body text.");
eq("word count", countWords("one two  three\nfour"), 4);
eq("short line share", shortLineWordShare("a b c\nthis line has many many more than six words in it", 15), 3 / 15);
eq("moved-in detection", movedIn({ moves: [{ comment: "moved page [[Draft:Ann Smith]] to [[Ann Smith]] without leaving a redirect" }] }), true);
eq("moved-in: renaming within the article namespace is not moved in", movedIn({ moves: [{ comment: "moved page [[Ann smith]] to [[Ann Smith]]" }] }), false);
eq("eras", [era("2018-12"), era("2019-01"), era("2022-11"), era("2022-12"), era("2023-12"), era("2024-01"), era("2026-09"), era("2026-10"), era("2014-12")], ["EARLY", "LATE", "LATE", "TRANSITION", "TRANSITION", "AFTER", "AFTER", null, null]);
process.exit(fails ? 1 : 0);
