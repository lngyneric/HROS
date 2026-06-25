import type { Router } from "express";
import { requireAuth } from "../../auth/auth.middleware.js";
import { prisma } from "../../db/prisma.js";
import { getVisibleOrgUnitIds } from "../../scope/scope.js";

export function mountStatsRoutes(router: Router) {
  router.get("/api/stats/headcount", requireAuth, async (req, res) => {
    if (req.user!.dataScope === "SELF") {
      if (!req.user!.employeeId) {
        res.json({ totalActive: 0 });
        return;
      }
      const emp = await prisma.employeeMaster.findUnique({ where: { id: req.user!.employeeId } });
      res.json({ totalActive: emp?.currentStatus === "ACTIVE" ? 1 : 0 });
      return;
    }

    const visible = await getVisibleOrgUnitIds(req.user!.id, req.user!.dataScope, req.user!.employeeId);
    const totalActive = await prisma.employeeMaster.count({
      where:
        visible === "ALL"
          ? { currentStatus: "ACTIVE" }
          : { currentStatus: "ACTIVE", jobAssignments: { some: { orgUnitId: { in: visible }, effectiveTo: null } } }
    });
    res.json({ totalActive });
  });

  router.get("/api/stats/distribution/departments", requireAuth, async (req, res) => {
    if (req.user!.dataScope === "SELF") {
      if (!req.user!.employeeId) {
        res.json({ totalActive: 0, distribution: {} });
        return;
      }
      const emp = await prisma.jobAssignment.findFirst({
        where: { employeeId: req.user!.employeeId, effectiveTo: null, employee: { is: { currentStatus: "ACTIVE" } } },
        include: { orgUnit: true }
      });
      if (!emp) {
        res.json({ totalActive: 0, distribution: {} });
        return;
      }
      res.json({ totalActive: 1, distribution: { [emp.orgUnit.orgName]: 1 } });
      return;
    }

    const visible = await getVisibleOrgUnitIds(req.user!.id, req.user!.dataScope, req.user!.employeeId);
    const distribution: Record<string, number> = {};
    let totalActive = 0;
    const assignments = await prisma.jobAssignment.findMany({
      where:
        visible === "ALL"
          ? { effectiveTo: null, employee: { is: { currentStatus: "ACTIVE" } } }
          : { effectiveTo: null, orgUnitId: { in: visible }, employee: { is: { currentStatus: "ACTIVE" } } },
      include: { orgUnit: true }
    });
    assignments.forEach((assignment) => {
      distribution[assignment.orgUnit.orgName] = (distribution[assignment.orgUnit.orgName] ?? 0) + 1;
      totalActive += 1;
    });
    res.json({ totalActive, distribution });
  });

  router.get("/api/stats/distribution/positions", requireAuth, async (req, res) => {
    if (req.user!.dataScope === "SELF") {
      if (!req.user!.employeeId) {
        res.json({ totalActive: 0, distribution: {} });
        return;
      }
      const emp = await prisma.jobAssignment.findFirst({
        where: { employeeId: req.user!.employeeId, effectiveTo: null, employee: { is: { currentStatus: "ACTIVE" } } },
        include: { position: true }
      });
      if (!emp) {
        res.json({ totalActive: 0, distribution: {} });
        return;
      }
      res.json({ totalActive: 1, distribution: { [emp.position.positionName]: 1 } });
      return;
    }

    const visible = await getVisibleOrgUnitIds(req.user!.id, req.user!.dataScope, req.user!.employeeId);
    const distribution: Record<string, number> = {};
    let totalActive = 0;
    const assignments = await prisma.jobAssignment.findMany({
      where:
        visible === "ALL"
          ? { effectiveTo: null, employee: { is: { currentStatus: "ACTIVE" } } }
          : { effectiveTo: null, orgUnitId: { in: visible }, employee: { is: { currentStatus: "ACTIVE" } } },
      include: { position: true }
    });
    assignments.forEach((assignment) => {
      distribution[assignment.position.positionName] = (distribution[assignment.position.positionName] ?? 0) + 1;
      totalActive += 1;
    });
    res.json({ totalActive, distribution });
  });
}
