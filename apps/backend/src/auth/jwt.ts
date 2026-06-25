import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";

const env = getEnv();

export type JwtPayload = {
  userId: string;
};

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "12h" });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== "object" || decoded === null || typeof (decoded as any).userId !== "string") {
    throw new Error("invalid token");
  }
  return { userId: (decoded as any).userId };
}

