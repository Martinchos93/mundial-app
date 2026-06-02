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
    "pts_top_scorer": 10,
}

# Anti-gaming cap: a user can pick at most this many players per category per
# match (otherwise picking the whole squad would guarantee every hit).
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
    actual_scorers: list[str] | None = None,
    actual_booked: list[str] | None = None,
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

    # Optional per-match player picks: points per correct hit (capped picks).
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
        actual_scorers=match.scorers,
        actual_booked=match.booked,
        config=config,
    )
