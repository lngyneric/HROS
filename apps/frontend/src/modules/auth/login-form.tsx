import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getCurrentUser, getRoleHomePath, login } from "./service";

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 8
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 14
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  background: "#2563eb",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer"
};

export function LoginForm() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);

        try {
          setSubmitting(true);
          setErrorMessage("");

          await login({
            email: String(formData.get("email") ?? ""),
            password: String(formData.get("password") ?? "")
          });

          const me = await getCurrentUser();
          await navigate({ to: getRoleHomePath(me.role) });
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "登录失败");
        } finally {
          setSubmitting(false);
        }
      }}
      style={{ display: "grid", gap: 16 }}
    >
      <div style={fieldStyle}>
        <label htmlFor="login-email">邮箱</label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue="employee@hros.local"
          required
          style={inputStyle}
        />
      </div>

      <div style={fieldStyle}>
        <label htmlFor="login-password">密码</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          defaultValue="password12345"
          required
          style={inputStyle}
        />
      </div>

      <button type="submit" disabled={submitting} style={{ ...buttonStyle, opacity: submitting ? 0.7 : 1 }}>
        {submitting ? "登录中..." : "登录"}
      </button>

      {errorMessage ? (
        <p role="alert" style={{ margin: 0, color: "#dc2626" }}>
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
