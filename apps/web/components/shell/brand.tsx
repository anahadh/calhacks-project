import Link from "next/link";

/** The Hippocra.tech lockup: the staff mark and the wordmark, linking home. */
export function Brand() {
  return (
    <Link href="/" className="inline-flex shrink-0 items-center gap-2.5 text-[18px] font-light tracking-[-0.01em] text-ink no-underline">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="" aria-hidden width={22} height={28} />
      <span>
        Hippocra.<span className="text-ink-muted">tech</span>
      </span>
    </Link>
  );
}
