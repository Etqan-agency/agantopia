/**
 * Task postmortems: after a real task finishes, draft a TASK_LESSON knowledge
 * entry for the assignee (scoped to employee + project) for owner approval.
 * ZERO: structured deterministic summary. LOW: one bounded LLM call on top of it.
 */
import { prisma, type Db, type KnowledgeEntry } from "@agentopia/db";
import { emit, log } from "./deps";
import { learningProviderLimit, resolveEmployeeLlm } from "./llm";
import { redactSecrets } from "./sanitize";
import { synthesizeNote, type SynthFn } from "./synth";

export type PostmortemOptions = { mode: "ZERO" | "LOW"; synth?: SynthFn; db?: Db };

const clip = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** Build the deterministic, factual postmortem text from task records only. */
export function buildDeterministicPostmortem(input: {
  title: string;
  description: string;
  status: string;
  attempt: number;
  resultSummary: string | null;
  errorMessage: string | null;
  artifacts: Array<{ name: string; kind: string }>;
  reviews: Array<{ decision: string; note?: string | null }>;
  executionErrors: string[];
}): string {
  const lines = [
    `What was asked: ${clip(input.description, 600) || "(no description)"}`,
    `Outcome: ${input.status} after ${Math.max(1, input.attempt)} attempt(s).`,
    `What was delivered: ${clip(input.resultSummary, 600) || "(no result summary recorded)"}`,
    input.artifacts.length
      ? `Artifacts: ${input.artifacts.slice(0, 10).map((a) => `${a.name} (${a.kind.toLowerCase()})`).join(", ")}${input.artifacts.length > 10 ? `, +${input.artifacts.length - 10} more` : ""}`
      : "Artifacts: none recorded.",
    input.reviews.length
      ? `Review: ${input.reviews.map((r) => `${r.decision.toLowerCase()}${r.note ? `: ${clip(r.note, 200)}` : ""}`).join("; ")}`
      : "Review: no review recorded.",
  ];
  const errors = [input.errorMessage, ...input.executionErrors].filter((e): e is string => !!e).map((e) => clip(e, 200));
  lines.push(errors.length ? `Errors: ${[...new Set(errors)].slice(0, 5).join("; ")}` : "Errors: none recorded.");
  return redactSecrets(lines.join("\n"));
}

/**
 * Draft a TASK_LESSON for a finished (COMPLETED or FAILED), non-demo task with
 * an assignee. Idempotent per task+employee: returns the existing lesson if
 * one was already drafted. Returns null when the task is not eligible.
 */
export async function generateTaskPostmortem(taskId: string, opts: PostmortemOptions): Promise<KnowledgeEntry | null> {
  const db = opts.db ?? prisma;
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      artifacts: { select: { name: true, kind: true }, orderBy: { createdAt: "asc" } },
      executions: { select: { error: true, status: true }, orderBy: { createdAt: "asc" } },
      events: { where: { type: "task.review_decided" }, select: { payload: true }, orderBy: { seq: "asc" } },
      assignee: { include: { providerConnection: true } },
    },
  });
  if (!task || task.isDemo || !task.assignee) return null;
  if (task.status !== "COMPLETED" && task.status !== "FAILED") return null;
  const employee = task.assignee;

  const existing = await db.knowledgeEntry.findFirst({ where: { taskId, employeeId: employee.id, kind: "TASK_LESSON" } });
  if (existing) return existing;

  const evidence = await db.employeeCareerEvidence.findMany({
    where: { taskId, kind: { in: ["REVIEW_APPROVED", "REVIEW_REJECTED"] } },
    orderBy: { createdAt: "asc" },
    select: { kind: true, summary: true },
  });
  const reviews = [
    ...task.events.map((e) => {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      return { decision: String(p.decision ?? p.verdict ?? p.status ?? "decided"), note: typeof p.note === "string" ? p.note : typeof p.message === "string" ? p.message : null };
    }),
    ...(task.events.length === 0 ? evidence.map((e) => ({ decision: e.kind === "REVIEW_APPROVED" ? "approved" : "rejected", note: e.summary })) : []),
  ];

  const facts = buildDeterministicPostmortem({
    title: task.title,
    description: task.description,
    status: task.status,
    attempt: task.attempt,
    resultSummary: task.resultSummary,
    errorMessage: task.errorMessage,
    artifacts: task.artifacts,
    reviews,
    executionErrors: task.executions.map((e) => e.error).filter((e): e is string => !!e),
  });

  let title = `Lesson: ${clip(task.title, 180)}`;
  let content = facts;
  let confidence = 0.6;
  let provenance: "TASK_POSTMORTEM" | "TASK_POSTMORTEM_DETERMINISTIC" = "TASK_POSTMORTEM_DETERMINISTIC";

  if (opts.mode === "LOW") {
    // Never call a limited provider; no paid fallback (deterministic lesson instead).
    const limited = await learningProviderLimit(employee);
    let llm = limited ? null : await resolveEmployeeLlm(employee);
    if (!llm && !limited && opts.synth) llm = { provider: "ANTHROPIC", secret: "", model: null };
    if (llm) {
      try {
        const synth = opts.synth ?? synthesizeNote;
        const res = await synth({
          text: `Task: ${task.title}\n${facts}`,
          sourceUrl: `task:${task.id}`,
          title: task.title,
          employeeTopics: [employee.specialty.toLowerCase(), ...employee.specializationTopics],
          provider: llm.provider,
          secret: llm.secret,
          model: llm.model,
          maxOutputTokens: 400,
          signal: AbortSignal.timeout(60_000),
        });
        await db.usageRecord.create({
          data: {
            companyId: task.companyId,
            employeeId: employee.id,
            taskId: task.id,
            provider: res.provider.toLowerCase(),
            model: res.model,
            source: "PROVIDER_REPORTED",
            inputTokens: res.tokens.input,
            outputTokens: res.tokens.output,
            costUsd: res.costUsd,
          },
        });
        title = `Lesson: ${clip(res.title, 180)}`;
        content = `Lessons: ${redactSecrets(res.claim)}\n\n${facts}`;
        confidence = Math.max(0, Math.min(1, res.confidence));
        provenance = "TASK_POSTMORTEM";
      } catch (err) {
        log.warn({ err: String(err), taskId }, "postmortem synthesis failed; using deterministic summary");
      }
    }
  }

  const now = new Date();
  const entry = await db.knowledgeEntry.create({
    data: {
      companyId: task.companyId,
      employeeId: employee.id,
      projectId: task.projectId,
      taskId: task.id,
      kind: "TASK_LESSON",
      provenance,
      status: "DRAFT",
      title,
      content,
      retrievedAt: now,
      confidence,
      tags: [...new Set(["task-lesson", employee.specialty.toLowerCase(), task.status.toLowerCase(), ...(task.requiredSpecialty ? [task.requiredSpecialty.toLowerCase()] : [])])],
      // Lessons describe history; they do not expire (owner can delete them).
    },
  });
  await emit(
    {
      companyId: task.companyId,
      employeeId: employee.id,
      taskId: task.id,
      type: "knowledge.drafted",
      payload: { entryId: entry.id, title: entry.title, status: entry.status, provenance, kind: "TASK_LESSON" },
    },
    db,
  );
  return entry;
}
