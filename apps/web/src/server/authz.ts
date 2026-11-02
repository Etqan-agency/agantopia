import { prisma, type CompanyRole } from "@agentopia/db";
import { forbidden, notFound, unauthorized } from "./errors";
import { clientIp as trustedClientIp, enforceIdentityRateLimit } from "./rate-limit";

/**
 * Data Access Layer for authorization. Every route handler resolves the session
 * with `requireSession()` and the company scope with `requireCompanyAccess()`
 * (or the floor/building variants). Nothing else queries tenant data unscoped.
 */
export type SessionUser = { id: string; email: string; name: string };
export type AppSession = { user: SessionUser };

let testSession: AppSession | null | undefined;

/** Test-only hook: stub the current session. Throws outside NODE_ENV=test. */
export function __setTestSession(session: AppSession | null | undefined): void {
  if (process.env.NODE_ENV !== "test") throw new Error("__setTestSession is only available in tests");
  testSession = session;
}

export async function getSession(req?: Request): Promise<AppSession | null> {
  if (process.env.NODE_ENV === "test" && testSession !== undefined) return testSession;
  const { auth } = await import("../lib/auth");
  let hdrs: Headers;
  if (req) hdrs = req.headers;
  else {
    const { headers } = await import("next/headers");
    hdrs = await headers();
  }
  const s = await auth.api.getSession({ headers: hdrs });
  if (!s) return null;
  return { user: { id: s.user.id, email: s.user.email, name: s.user.name } };
}

export async function requireSession(req?: Request): Promise<AppSession> {
  const s = await getSession(req);
  if (!s) throw unauthorized();
  if (req) await enforceIdentityRateLimit(req, `u:${s.user.id}`);
  return s;
}

export type CompanyAccess = {
  company: { id: string; name: string; ownerId: string; timezone: string; isDemo: boolean; settings: unknown; createdAt: Date; updatedAt: Date };
  role: CompanyRole;
};

/** Owner or member of a non-archived company. 404 if missing/archived, 403 if not a member. */
export async function requireCompanyAccess(userId: string, companyId: string, opts: { owner?: boolean } = {}): Promise<CompanyAccess> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true, name: true, ownerId: true, timezone: true, isDemo: true, settings: true, archivedAt: true, createdAt: true, updatedAt: true,
      memberships: { where: { userId }, select: { role: true }, take: 1 },
    },
  });
  if (!company || company.archivedAt) throw notFound("Company");
  let role: CompanyRole | null = null;
  if (company.ownerId === userId) role = "OWNER";
  else if (company.memberships[0]) role = company.memberships[0].role;
  if (!role) throw forbidden();
  if (opts.owner && role !== "OWNER") throw forbidden("Only the company owner can do this");
  const { memberships: _m, archivedAt: _a, ...rest } = company;
  return { company: rest, role };
}

/** Convenience: session + company access in one call. */
export async function authorizeCompany(req: Request, companyId: string, opts: { owner?: boolean } = {}) {
  const session = await requireSession(req);
  const access = await requireCompanyAccess(session.user.id, companyId, opts);
  return { session, ...access };
}

/** Building owner may read/write; members of a company on one of its floors may read. */
export async function requireBuildingAccess(userId: string, buildingId: string, opts: { write?: boolean } = {}) {
  const building = await prisma.building.findUnique({ where: { id: buildingId }, select: { id: true, name: true, ownerId: true, isDemo: true } });
  if (!building) throw notFound("Building");
  if (building.ownerId === userId) return { building, owner: true };
  if (!opts.write) {
    const shared = await prisma.floor.findFirst({
      where: {
        buildingId,
        archivedAt: null,
        company: { archivedAt: null, OR: [{ ownerId: userId }, { memberships: { some: { userId } } }] },
      },
      select: { id: true },
    });
    if (shared) return { building, owner: false };
  }
  throw forbidden();
}

/** Floor access: building owner (read/write) or member of the floor's company (read). */
export async function requireFloorAccess(userId: string, floorId: string, opts: { write?: boolean } = {}) {
  const floor = await prisma.floor.findUnique({
    where: { id: floorId },
    select: {
      id: true, name: true, order: true, buildingId: true, companyId: true, archivedAt: true,
      building: { select: { ownerId: true } },
      company: { select: { ownerId: true, archivedAt: true, memberships: { where: { userId }, select: { role: true }, take: 1 } } },
    },
  });
  if (!floor) throw notFound("Floor");
  const isBuildingOwner = floor.building.ownerId === userId;
  const isCompanyMember = !!floor.company && !floor.company.archivedAt && (floor.company.ownerId === userId || floor.company.memberships.length > 0);
  if (opts.write ? !isBuildingOwner : !(isBuildingOwner || isCompanyMember)) throw forbidden();
  return { floor: { id: floor.id, name: floor.name, order: floor.order, buildingId: floor.buildingId, companyId: floor.companyId, archivedAt: floor.archivedAt } };
}

/** Client address for auditing; forwarding headers are only trusted behind TRUSTED_PROXY. */
export function clientIp(req: Request): string | null {
  return trustedClientIp(req);
}
