"""viz.py: the negotiation chart, a PNG small enough to inline in an ASI:One card."""

import viz


ROWS = [
    viz.Row(round=1, plan="Wall off imaging", infected=5, verdicts={"Inventory": "accept", "Clinical": "reject"}),
    viz.Row(round=2, plan="Critical Care Shield", infected=5, verdicts={"Inventory": "accept", "Clinical": "accept"}),
]


def test_chart_is_a_small_png():
    png = viz.negotiation_chart("MRI 2", 9, ROWS)
    assert png[:8] == b"\x89PNG\r\n\x1a\n" and len(png) < 40_000


def test_data_uri_and_many_rows_stay_small():
    rows = [viz.Row(round=i, plan=f"Plan {i} with a very long name that gets cut", infected=i % 9,
                    verdicts={"Inventory": "accept", "Clinical": "reject"}) for i in range(1, 9)]
    uri = viz.data_uri(viz.negotiation_chart("ICU nurse station", 12, rows))
    assert uri.startswith("data:image/png;base64,") and len(uri) < 60_000


def test_rows_from_round_events():
    import json
    from protocol import Proposal, RunResult, Verdict
    from tests_paths import FIXTURES
    res = RunResult.parse_file(FIXTURES / "results" / "cand_isolate_imaging.json")
    p = json.loads((FIXTURES / "candidates" / "cand_isolate_imaging.json").read_text())["policy"]
    fields = {k: p[k] for k in ("strategy", "name", "rules", "rationale", "tradeoff")}
    events = [("proposal", Proposal(sessionId="s", round=1, policyId="x", testResult=res, **fields)),
              ("verdict", Verdict(sessionId="s", round=1, policyId="x", agent="inventory", decision="accept", reason="ok")),
              ("verdict", Verdict(sessionId="s", round=1, policyId="x", agent="clinical_workflow", decision="reject", reason="no"))]
    rows = viz.rows_from_events(events)
    assert rows == [viz.Row(round=1, plan=p["name"], infected=res.infectedCount,
                            verdicts={"Inventory": "accept", "Clinical": "reject"})]
