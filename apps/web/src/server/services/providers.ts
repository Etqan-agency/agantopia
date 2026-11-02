import { prisma, Prisma } from "@agentopia/db";
import { PROVIDER_AUTH_MODES, ProviderSettingsSchema, UpdateProviderConnectionInput, type CreateProviderConnectionInput, type ProviderAuthMode } from "@agentopia/shared";
import { z } from "zod";
import type { ProviderConnectionView, ReconnectProviderResponse, VerifyProviderResponse } from "../../lib/api-types";
import { audit } from "../audit";
import { decryptSecret, encryptSecret, getProviderAdapter, secretLast4 } from "../core";
import { ApiError, badRequest, conflict, notFound } from "../errors";
import { clearLimit, getProviderLimitView, getProviderStatuses, isRunnerOnline, isSubscriptionProvider, RECONNECT_INSTRUCTIONS } from "./provider-status";
import { HAS_SECRET_KEY, MODELS_KEY, providerSelect, toProviderView } from "./views";

/** PATCH body: the shared schema plus an auth-mode switch (API_KEY needs the billing acknowledgement). */
export const UpdateProviderInput = UpdateProviderConnectionInput.extend({
  authMode: z.enum(PROVIDER_AUTH_MODES).optional(),
  acknowledgeSeparateBilling: z.boolean().optional(),
});

const separateBillingNotAcknowledged = () =>
  new ApiError(
    400,
    "separate_billing_not_acknowledged",
    "API keys are billed separately by the provider. Set acknowledgeSeparateBilling to true to confirm. A Claude or ChatGPT subscription is not an API key.",
  );

const keyNotAllowed = () =>
  new ApiError(400, "api_key_not_allowed", "Subscription connections never store a key: the runner uses the CLI sign-in on your machine.");

/** Remove anything that looks like a credential from provider error text and bound its length. */
export function sanitizeProviderError(message: unknown, secret?: string | null): string {
  let s = typeof message === "string" ? message : message instanceof Error ? message.message : "Verification failed";
  if (secret && secret.length >= 6) s = s.split(secret).join("[redacted]");
  s = s
    .replace(/\b(sk|rk|pk)-[A-Za-z0-9_\-]{6,}/g, "[redacted]")
    .replace(/\b(sk-ant|sk-proj)[A-Za-z0-9_\-]*/g, "[redacted]")
    .replace(/(authorization|x-api-key|api[-_ ]?key)\s*[:=]\s*(bearer\s+)?\S+/gi, "$1: [redacted]")
    .replace(/bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/[A-Za-z0-9_\-]{32,}/g, "[redacted]");
  return s.slice(0, 300);
}

