import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db/prisma.js";
import { verifyToken } from "./jwt.js";

export type AuthedUser = {
  id: string;
  role: string;
  dataScope: string;
  employeeId: string | null;
};

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthedUser;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    const token = header.slice("Bearer ".length);
    const { userId } = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    req.user = { id: user.id, role: user.role, dataScope: user.dataScope, employeeId: user.employeeId };
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
}

