/**
 * Idempotent seed: global skill templates + the visitor demo building.
 *
 * Run with `pnpm db:seed`. Every row uses a fixed id (or a natural unique key)
 * and is upserted, so re-running converges to the same state. All demo tasks
 * are `isDemo: true` and every demo TaskEvent payload carries `simulated: true`.
 * No AI model is called and no usage is fabricated (usage rows are zeros).
 */
import path from "node:path";
import { randomBytes, scryptSync, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../../../.env") });

const { prisma } = await import("../src/index.js");
const shared = await import("../../shared/src/index.js");
const {
  SKILL_TEMPLATES, ROLE_TEMPLATES, DEFAULT_ROOMS, DEFAULT_LAYOUT, SPECIALTY_ROOM, CompanySettingsSchema, ProviderSettingsSchema, compilePrompt,
} = shared;
type Specialty = (typeof shared.SPECIALTIES)[number];
type Rank = (typeof shared.RANKS)[number];

const J = (v: unknown) => v as never; // JSON input cast for Prisma Json columns
const DEMO_USER = "demo_user";
const BUILDING = "demo_building";
const now = new Date();
const daysAgo = (d: number, h = 0) => new Date(now.getTime() - d * 86_400_000 - h * 3_600_000);

// --- better-auth compatible scrypt hash ("salt:hash", N=16384 r=16 p=1 dkLen=64) -------
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password.normalize("NFKC"), salt, 64, { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 });
  return `${salt}:${key.toString("hex")}`;
}

async function seedSkills() {
  for (const s of SKILL_TEMPLATES) {
    const existing = await prisma.skill.findFirst({ where: { companyId: null, slug: s.slug }, select: { id: true } });
    const data = { name: s.name, description: s.description, instructions: s.instructions, applicableRoles: s.applicableRoles, provenance: "template", enabled: true };
    if (existing) await prisma.skill.update({ where: { id: existing.id }, data });
    else await prisma.skill.create({ data: { id: `skill_tpl_${s.slug}`, companyId: null, slug: s.slug, ...data } });
  }
  const rows = await prisma.skill.findMany({ where: { companyId: null }, select: { id: true, slug: true } });
  return new Map(rows.map((r) => [r.slug, r.id]));
}

async function seedDemoUser() {
  await prisma.user.upsert({
    where: { email: "visitor@agentopia.demo" },
    update: {},
    create: { id: DEMO_USER, email: "visitor@agentopia.demo", name: "Demo Visitor", emailVerified: false },
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "visitor@agentopia.demo" } });
  // Random, never-printed password: this account exists only to own demo rows.
  const exists = await prisma.account.findFirst({ where: { userId: user.id, providerId: "credential" }, select: { id: true } });
  if (!exists) {
    await prisma.account.create({
      data: { id: "demo_user_account", userId: user.id, accountId: user.id, providerId: "credential", password: hashPassword(randomBytes(32).toString("base64url")) },
    });
  }
  return user.id;
}

type EmpSpec = { id: string; name: string; specialty: Specialty; rank: Rank; manager?: boolean; visual?: string; avatar: { palette: string; hair: number; skin: number } };
type FloorSpec = { floorId: string; companyId: string; name: string; order: number; companyName: string; employees: EmpSpec[] };

