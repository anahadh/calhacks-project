"""Apply the agents' Policy to an app hospital: the engine's edge to the uAgents.

The agents describe a segmentation plan as allow rules over zones, device types,
roles, VLANs, protocols and ports (``agents/protocol.py`` ``Policy``;
HOSPITAL_SCHEMA.md "Policy"). The engine reasons over links, not rules, so this
module decides which flows are active (a challenge can switch some on), which the
policy keeps, and which it removes, and hands ``app_bridge`` a hospital that holds
only the active, kept flows. Removed and broken protected flows are engine output
(AGENTS.md rule 3): the visible rerun and the agents' test runs share this function.

The keep rule is a line-for-line port of the retired sim-core ``policy.ts``
(``keptFlowIds``, ``protectedBroken``). Challenge activation mirrors sim-core's
``extraActiveFlowIds`` and ``agents/logic/inventory.py`` ``device_flows``. Pure: no
clock, no randomness, no I/O; output order is hospital file order.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Annotated, Literal, NamedTuple

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

SUPPORTED_CHALLENGES = ("unknown_device_imaging",)

DeviceType = Literal[
    "mri", "ct", "workstation", "nurse_station", "patient_monitor",
    "infusion_pump", "server_rack", "pharmacy_cabinet", "lab_analyzer",
    "anesthesia_machine", "badge_reader", "hvac", "unknown",
]
ServerRole = Literal["pacs", "ehr_engine", "file_server", "domain_controller", "other"]
FlowProtocol = Literal["smb", "rdp", "http", "https", "dicom", "hl7", "other"]
Strategy = Literal["least_disruption", "max_containment", "protect_critical_care", "fastest_deploy"]
NonEmpty = Annotated[str, Field(min_length=1)]


class PolicyError(ValueError):
    """A policy or challenge the engine cannot apply (transports: 422 ``invalid_policy``)."""


class _Strict(BaseModel):
    # Mirrors agents/protocol.py Strict: unknown fields are rejected, "from" is an alias.
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class AppSelector(_Strict):
    """Any subset of zone, deviceType, role, vlan. Empty matches every device."""

    zone: NonEmpty | None = None
    deviceType: DeviceType | None = None
    role: ServerRole | None = None
    vlan: Annotated[int, Field(ge=1, le=4094)] | None = None


class AppPolicyRule(_Strict):
    id: NonEmpty
    from_: AppSelector = Field(alias="from")
    to: AppSelector
    protocol: FlowProtocol | None = None  # omitted = any
    port: Annotated[int, Field(ge=1, le=65535)] | None = None  # omitted = any
    plain: NonEmpty


class AppPolicy(_Strict):
    """The agents' Policy, validated locally so the engine never imports agent code."""

    strategy: Strategy
    name: NonEmpty
    rules: Annotated[list[AppPolicyRule], Field(max_length=40)]
    rationale: str
    tradeoff: str

    @model_validator(mode="after")
    def _fastest_deploy_selects_by_vlan_and_port(self) -> "AppPolicy":
        # Same check as agents/protocol.py: existing ACLs express only vlan and port.
        if self.strategy != "fastest_deploy":
            return self
        for rule in self.rules:
            for side in (rule.from_, rule.to):
                if side.zone is not None or side.deviceType is not None or side.role is not None:
                    raise ValueError(f"rule {rule.id}: fastest_deploy rules may select only by vlan and port")
            if rule.protocol is not None:
                raise ValueError(f"rule {rule.id}: fastest_deploy rules may select only by vlan and port")
        return self


class AppliedPolicy(NamedTuple):
    hospital: dict  # the hospital with only active, kept flows
    removed_flows: list[str]  # active flows the policy removed, in hospital file order
    protected_broken: list[str]  # removed ∩ protected, in file order


def parse_policy(policy: dict) -> AppPolicy:
    """Strictly parse a by-alias Policy dict, or raise PolicyError with one readable line."""
    try:
        return AppPolicy.model_validate(policy)
    except ValidationError as exc:
        problems = "; ".join(f"{'.'.join(str(p) for p in err['loc']) or 'policy'}: {err['msg']}" for err in exc.errors(include_url=False))
        raise PolicyError(f"invalid policy: {problems}") from None


