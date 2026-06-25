import { randomUUID } from "node:crypto";
import type { RoleCode, WorkflowStatus } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { writeAuditEvent } from "../../audit/audit.js";
import { createActionRun } from "../actions/action-runner.js";

type CreateOffboardingDraftInput = {
  actorUserId: string;
  actorType: string;
  employeeId: string;
  plannedLastDay?: string;
  resignationReason?: string;
  requestId: string;
  idempotencyKey: string;
};

type OffboardingTransitionInput = {
  workflowInstanceId: string;
  actorUserId: string;
  actorType: string;
  actorRole: RoleCode;
  requestId: string;
  idempotencyKey: string;
};

type OffboardingTransitionConfig = {
  actionCode:
    | "offboarding.submit"
    | "offboarding.approve_hr"
    | "offboarding.approve_manager"
    | "offboarding.approve_finance";
  allowedActorRoles: RoleCode[];
  fromStatuses: WorkflowStatus[];
  toStatus: WorkflowStatus;
  currentTaskCode: string;
  nextTaskCode?: string;
  auditOperation: "SUBMIT" | "APPROVE_HR" | "APPROVE_MANAGER" | "APPROVE_FINANCE";
  nextActions: string[];
  currentTaskResultSummary: string;
};

type ArchiveOffboardingCaseInput = {
  workflowInstanceId: string;
  actorUserId: string;
  actorType: string;
  requestId: string;
  idempotencyKey: string;
};

const OFFBOARDING_TEMPLATE_CODE = "OFFBOARDING_STANDARD";
const OFFBOARDING_SUBMIT_TASK_CODE = "offboarding.submit";
const OFFBOARDING_APPROVE_HR_TASK_CODE = "offboarding.approve_hr";
const OFFBOARDING_APPROVE_MANAGER_TASK_CODE = "offboarding.approve_manager";
const OFFBOARDING_APPROVE_FINANCE_TASK_CODE = "offboarding.approve_finance";
const OFFBOARDING_ARCHIVE_TASK_CODE = "offboarding.archive";

function assertActorRole(actorRole: RoleCode, allowedActorRoles: RoleCode[]) {
  if (!allowedActorRoles.includes(actorRole)) {
    throw new Error("forbidden");
  }
}

async function resolveTaskTemplate(input: {
  templateId: string;
  taskCode: string;
}) {
  return prisma.workflowTaskTemplate.findFirstOrThrow({
    where: {
      templateId: input.templateId,
      taskCode: input.taskCode
    }
  });
}

function buildNextTaskAssignment(input: {
  requiredRole: string | null;
  fallbackActorId: string;
}) {
  if (input.requiredRole) {
    return {
      assigneeType: "role",
      assigneeId: input.requiredRole
    };
  }

  return {
    assigneeType: "user",
    assigneeId: input.fallbackActorId
  };
}

async function updateEmploymentTermination(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  input: Pick<CreateOffboardingDraftInput, "employeeId" | "plannedLastDay" | "resignationReason">
) {
  if (!input.plannedLastDay && !input.resignationReason) {
    return null;
  }

  const employment = await tx.employmentRelationship.findFirst({
    where: { employeeId: input.employeeId },
    orderBy: { startDate: "desc" }
  });

  if (!employment) {
    return null;
  }

  return tx.employmentRelationship.update({
    where: { id: employment.id },
    data: {
      ...(input.plannedLastDay
        ? {
            terminationDate: new Date(`${input.plannedLastDay}T00:00:00.000Z`)
          }
        : {}),
      ...(input.resignationReason
        ? {
            terminationReasonCode: input.resignationReason
          }
        : {})
    }
  });
}

