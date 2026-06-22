"""Official FIFA group-stage tiebreaker (Reglamento Mundial 2026, Art. 13).

Order after equal points:
  1) head-to-head among the tied teams: points → goal diff → goals scored
     (computed over the matches played BETWEEN the tied teams only),
  2) overall goal difference,
  3) overall goals scored,
  4) fair-play (fewest cards).

This is the practical flat-key form of Art. 13 — it covers every real case;
the pure recursive "re-apply to the remaining tied subset" only differs in
contrived 3+ way ties and lands on the same order here.
"""
from __future__ import annotations


def rank_group(
    rows: list[dict],
    matches: list[tuple],
    *,
    name: str,
    points: str,
    gd: str,
    gf: str,
    fp: str,
) -> list[dict]:
    """Rank a single group's `rows` (per-team dicts) by Art. 13.

    `matches`: finished matches in this group as (home, away, home_score, away_score).
    The `name/points/gd/gf/fp` args are the dict keys to read on each row.
    """
    ordered = sorted(rows, key=lambda r: r[points], reverse=True)
    out: list[dict] = []
    i = 0
    while i < len(ordered):
        j = i
        while j < len(ordered) and ordered[j][points] == ordered[i][points]:
            j += 1
        block = ordered[i:j]
        if len(block) > 1:
            members = {r[name] for r in block}
            # head-to-head mini-table: name -> [pts, gd, gf]
            h: dict[str, list[int]] = {r[name]: [0, 0, 0] for r in block}
            for ht, at, hs, as_ in matches:
                if ht in members and at in members:
                    h[ht][1] += hs - as_; h[ht][2] += hs
                    h[at][1] += as_ - hs; h[at][2] += as_
                    if hs > as_:
                        h[ht][0] += 3
                    elif as_ > hs:
                        h[at][0] += 3
                    else:
                        h[ht][0] += 1; h[at][0] += 1
            block.sort(
                key=lambda r: (
                    h[r[name]][0], h[r[name]][1], h[r[name]][2],  # head-to-head
                    r[gd], r[gf], r[fp],                          # overall + fair-play
                ),
                reverse=True,
            )
        out.extend(block)
        i = j
    return out
