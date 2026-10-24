"""The uAgents' decisions as pure, deterministic functions (AGENTS.md rule 7).

No network, no Claude, no uagents runtime, no clock, no randomness. Every
output that depends on a set is sorted, so results don't change with Python's
hash seed. Text fields Claude fills in later are placeholders: "[reason]",
"[question]", "[explanation]".
"""
