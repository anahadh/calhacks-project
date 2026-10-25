"""cards.py: the two ASI:One cards, built in code. Allowed primitives only, nesting depth <= 8,
payload under 64 KB, no forbidden words, every number from the round's messages. No network."""

import json

import cards
from llm import FORBIDDEN
from logic import hospital as hospital_mod
from protocol import Policy, Recommendation, RunResult
from tests_paths import FIXTURES

H = hospital_mod.load()
ALLOWED = {"section", "group", "divider", "text", "heading", "image", "badge", "button", "input", "list", "choice_grid"}
base = RunResult.parse_file(FIXTURES / "results" / "baseline.json")
res = RunResult.parse_file(FIXTURES / "results" / "cand_isolate_imaging.json")
policy = Policy.parse_obj(json.loads((FIXTURES / "candidates" / "cand_isolate_imaging.json").read_text())["policy"])
rec = Recommendation(policy=policy, testResult=res, verdicts=[], explanation="It holds the attack to imaging.",
                     requiredRoles=["security", "clinical_engineering"])


def payload(msg):
    meta = next(c.metadata for c in msg.content if c.type == "metadata")
    return meta, json.loads(meta["card_payload"])["root"]


def walk(node):
    yield node
    for k in node.get("children", []):
        yield from walk(k)
    for i in node.get("items", []):
        for k in i.get("children", []):
            yield from walk(k)


def test_picker_has_at_most_six_rows_and_is_interactive():
    on = ["mri_2", "ct_1", "srv_pacs", "srv_file", "ws_er_1", "ns_icu", "ws_er_2", "mri_1"]
    m = cards.picker_card(H, on, "Pick one.")
    meta, root = payload(m)
    items = next(n for n in walk(root) if n["type"] == "list")["items"]
    assert len(items) == 6
    assert all(i["action"]["selection"]["action"] == "simulate" and i["action"]["selection"]["device"] in on for i in items)
    assert meta["requires_card_interaction"] == "true" and "is_terminal" not in meta
    assert cards.depth(root) <= 8 and all(n["type"] in ALLOWED for n in walk(root))
    assert m.text() == "Pick one."


def test_picker_with_few_devices_shows_them_all():
    _, root = payload(cards.picker_card(H, ["mri_1", "ct_1"], "Pick."))
    assert len(next(n for n in walk(root) if n["type"] == "list")["items"]) == 2


def test_recommendation_card_has_four_numbers_roles_and_room_link():
    m = cards.recommendation_card(H, "chat-1", rec, base, "http://x/room/chat-1", "Done.")
    meta, root = payload(m)
    s = json.dumps(root)
    for n in (base.infectedCount, res.infectedCount, cards.affected(base), cards.affected(res)):
        assert str(n) in s
    assert "Security" in s and "Clinical engineering" in s and "http://x/room/chat-1" not in s
    assert "approved" not in s.lower() and not FORBIDDEN.search(s)
    assert meta["requires_card_interaction"] == "true" and meta["is_terminal"] == "true"
    assert len(meta["card_payload"]) < 64 * 1024 and cards.depth(root) <= 8
    assert all(n["type"] in ALLOWED for n in walk(root))


def test_recommendation_card_without_a_baseline_shows_after_only():
    _, root = payload(cards.recommendation_card(H, "chat-1", rec, None, "http://x/room/chat-1", "Done."))
    assert "→" not in json.dumps(root) and str(res.infectedCount) in json.dumps(root)


def test_deleted_cards_are_gone():
    for name in ("help_card", "devices_card", "protected_card", "device_card", "started_card",
                 "summary_card", "lanes", "lanes_list", "plan_block", "traffic_line"):
        assert not hasattr(cards, name), name


def test_trace_card_shows_each_agent_state_and_the_lines():
    lines = ["Baseline: 9 devices infected over 9 ticks. Asking @hippocratech-flow for a plan…",
             "[ @hippocratech-coordinator ] asked @hippocratech-flow for a plan (round 1).",
             '[ @hippocratech-flow · round 1 ] proposed "Isolate imaging": 3 devices infected with it, 9 without.',
             "[ @hippocratech-inventory · round 1 ] accepted.",
             "[ @hippocratech-clinical-workflow · round 1 ] rejected: it cuts imaging. Needs: keep MRI 2 → PACS."]
    m = cards.trace_card(H, "chat-1", "MRI 2", lines, 1, "running", "http://x/room/chat-1")
    meta, root = payload(m)
    s = json.dumps(root)
    for handle in ("@hippocratech-flow", "@hippocratech-inventory", "@hippocratech-clinical-workflow"):
        assert handle in s
    badges = [n for n in walk(root) if n["type"] == "badge"]
    assert {b["label"] for b in badges} >= {"accepted", "rejected", "proposed"}
    assert "Isolate imaging" in s and "http://x/room/chat-1" not in s
    assert meta["requires_card_interaction"] == "true" and meta["preferred_drawer_width_px"]
    assert cards.depth(root) <= 8 and all(n["type"] in ALLOWED for n in walk(root))
    import narrate
    assert m.text() == narrate.render(lines)
    assert [n["value"] for n in walk(root) if n["type"] == "heading" and n["value"].startswith("Round")] == ["Round 1"]
    assert meta["is_terminal"] == "true"


