"""Unit tests for the scoring engine."""
import pytest

from app.services.scoring import calculate_score, DEFAULT_CONFIG


def score(**kwargs):
    # Cards default to a mismatch (pred 0 vs actual 1) so card points are only
    # awarded when a test explicitly makes both sides equal.
    base = dict(
        pred_home=0, pred_away=0, pred_yellows=0, pred_reds=0,
        actual_home=0, actual_away=0, actual_yellows=1, actual_reds=1,
    )
    base.update(kwargs)
    return calculate_score(**base)


def test_nothing_correct():
    # Predict home win 2-0, actual away win 0-3 -> different result, different totals
    b = score(pred_home=2, pred_away=0, actual_home=0, actual_away=3,
              pred_yellows=1, pred_reds=1, actual_yellows=4, actual_reds=0)
    assert b.total == 0
    assert (b.pts_result, b.pts_exact, b.pts_yellows, b.pts_reds, b.pts_bonus) == (0, 0, 0, 0, 0)


def test_result_only_home_win():
    # Correct winner, wrong total goals
    b = score(pred_home=2, pred_away=0, actual_home=3, actual_away=1)
    assert b.pts_result == 3
    assert b.pts_exact == 0
    assert b.pts_bonus == 0
    assert b.total == 3


def test_result_only_draw():
    b = score(pred_home=1, pred_away=1, actual_home=2, actual_away=2)
    assert b.pts_result == 3
    assert b.pts_exact == 0  # totals differ (2 vs 4)
    assert b.total == 3


def test_result_only_away_win():
    b = score(pred_home=0, pred_away=1, actual_home=1, actual_away=3)
    assert b.pts_result == 3
    assert b.total == 3


def test_exact_goals_without_result():
    # Same total goals (2) but wrong winner -> exact goals only, no result, no bonus
    b = score(pred_home=2, pred_away=0, actual_home=0, actual_away=2)
    assert b.pts_result == 0
    assert b.pts_exact == 2
    assert b.pts_bonus == 0
    assert b.total == 2


def test_result_and_exact_goals_gives_bonus():
    # Correct winner AND correct total goals (but not necessarily exact scoreline)
    b = score(pred_home=2, pred_away=1, actual_home=3, actual_away=0)
    # pred home win, total 3 ; actual home win, total 3 -> result + exact + bonus
    assert b.pts_result == 3
    assert b.pts_exact == 2
    assert b.pts_bonus == 3
    assert b.total == 8


def test_perfect_scoreline():
    b = score(pred_home=2, pred_away=1, actual_home=2, actual_away=1,
              pred_yellows=3, pred_reds=1, actual_yellows=3, actual_reds=1)
    assert b.pts_result == 3
    assert b.pts_exact == 2
    assert b.pts_yellows == 1
    assert b.pts_reds == 1
    assert b.pts_bonus == 3
    assert b.total == 10


def test_yellows_exact_only():
    # 1-0 vs 0-2: away win (result mismatch) and totals differ (1 vs 2)
    b = score(pred_home=1, pred_away=0, actual_home=0, actual_away=2,
              pred_yellows=5, actual_yellows=5)
    assert b.pts_yellows == 1
    assert b.pts_result == 0
    assert b.pts_exact == 0
    assert b.total == 1


def test_reds_exact_only():
    b = score(pred_home=1, pred_away=0, actual_home=0, actual_away=2,
              pred_reds=2, actual_reds=2)
    assert b.pts_reds == 1
    assert b.pts_result == 0
    assert b.total == 1


def test_cards_both_exact():
    b = score(pred_home=0, pred_away=0, actual_home=1, actual_away=0,
              pred_yellows=4, pred_reds=1, actual_yellows=4, actual_reds=1)
    # totals differ (0 vs 1), winner differs (draw vs home) -> only cards
    assert b.pts_yellows == 1
    assert b.pts_reds == 1
    assert b.total == 2


def test_custom_config_overrides():
    cfg = {"pts_result": 5, "pts_exact_goals": 4, "pts_bonus": 10}
    b = score(pred_home=1, pred_away=0, actual_home=2, actual_away=1, config=cfg)
    # home win both, total 1 vs 3 -> result only with custom value
    assert b.pts_result == 5
    assert b.pts_exact == 0
    assert b.total == 5


def test_default_config_values():
    assert DEFAULT_CONFIG == {
        "pts_result": 3,
        "pts_exact_goals": 2,
        "pts_yellows": 1,
        "pts_reds": 1,
        "pts_bonus": 3,
        "pts_scorer": 3,
        "pts_card": 2,
        "pts_card_red": 4,
        "pts_top_scorer": 10,
        "pts_champion": 15,
    }


# ---- Total must always equal the sum of every component (the displayed bug) --

_COMPONENTS = (
    "pts_result", "pts_exact", "pts_yellows", "pts_reds",
    "pts_bonus", "pts_scorers", "pts_cards",
)


def _assert_total_consistent(b):
    assert b.total == sum(getattr(b, c) for c in _COMPONENTS), b.as_dict()


def test_total_equals_sum_of_parts_simple():
    _assert_total_consistent(score(pred_home=2, pred_away=0, actual_home=3, actual_away=1))


