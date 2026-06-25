import type { CliContext } from "./context.js";
import { cliFailed, createCliEvent, type CliCommandResponse } from "./output.js";
import { runActionGetCommand } from "./commands/action-get.js";
import { runActionListCommand } from "./commands/action-list.js";
import { runApprovalApproveCommand } from "./commands/approval-approve.js";
import { runApprovalListCommand } from "./commands/approval-list.js";
import { runApprovalRejectCommand } from "./commands/approval-reject.js";
import { runAuditListCommand } from "./commands/audit-list.js";
import { runOffboardingApproveFinanceCommand } from "./commands/offboarding-approve-finance.js";
import { runOffboardingApproveHrCommand } from "./commands/offboarding-approve-hr.js";
import { runOffboardingApproveManagerCommand } from "./commands/offboarding-approve-manager.js";
import { runOffboardingArchiveCommand } from "./commands/offboarding-archive.js";
import { runOffboardingCreateCommand } from "./commands/offboarding-create.js";
import { runOnboardingApproveHrCommand } from "./commands/onboarding-approve-hr.js";
import { runOnboardingApproveManagerCommand } from "./commands/onboarding-approve-manager.js";
import { runOnboardingCreateCommand } from "./commands/onboarding-create.js";
import { runOnboardingSubmitCommand } from "./commands/onboarding-submit.js";
import { runWhoAmICommand } from "./commands/whoami.js";

type RegisteredCommandHandler = (context: CliContext) => Promise<CliCommandResponse>;

const COMMAND_REGISTRY: Record<string, RegisteredCommandHandler> = {
  "hros action list": runActionListCommand,
  "hros action get": runActionGetCommand,
  "hros approval list": runApprovalListCommand,
  "hros approval approve": runApprovalApproveCommand,
  "hros approval reject": runApprovalRejectCommand,
  "hros audit list": runAuditListCommand,
  "hros auth whoami": runWhoAmICommand,
  "hros onboarding create": runOnboardingCreateCommand,
  "hros onboarding submit": runOnboardingSubmitCommand,
  "hros onboarding approve-hr": runOnboardingApproveHrCommand,
  "hros onboarding approve-manager": runOnboardingApproveManagerCommand,
  "hros offboarding create": runOffboardingCreateCommand,
  "hros offboarding approve-hr": runOffboardingApproveHrCommand,
  "hros offboarding approve-manager": runOffboardingApproveManagerCommand,
  "hros offboarding approve-finance": runOffboardingApproveFinanceCommand,
  "hros offboarding archive": runOffboardingArchiveCommand
};

export async function runRegisteredCommand(context: CliContext): Promise<CliCommandResponse> {
  const handler = COMMAND_REGISTRY[context.parsed.commandName];

  if (!handler) {
    return cliFailed({
      traceId: context.traceId,
      events: [
        createCliEvent("command_received", "ok", {
          commandName: context.parsed.commandName,
          argv: context.parsed.argv
        }),
        createCliEvent("command_failed", "failed", {
          code: "unknown_command",
          commandName: context.parsed.commandName
        })
      ],
      result: {
        success: false,
        code: "unknown_command",
        message: `未注册命令: ${context.parsed.commandName}`
      }
    });
  }

  return handler(context);
}