def test_trace_card_keeps_only_the_last_lines_and_stays_small():
    lines = [f"[ @hippocratech-flow · round {i} ] proposed \"plan {i}\": 3 devices infected with it, 9 without." for i in range(200)]
    m = cards.trace_card(H, "chat-1", "MRI 2", lines, 6, "running", "http://x/room/chat-1")
    meta, root = payload(m)
    assert len(meta["card_payload"]) < 64 * 1024
    assert "plan 199" in json.dumps(root) and "plan 0\"" not in json.dumps(root)


def test_every_card_passes_the_documented_schema():
    """ASI:One drops a card that fails validation and shows plain text instead, so every
    card is checked against the element-tree schema before it is sent."""
    import pytest
    lines = ["[ @hippocratech-flow · round 1 ] proposed \"x\": 3 devices infected with it, 9 without.",
             "[ @hippocratech-clinical-workflow · round 1 ] rejected: no. Needs: keep a flow.",
             "[ @hippocratech-inventory · round 2 ] asking a human to confirm Thing."]
    for m in (cards.picker_card(H, ["mri_2", "ct_1"], "Pick."),
              cards.recommendation_card(H, "s", rec, base, "http://x", "Done."),
              cards.trace_card(H, "s", "MRI 2", lines, 2, "waiting_for_human", "http://x")):
        cards.validate(payload(m)[1])  # raises on a bad node
    with pytest.raises(ValueError, match="variant"):
        cards.validate({"type": "badge", "label": "x", "variant": "danger"})
    with pytest.raises(ValueError, match="level"):
        cards.validate({"type": "heading", "value": "x", "level": 4})
    with pytest.raises(ValueError, match="style"):
        cards.validate({"type": "text", "value": "x", "style": "bold"})
    with pytest.raises(ValueError, match="type"):
        cards.validate({"type": "table"})


def test_agents_are_tappable_on_both_cards():
    """Tapping an agent lane or a trace row asks that agent to explain itself (an `ask`
    selection the Coordinator answers through ask_agent); the recommendation card offers
    the same three asks as buttons. No card links out of ASI:One."""
    lines = ['[ @hippocratech-flow · round 1 ] proposed "x": 3 devices infected with it, 9 without.',
             "[ @hippocratech-coordinator ] asked @hippocratech-flow for a plan (round 1).",
             "[ @hippocratech-clinical-workflow · round 1 ] rejected: no. Needs: keep a flow."]
    _, root = payload(cards.trace_card(H, "s", "MRI 2", lines, 1, "running", "http://x/room/s"))
    asks = [n["action"]["selection"] for n in walk_items(root) if n.get("action")]
    assert {"action": "ask", "source": "hippocratech", "agent": "flow", "about": ""} in asks
    row = next(a for a in asks if a["agent"] == "clinical_workflow" and a["about"])
    assert row["about"].startswith("[ @hippocratech-clinical-workflow · round 1 ] rejected")
    assert not any(a["agent"] == "coordinator" for a in asks)  # the Coordinator's own handoffs are not tappable
    _, root = payload(cards.recommendation_card(H, "s", rec, base, "http://x/room/s", "Done."))
    buttons = [n for n in walk(root) if n["type"] == "button"]
    assert [b["action"]["selection"]["agent"] for b in buttons] == ["flow", "inventory", "clinical_workflow"]
    assert not any("url" in b["action"]["selection"] for b in buttons)


def walk_items(node):
    for n in walk(node):
        for i in n.get("items", []):
            yield i


def test_recommendation_card_can_carry_the_chart_image():
    _, root = payload(cards.recommendation_card(H, "s", rec, base, "http://x", "Done.", chart="https://img.example/c.png"))
    imgs = [n for n in walk(root) if n["type"] == "image"]
    assert imgs and imgs[0]["src"] == "https://img.example/c.png" and imgs[0]["alt"]
    _, root = payload(cards.recommendation_card(H, "s", rec, base, "http://x", "Done.", chart="data:image/png;base64,AAAA"))
    assert not [n for n in walk(root) if n["type"] == "image"]  # data URIs make ASI:One drop the card


