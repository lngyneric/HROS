import { prisma } from "./prisma.js";
import { hashPassword } from "../auth/password.js";

async function main() {
  const passwordHash = await hashPassword("password12345");
  await prisma.workflowEvent.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.actionResult.deleteMany();
  await prisma.actionInvocation.deleteMany();
  await prisma.actionDefinition.deleteMany();
  await prisma.taskArtifact.deleteMany();
  await prisma.workflowTask.deleteMany();
  await prisma.workflowInstance.deleteMany();
  await prisma.workflowTaskTemplate.deleteMany();
  await prisma.workflowStage.deleteMany();
  await prisma.workflowTemplate.deleteMany();
  await prisma.jobAssignment.deleteMany();
  await prisma.employmentRelationship.deleteMany();
  await prisma.employeeIdentityPrivate.deleteMany();
  await prisma.user.deleteMany();
  await prisma.position.deleteMany();
  await prisma.orgUnit.deleteMany();
  await prisma.employeeMaster.deleteMany();

  const rootOrg = await prisma.orgUnit.create({
    data: {
      orgCode: "ROOT",
      orgName: "公司"
    }
  });
  await prisma.orgUnit.create({
    data: {
      orgCode: "HR",
      orgName: "人力资源部",
      parentOrgId: rootOrg.id
    }
  });
  const salesOrg = await prisma.orgUnit.create({
    data: {
      orgCode: "SALES",
      orgName: "销售本部",
      parentOrgId: rootOrg.id
    }
  });

  const managerPosition = await prisma.position.create({
    data: {
      positionCode: "DEPT_MANAGER",
      positionName: "部门经理"
    }
  });
  const staffPosition = await prisma.position.create({
    data: {
      positionCode: "STAFF",
      positionName: "员工"
    }
  });

  const managerEmployee = await prisma.employeeMaster.create({
    data: {
      employeeNo: "E0001",
      fullName: "部门经理",
      workEmail: "manager.employee@hros.local",
      mobilePhone: "13800000001",
      hireDate: new Date("2024-01-15T00:00:00.000Z"),
      currentStatus: "ACTIVE"
    }
  });
  const employee = await prisma.employeeMaster.create({
    data: {
      employeeNo: "E0002",
      fullName: "员工A",
      workEmail: "employee.work@hros.local",
      mobilePhone: "13800000002",
      hireDate: new Date("2026-07-01T00:00:00.000Z"),
      currentStatus: "PREBOARDING"
    }
  });

  await prisma.employeeIdentityPrivate.create({
    data: {
      employeeId: employee.id,
      idType: "CN_ID",
      idNumberEncrypted: "enc-id-e0002",
      addressEncrypted: "enc-address-e0002"
    }
  });

  await prisma.employmentRelationship.createMany({
    data: [
      {
        employeeId: managerEmployee.id,
        employmentType: "FULL_TIME",
        legalEntity: "HROS China",
        contractType: "OPEN_ENDED",
        startDate: new Date("2024-01-15T00:00:00.000Z")
      },
      {
        employeeId: employee.id,
        employmentType: "FULL_TIME",
        legalEntity: "HROS China",
        contractType: "OPEN_ENDED",
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        probationEndDate: new Date("2026-10-01T00:00:00.000Z")
      }
    ]
  });

  await prisma.jobAssignment.createMany({
    data: [
      {
        employeeId: managerEmployee.id,
        positionId: managerPosition.id,
        orgUnitId: salesOrg.id,
        assignmentType: "PRIMARY",
        effectiveFrom: new Date("2024-01-15T00:00:00.000Z"),
        isPrimary: true
      },
      {
        employeeId: employee.id,
        positionId: staffPosition.id,
        orgUnitId: salesOrg.id,
        managerEmployeeId: managerEmployee.id,
        assignmentType: "PRIMARY",
        effectiveFrom: new Date("2026-07-01T00:00:00.000Z"),
        isPrimary: true
      }
    ]
  });

  await prisma.user.createMany({
    data: [
      {
        id: "seed-admin",
        email: "admin@hros.local",
        passwordHash,
        displayName: "Admin",
        role: "ADMIN",
        dataScope: "ALL"
      },
      {
        id: "seed-hrbp",
        email: "hrbp@hros.local",
        passwordHash,
        displayName: "HRBP",
        role: "HRBP",
        dataScope: "ORG_TREE"
      },
      {
        id: "seed-hr",
        email: "hr@hros.local",
        passwordHash,
        displayName: "HR专员",
        role: "HR_SPECIALIST",
        dataScope: "ORG_TREE"
      },
      {
        id: "seed-manager",
        email: "manager@hros.local",
        passwordHash,
        displayName: "部门经理",
        role: "MANAGER",
        dataScope: "DEPT_TREE",
        employeeId: managerEmployee.id
      },
      {
        id: "seed-employee",
        email: "employee@hros.local",
        passwordHash,
        displayName: "员工自助",
        role: "EMPLOYEE_SELF",
        dataScope: "SELF",
        employeeId: employee.id
      },
      {
        id: "seed-finance",
        email: "finance@hros.local",
        passwordHash,
        displayName: "薪资财务",
        role: "PAYROLL_FINANCE",
        dataScope: "ALL"
      }
    ]
  });

  const onboardingTemplate = await prisma.workflowTemplate.create({
    data: {
      templateCode: "ONBOARDING_STANDARD",
      templateName: "标准入职流程",
      domainType: "ONBOARDING",
      version: 1
    }
  });

  const onboardingDraftStage = await prisma.workflowStage.create({
    data: {
      templateId: onboardingTemplate.id,
      stageCode: "DRAFT",
      stageName: "草稿",
      stageOrder: 1
    }
  });
  const onboardingHrStage = await prisma.workflowStage.create({
    data: {
      templateId: onboardingTemplate.id,
      stageCode: "HR_REVIEW",
      stageName: "HR审核",
      stageOrder: 2
    }
  });
  const onboardingManagerStage = await prisma.workflowStage.create({
    data: {
      templateId: onboardingTemplate.id,
      stageCode: "MANAGER_CONFIRM",
      stageName: "经理确认",
      stageOrder: 3
    }
  });

  await prisma.workflowTaskTemplate.createMany({
    data: [
      {
        templateId: onboardingTemplate.id,
        stageId: onboardingDraftStage.id,
        taskCode: "onboarding.submit",
        taskName: "提交入职流程",
        requiredRole: "EMPLOYEE_SELF",
        isRequired: true
      },
      {
        templateId: onboardingTemplate.id,
        stageId: onboardingHrStage.id,
        taskCode: "onboarding.approve_hr",
        taskName: "HR审核入职流程",
        requiredRole: "HR_SPECIALIST",
        isRequired: true
      },
      {
        templateId: onboardingTemplate.id,
        stageId: onboardingManagerStage.id,
        taskCode: "onboarding.approve_manager",
        taskName: "经理确认入职流程",
        requiredRole: "MANAGER",
        isRequired: true
      }
    ]
  });

  const offboardingTemplate = await prisma.workflowTemplate.create({
    data: {
      templateCode: "OFFBOARDING_STANDARD",
      templateName: "标准离职流程",
      domainType: "OFFBOARDING",
      version: 1
    }
  });

  const offboardingDraftStage = await prisma.workflowStage.create({
    data: {
      templateId: offboardingTemplate.id,
      stageCode: "DRAFT",
      stageName: "草稿",
      stageOrder: 1
    }
  });
  const offboardingHrStage = await prisma.workflowStage.create({
    data: {
      templateId: offboardingTemplate.id,
      stageCode: "HR_REVIEW",
      stageName: "HR审核",
      stageOrder: 2
    }
  });
  const offboardingManagerStage = await prisma.workflowStage.create({
    data: {
      templateId: offboardingTemplate.id,
      stageCode: "MANAGER_CONFIRM",
      stageName: "经理确认",
      stageOrder: 3
    }
  });
  const offboardingFinanceStage = await prisma.workflowStage.create({
    data: {
      templateId: offboardingTemplate.id,
      stageCode: "FINANCE_CONFIRM",
      stageName: "财务确认",
      stageOrder: 4
    }
  });
  const offboardingArchiveStage = await prisma.workflowStage.create({
    data: {
      templateId: offboardingTemplate.id,
      stageCode: "ARCHIVE",
      stageName: "归档",
      stageOrder: 5
    }
  });

  await prisma.workflowTaskTemplate.createMany({
    data: [
      {
        templateId: offboardingTemplate.id,
        stageId: offboardingDraftStage.id,
        taskCode: "offboarding.submit",
        taskName: "提交离职流程",
        requiredRole: "EMPLOYEE_SELF",
        isRequired: true
      },
      {
        templateId: offboardingTemplate.id,
        stageId: offboardingHrStage.id,
        taskCode: "offboarding.approve_hr",
        taskName: "HR审核离职流程",
        requiredRole: "HR_SPECIALIST",
        isRequired: true
      },
      {
        templateId: offboardingTemplate.id,
        stageId: offboardingManagerStage.id,
        taskCode: "offboarding.approve_manager",
        taskName: "经理确认离职流程",
        requiredRole: "MANAGER",
        isRequired: true
      },
      {
        templateId: offboardingTemplate.id,
        stageId: offboardingFinanceStage.id,
        taskCode: "offboarding.approve_finance",
        taskName: "财务确认离职流程",
        requiredRole: "PAYROLL_FINANCE",
        isRequired: true
      },
      {
        templateId: offboardingTemplate.id,
        stageId: offboardingArchiveStage.id,
        taskCode: "offboarding.archive",
        taskName: "归档离职流程",
        requiredRole: "PAYROLL_FINANCE",
        isRequired: true
      }
    ]
  });

  const actionDefinitions = [
    ["onboarding.create", "创建入职流程", "ONBOARDING", { employeeId: { type: "string" } }],
    ["onboarding.submit", "提交入职流程", "ONBOARDING", { workflowInstanceId: { type: "string" } }],
    ["onboarding.approve_hr", "HR审核入职流程", "ONBOARDING", { workflowInstanceId: { type: "string" } }],
    ["onboarding.approve_manager", "经理确认入职流程", "ONBOARDING", { workflowInstanceId: { type: "string" } }],
    ["offboarding.create", "创建离职流程", "OFFBOARDING", { employeeId: { type: "string" } }],
    ["offboarding.submit", "提交离职流程", "OFFBOARDING", { workflowInstanceId: { type: "string" } }],
    ["offboarding.approve_hr", "HR审核离职流程", "OFFBOARDING", { workflowInstanceId: { type: "string" } }],
    ["offboarding.approve_manager", "经理确认离职流程", "OFFBOARDING", { workflowInstanceId: { type: "string" } }],
    ["offboarding.approve_finance", "财务确认离职流程", "OFFBOARDING", { workflowInstanceId: { type: "string" } }],
    ["offboarding.archive", "归档离职流程", "OFFBOARDING", { workflowInstanceId: { type: "string" } }]
  ] as const;

  await prisma.actionDefinition.createMany({
    data: actionDefinitions.map(([actionCode, actionName, domainType, properties]) => ({
      actionCode,
      actionName,
      domainType,
      inputSchemaJson: {
        type: "object",
        properties,
        additionalProperties: false
      },
      outputSchemaJson: {
        type: "object",
        properties: {
          businessObjectId: { type: "string" },
          success: { type: "boolean" }
        },
        additionalProperties: true
      },
      requiresApproval: false,
      isIdempotent: true
    }))
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    await prisma.$disconnect();
    throw e;
  });
