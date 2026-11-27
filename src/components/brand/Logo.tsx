import Link from "next/link";

/** The BC monogram tile. Same drawing as src/app/icon.svg. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="9" fill="var(--accent)" />
      <g fill="none" stroke="var(--bg)" strokeWidth="3.5" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M8 11V29M8 11H13A4 4 0 0 1 13 19H8M8 19H13.5A5 5 0 0 1 13.5 29H8" />
        <path d="M32.5 13.5Q31 11 28 11A5 5 0 0 0 23 16V24A5 5 0 0 0 28 29Q31 29 32.5 26.5" />
      </g>
    </svg>
  );
}

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/" onClick={onClick} className="group inline-flex items-center gap-3" aria-label="BC TCG home">
      <LogoMark className="size-11 transition-transform duration-200 ease-out group-active:scale-95" />
      <span className="font-display text-xl font-bold tracking-[0.02em] text-text">
        BC <span className="text-accent">TCG</span>
      </span>
    </Link>
  );
}
