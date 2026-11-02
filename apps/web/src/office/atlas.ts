/**
 * Procedural texture atlas. Every frame is drawn once with `Graphics`, packed
 * into a single container and rendered with ONE `renderer.generateTexture()`
 * call. All frames are sub-textures of that one source, so every sprite in the
 * scene can be batched together. No external image assets are used.
 *
 * Characters are layered from three atlas frames that share the source:
 *   body  (palette × facing × {walk0, walk1, type}) : coloured
 *   head  (facing)                                   : white, tinted by skin
 *   hair  (style × facing)                           : white, tinted by hair colour
 */
import { Container, Graphics, Rectangle, Texture, type Renderer } from "pixi.js";
import {
  BLACK, CHARACTER_PALETTES, CHARCOAL, FLOOR_COLORS, GOLD, GRAPHITE, GREY, HAIR_STYLES, MIST, mix, PURPLE, PURPLE_DEEP, SILVER, WHITE,
  type FloorKey,
} from "./palette";
import type { Facing } from "./floor-plan";
import type { IconKind } from "./state-machine";

export const FACINGS: Facing[] = ["down", "up", "left", "right"];
export const BODY_FRAMES = ["walk0", "walk1", "type"] as const;
export type BodyFrame = (typeof BODY_FRAMES)[number];

export type Atlas = {
  source: Texture;
  textures: Map<string, Texture>;
  get(name: string): Texture;
  destroy(): void;
};

type Spec = { name: string; w: number; h: number; draw: (g: Graphics) => void };

const ATLAS_WIDTH = 512;
const PAD = 2;
const RESOLUTION = 2;

