"use client";

import { useLayoutEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type RunTag = "div" | "figure" | "section" | "ol" | "ul";

const REDUCE = "(prefers-reduced-motion: reduce)";

/**
 * Starts a CSS-driven sequence the first time its content scrolls into view.
 *
 * Renders `data-run="on"` in server HTML, so without JS, and under reduced motion, every stage
 * is shown in its final state. After hydration (when motion is allowed) it flips to "off" with
 * transitions disabled before paint, then back to "on" once 30% of it is visible. Children style
 * themselves with the named group variant, plus a delay class per stage:
 *
 * @example
 * <RunOnView as="figure">
 *   <rect className={cn("fill-navy-700 transition-[fill] duration-[400ms]", delayClass(2),
 *     "group-data-[run=on]/run:fill-violet")} />
 * </RunOnView>
 */
export function RunOnView({
  as = "div",
  threshold = 0.3,
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "ref"> & { as?: RunTag; threshold?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || window.matchMedia(REDUCE).matches) return;
    el.dataset.run = "off";
    let frame = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        frame = requestAnimationFrame(() => {
          el.dataset.run = "on";
        });
      },
      { threshold },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      el.dataset.run = "on";
    };
  }, [threshold]);

  // Every RunTag is an HTMLElement; typed as "div" so the ref lines up.
  const Tag = as as "div";
  return (
    <Tag ref={ref} data-run="on" className={cn("group/run data-[run=off]:[&_*]:transition-none", className)} {...props}>
      {children}
    </Tag>
  );
}