def test_total_equals_sum_of_parts_full_house():
    b = score(
        pred_home=1, pred_away=2, actual_home=1, actual_away=2,
        pred_yellows=3, pred_reds=1, actual_yellows=3, actual_reds=1,
        pred_players=[{"name": "X", "g": 2}, {"name": "Y", "y": 1}],
        actual_scorers=["X", "X"], actual_booked=["Y"], actual_reds_players=[],
    )
    _assert_total_consistent(b)


def test_screenshot_case_mexico_1_4():
    # Reproduces the report: away win predicted right (+3), exact yellow total
    # (+1) AND exact red total (+1, reds 0==0). Visible boxes hid the reds, but
    # the engine total must be 5 and equal the sum of parts.
    b = score(
        pred_home=0, pred_away=2, actual_home=1, actual_away=4,  # away win both, totals differ
        pred_yellows=4, actual_yellows=4,  # exact yellows -> +1
        pred_reds=0, actual_reds=0,        # exact reds   -> +1
    )
    assert b.pts_result == 3
    assert b.pts_exact == 0
    assert b.pts_yellows == 1
    assert b.pts_reds == 1
    assert b.total == 5
    _assert_total_consistent(b)


@pytest.mark.parametrize("ph,pa,ah,aa,py,pr,ay,ar", [
    (0, 0, 0, 0, 0, 0, 0, 0),
    (3, 1, 3, 1, 2, 1, 2, 1),
    (1, 2, 4, 0, 5, 0, 1, 2),
    (2, 2, 2, 2, 0, 0, 9, 3),
])
def test_total_consistent_matrix(ph, pa, ah, aa, py, pr, ay, ar):
    b = calculate_score(
        pred_home=ph, pred_away=pa, pred_yellows=py, pred_reds=pr,
        actual_home=ah, actual_away=aa, actual_yellows=ay, actual_reds=ar,
        pred_players=[{"name": "A", "g": 1, "y": 1}],
        actual_scorers=["A"], actual_booked=["A"], actual_reds_players=[],
    )
    _assert_total_consistent(b)


def test_pred_players_goals_count_based():
    # Predict Mbappe 2 goals; he scores 2 -> +6. Wrong result anyway.
    b = score(
        pred_home=1, pred_away=0, actual_home=0, actual_away=2,
        pred_players=[{"name": "Mbappe", "g": 2}],
        actual_scorers=["Mbappe", "Mbappe"],
    )
    assert b.pts_scorers == 6
    assert b.total == 6


def test_pred_players_goals_capped_by_actual():
    # Predict 2 but he only scored 1 -> min -> +3.
    b = score(
        pred_players=[{"name": "Mbappe", "g": 2}],
        actual_scorers=["Mbappe"],
    )
    assert b.pts_scorers == 3


def test_pred_players_yellow_and_red():
    b = score(
        pred_players=[
            {"name": "Messi", "y": 1},   # got yellow -> +2
            {"name": "Otamendi", "r": 1},  # got red -> +4
            {"name": "Ghost", "y": 1},   # not booked -> 0
        ],
        actual_booked=["Messi", "Otamendi"],
        actual_reds_players=["Otamendi"],
    )
    assert b.pts_cards == 6


def test_pred_players_red_pick_needs_red_not_yellow():
    # Predicted a red but the player only got a yellow -> no points.
    b = score(
        pred_players=[{"name": "Messi", "r": 1}],
        actual_booked=["Messi"],
        actual_reds_players=[],
    )
    assert b.pts_cards == 0


def test_pred_players_goal_picks_capped_at_five():
    picks = [{"name": n, "g": 1} for n in ["a", "b", "c", "d", "e", "f"]]
    actual = ["a", "b", "c", "d", "e", "f"]  # 6 actually scored
    b = score(pred_players=picks, actual_scorers=actual)
    assert b.pts_scorers == 5 * 3  # only first 5 picks count


def test_scorers_per_hit():
    # 2 picks, 1 of them actually scored -> +3 (one hit). Result also wrong.
    b = score(
        pred_home=1, pred_away=0, actual_home=0, actual_away=2,
        pred_scorers=["Mbappe", "Giroud"], actual_scorers=["Mbappe", "Dembele"],
    )
    assert b.pts_scorers == 3
    assert b.total == 3


def test_scorers_picking_everyone_is_capped():
    # 7 picks (>MAX_PICKS=5); only the first 5 distinct count. 3 of first 5 hit.
    picks = ["a", "b", "c", "d", "e", "x", "y"]
    actual = ["a", "c", "e", "x", "y"]  # x,y are beyond the cap -> not counted
    b = score(pred_scorers=picks, actual_scorers=actual)
    assert b.pts_scorers == 3 * 3  # a, c, e


def test_cards_per_hit_and_case_insensitive():
    b = score(pred_cards=["Messi"], actual_booked=["messi"])
    assert b.pts_cards == 2


def test_no_picks_no_points():
    b = score(pred_scorers=[], pred_cards=[], actual_scorers=["x"], actual_booked=["y"])
    assert b.pts_scorers == 0
    assert b.pts_cards == 0


@pytest.mark.parametrize(
    "ph,pa,ah,aa,expected_result",
    [
        (1, 0, 2, 0, 3),  # home/home
        (0, 1, 0, 2, 3),  # away/away
        (1, 1, 0, 0, 3),  # draw/draw
        (1, 0, 0, 1, 0),  # home/away mismatch
    ],
)
def test_result_matrix(ph, pa, ah, aa, expected_result):
    b = score(pred_home=ph, pred_away=pa, actual_home=ah, actual_away=aa)
    assert b.pts_result == expected_result
