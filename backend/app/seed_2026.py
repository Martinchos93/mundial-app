"""Seed the OFFICIAL Mundial 2026 group stage (final draw of 5 Dec 2025).

The API-Football free plan can't access season 2026, so the real fixture is
seeded locally from FIFA's published schedule (12 groups, 72 group-stage
matches with official dates and host venues). Matches are `scheduled`, so
prode predictions are open. Run with:  python -m app.seed_2026
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

from app.database import SessionLocal
from app.models import Match, Prediction, Score, AIPrediction

# Schedule times are local Argentina time (UTC-3).
ARG_TZ = timezone(timedelta(hours=-3))


def _kickoff_utc(date_s: str, time_s: str) -> datetime:
    y, m, d = (int(x) for x in date_s.split("-"))
    hh, mm = (int(x) for x in time_s.split(":"))
    return datetime(y, m, d, hh, mm, tzinfo=ARG_TZ).astimezone(timezone.utc)

# Group-stage schedule: GROUP | DATE | TIME | HOME | AWAY | HOST CITY
# TIME is local Argentina time (UTC-3), as shown on the official fixture image;
# seed() converts it to UTC. Dates are the Argentina calendar day of kickoff.
SCHEDULE = """
A|2026-06-11|16:00|Mexico|South Africa|Mexico City
A|2026-06-11|23:00|Korea Republic|Czech Republic|Guadalajara
A|2026-06-18|13:00|Czech Republic|South Africa|Atlanta
A|2026-06-18|22:00|Mexico|Korea Republic|Guadalajara
A|2026-06-24|22:00|Czech Republic|Mexico|Mexico City
A|2026-06-24|22:00|South Africa|Korea Republic|Monterrey
B|2026-06-12|16:00|Canada|Bosnia and Herzegovina|Toronto
B|2026-06-13|16:00|Qatar|Switzerland|Santa Clara
B|2026-06-18|16:00|Switzerland|Bosnia and Herzegovina|Inglewood
B|2026-06-18|19:00|Canada|Qatar|Vancouver
B|2026-06-24|16:00|Switzerland|Canada|Vancouver
B|2026-06-24|16:00|Bosnia and Herzegovina|Qatar|Seattle
C|2026-06-13|19:00|Brazil|Morocco|Foxborough
C|2026-06-13|22:00|Haiti|Scotland|East Rutherford
C|2026-06-19|21:30|Brazil|Haiti|Philadelphia
C|2026-06-19|19:00|Scotland|Morocco|Foxborough
C|2026-06-24|19:00|Scotland|Brazil|Miami Gardens
C|2026-06-24|19:00|Morocco|Haiti|Atlanta
D|2026-06-12|22:00|USA|Paraguay|Inglewood
D|2026-06-14|01:00|Australia|Turkey|Vancouver
D|2026-06-20|00:00|Turkey|Paraguay|Santa Clara
D|2026-06-19|16:00|USA|Australia|Seattle
D|2026-06-25|23:00|Turkey|USA|Inglewood
D|2026-06-25|23:00|Paraguay|Australia|Santa Clara
E|2026-06-14|14:00|Germany|Curacao|Philadelphia
E|2026-06-14|20:00|Cote D'Ivoire|Ecuador|Houston
E|2026-06-20|17:00|Germany|Cote D'Ivoire|Toronto
E|2026-06-20|21:00|Ecuador|Curacao|Kansas City
E|2026-06-25|17:00|Ecuador|Germany|Philadelphia
E|2026-06-25|17:00|Curacao|Cote D'Ivoire|East Rutherford
F|2026-06-14|17:00|Netherlands|Japan|Arlington
F|2026-06-14|23:00|Sweden|Tunisia|Monterrey
F|2026-06-20|14:00|Netherlands|Sweden|Houston
F|2026-06-21|01:00|Tunisia|Japan|Monterrey
F|2026-06-25|20:00|Tunisia|Netherlands|Arlington
F|2026-06-25|20:00|Japan|Sweden|Kansas City
G|2026-06-15|16:00|Belgium|Egypt|Inglewood
G|2026-06-15|22:00|IR Iran|New Zealand|Seattle
G|2026-06-21|16:00|Belgium|IR Iran|Inglewood
G|2026-06-21|22:00|New Zealand|Egypt|Vancouver
G|2026-06-27|00:00|New Zealand|Belgium|Seattle
G|2026-06-27|00:00|Egypt|IR Iran|Vancouver
H|2026-06-15|13:00|Spain|Cape Verde|Miami Gardens
H|2026-06-15|19:00|Saudi Arabia|Uruguay|Atlanta
H|2026-06-21|13:00|Spain|Saudi Arabia|Miami Gardens
H|2026-06-21|19:00|Uruguay|Cape Verde|Atlanta
H|2026-06-26|21:00|Uruguay|Spain|Houston
H|2026-06-26|21:00|Cape Verde|Saudi Arabia|Guadalajara
I|2026-06-16|16:00|France|Senegal|East Rutherford
I|2026-06-16|19:00|Iraq|Norway|Foxborough
I|2026-06-22|18:00|France|Iraq|East Rutherford
I|2026-06-22|21:00|Norway|Senegal|Philadelphia
I|2026-06-26|16:00|Norway|France|Foxborough
I|2026-06-26|16:00|Senegal|Iraq|Toronto
J|2026-06-16|22:00|Argentina|Algeria|Kansas City
J|2026-06-17|01:00|Austria|Jordan|Santa Clara
J|2026-06-22|14:00|Argentina|Austria|Arlington
J|2026-06-23|00:00|Jordan|Algeria|Santa Clara
J|2026-06-27|23:00|Jordan|Argentina|Kansas City
J|2026-06-27|23:00|Algeria|Austria|Arlington
K|2026-06-17|14:00|Portugal|DR Congo|Houston
K|2026-06-17|23:00|Uzbekistan|Colombia|Mexico City
K|2026-06-23|14:00|Portugal|Uzbekistan|Houston
K|2026-06-23|23:00|Colombia|DR Congo|Guadalajara
K|2026-06-27|20:30|Colombia|Portugal|Miami Gardens
K|2026-06-27|20:30|DR Congo|Uzbekistan|Atlanta
L|2026-06-17|17:00|England|Croatia|Toronto
L|2026-06-17|20:00|Ghana|Panama|Arlington
L|2026-06-23|17:00|England|Ghana|Foxborough
L|2026-06-23|20:00|Panama|Croatia|Toronto
L|2026-06-27|18:00|Panama|England|East Rutherford
L|2026-06-27|18:00|Croatia|Ghana|Philadelphia
"""

# Host city -> stadium label
CITY_VENUE = {
    "Mexico City": "Estadio Azteca, Ciudad de México",
    "Guadalajara": "Estadio Akron, Guadalajara",
    "Monterrey": "Estadio BBVA, Monterrey",
    "Toronto": "BMO Field, Toronto",
    "Vancouver": "BC Place, Vancouver",
    "Atlanta": "Mercedes-Benz Stadium, Atlanta",
    "Inglewood": "SoFi Stadium, Los Ángeles",
    "Santa Clara": "Levi's Stadium, San Francisco",
    "Seattle": "Lumen Field, Seattle",
    "Foxborough": "Gillette Stadium, Boston",
    "East Rutherford": "MetLife Stadium, Nueva York",
    "Philadelphia": "Lincoln Financial Field, Filadelfia",
    "Miami Gardens": "Hard Rock Stadium, Miami",
    "Houston": "NRG Stadium, Houston",
    "Arlington": "AT&T Stadium, Dallas",
    "Kansas City": "Arrowhead Stadium, Kansas City",
}

# Official knockout bracket: match_no | round | date | host city | home_source | away_source
# Sources: W:X winner group X · R:X runner-up X · T:<letters> best third among those
# groups · MW:n winner of match n · ML:n loser of match n
KNOCKOUT = [
    (73, "16avos", "2026-06-28", "Inglewood", "R:A", "R:B"),
    (74, "16avos", "2026-06-29", "Foxborough", "W:E", "T:ABCDF"),
    (75, "16avos", "2026-06-29", "Monterrey", "W:F", "R:C"),
    (76, "16avos", "2026-06-29", "Houston", "W:C", "R:F"),
    (77, "16avos", "2026-06-30", "East Rutherford", "W:I", "T:CDFGH"),
    (78, "16avos", "2026-06-30", "Arlington", "R:E", "R:I"),
    (79, "16avos", "2026-06-30", "Mexico City", "W:A", "T:CEFHI"),
    (80, "16avos", "2026-07-01", "Atlanta", "W:L", "T:EHIJK"),
    (81, "16avos", "2026-07-01", "Santa Clara", "W:D", "T:BEFIJ"),
    (82, "16avos", "2026-07-01", "Seattle", "W:G", "T:AEHIJ"),
    (83, "16avos", "2026-07-02", "Toronto", "R:K", "R:L"),
    (84, "16avos", "2026-07-02", "Inglewood", "W:H", "R:J"),
    (85, "16avos", "2026-07-02", "Vancouver", "W:B", "T:EFGIJ"),
    (86, "16avos", "2026-07-03", "Miami Gardens", "W:J", "R:H"),
    (87, "16avos", "2026-07-03", "Kansas City", "W:K", "T:DEIJL"),
    (88, "16avos", "2026-07-03", "Arlington", "R:D", "R:G"),
    (89, "Octavos", "2026-07-04", "Philadelphia", "MW:74", "MW:77"),
    (90, "Octavos", "2026-07-04", "Houston", "MW:73", "MW:75"),
    (91, "Octavos", "2026-07-05", "East Rutherford", "MW:76", "MW:78"),
    (92, "Octavos", "2026-07-05", "Mexico City", "MW:79", "MW:80"),
    (93, "Octavos", "2026-07-06", "Arlington", "MW:83", "MW:84"),
    (94, "Octavos", "2026-07-06", "Seattle", "MW:81", "MW:82"),
    (95, "Octavos", "2026-07-07", "Atlanta", "MW:86", "MW:88"),
    (96, "Octavos", "2026-07-07", "Vancouver", "MW:85", "MW:87"),
    (97, "Cuartos", "2026-07-09", "Foxborough", "MW:89", "MW:90"),
    (98, "Cuartos", "2026-07-10", "Inglewood", "MW:93", "MW:94"),
    (99, "Cuartos", "2026-07-11", "Miami Gardens", "MW:91", "MW:92"),
    (100, "Cuartos", "2026-07-11", "Kansas City", "MW:95", "MW:96"),
    (101, "Semifinal", "2026-07-14", "Arlington", "MW:97", "MW:98"),
    (102, "Semifinal", "2026-07-15", "Atlanta", "MW:99", "MW:100"),
    (103, "Tercer puesto", "2026-07-18", "Miami Gardens", "ML:101", "ML:102"),
    (104, "Final", "2026-07-19", "East Rutherford", "MW:101", "MW:102"),
]


def label_for_source(code: str) -> str:
    """Human placeholder shown until the slot resolves to a real team."""
    kind, _, arg = code.partition(":")
    if kind == "W":
        return f"1° {arg}"
    if kind == "R":
        return f"2° {arg}"
    if kind == "T":
        return f"3° ({'/'.join(arg)})"
    if kind == "MW":
        return f"Ganador M{arg}"
    if kind == "ML":
        return f"Perdedor M{arg}"
    return "?"


def seed() -> int:
    db = SessionLocal()
    try:
        # Clean slate (dev seed).
        db.query(Score).delete()
        db.query(Prediction).delete()
        db.query(AIPrediction).delete()
        db.query(Match).delete()
        db.commit()

        count = 0
        for line in SCHEDULE.strip().splitlines():
            group, date_s, time_s, home, away, city = [p.strip() for p in line.split("|")]
            db.add(
                Match(
                    match_no=count + 1,
                    home_team=home,
                    away_team=away,
                    kickoff_utc=_kickoff_utc(date_s, time_s),
                    phase=f"Grupo {group}",
                    venue=CITY_VENUE.get(city, city),
                    status="scheduled",
                )
            )
            count += 1

        # Knockout bracket (placeholders until results resolve them).
        for no, rnd, date_s, city, hsrc, asrc in KNOCKOUT:
            y, m, d = (int(x) for x in date_s.split("-"))
            kickoff = datetime(y, m, d, 19, 0, tzinfo=timezone.utc)
            db.add(
                Match(
                    match_no=no,
                    home_source=hsrc,
                    away_source=asrc,
                    home_team=label_for_source(hsrc),
                    away_team=label_for_source(asrc),
                    kickoff_utc=kickoff,
                    phase=rnd,
                    venue=CITY_VENUE.get(city, city),
                    status="scheduled",
                )
            )
            count += 1
        db.commit()
        return count
    finally:
        db.close()


def sync_kickoffs() -> int:
    """Update kickoff times (and venues) of existing group matches in place,
    matching by (group, home, away) — WITHOUT deleting matches or predictions.
    Lets production pick up corrected schedule times after a redeploy."""
    db = SessionLocal()
    updated = 0
    try:
        wanted: dict[tuple[str, str, str], tuple[datetime, str]] = {}
        for line in SCHEDULE.strip().splitlines():
            group, date_s, time_s, home, away, city = [p.strip() for p in line.split("|")]
            wanted[(f"Grupo {group}", home, away)] = (
                _kickoff_utc(date_s, time_s),
                CITY_VENUE.get(city, city),
            )
        for m in db.query(Match).filter(Match.phase.ilike("Grupo %")).all():
            key = (m.phase, m.home_team, m.away_team)
            target = wanted.get(key)
            if not target:
                continue
            kickoff, venue = target
            if m.kickoff_utc != kickoff or m.venue != venue:
                m.kickoff_utc = kickoff
                m.venue = venue
                updated += 1
        db.commit()
        if updated:
            try:
                from app.redis_client import bump_matches_cache
                bump_matches_cache()
            except Exception:  # noqa: BLE001
                pass
        return updated
    finally:
        db.close()


if __name__ == "__main__":
    n = seed()
    print(f"Seeded {n} official Mundial 2026 group-stage matches.")
