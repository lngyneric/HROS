import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionEventTimeline } from "@/components/ui/action-event-timeline";
import { hrOffboardingWorkitemsQuery, hrOnboardingWorkitemsQuery } from "../queries";
import {
  lockOffboardingCase,
  lockOnboardingCase,
  transitionOffboardingCase,
  transitionOnboardingCase,
  unlockOffboardingCase,
  unlockOnboardingCase
} from "../service";
import type { ActionEnvelope, OffboardingWorkItemCase, OnboardingWorkItemCase } from "../types";

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

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse"
};

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "9px 14px",
  fontWeight: 700,
  cursor: "pointer"
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#2563eb",
  color: "#ffffff"
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#e2e8f0",
  color: "#0f172a"
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

type CaseAction = {
  label: string;
  disabled: boolean;
  onClick: () => Promise<void>;
  tone?: "primary" | "secondary";
};

function WorklistTable(props: {
  rows: Array<OnboardingWorkItemCase | OffboardingWorkItemCase>;
  loading: boolean;
  emptyText: string;
  renderActions: (row: OnboardingWorkItemCase | OffboardingWorkItemCase) => CaseAction[];
}) {
  if (!props.loading && props.rows.length === 0) {
    return <EmptyState text={props.emptyText} />;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
            <th style={{ padding: "0 0 12px" }}>员工</th>
            <th style={{ padding: "0 0 12px" }}>工号</th>
            <th style={{ padding: "0 0 12px" }}>工单 ID</th>
            <th style={{ padding: "0 0 12px" }}>状态</th>
            <th style={{ padding: "0 0 12px" }}>锁定</th>
            <th style={{ padding: "0 0 12px" }}>创建时间</th>
            <th style={{ padding: "0 0 12px" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
              <td style={{ padding: "14px 0" }}>{row.employee?.name ?? row.employee?.fullName ?? "-"}</td>
              <td style={{ padding: "14px 0" }}>{row.employee?.employeeNo ?? "-"}</td>
              <td style={{ padding: "14px 0", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{row.id}</td>
              <td style={{ padding: "14px 0" }}>{row.status}</td>
              <td style={{ padding: "14px 0" }}>{row.isLocked ? "是" : "否"}</td>
              <td style={{ padding: "14px 0", color: "#475569" }}>{formatDate(row.createdAt)}</td>
              <td style={{ padding: "14px 0" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {props.renderActions(row).map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      disabled={action.disabled}
                      onClick={() => {
                        void action.onClick();
                      }}
                      style={{
                        ...(action.tone === "primary" ? primaryButtonStyle : secondaryButtonStyle),
                        opacity: action.disabled ? 0.55 : 1
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HrWorklistView() {
  const queryClient = useQueryClient();
  const onboardingQuery = useQuery(hrOnboardingWorkitemsQuery);
  const offboardingQuery = useQuery(hrOffboardingWorkitemsQuery);
  const [latestEvents, setLatestEvents] = useState<ActionEnvelope["events"]>([]);
  const [actionError, setActionError] = useState("");
  const [pendingAction, setPendingAction] = useState("");

  const isRefreshing = onboardingQuery.isFetching || offboardingQuery.isFetching;
  const queryError =
    (onboardingQuery.error instanceof Error && onboardingQuery.error.message) ||
    (offboardingQuery.error instanceof Error && offboardingQuery.error.message) ||
    "";

  async function runAction(actionKey: string, action: () => Promise<ActionEnvelope>, queryKey: readonly unknown[]) {
    try {
      setPendingAction(actionKey);
      setActionError("");
      const response = await action();
      setLatestEvents(response.events);
      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "操作失败");
    } finally {
      setPendingAction("");
    }
  }

  return (
    <section style={{ display: "grid", gap: 24 }}>
      {queryError || actionError ? (
        <div
          role="alert"
          style={{
            padding: 14,
            borderRadius: 16,
            background: "#fef2f2",
            color: "#b91c1c"
          }}
        >
          {queryError || actionError}
        </div>
      ) : null}

      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <h2 style={{ margin: 0, fontSize: 24 }}>入职工单</h2>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
              继续复用现有入职列表、流转、锁定与解锁接口，支持 HR 从提交态推进到经理确认。
            </p>
          </div>
          <button
            type="button"
            style={{ ...secondaryButtonStyle, opacity: isRefreshing ? 0.7 : 1 }}
            disabled={isRefreshing}
            onClick={() => {
              void Promise.all([onboardingQuery.refetch(), offboardingQuery.refetch()]);
            }}
          >
            {isRefreshing ? "刷新中..." : "刷新"}
          </button>
        </div>

        <WorklistTable
          rows={onboardingQuery.data ?? []}
          loading={onboardingQuery.isPending}
          emptyText="暂无入职工单。"
          renderActions={(row) => [
            {
              label: "转 HR_REVIEW",
              disabled: pendingAction !== "" || row.status !== "SUBMITTED",
              onClick: () =>
                runAction(
                  `onboarding-review-${row.id}`,
                  () => transitionOnboardingCase(row.id, "HR_REVIEW"),
                  hrOnboardingWorkitemsQuery.queryKey
                )
            },
            {
              label: "转 MANAGER_CONFIRM",
              disabled: pendingAction !== "" || row.status !== "HR_REVIEW",
              onClick: () =>
                runAction(
                  `onboarding-manager-${row.id}`,
                  () => transitionOnboardingCase(row.id, "MANAGER_CONFIRM"),
                  hrOnboardingWorkitemsQuery.queryKey
                )
            },
            {
              label: "解锁",
              disabled:
                pendingAction !== "" ||
                !row.isLocked ||
                row.status === "DRAFT" ||
                row.status === "COMPLETED" ||
                row.status === "CANCELLED",
              onClick: () =>
                runAction(`onboarding-unlock-${row.id}`, () => unlockOnboardingCase(row.id), hrOnboardingWorkitemsQuery.queryKey)
            },
            {
              label: "锁定",
              disabled: pendingAction !== "" || row.isLocked || row.status === "COMPLETED" || row.status === "CANCELLED",
              onClick: () =>
                runAction(`onboarding-lock-${row.id}`, () => lockOnboardingCase(row.id), hrOnboardingWorkitemsQuery.queryKey)
            }
          ]}
        />
      </section>

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>离职工单</h2>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
            继续复用现有离职列表、流转、锁定与解锁接口，支持 HR 推进到经理确认阶段。
          </p>
        </div>

        <WorklistTable
          rows={offboardingQuery.data ?? []}
          loading={offboardingQuery.isPending}
          emptyText="暂无离职工单。"
          renderActions={(row) => [
            {
              label: "转 HR_REVIEW",
              disabled: pendingAction !== "" || row.status !== "SUBMITTED",
              onClick: () =>
                runAction(
                  `offboarding-review-${row.id}`,
                  () => transitionOffboardingCase(row.id, "HR_REVIEW"),
                  hrOffboardingWorkitemsQuery.queryKey
                )
            },
            {
              label: "转 MANAGER_CONFIRM",
              disabled: pendingAction !== "" || row.status !== "HR_REVIEW",
              onClick: () =>
                runAction(
                  `offboarding-manager-${row.id}`,
                  () => transitionOffboardingCase(row.id, "MANAGER_CONFIRM"),
                  hrOffboardingWorkitemsQuery.queryKey
                )
            },
            {
              label: "解锁",
              disabled:
                pendingAction !== "" ||
                !row.isLocked ||
                row.status === "DRAFT" ||
                row.status === "ARCHIVED" ||
                row.status === "CANCELLED",
              onClick: () =>
                runAction(`offboarding-unlock-${row.id}`, () => unlockOffboardingCase(row.id), hrOffboardingWorkitemsQuery.queryKey)
            },
            {
              label: "锁定",
              disabled: pendingAction !== "" || row.isLocked || row.status === "ARCHIVED" || row.status === "CANCELLED",
              onClick: () =>
                runAction(`offboarding-lock-${row.id}`, () => lockOffboardingCase(row.id), hrOffboardingWorkitemsQuery.queryKey)
            }
          ]}
        />
      </section>

      <section style={panelStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>最近操作事件</h2>
          <p style={{ margin: 0, color: "#475569" }}>保留原工作台的事件回显能力，便于确认流转和锁定动作结果。</p>
        </div>
        <ActionEventTimeline events={latestEvents} />
      </section>
    </section>
  );
}
