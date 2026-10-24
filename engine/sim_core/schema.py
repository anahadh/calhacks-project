"""Causal input contract. Metadata cannot silently become an attack entitlement."""

from __future__ import annotations

from enum import IntEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Level(IntEnum):
    clean = 0
    footholded = 1
    cred_holder = 2
    controlled = 3
    encrypted = 4


class Assumption(StrictModel):
    id: str
    statement: str
    provenance: Literal["R", "P", "I", "S"]


class HostProfile(StrictModel):
    os_family: Literal["windows", "vendor_embedded", "appliance", "none"]
    os_version: str = "unspecified"
    end_of_life: bool = False
    domain_joined: bool = False
    endpoint_protection: Literal["none", "av_monitor_only", "av_block_commodity", "edr"] = "none"
    patch_state: dict[str, str] = Field(default_factory=dict)
    service_classes: list[str] = Field(default_factory=list)
    vendor_managed: bool = False


class Dependency(StrictModel):
    provider: str
    port_class: str


class Node(StrictModel):
    id: str
    dept: str
    org: str
    domain: str | None = None
    kind: str
    host: HostProfile
    external: bool = False
    medical_device: bool = False
    internet_exposed: bool = False
    mail_client: bool = False
    backup: bool = False
    requires: list[Dependency] = Field(default_factory=list)

    @property
    def encryptable(self) -> bool:
        # Several supplied medical devices run Windows. Clinical identity wins.
        return not self.external and not self.medical_device and self.host.os_family == "windows"


class Link(StrictModel):
    a: str
    b: str
    port_classes: list[str] = Field(default_factory=lambda: ["*"])
    bidirectional: bool = True


class Domain(StrictModel):
    id: str
    dcs: list[str] = Field(default_factory=list)
    external: bool = False


class Trust(StrictModel):
    a: str
    b: str
    # Direction of authority: an a principal is honored by a b resource.
    direction: Literal["bidirectional", "a_to_b", "b_to_a"] = "bidirectional"


class Account(StrictModel):
    id: str
    domain: str
    org: str | None = None
    tier: Literal["user", "vendor", "service", "service_desk_admin", "administrator", "admin", "privileged", "domain_admin", "enterprise_admin"]
    admin_to: list[str] = Field(default_factory=list)
    sessions_on: list[str] = Field(default_factory=list)


class Service(StrictModel):
    name: str
    requires_all: list[str]
    paper_fallback: bool = False
    # Explicit consumers solve the ambiguity of server-only requires_all lists.
    # Each listed consumer is necessary; alternatives must be modeled separately.
    consumers: list[str] = Field(default_factory=list)


LeverId = Literal["segment_departments", "cut_hse_trust", "tier_admin_accounts", "patch_gateway", "mfa_remote", "edr_servers", "offline_backup"]


class Lever(StrictModel):
    id: LeverId
    zones: dict[str, list[str]] = Field(default_factory=dict)
    allow: list[tuple[str, str, str]] = Field(default_factory=list)

    @model_validator(mode="after")
    def shape(self) -> "Lever":
        if self.id != "segment_departments" and (self.zones or self.allow):
            raise ValueError("zones and allow belong only to segment_departments")
        if any(zone.startswith("unlisted:") for zone in self.zones):
            raise ValueError("unlisted: is a reserved zone namespace")
        members = [dept for depts in self.zones.values() for dept in depts]
        if len(set(members)) != len(members):
            raise ValueError("a department cannot belong to two zones")
        return self


class Plan(StrictModel):
    plan_id: str = "baseline"
    levers: list[Lever] = Field(default_factory=list)

    @model_validator(mode="after")
    def unique_levers(self) -> "Plan":
        ids = [lever.id for lever in self.levers]
        if len(set(ids)) != len(ids):
            raise ValueError("a lever may be applied only once")
        return self


