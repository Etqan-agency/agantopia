/**
 * Executes one LearningRun end to end: change detection, fetch, extraction,
 * relevance, dedup, note drafting (deterministic or one bounded LLM call),
 * budgets, time cap, cancellation, and terminal bookkeeping.
 *
 * Safety: fetched content is untrusted data. It is never executed, never
 * followed as instructions, and credential-looking strings are redacted before
 * anything is stored.
 */
import { prisma, Prisma, type Db, type LearningRunStatus, type LearningSource } from "@agentopia/db";
import { ROLE_TEMPLATES } from "@agentopia/shared";
import { LearningBudget, ZeroTokenViolation } from "./budget";
import { resolveEffectiveSchedule } from "./config";
import { alreadySeen } from "./dedup";
import { emit, log } from "./deps";
import { fetchDocPage, type DocFetchResult } from "./fetchers/docs";
import { fetchRepoSnapshot, type RepoSnapshotResult } from "./fetchers/github";
import { isAllowedByRobots } from "./fetchers/robots";
import { LEARNING_USER_AGENT } from "./fetchers/types";
import { learningProviderLimit, resolveEmployeeLlm, type EmployeeLlm } from "./llm";
import { isRelevant, scoreRelevance } from "./relevance";
import { redactSecrets } from "./sanitize";
import { syncScheduleToQueue } from "./schedule";
import { isRelevantToEmployee, listCandidateSources, listSourcesForEmployee } from "./sources";
import { deterministicNote, estimateSynthTokens, synthesizeNote, type SynthFn } from "./synth";

export const KNOWLEDGE_TTL_DAYS = 180;
const MAX_LOG_STEPS = 500;

/** Injectable network layer (tests pass fakes; no network in tests). */
export type LearningFetchers = {
  robots: (url: string, signal: AbortSignal) => Promise<boolean>;
  docs: (url: string, opts: { etag?: string | null; signal: AbortSignal }) => Promise<DocFetchResult>;
  github: (url: string, opts: { lastCommitSha?: string | null; etag?: string | null; signal: AbortSignal }) => Promise<RepoSnapshotResult>;
};

export type RunLearningOptions = {
  /** External abort (e.g. worker shutdown) → CANCELLED. */
  signal?: AbortSignal;
  fetchers?: Partial<LearningFetchers>;
  /** Synthesizer override (tests). Defaults to synthesizeNote with the employee's provider. */
  synth?: SynthFn;
  /** Internal override of the time cap in milliseconds (tests). */
  maxDurationMs?: number;
  db?: Db;
};

export type RunLearningResult = {
  runId: string;
  status: LearningRunStatus;
  tokensUsed: number;
  costUsd: number;
  sourcesChecked: number;
  sourcesChanged: number;
  sourcesSkipped: number;
  entriesDrafted: number;
  error: string | null;
};

export type LearningLogStep = { at: string; step: string; sourceId?: string; url?: string; detail?: unknown };

const defaultFetchers: LearningFetchers = {
  robots: (url, signal) => isAllowedByRobots(url, LEARNING_USER_AGENT, { signal }),
  docs: (url, o) => fetchDocPage(url, o),
  github: (url, o) => fetchRepoSnapshot(url, o),
};

/** In-process controllers so cancelLearningRun can abort a live run immediately. */
const liveRuns = new Map<string, AbortController>();

class StopRun extends Error {
  constructor(public status: LearningRunStatus, message: string) {
    super(message);
  }
}

function withAbort<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}

/** Docs first, then GitHub, interleaved fairly: d1, g1, d2, g2, ... */
export function interleaveSources<T extends { kind: string }>(sources: T[]): T[] {
  const docs = sources.filter((s) => s.kind === "DOCS");
  const gh = sources.filter((s) => s.kind === "GITHUB");
  const out: T[] = [];
  for (let i = 0; i < Math.max(docs.length, gh.length); i++) {
    if (docs[i]) out.push(docs[i]!);
    if (gh[i]) out.push(gh[i]!);
  }
  return out;
}

