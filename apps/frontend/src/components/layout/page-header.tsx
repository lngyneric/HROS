import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PageHeader(props: PageHeaderProps) {
  return (
    <section
      style={{
        display: "grid",
        gap: 12,
        padding: 24,
        borderRadius: 24,
        background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
        color: "#ffffff",
        boxShadow: "0 20px 50px rgba(15, 23, 42, 0.18)"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap"
        }}
      >
        <div style={{ display: "grid", gap: 8, maxWidth: 760 }}>
          {props.eyebrow ? <p style={{ margin: 0, opacity: 0.82, fontWeight: 700 }}>{props.eyebrow}</p> : null}
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.2 }}>{props.title}</h1>
          <p style={{ margin: 0, lineHeight: 1.7, opacity: 0.92 }}>{props.description}</p>
        </div>
        {props.actions ? <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{props.actions}</div> : null}
      </div>
    </section>
  );
}
