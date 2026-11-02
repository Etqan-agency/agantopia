import type { CSSProperties, ReactNode } from "react";
import { CHARACTER_PALETTES, GOLD, HAIR_COLORS, BLACK, SKIN_TONES, cssHex, mix } from "@/office/palette";
import { cn } from "@/lib/utils";
import {
  NARROW_LAYOUT,
  TABLET_LAYOUT,
  WIDE_LAYOUT,
  computeHeroScene,
  r2,
  tagBox,
  type Facing,
  type HeroScene,
  type Member,
  type PlacedCharacter,
  type Tag,
} from "./hero-scene-geometry";

/**
 * Homepage hero scene ("Hero B"): the owner at a gold rail watching a team of twelve AI
 * employees in a breathing gold spotlight, over a perspective grid with a faint HUD.
 *
 * Server component. The canonical layouts (wide, tablet, phone) are rendered into the HTML with a fixed viewBox and
 * swapped by CSS at 560px and 900px, so first paint never waits for JavaScript and nothing shifts. Motion is
 * CSS only (globals.css, "homepage hero"). The whole drawing is decorative (aria-hidden); the hero
 * section carries a visually hidden sentence describing it.
 */

const v = (token: string) => `var(--color-${token})`;
const C = {
  navy: v("navy"),
  navy800: v("navy-800"),
  navy950: v("navy-950"),
  violet: v("violet"),
  lavender: v("lavender"),
  gold: v("gold"),
  goldDeep: v("gold-deep"),
  snow: v("snow"),
  mist: v("mist"),
  white: v("white"),
  stone300: v("stone-300"),
  stone500: v("stone-500"),
  stone800: v("stone-800"),
} as const;

/** Office palette numbers that have a CSS token; anything else (skin tints) falls back to its hex. */
const TOKEN_OF: Record<number, string> = {
  0x7357f6: "violet",
  0x5b3fd9: "violet-deep",
  0xb8a7ff: "lavender",
  0xffc66d: "gold",
  0xa8b4ca: "mist",
  0x111326: "navy",
  0xffffff: "white",
  0x3a4561: "stone-700",
  0x7d889f: "stone-500",
  0xeef1f8: "stone-100",
};
const paint = (n: number) => (TOKEN_OF[n] ? v(TOKEN_OF[n]) : cssHex(n));

/** The owner is lit from the spotlight only: skin and cloth in shadow are navy mixed toward gold. */
const shade = (t: number) => cssHex(mix(BLACK, GOLD, t));
const OWNER = {
  skin: shade(0.33),
  skinLit: shade(0.52),
  ear: shade(0.44),
  neck: shade(0.24),
  seam: shade(0.06),
  seamLit: shade(0.12),
  strand: shade(0.08),
  strandDark: shade(0.04),
  collarBand: shade(0.04),
};

function outfitOf(name: Member["o"]) {
  const p = CHARACTER_PALETTES.find((x) => x.name === name)!;
  return { shirt: paint(p.shirt), pants: paint(p.pants), accent: paint(p.accent) };
}

/* ------------------------------------------------------------------ characters */

function Hair({ style, facing, colour }: { style: number; facing: Facing; colour: string }) {
  const back = facing === "up";
  const parts: ReactNode[] = [];
  if (back) parts.push(<circle key="b" cx="16" cy="11" r="9" />);
  else {
    parts.push(<path key="cap" d="M7 11 A9 9 0 0 1 25 11 L25 11.5 L7 11.5 Z" />);
    if (facing === "down") {
      parts.push(<circle key="f1" cx="11.5" cy="10.5" r="2.6" />, <circle key="f2" cx="16" cy="9.5" r="2.6" />, <circle key="f3" cx="20.5" cy="10.5" r="2.6" />);
    } else parts.push(<rect key="side" x="7" y="10" width="7" height="9" rx="3" />);
  }
  if (style === 1) {
    if (back) parts.push(<rect key="s1" x="8" y="11" width="16" height="10" rx="4" />);
    else if (facing === "down") parts.push(<rect key="s1a" x="6" y="9" width="4" height="11" rx="2" />, <rect key="s1b" x="22" y="9" width="4" height="11" rx="2" />);
    else parts.push(<rect key="s1" x="7" y="11" width="7" height="10" rx="3" />);
  } else if (style === 2) {
    parts.push(<circle key="bun" cx="16" cy={back ? 5 : 2} r="3.6" />);
  } else if (style === 3) {
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      parts.push(<circle key={`c${i}`} cx={r2(16 + Math.cos(a) * 8.5)} cy={r2(11 + Math.sin(a) * 8.5)} r="3" />);
    }
  }
  return <g fill={colour}>{parts}</g>;
}

