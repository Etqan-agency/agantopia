/**
 * Shared colour tokens for the office (docs/design/agentopia-brand-system.md).
 * Five brand hues: violet, gold, mist grey, navy, white. Everything else is a
 * tint (toward white) or shade (toward navy) of one of them, or a step of the
 * cool neutral ramp (stone-* in globals.css). Keep hex out of atlas/scene; add
 * a token here instead.
 */
import type { RoomKind } from "@agentopia/shared";

export const PURPLE = 0x7357f6; // violet
export const GOLD = 0xffc66d; // the lamp
export const GREY = 0xa8b4ca; // mist
export const BLACK = 0x111326; // navy
export const WHITE = 0xffffff;

/** Lightness steps (cool neutral ramp and violet steps). */
export const PURPLE_DEEP = 0x5b3fd9; // violet-deep
export const LAVENDER = 0xb8a7ff; // violet toward white
export const CHARCOAL = 0x242d43; // navy-700 / stone-800
export const GRAPHITE = 0x3a4561; // stone-700
export const SILVER = 0x7d889f; // stone-500: the mid grey (baseboards, frames, unlit bulbs)
export const MIST = 0xcbd2e1; // stone-300: wall body, desk tops

/** Body tint for desaturated (offline) characters. Multiplies, so it only dims. */
export const DIM_TINT = 0x9aa0ad;

/** Legacy names kept for callers; mapped onto the five hues. */
export const INK = BLACK;
export const PARCHMENT = WHITE;
export const MOSS = PURPLE;
export const BRICK = BLACK;
export const SKY = PURPLE;
export const SAFFRON = GOLD;

/** 0xRRGGBB to a CSS "#rrggbb" string (for DOM overlays such as name labels). */
export function cssHex(c: number): string {
  return `#${c.toString(16).padStart(6, "0")}`;
}

/** 0xRRGGBB plus alpha to a CSS rgba() string. */
export function cssRgba(c: number, alpha: number): string {
  return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${alpha})`;
}

/**
 * Character outfits. Names are the avatar palette ids stored on employees
 * (see AVATAR_PALETTES in components/avatar-swatch.tsx) plus "ink" used by the
 * demo data; each maps to a combination of the brand hues.
 */
export const CHARACTER_PALETTES = [
  { name: "moss", shirt: GOLD, pants: BLACK, accent: WHITE }, // gold shirt
  { name: "brick", shirt: BLACK, pants: GRAPHITE, accent: GOLD }, // navy shirt, gold collar
  { name: "sky", shirt: GREY, pants: BLACK, accent: WHITE }, // mist shirt
  { name: "saffron", shirt: WHITE, pants: BLACK, accent: PURPLE }, // white shirt, violet trim
  { name: "ink", shirt: GRAPHITE, pants: BLACK, accent: LAVENDER }, // slate suit
  { name: "plum", shirt: PURPLE, pants: GRAPHITE, accent: GOLD }, // violet and gold
  { name: "teal", shirt: LAVENDER, pants: BLACK, accent: PURPLE_DEEP }, // lavender shirt
] as const;

function tint(c: number, t: number): number {
  return mix(c, WHITE, t);
}

/**
 * Skin: pale gold tints (kept high so the warmer gold does not read orange) and
 * cool neutral steps.
 */
export const SKIN_TONES = [tint(GOLD, 0.88), tint(GOLD, 0.76), 0xeef1f8, 0xd5dbe7, GREY, SILVER] as const;
export const HAIR_COLORS = [BLACK, GRAPHITE, PURPLE, GOLD, SILVER, PURPLE_DEEP] as const;
export const HAIR_STYLES = 4;

export type FloorKey = RoomKind | "CORRIDOR";

/**
 * Floor tiles: white and light washes of the brand hues (two checker variants).
 * GREY (mist) is already light, so its washes use smaller tint amounts than violet.
 */
export const FLOOR_COLORS: Record<FloorKey, readonly [number, number]> = {
  MANAGER_OFFICE: [tint(PURPLE, 0.86), tint(PURPLE, 0.82)], // violet wash
  DEVELOPMENT: [tint(PURPLE, 0.94), tint(PURPLE, 0.91)], // lighter violet wash
  DESIGN: [tint(GOLD, 0.8), tint(GOLD, 0.75)], // gold wash
  RESEARCH: [tint(GREY, 0.78), tint(GREY, 0.72)], // mist wash
  QA: [tint(GREY, 0.6), tint(GREY, 0.55)], // deeper mist wash
  SHARED: [WHITE, tint(GREY, 0.92)],
  LOUNGE: [WHITE, tint(GREY, 0.88)],
  CORRIDOR: [tint(GREY, 0.68), tint(GREY, 0.64)],
};

/**
 * Wall hint per room. Walls stay cool grey; violet rooms tint them lightly. Gold is not used on
 * walls: multiplied over the grey wall texture it turns muddy brown, and the gold floor wash
 * already marks the design room.
 */
const ACCENT: Record<FloorKey, number> = {
  MANAGER_OFFICE: PURPLE,
  DEVELOPMENT: PURPLE,
  DESIGN: GREY,
  RESEARCH: GREY,
  QA: BLACK,
  SHARED: GREY,
  LOUNGE: GREY,
  CORRIDOR: GREY,
};

export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Tint applied to the (light grey) wall texture of a room. */
export function wallTint(kind: FloorKey): number {
  return mix(ACCENT[kind], WHITE, 0.72);
}

export function greyOf(c: number): number {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const l = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
  return (l << 16) | (l << 8) | l;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Map an avatar spec to atlas indices. Unknown palette names hash deterministically. */
export function resolveAvatar(avatar: { palette: string; hair: number; skin: number } | null | undefined, fallbackSeed: string) {
  const name = avatar?.palette ?? "";
  let palette = CHARACTER_PALETTES.findIndex((p) => p.name === name.toLowerCase());
  if (palette < 0) palette = hash(name || fallbackSeed) % CHARACTER_PALETTES.length;
  const hairN = Number.isFinite(avatar?.hair) ? Math.abs(Math.trunc(avatar!.hair)) : hash(fallbackSeed + "h");
  const skinN = Number.isFinite(avatar?.skin) ? Math.abs(Math.trunc(avatar!.skin)) : hash(fallbackSeed + "s");
  return {
    palette,
    hairStyle: hairN % HAIR_STYLES,
    hairColor: HAIR_COLORS[Math.floor(hairN / HAIR_STYLES) % HAIR_COLORS.length]!,
    skin: SKIN_TONES[skinN % SKIN_TONES.length]!,
  };
}
