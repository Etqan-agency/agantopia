import { expect, test, type BrowserContext } from "@playwright/test";
import { createTaskApi, hireApi, newOwner, waitForTaskStatus } from "./helpers";
import { noHorizontalPageScroll, unnamedControls } from "./a11y-heuristics";

let shared: { ctx: BrowserContext; cid: string } | null = null;

test.describe("Accessibility and responsiveness", () => {
  test.beforeAll(async ({ browser }) => {
    const { ctx, company } = await newOwner(browser, "a11y", "Access Co");
    await hireApi(ctx.request, company.companyId, "Mina Fares", "FRONTEND");
    await hireApi(ctx.request, company.companyId, "Omar Adel", "BACKEND");
    const t = await createTaskApi(ctx.request, company.companyId, { title: "Build the pricing page", description: "Pricing page with three tiers." });
    await waitForTaskStatus(ctx.request, company.companyId, t.id, ["COMPLETED"]);
    shared = { ctx, cid: company.companyId };
  });
  test.afterAll(async () => {
    await shared?.ctx.close();
  });

  for (const path of ["/office", "/office?view=list", "/tasks", "/employees", "/learning"]) {
    test(`every interactive control has an accessible name on ${path}`, async () => {
      const page = await shared!.ctx.newPage();
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await page.waitForTimeout(800);
      expect(await unnamedControls(page)).toEqual([]);
      // Role-based spot checks.
      for (const b of await page.getByRole("button").all()) {
        if (await b.isVisible()) expect((await b.getAttribute("aria-hidden")) ?? "").not.toBe("true");
      }
      await page.close();
    });
  }

  test("keyboard: Tab reaches the floor switcher and the New task button on /office", async () => {
    const page = await shared!.ctx.newPage();
    await page.goto("/office");
    await expect(page.getByRole("button", { name: "New task" })).toBeVisible();
    const reached = new Set<string>();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const d = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a) return "";
        const nav = a.closest("nav[aria-label='Floors']") ? "floors-nav:" : "";
        return nav + (a.getAttribute("aria-label") ?? a.innerText ?? "").trim().slice(0, 80);
      });
      if (/^Switch floor\./.test(d)) reached.add("rail-switcher");
      if (d.startsWith("floors-nav:")) reached.add("office-floor-button");
      if (d === "New task") reached.add("new-task");
      if (reached.size === 3) break;
    }
    expect([...reached].sort()).toEqual(["new-task", "office-floor-button", "rail-switcher"]);
    // Enter on the focused New task button opens the dialog.
    await page.getByRole("button", { name: "New task" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "New task" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "New task" })).toBeHidden();
    // Skip link is the first stop.
    await page.reload();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.close();
  });

  test("prefers-reduced-motion renders the office as the list view (no canvas)", async () => {
    const page = await shared!.ctx.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/office");
    await expect(page.getByText("Your system asks for reduced motion, so the office is shown as a list.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Mina Fares/ })).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    await page.close();
    // Same for the visitor demo.
    const demo = await shared!.ctx.browser()!.newPage();
    await demo.emulateMedia({ reducedMotion: "reduce" });
    await demo.goto("/demo");
    await expect(demo.getByText("Your system asks for reduced motion, so the office is shown as a list.")).toBeVisible();
    await expect(demo.locator("canvas")).toHaveCount(0);
    await demo.close();
  });

  test("mobile 390x844: office list view and tasks list without horizontal page scroll", async () => {
    const page = await shared!.ctx.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/office");
    await expect(page.getByText("On small screens the office is shown as a list.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Mina Fares/ })).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    let d = await noHorizontalPageScroll(page);
    expect(d.scrollWidth).toBeLessThanOrEqual(d.innerWidth);

    await page.goto("/tasks");
    await expect(page.getByRole("heading", { level: 2, name: /Completed/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Build the pricing page/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Task board, scrolls horizontally" })).toBeHidden();
    d = await noHorizontalPageScroll(page);
    expect(d.scrollWidth).toBeLessThanOrEqual(d.innerWidth);

    for (const p of ["/employees", "/learning", "/integrations", "/settings", "/demo"]) {
      await page.goto(p);
      await page.waitForLoadState("networkidle");
      d = await noHorizontalPageScroll(page);
      expect(d.scrollWidth, `${p} scrolls horizontally`).toBeLessThanOrEqual(d.innerWidth);
    }
    await page.close();
  });
});
