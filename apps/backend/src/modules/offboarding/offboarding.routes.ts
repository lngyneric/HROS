import type { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAuth } from "../../auth/auth.middleware.js";
import { prisma } from "../../db/prisma.js";
import { requireRole } from "../../rbac/requireRole.js";
import { getVisibleOrgUnitIds } from "../../scope/scope.js";
import { writeAudit } from "../../audit/audit.js";
import { archiveOffboardingCase } from "./offboarding.actions.js";

const prismaCompat = prisma as typeof prisma & Record<string, any>;

function toOffboardingCaseView(item: {
  id: string;
  status: string;
  startedAt: Date;
  employeeId: string;
  employee: { id: string; employeeNo: string; fullName: string; currentStatus: string };
  tasks: Array<{
    id: string;
    taskCode: string;
    resultSummary: string | null;
    artifacts: Array<{ id: string; artifactType: string }>;
  }>;
}) {
  const archives = item.tasks.flatMap((task) =>
    task.artifacts
      .filter((artifact) => artifact.artifactType === "archive_snapshot")
      .map((artifact) => ({
        id: artifact.id,
        snapshotVersion: "1.0"
      }))
  );

  return {
    id: item.id,
    status: item.status,
    isLocked: item.status !== "DRAFT",
    createdAt: item.startedAt.toISOString(),
    plannedLastDay: null,
    resignationReason: null,
    employeeId: item.employeeId,
    employee: {
      id: item.employee.id,
      employeeNo: item.employee.employeeNo,
      fullName: item.employee.fullName,
      status: item.employee.currentStatus
    },
    items: item.tasks.map((task) => ({
      id: task.id,
      itemType: "workflow_task",
      title: task.taskCode,
      description: task.resultSummary,
      itemStatus: task.taskCode
    })),
    archives
  };
}

const CreateSchema = z.object({
  employeeId: z.string().uuid().optional(),
  plannedLastDay: z.coerce.date().optional(),
  resignationReason: z.string().optional()
});

const TransitionSchema = z.object({
  to: z.enum(["HR_REVIEW", "MANAGER_CONFIRM", "FINANCE_CONFIRM", "ARCHIVED", "CANCELLED"])
});

const LockSchema = z.object({
  reason: z.string().min(1).default("manual")
});

const AddItemSchema = z.object({
  itemType: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional()
});

async function assertEmployeeVisible(req: { user: { id: string; dataScope: string; employeeId: string | null } }, employeeId: string) {
  if (req.user.dataScope === "SELF") {
    if (req.user.employeeId !== employeeId) throw new Error("forbidden");
    return;
  }
  const visible = await getVisibleOrgUnitIds(req.user.id, req.user.dataScope, req.user.employeeId);
  if (visible === "ALL") return;
  const empEmployment = await prismaCompat.employment.findFirst({ where: { employeeId, effectiveTo: null } });
  if (!empEmployment) throw new Error("forbidden");
  if (!visible.includes(empEmployment.orgUnitId)) throw new Error("forbidden");
}

async function doArchive(params: { caseId: string; actorUserId: string }) {
  return prisma.$transaction(async (tx) => {
    const txCompat = tx as typeof tx & Record<string, any>;

    const c = await txCompat.offboardingCase.findUnique({
      where: { id: params.caseId },
      include: { employee: { include: { sensitive: true, employments: true } }, items: true }
    });
    if (!c) throw new Error("not_found");
    if (c.status !== "FINANCE_CONFIRM") throw new Error("invalid_state");

    const snapshotPayload = {
      employee: {
        id: c.employee.id,
        employeeNo: c.employee.employeeNo,
        name: c.employee.name,
        employments: c.employee.employments
      },
      offboarding: {
        id: c.id,
        plannedLastDay: c.plannedLastDay,
        resignationReason: c.resignationReason,
        items: c.items
      }
    };

    const archived = await txCompat.archiveSnapshot.create({
      data: {
        employeeId: c.employeeId,
        offboardingCaseId: c.id,
        snapshotVersion: "1.0",
        snapshotPayload
      }
    });

    await txCompat.employee.update({ where: { id: c.employeeId }, data: { status: "RESIGNED" } });

    const updatedCase = await txCompat.offboardingCase.update({
      where: { id: c.id },
      data: {
        status: "ARCHIVED",
        isLocked: true,
        lockedReason: "terminal",
        lockedAt: new Date(),
        lockedByUserId: params.actorUserId
      }
    });

    return { archived, updatedCase };
  });
}

