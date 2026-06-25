import { randomUUID } from "node:crypto";
import type { RoleCode, WorkflowStatus } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { writeAuditEvent } from "../../audit/audit.js";
import { createActionRun } from "../actions/action-runner.js";

type CreateOnboardingDraftInput = {
  actorUserId: string;
  actorType: string;
  employeeId: string;
  requestId: string;
  idempotencyKey: string;
};

type OnboardingTransitionInput = {
  workflowInstanceId: string;
  actorUserId: string;
  actorType: string;
  actorRole: RoleCode;
  requestId: string;
  idempotencyKey: string;
};

type OnboardingTransitionConfig = {
  actionCode: "onboarding.submit" | "onboarding.approve_hr" | "onboarding.approve_manager";
  allowedActorRoles: RoleCode[];
  fromStatuses: WorkflowStatus[];
  toStatus: WorkflowStatus;
  currentTaskCode: string;
  nextTaskCode?: string;
  auditOperation: "SUBMIT" | "APPROVE_HR" | "APPROVE_MANAGER";
  nextActions: string[];
  currentTaskResultSummary: string;
};

const ONBOARDING_TEMPLATE_CODE = "ONBOARDING_STANDARD";
const ONBOARDING_SUBMIT_TASK_CODE = "onboarding.submit";
const ONBOARDING_APPROVE_HR_TASK_CODE = "onboarding.approve_hr";
const ONBOARDING_APPROVE_MANAGER_TASK_CODE = "onboarding.approve_manager";

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

async function executeOnboardingTransition(
  input: OnboardingTransitionInput,
  config: OnboardingTransitionConfig
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

      if (workflow.businessObjectType !== "onboarding_case") {
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
            completedAt: config.toStatus === "COMPLETED" ? workflow.completedAt ?? now : null
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

export async function createOnboardingDraft(input: CreateOnboardingDraftInput) {
  const [actionDefinition, workflowTemplate, firstStage] = await Promise.all([
    prisma.actionDefinition.findUniqueOrThrow({
      where: { actionCode: "onboarding.create" }
    }),
    prisma.workflowTemplate.findUniqueOrThrow({
      where: { templateCode: ONBOARDING_TEMPLATE_CODE }
    }),
    prisma.workflowStage.findFirstOrThrow({
      where: {
        template: {
          templateCode: ONBOARDING_TEMPLATE_CODE
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
    throw new Error("missing_onboarding_task_template");
  }

  return createActionRun({
    actionCode: "onboarding.create",
    actorType: input.actorType,
    actorId: input.actorUserId,
    input: {
      employeeId: input.employeeId,
      requestId: input.requestId
    },
    execute: async ({ emit }) => {
      emit("input_validated", "ok", {
        employeeId: input.employeeId
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
              employeeId: input.employeeId
            },
            status: "RUNNING"
          }
        });

        const workflow = await tx.workflowInstance.create({
          data: {
            id: workflowId,
            templateId: workflowTemplate.id,
            employeeId: input.employeeId,
            businessObjectType: "onboarding_case",
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
                actionCode: "onboarding.create",
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
              employeeId: input.employeeId
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
        nextActions: [ONBOARDING_SUBMIT_TASK_CODE],
        artifacts: []
      };
    }
  });
}

export async function submitOnboardingDraft(input: OnboardingTransitionInput) {
  return executeOnboardingTransition(input, {
    actionCode: "onboarding.submit",
    allowedActorRoles: ["ADMIN", "EMPLOYEE_SELF"],
    fromStatuses: ["DRAFT"],
    toStatus: "SUBMITTED",
    currentTaskCode: ONBOARDING_SUBMIT_TASK_CODE,
    nextTaskCode: ONBOARDING_APPROVE_HR_TASK_CODE,
    auditOperation: "SUBMIT",
    nextActions: [ONBOARDING_APPROVE_HR_TASK_CODE],
    currentTaskResultSummary: "submitted"
  });
}

export async function approveOnboardingByHr(input: OnboardingTransitionInput) {
  return executeOnboardingTransition(input, {
    actionCode: "onboarding.approve_hr",
    allowedActorRoles: ["ADMIN", "HRBP", "HR_SPECIALIST"],
    fromStatuses: ["SUBMITTED", "HR_REVIEW"],
    toStatus: "MANAGER_CONFIRM",
    currentTaskCode: ONBOARDING_APPROVE_HR_TASK_CODE,
    nextTaskCode: ONBOARDING_APPROVE_MANAGER_TASK_CODE,
    auditOperation: "APPROVE_HR",
    nextActions: [ONBOARDING_APPROVE_MANAGER_TASK_CODE],
    currentTaskResultSummary: "hr_approved"
  });
}

export async function approveOnboardingByManager(input: OnboardingTransitionInput) {
  return executeOnboardingTransition(input, {
    actionCode: "onboarding.approve_manager",
    allowedActorRoles: ["ADMIN", "MANAGER"],
    fromStatuses: ["MANAGER_CONFIRM"],
    toStatus: "COMPLETED",
    currentTaskCode: ONBOARDING_APPROVE_MANAGER_TASK_CODE,
    auditOperation: "APPROVE_MANAGER",
    nextActions: [],
    currentTaskResultSummary: "manager_approved"
  });
}