/** The product lamp (office-floor-svg Lamp), floating above the head. */
function LampAbove({ kind, delay, idp }: { kind: "steady" | "seq"; delay: number; idp: string }) {
  const shadeD = "M-4.5 1.6 L4.5 1.6 L2.7 -3 L-2.7 -3 Z";
  return (
    <g className={cn(kind === "steady" && "hero-b-lamp-steady")} style={{ "--d": `${delay}s` } as CSSProperties} transform="translate(0 -38)">
      <path d={shadeD} fill="none" stroke={C.mist} strokeOpacity=".55" strokeWidth=".7" />
      <g className="hero-b-lamp-on">
        <circle cx="0" cy="0" r="7.5" fill={`url(#${idp}lampGlow)`} />
        <path d={shadeD} fill={C.gold} stroke={C.navy} strokeOpacity=".45" strokeWidth=".5" />
        <circle cx="0" cy="2.4" r="1.6" fill={C.white} opacity=".95" />
      </g>
    </g>
  );
}

/** One employee in the live office's round-headed style (32-unit frame, feet at 16,32). */
function Character({ c, idp }: { c: PlacedCharacter; idp: string }) {
  const m = c.member;
  const o = outfitOf(m.o);
  const skin = paint(SKIN_TONES[m.skin % SKIN_TONES.length]!);
  const hair = paint(HAIR_COLORS[m.hair % HAIR_COLORS.length]!);
  const facing = m.f;
  const side = facing === "left" || facing === "right";
  const flip = facing === "left";
  const ol = { stroke: C.navy, strokeOpacity: 0.35, strokeWidth: 0.7 };
  const gx = m.g ? -1.7 : 0;
  return (
    <g transform={`translate(${r2(c.x)} ${r2(c.y)}) scale(${r2(c.k)})`}>
      <ellipse cx="0" cy="-1.5" rx="10" ry="2.8" fill={C.navy} opacity=".5" />
      <g transform={`translate(-16 -32)${flip ? " translate(32 0) scale(-1 1)" : ""}`}>
        {/* legs */}
        {side ? (
          <>
            <rect x="14" y="24" width="4" height="6" fill={o.pants} />
            <rect x="14.5" y="29" width="4.5" height="2" fill={C.stone800} />
          </>
        ) : (
          <>
            <rect x="11.5" y="24" width="3.5" height="6" fill={o.pants} />
            <rect x="17" y="24" width="3.5" height="6" fill={o.pants} />
            <rect x="11.5" y="29" width="3.5" height="2" fill={C.stone800} />
            <rect x="17" y="29" width="3.5" height="2" fill={C.stone800} />
          </>
        )}
        {/* torso */}
        {side ? (
          <rect x="11" y="15" width="10" height="11" rx="4" fill={o.shirt} {...ol} />
        ) : (
          <>
            <rect x="9" y="15" width="14" height="11" rx="4.5" fill={o.shirt} {...ol} />
            {facing === "down" ? (
              <>
                <path d="M13 15 L19 15 L16 18.5 Z" fill={o.accent} />
                <rect x="15.4" y="18.5" width="1.2" height="6" fill={o.accent} opacity=".55" />
              </>
            ) : (
              <rect x="10" y="22" width="12" height="1.2" fill={C.navy} opacity=".15" />
            )}
          </>
        )}
        {/* arms and props */}
        {side ? (
          m.p === "laptop" ? (
            <>
              <rect x="14" y="18" width="9" height="3.5" rx="1.7" fill={o.shirt} />
              <rect x="21.5" y="15.5" width="1.6" height="8" rx=".6" fill={C.stone300} />
            </>
          ) : (
            <>
              <rect x="14.5" y="16.5" width="3.5" height="8" rx="1.7" fill={o.shirt} {...ol} />
              <circle cx="16.25" cy="24.8" r="1.5" fill={skin} />
            </>
          )
        ) : m.p === "laptop" && facing === "down" ? (
          <>
            <rect x="6.5" y="16" width="3.5" height="6" rx="1.7" fill={o.shirt} />
            <rect x="22" y="16" width="3.5" height="6" rx="1.7" fill={o.shirt} />
            <rect x="9.5" y="17.2" width="13" height="8.6" rx="1.2" fill={C.stone300} stroke={C.navy} strokeOpacity=".4" strokeWidth=".6" />
            <circle cx="16" cy="21.5" r="1.1" fill={C.violet} opacity=".8" />
            <circle cx="9.6" cy="23" r="1.5" fill={skin} />
            <circle cx="22.4" cy="23" r="1.5" fill={skin} />
          </>
        ) : (
          <>
            <rect x="6.5" y="16" width="3.5" height="8" rx="1.7" fill={o.shirt} {...ol} />
            <rect x="22" y="16" width="3.5" height="8" rx="1.7" fill={o.shirt} {...ol} />
            <circle cx="8.25" cy="24.6" r="1.5" fill={skin} />
            <circle cx="23.75" cy="24.6" r="1.5" fill={skin} />
            {m.p === "folder" ? (
              <>
                <g transform="rotate(-8 25 22)">
                  <rect x="22.6" y="17.6" width="6" height="8" rx=".7" fill={C.gold} stroke={C.navy} strokeOpacity=".5" strokeWidth=".6" />
                  <rect x="22.6" y="17.6" width="2.6" height="1.4" fill={C.goldDeep} />
                </g>
                <circle cx="23.75" cy="22.6" r="1.5" fill={skin} />
              </>
            ) : null}
          </>
        )}
        {/* head */}
        <circle cx="16" cy="12" r="8.5" fill={skin} stroke={C.navy} strokeOpacity=".3" strokeWidth=".6" />
        {facing === "down" ? (
          <>
            <circle cx={13 + gx} cy="13" r="1.25" fill={C.navy} />
            <circle cx={19 + gx} cy="13" r="1.25" fill={C.navy} />
          </>
        ) : side ? (
          <circle cx="20.5" cy="13" r="1.25" fill={C.navy} />
        ) : null}
        <Hair style={m.st} facing={flip ? "right" : facing} colour={hair} />
        {/* top light from the spotlight */}
        <path d="M9.2 7.4 A8.5 8.5 0 0 1 22.8 7.4" fill="none" stroke={C.gold} strokeOpacity=".75" strokeWidth=".9" strokeLinecap="round" />
      </g>
      {m.lamp ? <LampAbove kind={m.lamp} delay={c.lampDelay} idp={idp} /> : null}
    </g>
  );
}

