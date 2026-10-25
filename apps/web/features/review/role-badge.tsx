import { ROLE_SHORT } from "@/lib/role-views";
import type { PresenceRow } from "@/lib/stdb/types";

/** A person's role, short, as a neutral chip (UX rule 2: chrome stays monochrome). */
export function RoleBadge({ role }: { role: PresenceRow["role"] }) {
  return (
    <span className="num inline-flex items-center rounded-[3px] border border-line2 px-1 py-px text-[9.5px] uppercase leading-3 tracking-[0.06em] text-ink-muted">
      {ROLE_SHORT[role]}
    </span>
  );
}
