import pytest


@pytest.fixture(autouse=True)
def no_asi1_key(monkeypatch):
    """Never call ASI:One from tests: agents/.env may hold a real ASI1_API_KEY."""
    monkeypatch.delenv("ASI1_API_KEY", raising=False)