const FLOORS: FloorSpec[] = [
  {
    floorId: "demo_floor_1", companyId: "demo_co_northwind", name: "Northwind Labs", order: 1, companyName: "Northwind Labs",
    employees: [
      { id: "demo_nw_manager", name: "Morgan Hale", specialty: "MANAGEMENT", rank: "SENIOR", manager: true, avatar: { palette: "sky", hair: 2, skin: 1 } },
      { id: "demo_nw_fe1", name: "Lina Farouk", specialty: "FRONTEND", rank: "JUNIOR", avatar: { palette: "teal", hair: 4, skin: 2 } },
      { id: "demo_nw_fe2", name: "Theo Park", specialty: "FRONTEND", rank: "TRAINEE", avatar: { palette: "saffron", hair: 1, skin: 0 } },
      { id: "demo_nw_be", name: "Omar Nasser", specialty: "BACKEND", rank: "SENIOR", avatar: { palette: "slate", hair: 0, skin: 2 } },
      { id: "demo_nw_ux", name: "Sofia Reyes", specialty: "UIUX", rank: "EXPERT", visual: "WORKING", avatar: { palette: "rose", hair: 5, skin: 1 } },
      { id: "demo_nw_qa", name: "Kenji Watanabe", specialty: "QA", rank: "JUNIOR", visual: "REVIEWING", avatar: { palette: "moss", hair: 3, skin: 0 } },
      { id: "demo_nw_research", name: "Amara Okafor", specialty: "RESEARCH", rank: "JUNIOR", visual: "BLOCKED", avatar: { palette: "plum", hair: 2, skin: 3 } },
    ],
  },
  {
    floorId: "demo_floor_2", companyId: "demo_co_pixel", name: "Pixel & Co.", order: 2, companyName: "Pixel & Co.",
    employees: [
      { id: "demo_px_manager", name: "Riley Chen", specialty: "MANAGEMENT", rank: "SENIOR", manager: true, avatar: { palette: "brick", hair: 1, skin: 1 } },
      { id: "demo_px_fe", name: "Noor Haddad", specialty: "FRONTEND", rank: "MID_LEVEL", avatar: { palette: "teal", hair: 5, skin: 2 } },
      { id: "demo_px_ux", name: "Ivy Laurent", specialty: "UIUX", rank: "JUNIOR", visual: "WORKING", avatar: { palette: "saffron", hair: 4, skin: 0 } },
      { id: "demo_px_qa", name: "Mateo Silva", specialty: "QA", rank: "TRAINEE", avatar: { palette: "sky", hair: 0, skin: 3 } },
    ],
  },
];

