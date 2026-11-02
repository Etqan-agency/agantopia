/** Resolve which LLM (if any) an employee may use for bounded learning calls. */
import { prisma, type Employee, type ProviderConnection } from "@agentopia/db";
import { CompanySettingsSchema } from "@agentopia/shared";
import { isProviderAvailable } from "../providers/limits";
import { deps, log } from "./deps";

export type EmployeeLlm = { provider: "ANTHROPIC" | "OPENAI"; secret: string; model: string | null };

type EmployeeWithConnection = Employee & { providerConnection: ProviderConnection | null };

/**
 * Usage Limit Manager check for learning: when the employee's provider is
 * currently limited (usage/rate limit or expired sign-in), learning must not
 * call it. Returns the reason, or null when the provider is available (or the
 * employee has no real provider).
 */
export async function learningProviderLimit(employee: EmployeeWithConnection): Promise<string | null> {
  const p = employee.providerConnection?.provider;
  if (p !== "ANTHROPIC" && p !== "OPENAI") return null;
  try {
    const a = await isProviderAvailable(employee.companyId, p);
    return a.available ? null : (a.reason ?? "provider limit");
  } catch (err) {
    log.warn({ err: String(err) }, "provider limit check failed; treating provider as unavailable for learning");
    return "provider limit state unavailable";
  }
}

/** company.settings.allowPaidLearning (default false). */
export async function paidLearningAllowed(companyId: string): Promise<boolean> {
  const c = await prisma.company.findUnique({ where: { id: companyId }, select: { settings: true } });
  const parsed = CompanySettingsSchema.safeParse(c?.settings ?? {});
  return parsed.success ? parsed.data.allowPaidLearning === true : false;
}

/**
 * The employee's own explicit API_KEY provider connection (VERIFIED, not
 * revoked), with its secret decrypted server-side, and only when the company
 * opted into paid learning (`settings.allowPaidLearning === true`) and the
 * provider is not limited. Subscription (SUBSCRIPTION_CLI) connections are
 * never used for learning. Returns null otherwise (callers then draft
 * deterministic, zero-token notes).
 */
export async function resolveEmployeeLlm(employee: EmployeeWithConnection, opts: { allowPaidLearning?: boolean } = {}): Promise<EmployeeLlm | null> {
  const c = employee.providerConnection;
  if (!c || c.authMode !== "API_KEY" || c.mode !== "API" || c.status !== "VERIFIED" || c.revokedAt || !c.encryptedSecret) return null;
  if (c.provider !== "ANTHROPIC" && c.provider !== "OPENAI") return null;
  const allowed = opts.allowPaidLearning ?? (await paidLearningAllowed(employee.companyId));
  if (!allowed) return null;
  if (await learningProviderLimit(employee)) return null;
  try {
    const secret = await deps().decryptSecret(c.encryptedSecret);
    return { provider: c.provider, secret, model: employee.model ?? c.defaultModel ?? null };
  } catch (err) {
    log.warn({ err: String(err), connectionId: c.id }, "could not decrypt provider secret for learning");
    return null;
  }
}