/** Role tag, or the status pill (gold dot) the product shows over a working employee. */
function TagPill({ t }: { t: Tag }) {
  const { w, h } = tagBox(t.text, t.fs, t.dot);
  return (
    <g transform={`translate(${r2(t.x - w / 2)} ${r2(t.y - h / 2)})`}>
      <rect width={w} height={h} rx={h / 2} fill={C.navy} fillOpacity=".86" stroke={t.dot ? C.gold : C.white} strokeOpacity={t.dot ? ".55" : ".14"} />
      {t.dot ? <circle cx={h / 2 + 1} cy={h / 2} r="2.8" fill={C.gold} /> : null}
      <text
        x={t.dot ? h / 2 + 8 : w / 2}
        y={r2(h / 2 + t.fs * 0.36)}
        fontSize={t.fs}
        fontWeight="500"
        fill={t.dot ? C.snow : C.mist}
        textAnchor={t.dot ? undefined : "middle"}
      >
        {t.text}
      </text>
    </g>
  );
}

/* ----------------------------------------------------------------------- owner */

/** One larger human seen from behind at three-quarter, turned toward the team, gold rim light. */
function Owner({ x, y, u, idp }: { x: number; y: number; u: number; idp: string }) {
  const jacket = "M-122 14 L-120 -118 C-120 -164 -98 -188 -54 -198 C-40 -201 -30 -204 -24 -207 L32 -207 C44 -203 72 -196 92 -184 C114 -170 120 -142 118 -112 L120 14 Z";
  const rim = { fill: "none", stroke: C.gold, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <g transform={`translate(${x} ${y}) scale(${u})`}>
      <defs>
        {/* Gradients are the one place raw hex is kept: near-black navy shades with a warm edge. */}
        <linearGradient id={`${idp}jk`} x1="-120" y1="0" x2="120" y2="-60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#080A17" />
          <stop offset=".55" stopColor="#0E1124" />
          <stop offset="1" stopColor="#2A2630" />
        </linearGradient>
        <linearGradient id={`${idp}hr`} x1="-40" y1="0" x2="50" y2="-30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#05060D" />
          <stop offset=".7" stopColor="#0D0E18" />
          <stop offset="1" stopColor="#3A3024" />
        </linearGradient>
      </defs>
      <path d={jacket} fill={`url(#${idp}jk)`} />
      <path d="M-90 -172 C-98 -120 -102 -60 -100 14" fill="none" stroke={OWNER.seam} strokeWidth="2.4" />
      <path d="M86 -170 C94 -120 98 -60 98 14" fill="none" stroke={OWNER.seamLit} strokeWidth="2.4" />
      <path d="M4 -196 L6 14" stroke={OWNER.seam} strokeWidth="2.4" />
      <path d="M-40 -200 C-20 -190 22 -190 46 -200 L40 -212 C20 -204 -18 -204 -34 -212 Z" fill={OWNER.collarBand} />
      <path d="M-26 -208 C-10 -200 18 -200 34 -208 L32 -216 C16 -209 -10 -209 -24 -216 Z" fill={C.stone500} />
      <path d="M-20 -214 L-18 -238 L26 -238 L30 -214 Z" fill={OWNER.neck} />
      <circle cx="6" cy="-272" r="42" fill={OWNER.skin} />
      <path d="M44 -268 C50 -250 44 -236 32 -228 L26 -236 C36 -244 40 -256 40 -268 Z" fill={OWNER.skinLit} />
      <ellipse cx="42" cy="-262" rx="7" ry="11" fill={OWNER.ear} />
      <path
        d="M-36 -258 C-46 -298 -12 -322 14 -318 C40 -314 54 -294 50 -270 C46 -276 38 -278 35 -270 C33 -262 36 -250 32 -238 C26 -230 8 -226 -10 -228 C-24 -230 -34 -244 -36 -258 Z"
        fill={`url(#${idp}hr)`}
      />
      <path d="M-16 -308 C2 -314 24 -310 38 -298" fill="none" stroke={OWNER.strand} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M-28 -284 C-12 -294 12 -294 30 -284" fill="none" stroke={OWNER.strandDark} strokeWidth="2" strokeLinecap="round" />
      {/* gold rim light: hair crown, ear, neck, right shoulder and arm */}
      <path d="M-6 -317 C20 -320 46 -304 51 -276" {...rim} strokeWidth="3.2" />
      <path d="M48 -270 C51 -258 48 -246 40 -238" {...rim} strokeWidth="2.4" strokeOpacity=".85" />
      <path d="M28 -236 L31 -214" {...rim} strokeWidth="2" strokeOpacity=".7" />
      <path d="M34 -208 C48 -202 74 -195 92 -184 C114 -170 120 -142 118 -112 L120 14" {...rim} strokeWidth="3.2" />
      <path d="M-54 -198 C-80 -192 -104 -176 -114 -150" {...rim} strokeWidth="1.6" strokeOpacity=".3" />
    </g>
  );
}

