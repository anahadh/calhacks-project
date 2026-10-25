"""The agents' tools: test runs (hippo-sim), candidates (hippo-opt), and the relay.

No spread logic here (AGENTS.md rule 3): numbers come from hippo-sim, the CLI of
the Python engine in engine/ (HIPPO_SIM_BIN, e.g. engine/.venv/bin/hippo-sim), or,
with HIPPO_SIM_FIXTURES=1, from fixtures/results/, which scripts/refresh_fixtures.py
records from that same CLI. In fixture mode every relay line says "fixture": true.
"""

import fcntl
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from config import AGENTS_DIR, settings
from protocol import Candidate, Constraint, RunResult, Strict

FIXTURES = AGENTS_DIR / "fixtures"
SIM_TIMEOUT_S = 60
FIXTURE_PATIENT_ZERO = "mri_2"  # every file in fixtures/results/ is for this patient zero


class ToolError(RuntimeError):
    pass


# --- hippo-sim ---


def fixture_name(candidate_id: str | None, challenges: list[str]) -> str:
    """fixtures/results/<id or "baseline">.json, or <id>@<challenge+challenge>.json with challenges."""
    base = candidate_id or "baseline"
    return f"{base}@{'+'.join(sorted(challenges))}.json" if challenges else f"{base}.json"


_HOSPITAL: dict | None = None


def _hospital() -> dict:
    global _HOSPITAL
    if _HOSPITAL is None:
        _HOSPITAL = json.loads(settings().hospital_path.read_text())["hospital"]
    return _HOSPITAL


def run_sim(candidate: Candidate | None, patient_zero: str, seed: int, challenges: list[str] = ()) -> RunResult:
    """One test run. candidate None = baseline (no policy)."""
    s = settings()
    challenges = sorted(challenges)
    if s.hippo_sim_fixtures:
        if patient_zero != FIXTURE_PATIENT_ZERO:
            raise ToolError(f"fixture results exist only for an attack starting at MRI 2 ({FIXTURE_PATIENT_ZERO}); "
                            f"connect hippo-sim (HIPPO_SIM_BIN) to start from {patient_zero}")
        path = FIXTURES / "results" / fixture_name(candidate.id if candidate else None, challenges)
        if not path.exists():
            raise ToolError(f"HIPPO_SIM_FIXTURES=1 but there is no fixture {path.relative_to(AGENTS_DIR)}")
        return RunResult.parse_file(path)
    engine = os.environ.get("ENGINE_URL", "").strip().rstrip("/")
    if engine:
        # The engine server's /app/run_result: the same function as hippo-sim (the parity test keeps them equal),
        # without forking a process per run (forking beside uAgents' gRPC threads crashed runs with a signal).
        body = {"hospital": _hospital(), "patient_zero": patient_zero, "challenges": challenges}
        if candidate is not None:
            body["policy"] = json.loads(candidate.policy.json(exclude_none=True, by_alias=True))
        try:
            r = httpx.post(f"{engine}/app/run_result", json=body, timeout=SIM_TIMEOUT_S)
        except httpx.HTTPError as e:
            raise ToolError(f"the engine at {engine} failed to answer: {e}") from e
        if r.status_code != 200:
            raise ToolError(f"the engine answered HTTP {r.status_code}: {r.text[:300]}")
        try:
            return RunResult.parse_obj(r.json())
        except ValueError as e:
            raise ToolError(f"the engine sent something that is not a RunResult: {e}") from e
    if not s.hippo_sim_bin:
        raise ToolError("No simulator: set ENGINE_URL or HIPPO_SIM_BIN, or HIPPO_SIM_FIXTURES=1 for fixture results.")

    with tempfile.TemporaryDirectory() as tmp:
        cmd = [s.hippo_sim_bin, "--hospital", str(s.hospital_path), "--patient-zero", patient_zero, "--seed", str(seed)]
        if candidate is not None:
            policy_path = Path(tmp) / f"{candidate.id}.json"
            policy_path.write_text(candidate.policy.json(exclude_none=True))
            cmd += ["--policy", str(policy_path)]
        for c in challenges:
            cmd += ["--challenge", c]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=SIM_TIMEOUT_S)
        except (OSError, subprocess.TimeoutExpired) as e:
            raise ToolError(f"hippo-sim failed to run: {e}") from e
    if proc.returncode != 0:
        raise ToolError(f"hippo-sim exited {proc.returncode}: {proc.stderr.strip()[:500]}")
    try:
        return RunResult.parse_raw(proc.stdout)
    except ValueError as e:
        raise ToolError(f"hippo-sim printed something that is not a RunResult: {e}") from e


