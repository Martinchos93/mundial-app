"""Scoring engine for Mundial 2026 predictions.

Rules (defaults, overridable via column.scoring_config):
  - Correct result (winner or draw):        +3   (pts_result)
  - Exact scoreline (e.g. 2-1 == 2-1):       +2   (pts_exact_goals)
  - Exact total yellow cards:                +1   (pts_yellows)
  - Exact total red cards:                   +1   (pts_reds)
  - Bonus for the exact scoreline:           +3   (pts_bonus)

The engine is intentionally free of DB/ORM coupling so it can be unit
tested in isolation. `calculate_score` accepts plain values; a thin
helper (`score_prediction`) adapts ORM objects to it.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, asdict
from typing import Any

DEFAULT_CONFIG: dict[str, int] = {
    "pts_result": 3,
    "pts_exact_goals": 2,  # exact scoreline (2-1 == 2-1), not total goals
    "pts_yellows": 1,
    "pts_reds": 1,
    "pts_bonus": 3,  # extra for the exact scoreline
    "pts_scorer": 3,
    "pts_card": 2,
    "pts_card_red": 4,
    "pts_top_scorer": 10,
    "pts_champion": 15,
}

# Anti-gaming caps: at most this many players per category per match (otherwise
# filling the whole squad would guarantee every hit).
MAX_PICKS = 5  # legacy name-list fallback
MAX_GOALS_PER_TEAM = 3  # goleadores cap per team = min(predicted score, this)
MAX_YELLOW_PICKS = 3
MAX_RED_PICKS = 3


@dataclass
class ScoreBreakdown:
    pts_result: int = 0
    pts_exact: int = 0
    pts_yellows: int = 0
    pts_reds: int = 0
    pts_bonus: int = 0
    pts_scorers: int = 0
    pts_cards: int = 0
    total: int = 0

    def as_dict(self) -> dict[str, int]:
        return asdict(self)


# Tokens that carry no identity, so they shouldn't block a match.
_NAME_STOP = {"jr", "junior", "de", "da", "do", "dos", "das", "del", "la", "el"}


def _name_tokens(name: str) -> frozenset[str]:
    """Accent-stripped, punctuation-split token set of a player name. Lets
    'Vinícius Júnior' (our squad) match 'Vinicius' (promiedos) and
    'B. Guimaraes' match 'Bruno Guimaraes'."""
    s = unicodedata.normalize("NFKD", name or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).casefold()
    s = re.sub(r"[.\-_'`]", " ", s)
    return frozenset(t for t in s.split() if t and t not in _NAME_STOP)


def _name_match(a: str, b: str) -> bool:
    """True if two names refer to the same player: same token set, or one is a
    subset of the other (short name vs full name)."""
    ta, tb = _name_tokens(a), _name_tokens(b)
    if not ta or not tb:
        return False
    return ta <= tb or tb <= ta


def _match_count(name: str, actuals) -> int:
    """How many of `actuals` match `name` (counts a brace as 2)."""
    return sum(1 for a in (actuals or []) if _name_match(name, a))


def _count_hits(picks, actuals) -> int:
    """Number of distinct picks (capped at MAX_PICKS) that appear in actuals."""
    seen: list[frozenset[str]] = []
    hits = 0
    for p in (picks or [])[:MAX_PICKS]:
        toks = _name_tokens(p)
        if not toks or toks in seen:
            continue
        seen.append(toks)
        if any(_name_match(p, a) for a in (actuals or [])):
            hits += 1
    return hits


def _score_players(
    pred_players: list[dict],
    actual_scorers,
    actual_booked,
    actual_reds,
    cfg: dict,
    goal_budget: dict[str, int] | None = None,
) -> tuple[int, int]:
    """Count-based scoring for per-player picks. Returns (goal_pts, card_pts).

    Goals: +pts_scorer per correctly predicted goal. Counted goals per TEAM are
    capped at goal_budget[team] = min(predicted team score, MAX_GOALS_PER_TEAM),
    so a 11-11 prediction with the whole squad can't farm scorer points.
    Cards: yellow pick that landed +pts_card; red pick that landed +pts_card_red.
    """
    # A red-carded player isn't double-counted as a yellow.
    booked = list(actual_booked or [])
    reds = list(actual_reds or [])
    yellows = [n for n in booked if not any(_name_match(n, rp) for rp in reds)]

    goal_pts = card_pts = 0
    yellow_used = red_used = 0
    used_goals: dict[str, int] = {}  # correct goals already counted per team
    for p in pred_players or []:
        name = p.get("name", "")
        if not _name_tokens(name):
            continue
        team = p.get("team") or ""
        g = int(p.get("g", 0) or 0)
        y = int(p.get("y", 0) or 0)
        r = int(p.get("r", 0) or 0)

        if g > 0:
            cap = (goal_budget or {}).get(team, MAX_GOALS_PER_TEAM)
            room = cap - used_goals.get(team, 0)
            if room > 0:
                counted = min(g, _match_count(name, actual_scorers), room)
                if counted > 0:
                    goal_pts += counted * int(cfg["pts_scorer"])
                    used_goals[team] = used_goals.get(team, 0) + counted

        if r > 0 and red_used < MAX_RED_PICKS:
            red_used += 1
            if any(_name_match(name, rp) for rp in reds):
                card_pts += int(cfg["pts_card_red"])

        if y > 0 and yellow_used < MAX_YELLOW_PICKS:
            yellow_used += 1
            if any(_name_match(name, yp) for yp in yellows):
                card_pts += int(cfg["pts_card"])
    return goal_pts, card_pts


def _outcome(home: int, away: int) -> str:
    if home > away:
        return "home"
    if home < away:
        return "away"
    return "draw"


def calculate_score(
    *,
    pred_home: int,
    pred_away: int,
    pred_yellows: int,
    pred_reds: int,
    actual_home: int,
    actual_away: int,
    actual_yellows: int,
    actual_reds: int,
    pred_scorers: list[str] | None = None,
    pred_cards: list[str] | None = None,
    pred_players: list[dict] | None = None,
    actual_scorers: list[str] | None = None,
    actual_booked: list[str] | None = None,
    actual_reds_players: list[str] | None = None,
    home_team: str | None = None,
    away_team: str | None = None,
    config: dict[str, Any] | None = None,
) -> ScoreBreakdown:
    """Compute the score breakdown for a single prediction vs a final result."""
    cfg = {**DEFAULT_CONFIG, **(config or {})}
    breakdown = ScoreBreakdown()

    result_correct = _outcome(pred_home, pred_away) == _outcome(actual_home, actual_away)
    # Exact scoreline (e.g. 2-1 == 2-1), NOT just the total number of goals.
    exact_score = pred_home == actual_home and pred_away == actual_away

    if result_correct:
        breakdown.pts_result = int(cfg["pts_result"])
    if exact_score:
        breakdown.pts_exact = int(cfg["pts_exact_goals"])
    # Only reward an ACTIVE prediction (> 0). Predicting 0 is the default "didn't
    # bother", so 0-vs-0 must not hand out a free point on the many card-less games.
    if pred_yellows > 0 and pred_yellows == actual_yellows:
        breakdown.pts_yellows = int(cfg["pts_yellows"])
    if pred_reds > 0 and pred_reds == actual_reds:
        breakdown.pts_reds = int(cfg["pts_reds"])
    if exact_score:  # exact scoreline implies the result is correct too
        breakdown.pts_bonus = int(cfg["pts_bonus"])

    # Per-player picks. Prefer the count-based pred_players; fall back to the
    # legacy name-list membership for older predictions.
    if pred_players:
        # Per-team goleador cap = min(predicted team score, MAX_GOALS_PER_TEAM).
        goal_budget: dict[str, int] = {}
        if home_team:
            goal_budget[home_team] = min(pred_home, MAX_GOALS_PER_TEAM)
        if away_team:
            goal_budget[away_team] = min(pred_away, MAX_GOALS_PER_TEAM)
        breakdown.pts_scorers, breakdown.pts_cards = _score_players(
            pred_players, actual_scorers, actual_booked, actual_reds_players, cfg,
            goal_budget or None,
        )
    else:
        breakdown.pts_scorers = _count_hits(pred_scorers, actual_scorers) * int(cfg["pts_scorer"])
        breakdown.pts_cards = _count_hits(pred_cards, actual_booked) * int(cfg["pts_card"])

    breakdown.total = (
        breakdown.pts_result
        + breakdown.pts_exact
        + breakdown.pts_yellows
        + breakdown.pts_reds
        + breakdown.pts_bonus
        + breakdown.pts_scorers
        + breakdown.pts_cards
    )
    return breakdown


def score_prediction(prediction, match, config: dict | None = None) -> ScoreBreakdown:
    """Adapter that scores an ORM Prediction against an ORM Match (must be finished)."""
    return calculate_score(
        pred_home=prediction.pred_home_score,
        pred_away=prediction.pred_away_score,
        pred_yellows=prediction.pred_yellows,
        pred_reds=prediction.pred_reds,
        actual_home=match.home_score or 0,
        actual_away=match.away_score or 0,
        actual_yellows=(match.home_yellows or 0) + (match.away_yellows or 0),
        actual_reds=(match.home_reds or 0) + (match.away_reds or 0),
        pred_scorers=prediction.pred_scorers,
        pred_cards=prediction.pred_cards,
        pred_players=prediction.pred_players,
        actual_scorers=match.scorers,
        actual_booked=match.booked,
        actual_reds_players=match.red_players,
        home_team=match.home_team,
        away_team=match.away_team,
        config=config,
    )
