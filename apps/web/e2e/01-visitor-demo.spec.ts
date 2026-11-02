import { expect, test } from "@playwright/test";
import { BASE, DEMO_COMPANY_IDS, createCompanyApi, createTaskApi, hireApi, signUpApi, trackErrors } from "./helpers";

test.describe("Visitor demo", () => {
  test("loads without auth, labels everything simulated, lists both floors and switches", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/demo");
    await expect(page).toHaveURL(/\/demo$/);
    // Simulated labelling in the header and on the canvas toolbar / feed.
    await expect(page.getByText("Demo building. Everything here is simulated")).toBeVisible();
    const floors = page.getByRole("navigation", { name: "Floors" });
    await expect(floors.getByRole("button")).toHaveCount(2);
    await expect(floors.getByRole("button", { name: /Northwind Labs/ })).toBeVisible();
    await expect(floors.getByRole("button", { name: /Pixel & Co\./ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Northwind Labs" })).toBeVisible();

    // The scripted simulation plays in the browser: the feed fills with "Simulated" items.
    const feed = page.locator("section[aria-labelledby='office-feed-title']");
    await expect(feed.getByRole("listitem").first()).toBeVisible({ timeout: 20_000 });
    await expect(feed.getByText("Simulated").first()).toBeVisible();

    await floors.getByRole("button", { name: /Pixel & Co\./ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Pixel & Co." })).toBeVisible();
    await expect(floors.getByRole("button", { name: /Pixel & Co\./ })).toHaveAttribute("aria-current", "true");
    expect(errors).toEqual([]);
  });

  test("Run a task and Connect a provider explain that an account is needed", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: "Run a task" }).click();
    const dialog = page.getByRole("dialog", { name: /Running a task needs an account/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/simulated in your browser/)).toBeVisible();
    await dialog.getByRole("button", { name: "Keep exploring" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Connect a provider" }).click();
    const d2 = page.getByRole("dialog", { name: /Connecting a provider needs an account/ });
    await expect(d2).toBeVisible();
    await d2.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL(/\/signup\?next=%2Fonboarding|\/signup\?next=\/onboarding/);
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  });

  test("demo API routes never expose non-demo data", async ({ playwright }) => {
    // Create real (non-demo) data in a separate signed-in context.
    const owner = await playwright.request.newContext({ baseURL: BASE });
    await signUpApi(owner, "demo-iso");
    const co = await createCompanyApi(owner, "Private Co");
    const emp = await hireApi(owner, co.companyId, "Secret Person", "BACKEND");
    const task = await createTaskApi(owner, co.companyId, { title: "Private task title", description: "Should never be visible in the demo" });

    // Anonymous visitor.
    const anon = await playwright.request.newContext({ baseURL: BASE });
    const seen = new Set<string>();
    const collect = (v: unknown) => {
      const s = JSON.stringify(v);
      for (const m of s.matchAll(/"companyId":"([^"]+)"/g)) seen.add(m[1]!);
      for (const m of s.matchAll(/"company":\{"id":"([^"]+)"/g)) seen.add(m[1]!);
      expect(s).not.toContain(co.companyId);
      expect(s).not.toContain("Private task title");
      expect(s).not.toContain("Secret Person");
    };
    const building = await (await anon.get("/api/demo/building")).json();
    collect(building);
    expect(building.floors).toHaveLength(2);
    for (const f of building.floors as Array<{ id: string }>) {
      const r = await anon.get(`/api/demo/floors/${f.id}/view`);
      expect(r.status()).toBe(200);
      const v = await r.json();
      expect(v.company.isDemo).toBe(true);
      collect(v);
      for (const e of v.employees as Array<{ id: string }>) collect(await (await anon.get(`/api/demo/employees/${e.id}`)).json());
    }
    const tasks = await (await anon.get("/api/demo/tasks?limit=100")).json();
    collect(tasks);
    for (const t of (tasks.items as Array<{ id: string }>).slice(0, 10)) collect(await (await anon.get(`/api/demo/tasks/${t.id}`)).json());
    collect(await (await anon.get(`/api/demo/tasks?companyId=${co.companyId}`)).json());
    collect(await (await anon.get("/api/demo/script")).json());

    // Direct access to non-demo ids through the demo routes is refused.
    expect((await anon.get(`/api/demo/floors/${co.floorId}/view`)).status()).toBe(404);
    expect((await anon.get(`/api/demo/employees/${emp.id}`)).status()).toBe(404);
    expect((await anon.get(`/api/demo/tasks/${task.id}`)).status()).toBe(404);

    for (const id of seen) expect(DEMO_COMPANY_IDS).toContain(id);
    expect(seen.size).toBeGreaterThan(0);
    await owner.dispose();
    await anon.dispose();
  });
});
