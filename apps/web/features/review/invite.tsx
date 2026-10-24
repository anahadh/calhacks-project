"use client";

import { useEffect, useState } from "react";

/** The link to send: this session's page. Anyone who opens it joins the same session. */
export function useInviteLink(sessionId: string): string {
  const [link, setLink] = useState(`/s/${sessionId}`);
  useEffect(() => setLink(`${window.location.origin}/s/${sessionId}`), [sessionId]);
  return link;
}

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (e.g. plain http on another host): the link stays selectable.
    }
  };
  return { copied, copy };
}

/** The invite link with a copy button, for the join modal and the invite popover. */
export function InviteLink({ sessionId }: { sessionId: string }) {
  const link = useInviteLink(sessionId);
  const { copied, copy } = useCopy(link);
  return (
    <div>
      <div className="eyebrow">Invite your team</div>
      <div className="mt-1 flex gap-1.5">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Session link"
          className="num min-w-0 flex-1 rounded-[2px] border border-line2 bg-panel2 px-2 py-1.5 text-[11.5px] text-ink outline-none"
        />
        <button
          type="button"
          onClick={copy}
          className="num shrink-0 rounded-[2px] border border-line2 px-2.5 py-1.5 text-[11px] text-ink hover:border-accent"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-ink-faint">Anyone with this link can enter their name and watch the same run.</p>
    </div>
  );
}

/** Header button: copies the session link. */
export function InviteButton({ sessionId }: { sessionId: string }) {
  const link = useInviteLink(sessionId);
  const { copied, copy } = useCopy(link);
  return (
    <button
      onClick={copy}
      title={link}
      className="btn"
    >
      {copied ? "Link copied" : "Invite"}
    </button>
  );
}
