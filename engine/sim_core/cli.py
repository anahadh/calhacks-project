"""``hippo-sim`` command line: deterministic replay and sensitivity generation.

Only the result JSON is written to stdout; every diagnostic and validation error
goes to stderr with a nonzero exit. The ``replay`` subcommand has no seed — replay
is deterministic — and seeds live only on the separate ``sensitivity`` command.
Canonical Scenario/Campaign/Plan are parsed by their strict Pydantic models, so an
upload carrying an embedded ``campaign`` or ``expected`` block is rejected (extra
fields are forbidden), never silently stripped. The supplied CUH inventory dialect
is accepted only through ``load_cuh``. No transition is computed here; the CLI only
loads inputs, calls the engine, and serializes.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from pydantic import ValidationError

from . import cache as cache_mod
from .adapters import load_cuh
from .bundle import freeze_attack, load_bundle, replay_bundle
from .generator import GeneratorConfig, generate_trial
from .replay import compare_plan, replay
from .schema import Campaign, Plan, Scenario
from .serialize import comparison_bytes, result_bytes


def _load_scenario(path: str, fmt: str) -> Scenario:
    text = Path(path).read_text(encoding="utf-8")
    if fmt == "cuh":
        return load_cuh(path)
    if fmt == "canonical":
        return Scenario.model_validate_json(text)
    # auto: a canonical scenario declares scenario_id; otherwise treat as the
    # CUH inventory dialect, which load_cuh validates strictly on its own.
    data = json.loads(text)
    if isinstance(data, dict) and "scenario_id" in data:
        return Scenario.model_validate(data)
    return load_cuh(path)


def _emit(text: str, output: str | None) -> None:
    if output:
        Path(output).write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text + "\n")


def _cmd_replay(args: argparse.Namespace) -> None:
    if args.bundle:
        if args.compare:
            raise ValueError("--compare cannot be combined with --bundle")
        result = replay_bundle(load_bundle(args.bundle), verify=args.verify)
        _emit(result_bytes(result), args.output)
        return
    if not (args.scenario and args.campaign):
        raise ValueError("replay needs --scenario and --campaign (or --bundle)")
    scenario = _load_scenario(args.scenario, args.scenario_format)
    campaign = Campaign.model_validate_json(Path(args.campaign).read_text(encoding="utf-8"))
    plan = Plan.model_validate_json(Path(args.plan).read_text(encoding="utf-8")) if args.plan else Plan()
    if args.compare:
        if not args.plan:
            raise ValueError("--compare needs a --plan to compare against the no-lever baseline")
        _emit(comparison_bytes(compare_plan(scenario, campaign, plan)), args.output)
        return
    if args.cache_dir:
        result, _ = cache_mod.load_or_compute(args.cache_dir, scenario, campaign, plan)
    else:
        result = replay(scenario, campaign, plan)
    _emit(result_bytes(result), args.output)


def _cmd_freeze(args: argparse.Namespace) -> None:
    scenario = _load_scenario(args.scenario, args.scenario_format)
    campaign = Campaign.model_validate_json(Path(args.campaign).read_text(encoding="utf-8"))
    plan = Plan.model_validate_json(Path(args.plan).read_text(encoding="utf-8")) if args.plan else Plan()
    bundle = freeze_attack(scenario, campaign, plan)
    _emit(bundle.model_dump_json(indent=2), args.output)


def _cmd_sensitivity(args: argparse.Namespace) -> None:
    scenario = _load_scenario(args.scenario, args.scenario_format)
    plan = Plan.model_validate_json(Path(args.plan).read_text(encoding="utf-8")) if args.plan else Plan()
    config = GeneratorConfig(
        eol_workstation_min=args.eol_min,
        eol_workstation_max=args.eol_max,
        extra_allow_flows=args.extra_allow_flows,
    )
    trial = generate_trial(scenario, plan, args.seed, config)
    _emit(trial.model_dump_json(), args.output)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="hippo-sim", description="Deterministic propagation replay and sensitivity generation.")
    sub = parser.add_subparsers(dest="command", required=True)

    replay_cmd = sub.add_parser("replay", help="Replay a campaign against a scenario, or replay a frozen bundle.")
    replay_cmd.add_argument("--scenario", help="Scenario JSON (canonical or CUH dialect). Omit when using --bundle.")
    replay_cmd.add_argument("--campaign", help="Canonical Campaign JSON (never planner-visible). Omit when using --bundle.")
    replay_cmd.add_argument("--plan", help="Canonical Plan JSON. Defaults to the no-lever baseline.")
    replay_cmd.add_argument("--scenario-format", choices=["auto", "canonical", "cuh"], default="auto")
    replay_cmd.add_argument("--cache-dir", help="If set, serve from / store to this content-addressed cache.")
    replay_cmd.add_argument("--bundle", help="Replay a frozen attack bundle instead of raw inputs.")
    replay_cmd.add_argument("--verify", action="store_true", help="With --bundle: re-run the frozen inputs and confirm they reproduce the frozen result.")
    replay_cmd.add_argument("--compare", action="store_true", help="Emit the paired leave-one-lever-out comparison instead of one replay.")
    replay_cmd.add_argument("--output", help="Write JSON here instead of stdout.")
    replay_cmd.set_defaults(func=_cmd_replay)

    freeze_cmd = sub.add_parser("freeze", help="Freeze an attack (scenario+campaign+plan) into a deterministic, replayable bundle.")
    freeze_cmd.add_argument("--scenario", required=True)
    freeze_cmd.add_argument("--campaign", required=True)
    freeze_cmd.add_argument("--plan")
    freeze_cmd.add_argument("--scenario-format", choices=["auto", "canonical", "cuh"], default="auto")
    freeze_cmd.add_argument("--output", help="Write the bundle here instead of stdout.")
    freeze_cmd.set_defaults(func=_cmd_freeze)

    sens = sub.add_parser("sensitivity", help="Generate one synthetic-interior trial (seeds live here, never on replay).")
    sens.add_argument("--scenario", required=True)
    sens.add_argument("--plan")
    sens.add_argument("--scenario-format", choices=["auto", "canonical", "cuh"], default="auto")
    sens.add_argument("--seed", type=int, required=True, help="Seed for the sole synthetic-interior RNG.")
    sens.add_argument("--eol-min", type=float, default=0.45)
    sens.add_argument("--eol-max", type=float, default=0.55)
    sens.add_argument("--extra-allow-flows", type=int, default=0)
    sens.add_argument("--output")
    sens.set_defaults(func=_cmd_sensitivity)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    try:
        args.func(args)
    except (ValidationError, ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
