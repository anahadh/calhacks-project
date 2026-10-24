import { ReplayView } from "@/components/propagation/replay-view";

// An explicitly selected, render-only view of a propagation replay. It is a
// separate route from the live session scene (/s/[sessionId]); the demo session
// and its mockSession are untouched. No backend subscription and no browser
// ticks — it renders bundled replay output through the propagation adapter.
export default function ReplayPage() {
  return <ReplayView />;
}
