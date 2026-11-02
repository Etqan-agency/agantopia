import { prisma } from "@agentopia/db";
import type { CreateRunnerInput } from "@agentopia/shared";
import type { z } from "zod";
import type { CreatedRunner } from "../../lib/api-types";
import { audit } from "../audit";
import { authenticateRunnerCore, emitEvent, generateToken, hashToken, runnerProtocolSchema, runnerServer } from "../core";
import { ApiError, notFound, unauthorized } from "../errors";
import { enforceIdentityRateLimit } from "../rate-limit";
import { runnerSelect, toRunnerView } from "./views";

// --- Owner-facing management ---------------------------------------------------------------
export async function listRunners(companyId: string) {
  const rows = await prisma.runner.findMany({ where: { companyId }, orderBy: { createdAt: "asc" }, select: runnerSelect });
  return rows.map(toRunnerView);
}

export async function createRunner(companyId: string, userId: string, input: z.infer<typeof CreateRunnerInput>): Promise<CreatedRunner> {
  const token = generateToken();
  const r = await prisma.runner.create({ data: { companyId, name: input.name, tokenHash: hashToken(token) }, select: runnerSelect });
  await audit(companyId, userId, "runner.create", "Runner", r.id, { name: input.name });
  return { runner: toRunnerView(r), token };
}

export async function revokeRunner(companyId: string, userId: string, runnerId: string) {
  const r = await prisma.runner.findFirst({ where: { id: runnerId, companyId }, select: { id: true, status: true } });
  if (!r) throw notFound("Runner");
  if (r.status !== "REVOKED") {
    await prisma.runner.update({ where: { id: runnerId }, data: { status: "REVOKED", revokedAt: new Date() } });
    await emitEvent({ companyId, type: "runner.status", payload: { runnerId, status: "REVOKED" } });
    await audit(companyId, userId, "runner.revoke", "Runner", runnerId, {});
  }
  return toRunnerView(await prisma.runner.findUniqueOrThrow({ where: { id: runnerId }, select: runnerSelect }));
}

// --- Runner protocol ----------------------------------------------------------------------------
/*
 * Thin delegation to core (`@agentopia/core/runner/server`, wire format in
 * `@agentopia/core/runner/protocol`), the protocol the runner CLI speaks.
 * Core enforces company scoping and leases; provider-limit classification on
 * complete parks tasks as WAITING_FOR_PROVIDER_LIMIT.
 */
type CoreRunner = { id: string; companyId: string; name: string; status: string };

/** Bearer token → runner row (core lookup by token hash; revoked runners and archived companies are refused). */
export async function authenticateRunner(req: Request): Promise<CoreRunner> {
  const h = (req.headers.get("authorization") ?? "").trim();
  if (!/^Bearer\s+\S{16,512}$/i.test(h)) throw unauthorized("Runner token required");
  const runner = (await authenticateRunnerCore(h)) as CoreRunner | null;
  if (!runner) throw unauthorized("Invalid runner token");
  const company = await prisma.company.findUnique({ where: { id: runner.companyId }, select: { archivedAt: true } });
  if (!company || company.archivedAt) throw unauthorized("Invalid runner token");
  await enforceIdentityRateLimit(req, `r:${runner.id}`);
  return runner;
}

async function parseCore(name: "RunnerHeartbeatInput" | "RunnerEventsInput" | "RunnerCompleteInput", raw: unknown) {
  const schema = await runnerProtocolSchema(name);
  if (!schema) throw new ApiError(503, "core_unavailable", "runner/protocol is not available");
  const r = schema.safeParse(raw);
  if (!r.success) throw new ApiError(400, "validation_error", "Request validation failed", (r.error as { issues?: unknown }).issues);
  return r.data as Record<string, unknown>;
}

export async function handleHeartbeat(runner: CoreRunner, body: unknown) {
  const input = await parseCore("RunnerHeartbeatInput", body);
  return (await runnerServer("runnerHeartbeat"))(runner, input.capabilities);
}

export async function handleClaim(runner: CoreRunner) {
  return { job: ((await (await runnerServer("claimRunnerJob"))(runner)) as unknown) ?? null };
}

export async function handleEvents(runner: CoreRunner, sessionId: string, body: unknown) {
  const input = await parseCore("RunnerEventsInput", body);
  return (await runnerServer("recordRunnerEvents"))(runner, sessionId, input.items);
}

export async function handleControl(runner: CoreRunner, sessionId: string) {
  return (await runnerServer("getRunnerControl"))(runner, sessionId);
}

export async function handleComplete(runner: CoreRunner, sessionId: string, body: unknown) {
  const input = await parseCore("RunnerCompleteInput", body);
  return (await runnerServer("completeRunnerJob"))(runner, sessionId, input);
}
