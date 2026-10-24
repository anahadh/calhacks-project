import { redirect } from "next/navigation";

// The load screen (Demo hospital / Upload JSON) comes later. For now, go
// straight to the demo session.
export default function Home() {
  redirect("/s/demo");
}
