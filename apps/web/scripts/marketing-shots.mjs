// Product screenshots for the marketing site.
//
//   node apps/web/scripts/marketing-shots.mjs             # seed (or reuse) an account, capture, optimise, write manifest
//   MANIFEST_ONLY=1 node apps/web/scripts/marketing-shots.mjs   # rebuild webp + manifest from existing PNGs
//
// Env: BASE (default http://localhost:3100), STATE (seed state file; default in the OS temp dir),
// THEME (dark | light; default dark), ONLY (regex of capture names), MANIFEST_ONLY, KEEP_PENDING
// (skip denying the seeded approvals after capture).
// Needs the dev server and the worker (tasks run on the simulated provider). DPR 2.
// The account is a throwaway `shots+<ts>@agentopia.test`; the rail user menu is cropped out of
// the one full-shell capture, and no token is ever rendered (runner tokens are created via the API
// and never shown on a page).
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(here, "..");
const ROOT = resolve(WEB, "../..");
const require = createRequire(join(WEB, "package.json"));
const B = process.env.BASE ?? "http://localhost:3100";
const STATE = process.env.STATE ?? join(tmpdir(), "agentopia-marketing-shots.json");
const STORAGE = STATE.replace(/\.json$/, "") + ".storage.json";
const OUT = join(WEB, "public/marketing/screenshots");
const PRODUCT = join(ROOT, "artifacts/agentopia-frontend-refactor/screenshots/product");
const MANIFEST = join(WEB, "src/content/marketing/screenshots.ts");
const PASSWORD = "Passw0rd!Passw0rd";
const THEME = process.env.THEME === "light" ? "light" : "dark";
mkdirSync(OUT, { recursive: true });
mkdirSync(PRODUCT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** sharp is not a direct dependency: resolve it from apps/web, the root, or the pnpm store. */
function loadSharp() {
  for (const base of [join(WEB, "package.json"), join(ROOT, "package.json")]) {
    try {
      return createRequire(base)("sharp");
    } catch {}
  }
  const store = join(ROOT, "node_modules/.pnpm");
  if (existsSync(store)) {
    for (const d of readdirSync(store).filter((n) => n.startsWith("sharp@")).sort().reverse()) {
      try {
        return createRequire(join(store, d, "node_modules/sharp/package.json"))("sharp");
      } catch {}
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------------------------
async function seed(browser) {
  const email = `shots+${Date.now()}@agentopia.test`;
  const ctx = await browser.newContext();
  const req = ctx.request;
  const j = async (r) => (r.ok() ? r.json() : Promise.reject(new Error(`${r.url()} ${r.status()} ${await r.text()}`)));
  await j(await req.post(`${B}/api/auth/sign-up/email`, { data: { name: "Harbor Owner", email, password: PASSWORD }, headers: { origin: B } }));
  const co = await j(await req.post(`${B}/api/companies`, { data: { name: "Harbor Studio", timezone: "Africa/Cairo", floorName: "Floor 1" } }));
  const cid = co.company?.id ?? co.id;
  const emps = {};
  for (const [n, s] of [["Mina Fares", "FRONTEND"], ["Omar Adel", "BACKEND"], ["Laila Noor", "UIUX"], ["Youssef Kamal", "QA"], ["Nour Hany", "RESEARCH"]]) {
    const b = await j(await req.post(`${B}/api/companies/${cid}/employees`, { data: { name: n, specialty: s, rank: "MID_LEVEL" } }));
    emps[n] = (b.employee ?? b).id;
  }
  await j(await req.post(`${B}/api/companies/${cid}/learning/sources`, { data: { kind: "DOCS", url: "https://www.w3.org/WAI/WCAG22/quickref/", title: "WCAG 2.2 quick reference", specialty: "QA", topics: ["accessibility"] } }));
  await j(await req.post(`${B}/api/companies/${cid}/knowledge`, {
    data: { employeeId: emps["Mina Fares"], kind: "OWNER_INSTRUCTION", title: "Use the design tokens", content: "Always use the semantic colour tokens from globals.css. Never hard-code hex colours in components.", tags: ["frontend", "design system"] },
  }));
  await j(await req.post(`${B}/api/companies/${cid}/knowledge`, {
    data: { employeeId: emps["Mina Fares"], kind: "PROJECT_DOC", title: "Pricing page brief", content: "Three tiers, monthly and yearly toggle, an FAQ, and a comparison table that collapses on mobile.", tags: ["pricing"] },
  }));
  const tasks = {};
  const status = async (id) => {
    const b = await j(await req.get(`${B}/api/companies/${cid}/tasks/${id}`));
    return (b.task ?? b).status;
  };
  const task = async (title, description, priority = "NORMAL") => {
    const b = await j(await req.post(`${B}/api/companies/${cid}/tasks`, { data: { title, description, priority } }));
    tasks[title] = (b.task ?? b).id;
    return tasks[title];
  };
  const first = await task("Build the pricing page", "Create a responsive pricing page with three tiers and an FAQ. Keep accessibility in mind.", "HIGH");
  for (let i = 0; i < 90 && (await status(first)) !== "COMPLETED"; i++) await sleep(1000);
  await task("Write the onboarding email sequence", "Draft a five-email onboarding sequence for new owners: welcome, first hire, first task, learning, review.");
  // Stays in "Waiting for approval" so the board and approvals strip show a second state.
  await task("Audit the signup flow for accessibility", "Check the signup form against WCAG 2.2 AA: labels, errors, focus order and contrast. [simulate:block]");
  // Subscription-first integrations: Claude Code connected through the CLI (runner not started yet), one runner registered.
  await j(await req.post(`${B}/api/companies/${cid}/providers`, { data: { provider: "ANTHROPIC", authMode: "SUBSCRIPTION_CLI", label: "Claude Code (subscription)" } }));
  await j(await req.post(`${B}/api/companies/${cid}/runners`, { data: { name: "Studio laptop" } })); // token in the response is discarded
  await sleep(4000);
  await ctx.storageState({ path: STORAGE });
  const state = { email, cid, emps, tasks };
  writeFileSync(STATE, JSON.stringify(state, null, 2));
  await ctx.close();
  console.log("seeded", email, cid);
  return state;
}

async function loadOrSeed(browser) {
  if (existsSync(STATE) && existsSync(STORAGE)) {
    const st = JSON.parse(readFileSync(STATE, "utf8"));
    const ctx = await browser.newContext({ storageState: STORAGE });
    const r = await ctx.request.get(`${B}/api/me`);
    await ctx.close();
    if (r.ok()) {
      console.log("reusing", st.email);
      return st;
    }
  }
  return seed(browser);
}

// ---------------------------------------------------------------------------------------------
// Capture helpers
// ---------------------------------------------------------------------------------------------
const files = [];
/** The theme script in app/layout.tsx reads localStorage before paint; set it before any navigation. */
async function themed(ctx) {
  await ctx.addInitScript((t) => { try { localStorage.setItem("agentopia.theme", t); } catch {} }, THEME);
  ctx.on("page", (p) => { p.emulateMedia({ colorScheme: THEME }).catch(() => {}); });
}
/** Dev-only overlays (the Next.js dev indicator) and transient toasts are not product UI. */
const HIDE_CSS = "nextjs-portal, [data-sonner-toaster] { display: none !important; }";

async function open(ctx, path, { tab, wait = 1200 } = {}) {
  const page = await ctx.newPage();
  await page.goto(B + path, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 20_000 });
  await page.addStyleTag({ content: HIDE_CSS });
  if (tab) await page.getByRole("tab", { name: tab }).click();
  // A programmatic click leaves the focus ring on the tab; screenshots show the resting state.
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  await page.waitForTimeout(wait);
  return page;
}

/** Clip to the content column (right of the rail) from `top` for `height` CSS px. */
async function shootMain(page, name, { top = 0, height } = {}) {
  const box = await page.locator("main#main").boundingBox();
  const vh = page.viewportSize().height;
  const full = await page.evaluate(() => document.documentElement.scrollHeight);
  const h = Math.min(height ?? vh, full - top);
  const file = join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true, clip: { x: Math.round(box.x), y: Math.round(top), width: Math.round(box.width), height: Math.round(h) } });
  files.push(name);
  console.log("shot", name);
}

async function shootViewport(page, name, clip) {
  const file = join(OUT, `${name}.png`);
  await page.screenshot({ path: file, ...(clip ? { clip } : {}) });
  files.push(name);
  console.log("shot", name);
}

/** Gold lamp pixels (#FFC66D ± tolerance) in a PNG buffer: a proxy for "lamps are on". */
async function goldScore(sharp, buf) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (Math.abs(data[i] - 255) < 12 && Math.abs(data[i + 1] - 198) < 16 && Math.abs(data[i + 2] - 109) < 20) n++;
  }
  return n;
}

