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
    expect(screen.getByText("Get early access")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request early access" })).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /view (a )?sample report/i })
        .some((link) => link.getAttribute("href") === "/sample-report.pdf"),
    ).toBe(true);
    expect(screen.getByText(/Uploaded filings are not used to train public models/i)).toBeInTheDocument();
  });

  it("renders proof, flow, and footer trust links", () => {
    render(<LandingPage />);

    expect(screen.getByText("Native-language filing")).toBeInTheDocument();
    expect(screen.getByText("Parsed investor summary")).toBeInTheDocument();
    expect(screen.getByText("1. Upload Filing")).toBeInTheDocument();
    expect(screen.getByText("2. AI Decodes & Translates")).toBeInTheDocument();
    expect(screen.getByText("3. Export PDF / Excel-ready Summary")).toBeInTheDocument();
    expect(screen.getByText("Frequently asked questions")).toBeInTheDocument();
    expect(screen.getByText("What file types can I upload?")).toBeInTheDocument();
    expect(screen.getByText("How accurate is the output?")).toBeInTheDocument();
    expect(screen.getByText("Is my data used to train public models?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact Us" })).toHaveAttribute("href", "mailto:hello@dealspacer.com");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
  });

  it("validates email before submit", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<LandingPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bad-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Request early access" }));

    expect(await screen.findByText("Enter a valid email.")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Request early access" }));

    expect(await screen.findByText("You're on the list")).toBeInTheDocument();
  });
});
