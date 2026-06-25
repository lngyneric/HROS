import { createRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { HrWorklistView } from "@/modules/workitems/views/hr-worklist-view";
import { rootRoute } from "./__root";

function HrPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="HROS HR"
        title="HR 工作台"
        description="集中处理入职与离职工单，沿用现有列表、流转、锁定与解锁接口，不提前拆除旧页面实现。"
      />
      <HrWorklistView />
    </AppShell>
  );
}

export const hrRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hr",
  component: HrPage
});
