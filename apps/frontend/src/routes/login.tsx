import { createRoute } from "@tanstack/react-router";
import { LoginForm } from "@/modules/auth/login-form";
import { rootRoute } from "./__root";

function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%)"
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 420,
          display: "grid",
          gap: 24,
          padding: 32,
          borderRadius: 24,
          background: "#ffffff",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)"
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0, color: "#2563eb", fontWeight: 600 }}>HROS</p>
          <h1 style={{ margin: 0, fontSize: 32 }}>登录</h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
            使用现有 HROS 账号访问员工自助、审批和财务工作台。
          </p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage
});
