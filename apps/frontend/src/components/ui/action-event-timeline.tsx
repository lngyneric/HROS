import type { ActionEvent } from "@/modules/onboarding/types";

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

const containerStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  margin: 0,
  padding: 0,
  listStyle: "none"
};

const itemStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #dbe4f0",
  background: "#f8fbff"
};

const badgeStyle: Record<ActionEvent["status"], React.CSSProperties> = {
  ok: {
    color: "#166534",
    background: "#dcfce7"
  },
  failed: {
    color: "#991b1b",
    background: "#fee2e2"
  }
};

export function ActionEventTimeline(props: { events: ActionEvent[] }) {
  if (props.events.length === 0) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 16,
          border: "1px dashed #cbd5e1",
          color: "#64748b",
          background: "#fff"
        }}
      >
        暂无最近操作事件
      </div>
    );
  }

  return (
    <ol style={containerStyle}>
      {props.events.map((event) => (
        <li key={`${event.eventType}-${event.timestamp}`} style={itemStyle}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <code
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                background: "#e2e8f0",
                color: "#0f172a"
              }}
            >
              {event.eventType}
            </code>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                ...badgeStyle[event.status]
              }}
            >
              {event.status}
            </span>
            <span style={{ color: "#0f172a", fontWeight: 600 }}>{event.summary}</span>
          </div>
          <span style={{ color: "#64748b", fontSize: 13 }}>{formatTimestamp(event.timestamp)}</span>
        </li>
      ))}
    </ol>
  );
}
