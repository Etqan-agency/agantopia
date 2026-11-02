// Automated accessibility sweep with axe-core (WCAG 2.0/2.1/2.2 A + AA rules; best-practice off).
//
//   node apps/web/scripts/a11y-sweep.mjs
//
// Env: BASE (default http://localhost:3100), OUT_NAME (default axe-results; writes <OUT_NAME>.json
// and <OUT_NAME>.md under artifacts/agentopia-frontend-refactor/qa/), ONLY (substring filter on
// the route path, for quick re-checks).
// Needs the dev server and the worker (the seeded task runs on the simulated provider).
// Signs up a throwaway `a11y+<ts>@agentopia.test` account; light theme throughout.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(here, "..");
const ROOT = resolve(WEB, "../..");
const require = createRequire(join(WEB, "package.json"));
const { chromium } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");
const axeVersion = createRequire(require.resolve("@axe-core/playwright"))("axe-core/package.json").version;

const B = process.env.BASE ?? "http://localhost:3100";
const OUT_DIR = join(ROOT, "artifacts/agentopia-frontend-refactor/qa");
const OUT_NAME = process.env.OUT_NAME ?? "axe-results";
const ONLY = process.env.ONLY ?? "";
const PASSWORD = "Passw0rd!Passw0rd";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
];
mkdirSync(OUT_DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** MARKETING_ROUTES paths, read from the typed source so this list never drifts. */
function marketingPaths() {
  const src = readFileSync(join(WEB, "src/content/marketing/routes.ts"), "utf8");
  const block = src.slice(src.indexOf("MARKETING_ROUTES"), src.indexOf("DISALLOWED_PREFIXES"));
  return [...block.matchAll(/path:\s*"([^"]+)"/g)].map((m) => m[1]);
}

async function seed(browser) {
  const email = `a11y+${Date.now()}@agentopia.test`;
  const ctx = await browser.newContext({ colorScheme: "light" });
  const req = ctx.request;
  const j = async (r) => (r.ok() ? r.json() : Promise.reject(new Error(`${r.url()} ${r.status()} ${await r.text()}`)));
  await j(await req.post(`${B}/api/auth/sign-up/email`, { data: { name: "Access Owner", email, password: PASSWORD }, headers: { origin: B } }));
  const co = await j(await req.post(`${B}/api/companies`, { data: { name: "Access Studio", timezone: "Africa/Cairo", floorName: "Floor 1" } }));
  const cid = co.company?.id ?? co.id;
  const emps = [];
  for (const [n, s] of [["Mina Fares", "FRONTEND"], ["Omar Adel", "BACKEND"], ["Youssef Kamal", "QA"]]) {
    const b = await j(await req.post(`${B}/api/companies/${cid}/employees`, { data: { name: n, specialty: s, rank: "MID_LEVEL" } }));
    emps.push((b.employee ?? b).id);
  }
  const t = await j(await req.post(`${B}/api/companies/${cid}/tasks`, { data: { title: "Build the pricing page", description: "Pricing page with three tiers and an FAQ." } }));
  const tid = (t.task ?? t).id;
  let status = "";
  for (let i = 0; i < 90; i++) {
    const b = await j(await req.get(`${B}/api/companies/${cid}/tasks/${tid}`));
    status = (b.task ?? b).status;
    if (status === "COMPLETED" || status === "FAILED") break;
    await sleep(1000);
  }
  console.log("seeded", email, cid, "task", status);
  const storage = await ctx.storageState();
  await ctx.close();
  return { cid, emps, tid, storage };
}

function slim(results) {
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    helpUrl: v.helpUrl,
    tags: v.tags.filter((t) => t.startsWith("wcag")),
    nodes: v.nodes.map((n) => ({ target: n.target.join(" "), html: n.html.slice(0, 300), summary: n.failureSummary?.slice(0, 400) })),
  }));
}

async function runOne(browser, { path, viewport, variant, storage }) {
  const ctx = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: "light",
    reducedMotion: variant === "reduced-motion" ? "reduce" : "no-preference",
    ...(storage ? { storageState: storage } : {}),
    ...(viewport.width < 900 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("agentopia.theme", "light");
    } catch {}
  });
  const page = await ctx.newPage();
  let error = null;
  let violations = [];
  try {
    const res = await page.goto(B + path, { waitUntil: "networkidle", timeout: 60_000 });
    await page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 20_000 }).catch(() => {});
    // The Next.js dev overlay is not product UI.
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.waitForTimeout(1200);
    if (variant === "mobile-nav-open") {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(500);
    }
    const r = await new AxeBuilder({ page }).withTags(TAGS).exclude("nextjs-portal").analyze();
    violations = slim(r);
    if (res && res.status() >= 400) error = `HTTP ${res.status()}`;
  } catch (e) {
    error = String(e.message ?? e).slice(0, 300);
  }
  await ctx.close();
  return { path, viewport: viewport.name, variant, error, violations };
}

