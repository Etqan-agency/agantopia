"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * The hero <section>, server-rendered as is. After hydration it adds `is-paused` (and
 * data-motion="paused") while the hero is offscreen or the visitor prefers reduced motion, which
 * pauses the scene's CSS animations. No timers, no requestAnimationFrame.
 */
export function HeroMotionGate({ className, children, ...props }: ComponentProps<"section">) {
  const ref = useRef<HTMLElement>(null);
  const [offscreen, setOffscreen] = useState(false);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => setOffscreen(!entries[0]!.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const paused = offscreen || reduced;
  return (
    <section ref={ref} {...props} data-motion={paused ? "paused" : "running"} className={cn(className, paused && "is-paused")}>
      {children}
    </section>
  );
}
