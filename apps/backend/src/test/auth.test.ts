import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("auth", () => {
  it("rejects invalid credentials", async () => {
    const res = await request(createApp()).post("/api/auth/login").send({ email: "nope@hros.local", password: "x" });
    expect(res.status).toBe(401);
  });
});

