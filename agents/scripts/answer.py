"""POST /resume to the Coordinator: a human answers an open question, the way the
answer watcher will.

    .venv/bin/python scripts/answer.py --choice workstation        # the latest open question in session dev
    .venv/bin/python scripts/answer.py --question q-r1-dev_unknown_7 --choice workstation --role clinical_engineering

Without --question, it reads the session's log (RELAY_LOG_DIR/<session>.jsonl) for the
latest question sent to humans that has no answer yet.
"""

import argparse
import json
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import PORTS, settings  # noqa: E402


def latest_open_question(session: str) -> dict | None:
    path = settings().log_dir / f"{session}.jsonl"
    if not path.exists():
        return None
    asked, answered = {}, set()
    for line in path.read_text().splitlines():
        row = json.loads(line)
        if row.get("table") != "agent_message":
            continue
        if row["type"] == "question" and row["to"] == "humans":
            asked[row["payload"]["id"]] = row["payload"]
        elif row["type"] == "answer":
            answered.add(row["payload"]["questionId"])
    open_ = [q for qid, q in asked.items() if qid not in answered]
    return open_[-1] if open_ else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--session", default="dev")
    ap.add_argument("--question")
    ap.add_argument("--choice", required=True)
    ap.add_argument("--role", default="clinical_engineering")
    ap.add_argument("--author", default="Dev")
    a = ap.parse_args()
    qid = a.question
    if qid is None:
        q = latest_open_question(a.session)
        if q is None:
            print(f"no open question in session {a.session}", file=sys.stderr)
            return 1
        qid = q["id"]
        print(f"open question {qid} about {q['targetId']} (answerable by {q['allowedRoles']})")
    body = {"sessionId": a.session, "questionId": qid, "choice": a.choice, "author": a.author, "role": a.role}
    r = httpx.post(f"http://127.0.0.1:{PORTS['coordinator']}/resume", json=body, timeout=60)
    print(f"POST /resume {json.dumps(body)}\n→ HTTP {r.status_code} {r.text}")
    return 0 if r.status_code == 200 and r.json().get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
