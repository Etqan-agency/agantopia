import { expect, test } from "@playwright/test";
import { BASE, createTaskApi, hireApi, newOwner, signUpApi } from "./helpers";

test.describe("Companies and floors", () => {
  test("open a second company on a new floor, rename floor and company, switch floors in the rail", async ({ browser }) => {
    const { ctx, page, company: alpha } = await newOwner(browser, "floors", "Alpha Co");
    await page.goto("/settings");
    const openForm = page.locator("form").filter({ has: page.getByRole("heading", { name: "Open another company" }) });
    await openForm.getByLabel("Company name").fill("Beta Co");
    await openForm.getByLabel(/Floor name/).fill("Beta Floor");
    await openForm.getByRole("button", { name: "Open company" }).click();
    await expect(page.getByText("Beta Co is open")).toBeVisible();

    // Two floors, two companies, one building.
    await expect.poll(async () => {
      const me = await (await ctx.request.get("/api/me")).json();
      return me.buildings.flatMap((b: { floors: Array<{ company: { name: string } | null }> }) => b.floors.map((f) => f.company?.name)).sort();
    }).toEqual(["Alpha Co", "Beta Co"]);
    const me = await (await ctx.request.get("/api/me")).json();
    const beta = me.buildings[0].floors.find((f: { company: { name: string } | null }) => f.company?.name === "Beta Co");
    expect(me.buildings[0].floors.find((f: { id: string }) => f.id === alpha.floorId)).toBeTruthy();

    // The switcher now points at Beta Co.
    const switcher = page.getByRole("button", { name: /^Switch floor\. Current:/ }).first();
    await expect(switcher).toHaveAccessibleName(/Beta Co/);

    // Rename the floor inline.
    await page.getByRole("button", { name: "Rename Beta Floor" }).click();
    await page.getByRole("textbox", { name: "Floor name", exact: true }).first().fill("Beta Penthouse");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Rename Beta Penthouse" })).toBeVisible();

    // Rename the (current) company.
    const companyName = page.locator("section[aria-labelledby='company-h']").getByLabel("Company name");
    await expect(companyName).toHaveValue("Beta Co");
    await companyName.fill("Beta Holdings");
    await page.getByRole("button", { name: "Save company" }).click();
    await expect(page.getByText("Company saved")).toBeVisible();
    const detail = await (await ctx.request.get(`/api/companies/${beta.companyId}`)).json();
    expect((detail.company ?? detail).name).toBe("Beta Holdings");
    const me2 = await (await ctx.request.get("/api/me")).json();
    expect(me2.buildings[0].floors.map((f: { name: string }) => f.name).sort()).toEqual(["Beta Penthouse", "Floor 1"]);

    // Switch floors from the rail.
    await switcher.click();
    await page.getByRole("menuitemradio", { name: /Alpha Co/ }).click();
    await expect(switcher).toHaveAccessibleName(/Alpha Co/);
    await page.goto("/office?view=list");
    await expect(page.getByRole("heading", { level: 1, name: "Alpha Co" })).toBeVisible();
    await switcher.click();
    await page.getByRole("menuitemradio", { name: /Beta Holdings/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Beta Holdings" })).toBeVisible();
    await ctx.close();
  });

  test("tenant isolation: user B cannot read or change user A's company", async ({ browser, playwright }) => {
    const { ctx: a, company } = await newOwner(browser, "iso-a", "Isolated A");
    const emp = await hireApi(a.request, company.companyId, "Private Pat", "FRONTEND");
    const task = await createTaskApi(a.request, company.companyId, { title: "A's private task", description: "nobody else may read this" });

    const b = await playwright.request.newContext({ baseURL: BASE });
    await signUpApi(b, "iso-b");
    await b.post("/api/companies", { data: { name: "Company B" } });
    const cid = company.companyId;
    const denied = async (p: Promise<{ status(): number }>) => expect([403, 404]).toContain((await p).status());
    await denied(b.get(`/api/companies/${cid}`));
    await denied(b.patch(`/api/companies/${cid}`, { data: { name: "hijacked" } }));
    await denied(b.get(`/api/companies/${cid}/employees`));
    await denied(b.get(`/api/companies/${cid}/employees/${emp.id}`));
    await denied(b.post(`/api/companies/${cid}/employees`, { data: { name: "Mole", specialty: "QA" } }));
    await denied(b.get(`/api/companies/${cid}/tasks`));
    await denied(b.get(`/api/companies/${cid}/tasks/${task.id}`));
    await denied(b.post(`/api/companies/${cid}/tasks`, { data: { title: "evil", description: "evil task" } }));
    await denied(b.get(`/api/companies/${cid}/events?after=0`));
    await denied(b.get(`/api/companies/${cid}/approvals?status=PENDING`));
    await denied(b.get(`/api/companies/${cid}/providers`));
    await denied(b.get(`/api/companies/${cid}/knowledge`));
    await denied(b.get(`/api/companies/${cid}/memory/search?q=private`));
    await denied(b.get(`/api/companies/${cid}/usage`));
    await denied(b.get(`/api/floors/${company.floorId}/view`));
    await denied(b.patch(`/api/floors/${company.floorId}`, { data: { name: "hijacked" } }));
    await denied(b.patch(`/api/buildings/${company.buildingId}`, { data: { name: "hijacked" } }));
    await denied(b.post(`/api/floors`, { data: { buildingId: company.buildingId, name: "squat" } }));

    const meB = await (await b.get("/api/me")).json();
    const s = JSON.stringify(meB);
    expect(s).not.toContain(cid);
    expect(s).not.toContain(company.floorId);
    expect(s).not.toContain(company.buildingId);
    expect(s).not.toContain("Isolated A");

    // A's company is unchanged.
    const detail = await (await a.request.get(`/api/companies/${cid}`)).json();
    expect((detail.company ?? detail).name).toBe("Isolated A");
    await a.close();
    await b.dispose();
  });
});
