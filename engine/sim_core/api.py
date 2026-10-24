"""FastAPI transport: a POST that replays-and-caches and a WebSocket that streams.

No function here computes a transition. POST ``/replay`` validates strict request
objects (or server-owned identifiers), runs the blocking replay in a worker thread,
caches the complete result and returns its exact canonical bytes with the cache key.
WebSocket ``/replay/{cache_key}/trace`` streams the *already computed* cached result
— meta, every trace entry, every service frame, every event effect, then a final
message with levels and summary — enough for a client to reconstruct the identical
``ReplayResult``. Invalid-data errors (413/422/404) are kept distinct from rule
blockers, which are ordinary 200 results whose trace entries have status "blocked".

Importing this module needs the ``api`` extra (``uv sync`` installs it in dev):
    uv run uvicorn sim_core.api:app
"""

from __future__ import annotations

import os
from pathlib import Path

from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import ValidationError

from . import RULES_VERSION, cache
from .adapters import load_cuh
from .app_bridge import run_session
from .planner import PlannerBoundaryError, planner_scenario_payload
from .schema import Campaign, Plan, Scenario, StrictModel
from .serialize import CONTENT_TYPE, result_bytes

DEFAULT_MAX_BODY_BYTES = 4_000_000
DEFAULT_MAX_NODES = 5_000
DEFAULT_MAX_EVENTS = 10_000
DEFAULT_ALLOW_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]


def _demo_registry() -> tuple[dict[str, Scenario], dict[str, Campaign]]:
    """Best-effort CUH demo for the browser UI; absent files just leave it empty."""
    try:
        root = Path(__file__).resolve().parents[2]
        scenario = load_cuh(root / "claude_instructions" / "data" / "scenarios" / "cuh_hospital.json")
        campaign = Campaign.model_validate_json((root / "engine" / "examples" / "cuh_campaign.json").read_text(encoding="utf-8"))
        return {"cuh": scenario}, {"cuh-campaign": campaign}
    except (OSError, ValidationError, ValueError):
        return {}, {}


class ReplayRequest(StrictModel):
    """Distinct strict objects, or server-owned identifiers, never mixed."""

    scenario: Scenario | None = None
    campaign: Campaign | None = None
    plan: Plan | None = None
    scenario_id: str | None = None
    campaign_id: str | None = None


class AppRunRequest(StrictModel):
    """A live run over the app's hospital format (devices/flows/services/patients)."""

    hospital: dict
    patient_zero: str


class _ClientError(Exception):
    def __init__(self, status: int, detail: str) -> None:
        self.status = status
        self.detail = detail


def _error(status: int, kind: str, detail: object) -> JSONResponse:
    # A transport/validation error; distinct from an in-result rule blocker.
    return JSONResponse(status_code=status, content={"error": {"type": kind, "detail": detail}})


