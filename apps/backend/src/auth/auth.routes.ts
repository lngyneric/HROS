import type { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { verifyPassword } from "./password.js";
import { signToken } from "./jwt.js";
import { requireAuth } from "./auth.middleware.js";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export function mountAuthRoutes(router: Router) {
  router.post("/api/auth/login", async (req, res) => {
    const body = LoginSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "bad_request" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: body.data.email } });
    if (!user) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const ok = await verifyPassword(body.data.password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    res.json({ token: signToken({ userId: user.id }) });
  });

  router.get("/api/auth/me", requireAuth, async (req, res) => {
    res.json({ id: req.user!.id, role: req.user!.role, dataScope: req.user!.dataScope, employeeId: req.user!.employeeId });
  });
}

