"""Scorekeeper (uAgent, SCOREKEEPER=1 only): explains how the plans rank. Decides nothing.

Receives the Coordinator's fire-and-forget ScoreInput copies and replies with a Scorecard
(logic.scorekeeper). It never sends a Verdict, a Constraint or a Question, and the
Coordinator never routes a Scorecard into a round decision (AGENTS.md rule 8). No model:
the Scorecard's `why` and every chat reply are templates over the inputs' numbers.

Every message in or out is relayed first (rule 10), like every other agent's. An error is
logged and the agent goes idle; it never stops the round, since the round doesn't need it.
"""

from uagents import Context, Protocol
from uagents_core.contrib.protocols.chat import ChatAcknowledgement, ChatMessage, TextContent, chat_protocol_spec

import agent_chat
from config import settings
from logic import hospital as hospital_mod
from logic import scorekeeper as logic
from protocol import ScoreInput, Scorecard
from runtime import make_agent, received, send
from tools import ToolError, relay

NAME = "scorekeeper"
agent, protocol = make_agent(NAME)
H = hospital_mod.load(settings().hospital_path)
cards: dict[str, Scorecard] = {}  # session → its latest Scorecard
last_session: list[str] = []


async def score(ctx: Context, sender: str, msg: ScoreInput) -> Scorecard | None:
    try:
        who = await received(NAME, sender, "score_input", msg)
        if who != "coordinator":
            raise ValueError(f"score_input from {who}; only the Coordinator sends copies")
        card = logic.scorecard(msg.sessionId, list(msg.candidates), H)
        cards[msg.sessionId] = card
        last_session[:] = [msg.sessionId]
        await send(ctx, NAME, "coordinator", "scorecard", card)
        agent_chat.note(NAME, card.why)
        return card
    except Exception as e:  # the round goes on without us; show the error in the log
        ctx.logger.error(f"Scorekeeper: {type(e).__name__}: {e}")
        return None
    finally:
        try:
            await relay.status(msg.sessionId, NAME, "idle")
        except ToolError as e:
            ctx.logger.error(f"relay failed: {e}")


@protocol.on_message(ScoreInput)
async def on_score_input(ctx: Context, sender: str, msg: ScoreInput):
    await score(ctx, sender, msg)


# --- chat (ASI:One): templates only, no model ---

chat_protocol = Protocol(spec=chat_protocol_spec)


def chat_answer(text: str) -> str:
    return logic.chat_reply(text, cards.get(last_session[0]) if last_session else None)


@chat_protocol.on_message(ChatMessage)
async def on_chat(ctx: Context, sender: str, msg: ChatMessage):
    await agent_chat.send_chat(ctx, sender, ChatAcknowledgement(acknowledged_msg_id=msg.msg_id))
    text = msg.text().strip()
    if not text:
        return
    session = agent_chat.CHAT_SESSION
    await relay.post(session, 0, "humans", NAME, "chat", {"text": text, "via": "template"}, direction="received")
    answer = chat_answer(text)
    await relay.post(session, 0, NAME, "humans", "chat", {"text": answer, "via": "template"}, direction="sent")
    await agent_chat.send_chat(ctx, sender, ChatMessage(content=[TextContent(text=answer)]))


@chat_protocol.on_message(ChatAcknowledgement)
async def on_chat_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


agent.include(protocol)
agent.include(chat_protocol, publish_manifest=settings().mailbox or not settings().local_resolve)

if __name__ == "__main__":
    agent.run()
