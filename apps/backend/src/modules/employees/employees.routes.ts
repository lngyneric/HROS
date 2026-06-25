import type { Router } from "express";
import { requireAuth } from "../../auth/auth.middleware.js";
import { prisma } from "../../db/prisma.js";
import { getVisibleOrgUnitIds } from "../../scope/scope.js";
import { EmployeeFieldPolicy, EmployeeSensitiveFieldPolicy } from "../../field-policy/classification.js";
import { filterByPolicy } from "../../field-policy/filter.js";
import { writeAudit } from "../../audit/audit.js";

export function mountEmployeeRoutes(router: Router) {
  router.get("/api/employees", requireAuth, async (req, res) => {
    if (req.user!.dataScope === "SELF") {
      if (!req.user!.employeeId) {
        res.json([]);
        return;
      }
      const emp = await prisma.employeeMaster.findUnique({ where: { id: req.user!.employeeId } });
      res.json(
        emp
          ? [
              filterByPolicy(
                {
                  id: emp.id,
                  employeeNo: emp.employeeNo,
                  name: emp.fullName,
                  status: emp.currentStatus
                },
                EmployeeFieldPolicy,
                req.user!.role
              )
            ]
          : []
      );
      return;
    }

    const visible = await getVisibleOrgUnitIds(req.user!.id, req.user!.dataScope, req.user!.employeeId);
    const employees = await prisma.employeeMaster.findMany({
      where: visible === "ALL" ? {} : { jobAssignments: { some: { orgUnitId: { in: visible }, effectiveTo: null } } },
      orderBy: { employeeNo: "asc" }
    });
    res.json(
      employees.map((e) =>
        filterByPolicy(
          {
            id: e.id,
            employeeNo: e.employeeNo,
            name: e.fullName,
            status: e.currentStatus
          },
          EmployeeFieldPolicy,
          req.user!.role
        )
      )
    );
  });

  router.get("/api/employees/:id", requireAuth, async (req, res) => {
    const emp = await prisma.employeeMaster.findUnique({
      where: { id: req.params.id },
      include: { identityPrivate: true, jobAssignments: true }
    });
    if (!emp) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    if (req.user!.dataScope === "SELF" && req.user!.employeeId !== emp.id) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    if (req.user!.dataScope !== "SELF") {
      const visible = await getVisibleOrgUnitIds(req.user!.id, req.user!.dataScope, req.user!.employeeId);
      if (visible !== "ALL") {
        const current = emp.jobAssignments.find((x) => x.effectiveTo === null);
        if (current && !visible.includes(current.orgUnitId)) {
          res.status(403).json({ error: "forbidden" });
          return;
        }
      }
    }

    const payload: any = {
      ...filterByPolicy(
        {
          id: emp.id,
          employeeNo: emp.employeeNo,
          name: emp.fullName,
          status: emp.currentStatus
        },
        EmployeeFieldPolicy,
        req.user!.role
      ),
      sensitive: emp.identityPrivate
        ? filterByPolicy(
            {
              employeeId: emp.id,
              idNumber: emp.identityPrivate.idNumberEncrypted,
              phone: emp.mobilePhone,
              address: emp.identityPrivate.addressEncrypted,
              bankAccount: undefined
            },
            EmployeeSensitiveFieldPolicy,
            req.user!.role
          )
        : null
    };

    if (payload.sensitive && Object.keys(payload.sensitive).length > 0) {
      await writeAudit({
        actorUserId: req.user!.id,
        action: "READ_SENSITIVE",
        resourceType: "Employee",
        resourceId: emp.id,
        fieldClassification: "SENSITIVE",
        metadata: { fields: Object.keys(payload.sensitive) }
      });
    }

    res.json(payload);
  });
}
