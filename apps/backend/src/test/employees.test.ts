import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("employees", () => {
  it("rejects unauth", async () => {
    const res = await request(createApp()).get("/api/employees");
    expect(res.status).toBe(401);
  });
});

