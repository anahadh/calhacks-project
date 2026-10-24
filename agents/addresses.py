"""The four agents' addresses (derived from their seeds) and how they reach each other.

With LOCAL_RESOLVE=1 the agents skip the Almanac and Agentverse entirely:
a RulesBasedResolver maps each address straight to http://127.0.0.1:<port>/submit.
See AGENT_NOTES.md, "Local resolution".
"""

from functools import cache

from uagents.crypto import Identity
from uagents.resolver import RulesBasedResolver

from config import AGENTS, PORTS, seed


@cache
def address(agent: str) -> str:
    return Identity.from_seed(seed(agent), 0).address


def endpoint(agent: str) -> str:
    return f"http://127.0.0.1:{PORTS[agent]}/submit"


def all_addresses() -> dict[str, str]:
    return {agent: address(agent) for agent in AGENTS}


def local_resolver() -> RulesBasedResolver:
    return RulesBasedResolver({address(a): endpoint(a) for a in AGENTS})


if __name__ == "__main__":
    for agent, addr in all_addresses().items():
        print(f"{agent:<18} {addr}  {endpoint(agent)}")
