"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

type RevealTag = "div" | "section" | "article" | "li" | "ul" | "ol" | "span" | "figure" | "header" | "footer";

/**
 * Fades content in with an 8px rise the first time it scrolls into view.
 *
 * Progressive: the server HTML is fully visible. Only after hydration, and only for
 * elements that start below the fold, is `data-reveal="hidden"` applied; an
 * IntersectionObserver then flips it to "shown" once. Under reduced motion nothing
 * is hidden. Uses IntersectionObserver rather than motion's whileInView to keep the bundle small.
 *
 * @example
 * <MotionReveal as="li" delay={80}><FeatureCard /></MotionReveal>
 */
export function MotionReveal({
  as = "div",
  delay = 0,
  className,
  children,
}: {
  as?: RevealTag;
  /** Transition delay in ms (for light staggering; keep under 240). */
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || typeof IntersectionObserver === "undefined") return;
    // Already on screen at mount: leave it alone so nothing flashes.
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.dataset.reveal = "hidden";
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.reveal = "shown";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (el.dataset.reveal === "hidden") el.dataset.reveal = "shown";
    };
  }, [reduced]);

  // Every RevealTag is an HTMLElement; typed as "div" so the ref type lines up.
  const Tag = as as "div";
  return (
    <Tag
      ref={ref}
      className={cn(
        "transition-[opacity,translate] duration-[400ms] ease-brand data-[reveal=hidden]:translate-y-2 data-[reveal=hidden]:opacity-0",
        className,
      )}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
