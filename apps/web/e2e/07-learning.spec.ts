import { expect, test, type Page } from "@playwright/test";
import { hireApi, newOwner } from "./helpers";

const DAY_INDEX: Record<string, string> = { Mon: "monday", Tue: "tuesday", Wed: "wednesday", Thu: "thursday", Fri: "friday", Sat: "saturday", Sun: "sunday" };

/** Weekday and HH:MM of an ISO instant in a timezone. */
function local(iso: string, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { day: DAY_INDEX[get("weekday")]!, time: `${get("hour")}:${get("minute")}` };
}

async function nextRuns(page: Page) {
  const section = page.locator("section[aria-labelledby='sched-company']");
  const list = section.locator("h3:text-is('Next runs') + ol time");
  await expect(list.first()).toBeVisible();
  return list.evaluateAll((els) => els.map((e) => e.getAttribute("datetime")!));
}

async function setDays(page: Page, days: string[]) {
  const section = page.locator("section[aria-labelledby='sched-company']");
  // Turn on the wanted days first (at least one day must stay selected), then turn off the rest.
  for (const d of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
    const b = section.getByRole("button", { name: d, exact: true });
    if (days.includes(d) && (await b.getAttribute("aria-pressed")) !== "true") await b.click();
  }
  for (const d of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
    const b = section.getByRole("button", { name: d, exact: true });
    if (!days.includes(d) && (await b.getAttribute("aria-pressed")) === "true") await b.click();
  }
}

