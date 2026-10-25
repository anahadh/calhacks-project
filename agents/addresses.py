"""The agents' addresses (derived from their seeds) and how they reach each other: the
four, plus the Scorekeeper (port 8005) with SCOREKEEPER=1.

With LOCAL_RESOLVE=1 the agents reach each other directly at
http://127.0.0.1:<port>/submit, never through the Almanac or Agentverse. In mailbox
mode, anyone else (an ASI:One user, say) is still looked up the normal way, so the
Coordinator can reply to them. See AGENT_NOTES.md, "Local resolution" and "Modes".
"""

from functools import cache

from uagents.crypto import Identity
from uagents.resolver import GlobalResolver, Resolver, RulesBasedResolver

from config import PORTS, agents, seed, settings


@cache
def address(agent: str) -> str:
    return Identity.from_seed(seed(agent), 0).address


def endpoint(agent: str) -> str:
    return f"http://127.0.0.1:{PORTS[agent]}/submit"


def all_addresses() -> dict[str, str]:
    return {agent: address(agent) for agent in agents()}


def local_rules() -> dict[str, str]:
    """Our agents (127.0.0.1:8001-8004, and :8005 for the Scorekeeper with SCOREKEEPER=1),
    plus any LOCAL_PEERS (a test's fake chat sender, for instance)."""
    return {**{address(a): endpoint(a) for a in agents()}, **settings().local_peers}


class LocalFirstResolver(Resolver):
    """Local rules for our agents; everyone else through the global resolver (Almanac,
    Agentverse). Used with AGENT_MAILBOX=1 and LOCAL_RESOLVE=1."""

    def __init__(self, rules: dict[str, str], fallback: Resolver | None = None):
        self._local = RulesBasedResolver(rules)
        self._rules = rules
        self._fallback = fallback or GlobalResolver()

    async def resolve(self, destination: str) -> tuple[str | None, list[str]]:
        if destination in self._rules:
            return await self._local.resolve(destination)
        return await self._fallback.resolve(destination)


def local_resolver() -> Resolver:
    """Local only (LOCAL_RESOLVE=1, no mailbox), or local first (LOCAL_RESOLVE=1 with a mailbox)."""
    rules = local_rules()
    return LocalFirstResolver(rules) if settings().mailbox else RulesBasedResolver(rules)


if __name__ == "__main__":
    for agent, addr in all_addresses().items():
        print(f"{agent:<18} {addr}  {endpoint(agent)}")
