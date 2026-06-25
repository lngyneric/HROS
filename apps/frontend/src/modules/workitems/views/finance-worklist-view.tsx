import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionEventTimeline } from "@/components/ui/action-event-timeline";
import { financeOffboardingWorkitemsQuery } from "../queries";
import { transitionOffboardingCase } from "../service";
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

export function FinanceWorklistView() {
  const queryClient = useQueryClient();
  const offboardingQuery = useQuery(financeOffboardingWorkitemsQuery);
  const [latestEvents, setLatestEvents] = useState<ActionEnvelope["events"]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingAction, setPendingAction] = useState("");

  const rows = useMemo(
    () => (offboardingQuery.data ?? []).filter((caseItem) => caseItem.status === "FINANCE_CONFIRM"),
    [offboardingQuery.data]
  );

  async function archiveCase(id: string) {
    try {
      setPendingAction(id);
      setErrorMessage("");
      const response = await transitionOffboardingCase(id, "ARCHIVED");
      setLatestEvents(response.events);
      await queryClient.invalidateQueries({ queryKey: financeOffboardingWorkitemsQuery.queryKey });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setPendingAction("");
    }
  }

  return (
    <section style={{ display: "grid", gap: 24 }}>
      {(offboardingQuery.error instanceof Error || errorMessage) && (
        <div
          role="alert"
          style={{
            padding: 14,
            borderRadius: 16,
            background: "#fef2f2",
            color: "#b91c1c"
          }}
        >
          {(offboardingQuery.error instanceof Error && offboardingQuery.error.message) || errorMessage}
        </div>
      )}

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>待归档离职工单</h2>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
            财务页面继续读取现有离职列表接口，并将 FINANCE_CONFIRM 工单归档到 ARCHIVED。
          </p>
        </div>

        {rows.length === 0 && !offboardingQuery.isPending ? (
          <EmptyState text="暂无待归档的离职工单。" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "0 0 12px" }}>员工</th>
                  <th style={{ padding: "0 0 12px" }}>工号</th>
                  <th style={{ padding: "0 0 12px" }}>工单 ID</th>
                  <th style={{ padding: "0 0 12px" }}>计划离职日</th>
                  <th style={{ padding: "0 0 12px" }}>创建时间</th>
                  <th style={{ padding: "0 0 12px" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 0" }}>{row.employee?.name ?? row.employee?.fullName ?? "-"}</td>
                    <td style={{ padding: "14px 0" }}>{row.employee?.employeeNo ?? "-"}</td>
                    <td style={{ padding: "14px 0", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{row.id}</td>
                    <td style={{ padding: "14px 0" }}>{row.plannedLastDay ? formatDate(row.plannedLastDay) : "-"}</td>
                    <td style={{ padding: "14px 0", color: "#475569" }}>{formatDate(row.createdAt)}</td>
                    <td style={{ padding: "14px 0" }}>
                      <button
                        type="button"
                        disabled={pendingAction !== ""}
                        onClick={() => {
                          void archiveCase(row.id);
                        }}
                        style={{ ...buttonStyle, opacity: pendingAction !== "" ? 0.6 : 1 }}
                      >
                        归档
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
          <p style={{ margin: 0, color: "#475569" }}>保留财务工作台原有的事件反馈，方便确认归档是否完成。</p>
        </div>
        <ActionEventTimeline events={latestEvents} />
      </section>
    </section>
  );
}
