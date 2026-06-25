import { describe, expect, it } from "vitest";
import { runCli } from "../cli/main.js";
import { prisma } from "../db/prisma.js";

describe("cli offboarding", () => {
  it("blocks high-risk archive commands and persists a security event", async () => {
    const result = await runCli([
      "offboarding",
      "archive",
      "--actor-id",
      "seed-finance",
      "--workflow-instance-id",
      "wf-cli-blocked",
      "--output",
      "json"
    ]);

    expect(result.status).toBe("blocked");
    expect(result.invocationId).toEqual(expect.any(String));
    expect(result.traceId).toEqual(expect.any(String));
    expect(result.events[0]?.eventType).toBe("command_received");
    expect(
      result.events.some((event) => event.eventType === "policy_checked" && event.status === "failed")
    ).toBe(true);
    expect(result.events.some((event) => event.eventType === "security_event_written")).toBe(true);
    expect(result.result).toMatchObject({
      success: false,
      code: "approval_required",
      approvalType: "OFFBOARDING_ARCHIVE_APPROVAL"
    });
    expect(result.result.securityEventId).toEqual(expect.any(String));

    const securityEventId = String(result.result.securityEventId);

    const storedEvent = await prisma.securityEvent.findUniqueOrThrow({
      where: { id: securityEventId }
    });

    expect(storedEvent.eventType).toBe("HIGH_RISK_COMMAND_BLOCKED");
    expect(storedEvent.riskLevel).toBe("HIGH");
    expect(storedEvent.detailsJson).toMatchObject({
      commandName: "hros offboarding archive",
      blockingReason: "approval_required"
    });

    await prisma.securityEvent.delete({
      where: { id: storedEvent.id }
    });
    await prisma.approvalRequest.deleteMany({
      where: { invocationId: result.invocationId }
    });
    await prisma.actionResult.delete({
      where: { invocationId: result.invocationId }
    });
    await prisma.actionInvocation.delete({
      where: { id: result.invocationId }
    });
  });
});
