"""Settings for the agents, from agents/.env (never committed) and the environment.
Variables already in the environment win over .env, so tests and run_all can set them."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

AGENTS_DIR = Path(__file__).parent
load_dotenv(AGENTS_DIR / ".env", override=False)

AGENTS = ("inventory", "flow", "clinical_workflow", "coordinator")
PORTS = {"inventory": 8001, "flow": 8002, "clinical_workflow": 8003, "coordinator": 8004}
SEED_VARS = {
    "inventory": "INVENTORY_AGENT_SEED",
    "flow": "FLOW_AGENT_SEED",
    "clinical_workflow": "CLINICAL_WORKFLOW_AGENT_SEED",
    "coordinator": "COORDINATOR_AGENT_SEED",
}


class ConfigError(RuntimeError):
    pass


def _str(name: str) -> str | None:
    value = os.environ.get(name, "").strip()
    return value or None


def _flag(name: str, default: bool) -> bool:
    value = _str(name)
    if value is None:
        return default
    if value not in ("0", "1"):
        raise ConfigError(f"{name} must be 0 or 1, not {value!r}")
    return value == "1"


@dataclass(frozen=True)
class Settings:
    mailbox: bool  # AGENT_MAILBOX: receive through an Agentverse mailbox
    local_resolve: bool  # LOCAL_RESOLVE: reach each other at 127.0.0.1, no Almanac/Agentverse
    hippo_sim_bin: str | None
    hippo_sim_fixtures: bool  # HIPPO_SIM_FIXTURES: read results from fixtures/results/ instead
    hippo_opt_bin: str | None
    relay_url: str | None  # WATCHER_RELAY_URL
    relay_token: str | None  # RELAY_TOKEN
    hospital_path: Path  # HOSPITAL_PATH, default fixtures/hospital.json
    log_dir: Path  # RELAY_LOG_DIR, default agents/logs; used when WATCHER_RELAY_URL is unset
    agentverse_api_key: str | None  # AGENTVERSE_API_KEY: with AGENT_MAILBOX=1, agents connect their own mailbox
    local_peers: dict[str, str]  # LOCAL_PEERS: extra "address=url" pairs for the local resolver (tests, dev)


def settings() -> Settings:
    s = Settings(
        mailbox=_flag("AGENT_MAILBOX", False),
        local_resolve=_flag("LOCAL_RESOLVE", True),
        hippo_sim_bin=_str("HIPPO_SIM_BIN"),
        hippo_sim_fixtures=_flag("HIPPO_SIM_FIXTURES", False),
        hippo_opt_bin=_str("HIPPO_OPT_BIN"),
        relay_url=_str("WATCHER_RELAY_URL"),
        relay_token=_str("RELAY_TOKEN"),
        hospital_path=Path(_str("HOSPITAL_PATH") or AGENTS_DIR / "fixtures" / "hospital.json"),
        log_dir=Path(_str("RELAY_LOG_DIR") or AGENTS_DIR / "logs"),
        agentverse_api_key=_str("AGENTVERSE_API_KEY"),
        local_peers=_peers(_str("LOCAL_PEERS")),
    )
    if s.relay_url and not s.relay_token:
        raise ConfigError("WATCHER_RELAY_URL is set but RELAY_TOKEN is not")
    return s


def _peers(value: str | None) -> dict[str, str]:
    out = {}
    for pair in (value or "").split(","):
        if pair.strip():
            addr, sep, url = pair.strip().partition("=")
            if not sep or not url.startswith("http"):
                raise ConfigError(f"LOCAL_PEERS entries look like agent1q...=http://127.0.0.1:8010/submit, not {pair!r}")
            out[addr] = url
    return out


def seed(agent: str) -> str:
    var = SEED_VARS[agent]
    value = _str(var)
    if value is None:
        raise ConfigError(f"{var} is not set. Put one seed phrase per agent in agents/.env (see docs/.env.example).")
    return value
