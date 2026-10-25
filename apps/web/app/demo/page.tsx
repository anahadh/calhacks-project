"use client";

import { DemoRoom } from "@/features/agents/demo-room";

// /demo: the scripted negotiation on its own page, no database needed. Labeled on screen.
export default function DemoPage() {
  return (
    <div className="flex h-screen flex-col bg-bg p-4 md:p-6">
      <DemoRoom />
    </div>
  );
}
