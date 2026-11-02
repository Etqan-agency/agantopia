import { cn } from "@/lib/utils";

/**
 * The six avatar palettes offered when hiring. Ids are stored in
 * Employee.avatar.palette and are shared with the office scene.
 */
export const AVATAR_PALETTES = [
  // Ids are legacy (stored data); colours are combinations of the brand hues and match
  // CHARACTER_PALETTES in src/office/palette.ts.
  { id: "teal", label: "Lavender", body: "#b8a7ff", ink: "#111326", ring: "#7357f6" },
  { id: "moss", label: "Gold", body: "#ffc66d", ink: "#111326", ring: "#e8a93d" },
  { id: "brick", label: "Navy", body: "#111326", ink: "#f5f7ff", ring: "#7d889f" },
  { id: "sky", label: "Mist", body: "#a8b4ca", ink: "#111326", ring: "#7d889f" },
  { id: "saffron", label: "White & violet", body: "#ffffff", ink: "#5b3fd9", ring: "#7357f6" },
  { id: "plum", label: "Violet & gold", body: "#7357f6", ink: "#ffffff", ring: "#ffc66d" }, // white ink: gold on violet is 3.1:1
] as const;

export type AvatarPaletteId = (typeof AVATAR_PALETTES)[number]["id"];

export function paletteFor(id: string | null | undefined) {
  return AVATAR_PALETTES.find((p) => p.id === id) ?? AVATAR_PALETTES[0];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Small top-down-ish portrait: a palette disc with initials. Decorative; pair with the name. */
export function AvatarSwatch({
  name,
  palette,
  size = "md",
  className,
}: {
  name: string;
  palette?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const p = paletteFor(palette);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight select-none",
        size === "sm" && "size-6 text-[10px]",
        size === "md" && "size-8 text-xs",
        size === "lg" && "size-11 text-sm",
        size === "xl" && "size-16 text-lg",
        className,
      )}
      style={{ background: p.body, color: p.ink, boxShadow: `inset 0 0 0 1.5px ${p.ring}, inset 0 -3px 0 rgb(0 0 0 / 0.12)` }}
    >
      {initials(name)}
    </span>
  );
}