async function seedFloor(spec: FloorSpec, ownerId: string, skillIds: Map<string, string>) {
  const { companyId, floorId } = spec;
  const settings = CompanySettingsSchema.parse({});
  await prisma.company.upsert({
    where: { id: companyId },
    update: { name: spec.companyName, isDemo: true, archivedAt: null },
    create: { id: companyId, ownerId, name: spec.companyName, timezone: "Africa/Cairo", isDemo: true, settings: J(settings) },
  });
  await prisma.companyMembership.upsert({ where: { companyId_userId: { companyId, userId: ownerId } }, update: { role: "OWNER" }, create: { companyId, userId: ownerId, role: "OWNER" } });
  await prisma.floor.upsert({
    where: { id: floorId },
    update: { name: spec.name, order: spec.order, companyId, archivedAt: null },
    create: { id: floorId, buildingId: BUILDING, companyId, name: spec.name, order: spec.order, layout: J(DEFAULT_LAYOUT) },
  });

  // Rooms and desks.
  const desksByKind = new Map<string, string[]>();
  for (const [i, r] of DEFAULT_ROOMS.entries()) {
    const roomId = `${floorId}_r${i}`;
    await prisma.room.upsert({
      where: { id: roomId },
      update: { name: r.name, kind: r.kind, x: r.x, y: r.y, w: r.w, h: r.h, order: i },
      create: { id: roomId, floorId, companyId, name: r.name, kind: r.kind, x: r.x, y: r.y, w: r.w, h: r.h, order: i },
    });
    const ids: string[] = [];
    for (const [j, d] of r.deskSlots.entries()) {
      const deskId = `${roomId}_d${j}`;
      await prisma.desk.upsert({ where: { id: deskId }, update: { x: d.x, y: d.y, facing: d.facing }, create: { id: deskId, roomId, x: d.x, y: d.y, facing: d.facing } });
      ids.push(deskId);
    }
    desksByKind.set(r.kind, ids);
  }

  // Simulated provider (clearly labelled).
  const providerId = `${companyId}_sim`;
  await prisma.providerConnection.upsert({
    where: { id: providerId },
    update: { label: "Simulated (demo)", status: "VERIFIED" },
    create: {
      id: providerId, companyId, provider: "SIMULATED", mode: "SIMULATED", label: "Simulated (demo)", status: "VERIFIED", lastVerifiedAt: now,
      defaultModel: "simulated", settings: J({ ...ProviderSettingsSchema.parse({}), _hasSecret: false, _availableModels: ["simulated"] }),
    },
  });

  // Free all desks of this floor first so re-runs can reassign deterministically.
  await prisma.desk.updateMany({ where: { room: { floorId } }, data: { employeeId: null } });

  const managerId = spec.employees.find((e) => e.manager)!.id;
  const used = new Map<string, number>();
  for (const e of spec.employees) {
    const tpl = ROLE_TEMPLATES[e.specialty];
    const fields = tpl.prompt;
    const base = {
      name: e.name, avatar: J(e.avatar), title: tpl.title, department: tpl.department, specialty: e.specialty, role: e.manager ? ("MANAGER" as const) : ("EMPLOYEE" as const),
      reportsToId: e.manager ? null : managerId, providerConnectionId: providerId, model: "simulated", rank: e.rank, status: "ACTIVE" as const,
      visualState: (e.visual ?? "IDLE") as never, specializationTopics: tpl.topics, currentPromptVersion: 1,
    };
    await prisma.employee.upsert({ where: { id: e.id }, update: base, create: { id: e.id, companyId, ...base, reportsToId: null } });
    await prisma.promptVersion.upsert({
      where: { employeeId_version: { employeeId: e.id, version: 1 } },
      update: { fields: J(fields), compiled: compilePrompt(fields) },
      create: { employeeId: e.id, version: 1, fields: J(fields), compiled: compilePrompt(fields), note: "Initial version (role template)" },
    });
    for (const slug of tpl.skills) {
      const skillId = skillIds.get(slug);
      if (!skillId) continue;
      await prisma.employeeSkill.upsert({
        where: { employeeId_skillId: { employeeId: e.id, skillId } },
        update: {},
        create: { employeeId: e.id, skillId, proficiency: e.rank === "EXPERT" ? "EXPERT" : "PROFICIENT" },
      });
    }
    await prisma.employeeCareerEvidence.upsert({
      where: { id: `${e.id}_ev_init` },
      update: { toRank: e.rank },
      create: {
        id: `${e.id}_ev_init`, employeeId: e.id, kind: "INITIALIZED_AS", toRank: e.rank, createdAt: daysAgo(30),
        summary: `Initialized as ${e.rank} by the owner. Assigned rank, not demonstrated experience (demo data).`,
      },
    });
    // Desk in the specialty's room.
    const kind = SPECIALTY_ROOM[e.specialty];
    const list = desksByKind.get(kind) ?? [];
    const idx = used.get(kind) ?? 0;
    const deskId = list[idx];
    if (deskId) {
      used.set(kind, idx + 1);
      await prisma.desk.update({ where: { id: deskId }, data: { employeeId: e.id } });
    }
    // Default learning sources (template allowlist).
    for (const s of tpl.sources) {
      await prisma.learningSource.upsert({
        where: { companyId_employeeId_url: { companyId, employeeId: e.id, url: s.url } },
        update: { title: s.title, kind: s.kind },
        create: { companyId, employeeId: e.id, kind: s.kind, url: s.url, title: s.title, specialty: e.specialty, topics: tpl.topics },
      });
    }
  }
  // Fix reportsTo now that the manager exists.
  await prisma.employee.updateMany({ where: { companyId, role: "EMPLOYEE" }, data: { reportsToId: managerId } });

  // Learning schedule: Mon/Thu 09:00 Africa/Cairo, 10 min, LOW. Paused: demo companies never run real learning.
  await prisma.learningSchedule.upsert({
    where: { id: `${companyId}_sched` },
    update: { days: ["monday", "thursday"], time: "09:00", timezone: "Africa/Cairo", maxDurationMinutes: 10, tokenStrategy: "LOW" },
    create: {
      id: `${companyId}_sched`, companyId, employeeId: null, enabled: true, days: ["monday", "thursday"], time: "09:00", timezone: "Africa/Cairo",
      maxDurationMinutes: 10, tokenStrategy: "LOW", pausedAt: now, pauseReason: "Demo company: schedule is shown for illustration and never runs",
    },
  });
  return { providerId, managerId };
}

type EvSpec = { type: string; employeeId: string | null; payload?: Record<string, unknown>; at: Date };

