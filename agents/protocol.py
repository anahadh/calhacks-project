"""Message models for the four uAgents (spec: The Agents), plus Policy and
RunResult (HOSPITAL_SCHEMA.md) and the Coordinator's REST request models.

uagents.Model is a pydantic v1 BaseModel (pydantic.v1), so strictness is set
with a v1 `Config` class, not v2's `model_config`. Pydantic v1 ignores extra
fields by default; `Strict` forbids them (AGENTS.md rule 11).

Field names are camelCase to match the JSON contracts and SpacetimeDB rows.
`from` is a Python keyword, so PolicyRule stores it as `from_` with the alias
"from". uAgents serializes messages with `.json()` and REST responses with
`.dict()`, so `Strict` makes both default to `by_alias=True`. Otherwise the
wire format would say "from_".
"""

from typing import Literal

from pydantic.v1 import Extra, Field, conint, conlist, constr, root_validator
from uagents import Model

# --- Shared enums ---

AgentName = Literal["inventory", "flow", "clinical_workflow", "coordinator"]
# Roles that can be required to sign off or allowed to answer a question.
# Observers can do neither.
ReviewRole = Literal["security", "clinical_engineering", "operations"]
DeviceType = Literal[
    "mri", "ct", "workstation", "nurse_station", "patient_monitor",
    "infusion_pump", "server_rack", "pharmacy_cabinet", "lab_analyzer",
    "anesthesia_machine", "badge_reader", "hvac", "unknown",
]
ServerRole = Literal["pacs", "ehr_engine", "file_server", "domain_controller", "other"]
FlowProtocol = Literal["smb", "rdp", "http", "https", "dicom", "hl7", "other"]
Strategy = Literal["least_disruption", "max_containment", "protect_critical_care", "fastest_deploy"]
ChallengeId = Literal["unknown_device_imaging", "vendor_link_mri3", "mark_vulnerable_ehr"]

NonNegInt = conint(ge=0)
Port = conint(ge=1, le=65535)
Vlan = conint(ge=1, le=4094)
NonEmptyStr = constr(min_length=1)


class Strict(Model):
    """Base for every model here: unknown fields are rejected."""

    class Config:
        extra = Extra.forbid
        allow_population_by_field_name = True

    def dict(self, **kwargs):
        kwargs.setdefault("by_alias", True)
        return super().dict(**kwargs)

    def json(self, **kwargs):
        kwargs.setdefault("by_alias", True)
        return super().json(**kwargs)


# --- Policy (HOSPITAL_SCHEMA.md: Policy) ---


class Selector(Strict):
    """Any subset of zone, deviceType, role, vlan."""

    zone: NonEmptyStr | None = None
    deviceType: DeviceType | None = None
    role: ServerRole | None = None
    vlan: Vlan | None = None


class PolicyRule(Strict):
    id: NonEmptyStr
    from_: Selector = Field(..., alias="from")
    to: Selector
    protocol: FlowProtocol | None = None  # omitted = any
    port: Port | None = None  # omitted = any
    plain: NonEmptyStr


class Policy(Strict):
    strategy: Strategy
    name: NonEmptyStr
    rules: conlist(PolicyRule, max_items=40)
    rationale: str
    tradeoff: str

    @root_validator(skip_on_failure=True)
    def _fastest_deploy_selects_by_vlan_and_port(cls, values):
        # "fastest_deploy rules may select only by vlan and port, since that is
        # what existing ACLs express."
        if values.get("strategy") != "fastest_deploy":
            return values
        for rule in values.get("rules", []):
            for side in (rule.from_, rule.to):
                if side.zone is not None or side.deviceType is not None or side.role is not None:
                    raise ValueError(f"rule {rule.id}: fastest_deploy rules may select only by vlan and port")
            if rule.protocol is not None:
                raise ValueError(f"rule {rule.id}: fastest_deploy rules may select only by vlan and port")
        return values


# --- RunResult: what hippo-sim prints (draft, needs lead approval) ---


class InfectedDevice(Strict):
    id: NonEmptyStr
    tick: NonNegInt


