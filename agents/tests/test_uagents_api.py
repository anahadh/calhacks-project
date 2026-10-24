"""Checks the uAgents APIs that AGENT_NOTES.md documents, against the installed
package. Nothing here touches the network.

The REST tests call the agent's ASGI server directly, the same way uAgents' own
tests/test_rest.py does (private API, so it may need updating on upgrades).
"""

import json
from unittest.mock import AsyncMock, patch

from uagents import Agent, Context, Protocol
from uagents.crypto import Identity
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    TextContent,
    chat_protocol_spec,
)

import protocol as p

SEED = "hippocratech test seed, not a real one"


def test_address_is_derived_from_seed():
    agent = Agent(name="coordinator_test", seed=SEED)
    assert agent.address == Identity.from_seed(SEED, 0).address
    assert agent.address.startswith("agent1q")
    # Same seed, same address: this is why each uAgent gets a fixed seed.
    assert Agent(name="other_name", seed=SEED).address == agent.address


def test_mailbox_agent_constructs_offline():
    agent = Agent(name="mailbox_test", seed=SEED + " mailbox", port=8101, mailbox=True)
    assert agent.mailbox_client is not None


def _post(agent: Agent, path: str, body: dict) -> tuple[int, dict]:
    send = AsyncMock()
    with patch("uagents.asgi._read_asgi_body", return_value=json.dumps(body).encode()):
        # Agent() binds to the current event loop at construction, so run on
        # that loop; asyncio.run() would close it and break later Agent() calls.
        agent._loop.run_until_complete(
            agent._server(
                scope={"type": "http", "method": "POST", "path": path, "client": ("127.0.0.1", 1)},
                receive=None,
                send=send,
            )
        )
    start, payload = (c.args[0] for c in send.call_args_list)
    return start["status"], json.loads(payload["body"])


def test_rest_post_validates_with_strict_models():
    agent = Agent(name="rest_test", seed=SEED + " rest", port=8102)
    seen = []

    @agent.on_rest_post("/start_round", p.StartRound, p.RestAck)
    async def start_round(ctx: Context, req: p.StartRound) -> p.RestAck:
        seen.append(req)
        return p.RestAck(ok=True, detail=f"round started for {req.runId}")

    ok = {"sessionId": "demo", "runId": "run_baseline", "patientZero": "mri_2", "seed": 1337, "challenges": []}
    assert _post(agent, "/start_round", ok) == (200, {"ok": True, "detail": "round started for run_baseline"})
    assert seen == [p.StartRound(**ok)]

    status, err = _post(agent, "/start_round", {**ok, "extra": 1})
    assert status == 400 and err["type"] == "value_error.extra"
    assert len(seen) == 1  # the handler never ran


def test_chat_protocol_includes():
    agent = Agent(name="chat_test", seed=SEED + " chat", port=8103)
    chat = Protocol(spec=chat_protocol_spec)

    @chat.on_message(ChatMessage)
    async def on_chat(ctx: Context, sender: str, msg: ChatMessage):
        await ctx.send(sender, ChatAcknowledgement(acknowledged_msg_id=msg.msg_id))
        await ctx.send(sender, ChatMessage(content=[TextContent(text=f"You said: {msg.text()}")]))

    @chat.on_message(ChatAcknowledgement)
    async def on_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
        pass

    agent.include(chat, publish_manifest=True)
    assert chat.digest in agent.protocols
    assert ChatMessage(content=[TextContent(text="hi")]).text() == "hi"
