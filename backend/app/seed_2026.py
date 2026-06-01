"""Seed the OFFICIAL Mundial 2026 group stage (final draw of 5 Dec 2025).

The API-Football free plan can't access season 2026, so the real fixture is
seeded locally from FIFA's published schedule (12 groups, 72 group-stage
matches with official dates and host venues). Matches are `scheduled`, so
prode predictions are open. Run with:  python -m app.seed_2026
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.database import SessionLocal
from app.models import Match, Prediction, Score, AIPrediction

# Official group-stage schedule: GROUP | DATE | HOME | AWAY | HOST CITY
SCHEDULE = """
A|2026-06-11|Mexico|South Africa|Mexico City
A|2026-06-11|Korea Republic|Czech Republic|Guadalajara
A|2026-06-18|Czech Republic|South Africa|Atlanta
A|2026-06-18|Mexico|Korea Republic|Guadalajara
A|2026-06-24|Czech Republic|Mexico|Mexico City
A|2026-06-24|South Africa|Korea Republic|Monterrey
B|2026-06-12|Canada|Bosnia and Herzegovina|Toronto
B|2026-06-12|Qatar|Switzerland|Santa Clara
B|2026-06-18|Switzerland|Bosnia and Herzegovina|Inglewood
B|2026-06-18|Canada|Qatar|Vancouver
B|2026-06-24|Switzerland|Canada|Vancouver
B|2026-06-24|Bosnia and Herzegovina|Qatar|Seattle
C|2026-06-13|Brazil|Morocco|Foxborough
C|2026-06-13|Haiti|Scotland|East Rutherford
C|2026-06-19|Brazil|Haiti|Philadelphia
C|2026-06-19|Scotland|Morocco|Foxborough
C|2026-06-24|Scotland|Brazil|Miami Gardens
C|2026-06-24|Morocco|Haiti|Atlanta
D|2026-06-12|USA|Paraguay|Inglewood
D|2026-06-12|Australia|Turkey|Vancouver
D|2026-06-19|Turkey|Paraguay|Santa Clara
D|2026-06-19|USA|Australia|Seattle
D|2026-06-25|Turkey|USA|Inglewood
D|2026-06-25|Paraguay|Australia|Santa Clara
E|2026-06-14|Germany|Curacao|Philadelphia
E|2026-06-14|Cote D'Ivoire|Ecuador|Houston
E|2026-06-20|Germany|Cote D'Ivoire|Toronto
E|2026-06-20|Ecuador|Curacao|Kansas City
E|2026-06-25|Ecuador|Germany|Philadelphia
E|2026-06-25|Curacao|Cote D'Ivoire|East Rutherford
F|2026-06-14|Netherlands|Japan|Arlington
F|2026-06-14|Sweden|Tunisia|Monterrey
F|2026-06-20|Netherlands|Sweden|Houston
F|2026-06-20|Tunisia|Japan|Monterrey
F|2026-06-25|Tunisia|Netherlands|Arlington
F|2026-06-25|Japan|Sweden|Kansas City
G|2026-06-15|Belgium|Egypt|Inglewood
G|2026-06-15|IR Iran|New Zealand|Seattle
G|2026-06-21|Belgium|IR Iran|Inglewood
G|2026-06-21|New Zealand|Egypt|Vancouver
G|2026-06-26|New Zealand|Belgium|Seattle
G|2026-06-26|Egypt|IR Iran|Vancouver
H|2026-06-15|Spain|Cape Verde|Miami Gardens
H|2026-06-15|Saudi Arabia|Uruguay|Atlanta
H|2026-06-21|Spain|Saudi Arabia|Miami Gardens
H|2026-06-21|Uruguay|Cape Verde|Atlanta
H|2026-06-26|Uruguay|Spain|Houston
H|2026-06-26|Cape Verde|Saudi Arabia|Guadalajara
I|2026-06-16|France|Senegal|East Rutherford
I|2026-06-16|Iraq|Norway|Foxborough
I|2026-06-22|France|Iraq|East Rutherford
I|2026-06-22|Norway|Senegal|Philadelphia
I|2026-06-26|Norway|France|Foxborough
I|2026-06-26|Senegal|Iraq|Toronto
J|2026-06-16|Argentina|Algeria|Kansas City
J|2026-06-16|Austria|Jordan|Santa Clara
J|2026-06-22|Argentina|Austria|Arlington
J|2026-06-22|Jordan|Algeria|Santa Clara
J|2026-06-27|Jordan|Argentina|Kansas City
J|2026-06-27|Algeria|Austria|Arlington
K|2026-06-17|Portugal|DR Congo|Houston
K|2026-06-17|Uzbekistan|Colombia|Mexico City
K|2026-06-23|Portugal|Uzbekistan|Houston
K|2026-06-23|Colombia|DR Congo|Guadalajara
K|2026-06-27|Colombia|Portugal|Miami Gardens
K|2026-06-27|DR Congo|Uzbekistan|Atlanta
L|2026-06-17|England|Croatia|Toronto
L|2026-06-17|Ghana|Panama|Arlington
L|2026-06-23|England|Ghana|Foxborough
L|2026-06-23|Panama|Croatia|Toronto
L|2026-06-27|Panama|England|East Rutherford
L|2026-06-27|Croatia|Ghana|Philadelphia
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

KICKOFF_HOURS = [19, 22, 16, 1]  # UTC slots (afternoon/evening local in the Americas)

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
            group, date_s, home, away, city = [p.strip() for p in line.split("|")]
            y, m, d = (int(x) for x in date_s.split("-"))
            kickoff = datetime(y, m, d, KICKOFF_HOURS[count % len(KICKOFF_HOURS)], 0, tzinfo=timezone.utc)
            db.add(
                Match(
                    match_no=count + 1,
                    home_team=home,
                    away_team=away,
                    kickoff_utc=kickoff,
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


if __name__ == "__main__":
    n = seed()
    print(f"Seeded {n} official Mundial 2026 group-stage matches.")