def _check_selectors(hospital: dict, policy: AppPolicy) -> None:
    # HOSPITAL_SCHEMA.md "Policy": naming a zone, type, role or VLAN the hospital
    # does not have is a validation error, not a rule that silently matches nothing.
    present = {
        "zone": {room.get("zone") for room in hospital.get("rooms", [])},
        "deviceType": {device.get("type") for device in hospital["devices"]},
        "role": {device.get("role") for device in hospital["devices"]},
        "vlan": {device.get("vlan") for device in hospital["devices"]},
    }
    for rule in policy.rules:
        for side in (rule.from_, rule.to):
            for field in ("zone", "deviceType", "role", "vlan"):
                value = getattr(side, field)
                if value is not None and value not in present[field]:
                    raise PolicyError(f"unknown {field} '{value}' in rule {rule.id}")


def _matches(selector: AppSelector, device: dict, zone_of: dict[str, str]) -> bool:
    if selector.zone is not None and zone_of.get(device.get("roomId"), "") != selector.zone:
        return False
    if selector.deviceType is not None and device.get("type") != selector.deviceType:
        return False
    if selector.role is not None and device.get("role") != selector.role:
        return False
    if selector.vlan is not None and device.get("vlan") != selector.vlan:
        return False
    return True


def kept_flow_ids(hospital: dict, flows: list[dict], policy: AppPolicy | None) -> set[str]:
    """Flow ids a policy keeps: those at least one rule matches on source, destination,
    protocol and port. No policy keeps every flow. (sim-core policy.ts keptFlowIds.)"""
    if policy is None:
        return {flow["id"] for flow in flows}
    device = {d["id"]: d for d in hospital["devices"]}
    zone_of = {room["id"]: room.get("zone", "") for room in hospital.get("rooms", [])}
    kept: set[str] = set()
    for flow in flows:
        src, dst = device.get(flow["from"]), device.get(flow["to"])
        if src is None or dst is None:
            continue
        if any(
            (rule.protocol is None or rule.protocol == flow.get("protocol"))
            and (rule.port is None or rule.port == flow.get("port"))
            and _matches(rule.from_, src, zone_of)
            and _matches(rule.to, dst, zone_of)
            for rule in policy.rules
        ):
            kept.add(flow["id"])
    return kept


def active_flows(hospital: dict, challenges: Sequence[str] = ()) -> list[dict]:
    """Flows on the network, in file order: ``active is not False``, plus, under
    ``unknown_device_imaging``, the inactive flows that touch an ``unknown``-type device."""
    unsupported = [c for c in challenges if c not in SUPPORTED_CHALLENGES]
    if unsupported:
        raise PolicyError(f"unsupported challenge '{unsupported[0]}'; the engine supports: {', '.join(SUPPORTED_CHALLENGES)}")
    unknown = {d["id"] for d in hospital["devices"] if d.get("type") == "unknown"} if "unknown_device_imaging" in challenges else set()
    return [f for f in hospital["flows"] if f.get("active") is not False or f["from"] in unknown or f["to"] in unknown]


def apply_policy(hospital: dict, policy: dict | None = None, challenges: Sequence[str] = ()) -> AppliedPolicy:
    """The hospital the engine runs on under ``policy`` and ``challenges``.

    Raises PolicyError (a ValueError) for a malformed policy, a selector naming
    something the hospital lacks, or an unsupported challenge.
    """
    parsed = None
    if policy is not None:
        parsed = parse_policy(policy)
        _check_selectors(hospital, parsed)
    active = active_flows(hospital, challenges)
    kept = kept_flow_ids(hospital, active, parsed)
    removed = [f["id"] for f in active if f["id"] not in kept]
    protected = [f["id"] for f in active if f["id"] not in kept and f.get("protected")]
    applied = {**hospital, "flows": [f for f in active if f["id"] in kept]}
    return AppliedPolicy(applied, removed, protected)


__all__ = [
    "SUPPORTED_CHALLENGES", "AppPolicy", "AppPolicyRule", "AppSelector", "AppliedPolicy", "PolicyError",
    "active_flows", "apply_policy", "kept_flow_ids", "parse_policy",
]
