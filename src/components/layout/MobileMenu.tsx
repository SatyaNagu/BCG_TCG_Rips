"use client";

// Adapted from 21st.dev "Immersive Full Screen Navigation" (hyperiux):
// clip-path wipe, staggered reveal and focus trap, rebuilt with Motion.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useLenis } from "@/components/providers/SmoothScroll";
import { ButtonLink } from "@/components/ui/Button";
import { NAV_ITEMS, isActive } from "./nav-items";

const EASE = [0.76, 0, 0.24, 1] as const;
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Props = { open: boolean; onClose: () => void; pathname: string };

export function MobileMenu({ open, onClose, pathname }: Props) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const lenis = useLenis();

  // Lock page scroll while open.
  useEffect(() => {
    if (!open) return;
    lenis?.stop();
    document.documentElement.style.overflow = "hidden";
    return () => {
      lenis?.start();
      document.documentElement.style.overflow = "";
    };
  }, [open, lenis]);

  // Close when the route changes or the viewport grows past mobile.
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = () => mq.matches && onClose();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [onClose]);

  // Focus trap + Escape to close. Focus returns to the toggle on close.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const toggle = document.querySelector<HTMLElement>('[aria-controls="mobile-menu"]');
      const ring = toggle ? [toggle, ...items] : items;
      const i = ring.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? ring.length - 1 : i - 1) : i === ring.length - 1 ? 0 : i + 1;
      e.preventDefault();
      ring[next]?.focus();
    };

    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="mobile-menu"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-bg px-6 pb-10 pt-[calc(var(--header-h)+40px)] md:hidden"
          initial={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)" }}
          animate={reduce ? { opacity: 1 } : { clipPath: "inset(0 0 0% 0)" }}
          exit={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: reduce ? 0.2 : 0.6, ease: EASE }}
        >
          <nav aria-label="Mobile">
            <ul className="flex flex-col">
              {NAV_ITEMS.map((item, i) => {
                const active = isActive(pathname, item.href);
                return (
                  <motion.li
                    key={item.href}
                    className="border-b border-border"
                    initial={reduce ? false : { opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : 0.25 + i * 0.06 }}
                  >
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center justify-between py-5 font-display text-4xl font-bold tracking-tight ${
                        active ? "text-accent" : "text-text"
                      }`}
                    >
                      {item.label}
                      <span aria-hidden="true" className={`text-2xl ${active ? "text-accent" : "text-text-subtle"}`}>
                        →
                      </span>
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
          </nav>

          <motion.div
            className="mt-auto flex flex-col gap-3 pt-10"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : 0.45 }}
          >
            <ButtonLink href="/signup" size="lg" onClick={onClose}>
              Sign up
            </ButtonLink>
            <ButtonLink href="/signin" variant="outline" size="lg" onClick={onClose}>
              Sign in
            </ButtonLink>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
