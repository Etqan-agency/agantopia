/** Learning sources: default seeding from role templates and specialty scoping. */
import { prisma, type Db, type LearningSource, type Specialty } from "@agentopia/db";
import { ROLE_TEMPLATES } from "@agentopia/shared";

/**
 * Create the role template's default sources for an employee (or, with
 * `employeeId = null`, as shared company sources). Idempotent per URL.
 * Returns the sources that were created.
 */
export async function ensureDefaultSources(
  companyId: string,
  employeeId: string | null,
  specialty: Specialty,
  db: Db = prisma,
): Promise<LearningSource[]> {
  const tpl = ROLE_TEMPLATES[specialty];
  const created: LearningSource[] = [];
  for (const src of tpl.sources) {
    // Compound unique contains a nullable column, so use findFirst + create.
    const existing = await db.learningSource.findFirst({ where: { companyId, employeeId, url: src.url }, select: { id: true } });
    if (existing) continue;
    created.push(
      await db.learningSource.create({
        data: { companyId, employeeId, kind: src.kind, url: src.url, title: src.title, specialty, topics: tpl.topics },
      }),
    );
  }
  return created;
}

type EmployeeScope = { id: string; companyId: string; specialty: Specialty };

/**
 * True only when the source belongs to the employee's company, is shared or
 * assigned to that employee, and matches the employee's specialty
 * (learning is specialization-only).
 */
export function isRelevantToEmployee(
  source: Pick<LearningSource, "companyId" | "employeeId" | "specialty">,
  employee: EmployeeScope,
): boolean {
  return (
    source.companyId === employee.companyId &&
    (source.employeeId === null || source.employeeId === employee.id) &&
    source.specialty === employee.specialty
  );
}

/**
 * All enabled sources (employee-specific + shared) visible to an employee,
 * regardless of specialty. Used by the run to log off-specialty skips.
 */
export async function listCandidateSources(companyId: string, employeeId: string, db: Db = prisma): Promise<LearningSource[]> {
  return db.learningSource.findMany({
    where: { companyId, enabled: true, OR: [{ employeeId }, { employeeId: null }] },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

/**
 * Enabled sources an employee may learn from: employee-specific + shared,
 * same specialty, de-duplicated by URL (employee-specific wins).
 */
export async function listSourcesForEmployee(companyId: string, employeeId: string, db: Db = prisma): Promise<LearningSource[]> {
  const employee = await db.employee.findFirst({ where: { id: employeeId, companyId }, select: { id: true, companyId: true, specialty: true } });
  if (!employee) return [];
  const all = (await listCandidateSources(companyId, employeeId, db)).filter((s) => isRelevantToEmployee(s, employee));
  const byUrl = new Map<string, LearningSource>();
  for (const s of all) {
    const prev = byUrl.get(s.url);
    if (!prev || (prev.employeeId === null && s.employeeId !== null)) byUrl.set(s.url, s);
  }
  return [...byUrl.values()];
}
