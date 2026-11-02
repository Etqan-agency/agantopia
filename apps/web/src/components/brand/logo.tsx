import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import lockup from "../../../public/brand/agentopia-logo.png";
import mark from "../../../public/brand/agentopia-mark.png";

/** Mark height in px for each size. The light-surface lockup uses the same height. */
const SIZE = { sm: 24, md: 32, lg: 48 } as const;
/** Wordmark text size paired with each mark height. */
const WORDMARK_TEXT = { sm: "text-sm", md: "text-lg", lg: "text-2xl" } as const;

/** Intrinsic ratio of the official lockup PNG (1744 x 341). */
const LOCKUP_RATIO = lockup.width / lockup.height;

export type LogoTone = "auto" | "light-surface" | "dark-surface";
export type LogoSize = keyof typeof SIZE;

/**
 * The Agentopia mark alone (violet figure, gold orbit dots, gold spark), from
 * `public/brand/agentopia-mark.png`. Transparent background, so it works on any surface.
 *
 * @example <AgentopiaMark size="lg" />
 */
export function AgentopiaMark({
  size = "sm",
  className,
  label,
}: {
  size?: LogoSize;
  className?: string;
  /** Accessible name. Omit when the mark sits next to visible "Agentopia" text. */
  label?: string;
}) {
  const px = SIZE[size];
  return (
    <Image
      src={mark}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      width={px}
      height={px}
      loading="eager"
      className={cn("shrink-0 select-none", className)}
    />
  );
}

/** Official lockup (navy wordmark): only for light surfaces. */
function LightLockup({ size, wordmark }: { size: LogoSize; wordmark: boolean }) {
  const h = SIZE[size];
  if (!wordmark) return <AgentopiaMark size={size} />;
  return (
    <Image
      src={lockup}
      alt=""
      aria-hidden
      width={Math.round(h * LOCKUP_RATIO)}
      height={h}
      loading="eager"
      className="shrink-0 select-none"
    />
  );
}

/** Mark + Sora 600 text wordmark in snow: for navy/chrome surfaces where the navy lockup would vanish. */
function DarkLockup({ size, wordmark }: { size: LogoSize; wordmark: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <AgentopiaMark size={size} />
      {wordmark ? (
        <span className={cn("font-display font-semibold tracking-tight text-snow", WORDMARK_TEXT[size])}>Agentopia</span>
      ) : null}
    </span>
  );
}

/**
 * Brand logo.
 *
 * - `tone="light-surface"`: the official lockup PNG (mark + navy wordmark).
 * - `tone="dark-surface"`: the mark PNG + a Sora 600 text wordmark in snow.
 * - `tone="auto"` (default): follows the app theme (light lockup in light mode, dark lockup in
 *   dark mode), toggled in CSS by `.brand-logo-on-light` / `.brand-logo-on-dark` in globals.css.
 *
 * `size` is the mark height (sm 24, md 32, lg 48). `href={null}` renders a non-link.
 *
 * @example <BrandLogo href="/office" size="md" tone="dark-surface" />
 */
export function BrandLogo({
  href = "/",
  size = "sm",
  wordmark = true,
  tone = "auto",
  className = "",
}: {
  href?: string | null;
  size?: LogoSize;
  wordmark?: boolean;
  tone?: LogoTone;
  className?: string;
}) {
  const body =
    tone === "light-surface" ? (
      <LightLockup size={size} wordmark={wordmark} />
    ) : tone === "dark-surface" ? (
      <DarkLockup size={size} wordmark={wordmark} />
    ) : (
      <>
        <span className="brand-logo-on-light inline-flex">
          <LightLockup size={size} wordmark={wordmark} />
        </span>
        <span className="brand-logo-on-dark inline-flex">
          <DarkLockup size={size} wordmark={wordmark} />
        </span>
      </>
    );
  const classes = cn("inline-flex items-center rounded-sm", className);
  if (href === null)
    return (
      <span role="img" aria-label="Agentopia" className={classes}>
        {body}
      </span>
    );
  return (
    <Link href={href} aria-label="Agentopia" className={classes}>
      {body}
    </Link>
  );
}