async function executeOffboardingTransition(
  input: OffboardingTransitionInput,
  config: OffboardingTransitionConfig
) {
  const actionDefinition = await prisma.actionDefinition.findUniqueOrThrow({
    where: { actionCode: config.actionCode }
  });

  return createActionRun({
    actionCode: config.actionCode,
    actorType: input.actorType,
    actorId: input.actorUserId,
    input: {
      workflowInstanceId: input.workflowInstanceId,
      requestId: input.requestId
    },
    execute: async ({ emit }) => {
      emit("input_validated", "ok", {
        workflowInstanceId: input.workflowInstanceId
      });

      assertActorRole(input.actorRole, config.allowedActorRoles);

      const workflow = await prisma.workflowInstance.findUniqueOrThrow({
        where: { id: input.workflowInstanceId },
        include: {
          tasks: {
            orderBy: { taskCode: "asc" }
          }
        }
      });

      if (workflow.businessObjectType !== "offboarding_case") {
        throw new Error("not_found");
      }

      if (!config.fromStatuses.includes(workflow.status)) {
        throw new Error("invalid_state");
      }

      const [currentTaskTemplate, nextTaskTemplate] = await Promise.all([
        resolveTaskTemplate({
          templateId: workflow.templateId,
          taskCode: config.currentTaskCode
        }),
        config.nextTaskCode
          ? resolveTaskTemplate({
              templateId: workflow.templateId,
              taskCode: config.nextTaskCode
            })
          : Promise.resolve(null)
      ]);

      const now = new Date();

      const transitioned = await prisma.$transaction(async (tx) => {
        const invocation = await tx.actionInvocation.create({
          data: {
            actionDefinitionId: actionDefinition.id,
            requestId: input.requestId,
            idempotencyKey: input.idempotencyKey,
            actorType: input.actorType,
            actorId: input.actorUserId,
            channel: "api",
            inputPayloadJson: {
              workflowInstanceId: input.workflowInstanceId
            },
            status: "RUNNING"
          }
        });

        const existingCurrentTask = await tx.workflowTask.findFirst({
          where: {
            workflowInstanceId: workflow.id,
            taskCode: config.currentTaskCode
          }
        });

        const completedTask = existingCurrentTask
          ? await tx.workflowTask.update({
              where: { id: existingCurrentTask.id },
              data: {
                status: config.toStatus,
                assigneeType: "user",
                assigneeId: input.actorUserId,
                startedAt: existingCurrentTask.startedAt ?? now,
                completedAt: now,
                resultSummary: config.currentTaskResultSummary
              }
            })
          : await tx.workflowTask.create({
              data: {
                id: randomUUID(),
                workflowInstanceId: workflow.id,
                taskTemplateId: currentTaskTemplate.id,
                taskCode: currentTaskTemplate.taskCode,
                status: config.toStatus,
                assigneeType: "user",
                assigneeId: input.actorUserId,
                startedAt: now,
                completedAt: now,
                resultSummary: config.currentTaskResultSummary
              }
            });

        const updatedWorkflow = await tx.workflowInstance.update({
          where: { id: workflow.id },
          data: {
            status: config.toStatus,
            completedAt: null
          }
        });

        const nextTask =
          nextTaskTemplate === null
            ? null
            : await (async () => {
                const existingNextTask = await tx.workflowTask.findFirst({
                  where: {
                    workflowInstanceId: workflow.id,
                    taskCode: nextTaskTemplate.taskCode
                  }
                });

                const assignment = buildNextTaskAssignment({
                  requiredRole: nextTaskTemplate.requiredRole,
                  fallbackActorId: input.actorUserId
                });

                if (existingNextTask) {
                  return tx.workflowTask.update({
                    where: { id: existingNextTask.id },
                    data: {
                      status: config.toStatus,
                      assigneeType: assignment.assigneeType,
                      assigneeId: assignment.assigneeId,
                      startedAt: existingNextTask.startedAt ?? null,
                      completedAt: null,
                      resultSummary: null
                    }
                  });
                }

                return tx.workflowTask.create({
                  data: {
                    id: randomUUID(),
                    workflowInstanceId: workflow.id,
                    taskTemplateId: nextTaskTemplate.id,
                    taskCode: nextTaskTemplate.taskCode,
                    status: config.toStatus,
                    assigneeType: assignment.assigneeType,
                    assigneeId: assignment.assigneeId
                  }
                });
              })();

        await tx.workflowEvent.createMany({
          data: [
            {
              workflowInstanceId: workflow.id,
              taskId: completedTask.id,
              eventType: "command_received",
              eventPayloadJson: {
                actionCode: config.actionCode,
                requestId: input.requestId
              }
            },
            {
              workflowInstanceId: workflow.id,
              taskId: completedTask.id,
              eventType: "state_transition_applied",
              eventPayloadJson: {
                fromStatus: workflow.status,
                status: updatedWorkflow.status,
                completedTaskCode: completedTask.taskCode,
                nextTaskCode: nextTask?.taskCode ?? null
              }
            }
          ]
        });

        await tx.actionResult.create({
          data: {
            invocationId: invocation.id,
            success: true,
            businessObjectType: "workflow_instance",
            businessObjectId: workflow.id,
            outputPayloadJson: {
              workflowInstanceId: workflow.id,
              taskId: completedTask.id,
              nextTaskId: nextTask?.id ?? null,
              workflowStatus: updatedWorkflow.status
            }
          }
        });

        await tx.actionInvocation.update({
          where: { id: invocation.id },
          data: {
            status: "SUCCEEDED",
            finishedAt: now
          }
        });

        await writeAuditEvent(
          {
            actorType: input.actorType,
            actorId: input.actorUserId,
            entityType: "WorkflowInstance",
            entityId: workflow.id,
            operation: config.auditOperation,
            beforeJson: {
              status: workflow.status,
              taskCode: completedTask.taskCode
            },
            afterJson: {
              status: updatedWorkflow.status,
              completedTaskCode: completedTask.taskCode,
              nextTaskCode: nextTask?.taskCode ?? null
            },
            requestId: input.requestId
          },
          tx
        );

        return {
          completedTask,
          nextTask,
          updatedWorkflow
        };
      });

      emit("state_transition_applied", "ok", {
        workflowInstanceId: workflow.id,
        fromStatus: workflow.status,
        status: transitioned.updatedWorkflow.status,
        completedTaskCode: transitioned.completedTask.taskCode,
        nextTaskCode: transitioned.nextTask?.taskCode ?? null
      });

      return {
        success: true,
        businessObjectType: "workflow_instance",
        businessObjectId: workflow.id,
        nextActions: config.nextActions,
        artifacts: []
      };
    }
  });
}

