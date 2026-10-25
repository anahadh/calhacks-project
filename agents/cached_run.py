"""The cached demo round: the one exception to "no faking a sponsor" (AGENTS.md rule 14).

A real standalone round (agents running with WATCHER_RELAY_URL unset, the real engine,
a real model) writes agents/logs/<sessionId>.jsonl. record() turns that log into
agents/cache/demo_round.json; labeled() turns the cache into relay rows for a target
session, each one marked "Cached run" with only fields the watcher relay already
accepts (apps/watcher/src/relay.ts). scripts/record_round.py and scripts/replay_cached.py
are thin wrappers; scripts/demo_check.py uses validate().

Nothing here is ever generated: a cache can only come from record() on a real log.
"""

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

AGENTS_DIR = Path(__file__).parent
CACHE_PATH = AGENTS_DIR / "cache" / "demo_round.json"
FORMAT = 1
LABEL = "Cached run"
REASON_PREFIX = f"{LABEL} · "

# The relay's agent_message and agent_status rows (relay.ts AgentMessageRow, AgentStatusRow, both strict).
MESSAGE_FIELDS = ("sessionId", "round", "from", "to", "type", "payload", "reason", "reasonSource", "createdAt",
                  "direction", "fixture")
STATUS_FIELDS = ("sessionId", "agent", "status", "updatedAt", "fixture")
# Message types whose text a model writes (protocol.py TEXT_FIELDS): each needs its reason and source.
WORDED = ("proposal", "revision", "verdict", "question", "recommendation")
MODEL_SOURCES = ("claude", "asi1")
# Payloads the relay parses strictly on sent rows (relay.ts QuestionPayload, RoundStatePayload,
# RecommendationPayload): no "cached" key there. Every other payload is z.record and takes it.
STRICT_PAYLOADS = ("question", "round_state", "recommendation")


class CacheError(ValueError):
    pass


