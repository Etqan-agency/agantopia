import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-xs font-medium leading-4 [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-surface-sunken text-fg-muted",
        moss: "bg-moss-wash text-moss-ink",
        brick: "bg-brick-wash text-brick-ink",
        sky: "bg-sky-wash text-sky-ink",
        saffron: "bg-saffron-wash text-saffron-ink",
        outline: "border border-rule-strong text-fg-muted",
        // Solid fills for strong emphasis (KPI-tile look).
        purple: "bg-purple text-white",
        gold: "bg-gold text-navy",
        black: "bg-fg text-surface",
        // Used for anything simulated: dashed outline, matching the dashed floor outline in the office.
        simulated: "border border-dashed border-gold bg-saffron-wash text-fg",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
