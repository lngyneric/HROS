import { describe, expect, it } from "vitest";
import { prisma } from "../db/prisma.js";

describe("hros schema", () => {
  it("seeds action definitions and workflow templates", async () => {
    const actionCount = await prisma.actionDefinition.count();
    const workflowTemplateCount = await prisma.workflowTemplate.count();

    expect(actionCount).toBeGreaterThan(0);
    expect(workflowTemplateCount).toBeGreaterThan(0);
  });
});
