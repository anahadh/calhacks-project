"""The chat protocol (ASI:One) for the three specialist agents, on the reasoning loop.

A specialist answers a chat, from the Coordinator's ask_agent or a judge who found it on
Agentverse, with brain.respond over its own tools: who it is (its profile), the last
thing it said in a round, the state it keeps per session (flow.tools(), inventory.tools(),
clinical_workflow.tools()) and the hospital's MCP tools. It never starts a round (only the
Coordinator does; it has no start_round tool). Every chat in or out is relayed first
(rule 10), like the Coordinator's; acks aren't.
"""

import logging
import re
from pathlib import Path
from types import SimpleNamespace
from typing import Callable

from uagents import Agent, Context, Model, Protocol
from uagents_core.contrib.protocols.chat import ChatAcknowledgement, ChatMessage, TextContent, chat_protocol_spec

import brain
import mcp_server
from runtime import PROFILES
from tools import relay

CHAT_SESSION = "asi1-chat"  # the relay session for chat outside a round
COORDINATOR = "Hippocratech Coordinator (@hippocratech-coordinator)"
PROMPTS_DIR = Path(__file__).parent / "prompts"

last_said: dict[str, str] = {}  # agent name → its last message in a round, in one line
chat_protocol = Protocol(spec=chat_protocol_spec)  # one spec; each agent includes its own instance


def note(name: str, line: str) -> None:
    """Remember the last thing an agent said in a round, for its chat tools."""
    last_said[name] = line


def intro(name: str) -> str:
    """The profile's first two sections as plain sentences: who the agent is and the
    stall point it owns."""
    text = Path(PROFILES[name].readme_path(name)).read_text().strip()
    parts = re.split(r"^## ", text, flags=re.M)
    head = "\n".join(l for l in parts[0].splitlines() if l and not l.startswith(("#", ">"))).strip()
    own = next((p for p in parts[1:] if p.lower().startswith("the stall point")), "")
    own = own.split("\n", 1)[1].strip() if "\n" in own else ""
    plain = lambda s: re.sub(r"[*_`>]", "", re.sub(r"\n+", " ", s)).strip()
    return " ".join(x for x in (plain(head), plain(own)) if x)


def system_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.md").read_text()


# --- tools every specialist has ---

NO_ARGS = {"type": "object", "properties": {}}


def intro_tool(name: str) -> brain.Tool:
    async def who_am_i(args: dict):
        return {"intro": intro(name), "handle": "@" + PROFILES[name].handle,
                "note": f"I only talk to the Coordinator during a round. To start one, chat with {COORDINATOR}."}
    return brain.Tool("who_am_i", "Who this agent is and the one thing it owns, from its Agentverse profile.", NO_ARGS, who_am_i)


def last_said_tool(name: str) -> brain.Tool:
    async def last(args: dict):
        said = last_said.get(name)
        return {"said": said} if said else {"none": True, "note": "I haven't spoken in a round yet."}
    return brain.Tool("last_said", "The last thing this agent said in a negotiation round, in one line.", NO_ARGS, last)


# --- the handler ---


def ctx_stub():
    """A Context stand-in for tests: storage and a logger. Not used at runtime."""
    class Store(dict):
        def get(self, k):
            return super().get(k)

        def set(self, k, v):
            self[k] = v

    return SimpleNamespace(storage=Store(), logger=logging.getLogger("agent_chat.test"))


async def send_chat(ctx: Context, to: str, message: Model) -> None:
    status = await ctx.send_raw(
        destination=to,
        message_schema_digest=Model.build_schema_digest(message),
        message_body=message.model_dump_json(),
        protocol_digest=chat_protocol.digest,
    )
    if status.status.value not in ("delivered", "sent"):
        ctx.logger.error(f"chat reply to {to[:16]}… not delivered: {status.detail}")


async def handle_chat(ctx: Context, name: str, sender: str, msg: ChatMessage, tools: Callable[[], list[brain.Tool]]) -> None:
    """One chat turn for a specialist: ack, relay in, respond with its tools, relay out, send."""
    await send_chat(ctx, sender, ChatAcknowledgement(acknowledged_msg_id=msg.msg_id))
    text = msg.text().strip()
    if not text:
        return
    await relay.post(CHAT_SESSION, 0, "humans", name, "chat", {"text": text, "via": "asi1"}, direction="received")
    try:
        all_tools = await mcp_server.as_brain_tools() + list(tools()) + [intro_tool(name), last_said_tool(name)]
        turn = await brain.respond(ctx.storage, name, sender, text, all_tools, system_prompt(name))
        answer = turn.text
    except brain.BrainError as e:
        answer = f"I couldn't answer: {e}"
    await relay.post(CHAT_SESSION, 0, name, "humans", "chat", {"text": answer, "via": "asi1"}, direction="sent")
    await send_chat(ctx, sender, ChatMessage(content=[TextContent(text=answer)]))


def make_chat(name: str, agent: Agent, tools: Callable[[], list[brain.Tool]] = lambda: []) -> Protocol:
    chat = Protocol(spec=chat_protocol_spec)

    @chat.on_message(ChatMessage)
    async def on_chat(ctx: Context, sender: str, msg: ChatMessage):
        await handle_chat(ctx, name, sender, msg, tools)

    @chat.on_message(ChatAcknowledgement)
    async def on_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
        pass

    return chat
