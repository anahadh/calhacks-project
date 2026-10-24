"""Shared plumbing for the four uAgents: building the Agent, and sending and receiving
so that every message goes through the relay (AGENTS.md rule 9) and every agent
reports its status (thinking → speaking → idle/waiting).

Decisions live in logic/; nothing here decides anything.
"""

import asyncio
import logging
import os
from dataclasses import dataclass
from pathlib import Path

os.environ.setdefault("GRPC_VERBOSITY", "NONE")  # the ledger client's gRPC noise when offline

import httpx  # noqa: E402
from uagents import Agent, Context, Model, Protocol  # noqa: E402
from uagents_core.registration import AgentRegistrationPolicy  # noqa: E402
from uagents_core.types import DeliveryStatus  # noqa: E402

import addresses  # noqa: E402
from config import PORTS, seed, settings  # noqa: E402
from protocol import Strict  # noqa: E402
from llm import TEXT_FIELDS  # noqa: E402
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


PROFILES_DIR = Path(__file__).parent / "profiles"


@dataclass(frozen=True)
class Profile:
    """What Agentverse shows for an agent. Published only through /connect (the Inspector's
    Connect → Mailbox, or AGENTVERSE_API_KEY), and only because publish_agent_details=True."""

    name: str
    handle: str
    description: str

    def readme_path(self, agent: str) -> str:
        return str(PROFILES_DIR / f"{agent}.md")  # absolute: uAgents joins a relative path onto the cwd


PROFILES = {
    "inventory": Profile(
        "Hippocratech Inventory Agent", "hippocratech-inventory",
        "Internal agent, called by the Hippocratech Orchestrator (no chat). Blocks any network change to a hospital device nobody can name, and asks a human what it is. Simulation only.",
    ),
    "flow": Profile(
        "Hippocratech Flow Agent", "hippocratech-flow",
        "Internal agent, called by the Hippocratech Orchestrator (no chat). Proposes and revises hospital network-segmentation plans, each tested against the same simulated attack.",
    ),
    "clinical_workflow": Profile(
        "Hippocratech Clinical Workflow", "hippocratech-clinical-workflow",
        "Internal agent, called by the Hippocratech Orchestrator (no chat). Rejects any segmentation plan that breaks a protected clinical flow or keeps a critical service down.",
    ),
    "coordinator": Profile(
        "Hippocratech Orchestrator", "hippocratech-coordinator",
        "Orchestrator: chat with me on ASI:One. I run Inventory, Flow and Clinical Workflow agents to build a ransomware "
        "segmentation plan for a simulated hospital, then route it to the humans who must sign off. Try 'simulate ransomware from MRI 2'.",
    ),
}


class Health(Model):
    agent: str
    address: str
    mailbox: bool
    localResolve: bool


def make_agent(name: str) -> tuple[Agent, Protocol]:
    """Build an agent for the mode in settings() (AGENT_NOTES.md, "Modes"):

    | AGENT_MAILBOX | LOCAL_RESOLVE | Reaches the other three  | Registers on Agentverse/Almanac |
    |---------------|---------------|--------------------------|---------------------------------|
    | 0             | 1 (default)   | 127.0.0.1:<port>/submit  | no                              |
    | 1             | 1             | 127.0.0.1:<port>/submit  | yes, with a mailbox             |
    | 0             | 0             | Almanac lookup           | yes, with the local endpoint    |
    | 1             | 0             | through their mailboxes  | yes, with a mailbox             |

    Every agent also serves GET /health, so its local HTTP server (and /submit) stays up
    in mailbox mode whatever the inspector setting.
    """
    s = settings()
    p = PROFILES[name]
    kwargs = dict(
        name=p.name, seed=seed(name), port=PORTS[name], mailbox=s.mailbox,
        handle=p.handle, description=p.description, readme_path=p.readme_path(name),
        publish_agent_details=True,
    )
    if not s.mailbox:
        kwargs["endpoint"] = [addresses.endpoint(name)]  # an endpoint would override the mailbox
    if s.local_resolve:
        kwargs["resolve"] = addresses.local_resolver()
    if s.local_resolve and not s.mailbox:
        # Nothing to register with. The ledger client is unused; its warnings are noise.
        logging.getLogger("network").setLevel(logging.ERROR)
        agent = LocalAgent(**kwargs, registration_policy=NoRegistration(), report_events=False,
                           mark_inactive_on_shutdown=False)
    else:
        agent = Agent(**kwargs)
    assert agent.address == addresses.address(name)

    @agent.on_rest_get("/health", Health)
    async def health(_ctx: Context) -> Health:
        return Health(agent=name, address=agent.address, mailbox=s.mailbox, localResolve=s.local_resolve)

    if s.mailbox and s.agentverse_api_key:
        @agent.on_event("startup")
        async def connect(ctx: Context):
            await connect_mailbox(ctx, name, s.agentverse_api_key)

    return agent, Protocol(name=PROTOCOL_NAME, version=PROTOCOL_VERSION)


