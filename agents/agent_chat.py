"""The chat protocol (ASI:One) for the three specialist agents, in plain code.

Each specialist answers a chat with what it was created to do (its profile's first
section) and the last thing it said in a round, so a judge who finds Inventory, Flow
or Clinical Workflow on Agentverse sees a working agent rather than a dead end. It
never starts a round (only the Coordinator does) and never reads the text with a
language model. Every chat in or out is relayed first (rule 10), like the
Coordinator's; acks aren't.
"""

import re
from datetime import datetime, timezone
from uuid import uuid4

from uagents import Agent, Context, Model, Protocol
from uagents_core.contrib.protocols.chat import ChatAcknowledgement, ChatMessage, TextContent, chat_protocol_spec

from pathlib import Path

from runtime import PROFILES
from tools import relay

CHAT_SESSION = "asi1-chat"  # the Coordinator's relay session for chat outside a round
COORDINATOR = "Hippocratech Coordinator (@hippocratech-coordinator)"

last_said: dict[str, str] = {}  # agent name → its last message in a round, in one line


def note(name: str, line: str) -> None:
    """Remember the last thing an agent said in a round, for its chat reply."""
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


def reply_text(name: str) -> str:
    said = last_said.get(name)
    tail = f" Last round, I said: \"{said}\"" if said else " I haven't spoken in a round yet."
    return (f"{intro(name)}{tail} I only talk to the Coordinator during a round. To start one, chat with "
            f"{COORDINATOR}: \"simulate ransomware from MRI 2\". Nothing here touches a real network, and "
            f"only humans sign off a plan.")


def make_chat(name: str, agent: Agent) -> Protocol:
    chat = Protocol(spec=chat_protocol_spec)

    async def send(ctx: Context, to: str, message: Model) -> None:
        status = await ctx.send_raw(
            destination=to,
            message_schema_digest=Model.build_schema_digest(message),
            message_body=message.model_dump_json(),
            protocol_digest=chat.digest,
        )
        if status.status.value not in ("delivered", "sent"):
            ctx.logger.error(f"chat reply to {to[:16]}… not delivered: {status.detail}")

    @chat.on_message(ChatMessage)
    async def on_chat(ctx: Context, sender: str, msg: ChatMessage):
        await send(ctx, sender, ChatAcknowledgement(acknowledged_msg_id=msg.msg_id))
        text = msg.text().strip()
        await relay.post(CHAT_SESSION, 0, "humans", name, "chat", {"text": text, "via": "asi1"}, direction="received")
        answer = reply_text(name)
        await relay.post(CHAT_SESSION, 0, name, "humans", "chat", {"text": answer, "via": "asi1"}, direction="sent")
        await send(ctx, sender, ChatMessage(timestamp=datetime.now(timezone.utc), msg_id=uuid4(),
                                            content=[TextContent(type="text", text=answer)]))

    @chat.on_message(ChatAcknowledgement)
    async def on_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
        pass

    return chat
