import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("root local dev runbook", () => {
  it("documents the PostgreSQL-based MVP startup path", () => {
    const rootReadme = readFileSync(resolve(process.cwd(), "..", "..", "README.md"), "utf8");
    expect(rootReadme).toContain("docker compose up -d db");
    expect(rootReadme).toContain("npm run dev");
    expect(rootReadme).toContain("http://localhost:5173");
    expect(rootReadme).toContain("http://localhost:3003");
  });
});