class ServiceDown(Strict):
    id: NonEmptyStr
    downSinceTick: NonNegInt
    ticksDown: NonNegInt


class PatientCounts(Strict):
    ok: NonNegInt
    delayed: NonNegInt
    disrupted: NonNegInt
    diverted: NonNegInt


class RunResult(Strict):
    ticks: NonNegInt
    infectedCount: NonNegInt
    infectedDevices: list[InfectedDevice]
    servicesDown: list[ServiceDown]
    patientCounts: PatientCounts
    protectedBroken: list[str]  # flow ids
    removedFlows: list[str]  # flow ids


# --- Messages (spec: The Agents, Message models) ---


class Constraint(Strict):
    kind: Literal["keep_flow", "keep_service", "confirm_device", "max_rules"]
    targetIds: list[str]  # flow, service or device ids; empty for max_rules
    limit: conint(ge=1) | None = None  # max_rules only: the most rules a policy may have

    @root_validator(skip_on_failure=True)
    def _limit_only_for_max_rules(cls, values):
        if (values.get("kind") == "max_rules") != (values.get("limit") is not None):
            raise ValueError("limit is required for max_rules and not allowed for other kinds")
        return values


class Proposal(Strict):
    round: conint(ge=1)
    policyId: NonEmptyStr
    # strategy, name and tradeoff are beyond the spec's field table: with them
    # a Proposal carries a whole Policy, so the Coordinator can publish it.
    strategy: Strategy
    name: NonEmptyStr
    rules: conlist(PolicyRule, max_items=40)
    rationale: str
    tradeoff: str
    testResult: RunResult


class Verdict(Strict):
    round: conint(ge=1)
    policyId: NonEmptyStr
    agent: AgentName
    decision: Literal["accept", "reject"]
    reason: str  # Claude-written; the decision itself comes from code
    constraint: Constraint | None = None  # set on a rejection


class RuleDiff(Strict):
    added: list[PolicyRule]
    removed: list[str]  # rule ids


class Revision(Strict):
    round: conint(ge=1)
    policyId: NonEmptyStr
    diff: RuleDiff
    testResult: RunResult


class Question(Strict):
    id: NonEmptyStr  # Answer.questionId refers to this
    round: conint(ge=1)
    agent: AgentName
    targetId: NonEmptyStr  # device or flow id
    text: NonEmptyStr
    choices: conlist(NonEmptyStr, min_items=2)
    allowedRoles: conlist(ReviewRole, min_items=1)


class Answer(Strict):
    questionId: NonEmptyStr
    author: NonEmptyStr
    role: ReviewRole
    choice: NonEmptyStr


class Recommendation(Strict):
    policy: Policy
    testResult: RunResult
    verdicts: list[Verdict]
    explanation: str
    requiredRoles: conlist(ReviewRole, min_items=1)


# --- Coordinator → agents and relay (not in the spec's table) ---


class ProposalRequest(Strict):
    """Coordinator → Flow: propose (revise is None) or revise `revise`.
    Round 1's request also goes to Inventory, which runs its preflight on it."""

    sessionId: NonEmptyStr
    round: conint(ge=1)
    runId: NonEmptyStr
    patientZero: NonEmptyStr
    baseline: RunResult
    constraints: list[Constraint]
    revise: NonEmptyStr | None = None  # policy id to revise


class RoundState(Strict):
    """Coordinator → relay: written to session.roundState (round_state_set)."""

    sessionId: NonEmptyStr
    round: NonNegInt
    state: Literal["idle", "running", "waiting_for_human", "done"]
    detail: str | None = None


# --- Coordinator REST requests (called by the watchers) ---


class StartRound(Strict):
    sessionId: NonEmptyStr
    runId: NonEmptyStr
    patientZero: NonEmptyStr


class Reassess(Strict):
    sessionId: NonEmptyStr
    challenge: ChallengeId


class Resume(Strict):
    sessionId: NonEmptyStr
    questionId: NonEmptyStr
    choice: NonEmptyStr
    author: NonEmptyStr
    role: ReviewRole


class RestAck(Strict):
    """Response for the REST handlers (on_rest_post needs a response model)."""

    ok: bool
    detail: str | None = None
