import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActionEventTimeline } from "@/components/ui/action-event-timeline";
import { onboardingCasesQuery } from "../queries";
import { useCreateOnboardingDraft, useSubmitOnboardingCase } from "../mutations";
import type { ActionEvent, OnboardingCase } from "../types";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN");
}

function createSyntheticEvent(caseItem: OnboardingCase): ActionEvent {
  return {
    eventType: "onboarding.submit",
    status: "ok",
    summary: `已提交入职草稿 ${caseItem.id}`,
    timestamp: new Date().toISOString(),
    payload: {
      caseId: caseItem.id,
      status: caseItem.status
    }
  };
}

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
  padding: 24,
  borderRadius: 24,
  background: "#ffffff",
  boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)"
};

const actionBarStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  alignItems: "center"
};

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "10px 16px",
  fontWeight: 600,
  cursor: "pointer"
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#e2e8f0",
  color: "#0f172a"
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#2563eb",
  color: "#ffffff"
};

export function SelfOnboardingView() {
  const onboardingQuery = useQuery(onboardingCasesQuery);
  const createMutation = useCreateOnboardingDraft();
  const submitMutation = useSubmitOnboardingCase();
  const [latestEvents, setLatestEvents] = useState<ActionEvent[]>([]);

  const latestDraft = useMemo(
    () => onboardingQuery.data?.find((caseItem) => caseItem.status === "DRAFT"),
    [onboardingQuery.data]
  );

  const errorMessage =
    (onboardingQuery.error instanceof Error && onboardingQuery.error.message) ||
    (createMutation.error instanceof Error && createMutation.error.message) ||
    (submitMutation.error instanceof Error && submitMutation.error.message) ||
    "";

  return (
    <section style={sectionStyle}>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <h2 style={{ margin: 0, fontSize: 24 }}>入职办理</h2>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
              继续复用现有入职接口，支持员工创建草稿、查看当前记录并提交最新草稿。
            </p>
          </div>
          <div
            style={{
              minWidth: 180,
              padding: 16,
              borderRadius: 16,
              background: "#eff6ff",
              color: "#1d4ed8"
            }}
          >
            <div style={{ fontSize: 13 }}>当前草稿</div>
            <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700 }}>{latestDraft ? latestDraft.id : "暂无草稿"}</div>
          </div>
        </div>

        <div style={actionBarStyle}>
          <button
            type="button"
            style={{ ...secondaryButtonStyle, opacity: createMutation.isPending ? 0.7 : 1 }}
            disabled={createMutation.isPending || submitMutation.isPending}
            onClick={async () => {
              const result = await createMutation.mutateAsync();
              setLatestEvents(result.events);
            }}
          >
            {createMutation.isPending ? "创建中..." : "创建草稿"}
          </button>

          <button
            type="button"
            style={{ ...primaryButtonStyle, opacity: latestDraft && !submitMutation.isPending ? 1 : 0.6 }}
            disabled={!latestDraft || createMutation.isPending || submitMutation.isPending}
            onClick={async () => {
              if (!latestDraft) {
                return;
              }

              const result = await submitMutation.mutateAsync(latestDraft.id);
              setLatestEvents([createSyntheticEvent(result)]);
            }}
          >
            {submitMutation.isPending ? "提交中..." : "提交最新草稿"}
          </button>

          <button
            type="button"
            style={{ ...secondaryButtonStyle, opacity: onboardingQuery.isFetching ? 0.7 : 1 }}
            disabled={onboardingQuery.isFetching}
            onClick={() => {
              void onboardingQuery.refetch();
            }}
          >
            {onboardingQuery.isFetching ? "刷新中..." : "刷新"}
          </button>
        </div>

        {errorMessage ? (
          <p
            role="alert"
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 12,
              background: "#fef2f2",
              color: "#b91c1c"
            }}
          >
            {errorMessage}
          </p>
        ) : null}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ padding: "0 0 12px" }}>工单 ID</th>
              <th style={{ padding: "0 0 12px" }}>状态</th>
              <th style={{ padding: "0 0 12px" }}>锁定</th>
              <th style={{ padding: "0 0 12px" }}>任务数</th>
              <th style={{ padding: "0 0 12px" }}>创建时间</th>
            </tr>
          </thead>
          <tbody>
            {(onboardingQuery.data ?? []).map((caseItem) => (
              <tr key={caseItem.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "14px 0", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{caseItem.id}</td>
                <td style={{ padding: "14px 0" }}>{caseItem.status}</td>
                <td style={{ padding: "14px 0" }}>{caseItem.isLocked ? "是" : "否"}</td>
                <td style={{ padding: "14px 0" }}>{caseItem.items?.length ?? 0}</td>
                <td style={{ padding: "14px 0", color: "#475569" }}>{formatDate(caseItem.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!onboardingQuery.isPending && (onboardingQuery.data?.length ?? 0) === 0 ? (
          <div
            style={{
              padding: 20,
              borderRadius: 16,
              background: "#f8fafc",
              color: "#64748b"
            }}
          >
            暂无入职记录，请先创建草稿。
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>最近操作事件</h3>
        <ActionEventTimeline events={latestEvents} />
      </div>
    </section>
  );
}