def create_app(
    cache_dir: Path | str | None = None,
    *,
    scenarios: dict[str, Scenario] | None = None,
    campaigns: dict[str, Campaign] | None = None,
    demo: bool = False,
    allow_origins: list[str] | None = None,
    max_body_bytes: int = DEFAULT_MAX_BODY_BYTES,
    max_nodes: int = DEFAULT_MAX_NODES,
    max_events: int = DEFAULT_MAX_EVENTS,
) -> FastAPI:
    cache_dir = Path(cache_dir or os.environ.get("HIPPO_CACHE_DIR", ".hippo_cache"))
    scenarios = dict(scenarios or {})
    campaigns = dict(campaigns or {})
    if demo:
        demo_scenarios, demo_campaigns = _demo_registry()
        scenarios = {**demo_scenarios, **scenarios}
        campaigns = {**demo_campaigns, **campaigns}
    app = FastAPI(title="hippo-backtest replay", version=RULES_VERSION)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins or DEFAULT_ALLOW_ORIGINS,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    def _resolve(request: ReplayRequest) -> tuple[Scenario, Campaign, Plan]:
        if (request.scenario is None) == (request.scenario_id is None):
            raise _ClientError(422, "provide exactly one of 'scenario' or 'scenario_id'")
        if (request.campaign is None) == (request.campaign_id is None):
            raise _ClientError(422, "provide exactly one of 'campaign' or 'campaign_id'")
        scenario = request.scenario if request.scenario is not None else scenarios.get(request.scenario_id or "")
        if scenario is None:
            raise _ClientError(404, f"unknown scenario_id: {request.scenario_id}")
        campaign = request.campaign if request.campaign is not None else campaigns.get(request.campaign_id or "")
        if campaign is None:
            raise _ClientError(404, f"unknown campaign_id: {request.campaign_id}")
        return scenario, campaign, request.plan or Plan()

    @app.get("/healthz")
    async def healthz() -> dict:
        return {"status": "ok", "rules_version": RULES_VERSION}

    @app.get("/planner/scenario/{scenario_id}")
    async def planner_scenario(scenario_id: str):
        scenario = scenarios.get(scenario_id)
        if scenario is None:
            return _error(404, "unknown_scenario", scenario_id)
        # Only the canonical scenario and the Plan schema; never the campaign.
        return JSONResponse(planner_scenario_payload(scenario))

    @app.post("/replay")
    async def post_replay(request: Request):
        raw = await request.body()
        if len(raw) > max_body_bytes:
            return _error(413, "body_too_large", f"request body exceeds {max_body_bytes} bytes")
        try:
            parsed = ReplayRequest.model_validate_json(raw)
        except ValidationError as exc:
            # Reduce to plainly JSON-serializable fields (ctx can hold exceptions).
            detail = [{"loc": list(err["loc"]), "msg": err["msg"], "type": err["type"]} for err in exc.errors(include_url=False)]
            return _error(422, "invalid_request", detail)
        except (ValueError, PlannerBoundaryError) as exc:
            return _error(422, "invalid_request", str(exc))
        try:
            scenario, campaign, plan = _resolve(parsed)
        except _ClientError as exc:
            return _error(exc.status, "resolution", exc.detail)
        if len(scenario.nodes) > max_nodes:
            return _error(413, "too_many_nodes", f"{len(scenario.nodes)} > {max_nodes}")
        if len(campaign.events) > max_events:
            return _error(413, "too_many_events", f"{len(campaign.events)} > {max_events}")
        try:
            result, cached = await run_in_threadpool(cache.load_or_compute, cache_dir, scenario, campaign, plan)
        except (ValueError, ValidationError) as exc:
            # An input that parsed but violates a causal invariant (e.g. a campaign
            # naming an unknown host) is still bad data, not a rule blocker.
            return _error(422, "invalid_causal_input", str(exc))
        return Response(
            content=result_bytes(result),
            media_type=CONTENT_TYPE,
            headers={"X-Cache-Key": result.cache_key, "X-Cache": "hit" if cached else "miss"},
        )

    @app.post("/app/run")
    async def app_run(request: Request):
        # Live run over the app's hospital format, returning the UI's sim rows
        # (devices/services/patients + a per-tick attempts/events/snapshots timeline).
        raw = await request.body()
        if len(raw) > max_body_bytes:
            return _error(413, "body_too_large", f"request body exceeds {max_body_bytes} bytes")
        try:
            parsed = AppRunRequest.model_validate_json(raw)
        except ValidationError as exc:
            return _error(422, "invalid_request", [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors(include_url=False)])
        devices = parsed.hospital.get("devices") if isinstance(parsed.hospital, dict) else None
        if not isinstance(devices, list) or not devices:
            return _error(422, "invalid_hospital", "hospital must have a non-empty devices list")
        if len(devices) > max_nodes:
            return _error(413, "too_many_nodes", f"{len(devices)} > {max_nodes}")
        try:
            session = await run_in_threadpool(run_session, parsed.hospital, parsed.patient_zero)
        except (ValueError, KeyError, TypeError) as exc:
            return _error(422, "invalid_app_input", str(exc))
        return JSONResponse(session)

    @app.websocket("/replay/{cache_key}/trace")
    async def stream_trace(websocket: WebSocket, cache_key: str) -> None:
        await websocket.accept()
        try:
            try:
                cache.cache_path(cache_dir, cache_key)  # validates the key shape
            except ValueError:
                await websocket.send_json({"kind": "error", "detail": "invalid cache key"})
                await websocket.close(code=4400)
                return
            result = await run_in_threadpool(cache.load, cache_dir, cache_key)
            if result is None:
                await websocket.send_json({"kind": "error", "detail": "no cached replay for this key"})
                await websocket.close(code=4404)
                return
            await websocket.send_json({
                "kind": "meta",
                "cache_key": result.cache_key,
                "rules_version": RULES_VERSION,
                "counts": {"trace": len(result.trace), "services": len(result.services), "event_effects": len(result.event_effects)},
            })
            for index, entry in enumerate(result.trace):
                await websocket.send_json({"kind": "trace", "index": index, "entry": entry.model_dump(mode="json")})
            for index, frame in enumerate(result.services):
                await websocket.send_json({"kind": "service_frame", "index": index, "frame": frame.model_dump(mode="json")})
            for index, effect in enumerate(result.event_effects):
                await websocket.send_json({"kind": "event_effect", "index": index, "effect": effect.model_dump(mode="json")})
            await websocket.send_json({"kind": "summary", "cache_key": result.cache_key, "levels": result.levels, "summary": result.summary})
            await websocket.close()
        except WebSocketDisconnect:
            return

    return app


app = create_app(demo=True)