# --- hippo-opt ---


def optimize(hospital: dict, baseline: RunResult, constraints: list[Constraint]) -> list[Candidate]:
    """Candidate policies. `hospital` is the hospital object the caller chooses to share
    (Flow strips protected-flow information from it)."""
    s = settings()
    if not s.hippo_opt_bin:
        raise ToolError("HIPPO_OPT_BIN is unset (the Flow Agent builds candidates itself; see logic/candidates.py)")

    with tempfile.TemporaryDirectory() as tmp:
        paths = {}
        for name, obj in (
            ("hospital", {"schemaVersion": 1, "hospital": hospital}),
            ("baseline", json.loads(baseline.json())),
            ("constraints", [json.loads(c.json()) for c in constraints]),
        ):
            paths[name] = Path(tmp) / f"{name}.json"
            paths[name].write_text(json.dumps(obj))
        cmd = [s.hippo_opt_bin, "--hospital", str(paths["hospital"]), "--baseline", str(paths["baseline"]),
               "--constraints", str(paths["constraints"])]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=SIM_TIMEOUT_S)
        except (OSError, subprocess.TimeoutExpired) as e:
            raise ToolError(f"hippo-opt failed to run: {e}") from e
    if proc.returncode != 0:
        raise ToolError(f"hippo-opt exited {proc.returncode}: {proc.stderr.strip()[:500]}")
    try:
        return [Candidate.parse_obj(c) for c in json.loads(proc.stdout)]
    except ValueError as e:
        raise ToolError(f"hippo-opt printed something that is not a list of candidates: {e}") from e


# --- relay ---

COLORS = {
    "inventory": "\033[36m", "flow": "\033[35m", "clinical_workflow": "\033[34m",
    "coordinator": "\033[33m", "humans": "\033[32m", "relay": "\033[37m",
}
RESET, DIM, BOLD = "\033[0m", "\033[2m", "\033[1m"


def summary(type: str, p: dict) -> str:
    """One readable line for a message payload (the agent_message row's payload)."""
    def cons(cs):
        return ", ".join(f"{c['kind']}{c['targetIds']}" + (f"≤{c['limit']}" if c.get("limit") else "") for c in cs) or "none"

    def numbers(r):
        return f"infected {r['infectedCount']}, patients ok {r['patientCounts']['ok']}, protected broken {r['protectedBroken'] or 'none'}"

    if type == "proposal_request":
        what = f"revise {p['revise']}" if p.get("revise") else "propose"
        return f"round {p['round']}: {what}; constraints: {cons(p['constraints'])}"
    if type == "proposal":
        return f"{p['policyId']} '{p['name']}' ({p['strategy']}), {len(p['rules'])} rules; removes {p['testResult']['removedFlows']}; {numbers(p['testResult'])}"
    if type == "revision":
        d = p["diff"]
        return f"{p['policyId']}: +{[r['id'] for r in d['added']]} −{d['removed']}; removes {p['testResult']['removedFlows']}; {numbers(p['testResult'])}"
    if type == "verdict":
        c = p.get("constraint")
        return f"{p['decision'].upper()} {p['policyId']} (round {p['round']})" + (f" with {c['kind']}{c['targetIds']}" if c else "")
    if type == "question":
        return f"{p['id']} about {p['targetId']}; answerable by {p['allowedRoles']}"
    if type == "answer":
        return f"{p['author']} ({p['role']}) answers {p['questionId']}: {p['choice']}"
    if type == "recommendation":
        return (f"'{p['policy']['name']}', {len(p['policy']['rules'])} rules; {numbers(p['testResult'])}; "
                f"required roles {p['requiredRoles']}")
    if type == "chat":
        text = " ".join(p["text"].split())
        return f"“{text[:150]}{'…' if len(text) > 150 else ''}”"
    if type == "round_state":
        return f"round {p['round']}: {p['state']}" + (f" ({p['detail']})" if p.get("detail") else "")
    return json.dumps(p)[:200]