export function bodyKey(palette: number, facing: Facing, frame: BodyFrame): string {
  return `body:${palette}:${facing}:${frame}`;
}
export function headKey(facing: Facing): string {
  return `head:${facing}`;
}
export function hairKey(style: number, facing: Facing): string {
  return `hair:${style}:${facing}`;
}
export function floorKey(kind: FloorKey, variant: 0 | 1): string {
  return `floor:${kind}:${variant}`;
}
export function iconKey(icon: IconKind): string {
  return `icon:${icon}`;
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function drawBody(g: Graphics, palette: (typeof CHARACTER_PALETTES)[number], facing: Facing, frame: BodyFrame) {
  const { shirt, pants, accent } = palette;
  const shoe = CHARCOAL;
  const sleeve = shirt;
  const side = facing === "left" || facing === "right";
  const dir = facing === "left" ? -1 : 1;
  // shadow
  g.ellipse(16, 30, 9, 2.6).fill({ color: BLACK, alpha: 0.18 });

  // legs
  if (frame === "walk1") {
    if (side) {
      g.rect(16 - 4 + dir * 2, 24, 3.5, 6).fill(pants);
      g.rect(16 + 0.5 - dir * 3, 24, 3.5, 5.5).fill(pants);
      g.rect(16 - 4 + dir * 2, 29, 4, 2).fill(shoe);
      g.rect(16 + 0.5 - dir * 3, 28.5, 4, 2).fill(shoe);
    } else {
      g.rect(11.5, 24, 3.5, 4.5).fill(pants);
      g.rect(17, 24, 3.5, 6.5).fill(pants);
      g.rect(11.5, 27.5, 3.5, 2).fill(shoe);
      g.rect(17, 29, 3.5, 2).fill(shoe);
    }
  } else if (frame === "type") {
    // seated: short legs tucked under
    g.rect(11.5, 24, 3.5, 4).fill(pants);
    g.rect(17, 24, 3.5, 4).fill(pants);
    g.rect(11.5, 27, 3.5, 2).fill(shoe);
    g.rect(17, 27, 3.5, 2).fill(shoe);
  } else {
    if (side) {
      g.rect(14, 24, 4, 6).fill(pants);
      g.rect(14 + dir * 0.5, 29, 4.5, 2).fill(shoe);
    } else {
      g.rect(11.5, 24, 3.5, 6).fill(pants);
      g.rect(17, 24, 3.5, 6).fill(pants);
      g.rect(11.5, 29, 3.5, 2).fill(shoe);
      g.rect(17, 29, 3.5, 2).fill(shoe);
    }
  }

  // torso
  if (side) {
    g.roundRect(11, 15, 10, 11, 4).fill(shirt);
  } else {
    g.roundRect(9, 15, 14, 11, 4.5).fill(shirt);
    if (facing === "down") {
      g.poly([13, 15, 19, 15, 16, 18.5]).fill(accent);
      g.rect(15.4, 18.5, 1.2, 6).fill({ color: accent, alpha: 0.55 });
    } else {
      g.rect(10, 22, 12, 1.2).fill({ color: BLACK, alpha: 0.12 });
    }
  }

  // arms
  const armShade = { color: BLACK, alpha: 0.12 };
  if (frame === "type") {
    if (facing === "down") {
      g.roundRect(8, 17, 4, 7, 2).fill(sleeve);
      g.roundRect(20, 17, 4, 7, 2).fill(sleeve);
      g.roundRect(10, 22.5, 5, 3, 1.5).fill(sleeve);
      g.roundRect(17, 22.5, 5, 3, 1.5).fill(sleeve);
      g.circle(14.5, 24.5, 1.4).fill(accent);
      g.circle(17.5, 24.5, 1.4).fill(accent);
    } else if (facing === "up") {
      g.roundRect(7.5, 16, 4, 5, 2).fill(sleeve);
      g.roundRect(20.5, 16, 4, 5, 2).fill(sleeve);
    } else {
      g.roundRect(14, 18, 9 * (dir > 0 ? 1 : 1), 3.5, 1.7).fill(sleeve);
      if (dir < 0) {
        g.clear();
        drawBody(g, palette, "right", frame);
        g.scale.x = -1;
        g.pivot.x = 32;
        return;
      }
      g.circle(23, 19.7, 1.5).fill(accent);
    }
  } else if (side) {
    const swing = frame === "walk1" ? 2.5 : 0;
    g.roundRect(14.5 + swing * dir, 16.5, 3.5, 8, 1.7).fill(sleeve);
    g.roundRect(14.5 + swing * dir, 22, 3.5, 2.5, 1.2).fill(armShade);
  } else {
    const swing = frame === "walk1" ? 1.5 : 0;
    g.roundRect(6.5, 16 + swing, 3.5, 8, 1.7).fill(sleeve);
    g.roundRect(22, 16 - swing, 3.5, 8, 1.7).fill(sleeve);
    g.roundRect(6.5, 22 + swing, 3.5, 2.2, 1.1).fill(armShade);
    g.roundRect(22, 22 - swing, 3.5, 2.2, 1.1).fill(armShade);
  }
}

function drawHead(g: Graphics, facing: Facing) {
  // Drawn white; tinted per employee with the skin tone.
  g.circle(10, 10, 8.5).fill(WHITE);
  g.ellipse(10, 13.5, 6.5, 3).fill({ color: BLACK, alpha: 0.05 });
  const eye = BLACK;
  if (facing === "down") {
    g.circle(7, 11, 1.25).fill(eye);
    g.circle(13, 11, 1.25).fill(eye);
    g.circle(5.5, 13.2, 1.3).fill({ color: PURPLE, alpha: 0.16 });
    g.circle(14.5, 13.2, 1.3).fill({ color: PURPLE, alpha: 0.16 });
  } else if (facing === "left") {
    g.circle(5.5, 11, 1.25).fill(eye);
    g.circle(4.5, 13.2, 1.2).fill({ color: PURPLE, alpha: 0.16 });
  } else if (facing === "right") {
    g.circle(14.5, 11, 1.25).fill(eye);
    g.circle(15.5, 13.2, 1.2).fill({ color: PURPLE, alpha: 0.16 });
  }
}

function drawHair(g: Graphics, style: number, facing: Facing) {
  // 22×22 frame, head centre at (11, 11). Drawn white; tinted per employee.
  const c = WHITE;
  const cx = 11;
  const cy = 11;
  const cap = () => {
    g.moveTo(cx - 9, cy).arc(cx, cy, 9, Math.PI, Math.PI * 2).lineTo(cx + 9, cy + 0.5).lineTo(cx - 9, cy + 0.5).closePath().fill(c);
  };
  const back = facing === "up";
  if (back) {
    g.circle(cx, cy, 9).fill(c);
  } else {
    cap();
    if (facing === "down") {
      g.circle(cx - 4.5, cy - 0.5, 2.6).fill(c);
      g.circle(cx, cy - 1.5, 2.6).fill(c);
      g.circle(cx + 4.5, cy - 0.5, 2.6).fill(c);
    } else {
      const s = facing === "left" ? 1 : -1; // hair falls on the back side
      g.roundRect(cx + s * 3, cy - 2, 6.5, 8, 3).fill(c);
      g.roundRect(cx - 3.25, cy - 2, 6.5, 8, 3).fill(c);
      if (facing === "left") g.roundRect(cx + 2, cy - 1, 7, 9, 3).fill(c);
      else g.roundRect(cx - 9, cy - 1, 7, 9, 3).fill(c);
    }
  }
  switch (style % HAIR_STYLES) {
    case 1: // long
      if (back) g.roundRect(cx - 8, cy, 16, 10, 4).fill(c);
      else if (facing === "down") {
        g.roundRect(cx - 10, cy - 2, 4, 11, 2).fill(c);
        g.roundRect(cx + 6, cy - 2, 4, 11, 2).fill(c);
      } else g.roundRect(facing === "left" ? cx + 2 : cx - 9, cy, 7, 10, 3).fill(c);
      break;
    case 2: // bun
      g.circle(cx, back ? cy - 6 : cy - 9, 3.6).fill(c);
      break;
    case 3: // curly
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        g.circle(cx + Math.cos(a) * 8.5, cy + Math.sin(a) * 8.5, 3).fill(c);
      }
      if (back) for (let i = 0; i < 3; i++) g.circle(cx - 6 + i * 6, cy + 6, 3).fill(c);
      break;
    default:
      break; // short
  }
}

