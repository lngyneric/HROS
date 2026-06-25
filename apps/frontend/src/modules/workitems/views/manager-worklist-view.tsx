import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionEventTimeline } from "@/components/ui/action-event-timeline";
import { managerOffboardingWorkitemsQuery, managerOnboardingWorkitemsQuery } from "../queries";
import { transitionOffboardingCase, transitionOnboardingCase } from "../service";
import type { ActionEnvelope } from "../types";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}

const panelStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  padding: 24,
  borderRadius: 24,
  background: "#ffffff",
  boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)"
};

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "9px 14px",
  fontWeight: 700,
  cursor: "pointer",
  background: "#2563eb",
  color: "#ffffff"
};

function EmptyState(props: { text: string }) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 16,
        border: "1px dashed #cbd5e1",
        background: "#f8fafc",
        color: "#64748b"
      }}
    >
      {props.text}
    </div>
  );
}

export function ManagerWorklistView() {
  const queryClient = useQueryClient();
  const onboardingQuery = useQuery(managerOnboardingWorkitemsQuery);
  const offboardingQuery = useQuery(managerOffboardingWorkitemsQuery);
  const [latestEvents, setLatestEvents] = useState<ActionEnvelope["events"]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingAction, setPendingAction] = useState("");

  const onboardingRows = useMemo(
    () => (onboardingQuery.data ?? []).filter((caseItem) => caseItem.status === "MANAGER_CONFIRM"),
    [onboardingQuery.data]
  );
  const offboardingRows = useMemo(
    () => (offboardingQuery.data ?? []).filter((caseItem) => caseItem.status === "MANAGER_CONFIRM"),
    [offboardingQuery.data]
  );

  const queryError =
    (onboardingQuery.error instanceof Error && onboardingQuery.error.message) ||
    (offboardingQuery.error instanceof Error && offboardingQuery.error.message) ||
    "";

  async function runAction(actionKey: string, action: () => Promise<ActionEnvelope>, queryKey: readonly unknown[]) {
    try {
      setPendingAction(actionKey);
      setErrorMessage("");
      const response = await action();
      setLatestEvents(response.events);
      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setPendingAction("");
    }
  }

  return (
    <section style={{ display: "grid", gap: 24 }}>
      {queryError || errorMessage ? (
        <div
          role="alert"
          style={{
            padding: 14,
            borderRadius: 16,
            background: "#fef2f2",
            color: "#b91c1c"
          }}
        >
          {queryError || errorMessage}
        </div>
      ) : null}

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>入职确认</h2>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
            经理工作台继续复用现有列表与流转接口，仅处理已进入 MANAGER_CONFIRM 的入职工单。
          </p>
        </div>

        {onboardingRows.length === 0 && !onboardingQuery.isPending ? (
          <EmptyState text="暂无待确认的入职工单。" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "0 0 12px" }}>员工</th>
                  <th style={{ padding: "0 0 12px" }}>工号</th>
                  <th style={{ padding: "0 0 12px" }}>工单 ID</th>
                  <th style={{ padding: "0 0 12px" }}>创建时间</th>
                  <th style={{ padding: "0 0 12px" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {onboardingRows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 0" }}>{row.employee?.name ?? row.employee?.fullName ?? "-"}</td>
                    <td style={{ padding: "14px 0" }}>{row.employee?.employeeNo ?? "-"}</td>
                    <td style={{ padding: "14px 0", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{row.id}</td>
                    <td style={{ padding: "14px 0", color: "#475569" }}>{formatDate(row.createdAt)}</td>
                    <td style={{ padding: "14px 0" }}>
                      <button
                        type="button"
                        disabled={pendingAction !== ""}
                        onClick={() => {
                          void runAction(
                            `onboarding-complete-${row.id}`,
                            () => transitionOnboardingCase(row.id, "COMPLETED"),
                            managerOnboardingWorkitemsQuery.queryKey
                          );
                        }}
                        style={{ ...buttonStyle, opacity: pendingAction !== "" ? 0.6 : 1 }}
                      >
                        完成
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>离职交接确认</h2>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
            经理确认完成后，离职工单会继续沿用现有接口转交到 FINANCE_CONFIRM。
          </p>
        </div>

        {offboardingRows.length === 0 && !offboardingQuery.isPending ? (
          <EmptyState text="暂无待确认的离职工单。" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "0 0 12px" }}>员工</th>
                  <th style={{ padding: "0 0 12px" }}>工号</th>
                  <th style={{ padding: "0 0 12px" }}>工单 ID</th>
                  <th style={{ padding: "0 0 12px" }}>创建时间</th>
                  <th style={{ padding: "0 0 12px" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {offboardingRows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 0" }}>{row.employee?.name ?? row.employee?.fullName ?? "-"}</td>
                    <td style={{ padding: "14px 0" }}>{row.employee?.employeeNo ?? "-"}</td>
                    <td style={{ padding: "14px 0", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{row.id}</td>
                    <td style={{ padding: "14px 0", color: "#475569" }}>{formatDate(row.createdAt)}</td>
                    <td style={{ padding: "14px 0" }}>
                      <button
                        type="button"
                        disabled={pendingAction !== ""}
                        onClick={() => {
                          void runAction(
                            `offboarding-finance-${row.id}`,
                            () => transitionOffboardingCase(row.id, "FINANCE_CONFIRM"),
                            managerOffboardingWorkitemsQuery.queryKey
                          );
                        }}
                        style={{ ...buttonStyle, opacity: pendingAction !== "" ? 0.6 : 1 }}
                      >
                        转 FINANCE_CONFIRM
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>最近操作事件</h2>
          <p style={{ margin: 0, color: "#475569" }}>与旧页面一致，经理可以在完成操作后立刻查看服务端返回的事件轨迹。</p>
        </div>
        <ActionEventTimeline events={latestEvents} />
      </section>
    </section>
  );
}
