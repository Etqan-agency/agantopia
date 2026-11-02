import { expect, test } from "@playwright/test";
import { DISALLOWED_PREFIXES, MARKETING_ROUTES } from "../src/content/marketing/routes";
import { BASE, trackErrors } from "./helpers";

// Public marketing site: routing, SEO plumbing, the illustrated hero, reduced motion, navigation.
// No account needed. The mobile test runs in the mobile-chromium project (see playwright.config.ts).

test.describe("Marketing site", () => {
  test("every marketing route returns 200 with one h1 and a canonical link", async ({ request }) => {
    for (const r of MARKETING_ROUTES) {
      const res = await request.get(`${BASE}${r.path}`);
      expect(res.status(), r.path).toBe(200);
      const html = await res.text();
      expect(html.match(/<h1[\s>]/g)?.length ?? 0, `${r.path} h1 count`).toBe(1);
      expect(html, `${r.path} canonical`).toMatch(/<link rel="canonical" href="[^"]+"/);
    }
  });

  test("sitemap lists every marketing route; robots disallows the app", async ({ request }) => {
    const sitemap = await (await request.get(`${BASE}/sitemap.xml`)).text();
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
    for (const r of MARKETING_ROUTES) expect(locs, r.path).toContain(r.path);

    const robots = await (await request.get(`${BASE}/robots.txt`)).text();
    for (const p of DISALLOWED_PREFIXES) expect(robots).toContain(`Disallow: ${p}`);
    expect(robots).toMatch(/Sitemap: \S+\/sitemap\.xml/);
  });

  test("hero: two-line headline, illustration pill and both CTAs", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    const hero = page.locator("[data-hero]");
    const h1 = hero.getByRole("heading", { level: 1 });
    await expect(h1).toContainText("Build your own AI company.");
    await expect(h1).toContainText("Then watch it work.");
    await expect(hero.getByText("Illustration, not a live scene", { exact: true })).toBeVisible();
    await expect(hero.getByRole("link", { name: "Create your company" })).toHaveAttribute("href", "/signup?next=/onboarding");
    await expect(hero.getByRole("link", { name: "Watch the office work" })).toHaveAttribute("href", "/demo");
    await expect(hero.getByRole("link", { name: "See how it works" })).toHaveAttribute("href", "/how-it-works");
    // The scene is decorative and server-rendered: present in the HTML, hidden from assistive tech.
    await expect(hero.locator("svg[aria-hidden='true']").first()).toBeAttached();
    await expect(hero).toHaveAttribute("data-motion", "running");
    expect(errors).toEqual([]);
  });

  test("reduced motion: hero scene is paused; office story shows the stepper", async ({ page }) => {
    const errors = trackErrors(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const hero = page.locator("[data-hero]");
    await expect(hero).toHaveClass(/\bis-paused\b/);
    await expect(hero).toHaveAttribute("data-motion", "paused");
    await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(hero.getByRole("link", { name: "Create your company" })).toBeVisible();
    // No dash animates and only the three steady lamps are lit.
    const running = await hero.evaluate((el) =>
      [...el.querySelectorAll(".hero-b-dash, .hero-b-lamp-on, .hero-b-breathe")].filter((n) => getComputedStyle(n).animationName !== "none").length,
    );
    expect(running).toBe(0);

    const story = page.locator("#office-alive");
    await story.scrollIntoViewIfNeeded();
    const stepper = story.getByRole("list", { name: "How a task moves through the office" });
    // Two lists share the name (scroll story and stepper); only the stepper is visible under reduced motion.
    const visibleStepper = stepper.filter({ has: page.getByRole("button") });
    await expect(visibleStepper).toBeVisible();
    await expect(visibleStepper.getByRole("button").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("navbar Product menu opens from the keyboard and links to AI employees", async ({ page }) => {
    await page.goto("/");
    // The lighter hero lets "load" fire before the navbar hydrates; wait so Enter reaches radix.
    await page.waitForLoadState("networkidle");
    const trigger = page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Product" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const link = page.getByRole("link", { name: /AI employees/ }).first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/features/ai-employees");
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  });

  test("FAQ answers are in the initial HTML", async ({ request }) => {
    const html = await (await request.get(`${BASE}/faq`)).text();
    // Strip JSON-LD so the check proves the visible answers are server-rendered, not just the schema.
    const body = html.replace(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/g, "");
    expect(body).toContain("The visitor demo at /demo shows a seeded two-floor building");
    expect(body).toContain("Agentopia is a workspace where you run a small company staffed by AI employees.");
  });

  test("JSON-LD parses on /, /faq and /features/ai-manager", async ({ request }) => {
    for (const path of ["/", "/faq", "/features/ai-manager"]) {
      const html = await (await request.get(`${BASE}${path}`)).text();
      const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
      expect(blocks.length, path).toBeGreaterThan(0);
      const types: string[] = [];
      for (const b of blocks) {
        const data = JSON.parse(b);
        for (const d of Array.isArray(data) ? data : data["@graph"] ?? [data]) types.push(d["@type"]);
      }
      if (path === "/faq") expect(types).toContain("FAQPage");
    }
  });

  test("mobile 390x844: menu sheet opens and navigates to the FAQ", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const open = page.getByRole("button", { name: "Open menu" });
    await open.click();
    const sheet = page.getByRole("dialog", { name: "Menu" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: "FAQ" }).click();
    await expect(page).toHaveURL(/\/faq$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(sheet).toBeHidden();
  });
});
