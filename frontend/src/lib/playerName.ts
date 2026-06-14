// Fuzzy player-name matching — mirrors the backend (app/services/scoring.py) so
// the ✅/❌ markers agree with the points actually awarded. Handles accent
// differences and short-vs-full names: "Vinícius Júnior" ~ "Vinicius".

const NAME_STOP = new Set(["jr", "junior", "de", "da", "do", "dos", "das", "del", "la", "el"]);
const ACCENTS = /[̀-ͯ]/g; // combining diacritical marks

function nameTokens(name: string): Set<string> {
  const s = (name || "")
    .normalize("NFKD")
    .replace(ACCENTS, "")
    .toLowerCase()
    .replace(/[.\-_'`]/g, " ");
  return new Set(s.split(/\s+/).filter((t) => t && !NAME_STOP.has(t)));
}

/** True if two names refer to the same player (same tokens, or one a subset). */
export function playerNameMatch(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  const subset = (x: Set<string>, y: Set<string>) => Array.from(x).every((t) => y.has(t));
  return subset(ta, tb) || subset(tb, ta);
}

/** How many of `actuals` match `name` (counts a brace as 2). */
export function countNameMatches(name: string, actuals: string[]): number {
  return (actuals || []).filter((a) => playerNameMatch(name, a)).length;
}
