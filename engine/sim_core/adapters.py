"""Strict inventory conversion, with every added causal fact disclosed.

This module has no campaign/ground-truth loader. Descriptive inventory metadata is
validated before being omitted from the causal schema; unknown fields fail rather
than disappearing. Incomplete snapshots need authored completions, not guesses
based on their expected outcomes.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import model_validator

from .schema import (
    Account,
    Assumption,
    Dependency,
    Domain,
    HostProfile,
    LeverId,
    Link,
    Node,
    Scenario,
    Service,
    StrictModel,
    Trust,
)


# These are reconstruction choices, not facts recovered from the attack replay.
_EXTERNAL_DOMAIN_NODES = {"HSE": "HSE / NHN"}
_SERVICE_CONSUMERS = {
    "Emergency department": "WS-ED-1",
    "Radiology (X-ray, CT, MRI)": "MRI-1",
    "Radiotherapy": "LINAC-1",
    "Laboratory (GP bloods)": "ANL-HAEM",
    "Theatres & surgery": "WS-THR-1",
    "Outpatients & chemotherapy": "WS-ADM-4",
    "Pharmacy": "WS-PH-1",
    "Email & comms (HSE)": "WS-ADM-4",
}


class _RawMeta(StrictModel):
    name: str
    provenance: str
    note: str


class _RawDepartment(StrictModel):
    id: str
    name: str
    switch: str | None


class _RawHost(HostProfile):
    # Every supplied host field is required in this dialect. A missing profile
    # fact must not quietly become the canonical schema's convenient default.
    os_version: str
    end_of_life: bool
    domain_joined: bool
    endpoint_protection: Literal["none", "av_monitor_only", "av_block_commodity", "edr"]
    patch_state: dict[str, str]
    service_classes: list[str]
    vendor_managed: bool
    provenance: str


class _RawNode(StrictModel):
    id: str
    dept: str
    kind: str
    label: str
    os: str
    ip: str | None
    requires: list[str]
    external: bool = False
    windows: bool
    medical_device: bool = False
    internet_exposed: bool = False
    radiotherapy_chain: bool = False
    host: _RawHost


class _RawLink(StrictModel):
    a: str
    b: str
    layer: Literal["network"]


class _RawService(StrictModel):
    name: str
    requires_all: list[str]
    when_down: str
    paper_fallback: bool


class _RawDomain(Domain):
    provenance: str
    note: str | None = None


class _RawTrust(Trust):
    provenance: str
    note: str | None = None


class _RawAccount(Account):
    admin_to: list[str]
    sessions_on: list[str]
    provenance: str
    note: str | None = None


class _RawAVMode(StrictModel):
    servers: str
    workstations: str


class _RawPosture(StrictModel):
    provenance: str
    av_mode: _RawAVMode
    edr: bool
    mfa_remote_access: bool
    siem: bool
    unpatched_edge: dict[str, str]
    segmentation: Literal["flat"]
    network_note: str
    backups: str


class _RawLever(StrictModel):
    id: LeverId
    type: str
    effect: str


class _RawCUH(StrictModel):
    meta: _RawMeta
    departments: list[_RawDepartment]
    nodes: list[_RawNode]
    links: list[_RawLink]
    services: list[_RawService]
    snapshot_date: str
    domains: list[_RawDomain]
    trusts: list[_RawTrust]
    posture: _RawPosture
    levers: list[_RawLever]
    accounts: list[_RawAccount]

    @model_validator(mode="after")
    def inventory_references(self) -> "_RawCUH":
        departments = [dept.id for dept in self.departments]
        if len(departments) != len(set(departments)):
            raise ValueError("duplicate department IDs")
        nodes = {node.id for node in self.nodes}
        for node in self.nodes:
            if node.dept not in departments:
                raise ValueError(f"unknown department on {node.id}: {node.dept}")
        for department in self.departments:
            if department.switch is not None and department.switch not in nodes:
                raise ValueError(f"unknown department switch: {department.switch}")
        for gateway in self.posture.unpatched_edge:
            if gateway not in nodes:
                raise ValueError(f"unknown unpatched edge: {gateway}")
        lever_ids = [lever.id for lever in self.levers]
        if len(lever_ids) != len(set(lever_ids)):
            raise ValueError("duplicate lever IDs")
        return self


def _dependency_class(consumer: _RawNode, provider: _RawNode) -> str:
    if provider.kind == "dc":
        return "directory"
    return {"rad": "imaging", "rt": "oncology"}.get(consumer.dept, "app")


def load_cuh(path: Path | str) -> Scenario:
    """Load the supplied CUH inventory; never infer attack rights or history.

    This adapter deliberately accepts the CUH inventory dialect only. It does
    not turn incomplete HSE/BL metadata into a seemingly calibrated simulation.
    """
    raw = _RawCUH.model_validate(json.loads(Path(path).read_text(encoding="utf-8")))
    internal_domains = [domain.id for domain in raw.domains if not domain.external]
    if internal_domains != ["CUH"]:
        raise ValueError("CUH adapter requires exactly one internal domain, CUH")
    by_id = {node.id: node for node in raw.nodes}
    for domain_id, node_id in _EXTERNAL_DOMAIN_NODES.items():
        if domain_id not in {domain.id for domain in raw.domains} or node_id not in by_id:
            raise ValueError(f"missing declared external domain anchor: {domain_id} / {node_id}")
        if not by_id[node_id].external:
            raise ValueError(f"external domain anchor must be external: {node_id}")

    nodes = []
    for node in raw.nodes:
        domain = "CUH" if node.host.domain_joined else None
        org = "CUH"
        if node.external:
            if node.id == "Internet":
                org = "Internet"
            elif node.id in _EXTERNAL_DOMAIN_NODES.values():
                domain = next(key for key, value in _EXTERNAL_DOMAIN_NODES.items() if value == node.id)
                org = domain
            else:
                raise ValueError(f"no declared external organization mapping for {node.id}")
        dependencies = []
        for requirement in node.requires:
            if requirement not in by_id:
                raise ValueError(f"unknown dependency on {node.id}: {requirement}")
            dependencies.append(Dependency(provider=requirement, port_class=_dependency_class(node, by_id[requirement])))
        nodes.append(Node(
            id=node.id,
            dept=node.dept,
            org=org,
            domain=domain,
            kind=node.kind,
            host=HostProfile.model_validate(node.host.model_dump(exclude={"provenance"})),
            external=node.external,
            medical_device=node.medical_device,
            internet_exposed=node.internet_exposed,
            mail_client=node.kind in {"ws", "cow"},
            backup=node.id == "BACKUP-01",
            requires=dependencies,
        ))

    services = []
    for service in raw.services:
        if service.name not in _SERVICE_CONSUMERS:
            raise ValueError(f"service needs an explicit representative consumer: {service.name}")
        services.append(Service(
            name=service.name,
            requires_all=service.requires_all,
            paper_fallback=service.paper_fallback,
            consumers=[_SERVICE_CONSUMERS[service.name]],
        ))

    assumptions = [
        Assumption(id="cuh-domain-membership", provenance="S", statement="All domain-joined internal inventory nodes belong to the sole internal domain CUH; non-domain-joined nodes receive no inferred domain membership."),
        Assumption(id="cuh-external-domain-anchor", provenance="S", statement="The inventory node HSE / NHN represents the external domain HSE; Internet is its own external organization. This grants no attacker credentials or privileges."),
        Assumption(id="cuh-dependency-port-classes", provenance="S", statement="Dependencies on domain controllers use directory; other dependencies from rad consumers use imaging, from rt consumers use oncology, and from other consumers use app. These classes are reconstructed functional flows, not measured ports."),
        Assumption(id="cuh-service-representatives", provenance="S", statement="Each service additionally requires the following representative consumer: " + "; ".join(f"{name}: {consumer}" for name, consumer in _SERVICE_CONSUMERS.items()) + ". These are reconstructed workflow requirements, not reported incident outcomes."),
        Assumption(id="cuh-mail-clients", provenance="S", statement="Inventory kinds ws and cow are modeled as mail-using workstations. Their availability as mail clients does not imply that the attacker chooses or compromises them."),
        Assumption(id="cuh-backup-identity", provenance="S", statement="BACKUP-01 is the modeled backup store. No other server is inferred to be a backup."),
        Assumption(id="cuh-network-links", provenance="S", statement="Inventory network links are modeled as bidirectional connectivity supporting every port class before a plan or defender cut restricts them."),
    ]
    return Scenario(
        scenario_id="cuh_hospital",
        snapshot_date=raw.snapshot_date,
        nodes=nodes,
        links=[Link(a=link.a, b=link.b) for link in raw.links],
        domains=[Domain.model_validate(domain.model_dump(exclude={"provenance", "note"})) for domain in raw.domains],
        trusts=[Trust.model_validate(trust.model_dump(exclude={"provenance", "note"})) for trust in raw.trusts],
        accounts=[Account.model_validate(account.model_dump(exclude={"provenance", "note"})) for account in raw.accounts],
        services=services,
        levers=[lever.id for lever in raw.levers],
        mfa_remote_access=raw.posture.mfa_remote_access,
        assumptions=assumptions,
    )


def audit_raw_snapshot(data: dict[str, object]) -> list[str]:
    """List missing causal inputs without opening campaign or expected values.

    This is an evidence audit, not a completion policy or a validity verdict.
    It intentionally examines only inventory keys and their immediate fields.
    """
    gaps = []
    if "orgs" in data:
        gaps.append("Organization aggregates do not supply host inventory, account sessions, or privileged-account counts; host-level calibration requires explicit synthetic expansion.")
        gaps.append("A majority-protected organization cannot establish zero encrypted hosts; aggregate survivor and host-level coverage outcomes must be reported separately.")
    raw_nodes = data.get("nodes")
    if not isinstance(raw_nodes, list) or not raw_nodes:
        gaps.append("No host nodes are supplied.")
    else:
        nodes = [node for node in raw_nodes if isinstance(node, dict)]
        if len(nodes) != len(raw_nodes):
            gaps.append("Some host inventory entries are not objects.")
        if any("host" not in node for node in nodes):
            gaps.append("Some nodes lack host profiles; OS, domain membership, endpoint protection, service classes, and patch states need explicit evidence or assumptions.")
        if any(node.get("internet_exposed") is True and "host" not in node for node in nodes):
            gaps.append("Internet exposure alone does not specify an exploitable patch state or the credentials required for initial access.")
    if "links" not in data:
        gaps.append("No host connectivity links are supplied; flat or wide-access narrative metadata is not a host network graph.")
    if "domains" not in data:
        gaps.append("No AD domain inventory or host domain assignment is supplied.")
    raw_accounts = data.get("accounts")
    if not isinstance(raw_accounts, list) or not raw_accounts:
        gaps.append("No account inventory is supplied; credentials and administrator entitlements cannot be inferred from aggregate outcomes.")
    else:
        accounts = [account for account in raw_accounts if isinstance(account, dict)]
        if any("sessions_on" not in account for account in accounts):
            gaps.append("Some accounts lack session locations; credential-harvest transitions have no supplied source.")
        if any("domain" not in account for account in accounts):
            gaps.append("Some accounts lack domains; domain and cross-trust entitlement checks cannot be resolved.")
    if "campaign" in data:
        gaps.append("An embedded campaign must be extracted into a separate replay input and excluded from planner-visible inventory.")
    if "expected" in data:
        # Enforcement lives in the strict loader and the planner boundary, which
        # reject both keys; this advisory explains why such a file is unusable.
        gaps.append("Embedded expected/ground-truth outcomes must be excluded from planner-visible inventory; they are never a causal input.")
    return gaps