// ---------------------------------------------------------------------------------------------
// Optimise + manifest
// ---------------------------------------------------------------------------------------------
const MANIFEST_ENTRIES = {
  "office": {
    file: "office-1440",
    alt: "The Agentopia app in its dark theme: the navy navigation rail on the left and, on a navy page, the Harbor Studio office floor drawn as a light top-down floor plan with a manager's office, development, design, research and QA rooms and employees with name labels. Gold lamps mark live work: Mina Fares is at her desk in Development, while Laila Noor in Design and Nour Hany in Research wait for an approval, marked by an exclamation icon. The current floor is highlighted in a violet card on the left, playback controls sit above the canvas and the activity feed runs below it on dark panels.",
    caption: "The office, live: lamps light up as employees pick up work from the manager.",
  },
  "office-list": {
    file: "office-list-1440",
    alt: "The office as a list on dark navy panels, with the note that Static view is on and a button to show the office canvas: employees grouped by room (Manager's office, Development, Design, Research, QA lab), each row with name, role, what they are on and a state badge, such as a gold Working badge for Mina Fares and Waiting for approval for Nour Hany, next to the floor switcher and above the activity feed.",
    caption: "The same office as an accessible list, used for reduced motion and small screens.",
  },
  "employees": {
    file: "employees-1440",
    alt: "The Employees page for Harbor Studio in the dark theme: a table of six employees on navy (Morgan Hale the manager, Mina Fares, Omar Adel, Laila Noor, Youssef Kamal and Nour Hany) with specialty badges, rank, provider and an activity lamp, gold for Mina Fares, who is working, and amber for Nour Hany, who waits for approval, with the task each one is on, plus a Hire employee button.",
    caption: "Your team: every employee with their specialty, rank, state and provider.",
  },
  "employee-detail": {
    file: "employee-detail-overview-1440",
    alt: "Mina Fares's profile in the dark theme: a Frontend Engineer at Mid-Level on the simulated provider, working on the yearly billing toggle, with tabs for Overview, Prompt, Skills, Knowledge, Projects and tasks, Progression, Learning and Usage. The overview lists identity details, focus topics and reporting line on navy, next to an experience bar and the provider connection settings.",
    caption: "An employee profile: identity, prompt, skills, knowledge, track record and usage.",
  },
  "tasks": {
    file: "tasks-1440",
    alt: "The Tasks board in the dark theme: a strip of four approval requests for simulated tool use, each with Approve and Deny buttons, above quick links to the In progress, Waiting for approval and Completed columns; the board is scrolled to a task waiting for approval and the Completed column, each card showing the title, assignee and when it last changed.",
    caption: "Every task by status, with approvals for risky actions at the top.",
  },
  "task-detail": {
    file: "task-detail-1440",
    alt: "The task page for 'Build the pricing page' on a navy background: Completed status with High priority and Simulated tags above the title, the brief and a note that it ran on the simulated provider, the result summary, and the start of the timeline of persisted events (task created, manager planned the work, assigned to Mina Fares with the reason, and work started); on the right, the assignee, priority, attempts and timestamps, dependencies, subtasks and the handoff record.",
    caption: "A task end to end: status, result, and every step on its timeline.",
  },
  "organization": {
    file: "organization-1440",
    alt: "The organization chart for Harbor Studio in the dark theme: Morgan Hale, the manager, in a violet node at the top with five reports below on a navy canvas (Laila Noor, Mina Fares, Nour Hany, Omar Adel and Youssef Kamal), each node colour-coded by specialty with a status lamp, plus zoom controls and the start of the reporting lines list.",
    caption: "Who reports to whom, as a chart and as a list.",
  },
  "learning": {
    file: "learning-1440",
    alt: "The Learning page in the dark theme: the default schedule with learning switched on, Monday and Thursday selected at 09:00 in Africa/Cairo, a 10-minute run limit and the Low token strategy chosen over Zero; on the right, green switches for official documentation, GitHub repositories, specialty topics only, requiring approval, skipping unchanged sources and pausing when the budget runs out, with per-run and weekly token and cost budgets.",
    caption: "Learning on a schedule and a budget you set; nothing learned is used until you approve it.",
  },
  "integrations": {
    file: "integrations-cards-1440",
    alt: "Two provider cards on navy: Claude Code, connected through the user's own subscription, with the status Runner offline and three steps to install it, sign in through its own /login flow and start the local runner; and OpenAI Codex, not connected yet, with a Connect with my subscription button. Below, the Local runners list with a registered runner named Studio laptop that has never connected.",
    caption: "Subscription-first: run employees through your own Claude Code or Codex sign-in on your machine.",
  },
  "settings": {
    file: "settings-1440",
    alt: "The Settings page for Harbor Studio in the dark theme: the company name and timezone (Africa/Cairo) with a Save company button, then the building and its floors, with Floor 1 marked Current, rename, reorder, duplicate-layout and archive controls, and forms to add an empty floor or open another company on a new floor.",
    caption: "Company, floors and limits in one place.",
  },
  "onboarding": {
    file: "onboarding-1440",
    alt: "The onboarding flow in the dark theme on the Connect a provider step: a five-step progress list on the left (Account, Company and floor, Connect a provider, Model and permissions, Run a test task) and, on the right, the connection type with Use my subscription (local runner) selected ahead of the Anthropic and OpenAI API key options, the Claude Code tool picker, and three setup steps: install Claude Code, sign in through its own /login flow, and start the local runner with a runner token.",
    caption: "Set up a company in a few steps; nothing runs on a model until you connect one.",
  },
};