async function seedEvents(companyId: string, taskId: string, events: EvSpec[]) {
  for (const [i, e] of events.entries()) {
    await prisma.taskEvent.upsert({
      where: { id: `${taskId}_ev${i}` },
      update: { payload: J({ ...(e.payload ?? {}), simulated: true }) },
      create: { id: `${taskId}_ev${i}`, companyId, taskId, employeeId: e.employeeId, type: e.type, payload: J({ ...(e.payload ?? {}), simulated: true }), createdAt: e.at },
    });
  }
}

type TaskSpec = {
  id: string; companyId: string; title: string; description: string; status: "COMPLETED" | "IN_PROGRESS" | "REVIEW" | "BLOCKED";
  assigneeId: string; managerId: string; reviewerId?: string; specialty: Specialty; createdAt: Date; errorMessage?: string; resultSummary?: string;
  artifacts?: Array<{ name: string; kind: "TEXT" | "DIFF"; mimeType: string; content: string }>;
};

async function seedTask(t: TaskSpec) {
  const completed = t.status === "COMPLETED";
  const at = (min: number) => new Date(t.createdAt.getTime() + min * 60_000);
  await prisma.task.upsert({
    where: { id: t.id },
    update: { status: t.status, isDemo: true },
    create: {
      id: t.id, companyId: t.companyId, title: t.title, description: t.description, status: t.status, priority: "NORMAL", requiredSpecialty: t.specialty,
      assigneeId: t.assigneeId, createdByEmployeeId: null, isDemo: true, attempt: 1, createdAt: t.createdAt, startedAt: at(3),
      completedAt: completed ? at(40) : null, errorMessage: t.errorMessage ?? null, resultSummary: t.resultSummary ?? null,
      plan: J({ simulated: true, summary: "Demo plan (simulated)", subtasks: [{ title: t.title, specialty: t.specialty }] }),
    },
  });
  await prisma.assignment.upsert({
    where: { id: `${t.id}_asg` },
    update: {},
    create: {
      id: `${t.id}_asg`, taskId: t.id, employeeId: t.assigneeId, assignedById: t.managerId, createdAt: at(2), status: completed ? "HANDED_OFF" : "ACTIVE",
      endedAt: completed ? at(30) : null, reason: `Best ${t.specialty.toLowerCase()} match by specialty and availability (demo).`,
      handoff: J({ inputs: [t.description], deliverables: ["Summary", "Artifacts"], constraints: ["Simulated demo"], artifacts: [], reviewStatus: completed ? "APPROVED" : "PENDING" }),
    },
  });
  const ev: EvSpec[] = [
    { type: "task.created", employeeId: t.managerId, payload: { title: t.title, status: "BACKLOG" }, at: at(0) },
    { type: "task.planned", employeeId: t.managerId, payload: { status: "PLANNING" }, at: at(1) },
    { type: "task.assigned", employeeId: t.assigneeId, payload: { status: "ASSIGNED", assigneeId: t.assigneeId }, at: at(2) },
    { type: "task.started", employeeId: t.assigneeId, payload: { status: "IN_PROGRESS", from: "ASSIGNED", attempt: 1 }, at: at(3) },
    { type: "execution.tool_use", employeeId: t.assigneeId, payload: { tool: "Read", input: "project files" }, at: at(6) },
  ];
  if (t.status === "COMPLETED") {
    ev.push(
      { type: "execution.tool_use", employeeId: t.assigneeId, payload: { tool: "Write", input: t.artifacts?.[0]?.name ?? "deliverable" }, at: at(15) },
      { type: "task.handoff", employeeId: t.assigneeId, payload: { fromEmployeeId: t.assigneeId, toEmployeeId: t.reviewerId, artifactIds: (t.artifacts ?? []).map((_, i) => `${t.id}_art${i}`), summary: "Ready for review." }, at: at(30) },
      { type: "task.review_started", employeeId: t.reviewerId ?? null, payload: { status: "REVIEW", reviewerId: t.reviewerId }, at: at(31) },
      { type: "task.review_decided", employeeId: t.reviewerId ?? null, payload: { decision: "APPROVED", reviewerId: t.reviewerId }, at: at(38) },
      { type: "task.completed", employeeId: t.assigneeId, payload: { status: "COMPLETED", from: "REVIEW" }, at: at(40) },
      { type: "employee.state", employeeId: t.assigneeId, payload: { state: "IDLE", taskId: null }, at: at(41) },
    );
  } else if (t.status === "REVIEW") {
    ev.push(
      { type: "task.handoff", employeeId: t.assigneeId, payload: { fromEmployeeId: t.assigneeId, toEmployeeId: t.reviewerId, artifactIds: [], summary: "Implementation ready for QA." }, at: at(25) },
      { type: "task.review_started", employeeId: t.reviewerId ?? null, payload: { status: "REVIEW", reviewerId: t.reviewerId }, at: at(26) },
    );
  } else if (t.status === "BLOCKED") {
    ev.push({ type: "task.blocked", employeeId: t.assigneeId, payload: { status: "BLOCKED", message: t.errorMessage }, at: at(8) });
  } else {
    ev.push({ type: "task.progress", employeeId: t.assigneeId, payload: { message: "Working through the checklist (simulated)." }, at: at(9) });
  }
  await seedEvents(t.companyId, t.id, ev);

  if (completed) {
    const sid = `${t.id}_exec1`;
    await prisma.executionSession.upsert({
      where: { id: sid },
      update: {},
      create: {
        id: sid, companyId: t.companyId, taskId: t.id, employeeId: t.assigneeId, attempt: 1, provider: "simulated", mode: "SIMULATED", model: "simulated",
        status: "SUCCEEDED", usage: J({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }), costUsd: 0, costSource: "unavailable",
        startedAt: at(3), endedAt: at(29), createdAt: at(3),
      },
    });
    for (const [i, a] of (t.artifacts ?? []).entries()) {
      await prisma.artifact.upsert({
        where: { id: `${t.id}_art${i}` },
        update: { content: a.content },
        create: {
          id: `${t.id}_art${i}`, companyId: t.companyId, taskId: t.id, executionSessionId: sid, name: a.name, kind: a.kind, mimeType: a.mimeType, content: a.content,
          sizeBytes: Buffer.byteLength(a.content), sha256: createHash("sha256").update(a.content).digest("hex"), createdAt: at(29),
        },
      });
    }
    await prisma.usageRecord.upsert({
      where: { id: `${t.id}_usage1` },
      update: {},
      create: { id: `${t.id}_usage1`, companyId: t.companyId, employeeId: t.assigneeId, taskId: t.id, executionSessionId: sid, provider: "simulated", model: "simulated", source: "ESTIMATED", costUsd: 0, createdAt: at(29) },
    });
    // Evidence tied to this (simulated) demo task only.
    await prisma.employeeCareerEvidence.upsert({
      where: { id: `${t.id}_ev_done` },
      update: {},
      create: { id: `${t.id}_ev_done`, employeeId: t.assigneeId, kind: "TASK_COMPLETED", taskId: t.id, summary: `Completed "${t.title}" (simulated demo task).`, createdAt: at(40) },
    });
    if (t.reviewerId) {
      await prisma.employeeCareerEvidence.upsert({
        where: { id: `${t.id}_ev_review` },
        update: {},
        create: { id: `${t.id}_ev_review`, employeeId: t.assigneeId, kind: "REVIEW_APPROVED", taskId: t.id, score: 0.9, summary: `Review approved by QA (simulated demo task).`, createdAt: at(38) },
      });
    }
  }
}