function summarize(r: {
  id: string;
  status: LearningRunStatus;
  tokensUsed: number;
  costUsd: number;
  sourcesChecked: number;
  sourcesChanged: number;
  sourcesSkipped: number;
  entriesDrafted: number;
  error: string | null;
}): RunLearningResult {
  return {
    runId: r.id,
    status: r.status,
    tokensUsed: r.tokensUsed,
    costUsd: r.costUsd,
    sourcesChecked: r.sourcesChecked,
    sourcesChanged: r.sourcesChanged,
    sourcesSkipped: r.sourcesSkipped,
    entriesDrafted: r.entriesDrafted,
    error: r.error,
  };
}

/**
 * Run a QUEUED learning run. Idempotent: if the run is not QUEUED (already
 * running elsewhere, cancelled, or finished) it returns the current state
 * without doing anything.
 */
export async function runLearningRun(learningRunId: string, opts: RunLearningOptions = {}): Promise<RunLearningResult> {
  const db = opts.db ?? prisma;
  const startedAt = new Date();
  const claimed = await db.learningRun.updateMany({ where: { id: learningRunId, status: "QUEUED" }, data: { status: "RUNNING", startedAt } });
  if (claimed.count === 0) {
    const existing = await db.learningRun.findUnique({ where: { id: learningRunId } });
    if (!existing) throw new Error(`learning run ${learningRunId} not found`);
    return summarize(existing);
  }
  const run = await db.learningRun.findUniqueOrThrow({
    where: { id: learningRunId },
    include: { employee: { include: { providerConnection: true } } },
  });
  const employee = run.employee;
  const companyId = run.companyId;
  const { schedule, config: baseConfig } = await resolveEffectiveSchedule(companyId, employee.id, db);
  const config = { ...baseConfig, tokenStrategy: run.tokenStrategy };
  const fetchers: LearningFetchers = { ...defaultFetchers, ...opts.fetchers };

  const steps: LearningLogStep[] = [];
  const logStep = (step: string, extra: Omit<LearningLogStep, "at" | "step"> = {}) => {
    if (steps.length < MAX_LOG_STEPS) steps.push({ at: new Date().toISOString(), step, ...extra });
  };
  const counters = { sourcesChecked: 0, sourcesChanged: 0, sourcesSkipped: 0, entriesDrafted: 0 };

  const controller = new AbortController();
  liveRuns.set(learningRunId, controller);
  const timeoutMs = opts.maxDurationMs ?? config.maxDurationMinutes * 60_000;
  const timer = setTimeout(() => controller.abort(new StopRun("TIMED_OUT", `time cap of ${Math.round(timeoutMs / 1000)}s reached`)), timeoutMs);
  const onExternalAbort = () => controller.abort(new StopRun("CANCELLED", "aborted by worker"));
  if (opts.signal?.aborted) onExternalAbort();
  opts.signal?.addEventListener("abort", onExternalAbort, { once: true });
  const signal = controller.signal;

  let budget: LearningBudget | null = null;
  let status: LearningRunStatus = "COMPLETED";
  let error: string | null = null;

  const persist = async () => {
    await db.learningRun.update({
      where: { id: learningRunId },
      data: {
        ...counters,
        tokensUsed: budget?.runTokens ?? 0,
        costUsd: budget?.runCostUsd ?? 0,
        log: steps as unknown as Prisma.InputJsonValue,
      },
    });
  };

  await emit({ companyId, employeeId: employee.id, type: "learning.run_started", payload: { runId: run.id, trigger: run.trigger, tokenStrategy: run.tokenStrategy } }, db);
  logStep("started", { detail: { tokenStrategy: run.tokenStrategy, maxDurationMs: timeoutMs, scheduleId: schedule?.id ?? null } });

  try {
    budget = await LearningBudget.load(companyId, config, { db, now: startedAt, excludeRunId: run.id });
    if (config.tokenStrategy === "LOW" && budget.exhausted) throw new StopRun("BUDGET_EXHAUSTED", budget.exhaustedReason ?? "budget exhausted");

    let llm: EmployeeLlm | null = null;
    if (config.tokenStrategy === "LOW") {
      // Usage Limit Manager: never call a limited provider (and never fall back to a paid one).
      const limited = await learningProviderLimit(employee);
      if (limited) {
        logStep("postponed: provider limit", { detail: `${limited}; drafting deterministic notes only` });
      } else {
        llm = await resolveEmployeeLlm(employee);
        if (!llm && opts.synth) llm = { provider: "ANTHROPIC", secret: "", model: null };
        if (!llm) logStep("llm-unavailable", { detail: "no API-key connection with paid learning allowed (settings.allowPaidLearning); drafting deterministic notes" });
      }
    }
    const synth: SynthFn = opts.synth ?? synthesizeNote;

    // Specialization-only: off-specialty sources are never fetched.
    const candidates = await listCandidateSources(companyId, employee.id, db);
    for (const s of candidates) {
      if (!isRelevantToEmployee(s, employee)) {
        counters.sourcesSkipped++;
        logStep("skipped: off-specialty", { sourceId: s.id, url: s.url, detail: { sourceSpecialty: s.specialty, employeeSpecialty: employee.specialty } });
      }
    }
    const eligible = (await listSourcesForEmployee(companyId, employee.id, db)).filter((s) => {
      const on = s.kind === "DOCS" ? config.sourceDocs : config.sourceGithub;
      if (!on) {
        counters.sourcesSkipped++;
        logStep("skipped: source kind disabled", { sourceId: s.id, url: s.url });
      }
      return on;
    });
    const ordered = interleaveSources(eligible);
    const roleTopics = ROLE_TEMPLATES[employee.specialty].topics;
    let githubRateLimited = false;

    for (const source of ordered) {
      if (signal.aborted) throw signal.reason;
      const row = await db.learningRun.findUnique({ where: { id: learningRunId }, select: { status: true } });
      if (row?.status === "CANCELLED") throw new StopRun("CANCELLED", "cancelled");
      if (budget.exhausted) throw new StopRun("BUDGET_EXHAUSTED", budget.exhaustedReason ?? "budget exhausted");
      if (source.kind === "GITHUB" && githubRateLimited) {
        counters.sourcesSkipped++;
        logStep("skipped: github rate limited", { sourceId: source.id, url: source.url });
        continue;
      }
      counters.sourcesChecked++;
      const outcome = await processSource(source);
      if (outcome === "rate_limited") githubRateLimited = true;
      await persist();
    }

    async function processSource(source: LearningSource): Promise<"ok" | "rate_limited"> {
      const now = new Date();
      let fetched: DocFetchResult | RepoSnapshotResult;
      if (source.kind === "DOCS") {
        const allowed = await withAbort(fetchers.robots(source.url, signal), signal);
        if (!allowed) {
          counters.sourcesSkipped++;
          logStep("skipped: disallowed by robots.txt", { sourceId: source.id, url: source.url });
          return "ok";
        }
        fetched = await withAbort(fetchers.docs(source.url, { etag: config.skipUnchanged ? source.etag : null, signal }), signal);
      } else {
        fetched = await withAbort(
          fetchers.github(source.url, {
            etag: config.skipUnchanged ? source.etag : null,
            lastCommitSha: config.skipUnchanged ? source.lastCommitSha : null,
            signal,
          }),
          signal,
        );
      }

      if (fetched.status === "rate_limited") {
        counters.sourcesSkipped++;
        logStep("skipped: github rate limited", { sourceId: source.id, url: source.url, detail: fetched.error });
        return "rate_limited";
      }
      if (fetched.status === "error") {
        counters.sourcesSkipped++;
        logStep("error: fetch failed", { sourceId: source.id, url: source.url, detail: fetched.error });
        await db.learningSource.update({ where: { id: source.id }, data: { lastFetchedAt: now } });
        return "ok";
      }
      const commitSha = "commitSha" in fetched ? (fetched.commitSha ?? null) : null;
      const unchangedByHash = config.skipUnchanged && fetched.status === "changed" && fetched.contentHash && fetched.contentHash === source.contentHash;
      if (fetched.status === "unchanged" || unchangedByHash || !fetched.text || !fetched.contentHash) {
        counters.sourcesSkipped++;
        logStep("skipped: unchanged", { sourceId: source.id, url: source.url, detail: { by: fetched.status === "unchanged" ? "etag/sha" : "content hash" } });
        await db.learningSource.update({
          where: { id: source.id },
          data: { lastFetchedAt: now, etag: fetched.etag ?? source.etag, lastCommitSha: commitSha ?? source.lastCommitSha },
        });
        return "ok";
      }

      counters.sourcesChanged++;
      const hash = fetched.contentHash;
      const text = redactSecrets(fetched.text);
      const title = redactSecrets(fetched.title ?? source.title).slice(0, 300);
      await db.learningSource.update({
        where: { id: source.id },
        data: {
          etag: fetched.etag ?? null,
          lastCommitSha: commitSha ?? source.lastCommitSha,
          contentHash: hash,
          lastFetchedAt: now,
          ...(hash !== source.contentHash ? { lastChangedAt: now } : {}),
        },
      });

      const topics = [...new Set([...source.topics, ...roleTopics])];
      const score = scoreRelevance(`${title}\n${text}`, topics, employee.specializationTopics);
      if (!isRelevant(score)) {
        logStep("skipped: not relevant", { sourceId: source.id, url: source.url, detail: { score: Number(score.toFixed(3)) } });
        return "ok";
      }
      if (await alreadySeen(source.id, hash, db)) {
        logStep("skipped: duplicate content", { sourceId: source.id, url: source.url });
        return "ok";
      }

      let doc;
      try {
        doc = await db.sourceDocument.create({
          data: {
            companyId,
            sourceId: source.id,
            url: source.url,
            title,
            contentHash: hash,
            commitSha,
            etag: fetched.etag ?? null,
            text,
            sizeBytes: fetched.sizeBytes ?? Buffer.byteLength(text, "utf8"),
            license: "license" in fetched ? (fetched.license ?? null) : null,
            fetchedAt: now,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          logStep("skipped: duplicate content", { sourceId: source.id, url: source.url });
          return "ok";
        }
        throw err;
      }

      // Draft the note.
      let noteTitle: string;
      let noteContent: string;
      let confidence: number;
      let provenance: "LEARNING_LLM" | "LEARNING_DETERMINISTIC" = "LEARNING_DETERMINISTIC";
      const det = deterministicNote({ title, url: source.url, retrievedAt: now, headings: fetched.headings, commitSha });
      noteTitle = det.title;
      noteContent = det.content;
      confidence = det.confidence;

      if (config.tokenStrategy === "LOW" && llm && budget) {
        const estimate = estimateSynthTokens(text, 400);
        if (!budget.canSpend(estimate)) {
          budget.markExhausted("next synthesis call would exceed the token budget");
          logStep("budget: deterministic note instead of LLM call", { sourceId: source.id, detail: { estimate, remaining: budget.remainingTokens } });
        } else {
          const res = await withAbort(
            synth({
              text,
              sourceUrl: source.url,
              title,
              employeeTopics: topics,
              provider: llm.provider,
              secret: llm.secret,
              model: llm.model,
              maxOutputTokens: 400,
              signal,
            }),
            signal,
          );
          budget.record({ inputTokens: res.tokens.input, outputTokens: res.tokens.output, costUsd: res.costUsd });
          await db.usageRecord.create({
            data: {
              companyId,
              employeeId: employee.id,
              learningRunId,
              provider: res.provider.toLowerCase(),
              model: res.model,
              source: "PROVIDER_REPORTED",
              inputTokens: res.tokens.input,
              outputTokens: res.tokens.output,
              costUsd: res.costUsd,
            },
          });
          logStep("llm: synthesized", { sourceId: source.id, detail: { tokens: res.tokens, parsed: res.parsed } });
          provenance = "LEARNING_LLM";
          noteTitle = redactSecrets(res.title).slice(0, 200);
          noteContent = `${redactSecrets(res.claim)}\n\nSource: ${source.url} (retrieved ${now.toISOString()}${commitSha ? `, commit ${commitSha}` : ""}).`;
          confidence = Math.max(0, Math.min(1, res.confidence));
        }
      }

      const verified = !config.approvalRequired;
      const entry = await db.knowledgeEntry.create({
        data: {
          companyId,
          employeeId: employee.id,
          learningRunId,
          sourceDocumentId: doc.id,
          kind: "LEARNED_NOTE",
          provenance,
          status: verified ? "VERIFIED" : "DRAFT",
          verifiedAt: verified ? now : null,
          title: noteTitle,
          content: noteContent,
          sourceUrl: source.url,
          commitSha,
          retrievedAt: now,
          confidence,
          tags: topics.slice(0, 20),
          expiresAt: new Date(now.getTime() + KNOWLEDGE_TTL_DAYS * 86_400_000),
        },
      });
      counters.entriesDrafted++;
      logStep("drafted", { sourceId: source.id, url: source.url, detail: { entryId: entry.id, provenance, score: Number(score.toFixed(3)) } });
      await emit(
        {
          companyId,
          employeeId: employee.id,
          type: "knowledge.drafted",
          payload: { entryId: entry.id, runId: learningRunId, title: entry.title, status: entry.status, provenance, sourceUrl: source.url },
        },
        db,
      );
      return "ok";
    }
  } catch (err) {
    const reason = err instanceof StopRun ? err : signal.aborted && signal.reason instanceof StopRun ? signal.reason : null;
    if (reason) {
      status = reason.status;
      error = reason.status === "CANCELLED" ? null : reason.message;
      logStep(`stopped: ${reason.status.toLowerCase()}`, { detail: reason.message });
    } else if (err instanceof ZeroTokenViolation) {
      status = "FAILED";
      error = err.message;
      logStep("error: zero-token violation");
    } else {
      status = "FAILED";
      error = redactSecrets(err instanceof Error ? err.message : String(err)).slice(0, 1000);
      logStep("error", { detail: error });
      log.error({ err: error, runId: learningRunId }, "learning run failed");
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onExternalAbort);
    liveRuns.delete(learningRunId);
  }

  if (status === "COMPLETED" && budget?.exhausted && config.tokenStrategy === "LOW") {
    status = "BUDGET_EXHAUSTED";
    error = budget.exhaustedReason;
  }
  // An external cancel always wins.
  const latest = await db.learningRun.findUnique({ where: { id: learningRunId }, select: { status: true } });
  if (latest?.status === "CANCELLED") status = "CANCELLED";

  // Only the weekly caps pause the schedule; the per-run cap just ends this run.
  if (status === "BUDGET_EXHAUSTED" && config.pauseOnBudgetExhaustion && schedule && budget?.weeklyExhausted) {
    await db.learningSchedule.update({ where: { id: schedule.id }, data: { pausedAt: new Date(), pauseReason: `budget exhausted: ${error ?? "cap reached"}` } });
    logStep("schedule paused", { detail: { scheduleId: schedule.id } });
    try {
      await syncScheduleToQueue(schedule.id, db);
    } catch (err) {
      log.warn({ err: String(err) }, "failed to sync paused schedule");
    }
  }

  const endedAt = new Date();
  logStep("ended", { detail: { status } });
  const final = await db.learningRun.update({
    where: { id: learningRunId },
    data: {
      ...counters,
      status,
      error,
      endedAt,
      durationMs: endedAt.getTime() - startedAt.getTime(),
      tokensUsed: budget?.runTokens ?? 0,
      costUsd: budget?.runCostUsd ?? 0,
      log: steps as unknown as Prisma.InputJsonValue,
    },
  });
  await emit(
    {
      companyId,
      employeeId: employee.id,
      type: "learning.run_ended",
      payload: { runId: learningRunId, status, error, tokensUsed: final.tokensUsed, ...counters },
    },
    db,
  );
  return summarize(final);
}

/**
 * Cancel a QUEUED or RUNNING run. A live run in this process is aborted
 * immediately; a run in another worker notices the CANCELLED row between
 * sources. Returns false when the run was not cancellable.
 */
export async function cancelLearningRun(runId: string, opts: { companyId?: string; db?: Db } = {}): Promise<boolean> {
  const db = opts.db ?? prisma;
  const before = await db.learningRun.findFirst({ where: { id: runId, ...(opts.companyId ? { companyId: opts.companyId } : {}) } });
  if (!before || (before.status !== "QUEUED" && before.status !== "RUNNING")) return false;
  const res = await db.learningRun.updateMany({
    where: { id: runId, status: { in: ["QUEUED", "RUNNING"] } },
    data: { status: "CANCELLED", ...(before.status === "QUEUED" ? { endedAt: new Date() } : {}) },
  });
  if (res.count === 0) return false;
  liveRuns.get(runId)?.abort(new StopRun("CANCELLED", "cancelled"));
  if (before.status === "QUEUED") {
    await emit({ companyId: before.companyId, employeeId: before.employeeId, type: "learning.run_ended", payload: { runId, status: "CANCELLED" } }, db);
  }
  return true;
}