function drawFloor(g: Graphics, kind: FloorKey, variant: 0 | 1) {
  const [a, b] = FLOOR_COLORS[kind];
  g.rect(0, 0, 32, 32).fill(variant === 0 ? a : b);
  g.rect(0, 0, 32, 1).fill({ color: BLACK, alpha: 0.05 });
  g.rect(0, 0, 1, 32).fill({ color: BLACK, alpha: 0.05 });
  if (kind === "LOUNGE" || kind === "MANAGER_OFFICE") {
    // soft rug weave
    g.rect(4, 15, 24, 1).fill({ color: WHITE, alpha: 0.18 });
  }
  if (kind === "CORRIDOR") {
    g.rect(0, 15.5, 32, 1).fill({ color: WHITE, alpha: 0.12 });
  }
}

function drawWall(g: Graphics) {
  // Grey, lightly tinted per room accent.
  g.rect(0, 0, 32, 32).fill(MIST);
  g.rect(0, 0, 32, 7).fill(WHITE);
  g.rect(0, 26, 32, 6).fill(SILVER);
  g.rect(0, 7, 32, 1).fill({ color: BLACK, alpha: 0.12 });
}

function drawDoor(g: Graphics) {
  g.rect(0, 0, 32, 32).fill(SILVER);
  g.rect(2, 2, 28, 28).fill(MIST);
  for (let i = 0; i < 4; i++) g.rect(4, 6 + i * 6, 24, 1).fill({ color: BLACK, alpha: 0.18 });
}

function drawDesk(g: Graphics, facing: Facing) {
  const top = MIST;
  const edge = GRAPHITE;
  const horizontal = facing === "up" || facing === "down";
  if (horizontal) {
    g.roundRect(1, 4, 30, 22, 2).fill(edge);
    g.roundRect(1, 4, 30, 18, 2).fill(top);
    g.rect(3, 6, 26, 1).fill({ color: WHITE, alpha: 0.2 });
    // drawer on the employee side
    if (facing === "down") g.rect(20, 23, 8, 2).fill({ color: BLACK, alpha: 0.25 });
    else g.rect(4, 23, 8, 2).fill({ color: BLACK, alpha: 0.25 });
    // keyboard + paper
    g.roundRect(10, facing === "down" ? 7 : 15, 12, 4, 1).fill(BLACK);
    g.rect(4, facing === "down" ? 8 : 14, 5, 6).fill(mix(GOLD, WHITE, 0.7));
  } else {
    g.roundRect(5, 1, 22, 30, 2).fill(edge);
    g.roundRect(5, 1, 22, 26, 2).fill(top);
    g.rect(7, 3, 1, 22).fill({ color: WHITE, alpha: 0.2 });
    const kx = facing === "right" ? 8 : 20;
    g.roundRect(kx, 10, 4, 12, 1).fill(BLACK);
    g.rect(facing === "right" ? 19 : 8, 18, 5, 6).fill(mix(GOLD, WHITE, 0.7));
  }
}

function drawChair(g: Graphics) {
  g.ellipse(10, 17, 7, 2).fill({ color: BLACK, alpha: 0.15 });
  g.roundRect(3, 3, 14, 13, 4).fill(CHARCOAL);
  g.roundRect(5, 5, 10, 8, 3).fill(GRAPHITE);
}