export function mountOffboardingRoutes(router: Router) {
  router.get("/api/offboarding-cases", requireAuth, async (req, res) => {
    if (req.user!.dataScope === "SELF") {
      if (!req.user!.employeeId) {
        res.json([]);
        return;
      }
      const cases = await prisma.workflowInstance.findMany({
        where: {
          employeeId: req.user!.employeeId,
          businessObjectType: "offboarding_case"
        },
        include: {
          employee: true,
          tasks: {
            include: { artifacts: true },
            orderBy: { taskCode: "asc" }
          }
        },
        orderBy: { startedAt: "desc" }
      });
      res.json(cases.map(toOffboardingCaseView));
      return;
    }

    if (req.user!.role === "MANAGER") {
      const visible = await getVisibleOrgUnitIds(req.user!.id, req.user!.dataScope, req.user!.employeeId);
      const where =
        visible === "ALL"
          ? { businessObjectType: "offboarding_case" as const, status: "MANAGER_CONFIRM" as const }
          : {
              businessObjectType: "offboarding_case" as const,
              status: "MANAGER_CONFIRM" as const,
              employee: {
                jobAssignments: {
                  some: {
                    orgUnitId: { in: visible },
                    isPrimary: true,
                    effectiveTo: null
                  }
                }
              }
            };
      const cases = await prisma.workflowInstance.findMany({
        where,
        include: {
          employee: true,
          tasks: {
            include: { artifacts: true },
            orderBy: { taskCode: "asc" }
          }
        },
        orderBy: { startedAt: "desc" }
      });
      res.json(cases.map(toOffboardingCaseView));
      return;
    }

    if (req.user!.role === "PAYROLL_FINANCE") {
      const cases = await prisma.workflowInstance.findMany({
        where: {
          businessObjectType: "offboarding_case",
          status: "FINANCE_CONFIRM"
        },
        include: {
          employee: true,
          tasks: {
            include: { artifacts: true },
            orderBy: { taskCode: "asc" }
          }
        },
        orderBy: { startedAt: "desc" }
      });
      res.json(cases.map(toOffboardingCaseView));
      return;
    }

    const visible = await getVisibleOrgUnitIds(req.user!.id, req.user!.dataScope, req.user!.employeeId);
    const cases = await prisma.workflowInstance.findMany({
      where:
        visible === "ALL"
          ? { businessObjectType: "offboarding_case" }
          : {
              businessObjectType: "offboarding_case",
              employee: {
                jobAssignments: {
                  some: {
                    orgUnitId: { in: visible },
                    isPrimary: true,
                    effectiveTo: null
                  }
                }
              }
            },
      include: {
        employee: true,
        tasks: {
          include: { artifacts: true },
          orderBy: { taskCode: "asc" }
        }
      },
      orderBy: { startedAt: "desc" }
    });
    res.json(cases.map(toOffboardingCaseView));
  });

  router.post("/api/offboarding-cases", requireAuth, async (req, res) => {
    const body = CreateSchema.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "bad_request" });
      return;
    }

    const employeeId = req.user!.dataScope === "SELF" ? req.user!.employeeId : body.data.employeeId;
    if (!employeeId) {
      res.status(400).json({ error: "employee_required" });
      return;
    }

    try {
      await assertEmployeeVisible({ user: req.user! }, employeeId);
    } catch {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const created = await prismaCompat.offboardingCase.create({
      data: {
        employeeId,
        requesterUserId: req.user!.id,
        status: "DRAFT",
        isLocked: false,
        plannedLastDay: body.data.plannedLastDay,
        resignationReason: body.data.resignationReason
      },
      include: { employee: true, items: true }
    });

    res.json(created);
  });

  router.post("/api/offboarding-cases/:id/submit", requireAuth, async (req, res) => {
    const c = await prismaCompat.offboardingCase.findUnique({ where: { id: req.params.id } });
    if (!c) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    try {
      await assertEmployeeVisible({ user: req.user! }, c.employeeId);
    } catch {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    if (c.status !== "DRAFT") {
      res.status(409).json({ error: "invalid_state" });
      return;
    }
    const updated = await prismaCompat.offboardingCase.update({
      where: { id: c.id },
      data: {
        status: "SUBMITTED",
        isLocked: true,
        lockedReason: "submitted",
        lockedAt: new Date(),
        lockedByUserId: req.user!.id
      },
      include: { employee: true, items: true }
    });
    await writeAudit({
      actorUserId: req.user!.id,
      action: "TRANSITION",
      resourceType: "OffboardingCase",
      resourceId: updated.id,
      fieldClassification: "PUBLIC",
      metadata: { from: "DRAFT", to: "SUBMITTED" }
    });
    res.json(updated);
  });

  router.post("/api/offboarding-cases/:id/transition", requireAuth, async (req, res) => {
    const body = TransitionSchema.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "bad_request" });
      return;
    }

    const to = body.data.to;
    const role = req.user!.role;

    if (to === "ARCHIVED") {
      const allowed = role === "ADMIN" || role === "PAYROLL_FINANCE";
      if (!allowed) {
        res.status(409).json({ error: "invalid_transition" });
        return;
      }

      try {
        const action = await archiveOffboardingCase({
          workflowInstanceId: req.params.id,
          actorUserId: req.user!.id,
          actorType: "user",
          requestId: randomUUID(),
          idempotencyKey: req.header("x-idempotency-key") ?? randomUUID()
        });

        res.json(action);
      } catch {
        res.status(409).json({ error: "invalid_state" });
      }
      return;
    }

    const c = await prismaCompat.offboardingCase.findUnique({ where: { id: req.params.id } });
    if (!c) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    try {
      await assertEmployeeVisible({ user: req.user! }, c.employeeId);
    } catch {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const from = c.status;

    const allowed =
      (from === "SUBMITTED" && to === "HR_REVIEW" && (role === "ADMIN" || role === "HRBP" || role === "HR_SPECIALIST")) ||
      (from === "HR_REVIEW" && to === "MANAGER_CONFIRM" && (role === "ADMIN" || role === "HRBP" || role === "HR_SPECIALIST")) ||
      (from === "MANAGER_CONFIRM" && to === "FINANCE_CONFIRM" && (role === "ADMIN" || role === "MANAGER")) ||
      (to === "CANCELLED" && from !== "ARCHIVED" && role !== "EMPLOYEE_SELF");

    if (!allowed) {
      res.status(409).json({ error: "invalid_transition" });
      return;
    }

    const updateData: any = { status: to };
    updateData.isLocked = true;
    updateData.lockedReason = to.toLowerCase();
    updateData.lockedAt = new Date();
    updateData.lockedByUserId = req.user!.id;

    const updated = await prismaCompat.offboardingCase.update({
      where: { id: c.id },
      data: updateData,
      include: { employee: true, items: true }
    });

    await writeAudit({
      actorUserId: req.user!.id,
      action: "TRANSITION",
      resourceType: "OffboardingCase",
      resourceId: updated.id,
      fieldClassification: "PUBLIC",
      metadata: { from, to }
    });

    res.json(updated);
  });

  router.post(
    "/api/offboarding-cases/:id/unlock",
    requireAuth,
    requireRole(["ADMIN", "HR_SPECIALIST"]),
    async (req, res) => {
      const c = await prismaCompat.offboardingCase.findUnique({ where: { id: req.params.id } });
      if (!c) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (c.status === "ARCHIVED" || c.status === "CANCELLED") {
        res.status(409).json({ error: "invalid_state" });
        return;
      }
      if (c.status === "DRAFT") {
        res.status(409).json({ error: "invalid_state" });
        return;
      }
      const updated = await prismaCompat.offboardingCase.update({
        where: { id: c.id },
        data: {
          isLocked: false,
          lastUnlockedAt: new Date(),
          lastUnlockedByUserId: req.user!.id,
          unlockReason: "manual"
        },
        include: { employee: true, items: true }
      });
      await writeAudit({
        actorUserId: req.user!.id,
        action: "UNLOCK",
        resourceType: "OffboardingCase",
        resourceId: updated.id,
        fieldClassification: "PUBLIC",
        metadata: { status: updated.status }
      });
      res.json(updated);
    }
  );

  router.post(
    "/api/offboarding-cases/:id/lock",
    requireAuth,
    requireRole(["ADMIN", "HR_SPECIALIST"]),
    async (req, res) => {
      const body = LockSchema.safeParse(req.body ?? {});
      if (!body.success) {
        res.status(400).json({ error: "bad_request" });
        return;
      }
      const c = await prismaCompat.offboardingCase.findUnique({ where: { id: req.params.id } });
      if (!c) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const updated = await prismaCompat.offboardingCase.update({
        where: { id: c.id },
        data: {
          isLocked: true,
          lockedReason: body.data.reason,
          lockedAt: new Date(),
          lockedByUserId: req.user!.id
        },
        include: { employee: true, items: true }
      });
      await writeAudit({
        actorUserId: req.user!.id,
        action: "LOCK",
        resourceType: "OffboardingCase",
        resourceId: updated.id,
        fieldClassification: "PUBLIC",
        metadata: { status: updated.status, reason: body.data.reason }
      });
      res.json(updated);
    }
  );

  router.post("/api/offboarding-cases/:id/archive", requireAuth, requireRole(["ADMIN", "PAYROLL_FINANCE"]), async (req, res) => {
    try {
      const action = await archiveOffboardingCase({
        workflowInstanceId: req.params.id,
        actorUserId: req.user!.id,
        actorType: "user",
        requestId: randomUUID(),
        idempotencyKey: req.header("x-idempotency-key") ?? randomUUID()
      });

      res.json(action);
    } catch {
      res.status(409).json({ error: "invalid_state" });
    }
  });

  router.post("/api/offboarding-cases/:id/items", requireAuth, async (req, res) => {
    const body = AddItemSchema.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "bad_request" });
      return;
    }
    const c = await prismaCompat.offboardingCase.findUnique({ where: { id: req.params.id } });
    if (!c) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    try {
      await assertEmployeeVisible({ user: req.user! }, c.employeeId);
    } catch {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    if (c.isLocked) {
      res.status(409).json({ error: "locked" });
      return;
    }
    if (req.user!.role === "EMPLOYEE_SELF" && req.user!.employeeId !== c.employeeId) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const item = await prismaCompat.caseItem.create({
      data: {
        caseType: "OFFBOARDING",
        offboardingCaseId: c.id,
        itemType: body.data.itemType,
        title: body.data.title,
        description: body.data.description,
        itemStatus: "pending"
      }
    });
    await writeAudit({
      actorUserId: req.user!.id,
      action: "UPDATE",
      resourceType: "OffboardingCase",
      resourceId: c.id,
      fieldClassification: "PUBLIC",
      metadata: { addItemId: item.id }
    });
    res.json(item);
  });
}
