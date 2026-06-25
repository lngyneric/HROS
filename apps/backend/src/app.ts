import express from "express";
import { mountAuthRoutes } from "./auth/auth.routes.js";
import { mountEmployeeRoutes } from "./modules/employees/employees.routes.js";
import { mountOnboardingRoutes } from "./modules/onboarding/onboarding.routes.js";
import { mountOffboardingRoutes } from "./modules/offboarding/offboarding.routes.js";
import { mountStatsRoutes } from "./modules/stats/stats.routes.js";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  mountAuthRoutes(app);
  mountEmployeeRoutes(app);
  mountOnboardingRoutes(app);
  mountOffboardingRoutes(app);
  mountStatsRoutes(app);

  return app;
}

