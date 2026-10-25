import os

import pytest

# Test-only seeds, set before config.py loads agents/.env (the environment wins over the
# file), so no test ever derives an address from a real seed. A shell value still wins.
TEST_SEEDS = {
    "INVENTORY_AGENT_SEED": "hippocratech test seed: inventory",
    "FLOW_AGENT_SEED": "hippocratech test seed: flow",
    "CLINICAL_WORKFLOW_AGENT_SEED": "hippocratech test seed: clinical workflow",
    "COORDINATOR_AGENT_SEED": "hippocratech test seed: coordinator",
    "SCOREKEEPER_AGENT_SEED": "hippocratech test seed: scorekeeper",
}
for _var, _seed in TEST_SEEDS.items():
    os.environ.setdefault(_var, _seed)
# The Scorekeeper is off unless a test (or the shell) turns it on, whatever agents/.env says.
os.environ.setdefault("SCOREKEEPER", "0")


@pytest.fixture(autouse=True)
def no_asi1_key(monkeypatch):
    """Never call ASI:One from tests: agents/.env may hold a real ASI1_API_KEY."""
    monkeypatch.delenv("ASI1_API_KEY", raising=False)
