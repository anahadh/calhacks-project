"""The negotiation as a picture for ASI:One cards (the `image` element): one bar per plan
the agents tried, devices infected with it against no plan, and each guardian's verdict.
Drawn in code from the round's messages (rule 16); a small PNG, inlined as a data URI.
"""

import base64
import io
from dataclasses import dataclass, field

from PIL import Image, ImageDraw, ImageFont

W, ROW_H, TOP, PAD = 960, 64, 118, 32
BG, INK, MUTED, TRACK = (24, 28, 27), (236, 240, 236), (150, 160, 154), (52, 60, 57)
BASE_BAR, PLAN_BAR = (122, 72, 64), (98, 196, 132)
CHIP = {"accept": ((46, 110, 70), "yes"), "reject": ((140, 60, 52), "no")}
GUARDIANS = {"inventory": "Inventory", "clinical_workflow": "Clinical"}


@dataclass
class Row:
    round: int
    plan: str
    infected: int
    verdicts: dict[str, str] = field(default_factory=dict)  # guardian short name → accept | reject


def _font(size: int):
    return ImageFont.load_default(size=size)


def _cut(d: ImageDraw.ImageDraw, text: str, font, width: int) -> str:
    if d.textlength(text, font=font) <= width:
        return text
    while text and d.textlength(text + "…", font=font) > width:
        text = text[:-1]
    return text + "…"


def negotiation_chart(device: str, baseline: int, rows: list[Row]) -> bytes:
    rows = rows[-8:]
    h = TOP + ROW_H * (len(rows) + 1) + PAD
    img = Image.new("RGB", (W, h), BG)
    d = ImageDraw.Draw(img)
    big, mid, small = _font(30), _font(19), _font(15)
    d.text((PAD, 24), f"Ransomware from {device}", font=big, fill=INK)
    d.text((PAD, 66), "Devices infected per plan the agents negotiated (simulation)", font=small, fill=MUTED)
    label_w, bar_x, bar_w = 230, PAD + 240, 340
    scale = max(baseline, 1)

    def bar(y: int, label: str, value: int, color, sub: str = ""):
        d.text((PAD, y + 4), _cut(d, label, mid, label_w), font=mid, fill=INK)
        if sub:
            d.text((PAD, y + 30), sub, font=small, fill=MUTED)
        d.rounded_rectangle((bar_x, y + 8, bar_x + bar_w, y + 30), radius=11, fill=TRACK)
        filled = max(22, int(bar_w * min(value, scale) / scale)) if value else 0
        if filled:
            d.rounded_rectangle((bar_x, y + 8, bar_x + filled, y + 30), radius=11, fill=color)
        d.text((bar_x + bar_w + 12, y + 7), str(value), font=mid, fill=INK)

    y = TOP
    bar(y, "No segmentation", baseline, BASE_BAR, "baseline")
    for r in rows:
        y += ROW_H
        bar(y, r.plan, r.infected, PLAN_BAR, f"round {r.round}")
        x = bar_x + bar_w + 56
        for name, decision in r.verdicts.items():
            color, mark = CHIP.get(decision, ((70, 80, 76), "·"))
            label = f"{name}: {mark}"
            tw = int(d.textlength(label, font=small)) + 16
            d.rounded_rectangle((x, y + 8, x + tw, y + 30), radius=11, fill=color)
            d.text((x + 8, y + 11), label, font=small, fill=INK)
            x += tw + 6
    out = io.BytesIO()
    img.quantize(colors=32).save(out, format="PNG", optimize=True)
    return out.getvalue()


def data_uri(png: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png).decode()


def rows_from_events(events: list[tuple[str, object]]) -> list[Row]:
    """One Row per proposal or revision, with the guardians' verdicts on it."""
    rows: list[Row] = []
    by_policy: dict[str, Row] = {}
    name = None
    for type, m in events:
        if type in ("proposal", "revision"):
            name = getattr(m, "name", None) or name or m.policyId
            row = Row(round=m.round, plan=name, infected=m.testResult.infectedCount)
            rows.append(row)
            by_policy[f"{m.round}:{m.policyId}"] = row
        elif type == "verdict" and m.agent in GUARDIANS:
            row = by_policy.get(f"{m.round}:{m.policyId}")
            if row is not None:
                row.verdicts[GUARDIANS[m.agent]] = m.decision
    return rows
