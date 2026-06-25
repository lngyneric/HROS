import { randomUUID } from "node:crypto";
import type { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../auth/auth.middleware.js";
import { prisma } from "../../db/prisma.js";
import { requireRole } from "../../rbac/requireRole.js";
import { getVisibleOrgUnitIds } from "../../scope/scope.js";
import { writeAudit } from "../../audit/audit.js";
import { createOnboardingDraft } from "./onboarding.actions.js";

const prismaCompat = prisma as typeof prisma & Record<string, any>;

function toOnboardingCaseView(item: {
  id: string;
  status: string;
  startedAt: Date;
  employeeId: string;
  employee: { id: string; employeeNo: string; fullName: string; currentStatus: string };
  tasks: Array<{ id: string; taskCode: string; resultSummary: string | null }>;
}) {
  return {
    id: item.id,
    status: item.status,
    isLocked: item.status !== "DRAFT",
    createdAt: item.startedAt.toISOString(),
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
    }))
  };
}

const CreateSchema = z.object({
  employeeId: z.string().uuid().optional()
});

const TransitionSchema = z.object({
  to: z.enum(["HR_REVIEW", "MANAGER_CONFIRM", "COMPLETED", "CANCELLED"])
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
  const assignment = await prisma.jobAssignment.findFirst({
    where: {
      employeeId,
      isPrimary: true,
      effectiveTo: null
    },
    orderBy: { effectiveFrom: "desc" }
  });
  if (!assignment) throw new Error("forbidden");
  if (!visible.includes(assignment.orgUnitId)) throw new Error("forbidden");
}

export function mountOnboardingRoutes(router: Router) {
  router.get("/api/onboarding-cases", requireAuth, async (req, res) => {
    if (req.user!.dataScope === "SELF") {
      if (!req.user!.employeeId) {
        res.json([]);
        return;
      }
      const cases = await prisma.workflowInstance.findMany({
        where: {
          employeeId: req.user!.employeeId,
          businessObjectType: "onboarding_case"
        },
        include: {
          employee: true,
          tasks: {
            orderBy: { taskCode: "asc" }
          }
        },
        orderBy: { startedAt: "desc" }
      });
      res.json(cases.map(toOnboardingCaseView));
      return;
    }

    if (req.user!.role === "MANAGER") {
      const visible = await getVisibleOrgUnitIds(req.user!.id, req.user!.dataScope, req.user!.employeeId);
      if (visible === "ALL") {
        const cases = await prisma.workflowInstance.findMany({
          where: {
            businessObjectType: "onboarding_case",
            status: "MANAGER_CONFIRM"
          },
          include: {
            employee: true,
            tasks: {
              orderBy: { taskCode: "asc" }
            }
          },
          orderBy: { startedAt: "desc" }
        });
        res.json(cases.map(toOnboardingCaseView));
        return;
      }
      const cases = await prisma.workflowInstance.findMany({
        where: {
          businessObjectType: "onboarding_case",
          status: "MANAGER_CONFIRM",
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
            orderBy: { taskCode: "asc" }
          }
        },
        orderBy: { startedAt: "desc" }
      });
      res.json(cases.map(toOnboardingCaseView));
      return;
    }

    const visible = await getVisibleOrgUnitIds(req.user!.id, req.user!.dataScope, req.user!.employeeId);
    const cases = await prisma.workflowInstance.findMany({
      where:
        visible === "ALL"
          ? { businessObjectType: "onboarding_case" }
          : {
              businessObjectType: "onboarding_case",
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
          orderBy: { taskCode: "asc" }
        }
      },
      orderBy: { startedAt: "desc" }
    });
    res.json(cases.map(toOnboardingCaseView));
  });

  router.post("/api/onboarding-cases", requireAuth, async (req, res) => {
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

    const action = await createOnboardingDraft({
      actorUserId: req.user!.id,
      actorType: "user",
      employeeId,
      requestId: randomUUID(),
      idempotencyKey: req.header("x-idempotency-key") ?? randomUUID()
    });

    res.json(action);
  });

  router.post("/api/onboarding-cases/:id/submit", requireAuth, async (req, res) => {
    const c = await prismaCompat.onboardingCase.findUnique({ where: { id: req.params.id } });
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
    const updated = await prismaCompat.onboardingCase.update({
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
      resourceType: "OnboardingCase",
      resourceId: updated.id,
      fieldClassification: "PUBLIC",
      metadata: { from: "DRAFT", to: "SUBMITTED" }
    });
    res.json(updated);
  });

  router.post("/api/onboarding-cases/:id/transition", requireAuth, async (req, res) => {
    const body = TransitionSchema.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "bad_request" });
      return;
    }

    const c = await prismaCompat.onboardingCase.findUnique({ where: { id: req.params.id } });
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

    const to = body.data.to;
    const from = c.status;
    const role = req.user!.role;

    const allowed =
      (from === "SUBMITTED" && to === "HR_REVIEW" && (role === "ADMIN" || role === "HRBP" || role === "HR_SPECIALIST")) ||
      (from === "HR_REVIEW" && to === "MANAGER_CONFIRM" && (role === "ADMIN" || role === "HRBP" || role === "HR_SPECIALIST")) ||
      (from === "MANAGER_CONFIRM" && to === "COMPLETED" && (role === "ADMIN" || role === "MANAGER")) ||
      (to === "CANCELLED" && from !== "COMPLETED" && role !== "EMPLOYEE_SELF");

    if (!allowed) {
      res.status(409).json({ error: "invalid_transition" });
      return;
    }

    const updateData: any = { status: to };
    if (to === "COMPLETED" || to === "CANCELLED") {
      updateData.isLocked = true;
      updateData.lockedReason = "terminal";
      updateData.lockedAt = new Date();
      updateData.lockedByUserId = req.user!.id;
    } else {
      updateData.isLocked = true;
      updateData.lockedReason = to.toLowerCase();
      updateData.lockedAt = new Date();
      updateData.lockedByUserId = req.user!.id;
    }

    const updated = await prismaCompat.onboardingCase.update({
      where: { id: c.id },
      data: updateData,
      include: { employee: true, items: true }
    });

    await writeAudit({
      actorUserId: req.user!.id,
      action: "TRANSITION",
      resourceType: "OnboardingCase",
      resourceId: updated.id,
      fieldClassification: "PUBLIC",
      metadata: { from, to }
    });

    res.json(updated);
  });

  router.post(
    "/api/onboarding-cases/:id/unlock",
    requireAuth,
    requireRole(["ADMIN", "HR_SPECIALIST"]),
    async (req, res) => {
      const c = await prismaCompat.onboardingCase.findUnique({ where: { id: req.params.id } });
      if (!c) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (c.status === "COMPLETED" || c.status === "CANCELLED") {
        res.status(409).json({ error: "invalid_state" });
        return;
      }
      if (c.status === "DRAFT") {
        res.status(409).json({ error: "invalid_state" });
        return;
      }
      const updated = await prismaCompat.onboardingCase.update({
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
        resourceType: "OnboardingCase",
        resourceId: updated.id,
        fieldClassification: "PUBLIC",
        metadata: { status: updated.status }
      });
      res.json(updated);
    }
  );

  router.post(
    "/api/onboarding-cases/:id/lock",
    requireAuth,
    requireRole(["ADMIN", "HR_SPECIALIST"]),
    async (req, res) => {
      const body = LockSchema.safeParse(req.body ?? {});
      if (!body.success) {
        res.status(400).json({ error: "bad_request" });
        return;
      }
      const c = await prismaCompat.onboardingCase.findUnique({ where: { id: req.params.id } });
      if (!c) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const updated = await prismaCompat.onboardingCase.update({
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
        resourceType: "OnboardingCase",
        resourceId: updated.id,
        fieldClassification: "PUBLIC",
        metadata: { status: updated.status, reason: body.data.reason }
      });
      res.json(updated);
    }
  );

  router.post("/api/onboarding-cases/:id/items", requireAuth, async (req, res) => {
    const body = AddItemSchema.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "bad_request" });
      return;
    }
    const c = await prismaCompat.onboardingCase.findUnique({ where: { id: req.params.id } });
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
        caseType: "ONBOARDING",
        onboardingCaseId: c.id,
        itemType: body.data.itemType,
        title: body.data.title,
        description: body.data.description,
        itemStatus: "pending"
      }
    });
    await writeAudit({
      actorUserId: req.user!.id,
      action: "UPDATE",
      resourceType: "OnboardingCase",
      resourceId: c.id,
      fieldClassification: "PUBLIC",
      metadata: { addItemId: item.id }
    });
    res.json(item);
  });
}