async function optimise(sharp) {
  const dims = {};
  for (const f of readdirSync(OUT).filter((n) => n.endsWith(".png"))) {
    const name = f.replace(/\.png$/, "");
    const png = join(OUT, f);
    if (sharp) {
      const webp = join(OUT, `${name}.webp`);
      await sharp(png).webp({ quality: 82 }).toFile(webp);
      const m = await sharp(webp).metadata();
      dims[name] = { src: `/marketing/screenshots/${name}.webp`, width: m.width, height: m.height };
    } else {
      const buf = readFileSync(png);
      dims[name] = { src: `/marketing/screenshots/${name}.png`, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (name.endsWith("-1440")) copyFileSync(png, join(PRODUCT, f));
  }
  return dims;
}

function writeManifest(dims) {
  const lines = [
    "// Generated by apps/web/scripts/marketing-shots.mjs. Do not edit by hand; re-run the script.",
    `// Real product screenshots (${THEME} theme, device scale factor 2) of a seeded Harbor Studio account`,
    "// running on the simulated provider.",
    'import type { VisualKey } from "./types";',
    "",
    'export type ScreenshotKey = VisualKey extends infer V ? (V extends `screenshot:${infer K}` ? K : never) : never;',
    "",
    "export type Screenshot = { src: string; width: number; height: number; alt: string; caption: string };",
    "",
    "export const SCREENSHOTS: Record<ScreenshotKey, Screenshot> = {",
  ];
  for (const [key, e] of Object.entries(MANIFEST_ENTRIES)) {
    const d = dims[e.file];
    if (!d) throw new Error(`missing capture for ${key} (${e.file}.png)`);
    lines.push(`  ${JSON.stringify(key)}: {`);
    lines.push(`    src: ${JSON.stringify(d.src)},`);
    lines.push(`    width: ${d.width},`);
    lines.push(`    height: ${d.height},`);
    lines.push(`    alt: ${JSON.stringify(e.alt)},`);
    lines.push(`    caption: ${JSON.stringify(e.caption)},`);
    lines.push("  },");
  }
  lines.push("};", "");
  writeFileSync(MANIFEST, lines.join("\n"));
  console.log("manifest", MANIFEST);
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------
const sharp = loadSharp();
if (!sharp) console.warn("sharp could not be resolved: keeping PNG only");

if (!process.env.MANIFEST_ONLY) {
  const { chromium } = require("@playwright/test");
  const browser = await chromium.launch();
  const st = await loadOrSeed(browser);
  const errors = [];
  const mk = async (width, height) => {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, storageState: STORAGE, colorScheme: THEME, reducedMotion: "no-preference" });
    await themed(ctx);
    ctx.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
    return ctx;
  };
  const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
  const want = (n) => !only || only.test(n) || (n === "integrations-1440" && only.test("integrations-cards-1440"));
  const desk = await mk(1440, 960);
  const mina = st.emps["Mina Fares"];

  // Office, full shell: start fresh work and keep the frame with the most lit lamps.
  if (want("office-1440")) {
    const page = await open(desk, "/office", { wait: 500 });
    const region = page.getByRole("region", { name: /Office floor canvas/ });
    await region.locator("canvas").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2500); // first fit + sprites
    // Simulated runs finish in under a second, so lamps would only flash. Two tasks gated on an
    // approval keep their assignees at their desks with the lamp on (the "waiting for approval"
    // look: lamp on, exclamation icon) while a third, ungated task runs through the office.
    // The approvals are granted right after the capture, so those tasks then complete normally.
    const stamp = new Date().toISOString().slice(11, 16);
    const post = (data) => desk.request.post(`${B}/api/companies/${st.cid}/tasks`, { data });
    const gated = [];
    for (const [who, title, d] of [
      ["Laila Noor", "Design the pricing comparison table", "Sketch the tier comparison table for desktop and mobile."],
      ["Nour Hany", "Research competitor onboarding emails", "Collect five competitor onboarding sequences and summarise what they ask of a new user."],
    ]) {
      const r = await post({ title, description: `${d} (${stamp}) [simulate:block]`, submitToManager: false, assigneeId: st.emps[who] });
      const b = await r.json();
      gated.push((b.task ?? b).id);
    }
    const waitingCount = async () => {
      const b = await (await desk.request.get(`${B}/api/companies/${st.cid}/employees`)).json();
      return (b.items ?? b).filter((e) => e.visualState === "WAITING_APPROVAL").length;
    };
    for (let i = 0; i < 60 && (await waitingCount()) < 2; i++) await sleep(1000);
    await page.waitForTimeout(4000); // let them walk to their desks
    await post({ title: "Implement the yearly billing toggle", description: `Add the monthly and yearly toggle to the pricing page with accessible labels. (${stamp})` });
    const vh = page.viewportSize().height;
    const clip = { x: 0, y: 0, width: 1440, height: vh - 76 }; // crop the rail's user menu (name + email)
    // Score only the canvas, so the gold New task button and the rail badge do not count.
    const cb = await region.locator("canvas").boundingBox();
    const area = { left: Math.round(cb.x * 2), top: Math.round(cb.y * 2), width: Math.round(cb.width * 2), height: Math.round(Math.min(cb.height, clip.height - cb.y) * 2) };
    let best = { score: -1, buf: null };
    for (let i = 0; i < 30; i++) {
      const buf = await page.screenshot({ clip });
      const score = sharp ? await goldScore(sharp, await sharp(buf).extract(area).png().toBuffer()) : 0;
      if (score > best.score) best = { score, buf };
      await page.waitForTimeout(250);
    }
    const approvals = await (await desk.request.get(`${B}/api/companies/${st.cid}/approvals?status=PENDING`)).json();
    for (const a of approvals.items ?? approvals) {
      if (gated.includes(a.taskId)) await desk.request.post(`${B}/api/companies/${st.cid}/approvals/${a.id}`, { data: { decision: "APPROVED" } });
    }
    writeFileSync(join(OUT, "office-1440.png"), best.buf);
    files.push("office-1440");
    console.log("shot office-1440, gold score", best.score);
    await page.close();
  }
  if (want("office-list-1440")) {
    const page = await open(desk, "/office?view=list", { wait: 1500 });
    await shootMain(page, "office-list-1440", { height: 900 });
    await page.close();
  }
  if (want("employees-1440")) {
    const page = await open(desk, "/employees");
    await shootMain(page, "employees-1440", { height: 760 });
    await page.close();
  }
  for (const [tab, name, height] of [["Overview", "employee-detail-overview-1440", 940], ["Knowledge", "employee-detail-knowledge-1440", 900], ["Learning", "employee-detail-learning-1440", 1100]]) {
    if (!want(name)) continue;
    const page = await open(desk, `/employees/${mina}`, { tab, wait: 1800 });
    await shootMain(page, name, { height });
    await page.close();
  }
  if (want("tasks-1440")) {
    const page = await open(desk, "/tasks", { wait: 1200 });
    const jump = page.getByRole("navigation", { name: "Jump to a column" }).getByRole("button", { name: /Waiting for approval/ });
    if (await jump.count()) {
      await jump.click();
      await page.waitForTimeout(900);
    }
    await shootMain(page, "tasks-1440", { height: 760 });
    await page.close();
  }
  if (want("task-detail-1440")) {
    // From the top of the content: header, status pill, controls, result and the first timeline
    // rows (planning, assignment, work, handoff to Youssef Kamal's review).
    const page = await open(desk, `/tasks/${st.tasks["Build the pricing page"]}`, { wait: 1800 });
    await shootMain(page, "task-detail-1440", { top: 0, height: 950 });
    await page.close();
  }
  if (want("organization-1440")) {
    const page = await open(desk, "/organization", { wait: 2500 });
    await shootMain(page, "organization-1440", { height: 900 });
    await page.close();
  }
  if (want("learning-1440")) {
    const page = await open(desk, "/learning", { wait: 2500 });
    await shootMain(page, "learning-1440", { height: 960 });
    await page.close();
  }
  if (want("integrations-1440")) {
    const page = await open(desk, "/integrations", { wait: 2500 });
    const runners = page.getByRole("heading", { name: "Local runners" });
    let height = 1400;
    if (await runners.count()) {
      const sec = runners.locator("xpath=ancestor::section[1]");
      const b = (await sec.count()) ? await sec.boundingBox() : await runners.boundingBox();
      height = Math.round(b.y + b.height + 32);
    }
    if (want("integrations-full-1440")) await shootMain(page, "integrations-full-1440", { height });
    // Tighter crop for the marketing site: the two provider cards and the runners list. The provider
    // connections list and the create-runner form between them are hidden for this capture only, so
    // the crop stays under 850 CSS px (1700 px at 2x).
    await page.addStyleTag({ content: 'section[aria-labelledby="providers-h"], section[aria-labelledby="runners-h"] > form { display: none !important; }' });
    await page.waitForTimeout(400);
    const providers = await page.locator('section[aria-labelledby="ai-providers-h"]').boundingBox();
    const cardTop = (await page.locator('section[aria-labelledby="ai-providers-h"] article').first().boundingBox()).y;
    const rsec = await page.locator('section[aria-labelledby="runners-h"]').boundingBox();
    const bottom = rsec.y + rsec.height + 32;
    let top = providers.y - 24;
    // Too tall with the heading: start just above the cards (the gap to the intro text is ~20px).
    if (bottom - top > 850) top = cardTop - 10;
    await shootMain(page, "integrations-cards-1440", { top: Math.round(top), height: Math.round(Math.min(850, bottom - top)) });
    await page.close();
  }
  if (want("settings-1440")) {
    const page = await open(desk, "/settings", { wait: 1500 });
    await shootMain(page, "settings-1440", { height: 960 });
    await page.close();
  }
  if (want("onboarding-1440")) {
    // A fresh owner without a company, walked to the provider step through the real form.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2, colorScheme: THEME });
    await themed(ctx);
    await ctx.request.post(`${B}/api/auth/sign-up/email`, { data: { name: "New Owner", email: `shots+onboard${Date.now()}@agentopia.test`, password: PASSWORD }, headers: { origin: B } });
    const page = await ctx.newPage();
    await page.goto(`${B}/onboarding`, { waitUntil: "networkidle" });
    await page.getByLabel("Company name").fill("Lantern Labs");
    await page.getByRole("button", { name: "Create company" }).click();
    await page.getByRole("heading", { level: 1 }).filter({ hasNotText: "Name your company" }).first().waitFor({ timeout: 20_000 }).catch(() => {});
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: HIDE_CSS });
    await page.waitForTimeout(1200);
    await shootViewport(page, "onboarding-1440");
    await ctx.close();
  }
  await desk.close();

  const phone = await mk(390, 844);
  if (want("office-390")) {
    const page = await open(phone, "/office", { wait: 1500 });
    await shootViewport(page, "office-390");
    await page.close();
  }
  if (want("tasks-390")) {
    const page = await open(phone, "/tasks", { wait: 1200 });
    await shootViewport(page, "tasks-390");
    await page.close();
  }
  if (want("employee-detail-390")) {
    const page = await open(phone, `/employees/${mina}`, { wait: 1500 });
    await shootViewport(page, "employee-detail-390");
    await page.close();
  }
  await phone.close();
  // Cleanup: `[simulate:block]` tasks re-request approval on every attempt and hold worker slots
  // while they wait, which stalls other companies on a shared dev worker. Deny until they fail out.
  if (!process.env.KEEP_PENDING) {
    const ctx = await browser.newContext({ storageState: STORAGE });
    for (let i = 0; i < 12; i++) {
      const r = await ctx.request.get(`${B}/api/companies/${st.cid}/approvals?status=PENDING`);
      const pending = r.ok() ? ((await r.json()).items ?? []) : [];
      if (!pending.length && i > 2) break;
      for (const a of pending) await ctx.request.post(`${B}/api/companies/${st.cid}/approvals/${a.id}`, { data: { decision: "DENIED" } });
      await sleep(5000);
    }
    await ctx.close();
  }
  await browser.close();
  if (errors.length) console.log("page errors:\n" + errors.join("\n"));
}

const dims = await optimise(sharp);
writeManifest(dims);
for (const [n, d] of Object.entries(dims).sort()) console.log(n.padEnd(34), `${d.width}x${d.height}`, d.src);
