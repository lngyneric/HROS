import type { PropsWithChildren } from "react";
import { Link, useRouterState } from "@tanstack/react-router";

const navItems = [
  { to: "/self", label: "员工自助" },
  { to: "/hr", label: "HR 工作台" },
  { to: "/manager", label: "经理确认" },
  { to: "/finance", label: "财务确认" }
] as const;

export function AppShell(props: PropsWithChildren) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "24px 20px 48px"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gap: 24
        }}
      >
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            padding: 20,
            borderRadius: 24,
            background: "rgba(255, 255, 255, 0.92)",
            boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
            backdropFilter: "blur(12px)"
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <strong style={{ fontSize: 18, color: "#0f172a" }}>HROS</strong>
            <span style={{ color: "#64748b", fontSize: 14 }}>ShipAny + TanStack 工作台迁移中</span>
          </div>

          <nav style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {navItems.map((item) => {
              const isActive = pathname === item.to;

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    textDecoration: "none",
                    fontWeight: 700,
                    color: isActive ? "#ffffff" : "#334155",
                    background: isActive ? "#2563eb" : "#e2e8f0"
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        {props.children}
      </div>
    </main>
  );
}
