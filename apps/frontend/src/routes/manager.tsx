import { createRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ManagerWorklistView } from "@/modules/workitems/views/manager-worklist-view";
import { rootRoute } from "./__root";

function ManagerPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="HROS Manager"
        title="经理确认工作台"
        description="处理 MANAGER_CONFIRM 阶段的入职与离职工单，继续复用现有列表和 transition 接口。"
      />
      <ManagerWorklistView />
    </AppShell>
  );
}

export const managerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/manager",
  component: ManagerPage
});
