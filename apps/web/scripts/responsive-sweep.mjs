// Responsive + runtime-hygiene sweep of every marketing route.
//
//   node apps/web/scripts/responsive-sweep.mjs
//
// Env: BASE (default http://localhost:3100), ONLY (substring filter on the route path),
// NO_SHOTS=1 (checks only).
// Captures above-the-fold at 375/390/768/1024/1440/1920 and full-page at 390 and 1440 into
// artifacts/agentopia-frontend-refactor/screenshots/responsive/<slug>-<width>[-full].png, plus the
// mobile nav open at 390. Writes
// artifacts/agentopia-frontend-refactor/qa/responsive-results.json and exits 1 on any failure.
//
// Per page it asserts: no horizontal overflow; zero console errors, page errors, failed or >=400
// same-origin requests; no hydration warnings; every <img> has alt (empty only when decorative:
// aria-hidden, role=presentation/none, or inside an aria-hidden subtree); exactly one h1; at 390
// every visible link/button is >= 24x24 CSS px (below 44x44 is a warning; inline links inside a
// sentence and isolated targets that meet the 2.5.8 spacing exception are exempt); a visible focus outline on the first five tabbable elements.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(here, "..");
const ROOT = resolve(WEB, "../..");
const require = createRequire(join(WEB, "package.json"));
const { chromium } = require("@playwright/test");

const B = process.env.BASE ?? "http://localhost:3100";
const ONLY = process.env.ONLY ?? "";
const SHOTS = !process.env.NO_SHOTS;
const SHOT_DIR = join(ROOT, "artifacts/agentopia-frontend-refactor/screenshots/responsive");
const QA_DIR = join(ROOT, "artifacts/agentopia-frontend-refactor/qa");
mkdirSync(SHOT_DIR, { recursive: true });
mkdirSync(QA_DIR, { recursive: true });
const WIDTHS = [375, 390, 768, 1024, 1440, 1920];
const FULL = new Set([390, 1440]);
const HIDE_CSS = "nextjs-portal { display: none !important; }";

function marketingPaths() {
  const src = readFileSync(join(WEB, "src/content/marketing/routes.ts"), "utf8");
  const block = src.slice(src.indexOf("MARKETING_ROUTES"), src.indexOf("DISALLOWED_PREFIXES"));
  return [...block.matchAll(/path:\s*"([^"]+)"/g)].map((m) => m[1]);
}
const slugOf = (p) => (p === "/" ? "home" : p.slice(1).replace(/\//g, "-"));

async function newPage(browser, width) {
  const height = width < 900 ? (width < 500 ? 844 : 1024) : width >= 1920 ? 1080 : 900;
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: "light",
    ...(width < 900 ? { isMobile: true, hasTouch: true } : {}),
  });
  const page = await ctx.newPage();
  const log = { console: [], pageErrors: [], failed: [], hydration: [] };
  page.on("console", (m) => {
    const t = m.text();
    if (/hydrat|did not match|server rendered HTML/i.test(t)) log.hydration.push(t.slice(0, 300));
    // Dev-only noise that is not a page defect: HMR socket, React DevTools hint, Fast Refresh logs.
    if (m.type() === "error" && !/\[HMR\]|webpack-hmr|Download the React DevTools/i.test(t)) log.console.push(t.slice(0, 300));
  });
  page.on("pageerror", (e) => log.pageErrors.push(String(e.message).slice(0, 300)));
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (u.startsWith(B) && !/_next\/webpack-hmr|__nextjs/.test(u) && r.failure()?.errorText !== "net::ERR_ABORTED") log.failed.push(`${u} ${r.failure()?.errorText}`);
  });
  page.on("response", (r) => {
    if (r.url().startsWith(B) && r.status() >= 400) log.failed.push(`${r.url()} HTTP ${r.status()}`);
  });
  return { ctx, page, log };
}

async function settle(page) {
  await page.addStyleTag({ content: HIDE_CSS });
  // Let MotionReveal sections reveal before a full-page capture.
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += Math.round(window.innerHeight * 0.8)) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(700);
}