function drawMonitor(g: Graphics, employeeFacing: Facing) {
  // Frame 20×18; the monitor faces the employee.
  if (employeeFacing === "down") {
    // We see the back of the monitor.
    g.rect(8, 12, 4, 4).fill(CHARCOAL);
    g.roundRect(2, 2, 16, 11, 2).fill(CHARCOAL);
    g.roundRect(4, 4, 12, 7, 1).fill(GRAPHITE);
  } else if (employeeFacing === "up") {
    g.rect(8, 12, 4, 4).fill(CHARCOAL);
    g.roundRect(2, 2, 16, 11, 2).fill(BLACK);
    g.rect(3.5, 3.5, 13, 8).fill(mix(PURPLE, WHITE, 0.45));
    g.rect(5, 5, 7, 1).fill({ color: WHITE, alpha: 0.7 });
    g.rect(5, 7.5, 9, 1).fill({ color: WHITE, alpha: 0.5 });
  } else {
    const x = employeeFacing === "left" ? 12 : 6;
    g.rect(x - 1, 12, 4, 4).fill(CHARCOAL);
    g.roundRect(x, 1, 3, 13, 1).fill(CHARCOAL);
  }
}

function drawLamp(g: Graphics, on: boolean) {
  // Frame 64×64, bulb at the centre so OFF/ON swap without moving.
  const cx = 32;
  const cy = 32;
  if (on) {
    const rings = [30, 26, 22, 18, 14, 10];
    rings.forEach((r, i) => g.circle(cx, cy + 3, r).fill({ color: GOLD, alpha: 0.07 + i * 0.035 }));
  }
  g.ellipse(cx, cy + 9, 4.5, 1.8).fill(BLACK);
  g.rect(cx - 0.75, cy + 1, 1.5, 8).fill(BLACK);
  g.poly([cx - 6, cy + 2, cx + 6, cy + 2, cx + 3.5, cy - 4, cx - 3.5, cy - 4]).fill(on ? GOLD : GREY);
  g.poly([cx - 6, cy + 2, cx + 6, cy + 2, cx + 3.5, cy - 4, cx - 3.5, cy - 4]).stroke({ width: 0.6, color: BLACK, alpha: on ? 0.45 : 0.3 });
  if (on) {
    g.circle(cx, cy + 2.5, 2.6).fill(mix(GOLD, WHITE, 0.55));
    g.circle(cx, cy + 2.5, 1.3).fill(WHITE);
  } else {
    g.circle(cx, cy + 2.5, 1.8).fill(SILVER);
  }
}

function drawPlant(g: Graphics) {
  g.ellipse(16, 29, 9, 2.5).fill({ color: BLACK, alpha: 0.15 });
  g.poly([9, 19, 23, 19, 21, 29, 11, 29]).fill(BLACK);
  g.rect(9, 19, 14, 2).fill(GRAPHITE);
  const leaf = PURPLE;
  const light = mix(PURPLE, WHITE, 0.3);
  g.circle(16, 11, 7).fill(leaf);
  g.circle(10, 14, 5).fill(leaf);
  g.circle(22, 14, 5).fill(leaf);
  g.circle(13, 8, 4).fill(light);
  g.circle(19, 12, 3).fill(light);
}

function drawBookshelf(g: Graphics) {
  g.rect(1, 2, 30, 28).fill(BLACK);
  g.rect(3, 4, 26, 24).fill(GRAPHITE);
  const colors = [PURPLE, GOLD, WHITE, GREY, mix(PURPLE, WHITE, 0.5), SILVER, PURPLE_DEEP];
  for (let row = 0; row < 3; row++) {
    const y = 4 + row * 8;
    g.rect(3, y + 7, 26, 1.2).fill(BLACK);
    let x = 4;
    let k = row * 3;
    while (x < 27) {
      const w = 2 + ((k * 7) % 3);
      const h = 5 + ((k * 5) % 3);
      g.rect(x, y + 7 - h, w, h).fill(colors[k % colors.length]!);
      x += w + 0.6;
      k++;
    }
  }
}

