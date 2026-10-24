"""Shared plumbing for the four uAgents: building the Agent, and sending and receiving
so that every message goes through the relay (AGENTS.md rule 9) and every agent
reports its status (thinking → speaking → idle/waiting).

Decisions live in logic/; nothing here decides anything.
"""

import logging
import os

os.environ.setdefault("GRPC_VERBOSITY", "NONE")  # the ledger client's gRPC noise when offline

from uagents import Agent, Context, Protocol  # noqa: E402
from uagents_core.registration import AgentRegistrationPolicy  # noqa: E402
from uagents_core.types import DeliveryStatus  # noqa: E402

import addresses  # noqa: E402
from config import PORTS, seed, settings  # noqa: E402
from protocol import Strict  # noqa: E402
from tools import ToolError, relay  # noqa: E402

PROTOCOL_NAME = "hippocratech"
PROTOCOL_VERSION = "0.1.0"


class DeliveryError(RuntimeError):
    pass


class NoRegistration(AgentRegistrationPolicy):
    """LOCAL_RESOLVE=1: register nowhere. The others find us through the local resolver."""

    async def register(self, *args, **kwargs):
        return None


class LocalAgent(Agent):
    """LOCAL_RESOLVE=1: also skip the Almanac status update at startup.

    In uagents 0.26.1, run_startup_tasks() awaits _update_agent_status() before any
    on_event("startup") handler. It is an Almanac API call with 10 retries (about a
    minute when the host is unreachable), ending in a logged traceback. Overriding a
    private method is fragile; tests/test_runtime.py fails if it disappears.
    """

    async def _update_agent_status(self, active: bool):
        return None


def make_agent(name: str) -> tuple[Agent, Protocol]:
    s = settings()
    kwargs = dict(name=name, seed=seed(name), port=PORTS[name], mailbox=s.mailbox)
    if not s.mailbox:
        kwargs["endpoint"] = [addresses.endpoint(name)]
    if s.local_resolve:
        # The ledger client is unused locally; its "Ledger unavailable" warnings are noise.
        logging.getLogger("network").setLevel(logging.ERROR)
        agent = LocalAgent(
            **kwargs,
            resolve=addresses.local_resolver(),
            registration_policy=NoRegistration(),
            report_events=False,
            mark_inactive_on_shutdown=False,
        )
    else:
        agent = Agent(**kwargs)
    assert agent.address == addresses.address(name)
    return agent, Protocol(name=PROTOCOL_NAME, version=PROTOCOL_VERSION)


def round_of(msg: Strict) -> int:
    return getattr(msg, "round", 0) or 0


def reason_of(msg: Strict) -> str | None:
    return getattr(msg, "reason", None)


async def send(ctx: Context, me: str, to: str, type: str, msg: Strict) -> None:
    """Relay first, then send; a message that can't be relayed is not sent (rule 9)."""
    await relay.status(msg.sessionId, me, "speaking")
    await relay.post(msg.sessionId, round_of(msg), me, to, type, msg, reason_of(msg), direction="sent")
    status = await ctx.send(addresses.address(to), msg)
    # Through a mailbox, "sent" (stored in Agentverse) is as far as the sender can see.
    ok = {DeliveryStatus.DELIVERED} | ({DeliveryStatus.SENT} if settings().mailbox else set())
    if status.status not in ok:
        raise DeliveryError(f"{type} to {to} not delivered: {status.status.value}, {status.detail}")


async def received(me: str, sender_address: str, type: str, msg: Strict) -> str:
    """Relay an incoming message and mark this agent thinking. Returns the sender's name."""
    names = {addr: name for name, addr in addresses.all_addresses().items()}
    sender = names.get(sender_address)
    if sender is None:
        raise DeliveryError(f"{type} from unknown address {sender_address}")
    await relay.post(msg.sessionId, round_of(msg), sender, me, type, msg, reason_of(msg), direction="received")
    await relay.status(msg.sessionId, me, "thinking")
    return sender


async def fail(ctx: Context, me: str, session_id: str, error: Exception) -> None:
    """Show the error (rule 13): log it and leave the agent idle. No fallback behavior."""
    ctx.logger.error(f"{type(error).__name__}: {error}")
    try:
        await relay.status(session_id, me, "idle")
    except ToolError as e:
        ctx.logger.error(f"relay also failed: {e}")