/* ----------------------------------------------------------------------- scene */

function Scene({ scene, idp, band, className }: { scene: HeroScene; idp: string; band: number; className?: string }) {
  const { layout: l, frame: f, grid, plan, network, arcs, feed, spotlight: sp, team, rail } = scene;
  const { W, H, narrow } = l;
  const id = (n: string) => `${idp}${n}`;
  const url = (n: string) => `url(#${idp}${n})`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
      className={cn("font-sans", "hero-b-slice", narrow && "hero-b-slice-narrow", className)}
      style={{ "--vw": W, "--vh": H, "--band": band } as CSSProperties}
    >
      <defs>
        <linearGradient id={id("gridStroke")} x1="0" y1="0" x2={W} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={C.gold} stopOpacity=".16" />
          <stop offset=".5" stopColor={C.gold} stopOpacity=".3" />
          <stop offset="1" stopColor={C.gold} stopOpacity=".16" />
        </linearGradient>
        <linearGradient id={id("gridFade")} x1="0" y1={r2(f.horizon)} x2="0" y2={H} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={C.white} stopOpacity="0" />
          <stop offset=".1" stopColor={C.white} stopOpacity=".25" />
          <stop offset=".38" stopColor={C.white} stopOpacity=".9" />
          <stop offset="1" stopColor={C.white} stopOpacity="1" />
        </linearGradient>
        <mask id={id("gridMask")} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect x="0" y={r2(f.horizon)} width={W} height={r2(H - f.horizon)} fill={url("gridFade")} />
        </mask>
        <radialGradient id={id("haze")} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor={C.violet} stopOpacity=".28" />
          <stop offset=".55" stopColor={C.violet} stopOpacity=".1" />
          <stop offset="1" stopColor={C.violet} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("pool")} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor={C.gold} stopOpacity=".5" />
          <stop offset=".35" stopColor={C.gold} stopOpacity=".34" />
          <stop offset=".7" stopColor={C.goldDeep} stopOpacity=".12" />
          <stop offset="1" stopColor={C.goldDeep} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("poolWide")} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor={C.gold} stopOpacity=".14" />
          <stop offset="1" stopColor={C.gold} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("beam")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.gold} stopOpacity="0" />
          <stop offset=".6" stopColor={C.gold} stopOpacity=".035" />
          <stop offset="1" stopColor={C.gold} stopOpacity=".09" />
        </linearGradient>
        <radialGradient id={id("lampGlow")} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor={C.gold} stopOpacity=".55" />
          <stop offset="1" stopColor={C.gold} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("panel")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.navy800} stopOpacity=".92" />
          <stop offset="1" stopColor={C.navy950} stopOpacity=".98" />
        </linearGradient>
        <radialGradient id={id("edgeShade")} cx=".5" cy=".42" r=".75">
          <stop offset=".55" stopColor={C.navy} stopOpacity="0" />
          <stop offset="1" stopColor={C.navy} stopOpacity=".75" />
        </radialGradient>
      </defs>

      {/* violet haze at the horizon */}
      <ellipse cx={f.vpx} cy={r2(f.horizon + 10)} rx={r2(W * (narrow ? 0.7 : 0.48))} ry={narrow ? 110 : 120} fill={url("haze")} />

      {/* perspective floor grid */}
      <g mask={url("gridMask")} stroke={url("gridStroke")} strokeWidth="1" fill="none">
        {grid.radial.map((g, i) => (
          <line key={`r${i}`} {...g} />
        ))}
        {grid.cross.map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2={W} y2={y} />
        ))}
      </g>
      <line x1="0" y1={r2(f.horizon)} x2={W} y2={r2(f.horizon)} stroke={C.lavender} strokeOpacity=".12" />

      {/* background HUD, kept at or under 15% opacity */}
      <g fill="none">
        <g transform={`translate(${plan.ox} ${plan.oy})`} stroke={C.lavender} strokeOpacity=".15" strokeWidth="1">
          <rect x="0" y="0" width={plan.outline.w} height={plan.outline.h} strokeOpacity=".1" />
          {plan.rooms.map((rm) => (
            <g key={rm.name}>
              <rect x={rm.x} y={rm.y} width={rm.w} height={rm.h} rx="2" />
              {plan.labels ? (
                <text x={r2(rm.x + 5)} y={r2(rm.y + 12)} fontSize="9" fill={C.lavender} fillOpacity=".22" stroke="none">
                  {rm.name}
                </text>
              ) : null}
            </g>
          ))}
          {plan.lamps.map((d, j) => (
            <circle key={j} cx={d.cx} cy={d.cy} r={d.r} stroke="none" fill={C.gold} fillOpacity={d.bright ? ".32" : ".12"} />
          ))}
        </g>

        <g stroke={C.lavender} strokeOpacity=".16" strokeWidth="1">
          {network.edges.map((e, i) => (
            <line key={i} {...e} />
          ))}
        </g>
        {network.nodes.map((n, i) => (
          <g key={i}>
            {n.gold ? <circle cx={n.cx} cy={n.cy} r={n.r + 5} stroke={C.gold} strokeOpacity=".28" strokeDasharray="1.5 3" /> : null}
            <circle
              cx={n.cx}
              cy={n.cy}
              r={n.r}
              fill={n.gold ? C.gold : C.lavender}
              fillOpacity={n.gold ? ".42" : ".2"}
              stroke={n.gold ? C.gold : C.lavender}
              strokeOpacity=".3"
            />
          </g>
        ))}

        <g stroke={C.gold} strokeOpacity=".13">
          <path d={arcs.main} />
          <path d={arcs.outer} strokeDasharray="2 6" />
          {arcs.ticks.map((t, i) => (
            <line key={i} {...t} />
          ))}
        </g>

        {feed.length ? (
          <g fontSize="11" textAnchor="end" stroke="none">
            {feed.map((line) => (
              <g key={line.text}>
                <text x={line.x} y={line.y} fill={C.mist} fillOpacity={line.opacity}>
                  {line.text}
                </text>
                <circle cx={line.dot.cx} cy={line.dot.cy} r="2.2" fill={C.gold} fillOpacity={line.dot.opacity} />
              </g>
            ))}
          </g>
        ) : null}
      </g>

      {/* spotlight: faint beam, wide pool, breathing pool, floor rings */}
      <path d={sp.beam} fill={url("beam")} />
      <ellipse cx={sp.cx} cy={sp.cy} rx={sp.wide.rx} ry={sp.wide.ry} fill={url("poolWide")} />
      <g className="hero-b-breathe">
        <ellipse cx={sp.cx} cy={sp.cy} rx={sp.pool.rx} ry={sp.pool.ry} fill={url("pool")} />
      </g>
      <ellipse cx={sp.cx} cy={sp.cy} rx={sp.ringInner.rx} ry={sp.ringInner.ry} fill="none" stroke={C.gold} strokeOpacity=".4" strokeDasharray="2 7" />
      <ellipse cx={sp.cx} cy={sp.cy} rx={sp.ringOuter.rx} ry={sp.ringOuter.ry} fill="none" stroke={C.gold} strokeOpacity=".16" />

      {/* the team, back to front */}
      <g>
        {team.chars.map((c) => (
          <Character key={c.key} c={c} idp={idp} />
        ))}
      </g>
      <g>
        {team.tags.map((t) => (
          <TagPill key={t.key} t={t} />
        ))}
      </g>
      {team.pills.map((t) => (
        <TagPill key={t.key} t={t} />
      ))}

      {/* HUD connectors with a travelling dash */}
      <g>
        {scene.connectors.map((cn) => (
          <g key={cn.key} transform={`translate(${cn.x} ${cn.y}) rotate(${cn.angle})`}>
            <line x1="0" y1="0" x2={cn.len} y2="0" stroke={C.lavender} strokeOpacity=".22" />
            <line
              className="hero-b-dash"
              x1="0"
              y1="0"
              x2="14"
              y2="0"
              stroke={C.gold}
              strokeOpacity=".85"
              strokeWidth="1.6"
              strokeLinecap="round"
              style={{ "--len": `${r2(cn.len - 14)}px`, "--t": `${cn.duration}s`, "--d": `${cn.delay}s` } as CSSProperties}
            />
          </g>
        ))}
      </g>

      {/* edge shade, then the balcony and the owner at the gold rail */}
      <rect x="0" y="0" width={W} height={H} fill={url("edgeShade")} />
      <path d={rail.panel} fill={url("panel")} />
      {rail.posts.map((p, i) => (
        <line key={i} {...p} stroke={C.gold} strokeOpacity=".45" strokeWidth={rail.postWidth} />
      ))}
      <line {...rail.endPost} stroke={C.gold} strokeOpacity=".55" strokeWidth={rail.endPostWidth} />
      <line {...rail.baseRail} stroke={C.gold} strokeOpacity=".3" strokeWidth="1" />
      <line {...rail.handrail} stroke={C.gold} strokeWidth={rail.handrailWidth} strokeLinecap="round" />
      <Owner x={rail.owner.x} y={rail.owner.y} u={rail.owner.u} idp={id("own-")} />
    </svg>
  );
}

/** Height of the concept's own top bar inside its hero (the band the site navbar replaces). */
const CONCEPT_TOPBAR = { wide: 72, tablet: 72, narrow: 64 } as const;
const WIDE_SCENE = computeHeroScene(WIDE_LAYOUT);
const TABLET_SCENE = computeHeroScene(TABLET_LAYOUT);
const NARROW_SCENE = computeHeroScene(NARROW_LAYOUT);

/** All canonical layouts in the server HTML; CSS shows one (560px and 900px, the concept's breakpoints). */
export function HeroSceneB({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", "hero-b-frame", className)}>
      <Scene scene={WIDE_SCENE} idp="hbw-" band={CONCEPT_TOPBAR.wide} className="hidden min-[900px]:block" />
      <Scene scene={TABLET_SCENE} idp="hbt-" band={CONCEPT_TOPBAR.tablet} className="hidden min-[561px]:block min-[900px]:hidden" />
      <Scene scene={NARROW_SCENE} idp="hbn-" band={CONCEPT_TOPBAR.narrow} className="min-[561px]:hidden" />
    </div>
  );
}

/** Vignette class for the copy block (defined with the scene's CSS). */
export const heroVignetteClass = "hero-b-vignette";
