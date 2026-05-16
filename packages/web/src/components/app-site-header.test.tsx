import React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AppSiteHeader } from "./app-site-header";

describe("AppSiteHeader", () => {
  beforeEach(() => {
    cleanup();
  });

  it("keeps the padded header shell inside the viewport box", () => {
    const { container } = render(<AppSiteHeader sticky={false} />);

    expect(container.querySelector("header > div")).toHaveClass("box-border");
  });

  it("renders the mobile close backdrop outside the blurred header", () => {
    const { container } = render(<AppSiteHeader sticky={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const header = container.querySelector("header");
    const closeBackdrop = container.querySelector("button.fixed.inset-0");
    const drawer = container.querySelector("[id][class*='fixed']");

    expect(closeBackdrop).toBeInTheDocument();
    expect(drawer).toBeInTheDocument();
    expect(header?.contains(closeBackdrop)).toBe(false);
    expect(header?.contains(drawer)).toBe(false);
  });
});