export async function createOffboardingDraft(input: CreateOffboardingDraftInput) {
  const [actionDefinition, workflowTemplate, firstStage] = await Promise.all([
    prisma.actionDefinition.findUniqueOrThrow({
      where: { actionCode: "offboarding.create" }
    }),
    prisma.workflowTemplate.findUniqueOrThrow({
      where: { templateCode: OFFBOARDING_TEMPLATE_CODE }
    }),
    prisma.workflowStage.findFirstOrThrow({
      where: {
        template: {
          templateCode: OFFBOARDING_TEMPLATE_CODE
        }
      },
      include: {
        taskTemplates: {
          orderBy: { taskCode: "asc" }
        }
      },
      orderBy: { stageOrder: "asc" }
    })
  ]);

  const firstTaskTemplate = firstStage.taskTemplates[0];

  if (!firstTaskTemplate) {
    throw new Error("missing_offboarding_task_template");
  }

  return createActionRun({
    actionCode: "offboarding.create",
    actorType: input.actorType,
    actorId: input.actorUserId,
    input: {
      employeeId: input.employeeId,
      plannedLastDay: input.plannedLastDay ?? null,
      resignationReason: input.resignationReason ?? null,
      requestId: input.requestId
    },
    execute: async ({ emit }) => {
      emit("input_validated", "ok", {
        employeeId: input.employeeId,
        plannedLastDay: input.plannedLastDay ?? null,
        resignationReason: input.resignationReason ?? null
      });

      const workflowId = randomUUID();
      const taskId = randomUUID();
      const finishedAt = new Date();

      const created = await prisma.$transaction(async (tx) => {
        const invocation = await tx.actionInvocation.create({
          data: {
            actionDefinitionId: actionDefinition.id,
            requestId: input.requestId,
            idempotencyKey: input.idempotencyKey,
            actorType: input.actorType,
            actorId: input.actorUserId,
            channel: "api",
            inputPayloadJson: {
              employeeId: input.employeeId,
              plannedLastDay: input.plannedLastDay ?? null,
              resignationReason: input.resignationReason ?? null
            },
            status: "RUNNING"
          }
        });

        const employment = await updateEmploymentTermination(tx, input);

        const workflow = await tx.workflowInstance.create({
          data: {
            id: workflowId,
            templateId: workflowTemplate.id,
            employeeId: input.employeeId,
            businessObjectType: "offboarding_case",
            businessObjectId: workflowId,
            status: "DRAFT",
            initiatedBy: input.actorUserId
          }
        });

        const task = await tx.workflowTask.create({
          data: {
            id: taskId,
            workflowInstanceId: workflow.id,
            taskTemplateId: firstTaskTemplate.id,
            taskCode: firstTaskTemplate.taskCode,
            status: "DRAFT",
            assigneeType: "user",
            assigneeId: input.actorUserId
          }
        });

        await tx.workflowEvent.createMany({
          data: [
            {
              workflowInstanceId: workflow.id,
              taskId: task.id,
              eventType: "command_received",
              eventPayloadJson: {
                actionCode: "offboarding.create",
                requestId: input.requestId
              }
            },
            {
              workflowInstanceId: workflow.id,
              taskId: task.id,
              eventType: "state_transition_applied",
              eventPayloadJson: {
                status: workflow.status,
                taskCode: task.taskCode
              }
            }
          ]
        });

        await tx.actionResult.create({
          data: {
            invocationId: invocation.id,
            success: true,
            businessObjectType: "workflow_instance",
            businessObjectId: workflow.id,
            outputPayloadJson: {
              workflowInstanceId: workflow.id,
              taskId: task.id,
              workflowStatus: workflow.status
            }
          }
        });

        await tx.actionInvocation.update({
          where: { id: invocation.id },
          data: {
            status: "SUCCEEDED",
            finishedAt
          }
        });

        await writeAuditEvent(
          {
            actorType: input.actorType,
            actorId: input.actorUserId,
            entityType: "WorkflowInstance",
            entityId: workflow.id,
            operation: "CREATE",
            afterJson: {
              status: workflow.status,
              taskCode: task.taskCode,
              employeeId: input.employeeId,
              plannedLastDay: input.plannedLastDay ?? null,
              resignationReason: input.resignationReason ?? null,
              employmentRelationshipId: employment?.id ?? null
            },
            requestId: input.requestId
          },
          tx
        );

        return { workflow, task };
      });

      emit("state_transition_applied", "ok", {
        workflowInstanceId: created.workflow.id,
        taskId: created.task.id,
        status: created.workflow.status,
        taskCode: created.task.taskCode
      });

      return {
        success: true,
        businessObjectType: "workflow_instance",
        businessObjectId: created.workflow.id,
        nextActions: [OFFBOARDING_SUBMIT_TASK_CODE],
        artifacts: []
      };
    }
  });
}

