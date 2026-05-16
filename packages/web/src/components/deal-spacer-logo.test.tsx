import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DealSpacerLogoLink } from "./deal-spacer-logo";

describe("DealSpacerLogoLink", () => {
  it("expands the touch target on coarse pointers without changing logo density", () => {
    render(<DealSpacerLogoLink />);

    const link = screen.getByRole("link", { name: "DealSpacer" });
    expect(link).toHaveClass("relative", "inline-flex");

    const touchTarget = link.querySelector("span[aria-hidden='true']");
    expect(touchTarget).toHaveClass(
      "absolute",
      "hidden",
      "size-[max(100%,2.75rem)]",
      "[@media(any-pointer:coarse)]:block",
    );
    expect(touchTarget).not.toHaveClass("pointer-events-none");
  });
});
