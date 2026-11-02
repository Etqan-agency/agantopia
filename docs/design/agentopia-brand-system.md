# Agentopia brand system

Date: 2026-11-02. Implements sections 1–3 of `docs/design/frontend-refactor-plan.md`.
Tokens live in `apps/web/src/app/globals.css`; the office (Pixi) mirror lives in
`apps/web/src/office/palette.ts`.

Direction in one line: navy, confident sans type, real product fragments; the office is the one
bold element, and gold lamps mark live work. Everything else stays quiet.

## 1. Palette

Tailwind utilities exist for every brand token (`bg-navy`, `text-snow`, `text-mist`, `bg-violet`,
`text-lavender`, `bg-gold`, `bg-navy-800`, `bg-navy-700`, ...).

| token | hex | role |
| --- | --- | --- |
| `navy` | #111326 | marketing background, app rail/chrome, text on light |
| `navy-800` | #1B2436 | dark surface ("raised" sections, frames) |
| `navy-700` | #242D43 | elevated dark surface, dark rules, ScreenshotFrame chrome, panels on raised |
| `navy-600` | #2E3852 | panel step above navy-700 (viz panels on raised sections) |
| `navy-950` | #0C0E1C | "deep" marketing sections |
| `violet` | #7357F6 | primary accent: brand buttons, links on light, active rail item |
| `violet-deep` | #5B3FD9 | hover, text-safe violet on white |
| `lavender` | #B8A7FF | links and accents on navy, secondary chart series |
| `gold` | #FFC66D | the lamp and the second identity colour: activity, markers, active states, secondary CTAs, heading rules. Navy text on it |
| `gold-deep` | #E8A93D | gold hover, gold borders on white |
| `snow` | #F5F7FF | text on dark, light sunken surface |
| `mist` | #A8B4CA | muted text on dark |
| `success` / `success-ink` | #34D399 / #0E7A55 | success on dark / on light |
| `danger` / `danger-ink` | #FB7185 / #C0314F | danger on dark / on light |
| `white` | #FFFFFF | app light theme only. Never a marketing surface |
| `stone-50…950` | #F7F8FC … #111326 | cool neutral ramp (50 F7F8FC, 100 EEF1F8, 200 E3E7F2, 300 CBD2E1, 400 A8B4CA, 500 7D889F, 600 5B6478, 700 3A4561, 800 242D43, 900 1B2436, 950 111326) |

Legacy names still resolve: `purple`→violet, `purple-deep`→violet-deep, `black`/`ink`→navy,
`grey`→mist, `parchment`→white, `moss`→success, `brick`→danger, `sky`→violet, `saffron`→gold.

### Measured contrast (WCAG 2.x relative luminance, computed)

AA needs 4.5:1 for body text and 3:1 for large text (24 px, or 18.7 px bold) and UI parts.

| text | on | ratio | level |
| --- | --- | --- | --- |
| snow #F5F7FF | navy #111326 | 17.15 | AAA |
| mist #A8B4CA | navy | 8.77 | AAA |
| lavender #B8A7FF | navy | 8.74 | AAA |
| gold #FFC66D | navy | 11.83 | AAA |
| success #34D399 | navy | 9.54 | AAA |
| danger #FB7185 | navy | 6.81 | AA |
| stone-500 #7D889F | navy | 5.15 | AA |
| violet #7357F6 | navy | 3.86 | large text / UI only. Do not use violet for body text on navy; use lavender |
| snow | navy-800 #1B2436 | 14.52 | AAA |
| mist | navy-800 | 7.43 | AAA |
| lavender | navy-800 | 7.40 | AAA |
| gold | navy-800 | 10.02 | AAA |
| mist | navy-700 #242D43 | 6.56 | AA |
| snow | navy-700 | 12.82 | AAA |
| navy | white | 18.34 | AAA |
| text-muted #5B6478 | white | 5.93 | AA |
| text-muted #5B6478 | snow #F5F7FF | 5.55 | AA |
| stone-600 #5B6478 | stone-100 #EEF1F8 | 5.25 | AA |
| violet-deep #5B3FD9 | white | 6.65 | AA |
| violet #7357F6 | white | 4.75 | AA (keep violet text 16 px+; prefer violet-deep for links) |
| white | violet (brand button) | 4.75 | AA |
| white | violet-deep (brand hover) | 6.65 | AA |
| navy | gold (accent button) | 11.83 | AAA |
| navy | gold-deep (accent hover) | 8.89 | AAA |
| navy | mist | 8.77 | AAA |
| success-ink #0E7A55 | white | 5.34 | AA |
| danger-ink #C0314F | white | 5.54 | AA |
| saffron-ink #8A5A00 | white | 5.93 | AA |
| saffron-ink | saffron-wash #FFF3DD | 5.40 | AA |
| moss-ink #0E7A55 | moss-wash #DDF5EA | 4.66 | AA |
| brick-ink #C0314F | brick-wash #FFE4E9 | 4.62 | AA |
| sky-ink #5B3FD9 | sky-wash #EEEAFF | 5.65 | AA |
| success | dark moss-wash #12352B | 6.96 | AA |
| danger | dark brick-wash #3D1A23 | 5.69 | AA |
| lavender | dark sky-wash #221C4A | 7.51 | AAA |
| gold | dark saffron-wash #3A2E17 | 8.56 | AAA |
| #E4DDFF | violet-deep (org-chart muted) | 5.09 | AA |

