import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-fg text-surface hover:bg-fg/85",
        // Gold CTA with navy text (12.7:1). Gold is the "live work" colour: use sparingly.
        accent: "rounded-full bg-gold text-navy hover:bg-gold-deep",
        // Gold fill, navy text (12:1). Marketing secondary CTA ("Watch the office work").
        gold: "rounded-full bg-gold text-navy hover:bg-gold-deep",
        // Gold outline on navy surfaces (gold on navy 11.8:1).
        "outline-gold": "rounded-full border border-gold/70 text-gold hover:bg-gold/10",
        // Violet fill, white text (4.6:1; 6.6:1 on hover). Primary marketing CTA.
        brand: "rounded-full bg-violet text-white hover:bg-violet-deep",
        // Snow outline for navy surfaces (marketing secondary CTA).
        "outline-light": "rounded-full border border-snow/60 text-snow hover:bg-white/10",
        secondary: "border border-rule-strong bg-surface-raised text-fg hover:bg-surface-sunken",
        ghost: "text-fg hover:bg-surface-sunken",
        danger: "bg-fg text-surface hover:bg-fg/85",
        "danger-outline": "border border-brick-ink/50 text-brick-ink hover:bg-brick-wash",
        link: "h-auto px-0 text-sky-ink underline-offset-4 hover:underline",
        chrome: "text-chrome-fg hover:bg-chrome-raised",
      },
      size: {
        md: "h-11 px-4 text-sm",
        // Visually compact but keeps a 44px hit area through the ::after overlay.
        sm: "h-9 px-3 text-sm after:absolute after:-inset-1 after:content-['']",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
        "icon-sm": "size-9 after:absolute after:-inset-1 after:content-['']",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; pending?: boolean };

export function Button({ className, variant, size, asChild, pending, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {pending ? <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" /> : null}
          {children}
        </>
      )}
    </Comp>
  );
}