function drawCoffee(g: Graphics) {
  g.ellipse(16, 30, 10, 2).fill({ color: BLACK, alpha: 0.15 });
  g.roundRect(6, 4, 20, 25, 3).fill(CHARCOAL);
  g.roundRect(8, 6, 16, 6, 2).fill(GRAPHITE);
  g.circle(21, 9, 1.4).fill(GOLD);
  g.rect(10, 15, 12, 10).fill(BLACK);
  g.roundRect(13, 19, 6, 6, 1).fill(WHITE);
  g.rect(13, 19, 6, 1.5).fill(GRAPHITE);
}

function drawWhiteboard(g: Graphics) {
  g.roundRect(2, 3, 60, 24, 2).fill(GREY);
  g.rect(4, 5, 56, 20).fill(WHITE);
  g.moveTo(8, 10).lineTo(26, 10).stroke({ width: 1.5, color: PURPLE });
  g.moveTo(8, 14).lineTo(20, 14).stroke({ width: 1.5, color: PURPLE });
  g.rect(32, 9, 8, 8).stroke({ width: 1.2, color: BLACK });
  g.moveTo(42, 13).lineTo(48, 13).stroke({ width: 1.2, color: BLACK });
  g.rect(50, 9, 6, 8).fill(GOLD).stroke({ width: 1.2, color: BLACK });
  g.moveTo(8, 20).lineTo(30, 20).stroke({ width: 1.2, color: PURPLE });
  g.rect(14, 25, 14, 2).fill(GRAPHITE);
}

function drawFolder(g: Graphics) {
  g.roundRect(0.5, 1, 6, 3, 1).fill(mix(GOLD, BLACK, 0.2));
  g.roundRect(0.5, 2.5, 13, 9, 1).fill(GOLD);
  g.rect(2, 3, 10, 1).fill(WHITE);
  g.rect(1, 9.5, 12, 1).fill({ color: BLACK, alpha: 0.12 });
}

function drawIcon(g: Graphics, icon: IconKind) {
  const cx = 9;
  const cy = 9;
  const disc = (color: number) => {
    g.circle(cx, cy + 0.8, 8).fill({ color: BLACK, alpha: 0.2 });
    g.circle(cx, cy, 8).fill(color);
    g.circle(cx, cy, 8).stroke({ width: 1.2, color: WHITE });
  };
  switch (icon) {
    case "check":
      disc(PURPLE);
      g.moveTo(5, 9.5).lineTo(8, 12.5).lineTo(13.5, 6).stroke({ width: 2.2, color: WHITE, cap: "round", join: "round" });
      break;
    case "cross":
      disc(BLACK);
      g.moveTo(6, 6).lineTo(12, 12).stroke({ width: 2.2, color: WHITE, cap: "round" });
      g.moveTo(12, 6).lineTo(6, 12).stroke({ width: 2.2, color: WHITE, cap: "round" });
      break;
    case "exclamation":
      disc(GOLD);
      g.roundRect(8, 4, 2.2, 6.5, 1).fill(BLACK);
      g.circle(9.1, 13, 1.3).fill(BLACK);
      break;
    case "hourglass":
      disc(GREY);
      g.poly([5.5, 4.5, 12.5, 4.5, 9, 9, 12.5, 13.5, 5.5, 13.5, 9, 9]).fill(WHITE);
      g.poly([7, 12.5, 11, 12.5, 9, 10.5]).fill(GOLD);
      break;
    case "zzz":
      g.roundRect(1, 2, 16, 14, 6).fill({ color: WHITE, alpha: 0.9 });
      g.moveTo(4, 6).lineTo(8, 6).lineTo(4, 10).lineTo(8, 10).stroke({ width: 1.2, color: BLACK });
      g.moveTo(10, 8).lineTo(13, 8).lineTo(10, 11).lineTo(13, 11).stroke({ width: 1, color: BLACK });
      break;
  }
}

function drawSelection(g: Graphics) {
  g.ellipse(16, 6, 14, 5).fill({ color: GOLD, alpha: 0.45 });
  g.ellipse(16, 6, 14, 5).stroke({ width: 1.8, color: GOLD });
  g.ellipse(16, 6, 15, 6).stroke({ width: 0.6, color: BLACK, alpha: 0.5 });
}

// ---------------------------------------------------------------------------

