import json

import pytest
from pydantic.v1 import ValidationError

import protocol as p

RULE = {
    "id": "r1",
    "from": {"zone": "imaging", "deviceType": "mri"},
    "to": {"role": "pacs"},
    "protocol": "dicom",
    "port": 104,
    "plain": "MRI scanners may send images to PACS on port 104. Nothing else.",
}
POLICY = {
    "strategy": "protect_critical_care",
    "name": "Critical care first",
    "rules": [RULE],
    "rationale": "Cuts SMB from imaging to the file server.",
    "tradeoff": "Imaging workstations lose the shared drive.",
}
RUN_RESULT = {
    "ticks": 48,
    "infectedCount": 3,
    "infectedDevices": [{"id": "mri_2", "tick": 0}, {"id": "ws_img_1", "tick": 2}],
    "servicesDown": [{"id": "svc_mri", "downSinceTick": 0, "ticksDown": 48}],
    "patientCounts": {"ok": 86, "delayed": 0, "disrupted": 26, "diverted": 0},
    "protectedBroken": [],
    "removedFlows": ["fl_8", "fl_9"],
}
CONSTRAINT = {"kind": "keep_flow", "targetIds": ["fl_2"]}
VERDICT = {
    "sessionId": "demo",
    "round": 1,
    "policyId": "pol_1",
    "agent": "clinical_workflow",
    "decision": "reject",
    "reason": "This cuts MRI 2 to PACS, which carries scans to radiologists.",
    "constraint": CONSTRAINT,
}

SAMPLES = {
    p.Selector: {"vlan": 10},
    p.PolicyRule: RULE,
    p.Policy: POLICY,
    p.InfectedDevice: {"id": "mri_2", "tick": 0},
    p.ServiceDown: {"id": "svc_mri", "downSinceTick": 0, "ticksDown": 4},
    p.PatientCounts: RUN_RESULT["patientCounts"],
    p.RunResult: RUN_RESULT,
    p.Constraint: CONSTRAINT,
    p.Proposal: {
        "sessionId": "demo", "round": 1, "policyId": "pol_1", "strategy": "protect_critical_care", "name": "Critical care first",
        "rules": [RULE], "rationale": "Separates imaging from the file server.",
        "tradeoff": "Imaging workstations lose the shared drive.", "testResult": RUN_RESULT,
    },
    p.Verdict: VERDICT,
    p.RuleDiff: {"added": [RULE], "removed": ["r2"]},
    p.Revision: {
        "sessionId": "demo", "round": 2, "policyId": "pol_1",
        "diff": {"added": [RULE], "removed": ["r2"]}, "testResult": RUN_RESULT,
    },
    p.Question: {
        "sessionId": "demo", "id": "q_1", "round": 1, "agent": "inventory", "targetId": "dev_unknown_7",
        "text": "Is dev_unknown_7 in Imaging a workstation or a scanner?",
        "choices": ["workstation", "scanner"], "allowedRoles": ["clinical_engineering"],
    },
    p.Answer: {"sessionId": "demo", "questionId": "q_1", "author": "Dev", "role": "clinical_engineering", "choice": "workstation"},
    p.Recommendation: {
        "policy": POLICY, "testResult": RUN_RESULT,
        "verdicts": [{**VERDICT, "decision": "accept", "constraint": None}],
        "explanation": "Imaging stays connected to PACS; SMB to the file server is cut.",
        "requiredRoles": ["security", "clinical_engineering"],
    },
    p.ProposalRequest: {
        "sessionId": "demo", "round": 2, "runId": "run_baseline", "patientZero": "mri_2",
        "seed": 1337, "challenges": ["unknown_device_imaging"], "baseline": RUN_RESULT, "constraints": [CONSTRAINT], "revise": "pol_1",
    },
    p.RoundState: {"sessionId": "demo", "round": 2, "state": "waiting_for_human"},
    p.StartRound: {"sessionId": "demo", "runId": "run_baseline", "patientZero": "mri_2", "seed": 1337},
    p.Candidate: {"id": "cand_keep_scans", "policy": POLICY},
    p.Reassess: {"sessionId": "demo", "challenge": "unknown_device_imaging"},
    p.Resume: {
        "sessionId": "demo", "questionId": "q_1", "choice": "workstation",
        "author": "Dev", "role": "clinical_engineering",
    },
    p.RestAck: {"ok": True},
}


def test_every_model_has_a_sample():
    models = {
        v for v in vars(p).values()
        if isinstance(v, type) and issubclass(v, p.Strict) and v is not p.Strict
    }
    assert models == set(SAMPLES)


@pytest.mark.parametrize("model", SAMPLES, ids=lambda m: m.__name__)
def test_round_trip(model):
    obj = model.parse_obj(SAMPLES[model])
    # .json() is what uAgents puts on the wire; parse_raw is how it reads it.
    assert model.parse_raw(obj.json()) == obj
    # .model_dump_json() is the uagents.Model wrapper actually called by ctx.send.
    assert model.model_validate_json(obj.model_dump_json()) == obj
    assert model.parse_obj(obj.dict()) == obj


@pytest.mark.parametrize("model", SAMPLES, ids=lambda m: m.__name__)
def test_extra_field_rejected(model):
    with pytest.raises(ValidationError, match="extra fields not permitted"):
        model.parse_obj({**SAMPLES[model], "unexpected": 1})


def test_nested_extra_field_rejected():
    bad = {**POLICY, "rules": [{**RULE, "to": {"role": "pacs", "name": "PACS"}}]}
    with pytest.raises(ValidationError, match="extra fields not permitted"):
        p.Policy.parse_obj(bad)


def test_policy_rule_uses_from_on_the_wire():
    wire = json.loads(p.PolicyRule.parse_obj(RULE).json(exclude_none=True))
    assert wire == RULE


def test_policy_max_40_rules():
    rules = [{**RULE, "id": f"r{i}"} for i in range(41)]
    with pytest.raises(ValidationError):
        p.Policy.parse_obj({**POLICY, "rules": rules})
    p.Policy.parse_obj({**POLICY, "rules": rules[:40]})


def test_fastest_deploy_selects_only_by_vlan_and_port():
    with pytest.raises(ValidationError, match="only by vlan and port"):
        p.Policy.parse_obj({**POLICY, "strategy": "fastest_deploy"})
    vlan_rule = {"id": "r1", "from": {"vlan": 10}, "to": {"vlan": 20}, "port": 104, "plain": "VLAN 10 to 20 on 104."}
    p.Policy.parse_obj({**POLICY, "strategy": "fastest_deploy", "rules": [vlan_rule]})


def test_constraint_limit_only_for_max_rules():
    assert p.Constraint.parse_obj({"kind": "max_rules", "targetIds": [], "limit": 12}).limit == 12
    with pytest.raises(ValidationError, match="limit is required"):
        p.Constraint.parse_obj({"kind": "max_rules", "targetIds": []})
    with pytest.raises(ValidationError, match="limit is required"):
        p.Constraint.parse_obj({**CONSTRAINT, "limit": 3})


@pytest.mark.parametrize(
    "model, field, value",
    [
        (p.Answer, "role", "observer"),
        (p.Verdict, "decision", "approved"),
        (p.Constraint, "kind", "keep_everything"),
        (p.PolicyRule, "port", 70000),
        (p.Selector, "vlan", 0),
        (p.Reassess, "challenge", "unknown"),
        (p.Question, "choices", ["only one"]),
    ],
)
def test_invalid_values_rejected(model, field, value):
    with pytest.raises(ValidationError):
        model.parse_obj({**SAMPLES[model], field: value})