def test_trace_card_hides_coordinator_handoffs_but_keeps_mcp():
    lines = ["[ @hippocratech-coordinator ] MCP hospital.test_run(mri_2) → 9 devices infected over 9 ticks.",
             "[ @hippocratech-coordinator ] asked @hippocratech-flow for a plan (round 1).",
             "[ @hippocratech-inventory · round 1 ] accepted."]
    _, root = payload(cards.trace_card(H, "s", "MRI 2", lines, 1, "running", "http://x"))
    s = json.dumps(root)
    assert "asked @hippocratech-flow" not in s and "MCP" in s and "accepted" in s


def test_floor_tiles_draw_every_room_with_native_elements():
    tiles = cards.floor_tiles(H)
    s = json.dumps(tiles)
    for r in H.rooms.values():
        assert r["name"] in s
    cards.validate(tiles)
    hit = json.dumps(cards.floor_tiles(H, infected={"mri_2", "srv_pacs"}))
    assert "infected" in hit and '"variant": "warning"' in hit
    both = json.dumps(cards.floor_tiles(H, infected={"mri_2", "srv_pacs"}, after={"mri_2"}), ensure_ascii=False)
    assert "→" in both


def test_hospital_and_recommendation_cards_carry_the_floor():
    _, root = payload(cards.hospital_card(H, ["mri_2", "ct_1"], None, "Here."))
    assert "Emergency" in json.dumps(root)
    _, root = payload(cards.recommendation_card(H, "s", rec, base, "http://x", "Done."))
    assert "Imaging" in json.dumps(root) and "→" in json.dumps(root, ensure_ascii=False)


def test_result_is_a_detail_card_with_hero_rows_and_ask_buttons():
    m = cards.result_card(H, rec, base, "https://img/x.png", "Done.")
    meta = next(c.metadata for c in m.content if c.type == "metadata")
    p = json.loads(meta["card_payload"])
    assert meta["card_kind"] == "detail" and p["title"] == rec.policy.name and p["hero_image"] == "https://img/x.png"
    rows = {r["label"]: r["value"] for r in p["summary_rows"]}
    assert rows["Devices infected"] == f"{base.infectedCount} → {res.infectedCount}" and "Must sign off" in rows
    assert [c["selection"]["agent"] for c in p["ctas"]] == ["flow", "inventory", "clinical_workflow"]
    assert "hero_image" not in json.loads(next(c.metadata for c in cards.result_card(H, rec, base, None, "x").content if c.type == "metadata")["card_payload"])


def test_roster_is_a_carousel_of_the_four_agents():
    lines = ['[ @hippocratech-flow · round 2 ] revised the plan, now "X": ok.', "[ @hippocratech-inventory · round 2 ] accepted.",
             "[ @hippocratech-clinical-workflow · round 1 ] rejected: no.", "[ @hippocratech-clinical-workflow · round 2 ] accepted."]
    m = cards.roster_card(lines, "https://img/chart.png", "The agents.")
    meta = next(c.metadata for c in m.content if c.type == "metadata")
    p = json.loads(meta["card_payload"])
    assert meta["card_kind"] == "carousel" and len(p["items"]) == 4
    flow = p["items"][0]
    assert flow["title"] == "Flow" and flow["image"] == "https://img/chart.png" and flow["primary_cta"]["selection"]["agent"] == "flow"
    assert p["items"][2]["badges"][0]["label"] == "accepted"


def test_progress_card_is_compact_one_row_per_agent_with_its_latest_move():
    lines = ['[ @hippocratech-flow · round 2 ] revised the plan, now "X": I cut SMB. 5 devices infected with it, 9 without.',
             "[ @hippocratech-inventory · round 2 ] rejected: too many rules. Needs: fewer rules.",
             "[ @hippocratech-clinical-workflow · round 2 ] accepted."]
    m = cards.progress_card(lines, 2, "MRI 2", 9)
    meta = next(c.metadata for c in m.content if c.type == "metadata")
    p = json.loads(meta["card_payload"])
    assert meta["card_kind"] == "carousel" and [i["title"] for i in p["items"]] == ["Flow", "Inventory", "Clinical Workflow"]
    assert p["items"][1]["badges"][0]["label"] == "rejected" and "too many rules" in p["items"][1]["secondary_text"]
    assert "Round 2" in p["title"] and len(m.text()) < 400
