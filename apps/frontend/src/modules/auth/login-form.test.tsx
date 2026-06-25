import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
const loginMock = vi.fn();
const getCurrentUserMock = vi.fn();
const getRoleHomePathMock = vi.fn();

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");

  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

vi.mock("./service", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
  getRoleHomePath: (...args: unknown[]) => getRoleHomePathMock(...args),
  login: (...args: unknown[]) => loginMock(...args)
}));

import { LoginForm } from "./login-form";

describe("login form", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    loginMock.mockReset();
    getCurrentUserMock.mockReset();
    getRoleHomePathMock.mockReset();
  });

  it("submits credentials and navigates to the role home", async () => {
    const user = userEvent.setup();

    loginMock.mockResolvedValue({ token: "token-123" });
    getCurrentUserMock.mockResolvedValue({ role: "EMPLOYEE_SELF" });
    getRoleHomePathMock.mockReturnValue("/self");

    render(<LoginForm />);

    await user.clear(screen.getByLabelText("邮箱"));
    await user.type(screen.getByLabelText("邮箱"), "employee@hros.local");
    await user.clear(screen.getByLabelText("密码"));
    await user.type(screen.getByLabelText("密码"), "password12345");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        email: "employee@hros.local",
        password: "password12345"
      });
    });
    expect(getCurrentUserMock).toHaveBeenCalledTimes(1);
    expect(getRoleHomePathMock).toHaveBeenCalledWith("EMPLOYEE_SELF");
    expect(navigateMock).toHaveBeenCalledWith({ to: "/self" });
  });

  it("renders service errors", async () => {
    const user = userEvent.setup();

    loginMock.mockRejectedValue(new Error("凭证错误"));

    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("凭证错误");
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
