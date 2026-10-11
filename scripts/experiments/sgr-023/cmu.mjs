// CMU Pronouncing Dictionary (cmudict.dict) loader for SGR-023 validation and the CMU-syllable sensitivity.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
export const CMU_SHA256 = "81917843c7f44ce2b094ac63873c2c7a4cf802040792c455ba3ca406891c3d22";
export const CMU_PATH = `${process.env.HOME}/research/sgr-023/cmudict.dict`;
/** word (a-z only) -> array of syllable counts, one per listed pronunciation (first = primary). */
export function loadCmu(path = CMU_PATH, { check = true } = {}) {
  const buf = readFileSync(path);
  const sha = createHash("sha256").update(buf).digest("hex");
  if (check && sha !== CMU_SHA256) throw new Error(`cmudict.dict sha256 ${sha} is not the frozen file (${CMU_SHA256})`);
  const dict = new Map();
  for (const line of buf.toString("utf8").split("\n")) {
    const [w0, ...ph] = line.trim().split(/\s+/); if (!w0) continue;
    const w = w0.replace(/\(\d+\)$/, ""); if (!/^[a-z]+$/.test(w)) continue;
    const n = ph.filter((p) => /\d$/.test(p)).length; if (!n) continue;
    (dict.get(w) ?? dict.set(w, []).get(w)).push(n);
  }
  return { dict, sha };
}