function counts(violations) {
  const c = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of violations) c[v.impact ?? "minor"] += v.nodes.length;
  return c;
}

async function main() {
  const browser = await chromium.launch();
  const marketing = marketingPaths().filter((p) => p.includes(ONLY));
  const needsAuth = ["/onboarding", "/office", "/office?view=list", "/employees", "/tasks", "/organization", "/learning", "/integrations", "/settings"];
  const anonExtra = ["/demo", "/login", "/signup"].filter((p) => !marketing.includes(p));
  const seeded = await seed(browser);
  const appPaths = [...needsAuth, `/employees/${seeded.emps[0]}`, `/tasks/${seeded.tid}`].filter((p) => p.includes(ONLY));

  const jobs = [];
  for (const viewport of VIEWPORTS) {
    for (const path of [...marketing, ...anonExtra.filter((p) => p.includes(ONLY))]) jobs.push({ path, viewport, variant: "default" });
    for (const path of appPaths) jobs.push({ path, viewport, variant: "default", storage: seeded.storage });
    for (const path of marketing) jobs.push({ path, viewport, variant: "reduced-motion" });
  }
  // /demo has its own header without the marketing menu.
  for (const path of marketing.filter((p) => p !== "/demo")) jobs.push({ path, viewport: VIEWPORTS[1], variant: "mobile-nav-open" });

  const runs = [];
  for (const job of jobs) {
    const r = await runOne(browser, job);
    const c = counts(r.violations);
    console.log(`${r.path.padEnd(34)} ${r.viewport.padEnd(5)} ${r.variant.padEnd(16)} crit ${c.critical} ser ${c.serious} mod ${c.moderate} min ${c.minor}${r.error ? `  ERROR ${r.error}` : ""}`);
    runs.push(r);
  }
  await browser.close();

  // Rule ids that appeared, with page count, for the report.
  const byRule = {};
  for (const r of runs)
    for (const v of r.violations) {
      byRule[v.id] ??= { impact: v.impact, help: v.help, runs: 0, nodes: 0 };
      byRule[v.id].runs += 1;
      byRule[v.id].nodes += v.nodes.length;
    }
  const total = runs.reduce((acc, r) => {
    const c = counts(r.violations);
    for (const k of Object.keys(c)) acc[k] += c[k];
    return acc;
  }, { critical: 0, serious: 0, moderate: 0, minor: 0 });

  const meta = { generatedAt: new Date().toISOString(), base: B, axeCore: axeVersion, tags: TAGS, theme: "light", runs: runs.length, totals: total, byRule };
  writeFileSync(join(OUT_DIR, `${OUT_NAME}.json`), JSON.stringify({ meta, runs }, null, 2));

  const lines = [
    `# axe-core sweep (${meta.generatedAt})`,
    "",
    `axe-core ${axeVersion}, tags ${TAGS.join(", ")}, light theme, base ${B}. Counts are affected nodes.`,
    "",
    `Totals: critical ${total.critical}, serious ${total.serious}, moderate ${total.moderate}, minor ${total.minor} across ${runs.length} runs.`,
    "",
    "| route | viewport | variant | critical | serious | moderate | minor | rules |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | --- |",
    ...runs.map((r) => {
      const c = counts(r.violations);
      return `| ${r.path} | ${r.viewport} | ${r.variant} | ${c.critical} | ${c.serious} | ${c.moderate} | ${c.minor} | ${r.error ? `ERROR: ${r.error}` : r.violations.map((v) => v.id).join(", ")} |`;
    }),
    "",
    "## Rules seen",
    "",
    "| rule | impact | runs | nodes | help |",
    "| --- | --- | ---: | ---: | --- |",
    ...Object.entries(byRule).map(([id, v]) => `| ${id} | ${v.impact} | ${v.runs} | ${v.nodes} | ${v.help} |`),
    "",
  ];
  writeFileSync(join(OUT_DIR, `${OUT_NAME}.md`), lines.join("\n"));
  console.log("totals", total);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