test.describe("Learning", () => {
  test("schedule edits update the next-run preview and persist", async ({ browser }) => {
    const { ctx, page, company } = await newOwner(browser, "learn", "Learning Co");
    const cid = company.companyId;
    await page.goto("/learning");
    const section = page.locator("section[aria-labelledby='sched-company']");
    await expect(section).toBeVisible();

    // 1) A different schedule first so the preview has something to change from.
    await setDays(page, ["Tue"]);
    await section.getByLabel("Time", { exact: true }).fill("14:30");
    await section.getByLabel("Timezone").fill("Europe/London");
    await section.getByLabel("Maximum run length (minutes)").fill("15");
    await section.getByRole("radio", { name: "Zero" }).check();
    await section.getByRole("button", { name: "Save schedule" }).click();
    await expect(page.getByText("Schedule saved").first()).toBeVisible();
    await expect.poll(async () => (await nextRuns(page)).map((r) => local(r, "Europe/London").time)).toEqual(expect.arrayContaining(["14:30"]));
    const first = await nextRuns(page);
    for (const r of first) expect(local(r, "Europe/London")).toEqual({ day: "tuesday", time: "14:30" });

    // 2) The acceptance schedule: Mon/Thu 09:00 Africa/Cairo, 10 minutes, Low.
    await setDays(page, ["Mon", "Thu"]);
    await section.getByLabel("Time", { exact: true }).fill("09:00");
    await section.getByLabel("Timezone").fill("Africa/Cairo");
    await section.getByLabel("Maximum run length (minutes)").fill("10");
    await section.getByRole("radio", { name: "Zero" }).check();
    await section.getByRole("radio", { name: "Low" }).check();
    await section.getByRole("button", { name: "Save schedule" }).click();
    await expect.poll(async () => JSON.stringify(await nextRuns(page))).not.toBe(JSON.stringify(first));
    const runs = await nextRuns(page);
    expect(runs.length).toBeGreaterThanOrEqual(2);
    for (const r of runs) {
      const l = local(r, "Africa/Cairo");
      expect(["monday", "thursday"]).toContain(l.day);
      expect(l.time).toBe("09:00");
      expect(new Date(r).getTime()).toBeGreaterThan(Date.now());
    }

    // The PUT persisted.
    const saved = await (await ctx.request.get(`/api/companies/${cid}/learning/schedules`)).json();
    const s = ((saved.items ?? saved) as Array<Record<string, unknown>>).find((x) => x.employeeId === null)!;
    const cfg = (s.config ?? s) as Record<string, unknown>;
    expect([...(cfg.days as string[])].sort()).toEqual(["monday", "thursday"]);
    expect(cfg.time).toBe("09:00");
    expect(cfg.timezone).toBe("Africa/Cairo");
    expect(cfg.maxDurationMinutes).toBe(10);
    expect(cfg.tokenStrategy).toBe("LOW");
    await page.reload();
    await expect(section.getByRole("button", { name: "Mon", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(section.getByRole("button", { name: "Tue", exact: true })).toHaveAttribute("aria-pressed", "false");
    await expect(section.getByLabel("Timezone")).toHaveValue("Africa/Cairo");
    await expect(section.getByRole("radio", { name: "Low" })).toBeChecked();

    // Invalid duration is refused client-side.
    await section.getByLabel("Maximum run length (minutes)").fill("45");
    await section.getByRole("button", { name: "Save schedule" }).click();
    await expect(section.getByRole("alert").first()).toBeVisible();
    await ctx.close();
  });

  test("docs source, owner knowledge is VERIFIED and cited by the retrieval tester; queue holds no demo drafts", async ({ browser }) => {
    const { ctx, page, company } = await newOwner(browser, "know", "Knowledge Co");
    const cid = company.companyId;
    const emp = await hireApi(ctx.request, cid, "Farah Front", "FRONTEND");

    await page.goto("/learning");
    // Approval queue is empty for a new company (demo drafts never leak in).
    await expect(page.getByText("Nothing to review")).toBeVisible();
    const drafts = await (await ctx.request.get(`/api/companies/${cid}/knowledge?status=DRAFT`)).json();
    expect((drafts.items ?? drafts) as unknown[]).toHaveLength(0);

    // Add a docs source for FRONTEND.
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Add source" }) }).first();
    await form.getByLabel("URL").fill("https://react.dev/reference/react");
    await form.getByLabel("Name").fill("React reference e2e");
    await expect(form.getByLabel("Specialty")).toContainText("Frontend");
    await form.getByLabel(/Topics/).fill("hooks, forms");
    await form.getByRole("button", { name: "Add source" }).click();
    await expect(page.getByText("Added React reference e2e")).toBeVisible();
    const sources = await (await ctx.request.get(`/api/companies/${cid}/learning/sources`)).json();
    const src = ((sources.items ?? sources) as Array<{ title: string; kind: string; specialty: string; url: string }>).find((s) => s.title === "React reference e2e");
    expect(src).toMatchObject({ kind: "DOCS", specialty: "FRONTEND", url: "https://react.dev/reference/react" });
    await expect(page.getByText("React reference e2e").first()).toBeVisible();

    // Owner instruction through the employee's Knowledge tab.
    const marker = `zephyrform${Date.now()}`;
    await page.goto(`/employees/${emp.id}`);
    await page.getByRole("tab", { name: "Knowledge" }).click();
    await page.getByRole("button", { name: "Add instruction" }).click();
    const dlg = page.getByRole("dialog", { name: "Add an instruction for Farah Front" });
    await dlg.getByLabel("Title").fill("Form validation rule");
    await dlg.getByLabel("Instruction").fill(`Always validate ${marker} forms on blur and show inline errors with aria-describedby.`);
    await dlg.getByRole("button", { name: "Add instruction" }).click();
    await expect(page.getByText("Instruction added")).toBeVisible();
    const all = await (await ctx.request.get(`/api/companies/${cid}/knowledge`)).json();
    const k = ((all.items ?? all) as Array<{ id: string; title: string; status: string }>).find((x) => x.title === "Form validation rule");
    expect(k?.status).toBe("VERIFIED");
    await expect(page.getByRole("tab", { name: /Verified/ })).toContainText("1");

    // Retrieval tester cites it.
    await page.goto("/learning");
    // Let the sections above finish loading so the layout stops shifting before the select opens.
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Nothing to review")).toBeVisible();
    await expect(page.getByText("React reference e2e").first()).toBeVisible();
    const tester = page.locator("section[aria-labelledby='tester-h']");
    await tester.getByLabel("Query").fill(`${marker} validation`);
    await tester.getByLabel("As employee").click();
    await page.getByRole("option", { name: "Farah Front" }).click();
    await tester.getByRole("button", { name: "Search memory" }).click();
    const hit = tester.getByRole("listitem").filter({ hasText: "Form validation rule" });
    await expect(hit).toBeVisible();
    await expect(hit).toContainText("Owner instruction");
    await expect(hit).toContainText(marker);
    await expect(hit).toContainText("written inside Agentopia");
    const api = await (await ctx.request.get(`/api/companies/${cid}/memory/search?q=${marker}&employeeId=${emp.id}`)).json();
    expect(JSON.stringify(api)).toContain(k!.id);
    await ctx.close();
  });
});
