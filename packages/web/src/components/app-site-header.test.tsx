import React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

  it("uses larger touch targets for the mobile menu controls", () => {
    render(<AppSiteHeader sticky={false} />);

    const menuButton = screen.getByRole("button", { name: "Open menu" });
    expect(menuButton).toHaveClass("relative");
    expect(menuButton.querySelector("span[aria-hidden='true']")).toHaveClass(
      "size-[max(100%,3rem)]",
    );
    expect(menuButton.querySelector("span[aria-hidden='true']")).not.toHaveClass(
      "pointer-events-none",
    );

    fireEvent.click(menuButton);

    expect(screen.getAllByRole("link", { name: "Catalog" })[1]).toHaveClass(
      "min-h-12",
      "md:min-h-0",
    );
    const mobileNav = screen.getAllByRole("navigation", { name: "Site" }).at(-1);
    expect(mobileNav).toBeInTheDocument();
    expect(
      within(mobileNav!)
        .getByRole("link", { name: "Upload" })
        .querySelector(".lucide-arrow-up-right"),
    ).toHaveClass("size-4", "md:size-3");
  });
});
