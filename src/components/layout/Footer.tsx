"use client";

import { motion, useMotionTemplate, useSpring } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef } from "react";
import { Logo } from "@/components/brand/Logo";
import { useLenis } from "@/components/providers/SmoothScroll";
import { packs, rarityLabel } from "@/lib/packs";
import { NAV_ITEMS } from "./nav-items";
import { SOCIAL_LINKS } from "./social-links";

const ACCOUNT_LINKS = [
  { label: "Sign in", href: "/signin" },
  { label: "Sign up", href: "/signup" },
] as const;

const LEGAL_LINKS = [
  { label: "Privacy", href: "#" },
  { label: "Terms", href: "#" },
] as const;

/** Where the light rests on the wordmark when the pointer is elsewhere (fractions of its box). */
const SPOT_REST = { x: 0.74, y: 0.5 };
const SPOT_SPRING = { stiffness: 140, damping: 24, mass: 0.7 };

/** Site footer. The Packs page is a one-screen flow, so it has no footer. */
export function Footer() {
  const pathname = usePathname();
  if (pathname === "/packs" || pathname.startsWith("/packs/")) return null;
  return <FooterBody />;
}

function FooterBody() {
  const lenis = useLenis();
  const markRef = useRef<HTMLDivElement>(null);

  // The light's position over the wordmark, in percent of the wordmark's box.
  const spotX = useSpring(SPOT_REST.x * 100, SPOT_SPRING);
  const spotY = useSpring(SPOT_REST.y * 100, SPOT_SPRING);
  const spotMask = useMotionTemplate`radial-gradient(circle clamp(150px, 24cqw, 440px) at ${spotX}% ${spotY}%, #000 0%, rgb(0 0 0 / 0.6) 42%, transparent 100%)`;

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "touch") return;
      const box = markRef.current?.getBoundingClientRect();
      if (!box || box.width === 0) return;
      spotX.set(((e.clientX - box.left) / box.width) * 100);
      spotY.set(((e.clientY - box.top) / box.height) * 100);
    },
    [spotX, spotY],
  );

  const onPointerLeave = useCallback(() => {
    spotX.set(SPOT_REST.x * 100);
    spotY.set(SPOT_REST.y * 100);
  }, [spotX, spotY]);

  const backToTop = useCallback(() => {
    if (!lenis) {
      window.scrollTo({ top: 0 });
      return;
    }
    // A long page (the home film) jumps; short pages glide.
    const far = window.scrollY > window.innerHeight * 4;
    lenis.scrollTo(0, far ? { immediate: true } : { duration: 1.1 });
  }, [lenis]);

  return (
    <footer
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative overflow-hidden bg-bg-sunken"
    >
      {/* Gold seam along the top edge */}
      <div
        aria-hidden="true"
        className="h-px bg-[linear-gradient(90deg,transparent,rgb(255_208_0/0.6)_22%,rgb(255_208_0/0.6)_78%,transparent)]"
      />

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-12">
        <div className="grid gap-14 pb-14 pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20 lg:pb-14 lg:pt-16">
          <div>
            <Logo />
            <p className="mt-7 font-display text-[clamp(1.75rem,2.7vw,2.6rem)] font-bold leading-[1.05] tracking-[-0.03em]">
              Rip packs.
              <br />
              Pull <span className="text-accent">legends.</span>
            </p>

            <ul className="mt-9 flex flex-wrap gap-3">
              {SOCIAL_LINKS.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    onClick={holdPlaceholder}
                    aria-label={`BC TCG on ${social.label}`}
                    data-magnetic=""
                    className="grid size-13 place-items-center rounded-full border border-border-strong text-text-muted transition-[color,border-color,background-color,transform,translate] duration-200 ease-out hover:border-accent hover:bg-accent hover:text-on-accent active:scale-[0.94]"
                  >
                    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
                      <path d={social.path} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:gap-x-10">
            <FooterColumn title="Shop">
              {NAV_ITEMS.map((item) => (
                <FooterLink key={item.href} href={item.href}>
                  {item.label}
                </FooterLink>
              ))}
            </FooterColumn>

            <FooterColumn title="Rarities">
              {packs.map((pack) => (
                <FooterLink key={pack.id} href={`/packs#${pack.id}`}>
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full transition-transform duration-200 ease-out group-hover:scale-150"
                    style={{ backgroundColor: pack.color, boxShadow: `0 0 10px ${pack.color}` }}
                  />
                  {rarityLabel[pack.id]}
                </FooterLink>
              ))}
            </FooterColumn>

            <FooterColumn title="Account">
              {ACCOUNT_LINKS.map((item) => (
                <FooterLink key={item.href} href={item.href}>
                  {item.label}
                </FooterLink>
              ))}
            </FooterColumn>
          </nav>
        </div>

        <div className="flex flex-col gap-2 border-t border-border py-5 text-sm text-text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} BC Rip&apos;s</p>
          <div className="-mx-3 flex flex-wrap items-center">
            {LEGAL_LINKS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={holdPlaceholder}
                className="inline-flex min-h-11 items-center px-3 transition-colors duration-150 hover:text-text"
              >
                {item.label}
              </a>
            ))}
            <button
              type="button"
              onClick={backToTop}
              className="group inline-flex min-h-11 items-center gap-2 px-3 font-semibold text-text transition-colors duration-150 hover:text-accent"
            >
              Back to top
              <span
                aria-hidden="true"
                className="transition-transform duration-200 ease-out group-hover:-translate-y-1"
              >
                ↑
              </span>
            </button>
          </div>
        </div>

        {/* The name, set wide: gold foil that lights up under the pointer */}
        <div ref={markRef} aria-hidden="true" className="footer-mark-box @container relative select-none pb-6 pt-6 sm:pt-8">
          <p className="footer-mark">BC TCG</p>
          <motion.p
            className="footer-mark footer-mark--lit absolute inset-x-0 top-6 sm:top-8"
            style={{ maskImage: spotMask, WebkitMaskImage: spotMask }}
          >
            BC TCG
          </motion.p>
        </div>
      </div>
    </footer>
  );
}

/** Links that have no destination yet stay put instead of jumping to the top of the page. */
function holdPlaceholder(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.currentTarget.getAttribute("href") === "#") e.preventDefault();
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.32em] text-accent">{title}</h2>
      <ul className="mt-4">
        {Array.isArray(children) ? children.map((child, i) => <li key={i}>{child}</li>) : <li>{children}</li>}
      </ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex min-h-11 items-center gap-3 text-[17px] font-medium text-text-muted transition-colors duration-150 hover:text-text"
    >
      <span className="relative inline-flex items-center gap-3">
        {children}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 -bottom-1 h-0.5 origin-left scale-x-0 rounded-full bg-accent transition-transform duration-300 ease-out group-hover:scale-x-100"
        />
      </span>
    </Link>
  );
}