function internalSettings(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

async function requireConnection(companyId: string, providerId: string) {
  const p = await prisma.providerConnection.findFirst({ where: { id: providerId, companyId } });
  if (!p) throw notFound("Provider connection");
  return p;
}

async function view(providerId: string): Promise<ProviderConnectionView> {
  return toProviderView(await prisma.providerConnection.findUniqueOrThrow({ where: { id: providerId }, select: providerSelect }));
}

export async function listProviders(companyId: string): Promise<ProviderConnectionView[]> {
  const rows = await prisma.providerConnection.findMany({ where: { companyId }, orderBy: { createdAt: "asc" }, select: providerSelect });
  return rows.map(toProviderView);
}

/**
 * Derives the auth mode: any request carrying `apiKey` (or an explicit
 * `authMode: "API_KEY"` / legacy `mode: "API"`) is an API key connection;
 * everything else is the user's subscription through the local runner.
 */
function resolveAuthMode(input: z.infer<typeof CreateProviderConnectionInput>): ProviderAuthMode {
  if (input.apiKey || input.authMode === "API_KEY" || input.mode === "API") return "API_KEY";
  return "SUBSCRIPTION_CLI";
}

export async function createProvider(companyId: string, userId: string, input: z.infer<typeof CreateProviderConnectionInput>) {
  const simulated = input.provider === "SIMULATED" || input.mode === "SIMULATED";
  const provider = simulated ? "SIMULATED" : input.provider;
  const authMode: ProviderAuthMode = simulated ? "SUBSCRIPTION_CLI" : resolveAuthMode(input);
  const mode = simulated ? "SIMULATED" : authMode === "API_KEY" ? "API" : "LOCAL_RUNNER";

  let key: string | undefined;
  if (authMode === "API_KEY" && !simulated) {
    if (!input.apiKey) throw badRequest("apiKey is required for API key connections");
    if (input.acknowledgeSeparateBilling !== true) throw separateBillingNotAcknowledged();
    key = input.apiKey;
  }
  if (!simulated && authMode === "SUBSCRIPTION_CLI") {
    const existing = await prisma.providerConnection.findFirst({
      where: { companyId, provider, authMode: "SUBSCRIPTION_CLI", status: { not: "REVOKED" } },
      select: { id: true },
    });
    if (existing) throw conflict("This provider is already connected with your subscription", { connectionId: existing.id });
  }

  const settings = { ...ProviderSettingsSchema.parse(input.settings ?? {}), [HAS_SECRET_KEY]: !!key };
  const created = await prisma.providerConnection.create({
    data: {
      companyId, provider, mode, authMode, label: input.label, defaultModel: input.defaultModel ?? null,
      encryptedSecret: key ? encryptSecret(key) : null,
      secretLast4: key ? secretLast4(key) : null,
      status: simulated ? "VERIFIED" : "UNVERIFIED",
      lastVerifiedAt: simulated ? new Date() : null,
      settings: settings as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  await audit(companyId, userId, "provider.create", "ProviderConnection", created.id, {
    provider, mode, authMode, label: input.label, hasSecret: !!key, ...(authMode === "API_KEY" && !simulated ? { acknowledgedSeparateBilling: true } : {}),
  });
  return view(created.id);
}

export async function updateProvider(companyId: string, userId: string, providerId: string, input: z.infer<typeof UpdateProviderInput>) {
  const p = await requireConnection(companyId, providerId);
  if (p.status === "REVOKED") throw conflict("Provider connection is revoked");
  const simulated = p.mode === "SIMULATED" || p.provider === "SIMULATED";
  // A key always means an API key connection (billed separately).
  const nextAuthMode: ProviderAuthMode = simulated ? p.authMode : (input.authMode ?? (input.apiKey ? "API_KEY" : p.authMode));
  const switching = nextAuthMode !== p.authMode;
  if (nextAuthMode === "API_KEY" && switching) {
    if (input.acknowledgeSeparateBilling !== true) throw separateBillingNotAcknowledged();
    if (!input.apiKey && !p.encryptedSecret) throw badRequest("apiKey is required to switch to an API key connection");
  }
  if (nextAuthMode === "SUBSCRIPTION_CLI" && input.apiKey && !simulated) throw keyNotAllowed();
  if (switching && nextAuthMode === "SUBSCRIPTION_CLI" && !simulated) {
    // Same rule as createProvider: one active subscription connection per provider.
    const existing = await prisma.providerConnection.findFirst({
      where: { companyId, provider: p.provider, authMode: "SUBSCRIPTION_CLI", status: { not: "REVOKED" }, id: { not: providerId } },
      select: { id: true },
    });
    if (existing) throw conflict("This provider is already connected with your subscription", { connectionId: existing.id });
  }

  const current = internalSettings(p.settings);
  // input.settings is already validated by the patch schema (no defaults injected), so merge it as is.
  const nextSettings: Record<string, unknown> = input.settings ? { ...current, ...input.settings } : { ...current };
  const rotate = !!input.apiKey && !simulated && nextAuthMode === "API_KEY";
  if (rotate) nextSettings[HAS_SECRET_KEY] = true;
  const dropSecret = switching && nextAuthMode === "SUBSCRIPTION_CLI";
  if (dropSecret) {
    nextSettings[HAS_SECRET_KEY] = false;
    nextSettings[MODELS_KEY] = [];
  }
  await prisma.providerConnection.update({
    where: { id: providerId },
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.defaultModel !== undefined ? { defaultModel: input.defaultModel } : {}),
      ...(switching ? { authMode: nextAuthMode, mode: nextAuthMode === "API_KEY" ? "API" : "LOCAL_RUNNER", status: "UNVERIFIED", verifyError: null, lastVerifiedAt: null } : {}),
      ...(dropSecret ? { encryptedSecret: null, secretLast4: null } : {}),
      settings: nextSettings as Prisma.InputJsonValue,
      ...(rotate
        ? { encryptedSecret: encryptSecret(input.apiKey!), secretLast4: secretLast4(input.apiKey!), status: "UNVERIFIED", verifyError: null, lastVerifiedAt: null }
        : {}),
    },
  });
  await audit(companyId, userId, switching ? "provider.auth_mode" : rotate ? "provider.rotate" : "provider.update", "ProviderConnection", providerId, {
    label: input.label, defaultModel: input.defaultModel, settingsChanged: !!input.settings, rotated: rotate,
    ...(switching ? { from: p.authMode, to: nextAuthMode, ...(nextAuthMode === "API_KEY" ? { acknowledgedSeparateBilling: true } : {}) } : {}),
  });
  return view(providerId);
}

export async function revokeProvider(companyId: string, userId: string, providerId: string) {
  const p = await requireConnection(companyId, providerId);
  if (p.status !== "REVOKED") {
    const settings = { ...internalSettings(p.settings), [HAS_SECRET_KEY]: false, [MODELS_KEY]: [] };
    await prisma.providerConnection.update({
      where: { id: providerId },
      data: { status: "REVOKED", encryptedSecret: null, revokedAt: new Date(), settings: settings as Prisma.InputJsonValue },
    });
    await audit(companyId, userId, "provider.revoke", "ProviderConnection", providerId, {});
  }
  return view(providerId);
}

export async function verifyProvider(companyId: string, userId: string, providerId: string): Promise<VerifyProviderResponse> {
  const p = await requireConnection(companyId, providerId);
  if (p.status === "REVOKED") throw conflict("Provider connection is revoked");

  if ((p.authMode === "SUBSCRIPTION_CLI" || p.mode === "LOCAL_RUNNER") && !p.encryptedSecret) {
    const connection = await view(providerId);
    return { status: connection.status, models: connection.models, error: "Subscription connections are checked by the local runner (CLI installed and signed in), not with a key", connection };
  }

  let secret: string | undefined;
  let status: "VERIFIED" | "INVALID" = "INVALID";
  let models: string[] = [];
  let error: string | null = null;
  try {
    secret = p.encryptedSecret ? decryptSecret(p.encryptedSecret) : undefined;
    const adapter = await getProviderAdapter(p.provider);
    const r = await adapter.verify(secret);
    if (r?.ok) {
      status = "VERIFIED";
      models = Array.isArray(r.models) ? r.models.filter((m): m is string => typeof m === "string") : [];
      if (!models.length) {
        models = await adapter.listModels(secret).catch(() => []);
      }
    } else {
      error = sanitizeProviderError(r?.error ?? r?.message ?? "Key was rejected by the provider", secret);
    }
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: string }).code === "core_unavailable") throw err;
    error = sanitizeProviderError(err, secret);
  }
  const settings = { ...internalSettings(p.settings), [MODELS_KEY]: status === "VERIFIED" ? models.slice(0, 200) : [] };
  await prisma.providerConnection.update({
    where: { id: providerId },
    data: { status, verifyError: error, lastVerifiedAt: new Date(), settings: settings as Prisma.InputJsonValue },
  });
  await audit(companyId, userId, "provider.verify", "ProviderConnection", providerId, { status });
  if (status === "VERIFIED" && p.authMode === "API_KEY" && isSubscriptionProvider(p.provider)) {
    await clearLimit(companyId, p.provider, "verified");
  }
  const connection = await view(providerId);
  return { status, models: connection.models, error, connection };
}

