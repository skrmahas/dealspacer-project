import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import LandingPage from "./page";

describe("LandingPage", () => {
  beforeEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders lead capture form", () => {
    render(<LandingPage />);
    expect(screen.getByText("Request Early Access")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get Early Access" })).toBeInTheDocument();
  });

  it("validates email before submit", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<LandingPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bad-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Get Early Access" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits lead and shows success state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    );

    render(<LandingPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "hello@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Get Early Access" }));

    expect(await screen.findByText("You are on the early-access list.")).toBeInTheDocument();
  });
});
