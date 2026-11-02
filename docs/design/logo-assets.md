# Agentopia logo assets

Date: 2026-11-02. Status: raster only. No vector was reconstructed, traced or redrawn; the PNGs
below are the approved source and are used as-is.

## What exists (`apps/web/public/brand/`)

| file | size | background | contents | used for |
| --- | --- | --- | --- | --- |
| `agentopia-logo.png` | 1744 × 341 (ratio 5.11:1), RGBA | transparent | mark + navy wordmark lockup | `BrandLogo tone="light-surface"` (and the light half of `tone="auto"`) |
| `agentopia-mark.png` | 512 × 512, RGBA | transparent | mark alone (violet figure, two gold dots, gold spark) | `AgentopiaMark`, and the mark in `BrandLogo tone="dark-surface"` |
| `agentopia-logo-on-white.png` | 2172 × 724, RGB | opaque white | lockup on a white plate with padding | not used in the app; keep for documents/slides |

App icons in `apps/web/src/app/` (`icon.png`, `apple-icon.png`, `favicon.ico`, `opengraph-image.png`)
are separate raster files.

On dark surfaces the official wordmark (navy) disappears, so the web app renders the mark PNG next
to a live-text wordmark set in Sora 600, colour `snow` (#F5F7FF). That is an interim treatment, not a
substitute for an official reversed lockup.

## What a production-ready set needs (not available yet)

1. Vector source (SVG, plus the original design file) of the mark and of the wordmark, with the
   wordmark outlined (no font dependency).
2. Lockups: horizontal (mark + wordmark) and stacked, each as SVG.
3. Colour variants for each lockup:
   - full colour on light (violet #7357F6 + gold #FFC66D, navy #111326 wordmark),
   - reversed for navy (same mark, snow #F5F7FF or white wordmark),
   - one-colour navy, one-colour white, and one-colour black for print/embossing.
4. Favicon and app icon set generated from the vector: `favicon.ico` (16/32/48), `icon.svg`,
   `apple-touch-icon` 180 × 180, PWA icons 192 and 512 (plus maskable 512 with safe zone),
   and a monochrome `mask-icon` SVG.
5. Clear-space rule (safe area): proposed minimum clear space on every side equal to the height of
   the gold spark in the mark (roughly 25% of mark height); confirm against the vector.
6. Minimum sizes: proposed mark 16 px (favicon) / 24 px in UI; horizontal lockup 96 px wide on
   screen (about 19 px tall) and 25 mm in print. Below that, use the mark alone.
7. Social/OG templates using the vector lockup.

Until the vectors exist, do not trace the PNGs or set "Agentopia" in another typeface and call it
the logo; use `BrandLogo` / `AgentopiaMark` from `apps/web/src/components/brand/logo.tsx`.