### Semantic variables (app)

Same names as before: `--surface`, `--surface-raised`, `--surface-sunken`, `--text`, `--text-muted`,
`--rule`, `--rule-strong`, `--focus`, `--chrome*`, `--{moss,brick,sky,saffron}-{ink,wash}`,
`--lamp-done`. Light is the default; dark applies under `prefers-color-scheme: dark` (unless
`[data-theme=light]`) and under `[data-theme=dark]`. Chrome (rail, auth aside) is navy in both
themes. Focus ring: violet on light, gold on dark. Values: see the contract, section 2.

Marketing never follows the theme toggle and has no white surfaces. Three dark tones, set by
the `Section` primitive (Revision 1, owner feedback):

| tone | class | use |
| --- | --- | --- |
| `navy` | `bg-navy text-snow` | default; hero, header, office scenes |
| `raised` | `bg-navy-800 text-snow` | alternate band; viz panels inside use `surface="raised"` (navy-700) |
| `deep` | `bg-navy-950 text-snow` | alternate band; closing bands on detail pages |

`paper` survives only as a deprecated alias that renders `deep`. Neighbouring sections must
differ; rhythm comes from the navy / raised / deep alternation, gold markers and the office
scenes, never from white. The light office floor inside frames is the one light area allowed.

### Gold usage (expanded in Revision 1)

Gold is a confident part of the identity, not a rare accent. Contrast: gold on navy 11.8:1,
navy on gold 12:1, gold on navy-800 10.0:1.

- Buttons: `gold` (secondary CTA, e.g. "Watch the office work") and `outline-gold`.
  Primary CTA stays violet `brand`.
- `SectionHeading`: 40×3 px gold rule above every title; optional gold `kicker` (sentence case).
  Detail-page band headings carry the same rule.
- Numbered markers (Stepper, beats, learning stages, step lists): current item gold disc with a
  navy number, the others a gold outline.
- Check / feature icons, list dots and oversight icons: gold.
- Inline links ("See all ...", "Related", "See how it works"): gold, underline on hover.
  Breadcrumb current page: gold. Footer group headings: gold.
- Tabs and role selectors: the active item is a gold pill with navy text.
- Grid cards: the lead card gets a 2 px gold top border; linked cards lift their border to gold/60 on hover.
- Pills: Working / In progress = gold fill, navy text; Waiting (approval, reset) = gold outline;
  Completed = success.
- Office scenes: warm gold lamp pools (gold core into gold-deep) and a gold active-room outline.
- ConversionCta (raised) and the final CTA: a soft gold radial light behind the heading, opacity <= 0.18.
- FAQ accordion: gold chevron; the open question turns gold.
- Not allowed: gold body text, large gold fills beyond buttons and markers, gradient text.

### Hero scene exception (owner-approved, Hero B)

The homepage hero (`components/marketing/hero/hero-section.tsx` + `hero-scene-b.tsx`, concept in
`artifacts/hero-concept-b/`) is a deliberate, owner-approved exception to three rules, and only
there: (1) its breathing gold spotlight pool, faint gold beam, violet horizon haze and the radial
glow under the lamps are allowed despite "no glow halos"; (2) the second headline line ("Then
watch it work.") is gold despite "no single-word colour accents in headlines" (it is a whole line,
never a single word, and never gradient text); (3) its primary CTA "Create your company" is the
`gold` button and the secondary is `outline-gold`, where every other page keeps the violet `brand`
primary. Nowhere else on the site may use glows, haze, a gold headline line or the gold-primary
pairing; the final CTA keeps its soft radial light (<= 0.18) as before. The scene stays labelled:
the gold dashed "Illustration, not a live scene" pill is always visible.

