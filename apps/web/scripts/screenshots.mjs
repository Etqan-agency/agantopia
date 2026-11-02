import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const out = "/Users/khaledsakr/Documents/Agentopia/docs/screenshots";
const email = `shots+${Date.now()}@agentopia.test`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
async function shot(name, path, wait = 1500) {
  await page.goto(B + path, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => errors.push(`goto ${path}: ${e.message}`));
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  console.log("shot", name, page.url());
}
await shot("01-landing", "/");
await shot("02-demo", "/demo", 4000);
await shot("03-login", "/login");
// sign up through the API to create the session cookie
const r = await ctx.request.post(B + "/api/auth/sign-up/email", { data: { name: "Shots Owner", email, password: "Passw0rd!Passw0rd" }, headers: { origin: B } });
console.log("signup", r.status());
await shot("04-onboarding", "/onboarding");
// create company via API
const c = await ctx.request.post(B + "/api/companies", { data: { name: "Harbor Studio", timezone: "Africa/Cairo", floorName: "Floor 1" } });
const co = await c.json(); const cid = co.company?.id ?? co.id; console.log("company", c.status(), cid);
for (const [n, s] of [["Mina Fares", "FRONTEND"], ["Omar Adel", "BACKEND"], ["Laila Noor", "UIUX"], ["Youssef Kamal", "QA"], ["Nour Hany", "RESEARCH"]]) {
  const e = await ctx.request.post(`${B}/api/companies/${cid}/employees`, { data: { name: n, specialty: s, rank: "MID_LEVEL" } });
  console.log("hire", n, e.status());
}
const t = await ctx.request.post(`${B}/api/companies/${cid}/tasks`, { data: { title: "Build the pricing page", description: "Create a responsive pricing page with three tiers and an FAQ. Keep accessibility in mind.", priority: "HIGH" } });
const task = await t.json(); console.log("task", t.status(), task.id);
await page.waitForTimeout(3000);
await shot("05-office", "/office", 5000);
await shot("06-employees", "/employees");
const emps = await (await ctx.request.get(`${B}/api/companies/${cid}/employees`)).json();
const first = (emps.items ?? emps)[1] ?? (emps.items ?? emps)[0];
await shot("07-employee-detail", `/employees/${first.id}`);
await shot("08-tasks", "/tasks", 3000);
await shot("09-task-detail", `/tasks/${task.id}`, 3000);
await shot("10-organization", "/organization", 3000);
await shot("11-learning", "/learning");
await shot("12-integrations", "/integrations");
await shot("13-settings", "/settings");
await page.setViewportSize({ width: 390, height: 844 });
await shot("14-office-mobile", "/office", 3000);
await shot("15-tasks-mobile", "/tasks");
console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