class Scenario(StrictModel):
    scenario_id: str
    snapshot_date: str
    nodes: list[Node]
    links: list[Link]
    domains: list[Domain]
    trusts: list[Trust] = Field(default_factory=list)
    accounts: list[Account] = Field(default_factory=list)
    services: list[Service] = Field(default_factory=list)
    levers: list[LeverId] = Field(default_factory=list)
    mfa_remote_access: bool = False
    assumptions: list[Assumption] = Field(default_factory=list)

    @model_validator(mode="after")
    def references(self) -> "Scenario":
        def unique(values: list[str], kind: str) -> set[str]:
            if len(values) != len(set(values)):
                raise ValueError(f"duplicate {kind} IDs")
            return set(values)

        hosts = unique([n.id for n in self.nodes], "node")
        domains = unique([d.id for d in self.domains], "domain")
        unique([a.id for a in self.accounts], "account")
        unique([s.name for s in self.services], "service")
        for n in self.nodes:
            if n.domain is not None and n.domain not in domains:
                raise ValueError(f"unknown domain on {n.id}: {n.domain}")
            if n.host.domain_joined and n.domain is None:
                raise ValueError(f"domain-joined node {n.id} needs a domain")
            for dep in n.requires:
                if dep.provider not in hosts or not dep.port_class:
                    raise ValueError(f"invalid dependency on {n.id}: {dep.provider}")
        for link in self.links:
            if link.a not in hosts or link.b not in hosts or link.a == link.b:
                raise ValueError(f"invalid network link {link.a} → {link.b}")
        for domain in self.domains:
            if not set(domain.dcs) <= hosts:
                raise ValueError(f"unknown DC in {domain.id}")
        for trust in self.trusts:
            if trust.a not in domains or trust.b not in domains or trust.a == trust.b:
                raise ValueError("invalid trust endpoints")
        for account in self.accounts:
            if account.domain not in domains or not set(account.sessions_on) <= hosts:
                raise ValueError(f"invalid account references: {account.id}")
            for grant in account.admin_to:
                if grant == "*" or grant in hosts:
                    continue
                if grant.startswith("*@") and grant[2:] in domains:
                    continue
                raise ValueError(f"unknown entitlement {grant} on {account.id}")
        for service in self.services:
            if not service.requires_all or not set(service.requires_all + service.consumers) <= hosts:
                raise ValueError(f"invalid service requirements: {service.name}")
        return self


class EntryRoute(StrictModel):
    id: str
    target: str
    mode: Literal["phishing", "edge", "credential", "trust"]
    credential: str | None = None
    source_domain: str | None = None
    target_domain: str | None = None
    # A separately documented, already-compromised external context becomes
    # active only if this alternate route is attempted. It grants no credentials.
    source_foothold: str | None = None


class Event(StrictModel):
    t: str
    order: int
    rule: Literal["R1", "R2", "R3", "R4", "R5", "R6", "D1", "D2", "D3", "tick", "idle", "observation"]
    target: str | None = None
    org: str | None = None
    mode: Literal["phishing", "edge", "credential"] | None = None
    credential: str | None = None
    source_domain: str | None = None
    target_domain: str | None = None
    coverage: float = Field(default=0.9, ge=0, le=1)
    budget: int = Field(default=1, ge=1, le=10000)
    cut_links: list[tuple[str, str]] = Field(default_factory=list)
    label: str = ""


class Campaign(StrictModel):
    campaign_id: str
    events: list[Event]
    initial_creds: list[str] = Field(default_factory=list)
    initial_privileges: list[str] = Field(default_factory=list)
    initial_domains: list[str] = Field(default_factory=list)
    # External footholds are prior campaign history, never inferred from a snapshot.
    initial_footholds: list[str] = Field(default_factory=list)
    goal_hosts: list[str] = Field(default_factory=list)
    targeted_orgs: list[str] = Field(default_factory=list)
    entry_routes: list[EntryRoute] = Field(default_factory=list)
    detour_budget: int = Field(default=2, ge=0)
    assumptions: list[Assumption] = Field(default_factory=list)

    @model_validator(mode="after")
    def schedule(self) -> "Campaign":
        keys = [(e.t, e.order) for e in self.events]
        if len(keys) != len(set(keys)):
            raise ValueError("same-time events require distinct authored order values")
        route_ids = [route.id for route in self.entry_routes]
        if len(route_ids) != len(set(route_ids)):
            raise ValueError("entry route IDs must be unique")
        return self


class Blocker(StrictModel):
    code: str
    detail: str
    levers: list[str] = Field(default_factory=list)


class TraceEntry(StrictModel):
    t: str
    rule: str
    technique_label: str
    node: str | None = None
    from_level: str | None = None
    to_level: str | None = None
    reason: str
    status: Literal["applied", "blocked", "no_change", "observation"] = "applied"
    blockers: list[Blocker] = Field(default_factory=list)
    source: str | None = None
    account: str | None = None
    event_index: int | None = None


class ServiceFrame(StrictModel):
    t: str
    phase: Literal["pre_attack", "post_step"] = "post_step"
    services: dict[str, Literal["up", "paper", "down"]]
    devices: dict[str, Literal["operational", "dependency_outage"]]
    causes: dict[str, list[str]]


class EventEffect(StrictModel):
    event_index: int
    t: str
    rule: str
    target: str | None
    level_changes: dict[str, tuple[str, str]]
    creds_added: list[str]
    creds_removed: list[str]
    privileges_added: list[str]
    domains_added: list[str]


class ReplayResult(StrictModel):
    cache_key: str
    trace: list[TraceEntry]
    services: list[ServiceFrame]
    levels: dict[str, str]
    summary: dict[str, object]
    event_effects: list[EventEffect] = Field(default_factory=list)
