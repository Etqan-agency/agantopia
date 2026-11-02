import { expect, test } from "@playwright/test";
import { createTaskApi, getTaskApi, hireApi, newOwner, waitForEvent, waitForTaskStatus } from "./helpers";

test.describe("Approvals and failures", () => {
  test("[simulate:block] raises an approval, approving it in the Tasks strip completes the task", async ({ browser }) => {
    const { ctx, page, company } = await newOwner(browser, "approve", "Approval Co");
    const cid = company.companyId;
    await hireApi(ctx.request, cid, "Bea Backend", "BACKEND");
    await page.goto("/tasks");
    await expect(page.getByRole("heading", { level: 1, name: "Tasks" })).toBeVisible();

    const task = await createTaskApi(ctx.request, cid, { title: "Write the migration script", description: "Add the users table migration. [simulate:block]" });
    await waitForTaskStatus(ctx.request, cid, task.id, ["WAITING_APPROVAL"]);
    const pending = await (await ctx.request.get(`/api/companies/${cid}/approvals?status=PENDING`)).json();
    const items = (pending.items ?? pending) as Array<{ id: string; title: string; taskId?: string; task?: { id: string } }>;
    expect(items).toHaveLength(1);
    expect(items[0]!.task?.id ?? items[0]!.taskId).toBe(task.id);

    // The approvals strip on the Tasks page shows it live.
    const strip = page.locator("section[aria-labelledby='approvals-heading']");
    await expect(strip).toBeVisible({ timeout: 15_000 });
    await expect(strip.getByRole("heading")).toHaveText("1 request is waiting for your approval");
    await expect(strip.getByRole("link", { name: "Write the migration script" })).toBeVisible();
    await strip.getByRole("button", { name: `Approve: ${items[0]!.title}` }).click();
    await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
    await expect(strip).toBeHidden({ timeout: 15_000 });

    await waitForTaskStatus(ctx.request, cid, task.id, ["COMPLETED"]);
    const decided = await (await ctx.request.get(`/api/companies/${cid}/approvals?status=APPROVED`)).json();
    expect(((decided.items ?? decided) as Array<{ id: string }>).map((a) => a.id)).toContain(items[0]!.id);
    await page.goto(`/tasks/${task.id}`);
    await expect(page.getByRole("list", { name: "Task timeline" }).getByText("Waiting for approval", { exact: true })).toBeVisible();
    await expect(page.getByRole("list", { name: "Task timeline" }).getByText("Approval decided", { exact: true })).toBeVisible();
    await expect(page.locator("main").getByText("Completed", { exact: true }).first()).toBeVisible();
    await ctx.close();
  });

  test("[simulate:fail] ends FAILED after a retry, the UI shows it and Retry starts a new attempt", async ({ browser }) => {
    const { ctx, page, company } = await newOwner(browser, "fail", "Failure Co");
    const cid = company.companyId;
    await hireApi(ctx.request, cid, "Quinn QA", "QA");
    const task = await createTaskApi(ctx.request, cid, { title: "Run the regression suite", description: "Run every regression test. [simulate:fail]" });
    await waitForEvent(ctx.request, cid, (e) => e.taskId === task.id && e.type === "task.failed", 60_000);
    const failed = await waitForTaskStatus(ctx.request, cid, task.id, ["FAILED"]);
    const events = await waitForEvent(ctx.request, cid, (e) => e.taskId === task.id && e.type === "task.failed");
    const mine = events.filter((e) => e.taskId === task.id);
    expect(mine.some((e) => e.type === "task.retry_scheduled"), mine.map((e) => e.type).join(",")).toBe(true);
    expect(mine.filter((e) => e.type === "execution.started").length).toBeGreaterThanOrEqual(2);
    expect((failed as unknown as { attempt: number }).attempt).toBeGreaterThanOrEqual(2);

    await page.goto(`/tasks/${task.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Run the regression suite" })).toBeVisible();
    await expect(page.locator("main").getByText("Failed", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("list", { name: "Task timeline" }).getByText("Retry scheduled", { exact: true })).toBeVisible();
    const before = (await getTaskApi(ctx.request, cid, task.id)) as unknown as { executions: unknown[] };

    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText("Retry queued")).toBeVisible();
    await expect
      .poll(async () => ((await getTaskApi(ctx.request, cid, task.id)) as unknown as { executions: unknown[] }).executions.length, { timeout: 30_000 })
      .toBeGreaterThan(before.executions.length);
    await waitForTaskStatus(ctx.request, cid, task.id, ["FAILED"]);
    await expect(page.locator("main").getByText("Failed", { exact: true }).first()).toBeVisible();
    await ctx.close();
  });
});
