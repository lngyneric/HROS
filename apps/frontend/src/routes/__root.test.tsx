import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RootLoading } from "./__root";

describe("root loading view", () => {
  it("renders the loading shell", () => {
    render(<RootLoading />);

    expect(screen.getByText("加载中")).toBeInTheDocument();
  });
});