## 2. Typography

- Display: Sora (500/600/700) via `next/font/google`, variable `--font-sora`, utility `font-display`.
- Body: Inter, variable `--font-inter`, utility `font-sans` (default on `body`).
- Headlines are sentence case, Sora 600 (700 only for the hero if needed). No all-caps eyebrows,
  no single-word colour accents, no gradient text.

| role | size | line-height | tracking | weight |
| --- | --- | --- | --- | --- |
| h1 hero | 40 px mobile, 56 px tablet, 72 px desktop | 1.05 | -0.03em | Sora 600–700 |
| h2 section | 36 px mobile, 44 px desktop | 1.1 | -0.02em | Sora 600 |
| h3 | 24 px | 1.25 | -0.01em (`tracking-tight`) | Sora 600 |
| app page title (h1) | 24 px | 1.3 | `tracking-tight` | Sora 600 |
| lead | 18 px (16 px mobile) | 1.6 | 0 | Inter 400 |
| body | 16 px | 1.6 | 0 | Inter 400 |
| small / caption | 14 px | 1.5 | 0 | Inter 400–500 |
| pill / label | 12 px | 20 px | 0 | Inter 500 |

Measure: body copy max ~62–68ch. `text-wrap: balance` on headings and `pretty` on paragraphs is
set globally. Use `.tabular` for numbers in columns and counters.

## 3. Spacing rhythm

- Sections: 96 px vertical padding desktop, 64 px mobile (`Section padding="normal"`); `tight` is
  56 / 40 px.
- Container: max width 1200 px; side gutters 16 / 24 / 40 px.
- Inside sections use a 4 px base scale; common steps 8, 12, 16, 24, 32, 48, 64.
- Heading to body: 16 px; heading block to content: 40–56 px.

## 4. Radii and shadow

| token | value | use |
| --- | --- | --- |
| `rounded-sm` | 6 px | small chips, inputs inside dense UI |
| `rounded-md` | 10 px | app buttons, inputs, menus |
| `rounded-lg` | 16 px | marketing cards, screenshot frames, dialogs |
| `rounded-xl` | 24 px | large marketing panels |
| `rounded-full` | — | pills, marketing CTAs |

Shadow: one soft navy shadow for raised marketing frames, `shadow-frame`
(`0 24px 60px -24px rgb(17 19 38 / .45)`). No other decorative shadows.

## 5. Motion

| token | value | use |
| --- | --- | --- |
| `--duration-fast` | 160 ms | hover, press, colour changes |
| `--duration-base` | 240 ms | popovers, toggles, connector fade |
| `--duration-slow` | 400 ms | reveals, scene transitions |
| `--ease-brand` / `ease-brand` | `cubic-bezier(.2,.8,.2,1)` | everything except linear loops |
| `animate-lamp` | 2.4 s gold pulse | the lamp only |
| `animate-connector` | 0.8 s linear dash travel | `AnimatedConnector` only |

Rules: one engine (`motion` + CSS + SVG; Pixi only in `src/office`). Every animation has a static
or stepper fallback under `prefers-reduced-motion` (a global rule also collapses CSS durations).
Nothing essential is hidden without JS. No continuous rAF while paused or offscreen.

## 6. Logo usage

- Light surfaces: the official lockup `agentopia-logo.png` (`BrandLogo tone="light-surface"`).
- Dark surfaces (navy, chrome): the mark PNG + Sora 600 wordmark in snow
  (`BrandLogo tone="dark-surface"`). The official wordmark is navy and vanishes on navy.
- Theme-following surfaces (`bg-surface`): `tone="auto"`.
- Mark alone: `AgentopiaMark` (favicons, avatars, tight spaces).
- Sizes: `sm` 24 px, `md` 32 px, `lg` 48 px mark height. Do not go below 24 px in UI.
- Never redraw, recolour, stretch, outline, add effects to, or place the mark on a busy background.
  See `docs/design/logo-assets.md` for what is missing for production.

## 7. Do / don't

Do
- Keep surfaces flat and dark: navy, navy-800 (raised), navy-950 (deep). Separate with 1 px
  `white/10` rules.
- Use real product fragments (screenshots in `ScreenshotFrame`, the office) as the imagery.
- Label every scripted or illustrative visual with `DemoBadge`, always visible.
- Use gold for activity and for the identity marks listed under "Gold usage" (markers, active
  states, heading rules, secondary CTAs, inline links, icons).
- Use lavender (not violet) for links and accents on navy.