async function domChecks(page, width) {
  return page.evaluate((width) => {
    const out = { overflow: null, imgs: [], h1: 0, targetsFail: [], targetsWarn: [] };
    out.overflow = { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth };
    if (out.overflow.scrollWidth > out.overflow.innerWidth) {
      // Name the widest offenders so the defect can be located.
      const wide = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.right > window.innerWidth + 1 && r.width > 0) wide.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} right=${Math.round(r.right)}`);
      }
      out.overflow.offenders = wide.slice(0, 8);
    }
    for (const img of document.querySelectorAll("img")) {
      const alt = img.getAttribute("alt");
      const decorative = img.closest("[aria-hidden='true']") || ["presentation", "none"].includes(img.getAttribute("role") ?? "");
      if (alt === null || (alt === "" && !decorative)) out.imgs.push(img.outerHTML.slice(0, 160));
    }
    out.h1 = document.querySelectorAll("h1").length;
    if (width === 390) {
      const visible = (el) => {
        if (el.closest("[aria-hidden='true'], [inert]")) return false;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
      };
      /** WCAG 2.5.8 inline exception: a link inside a run of text. */
      const inline = (el) => {
        if (el.tagName !== "A") return false;
        const p = el.parentElement;
        if (!p) return false;
        const text = (p.textContent ?? "").trim();
        return getComputedStyle(el).display === "inline" && text.length > (el.textContent ?? "").trim().length + 10;
      };
      const targets = [];
      for (const el of document.querySelectorAll("a[href], button, [role='button'], [role='tab']")) {
        if (!visible(el) || inline(el)) continue;
        const r = el.getBoundingClientRect();
        // Visually hidden until focused (the skip link): not a pointer target.
        if (r.width <= 1 && r.height <= 1) continue;
        targets.push({ el, r });
      }
      /** WCAG 2.5.8 spacing exception: a 24px circle on the target's centre touches no other target. */
      const spaced = (t) => {
        const cx = t.r.left + t.r.width / 2;
        const cy = t.r.top + t.r.height / 2;
        return targets.every((o) => {
          if (o === t || o.el.contains(t.el) || t.el.contains(o.el)) return true;
          const dx = Math.max(o.r.left - cx, 0, cx - o.r.right);
          const dy = Math.max(o.r.top - cy, 0, cy - o.r.bottom);
          const small = o.r.width < 24 || o.r.height < 24;
          const ocx = o.r.left + o.r.width / 2;
          const ocy = o.r.top + o.r.height / 2;
          return Math.hypot(dx, dy) >= 12 && (!small || Math.hypot(ocx - cx, ocy - cy) >= 24);
        });
      };
      for (const t of targets) {
        const { el, r } = t;
        const label = `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}" ${Math.round(r.width)}x${Math.round(r.height)}`;
        if (r.width < 24 || r.height < 24) (spaced(t) ? out.targetsWarn : out.targetsFail).push(spaced(t) ? `${label} (under 24px, passes the 2.5.8 spacing exception)` : label);
        else if (r.width < 44 || r.height < 44) out.targetsWarn.push(label);
      }
    }
    return out;
  }, width);
}

async function focusChecks(page) {
  const res = [];
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.activeElement?.blur?.();
    document.body.focus();
  });
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    res.push(
      await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return { name: "(body)", ok: false };
        const cs = getComputedStyle(a);
        const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 1;
        const ring = cs.boxShadow && cs.boxShadow !== "none";
        return { name: `${a.tagName.toLowerCase()} "${(a.getAttribute("aria-label") ?? a.textContent ?? "").trim().slice(0, 40)}"`, ok: outline || !!ring, outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}` };
      }),
    );
  }
  return res;
}

async function main() {
  const browser = await chromium.launch();
  const results = [];
  let failures = 0;
  for (const path of marketingPaths().filter((p) => p.includes(ONLY))) {
    const slug = slugOf(path);
    for (const width of WIDTHS) {
      const { ctx, page, log } = await newPage(browser, width);
      const r = { path, width, problems: [], warnings: [] };
      try {
        const res = await page.goto(B + path, { waitUntil: "networkidle", timeout: 60_000 });
        if (!res || res.status() !== 200) r.problems.push(`HTTP ${res?.status()}`);
        await settle(page);
        const d = await domChecks(page, width);
        if (d.overflow.scrollWidth > d.overflow.innerWidth) r.problems.push(`horizontal overflow ${d.overflow.scrollWidth} > ${d.overflow.innerWidth}: ${(d.overflow.offenders ?? []).join(" | ")}`);
        if (d.h1 !== 1) r.problems.push(`h1 count ${d.h1}`);
        for (const i of d.imgs) r.problems.push(`img alt: ${i}`);
        for (const t of d.targetsFail) r.problems.push(`target < 24px: ${t}`);
        for (const t of d.targetsWarn) r.warnings.push(`target < 44px: ${t}`);
        if (SHOTS) {
          await page.screenshot({ path: join(SHOT_DIR, `${slug}-${width}.png`) });
          if (FULL.has(width)) await page.screenshot({ path: join(SHOT_DIR, `${slug}-${width}-full.png`), fullPage: true });
        }
        if (width === 1440) {
          const f = await focusChecks(page);
          for (const x of f) if (!x.ok) r.problems.push(`no focus indicator on ${x.name} (${x.outline})`);
          r.focus = f;
        }
        if (SHOTS && width === 390 && path === "/") {
          await page.getByRole("button", { name: "Open menu" }).click();
          await page.getByRole("dialog").waitFor();
          await page.waitForTimeout(500);
          await page.screenshot({ path: join(SHOT_DIR, `home-390-mobile-nav-open.png`) });
          await page.keyboard.press("Escape");
        }
      } catch (e) {
        r.problems.push(`exception: ${String(e.message ?? e).slice(0, 300)}`);
      }
      await page.waitForTimeout(200);
      for (const c of log.console) r.problems.push(`console error: ${c}`);
      for (const c of log.pageErrors) r.problems.push(`pageerror: ${c}`);
      for (const c of [...new Set(log.failed)]) r.problems.push(`request: ${c}`);
      for (const c of log.hydration) r.problems.push(`hydration: ${c}`);
      await ctx.close();
      failures += r.problems.length;
      console.log(`${path.padEnd(34)} ${String(width).padEnd(5)} ${r.problems.length ? `FAIL ${r.problems.length}` : "ok"}${r.warnings.length ? `  (${r.warnings.length} warnings)` : ""}`);
      for (const p of r.problems) console.log(`    - ${p}`);
      results.push(r);
    }
  }
  await browser.close();
  writeFileSync(join(QA_DIR, ONLY ? `responsive-results-${slugOf(ONLY) || "home"}.json` : "responsive-results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), base: B, failures, results }, null, 2));
  console.log(failures ? `${failures} problems` : "all checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
