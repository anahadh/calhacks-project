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


def test_hospital_map_is_a_small_png_and_marks_infection():
    from logic import hospital as hospital_mod
    h = hospital_mod.load()
    plain = viz.hospital_map(h, "Bayview General")
    hit = viz.hospital_map(h, "Attack from MRI 2", infected={"mri_2", "srv_pacs"}, patient_zero="mri_2")
    assert plain[:4] == b"\x89PNG" and hit[:4] == b"\x89PNG" and plain != hit
    assert len(plain) < 30_000 and len(hit) < 30_000


def test_before_after_fits_in_a_card_with_the_chart():
    from logic import hospital as hospital_mod
    h = hospital_mod.load()
    pair = viz.before_after(h, "mri_2", {"mri_2", "srv_pacs", "srv_file", "ws_lab_1"}, {"mri_2"})
    chart = viz.negotiation_chart("MRI 2", 9, ROWS)
    assert len(viz.data_uri(pair)) + len(viz.data_uri(chart)) < 60_000


def test_floor_urls_point_at_the_hosted_image_route(monkeypatch):
    monkeypatch.delenv("IMAGE_BASE_URL", raising=False)
    assert viz.floor_url() == "https://hippocratech.vercel.app/api/floor"
    u = viz.floor_url(start="mri_2", infected={"srv_pacs", "mri_2"}, after={"mri_2"})
    assert u.startswith("https://hippocratech.vercel.app/api/floor?") and "start=mri_2" in u
    assert "infected=mri_2%2Csrv_pacs" in u and "after=mri_2" in u
    monkeypatch.setenv("IMAGE_BASE_URL", "https://example.dev/")
    assert viz.floor_url().startswith("https://example.dev/api/floor")