export async function submitOffboardingDraft(input: OffboardingTransitionInput) {
  return executeOffboardingTransition(input, {
    actionCode: "offboarding.submit",
    allowedActorRoles: ["ADMIN", "EMPLOYEE_SELF"],
    fromStatuses: ["DRAFT"],
    toStatus: "SUBMITTED",
    currentTaskCode: OFFBOARDING_SUBMIT_TASK_CODE,
    nextTaskCode: OFFBOARDING_APPROVE_HR_TASK_CODE,
    auditOperation: "SUBMIT",
    nextActions: [OFFBOARDING_APPROVE_HR_TASK_CODE],
    currentTaskResultSummary: "submitted"
  });
}

export async function approveOffboardingByHr(input: OffboardingTransitionInput) {
  return executeOffboardingTransition(input, {
    actionCode: "offboarding.approve_hr",
    allowedActorRoles: ["ADMIN", "HRBP", "HR_SPECIALIST"],
    fromStatuses: ["SUBMITTED"],
    toStatus: "HR_REVIEW",
    currentTaskCode: OFFBOARDING_APPROVE_HR_TASK_CODE,
    nextTaskCode: OFFBOARDING_APPROVE_MANAGER_TASK_CODE,
    auditOperation: "APPROVE_HR",
    nextActions: [OFFBOARDING_APPROVE_MANAGER_TASK_CODE],
    currentTaskResultSummary: "hr_approved"
  });
}

