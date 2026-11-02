/** Test-only DB fixtures (not exported from the package index). */
import { randomUUID } from "node:crypto";
import { prisma, type Specialty } from "@agentopia/db";

export type Fixture = { userId: string; companyId: string; cleanup: () => Promise<void> };

/** Create an owner user + company; cleanup deletes the user (cascades the company). */
export async function createCompanyFixture(name = "Learning Test Co"): Promise<Fixture> {
  const id = randomUUID();
  const user = await prisma.user.create({ data: { name: "Test Owner", email: `learning-test-${id}@example.test` } });
  const company = await prisma.company.create({ data: { ownerId: user.id, name } });
  return {
    userId: user.id,
    companyId: company.id,
    cleanup: async () => {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    },
  };
}

export async function createEmployee(companyId: string, specialty: Specialty, extra: { name?: string; specializationTopics?: string[] } = {}) {
  return prisma.employee.create({
    data: {
      companyId,
      name: extra.name ?? `${specialty} employee`,
      avatar: { palette: "a", hair: 1, skin: 1 },
      title: specialty,
      department: specialty,
      specialty,
      specializationTopics: extra.specializationTopics ?? [],
    },
  });
}
