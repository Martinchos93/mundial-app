"""Anthropic-powered match prediction service.

Gathers context from API-Football, builds a structured prompt, asks
Claude for a JSON prediction, persists it, and caches it in Redis.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Match, AIPrediction
from app.redis_client import redis_client
from app.services import football_api

logger = logging.getLogger(__name__)

_CACHE_PREFIX = "ai:match:"
_CACHE_TTL = 3600  # 1 hour
_REGEN_AFTER = timedelta(hours=6)

SYSTEM_PROMPT = (
    "Sos un analista experto en fútbol. Analizás datos estadísticos del "
    "Mundial 2026 y generás predicciones estructuradas en JSON. Siempre "
    "respondés SOLO con JSON válido, sin texto adicional."
)


def _client() -> Anthropic:
    return Anthropic(api_key=settings.ANTHROPIC_API_KEY)


async def _gather_context(match: Match) -> dict:
    """Collect recent form, tournament stats, H2H, lineups and odds."""
    context: dict = {
        "home_team": match.home_team,
        "away_team": match.away_team,
        "phase": match.phase,
        "venue": match.venue,
        "kickoff_utc": match.kickoff_utc.isoformat() if match.kickoff_utc else None,
    }

    home_id, away_id = match.home_team_id, match.away_team_id

    if home_id:
        context["home_recent_form"] = _summarize_fixtures(
            await football_api.get_team_last_fixtures(home_id, last=5), home_id
        )
        context["home_tournament_stats"] = _summarize_team_stats(
            await football_api.get_team_statistics(
                home_id, settings.WORLD_CUP_LEAGUE_ID, settings.WORLD_CUP_SEASON
            )
        )
    if away_id:
        context["away_recent_form"] = _summarize_fixtures(
            await football_api.get_team_last_fixtures(away_id, last=5), away_id
        )
        context["away_tournament_stats"] = _summarize_team_stats(
            await football_api.get_team_statistics(
                away_id, settings.WORLD_CUP_LEAGUE_ID, settings.WORLD_CUP_SEASON
            )
        )
    if home_id and away_id:
        context["head_to_head"] = _summarize_fixtures(
            await football_api.get_head_to_head(home_id, away_id, last=5), None
        )

    if match.api_id:
        context["lineups"] = await football_api.get_fixture_lineups(match.api_id)
        context["odds"] = _summarize_odds(await football_api.get_odds(match.api_id))

    return context


def _summarize_fixtures(fixtures: list[dict], team_id: int | None) -> list[dict]:
    out = []
    for fx in fixtures[:5]:
        teams = fx.get("teams", {})
        goals = fx.get("goals", {})
        out.append(
            {
                "home": teams.get("home", {}).get("name"),
                "away": teams.get("away", {}).get("name"),
                "score": f"{goals.get('home')}-{goals.get('away')}",
                "date": fx.get("fixture", {}).get("date"),
            }
        )
    return out


def _summarize_team_stats(stats: dict | None) -> dict:
    if not stats:
        return {}
    fixtures = stats.get("fixtures", {})
    goals = stats.get("goals", {})
    return {
        "wins": fixtures.get("wins", {}).get("total"),
        "draws": fixtures.get("draws", {}).get("total"),
        "loses": fixtures.get("loses", {}).get("total"),
        "goals_for_avg": goals.get("for", {}).get("average", {}).get("total"),
        "goals_against_avg": goals.get("against", {}).get("average", {}).get("total"),
        "form": stats.get("form"),
    }


def _summarize_odds(odds: list[dict]) -> dict:
    if not odds:
        return {}
    try:
        bets = odds[0]["bookmakers"][0]["bets"][0]["values"]
        return {v["value"]: v["odd"] for v in bets}
    except (KeyError, IndexError, TypeError):
        return {}


def _build_user_prompt(context: dict) -> str:
    return (
        "Analizá el siguiente partido del Mundial 2026 y generá una predicción.\n\n"
        f"DATOS DEL PARTIDO:\n{json.dumps(context, ensure_ascii=False, indent=2)}\n\n"
        "Respondé SOLO con un JSON con exactamente esta forma:\n"
        "{\n"
        '  "result": "home"|"draw"|"away",\n'
        '  "score": {"home": int, "away": int},\n'
        '  "confidence": float (0-1),\n'
        '  "probabilities": {"home": float, "draw": float, "away": float},\n'
        '  "xg_expected": {"home": float, "away": float},\n'
        '  "key_players": [string],\n'
        '  "decisive_factors": [string],\n'
        '  "summary": string (máx 200 chars, en español)\n'
        "}"
    )


def _parse_response(text: str) -> dict:
    text = text.strip()
    # Strip ```json fences if present
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
    # Fall back to slicing the outermost object
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        text = text[start : end + 1]
    return json.loads(text)


def _call_claude(context: dict) -> dict:
    client = _client()
    message = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": _build_user_prompt(context)}],
    )
    text = "".join(block.text for block in message.content if block.type == "text")
    return _parse_response(text)


def _persist(db: Session, match_id: int, data: dict) -> AIPrediction:
    score = data.get("score", {})
    probs = data.get("probabilities", {})
    xg = data.get("xg_expected", {})

    ai = AIPrediction(
        match_id=match_id,
        result=data.get("result", "draw"),
        score_home=int(score.get("home", 0)),
        score_away=int(score.get("away", 0)),
        confidence=float(data.get("confidence", 0.0)),
        prob_home=float(probs.get("home", 0.0)),
        prob_draw=float(probs.get("draw", 0.0)),
        prob_away=float(probs.get("away", 0.0)),
        xg_home=float(xg.get("home", 0.0)),
        xg_away=float(xg.get("away", 0.0)),
        key_players=list(data.get("key_players", []))[:8],
        factors=list(data.get("decisive_factors", []))[:8],
        summary_text=(data.get("summary") or "")[:400],
    )
    db.add(ai)
    db.commit()
    db.refresh(ai)
    return ai


def _latest_prediction(db: Session, match_id: int) -> AIPrediction | None:
    return (
        db.query(AIPrediction)
        .filter(AIPrediction.match_id == match_id)
        .order_by(AIPrediction.generated_at.desc())
        .first()
    )


async def generate_match_prediction(
    db: Session, match_id: int, force: bool = False
) -> AIPrediction | None:
    """Generate (or reuse) an AI prediction for a match.

    Reuses the stored prediction if it is younger than 6 hours unless
    `force=True`. Caches the serialized result in Redis for 1 hour.
    """
    match = db.get(Match, match_id)
    if match is None:
        return None

    existing = _latest_prediction(db, match_id)
    if existing and not force:
        age = datetime.now(timezone.utc) - existing.generated_at
        if age < _REGEN_AFTER:
            return existing

    if not settings.ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set; skipping generation for match %s", match_id)
        return existing

    try:
        context = await _gather_context(match)
        data = _call_claude(context)
    except Exception as exc:  # noqa: BLE001 - never let AI failure break the request
        logger.error("AI prediction failed for match %s: %s", match_id, exc)
        return existing

    ai = _persist(db, match_id, data)
    redis_client.setex(_CACHE_PREFIX + str(match_id), _CACHE_TTL, json.dumps({"id": ai.id}))
    return ai