export async function approveOffboardingByManager(input: OffboardingTransitionInput) {
  return executeOffboardingTransition(input, {
    actionCode: "offboarding.approve_manager",
    allowedActorRoles: ["ADMIN", "MANAGER"],
    fromStatuses: ["HR_REVIEW"],
    toStatus: "MANAGER_CONFIRM",
    currentTaskCode: OFFBOARDING_APPROVE_MANAGER_TASK_CODE,
    nextTaskCode: OFFBOARDING_APPROVE_FINANCE_TASK_CODE,
    auditOperation: "APPROVE_MANAGER",
    nextActions: [OFFBOARDING_APPROVE_FINANCE_TASK_CODE],
    currentTaskResultSummary: "manager_approved"
  });
}

export async function approveOffboardingByFinance(input: OffboardingTransitionInput) {
  return executeOffboardingTransition(input, {
    actionCode: "offboarding.approve_finance",
    allowedActorRoles: ["ADMIN", "PAYROLL_FINANCE"],
    fromStatuses: ["MANAGER_CONFIRM"],
    toStatus: "FINANCE_CONFIRM",
    currentTaskCode: OFFBOARDING_APPROVE_FINANCE_TASK_CODE,
    auditOperation: "APPROVE_FINANCE",
    nextActions: [OFFBOARDING_ARCHIVE_TASK_CODE],
    currentTaskResultSummary: "finance_approved"
  });
}