async def connect_mailbox(ctx: Context, name: str, api_key: str, attempts: int = 20) -> bool:
    """AGENTVERSE_API_KEY: do what the Inspector's Connect → Mailbox does, from code.

    The Inspector POSTs {"user_token", "agent_type": "mailbox"} to the agent's own
    /connect endpoint (uAgents' inspector handler), which registers the agent and its
    profile in Agentverse. uagents_core's register_agent() sends an Agentverse API key
    as that same user_token, so we POST it to our own /connect. The key is never logged.
    """
    url = f"http://127.0.0.1:{PORTS[name]}/connect"
    body = {"user_token": api_key, "agent_type": "mailbox"}
    for attempt in range(attempts):
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(url, json=body)
            result = r.json()
            if r.status_code == 200 and result.get("success"):
                ctx.logger.info("Agentverse: connected the mailbox with AGENTVERSE_API_KEY")
                return True
            ctx.logger.error(f"Agentverse: mailbox connect failed: {result.get('detail') or r.text[:200]}")
            return False
        except httpx.HTTPError:
            await asyncio.sleep(1)  # our server may not be listening yet
    ctx.logger.error("Agentverse: our own /connect never answered")
    return False


def round_of(msg: Strict) -> int:
    return getattr(msg, "round", 0) or 0


def reason_of(msg: Strict) -> tuple[str | None, str | None]:
    """A message's worded text and who wrote it ("claude", "asi1" or "template"), for the relay row."""
    fields = TEXT_FIELDS.get(type(msg))
    if fields is None:
        return None, None
    return getattr(msg, fields[0]), getattr(msg, fields[1])


async def send(ctx: Context, me: str, to: str, type: str, msg: Strict) -> None:
    """Relay first, then send; a message that can't be relayed is not sent (rule 9)."""
    await relay.status(msg.sessionId, me, "speaking")
    reason, source = reason_of(msg)
    await relay.post(msg.sessionId, round_of(msg), me, to, type, msg, reason, direction="sent", reason_source=source)
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
    reason, source = reason_of(msg)
    await relay.post(msg.sessionId, round_of(msg), sender, me, type, msg, reason, direction="received", reason_source=source)
    await relay.status(msg.sessionId, me, "thinking")
    return sender


async def fail(ctx: Context, me: str, session_id: str, error: Exception) -> None:
    """Show the error (rule 14): log it, stop the round with the error as its state's
    detail (the Agent Room shows it), and leave the agent idle. No fallback behavior."""
    ctx.logger.error(f"{type(error).__name__}: {error}")
    detail = f"The {me.replace('_', ' ')} agent failed: {error}"[:500]
    try:
        await relay.post(session_id, 0, me, "relay", "round_state",
                         {"sessionId": session_id, "round": 0, "state": "done", "detail": detail}, direction="sent")
        await relay.status(session_id, me, "idle")
    except ToolError as e:
        ctx.logger.error(f"relay also failed: {e}")
