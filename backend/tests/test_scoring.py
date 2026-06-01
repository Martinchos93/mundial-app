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
    }


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
