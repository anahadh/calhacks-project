"""Test helper (never used at runtime): a fake ASI:One user. A real uAgent that sends
chat-protocol messages to the Coordinator and writes everything it gets back, one JSON
line each, to --out. The Coordinator reaches it through LOCAL_PEERS.

    python tests/chat_sender.py --out replies.jsonl --text "hello" --text "simulate ransomware from MRI 2"
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from uagents import Context, Protocol  # noqa: E402
from uagents.resolver import RulesBasedResolver  # noqa: E402
from uagents_core.contrib.protocols.chat import (  # noqa: E402
    ChatAcknowledgement,
    ChatMessage,
    TextContent,
    chat_protocol_spec,
)

import addresses  # noqa: E402
import runtime  # noqa: E402

SEED = "live test seed for the chat sender"
PORT = int(os.environ.get("CHAT_SENDER_PORT", "8010"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--text", action="append", required=True)
    a = ap.parse_args()
    out = Path(a.out)
    coordinator = addresses.address("coordinator")

    agent = runtime.LocalAgent(
        name="chat-sender", seed=SEED, port=PORT, endpoint=[f"http://127.0.0.1:{PORT}/submit"],
        resolve=RulesBasedResolver({coordinator: addresses.endpoint("coordinator")}),
        registration_policy=runtime.NoRegistration(), report_events=False, mark_inactive_on_shutdown=False,
    )
    chat = Protocol(spec=chat_protocol_spec)

    def write(row):
        with out.open("a") as f:
            f.write(json.dumps(row) + "\n")

    @chat.on_message(ChatMessage)
    async def on_message(ctx: Context, sender: str, msg: ChatMessage):
        cards = [json.loads(c.metadata["card_payload"]) for c in msg.content if getattr(c, "type", "") == "metadata"]
        write({"type": "chat", "from_coordinator": sender == coordinator, "text": msg.text(), "cards": cards})
        await ctx.send(sender, ChatAcknowledgement(acknowledged_msg_id=msg.msg_id))

    @chat.on_message(ChatAcknowledgement)
    async def on_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
        write({"type": "ack", "from_coordinator": sender == coordinator, "acknowledged": str(msg.acknowledged_msg_id)})

    @agent.on_event("startup")
    async def send_all(ctx: Context):
        for text in a.text:
            msg = ChatMessage(content=[TextContent(text=text)])
            status = await ctx.send(coordinator, msg)
            write({"type": "sent", "text": text, "msg_id": str(msg.msg_id), "status": status.status.value})
            await asyncio.sleep(0.5)

    agent.include(chat)
    agent.run()


if __name__ == "__main__":
    main()
