import { createRouter } from "@tanstack/react-router";
import { financeRoute } from "./routes/finance";
import { hrRoute } from "./routes/hr";
import { rootRoute } from "./routes/__root";
import { loginRoute } from "./routes/login";
import { managerRoute } from "./routes/manager";
import { selfRoute } from "./routes/self";

const routeTree = rootRoute.addChildren([loginRoute, selfRoute, hrRoute, managerRoute, financeRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
