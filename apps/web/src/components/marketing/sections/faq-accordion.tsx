"use client";

import { ChevronDown } from "lucide-react";
import { Accordion } from "radix-ui";
import { useState } from "react";
import type { FaqItem } from "@/content/marketing/types";
import { cn } from "@/lib/utils";

/**
 * Accessible FAQ accordion (radix Accordion: buttons with aria-expanded/aria-controls,
 * arrow-key navigation between questions). Reusable on /faq. Every answer is rendered into
 * the server HTML (`forceMount`) and hidden with display:none while closed; an item that is
 * closing keeps display:block until its collapse animation ends. Dark surfaces only: gold
 * chevron, and the open item's question turns gold.
 *
 * @example <FAQAccordion items={HOME.faq.items} headingLevel={3} />
 */
export function FAQAccordion({
  items,
  headingLevel = 3,
  defaultOpen,
  className,
}: {
  items: readonly FaqItem[];
  headingLevel?: 2 | 3 | 4;
  /** Id of an item to open initially. */
  defaultOpen?: string;
  className?: string;
}) {
  const H = `h${headingLevel}` as "h2" | "h3" | "h4";
  const [open, setOpen] = useState<string[]>(defaultOpen ? [defaultOpen] : []);
  const [closing, setClosing] = useState<string[]>([]);
  const onValueChange = (next: string[]) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) setClosing((c) => [...c, ...open.filter((id) => !next.includes(id))]);
    setOpen(next);
  };
  const doneClosing = (id: string) => setClosing((c) => (c.includes(id) ? c.filter((x) => x !== id) : c));
  return (
    <Accordion.Root
      type="multiple"
      value={open}
      onValueChange={onValueChange}
      className={cn("flex flex-col border-t border-white/10", className)}
    >
      {items.map((item) => (
        <Accordion.Item key={item.id} value={item.id} id={item.id} className="scroll-mt-24 border-b border-white/10">
          <Accordion.Header asChild>
            <H className="m-0">
              <Accordion.Trigger
                className={cn(
                  "group flex min-h-14 w-full cursor-pointer items-center justify-between gap-6 py-4 text-left text-base font-semibold md:text-lg",
                  "focus-visible:outline-2 focus-visible:outline-offset-2",
                  "text-snow hover:text-gold focus-visible:outline-gold data-[state=open]:text-gold",
                )}
              >
                <span className="text-pretty">{item.question}</span>
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold transition-colors",
                    "group-data-[state=open]:border-gold group-data-[state=open]:bg-gold/10",
                  )}
                >
                  <ChevronDown className="size-4 transition-transform duration-[240ms] ease-brand group-data-[state=open]:rotate-180" />
                </span>
              </Accordion.Trigger>
            </H>
          </Accordion.Header>
          {/* forceMount keeps every answer in the server HTML (crawlable). Closed answers are
              display:none, except while data-closing is set so the collapse animation can play. */}
          <Accordion.Content
            forceMount
            data-closing={closing.includes(item.id) || undefined}
            onAnimationEnd={() => doneClosing(item.id)}
            className="overflow-hidden data-[state=closed]:not-data-[closing]:hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down motion-reduce:animate-none"
          >
            <p className="max-w-[68ch] pb-6 text-base leading-relaxed text-mist">{item.answer}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
