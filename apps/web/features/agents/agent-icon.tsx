import type { Speaker } from "@/lib/stdb/types";

// Spec: Inventory = tag, Flow = network, Clinical Workflow = heartbeat line,
// Coordinator = checklist. Humans get a person.
const PATHS: Record<Speaker, React.ReactNode> = {
  inventory: (
    <>
      <path d="M2.5 2.5h5l6 6-5 5-6-6z" />
      <circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  flow: (
    <>
      <circle cx="3.5" cy="8" r="1.8" />
      <circle cx="12.5" cy="3.5" r="1.8" />
      <circle cx="12.5" cy="12.5" r="1.8" />
      <path d="M5.2 7.2l5.6-2.9M5.2 8.8l5.6 2.9" />
    </>
  ),
  clinical_workflow: <path d="M1.5 8.5h3l1.5-4 3 8 1.5-4h4" />,
  coordinator: (
    <>
      <path d="M2 4l1.3 1.3L5.5 3M2 9l1.3 1.3L5.5 8" />
      <path d="M8 4.5h6M8 9.5h6M8 13h6" />
    </>
  ),
  humans: (
    <>
      <circle cx="8" cy="5" r="2.5" />
      <path d="M3 14c.6-2.8 2.6-4.3 5-4.3s4.4 1.5 5 4.3" />
    </>
  ),
};

/** The bare glyph, in currentColor. The node graph and the "now talking" pill draw it on their own backgrounds. */
export function AgentGlyph({ who, size = 16, strokeWidth = 1.4 }: { who: Speaker; size?: number; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[who]}
    </svg>
  );
}

export function AgentIcon({ who, size = 28 }: { who: Speaker; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[7px] border border-line2 bg-panel2 text-ink"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <AgentGlyph who={who} size={size * 0.55} />
    </span>
  );
}