class Relay:
    """Writes agent_message and agent_status rows (spec: Data Model).

    With WATCHER_RELAY_URL set, POSTs each row to <url>/agent_message or <url>/agent_status
    with `Authorization: Bearer $RELAY_TOKEN`. Otherwise appends it to
    <RELAY_LOG_DIR>/<sessionId>.jsonl (with a "table" field) and prints sent messages.

    Rows carry fields beyond the spec's tables: "direction" (sent or received; rule 10
    has both ends post, so every message appears twice), "fixture" (true when results
    come from fixtures/results/, so the UI can label the run) and "reasonSource"
    ("claude", "asi1" or "template": who wrote "reason", rule 14).
    """

    async def post(
        self, sessionId: str, round: int, from_: str, to: str, type: str, payload: Strict | dict,
        reason: str | None = None, direction: str = "sent", reason_source: str | None = None,
    ) -> dict:
        body = payload if isinstance(payload, dict) else json.loads(payload.json())
        row = {
            "sessionId": sessionId, "round": round, "seq": None, "from": from_, "to": to, "type": type,
            "payload": body, "reason": reason, "reasonSource": reason_source, "createdAt": _now(), "direction": direction,
            "fixture": settings().hippo_sim_fixtures,
        }
        return await self._write("agent_message", row)

    async def status(self, sessionId: str, agent: str, status: str) -> dict:
        assert status in ("idle", "thinking", "speaking", "waiting"), status
        row = {"sessionId": sessionId, "agent": agent, "status": status, "updatedAt": _now(),
               "fixture": settings().hippo_sim_fixtures}
        return await self._write("agent_status", row)

    async def _write(self, table: str, row: dict) -> dict:
        s = settings()
        print(f"[relay] {table} -> {s.relay_url or 'file ' + str(s.log_dir)}: {row.get('type') or row.get('status')}", flush=True)
        if s.relay_url:
            if table == "agent_message":
                row.pop("seq")  # the reducer assigns it
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(f"{s.relay_url.rstrip('/')}/{table}", json=row,
                                         headers={"Authorization": f"Bearer {s.relay_token}"})
            if resp.status_code >= 300:
                print(f"[relay] REJECTED {table}: HTTP {resp.status_code} {resp.text[:200]}", flush=True)
                raise ToolError(f"relay rejected {table} row: HTTP {resp.status_code} {resp.text[:200]}")
            return row
        _append(s.log_dir / f"{row['sessionId']}.jsonl", table, row)
        if table == "agent_message" and (row["direction"] == "sent" or row["from"] == "humans"):
            print(_line(row), flush=True)
        return row


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def _append(path: Path, table: str, row: dict) -> None:
    """Append one line. Four processes share the file, so seq is assigned under a lock."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a+", encoding="utf-8") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            if table == "agent_message":
                f.seek(0)
                row["seq"] = 1 + sum(1 for line in f if '"table": "agent_message"' in line)
            f.seek(0, os.SEEK_END)
            f.write(json.dumps({"table": table, **row}) + "\n")
            f.flush()
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)


def _line(row: dict) -> str:
    color = COLORS.get(row["from"], "") if sys.stdout.isatty() or os.environ.get("FORCE_COLOR") else ""
    reset = RESET if color else ""
    fixture = " [fixture]" if row["fixture"] else ""
    said = f"\n{'':>44}“{row['reason']}” ({row['reasonSource']})" if row.get("reason") and row.get("reasonSource") else ""
    return (f"{color}{BOLD if color else ''}#{row['seq']:<3} {row['from']:>17} → {row['to']:<17}{reset}{color} "
            f"{row['type']:<16} {summary(row['type'], row['payload'])}{fixture}{said}{reset}")


relay = Relay()
