import { expect, test } from "@playwright/test";
import { newOwner } from "./helpers";

test.describe("Hiring, prompt versions, skills, rank", () => {
  test("hire via sheet, edit prompt (v2), roll back (v3), assign a skill, rank override needs a reason", async ({ browser }) => {
    const { ctx, page, company } = await newOwner(browser, "hire", "Hire Co");
    const cid = company.companyId;
    await page.goto("/employees");
    await page.getByRole("button", { name: "Hire employee" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Hire employee" });
    await expect(sheet).toBeVisible();
    // Name is required.
    await sheet.getByRole("button", { name: "Hire employee" }).click();
    await expect(sheet.getByText("Enter a name between 1 and 80 characters.")).toBeVisible();
    await sheet.getByLabel("Name").fill("Fiona Front");
    await expect(sheet.getByLabel("Specialty")).toContainText("Frontend");
    await sheet.getByRole("button", { name: "Hire employee" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText("Fiona Front hired")).toBeVisible();

    const list = await (await ctx.request.get(`/api/companies/${cid}/employees`)).json();
    const emp = (list.items ?? list).find((e: { name: string }) => e.name === "Fiona Front");
    expect(emp.specialty).toBe("FRONTEND");

    // Detail page.
    await page.getByRole("link", { name: /Fiona Front/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/employees/${emp.id}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Fiona Front" })).toBeVisible();

    // Prompt: version 1 from the template, edit -> version 2.
    await page.getByRole("tab", { name: "Prompt" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: /^Version 1/ }).first()).toBeVisible();
    const identity = page.getByLabel("Identity", { exact: true });
    await identity.fill("You are Fiona, a meticulous frontend engineer. E2E edit.");
    await page.getByLabel(/Change note/).fill("e2e edit");
    await page.getByRole("button", { name: "Save new version" }).click();
    await expect(page.getByText("Prompt saved as version 2")).toBeVisible();
    await expect.poll(async () => (await (await ctx.request.get(`/api/companies/${cid}/employees/${emp.id}`)).json()).currentPromptVersion ?? null).toBe(2);
    await expect(page.getByText("1 added, 1 removed").first()).toBeVisible();

    // Roll back to version 1 -> version 3 that copies version 1.
    await page.getByRole("button", { name: "Roll back to version 1" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Roll back" }).or(page.getByRole("dialog").getByRole("button", { name: "Roll back" })).first().click();
    await expect(page.getByText("Rolled back to version 1")).toBeVisible();
    const versions = await (await ctx.request.get(`/api/companies/${cid}/employees/${emp.id}/prompt-versions`)).json();
    const vs = (versions.items ?? versions) as Array<{ version: number; fields: { identity: string } }>;
    expect(vs.map((v) => v.version).sort()).toEqual([1, 2, 3]);
    const v1 = vs.find((v) => v.version === 1)!;
    const v3 = vs.find((v) => v.version === 3)!;
    expect(v3.fields.identity).toBe(v1.fields.identity);
    await expect(page.getByLabel("Identity", { exact: true })).toHaveValue(v1.fields.identity);

    // Skills: assigned proficiency copy, assign one more skill as Expert.
    await page.getByRole("tab", { name: "Skills" }).click();
    await expect(page.getByText("Assigned proficiency is not demonstrated experience.", { exact: false })).toBeVisible();
    const before = (await (await ctx.request.get(`/api/companies/${cid}/employees/${emp.id}`)).json()).skills as Array<{ skillId: string }>;
    const off = page.getByRole("switch", { name: /^Assign / }).and(page.locator("[aria-checked='false']")).first();
    let skillName: string | null = null;
    if (!(await off.count())) await page.getByRole("switch", { name: "Show skills for other specialties" }).click();
    skillName = ((await off.getAttribute("aria-label")) ?? "").replace(/^Assign /, "");
    await off.click();
    await page.getByRole("combobox", { name: `Proficiency for ${skillName}` }).click();
    await page.getByRole("option", { name: "Expert" }).click();
    await page.getByRole("button", { name: "Save skills" }).click();
    await expect(page.getByText("Skills saved")).toBeVisible();
    const after = (await (await ctx.request.get(`/api/companies/${cid}/employees/${emp.id}`)).json()).skills as Array<{ skillId: string; proficiency: string; name?: string; skill?: { name: string } }>;
    expect(after.length).toBe(before.length + 1);
    expect(after.some((s) => s.proficiency === "EXPERT")).toBe(true);

    // Rank override requires a reason.
    await page.getByRole("tab", { name: "Progression" }).click();
    await page.getByRole("button", { name: "Override rank" }).click();
    const dlg = page.getByRole("dialog", { name: "Override rank" });
    await dlg.getByLabel("New rank").click();
    await page.getByRole("option", { name: "Senior" }).click();
    await dlg.getByRole("button", { name: "Change rank" }).click();
    await expect(dlg.getByText("Give a reason of at least 3 characters.", { exact: false })).toBeVisible();
    expect((await (await ctx.request.get(`/api/companies/${cid}/employees/${emp.id}`)).json()).rank).toBe(emp.rank);
    // API enforces it too.
    expect((await ctx.request.post(`/api/companies/${cid}/employees/${emp.id}/rank`, { data: { rank: "SENIOR", reason: "" } })).status()).toBe(400);
    await dlg.getByLabel("Reason").fill("Shipped the design system migration");
    await dlg.getByRole("button", { name: "Change rank" }).click();
    await expect(page.getByText("Rank changed to Senior")).toBeVisible();
    const final = await (await ctx.request.get(`/api/companies/${cid}/employees/${emp.id}`)).json();
    expect(final.rank).toBe("SENIOR");
    await expect(page.getByText("Shipped the design system migration").first()).toBeVisible();
    await ctx.close();
  });
});
