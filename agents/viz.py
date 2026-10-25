"""The negotiation as a picture for ASI:One cards (the `image` element): one bar per plan
the agents tried, devices infected with it against no plan, and each guardian's verdict.
Drawn in code from the round's messages (rule 16); a small PNG, inlined as a data URI.
"""

import base64
import io
import os
from urllib.parse import urlencode
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


# --- the hospital floor ---

ZONE_FILL = {"critical_care": (58, 44, 52), "imaging": (40, 52, 70), "it_core": (52, 48, 34), "clinical_support": (40, 58, 52),
             "inpatient": (46, 52, 60), "business": (50, 50, 50), "public": (44, 46, 46)}
DEV, HIT, ZERO, ROOM_EDGE = (150, 164, 156), (232, 84, 70), (255, 196, 64), (88, 98, 94)


def _floor(h, w: int, hgt: int, infected=frozenset(), patient_zero=None, label_rooms=True) -> Image.Image:
    xs = [p[0] for r in h.rooms.values() for p in r["polygon"]]
    ys = [p[1] for r in h.rooms.values() for p in r["polygon"]]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    s = min((w - 24) / (x1 - x0), (hgt - 24) / (y1 - y0))
    ox, oy = 12 + (w - 24 - s * (x1 - x0)) / 2, 12 + (hgt - 24 - s * (y1 - y0)) / 2
    at = lambda x, y: (ox + (x - x0) * s, oy + (y - y0) * s)
    img = Image.new("RGB", (w, hgt), BG)
    d = ImageDraw.Draw(img)
    small = _font(max(10, int(s * 0.9)))
    hit_rooms = {h.devices[i]["roomId"] for i in infected if i in h.devices}
    for r in h.rooms.values():
        pts = [at(*p) for p in r["polygon"]]
        fill = ZONE_FILL.get(r["zone"], (44, 46, 46))
        if r["id"] in hit_rooms:
            fill = tuple(min(255, int(c * 0.55 + t * 0.45)) for c, t in zip(fill, (120, 40, 36)))
        d.polygon(pts, fill=fill, outline=ROOM_EDGE)
        if label_rooms:
            cx, cy = sum(p[0] for p in pts) / len(pts), min(p[1] for p in pts) + 4
            d.text((cx, cy), r["name"], font=small, fill=MUTED, anchor="ma")
    rad = max(3, int(s * 0.45))
    for i, dv in h.devices.items():
        if "position" not in dv:
            continue
        x, y = at(*dv["position"])
        if i == patient_zero or i in infected:
            color, rr = (ZERO, rad + 4) if i == patient_zero else (HIT, rad + 2)
            d.ellipse((x - rr - 3, y - rr - 3, x + rr + 3, y + rr + 3), outline=color, width=2)
        else:
            color, rr = DEV, rad
        d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=color)
    return img


def _png(img: Image.Image) -> bytes:
    out = io.BytesIO()
    img.convert("P", palette=Image.ADAPTIVE, colors=48, dither=Image.Dither.NONE).save(out, format="PNG", optimize=True)
    return out.getvalue()


def hospital_map(h, title: str, infected=frozenset(), patient_zero=None, subtitle: str | None = None) -> bytes:
    """The floor plan: rooms by zone, every device as a dot; infected devices red, patient zero gold."""
    w, fh = 900, 540
    img = Image.new("RGB", (w, fh + 80), BG)
    d = ImageDraw.Draw(img)
    d.text((PAD, 20), title, font=_font(28), fill=INK)
    d.text((PAD, 56), subtitle or f"{len(h.rooms)} rooms · {len(h.devices)} devices (synthetic)", font=_font(15), fill=MUTED)
    img.paste(_floor(h, w, fh, set(infected), patient_zero), (0, 80))
    return _png(img)


def before_after(h, patient_zero: str, before: set, after: set) -> bytes:
    """Two floors side by side: the attack with no plan, and with the agents' plan."""
    w, fh = 600, 380
    img = Image.new("RGB", (w * 2, fh + 70), BG)
    d = ImageDraw.Draw(img)
    for k, (label, infected) in enumerate((("No segmentation", before), ("With the agents' plan", after))):
        d.text((k * w + PAD, 16), f"{label}: {len(infected)} infected", font=_font(22), fill=INK)
        img.paste(_floor(h, w, fh, set(infected), patient_zero, label_rooms=False), (k * w, 60))
    return _png(img)



def floor_url(start: str | None = None, infected=None, after=None, title: str | None = None) -> str:
    """The floor plan drawn by the web app's /api/floor route on Vercel (an https image ASI:One
    can fetch; nothing is uploaded: the device ids are in the URL)."""
    base = (os.environ.get("IMAGE_BASE_URL", "").strip() or "https://hippocratech.vercel.app").rstrip("/")
    q = {}
    if start:
        q["start"] = start
    if infected:
        q["infected"] = ",".join(sorted(infected))
    if after is not None:
        q["after"] = ",".join(sorted(after))
    if title:
        q["title"] = title
    return f"{base}/api/floor" + (f"?{urlencode(q)}" if q else "")



SCENES = __import__("pathlib").Path(__file__).resolve().parents[1] / "apps" / "web" / "public" / "asi1"


def scene_url(name: str) -> str | None:
    """A screenshot of the real 3D scene (agents/scripts/snap_scenes.py), served by the deployed
    web app at /asi1/<name>.png; None when that shot was never captured."""
    f = SCENES / f"{name}.png"
    if not f.exists() or f.stat().st_size < 60_000:
        return None
    base = (os.environ.get("IMAGE_BASE_URL", "").strip() or "https://hippocratech.vercel.app").rstrip("/")
    return f"{base}/asi1/{name}.png"
