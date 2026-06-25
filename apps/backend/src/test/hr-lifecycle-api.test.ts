import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../db/prisma.js";

const app = createApp();

let employeeToken = "";
let financeToken = "";

describe("hr lifecycle api", () => {
  beforeAll(async () => {
    const employeeLogin = await request(app).post("/api/auth/login").send({
      email: "employee@hros.local",
      password: "password12345"
    });
    const financeLogin = await request(app).post("/api/auth/login").send({
      email: "finance@hros.local",
      password: "password12345"
    });

    expect(employeeLogin.status).toBe(200);
    expect(financeLogin.status).toBe(200);

    employeeToken = employeeLogin.body.token;
    financeToken = financeLogin.body.token;
  });

  it("loads self-service onboarding and offboarding lists without 500", async () => {
    const onboardingRes = await request(app)
      .get("/api/onboarding-cases")
      .set("Authorization", `Bearer ${employeeToken}`);

    const offboardingRes = await request(app)
      .get("/api/offboarding-cases")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(onboardingRes.status).toBe(200);
    expect(Array.isArray(onboardingRes.body)).toBe(true);
    expect(offboardingRes.status).toBe(200);
    expect(Array.isArray(offboardingRes.body)).toBe(true);
  });

  it("creates an onboarding workflow draft and returns an action envelope", async () => {
    const idempotencyKey = `e2e-onboarding-create-${randomUUID()}`;

    const created = await request(app)
      .post("/api/onboarding-cases")
      .set("Authorization", `Bearer ${employeeToken}`)
      .set("x-idempotency-key", idempotencyKey)
      .send({});

    expect(created.status).toBe(200);
    expect(created.body.events.map((event: { eventType: string }) => event.eventType)).toEqual([
      "command_received",
      "input_validated",
      "state_transition_applied",
      "command_succeeded"
    ]);
    expect(created.body.result.success).toBe(true);
    expect(created.body.result.businessObjectType).toBe("workflow_instance");
    expect(created.body.result.nextActions).toContain("onboarding.submit");

    const workflowId = created.body.result.businessObjectId as string;

    const invocation = await prisma.actionInvocation.findUniqueOrThrow({
      where: { idempotencyKey },
      include: { result: true }
    });
    const workflow = await prisma.workflowInstance.findUniqueOrThrow({
      where: { id: workflowId },
      include: { events: true, tasks: true }
    });
    const auditEvent = await prisma.auditEvent.findFirstOrThrow({
      where: {
        entityType: "WorkflowInstance",
        entityId: workflowId,
        operation: "CREATE"
      },
      orderBy: { eventTime: "desc" }
    });

    expect(invocation.status).toBe("SUCCEEDED");
    expect(invocation.result?.businessObjectId).toBe(workflowId);
    expect(workflow.businessObjectType).toBe("onboarding_case");
    expect(workflow.status).toBe("DRAFT");
    expect(workflow.events.some((event) => event.eventType === "state_transition_applied")).toBe(true);
    expect(workflow.tasks[0]?.taskCode).toBe("onboarding.submit");
    expect(auditEvent.actorId).toBe("seed-employee");
  });

  it("archives an offboarding workflow through the api and persists artifact and audit state", async () => {
    const suffix = randomUUID();
    const employee = await prisma.employeeMaster.create({
      data: {
        employeeNo: `E2E-OFF-${suffix}`,
        fullName: "API 离职测试员工",
        workEmail: `api-offboarding-${suffix}@hros.local`,
        currentStatus: "ACTIVE"
      }
    });
    const workflowTemplate = await prisma.workflowTemplate.findUniqueOrThrow({
      where: { templateCode: "OFFBOARDING_STANDARD" }
    });
    const financeTaskTemplate = await prisma.workflowTaskTemplate.findFirstOrThrow({
      where: {
        templateId: workflowTemplate.id,
        taskCode: "offboarding.approve_finance"
      }
    });
    const workflow = await prisma.workflowInstance.create({
      data: {
        templateId: workflowTemplate.id,
        employeeId: employee.id,
        businessObjectType: "offboarding_case",
        businessObjectId: `e2e-offboarding-case-${suffix}`,
        status: "FINANCE_CONFIRM",
        initiatedBy: "seed-finance"
      }
    });

    await prisma.workflowTask.create({
      data: {
        workflowInstanceId: workflow.id,
        taskTemplateId: financeTaskTemplate.id,
        taskCode: financeTaskTemplate.taskCode,
        status: "FINANCE_CONFIRM",
        assigneeType: "user",
        assigneeId: "seed-finance"
      }
    });

    const archiveIdempotencyKey = `e2e-offboarding-archive-${suffix}`;

    const archived = await request(app)
      .post(`/api/offboarding-cases/${workflow.id}/archive`)
      .set("Authorization", `Bearer ${financeToken}`)
      .set("x-idempotency-key", archiveIdempotencyKey)
      .send({});

    expect(archived.status).toBe(200);
    expect(archived.body.events.map((event: { eventType: string }) => event.eventType)).toEqual([
      "command_received",
      "input_validated",
      "artifact_written",
      "state_transition_applied",
      "command_succeeded"
    ]);
    expect(archived.body.result.success).toBe(true);
    expect(archived.body.result.businessObjectId).toBe(workflow.id);
    expect(archived.body.result.artifacts).toHaveLength(1);
    expect(archived.body.result.artifacts[0]?.type).toBe("archive_snapshot");

    const invocation = await prisma.actionInvocation.findUniqueOrThrow({
      where: { idempotencyKey: archiveIdempotencyKey },
      include: { result: true }
    });
    const refreshed = await prisma.workflowInstance.findUniqueOrThrow({
      where: { id: workflow.id },
      include: {
        employee: true,
        tasks: {
          include: { artifacts: true },
          orderBy: { taskCode: "asc" }
        },
        events: true
      }
    });
    const auditEvent = await prisma.auditEvent.findFirstOrThrow({
      where: {
        entityType: "WorkflowInstance",
        entityId: workflow.id,
        operation: "ARCHIVE"
      },
      orderBy: { eventTime: "desc" }
    });

    expect(invocation.status).toBe("SUCCEEDED");
    expect(invocation.result?.businessObjectId).toBe(workflow.id);
    expect(refreshed.status).toBe("ARCHIVED");
    expect(refreshed.employee.currentStatus).toBe("OFFBOARDED");
    expect(refreshed.events.some((event) => event.eventType === "artifact_written")).toBe(true);
    expect(refreshed.events.some((event) => event.eventType === "state_transition_applied")).toBe(true);
    expect(refreshed.tasks.some((task) => task.taskCode === "offboarding.archive")).toBe(true);
    expect(refreshed.tasks.some((task) => task.artifacts.some((artifact) => artifact.artifactType === "archive_snapshot"))).toBe(true);
    expect(auditEvent.actorId).toBe("seed-finance");
  });
});
