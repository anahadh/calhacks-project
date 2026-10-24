import { RoomView } from "./room-view";

export default function RoomPage({ params }: { params: { sessionId: string } }) {
  return <RoomView sessionId={params.sessionId} />;
}