Don't
- No glassmorphism (no backdrop blur panels), no glow halos (the lamp pulse is the only glow).
- No particles, starfields, noise-gradient blobs or decorative orbs.
- No gradient text, no all-caps eyebrows, no "→" in button labels.
- No white or paper sections or panels anywhere on the marketing site.
- No gold large fills beyond buttons and markers, no gold body text.
- No testimonials, metrics, logos or claims the product does not implement (contract section 5).

## 8. Component inventory

### Shared UI
- `Button` (`components/ui/button.tsx`): variants `primary`, `accent` (gold, navy text),
  `brand` (violet fill, white text, hover violet-deep; primary marketing CTA), `gold` (gold fill,
  navy text, hover gold-deep, rounded-full; secondary marketing CTA), `outline-gold` (gold/70
  border, gold text, hover gold/10), `outline-light` (snow/60 border, snow text, hover snow/10), `secondary`, `ghost`, `danger`, `danger-outline`, `link`, `chrome`;
  sizes `sm`, `md`, `lg`, `icon`, `icon-sm`; `asChild`, `pending`.
- `BrandLogo` (`components/brand/logo.tsx`): `href?: string | null` (null renders a non-link),
  `size?: "sm" | "md" | "lg"`, `wordmark?: boolean`, `tone?: "auto" | "light-surface" | "dark-surface"`,
  `className`.
- `AgentopiaMark`: `size?`, `label?` (accessible name; omit when next to visible text), `className`.

### Viz surfaces
Viz components take `surface?: "dark" | "raised"` (`components/marketing/viz/surface.ts`):
`dark` (default) paints navy-800 panels for navy/deep sections; `raised` paints navy-700 panels
for raised sections. There is no light surface. `surfaceFor(tone)` / `inkFor(tone)` map a
section tone to the right value.

### Marketing primitives (`components/marketing/primitives/`, barrel `index.ts`)
- `Container`: `as?`, `className`, div props. Max 1200 px, gutters 16/24/40.
- `Section`: `tone: "navy" | "raised" | "deep"` (`"paper"` = deprecated alias of deep), `id`, `aria-labelledby?`,
  `padding?: "normal" | "tight" | "none"`, section props.
- `SectionHeading`: `id`, `title`, `lead?`, `align?: "start" | "center"`, `size?: "md" | "lg"`,
  `as?: "h1" | "h2" | "h3"`, `kicker?` (gold, sentence case), `rule?` (gold 40×3 rule, default on), `className`.
  Always light on dark.
- `MotionReveal` (client): `as?` (div, section, article, li, ul, ol, span, figure, header, footer),
  `delay?` ms, `className`, `children`. IntersectionObserver; fade + 8 px rise once; visible in
  server HTML; nothing hidden under reduced motion or for content already on screen at mount.
- `ScreenshotFrame` (navy-700 chrome, first dot gold): `src`, `alt`, `width`, `height`, `priority?` (maps to next/image `preload`),
  `label?` (address bar text), `caption?`, `zoom?` (opens a Dialog with the full image), `sizes?`,
  `className`.
- `Pill`: `variant?: "neutral" | "violet" | "gold" | "gold-outline" | "success" | "danger" | "simulated"`,
  `dot?`, span props (dark surfaces only).
- `DemoBadge`: `kind?: "scripted" | "illustrative"` ("Scripted demo" / "Illustrative data"),
  `className`.
- `AnimatedConnector`: `d`, `active?`, `tone?: "violet" | "lavender" | "gold" | "mist"`,
  `strokeWidth?`, `className`. Renders a `<g>`; place inside your own `<svg>`.
- `Stepper` (client): `steps: { id, label, description? }[]`, `current`, `onSelect?`, `label`,
  `orientation?: "vertical" | "horizontal"`, `className`. Gold markers. Ordered list with
  `aria-current="step"`; steps become buttons when `onSelect` is given.
- `marketing-button.tsx`: re-exports `Button`, `buttonVariants`, `ButtonProps`.

### Office palette (`src/office/palette.ts`)
PURPLE 0x7357f6, GOLD 0xffc66d, GREY 0xa8b4ca, BLACK 0x111326, WHITE 0xffffff; steps
PURPLE_DEEP, LAVENDER, CHARCOAL, GRAPHITE, SILVER (stone-500), MIST (stone-300), DIM_TINT;
helpers `mix`, `wallTint`, `greyOf`, `cssHex`, `cssRgba`. `atlas.ts` and `scene.ts` contain no
raw hex; add a token here instead.