def _time(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def _git_commit() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"], cwd=AGENTS_DIR, capture_output=True, text=True,
                              check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def read_log(path: Path) -> list[dict]:
    rows = []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise CacheError(f"{path.name} line {n} is not JSON: {e}") from e
    return rows


def record(log_rows: list[dict], engine: str, recorded_at: str | None = None, commit: str | None = None) -> dict:
    """The cache for one real round. Refuses fixture rows, worded messages without a model's
    text, and logs that don't hold one finished round."""
    if not log_rows:
        raise CacheError("the log is empty")
    problems = []
    for n, r in enumerate(log_rows, 1):
        if r.get("fixture") is not False:
            problems.append(f"row {n} has fixture={r.get('fixture')!r}: a cached run must come from the real engine")
        if r.get("table") == "agent_message" and r.get("direction") == "sent" and r.get("type") in WORDED:
            if not r.get("reason"):
                problems.append(f"row {n} ({r.get('type')} from {r.get('from')}) has no reason")
            if r.get("reasonSource") not in MODEL_SOURCES:
                problems.append(f"row {n} ({r.get('type')} from {r.get('from')}) has reasonSource "
                                f"{r.get('reasonSource')!r}, not one of {', '.join(MODEL_SOURCES)}")
    if problems:
        raise CacheError("refusing to record this log:\n  " + "\n  ".join(problems[:20]))

    sessions = {r.get("sessionId") for r in log_rows}
    if len(sessions) != 1:
        raise CacheError(f"the log mixes sessions: {sorted(map(str, sessions))}")
    session_id = sessions.pop()

    kept, last_status = [], {}
    for r in log_rows:
        if r.get("table") == "agent_message" and r.get("direction") == "sent":
            kept.append(("agent_message", r, r["createdAt"], {k: r[k] for k in MESSAGE_FIELDS}))
        elif r.get("table") == "agent_status" and last_status.get(r["agent"]) != r["status"]:
            last_status[r["agent"]] = r["status"]
            kept.append(("agent_status", r, r["updatedAt"], {k: r[k] for k in STATUS_FIELDS}))

    messages = [row for table, _, _, row in kept if table == "agent_message"]
    done = [m for m in messages if m["type"] == "round_state" and m["payload"].get("state") == "done"]
    if not done:
        raise CacheError("the log has no finished round (no round_state 'done'): record a whole round")
    requests = [m for m in messages if m["type"] == "proposal_request"]
    if not requests:
        raise CacheError("the log has no proposal_request: was the round started with scripts/start_round.py?")

    start = _time(kept[0][2])
    rows = [{"table": table, "offsetMs": round((_time(t) - start).total_seconds() * 1000), "row": row}
            for table, _, t, row in kept]
    if any(b["offsetMs"] < a["offsetMs"] for a, b in zip(rows, rows[1:])):
        raise CacheError("the log's timestamps go backwards: is it one round, in file order?")
    return {
        "format": FORMAT,
        "label": LABEL,
        "recordedAt": recorded_at or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sourceSessionId": session_id,
        "patientZero": requests[0]["payload"].get("patientZero"),
        "engine": engine,
        "modelSources": sorted({m["reasonSource"] for m in messages if m.get("reasonSource")}),
        "gitCommit": commit or _git_commit(),
        "rowCount": len(rows),
        "rows": rows,
    }


def validate(cache: dict) -> None:
    """A cache file as record() writes it, or CacheError."""
    for key in ("format", "label", "recordedAt", "sourceSessionId", "patientZero", "engine", "modelSources",
                "gitCommit", "rowCount", "rows"):
        if key not in cache:
            raise CacheError(f"the cache has no {key!r}")
    if cache["format"] != FORMAT or cache["label"] != LABEL:
        raise CacheError(f"unknown cache format {cache['format']!r} / label {cache['label']!r}")
    if cache["rowCount"] != len(cache["rows"]) or not cache["rows"]:
        raise CacheError(f"rowCount {cache['rowCount']} but {len(cache['rows'])} rows")
    if not set(cache["modelSources"]) <= set(MODEL_SOURCES) or not cache["modelSources"]:
        raise CacheError(f"modelSources {cache['modelSources']!r} must name the real model(s)")
    fields = {"agent_message": MESSAGE_FIELDS, "agent_status": STATUS_FIELDS}
    last = -1
    for n, r in enumerate(cache["rows"], 1):
        if r.get("table") not in fields or set(r.get("row", {})) != set(fields[r["table"]]):
            raise CacheError(f"cached row {n} isn't an agent_message or agent_status row")
        if r["row"]["fixture"] is not False:
            raise CacheError(f"cached row {n} is a fixture row")
        if not isinstance(r.get("offsetMs"), int) or r["offsetMs"] < last:
            raise CacheError(f"cached row {n} has a bad offsetMs")
        last = r["offsetMs"]
    if not any(r["row"].get("type") == "round_state" and r["row"]["payload"].get("state") == "done"
               for r in cache["rows"] if r["table"] == "agent_message"):
        raise CacheError("the cache has no finished round")


def load(path: Path = CACHE_PATH) -> dict:
    if not path.exists():
        raise CacheError(f"no cached run at {path}: record one on a laptop (docs/hippocratech/CACHED_RUN.md)")
    try:
        cache = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise CacheError(f"{path} is not JSON: {e}") from e
    validate(cache)
    return cache


def _resession(value, old: str, new: str):
    """Every "sessionId": <old> inside a payload (a recommendation's verdicts carry one too)."""
    if isinstance(value, dict):
        return {k: (new if k == "sessionId" and v == old else _resession(v, old, new)) for k, v in value.items()}
    if isinstance(value, list):
        return [_resession(v, old, new) for v in value]
    return value


def label_message(row: dict, old_session: str, session_id: str, created_at: str, recorded_date: str) -> dict:
    """One cached agent_message row for the target session, marked "Cached run" with fields the relay accepts."""
    out = {**row, "sessionId": session_id, "createdAt": created_at,
           "payload": _resession(row["payload"], old_session, session_id)}
    if out["reason"]:
        out["reason"] = REASON_PREFIX + out["reason"]
    if out["type"] == "round_state":
        detail = out["payload"].get("detail")
        head = f"{LABEL} (recorded {recorded_date})"
        out["payload"] = {**out["payload"], "detail": f"{head}: {detail}" if detail else head}
    if out["type"] not in STRICT_PAYLOADS:
        out["payload"] = {**out["payload"], "cached": True}
    return out


def label_status(row: dict, session_id: str, updated_at: str) -> dict:
    """agent_status rows are strict and have no free field: they can't carry the label."""
    return {**row, "sessionId": session_id, "updatedAt": updated_at}


def is_labeled(table: str, row: dict) -> bool:
    """The check replay and the tests share: every replayed agent_message row says it's cached."""
    if table != "agent_message":
        return True
    if row["reason"] is not None and not row["reason"].startswith(REASON_PREFIX):
        return False
    if row["type"] == "round_state" and not str(row["payload"].get("detail", "")).startswith(f"{LABEL} (recorded "):
        return False
    if row["type"] not in STRICT_PAYLOADS and row["payload"].get("cached") is not True:
        return False
    return row["reason"] is not None or row["type"] == "round_state" or row["payload"].get("cached") is True
