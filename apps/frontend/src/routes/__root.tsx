import { useQuery } from "@tanstack/react-query";
import { Outlet, createRootRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { setAuthToken } from "@/lib/api-client";
import { currentUserQuery } from "@/modules/auth/queries";
import { getRoleHomePath } from "@/modules/auth/service";
import { clearSession, getSessionToken } from "@/modules/auth/session";

export function RootLoading() {
  return (
    <div className="loading-shell">
      <span>加载中</span>
    </div>
  );
}

function RootRouteComponent() {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const token = getSessionToken();
  setAuthToken(token);

  const meQuery = useQuery({
    ...currentUserQuery,
    enabled: Boolean(token)
  });

  useEffect(() => {
    if (!token && pathname !== "/login") {
      void navigate({ to: "/login", replace: true });
    }
  }, [navigate, pathname, token]);

  useEffect(() => {
    if (meQuery.data && (pathname === "/" || pathname === "/login")) {
      void navigate({ to: getRoleHomePath(meQuery.data.role), replace: true });
    }
  }, [meQuery.data, navigate, pathname]);

  useEffect(() => {
    if (token && meQuery.isError) {
      clearSession();

      if (pathname !== "/login") {
        void navigate({ to: "/login", replace: true });
      }
    }
  }, [meQuery.isError, navigate, pathname, token]);

  if (pathname === "/") {
    return <RootLoading />;
  }

  if (token && (meQuery.isPending || meQuery.isError || (pathname === "/login" && Boolean(meQuery.data)))) {
    return <RootLoading />;
  }

  return (
    <div className="app-shell">
      <Outlet />
    </div>
  );
}

export const rootRoute = createRootRoute({
  component: RootRouteComponent
});

export const Route = rootRoute;