export async function archiveOffboardingCase(input: ArchiveOffboardingCaseInput) {
  const actionDefinition = await prisma.actionDefinition.findUniqueOrThrow({
    where: { actionCode: "offboarding.archive" }
  });

  return createActionRun({
    actionCode: "offboarding.archive",
    actorType: input.actorType,
    actorId: input.actorUserId,
    input: {
      workflowInstanceId: input.workflowInstanceId,
      requestId: input.requestId
    },
    execute: async ({ emit }) => {
      emit("input_validated", "ok", {
        workflowInstanceId: input.workflowInstanceId
      });

      const workflow = await prisma.workflowInstance.findUniqueOrThrow({
        where: { id: input.workflowInstanceId },
        include: {
          employee: true,
          tasks: {
            orderBy: {
              taskCode: "asc"
            }
          }
        }
      });

      if (workflow.businessObjectType !== "offboarding_case") {
        throw new Error("not_found");
      }

      if (workflow.status !== "FINANCE_CONFIRM") {
        throw new Error("invalid_state");
      }

      const archiveTaskTemplate = await prisma.workflowTaskTemplate.findFirstOrThrow({
        where: {
          templateId: workflow.templateId,
          taskCode: OFFBOARDING_ARCHIVE_TASK_CODE
        }
      });

      const now = new Date();

      const archived = await prisma.$transaction(async (tx) => {
        const invocation = await tx.actionInvocation.create({
          data: {
            actionDefinitionId: actionDefinition.id,
            requestId: input.requestId,
            idempotencyKey: input.idempotencyKey,
            actorType: input.actorType,
            actorId: input.actorUserId,
            channel: "api",
            inputPayloadJson: {
              workflowInstanceId: input.workflowInstanceId
            },
            status: "RUNNING"
          }
        });

        const existingArchiveTask = await tx.workflowTask.findFirst({
          where: {
            workflowInstanceId: workflow.id,
            taskCode: OFFBOARDING_ARCHIVE_TASK_CODE
          }
        });

        const archiveTask = existingArchiveTask
          ? await tx.workflowTask.update({
              where: { id: existingArchiveTask.id },
              data: {
                status: "ARCHIVED",
                assigneeType: "user",
                assigneeId: input.actorUserId,
                startedAt: existingArchiveTask.startedAt ?? now,
                completedAt: now,
                resultSummary: "archive_completed"
              }
            })
          : await tx.workflowTask.create({
              data: {
                id: randomUUID(),
                workflowInstanceId: workflow.id,
                taskTemplateId: archiveTaskTemplate.id,
                taskCode: archiveTaskTemplate.taskCode,
                status: "ARCHIVED",
                assigneeType: "user",
                assigneeId: input.actorUserId,
                startedAt: now,
                completedAt: now,
                resultSummary: "archive_completed"
              }
            });

        const artifact = await tx.taskArtifact.create({
          data: {
            taskId: archiveTask.id,
            artifactType: "archive_snapshot",
            artifactUri: `archive://${workflow.id}`,
            artifactPayloadJson: {
              workflowInstanceId: workflow.id,
              employeeId: workflow.employee.id,
              employeeNo: workflow.employee.employeeNo,
              employeeStatusBefore: workflow.employee.currentStatus
            }
          }
        });

        const updatedWorkflow = await tx.workflowInstance.update({
          where: { id: workflow.id },
          data: {
            status: "ARCHIVED",
            completedAt: workflow.completedAt ?? now
          }
        });

        const updatedEmployee = await tx.employeeMaster.update({
          where: { id: workflow.employee.id },
          data: {
            currentStatus: "OFFBOARDED"
          }
        });

        await tx.workflowEvent.createMany({
          data: [
            {
              workflowInstanceId: workflow.id,
              taskId: archiveTask.id,
              eventType: "command_received",
              eventPayloadJson: {
                actionCode: "offboarding.archive",
                requestId: input.requestId
              }
            },
            {
              workflowInstanceId: workflow.id,
              taskId: archiveTask.id,
              eventType: "artifact_written",
              eventPayloadJson: {
                artifactId: artifact.id,
                artifactType: artifact.artifactType,
                taskCode: archiveTask.taskCode
              }
            },
            {
              workflowInstanceId: workflow.id,
              taskId: archiveTask.id,
              eventType: "state_transition_applied",
              eventPayloadJson: {
                fromStatus: workflow.status,
                status: updatedWorkflow.status,
                employeeStatus: updatedEmployee.currentStatus
              }
            }
          ]
        });

        await tx.actionResult.create({
          data: {
            invocationId: invocation.id,
            success: true,
            businessObjectType: "workflow_instance",
            businessObjectId: workflow.id,
            outputPayloadJson: {
              workflowInstanceId: workflow.id,
              taskId: archiveTask.id,
              artifactId: artifact.id,
              workflowStatus: updatedWorkflow.status,
              employeeStatus: updatedEmployee.currentStatus
            }
          }
        });

        await tx.actionInvocation.update({
          where: { id: invocation.id },
          data: {
            status: "SUCCEEDED",
            finishedAt: now
          }
        });

        await writeAuditEvent(
          {
            actorType: input.actorType,
            actorId: input.actorUserId,
            entityType: "WorkflowInstance",
            entityId: workflow.id,
            operation: "ARCHIVE",
            beforeJson: {
              workflowStatus: workflow.status,
              employeeStatus: workflow.employee.currentStatus
            },
            afterJson: {
              workflowStatus: updatedWorkflow.status,
              employeeStatus: updatedEmployee.currentStatus,
              taskId: archiveTask.id,
              artifactId: artifact.id
            },
            requestId: input.requestId
          },
          tx
        );

        return {
          archiveTask,
          artifact,
          updatedWorkflow,
          updatedEmployee
        };
      });

      emit("artifact_written", "ok", {
        workflowInstanceId: workflow.id,
        taskId: archived.archiveTask.id,
        artifactId: archived.artifact.id,
        artifactType: archived.artifact.artifactType
      });

      emit("state_transition_applied", "ok", {
        workflowInstanceId: workflow.id,
        fromStatus: workflow.status,
        status: archived.updatedWorkflow.status,
        employeeStatus: archived.updatedEmployee.currentStatus
      });

      return {
        success: true,
        businessObjectType: "workflow_instance",
        businessObjectId: workflow.id,
        nextActions: [],
        artifacts: [
          {
            type: archived.artifact.artifactType,
            id: archived.artifact.id
          }
        ]
      };
    }
  });
}
