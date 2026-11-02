import { expect, test } from "@playwright/test";
import { EVENT_TO_VISUAL } from "@agentopia/shared";
import { hireApi, newOwner, waitForEvent } from "./helpers";

test.describe("Task to office", () => {
  test("a task created in the office runs, shows in the list view and feed, and its detail timeline is complete", async ({ browser }) => {
    const { ctx, page, company } = await newOwner(browser, "office", "Office Co");
    const cid = company.companyId;
    const mina = await hireApi(ctx.request, cid, "Mina Fares", "FRONTEND");

    await page.goto("/office?view=list");
    await expect(page.getByRole("heading", { level: 1, name: "Office Co" })).toBeVisible();
    const row = page.getByRole("button", { name: /Mina Fares/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Idle");
    // The office's own SSE stream is open once the "live updates …" suffix is gone.
    await expect(page.locator("header p").first()).not.toContainText("live updates", { timeout: 15_000 });

    // Record every text the employee's row shows while the task runs.
    await page.evaluate(() => {
      const w = window as unknown as { __rowTexts: string[] };
      w.__rowTexts = [];
      const snap = () => {
        for (const b of document.querySelectorAll("main button[aria-pressed]")) {
          const t = b.textContent ?? "";
          if (t.includes("Mina Fares") && w.__rowTexts[w.__rowTexts.length - 1] !== t) w.__rowTexts.push(t);
        }
      };
      new MutationObserver(snap).observe(document.body, { subtree: true, childList: true, characterData: true });
      snap();
    });

    const title = `Build the pricing page ${Date.now()}`;
    await page.getByRole("button", { name: "New task" }).click();
    const dialog = page.getByRole("dialog", { name: "New task" });
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByLabel("Description").fill("Create a responsive pricing page with three tiers and an FAQ.");
    await dialog.getByRole("button", { name: "Create task" }).click();
    await expect(dialog).toBeHidden();

    const first = await waitForEvent(ctx.request, cid, (e) => e.type === "task.created" && e.payload.title === title);
    const taskId = first.find((e) => e.type === "task.created" && e.payload.title === title)!.taskId!;
    const events = await waitForEvent(ctx.request, cid, (e) => e.type === "task.completed" && e.taskId === taskId);
    const forTask = events.filter((e) => e.taskId === taskId).sort((a, b) => a.seq - b.seq);
    const order = ["task.assigned", "task.started", "task.handoff", "task.review_started", "task.completed"];
    const seqs = order.map((t) => forTask.find((e) => e.type === t)?.seq ?? -1);
    expect(seqs.every((s) => s > 0), `missing lifecycle events: ${forTask.map((e) => e.type).join(",")}`).toBe(true);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    expect(forTask.find((e) => e.type === "task.assigned")!.employeeId).toBe(mina.id);

    // The assignee's visual state was projected to WORKING by at least one persisted event.
    const workingEvents = forTask.filter(
      (e) => e.employeeId === mina.id && ((e.type === "employee.state" && e.payload.state === "WORKING") || EVENT_TO_VISUAL[e.type] === "WORKING"),
    );
    expect(workingEvents.length).toBeGreaterThan(0);

    // List view showed the employee working on this task (state + current task title).
    await expect
      .poll(async () => page.evaluate(() => (window as unknown as { __rowTexts: string[] }).__rowTexts), { timeout: 10_000 })
      .toEqual(expect.arrayContaining([expect.stringMatching(/Working/)]));
    const texts = await page.evaluate(() => (window as unknown as { __rowTexts: string[] }).__rowTexts);
    expect(texts.some((t) => t.includes(title) && /Working|Thinking|Collaborating/.test(t)), texts.join("\n")).toBe(true);

    // The live feed received the events.
    const feed = page.locator("section[aria-labelledby='office-feed-title']");
    await expect(feed.getByRole("listitem").filter({ hasText: title }).first()).toBeVisible();
    await expect(feed.getByRole("listitem").filter({ hasText: /complet/i }).first()).toBeVisible();

    // Task detail.
    await page.goto(`/tasks/${taskId}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const timeline = page.getByRole("list", { name: "Task timeline" });
    await expect(timeline).toBeVisible();
    const labels = await timeline.locator(":scope > li span.font-medium").allTextContents();
    const idx = ["Assigned", "Work started", "Handed off", "Review started", "Completed"].map((l) => labels.indexOf(l));
    expect(idx.every((i) => i >= 0), labels.join(" | ")).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    const artifact = page.getByRole("listitem").filter({ hasText: "summary.md" });
    await expect(artifact).toBeVisible();
    await expect(artifact.getByText("Simulated", { exact: true })).toBeVisible();
    await artifact.getByRole("button", { name: "Show" }).click();
    await expect(artifact.locator("pre")).toContainText("Simulated run");

    // Tasks board: the board scrolls horizontally to the Completed column, which holds the task.
    await page.goto("/tasks");
    const board = page.getByRole("region", { name: "Task board, scrolls horizontally" });
    await expect(board).toBeVisible();
    const dims = await board.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    expect(dims.sw).toBeGreaterThan(dims.cw);
    const completed = board.locator("section[aria-labelledby='col-completed']");
    await completed.scrollIntoViewIfNeeded();
    expect(await board.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await expect(completed.getByRole("link", { name: new RegExp(title) })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await ctx.close();
  });

  test("the Static view toggle swaps the canvas for the list view and back; the canvas fits the floor with name labels", async ({ browser }) => {
    const { ctx, page, company } = await newOwner(browser, "static", "Static Co");
    await hireApi(ctx.request, company.companyId, "Mina Fares", "FRONTEND");
    await page.goto("/office");
    const canvasRegion = page.getByRole("region", { name: /Office floor canvas/ });
    await expect(canvasRegion).toBeVisible();
    await expect(canvasRegion.locator("canvas")).toHaveCount(1, { timeout: 15_000 });
    // Name labels are rendered (HTML, aria-hidden) for every employee, as on the demo.
    await expect.poll(async () => canvasRegion.locator("div[aria-hidden='true'] > div").evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== "none").map((e) => e.textContent)), { timeout: 10_000 }).toEqual(expect.arrayContaining(["Mina Fares"]));
    await page.getByRole("button", { name: "Static view" }).click();
    await expect(page.getByText("Static view is on.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Mina Fares/ })).toContainText("Idle");
    await expect(page.locator("canvas")).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Static view is on.")).toBeVisible();
    await page.getByRole("button", { name: "Show the office canvas" }).click();
    await expect(page.getByRole("region", { name: /Office floor canvas/ })).toBeVisible();
    await ctx.close();
  });
});
