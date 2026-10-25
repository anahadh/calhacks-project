"""The hospital and the simulator as an MCP server (FastMCP, `mcp` 1.x), the way the
Innovation Lab's mcp-agents expose their tools. The agents list and call these tools
through an in-process MCP client session (as_brain_tools), so every tool call in the
log is a literal MCP call. Nothing here decides anything: lookups read the hospital
file, test_run calls the same run_sim the rounds use (rule 3).

`python mcp_server.py` serves it over stdio for debugging with any MCP client.
"""

import json
from typing import Any

from mcp.server.fastmcp import FastMCP
from mcp.shared.memory import create_connected_server_and_client_session

import brain
import chat
from config import settings
from logic import hospital as hospital_mod
from logic.inventory import device_flows, dormant
from protocol import Candidate, Policy
from tools import run_sim

mcp = FastMCP("hippocratech-hospital")
H = hospital_mod.load(settings().hospital_path)


def _flow(f: dict) -> dict:
    return {"id": f["id"], "from": chat_name(f["from"]), "to": chat_name(f["to"]), "protocol": f.get("protocol"),
            "port": f.get("port"), "protected": bool(f.get("protected")), "purpose": f.get("purpose", "")}


def chat_name(device_id: str) -> str:
    return H.devices[device_id]["name"] if device_id in H.devices else device_id


@mcp.tool()
async def list_devices() -> str:
    """List the hospital devices a simulated attack can start from.

    Call this when the user asks what devices exist, which machines are on the network,
    or where an attack could begin. Devices that are not on the network yet are left out.
    Returns a JSON list of {id, name, type, zone, room}.

    Example: "what devices are there?" → list_devices()
    """
    out = []
    for d in chat.devices_on_network(H):
        dev = H.devices[d]
        out.append({"id": d, "name": dev["name"], "type": dev["type"], "zone": H.zone(d),
                    "room": H.rooms[dev["roomId"]]["name"]})
    return json.dumps(out)


@mcp.tool()
async def lookup_device(query: str) -> str:
    """Look up one hospital device by name or id and describe it.

    Call this when the user names a device ("what is PACS?", "tell me about MRI 2",
    "ct1"). Names are matched loosely: case, spaces and small typos are ignored.

    Args:
        query: the device's name or id as the user wrote it, e.g. "MRI 2", "mri_2", "PACS".

    Returns JSON {id, name, type, zone, room, vlan, dormant, flows_in, flows_out} where
    each flow is {id, from, to, protocol, port, protected, purpose}, or {"error": ...}
    with the closest names when nothing matches.

    Example: "what is the file server?" → lookup_device(query="file server")
    """
    d = chat.resolve_device(H, query)
    if d is None:
        return json.dumps({"error": chat.unknown_device(H, query)})
    dev = H.devices[d]
    flows = device_flows(H, d)
    return json.dumps({
        "id": d, "name": dev["name"], "type": dev["type"], "zone": H.zone(d), "room": H.rooms[dev["roomId"]]["name"],
        "vlan": dev.get("vlan"), "dormant": dormant(H, d),
        "flows_in": [_flow(f) for f in flows if f["to"] == d],
        "flows_out": [_flow(f) for f in flows if f["from"] == d],
    })


@mcp.tool()
async def protected_flows() -> str:
    """List the protected clinical flows: connections no segmentation plan may cut.

    Call this when the user asks which flows are protected, what must keep working, or
    why the Clinical Workflow Agent rejects plans. Returns a JSON list of
    {id, from, to, protocol, port, protected, purpose}.

    Example: "which flows are protected?" → protected_flows()
    """
    return json.dumps([_flow(f) for fid, f in sorted(H.flows.items()) if f.get("protected") and f.get("active", True)])


@mcp.tool()
async def test_run(patient_zero: str, policy: dict[str, Any] | None = None, challenges: list[str] | None = None) -> str:
    """Run the simulated ransomware attack once and report the outcome.

    Call this to compare an attack start, or to test a segmentation policy, without
    starting a negotiation round. The same deterministic engine the agents use runs it.

    Args:
        patient_zero: the device id the attack starts from, e.g. "mri_2" (use lookup_device
            to turn a name into an id).
        policy: optional full policy object {strategy, name, rules, rationale, tradeoff} to
            test; omit it for the baseline with no policy.

    Returns the RunResult as JSON: ticks, infectedCount, infectedDevices, servicesDown,
    patientCounts {ok, delayed, disrupted, diverted}, protectedBroken, removedFlows; or
    {"error": ...} when the simulator cannot run this case.

    Example: "how bad is an attack from PACS?" → test_run(patient_zero="srv_pacs")
    """
    try:
        candidate = None
        if policy is not None:
            candidate = Candidate(id="chat_test", policy=Policy.parse_obj(policy))
        result = run_sim(candidate, patient_zero, chat.DEMO_SEED, list(challenges or []))
    except Exception as e:
        return json.dumps({"error": f"{e.__class__.__name__}: {e}"})
    return json.dumps(result.dict())


# --- the agents' side: tools listed and called over MCP ---


async def call(name: str, args: dict) -> Any:
    """One tools/call over an in-process MCP client session (used for the round's baseline)."""
    async with create_connected_server_and_client_session(mcp) as session:
        res = await session.call_tool(name, args)
    text = next((c.text for c in res.content if getattr(c, "type", None) == "text"), "")
    return {"error": text or f"MCP tool {name} failed"} if res.isError else _parse(text)


def _parse(text: str) -> Any:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"text": text}


async def as_brain_tools() -> list[brain.Tool]:
    """The server's tools as brain.Tools: `tools/list` for the schemas, and each call is a
    `tools/call` over a fresh in-process client session."""
    async with create_connected_server_and_client_session(mcp) as session:
        listed = (await session.list_tools()).tools

    def make(name: str):
        async def call(args: dict) -> Any:
            async with create_connected_server_and_client_session(mcp) as session:
                res = await session.call_tool(name, args)
            text = next((c.text for c in res.content if getattr(c, "type", None) == "text"), "")
            if res.isError:
                return {"error": text or f"MCP tool {name} failed"}
            return _parse(text)
        return call

    return [brain.Tool(t.name, t.description or t.name, t.inputSchema or {"type": "object", "properties": {}}, make(t.name))
            for t in listed]


if __name__ == "__main__":
    mcp.run(transport="stdio")
