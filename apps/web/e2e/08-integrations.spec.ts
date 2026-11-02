import { expect, test } from "@playwright/test";
import { newOwner } from "./helpers";

const KEY = "sk-ant-invalid-test";

test.describe("Integrations", () => {
  test("invalid Anthropic key verifies as INVALID and is never shown; revoke works", async ({ browser }) => {
    const { ctx, page, company } = await newOwner(browser, "integ", "Integrations Co");
    const cid = company.companyId;
    const leaks: string[] = [];
    page.on("response", async (r) => {
      if (!r.url().includes("/api/")) return;
      try {
        const t = await r.text();
        if (t.includes(KEY)) leaks.push(r.url());
      } catch {
        /* streaming or redirect bodies */
      }
    });
    await page.goto("/integrations");
    await page.getByRole("button", { name: "Add connection" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Add a provider connection" });
    await sheet.getByRole("radio", { name: /Anthropic API key/ }).check();
    // API keys are billed separately: the acknowledgement is mandatory.
    await sheet.getByRole("checkbox", { name: /billed separately/ }).check();
    await sheet.getByLabel(/^Name/).fill("E2E Anthropic");
    await sheet.getByRole("textbox", { name: "API key" }).fill(KEY);
    await sheet.getByRole("button", { name: /Connect|Add|Save/ }).last().click();
    await expect(page.getByText("Provider connected")).toBeVisible();
    await expect(sheet).toBeHidden();

    // The connection's settings sheet opens next; verify from there.
    const settings = page.getByRole("dialog", { name: "Model and permissions: E2E Anthropic" });
    await expect(settings).toBeVisible();
    await expect(settings.getByText("Not verified", { exact: true })).toBeVisible();
    await settings.getByRole("button", { name: "Verify" }).click();
    await expect(settings.getByText("Invalid", { exact: true })).toBeVisible({ timeout: 30_000 });
    expect(await page.locator("body").innerText()).not.toContain(KEY);
    await settings.getByRole("button", { name: "Close" }).click();
    await expect(settings).toBeHidden();

    const row = page.getByRole("listitem").filter({ hasText: "E2E Anthropic" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("••••test");
    await expect(row.getByText("Invalid", { exact: true })).toBeVisible();
    // Verifying again from the list keeps it INVALID.
    await row.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByText("E2E Anthropic did not verify")).toBeVisible({ timeout: 30_000 });
    const list = await (await ctx.request.get(`/api/companies/${cid}/providers`)).json();
    const conn = ((list.items ?? list) as Array<{ id: string; label: string; status: string }>).find((c) => c.label === "E2E Anthropic")!;
    expect(conn.status).toBe("INVALID");
    expect(JSON.stringify(list)).not.toContain(KEY);

    // The key never appears in the page text or in any input value.
    expect(await page.locator("body").innerText()).not.toContain(KEY);
    const values = await page.locator("input, textarea").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    expect(values.join("\n")).not.toContain(KEY);
    expect(await page.content()).not.toContain(KEY);

    // Revoke.
    await row.getByRole("button", { name: "Revoke" }).click();
    await page.getByRole("alertdialog").or(page.getByRole("dialog")).getByRole("button", { name: "Revoke connection" }).click();
    await expect(page.getByText("E2E Anthropic revoked")).toBeVisible();
    await expect.poll(async () => {
      const l = await (await ctx.request.get(`/api/companies/${cid}/providers`)).json();
      return ((l.items ?? l) as Array<{ id: string; status: string }>).find((c) => c.id === conn.id)?.status ?? "GONE";
    }).toMatch(/REVOKED|GONE/);
    expect(leaks).toEqual([]);
    await ctx.close();
  });

  test("runner token is shown once; usage shows Unavailable subscription quota", async ({ browser }) => {
    const { ctx, page, company } = await newOwner(browser, "runner", "Runner Co");
    const cid = company.companyId;
    await page.goto("/integrations");
    const runners = page.locator("section[aria-labelledby='runners-h']");
    await runners.getByLabel("Runner name").fill("Laptop runner");
    await runners.getByRole("button", { name: /Create|Add/ }).click();
    const dlg = page.getByRole("dialog", { name: "Token for Laptop runner" });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByText("It is shown only once")).toBeVisible();
    const token = await dlg.getByLabel("Runner token").inputValue();
    expect(token.length).toBeGreaterThan(20);
    await dlg.getByRole("button", { name: "I saved it" }).click();
    await expect(dlg).toBeHidden();
    await expect(runners.getByText("Laptop runner")).toBeVisible();
    expect(await page.locator("body").innerText()).not.toContain(token);
    const list = await (await ctx.request.get(`/api/companies/${cid}/runners`)).json();
    expect(JSON.stringify(list)).not.toContain(token);
    await page.reload();
    expect(await page.content()).not.toContain(token);

    // The token works once against the runner protocol, then revoke kills it.
    const hb = await ctx.request.post("/api/runner/heartbeat", { headers: { authorization: `Bearer ${token}` }, data: { capabilities: { providers: ["ANTHROPIC"], auth: "subscription", version: "e2e" } } });
    expect(hb.status()).toBe(200);
    await runners.getByRole("button", { name: "Revoke" }).click();
    await page.getByRole("alertdialog").or(page.getByRole("dialog")).getByRole("button", { name: "Revoke runner" }).click();
    await expect(page.getByText("Laptop runner revoked")).toBeVisible();
    const hb2 = await ctx.request.post("/api/runner/heartbeat", { headers: { authorization: `Bearer ${token}` }, data: { capabilities: {} } });
    expect(hb2.status()).toBe(401);

    // Usage: subscription quota is never readable.
    const usage = page.locator("section[aria-labelledby='usage-h']");
    await expect(usage.getByText("Subscription quota", { exact: true })).toBeVisible();
    await expect(usage.getByText("Unavailable", { exact: true }).first()).toBeVisible();
    const u = await (await ctx.request.get(`/api/companies/${cid}/usage`)).json();
    expect(u.subscriptionQuota).toBe("unavailable");
    await ctx.close();
  });
});
