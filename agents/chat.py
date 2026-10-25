"""The Coordinator's chat helpers, in plain code: a card button's selection, and devices by
name or id. The reading of free text is brain.py's (a model picks tools; code runs them,
rule 8). Pure functions; coordinator.py sends.
"""

import difflib
import json
import re
from dataclasses import dataclass

from facts import AGENT_NAMES, ROLE_NAMES
from logic.hospital import HospitalIndex
from logic.inventory import dormant

DEMO_SEED = 1337
EXAMPLE = "simulate ransomware from MRI 2"

ACTIONS = {"simulate", "lookup", "devices", "protected", "status", "help"}


@dataclass(frozen=True)
class Command:
    kind: str  # "simulate", "lookup", "devices", "protected", "status" or "help"
    device: str | None = None


def selection(text: str) -> Command | None:
    """A card button's selection, sent back as JSON text (direct chat) or, through
    ASI:One's planner, as prose naming the action and device."""
    t = text.strip()
    if t.startswith("{") and t.endswith("}"):
        try:
            data = json.loads(t)
        except json.JSONDecodeError:
            data = None
        if isinstance(data, dict) and data.get("action") in ACTIONS:
            device = data.get("device")
            return Command(data["action"], device if isinstance(device, str) else None)
    m = re.search(r"\baction\W+(?P<action>simulate|lookup|devices|protected|status|help)\b", t, re.I)
    if m:
        d = re.search(r"\bdevice\W+(?P<device>[a-z0-9_]+)", t, re.I)
        return Command(m.group("action").lower(), d.group("device") if d else None)
    return None


FILLER_WORDS = ("the", "a", "an", "device", "machine", "machines", "scanner", "server", "workstation",
                "station", "unit", "system", "room", "please")
FILLER = re.compile(r"\b(?:%s)\b" % "|".join(FILLER_WORDS), re.I)


def _key(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _loose(s: str) -> str:
    """A name with filler words dropped, typos included ("mri mchine 1" → "mri1"), for a second try."""
    kept = [w for w in re.findall(r"[a-z0-9]+", s.lower())
            if not (w in FILLER_WORDS or difflib.get_close_matches(w, FILLER_WORDS, n=1, cutoff=0.75))]
    return "".join(kept)


def devices_on_network(h: HospitalIndex) -> list[str]:
    """Device ids a round can start from: not dormant (a challenge-only device is off the network)."""
    return sorted(d for d in h.devices if not dormant(h, d))


def resolve_device(h: HospitalIndex, query: str) -> str | None:
    """A device id from an id or a name, ignoring case, spaces and punctuation ("mri2" = "MRI 2")."""
    wanted = _key(query)
    for d in devices_on_network(h):
        if wanted in (_key(d), _key(h.devices[d]["name"])):
            return d
    # Second try: without filler words, then the closest name by spelling (typos like
    # "mri mchine 1"), only when one name is clearly closest.
    loose = _loose(query)
    keyed = {d: (_key(d), _loose(h.devices[d]["name"])) for d in devices_on_network(h)}
    for d, keys in keyed.items():
        if loose and loose in keys:
            return d
    close = difflib.get_close_matches(loose, [k[1] for k in keyed.values()], n=2, cutoff=0.75)
    if len(close) == 1 or (len(close) == 2 and close[0] != close[1]
                           and difflib.SequenceMatcher(None, loose, close[0]).ratio() > difflib.SequenceMatcher(None, loose, close[1]).ratio()):
        return next(d for d, keys in keyed.items() if keys[1] == close[0])
    return None


def unknown_device(h: HospitalIndex, query: str) -> str:
    names = [h.devices[d]["name"] for d in devices_on_network(h)]
    close = difflib.get_close_matches(FILLER.sub(" ", query).strip(), names, n=3, cutoff=0.5)
    some = close or [n for n in ("MRI 2", "CT 1", "PACS", "File server", "ER WS 1", "ICU nurse station") if n in names]
    return (f"I don't know a device called \"{query}\" in this hospital. "
            f"Try one of: {', '.join(some)}. For example: {EXAMPLE}.")
