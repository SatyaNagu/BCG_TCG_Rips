"use client";

import { useMotionValueEvent, useScroll } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { MobileMenu } from "./MobileMenu";
import { NAV_ITEMS, isActive } from "./nav-items";

const SCROLL_THRESHOLD = 24;

export function Header() {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Only re-render when crossing the threshold, not on every scroll tick.
  useMotionValueEvent(scrollY, "change", (y) => {
    const next = y > SCROLL_THRESHOLD;
    if (next !== scrolled) setScrolled(next);
  });

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const solid = scrolled || menuOpen;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 h-header border-b transition-[background-color,border-color,backdrop-filter] duration-300 ease-out ${
          solid
            ? "border-border bg-[var(--header-bg-scrolled)] backdrop-blur-xl backdrop-saturate-150"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between px-4 sm:px-6 md:grid md:grid-cols-[1fr_auto_1fr] lg:px-12">
          <div className="justify-self-start">
            <Logo onClick={closeMenu} />
          </div>

          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-2">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group relative block px-5 py-2.5 text-[17px] font-semibold transition-colors duration-150 ${
                        active ? "text-accent" : "text-text-muted hover:text-text"
                      }`}
                    >
                      {item.label}
                      <span
                        aria-hidden="true"
                        className={`absolute inset-x-5 -bottom-0.5 h-[3px] origin-left rounded-full bg-accent transition-transform duration-300 ease-out ${
                          active ? "scale-x-100" : "scale-x-0"
                        }`}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-3 justify-self-end">
            <div className="hidden items-center gap-3 md:flex">
              <ButtonLink href="/signin" variant="outline" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href="/signup" variant="solid" size="sm">
                Sign up
              </ButtonLink>
            </div>
            <MenuToggle open={menuOpen} onToggle={() => setMenuOpen((o) => !o)} />
          </div>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={closeMenu} pathname={pathname} />
    </>
  );
}

function MenuToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      aria-controls="mobile-menu"
      className="relative z-[60] -mr-2 grid size-11 place-items-center md:hidden"
    >
      <span className="relative block h-3.5 w-6">
        <span
          className={`absolute left-0 h-0.5 w-6 rounded-full bg-text transition-transform duration-300 ease-out ${
            open ? "top-1.5 rotate-45" : "top-0"
          }`}
        />
        <span
          className={`absolute left-0 h-0.5 w-6 rounded-full bg-text transition-transform duration-300 ease-out ${
            open ? "top-1.5 -rotate-45" : "top-3"
          }`}
        />
      </span>
    </button>
  );
}
