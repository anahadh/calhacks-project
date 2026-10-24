import { SessionView } from "../../session-view";

// The solution view's address (UX.md). It renders the same session view: the
// split screen shows while session.solution_pair_id is set, for every tab, and
// the address returns to /s/[sessionId] once the presenter closes it.
export default function SolutionPage({ params }: { params: { sessionId: string; recommendationId: string } }) {
  return <SessionView sessionId={params.sessionId} />;
}
