import { createRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { FinanceWorklistView } from "@/modules/workitems/views/finance-worklist-view";
import { rootRoute } from "./__root";

function FinancePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="HROS Finance"
        title="财务确认工作台"
        description="处理 FINANCE_CONFIRM 阶段的离职工单，继续使用现有离职列表与归档流转接口。"
      />
      <FinanceWorklistView />
    </AppShell>
  );
}

export const financeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/finance",
  component: FinancePage
});
