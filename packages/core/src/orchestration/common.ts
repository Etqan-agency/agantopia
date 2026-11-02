import { prisma, type ExecutionMode, type ProviderConnection } from "@agentopia/db";
import { CompanySettingsSchema, ProviderSettingsSchema, type CompanySettings, type ProviderSettings, type TaskStatus } from "@agentopia/shared";
import { decryptSecret } from "../crypto/secrets";
import { DomainError } from "../errors";
import type { DbClient } from "../events/emit";
import type { ProviderKind } from "../providers/types";
import type { LlmConfig } from "./llm";
import { assertTransition } from "./state-machine";

/** Parsed company settings with defaults. */
export async function getCompanySettings(companyId: string, db: DbClient = prisma): Promise<CompanySettings> {
  const c = await db.company.findUnique({ where: { id: companyId }, select: { settings: true } });
  if (!c) throw new DomainError("NOT_FOUND", "Company not found");
  return CompanySettingsSchema.parse(c.settings ?? {});
}

/** Parsed provider settings with defaults (empty connection → defaults). */
export function providerSettingsOf(conn: Pick<ProviderConnection, "settings"> | null | undefined): ProviderSettings {
  return ProviderSettingsSchema.parse((conn?.settings as object | null) ?? {});
}

export interface ExecutionTarget {
  provider: ProviderKind;
  /** Stored on ExecutionSession.provider. */
  providerLabel: "anthropic" | "openai" | "simulated";
  mode: ExecutionMode;
  connection: ProviderConnection | null;
  /** SUBSCRIPTION_CLI (user's own CLI sign-in via the local runner) or API_KEY (explicit, separately billed). */
  authMode: "SUBSCRIPTION_CLI" | "API_KEY" | null;
}

/**
 * Decides how an employee's work runs (no paid fallback, ever):
 *  - no connection (or a SIMULATED one) → SIMULATED (labelled, not paid);
 *  - authMode SUBSCRIPTION_CLI → LOCAL_RUNNER always (the server never executes it, never with a key);
 *  - authMode API_KEY → API (explicit paid), or LOCAL_RUNNER for legacy runner connections that carry a key.
 * An INVALID/REVOKED connection, or an API connection without a stored key, is refused
 * (the task is blocked rather than silently simulated or switched).
 */
export function resolveExecutionTarget(conn: ProviderConnection | null | undefined): ExecutionTarget {
  if (!conn || conn.provider === "SIMULATED" || conn.mode === "SIMULATED") {
    return { provider: "SIMULATED", providerLabel: "simulated", mode: "SIMULATED", connection: conn ?? null, authMode: null };
  }
  if (conn.status === "INVALID" || conn.status === "REVOKED" || conn.revokedAt) {
    throw new DomainError("CONFLICT", `Provider connection "${conn.label}" is ${conn.status.toLowerCase()}; fix it on the Integrations page`);
  }
  const providerLabel = conn.provider === "ANTHROPIC" ? "anthropic" : "openai";
  if (conn.authMode === "SUBSCRIPTION_CLI") {
    return { provider: conn.provider, providerLabel, mode: "LOCAL_RUNNER", connection: conn, authMode: "SUBSCRIPTION_CLI" };
  }
  const mode: ExecutionMode = conn.mode === "LOCAL_RUNNER" ? "LOCAL_RUNNER" : "API";
  if (mode === "API" && !conn.encryptedSecret) throw new DomainError("CONFLICT", `Provider connection "${conn.label}" has no API key`);
  return { provider: conn.provider, providerLabel, mode, connection: conn, authMode: "API_KEY" };
}

/** Maps ExecutionSession.provider back to an adapter kind. */
export function providerKindOf(label: string): ProviderKind {
  return label === "anthropic" ? "ANTHROPIC" : label === "openai" ? "OPENAI" : "SIMULATED";
}

/** LLM config for an employee's VERIFIED, explicit API_KEY connection, or null (no paid calls without one; subscription connections never). */
export async function verifiedLlmConfig(employeeId: string | null | undefined): Promise<LlmConfig | null> {
  if (!employeeId) return null;
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, include: { providerConnection: true } });
  const c = emp?.providerConnection;
  if (!c || c.authMode !== "API_KEY" || c.status !== "VERIFIED" || c.mode !== "API" || c.provider === "SIMULATED" || !c.encryptedSecret || c.revokedAt) return null;
  // A limited provider is not called (deterministic planning/review instead).
  const { isProviderAvailable } = await import("../providers/limits");
  if (!(await isProviderAvailable(c.companyId, c.provider)).available) return null;
  return { provider: c.provider, secret: decryptSecret(c.encryptedSecret), model: emp?.model ?? c.defaultModel };
}

/** The company's active manager employee, if any. */
export async function findManager(companyId: string, db: DbClient = prisma) {
  return db.employee.findFirst({ where: { companyId, role: "MANAGER", status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
}

/**
 * Guarded status change: asserts the transition and updates only if the row
 * still has `from` (optimistic concurrency). Returns false when it lost a race.
 */
export async function moveTask(db: DbClient, taskId: string, from: TaskStatus, to: TaskStatus, data: Record<string, unknown> = {}): Promise<boolean> {
  assertTransition(from, to);
  const r = await db.task.updateMany({ where: { id: taskId, status: from }, data: { ...data, status: to } });
  return r.count === 1;
}

/** Reviewer choice: an available ACTIVE QA employee (not the assignee), else the manager, else null. */
export async function pickReviewer(companyId: string, assigneeId: string | null | undefined) {
  const qa = await prisma.employee.findMany({
    where: { companyId, specialty: "QA", status: "ACTIVE", id: assigneeId ? { not: assigneeId } : undefined },
    include: { _count: { select: { assignments: { where: { status: "ACTIVE" } } } } },
    orderBy: [{ rank: "desc" }, { createdAt: "asc" }],
  });
  const free = qa.find((e) => e._count.assignments === 0);
  if (free) return free;
  const manager = await findManager(companyId);
  if (manager && manager.id !== assigneeId) return manager;
  return null;
}

/** Truncates arbitrary JSON-able input for event payloads. */
export function boundedJson(value: unknown, max = 2000): unknown {
  try {
    const s = JSON.stringify(value);
    if (s === undefined) return null;
    return s.length <= max ? value : { truncated: true, preview: s.slice(0, max) };
  } catch {
    return { unserializable: true };
  }
}