async function seedLearning(companyId: string) {
  const runs = [
    { id: "demo_nw_lrun1", employeeId: "demo_nw_fe1", at: daysAgo(4, 2) },
    { id: "demo_nw_lrun2", employeeId: "demo_nw_research", at: daysAgo(1, 2) },
  ];
  for (const r of runs) {
    await prisma.learningRun.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id, companyId, employeeId: r.employeeId, scheduleId: `${companyId}_sched`, status: "COMPLETED", trigger: "scheduled", tokenStrategy: "ZERO",
        startedAt: r.at, endedAt: new Date(r.at.getTime() + 6 * 60_000), durationMs: 6 * 60_000, tokensUsed: 0, costUsd: 0, sourcesChecked: 3, sourcesChanged: 1,
        sourcesSkipped: 2, entriesDrafted: 1, createdAt: r.at,
        log: J([{ at: r.at.toISOString(), step: "simulated", detail: "Demo learning run (simulated; no network or model calls)" }]),
      },
    });
  }
  const entries = [
    {
      id: "demo_kn_react_effects", employeeId: "demo_nw_fe1", learningRunId: "demo_nw_lrun1", status: "VERIFIED" as const,
      title: "Reference: React useEffect", sourceUrl: "https://react.dev/reference/react/useEffect", retrievedAt: daysAgo(4, 2),
      content: "Reference note (deterministic): React's useEffect reference page. Sections: Reference, Usage, Troubleshooting. Retrieved for the frontend specialty.",
      tags: ["react", "hooks"], decision: "APPROVED" as const,
    },
    {
      id: "demo_kn_next_app_router", employeeId: "demo_nw_fe1", learningRunId: "demo_nw_lrun1", status: "VERIFIED" as const,
      title: "Reference: Next.js App Router docs", sourceUrl: "https://nextjs.org/docs/app", retrievedAt: daysAgo(4, 2),
      content: "Reference note (deterministic): Next.js App Router documentation index. Sections: Getting Started, Guides, API Reference.",
      tags: ["next.js"], decision: "APPROVED" as const,
    },
    {
      id: "demo_kn_mdn_draft", employeeId: "demo_nw_research", learningRunId: "demo_nw_lrun2", status: "DRAFT" as const,
      title: "Reference: MDN Web Docs index", sourceUrl: "https://developer.mozilla.org/en-US/docs/Web", retrievedAt: daysAgo(1, 2),
      content: "Reference note (deterministic): MDN Web Docs landing page for web technologies. Awaiting owner approval.",
      tags: ["research"], decision: null,
    },
    {
      id: "demo_kn_rejected", employeeId: "demo_nw_research", learningRunId: "demo_nw_lrun2", status: "REJECTED" as const,
      title: "Reference: github/docs repository", sourceUrl: "https://github.com/github/docs", retrievedAt: daysAgo(1, 2),
      content: "Reference note (deterministic): repository README headings. Rejected by the owner as not relevant to current work.",
      tags: ["github"], decision: "REJECTED" as const,
    },
  ];
  for (const k of entries) {
    await prisma.knowledgeEntry.upsert({
      where: { id: k.id },
      update: { status: k.status },
      create: {
        id: k.id, companyId, employeeId: k.employeeId, learningRunId: k.learningRunId, kind: "LEARNED_NOTE", provenance: "LEARNING_DETERMINISTIC", status: k.status,
        title: k.title, content: k.content, sourceUrl: k.sourceUrl, retrievedAt: k.retrievedAt, confidence: 0.6, tags: k.tags,
        verifiedAt: k.status === "VERIFIED" ? daysAgo(3) : null, verifiedById: k.decision ? DEMO_USER : null, createdAt: k.retrievedAt,
      },
    });
    if (k.decision) {
      await prisma.knowledgeApproval.upsert({
        where: { id: `${k.id}_approval` },
        update: {},
        create: { id: `${k.id}_approval`, knowledgeEntryId: k.id, decision: k.decision, decidedById: DEMO_USER, note: "Demo decision", createdAt: daysAgo(3) },
      });
    }
  }
  await prisma.knowledgeEntry.upsert({
    where: { id: "demo_kn_owner_style" },
    update: {},
    create: {
      id: "demo_kn_owner_style", companyId, kind: "OWNER_INSTRUCTION", provenance: "OWNER", status: "VERIFIED", title: "House style: accessible by default",
      content: "All UI work must be keyboard accessible and meet WCAG AA contrast. Prefer small, reviewed changes.", confidence: 1, tags: ["style"],
      retrievedAt: daysAgo(10), verifiedAt: daysAgo(10), verifiedById: DEMO_USER, createdAt: daysAgo(10),
    },
  });
}

