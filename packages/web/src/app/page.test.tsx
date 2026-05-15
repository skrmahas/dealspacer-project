import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import LandingPage from "./page";

describe("LandingPage", () => {
  beforeEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders hero section with DealSpacer branding", () => {
    render(<LandingPage />);
    expect(screen.getByText("DealSpacer")).toBeInTheDocument();
    expect(screen.getByText("Request Early Access")).toBeInTheDocument();
  });

  it("renders lead capture form", () => {
    render(<LandingPage />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get Early Access" })).toBeInTheDocument();
  });

  it("renders How It Works section", () => {
    render(<LandingPage />);
    expect(screen.getByText("How It Works")).toBeInTheDocument();
    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText("Analyze")).toBeInTheDocument();
    expect(screen.getByText("Download")).toBeInTheDocument();
  });

  it("renders What You Get section with feature list", () => {
    render(<LandingPage />);
    expect(screen.getByText("What You Get")).toBeInTheDocument();
    expect(screen.getByText(/Key metrics dashboard/)).toBeInTheDocument();
    expect(screen.getByText(/Revenue breakdown/)).toBeInTheDocument();
    expect(screen.getByText(/Management tone/)).toBeInTheDocument();
  });

  it("renders FAQ section", () => {
    render(<LandingPage />);
    expect(screen.getByText("Frequently Asked Questions")).toBeInTheDocument();
    expect(screen.getByText("What types of documents can I upload?")).toBeInTheDocument();
    expect(screen.getByText("Which languages are supported?")).toBeInTheDocument();
    expect(screen.getByText("Is my data secure?")).toBeInTheDocument();
  });

  it("renders footer with links", () => {
    render(<LandingPage />);
    expect(screen.getByText("Open App")).toBeInTheDocument();
    expect(screen.getByText("Privacy")).toBeInTheDocument();
    expect(screen.getByText("Terms")).toBeInTheDocument();
  });
});
