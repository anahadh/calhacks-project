#!/usr/bin/env bash
# Start, stop, restart or inspect the local dev services (TEAM_BRIEF setup).
#
#   scripts/dev.sh restart            # restart everything
#   scripts/dev.sh restart watcher agents
#   scripts/dev.sh stop | start | status | logs [service]
#
# Services: stdb (3000), engine (8000), web (3001), watcher (8010 + ports 8001-8004 for the
# agents it talks to), agents (8001-8004). Each runs in the background with its output in
# .dev-logs/<service>.log. Processes are found by the port they listen on, so this also
# stops services started by hand.

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.local/bin:$PATH"  # spacetime lives here
LOGS="$ROOT/.dev-logs"
mkdir -p "$LOGS"
ALL="stdb engine web watcher agents"
WEB_PORT="${WEB_PORT:-3001}"

ports_of() {
  case "$1" in
    stdb) echo 3000 ;;
    engine) echo 8000 ;;
    web) echo "$WEB_PORT" ;;
    watcher) echo "${RELAY_PORT:-8010}" ;;
    agents) echo "8001 8002 8003 8004" ;;
    *) echo "unknown service: $1" >&2; exit 2 ;;
  esac
}

pids_of() {
  local pids=""
  for p in $(ports_of "$1"); do
    pids="$pids $(lsof -nP -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null)"
  done
  # run_all.py is the agents' parent and holds no port; stop it too or it keeps respawning output.
  if [ "$1" = agents ]; then pids="$pids $(pgrep -f 'python run_all.py' 2>/dev/null)"; fi
  if [ "$1" = watcher ]; then pids="$pids $(pgrep -f 'tsx src/index.ts' 2>/dev/null)"; fi
  echo $pids | tr ' ' '\n' | sort -u | tr '\n' ' '
}

stop_one() {
  local pids; pids="$(pids_of "$1")"
  if [ -z "${pids// /}" ]; then echo "  $1: not running"; return; fi
  kill $pids 2>/dev/null
  for _ in 1 2 3 4 5 6; do sleep 0.5; [ -z "$(pids_of "$1" | tr -d ' ')" ] && break; done
  pids="$(pids_of "$1")"; [ -n "${pids// /}" ] && kill -9 $pids 2>/dev/null
  echo "  $1: stopped"
}

start_one() {
  local running; running="$(pids_of "$1" | tr -d ' ')"
  if [ -n "$running" ]; then echo "  $1: already running (ports $(ports_of "$1"))"; return; fi
  local log="$LOGS/$1.log"; : > "$log"
  case "$1" in
    stdb)    (cd "$ROOT" && nohup spacetime start --listen-addr 127.0.0.1:3000 >>"$log" 2>&1 &) ;;
    engine)  (cd "$ROOT/engine" && nohup uv run uvicorn sim_core.api:app --host 127.0.0.1 --port 8000 >>"$log" 2>&1 &) ;;
    web)     (cd "$ROOT" && nohup npm run dev -w web -- -p "$WEB_PORT" >>"$log" 2>&1 &) ;;
    watcher) (cd "$ROOT" && nohup npm run dev -w watcher >>"$log" 2>&1 &) ;;
    agents)  (cd "$ROOT/agents" && nohup .venv/bin/python run_all.py >>"$log" 2>&1 &) ;;
  esac
  echo "  $1: starting (ports $(ports_of "$1")), log $log"
}

wait_up() {
  for s in "$@"; do
    for _ in $(seq 1 40); do
      local missing=0
      for p in $(ports_of "$s"); do lsof -nP -tiTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 || missing=1; done
      [ $missing = 0 ] && break
      sleep 0.5
    done
  done
}

status() {
  for s in $ALL; do
    local pids; pids="$(pids_of "$s" | tr -d ' ')"
    if [ -n "$pids" ]; then printf "  %-8s up    ports %s\n" "$s" "$(ports_of "$s")"
    else printf "  %-8s down  ports %s\n" "$s" "$(ports_of "$s")"; fi
  done
}

cmd="${1:-status}"; shift || true
services="${*:-$ALL}"
case "$cmd" in
  stop)    echo "Stopping:"; for s in $services; do stop_one "$s"; done ;;
  start)   echo "Starting:"; for s in $services; do start_one "$s"; done; wait_up $services; echo; status ;;
  restart)
    echo "Stopping:"; for s in $services; do stop_one "$s"; done
    # Dependencies first: stdb before everything, engine before watcher, agents last (they need the relay).
    ordered=""; for s in $ALL; do case " $services " in *" $s "*) ordered="$ordered $s" ;; esac; done
    echo "Starting:"; for s in $ordered; do start_one "$s"; [ "$s" = stdb ] && wait_up stdb; [ "$s" = watcher ] && wait_up watcher; done
    wait_up $ordered; echo; status ;;
  status)  status ;;
  logs)    s="${1:-watcher}"; tail -n 60 -f "$LOGS/$s.log" ;;
  *) sed -n 2,12p "$0"; exit 2 ;;
esac
