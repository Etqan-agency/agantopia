import { expect, test } from "@playwright/test";
import { createTaskApi, newOwner, trackErrors } from "./helpers";

test.describe("Subscription-first integrations", () => {
  test("provider cards: connect with my subscription shows runner setup; API keys need the billing acknowledgement", async ({ browser }) => {
    const { ctx, page, company } = await newOwner(browser, "subs", "Subscription Co");
    const cid = company.companyId;
    const errors = trackErrors(page);
    await page.goto("/integrations");

    const claude = page.getByRole("article", { name: "Claude Code" });
    const codex = page.getByRole("article", { name: "OpenAI Codex" });
    await expect(claude).toBeVisible();
    await expect(codex).toBeVisible();
    await expect(claude.getByTestId("provider-status")).toHaveText("Disconnected");
    await expect(codex.getByTestId("provider-status")).toHaveText("Disconnected");
    await expect(claude.getByText("Your Claude plan via the unmodified Claude Code CLI on your machine")).toBeVisible();
    await expect(codex.getByText("Your ChatGPT plan via the Codex CLI on your machine")).toBeVisible();
    await expect(claude.getByText("Usage details unavailable from provider.")).toBeVisible();

    // Connect with my subscription: no key, the card waits for the local runner.
    await claude.getByRole("button", { name: "Connect with my subscription" }).click();
    await expect(claude.getByTestId("provider-status")).toHaveText("Runner offline", { timeout: 15_000 });
    const steps = claude.getByRole("list", { name: "Set up Claude Code on your machine" });
    await expect(steps).toBeVisible();
    await expect(steps).toContainText("/login");
    await expect(steps).toContainText("pnpm runner --server");
    await expect(claude.getByRole("button", { name: "Reconnect" })).toBeVisible();
    await expect(claude.getByRole("button", { name: "Revoke" })).toBeVisible();

    const status = await (await ctx.request.get(`/api/companies/${cid}/providers/status`)).json();
    const claudeStatus = (status as Array<{ provider: string; status: string; authMode: string | null; usage: { kind: string } }>).find((s) => s.provider === "ANTHROPIC")!;
    expect(claudeStatus).toMatchObject({ status: "RUNNER_OFFLINE", authMode: "SUBSCRIPTION_CLI", usage: { kind: "unavailable" } });
    const conns = (await (await ctx.request.get(`/api/companies/${cid}/providers`)).json()).items as Array<{ provider: string; mode: string; hasSecret: boolean }>;
    expect(conns.find((c) => c.provider === "ANTHROPIC")).toMatchObject({ mode: "LOCAL_RUNNER", hasSecret: false });

    // Reconnect never logs in; it explains what to do on the machine.
    await claude.getByRole("button", { name: "Reconnect" }).click();
    await expect(page.getByText(/run `claude` and `\/login`/)).toBeVisible();

    // API key instead: refused without the acknowledgement, in the UI and by the API.
    await codex.getByRole("button", { name: "Use an API key instead (billed separately)" }).click();
    const dlg = page.getByRole("dialog", { name: "Use an API key for OpenAI Codex" });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByText("A Claude or ChatGPT subscription is not an API key. API usage is billed separately by the provider.")).toBeVisible();
    await dlg.getByLabel("API key").fill("sk-e2e-not-a-real-key-0000");
    await dlg.getByRole("button", { name: "Save API key" }).click();
    await expect(dlg.getByRole("alert")).toContainText("billed separately");
    await expect(dlg).toBeVisible();
    await dlg.getByRole("button", { name: "Cancel" }).click();
    await expect(dlg).toBeHidden();

    const refused = await ctx.request.post(`/api/companies/${cid}/providers`, {
      data: { provider: "OPENAI", authMode: "API_KEY", label: "No ack", apiKey: "sk-e2e-not-a-real-key-0000" },
    });
    expect(refused.status()).toBe(400);
    expect((await refused.json()).error.code).toBe("separate_billing_not_acknowledged");
    const after = (await (await ctx.request.get(`/api/companies/${cid}/providers`)).json()).items as Array<{ provider: string }>;
    expect(after.some((c) => c.provider === "OPENAI")).toBe(false);
    await expect(codex.getByTestId("provider-status")).toHaveText("Disconnected");

    // The existing connections table and runners section are still below the cards.
    await expect(page.locator("section[aria-labelledby='providers-h']")).toContainText("Claude Code (subscription)");
    await expect(page.locator("section[aria-labelledby='runners-h']")).toBeVisible();
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test("tasks board has a Waiting for provider limit column", async ({ browser }) => {
    const { ctx, page, company } = await newOwner(browser, "limitcol", "Limit Column Co");
    await createTaskApi(ctx.request, company.companyId, { title: "Board column check", description: "Any task so the board renders." });
    await page.goto("/tasks");
    const col = page.getByRole("region", { name: /Task board/ }).getByRole("heading", { name: /^Waiting for provider limit/ });
    await expect(col).toBeVisible();
    await expect(col.locator("[data-lamp='waiting']")).toHaveCount(1);
    await ctx.close();
  });

  test("settings: paid learning is off by default and can be allowed explicitly", async ({ browser }) => {
    const { ctx, page, company } = await newOwner(browser, "paidlearn", "Paid Learning Co");
    await page.goto("/settings");
    const toggle = page.getByRole("switch", { name: /Allow learning to use an API-key connection \(billed separately\)/ });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await page.getByRole("button", { name: "Save policies" }).click();
    await expect(page.getByText("Policies saved")).toBeVisible();
    const c = await (await ctx.request.get(`/api/companies/${company.companyId}`)).json();
    expect(c.settings.allowPaidLearning).toBe(true);
    await ctx.close();
  });
});
