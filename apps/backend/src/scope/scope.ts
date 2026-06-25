import { prisma } from "../db/prisma.js";

export async function getVisibleOrgUnitIds(userId: string, dataScope: string, employeeId: string | null): Promise<string[] | "ALL"> {
  void userId;

  if (dataScope === "ALL") return "ALL";
  if (dataScope === "SELF") return [];

  const ids = new Set<string>();

  if (dataScope === "ORG_TREE") {
    const rows = await prisma.orgUnit.findMany({ select: { id: true } });
    rows.forEach((x) => ids.add(x.id));
    return [...ids];
  }

  if (dataScope === "DEPT_TREE") {
    if (!employeeId) return [];
    const assignment = await prisma.jobAssignment.findFirst({
      where: { employeeId, isPrimary: true, effectiveTo: null }
    });
    if (!assignment) return [];

    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `WITH RECURSIVE t AS (
         SELECT id FROM "OrgUnit" WHERE id = $1
         UNION ALL
         SELECT o.id FROM "OrgUnit" o JOIN t ON o."parentOrgId" = t.id
       ) SELECT id FROM t`,
      assignment.orgUnitId
    );
    rows.forEach((x) => ids.add(x.id));
    return [...ids];
  }

  return [];
}
