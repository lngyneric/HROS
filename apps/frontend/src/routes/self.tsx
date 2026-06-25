import { createRoute } from "@tanstack/react-router";
import { SelfOffboardingView } from "@/modules/offboarding/views/self-offboarding-view";
import { SelfOnboardingView } from "@/modules/onboarding/views/self-onboarding-view";
import { rootRoute } from "./__root";

function SelfPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 24px 56px"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gap: 24
        }}
      >
        <section
          style={{
            display: "grid",
            gap: 12,
            padding: 24,
            borderRadius: 24,
            background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
            color: "#ffffff"
          }}
        >
          <p style={{ margin: 0, opacity: 0.88 }}>HROS 员工自助</p>
          <h1 style={{ margin: 0, fontSize: 36 }}>入离职自助办理</h1>
          <p style={{ margin: 0, maxWidth: 720, lineHeight: 1.7, opacity: 0.92 }}>
            当前页面继续对接现有 onboarding/offboarding API；HR、经理和财务工作台已迁移到新的 TanStack 路由页面，共享同一套认证骨架。
          </p>
        </section>

        <SelfOnboardingView />
        <SelfOffboardingView />
      </div>
    </main>
  );
}

export const selfRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/self",
  component: SelfPage
});
