"""A read-only index over a hospital file (HOSPITAL_SCHEMA.md)."""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from protocol import RunResult

DEFAULT_PATH = Path(__file__).parent.parent / "fixtures" / "hospital.json"

Row = dict[str, Any]


@dataclass(frozen=True)
class HospitalIndex:
    devices: dict[str, Row]
    rooms: dict[str, Row]
    flows: dict[str, Row]
    services: dict[str, Row]
    flows_by_device: dict[str, tuple[Row, ...]]  # active flows only, sorted by flow id

    def room_type(self, device_id: str) -> str:
        return self.rooms[self.devices[device_id]["roomId"]]["type"]

    def zone(self, device_id: str) -> str:
        return self.rooms[self.devices[device_id]["roomId"]]["zone"]

    def endpoints(self, flow_ids: Iterable[str]) -> set[str]:
        """Device ids at either end of the given flows."""
        out: set[str] = set()
        for fid in flow_ids:
            flow = self.flows[fid]
            out.update((flow["from"], flow["to"]))
        return out

    def touched(self, result: RunResult) -> set[str]:
        """The devices a policy touches: endpoints of the flows it removed."""
        return self.endpoints(result.removedFlows)


def index(hospital: Row) -> HospitalIndex:
    """Build the index from the `hospital` object of a hospital file."""
    flows = {f["id"]: f for f in hospital["flows"]}
    by_device: dict[str, list[Row]] = {d["id"]: [] for d in hospital["devices"]}
    for fid in sorted(flows):
        flow = flows[fid]
        if flow.get("active", True):  # inactive flows exist only for a challenge
            by_device[flow["from"]].append(flow)
            by_device[flow["to"]].append(flow)
    return HospitalIndex(
        devices={d["id"]: d for d in hospital["devices"]},
        rooms={r["id"]: r for r in hospital["rooms"]},
        flows=flows,
        services={s["id"]: s for s in hospital["services"]},
        flows_by_device={k: tuple(v) for k, v in by_device.items()},
    )


def load(path: Path | str = DEFAULT_PATH) -> HospitalIndex:
    """Load a hospital file. Defaults to fixtures/hospital.json until data/hospitals/demo.json exists."""
    return index(json.loads(Path(path).read_text())["hospital"])
