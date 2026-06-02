"""Scoring engine for Mundial 2026 predictions.

Rules (defaults, overridable via column.scoring_config):
  - Correct result (winner or draw):        +3   (pts_result)
  - Exact total goals of the match:          +2   (pts_exact_goals)
  - Exact total yellow cards:                +1   (pts_yellows)
  - Exact total red cards:                   +1   (pts_reds)
  - Bonus: correct result AND exact goals:   +3   (pts_bonus)

The engine is intentionally free of DB/ORM coupling so it can be unit
tested in isolation. `calculate_score` accepts plain values; a thin
helper (`score_prediction`) adapts ORM objects to it.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any

DEFAULT_CONFIG: dict[str, int] = {
    "pts_result": 3,
    "pts_exact_goals": 2,
    "pts_yellows": 1,
    "pts_reds": 1,
    "pts_bonus": 3,
    "pts_scorer": 3,
    "pts_card": 2,
    "pts_card_red": 4,
    "pts_top_scorer": 10,
}

# Anti-gaming cap: a user can pick at most this many players per category per
# match (otherwise filling the whole squad would guarantee every hit).
MAX_PICKS = 5


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


def _norm(name: str) -> str:
    return (name or "").strip().casefold()


def _count_hits(picks, actuals) -> int:
    """Number of distinct picks (capped at MAX_PICKS) that appear in actuals."""
    actual_set = {_norm(a) for a in (actuals or [])}
    seen: set[str] = set()
    hits = 0
    for p in (picks or [])[:MAX_PICKS]:
        key = _norm(p)
        if key and key not in seen:
            seen.add(key)
            if key in actual_set:
                hits += 1
    return hits


def _counter(names) -> dict[str, int]:
    out: dict[str, int] = {}
    for n in names or []:
        k = _norm(n)
        if k:
            out[k] = out.get(k, 0) + 1
    return out


def _score_players(
    pred_players: list[dict],
    actual_scorers,
    actual_booked,
    actual_reds,
    cfg: dict,
) -> tuple[int, int]:
    """Count-based scoring for per-player picks. Returns (goal_pts, card_pts).

    Goals: +pts_scorer per correctly predicted goal, min(pred, actual) per player.
    Cards: yellow pick that landed +pts_card; red pick that landed +pts_card_red.
    Only the first MAX_PICKS players (per category) count, to limit gaming.
    """
    goals_actual = _counter(actual_scorers)
    red_set = {_norm(n) for n in (actual_reds or [])}
    yellow_set = {_norm(n) for n in (actual_booked or [])} - red_set

    goal_pts = card_pts = 0
    goal_used = card_used = 0
    for p in pred_players or []:
        name = _norm(p.get("name", ""))
        if not name:
            continue
        g = int(p.get("g", 0) or 0)
        y = int(p.get("y", 0) or 0)
        r = int(p.get("r", 0) or 0)

        if g > 0 and goal_used < MAX_PICKS:
            goal_used += 1
            goal_pts += min(g, goals_actual.get(name, 0)) * int(cfg["pts_scorer"])

        if (y > 0 or r > 0) and card_used < MAX_PICKS:
            card_used += 1
            if r > 0 and name in red_set:
                card_pts += int(cfg["pts_card_red"])
            elif y > 0 and name in yellow_set:
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
    config: dict[str, Any] | None = None,
) -> ScoreBreakdown:
    """Compute the score breakdown for a single prediction vs a final result."""
    cfg = {**DEFAULT_CONFIG, **(config or {})}
    breakdown = ScoreBreakdown()

    result_correct = _outcome(pred_home, pred_away) == _outcome(actual_home, actual_away)
    goals_exact = (pred_home + pred_away) == (actual_home + actual_away)

    if result_correct:
        breakdown.pts_result = int(cfg["pts_result"])
    if goals_exact:
        breakdown.pts_exact = int(cfg["pts_exact_goals"])
    if pred_yellows == actual_yellows:
        breakdown.pts_yellows = int(cfg["pts_yellows"])
    if pred_reds == actual_reds:
        breakdown.pts_reds = int(cfg["pts_reds"])
    if result_correct and goals_exact:
        breakdown.pts_bonus = int(cfg["pts_bonus"])

    # Per-player picks. Prefer the count-based pred_players; fall back to the
    # legacy name-list membership for older predictions.
    if pred_players:
        breakdown.pts_scorers, breakdown.pts_cards = _score_players(
            pred_players, actual_scorers, actual_booked, actual_reds_players, cfg
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
        config=config,
    )
