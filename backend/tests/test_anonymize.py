import pytest
from backend.services.anonymize import round_up_to_100


def test_already_rounded():
    assert round_up_to_100(32000) == 32000


def test_rounds_up():
    assert round_up_to_100(179_423) == 179_500


def test_fractional_cents():
    assert round_up_to_100(100.01) == 200


def test_zero():
    assert round_up_to_100(0) == 0


def test_large_number():
    assert round_up_to_100(1_999_901) == 2_000_000


def test_exact_boundary():
    assert round_up_to_100(100) == 100
    assert round_up_to_100(101) == 200


def test_negative_not_applicable():
    # Losses are not income; function should still be mathematically consistent
    assert round_up_to_100(-100) == -100
