import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3003),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16)
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(): Env {
  return EnvSchema.parse(process.env);
}