function specs(): Spec[] {
  const out: Spec[] = [];
  CHARACTER_PALETTES.forEach((pal, pi) => {
    for (const f of FACINGS) for (const fr of BODY_FRAMES) out.push({ name: bodyKey(pi, f, fr), w: 32, h: 32, draw: (g) => drawBody(g, pal, f, fr) });
  });
  for (const f of FACINGS) out.push({ name: headKey(f), w: 20, h: 20, draw: (g) => drawHead(g, f) });
  for (let s = 0; s < HAIR_STYLES; s++) for (const f of FACINGS) out.push({ name: hairKey(s, f), w: 22, h: 22, draw: (g) => drawHair(g, s, f) });
  (Object.keys(FLOOR_COLORS) as FloorKey[]).forEach((k) => {
    out.push({ name: floorKey(k, 0), w: 32, h: 32, draw: (g) => drawFloor(g, k, 0) });
    out.push({ name: floorKey(k, 1), w: 32, h: 32, draw: (g) => drawFloor(g, k, 1) });
  });
  out.push({ name: "wall", w: 32, h: 32, draw: drawWall });
  out.push({ name: "door", w: 32, h: 32, draw: drawDoor });
  for (const f of FACINGS) out.push({ name: `desk:${f}`, w: 32, h: 32, draw: (g) => drawDesk(g, f) });
  for (const f of FACINGS) out.push({ name: `monitor:${f}`, w: 20, h: 18, draw: (g) => drawMonitor(g, f) });
  out.push({ name: "chair", w: 20, h: 20, draw: drawChair });
  out.push({ name: "lamp:off", w: 64, h: 64, draw: (g) => drawLamp(g, false) });
  out.push({ name: "lamp:on", w: 64, h: 64, draw: (g) => drawLamp(g, true) });
  out.push({ name: "plant", w: 32, h: 32, draw: drawPlant });
  out.push({ name: "bookshelf", w: 32, h: 32, draw: drawBookshelf });
  out.push({ name: "coffee", w: 32, h: 32, draw: drawCoffee });
  out.push({ name: "whiteboard", w: 64, h: 32, draw: drawWhiteboard });
  out.push({ name: "folder", w: 14, h: 12, draw: drawFolder });
  for (const i of ["check", "cross", "exclamation", "hourglass", "zzz"] as IconKind[]) out.push({ name: iconKey(i), w: 18, h: 18, draw: (g) => drawIcon(g, i) });
  out.push({ name: "selection", w: 32, h: 12, draw: drawSelection });
  return out;
}

/** Shelf-pack frames; returns positions and the atlas height. */
function pack(list: Spec[]): { pos: Map<string, { x: number; y: number }>; height: number } {
  const pos = new Map<string, { x: number; y: number }>();
  // Sort by height (stable) to keep shelves tight.
  const sorted = [...list].sort((a, b) => b.h - a.h);
  let x = PAD;
  let y = PAD;
  let shelf = 0;
  for (const s of sorted) {
    if (x + s.w + PAD > ATLAS_WIDTH) {
      x = PAD;
      y += shelf + PAD;
      shelf = 0;
    }
    pos.set(s.name, { x, y });
    x += s.w + PAD;
    shelf = Math.max(shelf, s.h);
  }
  return { pos, height: Math.ceil(y + shelf + PAD) };
}

/** Builds the atlas once. Call after `app.init()`; destroy with the scene. */
export function buildAtlas(renderer: Renderer): Atlas {
  const list = specs();
  const { pos, height } = pack(list);
  const root = new Container();
  for (const s of list) {
    const g = new Graphics();
    s.draw(g);
    const p = pos.get(s.name)!;
    const holder = new Container();
    holder.position.set(p.x, p.y);
    holder.addChild(g);
    root.addChild(holder);
  }
  const source = renderer.generateTexture({
    target: root,
    frame: new Rectangle(0, 0, ATLAS_WIDTH, height),
    resolution: RESOLUTION,
    antialias: true,
  });
  root.destroy({ children: true });

  const textures = new Map<string, Texture>();
  for (const s of list) {
    const p = pos.get(s.name)!;
    textures.set(s.name, new Texture({ source: source.source, frame: new Rectangle(p.x, p.y, s.w, s.h), label: s.name }));
  }
  return {
    source,
    textures,
    get(name: string) {
      const t = textures.get(name);
      if (!t) throw new Error(`atlas: missing frame ${name}`);
      return t;
    },
    destroy() {
      for (const t of textures.values()) t.destroy(false);
      textures.clear();
      source.destroy(true);
    },
  };
}

/** Exposed for tests/docs: number of frames and atlas size in logical px. */
export function atlasLayout(): { frames: number; width: number; height: number } {
  const list = specs();
  return { frames: list.length, width: ATLAS_WIDTH, height: pack(list).height };
}