/**
 * POST /providers/:pid/reconnect. Never performs a login: for a subscription
 * connection it clears a stale AUTH_EXPIRED limit once the latest runner
 * heartbeat reports the CLI signed in, and returns what to do otherwise; for an
 * API key it re-runs verify.
 */
export async function reconnectProvider(companyId: string, userId: string, providerId: string): Promise<ReconnectProviderResponse> {
  const p = await requireConnection(companyId, providerId);
  if (p.status === "REVOKED") throw conflict("Provider connection is revoked");
  if (!isSubscriptionProvider(p.provider)) throw badRequest("The simulated provider has nothing to reconnect");
  const provider = p.provider;
  const statusFor = async () => (await getProviderStatuses(companyId)).find((s) => s.provider === provider) ?? null;

  if (p.authMode === "API_KEY") {
    const limitBefore = await getProviderLimitView(companyId, provider);
    const verify = await verifyProvider(companyId, userId, providerId); // clears the limit on success
    const cleared = verify.status === "VERIFIED" && limitBefore.kind !== "OK";
    await audit(companyId, userId, "provider.reconnect", "ProviderConnection", providerId, { authMode: p.authMode, verified: verify.status, cleared });
    return { status: await statusFor(), cleared, instructions: null, verify };
  }

  const before = await statusFor();
  let cleared = false;
  const runner = before?.runner;
  if (before?.limit.kind === "AUTH_EXPIRED" && runner && isRunnerOnline({ status: runner.status, lastSeenAt: runner.lastSeenAt }) && runner.tool?.auth === "logged_in") {
    cleared = await clearLimit(companyId, provider, "The runner reports the CLI is signed in again");
  }
  await audit(companyId, userId, "provider.reconnect", "ProviderConnection", providerId, { authMode: p.authMode, cleared });
  return { status: cleared ? await statusFor() : before, cleared, instructions: RECONNECT_INSTRUCTIONS[provider] };
}