async function main() {
  const skillIds = await seedSkills();
  if (process.env.SEED_DEMO === "false") {
    console.log("[seed] skills seeded; SEED_DEMO=false so the demo building was skipped");
    return;
  }
  const ownerId = await seedDemoUser();
  await prisma.building.upsert({
    where: { id: BUILDING },
    update: { name: "Agentopia Demo HQ", isDemo: true },
    create: { id: BUILDING, ownerId, name: "Agentopia Demo HQ", isDemo: true },
  });
  const nw = await seedFloor(FLOORS[0]!, ownerId, skillIds);
  const px = await seedFloor(FLOORS[1]!, ownerId, skillIds);

  await seedTask({
    id: "demo_nw_task_done", companyId: "demo_co_northwind", status: "COMPLETED", specialty: "FRONTEND", assigneeId: "demo_nw_fe1", reviewerId: "demo_nw_qa",
    managerId: nw.managerId, createdAt: daysAgo(2, 5), title: "Build the pricing page hero",
    description: "Create a responsive hero section for the pricing page with a heading, subcopy and two CTAs.",
    resultSummary: "Implemented PricingHero with responsive layout and accessible CTAs; QA approved. (Simulated demo result.)",
    artifacts: [
      { name: "summary.md", kind: "TEXT", mimeType: "text/markdown", content: "# Pricing hero\n\n- Added `PricingHero` component\n- Responsive at 360/768/1280\n- Buttons are real `<a>` links with visible focus\n\n_Simulated demo artifact._\n" },
      { name: "PricingHero.diff", kind: "DIFF", mimeType: "text/x-diff", content: "+export function PricingHero() {\n+  return <section aria-labelledby=\"pricing-title\">...</section>;\n+}\n" },
    ],
  });
  await seedTask({
    id: "demo_nw_task_progress", companyId: "demo_co_northwind", status: "IN_PROGRESS", specialty: "UIUX", assigneeId: "demo_nw_ux", managerId: nw.managerId,
    createdAt: daysAgo(0, 3), title: "Audit color tokens for contrast", description: "Check every text/background token pair against WCAG AA and propose fixes.",
  });
  await seedTask({
    id: "demo_nw_task_review", companyId: "demo_co_northwind", status: "REVIEW", specialty: "BACKEND", assigneeId: "demo_nw_be", reviewerId: "demo_nw_qa",
    managerId: nw.managerId, createdAt: daysAgo(0, 6), title: "Add rate limiting to the public API", description: "Token-bucket rate limiting per API key with a 429 response and Retry-After.",
  });
  await seedTask({
    id: "demo_nw_task_blocked", companyId: "demo_co_northwind", status: "BLOCKED", specialty: "RESEARCH", assigneeId: "demo_nw_research", managerId: nw.managerId,
    createdAt: daysAgo(1, 1), title: "Compare hosted auth providers", description: "Summarize pricing and features of three hosted auth providers with citations.",
    errorMessage: "Blocked: web access requires owner approval (simulated).",
  });
  await seedTask({
    id: "demo_px_task_done", companyId: "demo_co_pixel", status: "COMPLETED", specialty: "FRONTEND", assigneeId: "demo_px_fe", reviewerId: "demo_px_qa",
    managerId: px.managerId, createdAt: daysAgo(3, 4), title: "Portfolio grid component", description: "Build a responsive, keyboard-navigable portfolio grid.",
    resultSummary: "Grid implemented with roving focus. (Simulated demo result.)",
    artifacts: [{ name: "summary.md", kind: "TEXT", mimeType: "text/markdown", content: "# Portfolio grid\n\nCSS grid with roving tabindex.\n\n_Simulated demo artifact._\n" }],
  });
  await seedTask({
    id: "demo_px_task_progress", companyId: "demo_co_pixel", status: "IN_PROGRESS", specialty: "UIUX", assigneeId: "demo_px_ux", managerId: px.managerId,
    createdAt: daysAgo(0, 2), title: "Moodboard for the rebrand", description: "Collect typography and color directions for the client rebrand.",
  });

  await seedLearning("demo_co_northwind");
  const counts = await Promise.all([
    prisma.employee.count({ where: { company: { isDemo: true } } }),
    prisma.task.count({ where: { isDemo: true } }),
    prisma.taskEvent.count({ where: { company: { isDemo: true } } }),
  ]);
  console.log(`[seed] demo ready: ${counts[0]} employees, ${counts[1]} tasks, ${counts[2]} events, ${skillIds.size} template skills`);
}

try {
  await main();
} catch (err) {
  console.error("[seed] failed", err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
