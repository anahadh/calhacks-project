import type { PatientStateValue } from "@/lib/stdb/types";

// Patient states always pair color with a glyph (UX rule 3).
export const PATIENT_STATE: Record<PatientStateValue, { label: string; glyph: string; color: string }> = {
  ok: { label: "OK", glyph: "", color: "#E8ECF1" },
  delayed: { label: "Delayed", glyph: "◷", color: "#F5B942" },
  disrupted: { label: "Disrupted", glyph: "!", color: "#FF4D6D" },
  diverted: { label: "Diverted", glyph: "↩", color: "#FF4D6D" },
};

export function PatientBadge({ state, size = "sm" }: { state: PatientStateValue; size?: "sm" | "md" }) {
  const s = PATIENT_STATE[state];
  const dim = size === "md" ? "h-5 w-5 text-[12px]" : "h-4 w-4 text-[10px]";
  return (
    <span
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full font-semibold leading-none text-bg`}
      style={{ background: s.color }}
      aria-label={s.label}
    >
      {s.glyph}
    </span>
  );
}
